"""AI Strategy Builder tables.

Users describe a strategy in natural language; the AI turns it into a
declarative JSON DSL (packages/common/src/strategy_dsl.py); the user
backtests it against ohlc_bars history and deploys it onto any of their
trading accounts. Live trades go through the canonical execution path and
are tagged in ai_strategy_trades so the UI can display AI-generated trades
separately from manual ones.

Revision ID: 0059
Revises: 0058
"""
from alembic import op


revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_strategies (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            prompt TEXT,
            dsl JSONB NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT ai_strategies_status_check
                CHECK (status IN ('draft', 'active', 'archived'))
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategies_user ON ai_strategies(user_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_strategy_backtests (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            strategy_id UUID NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            params JSONB NOT NULL,
            dsl_snapshot JSONB NOT NULL,
            stats JSONB NOT NULL,
            equity_curve JSONB NOT NULL,
            trades JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategy_backtests_strategy "
        "ON ai_strategy_backtests(strategy_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_strategy_instances (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            strategy_id UUID NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
            dsl_snapshot JSONB NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'running',
            last_eval_bar_ts INTEGER NOT NULL DEFAULT 0,
            trades_count INTEGER NOT NULL DEFAULT 0,
            error_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            stopped_at TIMESTAMPTZ,
            CONSTRAINT ai_strategy_instances_status_check
                CHECK (status IN ('running', 'stopped', 'error'))
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategy_instances_user "
        "ON ai_strategy_instances(user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategy_instances_running "
        "ON ai_strategy_instances(status) WHERE status = 'running'"
    )
    # One running instance per (strategy, account) — re-deploying the same
    # strategy onto the same account requires stopping the old instance.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_instance_strategy_account_running "
        "ON ai_strategy_instances(strategy_id, account_id) WHERE status = 'running'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_strategy_trades (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            instance_id UUID NOT NULL REFERENCES ai_strategy_instances(id) ON DELETE CASCADE,
            strategy_id UUID NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            order_id UUID,
            position_id UUID,
            side VARCHAR(8) NOT NULL,
            lots NUMERIC(10,2) NOT NULL,
            signal_bar_ts INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategy_trades_user "
        "ON ai_strategy_trades(user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategy_trades_position "
        "ON ai_strategy_trades(position_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ai_strategy_trades_instance "
        "ON ai_strategy_trades(instance_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_strategy_trades")
    op.execute("DROP TABLE IF EXISTS ai_strategy_instances")
    op.execute("DROP TABLE IF EXISTS ai_strategy_backtests")
    op.execute("DROP TABLE IF EXISTS ai_strategies")
