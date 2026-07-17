"""Instruments API — List instruments, get current prices."""
import asyncio
import json as _json
import logging
import time as _time
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db, AsyncSessionLocal
from packages.common.src.redis_client import redis_client
from packages.common.src.schemas import InstrumentResponse, TickData
from packages.common.src.instrumentation import get_rate_limiter
from packages.common.src.config import get_settings
from packages.common.src import bars_store, infoway_history
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
@_limiter.exempt
async def get_all_prices():
    """Static path before /{symbol}/price so it is never captured as a symbol.
    Exempt from rate limiting — clients poll this sub-second for live prices."""
    return await instrument_service.get_all_prices()


@router.get("/{symbol}/price", response_model=TickData)
@_limiter.exempt
async def get_price(symbol: str):
    return await instrument_service.get_price(symbol=symbol)


async def _fetch_history_source(sym: str, tf: str, resolution: str, end_ts: int | None) -> list[dict]:
    """Pull historical bars from the market-data SOURCE for a (symbol, tf).
    Crypto → Binance (keyless, reliable); everything else → Infoway history.
    `end_ts` (unix seconds) requests OLDER data ending there (scroll-back);
    None fetches the most-recent deep window (first-time seed)."""
    result: list = []
    if sym in _BINANCE_PAIRS:
        # Binance uses from/to; for scroll-back cap the window at end_ts.
        result = await _fetch_binance_klines(sym, resolution, 0, int(end_ts or 0))
    else:
        key = getattr(get_settings(), "INFOWAY_API_KEY", "") or ""
        if key and infoway_history.infoway_supports(tf):
            if end_ts:
                result = await infoway_history.fetch_infoway_klines(key, sym, tf, count=500, end_ts=int(end_ts))
            else:
                result = await infoway_history.backfill_infoway(key, sym, tf, target_bars=2000)

    # Guaranteed fallback: build history from our OWN TimescaleDB tick feed when
    # the external source returns nothing (Binance geo-block / Infoway REST).
    # No external dependency — works for every symbol the feed has recorded.
    if not result:
        try:
            from ..services import timescale_bars
            result = await timescale_bars.aggregate_ticks_to_bars(sym, tf, count=2000, end_ts=end_ts)
            if result:
                _logger.info("bars: %d bars for %s %s aggregated from TimescaleDB ticks", len(result), sym, tf)
        except Exception as e:
            _logger.warning("timescale tick aggregation error for %s %s: %s", sym, tf, e)

    # Grid-snap EVERY provider result before it is merged/stored — kills the
    # "every candle doubled" bug when a provider serves part of a range on an
    # offset grid. Idempotent for already-aligned bars.
    if result:
        result = bars_store.grid_snap(result, bars_store.TF_SECONDS.get(tf, 300))
    return result


# Track in-flight background backfills so a burst of chart requests for the
# same (symbol, tf) spawns exactly one provider fetch, not dozens.
_bg_backfill_inflight: set[str] = set()


def _schedule_bg_backfill(sym: str, tf: str, resolution: str) -> None:
    """Fire-and-forget the slow (~2-3s) provider history fetch on its OWN db
    session so the chart response returns immediately with whatever bars we
    already have. Used when the store is short but NOT empty — the chart shows
    instantly and the deeper history lands within a poll or two."""
    key = f"{sym}|{tf}"
    if key in _bg_backfill_inflight:
        return
    _bg_backfill_inflight.add(key)

    async def _run() -> None:
        try:
            async with AsyncSessionLocal() as bg_db:
                src = await _fetch_history_source(sym, tf, resolution, None)
                if src:
                    await bars_store.upsert_bars(bg_db, sym, tf, src)
                    await bg_db.commit()
        except Exception as e:
            _logger.warning("bg bars backfill failed for %s %s: %s", sym, tf, e)
        finally:
            _bg_backfill_inflight.discard(key)

    asyncio.create_task(_run())


@router.get("/{symbol}/bars")
@_limiter.exempt
async def get_bars(
    symbol: str,
    resolution: str = Query(default="5"),
    from_time: int = Query(default=0, alias="from"),
    to_time: int = Query(default=0, alias="to"),
    live: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """OHLCV bars for the charting library, served from the durable `ohlc_bars`
    store so history is gap-free and the source is hit only for NEW/missing data.

    Flow:
      1. Persist the freshest live bars (Redis, fed by BarAggregator) into the
         store — forward-fill, idempotent (dedup on symbol,tf,ts).
      2. Only when the store can't satisfy the request (first time ever, or the
         caller scrolled older than we hold) fetch that range from the source
         (Infoway / Binance) and store it. Otherwise NO source call.
      3. Read the window from the store; append the in-progress bar for a live
         last candle.
    """
    tf = _TV_RESOLUTION_TO_TF.get(resolution, "5m")
    sym = symbol.upper()
    bar_sec = bars_store.TF_SECONDS.get(tf, 300)
    now_epoch = int(_time.time())

    # Realtime polls (?live=1) are pure reads — skip all backfill/writes; the
    # background persistence + normal history requests keep the store current.
    if not live:
        # 1. Deep backfill from the SOURCE when the store is short. This MUST run
        #    before the forward-fill below — otherwise the ~30 freshly-persisted
        #    live bars make `count` non-zero and the deep history never loads
        #    (the original bug: chart showed only the live candle). A Redis marker
        #    throttles retries so we never hammer the source when it's unavailable.
        try:
            count = await bars_store.bars_count(db, sym, tf)
            need: str | None = None
            if count < 100:
                marker = f"bars:bf:{sym}:{tf}"
                if not await redis_client.get(marker):
                    need = "initial"
                    await redis_client.set(marker, "1", ex=1800)  # retry at most every 30 min
            elif from_time:
                oldest = await bars_store.oldest_ts(db, sym, tf)
                if oldest is not None and from_time < oldest - bar_sec:
                    need = "older"
            # Tail-gap heal: stored history ends well before now (a feed hiccup
            # or downtime left a hole) → the chart shows a gap between the last
            # closed candle and the live one. Backfill the recent window from the
            # source so history connects to the live candle. Skipped when the
            # market is genuinely closed (that gap is expected). Throttled so a
            # burst of chart loads can't hammer the provider.
            if not need and count >= 100:
                is_closed = sym not in _BINANCE_PAIRS and bars_store.is_forex_market_closed(now_epoch)
                if not is_closed:
                    newest = await bars_store.newest_ts(db, sym, tf)
                    current_slot = (now_epoch // bar_sec) * bar_sec
                    # Gap of more than a couple of bars = a real hole, not just
                    # the still-forming current bar not yet persisted.
                    if newest is not None and newest < current_slot - (2 * bar_sec):
                        gap_marker = f"bars:gap:{sym}:{tf}"
                        if not await redis_client.get(gap_marker):
                            need = "gap"
                            await redis_client.set(gap_marker, "1", ex=300)  # at most every 5 min
            if need == "initial" and count > 0:
                # We already have SOME bars — serve them immediately and pull the
                # deeper history in the background. This is the fix for the ~2-3s
                # "chart loads slow" stall: only a truly empty store (count == 0,
                # first-ever load) still blocks on the provider round-trip.
                _schedule_bg_backfill(sym, tf, resolution)
            elif need:
                end_ts = None
                if need == "older":
                    oldest = await bars_store.oldest_ts(db, sym, tf)
                    end_ts = (oldest - 1) if oldest else None
                src = await _fetch_history_source(sym, tf, resolution, end_ts)
                _logger.info("bars backfill %s %s (%s): source returned %d bars", sym, tf, need, len(src))
                if src:
                    await bars_store.upsert_bars(db, sym, tf, src)
                    await db.commit()
        except Exception as e:
            _logger.warning("bars source backfill skipped for %s %s: %s", sym, tf, e)

        # 2. Forward-fill: persist the most recent completed bars from the live
        #    aggregator (Redis list is newest-first). Cheap + idempotent.
        try:
            fresh_raw: list = await redis_client.lrange(f"bars:{sym}:{tf}", 0, 29)
            fresh = []
            for raw in fresh_raw:
                try:
                    b = _json.loads(raw)
                    fresh.append({
                        "time": int(b.get("time", 0)),
                        "open": float(b["open"]), "high": float(b["high"]),
                        "low": float(b["low"]), "close": float(b["close"]),
                        "volume": float(b.get("volume", 0.0)),
                    })
                except Exception:
                    continue
            if fresh:
                await bars_store.upsert_bars(db, sym, tf, fresh)
                await db.commit()
        except Exception as e:
            _logger.debug("bars forward-fill skipped for %s %s: %s", sym, tf, e)

    # 3. Serve the requested window from the durable store. Enforce ONLY the
    #    upper (`to`) bound — NOT `from` as a hard floor. On a closed market the
    #    charting library asks for a window that starts after the last real bar
    #    (e.g. gold on a Saturday); flooring on `from` would return nothing and
    #    blank the chart. Returning the latest bars ≤ `to` keeps history visible,
    #    and `to` is what the library moves when the user pans back.
    bars = await bars_store.read_bars(db, sym, tf, None, to_time or None, limit=5000)

    # Append the current in-progress bar so the last candle stays live.
    current_raw = await redis_client.get(f"bar:current:{sym}:{tf}")
    if current_raw:
        try:
            b = _json.loads(current_raw)
            bar_start = (now_epoch // bar_sec) * bar_sec
            if (not from_time or bar_start >= from_time) and (not to_time or bar_start <= to_time):
                bars = [x for x in bars if x["time"] != bar_start]
                bars.append({
                    "time": bar_start,
                    "open": float(b["open"]), "high": float(b["high"]),
                    "low": float(b["low"]), "close": float(b["close"]),
                    "volume": float(b.get("volume", 0.0)),
                })
                bars.sort(key=lambda x: x["time"])
        except Exception:
            pass

    # Weekend strip (non-crypto): drop any bar a provider padded into the forex
    # weekend close (Fri 21:00 → Sun 22:00 UTC). Crypto trades 24/7 — never
    # stripped. Naturally-absent weekend gaps are unaffected (nothing to strip).
    if sym not in _BINANCE_PAIRS:
        bars = [b for b in bars if not bars_store.is_forex_market_closed(b["time"])]

    return {"s": "ok", "bars": bars, "noData": len(bars) == 0}
