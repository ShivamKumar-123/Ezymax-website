"""Bar reconcile engine — re-asserts the provider's OFFICIAL OHLC over recent
CLOSED bars so stored history is byte-exact with the provider (no seam between
our tick-aggregated candles and provider history).

Design constraints (why it looks the way it does):
  • GENTLE on the provider API. A reconcile that hammers Infoway REST would get
    the key rate-limit-banned and take down the WHOLE feed — far worse than a
    closed candle being ~99% (not 100%) identical. So it does ONE light call
    (~8 recent bars) per cycle, round-robin over (symbol, tf); with ~30 symbols
    × 7 tf that reconciles each pair roughly every 10-15 min.
  • LEADER-LOCKED so a `--workers N` gateway fleet issues the calls ONCE, not
    N times (same lock the SL/TP engine uses).
  • NEVER touches the forming bar — only bars whose window has fully closed are
    upserted. Idempotent (PK symbol,tf,ts), grid-snapped before write.

This continuous healing also subsumes the reconnect blind-window backfill for
recent bars: whatever a feed drop missed reappears within a reconcile pass.
"""
import asyncio
import logging

import httpx

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src import bars_store, infoway_history
from sqlalchemy import text

logger = logging.getLogger("gateway.reconcile")

# One provider call per cycle. Keep this comfortably slow — the point is
# correctness over time, not speed.
RECONCILE_INTERVAL = 4.0
# How many recent bars to re-fetch per pair. A handful of closed bars is enough
# to keep the tail provider-exact; deep history is already backfilled on demand.
RECONCILE_LOOKBACK_BARS = 8
# Rebuild the (symbol, tf) work-list this often (cycles), so newly-traded
# symbols get picked up without a restart.
PAIR_REFRESH_EVERY = 60


class ReconcileEngine:
    def __init__(self, interval: float = RECONCILE_INTERVAL):
        self._interval = interval
        self._task: asyncio.Task | None = None
        self._running = False
        self._client: httpx.AsyncClient | None = None
        self._pairs: list[tuple[str, str]] = []
        self._cursor = 0
        self._cycles = 0

    async def start(self) -> None:
        if self._running:
            return
        key = (getattr(get_settings(), "INFOWAY_API_KEY", "") or "").strip()
        if not key:
            logger.info("reconcile engine idle — no INFOWAY_API_KEY set")
            return
        self._running = True
        self._client = httpx.AsyncClient(timeout=20.0)
        self._task = asyncio.create_task(self._loop())
        logger.info("reconcile engine started (1 call / %.1fs, %d-bar lookback)",
                    self._interval, RECONCILE_LOOKBACK_BARS)

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _loop(self) -> None:
        # Small initial delay so boot/backfill settles first.
        await asyncio.sleep(15.0)
        while self._running:
            try:
                # Leader-only: one worker in the fleet issues the API calls.
                async with engine_lock("reconcile", ttl_seconds=15) as is_leader:
                    if is_leader:
                        await self._reconcile_one()
            except Exception as e:  # never let a bad cycle kill the loop
                logger.debug("reconcile cycle error: %s", e)
            await asyncio.sleep(self._interval)

    async def _refresh_pairs(self) -> None:
        """Rebuild the round-robin work-list from what we actually store."""
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                text("SELECT DISTINCT symbol, tf FROM ohlc_bars")
            )).all()
        pairs = [
            (str(r[0]).upper(), str(r[1]))
            for r in rows
            if str(r[1]) in bars_store.TF_SECONDS and infoway_history.infoway_supports(str(r[1]))
        ]
        pairs.sort()
        self._pairs = pairs

    async def _reconcile_one(self) -> None:
        if not self._pairs or self._cycles % PAIR_REFRESH_EVERY == 0:
            await self._refresh_pairs()
        self._cycles += 1
        if not self._pairs:
            return

        sym, tf = self._pairs[self._cursor % len(self._pairs)]
        self._cursor += 1

        key = (getattr(get_settings(), "INFOWAY_API_KEY", "") or "").strip()
        if not key:
            return

        tf_sec = bars_store.TF_SECONDS.get(tf, 300)
        bars = await infoway_history.fetch_infoway_klines(
            key, sym, tf, count=RECONCILE_LOOKBACK_BARS, client=self._client,
        )
        if not bars:
            return

        # Normalize to the UTC grid, then keep only bars whose window has fully
        # CLOSED — never overwrite the still-forming candle.
        import time as _time
        now = int(_time.time())
        current_slot = (now // tf_sec) * tf_sec
        snapped = bars_store.grid_snap(bars, tf_sec)
        closed = [b for b in snapped if int(b["time"]) < current_slot]
        if not closed:
            return

        async with AsyncSessionLocal() as db:
            written = await bars_store.upsert_bars(db, sym, tf, closed)
            if written:
                await db.commit()


reconcile_engine = ReconcileEngine()
