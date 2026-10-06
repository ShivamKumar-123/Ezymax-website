"""NOWPayments reconciliation — ask the provider about every open deposit.

Settlement is webhook-driven, and a webhook is delivered once. If our side
fails while handling it (as the `expired` path did for months), the provider
has already been told "received", the retry is treated as a duplicate, and
the deposit stays `pending` forever: an unpaid invoice in the admin queue
with an Approve button next to it. Sixty-three of them had piled up.

This engine closes that gap from the other direction. Every hour (and once at
startup, to clear whatever accumulated while the gateway was down) it fetches
the provider's current state for each open NOWPayments deposit and feeds it
through the same handler the webhook uses, so a missed `finished` credits
the trader and a missed `expired` closes the row. The handler is idempotent;
a deposit the webhook already settled is skipped.

Leader-locked so a multi-worker gateway reconciles once.
"""
import asyncio
import logging

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock

logger = logging.getLogger("nowpayments-reconcile")

TICK_INTERVAL = 3600       # hourly — the webhook is the fast path
STARTUP_DELAY = 20         # let the gateway finish booting first


class NowPaymentsReconcileEngine:
    def __init__(self):
        self._running = False
        self._task = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("NOWPayments reconcile engine started (tick=%ds)", TICK_INTERVAL)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self):
        await asyncio.sleep(STARTUP_DELAY)
        while self._running:
            try:
                async with engine_lock("nowpayments_reconcile", ttl_seconds=600) as is_leader:
                    if is_leader:
                        from ..services.wallet_service import reconcile_nowpayments_deposits
                        async with AsyncSessionLocal() as db:
                            stats = await reconcile_nowpayments_deposits(db)
                        if stats.get("checked"):
                            logger.info("NOWPayments reconcile: %s", stats)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("NOWPayments reconcile error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


nowpayments_reconcile_engine = NowPaymentsReconcileEngine()
