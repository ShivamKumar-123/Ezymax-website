import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission, broker_scope_ids, assert_broker_scope
from packages.common.src.models import User
from packages.common.src.admin_schemas import FundRequest, CreditRequest
from services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    status_filter: str = Query(None, alias="status"),
    kyc_filter: str = Query(None, alias="kyc_status"),
    group_id: str = Query(None),
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    # White-label broker actors see only their own pool (None = unscoped).
    scope_ids = await broker_scope_ids(admin, db)
    return await user_service.list_users(
        page=page, per_page=per_page, search=search,
        status_filter=status_filter, kyc_filter=kyc_filter, group_id=group_id, db=db,
        user_ids=scope_ids,
    )


@router.get("/{user_id}")
async def get_user_detail(
    user_id: uuid.UUID,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.get_user_detail(user_id=user_id, db=db)


@router.post("/{user_id}/add-fund")
async def add_fund(
    user_id: uuid.UUID,
    body: FundRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.add_fund(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/deduct-fund")
async def deduct_fund(
    user_id: uuid.UUID,
    body: FundRequest,
    request: Request,
    admin: User = Depends(require_permission("users.deduct_fund")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.deduct_fund(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/give-credit")
async def give_credit(
    user_id: uuid.UUID,
    body: CreditRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.give_credit(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/take-credit")
async def take_credit(
    user_id: uuid.UUID,
    body: CreditRequest,
    request: Request,
    # Removing credit is a *debit*-shaped action — gate with the deduct
    # permission, not `users.add_fund`. Previously this endpoint was
    # reachable by anyone with `users.add_fund`, violating separation-
    # of-duty (a "credit-giver" analyst could also revoke credit).
    admin: User = Depends(require_permission("users.deduct_fund")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.take_credit(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/ban")
async def ban_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.ban")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.ban_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/unban")
async def unban_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.ban")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.unban_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/block-trading")
async def block_trading(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.block_trading")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.block_trading(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/kill-switch")
async def kill_switch(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.kill_switch")),
    db: AsyncSession = Depends(get_db),
):
    await assert_broker_scope(admin, user_id, db)
    return await user_service.kill_switch(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/login-as")
async def login_as_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.impersonate")),
    db: AsyncSession = Depends(get_db),
):
    """Issue a single-use redemption code (NOT a bare JWT) that the
    admin frontend opens at /auth/impersonate?code=X on the trader.

    Permission `users.impersonate` is a separate grant from `users.view`
    so a low-privilege analyst with "users.view" cannot impersonate a
    customer. Super-admins bypass automatically. Audit-logged on every
    successful start. The service additionally refuses to impersonate
    any staff role unless the caller is super_admin (audit H5)."""
    await assert_broker_scope(admin, user_id, db)
    return await user_service.login_as_user(
        user_id=user_id, admin_id=admin.id, admin_role=admin.role,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    # Hard-delete of a user (closes positions, wipes deposits/withdrawals,
    # destroys transaction history) is the single most destructive admin
    # operation. It must NOT be reachable via the financial "add funds"
    # permission. Restricted to super_admin only — `require_permission`
    # already lets super_admin through; for every other role we require
    # the explicit `users.delete` grant.
    admin: User = Depends(require_permission("users.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user. Closes all open positions/orders, deletes
    trading accounts, copy-trade allocations, copy trades, deposits, withdrawals,
    transactions, referrals, IB profile, and finally the user row. Cannot be
    undone."""
    await assert_broker_scope(admin, user_id, db)
    return await user_service.delete_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
