import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import (
    MLMConfigIn, UpdateIBCommissionIn, RejectIBIn, IBCommissionPlanIn,
)
from services import business_service

router = APIRouter(prefix="/business", tags=["Business"])


@router.get("/ib/applications")
async def list_ib_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_ib_applications(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.post("/ib/applications/{app_id}/approve")
async def approve_ib_application(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.approve_ib_application(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/ib/applications/{app_id}/reject")
async def reject_ib_application(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_ib_application(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/ib/agents")
async def list_ib_agents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_ib_agents(page=page, per_page=per_page, db=db)


@router.put("/ib/agents/{agent_id}/commission")
async def update_ib_commission(
    agent_id: uuid.UUID,
    body: UpdateIBCommissionIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_ib_commission(
        agent_id=agent_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/ib/agents/{agent_id}/reject")
async def reject_active_ib(
    agent_id: uuid.UUID,
    body: RejectIBIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_active_ib(
        agent_id=agent_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/ib/commission-plans")
async def list_commission_plans(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_commission_plans(db=db)


@router.post("/ib/commission-plans")
async def create_commission_plan(
    body: IBCommissionPlanIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.create_commission_plan(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/ib/commission-plans/{plan_id}")
async def update_commission_plan(
    plan_id: uuid.UUID,
    body: IBCommissionPlanIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_commission_plan(
        plan_id=plan_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/ib/commission-plans/{plan_id}")
async def delete_commission_plan(
    plan_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.delete_commission_plan(
        plan_id=plan_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/mlm/config")
async def get_mlm_config(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_mlm_config(db=db)


@router.put("/mlm/config")
async def update_mlm_config(
    body: MLMConfigIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_mlm_config(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/sub-broker/applications")
async def list_sub_broker_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_sub_broker_applications(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.post("/sub-broker/applications/{app_id}/approve")
async def approve_sub_broker(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.approve_sub_broker(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/sub-broker/applications/{app_id}/reject")
async def reject_sub_broker(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_sub_broker(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/sub-broker/agents")
async def list_sub_brokers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_sub_brokers(page=page, per_page=per_page, db=db)
