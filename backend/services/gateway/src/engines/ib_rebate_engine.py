"""IB rebate settlement engine (Milele-style accrual).

Once a day (leader-elected across workers), runs a settlement pass for the
current calendar month, plus a final catch-up for the previous month on the
1st/2nd. `settle_ib_rebates` is a no-op unless `ib_commission_model` is
'accrual', and only ever pays the newly-earned delta, so a mid-day deploy or a
double tick can never double-pay.
"""
import asyncio
import logging
from datetime import datetime, timezone

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.ib_rebate import settle_ib_rebates

logger = logging.getLogger("ib-rebate-engine")

TICK_INTERVAL = 3600  # poll hourly; the daily key guards the once-a-day run


def _prev_period(now: datetime) -> str:
    y, m = now.year, now.month
    if m == 1:
        return f"{y - 1:04d}-12"
    return f"{y:04d}-{m - 1:02d}"


class IbRebateEngine:
    def __init__(self):
        self._running = False
        self._last_run_day: str | None = None

    async def start(self):
        self._running = True
        logger.info("IB rebate settlement engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                today_key = now.strftime("%Y-%m-%d")
                if self._last_run_day != today_key:
                    async with engine_lock("ib_rebate_settle", ttl_seconds=600) as is_leader:
                        if is_leader:
                            async with AsyncSessionLocal() as db:
                                summary = await settle_ib_rebates(db)
                            if summary.get("ibs_paid"):
                                logger.info("IB rebate settlement: %s", summary)
                            # Month-start catch-up: settle the previous month once
                            # more so trades that closed near the boundary are paid.
                            if now.day <= 2:
                                async with AsyncSessionLocal() as db:
                                    await settle_ib_rebates(db, period=_prev_period(now))
                            self._last_run_day = today_key
            except Exception as e:
                logger.error("IB rebate engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


ib_rebate_engine = IbRebateEngine()
