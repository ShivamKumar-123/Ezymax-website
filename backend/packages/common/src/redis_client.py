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
    PRICE_CHANNEL = "prices"
    ORDERBOOK_CHANNEL = "orderbook"

    @staticmethod
    def tick_key(symbol: str) -> str:
        return f"{PriceChannel.TICK_PREFIX}{symbol}"

    @staticmethod
    def price_channel(symbol: str) -> str:
        return f"{PriceChannel.PRICE_CHANNEL}:{symbol}"


async def get_redis():
    return redis_client


async def publish_price(
    symbol: str, bid: float, ask: float, timestamp: str,
    market_spread: float | None = None,
):
    import json
    payload = {
        "symbol": symbol,
        "bid": bid,
        "ask": ask,
        "timestamp": timestamp,
        "spread": round(ask - bid, 8),
    }
    # Provider's LIVE market spread (raw InfoWay ask−bid, in price units) — the
    # signal a per-user FLOATING spread needs downstream (frontend re-spread +
    # b-book execution). Purely additive; consumers that don't know it ignore it.
    if market_spread is not None and market_spread > 0:
        payload["market_spread"] = round(float(market_spread), 8)
    data = json.dumps(payload)
    # 120 s TTL: if market-data dies, stale prices clear themselves
    # within 2 min instead of persisting forever. Live feed refreshes
    # the key on every tick (sub-second cadence), so the TTL never
    # actually expires during healthy operation — it's a crash safety
    # net, not a cache window.
    await redis_client.set(PriceChannel.tick_key(symbol), data, ex=120)
    await redis_client.publish(PriceChannel.price_channel(symbol), data)
    await redis_client.publish(PriceChannel.PRICE_CHANNEL, data)


CONFIG_INSTRUMENTS_RELOAD_CHANNEL = "config:instruments:reload"


async def publish_instrument_config_reload() -> None:
    """Notify services that instrument charge/spread config changed (optional cache bust)."""
    await redis_client.publish(CONFIG_INSTRUMENTS_RELOAD_CHANNEL, "1")
