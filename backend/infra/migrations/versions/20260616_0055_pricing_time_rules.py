"""Time-windowed spread / leverage rules.

Admin-defined windows (preset market session or custom day+hour range,
UTC) that override an instrument's spread (multiplier or absolute) and/or
cap its leverage. The market-data feed also layers live volatility
widening on top of the resolved base.

Idempotent (IF NOT EXISTS) — matches the admin startup DDL.

Revision ID: 0055
Revises: 0054
"""
from alembic import op


revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pricing_time_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(120) NOT NULL,
            scope VARCHAR(20) NOT NULL DEFAULT 'default',
            segment_id UUID REFERENCES instrument_segments(id) ON DELETE CASCADE,
            instrument_id UUID REFERENCES instruments(id) ON DELETE CASCADE,
            kind VARCHAR(12) NOT NULL DEFAULT 'custom',
            session VARCHAR(30),
            days_of_week JSONB,
            start_min INTEGER,
            end_min INTEGER,
            spread_mode VARCHAR(12) NOT NULL DEFAULT 'multiplier',
            spread_multiplier NUMERIC(8,3) DEFAULT 1,
            spread_value NUMERIC(18,8),
            spread_type VARCHAR(20) DEFAULT 'pips',
            leverage_cap INTEGER,
            priority INTEGER NOT NULL DEFAULT 0,
            is_enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            updated_by UUID
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pricing_time_rules_enabled ON pricing_time_rules (is_enabled)"
    )
    # Dynamic-spread global tunables live in system_settings (read by the
    # market-data feed). Seed sane defaults if absent.
    op.execute(
        """
        INSERT INTO system_settings (key, value, description)
        VALUES
            ('dynamic_spread_enabled',     'false'::jsonb, 'Widen spread with live market volatility'),
            ('dynamic_spread_max_mult',    '3.0'::jsonb,   'Max volatility spread multiplier'),
            ('dynamic_spread_sensitivity', '1.0'::jsonb,   'Volatility sensitivity (higher = widens faster)'),
            ('dynamic_spread_window_sec',  '60'::jsonb,    'Rolling window (seconds) for volatility calc')
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_pricing_time_rules_enabled")
    op.execute("DROP TABLE IF EXISTS pricing_time_rules")
    op.execute(
        "DELETE FROM system_settings WHERE key IN "
        "('dynamic_spread_enabled','dynamic_spread_max_mult',"
        "'dynamic_spread_sensitivity','dynamic_spread_window_sec')"
    )
