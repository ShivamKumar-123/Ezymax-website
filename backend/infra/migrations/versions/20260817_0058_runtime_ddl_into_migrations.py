"""Bring runtime-DDL tables under Alembic.

Three tables/columns existed only as `CREATE TABLE IF NOT EXISTS` /
`ALTER TABLE ADD COLUMN IF NOT EXISTS` statements executed at gateway boot
(`gateway/src/main.py` `_ensure_*` helpers and
`packages/common/src/bars_store.ensure_bars_table`), which meant no
migration created them and `alembic upgrade head` on a fresh database
produced a schema the running code then silently patched:

  - ohlc_bars            (durable chart bar store)
  - user_push_tokens     (Expo push-token registry)
  - investor_allocations.units  (PAMM NAV-based share accounting)

This revision makes migrations the authority. Everything is IF NOT EXISTS
so it's a no-op on databases the runtime DDL already touched; the runtime
helpers stay in place as belt-and-braces but should never fire on a
properly migrated database again.

Revision ID: 0058
Revises: 0057
"""
from alembic import op
import sqlalchemy as sa


revision = "0058"
down_revision = "0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Mirrors packages/common/src/bars_store.ensure_bars_table exactly.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ohlc_bars (
            symbol  VARCHAR(20)  NOT NULL,
            tf      VARCHAR(4)   NOT NULL,
            ts      BIGINT       NOT NULL,
            open    NUMERIC(20,8) NOT NULL,
            high    NUMERIC(20,8) NOT NULL,
            low     NUMERIC(20,8) NOT NULL,
            close   NUMERIC(20,8) NOT NULL,
            volume  NUMERIC(28,8) NOT NULL DEFAULT 0,
            PRIMARY KEY (symbol, tf, ts)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ohlc_bars_sym_tf_ts "
        "ON ohlc_bars(symbol, tf, ts)"
    )

    # Mirrors gateway _ensure_push_tokens_table exactly.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_push_tokens (
            token      TEXT PRIMARY KEY,
            user_id    UUID NOT NULL,
            platform   TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user "
        "ON user_push_tokens(user_id)"
    )

    # Mirrors gateway _ensure_pamm_units_column (column only — the one-time
    # backfill stays in the runtime helper because it depends on live data
    # state, is idempotent, and only touches rows still at 0).
    op.execute(
        "ALTER TABLE investor_allocations "
        "ADD COLUMN IF NOT EXISTS units NUMERIC(28,12) DEFAULT 0"
    )


def downgrade() -> None:
    # investor_allocations.units is NOT dropped: live PAMM share state.
    op.execute("DROP TABLE IF EXISTS user_push_tokens")
    op.execute("DROP TABLE IF EXISTS ohlc_bars")
