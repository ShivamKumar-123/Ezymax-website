"""Partial close must leave the REMAINING lots on an OPEN position and write a
TradeHistory row for ONLY the closed portion, with commission/swap/profit split
proportionally. Regression guard for the user-reported expectation:

    5 lots, close 70% (3.5)  ->  1.5 lots remain OPEN, 3.5 lots go to history.

Runs the REAL close_position() with a fake DB/session and patched pricing so the
arithmetic and the two records (open position + history) are exercised end to
end, no Postgres required.
"""
import asyncio
import json
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.services import trading_service as ts
from packages.common.src.models.trading import TradeHistory


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
    """Returns queued results for the 3 execute() calls close_position makes:
    load Position, load TradingAccount, then re-load remaining OPEN positions
    for the margin self-heal."""
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def refresh(self, obj, **k):
        return None  # with_for_update lock is a no-op in the fake

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None


def _fake_create_task(coro, *a, **k):
    # Neutralise the fire-and-forget notification / kafka / A-book tasks.
    try:
        coro.close()
    except Exception:
        pass
    return SimpleNamespace()


class PartialCloseRemainingTests(unittest.TestCase):
    def setUp(self):
        self._orig = {
            "price_cache_get": ts.price_cache.get,
            "is_tick_stale": ts.is_tick_stale,
            "calc_pnl_live": ts.calc_pnl_live,
            "resolve_user_quote": ts.resolve_user_quote,
            "release_bonuses": ts.wallet_service.release_bonuses_after_trade,
            "fire_event": ts.fire_event,
            "create_task": ts.asyncio.create_task,
        }
        fresh_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        tick = json.dumps({
            "symbol": "EURUSD", "bid": "1.10000", "ask": "1.10010",
            "timestamp": datetime.now(timezone.utc).isoformat(), "ts_ms": fresh_ms,
        })

        async def _price_get(_sym):
            return tick

        async def _calc(*_a, **_k):
            return Decimal("100")  # full P&L for the whole 5 lots

        async def _uq(_db, _inst, bid, ask, **_k):
            return bid, ask

        async def _noop(*_a, **_k):
            return None

        ts.price_cache.get = _price_get
        ts.is_tick_stale = lambda *_a, **_k: False
        ts.calc_pnl_live = _calc
        ts.resolve_user_quote = _uq
        ts.wallet_service.release_bonuses_after_trade = _noop
        ts.fire_event = _noop
        ts.asyncio.create_task = _fake_create_task

    def tearDown(self):
        ts.price_cache.get = self._orig["price_cache_get"]
        ts.is_tick_stale = self._orig["is_tick_stale"]
        ts.calc_pnl_live = self._orig["calc_pnl_live"]
        ts.resolve_user_quote = self._orig["resolve_user_quote"]
        ts.wallet_service.release_bonuses_after_trade = self._orig["release_bonuses"]
        ts.fire_event = self._orig["fire_event"]
        ts.asyncio.create_task = self._orig["create_task"]

    def _run_close(self, open_lots, close_lots):
        uid, acct_id = uuid4(), uuid4()
        inst = SimpleNamespace(
            symbol="EURUSD", contract_size=Decimal("100000"),
            base_currency="EUR", quote_currency="USD",
        )
        pos = SimpleNamespace(
            id=uuid4(), status="open", side="buy",
            open_price=Decimal("1.10000"), lots=Decimal(str(open_lots)),
            commission=Decimal("10"), swap=Decimal("-2"),
            created_at=datetime.now(timezone.utc),
            account_id=acct_id, instrument_id=uuid4(), instrument=inst,
            stop_loss=None, take_profit=None, close_price=None,
            profit=None, closed_at=None,
            spread_override=None, spread_override_type=None,
        )
        account = SimpleNamespace(
            id=acct_id, user_id=uid, balance=Decimal("1000"),
            credit=Decimal("0"), margin_used=Decimal("0"), leverage=100,
            is_demo=True, account_group_id=None, equity=Decimal("0"),
            free_margin=Decimal("0"),
        )
        # execute() call order in close_position: load Position, load account
        # (ownership), lock_account (FOR UPDATE), then re-load remaining open
        # positions for the margin self-heal.
        db = _DB([
            _Res(scalar=pos),
            _Res(scalar=account),
            _Res(scalar=account),   # lock_account FOR UPDATE
            _Res(items=[pos]),
        ])
        req = SimpleNamespace(lots=close_lots)
        result = asyncio.run(ts.close_position(pos.id, req, uid, db))
        history = [o for o in db.added if isinstance(o, TradeHistory)]
        return pos, account, result, history

    def test_5lots_close_3point5_leaves_1point5_open(self):
        pos, account, result, history = self._run_close(5, 3.5)

        # Remaining stays OPEN with 1.5 lots
        self.assertEqual(pos.lots, Decimal("1.5"))
        self.assertEqual(str(pos.status), "open")  # NOT closed
        self.assertEqual(result["remaining_lots"], 1.5)
        self.assertEqual(result["lots_closed"], 3.5)
        self.assertIn("Partial", result["message"])

        # Exactly one history row, for the CLOSED 3.5 lots only
        self.assertEqual(len(history), 1)
        h = history[0]
        self.assertEqual(h.lots, Decimal("3.5"))
        self.assertEqual(h.position_id, pos.id)
        # Proportional split (ratio 0.7): profit 100->70, comm 10->7, swap -2->-1.4
        self.assertEqual(h.profit, Decimal("70.0"))
        self.assertEqual(h.commission, Decimal("7.0"))
        self.assertEqual(h.swap, Decimal("-1.4"))
        # Realised P&L credited to balance
        self.assertEqual(account.balance, Decimal("1070.0"))

    def test_full_close_closes_position_and_history_has_all_lots(self):
        pos, account, result, history = self._run_close(5, 5)
        self.assertEqual(str(pos.status), "closed")
        self.assertEqual(result["remaining_lots"], 0)
        self.assertEqual(result["lots_closed"], 5.0)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].lots, Decimal("5"))


if __name__ == "__main__":
    unittest.main()
