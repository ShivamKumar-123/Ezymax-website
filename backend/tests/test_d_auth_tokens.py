"""Section D5/D6 regressions: session tokens, impersonation hand-off, bcrypt
72-byte limit, admin/trader secret separation.
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
from fastapi import HTTPException
from pydantic import ValidationError

from packages.common.src import auth as common_auth
from packages.common.src import config
from packages.common.src.config import get_settings
from packages.common.src.password_policy import validate_password_strength
from services.gateway.src.services import auth_service as svc
from services.gateway.src.services.auth_service import AuthServiceError

S = get_settings()
_COOKIE = S.ACCESS_TOKEN_COOKIE_NAME


def _tok(sub, *, iat=None, exp_s=3600, **extra):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(sub), "role": "user",
        "iat": iat or now, "exp": (iat or now) + timedelta(seconds=exp_s),
    }
    payload.update(extra)
    return jwt.encode(payload, S.JWT_SECRET, algorithm=S.JWT_ALGORITHM)


def _req(token):
    return SimpleNamespace(cookies={_COOKIE: token}, headers={})


class GetCurrentUserTests(unittest.TestCase):
    def setUp(self):
        self._orig = (common_auth._get_user_status, common_auth._session_is_active)

        async def _status(uid):
            return "active"

        async def _active(sid):
            return True
        common_auth._get_user_status = _status
        common_auth._session_is_active = _active

    def tearDown(self):
        common_auth._get_user_status, common_auth._session_is_active = self._orig

    def test_sidless_token_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(common_auth.get_current_user(_req(_tok(uuid4())), credentials=None))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_handoff_token_rejected_even_with_sid(self):
        tok = _tok(uuid4(), sid=str(uuid4()), typ="impersonation", impersonated_by=str(uuid4()))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(common_auth.get_current_user(_req(tok), credentials=None))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_raw_legacy_handoff_rejected(self):
        tok = _tok(uuid4(), impersonated_by=str(uuid4()))
        with self.assertRaises(HTTPException):
            asyncio.run(common_auth.get_current_user(_req(tok), credentials=None))

    def test_session_token_accepted(self):
        uid = uuid4()
        out = asyncio.run(common_auth.get_current_user(
            _req(_tok(uid, sid=str(uuid4()), amr="login")), credentials=None))
        self.assertEqual(out["user_id"], uid)

    def test_verify_session_token_helper(self):
        self.assertIsNone(asyncio.run(common_auth.verify_session_token(_tok(uuid4()))))
        self.assertIsNone(asyncio.run(common_auth.verify_session_token(None)))
        uid = uuid4()
        out = asyncio.run(common_auth.verify_session_token(_tok(uid, sid=str(uuid4()))))
        self.assertEqual(out["user_id"], uid)


class _DBGet:
    def __init__(self, user):
        self._user = user

    async def get(self, *a, **k):
        return self._user


class ImpersonationHandoffTests(unittest.TestCase):
    def setUp(self):
        self._orig = (svc.rate_limit_http, svc.issue_auth_json_response)
        svc.rate_limit_http = lambda *a, **k: None
        self.calls = []

        async def _issue(user, request, db, **kw):
            self.calls.append(kw)
            return "ISSUED"
        svc.issue_auth_json_response = _issue

    def tearDown(self):
        svc.rate_limit_http, svc.issue_auth_json_response = self._orig

    def _user(self):
        return SimpleNamespace(id=uuid4(), status="active")

    def test_new_typ_impersonation_token_accepted_30min_no_refresh(self):
        u = self._user()
        tok = _tok(u.id, exp_s=120, typ="impersonation", impersonated_by=str(uuid4()))
        self.assertEqual(asyncio.run(svc.bootstrap_session(tok, None, _DBGet(u))), "ISSUED")
        kw = self.calls[0]
        self.assertEqual(kw["amr_override"], "impersonation")
        self.assertIs(kw["issue_refresh"], False)
        self.assertEqual(kw["access_ttl"], timedelta(minutes=30))

    def test_legacy_token_still_accepted_during_rollout(self):
        u = self._user()
        tok = _tok(u.id, exp_s=7200, impersonated_by=str(uuid4()))
        self.assertEqual(asyncio.run(svc.bootstrap_session(tok, None, _DBGet(u))), "ISSUED")

    def test_stale_handoff_token_rejected(self):
        u = self._user()
        old = datetime.now(timezone.utc) - timedelta(minutes=10)
        tok = _tok(u.id, iat=old, exp_s=7200, impersonated_by=str(uuid4()))
        with self.assertRaises(AuthServiceError):
            asyncio.run(svc.bootstrap_session(tok, None, _DBGet(u)))
        self.assertEqual(self.calls, [])

    def test_typ_without_admin_rejected(self):
        u = self._user()
        tok = _tok(u.id, exp_s=120, typ="impersonation")
        with self.assertRaises(AuthServiceError):
            asyncio.run(svc.bootstrap_session(tok, None, _DBGet(u)))


class BcryptLimitTests(unittest.TestCase):
    def test_hash_refuses_over_72_bytes(self):
        with self.assertRaises(ValueError):
            common_auth.hash_password("é" * 40)  # 80 UTF-8 bytes

    def test_policy_refuses_over_72_bytes(self):
        with self.assertRaises(ValueError):
            validate_password_strength("Aa1!" + "é" * 40)
        self.assertTrue(validate_password_strength("Aa1!goodpassword"))

    def test_verify_truncates_like_legacy_bcrypt(self):
        import bcrypt
        long_pw = "Ab1!" * 25  # 100 bytes — hashed by old bcrypt on its 72-byte prefix
        legacy = bcrypt.hashpw(long_pw.encode()[:72], bcrypt.gensalt()).decode()
        self.assertTrue(common_auth.verify_password(long_pw, legacy))

    def test_schema_rejects_long_reset_password(self):
        from packages.common.src.schemas import ResetPasswordRequest
        with self.assertRaises(ValidationError):
            ResetPasswordRequest(email="a@x.com", token="123456", new_password="Aa1!" + "é" * 40)


class AdminSecretSeparationTests(unittest.TestCase):
    def _s(self, **over):
        base = dict(
            ENVIRONMENT="production",
            JWT_SECRET="j" * 48, ADMIN_JWT_SECRET="a" * 48, USER_JWT_SECRET="u" * 48,
            ADMIN_PASSWORD="Str0ng!-Admin-Passw0rd",
            DATABASE_URL="postgresql+asyncpg://x:Str0ng-pw@db/x",
            TIMESCALE_URL="postgresql+asyncpg://x:Str0ng-pw@db/x",
        )
        base.update(over)
        return SimpleNamespace(**base)

    def test_distinct_secrets_boot(self):
        config._assert_production_secrets(self._s())

    def test_admin_equals_jwt_refused(self):
        with self.assertRaises(RuntimeError):
            config._assert_production_secrets(self._s(ADMIN_JWT_SECRET="j" * 48))

    def test_admin_equals_user_jwt_refused(self):
        with self.assertRaises(RuntimeError):
            config._assert_production_secrets(self._s(ADMIN_JWT_SECRET="u" * 48))

    def test_flag_defaults_off(self):
        self.assertIs(get_settings().WITHDRAWAL_STEP_UP_REQUIRED, False)


if __name__ == "__main__":
    unittest.main()
