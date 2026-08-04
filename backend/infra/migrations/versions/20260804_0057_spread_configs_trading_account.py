"""Per-trading-account targeting for user-scope spread overrides.

A user can hold several trading accounts (live/demo, different tiers).
The Per User (Override) spread rule previously applied to ALL of them —
admins asked to target one specific account ("50 pips on XAUUSD, but
only on his Micro live account").

Adds a nullable ``trading_account_id`` FK to ``spread_configs``. Scope
stays ``'user'``: a row with the column set applies only when trading
that account; NULL keeps today's user-wide behaviour. The resolver in
``packages/common/src/instrument_pricing.py`` prefers account-specific
rows over user-wide ones.

Revision ID: 0057
Revises: 0056
"""
from alembic import op
import sqlalchemy as sa


revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "spread_configs",
        sa.Column(
            "trading_account_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("trading_accounts.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_spread_configs_trading_account_id",
        "spread_configs",
        ["trading_account_id"],
        postgresql_where=sa.text("trading_account_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_spread_configs_trading_account_id", table_name="spread_configs"
    )
    op.drop_column("spread_configs", "trading_account_id")
