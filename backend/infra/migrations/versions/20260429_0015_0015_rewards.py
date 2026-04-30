"""Rewards engine — XP/AC/PS state, mission templates + per-user progress, store items.

Revision ID: 0015
Revises: 0014
"""
import json

import sqlalchemy as sa
from alembic import op


revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


_LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 5000, 8000, 12000, 18000, 26000, 36000]


def upgrade() -> None:
    # Per-user rewards state.
    op.execute("""
        CREATE TABLE IF NOT EXISTS rewards_user_state (
            user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            xp           INTEGER NOT NULL DEFAULT 0,
            ac_balance   NUMERIC(18,2) NOT NULL DEFAULT 0,
            ps           BIGINT NOT NULL DEFAULT 0,
            last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)

    # Mission catalogue.
    op.execute("""
        CREATE TABLE IF NOT EXISTS rewards_missions (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug          VARCHAR(60) UNIQUE NOT NULL,
            period        VARCHAR(10) NOT NULL CHECK (period IN ('daily','weekly')),
            title         VARCHAR(120) NOT NULL,
            description   TEXT NOT NULL,
            action_kind   VARCHAR(40) NOT NULL,
            target_count  INTEGER NOT NULL DEFAULT 1,
            xp_reward     INTEGER NOT NULL DEFAULT 0,
            ac_reward     NUMERIC(18,2) NOT NULL DEFAULT 0,
            is_active     BOOLEAN NOT NULL DEFAULT TRUE,
            display_order INTEGER NOT NULL DEFAULT 0
        );
    """)

    # Per-user, per-period mission progress.
    op.execute("""
        CREATE TABLE IF NOT EXISTS rewards_user_mission_progress (
            user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mission_id   UUID NOT NULL REFERENCES rewards_missions(id) ON DELETE CASCADE,
            period_key   VARCHAR(20) NOT NULL,
            progress     INTEGER NOT NULL DEFAULT 0,
            completed_at TIMESTAMPTZ,
            claimed_at   TIMESTAMPTZ,
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, mission_id, period_key)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_rump_user_period ON rewards_user_mission_progress(user_id, period_key);")

    # Reward store items.
    op.execute("""
        CREATE TABLE IF NOT EXISTS reward_store_items (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug        VARCHAR(60) UNIQUE NOT NULL,
            category    VARCHAR(20) NOT NULL CHECK (category IN ('cashback','bonus','perk','tool')),
            label       VARCHAR(120) NOT NULL,
            description TEXT,
            ac_price    NUMERIC(18,2) NOT NULL,
            payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            display_order INTEGER NOT NULL DEFAULT 0
        );
    """)

    # Audit log of XP/AC events.
    op.execute("""
        CREATE TABLE IF NOT EXISTS rewards_transactions (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type         VARCHAR(30) NOT NULL,
            xp_delta     INTEGER NOT NULL DEFAULT 0,
            ac_delta     NUMERIC(18,2) NOT NULL DEFAULT 0,
            source       VARCHAR(60),
            reference_id UUID,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_rewards_tx_user_created ON rewards_transactions(user_id, created_at DESC);")

    # Seed default missions (idempotent — only insert if slug not present).
    seeds = [
        ("daily_place_trades", "daily", "Place 3 Trades",
         "Execute any 3 trades in any market.", "place_trades", 3, 20, 10, 1),
        ("daily_copy_trade", "daily", "Copy a Trade",
         "Copy any top trader's trade.", "copy_trade", 1, 15, 10, 2),
        ("daily_refer_friend", "daily", "Refer a Friend",
         "Invite a friend to join FXArtha.", "refer_friend", 1, 30, 20, 3),
        ("daily_trade_volume", "daily", "Trade Volume",
         "Achieve $1,000 trading volume.", "trade_volume_usd", 1000, 25, 15, 4),
        ("weekly_win_streak", "weekly", "Win Streak x5",
         "Close 5 winning trades in a row.", "win_streak", 5, 120, 75, 1),
        ("weekly_deposit", "weekly", "Deposit $500",
         "Top up your wallet by $500 this week.", "deposit_usd", 500, 80, 50, 2),
    ]
    mission_stmt = sa.text("""
        INSERT INTO rewards_missions
          (slug, period, title, description, action_kind, target_count, xp_reward, ac_reward, display_order)
        VALUES
          (:slug, :period, :title, :description, :action_kind, :target_count, :xp_reward, :ac_reward, :display_order)
        ON CONFLICT (slug) DO NOTHING
    """)
    bind = op.get_bind()
    for s in seeds:
        bind.execute(mission_stmt, dict(
            slug=s[0], period=s[1], title=s[2], description=s[3],
            action_kind=s[4], target_count=s[5], xp_reward=s[6],
            ac_reward=s[7], display_order=s[8],
        ))

    store_seeds = [
        ("cashback_100",        "cashback", "Cashback 100",
         "Get a 100 cashback credited to your main wallet.", 200,
         {"kind": "cashback", "amount": 100}, 1),
        ("bonus_500",           "bonus",    "Trading Bonus 500",
         "Add a 500 trading bonus to a chosen account.", 800,
         {"kind": "trading_bonus", "amount": 500}, 2),
        ("zero_brokerage_1d",   "perk",     "Zero Brokerage 1 Day Pass",
         "24h commission-free trading on all instruments.", 1000,
         {"kind": "zero_commission_hours", "hours": 24}, 3),
        ("premium_signals_1mo", "tool",     "Premium Signals 1 Month",
         "Daily curated trade ideas for one month.", 1500,
         {"kind": "signals_days", "days": 30}, 4),
    ]
    store_stmt = sa.text("""
        INSERT INTO reward_store_items
          (slug, category, label, description, ac_price, payload, display_order)
        VALUES
          (:slug, :category, :label, :description, :ac_price, CAST(:payload AS JSONB), :display_order)
        ON CONFLICT (slug) DO NOTHING
    """)
    for s in store_seeds:
        bind.execute(store_stmt, dict(
            slug=s[0], category=s[1], label=s[2], description=s[3],
            ac_price=s[4], payload=json.dumps(s[5]), display_order=s[6],
        ))


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rewards_transactions;")
    op.execute("DROP TABLE IF EXISTS rewards_user_mission_progress;")
    op.execute("DROP TABLE IF EXISTS reward_store_items;")
    op.execute("DROP TABLE IF EXISTS rewards_missions;")
    op.execute("DROP TABLE IF EXISTS rewards_user_state;")
