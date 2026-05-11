"""Wallet API — Deposits, Withdrawals, Transactions."""
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
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
from ..services import wallet_service, onchain_deposit_service, onchain_withdraw_service

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


# ─── Decentralized USDT deposit flow ──────────────────────────────────────
# User picks a chain, signs a transfer in their own wallet, submits the
# tx hash. The chain_verifier_engine confirms on-chain and credits.


class OnchainDepositRequest(BaseModel):
    network: str  # eth | bsc | tron
    amount: Decimal


@router.post("/deposit/onchain", status_code=201)
async def create_onchain_deposit(
    req: OnchainDepositRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Open a wallet-connect deposit. Returns the admin deposit address
    for the picked chain plus everything the trader UI needs to invoke
    MetaMask / TronLink: token contract, chain id, base-units amount,
    expiry. The user's wallet does the actual transfer."""
    return await onchain_deposit_service.create_onchain_deposit(
        user_id=current_user["user_id"],
        network=req.network,
        amount=req.amount,
        db=db,
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.create_withdrawal(
        req=req, user_id=current_user["user_id"], db=db,
    )


# ─── Decentralized USDT withdraw flow (mirror of /deposit/onchain) ─────────


class OnchainWithdrawRequest(BaseModel):
    network: str            # eth | bsc | tron
    amount: Decimal
    destination_address: str  # user's own wallet on the picked chain


@router.post("/withdraw/onchain", status_code=201)
async def create_onchain_withdrawal(
    req: OnchainWithdrawRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """User initiates a wallet-connect withdrawal: pick chain + paste their
    own destination address. We freeze the user's main wallet balance,
    queue the row for admin review. Admin signs the on-chain payout and
    pastes the tx hash; the chain_verifier_engine confirms and flips the
    row to 'paid'."""
    return await onchain_withdraw_service.create_onchain_withdrawal(
        user_id=current_user["user_id"],
        network=req.network,
        amount=req.amount,
        destination_address=req.destination_address,
        db=db,
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


