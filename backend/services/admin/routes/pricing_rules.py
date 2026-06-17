"""Time-windowed spread / leverage rules + dynamic-spread settings (admin).

Admin sets spread & leverage per time window (preset session or custom
UTC day/hour range); the market-data feed then lets spread fluctuate with
live market volatility on top of the configured base. Gated by config perms.
"""
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission, write_audit_log
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import pricing_rules_service

router = APIRouter(prefix="/pricing-rules", tags=["Pricing Time Rules"])


class TimeRuleIn(BaseModel):
    name: str
    scope: str = "default"
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    kind: str = "custom"
    session: Optional[str] = None
    days_of_week: Optional[list[int]] = None
    start_min: Optional[int] = None
    end_min: Optional[int] = None
    spread_mode: str = "multiplier"
    spread_multiplier: Optional[float] = None
    spread_value: Optional[float] = None
    spread_type: Optional[str] = "pips"
    leverage_cap: Optional[int] = None
    priority: int = 0
    is_enabled: bool = True


class TimeRulePatch(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    kind: Optional[str] = None
    session: Optional[str] = None
    days_of_week: Optional[list[int]] = None
    start_min: Optional[int] = None
    end_min: Optional[int] = None
    spread_mode: Optional[str] = None
    spread_multiplier: Optional[float] = None
    spread_value: Optional[float] = None
    spread_type: Optional[str] = None
    leverage_cap: Optional[int] = None
    priority: Optional[int] = None
    is_enabled: Optional[bool] = None


class DynamicSpreadIn(BaseModel):
    dynamic_spread_enabled: Optional[bool] = None
    dynamic_spread_max_mult: Optional[float] = None
    dynamic_spread_sensitivity: Optional[float] = None
    dynamic_spread_window_sec: Optional[int] = None


def _ip(request: Request) -> Optional[str]:
    return request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)


@router.get("")
async def list_rules(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await pricing_rules_service.list_rules(db)


@router.get("/sessions")
async def list_sessions(
    admin: User = Depends(require_permission("config.view")),
):
    return pricing_rules_service.sessions()


@router.get("/dynamic-spread")
async def get_dynamic(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await pricing_rules_service.get_dynamic(db)


@router.put("/dynamic-spread")
async def set_dynamic(
    body: DynamicSpreadIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    res = await pricing_rules_service.set_dynamic(db, body.model_dump(exclude_none=True), admin.id)
    await write_audit_log(db, admin_id=admin.id, action="dynamic_spread_update",
                          entity_type="system_setting", new_values=res, ip_address=_ip(request))
    await db.commit()
    return res


@router.post("")
async def create_rule(
    body: TimeRuleIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    res = await pricing_rules_service.create_rule(db, body.model_dump(), admin.id)
    await write_audit_log(db, admin_id=admin.id, action="pricing_rule_create",
                          entity_type="pricing_time_rule", entity_id=uuid.UUID(res["id"]),
                          new_values={"name": res["name"], "scope": res["scope"]}, ip_address=_ip(request))
    await db.commit()
    return res


@router.put("/{rule_id}")
async def update_rule(
    rule_id: uuid.UUID,
    body: TimeRulePatch,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    res = await pricing_rules_service.update_rule(db, rule_id, body.model_dump(exclude_none=True), admin.id)
    await write_audit_log(db, admin_id=admin.id, action="pricing_rule_update",
                          entity_type="pricing_time_rule", entity_id=rule_id, ip_address=_ip(request))
    await db.commit()
    return res


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    res = await pricing_rules_service.delete_rule(db, rule_id)
    await write_audit_log(db, admin_id=admin.id, action="pricing_rule_delete",
                          entity_type="pricing_time_rule", entity_id=rule_id, ip_address=_ip(request))
    await db.commit()
    return res
