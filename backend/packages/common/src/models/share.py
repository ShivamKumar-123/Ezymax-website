"""Public share links for trader cards (TradeLocker-style)."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class SharedTrade(Base):
    """Public share link for a trader's trades — TradeLocker-style share card.

    `scope` decides what the link covers:
      * ``single``  — one position; `position_id` is set, `account_id` is NULL
      * ``open``    — every open position on `account_id`, priced live
      * ``history`` — `account_id`'s full record: open positions + closed trades

    For the account-wide scopes `position_id` is NULL, so the link keeps
    working as the account's trades change rather than freezing a snapshot.
    """
    __tablename__ = "shared_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    short_code = Column(String(16), unique=True, nullable=False, index=True)
    # NULL for account-wide shares (scope != 'single').
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="CASCADE"), nullable=True)
    # Set only for account-wide shares.
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=True)
    scope = Column(String(16), nullable=False, default="single")  # single | open | history
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text)
    link_description = Column(Text)
    display_mode = Column(String(16), default="pnl")  # pnl | roi | ticks
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
