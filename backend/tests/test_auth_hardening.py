"""Auth hardening regressions (zero-vuln pass):

- bootstrap_session only accepts admin-impersonation tokens; an ordinary session
  token (has a sid) can no longer be upgraded into a fresh session + refresh token.
- impersonation sessions get amr="impersonation" and NO refresh token.
- require_full_session refuses impersonation sessions (money-out / security).
- setup_2fa refuses to overwrite a LIVE 2FA secret (2FA-takeover).
- regenerate backup codes requires a current authenticator code.
- algo-key auth refuses a banned owner.
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pyotp
from fastapi import HTTPException

from packages.common.src import auth as common_auth
from packages.common.src.config import get_settings
from services.gateway.src.services import auth_service as svc
from services.gateway.src.services.auth_service import AuthServiceError

S = get_settings()


def _user_token(sub, **extra):
    payload = {
        "sub": str(sub), "role": "user", "type": "user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
    }
    payload.update(extra)
    return jwt.encode(payload, S.JWT_SECRET, algorithm=S.JWT_ALGORITHM)


class _DBGet:
    def __init__(self, user):
        self._user = user

    async def get(self, *a, **k):
        return self._user


class BootstrapLockdownTests(unittest.TestCase):
    def setUp(self):
        self._orig_rl = svc.rate_limit_http
        self._orig_issue = svc.issue_auth_json_response
        svc.rate_limit_http = lambda *a, **k: None
        self.calls = []

        async def _fake_issue(user, request, db, **kw):
            self.calls.append(kw)
            return "ISSUED"

        svc.issue_auth_json_response = _fake_issue

    def tearDown(self):
        svc.rate_limit_http = self._orig_rl
        svc.issue_auth_json_response = self._orig_issue

    def _user(self):
        return SimpleNamespace(id=uuid4(), status="active")

    def test_normal_session_token_rejected(self):
        u = self._user()
        tok = _user_token(u.id, sid=str(uuid4()), amr="login")
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.bootstrap_session(tok, None, _DBGet(u)))
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(self.calls, [])

    def test_plain_token_without_impersonation_rejected(self):
        u = self._user()
        with self.assertRaises(AuthServiceError):
            asyncio.run(svc.bootstrap_session(_user_token(u.id), None, _DBGet(u)))
        self.assertEqual(self.calls, [])

    def test_impersonation_token_gets_restricted_session_without_refresh(self):
        u = self._user()
        tok = _user_token(u.id, impersonated_by=str(uuid4()))
        out = asyncio.run(svc.bootstrap_session(tok, None, _DBGet(u)))
        self.assertEqual(out, "ISSUED")
        self.assertEqual(self.calls[0].get("amr_override"), "impersonation")
        self.assertIs(self.calls[0].get("issue_refresh"), False)


class RequireFullSessionTests(unittest.TestCase):
    def test_impersonation_blocked(self):
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(common_auth.require_full_session({"user_id": uuid4(), "amr": "impersonation"}))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_login_and_legacy_allowed(self):
        for amr in ("login", "derived", None):
            cu = {"user_id": uuid4(), "amr": amr}
            self.assertIs(asyncio.run(common_auth.require_full_session(cu)), cu)


class _Res:
    def __init__(self, v):
        self._v = v

    def scalar_one_or_none(self):
        return self._v


class _UserDB:
    def __init__(self, user):
        self.user = user
        self.committed = False
        self.executed = 0

    async def execute(self, *a, **k):
        self.executed += 1
        return _Res(self.user)

    def add(self, *a, **k):
        pass

    async def commit(self):
        self.committed = True


class TwoFactorTakeoverTests(unittest.TestCase):
    def test_setup_refuses_when_already_enabled(self):
        secret = pyotp.random_base32()
        user = SimpleNamespace(email="a@x.com", two_factor_enabled=True, two_factor_secret=secret)
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.setup_2fa(uuid4(), _UserDB(user)))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(user.two_factor_secret, secret)  # live secret untouched

    def test_setup_allowed_when_not_enabled(self):
        user = SimpleNamespace(email="a@x.com", two_factor_enabled=False, two_factor_secret=None)
        out = asyncio.run(svc.setup_2fa(uuid4(), _UserDB(user)))
        self.assertTrue(out["otp_uri"].startswith("otpauth://"))
        self.assertEqual(out["otp_uri"], out["qr_uri"])

    def test_regenerate_requires_valid_code(self):
        secret = pyotp.random_base32()
        user = SimpleNamespace(two_factor_enabled=True, two_factor_secret=secret)
        with self.assertRaises(AuthServiceError) as ctx:
            asyncio.run(svc.regenerate_2fa_backup_codes(uuid4(), "000000", _UserDB(user)))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_regenerate_with_valid_code_issues_codes(self):
        secret = pyotp.random_base32()
        user = SimpleNamespace(two_factor_enabled=True, two_factor_secret=secret)
        db = _UserDB(user)
        out = asyncio.run(svc.regenerate_2fa_backup_codes(uuid4(), pyotp.TOTP(secret).now(), db))
        self.assertEqual(len(out["backup_codes"]), 8)
        self.assertTrue(db.committed)


class AlgoKeyBannedOwnerTests(unittest.TestCase):
    def test_banned_owner_rejected(self):
        from services.gateway.src.api import algo_connector as ac

        raw_secret = "s3cret"
        key_row = SimpleNamespace(
            user_id=uuid4(), account_id=uuid4(),
            secret_hash=ac._hash_secret(raw_secret), last_used_at=None,
        )

        class _DB:
            async def execute(self, *a, **k):
                return _Res(key_row)

            async def get(self, *a, **k):
                return SimpleNamespace(is_active=True)

        orig = common_auth._get_user_status

        async def _banned(_uid):
            return "banned"

        common_auth._get_user_status = _banned
        try:
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(ac._authenticate("k", raw_secret, _DB()))
            self.assertEqual(ctx.exception.status_code, 403)
        finally:
            common_auth._get_user_status = orig


if __name__ == "__main__":
    unittest.main()
