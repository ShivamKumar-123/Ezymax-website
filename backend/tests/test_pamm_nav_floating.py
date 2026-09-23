"""H-TRADE-2: PAMM pool NAV valuation must include the floating P&L of open
positions, not just the settled balance.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.services import social_service as ss


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


class PoolNavFloatingTests(unittest.TestCase):
    def setUp(self):
        self._orig = ss._live_open_pnl

    def tearDown(self):
        ss._live_open_pnl = self._orig

    def test_includes_floating_pnl(self):
        pool = SimpleNamespace(id=uuid4(), balance=Decimal("1000"))
        pos = SimpleNamespace(instrument=SimpleNamespace(symbol="EURUSD"))

        async def _pnl(p, inst):
            return 50.0
        ss._live_open_pnl = _pnl

        val = asyncio.run(ss._pool_value_with_floating(_DB([pos]), pool))
        self.assertEqual(val, Decimal("1050"))

    def test_no_positions_is_balance(self):
        pool = SimpleNamespace(id=uuid4(), balance=Decimal("777"))
        val = asyncio.run(ss._pool_value_with_floating(_DB([]), pool))
        self.assertEqual(val, Decimal("777"))

    def test_negative_floating_reduces_value(self):
        pool = SimpleNamespace(id=uuid4(), balance=Decimal("1000"))
        pos = SimpleNamespace(instrument=SimpleNamespace(symbol="EURUSD"))

        async def _pnl(p, inst):
            return -120.0
        ss._live_open_pnl = _pnl

        val = asyncio.run(ss._pool_value_with_floating(_DB([pos]), pool))
        self.assertEqual(val, Decimal("880"))


if __name__ == "__main__":
    unittest.main()
