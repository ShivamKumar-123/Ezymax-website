"""Play Zone — Spin & Win catalogue + audit log; Lottery rounds + tickets;
Bidding rounds + bids."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class SpinWheelPrize(Base):
    """A slot on the wheel. Weights are integers — the service draws weighted-random."""
    __tablename__ = "spin_wheel_prizes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(60), unique=True, nullable=False)
    label = Column(String(80), nullable=False)
    weight = Column(Integer, nullable=False, default=0)
    # xp | ac | cashback | nothing
    payout_kind = Column(String(20), nullable=False)
    payout_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")


class SpinResult(Base):
    """One row per spin. Used for analytics + cooldowns + showing recent wins."""
    __tablename__ = "spin_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    prize_id = Column(UUID(as_uuid=True), ForeignKey("spin_wheel_prizes.id"), nullable=False)
    ac_cost = Column(Numeric(18, 2), nullable=False)
    payout_kind = Column(String(20), nullable=False)
    payout_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    awarded_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


# ─── Lottery ─────────────────────────────────────────────────────────


class LotteryRound(Base):
    __tablename__ = "lottery_rounds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(80), nullable=False)
    prize_label = Column(String(120), nullable=False)
    # xp | ac | cashback | external (admin handles fulfillment)
    prize_kind = Column(String(20), nullable=False)
    prize_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    ticket_cost_ac = Column(Numeric(18, 2), nullable=False, default=Decimal("100"))
    opens_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    draws_at = Column(DateTime(timezone=True), nullable=False)
    # open | drawing | closed | cancelled
    state = Column(String(20), nullable=False, default="open")
    winning_ticket_id = Column(UUID(as_uuid=True), nullable=True)
    ticket_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class LotteryTicket(Base):
    __tablename__ = "lottery_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id = Column(UUID(as_uuid=True), ForeignKey("lottery_rounds.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ac_paid = Column(Numeric(18, 2), nullable=False)
    purchased_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


# ─── Bidding ─────────────────────────────────────────────────────────


class BiddingRound(Base):
    __tablename__ = "bidding_rounds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(80), nullable=False)
    prize_label = Column(String(120), nullable=False)
    prize_kind = Column(String(20), nullable=False)
    prize_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    min_bid_ac = Column(Numeric(18, 2), nullable=False, default=Decimal("100"))
    opens_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    closes_at = Column(DateTime(timezone=True), nullable=False)
    state = Column(String(20), nullable=False, default="open")
    winning_bid_id = Column(UUID(as_uuid=True), nullable=True)
    bid_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class Bid(Base):
    __tablename__ = "bids"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id = Column(UUID(as_uuid=True), ForeignKey("bidding_rounds.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ac_amount = Column(Numeric(18, 2), nullable=False)
    placed_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    refunded_ac = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
