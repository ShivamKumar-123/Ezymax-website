"""H-MONEY-2 (residual): transfer_main_to_trading must not move non-withdrawable
bonus credit into a trading account (from where it could be withdrawn). It may
only transfer the real balance = main_wallet_balance - outstanding_bonus.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from services.gateway.src.services import wallet_service as ws


class _Res:
    def __init__(self, scalar=None, scalarv=None):
        self._scalar = scalar
        self._scalarv = scalarv

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalarv


class _DB:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def commit(self):
        return None


class TransferMainBonusGuardTests(unittest.TestCase):
    def test_transfer_exceeding_non_bonus_balance_refused(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("100"))
        # main=100, outstanding bonus=80 → only 20 is transferable.
        db = _DB([
            _Res(scalar=user),     # select User FOR UPDATE
            _Res(scalarv=80),      # outstanding_bonus sum
        ])
        req = SimpleNamespace(amount=Decimal("50"), to_account_id=uuid4())
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.transfer_main_to_trading(req, uid, db))
        self.assertEqual(ctx.exception.status_code, 400)
        # balance untouched (refused before mutation)
        self.assertEqual(user.main_wallet_balance, Decimal("100"))


if __name__ == "__main__":
    unittest.main()
