"""Wallet API — Deposits, Withdrawals, Transactions."""
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.rate_limit import rate_limit_http
from packages.common.src.schemas import (
    DepositRequest,
    InternalWalletTransferRequest,
    OnchainDepositRequest,
    OnchainWithdrawRequest,
    RazorpayOrderRequest,
    RazorpayVerifyRequest,
    TransferMainToTradingRequest,
    TransferTradingToMainRequest,
    TxHashSaveRequest,
    WithdrawalRequest,
)
from packages.common.src.auth import get_current_user, require_full_session
from ..services import wallet_service, onchain_deposit_service, onchain_withdraw_service

router = APIRouter()


@router.post("/deposit/bank-details")
async def fetch_deposit_bank_details(
    body: dict | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the admin-configured deposit destinations for the user:
      - bank_name / account_holder / account_number / ifsc_code / upi_id
        / qr_code_url from the bank_accounts table (admin manages via
        /admin/banks)
      - crypto_wallets: [] from admin_deposit_wallets (admin manages via
        /admin/settings/deposit-wallets)

    Body can optionally include `amount` to trigger per-tier bank rotation.
    Both data sources are surfaced together so the trader's Crypto chip
    always shows whatever payment destinations the admin has configured.
    """
    amount = None
    if isinstance(body, dict):
        raw = body.get("amount")
        try:
            if raw is not None:
                amount = Decimal(str(raw))
        except Exception:
            amount = None
    return await wallet_service.get_deposit_bank_details(amount=amount, db=db)


@router.post("/deposit", status_code=201)
async def create_deposit(
    req: DepositRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Tight cap on money-creating endpoints — 20/min per IP is well
    # above any human pace but blocks scripted abuse / fraud attempts.
    rate_limit_http(request, "wallet-deposit", 20, 60.0)
    return await wallet_service.create_deposit(
        req=req, user_id=current_user["user_id"], db=db,
    )


# ─── Manual bank / UPI deposit (multipart with proof file) ──────────────────


@router.post("/deposit/manual", status_code=201)
async def create_manual_deposit(
    request: Request,
    amount: Decimal = Form(...),
    transaction_id: str = Form(...),
    file: UploadFile = File(...),
    account_id: UUID | None = Form(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manual bank / UPI deposit: user uploads payment proof; goes to admin
    queue for review. Body is multipart/form-data (not JSON) because of the
    file upload."""
    rate_limit_http(request, "wallet-deposit-manual", 10, 60.0)
    return await wallet_service.create_manual_deposit(
        user_id=current_user["user_id"],
        account_id=account_id,
        amount=amount,
        transaction_id=transaction_id,
        file=file,
        db=db,
    )


@router.post("/withdraw/manual", status_code=201)
async def create_manual_withdrawal(
    request: Request,
    amount: Decimal = Form(...),
    upi_id: str = Form(""),
    payout_notes: str = Form(""),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(require_full_session),
    db: AsyncSession = Depends(get_db),
):
    """Manual UPI / QR-payout withdrawal: user submits UPI ID and/or a QR
    image; goes to admin queue for manual payout. Multipart body.
    403s with KYC_REQUIRED unless the user's KYC is approved."""
    rate_limit_http(request, "wallet-withdraw-manual", 10, 60.0)
    return await wallet_service.create_manual_withdrawal(
        user_id=current_user["user_id"],
        amount=amount,
        upi_id=upi_id,
        payout_notes=payout_notes,
        file=file,
        db=db,
    )


# ─── Local Banking request (admin-mediated) ───────────────────────────────


@router.post("/deposit/local-banking", status_code=201)
async def create_local_banking_request(
    request: Request,
    amount: Decimal = Form(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stage 1 of the local banking flow — user submits a request, admin
    shares a payment link out of band (or attaches it via the admin
    panel). No KYC gate: deposits are open to everyone; identity is
    verified at withdrawal time instead."""
    rate_limit_http(request, "wallet-deposit-lb", 20, 60.0)
    return await wallet_service.create_local_banking_request(
        amount=amount,
        user_id=current_user["user_id"],
        db=db,
    )


@router.post("/deposit/local-banking/{deposit_id}/confirm-payment", status_code=200)
async def confirm_local_banking_payment(
    deposit_id: UUID,
    amount: Decimal = Form(...),
    transaction_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stage 3 of the local banking flow — user has paid via the admin's
    link and is uploading proof + the actual amount they paid. The Deposit
    row's amount / transaction_id / screenshot_url are populated; status
    stays pending so the admin can verify and approve."""
    return await wallet_service.confirm_local_banking_payment(
        deposit_id=deposit_id,
        user_id=current_user["user_id"],
        amount=amount,
        transaction_id=transaction_id,
        file=file,
        db=db,
    )


# ─── Razorpay deposits (Checkout popup, charged in INR) ───────────────────


@router.get("/deposit/razorpay/rate")
async def get_razorpay_rate(
    current_user: dict = Depends(get_current_user),
):
    """Live USD→INR rate the next Razorpay charge will use, so the trader UI
    can preview an accurate rupee amount before opening the Checkout popup."""
    from ..services import razorpay_service

    rate = await razorpay_service.get_usd_to_inr_rate()
    return {"rate": float(rate), "currency": "INR"}


@router.post("/deposit/{deposit_id}/razorpay-order", status_code=201)
async def create_razorpay_order_on_lb_deposit(
    deposit_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Razorpay order against an approved Local Banking deposit.
    Body: { "amount": number }. Used by the trader's "Pay with Razorpay"
    button after admin has approved the LB request — admin doesn't pick
    an amount, the user picks it here at pay time."""
    raw = body.get("amount") if isinstance(body, dict) else None
    try:
        amount = Decimal(str(raw)) if raw is not None else Decimal("0")
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid amount")
    return await wallet_service.create_razorpay_order_on_lb_deposit(
        deposit_id=deposit_id,
        amount=amount,
        user_id=current_user["user_id"],
        db=db,
    )


@router.get("/deposit/razorpay/{order_id}/meta")
async def get_razorpay_order_meta(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the publishable key + locked amount for a Razorpay order that
    was created server-side (e.g. by admin's Approve & Razorpay button).
    The trader UI calls this before opening the Razorpay Checkout popup."""
    from sqlalchemy import select
    from packages.common.src.models import Deposit
    from ..services import razorpay_service

    if not razorpay_service.razorpay_configured():
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Razorpay is not configured")

    q = await db.execute(
        select(Deposit).where(
            Deposit.transaction_id == order_id,
            Deposit.user_id == current_user["user_id"],
        )
    )
    deposit = q.scalar_one_or_none()
    if not deposit:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Order not found on your account")

    from packages.common.src.config import get_settings
    rate = await razorpay_service.get_usd_to_inr_rate()
    amount_paise = razorpay_service.usd_to_inr_paise(deposit.amount, rate)
    return {
        "key_id": get_settings().RAZORPAY_KEY_ID,
        "amount_paise": amount_paise,
        "amount_inr": float(amount_paise) / 100,
        "currency": "INR",
    }


@router.post("/deposit/razorpay/order", status_code=201)
async def create_razorpay_order(
    req: RazorpayOrderRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a pending Deposit + a Razorpay order. The user enters a USD
    amount; the order is charged in INR (USD_TO_INR_RATE). Returns the
    fields the frontend Razorpay Checkout popup needs. Balance is credited
    only on /deposit/razorpay/verify or the payment.captured webhook.

    Honours the `Idempotency-Key` header — a network-blip retry of the same
    key returns the same order instead of creating a second Razorpay order."""
    from packages.common.src.idempotency import get_cached_response, store_response

    cached = await get_cached_response(
        request, scope="deposit_razorpay_order",
        user_id=current_user["user_id"], db=db,
    )
    if cached is not None:
        return cached

    result = await wallet_service.create_razorpay_deposit(
        amount=req.amount,
        account_target=req.account_target,
        user_id=current_user["user_id"],
        db=db,
    )
    await store_response(
        request, scope="deposit_razorpay_order",
        user_id=current_user["user_id"], response_json=result,
        status_code=201, db=db,
    )
    return result


@router.post("/deposit/razorpay/verify")
async def verify_razorpay_deposit(
    req: RazorpayVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify the Razorpay Checkout signature and idempotently credit the
    deposit. Safe to race with the webhook — whichever lands first credits
    once, the other is a no-op."""
    return await wallet_service.verify_and_credit_razorpay(
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        razorpay_signature=req.razorpay_signature,
        user_id=current_user["user_id"],
        db=db,
    )


# ─── Decentralized USDT deposit flow ──────────────────────────────────────
# User picks a chain, signs a transfer in their own wallet, submits the
# tx hash. The chain_verifier_engine confirms on-chain and credits.


@router.post("/deposit/onchain", status_code=201)
async def create_onchain_deposit(
    req: OnchainDepositRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Open a wallet-connect deposit. Returns the admin deposit address
    for the picked chain plus everything the trader UI needs to invoke
    MetaMask / TronLink: token contract, chain id, base-units amount,
    expiry. The user's wallet does the actual transfer."""
    rate_limit_http(request, "wallet-deposit-onchain", 20, 60.0)
    return await onchain_deposit_service.create_onchain_deposit(
        user_id=current_user["user_id"],
        network=req.network,
        amount=req.amount,
        db=db,
        target=req.target,
    )


@router.post("/deposit/{deposit_id}/confirm-tx", status_code=202)
async def confirm_onchain_tx(
    deposit_id: UUID,
    req: TxHashSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record the on-chain tx hash for a wallet-connect deposit. The
    chain_verifier_engine will pick it up on its next tick and credit
    the user's main wallet once the transfer has enough confirmations."""
    return await onchain_deposit_service.confirm_tx_hash(
        deposit_id=deposit_id, tx_hash=req.tx_hash,
        user_id=current_user["user_id"], db=db,
    )


@router.get("/deposit/{deposit_id}/onchain-status")
async def get_onchain_deposit_status(
    deposit_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Polling endpoint the trader UI uses to tail the deposit's status
    from 'initiated' → 'submitted' → 'auto_approved' / 'rejected'."""
    return await onchain_deposit_service.get_status(
        deposit_id=deposit_id, user_id=current_user["user_id"], db=db,
    )


@router.post("/withdraw", status_code=201)
async def create_withdrawal(
    req: WithdrawalRequest,
    request: Request,
    current_user: dict = Depends(require_full_session),
    db: AsyncSession = Depends(get_db),
):
    # 10/min cap on withdrawals — even legitimate users don't withdraw
    # more than a couple of times an hour; tight cap blocks credential-
    # stuffing-then-drain attacks.
    rate_limit_http(request, "wallet-withdraw", 10, 60.0)
    return await wallet_service.create_withdrawal(
        req=req, user_id=current_user["user_id"], db=db,
    )


# ─── Decentralized USDT withdraw flow (mirror of /deposit/onchain) ─────────


@router.post("/withdraw/onchain", status_code=201)
async def create_onchain_withdrawal(
    req: OnchainWithdrawRequest,
    request: Request,
    current_user: dict = Depends(require_full_session),
    db: AsyncSession = Depends(get_db),
):
    """User initiates a wallet-connect withdrawal: pick chain + paste their
    own destination address. We freeze the user's main wallet balance,
    queue the row for admin review. Admin signs the on-chain payout and
    pastes the tx hash; the chain_verifier_engine confirms and flips the
    row to 'paid'."""
    rate_limit_http(request, "wallet-withdraw-onchain", 10, 60.0)
    return await onchain_withdraw_service.create_onchain_withdrawal(
        user_id=current_user["user_id"],
        network=req.network,
        amount=req.amount,
        destination_address=req.destination_address,
        db=db,
        source=req.source,
    )


@router.get("/withdraw/{withdrawal_id}/onchain-status")
async def get_onchain_withdrawal_status(
    withdrawal_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Polling endpoint for the trader UI: pending → approved → sent → paid
    (or rejected with reason)."""
    return await onchain_withdraw_service.get_status(
        withdrawal_id=withdrawal_id, user_id=current_user["user_id"], db=db,
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


