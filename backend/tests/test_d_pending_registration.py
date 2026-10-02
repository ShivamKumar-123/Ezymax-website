"""Section D2 regressions: pending registration can't be hijacked by a second
/register/start, attempt budget survives resend, cancel needs the OTP,
uniform response for registered emails, resend has a DB session (500 bug).
"""
import asyncio
import json
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from packages.common.src import settings_store, smtp_mail
from services.gateway.src.services import pending_registration_service as prs

EMAIL = "new@x.com"


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, k):
        return self.store.get(k)

    async def set(self, k, v, ex=None, nx=False, xx=False, **kw):
        if nx and k in self.store:
            return None
        if xx and k not in self.store:
            return None
        self.store[k] = v
        return True

    async def delete(self, k):
        return 1 if self.store.pop(k, None) is not None else 0

    async def incr(self, k):
        self.store[k] = int(self.store.get(k, 0)) + 1
        return self.store[k]

    async def expire(self, k, ttl):
        return True

    async def ttl(self, k):
        return 500


class _Res:
    def __init__(self, v):
        self._v = v

    def scalar_one_or_none(self):
        return self._v


class _DB:
    def __init__(self, registered=False):
        self.registered = registered

    async def execute(self, *a, **k):
        return _Res("id" if self.registered else None)


def _req():
    return SimpleNamespace(headers={}, client=None)


async def _noop(*a, **k):
    return None


class PendingRegistrationTests(unittest.TestCase):
    def setUp(self):
        self.r = _FakeRedis()
        self.sent = []
        self._orig = {
            "redis_client": prs.redis_client,
            "rate_limit_http": prs.rate_limit_http,
            "apply_email_brand_for_signup": prs.apply_email_brand_for_signup,
            "hash_password": prs.hash_password,
            "verify_password": prs.verify_password,
            "_send_in_background": prs._send_in_background,
        }
        prs.redis_client = self.r
        prs.rate_limit_http = lambda *a, **k: None
        prs.apply_email_brand_for_signup = _noop
        prs.hash_password = lambda p: "H:" + p
        prs.verify_password = lambda p, h: h == "H:" + p
        prs._send_in_background = lambda e, s, h, t: self.sent.append((e, s, t))
        self._orig_gbs = settings_store.get_bool_setting

        async def _gbs(name, default=False):
            return default
        settings_store.get_bool_setting = _gbs
        self._orig_smtp = (smtp_mail.smtp_configured, smtp_mail.send_email)
        smtp_mail.smtp_configured = lambda: True

        async def _send(*a, **k):
            self.sent.append(a)
            return True
        smtp_mail.send_email = _send

    def tearDown(self):
        for k, v in self._orig.items():
            setattr(prs, k, v)
        settings_store.get_bool_setting = self._orig_gbs
        smtp_mail.smtp_configured, smtp_mail.send_email = self._orig_smtp

    def _start(self, password="Passw0rd!", referral=None, db=None):
        return asyncio.run(prs.start_pending_registration(
            email=EMAIL, password=password, first_name="A", last_name="B",
            phone=None, country=None, referral_code=referral,
            request=_req(), db=db or _DB(),
        ))

    def _entry(self):
        raw = self.r.store.get(prs._redis_key(EMAIL))
        return json.loads(raw) if raw else None

    def _set_otp(self, otp="111111"):
        e = self._entry()
        e["otp_hash"] = prs._hash_otp(otp, e["otp_salt"])
        self.r.store[prs._redis_key(EMAIL)] = json.dumps(e)

    def test_second_start_with_other_password_voids_and_contests(self):
        self._start("Passw0rd!")
        original = self._entry()
        self.assertEqual(original["password_hash"], "H:Passw0rd!")
        out = self._start("Attack3r!pw")
        self.assertEqual(out, prs._UNIFORM_START_RESPONSE)
        self.assertIsNone(self._entry())  # voided, NOT overwritten
        self.assertEqual(self.r.store.get(prs._contested_key(EMAIL)), "1")

    def test_second_start_other_referral_does_not_overwrite(self):
        self._start("Passw0rd!", referral="REF1")
        self._start("Passw0rd!", referral="EVIL")
        self.assertIsNone(self._entry())

    def test_same_person_restart_keeps_entry(self):
        self._start("Passw0rd!")
        first = self._entry()
        self._start("Passw0rd!")
        self.assertEqual(self._entry()["password_hash"], first["password_hash"])
        self.assertEqual(self._entry()["otp_hash"], first["otp_hash"])  # within cooldown

    def test_contested_verify_requires_password(self):
        self._start("Passw0rd!")
        self._start("Other1!pw")      # contest → void
        self._start("Other1!pw")      # attacker restarts
        self._set_otp("111111")
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(prs.complete_pending_registration(
                email=EMAIL, otp="111111", request=_req(), db=_DB()))
        self.assertIn("PASSWORD_REQUIRED", ctx.exception.detail)

    def test_attempt_budget_survives_resend(self):
        self._start("Passw0rd!")
        for _ in range(3):
            with self.assertRaises(HTTPException):
                asyncio.run(prs.complete_pending_registration(
                    email=EMAIL, otp="000000", request=_req(), db=_DB()))
        asyncio.run(prs.resend_pending_otp(email=EMAIL, request=_req(), db=_DB()))
        self.assertEqual(self.r.store[prs._attempts_key(EMAIL)], 3)
        for _ in range(2):
            with self.assertRaises(HTTPException):
                asyncio.run(prs.complete_pending_registration(
                    email=EMAIL, otp="000000", request=_req(), db=_DB()))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(prs.complete_pending_registration(
                email=EMAIL, otp="000000", request=_req(), db=_DB()))
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIsNone(self._entry())

    def test_wrong_password_on_verify_rejected(self):
        self._start("Passw0rd!")
        self._set_otp("111111")
        with self.assertRaises(HTTPException):
            asyncio.run(prs.complete_pending_registration(
                email=EMAIL, otp="111111", request=_req(), db=_DB(), password="nope"))

    def test_cancel_requires_otp(self):
        self._start("Passw0rd!")
        with self.assertRaises(HTTPException):
            asyncio.run(prs.cancel_pending_registration(email=EMAIL))
        with self.assertRaises(HTTPException):
            asyncio.run(prs.cancel_pending_registration(email=EMAIL, otp="000000"))
        self.assertIsNotNone(self._entry())
        self._set_otp("222222")
        asyncio.run(prs.cancel_pending_registration(email=EMAIL, otp="222222"))
        self.assertIsNone(self._entry())

    def test_registered_email_gets_uniform_response(self):
        out = self._start("Passw0rd!", db=_DB(registered=True))
        self.assertEqual(out, prs._UNIFORM_START_RESPONSE)
        self.assertIsNone(self._entry())

    def test_otp_compare_is_constant_time(self):
        import inspect
        self.assertIn("compare_digest", inspect.getsource(prs._otp_matches))


class ResendRouteHasDbTests(unittest.TestCase):
    def test_route_declares_db_dependency(self):
        import inspect
        from services.gateway.src.api import auth as auth_api
        self.assertIn("db", inspect.signature(auth_api.register_resend).parameters)
        self.assertIn("db", inspect.signature(prs.resend_pending_otp).parameters)


if __name__ == "__main__":
    unittest.main()
