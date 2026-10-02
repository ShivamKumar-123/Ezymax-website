import time

import redis.asyncio as aioredis
from .config import get_settings

settings = get_settings()

# Section F: bounded BlockingConnectionPool — when every connection is busy a
# caller waits up to REDIS_POOL_TIMEOUT for one instead of failing instantly
# with "Too many connections" (the old ConnectionPool behaviour under bursts).
redis_pool = aioredis.BlockingConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=int(getattr(settings, "REDIS_MAX_CONNECTIONS", 50) or 50),
    timeout=float(getattr(settings, "REDIS_POOL_TIMEOUT", 5.0) or 5.0),
    decode_responses=True,
)

redis_client = aioredis.Redis(connection_pool=redis_pool)

# Separate pool for long-lived pub/sub connections. A SUBSCRIBE pins its
# connection for the life of the subscriber, so sharing the command pool let
# N WebSocket clients starve every other Redis call in the process. Pub/sub
# may also live on a different Redis (REDIS_PUBSUB_URL) in a split deployment.
redis_pubsub_pool = aioredis.ConnectionPool.from_url(
    (getattr(settings, "REDIS_PUBSUB_URL", "") or settings.REDIS_URL),
    max_connections=int(getattr(settings, "REDIS_PUBSUB_MAX_CONNECTIONS", 50) or 50),
    decode_responses=True,
)
redis_pubsub_client = aioredis.Redis(connection_pool=redis_pubsub_pool)

# Hash of symbol -> latest tick JSON, maintained by publish_price. Lets readers
# fetch every price with one HGETALL instead of a keyspace SCAN.
TICKS_LATEST_HASH = "ticks:latest"
# Set of `bars:{SYM}:{TF}` list keys the aggregator writes (no SCAN needed).
BARS_INDEX_SET = "bars:index"


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
    #
    # Durable last-known price (NO TTL). The tick: key self-expires in 120 s so
    # a dead feed doesn't masquerade as "live"; but for instruments whose market
    # is closed (forex / indices / metals over the weekend) we still want to SHOW
    # the last price instead of "-". Readers fall back to this key when the live
    # tick: has expired. Also survives market-data restarts / long closures.
    #
    # Section F: all five writes go out in ONE pipelined round trip (was five
    # sequential awaits per tick), and the ticks:latest hash gives readers a
    # single HGETALL instead of a keyspace SCAN.
    sym_u = str(symbol or "").upper()
    pipe = redis_client.pipeline(transaction=False)
    pipe.set(PriceChannel.tick_key(symbol), data, ex=120)
    pipe.set(PriceChannel.last_price_key(symbol), data)
    if sym_u:
        pipe.hset(TICKS_LATEST_HASH, sym_u, data)
    pipe.publish(PriceChannel.price_channel(symbol), data)
    pipe.publish(PriceChannel.PRICE_CHANNEL, data)
    await pipe.execute()


async def get_latest_ticks() -> dict[str, str]:
    """symbol -> latest tick JSON for every symbol, in one round trip.

    Reads the ticks:latest hash (maintained by publish_price). Falls back to a
    SCAN of tick:* / last_price:* only while the hash is still empty (rolling
    deploy before market-data has been restarted on the new code)."""
    try:
        latest = await redis_client.hgetall(TICKS_LATEST_HASH)
    except Exception:
        latest = {}
    if latest:
        return {str(k).upper(): v for k, v in latest.items() if v}
    out: dict[str, str] = {}
    import json as _json
    for prefix in (PriceChannel.LAST_PRICE_PREFIX, PriceChannel.TICK_PREFIX):
        keys = [k async for k in redis_client.scan_iter(match=f"{prefix}*", count=500)]
        if not keys:
            continue
        for v in await redis_client.mget(keys):
            if not v:
                continue
            try:
                sym = str(_json.loads(v).get("symbol") or "").upper()
            except (ValueError, TypeError, AttributeError):
                continue
            if sym:
                out[sym] = v  # live tick: (second pass) overrides last_price:
    return out


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
