"""C-TRADE-3: a follower who subscribes while the master position is ALREADY
open (catch-up seeding) must enter at the CURRENT market price, not the master's
original entry — otherwise they instantly inherit the master's accrued P&L.
"""
import asyncio
import json
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import Position
from services.gateway.src.engines import copy_engine
from services.gateway.src.engines.copy_engine import CopyTradeEngine


class _Res:
    def scalar_one_or_none(self):
        return None


class _DB:
    def __init__(self):
        self.added = []

    async def execute(self, *a, **k):
        return _Res()

    async def flush(self):
        return None

    def add(self, obj):
        self.added.append(obj)
        if not getattr(obj, "id", None):
            try:
                obj.id = uuid4()
            except Exception:
                pass


class _FakeCache:
    def __init__(self, payload):
        self._payload = payload

    async def get(self, *a, **k):
        return self._payload


def _build():
    instr = SimpleNamespace(
        symbol="EURUSD", contract_size=Decimal("100000"),
        lot_step=Decimal("0.01"), min_lot=Decimal("0.01"), max_lot=Decimal("100"),
    )
    master_pos = SimpleNamespace(
        id=uuid4(), instrument=instr, instrument_id=uuid4(),
        side="buy", lots=Decimal("1"), open_price=Decimal("100"),
        stop_loss=None, take_profit=None,
    )
    investor = SimpleNamespace(
        id=uuid4(), max_drawdown_pct=None, max_lot_override=None,
        allocation_amount=Decimal("1000"), total_profit=Decimal("0"),
        investor_user_id=uuid4(), investor_account_id=uuid4(),
    )
    investor_account = SimpleNamespace(
        id=uuid4(), is_active=True, leverage=500, free_margin=Decimal("1000000"),
        equity=Decimal("1000"), margin_used=Decimal("0"), user_id=uuid4(),
        account_number="ACC1",
    )
    master_account = SimpleNamespace(id=uuid4())
    master = SimpleNamespace(id=uuid4())
    return instr, master_pos, investor, investor_account, master_account, master


class CopyCatchupPriceTests(unittest.TestCase):
    def setUp(self):
        self._orig_cache = copy_engine.price_cache
        self._orig_rct = copy_engine.resolve_copy_type
        copy_engine.resolve_copy_type = lambda inv, m: "signal"

    def tearDown(self):
        copy_engine.price_cache = self._orig_cache
        copy_engine.resolve_copy_type = self._orig_rct

    def _run(self, catch_up):
        instr, master_pos, investor, investor_account, master_account, master = _build()
        # current market ask = 110 (master opened at 100 → 10 of accrued move)
        copy_engine.price_cache = _FakeCache(json.dumps({"bid": 109.0, "ask": 110.0}))
        ce = CopyTradeEngine()
        ce.compute_lot_size = lambda *a, **k: (1.0, None)
        db = _DB()
        asyncio.run(ce._open_copy(
            master, master_pos, investor, investor_account,
            master_account, 0.0, db, catch_up=catch_up,
        ))
        positions = [o for o in db.added if isinstance(o, Position)]
        self.assertEqual(len(positions), 1)
        return positions[0]

    def test_catch_up_uses_current_market_price(self):
        pos = self._run(catch_up=True)
        # follower enters at the live ask (110), NOT the master's entry (100).
        self.assertEqual(pos.open_price, Decimal("110.0"))

    def test_realtime_mirror_uses_master_open_price(self):
        pos = self._run(catch_up=False)
        self.assertEqual(pos.open_price, Decimal("100"))


if __name__ == "__main__":
    unittest.main()
