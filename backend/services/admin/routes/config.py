import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User, SystemSetting, SpreadConfig
from packages.common.src.admin_schemas import BulkChargeUpdate, BulkSpreadUpdate, BulkSwapUpdate
from services import config_service

router = APIRouter(prefix="/config", tags=["Configuration"])

# Default floor (pips) applied when floating is toggled on for a user from the
# Users / Trades pages. Admin can fine-tune per-instrument in the Spreads page.
_DEFAULT_FLOATING_FLOOR_PIPS = 15.0


@router.get("/floating-users")
async def list_floating_users(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Users with an ENABLED per-user floating override — returns both ids and
    emails so the Users (has id) and Trades (has email) tables can show each
    user's floating toggle state."""
    rows = (await db.execute(
        select(SpreadConfig.user_id, User.email)
        .join(User, User.id == SpreadConfig.user_id)
        .where(
            func.lower(SpreadConfig.scope) == "user",
            func.lower(SpreadConfig.spread_type) == "floating",
            SpreadConfig.is_enabled == True,  # noqa: E712
        ).distinct()
    )).all()
    return {
        "user_ids": [str(r[0]) for r in rows if r[0]],
        "emails": [str(r[1]).lower() for r in rows if r[1]],
    }


class UserFloatingToggle(BaseModel):
    user_id: str | None = None
    user_email: str | None = None
    enabled: bool
    floor_pips: float | None = None


@router.post("/user-floating")
async def set_user_floating(
    body: UserFloatingToggle,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Turn a user's FLOATING spread on/off (a user-global override). On = the
    user's spread tracks the live market width × markup (capped); off = removes
    the row so they fall back to the normal per-instrument / default spread.
    Accepts either user_id or user_email (Trades table only has the email)."""
    uid: uuid.UUID | None = None
    if body.user_id:
        try:
            uid = uuid.UUID(body.user_id)
        except (ValueError, TypeError):
            uid = None
    if uid is None and body.user_email:
        row = (await db.execute(
            select(User.id).where(func.lower(User.email) == body.user_email.strip().lower()).limit(1)
        )).scalar_one_or_none()
        uid = row
    if uid is None:
        return {"error": "user not found"}
    existing = (await db.execute(
        select(SpreadConfig).where(
            func.lower(SpreadConfig.scope) == "user",
            SpreadConfig.user_id == uid,
            SpreadConfig.instrument_id.is_(None),
            func.lower(SpreadConfig.spread_type) == "floating",
        ).limit(1)
    )).scalar_one_or_none()
    if body.enabled:
        floor = body.floor_pips if (body.floor_pips and body.floor_pips > 0) else _DEFAULT_FLOATING_FLOOR_PIPS
        if existing:
            existing.is_enabled = True
            existing.value = Decimal(str(floor))
        else:
            db.add(SpreadConfig(
                scope="user", user_id=uid, instrument_id=None, segment_id=None,
                spread_type="floating", value=Decimal(str(floor)), is_enabled=True,
            ))
    elif existing:
        await db.delete(existing)
    await db.commit()
    return {"user_id": body.user_id, "enabled": body.enabled}


# ── Floating spread (global) ─────────────────────────────────────────────────
# The market-data spread engine already implements a Vantage-style floating
# spread: published spread = EMA(provider's live market spread) × (1 + markup%),
# clamped to [base_fixed_spread, base × max_mult]. It reads these keys from
# system_settings every ~30s. This exposes them to the admin so floating can be
# turned on + tuned without a deploy. Fixed per-instrument spread stays the base
# (the floor); floating only ever WIDENS from there, capped.
FLOATING_SPREAD_KEYS = (
    "floating_spread_enabled",       # bool — master switch
    "floating_spread_markup_pct",    # 0..100 — broker markup on top of market spread
    "floating_spread_max_mult",      # 1..10 — hard cap = base_fixed × this
    "floating_spread_ema_sec",       # 1..60 — smoothing time-constant
)
_FLOATING_DEFAULTS: dict[str, Any] = {
    "floating_spread_enabled": False,
    "floating_spread_markup_pct": 15.0,
    "floating_spread_max_mult": 4.0,
    "floating_spread_ema_sec": 5.0,
}


def _coerce_floating(key: str, value: Any) -> Any:
    """Server-side clamp so a bad admin value can't poison pricing."""
    if key == "floating_spread_enabled":
        return bool(value) if isinstance(value, bool) else str(value).lower() in ("true", "1", "yes")
    try:
        v = float(value)
    except (TypeError, ValueError):
        return _FLOATING_DEFAULTS[key]
    if key == "floating_spread_markup_pct":
        return max(0.0, min(100.0, v))
    if key == "floating_spread_max_mult":
        return max(1.0, min(10.0, v))
    if key == "floating_spread_ema_sec":
        return max(1.0, min(60.0, v))
    return v


@router.get("/floating-spread")
async def get_floating_spread(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(FLOATING_SPREAD_KEYS))
    )).scalars().all()
    out = dict(_FLOATING_DEFAULTS)
    for r in rows:
        raw = r.value
        if isinstance(raw, str):
            raw = raw.strip('"')
        out[r.key] = _coerce_floating(r.key, raw)
    return out


class FloatingSpreadUpdate(BaseModel):
    updates: dict[str, Any]


@router.put("/floating-spread")
async def update_floating_spread(
    body: FloatingSpreadUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    applied: dict[str, Any] = {}
    for key, value in body.updates.items():
        if key not in FLOATING_SPREAD_KEYS:
            continue  # allowlist — can't escape into other settings
        val = _coerce_floating(key, value)
        existing = (await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )).scalar_one_or_none()
        if existing is None:
            db.add(SystemSetting(
                key=key, value=val, updated_by=admin.id, updated_at=datetime.now(timezone.utc),
            ))
        else:
            existing.value = val
            existing.updated_by = admin.id
            existing.updated_at = datetime.now(timezone.utc)
        applied[key] = val
    await db.commit()
    return {"applied": applied}


@router.get("/instruments")
async def list_config_instruments(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    segment: str | None = Query(None),
    include_inactive: bool = Query(True),
):
    return await config_service.list_config_instruments(
        db=db, search=search, segment=segment, include_inactive=include_inactive,
    )


@router.put("/instrument/{instrument_id}")
async def update_instrument_config(
    instrument_id: uuid.UUID,
    body: dict,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    """Save charge, spread, swap, price impact (instrument_configs + engine sync)."""
    return await config_service.update_instrument_config(
        instrument_id=instrument_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/charges")
async def list_charges(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.list_charges(db=db)


@router.put("/charges")
async def update_charges(
    body: BulkChargeUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.update_charges(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/spreads")
async def list_spreads(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.list_spreads(db=db)


@router.put("/spreads")
async def update_spreads(
    body: BulkSpreadUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.update_spreads(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/swaps")
async def list_swaps(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.list_swaps(db=db)


@router.put("/swaps")
async def update_swaps(
    body: BulkSwapUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.update_swaps(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
