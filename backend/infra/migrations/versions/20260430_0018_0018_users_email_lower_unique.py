"""Case-insensitive uniqueness on users.email (lower(email)).

Revision ID: 0018
Revises: 0017
"""
from alembic import op


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Pre-flight: collapse any historical case-only duplicates so the new index can build.
    # We keep the oldest row (smallest created_at) and rewrite the email of any
    # collisions to a tagged form so the operator can review them later.
    op.execute("""
        WITH dupes AS (
            SELECT id,
                   lower(email) AS lemail,
                   row_number() OVER (PARTITION BY lower(email) ORDER BY created_at, id) AS rn
              FROM users
        )
        UPDATE users u
           SET email = u.email || '+dup' || d.id::text
          FROM dupes d
         WHERE u.id = d.id AND d.rn > 1;
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower
            ON users (lower(email));
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_users_email_lower;")
