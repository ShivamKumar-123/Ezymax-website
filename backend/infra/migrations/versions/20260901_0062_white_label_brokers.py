"""White-label brokers (rental model), ported from the stock4x tenant design.

Adds:
  * users.assigned_broker_id  — which broker's pool owns the user (NULL =
    platform pool). Also set on sub-broker rows (their parent broker).
  * users.broker_ancestry     — materialised ancestor path (uuid[], GIN
    indexed) so "everything under this broker" is one containment query.
  * users.signup_origin       — platform | broker_referral | custom_domain.
  * broker_profiles           — one row per role='broker' user: tri-state
    section permissions, branding (name/logo/support contacts), custom
    domain lifecycle, and rental terms (plan/amount/period/next-due).

`custom_domain` uniqueness uses a PARTIAL unique index so any number of
rows can leave it NULL while at most one row claims any given domain
(same trick stock4x needed partialFilterExpression for in Mongo).

Everything is additive + idempotent (IF NOT EXISTS) so re-running on a
host that already picked the DDL up via the admin service's startup
bootstrap is harmless.

Revision ID: 0062
Revises: 0061
"""
from alembic import op


revision = "0062"
down_revision = "0061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_broker_id UUID "
        "REFERENCES users(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS broker_ancestry UUID[] "
        "NOT NULL DEFAULT '{}'"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_origin VARCHAR(20)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_assigned_broker_id "
        "ON users(assigned_broker_id) WHERE assigned_broker_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_broker_ancestry "
        "ON users USING GIN (broker_ancestry)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS broker_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            partner_code VARCHAR(20) UNIQUE NOT NULL,
            permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
            brand_name VARCHAR(100),
            logo_url TEXT,
            support_email VARCHAR(255),
            support_whatsapp VARCHAR(32),
            custom_domain VARCHAR(255),
            app_subdomain VARCHAR(63),
            custom_domain_status VARCHAR(20),
            custom_domain_last_error TEXT,
            custom_domain_provisioned_at TIMESTAMPTZ,
            rental_plan VARCHAR(50),
            rental_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            rental_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
            rental_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
            rental_next_due DATE,
            rental_notes TEXT,
            is_suspended BOOLEAN NOT NULL DEFAULT false,
            suspended_reason TEXT,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_broker_profiles_custom_domain "
        "ON broker_profiles (custom_domain) WHERE custom_domain IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS broker_profiles")
    op.execute("DROP INDEX IF EXISTS idx_users_broker_ancestry")
    op.execute("DROP INDEX IF EXISTS idx_users_assigned_broker_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS signup_origin")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS broker_ancestry")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS assigned_broker_id")
