"""Deposit / withdrawal / transfer + bank-account Pydantic schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

# A12: one definition of a valid money amount for every wallet request.
# Decimal only, finite, strictly positive, capped, and at most 8 decimals
# (the ledger columns are NUMERIC(18, 8)).
MAX_MONEY_AMOUNT = Decimal("10000000")
MONEY_DECIMAL_PLACES = 8


def MoneyAmount(**extra):  # noqa: N802 - reads like a type at the call site
    return Field(
        gt=0,
        le=MAX_MONEY_AMOUNT,
        allow_inf_nan=False,
        decimal_places=MONEY_DECIMAL_PLACES,
        **extra,
    )


def validate_money_amount(value, *, allow_zero: bool = False) -> Decimal:
    """Same rules as :func:`MoneyAmount` for multipart/Form and ad-hoc dict
    bodies. Raises ValueError with a user-safe message."""
    try:
        amt = value if isinstance(value, Decimal) else Decimal(str(value).strip())
    except Exception:
        raise ValueError("Invalid amount")
    if not amt.is_finite():
        raise ValueError("Invalid amount")
    if amt < 0 or (amt == 0 and not allow_zero):
        raise ValueError("Amount must be greater than zero")
    if amt > MAX_MONEY_AMOUNT:
        raise ValueError(f"Amount must not exceed {MAX_MONEY_AMOUNT}")
    exp = amt.normalize().as_tuple().exponent
    if isinstance(exp, int) and exp < -MONEY_DECIMAL_PLACES:
        raise ValueError(f"Amount may have at most {MONEY_DECIMAL_PLACES} decimal places")
    return amt


class DepositRequest(BaseModel):
    """account_id is optional — approved deposits credit main_wallet_balance regardless."""
    account_id: Optional[UUID] = None
    amount: Decimal = MoneyAmount()
    method: str
    transaction_id: Optional[str] = None
    screenshot_url: Optional[str] = None
    crypto_tx_hash: Optional[str] = None
    crypto_address: Optional[str] = None
    crypto_currency: Optional[str] = None  # BTC | ETH | USDT_TRC — used for OxaPay payment creation


class WithdrawalRequest(BaseModel):
    """Withdraw to external payout (OxaPay, etc.).

    `source` picks where the funds come FROM when the user has both a
    legacy main_wallet_balance AND a wallet-bound trading account:
      - "wallet" → wallet-bound trading account (recommended for users
        who've migrated)
      - "main"   → legacy main_wallet_balance
      - None / unset → server resolver picks (wallet-bound if present,
        else main wallet)
    """

    amount: Decimal = MoneyAmount()
    method: str
    bank_details: Optional[dict] = None
    crypto_address: Optional[str] = None
    source: Optional[str] = None
    # D3 withdrawal step-up (see OnchainWithdrawRequest).
    step_up_challenge_id: Optional[str] = None


class TransferTradingToMainRequest(BaseModel):
    """Move available cash from a live trading account into the user main wallet."""

    from_account_id: UUID
    amount: Decimal = MoneyAmount()


class TransferMainToTradingRequest(BaseModel):
    """Fund a live trading account from the main wallet."""

    to_account_id: UUID
    amount: Decimal = MoneyAmount()


class InternalWalletTransferRequest(BaseModel):
    """Move available balance from one live trading account to another (same user)."""

    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal = MoneyAmount()


class DepositResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    method: str
    status: str
    transaction_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WithdrawalResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    method: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class BankAccountCreate(BaseModel):
    account_name: str
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    qr_code_url: Optional[str] = None
    tier: int = 1
    min_amount: Decimal = Decimal("0")
    max_amount: Decimal = Decimal("999999999")


# ─── Razorpay deposit flow (cards / UPI / netbanking, charged in INR) ──────


class RazorpayOrderRequest(BaseModel):
    """Create a Razorpay order. The user enters a USD amount; the backend
    converts USD→INR at USD_TO_INR_RATE and charges INR via Checkout.

    `account_target` ("wallet" | "main" | None) chooses where the credited
    USD lands when the payment settles.
    """
    amount: Decimal = MoneyAmount()
    account_target: Optional[str] = None


class RazorpayVerifyRequest(BaseModel):
    """The three fields the Razorpay Checkout handler returns to the browser
    on a successful payment. Posted back so the server can verify the HMAC
    signature and idempotently credit the wallet."""
    razorpay_order_id: str = Field(min_length=1, max_length=64)
    razorpay_payment_id: str = Field(min_length=1, max_length=64)
    razorpay_signature: str = Field(min_length=1, max_length=256)


class TxHashSaveRequest(BaseModel):
    """User-supplied on-chain tx hash. Purely informational; settlement
    still gates on the on-chain verifier."""
    tx_hash: str


# ─── Decentralised on-chain USDT deposit + withdraw ───────────────────────


class OnchainDepositRequest(BaseModel):
    """User picks chain + amount, then signs a transfer in their own
    wallet. The chain_verifier_engine confirms the deposit on-chain.

    `target` — "wallet" | "main" | None (auto-route at credit time).
    """
    network: str            # eth | bsc | tron
    amount: Decimal = MoneyAmount()
    target: Optional[str] = None


class OnchainWithdrawRequest(BaseModel):
    """Mirror of OnchainDepositRequest for payouts. Admin reviews +
    sends manually; chain_verifier_engine confirms once tx is mined.

    `source` — same semantics as WithdrawalRequest.
    """
    network: str            # eth | bsc | tron
    amount: Decimal = MoneyAmount()
    destination_address: str  # user's own wallet on the picked chain
    source: Optional[str] = None
    # D3 withdrawal step-up: id of a verified, single-use challenge. Only
    # enforced when WITHDRAWAL_STEP_UP_REQUIRED is on.
    step_up_challenge_id: Optional[str] = None
