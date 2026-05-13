"""Phase 8: day-of-streak missions per Repeatable_task.docx.

Adds rewards_missions.streak_day so a daily mission can be tied to a
specific day in the 7-day streak cycle. NULL = day-agnostic (existing
daily missions still show every day).

Seeds the headline mission for each day 1-7 from the doc:
  Day 1  Place 1 trade            +10 XP / +3 AC / 5 PS-flat
  Day 2  Place 2 trades           +20 XP / +5 AC
  Day 3  Close 1 trade in profit  +20 XP / +0 AC
  Day 4  Place 3 trades           +25 XP / +8 AC
  Day 5  Trade $500 volume        +30 XP / +0 AC
  Day 6  Place 5 trades           +40 XP / +15 AC
  Day 7  Trade $1000 volume       +50 XP / +0 AC

(PS is awarded uniformly via mission_claim → flat +100 in
rewards_service.claim_mission, kept separate so the claim path doesn't
need to know about the per-mission PS deltas.)

Action kinds reuse what trading_service already wires:
  place_trades            → fires on every trade close
  trade_volume_usd        → fires with USD volume on every trade close
  win_streak              → fires on profitable closes (used here for "Close
                            in profit" via target_count=1)

Revision ID: 0028
Revises: 0027
"""
import sqlalchemy as sa
from alembic import op


revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE rewards_missions
            ADD COLUMN IF NOT EXISTS streak_day INTEGER;
    """)
    op.execute("""
        ALTER TABLE rewards_missions
            ADD CONSTRAINT rewards_missions_streak_day_check
            CHECK (streak_day IS NULL OR (streak_day >= 1 AND streak_day <= 7));
    """)

    # Seed the per-day headline missions. period='daily' keeps them on the
    # Daily tab; streak_day filters which day they appear on.
    seeds = [
        # slug,                     day, title,                 description,                                      action_kind,        target, xp, ac, order
        ("streak_day1_place_1",      1, "Day 1: First trade",  "Place 1 trade today.",                            "place_trades",      1,    10,   3,  10),
        ("streak_day2_place_2",      2, "Day 2: Place 2 trades","Engage more — place 2 trades today.",            "place_trades",      2,    20,   5,  10),
        ("streak_day3_profit_close", 3, "Day 3: Close in profit","Close 1 winning trade today.",                  "win_streak",        1,    20,   0,  10),
        ("streak_day4_place_3",      4, "Day 4: Place 3 trades","Stay consistent — 3 trades today.",              "place_trades",      3,    25,   8,  10),
        ("streak_day5_volume_500",   5, "Day 5: Trade $500",   "Hit $500 traded volume today.",                   "trade_volume_usd",  500,  30,   0,  10),
        ("streak_day6_place_5",      6, "Day 6: Power user",   "Place 5 trades today.",                           "place_trades",      5,    40,  15,  10),
        ("streak_day7_volume_1000",  7, "Day 7: Reward Day",   "Hit $1,000 traded volume on the streak finale.",  "trade_volume_usd",  1000, 50,   0,  10),
    ]
    stmt = sa.text("""
        INSERT INTO rewards_missions
          (slug, period, title, description, action_kind, target_count,
           xp_reward, ac_reward, display_order, streak_day, is_active)
        VALUES
          (:slug, 'daily', :title, :description, :action_kind, :target_count,
           :xp_reward, :ac_reward, :display_order, :streak_day, TRUE)
        ON CONFLICT (slug) DO UPDATE
          SET streak_day = EXCLUDED.streak_day,
              target_count = EXCLUDED.target_count,
              xp_reward = EXCLUDED.xp_reward,
              ac_reward = EXCLUDED.ac_reward,
              title = EXCLUDED.title,
              description = EXCLUDED.description
    """)
    bind = op.get_bind()
    for s in seeds:
        bind.execute(stmt, dict(
            slug=s[0], streak_day=s[1], title=s[2], description=s[3],
            action_kind=s[4], target_count=s[5],
            xp_reward=s[6], ac_reward=s[7], display_order=s[8],
        ))


def downgrade() -> None:
    op.execute("""
        DELETE FROM rewards_missions
         WHERE slug IN (
           'streak_day1_place_1','streak_day2_place_2','streak_day3_profit_close',
           'streak_day4_place_3','streak_day5_volume_500','streak_day6_place_5',
           'streak_day7_volume_1000'
         );
    """)
    op.execute("ALTER TABLE rewards_missions DROP CONSTRAINT IF EXISTS rewards_missions_streak_day_check;")
    op.execute("ALTER TABLE rewards_missions DROP COLUMN IF EXISTS streak_day;")
