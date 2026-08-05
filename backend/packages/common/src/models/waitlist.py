"""Waitlist requests — invite-only access gate.

A visitor submits (full name, email, phone) on the marketing landing site.
An admin reviews the row and approves or rejects it. On approval the real
trader `User` account is created (with a generated password) and the person
is emailed their credentials. No password is ever collected from or stored
for the applicant here — the account password is system-generated at approval.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class WaitlistRequest(Base):
    __tablename__ = "waitlist_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(20), nullable=True)

    # pending | approved | rejected
    status = Column(String(20), nullable=False, default="pending", server_default="pending", index=True)

    # Employee who actioned the row + when + why (reject reason).
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # The trader User row minted on approval (audit link back).
    created_user_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
