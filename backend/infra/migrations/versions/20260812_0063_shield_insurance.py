"""Ezymax Shield — aggregate period-plan trade insurance.

Adds the four Shield tables (separate product from the per-trade
insurance_policies / insurance_claims):

  * insurance_shield_plans   — admin catalog (seeded with handbook defaults)
  * user_insurance_shield    — a user's purchased plan (one active per user)
  * insurance_shield_claims  — aggregate settlement records
  * insurance_shield_events  — audit trail

Mirrors the idempotent startup DDL in services/admin/main.py so both fresh
Alembic installs and already-running hosts converge on the same schema.

Revision ID: 0063
Revises: 0062
"""
from alembic import op

revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS insurance_shield_plans (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code          VARCHAR(32) NOT NULL UNIQUE,
            period        VARCHAR(10) NOT NULL,
            tier          VARCHAR(10) NOT NULL,
            coverage_pct  NUMERIC(5,2) NOT NULL,
            max_payout    NUMERIC(18,2) NOT NULL,
            premium       NUMERIC(18,2) NOT NULL,
            is_active     BOOLEAN NOT NULL DEFAULT true,
            sort_order    INTEGER NOT NULL DEFAULT 0,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ins_shield_plan_period_check CHECK (period IN ('daily','weekly','monthly')),
            CONSTRAINT ins_shield_plan_tier_check   CHECK (tier IN ('basic','plus','pro','elite')),
            CONSTRAINT uq_ins_shield_plan_period_tier UNIQUE (period, tier)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_insurance_shield (
            id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_id                   UUID REFERENCES insurance_shield_plans(id) ON DELETE SET NULL,
            period                    VARCHAR(10) NOT NULL,
            tier                      VARCHAR(10) NOT NULL,
            coverage_pct              NUMERIC(5,2) NOT NULL,
            max_payout                NUMERIC(18,2) NOT NULL,
            premium_paid              NUMERIC(18,2) NOT NULL,
            cumulative_eligible_loss  NUMERIC(18,2) NOT NULL DEFAULT 0,
            coverage_used             NUMERIC(18,2) NOT NULL DEFAULT 0,
            status                    VARCHAR(12) NOT NULL DEFAULT 'active',
            activated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at                TIMESTAMPTZ NOT NULL,
            created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT user_ins_shield_status_check
                CHECK (status IN ('active','expired','cancelled','replaced','exhausted'))
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_ins_shield_user_status "
        "ON user_insurance_shield (user_id, status)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_ins_shield_one_active "
        "ON user_insurance_shield (user_id) WHERE status = 'active'"
    )
    op.execute("""
        CREATE TABLE IF NOT EXISTS insurance_shield_claims (
            id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_insurance_id         UUID NOT NULL REFERENCES user_insurance_shield(id) ON DELETE CASCADE,
            user_id                   UUID NOT NULL REFERENCES users(id),
            position_id               UUID REFERENCES positions(id) ON DELETE SET NULL,
            trade_loss                NUMERIC(18,2) NOT NULL,
            cumulative_eligible_loss  NUMERIC(18,2) NOT NULL,
            payout_amount             NUMERIC(18,2) NOT NULL,
            transaction_id            UUID REFERENCES transactions(id),
            status                    VARCHAR(14) NOT NULL DEFAULT 'paid',
            created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ins_shield_claim_status_check
                CHECK (status IN ('paid','pending','approved','rejected','partial','under_review'))
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ins_shield_claim_shield "
        "ON insurance_shield_claims (user_insurance_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ins_shield_claim_user_created "
        "ON insurance_shield_claims (user_id, created_at)"
    )
    op.execute("""
        CREATE TABLE IF NOT EXISTS insurance_shield_events (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_insurance_id UUID REFERENCES user_insurance_shield(id) ON DELETE SET NULL,
            user_id           UUID NOT NULL REFERENCES users(id),
            type              VARCHAR(24) NOT NULL,
            detail            TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ins_shield_event_user_created "
        "ON insurance_shield_events (user_id, created_at)"
    )
    op.execute("""
        INSERT INTO insurance_shield_plans
            (code, period, tier, coverage_pct, max_payout, premium, sort_order)
        VALUES
            ('daily_basic',   'daily',   'basic', 20,   200,  19,  0),
            ('daily_plus',    'daily',   'plus',  30,   500,  45,  1),
            ('daily_pro',     'daily',   'pro',   40,  2000, 149,  2),
            ('daily_elite',   'daily',   'elite', 50,  5000, 399,  3),
            ('weekly_basic',  'weekly',  'basic', 20,   500,  39, 10),
            ('weekly_plus',   'weekly',  'plus',  30,  1000,  79, 11),
            ('weekly_pro',    'weekly',  'pro',   40,  5000, 299, 12),
            ('weekly_elite',  'weekly',  'elite', 50, 10000, 699, 13),
            ('monthly_basic', 'monthly', 'basic', 20,  1000,  89, 20),
            ('monthly_plus',  'monthly', 'plus',  30,  2500, 199, 21),
            ('monthly_pro',   'monthly', 'pro',   40,  7500, 549, 22),
            ('monthly_elite', 'monthly', 'elite', 50, 15000, 999, 23)
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS insurance_shield_events")
    op.execute("DROP TABLE IF EXISTS insurance_shield_claims")
    op.execute("DROP TABLE IF EXISTS user_insurance_shield")
    op.execute("DROP TABLE IF EXISTS insurance_shield_plans")
