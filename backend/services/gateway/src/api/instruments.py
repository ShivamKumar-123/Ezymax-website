"""Instruments API — List instruments, get current prices."""
import asyncio as _asyncio
import json as _json
import logging
import os as _os
import time as _time
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text as _sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db, TimescaleSessionLocal
from packages.common.src.redis_client import redis_client
from packages.common.src.schemas import InstrumentResponse, TickData
from packages.common.src.instrumentation import get_rate_limiter
from packages.common.src.infoway_rest import fetch_klines as _iw_fetch_klines
from ..services import instrument_service

router = APIRouter()
_limiter = get_rate_limiter()
_logger = logging.getLogger("gateway.instruments")

# TradingView resolution string → bar aggregator timeframe key
_TV_RESOLUTION_TO_TF: dict[str, str] = {
    "1": "1m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "240": "4h", "D": "1d", "1D": "1d",
}

# Resolution → Binance kline interval string
_TV_RESOLUTION_TO_BINANCE: dict[str, str] = {
    "1": "1m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "240": "4h", "D": "1d", "1D": "1d",
}

# Platform symbol → Binance REST pair (crypto only)
_BINANCE_PAIRS: dict[str, str] = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT", "SOLUSD": "SOLUSDT", "BNBUSD": "BNBUSDT",
    "DOGEUSD": "DOGEUSDT", "ADAUSD": "ADAUSDT",
}


async def _fetch_binance_klines(
    symbol: str, resolution: str, from_time: int, to_time: int,
) -> list[dict]:
    """Fetch historical klines from Binance public REST API (no key needed).

    Results are cached in Redis for 60s to avoid repeated API calls on chart
    pan/zoom, which makes subsequent loads instant.
    """
    import httpx

    pair = _BINANCE_PAIRS.get(symbol.upper())
    if not pair:
        return []

    tf = _TV_RESOLUTION_TO_BINANCE.get(resolution, "5m")

    # --- Check Redis cache first ---
    cache_key = f"binance_cache:{symbol}:{tf}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            all_bars: list[dict] = _json.loads(cached)
            # Filter by requested time range
            return [
                b for b in all_bars
                if (not from_time or b["time"] >= from_time)
                and (not to_time or b["time"] <= to_time)
            ]
    except Exception:
        pass

    # --- Fetch from Binance ---
    start_ms = from_time * 1000 if from_time else None
    end_ms = to_time * 1000 if to_time else None

    params: dict = {"symbol": pair, "interval": tf, "limit": 1000}
    if start_ms:
        params["startTime"] = start_ms
    if end_ms:
        params["endTime"] = end_ms

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/klines", params=params)
            if resp.status_code != 200:
                _logger.warning("Binance klines HTTP %s for %s", resp.status_code, symbol)
                return []
            data = resp.json()
    except Exception as exc:
        _logger.warning("Binance klines fetch failed for %s: %s", symbol, exc)
        return []

    bars = []
    for k in data:
        bars.append({
            "time": int(k[0]) // 1000,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })

    # --- Cache in Redis (60s TTL) ---
    if bars:
        try:
            await redis_client.set(cache_key, _json.dumps(bars), ex=60)
        except Exception:
            pass

    return bars


@router.get("/", response_model=list[InstrumentResponse])
async def list_instruments(
    segment: str | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    return await instrument_service.list_instruments(
        segment=segment, active_only=active_only, db=db,
    )


@router.get("/market-status")
async def get_market_status(db: AsyncSession = Depends(get_db)):
    """Return market open/closed status for every active instrument.

    Clients should poll this every 60 s (or on page focus) to refresh
    the market-open state without spamming the server.
    """
    return await instrument_service.get_market_status(db=db)


@router.get("/market-status/{symbol}")
async def get_symbol_market_status(symbol: str, db: AsyncSession = Depends(get_db)):
    """Return market status for a single symbol."""
    return await instrument_service.get_symbol_market_status(symbol=symbol, db=db)


@router.get("/prices/all")
async def get_all_prices():
    """Static path before /{symbol}/price so it is never captured as a symbol."""
    return await instrument_service.get_all_prices()


@router.get("/{symbol}/price", response_model=TickData)
async def get_price(symbol: str):
    return await instrument_service.get_price(symbol=symbol)


# Bar-aggregator timeframe → seconds. Module-level so the bars helpers share it.
_TF_SECONDS = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400}


async def _fetch_ohlc_db(sym: str, tf: str, to_time: int, limit: int = 1000) -> list[dict]:
    """Read CLOSED bars from the durable ohlcv_<tf> store, ascending, time<=to.

    This is the real deep history (written on every rollover + by the backfill
    script). Redis is just a 1000-bar cache on top. Enforces only the UPPER
    bound — never a `from` floor. Returns [] if the table/DB is unavailable.
    """
    if tf not in _TF_SECONDS:
        return []
    q = (f"SELECT extract(epoch from time)::bigint AS t, open, high, low, close, volume "
         f"FROM ohlcv_{tf} WHERE symbol = :sym")
    params: dict = {"sym": sym, "lim": int(limit)}
    if to_time:
        q += " AND time <= to_timestamp(:to)"
        params["to"] = int(to_time)
    q += " ORDER BY time DESC LIMIT :lim"
    try:
        async with TimescaleSessionLocal() as s:
            rows = (await s.execute(_sql_text(q), params)).all()
    except Exception:
        return []
    bars = [{
        "time": int(r[0]), "open": float(r[1]), "high": float(r[2]),
        "low": float(r[3]), "close": float(r[4]), "volume": float(r[5] or 0),
    } for r in rows]
    bars.sort(key=lambda b: b["time"])
    return bars


def _grid_snap(bars: list[dict], bar_sec: int) -> list[dict]:
    """One bar per aligned slot. Providers sometimes serve part of a range on an
    OFFSET grid (e.g. 1h bars at :30 alongside :00 → every candle doubles).
    A grid-aligned original always wins; an off-grid bar snaps into an empty
    slot only. Prevents doubled candles when merging provider history."""
    slots: dict[int, dict] = {}
    for b in bars:
        t = int(b.get("time", 0))
        aligned = (t // bar_sec) * bar_sec
        on_grid = (t == aligned)
        cur = slots.get(aligned)
        if cur is None or (on_grid and not cur.get("_g")):
            slots[aligned] = {**b, "time": aligned, "_g": on_grid}
    out = [{k: v for k, v in b.items() if k != "_g"} for b in slots.values()]
    out.sort(key=lambda x: x["time"])
    return out


async def _fetch_infoway_bars(sym: str, tf: str, end_ts: int) -> list[dict]:
    """On-demand history from InfoWay REST — the SAME provider as the live feed,
    so history and live share one price basis (no seam). Grid-snapped. Best
    effort: no token / failure → []."""
    token = _os.environ.get("INFOWAY_API_KEY", "").strip()
    if not token:
        return []
    try:
        bars = await _iw_fetch_klines(sym, tf, count=500, end_ts=int(end_ts or 0), token=token)
    except Exception:
        return []
    return _grid_snap(bars, _TF_SECONDS.get(tf, 300)) if bars else []


async def _persist_ohlc_db(sym: str, tf: str, bars: list[dict]) -> None:
    """Deepen the durable store with on-demand-fetched bars so panning older
    permanently extends history. Best effort (fire-and-forget)."""
    if tf not in _TF_SECONDS or not bars:
        return
    stmt = _sql_text(
        f"INSERT INTO ohlcv_{tf} (time, symbol, open, high, low, close, volume, tick_count) "
        "VALUES (to_timestamp(:t), :sym, :o, :h, :l, :c, :v, 0) "
        "ON CONFLICT (symbol, time) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high, "
        "low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume"
    )
    try:
        async with TimescaleSessionLocal() as s:
            for b in bars:
                await s.execute(stmt, {
                    "t": int(b["time"]), "sym": sym, "o": float(b["open"]),
                    "h": float(b["high"]), "l": float(b["low"]),
                    "c": float(b["close"]), "v": float(b.get("volume", 0) or 0),
                })
            await s.commit()
    except Exception:
        pass


@router.get("/{symbol}/bars")
@_limiter.exempt
async def get_bars(
    symbol: str,
    resolution: str = Query(default="5"),
    from_time: int = Query(default=0, alias="from"),
    to_time: int = Query(default=0, alias="to"),
):
    """Return OHLCV bars for the TradingView charting library.

    Source priority (single-provider basis — no history/live seam):
      1. Durable ohlcv_<tf> store (deep, survives restarts).
      2. Redis list (recent cache) — supplements when durable is thin.
      3. Binance REST for crypto when empty/stale.
      4. On-demand InfoWay REST for non-crypto when thin (grid-snapped, persisted).
      5. Append the current forming bar.

    UPPER bound only: on a closed market the library asks for the latest bars
    BEFORE `from`, so `from` is NOT a hard floor (that would blank the chart).
    """
    tf = _TV_RESOLUTION_TO_TF.get(resolution, "5m")
    sym = symbol.upper()
    bar_sec = _TF_SECONDS.get(tf, 300)
    now_epoch = int(_time.time())

    # --- 1. Durable store first ---
    bars = await _fetch_ohlc_db(sym, tf, to_time)

    # --- 2. Redis list (recent cache) — upper bound only, no `from` floor ---
    if len(bars) < 20:
        raw_list: list[bytes] = await redis_client.lrange(f"bars:{sym}:{tf}", 0, 999)
        redis_bars = []
        for raw in raw_list:
            try:
                b = _json.loads(raw)
                t = int(b.get("time", 0))
                if to_time and t > to_time:
                    continue
                redis_bars.append({
                    "time": t, "open": float(b["open"]), "high": float(b["high"]),
                    "low": float(b["low"]), "close": float(b["close"]),
                    "volume": float(b.get("volume", 0.0)),
                })
            except Exception:
                continue
        redis_bars.sort(key=lambda x: x["time"])
        if len(redis_bars) > len(bars):
            bars = redis_bars

    # --- 3. Binance fallback for crypto when empty or stale ---
    has_recent = bars and (now_epoch - bars[-1]["time"]) < bar_sec * 3
    if not has_recent and sym in _BINANCE_PAIRS:
        binance_bars = await _fetch_binance_klines(sym, resolution, from_time, to_time)
        if binance_bars:
            binance_times = {b["time"] for b in binance_bars}
            bars = [b for b in bars if b["time"] not in binance_times] + binance_bars
            bars.sort(key=lambda x: x["time"])

    # --- 4. On-demand InfoWay REST for non-crypto when thin (same provider) ---
    if len(bars) < 50 and sym not in _BINANCE_PAIRS:
        iw = await _fetch_infoway_bars(sym, tf, to_time or now_epoch)
        if iw:
            iw_times = {b["time"] for b in iw}
            bars = [b for b in bars if b["time"] not in iw_times] + iw
            bars.sort(key=lambda x: x["time"])
            _asyncio.create_task(_persist_ohlc_db(sym, tf, iw))

    # --- 5. Append current in-progress bar (upper bound only) ---
    current_raw = await redis_client.get(f"bar:current:{sym}:{tf}")
    if current_raw:
        try:
            b = _json.loads(current_raw)
            bar_start = (now_epoch // bar_sec) * bar_sec
            if not to_time or bar_start <= to_time:
                bars = [x for x in bars if x["time"] != bar_start]
                bars.append({
                    "time": bar_start,
                    "open": float(b["open"]),
                    "high": float(b["high"]),
                    "low": float(b["low"]),
                    "close": float(b["close"]),
                    "volume": float(b.get("volume", 0.0)),
                })
        except Exception:
            pass

    return {"s": "ok", "bars": bars, "noData": len(bars) == 0}
