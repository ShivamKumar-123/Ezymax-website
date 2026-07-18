"""Tick Store — Writes tick data to TimescaleDB.

Also hosts OHLCStore — the durable per-bar sink the BarAggregator writes every
CLOSED candle to (the same `ohlc_bars` table in the MAIN Postgres the gateway
serves /bars history from). With it, saved history is BY CONSTRUCTION the exact
candle that was streamed live: no gaps, no tick-rebuild mismatch, restart-proof.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from packages.common.src.database import AsyncSessionLocal, TimescaleSessionLocal
from packages.common.src.bars_store import ensure_bars_table, upsert_bars

logger = logging.getLogger("market-data.store")


def _parse_tick_time(ts: str) -> datetime:
    """Infoway / feed timestamps are ISO strings; asyncpg needs datetime."""
    t = (ts or "").strip()
    if not t:
        return datetime.now(timezone.utc)
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(t)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime.now(timezone.utc)


class TickStore:
    def __init__(self):
        self._batch: list[tuple] = []
        self._batch_size = 100
        self._initialized = False

    async def init(self):
        self._initialized = True
        logger.info("Tick store initialized")

    async def insert_tick(self, symbol: str, bid: float, ask: float, timestamp: str):
        self._batch.append((_parse_tick_time(timestamp), symbol, bid, ask))

        if len(self._batch) >= self._batch_size:
            await self._flush()

    async def _flush(self):
        if not self._batch:
            return

        batch = self._batch[:]
        self._batch.clear()

        try:
            async with TimescaleSessionLocal() as session:
                for ts, symbol, bid, ask in batch:
                    await session.execute(
                        text(
                            "INSERT INTO ticks (time, symbol, bid, ask) "
                            "VALUES (:time, :symbol, :bid, :ask)"
                        ),
                        {"time": ts, "symbol": symbol, "bid": bid, "ask": ask},
                    )
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to flush ticks: {e}")


class OHLCStore:
    """Durable sink for CLOSED bars → the gateway's `ohlc_bars` table.

    The aggregator calls upsert() once per closed candle. Writes are idempotent
    on (symbol, tf, ts), so the aggregator's two persistence paths (tick-driven
    rollover in update() and the 1s aggregation loop) can never duplicate a bar.
    Failures are logged at WARNING — a dropped bar must never be silent, that's
    exactly what shows up later as a chart gap.
    """

    def __init__(self):
        self._ready = False

    async def init(self):
        try:
            async with AsyncSessionLocal() as session:
                await ensure_bars_table(session)
            self._ready = True
            logger.info("OHLC store initialized (ohlc_bars)")
        except Exception as exc:
            # Don't block startup on a DB hiccup — retry lazily on first upsert.
            logger.warning("OHLC store init failed (will retry on first bar): %s", exc)

    async def upsert(
        self, symbol: str, timeframe: str, bar_start: int,
        open_: float, high: float, low: float, close: float,
        volume: float = 0.0,
    ):
        try:
            if not self._ready:
                await self.init()
            async with AsyncSessionLocal() as session:
                await upsert_bars(session, symbol, timeframe, [{
                    "time": int(bar_start),
                    "open": float(open_), "high": float(high),
                    "low": float(low), "close": float(close),
                    "volume": float(volume or 0.0),
                }])
                await session.commit()
        except Exception as exc:
            logger.warning(
                "OHLC upsert FAILED %s %s @%s: %s", symbol, timeframe, bar_start, exc,
            )
