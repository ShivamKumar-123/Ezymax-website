"""H-ADMIN-2: employees cannot ban/fund/delete privileged accounts or themselves;
only a super_admin may act on admin/broker/super_admin targets.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException


def _load_user_service():
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "user_service.py")
    spec = importlib.util.spec_from_file_location("admin_user_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


us = _load_user_service()


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    """execute() always returns the given actor row (the guard's actor lookup)."""
    def __init__(self, actor):
        self._actor = actor

    async def execute(self, *a, **k):
        return _Res(self._actor)


def _guard(actor, target, admin_id):
    return us._assert_can_target(_DB(actor), admin_id, target)


class TargetGuardTests(unittest.TestCase):
    def test_self_target_denied(self):
        aid = uuid4()
        me = SimpleNamespace(id=aid, role="admin")
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(_guard(me, me, aid))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_employee_cannot_target_admin(self):
        aid = uuid4()
        actor = SimpleNamespace(id=aid, role="admin")  # employee-tier admin
        target = SimpleNamespace(id=uuid4(), role="admin")
        with self.assertRaises(HTTPException):
            asyncio.run(_guard(actor, target, aid))

    def test_employee_cannot_target_broker(self):
        aid = uuid4()
        actor = SimpleNamespace(id=aid, role="admin")
        target = SimpleNamespace(id=uuid4(), role="broker")
        with self.assertRaises(HTTPException):
            asyncio.run(_guard(actor, target, aid))

    def test_employee_can_target_regular_user(self):
        aid = uuid4()
        actor = SimpleNamespace(id=aid, role="admin")
        target = SimpleNamespace(id=uuid4(), role="user")
        asyncio.run(_guard(actor, target, aid))  # no raise

    def test_super_admin_can_target_admin(self):
        aid = uuid4()
        actor = SimpleNamespace(id=aid, role="super_admin")
        target = SimpleNamespace(id=uuid4(), role="admin")
        asyncio.run(_guard(actor, target, aid))  # no raise


if __name__ == "__main__":
    unittest.main()
