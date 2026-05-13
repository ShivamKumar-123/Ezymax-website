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
    """Withdraw to external payout (OxaPay, etc.) from main wallet only — not from trading accounts."""

    amount: Decimal = Field(gt=0)
    method: str
    bank_details: Optional[dict] = None
    crypto_address: Optional[str] = None


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
