"""C-MONEY-1: closing a trading account must record the removal of its
non-withdrawable bonus credit in the ledger (previously zeroed silently).

Pure-unit: delete_trading_account is driven with a fake DB whose execute()
returns queued results (no master, no followers, no open positions), and we
assert a `credit_removed` Transaction for -credit is written.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import Transaction
from services.gateway.src.services.account_service import delete_trading_account


class _Res:
    def __init__(self, scalar=None, first=None, items=None, count=None):
        self._scalar = scalar
        self._first = first
        self._items = items or []
        self._count = count

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._count

    def first(self):
        return self._first

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results, user):
        self._results = list(results)
        self._user = user
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, *a, **k):
        return self._user

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None


class DeleteAccountCreditRemovedTests(unittest.TestCase):
    def test_credit_removed_transaction_written(self):
        uid = uuid4()
        acct_id = uuid4()
        account = SimpleNamespace(
            id=acct_id, user_id=uid, is_demo=False,
            balance=Decimal("100"), credit=Decimal("50"),
            equity=Decimal("150"), free_margin=Decimal("100"),
            margin_used=Decimal("0"), is_active=True,
        )
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"), email="t@x.com")
        results = [
            _Res(scalar=account),   # select TradingAccount
            _Res(first=None),       # select open Position.id (none)
            _Res(count=0),          # count pending orders (none)
            _Res(items=[]),         # select open Position rows (none)
            _Res(),                 # update Order (ignored)
            _Res(scalar=None),      # select MasterAccount (none)
            _Res(items=[]),         # select follower InvestorAllocation (none)
        ]
        db = _DB(results, user)
        asyncio.run(delete_trading_account(acct_id, uid, db))

        credit_txns = [t for t in db.added if isinstance(t, Transaction) and t.type == "credit_removed"]
        self.assertEqual(len(credit_txns), 1)
        self.assertEqual(credit_txns[0].amount, Decimal("-50"))
        # balance sweep still recorded, and credit no longer on the account.
        self.assertEqual(account.credit, Decimal("0"))
        self.assertTrue(any(isinstance(t, Transaction) and t.type == "transfer" for t in db.added))

    def test_no_credit_no_removal_txn(self):
        uid = uuid4()
        acct_id = uuid4()
        account = SimpleNamespace(
            id=acct_id, user_id=uid, is_demo=False,
            balance=Decimal("0"), credit=Decimal("0"),
            equity=Decimal("0"), free_margin=Decimal("0"),
            margin_used=Decimal("0"), is_active=True,
        )
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"), email="t@x.com")
        results = [
            _Res(scalar=account), _Res(first=None), _Res(count=0), _Res(items=[]),
            _Res(), _Res(scalar=None), _Res(items=[]),
        ]
        db = _DB(results, user)
        asyncio.run(delete_trading_account(acct_id, uid, db))
        self.assertFalse(any(isinstance(t, Transaction) and t.type == "credit_removed" for t in db.added))


if __name__ == "__main__":
    unittest.main()
