"""Aggregate OHLC bars from our OWN tick history (TimescaleDB).

This is the guaranteed, dependency-free history source: the market-data feed
records every tick into the TimescaleDB `ticks` hypertable, so we can build
bars for any timeframe straight from it — no external API, no geo-block, works
for forex, metals AND crypto. Used as a fallback when the external source
(Binance / Infoway REST) returns nothing, so historical always lands in the
durable ohlc_bars store.

The gateway normally talks only to the main Postgres; here we open a small,
lazily-created read pool to the TimescaleDB (`TIMESCALE_URL`).
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from packages.common.src.config import get_settings

logger = logging.getLogger("gateway.timescale_bars")

_engine: AsyncEngine | None = None
_Session: async_sessionmaker | None = None

# tf slug → Postgres interval literal for time_bucket().
_TF_INTERVAL: dict[str, str] = {
    "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes", "30m": "30 minutes",
    "1h": "1 hour", "4h": "4 hours", "1d": "1 day",
}


def _session_maker() -> async_sessionmaker:
    global _engine, _Session
    if _Session is None:
        url = get_settings().TIMESCALE_URL
        _engine = create_async_engine(url, pool_size=2, max_overflow=2, pool_pre_ping=True)
        _Session = async_sessionmaker(_engine, expire_on_commit=False)
    return _Session


async def aggregate_ticks_to_bars(
    symbol: str, tf: str, count: int = 2000, end_ts: int | None = None,
) -> list[dict]:
    """Build up to `count` OHLC bars for (symbol, tf) from the ticks table,
    ending at/before `end_ts` (unix seconds; None = up to now). Ascending
    [{time, open, high, low, close, volume}] with time in epoch SECONDS.

    OHLC is computed from the tick mid price (bid+ask)/2; volume is tick count
    (we don't record traded size)."""
    interval = _TF_INTERVAL.get(tf)
    if not interval:
        return []
    # `interval` is inlined as a SQL literal (safe: it's a fixed value from
    # _TF_INTERVAL, never user input). asyncpg can't bind a string to an
    # interval-typed parameter, and binding a timedelta is more fragile than
    # a plain literal here.
    bucket = f"time_bucket(INTERVAL '{interval}', time)"
    where = ["symbol = :sym"]
    params: dict = {"sym": symbol.upper(), "lim": int(count)}
    if end_ts:
        where.append("time <= to_timestamp(:end_ts)")
        params["end_ts"] = int(end_ts)

    sql = text(
        f"""
        SELECT ts, o, h, l, c, v FROM (
            SELECT
                extract(epoch FROM {bucket})::bigint AS ts,
                first((bid + ask) / 2.0, time)  AS o,
                max((bid + ask) / 2.0)          AS h,
                min((bid + ask) / 2.0)          AS l,
                last((bid + ask) / 2.0, time)   AS c,
                count(*)::float                 AS v
            FROM ticks
            WHERE {' AND '.join(where)}
            GROUP BY {bucket}
            ORDER BY 1 DESC
            LIMIT :lim
        ) q
        ORDER BY ts ASC
        """
    )
    try:
        Session = _session_maker()
        async with Session() as s:
            rows = (await s.execute(sql, params)).all()
    except Exception as e:
        logger.warning("tick aggregation failed for %s %s: %s", symbol, tf, e)
        return []

    out: list[dict] = []
    for r in rows:
        try:
            out.append({
                "time": int(r[0]),
                "open": float(r[1]), "high": float(r[2]),
                "low": float(r[3]), "close": float(r[4]),
                "volume": float(r[5] or 0),
            })
        except (TypeError, ValueError):
            continue
    return out
