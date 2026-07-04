"""Add ib_profiles.portal_login_id + portal_password_hash for the separate
IB partner-portal login. On IB approval the admin flow generates a login ID
and password, stores the bcrypt hash here, and emails the credentials to the
user; they log in to a standalone IB portal with them.

Idempotent (ADD COLUMN IF NOT EXISTS).

Revision ID: 0058
Revises: 0057
"""
from alembic import op


revision = "0058"
down_revision = "0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS portal_login_id VARCHAR(30)")
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS portal_password_hash VARCHAR(255)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_ib_profiles_portal_login_id "
        "ON ib_profiles (portal_login_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_ib_profiles_portal_login_id")
    op.execute("ALTER TABLE ib_profiles DROP COLUMN IF EXISTS portal_password_hash")
    op.execute("ALTER TABLE ib_profiles DROP COLUMN IF EXISTS portal_login_id")
