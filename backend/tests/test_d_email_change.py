"""Section D5: email change rotates refresh credentials; credential-changing
auth routes refuse impersonation sessions.
"""
import asyncio
import inspect
import unittest
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.auth import require_full_session
from services.gateway.src.api import auth as auth_api
from services.gateway.src.services import auth_service as svc


class _Res:
    def __init__(self, v=None):
        self._v = v

    def scalars(self):
        return self

    def all(self):
        return list(self._v or [])


class _DB:
    def __init__(self, sids):
        self._sids = sids
        self.statements = []
        self.added = []

    async def execute(self, stmt, *a, **k):
        self.statements.append(str(stmt))
        if str(stmt).lstrip().upper().startswith("SELECT"):
            return _Res(self._sids)
        return _Res()

    def add(self, obj):
        self.added.append(obj)


class EmailChangeRotationTests(unittest.TestCase):
    def test_revokes_refresh_and_other_sessions_and_issues_fresh_refresh(self):
        keep = uuid4()
        other = uuid4()
        db = _DB([other])
        raw, exp, revoked = asyncio.run(svc.rotate_credentials_after_email_change(
            uuid4(), SimpleNamespace(), db, keep_sid=str(keep)))
        self.assertTrue(raw and len(raw) > 40)
        self.assertEqual(revoked, [other])
        self.assertTrue(any("UPDATE user_refresh_tokens" in s for s in db.statements))
        self.assertTrue(any("UPDATE user_sessions" in s for s in db.statements))
        self.assertEqual(len(db.added), 1)
        self.assertEqual(db.added[0].token_hash, svc.hash_token(raw))
        self.assertFalse(db.added[0].revoked)


class FullSessionRoutesTests(unittest.TestCase):
    def _dep(self, fn):
        return inspect.signature(fn).parameters["current_user"].default.dependency

    def test_credential_routes_require_full_session(self):
        for fn in (auth_api.start_email_verification, auth_api.verify_email_otp,
                   auth_api.step_up_start, auth_api.step_up_verify,
                   auth_api.change_password, auth_api.setup_2fa):
            self.assertIs(self._dep(fn), require_full_session, fn.__name__)


if __name__ == "__main__":
    unittest.main()
