"""Trade insurance policies + claim payouts."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Numeric, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class InsurancePolicy(Base):
    """Per-trade micro-insurance policy. Activated at order placement, settled on close."""
    __tablename__ = "insurance_policies"
    __table_args__ = (
        CheckConstraint("tier IN ('basic','advanced','pro','elite')", name="insurance_policies_tier_check"),
        CheckConstraint(
            "status IN ('active','claimed','expired','denied')",
            name="insurance_policies_status_check",
        ),
        Index("ix_ins_pol_user_status", "user_id", "status"),
        Index("ix_ins_pol_position", "position_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), unique=True)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"), nullable=False)
    tier = Column(String(16), nullable=False)
    fee = Column(Numeric(18, 8), nullable=False)
    coverage_pct = Column(Numeric(5, 2), nullable=False)  # e.g. 20.00
    max_cap = Column(Numeric(18, 8), nullable=False)
    risk_score = Column(Numeric(8, 4), nullable=False)
    status = Column(String(16), nullable=False, default="active", server_default="active")
    activated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    settled_at = Column(DateTime(timezone=True))


class InsuranceClaim(Base):
    """Payout record when an insured trade closes in loss + passes anti-abuse gates."""
    __tablename__ = "insurance_claims"
    __table_args__ = (
        Index("ix_ins_clm_user_paid_at", "user_id", "paid_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("insurance_policies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    loss_amount = Column(Numeric(18, 8), nullable=False)   # absolute, positive
    claim_amount = Column(Numeric(18, 8), nullable=False)  # credited to wallet
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"))
    paid_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
