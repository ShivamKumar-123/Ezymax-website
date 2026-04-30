"""Allow Google-only users — drop NOT NULL on password_hash, add google_id.

Revision ID: 0017
Revises: 0016
"""
from alembic import op


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing rows already have a password_hash; this just lets new
    # OAuth-only users store NULL in that column.
    op.execute("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(64);")
    # Partial index — many existing rows have NULL google_id, so a plain unique
    # constraint would reject them all. The partial form only enforces uniqueness
    # for rows that actually have a value.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_users_google_id
            ON users(google_id) WHERE google_id IS NOT NULL;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_users_google_id;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS google_id;")
    # Don't re-add NOT NULL automatically — would fail if any OAuth-only rows exist.
