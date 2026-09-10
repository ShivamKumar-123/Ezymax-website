"""IB / sub-broker / referrals + master accounts + investor allocations + copy trades."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class IBProfile(Base):
    __tablename__ = "ib_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    referral_code = Column(String(20), unique=True, nullable=False)
    parent_ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    level = Column(Integer, default=1)
    commission_plan_id = Column(UUID(as_uuid=True))
    custom_commission_per_lot = Column(Numeric(18, 8))
    custom_commission_per_trade = Column(Numeric(18, 8))
    total_earned = Column(Numeric(18, 8), default=0)
    pending_payout = Column(Numeric(18, 8), default=0)
    is_active = Column(Boolean, default=True)
    rejection_reason = Column(Text)
    rejected_at = Column(DateTime(timezone=True))
    rejected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class IBApplication(Base):
    __tablename__ = "ib_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String(20), default="pending")
    application_data = Column(JSONB)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class IBCommissionPlan(Base):
    __tablename__ = "ib_commission_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100))
    is_default = Column(Boolean, default=False)
    commission_per_lot = Column(Numeric(18, 8), default=0)
    commission_per_trade = Column(Numeric(18, 8), default=0)
    spread_share_pct = Column(Numeric(5, 2), default=0)
    cpa_per_deposit = Column(Numeric(18, 8), default=0)
    mlm_levels = Column(Integer, default=5)
    mlm_distribution = Column(JSONB, default=[40, 25, 15, 10, 10])
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class IBCommission(Base):
    __tablename__ = "ib_commissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    source_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    source_trade_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"))
    commission_type = Column(String(30))
    amount = Column(Numeric(18, 8), nullable=False)
    mlm_level = Column(Integer, default=1)
    # pending → an admin has not released it yet (the engine only ever writes
    # this) | paid → released and credited | rejected → voided, never credited.
    status = Column(String(20), default="pending")
    # Stamped when an admin releases the payout, not when the commission was
    # earned. NULL on rows that predate the approval flow (alembic 0065).
    paid_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    referred_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ib_profile_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    utm_source = Column(String(100))
    utm_medium = Column(String(100))
    utm_campaign = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class MasterAccount(Base):
    __tablename__ = "master_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    status = Column(String(20), default="pending")
    master_type = Column(String(20))
    performance_fee_pct = Column(Numeric(5, 2), default=20)
    management_fee_pct = Column(Numeric(5, 2), default=0)
    admin_commission_pct = Column(Numeric(5, 2), default=0)
    max_investors = Column(Integer, default=100)
    description = Column(Text)
    strategy_info = Column(JSONB, default=None)
    min_investment = Column(Numeric(18, 8), default=100)
    total_return_pct = Column(Numeric(10, 4), default=0)
    max_drawdown_pct = Column(Numeric(10, 4), default=0)
    sharpe_ratio = Column(Numeric(10, 4), default=0)
    followers_count = Column(Integer, default=0)
    total_fee_earned = Column(Numeric(18, 8), default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")
    account = relationship("TradingAccount", lazy="selectin")


class InvestorAllocation(Base):
    __tablename__ = "investor_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("master_accounts.id"))
    investor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    investor_account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    copy_type = Column(String(20), default="signal")
    allocation_amount = Column(Numeric(18, 8), nullable=False)
    # PAMM pool ownership in NAV-based units. At entry units = amount / NAV
    # (NAV = pool_value / total_units), so an investor buys in at the current
    # pool value and can't dilute profit earned before they joined. Investor
    # share = units / sum(active pamm units). 0 for signal/MAM allocations.
    units = Column(Numeric(28, 12), default=0)
    allocation_pct = Column(Numeric(5, 2))
    max_drawdown_pct = Column(Numeric(5, 2))
    max_lot_override = Column(Numeric(10, 4))
    status = Column(String(20), default="active")
    total_profit = Column(Numeric(18, 8), default=0)
    # High-water mark state for performance fees (alembic 0064). Fees are
    # charged only on gross profit that lifts the follower above their
    # previous peak — see packages/common/src/copy_fees.py.
    gross_pnl_cum = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")
    hwm_profit = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")
    last_distribution_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class CopyTrade(Base):
    __tablename__ = "copy_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    investor_allocation_id = Column(UUID(as_uuid=True), ForeignKey("investor_allocations.id"))
    investor_position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    ratio = Column(Numeric(10, 4), default=1)
    status = Column(String(20), default="open")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
