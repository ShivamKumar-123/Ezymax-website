"""Drop the algo_api_keys table — feature removed.

Revision ID: 0016
Revises: 0015
"""
from alembic import op


revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_algo_api_keys_api_key;")
    op.execute("DROP TABLE IF EXISTS algo_api_keys;")


def downgrade() -> None:
    # Best-effort recreate. Down migrations on dropped features are rarely useful;
    # restoring data isn't possible anyway.
    op.execute("""
        CREATE TABLE IF NOT EXISTS algo_api_keys (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
            account_id    UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
            api_key       VARCHAR(64) UNIQUE NOT NULL,
            secret_hash   VARCHAR(128) NOT NULL,
            api_secret    VARCHAR(128),
            label         VARCHAR(100) DEFAULT '',
            is_active     BOOLEAN DEFAULT true,
            last_used_at  TIMESTAMPTZ,
            trades_count  INTEGER DEFAULT 0,
            created_at    TIMESTAMPTZ DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_algo_api_keys_api_key ON algo_api_keys(api_key);")
