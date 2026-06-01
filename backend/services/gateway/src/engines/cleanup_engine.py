"""Cleanup engine — hourly TTL-based pruning of unbounded tables.

The platform has several tables that grow indefinitely if left alone:
  * notifications — one row per trade close / deposit / etc.
  * webhook_events — one row per IPN delivery (NOWPayments, OxaPay)
  * email_otp_codes — one row per OTP issued
  * wallet_auth_nonces — one row per SIWE nonce
  * idempotency_keys — one row per cached mutation response
  * user_audit_logs / admin audit_logs — one row per privileged action

Without a cleanup job these become Seq-Scan hotspots in a year, and the
DB volume bloats. None of these tables are financial — they're notify /
session / audit. Pruning per the schedule below is safe.

Retention windows are conservative enough that compliance auditors get
~1 year of records, but tight enough that the tables stay query-able
and indexable.

Leader-locked so a 2-worker gateway doesn't double-execute (the DELETEs
are idempotent but doubling them wastes IO).
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock

logger = logging.getLogger("cleanup-engine")

TICK_INTERVAL = 3600  # one hour

# Each entry: (label, sql, retention_days). retention_days is interpolated
# into the SQL via a parameterised bind so there's no injection surface.
_CLEANUP_JOBS = [
    (
        "notifications",
        # Delete notifications older than 90d. Users rarely scroll past
        # the most recent 50 in the bell drawer; anything older is dead
        # weight. The dashboard fetches "recent" not "all".
        "DELETE FROM notifications WHERE created_at < :cutoff",
        90,
    ),
    (
        "webhook_events",
        # 60d covers IPN re-deliveries from payment providers and gives
        # support a 2-month window for dispute forensics.
        "DELETE FROM webhook_events WHERE received_at < :cutoff",
        60,
    ),
    (
        "email_otp_codes",
        # Consumed or expired — neither is useful after the fact. We
        # cut on expires_at (5-min OTPs) to avoid touching active rows.
        "DELETE FROM email_otp_codes WHERE expires_at < :cutoff",
        1,  # 1 day = 24h, plenty after the 5-min OTP window
    ),
    (
        "wallet_auth_nonces",
        # Same shape as email OTPs — 5-min single-use nonces. 24h cutoff.
        "DELETE FROM wallet_auth_nonces WHERE expires_at < :cutoff",
        1,
    ),
    (
        "idempotency_keys",
        # 7d is the standard idempotency window (long enough for any
        # client retry, short enough to keep the table small).
        "DELETE FROM idempotency_keys WHERE created_at < :cutoff",
        7,
    ),
    (
        "user_audit_logs",
        # 365d retention. Adjust upward if a regulator pins us to longer.
        "DELETE FROM user_audit_logs WHERE created_at < :cutoff",
        365,
    ),
    (
        "audit_logs",
        # Admin AuditLog. Same 365d.
        "DELETE FROM audit_logs WHERE created_at < :cutoff",
        365,
    ),
]


class CleanupEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Cleanup engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Leader-locked: only one gateway worker runs the job
                # per hour. TTL=120s keeps the lock from outliving a
                # crashed worker. The DELETEs themselves are short.
                async with engine_lock("cleanup_tick", ttl_seconds=120) as is_leader:
                    if is_leader:
                        await self._run_once()
            except Exception as e:
                logger.error("cleanup engine tick failed: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)

    async def _run_once(self) -> None:
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            for label, sql, retention_days in _CLEANUP_JOBS:
                cutoff = now - timedelta(days=retention_days)
                try:
                    res = await db.execute(text(sql), {"cutoff": cutoff})
                    deleted = res.rowcount or 0
                    await db.commit()
                    if deleted:
                        logger.info(
                            "cleanup %s: deleted %d row(s) older than %s",
                            label, deleted, cutoff.isoformat(),
                        )
                except Exception as e:
                    # Per-table try/except so one bad query doesn't take
                    # the whole sweep down (e.g. table renamed mid-deploy).
                    await db.rollback()
                    logger.warning("cleanup %s failed: %s", label, e)


cleanup_engine = CleanupEngine()
