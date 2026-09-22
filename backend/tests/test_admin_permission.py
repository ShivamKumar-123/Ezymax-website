"""C-ADMIN-2: require_permission must NOT grant a role='admin' user implicit
full access when they have no active employees row.

Pure-unit: the dependency's inner `_check` is called directly with a stub
admin + a fake DB session (matching the mock style of the other tests here).
Fails before the fix (returned admin), passes after (raises 403).
"""
import asyncio
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from services.admin.dependencies import require_permission


class _FakeResult:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _FakeDB:
    """Returns the given employee row for any execute()."""
    def __init__(self, employee):
        self._employee = employee

    async def execute(self, *a, **k):
        return _FakeResult(self._employee)


class AdminPermissionTests(unittest.TestCase):
    def test_admin_without_employee_row_is_denied(self):
        check = require_permission("deposits.view")
        admin = SimpleNamespace(role="admin", id="u1")
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(check(admin=admin, db=_FakeDB(None)))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_super_admin_bypasses(self):
        check = require_permission("deposits.view")
        admin = SimpleNamespace(role="super_admin", id="u1")
        self.assertIs(asyncio.run(check(admin=admin, db=_FakeDB(None))), admin)

    def test_employee_with_explicit_permission_allowed(self):
        check = require_permission("deposits.view")
        admin = SimpleNamespace(role="admin", id="u2")
        emp = SimpleNamespace(role="finance", extra_permissions=["deposits.view"])
        self.assertIs(asyncio.run(check(admin=admin, db=_FakeDB(emp))), admin)


if __name__ == "__main__":
    unittest.main()
