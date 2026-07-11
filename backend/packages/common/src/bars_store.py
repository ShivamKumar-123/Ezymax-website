"""Durable OHLC bar store (Postgres).

Gives the chart gap-free, deep history WITHOUT re-hitting the market-data
source on every request:

  • Bars are persisted in `ohlc_bars` with PK (symbol, tf, ts), so writes are
    idempotent (dedup'd) and reads are gap-free by construction.
  • The /bars endpoint reads from here first; the source (Infoway / Binance)
    is only called to backfill a genuinely missing range, and the result is
    stored — so repeated requests never re-fetch the same data.
  • A persist-forward loop keeps it current from the live aggregator's bars.

Lives in the MAIN Postgres (the gateway already connects there) — no extra DB
wiring. `ts` is epoch SECONDS, aligned to the bar's open time.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# Timeframe → seconds. These are the canonical tf slugs used across the stack.
TF_SECONDS: dict[str, int] = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "1d": 86400,
}


async def ensure_bars_table(db: AsyncSession) -> None:
    """Create the durable bars table if it doesn't exist. Idempotent — safe to
    call on every gateway boot (mirrors the other _ensure_* startup helpers)."""
    await db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS ohlc_bars (
            symbol  VARCHAR(20)  NOT NULL,
            tf      VARCHAR(4)   NOT NULL,
            ts      BIGINT       NOT NULL,          -- epoch seconds, bar open
            open    NUMERIC(20,8) NOT NULL,
            high    NUMERIC(20,8) NOT NULL,
            low     NUMERIC(20,8) NOT NULL,
            close   NUMERIC(20,8) NOT NULL,
            volume  NUMERIC(28,8) NOT NULL DEFAULT 0,
            PRIMARY KEY (symbol, tf, ts)
        )
        """
    ))
    # Covering index for the hot read pattern: range scan by (symbol, tf, ts).
    await db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_ohlc_bars_sym_tf_ts ON ohlc_bars(symbol, tf, ts)"
    ))
    await db.commit()


def _num(v) -> float:
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


async def read_bars(
    db: AsyncSession, symbol: str, tf: str,
    from_ts: int | None = None, to_ts: int | None = None,
    limit: int = 5000,
) -> list[dict]:
    """Return stored bars for (symbol, tf) within [from_ts, to_ts], ascending.

    Returns dicts shaped for the chart datafeed: {time, open, high, low,
    close, volume} with `time` in epoch SECONDS.
    """
    clauses = ["symbol = :sym", "tf = :tf"]
    params: dict = {"sym": symbol.upper(), "tf": tf}
    if from_ts:
        clauses.append("ts >= :from_ts")
        params["from_ts"] = int(from_ts)
    if to_ts:
        clauses.append("ts <= :to_ts")
        params["to_ts"] = int(to_ts)
    params["lim"] = int(limit)
    # Take the most recent `limit` rows in the window, then present ascending.
    sql = text(
        f"""
        SELECT ts, open, high, low, close, volume
        FROM (
            SELECT ts, open, high, low, close, volume
            FROM ohlc_bars
            WHERE {' AND '.join(clauses)}
            ORDER BY ts DESC
            LIMIT :lim
        ) q
        ORDER BY ts ASC
        """
    )
    rows = (await db.execute(sql, params)).all()
    return [
        {
            "time": int(r[0]),
            "open": _num(r[1]), "high": _num(r[2]), "low": _num(r[3]),
            "close": _num(r[4]), "volume": _num(r[5]),
        }
        for r in rows
    ]


async def upsert_bars(db: AsyncSession, symbol: str, tf: str, bars: Iterable[dict]) -> int:
    """Insert/replace bars. Idempotent on (symbol, tf, ts). `bars` items may use
    either {time|ts, open, high, low, close, volume} keys. Returns count written.

    Does NOT commit — caller controls the transaction so a batch upsert stays
    atomic with any surrounding work."""
    payload = []
    for b in bars:
        ts = b.get("time", b.get("ts"))
        if ts is None:
            continue
        try:
            payload.append({
                "sym": symbol.upper(), "tf": tf, "ts": int(ts),
                "o": float(b["open"]), "h": float(b["high"]),
                "l": float(b["low"]), "c": float(b["close"]),
                "v": float(b.get("volume", 0) or 0),
            })
        except (KeyError, TypeError, ValueError):
            continue
    if not payload:
        return 0
    sql = text(
        """
        INSERT INTO ohlc_bars (symbol, tf, ts, open, high, low, close, volume)
        VALUES (:sym, :tf, :ts, :o, :h, :l, :c, :v)
        ON CONFLICT (symbol, tf, ts) DO UPDATE SET
            open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
            close = EXCLUDED.close, volume = EXCLUDED.volume
        """
    )
    await db.execute(sql, payload)
    return len(payload)


async def bars_count(db: AsyncSession, symbol: str, tf: str) -> int:
    row = (await db.execute(
        text("SELECT COUNT(*) FROM ohlc_bars WHERE symbol = :s AND tf = :t"),
        {"s": symbol.upper(), "t": tf},
    )).scalar()
    return int(row or 0)


async def oldest_ts(db: AsyncSession, symbol: str, tf: str) -> int | None:
    row = (await db.execute(
        text("SELECT MIN(ts) FROM ohlc_bars WHERE symbol = :s AND tf = :t"),
        {"s": symbol.upper(), "t": tf},
    )).scalar()
    return int(row) if row is not None else None
