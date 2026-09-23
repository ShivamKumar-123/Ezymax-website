"""M: 2FA is enforced on Google sign-in too (shared _enforce_2fa helper), not
just password login.
"""
import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

import pyotp

from services.gateway.src.services.auth_service import _enforce_2fa, AuthServiceError


class _DB:
    async def execute(self, *a, **k):
        raise AssertionError("should not query on these paths")


class Enforce2faTests(unittest.TestCase):
    def test_disabled_is_noop(self):
        user = SimpleNamespace(id=uuid4(), two_factor_enabled=False)
        asyncio.run(_enforce_2fa(user, None, _DB()))  # no raise

    def test_enabled_missing_code_raises(self):
        user = SimpleNamespace(id=uuid4(), two_factor_enabled=True,
                               two_factor_secret=pyotp.random_base32())
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(_enforce_2fa(user, None, _DB()))
        self.assertIn("2fa", str(ctx.exception).lower())

    def test_enabled_valid_totp_passes(self):
        secret = pyotp.random_base32()
        user = SimpleNamespace(id=uuid4(), two_factor_enabled=True, two_factor_secret=secret)
        code = pyotp.TOTP(secret).now()
        asyncio.run(_enforce_2fa(user, code, _DB()))  # no raise

    def test_enabled_no_secret_misconfig(self):
        user = SimpleNamespace(id=uuid4(), two_factor_enabled=True, two_factor_secret="")
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(_enforce_2fa(user, "123456", _DB()))
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
