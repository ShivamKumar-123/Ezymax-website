"""Market-data + instrument response Pydantic schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TickData(BaseModel):
    symbol: str
    bid: float
    ask: float
    timestamp: str
    spread: float


class OHLCVBar(BaseModel):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class InstrumentResponse(BaseModel):
    id: UUID
    symbol: str
    display_name: Optional[str]
    segment: Optional[str]
    base_currency: Optional[str] = None
    quote_currency: Optional[str] = None
    digits: int
    pip_size: Decimal
    min_lot: Decimal
    max_lot: Decimal
    lot_step: Decimal
    contract_size: Decimal
    margin_rate: Decimal
    is_active: bool

    class Config:
        from_attributes = True
