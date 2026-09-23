"""C-TRADE-4 (Medium): _collect_management_fees must debit the investor and
credit the master on LOCKED account rows, not the unlocked lookups.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.engines import stats_engine as se
from services.gateway.src.engines.stats_engine import StatsEngine


class _Res:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res([])

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None


class MgmtFeeLockedWriteTests(unittest.TestCase):
    def setUp(self):
        self._orig = se.lock_account

    def tearDown(self):
        se.lock_account = self._orig

    def test_debit_credit_on_locked_rows(self):
        macct_id, inv_id, uid = uuid4(), uuid4(), uuid4()
        master = SimpleNamespace(id=uuid4(), account_id=macct_id, status="approved",
                                 master_type="pamm", management_fee_pct=Decimal("36.5"),
                                 admin_commission_pct=Decimal("0"), user_id=uid,
                                 total_fee_earned=Decimal("0"))
        alloc = SimpleNamespace(id=uuid4(), allocation_amount=Decimal("1000"),
                                investor_account_id=inv_id, investor_user_id=uid)
        locked_inv = SimpleNamespace(id=inv_id, balance=Decimal("500"), credit=Decimal("0"),
                                     margin_used=Decimal("0"))
        locked_master = SimpleNamespace(id=macct_id, balance=Decimal("0"), credit=Decimal("0"),
                                        margin_used=Decimal("0"), account_number="PM1")
        calls = []

        async def _lock(db, aid):
            calls.append(aid)
            return locked_inv if aid == inv_id else locked_master
        se.lock_account = _lock

        db = _DB([
            _Res([master]),   # masters
            _Res([alloc]),    # allocations for the master
        ])
        asyncio.run(StatsEngine()._collect_management_fees(db))

        # daily_rate = 36.5/365/100 = 0.001 → fee = 1000 * 0.001 = 1.0
        self.assertEqual(locked_inv.balance, Decimal("499"))     # debited on locked row
        self.assertEqual(locked_master.balance, Decimal("1"))    # credited on locked row
        self.assertIn(inv_id, calls)
        self.assertIn(macct_id, calls)


if __name__ == "__main__":
    unittest.main()
