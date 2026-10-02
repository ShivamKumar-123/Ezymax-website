"""Section B2 / A7 — copy-account unwind hardening.

* stop_copy refuses while the copy account holds NON-copied positions or
  pending orders (manual trades must not be stranded on an account that is
  then refunded + deactivated), refuses PAMM/MAM allocations, refuses when a
  copied position has no fresh price (instead of skipping it), and refunds at
  most the real available cash (never negative, bonus credit excluded).
* MAM withdraw mirrors stop_copy: refunds the sub-account's real balance once,
  zeroes + deactivates it and never touches the master pool.
* No new `mamm` investments.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src.models import Transaction
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

    def first(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results, get_map=None):
        self._results = list(results)
        self._get_map = get_map or {}
        self.added = []
        self.commits = 0

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, _model, key):
        return self._get_map.get(key)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1


def _alloc(uid, acct_id, copy_type="signal"):
    return SimpleNamespace(
        id=uuid4(), investor_user_id=uid, status="active", copy_type=copy_type,
        master_id=uuid4(), investor_account_id=acct_id,
        allocation_amount=Decimal("1000"), total_profit=Decimal("0"),
    )


def _acct(acct_id, balance):
    return SimpleNamespace(
        id=acct_id, account_number="CF12345678", balance=Decimal(balance),
        credit=Decimal("0"), equity=Decimal(balance), free_margin=Decimal(balance),
        margin_used=Decimal("0"), is_active=True,
    )


class StopCopyGuardTests(unittest.TestCase):
    def test_refuses_when_manual_position_on_copy_account(self):
        uid, acct_id = uuid4(), uuid4()
        alloc = _alloc(uid, acct_id)
        acct = _acct(acct_id, "1000")
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        db = _DB([
            _Res(scalar=user), _Res(scalar=alloc), _Res(scalar=None),  # user, alloc, master
            _Res(scalar=acct),                                          # lock_account
            _Res(scalar=uuid4()),                                       # a NON-copied open position
        ])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.stop_copy(alloc.id, uid, db))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(user.main_wallet_balance, Decimal("0"))
        self.assertEqual(acct.balance, Decimal("1000"))
        self.assertTrue(acct.is_active)
        self.assertEqual(alloc.status, "active")
        self.assertEqual(db.commits, 0)

    def test_refuses_when_pending_order_on_copy_account(self):
        uid, acct_id = uuid4(), uuid4()
        alloc = _alloc(uid, acct_id)
        acct = _acct(acct_id, "1000")
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        db = _DB([
            _Res(scalar=user), _Res(scalar=alloc), _Res(scalar=None), _Res(scalar=acct),
            _Res(scalar=None),          # no foreign positions
            _Res(scalar=uuid4()),       # a pending order
        ])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.stop_copy(alloc.id, uid, db))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(db.commits, 0)

    def test_refuses_pamm_allocation(self):
        uid = uuid4()
        alloc = _alloc(uid, None, copy_type="pamm")
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        db = _DB([_Res(scalar=user), _Res(scalar=alloc)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.stop_copy(alloc.id, uid, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(user.main_wallet_balance, Decimal("0"))

    def test_refuses_without_price_and_mutates_nothing(self):
        uid, acct_id = uuid4(), uuid4()
        alloc = _alloc(uid, acct_id)
        acct = _acct(acct_id, "1000")
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        pos_id = uuid4()
        pos = SimpleNamespace(
            id=pos_id, status="open", instrument=SimpleNamespace(symbol="EURUSD"),
            side="buy", open_price=Decimal("1.1"), lots=Decimal("1"),
        )
        copy = SimpleNamespace(investor_position_id=pos_id, status="open")
        db = _DB([
            _Res(scalar=user), _Res(scalar=alloc), _Res(scalar=None), _Res(scalar=acct),
            _Res(scalar=None), _Res(scalar=None),   # no foreign positions / orders
            _Res(items=[copy]),                     # one open copied position
        ], get_map={pos_id: pos})

        orig = ss.price_cache.get

        async def _no_tick(_sym):
            return None
        ss.price_cache.get = _no_tick
        try:
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(ss.stop_copy(alloc.id, uid, db))
        finally:
            ss.price_cache.get = orig
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(copy.status, "open")
        self.assertEqual(pos.status, "open")
        self.assertEqual(acct.balance, Decimal("1000"))
        self.assertTrue(acct.is_active)
        self.assertEqual(db.commits, 0)

    def test_negative_balance_refunds_zero(self):
        uid, acct_id = uuid4(), uuid4()
        alloc = _alloc(uid, acct_id)
        acct = _acct(acct_id, "-25")
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("10"))
        db = _DB([
            _Res(scalar=user), _Res(scalar=alloc), _Res(scalar=None), _Res(scalar=acct),
            _Res(scalar=None), _Res(scalar=None), _Res(items=[]),
        ])
        out = asyncio.run(ss.stop_copy(alloc.id, uid, db))
        self.assertEqual(out["returned_to_wallet"], 0.0)
        self.assertEqual(user.main_wallet_balance, Decimal("10"))
        self.assertFalse(acct.is_active)


class MamWithdrawTests(unittest.TestCase):
    def test_refunds_subaccount_once_and_never_touches_pool(self):
        uid, acct_id = uuid4(), uuid4()
        alloc = _alloc(uid, acct_id, copy_type="mam")
        sub = _acct(acct_id, "800")   # real balance after losses (cost basis 1000)
        pool = SimpleNamespace(id=uuid4(), balance=Decimal("5000"))
        master = SimpleNamespace(id=alloc.master_id, account_id=pool.id, followers_count=3,
                                 performance_fee_pct=Decimal("0"))
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        db = _DB([
            _Res(scalar=alloc),                       # peek
            _Res(scalar=user), _Res(scalar=alloc),    # lock user, lock allocation
            _Res(scalar=master),                      # master
            _Res(scalar=sub),                         # lock sub-account
            _Res(scalar=None), _Res(scalar=None),     # no foreign positions / orders
            _Res(items=[]),                           # no open copies
        ], get_map={pool.id: pool})
        out = asyncio.run(ss.withdraw_managed_account(alloc.id, uid, db))

        # Real balance (800), NOT allocation_amount (1000) + P&L.
        self.assertEqual(out["returned_to_wallet"], 800.0)
        self.assertEqual(user.main_wallet_balance, Decimal("800"))
        self.assertEqual(sub.balance, Decimal("0"))
        self.assertFalse(sub.is_active)
        self.assertEqual(pool.balance, Decimal("5000"))      # pool untouched
        self.assertEqual(alloc.status, "withdrawn")
        txns = [t for t in db.added if isinstance(t, Transaction)]
        self.assertEqual(len(txns), 1)

        # A second withdraw sees the (locked, re-read) allocation as withdrawn.
        db2 = _DB([_Res(scalar=alloc), _Res(scalar=user), _Res(scalar=alloc)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.withdraw_managed_account(alloc.id, uid, db2))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(user.main_wallet_balance, Decimal("800"))


class NoNewMammInvestmentTests(unittest.TestCase):
    def test_mamm_invest_refused(self):
        uid = uuid4()
        master = SimpleNamespace(id=uuid4(), status="approved", master_type="mamm",
                                 account_id=uuid4(), user_id=uuid4(),
                                 min_investment=Decimal("0"), max_investors=100)
        db = _DB([_Res(scalar=master)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.invest_managed_account(
                master.id, Decimal("100"), None, Decimal("100"), uid, db,
            ))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(db.added, [])


if __name__ == "__main__":
    unittest.main()
