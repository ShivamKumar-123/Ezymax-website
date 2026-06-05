"""Robust replacement for the users.role CHECK constraint.

Migration 0051 tried to widen the role CHECK to include 'demo_admin'
but its DROP predicate (ILIKE '%role%IN%') failed to match the actual
constraint definition because PostgreSQL rewrites
`CHECK (role IN ('a','b'))` into the normalised form
`CHECK ((role)::text = ANY (ARRAY['a'::varchar, 'b'::varchar]))` —
the string "role IN" never appears in pg_get_constraintdef output,
so the DROP was a no-op and the legacy constraint kept rejecting
INSERTs of role='demo_admin'.

This migration uses pg_constraint joined with pg_attribute to find
EVERY CHECK constraint that references the `role` column — by
catalog identity, not string match — and drops them all, then adds
a single canonical constraint with the full allowed-roles list.

Idempotent: running this after a previous successful run finds the
canonical `users_role_check` (added below), drops it, and re-adds
it with the same definition. No row touched.

Revision ID: 0052
Revises: 0051
"""
from alembic import op


revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


_ALLOWED_ROLES = (
    "user", "admin", "super_admin", "ib", "sub_broker", "master_trader",
    "demo_admin",
)


def upgrade() -> None:
    # Find any CHECK constraint on the users table whose definition
    # references the `role` column. The catalog join goes:
    #   pg_constraint  -- conrelid=users  AND contype='c'
    #     join unnest(conkey) -- column indices the constraint covers
    #     join pg_attribute -- look up the actual column name
    # If any of the referenced columns is `role`, drop the constraint.
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT c.conname
                  FROM pg_constraint c
                  JOIN unnest(c.conkey) AS k(attnum) ON TRUE
                  JOIN pg_attribute a
                    ON a.attrelid = c.conrelid
                   AND a.attnum = k.attnum
                 WHERE c.conrelid = 'users'::regclass
                   AND c.contype = 'c'
                   AND a.attname = 'role'
            LOOP
                EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', r.conname);
            END LOOP;
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
