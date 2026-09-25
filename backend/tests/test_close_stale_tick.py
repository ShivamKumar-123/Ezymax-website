"""C-TRADE-5: close_position must refuse to settle against a stale quote.

get_current_price() and modify_position() already bail on is_tick_stale(), but
close_position() read the price cache directly and would realise P&L at a frozen
/ market-closed price. Pure-unit: drive close_position() with a fake DB + a
stale tick and assert it raises 400 before booking anything.
"""
import asyncio
import json
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from services.gateway.src.services import trading_service
from services.gateway.src.services.trading_service import close_position


class _Result:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _FakeDB:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, *a, **k):
        return _Result(self._results.pop(0) if self._results else None)

    async def refresh(self, *a, **k):
        return None


class _FakeCache:
    def __init__(self, payload):
        self._payload = payload

    async def get(self, *a, **k):
        return self._payload


class CloseStaleTickTests(unittest.TestCase):
    def setUp(self):
        self._orig_cache = trading_service.price_cache

    def tearDown(self):
        trading_service.price_cache = self._orig_cache

    def test_stale_tick_rejected(self):
        uid = uuid4()
        pos = SimpleNamespace(
            id=uuid4(), status="open", account_id=uuid4(),
            instrument=SimpleNamespace(symbol="EURUSD"), side="buy",
        )
        account = SimpleNamespace(id=pos.account_id, user_id=uid, account_group_id=uuid4())
        # explicit stale marker → is_tick_stale() returns True
        trading_service.price_cache = _FakeCache(json.dumps({"bid": 1.0, "ask": 1.1, "stale": True}))
        # execute order: load Position, load account (ownership), lock_account.
        db = _FakeDB([pos, account, account])
        req = SimpleNamespace(lots=None)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(close_position(pos.id, req, uid, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("stale", ctx.exception.detail.lower())


if __name__ == "__main__":
    unittest.main()
