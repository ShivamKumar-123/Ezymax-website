"""Gateway-side cache of active pricing time-rules → leverage cap.

The market-data feed owns the *spread* side of time-rules; the gateway
needs only the *leverage cap* at order-placement time. We cache the
enabled rules for a short TTL so the hot order path doesn't re-query
Postgres on every fill, and resolve the active cap with the shared pure
helper so semantics match the feed exactly.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import PricingTimeRule
from packages.common.src.pricing_time_rules import effective_leverage_cap

_TTL = 30.0
_rules: list[dict] = []
_last_load = 0.0


async def _refresh(db: AsyncSession) -> None:
    global _rules, _last_load
    now = time.monotonic()
    if _last_load > 0 and (now - _last_load) < _TTL:
        return
    try:
        rows = (await db.execute(
            select(PricingTimeRule).where(PricingTimeRule.is_enabled == True)
        )).scalars().all()
        _rules = [{
            "scope": r.scope,
            "segment_id": str(r.segment_id) if r.segment_id else None,
            "instrument_id": str(r.instrument_id) if r.instrument_id else None,
            "kind": r.kind, "session": r.session,
            "days_of_week": r.days_of_week, "start_min": r.start_min, "end_min": r.end_min,
            "leverage_cap": r.leverage_cap, "priority": r.priority, "is_enabled": r.is_enabled,
        } for r in rows]
        _last_load = now
    except Exception:
        # Keep the previous cache on a transient failure — never block a
        # trade because the rules table hiccupped.
        pass


async def leverage_cap_for(db: AsyncSession, instrument) -> Optional[int]:
    """Active leverage cap for ``instrument`` right now (UTC), or None."""
    await _refresh(db)
    if not _rules:
        return None
    return effective_leverage_cap(
        _rules,
        str(instrument.id),
        str(instrument.segment_id) if getattr(instrument, "segment_id", None) else None,
        datetime.now(timezone.utc),
    )
