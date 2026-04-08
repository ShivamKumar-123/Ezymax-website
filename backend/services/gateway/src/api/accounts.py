"""Trading Accounts API."""
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    AccountSummary,
    MessageResponse,
    OpenLiveAccountRequest,
    TradingAccountResponse,
)
from packages.common.src.auth import get_current_user
from ..services import account_service

router = APIRouter()


@router.get("/available-groups")
async def list_openable_account_groups(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Live account types the broker exposes (admin-managed AccountGroup rows)."""
    _ = current_user
    return await account_service.list_openable_account_groups(db=db)


@router.post("/open", status_code=status.HTTP_201_CREATED)
async def open_live_account(
    req: OpenLiveAccountRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a live trading account from an admin-defined type. Optional internal funding from existing live balances."""
    return await account_service.open_live_account(
        user_id=current_user["user_id"], req=req, db=db,
    )


@router.get("")
async def list_accounts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await account_service.list_accounts(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/{account_id}", response_model=TradingAccountResponse)
async def get_account(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await account_service.get_account(
        account_id=account_id, user_id=current_user["user_id"], db=db,
    )


@router.get("/{account_id}/summary", response_model=AccountSummary)
async def get_account_summary(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await account_service.get_account_summary(
        account_id=account_id, user_id=current_user["user_id"], db=db,
    )


@router.delete("/{account_id}", response_model=MessageResponse)
async def delete_trading_account(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently remove a live trading account owned by the user (demo accounts are not removable)."""
    return await account_service.delete_trading_account(
        account_id=account_id, user_id=current_user["user_id"], db=db,
    )
