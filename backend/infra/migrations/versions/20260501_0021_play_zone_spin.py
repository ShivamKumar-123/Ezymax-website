"""Phase 3: Play Zone — Spin & Win.

Two new tables:
  spin_wheel_prizes  — catalogue of slots on the wheel, with weight + payout.
  spin_results       — audit log of every spin (cost, prize awarded, AC delta).

Seeds the prize table per XP_Reward_mechanism table 5:
  ₹50 30%   ₹75 25%   ₹100 20%   ₹200 10%   ₹300 5%   ₹500 1%   nothing 9%
(In our app these AC values map to a "cashback" awarded at the AC denomination —
the rupee labels are kept verbatim so localisation can swap them later.)

Revision ID: 0021
Revises: 0020
"""
import sqlalchemy as sa
from alembic import op


revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS spin_wheel_prizes (
            id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug           VARCHAR(60) UNIQUE NOT NULL,
            label          VARCHAR(80) NOT NULL,
            weight         INTEGER NOT NULL CHECK (weight >= 0),
            payout_kind    VARCHAR(20) NOT NULL CHECK (payout_kind IN ('xp','ac','cashback','nothing')),
            payout_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
            display_order  INTEGER NOT NULL DEFAULT 0,
            is_active      BOOLEAN NOT NULL DEFAULT TRUE
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS spin_results (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            prize_id     UUID NOT NULL REFERENCES spin_wheel_prizes(id),
            ac_cost      NUMERIC(18,2) NOT NULL,
            payout_kind  VARCHAR(20) NOT NULL,
            payout_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            awarded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_spin_results_user_time ON spin_results(user_id, awarded_at DESC);")

    # Seed wheel — weights are integers proportional to the % chance (×100 so
    # we can express 0.5% later without changing the schema). Weights here sum
    # to 100, keeping the % == weight equivalence the doc spelled out.
    seeds = [
        # slug,             label,              weight, kind,   amount, order
        ("spin_50",          "+50 AC",           30, "ac",       50,    1),
        ("spin_75",          "+75 AC",           25, "ac",       75,    2),
        ("spin_100",         "+100 AC",          20, "ac",      100,    3),
        ("spin_200",         "+200 AC",          10, "ac",      200,    4),
        ("spin_300",         "+300 AC",           5, "ac",      300,    5),
        ("spin_500",         "+500 AC",           1, "ac",      500,    6),
        ("spin_nothing",     "Try again",         9, "nothing",   0,    7),
    ]
    stmt = sa.text("""
        INSERT INTO spin_wheel_prizes
          (slug, label, weight, payout_kind, payout_amount, display_order)
        VALUES
          (:slug, :label, :weight, :payout_kind, :payout_amount, :display_order)
        ON CONFLICT (slug) DO NOTHING
    """)
    bind = op.get_bind()
    for s in seeds:
        bind.execute(stmt, dict(
            slug=s[0], label=s[1], weight=s[2],
            payout_kind=s[3], payout_amount=s[4], display_order=s[5],
        ))


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS spin_results;")
    op.execute("DROP TABLE IF EXISTS spin_wheel_prizes;")
