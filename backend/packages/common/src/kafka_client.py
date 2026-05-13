"""Event-bus shim — Kafka has been removed.

Why this file still exists:
    Trade / order / position / risk hot paths historically called
    `produce_event(...)` to push events onto Kafka topics. Nothing
    consumed those topics — the broker plus Zookeeper were eating
    ~1.5 GB of RAM on a single-host VPS for an event log no one
    read. With zero users and zero consumers, Kafka was paying us
    nothing.

    Rather than rip every call site out (which would touch trading +
    risk + market-data and risk regression in flows that already
    work), we keep the public surface — `produce_event`,
    `KafkaTopics`, `create_consumer`, `close_producer`,
    `get_kafka_producer` — but make every function a no-op /
    structured-log line.

    When we eventually need a real event bus (fraud engine, analytics
    pipeline, audit replayer), the cheapest re-introduction is Redis
    Streams (Redis is already in the stack) — `XADD trades * key val`
    in place of the body below. A second commit can wire it back
    without touching call sites again. See README "Event bus".

The aiokafka package has been removed from every requirements.txt; do
not re-import AIOKafkaProducer / AIOKafkaConsumer here without also
re-adding the dependency.
"""
import logging

logger = logging.getLogger("kafka_client")


class KafkaTopics:
    """Topic-name constants. Retained as plain strings so existing
    call-sites compile and so a future Redis-Streams / Kafka migration
    can use the same identifiers as stream / topic names."""
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


async def get_kafka_producer():
    """Stub — no producer to return. Kept for import compatibility."""
    return None


async def produce_event(topic: str, key: str, value: dict) -> None:
    """No-op event publish. Logs at DEBUG so an operator inspecting the
    log can confirm the call site fired without flooding production
    output. Real durable storage of these events lives in Postgres
    (`positions`, `trade_history`, `audit_log`, `transactions`,
    `webhook_events`) — that's the source of truth, not this stream."""
    logger.debug("event[%s] key=%s value=%s (kafka removed; not published)",
                 topic, key, value)


def create_consumer(topic: str, group_id: str, **_kwargs):
    """Stub — there are no consumers in the codebase today, and the
    broker is gone. Calling this returns None so any caller can detect
    "no event bus" and either degrade gracefully or raise its own
    error."""
    logger.warning(
        "create_consumer(%s, %s) called but Kafka was removed. "
        "Use Redis pub/sub or a Postgres polling loop instead.",
        topic, group_id,
    )
    return None


async def close_producer() -> None:
    """No-op shutdown hook — retained so app lifespan handlers don't
    AttributeError on shutdown."""
    return None
