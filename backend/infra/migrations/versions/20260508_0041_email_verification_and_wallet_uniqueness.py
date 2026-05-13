"""Email verification + wallet uniqueness for the strict onboarding rule.

Two intertwined goals:

1. Every account must have exactly **one verified email**:
   - Adds users.email_verified BOOLEAN DEFAULT FALSE
   - Adds users.email_verified_at TIMESTAMPTZ NULL
   - Backfills email_verified = TRUE for accounts created via Google
     sign-in (Google verifies the address upstream, no point asking
     them to verify again).
   - Adds the email_otp_codes table that powers the
     /auth/email/start-verification + /auth/email/verify-otp flow.

2. Every account must have at most **one linked wallet**, and any given
   wallet may be linked to at most **one account at a time**:
   - The User model already has a single wallet_address column
     (so "one account = one wallet" is a structural constraint).
   - Adds a partial UNIQUE index on LOWER(wallet_address) WHERE
     wallet_address IS NOT NULL so racing link attempts can't both
     succeed.

Backwards-compatible. Existing rows with no wallet stay as-is. Existing
sessions are unaffected — onboarding_complete is computed at /auth/me
time, so the gate kicks in on the next request without needing a
forced logout.

Revision ID: 0041
Revises: 0040
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. email_verified flag on users.
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;"
    )

    # 2. Google sign-ins backfill — Google has already verified the
    # email upstream, so we don't make those users go through OTP again.
    # Anyone with a non-null google_id and a real (non-placeholder) email
    # gets flagged verified at migration time.
    op.execute(
        """
        UPDATE users
           SET email_verified = TRUE,
               email_verified_at = NOW()
         WHERE google_id IS NOT NULL
           AND email IS NOT NULL
           AND email NOT LIKE '%@wallet.fxartha.local'
           AND email_verified = FALSE;
        """
    )

    # 3. Partial UNIQUE index on wallet_address so the same wallet
    # cannot be linked to two accounts. Wallet addresses are stored
    # lowercase per the linking service; the LOWER() wrapper is a
    # belt-and-suspenders guard against any legacy rows that slipped
    # in before normalization was enforced.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wallet_address_unique
            ON users (LOWER(wallet_address))
         WHERE wallet_address IS NOT NULL;
        """
    )

    # 4. email_otp_codes — one row per outstanding verification attempt.
    # We hash the OTP code itself so a DB leak doesn't expose live codes.
    # `target_email` is the address being verified (NOT necessarily the
    # current users.email — for the change-email flow they differ until
    # verification completes). `attempts` caps brute-force tries.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS email_otp_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_email VARCHAR(255) NOT NULL,
            code_hash VARCHAR(128) NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ NULL
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_email_otp_codes_user_active
            ON email_otp_codes (user_id, expires_at)
         WHERE consumed_at IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_email_otp_codes_user_active;")
    op.execute("DROP TABLE IF EXISTS email_otp_codes;")
    op.execute("DROP INDEX IF EXISTS ix_users_wallet_address_unique;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified;")
