import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from fastapi import HTTPException
from sqlalchemy import select

from dependencies import require_permission, broker_scope_ids, assert_broker_scope
from packages.common.src.models import Position, TradingAccount, TradeHistory, Employee
from packages.common.src.models import User
from packages.common.src.admin_schemas import ModifyPositionRequest, ClosePositionRequest, CreateTradeRequest, BulkCreateTradeRequest, ModifyHistoryRequest
from services import trade_service

router = APIRouter(prefix="/trades", tags=["Trades"])


async def _assert_position_scope(admin: User, position_id: uuid.UUID, db: AsyncSession) -> None:
    """White-label guard: broker actors may only touch positions owned by
    users in their own pool. Platform admins pass through."""
    if admin.role != "broker":
        return
    uid = (
        await db.execute(
            select(TradingAccount.user_id)
            .join(Position, Position.account_id == TradingAccount.id)
            .where(Position.id == position_id)
        )
    ).scalar_one_or_none()
    if uid is None:
        raise HTTPException(status_code=404, detail="Position not found")
    await assert_broker_scope(admin, uid, db)


async def _assert_history_scope(admin: User, history_id: uuid.UUID, db: AsyncSession) -> None:
    """H-ADMIN-3: broker actors may only edit closed trades of users in their
    own pool. Platform admins pass through."""
    if admin.role != "broker":
        return
    uid = (
        await db.execute(
            select(TradingAccount.user_id)
            .join(TradeHistory, TradeHistory.account_id == TradingAccount.id)
            .where(TradeHistory.id == history_id)
        )
    ).scalar_one_or_none()
    if uid is None:
        raise HTTPException(status_code=404, detail="Trade history record not found")
    await assert_broker_scope(admin, uid, db)


async def _assert_modify_history_role(admin: User, db: AsyncSession) -> None:
    """H-ADMIN-3 (DECISION): editing a closed trade's P&L rewrites realised
    balances, so restrict it to super_admin and risk_manager."""
    if admin.role == "super_admin":
        return
    emp = (await db.execute(
        select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    if emp is not None and emp.role == "risk_manager":
        return
    raise HTTPException(status_code=403, detail="Only super_admin or risk_manager may edit closed trades.")



@router.get("/positions")
async def list_positions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: str = Query("open", alias="status"),
    # Optional per-user filter for the user-detail ledger page.
    # When omitted, the existing global list is returned.
    user_id: uuid.UUID | None = Query(None),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await trade_service.list_positions(
        page=page, per_page=per_page, status_filter=status_filter,
        user_id=user_id, db=db, user_ids=scope_ids,
    )


@router.get("/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: str = Query("pending", alias="status"),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await trade_service.list_orders(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
        user_ids=scope_ids,
    )


@router.get("/history")
async def list_trade_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user_id: uuid.UUID | None = Query(None),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await trade_service.list_trade_history(
        page=page, per_page=per_page, user_id=user_id, db=db,
        user_ids=scope_ids,
    )


@router.put("/position/{position_id}/modify")
async def modify_position(
    position_id: uuid.UUID,
    body: ModifyPositionRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.modify")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_position_scope(admin, position_id, db)
    return await trade_service.modify_position(
        position_id=position_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/position/{position_id}/close")
async def close_position(
    position_id: uuid.UUID,
    body: ClosePositionRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.close")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_position_scope(admin, position_id, db)
    return await trade_service.close_position(
        position_id=position_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/history/{history_id}/modify")
async def modify_trade_history(
    history_id: uuid.UUID,
    body: ModifyHistoryRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.modify")),
    db: AsyncSession = Depends(get_db),
):
    """Edit a closed trade. Any P&L change is reconciled to the account balance
    as a delta and recorded as an adjustment Transaction (H-ADMIN-3)."""
    await _assert_modify_history_role(admin, db)
    await _assert_history_scope(admin, history_id, db)
    return await trade_service.modify_trade_history(
        history_id=history_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/instruments")
async def list_instruments(
    search: str = Query(None),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_instruments(search=search, db=db)


@router.post("/create")
async def create_stealth_trade(
    body: CreateTradeRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.create")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.create_stealth_trade(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/create-bulk")
async def create_stealth_trade_bulk(
    body: BulkCreateTradeRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.create")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.create_stealth_trade_bulk(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
