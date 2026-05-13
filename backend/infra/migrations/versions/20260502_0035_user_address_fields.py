"""Persist the address fields the profile page already collects.

Until now the trader profile UI rendered City / State / Postal inputs and
sent them with PUT /profile, but `users` didn't have columns for them
and `UpdateProfileRequest` didn't list them — Pydantic silently dropped
the values on the way in. This migration adds the missing columns so
the UI's existing fields actually persist, and makes them part of the
`profile_complete` gate so a user can't skip past them on first login.

  city          VARCHAR(100) — town / city of residence
  state         VARCHAR(100) — state / province
  postal_code   VARCHAR(20)  — ZIP / postal code

`users.address` already existed (Text, optional) and is reused for the
street address line. All four are nullable so existing rows stay valid.

Revision ID: 0035
Revises: 0034
"""
from alembic import op


revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS postal_code;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS state;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS city;")
