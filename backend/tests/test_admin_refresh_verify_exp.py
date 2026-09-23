"""H-ADMIN-1: admin_refresh must reject an EXPIRED admin token (verify_exp=True).

Previously an expired admin access token could be refreshed forever, so a single
leaked token meant permanent access.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
from fastapi import HTTPException


def _load_admin_auth_service():
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "auth_service.py")
    spec = importlib.util.spec_from_file_location("admin_auth_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


auth_service = _load_admin_auth_service()
S = auth_service.settings


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    def __init__(self, admin):
        self._admin = admin

    async def execute(self, *a, **k):
        return _Res(self._admin)


def _token(admin_id, delta_seconds):
    exp = datetime.now(timezone.utc) + timedelta(seconds=delta_seconds)
    return jwt.encode(
        {"admin_id": str(admin_id), "type": "admin", "exp": exp},
        S.ADMIN_JWT_SECRET, algorithm=S.ADMIN_JWT_ALGORITHM,
    )


class AdminRefreshTests(unittest.TestCase):
    def test_expired_token_rejected(self):
        body = SimpleNamespace(access_token=_token(uuid4(), -3600))  # expired 1h ago
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_service.admin_refresh(body, _DB(None)))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_valid_token_refreshes(self):
        admin_id = uuid4()
        admin = SimpleNamespace(id=admin_id, role="super_admin", first_name="A", last_name="B", status="active")
        body = SimpleNamespace(access_token=_token(admin_id, 3600))  # valid 1h
        out = asyncio.run(auth_service.admin_refresh(body, _DB(admin)))
        self.assertTrue(out.access_token)
        self.assertEqual(out.role, "super_admin")


if __name__ == "__main__":
    unittest.main()
