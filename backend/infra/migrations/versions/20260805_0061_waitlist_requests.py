"""Waitlist requests — invite-only access gate.

A visitor submits (full name, email, phone) on the marketing landing site; an
admin approves or rejects it. On approval the trader User is minted and the
person is emailed generated credentials. No applicant password is stored.

Idempotent (CREATE TABLE IF NOT EXISTS).

Revision ID: 0061
Revises: 0060
"""
from alembic import op


revision = "0061"
down_revision = "0060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS waitlist_requests (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name         VARCHAR(200) NOT NULL,
            email             VARCHAR(255) NOT NULL,
            phone             VARCHAR(20),
            status            VARCHAR(20) NOT NULL DEFAULT 'pending',
            reviewed_by       UUID,
            reviewed_at       TIMESTAMPTZ,
            rejection_reason  TEXT,
            created_user_id   UUID,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT waitlist_requests_status_check
                CHECK (status IN ('pending','approved','rejected'))
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_waitlist_requests_email ON waitlist_requests (email)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_waitlist_requests_status ON waitlist_requests (status)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS waitlist_requests")
