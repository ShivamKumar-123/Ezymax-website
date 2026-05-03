"""Wallet API — Deposits, Withdrawals, Transactions."""
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    DepositRequest,
    InternalWalletTransferRequest,
    TransferMainToTradingRequest,
    TransferTradingToMainRequest,
    WithdrawalRequest,
)
from packages.common.src.auth import get_current_user
from ..services import wallet_service

router = APIRouter()


@router.post("/deposit", status_code=201)
async def create_deposit(
    req: DepositRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.create_deposit(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/deposit/manual", status_code=201)
async def create_manual_deposit(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    account_id: Optional[UUID] = Form(default=None),
    amount: Decimal = Form(...),
    transaction_id: str = Form(...),
    file: UploadFile = File(...),
):
    """Bank / UPI manual deposit: user pays admin bank (see bank-details), uploads proof + reference."""
    return await wallet_service.create_manual_deposit(
        user_id=current_user["user_id"],
        account_id=account_id, amount=amount,
        transaction_id=transaction_id, file=file, db=db,
    )


# ─── On-site wallet-connect deposits (NOWPayments /v1/payment) ────────────


class WalletDepositRequest(BaseModel):
    amount: Decimal
    crypto_currency: str  # frontend asset id, e.g. "USDT_ERC", "ETH"


class TxHashSaveRequest(BaseModel):
    tx_hash: str


@router.post("/deposit/wallet", status_code=201)
async def create_wallet_deposit(
    req: WalletDepositRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a NOWPayments direct payment (no hosted-page redirect).

    Returns the deposit row id + the pay_address / pay_amount / network /
    expires_at the frontend needs to drive the on-site wallet-connect UI.
    Settlement still happens via the same IPN webhook + handle_nowpayments_webhook
    path — balance is never credited from this endpoint.

    Honours the `Idempotency-Key` header — a network-blip retry of the
    same key returns the same response without creating a second
    NOWPayments invoice."""
    from packages.common.src.idempotency import get_cached_response, store_response

    cached = await get_cached_response(
        request, scope="deposit_wallet_create",
        user_id=current_user["user_id"], db=db,
    )
    if cached is not None:
        return cached

    result = await wallet_service.create_wallet_deposit(
        amount=req.amount,
        crypto_currency=req.crypto_currency,
        user_id=current_user["user_id"],
        db=db,
    )
    await store_response(
        request, scope="deposit_wallet_create",
        user_id=current_user["user_id"], response_json=result,
        status_code=201, db=db,
    )
    return result


@router.get("/deposit/{deposit_id}/status")
async def get_wallet_deposit_status(
    deposit_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read-only status check for the wallet-connect UI's polling loop.
    Combines local deposit status + a fresh NOWPayments status fetch so the
    UI can show "waiting → confirming → finished" without waiting for the
    IPN."""
    return await wallet_service.get_wallet_deposit_status(
        deposit_id=deposit_id, user_id=current_user["user_id"], db=db,
    )


@router.post("/deposit/{deposit_id}/tx-hash")
async def save_wallet_deposit_tx_hash(
    deposit_id: UUID,
    req: TxHashSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record the on-chain tx hash the user's wallet returned. Purely
    informational — settlement still gates on the NOWPayments IPN, never
    on a client-supplied hash."""
    return await wallet_service.save_wallet_deposit_tx_hash(
        deposit_id=deposit_id, tx_hash=req.tx_hash,
        user_id=current_user["user_id"], db=db,
    )


@router.post("/withdraw", status_code=201)
async def create_withdrawal(
    req: WithdrawalRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.create_withdrawal(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/withdraw/manual", status_code=201)
async def create_manual_withdrawal(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    amount: Decimal = Form(...),
    upi_id: str = Form(default=""),
    payout_notes: str = Form(default=""),
    file: UploadFile | None = File(default=None),
):
    """Manual payout: user provides UPI ID and/or a QR image for finance to pay out (main wallet)."""
    return await wallet_service.create_manual_withdrawal(
        user_id=current_user["user_id"],
        amount=amount, upi_id=upi_id, payout_notes=payout_notes,
        file=file, db=db,
    )


@router.post("/transfer-internal", status_code=200)
async def internal_wallet_transfer(
    req: InternalWalletTransferRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move funds between the user's own live trading accounts (available balance only)."""
    return await wallet_service.internal_wallet_transfer(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/transfer-trading-to-main", status_code=200)
async def transfer_trading_to_main(
    req: TransferTradingToMainRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move available balance from a live trading account into the user's main wallet."""
    return await wallet_service.transfer_trading_to_main(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/transfer-main-to-trading", status_code=200)
async def transfer_main_to_trading(
    req: TransferMainToTradingRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fund a live trading account from the main wallet."""
    return await wallet_service.transfer_main_to_trading(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.get("/deposits")
async def list_deposits(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.list_deposits(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/withdrawals")
async def list_withdrawals(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.list_withdrawals(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/transactions")
async def list_transactions(
    account_id: UUID | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.list_transactions(
        user_id=current_user["user_id"], account_id=account_id, db=db,
    )


@router.get("/summary")
async def wallet_summary(
    account_id: UUID | None = Query(
        None,
        description="Scope trading balance/equity to one live account. Main wallet + deposit/withdraw totals are always user-wide.",
    ),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Main wallet holds funds for external deposit/withdraw; live trading accounts hold trading balance."""
    return await wallet_service.wallet_summary(
        user_id=current_user["user_id"], account_id=account_id, db=db,
    )


class DepositBankDetailsRequest(BaseModel):
    """Optional amount picks a bank account tier (min/max)."""

    amount: Decimal | None = None


@router.post("/deposit/bank-details")
async def get_deposit_bank_details(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    body: DepositBankDetailsRequest | None = Body(default=None),
):
    """Return an active bank account for manual deposits (details + QR URL from admin)."""
    return await wallet_service.get_deposit_bank_details(
        amount=body.amount if body else None, db=db,
    )


@router.get("/bank-info")
async def get_bank_info(
    amount: Decimal = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.get_bank_info(amount=amount, db=db)
