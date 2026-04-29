"""Trade insurance — policies + claims tables, plus seed system_settings.

Revision ID: 0014
Revises: 0013
"""
import json
from alembic import op


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


_DEFAULTS = {
    "insurance_enabled": True,
    "insurance_base_constant": 1.2,
    "insurance_tier_multipliers": {"basic": 1, "advanced": 2, "pro": 3, "elite": 4},
    "insurance_coverage_pct": {"basic": 20, "advanced": 30, "pro": 40, "elite": 50},
    "insurance_fee_cap": 6,
    "insurance_fee_cap_high_volume": 12,
    "insurance_high_volume_lots": 5,
    "insurance_max_cap_rules": {
        "basic":    [100,  0.10],
        "advanced": [300,  0.20],
        "pro":      [600,  0.30],
        "elite":    [1000, 0.50],
    },
    "insurance_min_trade_duration_seconds": 300,
    "insurance_anti_abuse_daily_claims": 2,
    "insurance_anti_abuse_daily_payout": 2000,
    "insurance_anti_abuse_cooldown_hours": 12,
    "insurance_dynamic_high_lev_threshold": 200,
    "insurance_dynamic_high_lev_surcharge": 0.20,
    "insurance_dynamic_no_sl_surcharge": 0.15,
    "insurance_dynamic_winrate_threshold": 0.65,
    "insurance_dynamic_winrate_surcharge": 0.15,
    "insurance_disable_atr_floor": 0.0001,
    "insurance_news_blackout_until": None,
}


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS insurance_policies (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_id      UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
            position_id     UUID UNIQUE REFERENCES positions(id) ON DELETE SET NULL,
            instrument_id   UUID NOT NULL REFERENCES instruments(id),
            tier            VARCHAR(16) NOT NULL,
            fee             NUMERIC(18,8) NOT NULL,
            coverage_pct    NUMERIC(5,2)  NOT NULL,
            max_cap         NUMERIC(18,8) NOT NULL,
            risk_score      NUMERIC(8,4)  NOT NULL,
            status          VARCHAR(16) NOT NULL DEFAULT 'active',
            activated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            settled_at      TIMESTAMPTZ,
            CONSTRAINT insurance_policies_tier_check
                CHECK (tier IN ('basic','advanced','pro','elite')),
            CONSTRAINT insurance_policies_status_check
                CHECK (status IN ('active','claimed','expired','denied'))
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ins_pol_user_status ON insurance_policies(user_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ins_pol_position    ON insurance_policies(position_id);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS insurance_claims (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            policy_id       UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
            user_id         UUID NOT NULL REFERENCES users(id),
            loss_amount     NUMERIC(18,8) NOT NULL,
            claim_amount    NUMERIC(18,8) NOT NULL,
            transaction_id  UUID REFERENCES transactions(id),
            paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ins_clm_user_paid_at ON insurance_claims(user_id, paid_at DESC);")

    # Seed default insurance settings (only if not already present).
    for key, value in _DEFAULTS.items():
        op.execute(
            f"""
            INSERT INTO system_settings (key, value)
            VALUES ('{key}', '{json.dumps(value)}'::jsonb)
            ON CONFLICT (key) DO NOTHING;
            """
        )


def downgrade() -> None:
    for key in _DEFAULTS:
        op.execute(f"DELETE FROM system_settings WHERE key = '{key}';")
    op.execute("DROP TABLE IF EXISTS insurance_claims;")
    op.execute("DROP TABLE IF EXISTS insurance_policies;")
