"""Staking accrual engine.

Once a day, walks every active staking_position and inserts one
staking_reward_accruals row representing the principal × apy / 365 reward
earned over the just-elapsed 24h window. Idempotent (the unique index on
(position_id, period_start, period_end) prevents duplicates).
"""
import asyncio
import logging
from datetime import datetime, timezone

from packages.common.src.database import AsyncSessionLocal
from ..services import staking_service

logger = logging.getLogger("staking-engine")

# We poll hourly so a deploy that lands mid-day doesn't miss the first cycle,
# and we let staking_service.accrue_daily() de-dupe via its unique index.
TICK_INTERVAL = 3600  # seconds


class StakingEngine:
    def __init__(self):
        self._running = False
        self._last_run_day: str | None = None
        self._last_digest_iso_week: str | None = None

    async def start(self):
        self._running = True
        logger.info("Staking accrual engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                today_key = now.strftime("%Y-%m-%d")
                if self._last_run_day != today_key:
                    async with AsyncSessionLocal() as db:
                        inserted = await staking_service.accrue_daily(db)
                        await db.commit()
                    self._last_run_day = today_key
                    if inserted:
                        logger.info("Staking accrual: inserted %d reward rows", inserted)

                # Weekly digest — Monday after 00:00 UTC, once per ISO week.
                iso = now.isocalendar()
                week_key = f"{iso[0]}-W{iso[1]:02d}"
                if now.weekday() == 0 and self._last_digest_iso_week != week_key:
                    async with AsyncSessionLocal() as db:
                        sent = await staking_service.weekly_digest(db)
                    self._last_digest_iso_week = week_key
                    if sent:
                        logger.info("Staking digest: emailed %d users", sent)
            except Exception as e:
                logger.error("Staking engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


staking_engine = StakingEngine()
