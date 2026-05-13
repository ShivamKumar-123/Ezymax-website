"""Phase 7: overnight leverage fee tracking.

Adds positions.last_swap_at — the timestamp the overnight fee was last
charged on each position. The fee engine uses it to decide whether 24h
have elapsed since the last charge (or since open, if never charged).

Per Trading_Mechanism.docx: 0.01% per day on the borrowed portion of the
position notional. Fully-funded (leverage=1) positions and positions on
swap_free instruments / Islamic accounts pay nothing.

Revision ID: 0026
Revises: 0025
"""
from alembic import op


revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE positions
            ADD COLUMN IF NOT EXISTS last_swap_at TIMESTAMPTZ;
    """)
    # Lets the engine query "open positions where last_swap_at is null OR < cutoff" cheaply.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_positions_open_swap
            ON positions (last_swap_at) WHERE status = 'open';
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_positions_open_swap;")
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS last_swap_at;")
