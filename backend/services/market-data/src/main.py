"""Market Data Service — Connects to price feeds, normalizes, distributes via Redis pub/sub and stores in TimescaleDB."""
import asyncio
import json
import logging
import random
import signal
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from packages.common.src.config import get_settings
from packages.common.src.redis_client import (
    BARS_UPDATES_CHANNEL,
    CONFIG_INSTRUMENTS_RELOAD_CHANNEL,
    PriceChannel,
    redis_client,
    publish_price,
)
from packages.common.src.kafka_client import close_producer

from .feed_handler import FeedSimulator, INSTRUMENTS, LIVE_CRYPTO_SYMBOLS
from .infoway_config import usable_infoway_api_key
from .infoway_feed import InfowayFeed
from .corecen_lp_feed import CorecenLPFeed
from .bar_aggregator import BarAggregator
from .seed_bars import seed as seed_bars
from .spread_cache import StreamSpreadCache, RELOAD_INTERVAL_SEC
from .store import OHLCStore, TickStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("market-data")

try:
    from packages.common.src.instrumentation import init_sentry
    init_sentry("market-data")
except Exception:
    pass

settings = get_settings()

# If Infoway (or another feed) stops sending a symbol, Redis keeps a frozen tick; refresh
# with last mid + current admin spread so Spr matches config until live ticks resume.
STALE_TICK_AFTER_SEC = 90.0
STALE_REFRESH_INTERVAL_SEC = 30.0
# A >10% mid jump is dropped as a spike until it persists this many consecutive
# ticks, at which point the market is deemed to have genuinely gapped.
JUMP_ACCEPT_AFTER = 5
# While the Binance side-feed delivered a tick for a crypto symbol within this
# window, it is the source of truth for that symbol — the (much slower) Infoway
# crypto tick is dropped so the two feeds' slightly different mids can't
# interleave. Binance silent longer than this → Infoway flows again.
BINANCE_FRESH_SEC = 10.0


class MarketDataService:
    def __init__(self):
        raw_key = (settings.INFOWAY_API_KEY or "").strip()
        self._tick_count = 0
        self._infoway_watchdog_armed = False
        if getattr(settings, "CORECEN_LP_ENABLED", False):
            if not settings.CORECEN_LP_API_KEY or not settings.CORECEN_LP_API_SECRET:
                logger.error(
                    "CORECEN_LP_ENABLED=true but CORECEN_LP_API_KEY / CORECEN_LP_API_SECRET "
                    "are not set — gateway will reject LP pushes and no ticks will arrive."
                )
            self.feed = CorecenLPFeed()
            logger.info("Price feed: Corecen LP (receiving pushes on /api/lp/prices/batch)")
        elif usable_infoway_api_key(raw_key):
            self.feed = InfowayFeed(raw_key, INSTRUMENTS)
            self._infoway_watchdog_armed = True
            logger.info("Price feed: Infoway WebSocket (depth)")
        else:
            # No real upstream feed configured → live crypto only (Binance).
            # Non-crypto symbols stay UNQUOTED (clients show '-') — the GBM
            # price simulation has been removed, so no fake prices are served.
            self.feed = FeedSimulator(tick_rate_multiplier=1.0)
            logger.warning(
                "No Corecen/Infoway feed — running LIVE crypto (Binance) only; "
                "forex/indices/metals/shares are unquoted (show '-') until a real feed is set."
            )
        self.aggregator = BarAggregator()
        self.store = TickStore()
        self.ohlc_store = OHLCStore()
        self.spread_cache = StreamSpreadCache()
        self.running = True
        self._last_mid: dict[str, float] = {}
        # Native (pre-widen) bid/ask of the last tick per symbol. Used by the
        # stale-quote refresher so it can re-apply the current admin spread —
        # or fall back to the feed's native spread — without a fresh tick.
        self._last_quote: dict[str, tuple[float, float]] = {}
        self._last_live_mono: dict[str, float] = {}
        # Last 3 ACCEPTED native mids per symbol → median de-spike (kills a
        # single-tick spike without lagging a real move).
        self._mid_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=3))
        # Consecutive >10%-jump ticks per symbol. We drop a lone spike but
        # accept the move once it persists for JUMP_ACCEPT_AFTER ticks (the
        # market genuinely gapped, e.g. a news candle).
        self._bad_tick_count: dict[str, int] = defaultdict(int)
        # Monotonic time of the last Binance side-feed tick per crypto symbol
        # (see _binance_crypto_feed / BINANCE_FRESH_SEC).
        self._binance_live_mono: dict[str, float] = {}
        # Monotonic time of the last tick received from the PRIMARY feed
        # (Infoway) — drives the mid-flight reconnect watchdog below.
        self._last_feed_tick_mono: float = time.monotonic()

    async def start(self):
        logger.info("Starting Market Data Service...")

        signal.signal(signal.SIGINT, lambda *_: setattr(self, "running", False))
        signal.signal(signal.SIGTERM, lambda *_: setattr(self, "running", False))

        await self.store.init()
        await self.ohlc_store.init()
        # Every CLOSED bar the aggregator produces is persisted to the durable
        # OHLC store (ohlc_bars) — saved history is exactly the candle that
        # streamed live, deep and restart-proof.
        self.aggregator.ohlc_store = self.ohlc_store

        await self.spread_cache.reload_if_stale(force=True)
        await self._seed_last_mid_from_redis()

        tasks = [
            asyncio.create_task(self.feed.start()),
            asyncio.create_task(self._process_ticks()),
            asyncio.create_task(self._spread_reload_loop()),
            asyncio.create_task(self._spread_config_subscriber()),
            asyncio.create_task(self._stale_quote_refresher()),
            asyncio.create_task(self.aggregator.run_aggregation_loop()),
            asyncio.create_task(self._auto_seed_bars()),
        ]
        if self._infoway_watchdog_armed:
            tasks.append(asyncio.create_task(self._infoway_fallback_watchdog()))
        # Infoway's crypto socket ticks only every few seconds, which made BTC
        # P&L crawl. Pull crypto from Binance's public trade stream ALONGSIDE
        # Infoway (many ticks/sec) — same fix as the sibling platform.
        if isinstance(self.feed, InfowayFeed):
            tasks.append(asyncio.create_task(self._binance_crypto_feed()))
            tasks.append(asyncio.create_task(self._feed_reconnect_watchdog()))

        await asyncio.gather(*tasks)

    async def _spread_reload_loop(self):
        while self.running:
            await asyncio.sleep(RELOAD_INTERVAL_SEC)
            if self.running:
                await self.spread_cache.reload_if_stale(force=True)

    async def _spread_config_subscriber(self):
        """Reload spread cache when admin saves spreads (same channel as instrument config)."""
        channel = CONFIG_INSTRUMENTS_RELOAD_CHANNEL
        while self.running:
            pubsub = redis_client.pubsub()
            try:
                await pubsub.subscribe(channel)
                while self.running:
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if msg and msg.get("type") == "message":
                        logger.info("Config reload signal — refreshing spread cache")
                        await self.spread_cache.reload_if_stale(force=True)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Spread config subscriber error (retrying): %s", exc)
                await asyncio.sleep(2.0)
            finally:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.aclose()
                except Exception:
                    pass

    async def _seed_last_mid_from_redis(self) -> None:
        """Prime last mid from existing tick:* keys so stale-quote refresh can fix spread after restart."""
        try:
            mono = time.monotonic()
            n = 0
            async for key in redis_client.scan_iter(f"{PriceChannel.TICK_PREFIX}*"):
                raw = await redis_client.get(key)
                if not raw:
                    continue
                try:
                    d = json.loads(raw)
                    sym = str(d.get("symbol") or "").strip().upper()
                    if not sym:
                        continue
                    b, a = float(d["bid"]), float(d["ask"])
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    continue
                self._last_mid[sym] = (b + a) / 2.0
                self._last_quote[sym] = (b, a)
                self._last_live_mono[sym] = mono - STALE_TICK_AFTER_SEC - 1.0
                n += 1
            if n:
                logger.info("Seeded last mid from Redis for %d symbols (stale refresh eligible)", n)
        except Exception as exc:
            logger.warning("Seed last_mid from Redis failed: %s", exc)

    async def _stale_quote_refresher(self) -> None:
        while self.running:
            await asyncio.sleep(STALE_REFRESH_INTERVAL_SEC)
            if not self.running:
                break
            await self.spread_cache.reload_if_stale(force=False)
            now = time.monotonic()
            ts_dt = datetime.now(timezone.utc)
            ts = ts_dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts_dt.microsecond // 1000:03d}Z"
            for symbol, quote in list(self._last_quote.items()):
                if now - self._last_live_mono.get(symbol, 0) < STALE_TICK_AFTER_SEC:
                    continue
                try:
                    b0, a0 = quote
                    bid, ask = self.spread_cache.widen(symbol, b0, a0)
                    # stale=True: this is a refresher republish (no real feed
                    # tick for >STALE_TICK_AFTER_SEC), so SL/TP / stop-out /
                    # liquidation consumers skip it and never phantom-close.
                    await publish_price(symbol, bid, ask, ts, stale=True)
                except Exception as exc:
                    logger.debug("Stale quote refresh failed for %s: %s", symbol, exc)

    async def _process_ticks(self):
        logger.info("Tick processor started")
        while self.running:
            tick = await self.feed.get_tick()
            if tick is None:
                await asyncio.sleep(0.01)
                continue

            symbol = str(tick["symbol"] or "").strip().upper()
            if not symbol:
                continue
            self._last_feed_tick_mono = time.monotonic()
            # Crypto precedence: while the Binance side-feed is live for this
            # symbol its ~10 ticks/s stream is the source of truth — drop the
            # (much slower) Infoway crypto tick so the two feeds' slightly
            # different mids can't interleave. Still counts toward _tick_count
            # (Infoway IS alive) so the fallback watchdog judges it correctly.
            if symbol in LIVE_CRYPTO_SYMBOLS:
                last_b = self._binance_live_mono.get(symbol, 0.0)
                if last_b and time.monotonic() - last_b < BINANCE_FRESH_SEC:
                    self._tick_count += 1
                    continue
            bid = float(tick["bid"])
            ask = float(tick["ask"])
            ts = tick.get("timestamp", datetime.now(timezone.utc).isoformat())

            # --- Tick pipeline: bad-tick guard → de-spike → spread engine ---
            # 1a. Structurally invalid quote (non-positive or crossed) — always
            #     drop; there is no valid downstream use for it.
            if bid <= 0 or ask <= 0 or ask < bid:
                continue

            raw_mid = (bid + ask) / 2.0
            prev_mid = self._last_mid.get(symbol)

            # 1b. Jump guard: a >10% move from the last accepted mid is treated
            #     as a spike and dropped — unless it persists, meaning the
            #     market really gapped (accept after JUMP_ACCEPT_AFTER).
            if prev_mid and prev_mid > 0 and abs(raw_mid - prev_mid) / prev_mid > 0.10:
                self._bad_tick_count[symbol] += 1
                if self._bad_tick_count[symbol] < JUMP_ACCEPT_AFTER:
                    continue
                # Persisted → accept the new level and reset the median window
                # so the old (pre-gap) mids don't drag the de-spiked value.
                self._mid_history[symbol].clear()
            self._bad_tick_count[symbol] = 0

            # 2. De-spike: median of the last 3 accepted native mids.
            hist = self._mid_history[symbol]
            hist.append(raw_mid)
            mids = sorted(hist)
            despiked_mid = mids[len(mids) // 2]
            # Rebuild the native quote around the de-spiked mid, preserving the
            # feed's native half-spread; the spread engine re-spreads from this
            # mid next, so only the mid matters downstream.
            half = (ask - bid) / 2.0
            bid = despiked_mid - half
            ask = despiked_mid + half

            self._last_mid[symbol] = despiked_mid
            self._last_quote[symbol] = (bid, ask)
            self._last_live_mono[symbol] = time.monotonic()
            # 3. Spread engine: symmetric admin spread around the (de-spiked) mid.
            bid, ask = self.spread_cache.widen(symbol, bid, ask)

            await publish_price(symbol, bid, ask, ts)

            await self.store.insert_tick(symbol, bid, ask, ts)

            self.aggregator.update(symbol, bid, ask, ts)
            await self._publish_current_bars(symbol)
            self._tick_count += 1

    async def _publish_current_bars(self, symbol: str) -> None:
        """Publish the current in-progress bar for every TF of `symbol` to
        BARS_UPDATES_CHANNEL. Called once per tick from _process_ticks, so the
        live candle moves with every tick instead of only on the aggregation
        loop's 1s republish. The loop stays as the quiet-symbol heartbeat."""
        sym_bars = self.aggregator._bars.get(symbol)
        sym_starts = self.aggregator._bar_timestamps.get(symbol)
        if not sym_bars or not sym_starts:
            return
        # Snapshot the items so the aggregator can mutate the underlying
        # dict (new bar period rollover) while we're awaiting publish.
        # Without this, `RuntimeError: dictionary keys changed during
        # iteration` crashes the tick processor on every bar boundary.
        for tf_name, bar in list(sym_bars.items()):
            bar_start = sym_starts.get(tf_name)
            if bar_start is None:
                continue
            try:
                await redis_client.publish(
                    BARS_UPDATES_CHANNEL,
                    json.dumps({
                        "symbol": symbol,
                        "timeframe": tf_name,
                        "time": int(bar_start),
                        "open": float(bar.open),
                        "high": float(bar.high),
                        "low": float(bar.low),
                        "close": float(bar.close),
                        "volume": float(bar.volume),
                        "tick_count": int(bar.tick_count),
                        "closed": False,
                    }),
                )
            except Exception as exc:
                # Pub/sub is best-effort — don't break the tick processor
                # if Redis briefly hiccups. The aggregation loop republishes
                # within 1s anyway.
                logger.debug("publish current bar %s %s failed: %s", symbol, tf_name, exc)

    async def _binance_crypto_feed(self) -> None:
        """Live crypto ticks from Binance, run ALONGSIDE the Infoway feed.

        Infoway's crypto socket delivers a tick only every few seconds, so BTC
        (and every crypto) P&L visibly crawled. Binance's public trade stream
        is free, reliable, and ticks many times per second. This mirrors
        _process_ticks — same de-spike bookkeeping, admin spread via
        spread_cache.widen, publish_price → tick store → aggregator →
        per-tick bar publish — but deliberately does NOT touch
        self._tick_count, so the Infoway watchdog still detects a dead
        primary feed correctly. _process_ticks drops Infoway crypto ticks
        while this feed is fresh (BINANCE_FRESH_SEC) and lets them flow
        again automatically if Binance goes quiet.
        """
        import websockets as _ws
        from .feed_handler import BINANCE_MAP, BINANCE_WS, SPREAD_RANGE

        streams = [f"{pair}@trade" for pair in BINANCE_MAP]
        url = f"{BINANCE_WS}/{'/'.join(streams)}"
        # Stop if the watchdog swaps the primary feed to FeedSimulator, which
        # runs its OWN Binance feed — else we'd double-publish crypto.
        while self.running and isinstance(self.feed, InfowayFeed):
            try:
                logger.info("Binance crypto feed connecting (alongside Infoway)")
                async with _ws.connect(url, ping_interval=20, ping_timeout=10) as ws:
                    logger.info("Binance crypto feed connected — live crypto prices active")
                    async for raw in ws:
                        if not self.running or not isinstance(self.feed, InfowayFeed):
                            break
                        try:
                            data = json.loads(raw)
                            pair = (data.get("s") or "").lower()
                            symbol = BINANCE_MAP.get(pair)
                            if not symbol:
                                continue
                            price = float(data["p"])
                        except (KeyError, ValueError, TypeError):
                            continue
                        if price <= 0:
                            continue
                        ts_dt = datetime.now(timezone.utc)
                        ts = ts_dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts_dt.microsecond // 1000:03d}Z"
                        # Tiny native spread around the trade price (same range
                        # the simulator's Binance feed uses); the spread engine
                        # re-spreads from the mid anyway.
                        lo, hi = SPREAD_RANGE.get(symbol, (0.0, 0.0))
                        half = random.uniform(lo, hi) / 2.0
                        bid0, ask0 = price - half, price + half
                        self._last_mid[symbol] = price
                        self._mid_history[symbol].append(price)
                        self._last_quote[symbol] = (bid0, ask0)
                        now_mono = time.monotonic()
                        self._last_live_mono[symbol] = now_mono
                        self._binance_live_mono[symbol] = now_mono
                        bid, ask = self.spread_cache.widen(symbol, bid0, ask0)
                        await publish_price(symbol, bid, ask, ts)
                        await self.store.insert_tick(symbol, bid, ask, ts)
                        self.aggregator.update(symbol, bid, ask, ts)
                        await self._publish_current_bars(symbol)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("Binance crypto feed error: %s — reconnecting in 5s", e)
                await asyncio.sleep(5)

    async def _feed_reconnect_watchdog(self) -> None:
        """Mid-flight self-heal: reconnect a silently-dead Infoway socket.

        The startup watchdog below only covers the first 55s. Observed
        2026-07-21: the WS died after hours of running — no error, no close
        frame — leaving every non-crypto symbol frozen (stale republishes)
        until a MANUAL service restart. This loop detects the stall (no
        primary-feed tick for FEED_STALL_RECONNECT_SEC while the forex
        market is open) and rebuilds the feed automatically.
        """
        FEED_STALL_RECONNECT_SEC = 90.0
        from packages.common.src.market_hours import is_market_open

        while self.running:
            await asyncio.sleep(30.0)
            if not self.running or not isinstance(self.feed, InfowayFeed):
                continue
            gap = time.monotonic() - self._last_feed_tick_mono
            if gap < FEED_STALL_RECONNECT_SEC:
                continue
            # Weekend/holiday: zero forex ticks is NORMAL — don't churn the
            # connection all weekend. (Crypto stays live via Binance anyway.)
            try:
                forex_open, _ = is_market_open("EURUSD", "forex", None)
            except Exception:
                forex_open = True  # fail open: better a redundant reconnect than a dead feed
            if not forex_open:
                continue
            logger.error(
                "Feed stalled: no Infoway ticks for %.0fs with the market open — reconnecting the feed.",
                gap,
            )
            try:
                await self.feed.stop()
            except Exception as exc:
                logger.warning("Stopping stalled Infoway feed: %s", exc)
            raw_key = (settings.INFOWAY_API_KEY or "").strip()
            self.feed = InfowayFeed(raw_key, INSTRUMENTS)
            asyncio.create_task(self.feed.start())
            # Fresh grace window so we don't immediately re-trigger while the
            # new socket performs its handshake/subscriptions.
            self._last_feed_tick_mono = time.monotonic()

    async def _infoway_fallback_watchdog(self) -> None:
        """If Infoway never delivers ticks (bad key, network, symbol mismatch), use simulator."""
        try:
            await asyncio.sleep(55.0)
        except asyncio.CancelledError:
            raise
        if not self.running or self._tick_count > 0:
            return
        if not isinstance(self.feed, InfowayFeed):
            return
        logger.error(
            "Infoway: no ticks in 55s — check INFOWAY_API_KEY, outbound HTTPS/WSS, and symbol codes. "
            "Falling back to LIVE crypto only (Binance); forex/indices stay unquoted ('-')."
        )
        try:
            await self.feed.stop()
        except Exception as exc:
            logger.warning("Stopping Infoway feed: %s", exc)
        # Crypto-only live feed (no price simulation) so at least crypto keeps ticking.
        self.feed = FeedSimulator(tick_rate_multiplier=1.0)
        asyncio.create_task(self.feed.start())

    async def _auto_seed_bars(self) -> None:
        """Wait for first ticks to arrive, then seed historical bars if Redis is empty."""
        try:
            await asyncio.sleep(30.0)  # give feed time to start delivering ticks
        except asyncio.CancelledError:
            raise
        if not self.running:
            return
        # Check if bars already exist for a common symbol
        sample_count = await redis_client.llen("bars:BTCUSD:5m")
        if sample_count >= 50:
            logger.info("Bars already seeded (%d bars for BTCUSD:5m), skipping auto-seed", sample_count)
            return
        logger.info("Auto-seeding historical bars (first run or bars missing)...")
        try:
            await seed_bars()
        except Exception as exc:
            logger.warning("Auto-seed bars failed: %s", exc)

    async def shutdown(self):
        logger.info("Shutting down Market Data Service...")
        self.running = False
        await self.feed.stop()
        await close_producer()
        await redis_client.close()


async def main():
    service = MarketDataService()
    try:
        await service.start()
    except KeyboardInterrupt:
        await service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
