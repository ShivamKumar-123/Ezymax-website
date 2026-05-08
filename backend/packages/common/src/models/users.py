"""Users, sessions, KYC docs, audit + IP logs, employees."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    # OTP-verified email flag. Set TRUE when:
    #   • Google sign-in (Google verifies upstream — backfilled by 0041)
    #   • User completes /auth/email/verify-otp
    # Stays FALSE for password-only signups (until OTP) and for wallet-first
    # signups with the placeholder @wallet.fxartha.local email.
    email_verified = Column(Boolean, nullable=False, default=False, server_default="false")
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    phone = Column(String(20))
    password_hash = Column(String(255), nullable=True)  # nullable for OAuth-only users
    google_id = Column(String(64), nullable=True, index=True)  # Google `sub` claim if signed in via Google
    first_name = Column(String(100))
    last_name = Column(String(100))
    date_of_birth = Column(DateTime)
    country = Column(String(100))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    role = Column(String(20), default="user")
    status = Column(String(20), default="active")
    kyc_status = Column(String(20), default="pending")
    # KYC reminder cadence stage: 0 = none sent, 1 = 3-day reminder fired,
    # 2 = 7-day reminder fired (terminal — no further reminders).
    kyc_reminder_stage = Column(Integer, default=0, server_default="0", nullable=False)
    is_demo = Column(Boolean, default=False)
    # When TRUE the trader is routed to swap-free (Islamic) account groups
    # by default and is exempt from the overnight leverage fee engine.
    is_islamic = Column(Boolean, default=False, server_default="false")
    # Set to TRUE when the user holds an active VipPass (mirrored on User
    # for fast lookup at reward-application time). Gated by
    # system_settings.vip_pass_enabled until token economics land.
    is_vip = Column(Boolean, default=False, server_default="false")
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255))
    language = Column(String(10), default="en")
    theme = Column(String(10), default="dark")
    book_type = Column(String(1), default="B", server_default="B")  # 'A' (LP routed) or 'B' (internal)
    trading_blocked_until = Column(DateTime(timezone=True))
    main_wallet_balance = Column(Numeric(18, 8), nullable=False, default=0)
    # Lowercased EVM address (0x + 40 hex). Unique via the partial index
    # ix_users_wallet_address_lower (migration 0034). Set on first SIWE
    # sign-in or after a manual link from /profile/wallet/link.
    wallet_address = Column(String(42), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    accounts = relationship("TradingAccount", back_populates="user", lazy="selectin")
    sessions = relationship("UserSession", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", lazy="selectin")
    refresh_tokens = relationship("UserRefreshToken", back_populates="user", lazy="selectin")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash = Column(String(255), nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    device_info = Column(JSONB)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="password_reset_tokens")


class EmailOtpCode(Base):
    """One-time-passcode for email verification.

    Issued by /auth/email/start-verification and consumed by
    /auth/email/verify-otp. The OTP itself is hashed with SHA-256 +
    a per-row salt so a DB read can't replay live codes. `target_email`
    is the address being verified — for the change-email flow this
    differs from users.email until the OTP succeeds, at which point
    we promote target_email → users.email and flip email_verified=true.
    """
    __tablename__ = "email_otp_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_email = Column(String(255), nullable=False)
    code_hash = Column(String(128), nullable=False)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)


class UserRefreshToken(Base):
    __tablename__ = "user_refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class WalletAuthNonce(Base):
    """Single-use nonces for SIWE (EIP-4361) sign-in and account-link flows.

    A row is inserted by `wallet_auth_service.issue_nonce()` and consumed by
    a single atomic `UPDATE … RETURNING` in `verify_signature()`. After
    consume, `consumed_at` is set so a replay of the same SIWE message
    returns 401. `expires_at` (default 5 min from creation) prevents stale
    nonces from accumulating; a periodic cleanup is not strictly required.
    """
    __tablename__ = "wallet_auth_nonces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address = Column(String(42), nullable=False)
    nonce = Column(String(64), nullable=False, unique=True)
    chain_id = Column(Integer, nullable=False)
    issued_for = Column(String(20), nullable=False, default="login")
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    ip_address = Column(INET)
    user_agent_hash = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True))


class FundMoveApproval(Base):
    """Pending admin add-fund / deduct-fund actions awaiting a SECOND
    admin's approval (2-person rule). A single compromised finance-tier
    account cannot drain the platform — moves above the configured
    threshold land here as `status='pending'` and only the executor
    flips them to `executed` after a different admin signs off."""
    __tablename__ = "fund_move_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action = Column(String(20), nullable=False)          # 'add_fund' | 'deduct_fund'
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_account_id = Column(UUID(as_uuid=True))
    amount = Column(Numeric(18, 8), nullable=False)
    source = Column(String(20))
    description = Column(Text)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    requested_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    rejected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    rejected_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    status = Column(String(20), default="pending", nullable=False)
    executed_at = Column(DateTime(timezone=True))


class TwoFactorBackupCode(Base):
    """Bcrypt-hashed one-time codes for 2FA recovery. Generated at
    setup, displayed once, then only verified-and-burned on use."""
    __tablename__ = "user_2fa_backup_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code_hash = Column(String(255), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class IdempotencyKey(Base):
    """Cache of (scope, key_hash) → cached HTTP response so a network-
    blip retry of the same request returns the same answer instead of
    creating a duplicate row."""
    __tablename__ = "idempotency_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(40), nullable=False)
    key_hash = Column(String(64), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    response_status = Column(Integer, nullable=False)
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class KYCDocument(Base):
    __tablename__ = "kyc_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    document_type = Column(String(30), nullable=False)
    file_url = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    rejection_reason = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class IPLog(Base):
    __tablename__ = "ip_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    ip_address = Column(INET, nullable=False)
    action = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(INET)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class UserAuditLog(Base):
    """Trader-facing activity (login, logout, orders) for admin review — separate from admin AuditLog."""

    __tablename__ = "user_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action_type = Column(String(80), nullable=False)
    ip_address = Column(String(64))
    device_info = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="noload")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    role = Column(String(30), nullable=False)
    is_active = Column(Boolean, default=True)
    extra_permissions = Column(JSONB, default=list, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")
