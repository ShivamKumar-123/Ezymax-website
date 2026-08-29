import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import transaction_service

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("")
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type_filter: str = Query(None, alias="type"),
    search: str = Query(None),
    user_id: uuid.UUID | None = Query(None),
    include_trade_pnl: bool = Query(False),
    account_id: uuid.UUID | None = Query(None),
    main_only: bool = Query(False),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.list_transactions(
        page=page, per_page=per_page, type_filter=type_filter, search=search,
        user_id=user_id, include_trade_pnl=include_trade_pnl,
        account_id=account_id, main_only=main_only,
        date_from=date_from, date_to=date_to, db=db,
    )


@router.get("/summary")
async def transaction_summary(
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.get_transaction_summary(db=db)
