"""C-TRADE-4 (Medium): credit_admin_fee must credit the LOCKED user row, not the
unlocked row it looked up, so the fee credit can't race a concurrent balance
mutation on the same account.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src import admin_fees


class _Res:
    def __init__(self, scalar):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res(None)

    def add(self, obj):
        self.added.append(obj)


class AdminFeeLockedWriteTests(unittest.TestCase):
    def setUp(self):
        self._orig = admin_fees.lock_user

    def tearDown(self):
        admin_fees.lock_user = self._orig

    def test_credit_lands_on_locked_row(self):
        uid = uuid4()
        unlocked = SimpleNamespace(id=uid, main_wallet_balance=Decimal("100"))
        locked = SimpleNamespace(id=uid, main_wallet_balance=Decimal("100"))

        async def _lock(db, user_id):
            assert user_id == uid
            return locked
        admin_fees.lock_user = _lock

        db = _DB([_Res(unlocked)])  # the super_admin lookup returns the UNLOCKED row
        asyncio.run(admin_fees.credit_admin_fee(db, Decimal("50"), "test fee"))

        # write happened on the LOCKED row, not the unlocked lookup result
        self.assertEqual(locked.main_wallet_balance, Decimal("150"))
        self.assertEqual(unlocked.main_wallet_balance, Decimal("100"))


if __name__ == "__main__":
    unittest.main()
