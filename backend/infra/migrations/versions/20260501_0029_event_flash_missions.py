"""Phase 8b: event + flash mission seeds per Repeatable_task.docx.

Adds rewards_missions.starts_at so a mission can be hidden until a window
opens. The list_missions filter honors both starts_at and expires_at so:
   show iff (starts_at IS NULL OR starts_at <= now)
        AND (expires_at IS NULL OR expires_at > now)

Seeds upcoming festival missions (period='flash') with windows that
auto-open near the festival date and auto-close after. Admin can clone +
edit these for future years via SQL or the admin UI.

Festival windows (UTC, today = 2026-05-01):
  Eid al-Adha 2026     — 2026-06-04 .. 2026-06-08
  Independence Day IN  — 2026-08-13 .. 2026-08-16
  Diwali 2026          — 2026-11-06 .. 2026-11-10
  Christmas 2026       — 2026-12-22 .. 2026-12-26
  New Year 2027        — 2026-12-31 .. 2027-01-02

Revision ID: 0029
Revises: 0028
"""
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op


revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def _ts(s: str) -> datetime:
    """asyncpg requires datetime objects (not ISO strings) for TIMESTAMPTZ
    bind parameters, so coerce here."""
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def upgrade() -> None:
    op.execute("""
        ALTER TABLE rewards_missions
            ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
    """)

    seeds = [
        # slug,                    title,                     description,                                action_kind,         target,  xp,  ac,  starts_at,                ends_at
        # ─── Eid al-Adha ────────────────────────────────────────────────────────────────────────────
        ("event_eid_2026_trade",   "Eid: Bonus Trade",       "Place 2 trades during Eid.",                "place_trades",      2,       50,  20,  "2026-06-04 00:00:00",   "2026-06-08 23:59:59"),
        ("event_eid_2026_refer",   "Eid: Share Happiness",   "Refer 1 friend during Eid.",                "refer_friend",      1,       100, 30,  "2026-06-04 00:00:00",   "2026-06-08 23:59:59"),
        # ─── Independence Day (IN) ─────────────────────────────────────────────────────────────────
        ("event_indep_2026_trade", "Independence Day Trade", "Place 1 freedom trade.",                    "place_trades",      1,       30,  0,   "2026-08-13 00:00:00",   "2026-08-16 23:59:59"),
        # ─── Diwali ─────────────────────────────────────────────────────────────────────────────────
        ("event_diwali_2026_5t",   "Diwali: Festival Trades","Place 5 trades during Diwali.",             "place_trades",      5,       150, 50,  "2026-11-06 00:00:00",   "2026-11-10 23:59:59"),
        ("event_diwali_2026_vol",  "Diwali: Wealth Boost",   "Trade $1,000 during Diwali.",               "trade_volume_usd",  1000,    200, 0,   "2026-11-06 00:00:00",   "2026-11-10 23:59:59"),
        # ─── Christmas ──────────────────────────────────────────────────────────────────────────────
        ("event_xmas_2026_trade",  "Christmas: Trade & Win", "Place 3 trades over Christmas.",            "place_trades",      3,       100, 50,  "2026-12-22 00:00:00",   "2026-12-26 23:59:59"),
        # ─── New Year ───────────────────────────────────────────────────────────────────────────────
        ("event_ny_2027_first",    "New Year: First Trade",  "Place your first trade of the new year.",   "first_trade",       1,       50,  0,   "2026-12-31 00:00:00",   "2027-01-02 23:59:59"),
        ("event_ny_2027_strong",   "New Year: Start Strong", "Trade $500 in the first 48 hours of 2027.", "trade_volume_usd",  500,     100, 0,   "2026-12-31 00:00:00",   "2027-01-02 23:59:59"),
    ]
    stmt = sa.text("""
        INSERT INTO rewards_missions
          (slug, period, title, description, action_kind, target_count,
           xp_reward, ac_reward, display_order, starts_at, expires_at, is_active)
        VALUES
          (:slug, 'flash', :title, :description, :action_kind, :target_count,
           :xp_reward, :ac_reward, 50, :starts_at, :expires_at, TRUE)
        ON CONFLICT (slug) DO UPDATE
          SET starts_at = EXCLUDED.starts_at,
              expires_at = EXCLUDED.expires_at,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              target_count = EXCLUDED.target_count,
              xp_reward = EXCLUDED.xp_reward,
              ac_reward = EXCLUDED.ac_reward
    """)
    bind = op.get_bind()
    for s in seeds:
        bind.execute(stmt, dict(
            slug=s[0], title=s[1], description=s[2], action_kind=s[3],
            target_count=s[4], xp_reward=s[5], ac_reward=s[6],
            starts_at=_ts(s[7]), expires_at=_ts(s[8]),
        ))


def downgrade() -> None:
    op.execute("""
        DELETE FROM rewards_missions
         WHERE slug IN (
           'event_eid_2026_trade','event_eid_2026_refer','event_indep_2026_trade',
           'event_diwali_2026_5t','event_diwali_2026_vol',
           'event_xmas_2026_trade','event_ny_2027_first','event_ny_2027_strong'
         );
    """)
    op.execute("ALTER TABLE rewards_missions DROP COLUMN IF EXISTS starts_at;")
