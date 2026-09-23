"""H-AUTH-3: access tokens carry a sid claim; get_current_user rejects a token
whose session was revoked, while sid-less (legacy) tokens are grandfathered.
"""
import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src import auth
from packages.common.src.auth import create_access_token, decode_token, get_current_user
from packages.common.src.config import get_settings

_COOKIE = get_settings().ACCESS_TOKEN_COOKIE_NAME


def _req(token):
    return SimpleNamespace(cookies={_COOKIE: token}, headers={})


class SessionRevocationTests(unittest.TestCase):
    def setUp(self):
        self._orig_status = auth._get_user_status
        self._orig_active = auth._session_is_active

        async def _status(uid):
            return "active"
        auth._get_user_status = _status

    def tearDown(self):
        auth._get_user_status = self._orig_status
        auth._session_is_active = self._orig_active

    def test_token_carries_sid_and_amr(self):
        tok, _ = create_access_token(str(uuid4()), "user", sid="sid-123", amr="login")
        payload = decode_token(tok)
        self.assertEqual(payload["sid"], "sid-123")
        self.assertEqual(payload["amr"], "login")

    def test_revoked_session_rejected(self):
        async def _inactive(sid):
            return False
        auth._session_is_active = _inactive
        tok, _ = create_access_token(str(uuid4()), "user", sid=str(uuid4()), amr="login")
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_current_user(_req(tok), credentials=None))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_active_session_allowed(self):
        async def _active(sid):
            return True
        auth._session_is_active = _active
        uid = uuid4()
        tok, _ = create_access_token(str(uid), "user", sid=str(uuid4()), amr="login")
        out = asyncio.run(get_current_user(_req(tok), credentials=None))
        self.assertEqual(out["user_id"], uid)

    def test_legacy_token_without_sid_grandfathered(self):
        # No sid → session check skipped even if it would report inactive.
        async def _inactive(sid):
            return False
        auth._session_is_active = _inactive
        uid = uuid4()
        tok, _ = create_access_token(str(uid), "user")  # no sid
        out = asyncio.run(get_current_user(_req(tok), credentials=None))
        self.assertEqual(out["user_id"], uid)


if __name__ == "__main__":
    unittest.main()
