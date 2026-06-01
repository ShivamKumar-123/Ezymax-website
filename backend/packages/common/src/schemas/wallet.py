"""Deposit / withdrawal / transfer + bank-account Pydantic schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DepositRequest(BaseModel):
    """account_id is optional — approved deposits credit main_wallet_balance regardless."""
    account_id: Optional[UUID] = None
    amount: Decimal = Field(gt=0)
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

    amount: Decimal = Field(gt=0)
    method: str
    bank_details: Optional[dict] = None
    crypto_address: Optional[str] = None
    source: Optional[str] = None


class TransferTradingToMainRequest(BaseModel):
    """Move available cash from a live trading account into the user main wallet."""

    from_account_id: UUID
    amount: Decimal = Field(gt=0)


class TransferMainToTradingRequest(BaseModel):
    """Fund a live trading account from the main wallet."""

    to_account_id: UUID
    amount: Decimal = Field(gt=0)


class InternalWalletTransferRequest(BaseModel):
    """Move available balance from one live trading account to another (same user)."""

    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal = Field(gt=0)


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


# ─── NOWPayments wallet-connect deposit flow ──────────────────────────────


class WalletDepositRequest(BaseModel):
    """On-site NOWPayments direct payment — no hosted-page redirect.

    `target` lets the user pick where the credit should land when the
    deposit eventually settles (webhook):
      - "wallet" → wallet-bound trading account
      - "main"   → legacy main_wallet_balance
      - None / unset → server resolver picks (wallet-bound if present,
        else main wallet) — preserves the auto-route default
    """
    amount: Decimal = Field(gt=0)
    # Frontend asset id, e.g. "USDT_ERC", "USDT_TRC", "ETH".
    crypto_currency: str
    target: Optional[str] = None


class TxHashSaveRequest(BaseModel):
    """User-supplied on-chain tx hash. Purely informational; settlement
    still gates on the NOWPayments IPN."""
    tx_hash: str


class HostedInvoiceDepositRequest(BaseModel):
    """NOWPayments Mode B — server returns a hosted payment_url the
    browser redirects to. `crypto_currency` is optional; when omitted
    NOWPayments shows its full asset picker on the hosted page.

    `target` — same semantics as WalletDepositRequest.
    """
    amount: Decimal = Field(gt=0)
    crypto_currency: Optional[str] = None
    target: Optional[str] = None


# ─── Decentralised on-chain USDT deposit + withdraw ───────────────────────


class OnchainDepositRequest(BaseModel):
    """User picks chain + amount, then signs a transfer in their own
    wallet. The chain_verifier_engine confirms the deposit on-chain.

    `target` — same semantics as WalletDepositRequest.
    """
    network: str            # eth | bsc | tron
    amount: Decimal = Field(gt=0)
    target: Optional[str] = None


class OnchainWithdrawRequest(BaseModel):
    """Mirror of OnchainDepositRequest for payouts. Admin reviews +
    sends manually; chain_verifier_engine confirms once tx is mined.

    `source` — same semantics as WithdrawalRequest.

    Note: `destination_address` is accepted for back-compat with older
    clients but the server overrides it with the user's linked SIWE
    wallet — see onchain_withdraw_service.create_onchain_withdrawal.
    """
    network: str            # eth | bsc | tron
    amount: Decimal = Field(gt=0)
    destination_address: Optional[str] = None
    source: Optional[str] = None
