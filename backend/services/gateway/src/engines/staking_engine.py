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

    async def start(self):
        self._running = True
        logger.info("Staking accrual engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                if self._last_run_day != today_key:
                    async with AsyncSessionLocal() as db:
                        inserted = await staking_service.accrue_daily(db)
                        await db.commit()
                    self._last_run_day = today_key
                    if inserted:
                        logger.info("Staking accrual: inserted %d reward rows", inserted)
            except Exception as e:
                logger.error("Staking engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


staking_engine = StakingEngine()
