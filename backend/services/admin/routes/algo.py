"""Admin Algo Trading routes — signal management, master toggles, settings."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from packages.common.src.database import get_db
from packages.common.src.models import User
from dependencies import require_permission
from services.algo_service import (
    list_signals, execute_signal, reject_signal,
    list_algo_masters, toggle_algo_master,
    get_algo_settings, regenerate_webhook_secret, get_signal_stats,
    toggle_auto_execute,
)

router = APIRouter(prefix="/algo", tags=["Algo Trading"])


@router.get("/stats")
async def algo_stats(
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_signal_stats(db)


@router.get("/signals")
async def signals_list(
    status: Optional[str] = None,
    limit: int = 50,
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return {"items": await list_signals(db, status=status, limit=limit)}


class ExecuteRequest(BaseModel):
    signal_id: str


@router.post("/signals/execute")
async def signal_execute(
    body: ExecuteRequest,
    admin: User = Depends(require_permission("trades.manage")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await execute_signal(body.signal_id, str(admin.id), db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class RejectRequest(BaseModel):
    signal_id: str
    reason: str = ""


@router.post("/signals/reject")
async def signal_reject(
    body: RejectRequest,
    admin: User = Depends(require_permission("trades.manage")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await reject_signal(body.signal_id, str(admin.id), body.reason, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Masters ──

@router.get("/masters")
async def masters_list(
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return {"items": await list_algo_masters(db)}


class ToggleMasterRequest(BaseModel):
    master_id: str
    enabled: bool
    multiplier: Optional[float] = None


@router.post("/masters/toggle")
async def master_toggle(
    body: ToggleMasterRequest,
    admin: User = Depends(require_permission("trades.manage")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await toggle_algo_master(body.master_id, body.enabled, body.multiplier, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Settings ──

@router.get("/settings")
async def algo_settings(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_algo_settings(db)


@router.post("/settings/regenerate-secret")
async def regen_secret(
    admin: User = Depends(require_permission("config.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await regenerate_webhook_secret(str(admin.id), db)


class AutoExecuteRequest(BaseModel):
    enabled: bool


@router.post("/settings/auto-execute")
async def set_auto_execute(
    body: AutoExecuteRequest,
    admin: User = Depends(require_permission("config.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await toggle_auto_execute(body.enabled, str(admin.id), db)
