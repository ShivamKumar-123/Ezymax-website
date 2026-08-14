"""Every user gets a referral code + auto-IB threshold.

Adds users.referral_code (unique) and backfills existing users, and seeds the
`ib_auto_min_referrals` setting. With this, any user can refer and is
auto-promoted to IB once they hit the threshold (no application). Mirrors the
idempotent startup DDL in services/admin/main.py.

Revision ID: 0065
Revises: 0064
"""
from alembic import op

revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16)")
    op.execute(
        "UPDATE users SET referral_code = upper(substr(md5(id::text || 'fxa'), 1, 8)) "
        "WHERE referral_code IS NULL"
    )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code ON users (referral_code)")
    op.execute("""
        INSERT INTO system_settings (key, value, description) VALUES
            ('ib_auto_min_referrals', '1'::jsonb, 'Referrals a user needs to be auto-promoted to IB')
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_referral_code")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS referral_code")
