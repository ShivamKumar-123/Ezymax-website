"""H-MONEY-2: a deposit/welcome bonus offer is granted at most once per user;
a repeat deposit does not re-credit the same offer.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import Transaction, UserBonus
from packages.common.src.bonus_service import apply_deposit_bonus


class _Res:
    def __init__(self, items=None, first=None):
        self._items = items or []
        self._first = first

    def scalars(self):
        return self

    def all(self):
        return self._items

    def first(self):
        return self._first


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    def add(self, obj):
        self.added.append(obj)


def _offer():
    return SimpleNamespace(
        id=uuid4(), name="Welcome", percentage=Decimal("10"), fixed_amount=None,
        max_bonus=None, min_deposit=Decimal("0"), starts_at=None, expires_at=None,
        lots_required=Decimal("0"),
    )


class BonusOncePerOfferTests(unittest.TestCase):
    def test_first_grant_credits_and_records(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("100"))
        deposit = SimpleNamespace(amount=Decimal("200"), user_id=uid)
        offer = _offer()
        db = _DB([_Res(items=[offer]), _Res(first=None)])  # offer list, no prior UserBonus
        applied = asyncio.run(apply_deposit_bonus(db, user, deposit))
        self.assertEqual(applied, [("Welcome", Decimal("20"))])
        self.assertEqual(user.main_wallet_balance, Decimal("120"))
        self.assertTrue(any(isinstance(o, UserBonus) for o in db.added))
        self.assertTrue(any(isinstance(o, Transaction) and o.type == "bonus" for o in db.added))

    def test_second_grant_skipped(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("120"))
        deposit = SimpleNamespace(amount=Decimal("200"), user_id=uid)
        offer = _offer()
        db = _DB([_Res(items=[offer]), _Res(first=("existing-id",))])  # already granted
        applied = asyncio.run(apply_deposit_bonus(db, user, deposit))
        self.assertEqual(applied, [])
        self.assertEqual(user.main_wallet_balance, Decimal("120"))  # unchanged
        self.assertFalse(db.added)


if __name__ == "__main__":
    unittest.main()
