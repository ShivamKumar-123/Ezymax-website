"""Hedge-recorder engine — maintains hedge_episodes history.

Every tick (leader-locked, ~30s) it snapshots which trading accounts are
currently hedged: holding open positions on BOTH sides of the same
instrument. It then reconciles that against the open episodes in
``hedge_episodes``:

  * a newly-hedged (account, instrument) with no open episode  → INSERT open
  * an open episode whose (account, instrument) is no longer hedged → close it
  * an ongoing hedge → refresh last_* lots and bump peak_* lots

This is HISTORY only. The admin "live hedges" and "book exposure" tabs read
current open positions directly, so they never depend on this engine's
cadence. Records accrue from deploy forward — no backfill of past hedges.

Single writer by design: wrapped in ``engine_lock`` so only one gateway
worker records per tick, and the partial-unique index
``ux_hedge_open_account_instrument`` is the hard backstop against duplicate
open rows.
"""
from __future__ import annotations

import asyncio
import logging
from decimal import Decimal

from sqlalchemy import text

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock

logger = logging.getLogger("hedge-recorder")

TICK_INTERVAL = 30.0

# Accounts hedged on an instrument: SUM of buy lots and SUM of sell lots both
# > 0 over OPEN positions. Demo accounts excluded — they aren't book risk.
_SNAPSHOT_SQL = text(
    """
    SELECT
        ta.user_id                                   AS user_id,
        p.account_id                                 AS account_id,
        p.instrument_id                              AS instrument_id,
        max(i.symbol)                                AS symbol,
        sum(CASE WHEN lower(cast(p.side AS text)) = 'buy'  THEN p.lots ELSE 0 END) AS long_lots,
        sum(CASE WHEN lower(cast(p.side AS text)) = 'sell' THEN p.lots ELSE 0 END) AS short_lots
    FROM positions p
    JOIN trading_accounts ta ON ta.id = p.account_id
    JOIN instruments i       ON i.id = p.instrument_id
    WHERE lower(cast(p.status AS text)) = 'open'
      AND ta.is_demo = false
    GROUP BY ta.user_id, p.account_id, p.instrument_id
    HAVING sum(CASE WHEN lower(cast(p.side AS text)) = 'buy'  THEN p.lots ELSE 0 END) > 0
       AND sum(CASE WHEN lower(cast(p.side AS text)) = 'sell' THEN p.lots ELSE 0 END) > 0
    """
)


class HedgeRecorderEngine:
    def __init__(self) -> None:
        self._running = False

    async def start(self) -> None:
        self._running = True
        logger.info("Hedge recorder engine started (tick=%ds)", int(TICK_INTERVAL))
        asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._running = False

    async def _run(self) -> None:
        while self._running:
            try:
                async with engine_lock("hedge_recorder", ttl_seconds=120) as is_leader:
                    if is_leader:
                        await self._reconcile()
            except Exception as exc:  # noqa: BLE001
                logger.error("hedge recorder tick failed: %s", exc, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)

    async def _reconcile(self) -> None:
        async with AsyncSessionLocal() as db:
            snap = (await db.execute(_SNAPSHOT_SQL)).all()
            # key -> (user_id, symbol, long, short)
            current: dict[tuple, tuple] = {}
            for r in snap:
                m = r._mapping
                current[(str(m["account_id"]), str(m["instrument_id"]))] = (
                    str(m["user_id"]), m["symbol"],
                    Decimal(str(m["long_lots"] or 0)), Decimal(str(m["short_lots"] or 0)),
                )

            open_rows = (await db.execute(text(
                "SELECT id, account_id, instrument_id FROM hedge_episodes WHERE status = 'open'"
            ))).all()
            open_keys = {
                (str(r._mapping["account_id"]), str(r._mapping["instrument_id"])): str(r._mapping["id"])
                for r in open_rows
            }

            # 1) Close episodes no longer hedged.
            for key, ep_id in open_keys.items():
                if key not in current:
                    await db.execute(text(
                        "UPDATE hedge_episodes SET status='closed', closed_at=now() WHERE id = :id"
                    ), {"id": ep_id})

            # 2) Open new / refresh ongoing.
            for key, (user_id, symbol, long_lots, short_lots) in current.items():
                acc_id, inst_id = key
                if key in open_keys:
                    await db.execute(text(
                        """
                        UPDATE hedge_episodes
                        SET last_long_lots = :ll, last_short_lots = :sl,
                            peak_long_lots = greatest(peak_long_lots, :ll),
                            peak_short_lots = greatest(peak_short_lots, :sl)
                        WHERE id = :id
                        """
                    ), {"ll": long_lots, "sl": short_lots, "id": open_keys[key]})
                else:
                    # ON CONFLICT on the partial unique index → no-op if a race
                    # already inserted the open row this tick.
                    await db.execute(text(
                        """
                        INSERT INTO hedge_episodes
                            (user_id, account_id, instrument_id, symbol, status,
                             peak_long_lots, peak_short_lots, last_long_lots, last_short_lots)
                        VALUES (:uid, :aid, :iid, :sym, 'open', :ll, :sl, :ll, :sl)
                        ON CONFLICT (account_id, instrument_id) WHERE status = 'open'
                        DO NOTHING
                        """
                    ), {"uid": user_id, "aid": acc_id, "iid": inst_id, "sym": symbol,
                        "ll": long_lots, "sl": short_lots})

            await db.commit()


hedge_recorder_engine = HedgeRecorderEngine()
