import time

import redis.asyncio as aioredis
from .config import get_settings

settings = get_settings()

redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,
    decode_responses=True,
)

redis_client = aioredis.Redis(connection_pool=redis_pool)


class PriceChannel:
    TICK_PREFIX = "tick:"
    # Durable last-known price (no TTL) — read as a fallback when the live
    # tick: key has expired (e.g. forex/indices over the weekend).
    LAST_PRICE_PREFIX = "last_price:"
    PRICE_CHANNEL = "prices"
    ORDERBOOK_CHANNEL = "orderbook"

    @staticmethod
    def tick_key(symbol: str) -> str:
        return f"{PriceChannel.TICK_PREFIX}{symbol}"

    @staticmethod
    def last_price_key(symbol: str) -> str:
        return f"{PriceChannel.LAST_PRICE_PREFIX}{symbol}"

    @staticmethod
    def price_channel(symbol: str) -> str:
        return f"{PriceChannel.PRICE_CHANNEL}:{symbol}"


async def get_redis():
    return redis_client


async def publish_price(
    symbol: str,
    bid: float,
    ask: float,
    timestamp: str,
    stale: bool = False,
    spread_mult: float = 1.0,
):
    import json
    data = json.dumps({
        "symbol": symbol,
        "bid": bid,
        "ask": ask,
        "timestamp": timestamp,
        "spread": round(ask - bid, 8),
        # Multiplier applied to the base admin spread when building this quote
        # (1.0 = admin spread applied as configured). Carried so the chart /
        # order panel can surface any dynamic widening.
        "spread_mult": spread_mult,
        # Server publish time (epoch ms). Consumers use this for a
        # format-independent freshness check regardless of the upstream
        # feed's own timestamp format. Refreshed on every publish, so it
        # only ages while market-data is NOT publishing (i.e. the whole
        # service died) — before the 120 s tick: TTL expires.
        "ts_ms": int(time.time() * 1000),
        # True when this quote was NOT produced by a real feed tick but by
        # the stale-quote refresher (dead upstream feed, market-data alive).
        # SL/TP / stop-out / liquidation MUST NOT act on a stale quote —
        # a dead feed must never trigger phantom closes.
        "stale": bool(stale),
    })
    # 120 s TTL: if market-data dies, stale prices clear themselves
    # within 2 min instead of persisting forever. Live feed refreshes
    # the key on every tick (sub-second cadence), so the TTL never
    # actually expires during healthy operation — it's a crash safety
    # net, not a cache window.
    await redis_client.set(PriceChannel.tick_key(symbol), data, ex=120)
    # Durable last-known price (NO TTL). The tick: key self-expires in 120 s so
    # a dead feed doesn't masquerade as "live"; but for instruments whose market
    # is closed (forex / indices / metals over the weekend) we still want to SHOW
    # the last price instead of "-". Readers fall back to this key when the live
    # tick: has expired. Also survives market-data restarts / long closures.
    await redis_client.set(PriceChannel.last_price_key(symbol), data)
    await redis_client.publish(PriceChannel.price_channel(symbol), data)
    await redis_client.publish(PriceChannel.PRICE_CHANNEL, data)


def is_tick_stale(tick: dict, max_age_s: float = 60.0) -> bool:
    """True if this tick must NOT drive SL/TP, stop-out or liquidation.

    A dead feed must never trigger phantom closes, so any enforcement path
    reading a `tick:` value should bail when this returns True. Two signals:

      1. `stale=True` — the quote came from the stale-quote refresher, not a
         real feed tick (upstream feed died while market-data stayed up).
      2. `ts_ms` older than `max_age_s` — market-data itself stopped
         publishing (whole service died); catches the 0-120 s window before
         the tick: TTL expires and the key vanishes entirely.

    Fail-open: a legacy tick lacking both markers is treated as fresh, so we
    never block a legitimate close on missing metadata.
    """
    if not tick:
        return True
    if tick.get("stale"):
        return True
    ts_ms = tick.get("ts_ms")
    if ts_ms:
        try:
            if time.time() - (float(ts_ms) / 1000.0) > max_age_s:
                return True
        except (TypeError, ValueError):
            pass
    return False


# Live OHLCV bar fan-out. The market-data aggregator publishes both forming
# (~1/s) and just-closed bars here; the gateway /ws/bars relay subscribes once
# and forwards each to the browser clients whose (symbol, resolution) matches.
BARS_UPDATES_CHANNEL = "bars:updates"

CONFIG_INSTRUMENTS_RELOAD_CHANNEL = "config:instruments:reload"


async def publish_instrument_config_reload() -> None:
    """Notify services that instrument charge/spread config changed (optional cache bust)."""
    await redis_client.publish(CONFIG_INSTRUMENTS_RELOAD_CHANNEL, "1")
