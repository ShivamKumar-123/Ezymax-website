"""Share scopes: let a share link cover one trade, all open trades, or full history.

Until now a share link always pointed at exactly one position, so
`position_id` was NOT NULL. Account-wide shares ("all open positions",
"entire history") have no single position to point at, so:

  * `position_id` becomes nullable — NULL means an account-wide share
  * `scope` records which flavour it is: single | open | history
  * `account_id` is the account an account-wide share covers

Existing rows are all single-position shares, so they backfill to
scope='single' and keep their position_id.

Revision ID: 0061
Revises: 0060
"""
from alembic import op


revision = "0061"
down_revision = "0060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE shared_trades ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'single'")
    op.execute(
        "ALTER TABLE shared_trades ADD COLUMN IF NOT EXISTS account_id UUID "
        "REFERENCES trading_accounts(id) ON DELETE CASCADE"
    )
    # Pre-existing rows are single-position shares; the DEFAULT already
    # covers them, this is belt-and-braces for a partially applied run.
    op.execute("UPDATE shared_trades SET scope = 'single' WHERE scope IS NULL")
    op.execute("ALTER TABLE shared_trades ALTER COLUMN position_id DROP NOT NULL")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_shared_trades_account_scope "
        "ON shared_trades(account_id, scope)"
    )


def downgrade() -> None:
    # Account-wide shares cannot be represented once position_id is NOT NULL
    # again, so drop them rather than fabricate a position.
    op.execute("DELETE FROM shared_trades WHERE scope <> 'single' OR position_id IS NULL")
    op.execute("DROP INDEX IF EXISTS ix_shared_trades_account_scope")
    op.execute("ALTER TABLE shared_trades ALTER COLUMN position_id SET NOT NULL")
    op.execute("ALTER TABLE shared_trades DROP COLUMN IF EXISTS account_id")
    op.execute("ALTER TABLE shared_trades DROP COLUMN IF EXISTS scope")
