"""Admin-side Pydantic schemas (fund adjustments, manual trades, banks)."""
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdminFundAdjustment(BaseModel):
    user_id: UUID
    account_id: UUID
    amount: Decimal
    type: str = Field(..., pattern="^(deposit|withdrawal|credit|adjustment)$")
    description: Optional[str] = None


class AdminTradeCreate(BaseModel):
    account_id: UUID
    symbol: str
    order_type: str
    side: str
    lots: Decimal
    price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    stealth: bool = True


class AdminModifyTrade(BaseModel):
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    lots: Optional[Decimal] = None
    close_lots: Optional[Decimal] = None
    stealth: bool = True
