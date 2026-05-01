"""Phase 9a: VIP Pass stub.

Per XP_Reward_mechanism slide 18: $100 one-time pass that grants +20%
XP/AC/PS, higher limits, and a share of platform token burn. The
token-burn side isn't in this codebase yet, so we stub the schema +
admin toggle and ship the UI when token economics arrive.

Adds:
  - vip_passes table — one row per user who bought the pass.
  - users.is_vip flag for fast lookup at reward-time.
  - system_settings.vip_pass_enabled = false (default off).

Revision ID: 0030
Revises: 0029
"""
import sqlalchemy as sa
from alembic import op


revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS vip_passes (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            purchased_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            price_paid_usd  NUMERIC(18,2) NOT NULL DEFAULT 100,
            transaction_id  UUID,
            xp_boost_pct    INTEGER NOT NULL DEFAULT 20,
            ac_boost_pct    INTEGER NOT NULL DEFAULT 20,
            ps_boost_pct    INTEGER NOT NULL DEFAULT 20,
            burn_share_active BOOLEAN NOT NULL DEFAULT TRUE,
            cancelled_at    TIMESTAMPTZ
        );
    """)
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE;
    """)

    # Feature flag — ship the table + UI behind this so token-side work can
    # complete the loop later without another migration. value is JSONB.
    op.execute(sa.text("""
        INSERT INTO system_settings (key, value, description)
        VALUES (
          'vip_pass_enabled',
          'false'::jsonb,
          'Master switch for the VIP Pass purchase flow + boost application.'
        )
        ON CONFLICT (key) DO NOTHING
    """))


def downgrade() -> None:
    op.execute("DELETE FROM system_settings WHERE key = 'vip_pass_enabled';")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_vip;")
    op.execute("DROP TABLE IF EXISTS vip_passes;")
