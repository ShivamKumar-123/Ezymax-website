"""Real-time bid/ask from Infoway.io WebSocket (depth). No simulation."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import secrets
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

from packages.common.src.infoway_rest import fetch_klines
from packages.common.src.redis_client import redis_client
from .store import ohlc_store

logger = logging.getLogger("market-data.infoway")

INFOWAY_WS_BASE = "wss://data.infoway.io/ws"

# Data-silence watchdog: TCP + protocol pings can keep a socket "healthy" while
# the provider's push subscription silently dies — so at the next market open
# nothing streams and nobody reconnects (the classic zombie-subscription bug).
# If no DATA frame (not a heartbeat) arrives for this long, force-reconnect.
SILENT_RECONNECT_SEC = 900       # 15 min
SILENCE_CHECK_SEC = 60           # watchdog cadence
BACKFILL_CLAMP_SEC = 6 * 3600    # cap the reconnect blind-window backfill at 6h
BACKFILL_TFS = ("1m", "5m")      # higher TFs heal via history serving / reconcile
BACKFILL_SPACING = 1.0           # space REST calls ≥1s
_BACKFILL_TF_SEC = {"1m": 60, "5m": 300}

# Platform symbol -> Infoway product code (crypto uses *USDT on Infoway).
CRYPTO_INFOWAY_CODES: Dict[str, str] = {
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT",
    "SOLUSD": "SOLUSDT",
}

# Infoway may use alternate product codes vs our DB symbols.
INFOWAY_SYMBOL_ALIASES: Dict[str, str] = {
    # WTI / crude aliases → our USOIL instrument
    "XTIUSD": "USOIL",
    "WTIUSD": "USOIL",
    "CLUSD": "USOIL",
}


# Infoway push symbol -> platform symbol (handles USDT pairs and aliases).
def _build_infoway_to_platform(instruments: Dict[str, dict]) -> Dict[str, str]:
    m: Dict[str, str] = {}
    for plat, _info in instruments.items():
        code = CRYPTO_INFOWAY_CODES.get(plat, plat)
        m[code.upper()] = plat
        m[plat.upper()] = plat
    for infoway_sym, plat in INFOWAY_SYMBOL_ALIASES.items():
        if plat in instruments:
            m[infoway_sym.upper()] = plat
    return m


def _trace() -> str:
    return secrets.token_hex(16)


class InfowayFeed:
    """Streams depth (best bid/ask) from Infoway `common` + `crypto` sockets."""

    def __init__(self, api_key: str, instruments: Dict[str, dict]):
        self._api_key = api_key.strip()
        self._instruments = instruments
        self._infoway_to_platform = _build_infoway_to_platform(instruments)

        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []
        # Data-silence watchdog state (per business socket).
        self._last_data_ts: Dict[str, float] = {}  # set ONLY on real data frames
        self._ws_ref: Dict[str, object] = {}        # live socket per business

    @property
    def current_prices(self) -> Dict[str, float]:
        return {}

    async def start(self) -> None:
        self._running = True
        common_codes = [
            CRYPTO_INFOWAY_CODES.get(s, s)
            for s, info in self._instruments.items()
            if info["category"] != "crypto"
        ]
        crypto_codes = [
            CRYPTO_INFOWAY_CODES[s]
            for s in self._instruments
            if self._instruments[s]["category"] == "crypto"
        ]
        logger.info(
            "Infoway feed starting — common=%d symbols, crypto=%d symbols",
            len(common_codes),
            len(crypto_codes),
        )

        if common_codes:
            self._tasks.append(
                asyncio.create_task(
                    self._run_socket("common", common_codes),
                    name="infoway-common",
                )
            )
        if crypto_codes:
            self._tasks.append(
                asyncio.create_task(
                    self._run_socket("crypto", crypto_codes),
                    name="infoway-crypto",
                )
            )

        if not self._tasks:
            logger.error("No instruments configured for Infoway")
            return

        # Data-silence watchdog — force-reconnects a socket whose subscription
        # went zombie (healthy TCP, no data). Keeps market-open streaming alive.
        self._tasks.append(
            asyncio.create_task(self._silence_monitor(), name="infoway-silence")
        )

        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self) -> None:
        self._running = False
        for t in self._tasks:
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Infoway feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def _ws_url(self, business: str) -> str:
        q = urllib.parse.urlencode({"business": business, "apikey": self._api_key})
        return f"{INFOWAY_WS_BASE}?{q}"

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            try:
                self._tick_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._tick_queue.put_nowait(tick)

    def _platform_symbol(self, raw: str) -> Optional[str]:
        if not raw:
            return None
        key = raw.strip().upper()
        return self._infoway_to_platform.get(key)

    def _emit_depth(self, data: dict) -> None:
        raw_sym = data.get("s") or ""
        symbol = self._platform_symbol(str(raw_sym))
        if not symbol or symbol not in self._instruments:
            return

        b = data.get("b") or []
        a = data.get("a") or []
        try:
            bid_prices = b[0] if b else []
            ask_prices = a[0] if a else []
            if not bid_prices or not ask_prices:
                return
            bid = float(bid_prices[0])
            ask = float(ask_prices[0])
        except (TypeError, ValueError, IndexError):
            return

        if bid <= 0 or ask <= 0 or ask < bid:
            return

        info = self._instruments[symbol]
        decimals = int(info["decimals"])
        # Pass the provider's real bid/ask through. The platform NEVER shows
        # these raw values — market-data main always recomputes the published
        # quote from the mid via spread_cache.widen(). Carrying the raw spread
        # lets the floating-spread mode use live market width as its signal;
        # with floating off, widen() collapses to mid exactly as before.
        bid_r = round(bid, decimals)
        ask_r = round(ask, decimals)
        if ask_r < bid_r:
            ask_r = bid_r

        ts_ms = data.get("t")
        if isinstance(ts_ms, (int, float)) and ts_ms > 0:
            sec = int(ts_ms // 1000)
            ms = int(ts_ms % 1000)
            dt = datetime.fromtimestamp(sec, tz=timezone.utc)
            timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"
        else:
            ts = datetime.now(timezone.utc)
            timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"

        vol_b = b[1] if len(b) > 1 and b[1] else []
        vol_a = a[1] if len(a) > 1 and a[1] else []
        try:
            volume = int(float(vol_b[0]) + float(vol_a[0])) if vol_b and vol_a else 0
        except (TypeError, ValueError, IndexError):
            volume = 0

        tick = {
            "symbol": symbol,
            "bid": bid_r,
            "ask": ask_r,
            "timestamp": timestamp,
            "volume": max(volume, 1),
        }
        self._enqueue(tick)

    async def _heartbeat_loop(self, ws) -> None:
        while self._running:
            await asyncio.sleep(45.0)
            if not self._running:
                break
            try:
                msg = json.dumps({"code": 10010, "trace": _trace()})
                await ws.send(msg)
            except Exception as exc:
                logger.debug("Infoway heartbeat send failed: %s", exc)
                break

    async def _run_socket(self, business: str, codes: List[str]) -> None:
        if not codes:
            return
        # One depth subscription per connection; comma-separated codes.
        codes_str = ",".join(sorted(set(codes)))
        url = self._ws_url(business)

        # Exponential reconnect backoff: 2 → 4 → 8 → 16 → 32 → 60 (cap)
        # seconds. Counter resets to 0 on a successful subscribe so transient
        # blips don't pile up into a long sleep. Cap prevents the gateway
        # waiting forever; CRITICAL log every 5 attempts so operators know.
        reconnect_attempts = 0

        while self._running:
            hb_task: Optional[asyncio.Task] = None
            try:
                logger.info("Infoway [%s] connecting…", business)
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=25,
                    close_timeout=10,
                ) as ws:
                    sub = json.dumps(
                        {
                            "code": 10003,
                            "trace": _trace(),
                            "data": {"codes": codes_str},
                        }
                    )
                    await ws.send(sub)
                    logger.info(
                        "Infoway [%s] subscribed depth for %d codes",
                        business,
                        len(set(codes)),
                    )
                    # Healthy subscribe — reset the backoff counter so the
                    # next failure starts at 2s, not wherever we ended up.
                    reconnect_attempts = 0
                    self._ws_ref[business] = ws

                    # A reconnect (we had data before) → backfill the blind
                    # window from the SAME provider's REST so the chart has no
                    # hole. Fire-and-forget so it never delays resubscription.
                    if self._last_data_ts.get(business, 0.0) > 0:
                        asyncio.create_task(self._backfill_gap(business, list(codes)))

                    hb_task = asyncio.create_task(self._heartbeat_loop(ws))

                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        code = msg.get("code")
                        if code == 10005:
                            # Arm the silence watchdog ONLY on real data frames
                            # (never on heartbeat acks) — that's the whole point.
                            self._last_data_ts[business] = time.time()
                            self._emit_depth(msg.get("data") or {})
                        elif code in (10004, 10001):
                            logger.debug("Infoway [%s] ack: %s", business, msg.get("msg"))
                        elif code and code >= 400:
                            logger.warning(
                                "Infoway [%s] error (check API key / plan / symbol limits): %s",
                                business,
                                msg,
                            )
            except asyncio.CancelledError:
                break
            except Exception as exc:
                reconnect_attempts += 1
                delay = min(60.0, 2.0 ** min(reconnect_attempts, 6))
                if reconnect_attempts % 5 == 0:
                    logger.error(
                        "Infoway [%s] still down after %d attempts: %s",
                        business, reconnect_attempts, exc,
                    )
                else:
                    logger.warning(
                        "Infoway [%s] WebSocket error: %s — reconnect in %.0fs (attempt %d)",
                        business, exc, delay, reconnect_attempts,
                    )
                await asyncio.sleep(delay)
            finally:
                self._ws_ref.pop(business, None)
                if hb_task:
                    hb_task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await hb_task

        logger.info("Infoway [%s] task ended", business)

    async def _silence_monitor(self) -> None:
        """Force-reconnect a socket that has gone DATA-silent (no data frame for
        SILENT_RECONNECT_SEC) even though TCP/pings look healthy. Closing the
        socket makes _run_socket loop back and resubscribe fresh."""
        while self._running:
            await asyncio.sleep(SILENCE_CHECK_SEC)
            now = time.time()
            for business, ws in list(self._ws_ref.items()):
                last = self._last_data_ts.get(business, 0.0)
                if last <= 0:
                    continue  # never received data yet (boot / market closed)
                silent = now - last
                if silent > SILENT_RECONNECT_SEC:
                    logger.warning(
                        "Infoway [%s] DATA-silent %.0fs (>%ds) — forcing reconnect",
                        business, silent, SILENT_RECONNECT_SEC,
                    )
                    with contextlib.suppress(Exception):
                        await ws.close()

    async def _backfill_gap(self, business: str, codes: List[str]) -> None:
        """After a reconnect, heal the blind window from InfoWay REST klines
        (same provider → no price-basis seam). Best-effort: never raises into
        the feed loop. Only 1m + 5m, closed bars only, clamped to 6h."""
        token = self._api_key
        if not token:
            return
        last = self._last_data_ts.get(business, 0.0)
        gap = time.time() - last if last > 0 else 0.0
        if 0 < gap < 90:
            return  # tiny blip — not worth REST calls
        if gap > BACKFILL_CLAMP_SEC:
            gap = BACKFILL_CLAMP_SEC  # don't try to refill a whole weekend

        syms: List[str] = []
        seen: set = set()
        for code in set(codes):
            plat = self._platform_symbol(code)
            if plat and plat not in seen:
                seen.add(plat)
                syms.append(plat)
        if not syms:
            return

        logger.info(
            "Infoway [%s] backfilling %d symbols after %.0fs gap",
            business, len(syms), gap,
        )
        now = int(time.time())
        for sym in syms:
            if not self._running:
                break
            for tf in BACKFILL_TFS:
                try:
                    bars = await fetch_klines(sym, tf, count=500, token=token)
                except Exception:
                    bars = []
                await asyncio.sleep(BACKFILL_SPACING)
                if not bars:
                    continue
                tf_sec = _BACKFILL_TF_SEC.get(tf, 60)
                cutoff = (now // tf_sec) * tf_sec  # exclude the forming bar
                closed = [b for b in bars if int(b.get("time", 0)) < cutoff]
                if not closed:
                    continue
                with contextlib.suppress(Exception):
                    await ohlc_store.upsert_many(
                        sym, tf, [{**b, "tick_count": 0} for b in closed]
                    )
                with contextlib.suppress(Exception):
                    await self._merge_redis_bars(sym, tf, closed)

    async def _merge_redis_bars(self, sym: str, tf: str, official: List[dict]) -> None:
        """Overlay official bars onto the Redis list (official wins on collision;
        newer live bars survive). Newest at index 0, capped at 1000 — same
        convention as the aggregator."""
        tf_sec = _BACKFILL_TF_SEC.get(tf, 60)
        list_key = f"bars:{sym}:{tf}"
        by_time: Dict[int, dict] = {}
        for raw in await redis_client.lrange(list_key, 0, 999):
            try:
                b = json.loads(raw)
                t = int(b["time"])
                if t % tf_sec != 0:
                    continue
                by_time[t] = b
            except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                continue
        for b in official:
            t = int(b["time"])
            by_time[t] = {
                "symbol": sym, "timeframe": tf, "time": t,
                "open": b["open"], "high": b["high"], "low": b["low"],
                "close": b["close"], "volume": b.get("volume", 0),
            }
        merged = sorted(by_time.values(), key=lambda x: int(x["time"]))[-1000:]
        pipe = redis_client.pipeline()
        pipe.delete(list_key)
        for b in merged:
            pipe.lpush(list_key, json.dumps(b))
        pipe.ltrim(list_key, 0, 999)
        await pipe.execute()
