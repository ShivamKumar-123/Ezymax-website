"""Tick Store — Writes tick data to TimescaleDB."""
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import text
from packages.common.src.database import TimescaleSessionLocal

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


# Timeframes we persist as candles (matches BarAggregator + the frontend datafeed).
OHLC_TIMEFRAMES = ("1m", "5m", "15m", "30m", "1h", "4h", "1d")


class OHLCStore:
    """Persist CLOSED OHLC bars to TimescaleDB (one ``ohlcv_<tf>`` table per
    timeframe) so chart history is DURABLE and deep — instead of living only in
    Redis (1000-bar cap, wiped on restart) or being faked by seed_bars.

    Self-heals the schema on ``init()`` with idempotent DDL so it works whether
    the ``ohlcv_*`` hypertables already exist (prod) or not (local Postgres);
    the UNIQUE(symbol, time) index is valid on a hypertable because it includes
    the ``time`` partition key. Only CLOSED bars are written here; the forming
    candle stays real-time in Redis + /ws/bars.
    """

    def __init__(self) -> None:
        self._ready = False
        # Monotonic time of the last SUCCESSFUL durable commit (any symbol/tf).
        # The durable-write watchdog reads this to detect a silent write stall
        # (e.g. the aggregator-rollover bug that froze history for 5 days): while
        # live ticks flow but this stops advancing, the persistence path is dead.
        self.last_write_mono: float | None = None

    async def init(self) -> None:
        try:
            async with TimescaleSessionLocal() as session:
                for tf in OHLC_TIMEFRAMES:
                    await session.execute(text(
                        f"CREATE TABLE IF NOT EXISTS ohlcv_{tf} ("
                        "  time TIMESTAMPTZ NOT NULL, symbol VARCHAR(20) NOT NULL,"
                        "  open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,"
                        "  low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL,"
                        "  volume DOUBLE PRECISION DEFAULT 0, tick_count INTEGER DEFAULT 0)"
                    ))
                await session.commit()
            self._ready = True
            logger.info("OHLC store initialized (%d timeframes)", len(OHLC_TIMEFRAMES))
        except Exception as e:
            # Non-fatal: if the DB is unreachable the chart still works off Redis.
            logger.error(f"OHLC store init failed (chart falls back to Redis): {e}")

    # We intentionally do NOT use `ON CONFLICT (symbol, time)`: in prod the
    # ohlcv_<tf> tables are COMPRESSED TimescaleDB hypertables that (a) have no
    # UNIQUE(symbol, time) index and (b) can't get one while compression is
    # enabled (CREATE UNIQUE INDEX is blocked). So we upsert with UPDATE-then-
    # INSERT, which needs no unique index. The aggregator is a single writer per
    # (symbol, tf, window) so the race window is negligible, and recent bars
    # land in uncompressed chunks where UPDATE/INSERT are fully supported.
    _UPDATE = (
        "UPDATE {table} SET open=:o, high=:h, low=:l, close=:c, volume=:v, tick_count=:tc "
        "WHERE symbol=:sym AND time=to_timestamp(:t)"
    )
    _INSERT = (
        "INSERT INTO {table} (time, symbol, open, high, low, close, volume, tick_count) "
        "VALUES (to_timestamp(:t), :sym, :o, :h, :l, :c, :v, :tc)"
    )

    async def _upsert_one(self, session, tf: str, params: dict) -> None:
        res = await session.execute(text(self._UPDATE.format(table=f"ohlcv_{tf}")), params)
        if (res.rowcount or 0) == 0:
            await session.execute(text(self._INSERT.format(table=f"ohlcv_{tf}")), params)

    async def upsert(self, symbol: str, tf: str, bar_start: int,
                     o: float, h: float, l: float, c: float,
                     volume: float = 0.0, tick_count: int = 0) -> None:
        """Persist a single CLOSED bar (idempotent — re-closing the window updates it)."""
        if not self._ready or tf not in OHLC_TIMEFRAMES:
            return
        try:
            async with TimescaleSessionLocal() as session:
                await self._upsert_one(session, tf, {
                    "t": int(bar_start), "sym": symbol, "o": float(o), "h": float(h),
                    "l": float(l), "c": float(c), "v": float(volume), "tc": int(tick_count),
                })
                await session.commit()
            self.last_write_mono = time.monotonic()
        except Exception as exc:
            logger.debug("OHLC upsert %s %s failed: %s", symbol, tf, exc)

    async def upsert_many(self, symbol: str, tf: str, bars: list[dict]) -> None:
        """Bulk upsert for history backfill. Each bar: {time(epoch s), open,
        high, low, close, volume, tick_count}."""
        if not self._ready or tf not in OHLC_TIMEFRAMES or not bars:
            return
        try:
            async with TimescaleSessionLocal() as session:
                for b in bars:
                    await self._upsert_one(session, tf, {
                        "t": int(b.get("time", 0)), "sym": symbol,
                        "o": float(b["open"]), "h": float(b["high"]),
                        "l": float(b["low"]), "c": float(b["close"]),
                        "v": float(b.get("volume", 0) or 0),
                        "tc": int(b.get("tick_count", 0) or 0),
                    })
                await session.commit()
            self.last_write_mono = time.monotonic()
        except Exception as exc:
            logger.debug("OHLC bulk upsert %s %s failed: %s", symbol, tf, exc)


# Module singleton — imported by the aggregator (write-on-rollover), the bars
# API (durable-first read), and the backfill script.
ohlc_store = OHLCStore()
