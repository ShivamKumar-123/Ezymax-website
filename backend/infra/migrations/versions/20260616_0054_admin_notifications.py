"""Admin notification inbox (RMS alert bell).

Cross-cutting admin alert queue written by the suspicious-activity
detectors (shared-IP collisions, coordinated trading) and surfaced as
the notification bell in the admin topbar.

Idempotent (IF NOT EXISTS) — matches the admin service startup DDL.

Revision ID: 0054
Revises: 0053
"""
from alembic import op


revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS admin_notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category VARCHAR(40) NOT NULL,
            severity VARCHAR(16) NOT NULL DEFAULT 'medium',
            title VARCHAR(200) NOT NULL,
            body TEXT,
            meta JSONB,
            action_url VARCHAR(200),
            dedup_key VARCHAR(160),
            is_read BOOLEAN NOT NULL DEFAULT false,
            read_by UUID,
            read_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_admin_notif_dedup UNIQUE (dedup_key)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_notif_unread ON admin_notifications (is_read, created_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_admin_notif_unread")
    op.execute("DROP TABLE IF EXISTS admin_notifications")
