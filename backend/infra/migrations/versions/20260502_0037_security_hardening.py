"""Schema additions for the security/ops hardening pass.

Bundles four small additions into one revision to keep the chain short:

1. fund_move_approvals — pending admin add-fund / deduct-fund actions
   that need a SECOND admin to approve before money actually moves
   (C3 from the audit). Single admin can no longer drain the platform.

2. user_2fa_backup_codes — bcrypt-hashed one-time codes the user can
   download once after enabling 2FA, so a lost authenticator doesn't
   require a support-ticket account-recovery (which is the social-
   engineering attack path — H2).

3. idempotency_keys — generic (scope, key_hash) → response_json table
   used by deposit / withdrawal create endpoints to make HTTP retries
   safe. A network-blip retry of POST /wallet/deposit no longer
   creates two rows.

Revision ID: 0037
Revises: 0036
"""
from alembic import op


revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Two-person rule on admin fund moves ────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS fund_move_approvals (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            action          VARCHAR(20)  NOT NULL,    -- 'add_fund' | 'deduct_fund'
            target_user_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_account_id UUID       NULL,
            amount          NUMERIC(18,8) NOT NULL,
            source          VARCHAR(20)  NULL,        -- 'main_wallet' | 'trading_account'
            description     TEXT         NULL,
            requested_by    UUID         NOT NULL REFERENCES users(id),
            requested_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            approved_by     UUID         NULL REFERENCES users(id),
            approved_at     TIMESTAMPTZ  NULL,
            rejected_by     UUID         NULL REFERENCES users(id),
            rejected_at     TIMESTAMPTZ  NULL,
            rejection_reason TEXT        NULL,
            status          VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|executed
            executed_at     TIMESTAMPTZ  NULL,
            CONSTRAINT chk_fund_status CHECK (status IN ('pending','approved','rejected','executed'))
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_fund_approvals_status
            ON fund_move_approvals (status, requested_at DESC)
            WHERE status = 'pending';
    """)

    # Threshold (USD) above which the 2-person rule kicks in. Stored in
    # system_settings so finance can adjust without a deploy.
    op.execute("""
        INSERT INTO system_settings (key, value)
        VALUES ('fund_move_two_person_threshold', '500')
        ON CONFLICT (key) DO NOTHING;
    """)

    # ── 2FA backup codes ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_2fa_backup_codes (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            code_hash   VARCHAR(255) NOT NULL,   -- bcrypt
            used_at     TIMESTAMPTZ NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_2fa_backup_codes_user
            ON user_2fa_backup_codes (user_id) WHERE used_at IS NULL;
    """)

    # ── Idempotency keys ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS idempotency_keys (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scope           VARCHAR(40) NOT NULL,    -- 'deposit_create' | 'withdrawal_create' | ...
            key_hash        CHAR(64)    NOT NULL,    -- sha256 of (user_id || header)
            user_id         UUID        NULL REFERENCES users(id) ON DELETE CASCADE,
            response_status INTEGER     NOT NULL,
            response_json   TEXT        NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (scope, key_hash)
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_idempotency_created
            ON idempotency_keys (created_at);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS idempotency_keys;")
    op.execute("DROP TABLE IF EXISTS user_2fa_backup_codes;")
    op.execute("DROP TABLE IF EXISTS fund_move_approvals;")
    op.execute("DELETE FROM system_settings WHERE key = 'fund_move_two_person_threshold';")
