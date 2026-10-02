"""H-TRADE-3: invest_managed_account must credit exactly one destination —
PAMM → the pool account (no sub-account), MAM(M) → the investor sub-account
(never both). Previously the pool was credited for every type AND a MAM
sub-account too, double-crediting MAM investments.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import TradingAccount
from services.gateway.src.services import social_service as ss


class _Res:
    def __init__(self, scalar=None, scalarv=None, items=None):
        self._scalar = scalar
        self._scalarv = scalarv
        self._items = items or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalarv

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results, pool):
        self._results = list(results)
        self._pool = pool
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, *a, **k):
        return self._pool

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        return None

    async def refresh(self, *a, **k):
        return None


def _master(mtype):
    return SimpleNamespace(id=uuid4(), status="approved", master_type=mtype, user_id=uuid4(),
                           account_id=uuid4(), min_investment=Decimal("0"),
                           max_investors=100, followers_count=0)


def _user(uid):
    return SimpleNamespace(id=uid, main_wallet_balance=Decimal("1000"))


def _pool():
    return SimpleNamespace(id=uuid4(), balance=Decimal("500"), credit=Decimal("0"),
                           margin_used=Decimal("0"), equity=Decimal("500"),
                           free_margin=Decimal("500"))


class ManagedInvestOneDestinationTests(unittest.TestCase):
    def test_mamm_new_investment_refused(self):
        # A7: MAM ("mamm") is retired — new investments / top-ups are refused
        # before any money moves (was: credited a sub-account).
        uid = uuid4()
        master = _master("mamm")
        user = _user(uid)
        pool = _pool()
        db = _DB([_Res(scalar=master)], pool)
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.invest_managed_account(
                master.id, Decimal("100"), None, Decimal("0"), uid, db,
            ))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(pool.balance, Decimal("500"))
        self.assertEqual(user.main_wallet_balance, Decimal("1000"))
        self.assertEqual(db.added, [])

    def test_pamm_credits_pool_not_subaccount(self):
        uid = uuid4()
        master = _master("pamm")
        user = _user(uid)
        pool = _pool()
        db = _DB([
            _Res(scalar=master), _Res(scalarv=0),
            _Res(scalar=user),   # lock_user
            _Res(scalarv=0),     # outstanding bonus (A5 spendable_main_wallet)
            _Res(scalar=None),   # existing allocation
            _Res(scalar=pool),   # lock_account(pool)
            _Res(items=[]),      # _pool_value_with_floating: open positions
            _Res(scalarv=0),     # total units before
        ], pool)
        asyncio.run(ss.invest_managed_account(
            master.id, Decimal("100"), None, Decimal("0"), uid, db,
        ))
        self.assertEqual(pool.balance, Decimal("600"))          # pool credited
        self.assertEqual(user.main_wallet_balance, Decimal("900"))
        subs = [o for o in db.added if isinstance(o, TradingAccount)]
        self.assertEqual(len(subs), 0)                          # no sub-account


if __name__ == "__main__":
    unittest.main()
