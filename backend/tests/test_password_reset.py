"""C-AUTH-1: password reset must be bound to a user, cap attempts, and revoke
existing sessions/refresh tokens on success.

Before the fix reset_password() looked a 6-digit code up globally (any user's
code could match), applied no per-user/per-token attempt cap beyond the shared
IP limit, and left old sessions valid after a reset. Pure-unit: reset_password
is driven directly with a fake DB + fake Redis; module collaborators are
monkeypatched to no-ops.
"""
import asyncio
import unittest
from types import SimpleNamespace

from services.gateway.src.services import auth_service
from services.gateway.src.services.auth_service import AuthServiceError, reset_password


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
    """Returns queued values from execute() in order; records commits."""

    def __init__(self, results):
        self._results = list(results)
        self.committed = False
        self.execute_calls = 0

    async def execute(self, *a, **k):
        self.execute_calls += 1
        val = self._results.pop(0) if self._results else None
        return _Result(val)

    async def get(self, *a, **k):
        return None

    async def commit(self):
        self.committed = True


class _FakeRedis:
    def __init__(self, initial=None):
        self.store = dict(initial or {})

    async def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        return True


async def _noop(*a, **k):
    return None


class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        self._orig = {
            "assert_same_origin_or_tenant": auth_service.assert_same_origin_or_tenant,
            "rate_limit_http": auth_service.rate_limit_http,
            "hash_token": auth_service.hash_token,
            "hash_password": auth_service.hash_password,
            "redis_client": auth_service.redis_client,
        }
        auth_service.assert_same_origin_or_tenant = _noop
        auth_service.rate_limit_http = lambda *a, **k: None
        auth_service.hash_token = lambda t: "H(" + t + ")"
        auth_service.hash_password = lambda p: "bcrypt$" + p

    def tearDown(self):
        for k, v in self._orig.items():
            setattr(auth_service, k, v)

    def test_wrong_email_scopes_token_out(self):
        # user found, but the code does not belong to that user → row is None.
        auth_service.redis_client = _FakeRedis()
        user = SimpleNamespace(id="u1", email="a@x.com")
        db = _FakeDB([user, None])
        with self.assertRaises(AuthServiceError):
            asyncio.run(reset_password("123456", "NewPass123!", request=None, db=db, email="a@x.com"))

    def test_per_user_attempt_cap(self):
        # 10 attempts already recorded → the 11th is refused before any DB lookup.
        user = SimpleNamespace(id="u1", email="a@x.com")
        auth_service.redis_client = _FakeRedis({"pwreset_attempts_user:u1": 10})
        db = _FakeDB([user])
        with self.assertRaises(AuthServiceError):
            asyncio.run(reset_password("123456", "NewPass123!", request=None, db=db, email="a@x.com"))

    def test_success_resets_and_revokes(self):
        auth_service.redis_client = _FakeRedis()
        user = SimpleNamespace(id="u1", email="a@x.com", password_hash="old")
        row = SimpleNamespace(id="t1", user_id="u1", used=False)
        # execute order: select user, select token, then revoke_user_credentials:
        # update refresh, select active session ids, update those sessions,
        # update algo keys.
        db = _FakeDB([user, row, None, ["s1", "s2"], None, None])
        out = asyncio.run(reset_password("123456", "NewPass123!", request=None, db=db, email="a@x.com"))
        self.assertEqual(user.password_hash, "bcrypt$NewPass123!")
        self.assertTrue(row.used)
        self.assertTrue(db.committed)
        # refresh + session-select + session-update + algo-key update ran after the two selects.
        self.assertGreaterEqual(db.execute_calls, 6)
        self.assertIn("message", out)


if __name__ == "__main__":
    unittest.main()
