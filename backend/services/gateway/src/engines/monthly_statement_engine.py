"""Monthly account-statement notification engine.

Fires on the 1st of every UTC month: every active user with a real email
gets a one-line notification that their previous month's statement is
available in the trader app. Idempotent across workers and across
restarts via a per-user Redis SETNX lock keyed by `user_id:YYYY-MM`,
which means even though gateway runs with `--workers 2` (so the engine
spawns in every worker), each user receives exactly one email per month.

Tick is hourly so a deploy or restart on the 1st mid-day still triggers
the send for users not yet processed. The Redis key TTL is 35 days so
it naturally expires before the next month's run.
"""
from __future__ import annotations

import asyncio
import logging
from calendar import month_name
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import User
from packages.common.src.redis_client import redis_client

logger = logging.getLogger("monthly-statement")

TICK_INTERVAL = 3600  # check hourly
SEND_CONCURRENCY = 10  # cap parallel SMTP sessions
LOCK_TTL_SECONDS = 35 * 24 * 3600  # ~35 days; expires before next month
LOCK_PREFIX = "monthly_statement_sent"


def _previous_month_label(now: datetime) -> tuple[str, str]:
    """Return (label, year_month_key) for the *previous* calendar month.

    Example: called on 2026-04-01 → ("March, 2026", "2026-03").
    The notification covers the month that just ended."""
    y, m = now.year, now.month - 1
    if m == 0:
        m = 12
        y -= 1
    label = f"{month_name[m]}, {y}"
    key = f"{y:04d}-{m:02d}"
    return label, key


class MonthlyStatementEngine:
    def __init__(self):
        self._running = False
        self._last_run_month: str | None = None  # YYYY-MM we last finished

    async def start(self):
        self._running = True
        logger.info("Monthly statement engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                # Only on the 1st of the UTC month, and only once per month
                # per worker process. The per-user Redis lock guards against
                # duplicate sends across workers if both reach this branch.
                if now.day == 1:
                    label, ym_key = _previous_month_label(now)
                    if self._last_run_month != ym_key:
                        async with AsyncSessionLocal() as db:
                            sent = await send_monthly_statements(db, label, ym_key)
                        self._last_run_month = ym_key
                        if sent:
                            logger.info(
                                "monthly statement: emailed %d users for %s",
                                sent, label,
                            )
            except Exception as e:
                logger.error("Monthly statement engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


async def send_monthly_statements(
    db: AsyncSession, statement_month_label: str, year_month_key: str,
) -> int:
    """Send to every eligible user. Returns the number of emails actually
    dispatched (skips ones already locked by another worker, demo accounts,
    placeholder wallet emails, and missing addresses)."""
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured
        from packages.common.src.email_templates import render_monthly_statement_available
        from packages.common.src.config import get_settings
    except Exception as e:
        logger.warning("monthly statement setup failed: %s", e)
        return 0

    if not smtp_configured():
        return 0

    app_url = (get_settings().TRADER_APP_URL or "https://trade.fxartha.com")

    candidates = (await db.execute(
        select(User).where(User.status == "active")
    )).scalars().all()

    semaphore = asyncio.Semaphore(SEND_CONCURRENCY)
    sent_counter = 0
    sent_lock = asyncio.Lock()

    async def _send_one(user: User) -> None:
        nonlocal sent_counter
        if not user.email:
            return
        if user.email.lower().endswith("@wallet.fxartha.local"):
            return
        if bool(getattr(user, "is_demo", False)):
            return

        # Per-user-per-month idempotency. SETNX returns True only the first
        # time, so racing workers/replicas still send exactly one email.
        lock_key = f"{LOCK_PREFIX}:{user.id}:{year_month_key}"
        try:
            acquired = await redis_client.set(
                lock_key, "1", ex=LOCK_TTL_SECONDS, nx=True,
            )
        except Exception as e:
            logger.debug("redis SETNX failed for %s: %s — skipping safely", lock_key, e)
            return
        if not acquired:
            return  # another worker already sent it (or we already did)

        async with semaphore:
            try:
                subject, html, text = render_monthly_statement_available(
                    first_name=user.first_name,
                    statement_month_label=statement_month_label,
                    user_uid=str(user.id),
                    trader_app_url=app_url,
                )
                ok = await send_email(user.email, subject, html, text=text)
                if ok:
                    async with sent_lock:
                        sent_counter += 1
                else:
                    # Send failed — release the lock so a later run can retry.
                    try:
                        await redis_client.delete(lock_key)
                    except Exception:
                        pass
            except Exception as e:
                logger.warning("monthly statement send to %s failed: %s", user.email, e)
                try:
                    await redis_client.delete(lock_key)
                except Exception:
                    pass

    await asyncio.gather(*(_send_one(u) for u in candidates), return_exceptions=True)
    return sent_counter


monthly_statement_engine = MonthlyStatementEngine()
