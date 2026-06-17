"""RMS / IP-management models.

Two tables power the superadmin IP-management module:

  * ``ip_geo_cache``  — one row per distinct IP address, holding the
    geo-resolution (country / city / lat-lng / ISP) fetched from the
    external GeoIP provider. Cached so we never re-resolve the same IP
    and so the admin reads stay a pure DB lookup (no outbound call on
    the read path). Resolution is done lazily by the gateway
    ``rms_engine`` which respects the provider rate limit.

  * ``rms_alerts``    — one row per detected risk signal. v1 fires a
    single alert type, ``shared_ip``: two or more *distinct* users
    authenticating from the identical IP address (the strongest
    multi-account / fraud signal). The row is upserted on the
    ``(alert_type, ip_address)`` unique key so a recurring collision
    updates ``user_count`` / ``last_seen_at`` instead of duplicating.

The per-user IP sightings themselves are NOT stored here — they already
live in ``user_sessions`` (written on every login) and the previously
dead ``ip_logs`` table (now written on login too). RMS reads aggregate
over those.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, Numeric, Boolean, Text,
    UniqueConstraint, Index, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB

from ..database import Base


class IpGeoCache(Base):
    """Geo-resolution cache for a single IP address.

    ``status`` distinguishes a successfully resolved row from a row we
    inserted to mark "we tried and the provider failed / returned a
    private/reserved IP" — so the resolver doesn't hammer the provider
    on every tick for an IP that will never resolve. ``resolved_at`` is
    used to expire stale rows (ISPs reassign IPs); the resolver
    re-fetches anything older than its freshness window.
    """
    __tablename__ = "ip_geo_cache"

    ip_address = Column(INET, primary_key=True)
    status = Column(String(16), nullable=False, default="resolved")  # resolved | failed | private
    country = Column(String(80))
    country_code = Column(String(4))
    region = Column(String(120))
    city = Column(String(120))
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))
    isp = Column(String(160))
    org = Column(String(160))
    timezone = Column(String(64))
    # Provider proxy/hosting flags when available (ip-api free returns
    # neither on the free tier; kept nullable for a future upgrade to a
    # provider that does — ipinfo/ip-api pro).
    is_proxy = Column(Boolean)
    is_hosting = Column(Boolean)
    resolved_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class RmsAlert(Base):
    """A risk signal raised by the RMS engine for admin review."""
    __tablename__ = "rms_alerts"
    __table_args__ = (
        UniqueConstraint("alert_type", "ip_address", name="uq_rms_alert_type_ip"),
        Index("ix_rms_alerts_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_type = Column(String(40), nullable=False, default="shared_ip")
    ip_address = Column(INET, nullable=False)
    # Snapshot of the colliding users at detection time: list of
    # {"user_id","email","name"} dicts. Denormalised so the alert list
    # renders without re-joining (the live view re-derives from sessions).
    user_ids = Column(JSONB, nullable=False, default=list)
    user_count = Column(Integer, nullable=False, default=0)
    # open | reviewed | dismissed
    status = Column(String(16), nullable=False, default="open")
    severity = Column(String(16), nullable=False, default="medium")  # low | medium | high
    notes = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True))
    reviewed_at = Column(DateTime(timezone=True))
    first_seen_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AdminNotification(Base):
    """Cross-cutting admin alert inbox — the bell in the admin topbar.

    Any suspicious-activity detector (shared-IP collision, coordinated
    same-side trading, …) writes a row here via ``admin_notify()`` and
    publishes to the ``admin:alerts`` Redis channel. This is a *shared*
    team queue (not per-admin): a row is global, and ``is_read`` flips
    once any admin acknowledges it. Good enough for a small risk desk.

    ``dedup_key`` (unique when set) prevents the same recurring signal
    from spamming the bell — e.g. the same coordinated cluster in the
    same time-bucket inserts once, then ``ON CONFLICT DO NOTHING``.
    """
    __tablename__ = "admin_notifications"
    __table_args__ = (
        UniqueConstraint("dedup_key", name="uq_admin_notif_dedup"),
        Index("ix_admin_notif_unread", "is_read", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String(40), nullable=False)   # shared_ip | coordinated_trade | margin_critical | system
    severity = Column(String(16), nullable=False, default="medium")  # low | medium | high
    title = Column(String(200), nullable=False)
    body = Column(Text)
    # Free-form context the UI can deep-link from (ip, symbol, side, user list…)
    meta = Column(JSONB, nullable=True)
    action_url = Column(String(200), nullable=True)  # admin route to jump to (e.g. /rms, /trade-risk)
    dedup_key = Column(String(160), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    read_by = Column(UUID(as_uuid=True))
    read_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class PricingTimeRule(Base):
    """Time-windowed spread / leverage override.

    Admin defines windows (preset market session OR custom day+hour range,
    all in **UTC**) during which an instrument's spread and/or max leverage
    change. Resolved by precedence: instrument > segment > default, then by
    ``priority`` (higher wins) on overlap.

    Spread within a window is either a **multiplier** on the base admin
    spread (``spread_mode='multiplier'``) or an **absolute** override
    (``spread_mode='absolute'`` with ``spread_value``/``spread_type``).
    The market-data feed layers live volatility widening on top of this.
    ``leverage_cap`` (when set) caps the effective leverage at order
    placement during the window.
    """
    __tablename__ = "pricing_time_rules"
    __table_args__ = (
        Index("ix_pricing_time_rules_enabled", "is_enabled"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    scope = Column(String(20), nullable=False, default="default")  # default | segment | instrument
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id", ondelete="CASCADE"), nullable=True)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), nullable=True)
    kind = Column(String(12), nullable=False, default="custom")    # session | custom
    session = Column(String(30), nullable=True)                    # asian|london|newyork|overlap_london_ny (kind=session)
    # Custom windows (UTC): days 0=Mon..6=Sun, minutes-of-day 0..1440.
    days_of_week = Column(JSONB, nullable=True)
    start_min = Column(Integer, nullable=True)
    end_min = Column(Integer, nullable=True)
    spread_mode = Column(String(12), nullable=False, default="multiplier")  # multiplier | absolute
    spread_multiplier = Column(Numeric(8, 3), nullable=True, default=1)
    spread_value = Column(Numeric(18, 8), nullable=True)
    spread_type = Column(String(20), nullable=True, default="pips")
    leverage_cap = Column(Integer, nullable=True)
    priority = Column(Integer, nullable=False, default=0)
    is_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
