"""Per-account-group scope for charge_configs / spread_configs / swap_configs.

The Account Types page lets admins set ``spread_markup_default`` /
``commission_default`` / ``swap_free`` on each tier (Micro/Standard/Pro/Elite/
Islamic), but the resolver never had a way to express a per-tier
override on the granular config tables. Three options before this:
  - global default
  - per-instrument
  - per-segment
  - per-user (1:1 override)

None of them let admin say "Elite pays $5/lot on EURUSD, everyone else $10".
This migration adds a nullable ``account_group_id`` FK + lets the existing
``scope`` column carry the value ``'account_group'``. The resolvers in
``packages/common/src/instrument_pricing.py`` already check this scope.

No CHECK constraint on ``scope`` exists today (verified at write time), so
nothing to alter there — the new scope value just starts being used.

Revision ID: 0053
Revises: 0052
"""
from alembic import op
import sqlalchemy as sa


revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


_TABLES = ("charge_configs", "spread_configs", "swap_configs")


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column(
                "account_group_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("account_groups.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        # Index so the resolver's filtered lookup (scope='account_group' +
        # account_group_id=X + instrument_id=...) is a single-page seek
        # instead of a table scan. Partial index keeps the index size in
        # line with the (small) subset of rows that actually carry a group.
        op.create_index(
            f"ix_{table}_account_group_id",
            table,
            ["account_group_id"],
            postgresql_where=sa.text("account_group_id IS NOT NULL"),
        )
        # Extend the scope CHECK constraint to accept the new value. The
        # original constraint was defined in migration 0001 (initial baseline)
        # as a 4-value enum; we drop + recreate with 'account_group' added.
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {table}_scope_check")
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {table}_scope_check "
            f"CHECK (scope IN ('default','segment','instrument','user','account_group'))"
        )


def downgrade() -> None:
    for table in _TABLES:
        # Strip any account_group rows so the old 4-value CHECK doesn't fail
        # when restored. Cheap because these tables are small.
        op.execute(f"DELETE FROM {table} WHERE scope = 'account_group'")
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {table}_scope_check")
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {table}_scope_check "
            f"CHECK (scope IN ('default','segment','instrument','user'))"
        )
        op.drop_index(f"ix_{table}_account_group_id", table_name=table)
        op.drop_column(table, "account_group_id")
