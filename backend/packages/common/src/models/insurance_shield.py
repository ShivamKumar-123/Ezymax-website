"""Ezymex Shield — aggregate, period-based trade insurance.

This is the model from the *Ezymex Trade Insurance* handbook: the user buys a
single **period plan** (Daily / Weekly / Monthly) at one of four tiers, and the
plan pays a share of the user's **cumulative eligible realized loss** over that
period, up to a fixed cap:

    Payout(after each losing trade) =
        MIN(cumulative_eligible_loss × coverage%, max_payout) − already_paid

It is deliberately SEPARATE from the per-trade `InsurancePolicy`/`InsuranceClaim`
micro-insurance in `insurance.py` — both products co-exist. Nothing here touches
the per-trade tables. Tables are namespaced `insurance_shield_*`.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class InsuranceShieldPlan(Base):
    """Admin-configurable catalog of purchasable Shield plans.

    One row per (period, tier). Seeded with the handbook defaults on startup;
    admin can edit coverage / cap / premium or toggle `is_active`.
    """
    __tablename__ = "insurance_shield_plans"
    __table_args__ = (
        CheckConstraint("period IN ('daily','weekly','monthly')", name="ins_shield_plan_period_check"),
        CheckConstraint("tier IN ('basic','plus','pro','elite')", name="ins_shield_plan_tier_check"),
        UniqueConstraint("period", "tier", name="uq_ins_shield_plan_period_tier"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(32), nullable=False, unique=True)          # e.g. 'daily_basic'
    period = Column(String(10), nullable=False)                     # daily | weekly | monthly
    tier = Column(String(10), nullable=False)                       # basic | plus | pro | elite
    coverage_pct = Column(Numeric(5, 2), nullable=False)            # 20 / 30 / 40 / 50
    max_payout = Column(Numeric(18, 2), nullable=False)             # coverage cap for the period
    premium = Column(Numeric(18, 2), nullable=False)                # price of the plan
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserInsuranceShield(Base):
    """A Shield plan a user has purchased. At most one may be `active` per user.

    `cumulative_eligible_loss` accumulates the absolute realized loss of every
    eligible losing trade closed while the plan is active. `coverage_used` is the
    total already paid out. Remaining coverage = max_payout − coverage_used.
    """
    __tablename__ = "user_insurance_shield"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','expired','cancelled','replaced','exhausted')",
            name="user_ins_shield_status_check",
        ),
        Index("ix_user_ins_shield_user_status", "user_id", "status"),
        # One active plan per user — enforced by a partial unique index (added in
        # startup DDL / migration, since SQLAlchemy can't express WHERE here portably).
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("insurance_shield_plans.id", ondelete="SET NULL"))
    # Denormalised snapshot of the plan terms at purchase time — so later admin
    # edits to the catalog never retro-change an already-sold plan.
    period = Column(String(10), nullable=False)
    tier = Column(String(10), nullable=False)
    coverage_pct = Column(Numeric(5, 2), nullable=False)
    max_payout = Column(Numeric(18, 2), nullable=False)
    premium_paid = Column(Numeric(18, 2), nullable=False)

    cumulative_eligible_loss = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    coverage_used = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")

    status = Column(String(12), nullable=False, default="active", server_default="active")
    activated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class InsuranceShieldClaim(Base):
    """One settlement record per eligible losing trade that produced a payout
    (or was evaluated). Aggregate: each record carries the running cumulative
    loss and the *incremental* payout credited at that point."""
    __tablename__ = "insurance_shield_claims"
    __table_args__ = (
        CheckConstraint(
            "status IN ('paid','pending','approved','rejected','partial','under_review')",
            name="ins_shield_claim_status_check",
        ),
        Index("ix_ins_shield_claim_shield", "user_insurance_id"),
        Index("ix_ins_shield_claim_user_created", "user_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_insurance_id = Column(UUID(as_uuid=True), ForeignKey("user_insurance_shield.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"))
    trade_loss = Column(Numeric(18, 2), nullable=False)                 # absolute realized loss on this trade
    cumulative_eligible_loss = Column(Numeric(18, 2), nullable=False)   # running total after this trade
    payout_amount = Column(Numeric(18, 2), nullable=False)              # incremental credited (0 if none)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"))
    status = Column(String(14), nullable=False, default="paid", server_default="paid")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class InsuranceShieldEvent(Base):
    """Lightweight audit trail: purchases, replacements, payouts, denials,
    expiries. Keeps the money path auditable without parsing transactions."""
    __tablename__ = "insurance_shield_events"
    __table_args__ = (
        Index("ix_ins_shield_event_user_created", "user_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_insurance_id = Column(UUID(as_uuid=True), ForeignKey("user_insurance_shield.id", ondelete="SET NULL"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(24), nullable=False)   # purchase | replace | claim_paid | claim_denied | expired | cancelled
    detail = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
