"""Seed the spin wheel prize catalogue per the XP_Reward_mechanism deck.

Adds 7 prize slots to `spin_wheel_prizes` with the weights from slide 8:

  30 EZC cost per spin (set in play_zone_service.SPIN_COST_AC). Outcomes:

  | Slot     | Weight | Probability | Payout       |
  |----------|--------|-------------|--------------|
  | 50 EZC   |  30    |  30%        | +50  EZC     |
  | 75 EZC   |  25    |  25%        | +75  EZC     |
  | 100 EZC  |  20    |  20%        | +100 EZC     |
  | 200 EZC  |  10    |  10%        | +200 EZC     |
  | 300 EZC  |   5    |   5%        | +300 EZC     |
  | 500 EZC  |   1    |   1%        | +500 EZC     |
  | Nothing  |   9    |   9%        |  —           |

  Total weight 100 (so weight == probability percentage).

  Expected value at these weights is ~94 EZC per spin against a 30 EZC
  cost, i.e. +64 EZC minted per spin in net player favour. That matches
  what the deck shows but is NOT a sustainable steady-state economy — it
  exists as a launch-marketing tool to drive engagement. Operators
  should monitor the volume of EZC minted via `rewards_transactions`
  with type='spin' and either:
    (a) scale all payout_amount values down (e.g. by a factor of 3) so
        EV approaches cost, or
    (b) reduce the higher-tier weights so positive draws are rarer.
  Both are admin-tunable directly on `spin_wheel_prizes` — no migration
  needed once the table is seeded.

Idempotent — ON CONFLICT (slug) DO NOTHING so re-running the migration
chain on an existing prod DB doesn't churn the data. To re-tune, update
the rows directly; do not author a v2 migration that mutates them
(historical analytics rely on stable prize IDs).

Revision ID: 0049
Revises: 0048
"""
import sqlalchemy as sa
from alembic import op


revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


_SEED_ROWS = [
    # (slug,             label,         weight, payout_kind, payout_amount, display_order)
    ("spin_50_fxa",      "+50 EZC",       30,   "ac",          50,    1),
    ("spin_75_fxa",      "+75 EZC",       25,   "ac",          75,    2),
    ("spin_100_fxa",     "+100 EZC",      20,   "ac",         100,    3),
    ("spin_200_fxa",     "+200 EZC",      10,   "ac",         200,    4),
    ("spin_300_fxa",     "+300 EZC",       5,   "ac",         300,    5),
    ("spin_500_fxa",     "+500 EZC",       1,   "ac",         500,    6),
    ("spin_no_reward",   "No reward",      9,   "nothing",      0,    7),
]


def upgrade() -> None:
    stmt = sa.text(
        """
        INSERT INTO spin_wheel_prizes
          (slug, label, weight, payout_kind, payout_amount, display_order, is_active)
        VALUES
          (:slug, :label, :weight, :payout_kind, :payout_amount, :display_order, TRUE)
        ON CONFLICT (slug) DO NOTHING
        """
    )
    bind = op.get_bind()
    for slug, label, weight, kind, amount, order in _SEED_ROWS:
        bind.execute(stmt, dict(
            slug=slug, label=label, weight=weight,
            payout_kind=kind, payout_amount=amount, display_order=order,
        ))


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM spin_wheel_prizes
        WHERE slug IN (
            'spin_50_fxa','spin_75_fxa','spin_100_fxa','spin_200_fxa',
            'spin_300_fxa','spin_500_fxa','spin_no_reward'
        );
        """
    )
