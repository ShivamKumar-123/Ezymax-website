"""Admin service for time-windowed spread/leverage rules + dynamic-spread settings."""
import uuid
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import PricingTimeRule, Instrument, InstrumentSegment
from packages.common.src.pricing_time_rules import SESSION_PRESETS

_VALID_SCOPES = {"default", "segment", "instrument"}
_VALID_KINDS = {"session", "custom"}
_VALID_SPREAD_MODES = {"multiplier", "absolute"}

_DYN_DEFAULTS = {
    "dynamic_spread_enabled": False,
    "dynamic_spread_max_mult": 3.0,
    "dynamic_spread_sensitivity": 1.0,
    "dynamic_spread_window_sec": 60,
}


def sessions() -> list[dict]:
    return [{"slug": k, **v} for k, v in SESSION_PRESETS.items()]


def _serialize(r: PricingTimeRule, names: dict) -> dict:
    return {
        "id": str(r.id),
        "name": r.name,
        "scope": r.scope,
        "segment_id": str(r.segment_id) if r.segment_id else None,
        "segment_name": names.get(("seg", str(r.segment_id))) if r.segment_id else None,
        "instrument_id": str(r.instrument_id) if r.instrument_id else None,
        "instrument_symbol": names.get(("inst", str(r.instrument_id))) if r.instrument_id else None,
        "kind": r.kind,
        "session": r.session,
        "days_of_week": r.days_of_week,
        "start_min": r.start_min,
        "end_min": r.end_min,
        "spread_mode": r.spread_mode,
        "spread_multiplier": float(r.spread_multiplier) if r.spread_multiplier is not None else None,
        "spread_value": float(r.spread_value) if r.spread_value is not None else None,
        "spread_type": r.spread_type,
        "leverage_cap": r.leverage_cap,
        "priority": r.priority,
        "is_enabled": r.is_enabled,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


async def _name_map(db: AsyncSession) -> dict:
    names: dict = {}
    for s in (await db.execute(select(InstrumentSegment.id, InstrumentSegment.name))).all():
        names[("seg", str(s[0]))] = s[1]
    for i in (await db.execute(select(Instrument.id, Instrument.symbol))).all():
        names[("inst", str(i[0]))] = i[1]
    return names


async def list_rules(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(PricingTimeRule).order_by(PricingTimeRule.priority.desc(), PricingTimeRule.created_at.desc())
    )).scalars().all()
    names = await _name_map(db)
    return [_serialize(r, names) for r in rows]


def _validate(payload: dict) -> dict:
    scope = (payload.get("scope") or "default").lower()
    if scope not in _VALID_SCOPES:
        raise HTTPException(400, f"Invalid scope '{scope}'")
    kind = (payload.get("kind") or "custom").lower()
    if kind not in _VALID_KINDS:
        raise HTTPException(400, f"Invalid kind '{kind}'")
    mode = (payload.get("spread_mode") or "multiplier").lower()
    if mode not in _VALID_SPREAD_MODES:
        raise HTTPException(400, f"Invalid spread_mode '{mode}'")

    if scope == "instrument" and not payload.get("instrument_id"):
        raise HTTPException(400, "instrument_id required for scope=instrument")
    if scope == "segment" and not payload.get("segment_id"):
        raise HTTPException(400, "segment_id required for scope=segment")

    if kind == "session":
        if (payload.get("session") or "") not in SESSION_PRESETS:
            raise HTTPException(400, "Valid 'session' required for kind=session")
    else:
        days = payload.get("days_of_week")
        if not isinstance(days, list) or not days or any(not (0 <= int(d) <= 6) for d in days):
            raise HTTPException(400, "days_of_week must be a non-empty list of 0..6 (Mon..Sun)")
        for f in ("start_min", "end_min"):
            v = payload.get(f)
            if v is None or not (0 <= int(v) <= 1440):
                raise HTTPException(400, f"{f} must be 0..1440 (minutes of day, UTC)")

    if mode == "absolute" and payload.get("spread_value") is None:
        raise HTTPException(400, "spread_value required for spread_mode=absolute")
    if mode == "multiplier" and payload.get("spread_multiplier") is None:
        raise HTTPException(400, "spread_multiplier required for spread_mode=multiplier")
    cap = payload.get("leverage_cap")
    if cap is not None and int(cap) <= 0:
        raise HTTPException(400, "leverage_cap must be > 0 (or omit for no cap)")
    return payload


async def create_rule(db: AsyncSession, payload: dict, admin_id: uuid.UUID) -> dict:
    _validate(payload)
    r = PricingTimeRule(
        name=payload["name"],
        scope=(payload.get("scope") or "default").lower(),
        segment_id=payload.get("segment_id"),
        instrument_id=payload.get("instrument_id"),
        kind=(payload.get("kind") or "custom").lower(),
        session=payload.get("session"),
        days_of_week=payload.get("days_of_week"),
        start_min=payload.get("start_min"),
        end_min=payload.get("end_min"),
        spread_mode=(payload.get("spread_mode") or "multiplier").lower(),
        spread_multiplier=payload.get("spread_multiplier"),
        spread_value=payload.get("spread_value"),
        spread_type=(payload.get("spread_type") or "pips"),
        leverage_cap=payload.get("leverage_cap"),
        priority=int(payload.get("priority") or 0),
        is_enabled=bool(payload.get("is_enabled", True)),
        updated_by=admin_id,
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    names = await _name_map(db)
    return _serialize(r, names)


async def update_rule(db: AsyncSession, rule_id: uuid.UUID, payload: dict, admin_id: uuid.UUID) -> dict:
    r = (await db.execute(select(PricingTimeRule).where(PricingTimeRule.id == rule_id))).scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "Rule not found")
    merged = {**_serialize(r, {}), **payload}
    _validate(merged)
    for f in ("name", "scope", "segment_id", "instrument_id", "kind", "session",
              "days_of_week", "start_min", "end_min", "spread_mode", "spread_multiplier",
              "spread_value", "spread_type", "leverage_cap", "priority", "is_enabled"):
        if f in payload:
            setattr(r, f, payload[f])
    r.updated_by = admin_id
    await db.commit()
    await db.refresh(r)
    names = await _name_map(db)
    return _serialize(r, names)


async def delete_rule(db: AsyncSession, rule_id: uuid.UUID) -> dict:
    res = await db.execute(delete(PricingTimeRule).where(PricingTimeRule.id == rule_id))
    await db.commit()
    if (res.rowcount or 0) == 0:
        raise HTTPException(404, "Rule not found")
    return {"ok": True, "id": str(rule_id)}


# ── Dynamic-spread global settings (system_settings) ─────────────────────

async def get_dynamic(db: AsyncSession) -> dict:
    out = dict(_DYN_DEFAULTS)
    try:
        rows = (await db.execute(text(
            "SELECT key, value FROM system_settings WHERE key = ANY(:keys)"
        ), {"keys": list(_DYN_DEFAULTS.keys())})).all()
        for key, value in rows:
            raw = value if not isinstance(value, str) else value.strip('"')
            if key == "dynamic_spread_enabled":
                out[key] = str(raw).lower() in ("true", "1", "yes")
            elif key == "dynamic_spread_window_sec":
                out[key] = int(float(raw))
            else:
                out[key] = float(raw)
    except Exception:
        pass
    return out


async def set_dynamic(db: AsyncSession, payload: dict, admin_id: uuid.UUID) -> dict:
    import json
    vals: dict[str, Any] = {}
    if "dynamic_spread_enabled" in payload:
        vals["dynamic_spread_enabled"] = bool(payload["dynamic_spread_enabled"])
    if "dynamic_spread_max_mult" in payload:
        vals["dynamic_spread_max_mult"] = max(1.0, min(10.0, float(payload["dynamic_spread_max_mult"])))
    if "dynamic_spread_sensitivity" in payload:
        vals["dynamic_spread_sensitivity"] = max(0.0, min(20.0, float(payload["dynamic_spread_sensitivity"])))
    if "dynamic_spread_window_sec" in payload:
        vals["dynamic_spread_window_sec"] = max(5, min(3600, int(payload["dynamic_spread_window_sec"])))

    for key, v in vals.items():
        await db.execute(text(
            """
            INSERT INTO system_settings (key, value, updated_by, updated_at)
            VALUES (:k, CAST(:v AS jsonb), :by, now())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
            """
        ), {"k": key, "v": json.dumps(v), "by": admin_id})
    await db.commit()
    return await get_dynamic(db)
