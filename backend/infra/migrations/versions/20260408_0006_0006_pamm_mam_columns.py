"""Add PAMM/MAM columns: total_fee_earned on master_accounts, last_distribution_at on investor_allocations.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_accounts",
        sa.Column("total_fee_earned", sa.Numeric(18, 8), nullable=True, server_default="0"),
    )
    op.add_column(
        "investor_allocations",
        sa.Column("last_distribution_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("investor_allocations", "last_distribution_at")
    op.drop_column("master_accounts", "total_fee_earned")
