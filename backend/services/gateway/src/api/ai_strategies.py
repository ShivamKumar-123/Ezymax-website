"""AI Strategy Builder API — create/backtest/deploy AI-assisted strategies.

The strategy definition is a validated JSON DSL, never code; live execution
runs through the canonical trading_service paths (see
engines/ai_strategy_engine.py). AI-generated trades are tagged so the UI can
display them separately from manual trading.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db
from packages.common.src.rate_limit import rate_limit_http
from ..services import ai_strategy_service as svc

router = APIRouter()


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    # Refinement support (tradezini-style chat maker): the running
    # conversation plus the config being refined. Both optional — a bare
    # prompt is a fresh generation.
    previous_dsl: Optional[dict] = None
    history: Optional[list[ChatTurn]] = Field(default=None, max_length=40)


class CreateStrategyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    prompt: Optional[str] = Field(default=None, max_length=4000)
    explanation: Optional[str] = Field(default=None, max_length=8000)
    dsl: dict


class UpdateStrategyRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    dsl: Optional[dict] = None


class BacktestRequest(BaseModel):
    days: int = Field(default=90, ge=7, le=365)
    commission_per_lot: float = Field(default=0.0, ge=0, le=1000)


class DeployRequest(BaseModel):
    account_id: UUID


@router.post("/generate")
async def generate(
    body: GenerateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # LLM calls are the expensive path — keep the bucket tight.
    rate_limit_http(request, "ai-strategy-generate", 15, 60.0)
    return await svc.generate_from_prompt(
        body.prompt, db,
        previous_dsl=body.previous_dsl,
        history=[t.model_dump() for t in body.history] if body.history else None,
    )


@router.post("/", status_code=201)
async def create_strategy(
    body: CreateStrategyRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_http(request, "ai-strategy-write", 30, 60.0)
    return await svc.create_strategy(
        current_user["user_id"], body.name, body.dsl,
        body.description, body.prompt, db,
        explanation=body.explanation,
    )


@router.get("/")
async def list_strategies(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.list_strategies(current_user["user_id"], db)


@router.get("/instances")
async def list_instances(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.list_instances(current_user["user_id"], db)


@router.get("/position-ids")
async def ai_position_ids(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.list_ai_position_ids(current_user["user_id"], db)


@router.get("/trades")
async def ai_trades(
    status: str = "open",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.list_ai_trades(current_user["user_id"], status, db)


@router.post("/instances/{instance_id}/stop")
async def stop_instance(
    instance_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.stop_instance(instance_id, current_user["user_id"], db)


@router.get("/{strategy_id}")
async def get_strategy(
    strategy_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_strategy(strategy_id, current_user["user_id"], db)


@router.put("/{strategy_id}")
async def update_strategy(
    strategy_id: UUID,
    body: UpdateStrategyRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_http(request, "ai-strategy-write", 30, 60.0)
    return await svc.update_strategy(
        strategy_id, current_user["user_id"], db,
        name=body.name, description=body.description, dsl_raw=body.dsl,
    )


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.delete_strategy(strategy_id, current_user["user_id"], db)


@router.post("/{strategy_id}/backtest")
async def backtest(
    strategy_id: UUID,
    body: BacktestRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # CPU-bound-ish (pure-python indicator math over ≤25k bars) — cap the rate.
    rate_limit_http(request, "ai-strategy-backtest", 12, 60.0)
    return await svc.backtest_strategy(
        strategy_id, current_user["user_id"], db,
        days=body.days, commission_per_lot=body.commission_per_lot,
    )


@router.post("/{strategy_id}/deploy")
async def deploy(
    strategy_id: UUID,
    body: DeployRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_http(request, "ai-strategy-deploy", 20, 60.0)
    return await svc.deploy_strategy(
        strategy_id, current_user["user_id"], body.account_id, db,
    )
