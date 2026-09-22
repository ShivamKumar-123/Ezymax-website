"""C-TRADE-1: stop_copy must refund the CF account's REAL balance and zero the
account, not credit a reconstructed allocation_amount + P&L figure while leaving
the account funded (which let the same funds be swept again on account delete).
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import Transaction
from services.gateway.src.services.social_service import stop_copy


class _Res:
    def __init__(self, scalar=None, items=None):
        self._scalar = scalar
        self._items = items or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results, get_obj):
        self._results = list(results)
        self._get_obj = get_obj
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, *a, **k):
        return self._get_obj

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None


class StopCopyRealBalanceTests(unittest.TestCase):
    def test_refunds_real_balance_and_zeros_account(self):
        uid = uuid4()
        acct_id = uuid4()
        allocation = SimpleNamespace(
            id=uuid4(), investor_user_id=uid, status="active",
            master_id=uuid4(), investor_account_id=acct_id,
            allocation_amount=Decimal("1000"), total_profit=Decimal("0"),
        )
        # Real CF balance has drifted to 1200 (e.g. realised gains already booked).
        inv_acct = SimpleNamespace(
            id=acct_id, balance=Decimal("1200"), equity=Decimal("1200"),
            free_margin=Decimal("1200"), margin_used=Decimal("0"), is_active=True,
        )
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        results = [
            _Res(scalar=allocation),  # select InvestorAllocation
            _Res(scalar=user),        # lock_user (SELECT User FOR UPDATE)
            _Res(items=[]),           # select open CopyTrade (none)
            _Res(scalar=None),        # select MasterAccount (none)
            _Res(scalar=inv_acct),    # lock_account (SELECT TradingAccount FOR UPDATE)
        ]
        db = _DB(results, None)
        out = asyncio.run(stop_copy(allocation.id, uid, db))

        # refund equals the REAL balance (1200), not allocation_amount (1000).
        self.assertEqual(out["returned_to_wallet"], 1200.0)
        self.assertEqual(user.main_wallet_balance, Decimal("1200"))
        # account is emptied so it can't be swept again.
        self.assertEqual(inv_acct.balance, Decimal("0"))
        self.assertFalse(inv_acct.is_active)
        txns = [t for t in db.added if isinstance(t, Transaction)]
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0].amount, Decimal("1200"))


if __name__ == "__main__":
    unittest.main()
