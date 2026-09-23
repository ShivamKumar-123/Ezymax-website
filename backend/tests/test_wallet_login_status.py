"""Phase 3: wallet sign-in must enforce account-status + staff guards like
password/Google login. A banned user (or staff) must not get a session.
"""
import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.services import wallet_auth_service as was
from services.gateway.src.services.auth_service import AuthServiceError


class WalletLoginStatusTests(unittest.TestCase):
    def setUp(self):
        self._orig_verify = was.verify_message
        self._orig_resolve = was.resolve_or_create_user

        async def _verify(*a, **k):
            return "0xabc", SimpleNamespace(chain_id=1)
        was.verify_message = _verify

    def tearDown(self):
        was.verify_message = self._orig_verify
        was.resolve_or_create_user = self._orig_resolve

    def _run_with_user(self, user):
        async def _resolve(*a, **k):
            return user, False
        was.resolve_or_create_user = _resolve
        return asyncio.run(was.login_or_register_with_wallet("msg", "sig", SimpleNamespace(), None))

    def test_banned_user_refused(self):
        user = SimpleNamespace(id=uuid4(), status="banned", role="user", wallet_address="0xabc")
        with self.assertRaises(AuthServiceError) as ctx:
            self._run_with_user(user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_staff_refused(self):
        user = SimpleNamespace(id=uuid4(), status="active", role="admin", wallet_address="0xabc")
        with self.assertRaises(AuthServiceError) as ctx:
            self._run_with_user(user)
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
