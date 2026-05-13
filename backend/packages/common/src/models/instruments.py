"""Instruments + per-instrument tunables."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class InstrumentSegment(Base):
    __tablename__ = "instrument_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100))
    is_active = Column(Boolean, default=True)


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    display_name = Column(String(100))
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    base_currency = Column(String(10))
    quote_currency = Column(String(10))
    digits = Column(Integer, default=5)
    pip_size = Column(Numeric(10, 8), default=Decimal("0.0001"))
    lot_size = Column(Integer, default=100000)
    min_lot = Column(Numeric(10, 4), default=Decimal("0.01"))
    max_lot = Column(Numeric(10, 4), default=100)
    lot_step = Column(Numeric(10, 4), default=Decimal("0.01"))
    contract_size = Column(Numeric(18, 4), default=100000)
    margin_rate = Column(Numeric(10, 6), default=Decimal("0.01"))
    trading_hours = Column(JSONB)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    segment = relationship("InstrumentSegment", lazy="selectin")


class InstrumentConfig(Base):
    """Single admin-editable row per instrument; synced to charge/spread/swap config tables."""

    __tablename__ = "instrument_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), unique=True, nullable=False)
    commission_value = Column(Numeric(18, 8))
    commission_type = Column(String(30), nullable=False, default="per_lot")
    spread_value = Column(Numeric(18, 8))
    spread_type = Column(String(20), nullable=False, default="pips")
    price_impact = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    swap_long = Column(Numeric(18, 8), default=Decimal("0"))
    swap_short = Column(Numeric(18, 8), default=Decimal("0"))
    swap_free = Column(Boolean, nullable=False, default=False)
    min_lot_size = Column(Numeric(10, 4), default=Decimal("0.01"))
    max_lot_size = Column(Numeric(10, 4), default=Decimal("100"))
    leverage_max = Column(Integer, default=2000)
    is_enabled = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    instrument = relationship("Instrument", lazy="selectin")


class InstrumentConfigAudit(Base):
    __tablename__ = "instrument_config_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False)
    field_changed = Column(String(64), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    changed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ip_address = Column(String(64))
