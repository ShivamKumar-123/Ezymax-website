"""Widen users.role CHECK constraint to include 'demo_admin'.

The original `init-db.sql:21` ships with:
    role VARCHAR(20) ... CHECK (role IN
        ('user', 'admin', 'super_admin', 'ib', 'sub_broker', 'master_trader'))

Migration 0050 introduced a `demo_admin` role for read-only admin
viewers — INSERTing one tripped the CHECK constraint and surfaced as a
500 from /api/v1/admin/demo-admins. This migration drops + recreates
the constraint with `demo_admin` added.

Idempotent: the DO $$ block finds the existing constraint by predicate
match (so unnamed inline CHECKs and named ones both get cleaned up)
and the ADD step uses a fixed name `users_role_check` so future
re-runs are a no-op.

Revision ID: 0051
Revises: 0050
"""
from alembic import op


revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


_ALLOWED_ROLES = (
    "user", "admin", "super_admin", "ib", "sub_broker", "master_trader",
    "demo_admin",
)


def upgrade() -> None:
    # Drop whatever constraint guards `role` today — the init-db.sql
    # ships an inline (unnamed) CHECK; older deploys may have re-named
    # it. Catching both shapes via pg_constraint inspection keeps this
    # migration safe across environments.
    op.execute(
        """
        DO $$
        DECLARE con_name TEXT;
        BEGIN
            SELECT conname INTO con_name
              FROM pg_constraint
             WHERE conrelid = 'users'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%role%IN%';
            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
        """
    )
    roles_csv = ",".join(f"'{r}'" for r in _ALLOWED_ROLES)
    op.execute(
        f"""
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ({roles_csv}));
        """
    )


def downgrade() -> None:
    # Remove `demo_admin` from the allowed list. Note: if any rows have
    # role='demo_admin' the constraint add will fail — the operator
    # should delete those rows first.
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;")
    legacy_roles = [r for r in _ALLOWED_ROLES if r != "demo_admin"]
    roles_csv = ",".join(f"'{r}'" for r in legacy_roles)
    op.execute(
        f"""
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ({roles_csv}));
        """
    )
