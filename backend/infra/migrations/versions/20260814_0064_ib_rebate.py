"""IB rebate model (Milele-style tiered per-lot accrual).

Adds ib_rebate_periods (per IB per month accumulator + settlement tracker) and
ib_rebate_settlements (audit per payout), and seeds the default config in
system_settings. Mirrors the idempotent startup DDL in services/admin/main.py.
The `ib_commission_model` setting seeds to 'instant' so nothing changes until an
admin switches it to 'accrual'.

Revision ID: 0064
Revises: 0063
"""
from alembic import op

revision = "0064"
down_revision = "0063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS ib_rebate_periods (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ib_id             UUID NOT NULL REFERENCES ib_profiles(id) ON DELETE CASCADE,
            period            VARCHAR(7) NOT NULL,
            eligible_lots     NUMERIC(18,4) NOT NULL DEFAULT 0,
            active_clients    INTEGER NOT NULL DEFAULT 0,
            tier              VARCHAR(20) NOT NULL DEFAULT 'starter',
            rate_per_lot      NUMERIC(18,8) NOT NULL DEFAULT 0,
            own_target        NUMERIC(18,8) NOT NULL DEFAULT 0,
            own_settled       NUMERIC(18,8) NOT NULL DEFAULT 0,
            override_settled  NUMERIC(18,8) NOT NULL DEFAULT 0,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_ib_rebate_period UNIQUE (ib_id, period)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ib_rebate_period_period ON ib_rebate_periods (period)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS ib_rebate_settlements (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ib_id          UUID NOT NULL REFERENCES ib_profiles(id) ON DELETE CASCADE,
            period         VARCHAR(7) NOT NULL,
            kind           VARCHAR(12) NOT NULL,
            level          INTEGER NOT NULL DEFAULT 0,
            source_ib_id   UUID REFERENCES ib_profiles(id) ON DELETE SET NULL,
            amount         NUMERIC(18,8) NOT NULL,
            transaction_id UUID REFERENCES transactions(id),
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ib_rebate_settle_ib_period ON ib_rebate_settlements (ib_id, period)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ib_rebate_settle_created ON ib_rebate_settlements (created_at)")
    op.execute("""
        -- NOTE: the spaces after the colons in the JSON below are load-bearing.
        -- op.execute() routes this through sqlalchemy.text(), which treats
        -- ":name" as a bind parameter -- and `"min_lots":0` matches, so the
        -- literal was compiled with $1/$2 placeholders in place of the values
        -- and the statement died with "A value is required for bind parameter
        -- '0'". It only ever bites a FRESH database: an existing one already
        -- had these rows from the idempotent startup DDL, so the migration was
        -- never exercised. A space after the colon stops the match and leaves
        -- the JSON identical.
        INSERT INTO system_settings (key, value, description) VALUES
            ('ib_commission_model', '"instant"'::jsonb, 'IB payout model: instant or accrual'),
            ('ib_rebate_tiers',
              '[{"tier": "starter", "min_lots": 0, "min_clients": 0, "rate": 3}, {"tier": "builder", "min_lots": 200, "min_clients": 3, "rate": 5}, {"tier": "pro", "min_lots": 500, "min_clients": 10, "rate": 7}]'::jsonb,
              'IB rebate tier ladder (per closed lot)'),
            ('ib_override_pcts', '[10,5,2.5]'::jsonb, 'Upline override % by depth'),
            ('ib_override_cap_pct', '20'::jsonb, 'Max total override (%)'),
            ('ib_override_max_levels', '8'::jsonb, 'Max upline depth'),
            ('ib_active_client_min_lots', '0.5'::jsonb, 'Closed lots/month for active client'),
            ('ib_active_require_kyc', 'true'::jsonb, 'Active client must be KYC-verified'),
            ('ib_active_require_deposit', 'true'::jsonb, 'Active client must have deposited'),
            ('ib_rebate_all_instruments', 'true'::jsonb, 'Count all instruments')
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ib_rebate_settlements")
    op.execute("DROP TABLE IF EXISTS ib_rebate_periods")
