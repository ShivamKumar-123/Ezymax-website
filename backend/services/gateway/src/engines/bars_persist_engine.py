"""Continuous bar persistence — keeps the durable `ohlc_bars` store current
for EVERY symbol and timeframe, independent of who's looking at a chart.

The market-data aggregator publishes completed bars to Redis
(`bars:{SYMBOL}:{TF}`). This engine sweeps those every few seconds and upserts
them into the DB, so all timeframes (1m…1d) accumulate continuously and the
chart's realtime poll (`?live=1`) can stay a pure read. Idempotent (PK on
symbol,tf,ts) — re-persisting the same bars is a no-op.
"""
import asyncio
import json
import logging

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.redis_client import redis_client
from packages.common.src import bars_store

logger = logging.getLogger("gateway.bars_persist")


def _norm(b: dict) -> dict | None:
    try:
        return {
            "time": int(b.get("time", 0)),
            "open": float(b["open"]), "high": float(b["high"]),
            "low": float(b["low"]), "close": float(b["close"]),
            "volume": float(b.get("volume", 0.0)),
        }
    except (KeyError, TypeError, ValueError):
        return None


class BarsPersistEngine:
    def __init__(self, interval: float = 3.0):
        self._interval = interval
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("bars persist engine started (every %.1fs)", self._interval)

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._persist_cycle()
            except Exception as e:  # never let a bad cycle kill the loop
                logger.warning("bars persist cycle error: %s", e)
            await asyncio.sleep(self._interval)

    async def _persist_cycle(self) -> None:
        # Discover all active (symbol, tf) from the completed-bar list keys.
        keys: list = []
        try:
            async for key in redis_client.scan_iter(match="bars:*", count=300):
                keys.append(key)
        except Exception as e:
            logger.debug("bars persist scan failed: %s", e)
            return
        if not keys:
            return

        async with AsyncSessionLocal() as db:
            total = 0
            for key in keys:
                try:
                    k = key.decode() if isinstance(key, (bytes, bytearray)) else str(key)
                    parts = k.split(":")
                    # Only bars:{SYM}:{TF} (3 parts). Skips markers like bars:bf:… (4).
                    if len(parts) != 3:
                        continue
                    _, sym, tf = parts
                    if tf not in bars_store.TF_SECONDS:
                        continue
                    rows = await redis_client.lrange(k, 0, 40)
                    out = []
                    for raw in rows:
                        try:
                            nb = _norm(json.loads(raw))
                            if nb:
                                out.append(nb)
                        except Exception:
                            continue
                    if out:
                        total += await bars_store.upsert_bars(db, sym, tf, out)
                except Exception:
                    continue
            if total:
                await db.commit()


bars_persist_engine = BarsPersistEngine()
