"""Add book_type column to users (A-book / B-book routing flag).

Revision ID: 0013
Revises: 0012
"""
from alembic import op


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS book_type VARCHAR(1) NOT NULL DEFAULT 'B';
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS book_type;")
