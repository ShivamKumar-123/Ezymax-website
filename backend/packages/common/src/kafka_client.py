import json
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from .config import get_settings

settings = get_settings()


class KafkaTopics:
    ORDERS = "orders"
    TRADES = "trades"
    POSITIONS = "positions"
    DEPOSITS = "deposits"
    WITHDRAWALS = "withdrawals"
    COMMISSIONS = "commissions"
    NOTIFICATIONS = "notifications"
    AUDIT = "audit"
    MARKET_DATA = "market_data"
    RISK_EVENTS = "risk_events"
    SOCIAL_COPY = "social_copy"


_producer = None


async def get_kafka_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
        )
        await _producer.start()
    return _producer


async def produce_event(topic: str, key: str, value: dict):
    producer = await get_kafka_producer()
    await producer.send_and_wait(topic, key=key, value=value)


def create_consumer(
    topic: str, group_id: str,
    *, auto_offset_reset: str = "earliest",
    enable_auto_commit: bool = False,
) -> AIOKafkaConsumer:
    """Default to AT-LEAST-ONCE delivery semantics:
      - auto_offset_reset='earliest' so a brand-new consumer group
        starts from the beginning of the partition rather than silently
        skipping events that arrived before subscription
      - enable_auto_commit=False so the caller commits after the DB
        write succeeds (commit-after-handle pattern). With auto-commit
        true, a crash mid-handler discards the event because the offset
        already advanced.

    Caller must `await consumer.commit()` after a successful handler.
    Use the kwargs overrides for non-money paths (e.g. price ticks)
    where at-most-once is acceptable in exchange for lower latency."""
    return AIOKafkaConsumer(
        topic,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=group_id,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        auto_offset_reset=auto_offset_reset,
        enable_auto_commit=enable_auto_commit,
    )


async def close_producer():
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
