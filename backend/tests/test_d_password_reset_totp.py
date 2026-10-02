"""Section D1 (password reset) + D5 (TOTP replay, login enumeration, password
change policy, wallet-login gates) regressions. Fake DB / fake Redis only.
"""
import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

import pyotp

from packages.common.src import user_credentials as uc
from services.gateway.src.services import auth_service as svc
from services.gateway.src.services import wallet_auth_service as was
from services.gateway.src.services.auth_service import AuthServiceError


class _Result:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val

    def scalars(self):
        return self

    def all(self):
        return list(self._val) if isinstance(self._val, (list, tuple)) else []


class _FakeDB:
    def __init__(self, results=()):
        self._results = list(results)
        self.statements = []
        self.committed = False

    async def execute(self, stmt, *a, **k):
        self.statements.append(stmt)
        return _Result(self._results.pop(0) if self._results else None)

    async def get(self, *a, **k):
        return None

    async def commit(self):
        self.committed = True

    def add(self, *a, **k):
        pass

    async def flush(self):
        pass


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def incr(self, key):
        self.store[key] = int(self.store.get(key, 0)) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        return True

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, val, ex=None, **kw):
        self.store[key] = val
        return True


class _DownRedis:
    async def incr(self, key):
        raise ConnectionError("redis down")

    async def expire(self, key, ttl):
        raise ConnectionError("redis down")


async def _noop(*a, **k):
    return None


class ResetPasswordTests(unittest.TestCase):
    def setUp(self):
        self._orig = {k: getattr(svc, k) for k in (
            "assert_same_origin_or_tenant", "rate_limit_http", "hash_token",
            "hash_password", "redis_client", "revoke_user_credentials")}
        svc.assert_same_origin_or_tenant = _noop
        svc.rate_limit_http = lambda *a, **k: None
        svc.hash_token = lambda t: "H(" + t + ")"
        svc.hash_password = lambda p: "bcrypt$" + p

    def tearDown(self):
        for k, v in self._orig.items():
            setattr(svc, k, v)

    def test_unknown_email_never_queries_tokens(self):
        svc.redis_client = _FakeRedis()
        db = _FakeDB([None])  # user lookup → none
        with self.assertRaises(AuthServiceError):
            asyncio.run(svc.reset_password("123456", "NewPass123!", None, db, email="nobody@x.com"))
        self.assertEqual(len(db.statements), 1)  # only the user lookup
        sql = str(db.statements[0]).lower()
        self.assertIn("lower(", sql)

    def test_cap_fails_closed_when_redis_down(self):
        svc.redis_client = _DownRedis()
        db = _FakeDB([SimpleNamespace(id="u1")])
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.reset_password("123456", "NewPass123!", None, db, email="a@x.com"))
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(db.statements, [])  # refused before any lookup

    def test_cap_charged_before_lookup(self):
        r = _FakeRedis()
        r.store[f"pwreset_attempts_email:{svc._email_key('a@x.com')}"] = 10
        svc.redis_client = r
        db = _FakeDB([SimpleNamespace(id="u1")])
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.reset_password("123456", "NewPass123!", None, db, email="A@X.com"))
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(db.statements, [])

    def test_missing_email_refused(self):
        svc.redis_client = _FakeRedis()
        db = _FakeDB([])
        with self.assertRaises(AuthServiceError):
            asyncio.run(svc.reset_password("123456", "NewPass123!", None, db, email=None))
        self.assertEqual(db.statements, [])

    def test_token_query_scoped_to_user(self):
        svc.redis_client = _FakeRedis()
        user = SimpleNamespace(id=uuid4(), email="a@x.com", password_hash="old")
        row = SimpleNamespace(id="t1", user_id=user.id, used=False)

        async def _revoke(db, uid, **kw):
            return []
        svc.revoke_user_credentials = _revoke
        db = _FakeDB([user, row])
        asyncio.run(svc.reset_password("123456", "NewPass123!", None, db, email="a@x.com"))
        self.assertIn("password_reset_tokens.user_id", str(db.statements[1]))
        self.assertEqual(user.password_hash, "bcrypt$NewPass123!")


class ForgotPasswordTests(unittest.TestCase):
    def setUp(self):
        self._orig = {k: getattr(svc, k) for k in (
            "assert_same_origin_or_tenant", "rate_limit_http", "redis_client")}
        svc.assert_same_origin_or_tenant = _noop
        svc.rate_limit_http = lambda *a, **k: None
        svc.redis_client = _FakeRedis()

    def tearDown(self):
        for k, v in self._orig.items():
            setattr(svc, k, v)

    def test_unknown_email_uniform_and_lowercased(self):
        db = _FakeDB([None])
        out = asyncio.run(svc.forgot_password("Some@X.com", None, db))
        self.assertIn("If an account exists", out["message"])
        self.assertIn("lower(", str(db.statements[0]).lower())


class TotpReplayTests(unittest.TestCase):
    def test_same_code_rejected_second_time(self):
        secret = pyotp.random_base32()
        code = pyotp.TOTP(secret).now()
        r = _FakeRedis()
        uid = uuid4()
        self.assertTrue(asyncio.run(uc.verify_totp_once(uid, secret, code, client=r)))
        self.assertFalse(asyncio.run(uc.verify_totp_once(uid, secret, code, client=r)))

    def test_local_fallback_blocks_replay_when_redis_down(self):
        secret = pyotp.random_base32()
        code = pyotp.TOTP(secret).now()
        uid = uuid4()

        class _Boom:
            async def get(self, k):
                raise ConnectionError("down")
        self.assertTrue(asyncio.run(uc.verify_totp_once(uid, secret, code, client=_Boom())))
        self.assertFalse(asyncio.run(uc.verify_totp_once(uid, secret, code, client=_Boom())))

    def test_wrong_code_rejected(self):
        self.assertFalse(asyncio.run(uc.verify_totp_once(uuid4(), pyotp.random_base32(), "abc")))

    def test_login_2fa_replay_rejected(self):
        secret = pyotp.random_base32()
        user = SimpleNamespace(id=uuid4(), two_factor_enabled=True, two_factor_secret=secret)
        code = pyotp.TOTP(secret).now()
        orig = svc.consume_2fa_backup_code

        async def _no_backup(*a, **k):
            return False
        svc.consume_2fa_backup_code = _no_backup
        try:
            asyncio.run(svc._enforce_2fa(user, code, None))  # first use OK
            with self.assertRaises(AuthServiceError) as ctx:
                asyncio.run(svc._enforce_2fa(user, code, None))  # replay
            self.assertEqual(ctx.exception.status_code, 401)
        finally:
            svc.consume_2fa_backup_code = orig


class LoginEnumerationTests(unittest.TestCase):
    def setUp(self):
        self._orig = {k: getattr(svc, k) for k in (
            "assert_same_origin_or_tenant", "rate_limit_http", "dummy_password_check")}
        svc.assert_same_origin_or_tenant = _noop
        svc.rate_limit_http = lambda *a, **k: None
        self.dummy_calls = 0

        def _dummy(pw):
            self.dummy_calls += 1
        svc.dummy_password_check = _dummy

    def tearDown(self):
        for k, v in self._orig.items():
            setattr(svc, k, v)

    def test_unknown_account_runs_dummy_bcrypt(self):
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.login_user("ghost@x.com", "pw", None, SimpleNamespace(headers={}), _FakeDB([None])))
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(self.dummy_calls, 1)


class ChangePasswordPolicyTests(unittest.TestCase):
    def setUp(self):
        self._orig_r = svc.redis_client
        svc.redis_client = _FakeRedis()

    def tearDown(self):
        svc.redis_client = self._orig_r

    def test_weak_new_password_refused(self):
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.change_password(uuid4(), "OldPass1!", "12345678", _FakeDB([])))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_rate_limited_per_user(self):
        uid = uuid4()
        svc.redis_client.store[f"pwchange_attempts:{uid}"] = 5
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.change_password(uid, "OldPass1!", "N3w-Strong-Pass!", _FakeDB([])))
        self.assertEqual(ctx.exception.status_code, 429)


class WalletLoginGateTests(unittest.TestCase):
    def setUp(self):
        self._orig = (was.verify_message, was.resolve_or_create_user, was.issue_auth_json_response)

        async def _verify(*a, **k):
            return "0xabc", SimpleNamespace(chain_id=1)
        was.verify_message = _verify

        async def _issue(*a, **k):
            return "ISSUED"
        was.issue_auth_json_response = _issue
        from packages.common.src import settings_store
        self._ss = settings_store
        self._orig_gbs = settings_store.get_bool_setting
        self.maintenance = False

        async def _gbs(name, default=False):
            if name == "maintenance_mode":
                return self.maintenance
            return default
        settings_store.get_bool_setting = _gbs

    def tearDown(self):
        was.verify_message, was.resolve_or_create_user, was.issue_auth_json_response = self._orig
        self._ss.get_bool_setting = self._orig_gbs

    def _run(self, user, totp=None):
        async def _resolve(*a, **k):
            return user, False
        was.resolve_or_create_user = _resolve
        req = SimpleNamespace(headers={})
        return asyncio.run(was.login_or_register_with_wallet("m", "s", req, None, totp_code=totp))

    def _user(self, **kw):
        base = dict(id=uuid4(), status="active", role="user", wallet_address="0xabc",
                    two_factor_enabled=False, two_factor_secret=None)
        base.update(kw)
        return SimpleNamespace(**base)

    def test_2fa_enforced_on_wallet_login(self):
        u = self._user(two_factor_enabled=True, two_factor_secret=pyotp.random_base32())
        with self.assertRaises(AuthServiceError) as ctx:
            self._run(u)
        self.assertIn("2fa", ctx.exception.detail.lower())

    def test_2fa_valid_code_allows(self):
        secret = pyotp.random_base32()
        u = self._user(two_factor_enabled=True, two_factor_secret=secret)
        self.assertEqual(self._run(u, pyotp.TOTP(secret).now()), "ISSUED")

    def test_maintenance_blocks_wallet_login(self):
        self.maintenance = True
        with self.assertRaises(AuthServiceError) as ctx:
            self._run(self._user())
        self.assertEqual(ctx.exception.status_code, 503)

    def test_suspended_blocked(self):
        with self.assertRaises(AuthServiceError) as ctx:
            self._run(self._user(status="suspended"))
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
