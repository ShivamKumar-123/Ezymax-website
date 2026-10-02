"""Continuous bar persistence — keeps the durable `ohlc_bars` store current
for EVERY symbol and timeframe, independent of who's looking at a chart.

The market-data aggregator publishes completed bars to Redis
(`bars:{SYMBOL}:{TF}`). This engine sweeps those every few seconds and upserts
them into the DB, so all timeframes (1m…1d) accumulate continuously and the
chart's realtime poll (`?live=1`) can stay a pure read. Idempotent (PK on
symbol,tf,ts) — re-persisting the same bars is a no-op.

Section F: leader-locked (one writer across all workers / replicas instead of
N processes upserting the same rows every 3 s), the key list comes from the
`bars:index` set the aggregator maintains (no keyspace SCAN; SCAN remains only
as a fallback while the set is empty during a rolling deploy), and all LRANGEs
go out in one pipelined round trip.
"""
import asyncio
import json
import logging

from packages.common.src.instrumentation import spawn
from packages.common.src.database import WorkerSessionLocal as AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.redis_client import redis_client, BARS_INDEX_SET
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
        self._task = spawn(self._loop(), name="bars_persist_engine")
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
                async with engine_lock("bars_persist", ttl_seconds=30) as is_leader:
                    if is_leader:
                        await self._persist_cycle()
            except Exception as e:  # never let a bad cycle kill the loop
                logger.warning("bars persist cycle error: %s", e)
            await asyncio.sleep(self._interval)

    async def _bar_keys(self) -> list[str]:
        try:
            members = await redis_client.smembers(BARS_INDEX_SET)
        except Exception as e:
            logger.debug("bars persist index read failed: %s", e)
            members = set()
        if members:
            return [m.decode() if isinstance(m, (bytes, bytearray)) else str(m) for m in members]
        # Rolling-deploy fallback: aggregator not yet maintaining the index.
        keys: list[str] = []
        async for key in redis_client.scan_iter(match="bars:*", count=300):
            keys.append(key.decode() if isinstance(key, (bytes, bytearray)) else str(key))
        return keys

    async def _persist_cycle(self) -> None:
        # Discover all active (symbol, tf) list keys.
        try:
            raw_keys = await self._bar_keys()
        except Exception as e:
            logger.debug("bars persist key discovery failed: %s", e)
            return
        targets: list[tuple[str, str, str]] = []
        for k in raw_keys:
            parts = k.split(":")
            # Only bars:{SYM}:{TF} (3 parts). Skips markers like bars:bf:… (4).
            if len(parts) != 3:
                continue
            _, sym, tf = parts
            if tf not in bars_store.TF_SECONDS:
                continue
            targets.append((k, sym, tf))
        if not targets:
            return

        pipe = redis_client.pipeline(transaction=False)
        for k, _sym, _tf in targets:
            pipe.lrange(k, 0, 40)
        try:
            all_rows = await pipe.execute()
        except Exception as e:
            logger.debug("bars persist lrange failed: %s", e)
            return

        async with AsyncSessionLocal() as db:
            total = 0
            for (k, sym, tf), rows in zip(targets, all_rows):
                try:
                    out = []
                    for raw in rows or ():
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
