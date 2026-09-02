"""Allow role='broker' in the users role CHECK constraint.

The baseline schema (init-db.sql) whitelists role values:
    CHECK (role IN ('user','admin','super_admin','ib','sub_broker','master_trader'))
White-label tenants (alembic 0062) use role='broker', so the first
broker INSERT hit CheckViolationError. Recreate the constraint with
'broker' included. Idempotent — DROP IF EXISTS + same definition.

Revision ID: 0063
Revises: 0062
"""
from alembic import op


revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None

_ROLES = "('user','admin','super_admin','ib','sub_broker','master_trader','broker')"


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        f"ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN {_ROLES})"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK "
        "(role IN ('user','admin','super_admin','ib','sub_broker','master_trader'))"
    )
