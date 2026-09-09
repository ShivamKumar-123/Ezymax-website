"""Admin Config Service — charge, spread, swap bulk config management."""
import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import ChargeConfig, SpreadConfig, SwapConfig, LevelBenefit
from packages.common.src.redis_client import publish_instrument_config_reload
from packages.common.src.admin_schemas import (
    ChargeConfigOut, SpreadConfigOut, SwapConfigOut,
    BulkChargeUpdate, BulkSpreadUpdate, BulkSwapUpdate,
)
from instrument_service import build_admin_instrument_items, upsert_instrument_config
from dependencies import write_audit_log


async def list_config_instruments(
    db: AsyncSession,
    search: str | None,
    segment: str | None,
    include_inactive: bool,
) -> dict:
    return await build_admin_instrument_items(
        db, include_inactive=include_inactive, search=search, segment_filter=segment,
    )


async def update_instrument_config(
    instrument_id: uuid.UUID,
    body: dict,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    try:
        inst = await upsert_instrument_config(
            db, instrument_id, body, admin_id, ip_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await write_audit_log(
        db, admin_id, "update_instrument_config", "instrument", instrument_id,
        new_values=body, ip_address=ip_address,
    )
    await db.commit()
    await publish_instrument_config_reload()
    return {"message": f"{inst.symbol} config updated successfully"}


async def list_charges(db: AsyncSession) -> list:
    result = await db.execute(select(ChargeConfig).order_by(ChargeConfig.scope))
    configs = result.scalars().all()
    return [
        ChargeConfigOut(
            id=str(c.id),
            scope=c.scope,
            segment_id=str(c.segment_id) if c.segment_id else None,
            instrument_id=str(c.instrument_id) if c.instrument_id else None,
            user_id=str(c.user_id) if c.user_id else None,
            charge_type=c.charge_type,
            value=float(c.value or 0),
            is_enabled=c.is_enabled,
            created_at=c.created_at,
        )
        for c in configs
    ]


async def update_charges(
    body: BulkChargeUpdate,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    await db.execute(delete(ChargeConfig))

    for cfg in body.configs:
        new_cfg = ChargeConfig(
            scope=cfg.scope,
            segment_id=uuid.UUID(cfg.segment_id) if cfg.segment_id else None,
            instrument_id=uuid.UUID(cfg.instrument_id) if cfg.instrument_id else None,
            user_id=uuid.UUID(cfg.user_id) if cfg.user_id else None,
            charge_type=cfg.charge_type,
            value=Decimal(str(cfg.value)),
            is_enabled=cfg.is_enabled,
        )
        db.add(new_cfg)

    await write_audit_log(
        db, admin_id, "update_charges", "charge_config", None,
        new_values={"count": len(body.configs)}, ip_address=ip_address,
    )
    await db.commit()
    return {"message": f"{len(body.configs)} charge configs saved"}


async def list_spreads(db: AsyncSession) -> list:
    result = await db.execute(select(SpreadConfig).order_by(SpreadConfig.scope))
    configs = result.scalars().all()
    return [
        SpreadConfigOut(
            id=str(c.id),
            scope=c.scope,
            segment_id=str(c.segment_id) if c.segment_id else None,
            instrument_id=str(c.instrument_id) if c.instrument_id else None,
            user_id=str(c.user_id) if c.user_id else None,
            spread_type=c.spread_type,
            value=float(c.value or 0),
            is_enabled=c.is_enabled,
            created_at=c.created_at,
        )
        for c in configs
    ]


async def update_spreads(
    body: BulkSpreadUpdate,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    await db.execute(delete(SpreadConfig))

    for cfg in body.configs:
        new_cfg = SpreadConfig(
            scope=cfg.scope,
            segment_id=uuid.UUID(cfg.segment_id) if cfg.segment_id else None,
            instrument_id=uuid.UUID(cfg.instrument_id) if cfg.instrument_id else None,
            user_id=uuid.UUID(cfg.user_id) if cfg.user_id else None,
            spread_type=cfg.spread_type,
            value=Decimal(str(cfg.value)),
            is_enabled=cfg.is_enabled,
        )
        db.add(new_cfg)

    await write_audit_log(
        db, admin_id, "update_spreads", "spread_config", None,
        new_values={"count": len(body.configs)}, ip_address=ip_address,
    )
    await db.commit()
    await publish_instrument_config_reload()
    return {"message": f"{len(body.configs)} spread configs saved"}


async def list_swaps(db: AsyncSession) -> list:
    result = await db.execute(select(SwapConfig).order_by(SwapConfig.scope))
    configs = result.scalars().all()
    return [
        SwapConfigOut(
            id=str(c.id),
            scope=c.scope,
            segment_id=str(c.segment_id) if c.segment_id else None,
            instrument_id=str(c.instrument_id) if c.instrument_id else None,
            user_id=str(c.user_id) if c.user_id else None,
            swap_long=float(c.swap_long or 0),
            swap_short=float(c.swap_short or 0),
            triple_swap_day=c.triple_swap_day or 3,
            swap_free=c.swap_free or False,
            is_enabled=c.is_enabled,
            created_at=c.created_at,
        )
        for c in configs
    ]


async def update_swaps(
    body: BulkSwapUpdate,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    await db.execute(delete(SwapConfig))

    for cfg in body.configs:
        new_cfg = SwapConfig(
            scope=cfg.scope,
            segment_id=uuid.UUID(cfg.segment_id) if cfg.segment_id else None,
            instrument_id=uuid.UUID(cfg.instrument_id) if cfg.instrument_id else None,
            user_id=uuid.UUID(cfg.user_id) if cfg.user_id else None,
            swap_long=Decimal(str(cfg.swap_long)),
            swap_short=Decimal(str(cfg.swap_short)),
            triple_swap_day=cfg.triple_swap_day,
            swap_free=cfg.swap_free,
            is_enabled=cfg.is_enabled,
        )
        db.add(new_cfg)

    await write_audit_log(
        db, admin_id, "update_swaps", "swap_config", None,
        new_values={"count": len(body.configs)}, ip_address=ip_address,
    )
    await db.commit()
    return {"message": f"{len(body.configs)} swap configs saved"}


# ─── Level benefits (XP-tier trading-cost discounts) ─────────────────

LEVEL_LABELS = [
    "Novice", "Apprentice", "Skilled Trader", "Veteran", "Expert",
    "Master", "Champion", "Legend", "Sovereign", "Mythic",
]
LEVEL_XP_THRESHOLDS = [0, 500, 1500, 3000, 5000, 8000, 12000, 18000, 26000, 36000]


async def list_level_benefits(db: AsyncSession) -> list:
    """Always returns all 10 levels. Rows the table is missing come back as
    zeros so the admin page can render a complete ladder on a fresh install
    instead of a short list the desk has to guess at."""
    rows = (await db.execute(
        select(LevelBenefit).order_by(LevelBenefit.level)
    )).scalars().all()
    by_level = {int(r.level): r for r in rows}
    out = []
    for lvl in range(1, 11):
        r = by_level.get(lvl)
        out.append({
            "level": lvl,
            "label": LEVEL_LABELS[lvl - 1],
            "xp_required": LEVEL_XP_THRESHOLDS[lvl - 1],
            "spread_discount_pct": float(r.spread_discount_pct or 0) if r else 0.0,
            "swap_discount_pct": float(r.swap_discount_pct or 0) if r else 0.0,
            "commission_discount_pct": float(r.commission_discount_pct or 0) if r else 0.0,
            "is_enabled": bool(r.is_enabled) if r else True,
        })
    return out


async def update_level_benefits(
    body, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Upsert the ladder. Unlike spreads/swaps this does NOT delete-then-insert:
    the ladder is a fixed set of 10 rows, and wiping it mid-request would leave
    the pricing path with no discounts if the insert half failed."""
    old = {r["level"]: r for r in await list_level_benefits(db)}

    for item in body.levels:
        lvl = int(item.level)
        if lvl < 1 or lvl > 10:
            raise HTTPException(status_code=400, detail=f"Invalid level {lvl}: must be 1-10")
        for field in ("spread_discount_pct", "swap_discount_pct", "commission_discount_pct"):
            v = float(getattr(item, field) or 0)
            if v < 0 or v > 100:
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} for level {lvl} must be between 0 and 100",
                )

        row = (await db.execute(
            select(LevelBenefit).where(LevelBenefit.level == lvl)
        )).scalar_one_or_none()
        if row is None:
            row = LevelBenefit(level=lvl)
            db.add(row)
        row.spread_discount_pct = Decimal(str(item.spread_discount_pct or 0))
        row.swap_discount_pct = Decimal(str(item.swap_discount_pct or 0))
        row.commission_discount_pct = Decimal(str(item.commission_discount_pct or 0))
        row.is_enabled = bool(item.is_enabled)
        row.updated_by = admin_id

    await db.commit()

    # Drop this process's cached ladder so the change is live immediately here;
    # the gateway / b-book / risk-engine workers refresh within their own TTL.
    try:
        from packages.common.src.instrument_pricing import invalidate_level_cache
        invalidate_level_cache()
    except Exception:
        pass

    await write_audit_log(
        db, admin_id, "update_level_benefits", "config", None,
        old_values={"levels": list(old.values())},
        new_values={"levels": [i.model_dump() for i in body.levels]},
        ip_address=ip_address,
    )
    return {"message": "Level benefits updated", "levels": await list_level_benefits(db)}
