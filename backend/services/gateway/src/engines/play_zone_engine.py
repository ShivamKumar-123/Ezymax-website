"""Play Zone closer — runs every minute and closes any lottery / bidding
rounds whose scheduled close time has passed. Idempotent: each closer is
safe to call repeatedly because it filters on state='open'."""
import asyncio
import logging
from datetime import datetime, timezone

from packages.common.src.database import AsyncSessionLocal
from ..services import play_zone_service

logger = logging.getLogger("play-zone-engine")

TICK_INTERVAL = 60  # seconds


class PlayZoneEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Play Zone closer started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    n_lot = await play_zone_service.close_due_lottery_rounds(db)
                    n_bid = await play_zone_service.close_due_bidding_rounds(db)
                    if n_lot or n_bid:
                        await db.commit()
                        logger.info("Play Zone close: lotteries=%d bids=%d", n_lot, n_bid)
            except Exception as e:
                logger.error("Play Zone engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


play_zone_engine = PlayZoneEngine()
