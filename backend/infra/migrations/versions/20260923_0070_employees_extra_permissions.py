"""Phase 3: add employees.extra_permissions (present in the model, missing in
migrations).

The Employee model declares `extra_permissions JSONB`, and require_permission
(C-ADMIN-2) reads it on every admin request — but no migration ever added the
column, so a database built purely from migrations lacks it and admin auth would
error. Add it additively.

Additive: adds a nullable column with a default. downgrade() drops it.

Revision ID: 0070
Revises: 0069
"""
from alembic import op


revision = "0070"
down_revision = "0069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS extra_permissions "
        "JSONB DEFAULT '[]'::jsonb"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS extra_permissions")
