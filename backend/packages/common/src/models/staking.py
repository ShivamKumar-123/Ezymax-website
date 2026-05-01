"""Staking — plans, user positions, daily reward accruals.

The reward-accrual table is filled by a daily scheduler (see staking_service):
each row records the principal × apy_bps / 10000 / 365 reward computed for one
24h window. `paid_at` is set when the user claims the row.
"""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class StakingPlan(Base):
    """Catalogue of staking plans (Flexible + Locked tiers)."""
    __tablename__ = "staking_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(60), unique=True, nullable=False)
    label = Column(String(80), nullable=False)
    description = Column(Text)
    # 'flexible' | 'locked'
    mode = Column(String(10), nullable=False)
    # NULL for flexible; positive integer for locked plans.
    lock_months = Column(Integer, nullable=True)
    # APY in basis points (1800 = 18%).
    apy_bps = Column(Integer, nullable=False, default=0)
    min_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    # Trading-bonus multiplier in basis points: 10000 = 100% (i.e. stake $X, get
    # $X of trading bonus on opt-in). 0 disables the trading-bonus feature.
    trading_bonus_multiplier_bps = Column(Integer, nullable=False, default=0)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")


class StakingPosition(Base):
    """A user's stake in a single plan."""
    __tablename__ = "staking_positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("staking_plans.id"), nullable=False)
    principal = Column(Numeric(18, 2), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    unlocks_at = Column(DateTime(timezone=True), nullable=True)
    # 'active' | 'withdrawn' | 'early_exit'
    state = Column(String(20), nullable=False, default="active")
    # When TRUE the user opted in to the trading bonus when opening the
    # position. The principal is locked until unlocks_at and the equivalent
    # bonus has been credited to a tagged trading account.
    trading_bonus_active = Column(Boolean, nullable=False, default=False)
    trading_bonus_credited = Column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    last_accrued_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)


class StakingRewardAccrual(Base):
    """One row per accrual window (typically 24h) for one position."""
    __tablename__ = "staking_reward_accruals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("staking_positions.id", ondelete="CASCADE"), nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    reward_amount = Column(Numeric(18, 2), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
