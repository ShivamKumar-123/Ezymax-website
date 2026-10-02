"""C2: admin edits of OPEN positions.

* open_price / lots / side / open_time changes need a risk role
  (super_admin / risk_manager); values equal to the current ones (the admin UI
  pre-fills them) are not changes, so a plain SL/TP edit still works.
* lots in (0, 100], prices > 0, finite (schema).
* close at a supplied price needs a risk role and — unless super_admin — must
  be within 5% of a FRESH quote; a market close needs a fresh quote.
* close writes a ledger row and refuses A-book positions.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from packages.common.src.admin_schemas import ModifyPositionRequest, ClosePositionRequest
from packages.common.src.models import Transaction

ADMIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
if ADMIN_DIR not in sys.path:
    sys.path.append(ADMIN_DIR)

_spec = importlib.util.spec_from_file_location(
    "c_admin_trade_service", os.path.join(ADMIN_DIR, "services", "trade_service.py"))
ts = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ts)


class _Scalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return list(self._items)


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val

    def scalars(self):
        return _Scalars(self._val or [])


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []
        self.committed = False

    async def execute(self, *a, **k):
        return _Res(self._results.pop(0) if self._results else None)

    async def get(self, *a, **k):
        return None

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        self.committed = True


def _pos(**kw):
    base = dict(
        id=uuid4(), account_id=uuid4(), instrument_id=uuid4(), status="open",
        side="buy", lots=Decimal("1"), open_price=Decimal("1.10000"),
        stop_loss=None, take_profit=None, commission=Decimal("0"), swap=Decimal("0"),
        created_at=None, spread_override=None, spread_override_type=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _acc(pos, demo=True):
    return SimpleNamespace(
        id=pos.account_id, user_id=uuid4(), is_demo=demo, balance=Decimal("1000"),
        credit=Decimal("0"), margin_used=Decimal("0"), equity=Decimal("1000"),
        free_margin=Decimal("1000"), leverage=100,
    )


INST = SimpleNamespace(contract_size=Decimal("100000"), base_currency="EUR",
                       quote_currency="USD", symbol="EURUSD")


def _run(coro):
    return asyncio.run(coro)


class ModifyRiskGateTests(unittest.TestCase):
    def test_lots_change_without_risk_role_is_403(self):
        pos = _pos()
        db = _DB([pos, _acc(pos)])
        body = ModifyPositionRequest(lots=5)
        with self.assertRaises(HTTPException) as ctx:
            _run(ts.modify_position(pos.id, body, uuid4(), None, db, allow_risk_edits=False))
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(pos.lots, Decimal("1"))
        self.assertFalse(db.committed)

    def test_open_price_and_side_change_without_risk_role_is_403(self):
        for body in (ModifyPositionRequest(open_price=1.2), ModifyPositionRequest(side="sell")):
            pos = _pos()
            with self.assertRaises(HTTPException) as ctx:
                _run(ts.modify_position(pos.id, body, uuid4(), None, _DB([pos, _acc(pos)])))
            self.assertEqual(ctx.exception.status_code, 403)

    def test_unchanged_prefilled_values_allow_sl_tp_edit(self):
        pos = _pos()
        db = _DB([pos, _acc(pos), []])
        body = ModifyPositionRequest(stop_loss=1.05, open_price=1.1, lots=1, side="buy")
        _run(ts.modify_position(pos.id, body, uuid4(), None, db, allow_risk_edits=False))
        self.assertEqual(pos.stop_loss, Decimal("1.05"))
        self.assertTrue(db.committed)

    def test_risk_role_may_change_lots(self):
        pos = _pos()
        db = _DB([pos, _acc(pos), []])
        _run(ts.modify_position(pos.id, ModifyPositionRequest(lots=2), uuid4(), None, db,
                                allow_risk_edits=True))
        self.assertEqual(pos.lots, Decimal("2"))

    def test_schema_bounds(self):
        for bad in ({"lots": 0}, {"lots": 101}, {"lots": float("nan")},
                    {"open_price": 0}, {"open_price": -1}, {"stop_loss": float("inf")}):
            with self.subTest(bad=bad):
                with self.assertRaises(ValidationError):
                    ModifyPositionRequest(**bad)
        with self.assertRaises(ValidationError):
            ClosePositionRequest(close_price=0)


class CloseTests(unittest.TestCase):
    def setUp(self):
        self._orig = ts._get_live_price

        async def _tick(symbol):
            return {"bid": 1.20000, "ask": 1.20020}
        ts._get_live_price = _tick

    def tearDown(self):
        ts._get_live_price = self._orig

    def _close(self, body, *, allow, band=True, demo=True, book="B"):
        pos = _pos()
        acc = _acc(pos, demo=demo)
        results = [pos, acc]
        if not demo:
            results.append(SimpleNamespace(book_type=book))
        results.append(INST)
        db = _DB(results)
        out = _run(ts.close_position(pos.id, body, uuid4(), None, db,
                                     allow_supplied_price=allow, enforce_price_band=band))
        return out, db, pos, acc

    def test_supplied_price_needs_risk_role(self):
        with self.assertRaises(HTTPException) as ctx:
            self._close(ClosePositionRequest(close_price=1.2), allow=False)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_supplied_price_outside_band_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            self._close(ClosePositionRequest(close_price=1.5), allow=True)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_super_admin_exempt_from_band(self):
        out, db, pos, _acc_ = self._close(ClosePositionRequest(close_price=1.5), allow=True, band=False)
        self.assertEqual(pos.close_price, Decimal("1.5"))

    def test_market_close_writes_ledger_row(self):
        out, db, pos, acc = self._close(ClosePositionRequest(), allow=False)
        self.assertEqual(pos.close_price, Decimal("1.2"))
        txns = [t for t in db.added if isinstance(t, Transaction)]
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0].type, "profit")
        self.assertEqual(txns[0].amount, pos.profit)
        self.assertEqual(acc.balance, Decimal("1000") + pos.profit)

    def test_market_close_refuses_stale_quote(self):
        async def _stale(symbol):
            return {"bid": 1.2, "ask": 1.2, "stale": True}
        ts._get_live_price = _stale
        with self.assertRaises(HTTPException) as ctx:
            self._close(ClosePositionRequest(), allow=True)
        self.assertEqual(ctx.exception.status_code, 400)
        with self.assertRaises(HTTPException) as ctx:
            self._close(ClosePositionRequest(close_price=1.2), allow=True)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_a_book_close_refused(self):
        with self.assertRaises(HTTPException) as ctx:
            self._close(ClosePositionRequest(), allow=True, demo=False, book="A")
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
