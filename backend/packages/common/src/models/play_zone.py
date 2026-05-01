"""Play Zone — Spin & Win catalogue + audit log.

Lottery and Bidding will land in Phase 6 in this same module.
"""
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
