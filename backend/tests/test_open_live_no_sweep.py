"""H-MONEY-4: opening a live account is funded ONLY by a transfer from the main
wallet — never by sweeping the user's other trading accounts — and is refused
when the main wallet is short.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src.models import Transaction
from services.gateway.src.services import account_service
from services.gateway.src.services import auth_service as gw_auth


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return _Res(self._results.pop(0) if self._results else None)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None

    async def refresh(self, *a, **k):
        return None


def _group(min_dep):
    return SimpleNamespace(id=uuid4(), minimum_deposit=Decimal(str(min_dep)),
                           leverage_default=500, name="Standard", is_active=True, is_demo=False)


class OpenLiveNoSweepTests(unittest.TestCase):
    def setUp(self):
        self._orig_lev = account_service._user_effective_leverage_cap
        self._orig_num = gw_auth.generate_account_number

        async def _lev(*a, **k):
            return 500, {}
        account_service._user_effective_leverage_cap = _lev
        gw_auth.generate_account_number = lambda: "ACC123"

    def tearDown(self):
        account_service._user_effective_leverage_cap = self._orig_lev
        gw_auth.generate_account_number = self._orig_num

    def test_funds_from_wallet_only(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, is_demo=False, is_islamic=False,
                               main_wallet_balance=Decimal("500"))
        group = _group(100)
        req = SimpleNamespace(account_group_id=group.id, leverage=None, is_demo=None)
        db = _DB([user, group])
        asyncio.run(account_service.open_live_account(uid, req, db))
        # wallet debited by exactly min_d; exactly one transfer txn; no other
        # TradingAccount was mutated (none were even loaded).
        self.assertEqual(user.main_wallet_balance, Decimal("400"))
        txns = [t for t in db.added if isinstance(t, Transaction)]
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0].amount, Decimal("-100"))

    def test_refuses_when_wallet_short(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, is_demo=False, is_islamic=False,
                               main_wallet_balance=Decimal("50"))
        group = _group(100)
        req = SimpleNamespace(account_group_id=group.id, leverage=None, is_demo=None)
        db = _DB([user, group])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(account_service.open_live_account(uid, req, db))
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
