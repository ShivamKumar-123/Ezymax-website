import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from fastapi import HTTPException
from sqlalchemy import select

from dependencies import require_permission, broker_scope_ids, assert_broker_scope
from packages.common.src.models import User, Deposit, Withdrawal
from packages.common.src.admin_schemas import RejectRequest
from services import deposit_service


class MarkPaidRequest(BaseModel):
    tx_hash: str
    notes: str | None = None


class PaymentLinkRequest(BaseModel):
    payment_link: str
    message: str | None = None

router = APIRouter(prefix="/finance", tags=["Finance"])


async def _assert_deposit_scope(admin: User, deposit_id: uuid.UUID, db: AsyncSession) -> None:
    """White-label guard: a broker actor may only act on deposits raised
    by users in their own pool. Platform admins pass through."""
    if admin.role != "broker":
        return
    uid = (await db.execute(select(Deposit.user_id).where(Deposit.id == deposit_id))).scalar_one_or_none()
    if uid is None:
        raise HTTPException(status_code=404, detail="Deposit not found")
    await assert_broker_scope(admin, uid, db)


async def _assert_withdrawal_scope(admin: User, withdrawal_id: uuid.UUID, db: AsyncSession) -> None:
    if admin.role != "broker":
        return
    uid = (await db.execute(select(Withdrawal.user_id).where(Withdrawal.id == withdrawal_id))).scalar_one_or_none()
    if uid is None:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    await assert_broker_scope(admin, uid, db)



@router.get("/deposits/pending")
async def list_pending_deposits(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await deposit_service.list_pending_deposits(page=page, per_page=per_page, db=db, user_ids=scope_ids)


@router.get("/withdrawals/pending")
async def list_pending_withdrawals(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("withdrawals.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await deposit_service.list_pending_withdrawals(page=page, per_page=per_page, db=db, user_ids=scope_ids)


@router.get("/deposits")
async def list_all_deposits(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    user_id: uuid.UUID | None = Query(None),
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await deposit_service.list_all_deposits(
        page=page, per_page=per_page, status=status, user_id=user_id, db=db,
        user_ids=scope_ids,
    )


@router.get("/withdrawals")
async def list_all_withdrawals(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    user_id: uuid.UUID | None = Query(None),
    admin: User = Depends(require_permission("withdrawals.view")),
    db: AsyncSession = Depends(get_db),
):
    scope_ids = await broker_scope_ids(admin, db)
    return await deposit_service.list_all_withdrawals(
        page=page, per_page=per_page, status=status, user_id=user_id, db=db,
        user_ids=scope_ids,
    )


@router.post("/deposits/{deposit_id}/approve")
async def approve_deposit(
    deposit_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("deposits.approve")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_deposit_scope(admin, deposit_id, db)
    return await deposit_service.approve_deposit(
        deposit_id=deposit_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/deposits/{deposit_id}/payment-link")
async def set_deposit_payment_link(
    deposit_id: uuid.UUID,
    body: PaymentLinkRequest,
    request: Request,
    admin: User = Depends(require_permission("deposits.approve")),
    db: AsyncSession = Depends(get_db),
):
    """Local Banking stage-2 (manual link path): admin attaches a custom
    payment URL onto the user's request. Kept for cases where Razorpay
    isn't appropriate (admin wants to share a custom invoice link, UPI
    VPA, etc.). For the auto-Razorpay path see /deposits/{id}/approve-razorpay."""
    await _assert_deposit_scope(admin, deposit_id, db)
    return await deposit_service.set_payment_link(
        deposit_id=deposit_id,
        payment_link=body.payment_link,
        message=body.message,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
    )


class ApproveRazorpayRequest(BaseModel):
    """Admin-supplied amount overrides whatever the user typed at LB
    request time. Optional — if omitted we fall back to the user's
    requested amount, and 400 if neither is set."""
    amount: float | None = None


@router.post("/deposits/{deposit_id}/approve-razorpay")
async def approve_deposit_with_razorpay(
    deposit_id: uuid.UUID,
    request: Request,
    body: ApproveRazorpayRequest | None = None,
    admin: User = Depends(require_permission("deposits.approve")),
    db: AsyncSession = Depends(get_db),
):
    """Local Banking stage-2 (auto path): admin clicks Approve & Razorpay,
    enters the amount in the modal, server creates the Razorpay order
    for that amount and notifies the user. They tap the deposit row in
    their wallet to open the Razorpay checkout and pay; the existing
    Razorpay webhook credits the deposit on payment.captured."""
    await _assert_deposit_scope(admin, deposit_id, db)
    from decimal import Decimal
    amount = None
    if body is not None and body.amount is not None and body.amount > 0:
        amount = Decimal(str(body.amount))
    return await deposit_service.approve_with_razorpay(
        deposit_id=deposit_id,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
        amount_override=amount,
    )


@router.post("/deposits/{deposit_id}/reject")
async def reject_deposit(
    deposit_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("deposits.reject")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_deposit_scope(admin, deposit_id, db)
    return await deposit_service.reject_deposit(
        deposit_id=deposit_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(
    withdrawal_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("withdrawals.approve")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_withdrawal_scope(admin, withdrawal_id, db)
    return await deposit_service.approve_withdrawal(
        withdrawal_id=withdrawal_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(
    withdrawal_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("withdrawals.reject")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_withdrawal_scope(admin, withdrawal_id, db)
    return await deposit_service.reject_withdrawal(
        withdrawal_id=withdrawal_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/withdrawals/{withdrawal_id}/mark-paid")
async def mark_withdrawal_paid(
    withdrawal_id: uuid.UUID,
    body: MarkPaidRequest,
    request: Request,
    admin: User = Depends(require_permission("withdrawals.approve")),
    db: AsyncSession = Depends(get_db),
):
    """Record the off-platform payout admin made. Requires withdrawal to
    be in 'approved' status. Stamps the on-chain tx hash (or bank
    reference) and flips status to 'paid'."""
    await _assert_withdrawal_scope(admin, withdrawal_id, db)
    return await deposit_service.mark_withdrawal_paid(
        withdrawal_id=withdrawal_id,
        tx_hash=body.tx_hash,
        notes=body.notes,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
    )


@router.get("/deposits/{deposit_id}/screenshot")
async def download_deposit_screenshot(
    deposit_id: uuid.UUID,
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_deposit_scope(admin, deposit_id, db)
    return await deposit_service.download_deposit_screenshot(deposit_id=deposit_id, db=db)


@router.get("/withdrawals/{withdrawal_id}/payout-qr")
async def download_withdrawal_payout_qr(
    withdrawal_id: uuid.UUID,
    admin: User = Depends(require_permission("withdrawals.view")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_withdrawal_scope(admin, withdrawal_id, db)
    return await deposit_service.download_withdrawal_payout_qr(withdrawal_id=withdrawal_id, db=db)
