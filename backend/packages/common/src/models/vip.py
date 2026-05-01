"""VIP Pass — one-time purchase that grants ecosystem boosts.

Schema is in place; the boost-application logic + token-burn share are
gated by system_settings.vip_pass_enabled and ship when token economics
land. Until then this model exists so the schema is testable and the
admin can see the table.
"""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class VipPass(Base):
    __tablename__ = "vip_passes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    purchased_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    price_paid_usd = Column(Numeric(18, 2), nullable=False, default=Decimal("100"))
    transaction_id = Column(UUID(as_uuid=True), nullable=True)
    xp_boost_pct = Column(Integer, nullable=False, default=20)
    ac_boost_pct = Column(Integer, nullable=False, default=20)
    ps_boost_pct = Column(Integer, nullable=False, default=20)
    burn_share_active = Column(Boolean, nullable=False, default=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
