"""Public share links for trader cards (TradeLocker-style)."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class SharedTrade(Base):
    """Public share link for a trader's position — TradeLocker-style share card."""
    __tablename__ = "shared_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    short_code = Column(String(16), unique=True, nullable=False, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text)
    link_description = Column(Text)
    display_mode = Column(String(16), default="pnl")  # pnl | roi | ticks
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
