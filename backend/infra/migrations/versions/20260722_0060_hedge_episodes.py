"""Hedge episode history for the admin Hedged Trades section.

A "hedge episode" = a window during which one trading account held open
positions on BOTH sides (buy + sell) of the same instrument. The gateway
hedge-recorder engine opens an episode when a hedge forms and closes it when
the account is no longer hedged on that instrument. Live hedges + book
exposure are computed on the fly from open positions; this table is the
going-forward HISTORY source (records start accruing from deploy — there is
no backfill of pre-existing hedges by design).

Idempotent (CREATE TABLE IF NOT EXISTS).

Revision ID: 0060
Revises: 0059
"""
from alembic import op


revision = "0060"
down_revision = "0059"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hedge_episodes (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_id     UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
            instrument_id  UUID NOT NULL REFERENCES instruments(id),
            symbol         VARCHAR(32) NOT NULL,
            status         VARCHAR(8) NOT NULL DEFAULT 'open',
            opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            closed_at      TIMESTAMPTZ,
            peak_long_lots   NUMERIC(18,2) NOT NULL DEFAULT 0,
            peak_short_lots  NUMERIC(18,2) NOT NULL DEFAULT 0,
            last_long_lots   NUMERIC(18,2) NOT NULL DEFAULT 0,
            last_short_lots  NUMERIC(18,2) NOT NULL DEFAULT 0,
            CONSTRAINT hedge_episodes_status_check CHECK (status IN ('open','closed'))
        )
        """
    )
    # One live (open) episode per account+instrument — the recorder relies on
    # this to avoid duplicate open rows if two workers ever raced the lock.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_hedge_open_account_instrument
        ON hedge_episodes (account_id, instrument_id)
        WHERE status = 'open'
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_hedge_opened_at ON hedge_episodes (opened_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hedge_user ON hedge_episodes (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hedge_status ON hedge_episodes (status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS hedge_episodes")
