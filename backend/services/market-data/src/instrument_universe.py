"""The set of symbols market-data streams, read from the instruments table.

This used to be a hardcoded dict of 29 symbols in feed_handler, so any
instrument an admin added — or that was seeded later — was listed and tradable
but never received a price. The database is now the only list: an instrument
that is active gets streamed, and the segment decides where it is quoted.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.infoway_routes import publish_routes, route_for
from packages.common.src.models import Instrument

logger = logging.getLogger("market-data.universe")

# Segment name -> the category string the feeds already understand.
_CATEGORY_BY_SEGMENT = {
    "forex": "forex",
    "crypto": "crypto",
    "commodities": "commodity",
    "metals": "commodity",
    "energies": "energy",
    "indices": "index",
    "stocks": "stock",
}


def _entry(symbol: str, segment: str | None, digits: int, pip: float) -> dict:
    business, code = route_for(symbol, segment)
    return {
        "category": _CATEGORY_BY_SEGMENT.get((segment or "").lower(), "forex"),
        "decimals": digits,
        "pip": pip,
        "base_price": 0.0,
        "business": business,
        "code": code,
    }


def _from_hardcoded() -> Dict[str, dict]:
    """Last resort when the database cannot be read at boot."""
    from .feed_handler import INSTRUMENTS

    return {
        sym: _entry(sym, "crypto" if info["category"] == "crypto" else None,
                    int(info["decimals"]), float(info["pip"]))
        for sym, info in INSTRUMENTS.items()
    }


async def load_universe(fallback: bool = True) -> Optional[Dict[str, dict]]:
    """Active instruments keyed by symbol. Never raises.

    With ``fallback`` (boot), a database failure yields the built-in list so
    the feed still starts. Without it (periodic reload), a failure yields None:
    a transient DB error must not shrink a 500-symbol feed to the 29 built-ins.
    """
    try:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(Instrument)
                .where(Instrument.is_active == True)  # noqa: E712
                .options(selectinload(Instrument.segment))
            )).scalars().unique().all()
    except Exception as exc:  # noqa: BLE001
        if not fallback:
            logger.warning("Instrument universe reload failed, keeping current set: %s", exc)
            return None
        logger.error("Instrument universe load failed, using built-in list: %s", exc)
        return _from_hardcoded()

    out: Dict[str, dict] = {}
    for inst in rows:
        sym = (inst.symbol or "").strip().upper()
        if not sym:
            continue
        digits = int(inst.digits) if inst.digits is not None else 5
        pip = float(inst.pip_size) if inst.pip_size else 10.0 ** -digits
        out[sym] = _entry(sym, inst.segment.name if inst.segment else None, digits, pip)

    if not out:
        if not fallback:
            return None
        logger.error("No active instruments in the database, using built-in list")
        return _from_hardcoded()

    try:
        await publish_routes({s: (i["business"], i["code"]) for s, i in out.items()})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Publishing Infoway routes failed: %s", exc)
    return out
