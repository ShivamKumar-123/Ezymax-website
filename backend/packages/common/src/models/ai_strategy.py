"""AI Strategy Builder — user-defined, AI-assisted trading strategies.

Design invariants:
  - The strategy definition is a declarative JSON DSL (see
    packages/common/src/strategy_dsl.py) — never code. It is validated on
    every write and re-validated before every deploy.
  - Live execution goes through the canonical trading_service paths; the
    tables below only decide *when* to trade and tag what was traded.
  - AI-originated trades are linked via AIStrategyTrade (position_id /
    order_id) rather than a column on positions — the core trading schema
    stays untouched, and the "display AI trades separately" requirement is
    a join, not a migration on the hot tables.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from ..database import Base


class AIStrategy(Base):
    """A saved strategy definition (draft until deployed via an instance)."""
    __tablename__ = "ai_strategies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    # The natural-language prompt the user gave the AI (audit trail; nullable
    # for strategies built purely in the JSON editor).
    prompt = Column(Text)
    # The AI's plain-English explanation of how the strategy works
    # (shown on the detail page; from the chat reply that produced the rules).
    explanation = Column(Text)
    dsl = Column(JSONB, nullable=False)
    status = Column(String(16), nullable=False, default="draft")  # draft | active | archived
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                        onupdate=datetime.utcnow)


class AIStrategyBacktest(Base):
    """One backtest run of a strategy (params + results, immutable)."""
    __tablename__ = "ai_strategy_backtests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    strategy_id = Column(UUID(as_uuid=True),
                         ForeignKey("ai_strategies.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False)
    params = Column(JSONB, nullable=False)        # {days, commission_per_lot, ...}
    dsl_snapshot = Column(JSONB, nullable=False)  # DSL at run time (strategy may change later)
    stats = Column(JSONB, nullable=False)
    equity_curve = Column(JSONB, nullable=False)
    trades = Column(JSONB, nullable=False)        # capped list (last N round trips)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AIStrategyInstance(Base):
    """A deployment of a strategy onto ONE trading account ("any account":
    the user picks which of their accounts each instance trades on)."""
    __tablename__ = "ai_strategy_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    strategy_id = Column(UUID(as_uuid=True),
                         ForeignKey("ai_strategies.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True),
                        ForeignKey("trading_accounts.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    dsl_snapshot = Column(JSONB, nullable=False)  # frozen at deploy time
    status = Column(String(16), nullable=False, default="running")  # running | stopped | error
    # Engine bookkeeping — last CLOSED bar ts (epoch s) already evaluated, so a
    # restarted engine never double-fires on the same bar.
    last_eval_bar_ts = Column(Integer, nullable=False, default=0)
    trades_count = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    last_error = Column(Text)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    stopped_at = Column(DateTime(timezone=True))


class AIStrategyTrade(Base):
    """Link table tagging orders/positions that the AI engine created —
    the source of the separate 'AI trades' display."""
    __tablename__ = "ai_strategy_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instance_id = Column(UUID(as_uuid=True),
                         ForeignKey("ai_strategy_instances.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    strategy_id = Column(UUID(as_uuid=True),
                         ForeignKey("ai_strategies.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True))
    position_id = Column(UUID(as_uuid=True), index=True)
    side = Column(String(8), nullable=False)
    lots = Column(Numeric(10, 2), nullable=False)
    signal_bar_ts = Column(Integer, nullable=False)  # bar that produced the signal
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
