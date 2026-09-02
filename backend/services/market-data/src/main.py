"""Market Data Service — Connects to price feeds, normalizes, distributes via Redis pub/sub and stores in TimescaleDB."""
import asyncio
import json
import logging
import signal
import time
from datetime import datetime, timezone

from packages.common.src.config import get_settings
from packages.common.src.redis_client import (
    CONFIG_INSTRUMENTS_RELOAD_CHANNEL,
    PriceChannel,
    redis_client,
    publish_price,
)
from packages.common.src.kafka_client import close_producer

from .feed_handler import FeedSimulator, NullFeed, INSTRUMENTS
from .infoway_config import usable_infoway_api_key
from .infoway_feed import InfowayFeed
from .corecen_lp_feed import CorecenLPFeed
from .binance_feed import BinanceCryptoFeed, covered_symbols as binance_covered_symbols
from .bar_aggregator import BarAggregator
from .seed_bars import seed as seed_bars
from .spread_cache import StreamSpreadCache, RELOAD_INTERVAL_SEC
from .store import TickStore, ohlc_store

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

# --- Durable-write watchdog ---------------------------------------------------
# Catches a SILENT stall of the durable OHLC persistence (the class of bug that
# froze chart history for 5 days: ticks kept flowing + the forming candle kept
# updating, but no CLOSED bar was ever written). Signal: while the feed is alive
# (some symbol got a real tick recently), the durable store's last successful
# write must keep advancing — a 1m bar closes every 60s, so during an open
# market writes happen constantly. If it stops for this long, the pipeline is
# dead. Weekend / feed-down needs no alert: no live ticks → nothing expected.
DURABLE_CHECK_INTERVAL_SEC = 180.0   # how often the watchdog looks
DURABLE_STALE_SEC = 600.0            # no durable write this long (feed alive) → alarm
DURABLE_HEALTH_KEY = "health:ohlc_durable_write"


class MarketDataService:
    def __init__(self):
        raw_key = (settings.INFOWAY_API_KEY or "").strip()
        self._tick_count = 0
        self._infoway_watchdog_armed = False

        # Crypto from Binance's public WS (deep real liquidity) when enabled and
        # a real primary feed is active. The primary feed then drops the crypto
        # symbols so each has exactly one source; forex/metals/etc stay primary.
        self.crypto_feed = None
        binance_crypto = getattr(settings, "CRYPTO_FEED_BINANCE", True)
        crypto_syms = set(binance_covered_symbols(INSTRUMENTS)) if binance_crypto else set()

        if getattr(settings, "CORECEN_LP_ENABLED", False):
            if not settings.CORECEN_LP_API_KEY or not settings.CORECEN_LP_API_SECRET:
                logger.error(
                    "CORECEN_LP_ENABLED=true but CORECEN_LP_API_KEY / CORECEN_LP_API_SECRET "
                    "are not set — gateway will reject LP pushes and no ticks will arrive."
                )
            self.feed = CorecenLPFeed()
            logger.info("Price feed: Corecen LP (receiving pushes on /api/lp/prices/batch)")
            if crypto_syms:
                self.crypto_feed = BinanceCryptoFeed(INSTRUMENTS)
        elif usable_infoway_api_key(raw_key):
            self.feed = InfowayFeed(raw_key, INSTRUMENTS, exclude_symbols=crypto_syms)
            self._infoway_watchdog_armed = True
            if crypto_syms:
                self.crypto_feed = BinanceCryptoFeed(INSTRUMENTS)
                logger.info("Price feed: Infoway WebSocket (forex/metals) + Binance (crypto)")
            else:
                logger.info("Price feed: Infoway WebSocket (depth)")
        elif getattr(settings, "ALLOW_SIMULATED_FEED", False):
            # DEV ONLY — explicit opt-in. Never enable in production.
            self.feed = FeedSimulator(tick_rate_multiplier=1.0)
            logger.warning(
                "ALLOW_SIMULATED_FEED=true — using SIMULATED feed + Binance crypto. "
                "DEV ONLY; this fabricates prices and must NOT be used in production."
            )
        else:
            # No real feed and simulation not allowed → refuse to fabricate prices.
            self.feed = NullFeed()
            logger.error(
                "No real price feed (Infoway/Corecen) configured and ALLOW_SIMULATED_FEED is off — "
                "NOT publishing simulated prices. Prices freeze at their last real value."
            )
        self.aggregator = BarAggregator()
        self.store = TickStore()
        self.spread_cache = StreamSpreadCache()
        self.running = True
        self._last_mid: dict[str, float] = {}
        self._last_live_mono: dict[str, float] = {}
        self._service_start_mono = time.monotonic()
        self._durable_alert_active = False  # edge-trigger so we alert once per incident

    async def start(self):
        logger.info("Starting Market Data Service...")

        signal.signal(signal.SIGINT, lambda *_: setattr(self, "running", False))
        signal.signal(signal.SIGTERM, lambda *_: setattr(self, "running", False))

        await self.store.init()
        # Durable OHLC store — closed bars persist to ohlcv_<tf> so chart
        # history is deep and survives restarts (replaces the Redis-only cache
        # + simulated seed as the source of truth for history).
        await ohlc_store.init()

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
            asyncio.create_task(self._durable_write_watchdog()),
        ]
        if self.crypto_feed is not None:
            tasks.append(asyncio.create_task(self.crypto_feed.start()))
        if self._infoway_watchdog_armed:
            tasks.append(asyncio.create_task(self._infoway_fallback_watchdog()))

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
            for symbol, mid in list(self._last_mid.items()):
                if now - self._last_live_mono.get(symbol, 0) < STALE_TICK_AFTER_SEC:
                    continue
                try:
                    bid, ask = self.spread_cache.widen(symbol, mid)
                    await publish_price(symbol, bid, ask, ts)
                except Exception as exc:
                    logger.debug("Stale quote refresh failed for %s: %s", symbol, exc)

    async def _durable_write_watchdog(self):
        """Alarm when durable OHLC persistence silently stalls while the market
        is live. Three layers so a warning can never be missed:
          1. A loud ERROR log (always visible in `docker logs`).
          2. A Redis health key (machine-readable — admin panel / uptime probe).
          3. A best-effort email to ADMIN_EMAIL, edge-triggered (once per
             incident, plus one recovery note) so it never spams.
        """
        logger.info("Durable-write watchdog started (stale>%ds, check every %ds)",
                    int(DURABLE_STALE_SEC), int(DURABLE_CHECK_INTERVAL_SEC))
        while self.running:
            await asyncio.sleep(DURABLE_CHECK_INTERVAL_SEC)
            if not self.running:
                break
            try:
                now = time.monotonic()
                feed_alive = any(
                    now - t < STALE_TICK_AFTER_SEC
                    for t in self._last_live_mono.values()
                )
                base = ohlc_store.last_write_mono
                if base is None:
                    base = self._service_start_mono
                age = now - base
                stalled = feed_alive and age > DURABLE_STALE_SEC

                # Layer 2 — health key (TTL'd so a dead service = missing key).
                try:
                    await redis_client.set(DURABLE_HEALTH_KEY, json.dumps({
                        "status": "stalled" if stalled else "ok",
                        "feed_alive": feed_alive,
                        "write_age_sec": round(age, 1),
                        "threshold_sec": int(DURABLE_STALE_SEC),
                        "ts": datetime.now(timezone.utc).isoformat(),
                    }), ex=int(DURABLE_CHECK_INTERVAL_SEC * 3))
                except Exception as exc:
                    logger.debug("watchdog health-key write failed: %s", exc)

                if stalled and not self._durable_alert_active:
                    self._durable_alert_active = True
                    logger.error(
                        "🔴 DURABLE OHLC WRITE STALLED — no bar persisted for %.0fs "
                        "while the feed is live. Chart history will freeze. Check "
                        "the aggregator / TimescaleDB.", age,
                    )
                    await self._email_ops(
                        "🔴 FXArtha: durable chart-history write STALLED",
                        f"No OHLC bar has been persisted for {age:.0f}s while live "
                        f"ticks are flowing (threshold {int(DURABLE_STALE_SEC)}s).<br>"
                        f"Chart history is freezing — inspect the market-data "
                        f"aggregator and TimescaleDB.",
                    )
                elif not stalled and self._durable_alert_active:
                    self._durable_alert_active = False
                    logger.info("✅ Durable OHLC write recovered (age %.0fs).", age)
                    await self._email_ops(
                        "✅ FXArtha: durable chart-history write recovered",
                        f"Durable OHLC persistence is writing again "
                        f"(last write {age:.0f}s ago).",
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Durable-write watchdog error (continuing): %s", exc)

    async def _email_ops(self, subject: str, html: str) -> None:
        """Best-effort ops email — never raises, silently skips if no transport."""
        try:
            from packages.common.src.smtp_mail import send_email
            to = (getattr(settings, "ADMIN_EMAIL", "") or "").strip()
            if to:
                await send_email(to, subject, html)
        except Exception as exc:
            logger.debug("ops email failed: %s", exc)

    async def _process_ticks(self):
        logger.info("Tick processor started")
        while self.running:
            tick = await self.feed.get_tick()
            if tick is None and self.crypto_feed is not None:
                tick = await self.crypto_feed.get_tick()
            if tick is None:
                await asyncio.sleep(0.01)
                continue

            symbol = str(tick["symbol"] or "").strip().upper()
            if not symbol:
                continue
            bid = float(tick["bid"])
            ask = float(tick["ask"])
            ts = tick.get("timestamp", datetime.now(timezone.utc).isoformat())

            mid = (bid + ask) / 2.0
            # Provider's own live spread (0 when the feed collapses to mid,
            # e.g. Binance trade stream) — the floating-spread mode's signal.
            raw_spread = ask - bid
            self._last_mid[symbol] = mid
            self._last_live_mono[symbol] = time.monotonic()
            _mkt_spread = raw_spread if raw_spread > 0 else None
            bid, ask = self.spread_cache.widen(
                symbol, mid, raw_spread=_mkt_spread,
            )

            # Carry the provider's live market spread so a per-user FLOATING
            # spread can be computed downstream (frontend + execution).
            await publish_price(symbol, bid, ask, ts, market_spread=_mkt_spread)

            await self.store.insert_tick(symbol, bid, ask, ts)

            self.aggregator.update(symbol, bid, ask, ts)
            self._tick_count += 1

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
        if not getattr(settings, "ALLOW_SIMULATED_FEED", False):
            # Production: NEVER fabricate prices. Leave the Infoway feed
            # running — it keeps reconnecting on its own — so quotes resume
            # automatically once the key/network/symbols are fixed. Prices
            # stay frozen at their last real value until then.
            logger.error(
                "Infoway: no ticks in 55s — check INFOWAY_API_KEY (expired?), plan, outbound WSS, "
                "and symbol codes. NOT switching to simulated prices (production). The Infoway feed "
                "keeps retrying; prices stay frozen at their last real value until live ticks resume."
            )
            return
        # DEV ONLY — explicit opt-in to fabricated prices.
        logger.error(
            "Infoway: no ticks in 55s — ALLOW_SIMULATED_FEED=true, switching to simulated feed (DEV)."
        )
        try:
            await self.feed.stop()
        except Exception as exc:
            logger.warning("Stopping Infoway feed: %s", exc)
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
