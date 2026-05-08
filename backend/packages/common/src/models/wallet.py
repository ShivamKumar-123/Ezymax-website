"""Wallet ledger — banks, deposits, withdrawals, transactions, charge/spread/swap configs."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_name = Column(String(100))
    account_number = Column(String(50))
    bank_name = Column(String(100))
    ifsc_code = Column(String(20))
    upi_id = Column(String(100))
    qr_code_url = Column(Text)
    tier = Column(Integer, default=1)
    min_amount = Column(Numeric(18, 2), default=0)
    max_amount = Column(Numeric(18, 2), default=999999999)
    is_active = Column(Boolean, default=True)
    rotation_order = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"), nullable=True)
    amount = Column(Numeric(18, 8), nullable=False)
    currency = Column(String(10), default="USD")
    method = Column(String(30))
    status = Column(String(20), default="pending")
    transaction_id = Column(String(100))
    screenshot_url = Column(Text)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=True)
    crypto_tx_hash = Column(String(200))
    crypto_address = Column(String(200))
    # NOWPayments wallet-connect flow (migration 0032). `pay_amount` is the
    # exact crypto amount the user must send to `crypto_address`; `pay_currency`
    # is the NOWPayments code (usdterc20, eth, …); `network` is the chain we
    # surface to wagmi/RainbowKit; `expires_at` is the invoice TTL.
    pay_amount = Column(Numeric(36, 18), nullable=True)
    pay_currency = Column(String(20), nullable=True)
    network = Column(String(20), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"), nullable=True)
    amount = Column(Numeric(18, 8), nullable=False)
    currency = Column(String(10), default="USD")
    method = Column(String(30))
    status = Column(String(20), default="pending")
    bank_details = Column(JSONB)
    # crypto_address IS the linked-wallet snapshot at submit time. Even
    # if the user later disconnects + relinks a different wallet, the
    # historical row keeps the address we paid (or will pay) to.
    crypto_address = Column(String(200))
    crypto_tx_hash = Column(String(200))
    # Forensic snapshot fields added by 0042. wallet_chain_snapshot is
    # the chain id slug at submit time. verification_method records
    # how the user proved the action (siwe / password / totp future).
    # These two together let support reconstruct exactly how a payout
    # was authorised even years after the fact.
    wallet_chain_snapshot = Column(String(20), nullable=True)
    verification_method = Column(String(40), nullable=True)
    rejection_reason = Column(Text)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class WalletCooldown(Base):
    """Cooldown lock on a recently-disconnected wallet.

    When a user clicks "Disconnect" on Profile → Security, we insert a
    row here capturing (wallet_address, prior_user_id, disconnected_at,
    reusable_after = NOW() + 24h). The wallet-link flow LEFT JOINs
    against this table on lowercase address with `reusable_after >
    NOW()` and refuses to link a wallet that's still in cooldown.

    Why a separate table instead of fields on `users`:
      • A disconnected wallet doesn't belong to any active account, so
        putting cooldown state on `users` is a category error.
      • A wallet can be linked → disconnected → re-linked →
        disconnected again — multiple cooldown periods in its history.
      • Historical rows are useful for fraud investigation.
    """
    __tablename__ = "wallet_cooldowns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(64), nullable=False)
    wallet_chain = Column(String(20), nullable=True)
    prior_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    disconnected_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    reusable_after = Column(DateTime(timezone=True), nullable=False)
    # Free-text categorisation: 'user_disconnected' | 'admin_force' |
    # 'security_flag'. Non-binding — for analytics only.
    reason = Column(String(40), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"), nullable=True)
    type = Column(String(30), nullable=False)
    amount = Column(Numeric(18, 8), nullable=False)
    balance_after = Column(Numeric(18, 8))
    reference_id = Column(UUID(as_uuid=True))
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AdminDepositWallet(Base):
    """Admin-controlled deposit address per (network, asset).

    Powers the decentralized wallet-connect deposit flow: when a user picks
    USDT on a chain, the gateway looks up the active row for that
    (network='eth'|'bsc'|'tron', asset='USDT') tuple and shows the user
    that address as the destination. Only one row per (network, asset)
    can be active at a time, enforced by a partial unique index.

    The same row also holds the smart-contract integration placeholders
    (contract_address, contract_event_abi, contract_owner_address) added
    by migration 0040. These stay null until the client commits to a
    contract spec; once set, the chain verifier branches to event-decoded
    verification instead of plain transfer-input verification.
    """
    __tablename__ = "admin_deposit_wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    network = Column(String(20), nullable=False)  # eth | bsc | tron
    asset = Column(String(20), nullable=False, default="USDT")
    address = Column(String(64), nullable=False)
    min_confirmations = Column(Integer, nullable=False, default=12)
    is_active = Column(Boolean, default=True, nullable=False)

    # Smart-contract integration (nullable until Phase 2 ships).
    contract_address = Column(String(64), nullable=True)
    contract_event_abi = Column(JSONB, nullable=True)
    contract_owner_address = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class WebhookEvent(Base):
    """One row per processed payment-provider webhook.

    Inserted (with the (provider, external_id, status) UNIQUE constraint
    asserted at the DB layer) at the start of every webhook handler. A
    re-delivery of the same event by NOWPayments / OxaPay raises
    IntegrityError and the handler short-circuits — the deposit row is
    therefore credited at most once per status transition.
    """
    __tablename__ = "webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(40), nullable=False)
    external_id = Column(String(120), nullable=False)
    status = Column(String(40), nullable=False)
    received_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    payload_hash = Column(String(64))


class ChargeConfig(Base):
    __tablename__ = "charge_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    charge_type = Column(String(30), nullable=False)
    value = Column(Numeric(18, 8), nullable=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class SpreadConfig(Base):
    __tablename__ = "spread_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    spread_type = Column(String(20), nullable=False)
    value = Column(Numeric(18, 8), nullable=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class SwapConfig(Base):
    __tablename__ = "swap_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    swap_long = Column(Numeric(18, 8), default=0)
    swap_short = Column(Numeric(18, 8), default=0)
    triple_swap_day = Column(Integer, default=3)
    swap_free = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
