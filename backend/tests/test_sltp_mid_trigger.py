"""SL/TP must trigger on the MID, not the spread-adjusted bid/ask.

A wide spread (e.g. an admin widening it while the market never moved) drops the
bid far below a BUY's stop-loss even though the true market (mid) never reached
it. The engine must NOT close on that; it must close only when the mid crosses
the level. Regression guard for the "admin set a big spread and the trade
auto-closed" report.
"""
import asyncio
import json
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.engines import sltp_engine as se


class _Res:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, positions):
        self._positions = positions

    async def execute(self, *a, **k):
        return _Res(self._positions)

    async def commit(self):
        return None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _pos(side, open_price, sl=None, tp=None):
    return SimpleNamespace(
        id=uuid4(), account_id=uuid4(), status="open", side=side,
        open_price=Decimal(str(open_price)), lots=Decimal("0.01"),
        stop_loss=Decimal(str(sl)) if sl is not None else None,
        take_profit=Decimal(str(tp)) if tp is not None else None,
        instrument=SimpleNamespace(symbol="XAUUSD"),
    )


class SltpMidTriggerTests(unittest.TestCase):
    def _run(self, pos, bid, ask):
        closed = []

        async def _fake_close(db, p, close_price, reason):
            closed.append((p.id, Decimal(str(close_price)), reason))

        orig_session = se.AsyncSessionLocal
        orig_stale = se.is_tick_stale
        se.AsyncSessionLocal = lambda: _DB([pos])
        se.is_tick_stale = lambda *_a, **_k: False
        engine = se.SLTPEngine()
        engine._prices = {"XAUUSD": {"bid": str(bid), "ask": str(ask)}}
        engine._close_position = _fake_close
        try:
            asyncio.run(engine._check_positions_locked())
        finally:
            se.AsyncSessionLocal = orig_session
            se.is_tick_stale = orig_stale
        return closed

    def test_wide_spread_below_sl_does_not_trigger_when_mid_above(self):
        # BUY, SL 4284. Bid 4283 (below SL) but ask 4287 -> mid 4285 (above SL).
        # A 400-point spread; the market (mid) never reached the SL.
        closed = self._run(_pos("buy", 4285, sl=4284), bid=4283, ask=4287)
        self.assertEqual(closed, [])  # spread must NOT fire the stop

    def test_mid_crossing_sl_triggers_and_closes_at_sl(self):
        # Mid 4283.95 (<= SL 4284) -> real move through the stop -> fires.
        pos = _pos("buy", 4285, sl=4284)
        closed = self._run(pos, bid=4283.90, ask=4284.00)
        self.assertEqual(len(closed), 1)
        self.assertEqual(closed[0][0], pos.id)
        self.assertEqual(closed[0][1], Decimal("4284"))  # books at the SL level
        self.assertEqual(closed[0][2], "sl")

    def test_wide_spread_above_tp_does_not_trigger_when_mid_below(self):
        # BUY, TP 4290. Ask irrelevant; bid 4291 (above TP) but mid 4288 < TP.
        closed = self._run(_pos("buy", 4285, tp=4290), bid=4291, ask=4285)
        self.assertEqual(closed, [])


if __name__ == "__main__":
    unittest.main()
