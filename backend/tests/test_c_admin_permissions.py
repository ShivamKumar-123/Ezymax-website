"""C1 / C3: admin authorization.

* White-label brokers get an EXPLICIT per-section allow-list — never "every
  permission in an edit section". Money-moving / P&L-changing actions are
  denied even at EDIT on every section.
* /admin/auth/me reports exactly the set require_permission enforces (brokers
  and employees incl. extra grants).
* Role separation: `ib.payout` is finance (not marketing); finance lost
  banks.create/update; IB payout routes gate on ib.payout.

Pure-unit: dependencies / auth_service are loaded the way the admin app loads
them (bare `dependencies` import, admin dir on sys.path) and driven with stub
users + a fake DB.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

ADMIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
if ADMIN_DIR not in sys.path:
    sys.path.append(ADMIN_DIR)


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ADMIN_DIR, *rel.split("/")))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


import dependencies as deps  # noqa: E402  (admin-app style bare import)

auth_service = _load("c_admin_auth_service", "services/auth_service.py")


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    """Every execute() returns the same row (profile or employee)."""
    def __init__(self, row):
        self._row = row

    async def execute(self, *a, **k):
        return _Res(self._row)


ALL_EDIT = {
    "users": "edit", "kyc": "edit", "deposits": "edit", "withdrawals": "edit",
    "trades": "edit", "transactions": "edit", "sub_brokers": "edit",
}

DENIED_FOR_BROKERS = [
    "users.add_fund", "users.deduct_fund",
    "trades.modify", "trades.close", "trades.create", "trades.manage",
    "deposits.approve", "withdrawals.approve", "withdrawals.mark_paid",
    "ib.payout", "ib.manage", "users.delete", "users.impersonate",
    "users.kill_switch", "config.update", "banks.create",
]


def _broker():
    return SimpleNamespace(role="broker", id=uuid4())


def _check(permission, admin, db):
    return asyncio.run(deps.require_permission(permission)(admin=admin, db=db))


class BrokerAllowListTests(unittest.TestCase):
    def test_full_edit_broker_denied_money_and_pnl_actions(self):
        profile = SimpleNamespace(permissions=dict(ALL_EDIT))
        for perm in DENIED_FOR_BROKERS:
            with self.subTest(perm=perm):
                with self.assertRaises(HTTPException) as ctx:
                    _check(perm, _broker(), _DB(profile))
                self.assertEqual(ctx.exception.status_code, 403)

    def test_full_edit_broker_keeps_review_actions(self):
        profile = SimpleNamespace(permissions=dict(ALL_EDIT))
        for perm in ("users.view", "users.ban", "users.block_trading", "kyc.manage",
                     "deposits.view", "deposits.reject", "withdrawals.reject",
                     "trades.view", "positions.view"):
            with self.subTest(perm=perm):
                b = _broker()
                self.assertIs(_check(perm, b, _DB(profile)), b)

    def test_view_level_grants_no_mutations(self):
        profile = SimpleNamespace(permissions={"users": "view", "deposits": "view"})
        b = _broker()
        self.assertIs(_check("users.view", b, _DB(profile)), b)
        for perm in ("users.ban", "deposits.reject"):
            with self.assertRaises(HTTPException):
                _check(perm, _broker(), _DB(profile))

    def test_me_matches_enforced_allow_list(self):
        profile = SimpleNamespace(
            permissions=dict(ALL_EDIT), brand_name="B", logo_url=None, partner_code="WL-1",
        )
        admin = SimpleNamespace(role="broker", id=uuid4(), email="b@x.com", first_name="b", last_name=None)
        me = asyncio.run(auth_service.get_admin_me(admin=admin, db=_DB(profile)))
        perms = set(me["permissions"])
        self.assertEqual(perms, deps.broker_permissions_for_levels(ALL_EDIT))
        for perm in DENIED_FOR_BROKERS:
            self.assertNotIn(perm, perms)
        # every permission /me advertises is one require_permission grants
        for perm in perms:
            self.assertTrue(deps._broker_allows(profile, perm), perm)


class EmployeeRoleTests(unittest.TestCase):
    def test_finance_has_ib_payout_but_not_bank_edit(self):
        fin = deps.EMPLOYEE_ROLE_PERMISSIONS["finance"]
        self.assertIn("ib.payout", fin)
        self.assertNotIn("banks.create", fin)
        self.assertNotIn("banks.update", fin)

    def test_marketing_cannot_pay_out_ib(self):
        emp = SimpleNamespace(role="marketing", extra_permissions=[])
        admin = SimpleNamespace(role="admin", id=uuid4())
        with self.assertRaises(HTTPException) as ctx:
            _check("ib.payout", admin, _DB(emp))
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIs(_check("ib.manage", admin, _DB(emp)), admin)

    def test_ib_payout_routes_gate_on_ib_payout(self):
        src = open(os.path.join(ADMIN_DIR, "routes", "business.py"), encoding="utf-8").read()
        for route in ('"/ib/payouts/{agent_id}/approve"', '"/ib/payouts/{agent_id}/reject"'):
            block = src[src.index(route):]
            block = block[:block.index("return await")]
            self.assertIn('require_permission("ib.payout")', block, route)

    def test_me_includes_extra_permissions(self):
        emp = SimpleNamespace(role="support", extra_permissions=["deposits.view"])
        admin = SimpleNamespace(role="admin", id=uuid4(), email="e@x.com", first_name="e", last_name=None)
        me = asyncio.run(auth_service.get_admin_me(admin=admin, db=_DB(emp)))
        self.assertIn("deposits.view", me["permissions"])
        self.assertIn("tickets.view", me["permissions"])


if __name__ == "__main__":
    unittest.main()
