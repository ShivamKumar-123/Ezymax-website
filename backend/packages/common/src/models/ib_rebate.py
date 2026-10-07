"""Ezymax IB rebate model — Milele-style per-closed-lot, tiered, multi-level.

Replaces the legacy instant flat-rate IB commission with an **accrual** model:
each IB accumulates eligible closed lots over a calendar month, a daily
settlement job recomputes their tier (Starter/Builder/Pro/Custom) from that
month's lots + active clients, applies the tier rate to the whole month's lots
(so reaching a higher tier retro-pays the difference), and pays the *delta* over
what was already settled. Upline masters earn a capped override on top.

Separate from the legacy `ib_commissions` table — that path is gated off when
the `ib_commission_model` setting is 'accrual' (see ib_rebate/engine.py).
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Numeric, Integer, Index,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class IbRebatePeriod(Base):
    """One row per IB per calendar month — the accumulator + settlement tracker.

    `own_target` = eligible_lots × rate_per_lot at the current tier. `own_settled`
    is what has actually been paid to this IB for their own rebate so far; the
    settlement job pays `own_target − own_settled` each run (retroactive tier
    uplift falls out for free). `override_settled` is what this IB has received
    as override on its downline's rebates.
    """
    __tablename__ = "ib_rebate_periods"
    __table_args__ = (
        UniqueConstraint("ib_id", "period", name="uq_ib_rebate_period"),
        Index("ix_ib_rebate_period_period", "period"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id", ondelete="CASCADE"), nullable=False)
    period = Column(String(7), nullable=False)  # 'YYYY-MM'

    eligible_lots = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    active_clients = Column(Integer, nullable=False, default=0, server_default="0")
    tier = Column(String(20), nullable=False, default="starter", server_default="starter")
    rate_per_lot = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")

    own_target = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")
    own_settled = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")
    override_settled = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class IbRebateSettlement(Base):
    """Audit row per actual payout — one for each own-rebate delta credited and
    one for each override credited to an upline master."""
    __tablename__ = "ib_rebate_settlements"
    __table_args__ = (
        Index("ix_ib_rebate_settle_ib_period", "ib_id", "period"),
        Index("ix_ib_rebate_settle_created", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id", ondelete="CASCADE"), nullable=False)  # recipient
    period = Column(String(7), nullable=False)
    kind = Column(String(12), nullable=False)          # own | override
    level = Column(Integer, nullable=False, default=0)  # 0 = own, 1/2/3.. = override depth
    source_ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id", ondelete="SET NULL"))  # whose rebate produced this override
    amount = Column(Numeric(18, 8), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
