"""H-AUTH-4: legacy register no longer reclaims an existing account, and a
session cannot be refreshed while the email is unverified.
"""
import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.services import auth_service
from services.gateway.src.services.auth_service import (
    AuthServiceError, register_user, refresh_token,
)
from packages.common.src import settings_store


class _Res:
    def __init__(self, scalar=None):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, results, get_obj=None):
        self._results = list(results)
        self._get_obj = get_obj

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, *a, **k):
        return self._get_obj

    async def flush(self):
        return None


async def _noop(*a, **k):
    return None


class RegisterNoReclaimTests(unittest.TestCase):
    def setUp(self):
        self._orig = {
            "assert": auth_service.assert_same_origin_or_tenant,
            "rl": auth_service.rate_limit_http,
            "gb": settings_store.get_bool_setting,
        }
        auth_service.assert_same_origin_or_tenant = _noop
        auth_service.rate_limit_http = lambda *a, **k: None

        async def _gb(key, default=False):
            return default
        settings_store.get_bool_setting = _gb

    def tearDown(self):
        auth_service.assert_same_origin_or_tenant = self._orig["assert"]
        auth_service.rate_limit_http = self._orig["rl"]
        settings_store.get_bool_setting = self._orig["gb"]

    def test_existing_email_refused_not_reclaimed(self):
        existing = SimpleNamespace(id=uuid4(), email="a@x.com", email_verified=False)
        db = _DB([_Res(scalar=existing)])
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(register_user(
                email="a@x.com", password="StrongPass123!", first_name="A",
                last_name="B", phone=None, country=None, referral_code=None,
                request=SimpleNamespace(), db=db,
            ))
        self.assertIn("already registered", str(ctx.exception).lower())


class RefreshEmailVerifiedGateTests(unittest.TestCase):
    def setUp(self):
        self._orig = {
            "rl": auth_service.rate_limit_http,
            "gs": auth_service.get_settings,
            "ht": auth_service.hash_token,
        }
        auth_service.rate_limit_http = lambda *a, **k: None
        auth_service.get_settings = lambda: SimpleNamespace(REFRESH_TOKEN_COOKIE_NAME="refresh")
        auth_service.hash_token = lambda t: t

    def tearDown(self):
        auth_service.rate_limit_http = self._orig["rl"]
        auth_service.get_settings = self._orig["gs"]
        auth_service.hash_token = self._orig["ht"]

    def test_unverified_refresh_blocked_and_revoked(self):
        uid = uuid4()
        row = SimpleNamespace(user_id=uid, revoked=False)
        user = SimpleNamespace(id=uid, email="a@x.com", email_verified=False,
                               is_demo=False, status="active", role="user")
        req = SimpleNamespace(cookies={"refresh": "tok"})
        db = _DB([_Res(scalar=row)], get_obj=user)
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(refresh_token(req, db))
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertTrue(row.revoked)


if __name__ == "__main__":
    unittest.main()
