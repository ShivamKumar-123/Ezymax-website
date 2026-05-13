"""Phase 1: daily streak columns + extended mission periods + expires_at.

Revision ID: 0019
Revises: 0018
"""
import sqlalchemy as sa
from alembic import op


revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- 1. Daily streak fields on rewards_user_state ---
    op.execute("""
        ALTER TABLE rewards_user_state
            ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0;
    """)
    op.execute("""
        ALTER TABLE rewards_user_state
            ADD COLUMN IF NOT EXISTS last_streak_date DATE;
    """)

    # --- 2. Widen `period` from VARCHAR(10) to VARCHAR(20). 'achievement' is
    #         11 characters and the original column was capped at 10, so
    #         seed inserts below would fail with StringDataRightTruncation
    #         until the column itself is widened.
    op.execute("ALTER TABLE rewards_missions ALTER COLUMN period TYPE VARCHAR(20);")

    # --- 3. Extend rewards_missions.period enum to include bonus/flash/achievement.
    # The original CHECK was defined inline without a name; Postgres assigns an auto
    # name like "rewards_missions_period_check". Drop-if-exists then re-add the
    # widened constraint so the migration is safe to run on databases where the
    # constraint may have a different name (e.g. via a manual fix).
    op.execute("""
        DO $$
        DECLARE
            con_name TEXT;
        BEGIN
            SELECT conname INTO con_name
              FROM pg_constraint
             WHERE conrelid = 'rewards_missions'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%period%';
            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE rewards_missions DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    """)
    op.execute("""
        ALTER TABLE rewards_missions
          ADD CONSTRAINT rewards_missions_period_check
          CHECK (period IN ('daily','weekly','bonus','flash','achievement'));
    """)

    # --- 3. Optional expiry timestamp for flash/event missions (NULL = evergreen) ---
    op.execute("""
        ALTER TABLE rewards_missions
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    """)

    # --- 4. Seed two starter missions in the new periods so the Bonus + Achievements
    #         tabs aren't empty on day one. Idempotent via slug uniqueness. ---
    seeds = [
        # Bonus tab — limited-time signup bonus (no expiry on the row, but the
        # backend service can apply per-user one-shot logic via period_key).
        ("bonus_first_trade", "bonus", "First Trade Bonus",
         "Place your first ever trade and bag a one-time reward.",
         "first_trade", 1, 50, 30, 1),
        # Achievement tab — lifetime "trade $10k volume" badge.
        ("achievement_volume_10k", "achievement", "Trader Tier I",
         "Reach $10,000 lifetime trading volume.",
         "trade_volume_lifetime_usd", 10000, 200, 100, 1),
    ]
    stmt = sa.text("""
        INSERT INTO rewards_missions
          (slug, period, title, description, action_kind, target_count,
           xp_reward, ac_reward, display_order)
        VALUES
          (:slug, :period, :title, :description, :action_kind, :target_count,
           :xp_reward, :ac_reward, :display_order)
        ON CONFLICT (slug) DO NOTHING
    """)
    bind = op.get_bind()
    for s in seeds:
        bind.execute(stmt, dict(
            slug=s[0], period=s[1], title=s[2], description=s[3],
            action_kind=s[4], target_count=s[5],
            xp_reward=s[6], ac_reward=s[7], display_order=s[8],
        ))


def downgrade() -> None:
    op.execute("DELETE FROM rewards_missions WHERE slug IN ('bonus_first_trade','achievement_volume_10k');")
    op.execute("ALTER TABLE rewards_missions DROP COLUMN IF EXISTS expires_at;")
    op.execute("""
        DO $$
        DECLARE
            con_name TEXT;
        BEGIN
            SELECT conname INTO con_name
              FROM pg_constraint
             WHERE conrelid = 'rewards_missions'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%period%';
            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE rewards_missions DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    """)
    op.execute("""
        ALTER TABLE rewards_missions
          ADD CONSTRAINT rewards_missions_period_check
          CHECK (period IN ('daily','weekly'));
    """)
    op.execute("ALTER TABLE rewards_missions ALTER COLUMN period TYPE VARCHAR(10);")
    op.execute("ALTER TABLE rewards_user_state DROP COLUMN IF EXISTS last_streak_date;")
    op.execute("ALTER TABLE rewards_user_state DROP COLUMN IF EXISTS streak_count;")
