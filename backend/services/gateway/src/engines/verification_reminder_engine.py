"""KYC verification reminder engine.

Once a day, walks every user who signed up >=3 days ago and >=7 days ago
without completing KYC, and sends one reminder email. Uses a simple
flag (User.kyc_reminder_stage 0/1/2) to keep us from re-emailing — the
3-day reminder bumps it to 1, the 7-day reminder bumps it to 2 and stops
sending forever after.

Idempotent on the engine side: we only run once per UTC day. If the
gateway restarts mid-day, the cached `_last_run_day` is reset but the
DB-side stage flag prevents re-sending to the same user.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import User

logger = logging.getLogger("verification-reminder")

TICK_INTERVAL = 3600  # check hourly so a deploy mid-day still triggers


class VerificationReminderEngine:
    def __init__(self):
        self._running = False
        self._last_run_day: str | None = None

    async def start(self):
        self._running = True
        logger.info("Verification reminder engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                if self._last_run_day != today:
                    async with AsyncSessionLocal() as db:
                        sent = await send_due_reminders(db)
                        await db.commit()
                    self._last_run_day = today
                    if sent:
                        logger.info("KYC reminder: emailed %d users", sent)
            except Exception as e:
                logger.error("Verification reminder engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


async def send_due_reminders(db: AsyncSession) -> int:
    """Send reminders to two cohorts: users 3-6 days old (stage 0 → 1) and
    users 7+ days old (stage 1 → 2). Skip everyone past stage 2."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_verification_reminder
        from packages.common.src.config import get_settings
    except Exception as e:
        logger.warning("verification reminder setup failed: %s", e)
        return 0

    if not smtp_configured():
        return 0

    now = datetime.now(timezone.utc)
    threshold_3d = now - timedelta(days=3)
    threshold_7d = now - timedelta(days=7)
    app_url = (get_settings().TRADER_APP_URL or "https://trade.fxartha.com")

    candidates = (await db.execute(
        select(User).where(
            User.kyc_status.in_(("pending", "rejected")),
            User.created_at <= threshold_3d,
        )
    )).scalars().all()

    sent = 0
    for u in candidates:
        if not u.email or bool(getattr(u, "is_demo", False)):
            continue
        stage = int(getattr(u, "kyc_reminder_stage", 0) or 0)
        if stage >= 2:
            continue
        # Stage progression: 0→1 once they cross the 3-day mark, 1→2 once
        # they cross the 7-day mark. We only send when crossing.
        if stage == 0 and u.created_at <= threshold_3d:
            target_stage = 1
        elif stage == 1 and u.created_at <= threshold_7d:
            target_stage = 2
        else:
            continue

        days_old = max(0, (now - u.created_at).days) if u.created_at else 0
        subject, html, text = render_verification_reminder(
            first_name=u.first_name,
            days_since_signup=days_old,
            trader_app_url=app_url,
        )
        fire_and_forget(send_email(u.email, subject, html, text=text))
        u.kyc_reminder_stage = target_stage
        sent += 1
    return sent


verification_reminder_engine = VerificationReminderEngine()
