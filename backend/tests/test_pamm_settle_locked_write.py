"""C-TRADE-4 (Medium): distribute_pamm_profit must credit the LOCKED investor +
master account rows, not the unlocked rows from the allocations query.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4


def _load_admin_social():
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "social_service.py")
    spec = importlib.util.spec_from_file_location("admin_social_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ss = _load_admin_social()


class _Res:
    def __init__(self, scalar=None, scalarv=None, items=None):
        self._scalar = scalar
        self._scalarv = scalarv
        self._items = items or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalarv

    def all(self):
        return self._items


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        return None


class PammSettleLockedWriteTests(unittest.TestCase):
    def setUp(self):
        self._orig = ss.lock_account

    def tearDown(self):
        ss.lock_account = self._orig

    def test_credits_land_on_locked_rows(self):
        mid, macct_id, inv_id, uid = uuid4(), uuid4(), uuid4(), uuid4()
        master = SimpleNamespace(id=mid, account_id=macct_id, master_type="pamm",
                                 status="approved", performance_fee_pct=Decimal("20"),
                                 admin_commission_pct=Decimal("0"), user_id=uid,
                                 total_fee_earned=Decimal("0"))
        alloc = SimpleNamespace(id=uuid4(), allocation_amount=Decimal("1000"),
                                total_profit=Decimal("0"), investor_user_id=uid,
                                investor_account_id=inv_id)
        unlocked_inv = SimpleNamespace(id=inv_id, balance=Decimal("500"), credit=Decimal("0"),
                                       margin_used=Decimal("0"))

        locked_inv = SimpleNamespace(id=inv_id, balance=Decimal("500"), credit=Decimal("0"),
                                     margin_used=Decimal("0"))
        locked_master = SimpleNamespace(id=macct_id, balance=Decimal("0"), credit=Decimal("0"),
                                        margin_used=Decimal("0"), account_number="PM1")
        calls = []

        async def _lock(db, aid):
            calls.append(aid)
            return locked_inv if aid == inv_id else locked_master
        ss.lock_account = _lock

        db = _DB([
            _Res(scalar=master),                  # select MasterAccount
            _Res(scalarv=1000),                   # sum(TradeHistory.profit)
            _Res(items=[(alloc, unlocked_inv)]),  # allocations join
        ])
        asyncio.run(ss.distribute_pamm_profit(mid, uid, "1.2.3.4", db))

        # net_profit = 1000*100% - 20% = 800 → credited to the LOCKED investor row
        self.assertEqual(locked_inv.balance, Decimal("800").__add__(Decimal("500")))
        self.assertEqual(unlocked_inv.balance, Decimal("500"))       # untouched
        self.assertEqual(locked_master.balance, Decimal("200"))       # master cut on locked row
        self.assertIn(inv_id, calls)
        self.assertIn(macct_id, calls)


if __name__ == "__main__":
    unittest.main()
