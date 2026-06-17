"""RMS / IP-management tables.

Adds the two tables behind the superadmin IP-management module:

  * ``ip_geo_cache``  — per-IP geo-resolution cache (populated by the
    gateway rms_engine via the GeoIP provider).
  * ``rms_alerts``    — shared-IP collision alerts for admin review.

Plus a supporting index on ``user_sessions.ip_address`` (the RMS read
queries group/scan by IP) and an index on ``ip_logs`` for the same.

Idempotent: every statement is IF NOT EXISTS, so this is safe to run on
a host where the admin service's startup DDL already created the tables.

Revision ID: 0053
Revises: 0052
"""
from alembic import op


revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ip_geo_cache (
            ip_address INET PRIMARY KEY,
            status VARCHAR(16) NOT NULL DEFAULT 'resolved',
            country VARCHAR(80),
            country_code VARCHAR(4),
            region VARCHAR(120),
            city VARCHAR(120),
            latitude NUMERIC(9,6),
            longitude NUMERIC(9,6),
            isp VARCHAR(160),
            org VARCHAR(160),
            timezone VARCHAR(64),
            is_proxy BOOLEAN,
            is_hosting BOOLEAN,
            resolved_at TIMESTAMPTZ DEFAULT now(),
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rms_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            alert_type VARCHAR(40) NOT NULL DEFAULT 'shared_ip',
            ip_address INET NOT NULL,
            user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            user_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(16) NOT NULL DEFAULT 'open',
            severity VARCHAR(16) NOT NULL DEFAULT 'medium',
            notes TEXT,
            reviewed_by UUID,
            reviewed_at TIMESTAMPTZ,
            first_seen_at TIMESTAMPTZ DEFAULT now(),
            last_seen_at TIMESTAMPTZ DEFAULT now(),
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_rms_alert_type_ip UNIQUE (alert_type, ip_address)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_rms_alerts_status ON rms_alerts (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_sessions_ip ON user_sessions (ip_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ip_logs_ip ON ip_logs (ip_address)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ip_logs_user_created ON ip_logs (user_id, created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_ip_logs_user_created")
    op.execute("DROP INDEX IF EXISTS ix_ip_logs_ip")
    op.execute("DROP INDEX IF EXISTS ix_user_sessions_ip")
    op.execute("DROP INDEX IF EXISTS ix_rms_alerts_status")
    op.execute("DROP TABLE IF EXISTS rms_alerts")
    op.execute("DROP TABLE IF EXISTS ip_geo_cache")
