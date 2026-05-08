"""Security hardening pass — wallet cooldowns, step-up auth challenges,
wallet metadata, and per-withdrawal forensic snapshot fields.

Adds three pieces:

1. wallet_cooldowns
   When a user disconnects a wallet, we insert a row capturing the
   address + prior_user_id + 24-hour reusable_after timestamp. The
   wallet-link flow LEFT JOINs against this table and refuses with a
   clear error if any active cooldown row matches the candidate
   address. This stops account-A → disconnect → account-B → instant-
   takeover attacks within the cooldown window. Cleaner than putting
   cooldown state on `users` because a disconnected wallet doesn't
   belong to any user, and historical rows are useful for fraud audit.

2. sensitive_action_challenges
   Polymorphic table powering the async step-up auth flow (currently
   used for email-change OTP-to-OLD-email; future hooks: TOTP /
   passkey assertions / hardware-wallet challenges). One row per
   challenge attempt with `action`, `method`, `challenge_data` (JSONB
   — per-method state like OTP code-hash, SIWE nonce), `metadata`
   (action-specific context like the target email), `attempts`,
   `verified_at`, `consumed_at`. Inline step-up (password / fresh
   SIWE in the same request body) does NOT use this table — only
   async multi-roundtrip flows do.

3. Wallet metadata + withdrawal snapshot
   - users.wallet_chain VARCHAR(20)        — eth | bsc | polygon | arbitrum | tron | …
   - users.wallet_connected_at TIMESTAMPTZ — when current wallet was linked
   - users.wallet_disconnected_at TIMESTAMPTZ — when last wallet was disconnected (cleared on next link)
   - withdrawals.wallet_chain_snapshot VARCHAR(20)   — chain at submit time
   - withdrawals.verification_method VARCHAR(40)     — siwe | password | totp (future)
   The Withdrawal already has crypto_address — that's effectively the
   wallet snapshot. The two new columns capture the chain context and
   which step-up method the user used at submit time, so support /
   audit can reconstruct exactly how a payout was authorised.

All additive. No data destruction. Existing rows + sessions unchanged.

Revision ID: 0042
Revises: 0041
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── wallet_cooldowns ──────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS wallet_cooldowns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            wallet_address VARCHAR(64) NOT NULL,
            wallet_chain VARCHAR(20) NULL,
            prior_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            disconnected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            reusable_after TIMESTAMPTZ NOT NULL,
            reason VARCHAR(40) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    # Lookup pattern is "any active cooldown for this lowercase address?"
    # — a partial index on the lowercase address with reusable_after as a
    # secondary sort lets the cooldown check be a single index seek.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_wallet_cooldowns_lower_addr
            ON wallet_cooldowns (LOWER(wallet_address), reusable_after);
        """
    )

    # ── sensitive_action_challenges ───────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sensitive_action_challenges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(40) NOT NULL,
            method VARCHAR(40) NOT NULL,
            challenge_data JSONB NULL,
            metadata JSONB NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            verified_at TIMESTAMPTZ NULL,
            consumed_at TIMESTAMPTZ NULL,
            CONSTRAINT sensitive_action_challenges_action_check
                CHECK (action IN (
                    'email_change',
                    'wallet_link',
                    'wallet_disconnect',
                    'withdrawal',
                    'password_reset'
                )),
            CONSTRAINT sensitive_action_challenges_method_check
                CHECK (method IN (
                    'password',
                    'siwe',
                    'otp_old_email',
                    'totp',
                    'passkey'
                ))
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_sensitive_action_challenges_user_action
            ON sensitive_action_challenges (user_id, action, expires_at)
         WHERE consumed_at IS NULL;
        """
    )

    # ── users — wallet metadata ───────────────────────────────────────────
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_chain VARCHAR(20);"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMPTZ;"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_disconnected_at TIMESTAMPTZ;"
    )
    # Backfill: any user with a wallet today gets connected_at = created_at
    # as a placeholder (we don't have the real link-time timestamp on
    # historical data). Better than NULL because audit reports can sort.
    op.execute(
        """
        UPDATE users
           SET wallet_connected_at = created_at
         WHERE wallet_address IS NOT NULL
           AND wallet_connected_at IS NULL;
        """
    )

    # ── withdrawals — snapshot fields ─────────────────────────────────────
    op.execute(
        "ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS wallet_chain_snapshot VARCHAR(20);"
    )
    op.execute(
        "ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS verification_method VARCHAR(40);"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE withdrawals DROP COLUMN IF EXISTS verification_method;")
    op.execute("ALTER TABLE withdrawals DROP COLUMN IF EXISTS wallet_chain_snapshot;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS wallet_disconnected_at;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS wallet_connected_at;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS wallet_chain;")
    op.execute("DROP INDEX IF EXISTS ix_sensitive_action_challenges_user_action;")
    op.execute("DROP TABLE IF EXISTS sensitive_action_challenges;")
    op.execute("DROP INDEX IF EXISTS ix_wallet_cooldowns_lower_addr;")
    op.execute("DROP TABLE IF EXISTS wallet_cooldowns;")
