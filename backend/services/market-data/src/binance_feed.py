"""Live crypto bid/ask from Binance's public WebSocket.

Used in production so crypto quotes come from Binance's deep, real liquidity
instead of the general primary feed (whose crypto book can be thin / lagging).
Public market-data streams are FREE and UNAUTHENTICATED — no API key. We use
`@bookTicker` (best bid / best ask, pushed on every change) so the platform has
a real spread signal; market-data main still recomputes the published quote from
the mid via spread_cache.widen(), exactly like every other feed.

Same interface as InfowayFeed (`start` / `stop` / `get_tick`) so main can drain
it through the same tick pipeline.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

logger = logging.getLogger("market-data.binance")

# Combined-stream endpoint: frames arrive as {"stream": "...", "data": {...}}.
BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream"

# Platform symbol -> Binance stream pair (USDT-quoted proxy for the USD pair).
CRYPTO_BINANCE_PAIRS: Dict[str, str] = {
    "BTCUSD": "btcusdt",
    "ETHUSD": "ethusdt",
    "LTCUSD": "ltcusdt",
    "XRPUSD": "xrpusdt",
    "SOLUSD": "solusdt",
    # Added with the rest of the crypto list — without a pair here the symbol
    # is left on the primary feed, so half the crypto board would have come
    # from one source and half from another.
    "ADAUSD": "adausdt",
    "BNBUSD": "bnbusdt",
    "DOGEUSD": "dogeusdt",
}

# Data-silence watchdog: a healthy TCP socket can keep a dead subscription
# alive. If no book update arrives for this long, force a reconnect.
SILENT_RECONNECT_SEC = 120.0


def covered_symbols(instruments: Dict[str, dict]) -> List[str]:
    """Platform crypto symbols we can actually source from Binance."""
    return [
        s for s in instruments
        if instruments[s].get("category") == "crypto" and s in CRYPTO_BINANCE_PAIRS
    ]


class BinanceCryptoFeed:
    def __init__(self, instruments: Dict[str, dict]):
        self._instruments = instruments
        # pair (lowercase, as Binance sends `s` uppercase) -> platform symbol
        self._pair_to_platform: Dict[str, str] = {
            CRYPTO_BINANCE_PAIRS[s].upper(): s for s in covered_symbols(instruments)
        }
        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []
        self._last_data_ts = 0.0
        self._ws = None

    @property
    def symbols(self) -> List[str]:
        return list(self._pair_to_platform.values())

    async def start(self) -> None:
        pairs = [CRYPTO_BINANCE_PAIRS[s] for s in covered_symbols(self._instruments)]
        if not pairs:
            logger.info("Binance crypto feed: no covered symbols — not starting")
            return
        self._running = True
        logger.info("Binance crypto feed starting — %d symbols: %s",
                    len(pairs), ", ".join(self._pair_to_platform.values()))
        self._tasks = [
            asyncio.create_task(self._run_socket(pairs), name="binance-crypto"),
            asyncio.create_task(self._silence_monitor(), name="binance-silence"),
        ]
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self) -> None:
        self._running = False
        for t in self._tasks:
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Binance crypto feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            with contextlib.suppress(asyncio.QueueEmpty):
                self._tick_queue.get_nowait()
            with contextlib.suppress(asyncio.QueueFull):
                self._tick_queue.put_nowait(tick)

    def _emit(self, data: dict) -> None:
        raw_sym = str(data.get("s") or "").upper()
        symbol = self._pair_to_platform.get(raw_sym)
        if not symbol:
            return
        try:
            bid = float(data["b"])
            ask = float(data["a"])
        except (KeyError, TypeError, ValueError):
            return
        if bid <= 0 or ask <= 0:
            return
        if ask < bid:
            ask = bid

        decimals = int(self._instruments[symbol]["decimals"])
        ts = datetime.now(timezone.utc)
        timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"
        self._enqueue({
            "symbol": symbol,
            "bid": round(bid, decimals),
            "ask": round(ask, decimals),
            "timestamp": timestamp,
            "volume": 1,
        })

    async def _run_socket(self, pairs: List[str]) -> None:
        streams = "/".join(f"{p}@bookTicker" for p in pairs)
        url = f"{BINANCE_WS_BASE}?streams={streams}"
        attempts = 0
        while self._running:
            try:
                logger.info("Binance connecting… (%d streams)", len(pairs))
                async with websockets.connect(
                    url, ping_interval=20, ping_timeout=20, close_timeout=10,
                ) as ws:
                    self._ws = ws
                    self._last_data_ts = time.time()
                    attempts = 0
                    logger.info("Binance WebSocket connected — live crypto prices active")
                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        payload = msg.get("data") if isinstance(msg, dict) else None
                        if payload:
                            self._last_data_ts = time.time()
                            self._emit(payload)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                attempts += 1
                delay = min(60.0, 2.0 ** min(attempts, 6))
                logger.warning("Binance WS error: %s — reconnect in %.0fs (attempt %d)",
                               exc, delay, attempts)
                await asyncio.sleep(delay)
            finally:
                self._ws = None
        logger.info("Binance crypto feed task ended")

    async def _silence_monitor(self) -> None:
        while self._running:
            await asyncio.sleep(30.0)
            if self._last_data_ts <= 0:
                continue
            silent = time.time() - self._last_data_ts
            if silent > SILENT_RECONNECT_SEC and self._ws is not None:
                logger.warning("Binance DATA-silent %.0fs — forcing reconnect", silent)
                with contextlib.suppress(Exception):
                    await self._ws.close()
