"""Backfill email_verified=TRUE for existing Google-linked users.

Before this change, the Google OAuth handler created users with the
default `email_verified=false`, so they hit the OnboardingGate's email
OTP step on first sign-in even though Google had already verified
their mailbox upstream. The code is fixed in auth_service.google_oauth;
this migration cleans up the rows that were created under the old
behaviour.

Safe to run repeatedly — the `WHERE email_verified = false` clause
makes it a no-op once applied.

Revision ID: 0046
Revises: 0045
"""
from alembic import op


revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET email_verified = TRUE,
            email_verified_at = COALESCE(email_verified_at, NOW())
        WHERE google_id IS NOT NULL
          AND email_verified = FALSE;
        """
    )


def downgrade() -> None:
    # Intentional no-op. Reverting would log out every Google user
    # back into the OTP flow they've already passed — not useful.
    pass
