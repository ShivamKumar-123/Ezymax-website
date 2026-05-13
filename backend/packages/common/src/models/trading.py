"""Trading accounts, orders, positions, trade history."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base
from ._enums import (
    OrderStatus, PositionStatus,
    order_type_enum, order_side_enum, order_status_enum, position_status_enum,
)


class AccountGroup(Base):
    __tablename__ = "account_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False)
    description = Column(Text)
    leverage_default = Column(Integer, default=100)
    # Hard ceiling on leverage for accounts in this group. NULL falls back to
    # leverage_default for legacy callers; the picker + order-placement guard
    # always enforce the smaller of (max_leverage, leverage_default).
    max_leverage = Column(Integer, nullable=True)
    spread_markup_default = Column(Numeric(10, 5), default=0)
    commission_default = Column(Numeric(10, 5), default=0)
    # Percentage brokerage fee (e.g. 0.0006 = 0.06%) per Trading_Mechanism.docx.
    # Used by the order pipeline once Phase 4 wires the smart-fee engine; until
    # then it's surfaced in the picker as the headline rate.
    commission_pct = Column(Numeric(6, 4), nullable=True)
    minimum_deposit = Column(Numeric(18, 8), default=0)
    swap_free = Column(Boolean, default=False)
    is_demo = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    account_group_id = Column(UUID(as_uuid=True), ForeignKey("account_groups.id"))
    account_number = Column(String(20), unique=True, nullable=False)
    balance = Column(Numeric(18, 8), default=0)
    credit = Column(Numeric(18, 8), default=0)
    equity = Column(Numeric(18, 8), default=0)
    margin_used = Column(Numeric(18, 8), default=0)
    free_margin = Column(Numeric(18, 8), default=0)
    margin_level = Column(Numeric(10, 4), default=0)
    leverage = Column(Integer, default=100)
    currency = Column(String(5), default="USD")
    is_demo = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    positions = relationship("Position", back_populates="account", lazy="selectin")
    account_group = relationship("AccountGroup", lazy="selectin")


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    order_type = Column(order_type_enum, nullable=False)
    side = Column(order_side_enum, nullable=False)
    status = Column(order_status_enum, default=OrderStatus.PENDING)
    lots = Column(Numeric(10, 4), nullable=False)
    price = Column(Numeric(18, 8))
    stop_loss = Column(Numeric(18, 8))
    take_profit = Column(Numeric(18, 8))
    stop_limit_price = Column(Numeric(18, 8))
    filled_price = Column(Numeric(18, 8))
    filled_at = Column(DateTime(timezone=True))
    commission = Column(Numeric(18, 8), default=0)
    swap = Column(Numeric(18, 8), default=0)
    comment = Column(Text)
    is_admin_created = Column(Boolean, default=False)
    admin_created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    magic_number = Column(Integer)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    instrument = relationship("Instrument", lazy="selectin")


class Position(Base):
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"))
    side = Column(order_side_enum, nullable=False)
    status = Column(position_status_enum, default=PositionStatus.OPEN)
    lots = Column(Numeric(10, 4), nullable=False)
    open_price = Column(Numeric(18, 8), nullable=False)
    close_price = Column(Numeric(18, 8))
    stop_loss = Column(Numeric(18, 8))
    take_profit = Column(Numeric(18, 8))
    swap = Column(Numeric(18, 8), default=0)
    # Last time the overnight leverage fee was applied to this position.
    # NULL until first charge; the engine compares (now - last_swap_at) to
    # decide whether ≥24h have elapsed and another daily charge is due.
    last_swap_at = Column(DateTime(timezone=True), nullable=True)
    commission = Column(Numeric(18, 8), default=0)
    profit = Column(Numeric(18, 8), default=0)
    closed_at = Column(DateTime(timezone=True))
    comment = Column(Text)
    is_admin_modified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("TradingAccount", back_populates="positions")
    instrument = relationship("Instrument", lazy="selectin")


class TradeHistory(Base):
    __tablename__ = "trade_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    side = Column(order_side_enum, nullable=False)
    lots = Column(Numeric(10, 4), nullable=False)
    open_price = Column(Numeric(18, 8), nullable=False)
    close_price = Column(Numeric(18, 8), nullable=False)
    swap = Column(Numeric(18, 8), default=0)
    commission = Column(Numeric(18, 8), default=0)
    profit = Column(Numeric(18, 8), nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=False)
    close_reason = Column(String(20), default="manual")

    instrument = relationship("Instrument", lazy="selectin")
