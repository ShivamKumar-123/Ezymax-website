"""Play Zone — lottery / bidding round Pydantic schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ─── User-side ──────────────────────────────────────────────────────


class BidRequest(BaseModel):
    """User submits a bid amount (in Artha Coins) on a bidding round."""
    amount: Decimal = Field(gt=0)


# ─── Admin-side: create rounds ──────────────────────────────────────


class CreateLotteryRoundRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    prize_label: str = Field(min_length=1, max_length=120)
    prize_kind: Literal["xp", "ac", "cashback", "external"]
    prize_amount: Decimal = Field(default=Decimal("0"), ge=0)
    ticket_cost_ac: Decimal = Field(default=Decimal("100"), gt=0)
    draws_at: datetime
    opens_at: Optional[datetime] = None


class CreateBiddingRoundRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    prize_label: str = Field(min_length=1, max_length=120)
    prize_kind: Literal["xp", "ac", "cashback", "external"]
    prize_amount: Decimal = Field(default=Decimal("0"), ge=0)
    min_bid_ac: Decimal = Field(default=Decimal("100"), gt=0)
    closes_at: datetime
    opens_at: Optional[datetime] = None
