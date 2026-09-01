"""White-label broker (tenant) profile.

Ported from the stock4x broker model, adapted to SwissCresta's Postgres
stack and to a RENTAL business model: the platform rents the white-label
out to a broker for a flat fee — there is no P&L-share / settlement
machinery.

One row per users row with role='broker'. Holds:
  * tri-state section permissions (off / view / edit) — what the broker
    can see and do inside the admin panel, always scoped to their own
    user pool;
  * branding (brand name, logo, per-brand support contacts);
  * custom-domain lifecycle (pending_dns → dns_verified → provisioning
    → ready / failed) for serving the trader app on the broker's own
    domain;
  * rental terms (plan label, amount, period, next due date) — pure
    record-keeping for the platform owner, plus a suspension switch that
    freezes the whole tenant.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base

# Permission levels, ordered. Stored as plain strings inside the
# permissions JSONB: {"users": "edit", "deposits": "view", ...}.
PERMISSION_OFF = "off"
PERMISSION_VIEW = "view"
PERMISSION_EDIT = "edit"
_PERMISSION_ORDER = {PERMISSION_OFF: 0, PERMISSION_VIEW: 1, PERMISSION_EDIT: 2}

# Admin-panel sections a broker can be granted. Only sections whose
# backend queries are tenant-scoped may appear here — adding a section
# without scoping its service first would leak other tenants' data.
BROKER_SECTIONS = (
    "users",         # user list / detail / block / fund actions
    "kyc",           # KYC review for own pool
    "deposits",      # deposit review for own pool
    "withdrawals",   # withdrawal review for own pool
    "trades",        # trades/positions of own pool (view)
    "transactions",  # ledger of own pool
    "sub_brokers",   # ability to mint + manage sub-brokers
)

DOMAIN_STATUS_PENDING_DNS = "pending_dns"
DOMAIN_STATUS_DNS_VERIFIED = "dns_verified"
DOMAIN_STATUS_PROVISIONING = "provisioning"
DOMAIN_STATUS_READY = "ready"
DOMAIN_STATUS_FAILED = "failed"


def permission_at_least(actual: str | None, wanted: str) -> bool:
    """True when `actual` grants at least `wanted` (off < view < edit)."""
    return _PERMISSION_ORDER.get(actual or PERMISSION_OFF, 0) >= _PERMISSION_ORDER.get(wanted, 0)


class BrokerProfile(Base):
    __tablename__ = "broker_profiles"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Public referral handle for ?ref=<partner_code> signup links.
    # Distinct from IBProfile.referral_code — the IB system is commission
    # attribution; this is tenant pool assignment.
    partner_code = Column(String(20), unique=True, nullable=False, index=True)

    # {"users": "edit", "deposits": "view", ...} — sections absent from the
    # dict are OFF. Values are validated against BROKER_SECTIONS +
    # permission levels at write time (broker_service).
    permissions = Column(JSONB, nullable=False, default=dict, server_default="{}")

    # ── Branding ────────────────────────────────────────────────────────
    brand_name = Column(String(100), nullable=True)
    logo_url = Column(Text, nullable=True)  # served from the uploads mount
    support_email = Column(String(255), nullable=True)
    support_whatsapp = Column(String(32), nullable=True)

    # ── Custom domain (apex, lowercase, no protocol/path) ───────────────
    # Uniqueness is enforced by a partial unique index (see migration) so
    # any number of rows may leave it NULL but only one can claim a domain.
    custom_domain = Column(String(255), nullable=True)
    # Subdomain mode: serve the trader app on <app_subdomain>.<domain>
    # only, leaving the apex free for the broker's own landing page.
    # Empty/NULL = apex mode (platform serves apex + www).
    app_subdomain = Column(String(63), nullable=True)
    custom_domain_status = Column(String(20), nullable=True)
    custom_domain_last_error = Column(Text, nullable=True)
    custom_domain_provisioned_at = Column(DateTime(timezone=True), nullable=True)

    # ── Rental terms (record-keeping for the platform owner) ────────────
    rental_plan = Column(String(50), nullable=True)          # free-text label
    rental_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    rental_currency = Column(String(10), nullable=False, default="USD", server_default="USD")
    rental_period = Column(String(20), nullable=False, default="monthly", server_default="monthly")
    rental_next_due = Column(Date, nullable=True)
    rental_notes = Column(Text, nullable=True)

    # Suspension freezes the tenant: broker admin login is refused and the
    # pool's branding falls back to the platform. Trading users themselves
    # are NOT auto-blocked — that stays an explicit decision.
    is_suspended = Column(Boolean, nullable=False, default=False, server_default="false")
    suspended_reason = Column(Text, nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
