"""Add user wallet sign-in (SIWE) — wallet_address column + nonce table.

Adds:
  users.wallet_address VARCHAR(42)         — nullable, lowercased, unique via partial idx
  wallet_auth_nonces                        — single-use nonces issued for SIWE sign-in
                                              and account-link flows. Atomic
                                              `UPDATE … SET consumed_at = now()
                                              … RETURNING` on consume guarantees
                                              single-use even under concurrent verifies.

The placeholder email used for wallet-only signups (`wallet_<addr>@wallet.fxartha.local`)
will not collide with real signups because `.local` is a private TLD.

Revision ID: 0034
Revises: 0033
"""
from alembic import op


revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42);")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wallet_address_lower
            ON users (LOWER(wallet_address))
            WHERE wallet_address IS NOT NULL;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS wallet_auth_nonces (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            address         VARCHAR(42)  NOT NULL,
            nonce           VARCHAR(64)  NOT NULL UNIQUE,
            chain_id        INTEGER      NOT NULL,
            issued_for      VARCHAR(20)  NOT NULL DEFAULT 'login',
            user_id         UUID         NULL REFERENCES users(id) ON DELETE CASCADE,
            ip_address      INET         NULL,
            user_agent_hash CHAR(64)     NULL,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            expires_at      TIMESTAMPTZ  NOT NULL,
            consumed_at     TIMESTAMPTZ  NULL
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_wallet_nonces_address_active
            ON wallet_auth_nonces (LOWER(address))
            WHERE consumed_at IS NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_wallet_nonces_expires
            ON wallet_auth_nonces (expires_at);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_wallet_nonces_expires;")
    op.execute("DROP INDEX IF EXISTS ix_wallet_nonces_address_active;")
    op.execute("DROP TABLE IF EXISTS wallet_auth_nonces;")
    op.execute("DROP INDEX IF EXISTS ix_users_wallet_address_lower;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;")
