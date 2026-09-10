"""Capture the KYC document numbers, which were never stored at all.

Admin could see a user's uploaded ID image but not a single identifying
number next to it — nothing to type into a search, nothing to check a
duplicate against, nothing to quote back to a client.

PAN is stored in full: it is a tax identifier a broker is expected to hold.

Aadhaar deliberately is NOT. Only the last four digits (the part regulators
and clients expect to see) plus a keyed HMAC of the full number are kept.
The HMAC still answers the question that matters operationally — "has this
Aadhaar already been used on another account?" — via a unique index, while a
database leak yields nothing reusable and we never hold a full Aadhaar we
would then be obliged to protect. Recovering the number from these columns
is not possible, by design.

Revision ID: 0066
Revises: 0065
"""
from alembic import op


revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_last4 VARCHAR(4)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(64)")

    # Same PAN or same Aadhaar on two accounts is the duplicate-account signal
    # a desk actually acts on. Partial so the many NULLs stay unconstrained.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_pan_number "
        "ON users (pan_number) WHERE pan_number IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_aadhaar_hash "
        "ON users (aadhaar_hash) WHERE aadhaar_hash IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_aadhaar_hash")
    op.execute("DROP INDEX IF EXISTS uq_users_pan_number")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS aadhaar_hash")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS aadhaar_last4")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS pan_number")
