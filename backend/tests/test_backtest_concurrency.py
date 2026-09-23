"""H-TRADE-5: a user may have at most one backtest running at a time; a second
concurrent request is rejected (429) rather than piling CPU work on the worker.
Also asserts the hard bar cap constant.
"""
import asyncio
import unittest
from uuid import uuid4

from fastapi import HTTPException

from services.gateway.src.services import ai_strategy_service as svc


class BacktestConcurrencyTests(unittest.TestCase):
    def test_second_backtest_rejected(self):
        async def scenario():
            uid = uuid4()
            lock = asyncio.Lock()
            svc._backtest_locks[str(uid)] = lock
            await lock.acquire()  # simulate a backtest already running
            try:
                await svc.backtest_strategy(uuid4(), uid, db=None)
            finally:
                lock.release()

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(scenario())
        self.assertEqual(ctx.exception.status_code, 429)

    def test_bar_cap_is_20000(self):
        self.assertEqual(svc._BACKTEST_MAX_BARS, 20000)
        self.assertEqual(svc._BACKTEST_WALL_SECONDS, 30.0)


if __name__ == "__main__":
    unittest.main()
