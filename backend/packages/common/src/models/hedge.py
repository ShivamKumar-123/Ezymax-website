"""Hedge episode history — powers the admin Hedged Trades section.

A hedge episode is a window during which one trading account held open
positions on BOTH sides (buy + sell) of the same instrument. The gateway
``hedge_recorder_engine`` maintains these rows: it opens an episode when a
hedge forms and stamps ``closed_at`` when the account stops being hedged on
that instrument. Live hedges + book exposure are computed on the fly from
open positions; this table is the going-forward HISTORY source only.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, Numeric, Index, CheckConstraint, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class HedgeEpisode(Base):
    __tablename__ = "hedge_episodes"
    __table_args__ = (
        CheckConstraint("status IN ('open','closed')", name="hedge_episodes_status_check"),
        Index("ix_hedge_opened_at", "opened_at"),
        Index("ix_hedge_user", "user_id"),
        Index("ix_hedge_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"), nullable=False)
    symbol = Column(String(32), nullable=False)
    status = Column(String(8), nullable=False, default="open", server_default="open")
    opened_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    closed_at = Column(DateTime(timezone=True))
    peak_long_lots = Column(Numeric(18, 2), nullable=False, default=0)
    peak_short_lots = Column(Numeric(18, 2), nullable=False, default=0)
    last_long_lots = Column(Numeric(18, 2), nullable=False, default=0)
    last_short_lots = Column(Numeric(18, 2), nullable=False, default=0)
