"""Trade Insurance API Pydantic schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class InsuranceQuoteRequest(BaseModel):
    account_id: UUID
    symbol: str
    side: str = Field(..., pattern="^(buy|sell)$")
    lots: Decimal = Field(gt=0, le=100)
    leverage: int = Field(default=100, ge=1, le=2000)
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    # Coverage window: 1 day / 1 week / 1 month.
    duration: str = Field(default="1d", pattern="^(1d|1w|1m)$")


class InsuranceTierQuote(BaseModel):
    tier: str
    fee: float
    coverage_pct: float
    max_cap: float
    estimated_refund: float
    risk_score: float


class InsuranceActivateRequest(BaseModel):
    position_id: UUID
    tier: str = Field(..., pattern="^(basic|advanced|pro|elite)$")
    duration: str = Field(default="1d", pattern="^(1d|1w|1m)$")


class InsuranceActivateResponse(BaseModel):
    policy_id: UUID
    fee_charged: Decimal
    status: str
    duration: str = "1d"
    expires_at: Optional[datetime] = None


class InsurancePolicyOut(BaseModel):
    id: UUID
    position_id: Optional[UUID] = None
    instrument_symbol: Optional[str] = None
    tier: str
    fee: Decimal
    coverage_pct: Decimal
    max_cap: Decimal
    status: str
    duration: str = "1d"
    expires_at: Optional[datetime] = None
    activated_at: datetime
    settled_at: Optional[datetime] = None


class InsuranceClaimOut(BaseModel):
    id: UUID
    policy_id: UUID
    loss_amount: Decimal
    claim_amount: Decimal
    paid_at: datetime
