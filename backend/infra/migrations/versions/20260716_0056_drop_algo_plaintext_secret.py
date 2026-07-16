"""Drop plaintext algo API secrets — store only the SHA-256 hash.

The `api_secret` column held every bot credential in plaintext purely so the
dashboard could re-display it. Auth has always compared `secret_hash`, so a
DB dump (or any read-only SQL access) handed an attacker working trading
credentials for every algo account. The secret is now shown exactly once at
generation; a lost secret means regenerating the key pair.

Destroys the stored plaintext values by design — existing keys keep working
because the hash is untouched.

Revision ID: 0056
Revises: 0055
"""
from alembic import op


revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE algo_api_keys DROP COLUMN IF EXISTS api_secret")


def downgrade() -> None:
    # Recreate the column shape only — the plaintext values are gone forever,
    # which is the entire point of this migration.
    op.execute("ALTER TABLE algo_api_keys ADD COLUMN IF NOT EXISTS api_secret VARCHAR(128)")
