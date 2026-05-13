"""Phase 6a: Play Zone — Lottery.

Two new tables:
  lottery_rounds   — admin-scheduled rounds with prize_label + prize_value (in
                     XP/AC/cashback) and a draw_at timestamp. State machine:
                     open -> drawing -> closed.
  lottery_tickets  — one row per ticket purchase (100 AC each per
                     XP_Reward_mechanism slide 9). winning_ticket_id on the
                     round row is set when the cron closes it.

Revision ID: 0024
Revises: 0023
"""
import sqlalchemy as sa
from alembic import op


revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS lottery_rounds (
            id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug              VARCHAR(80) NOT NULL,
            prize_label       VARCHAR(120) NOT NULL,
            prize_kind        VARCHAR(20) NOT NULL CHECK (prize_kind IN ('xp','ac','cashback','external')),
            prize_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
            ticket_cost_ac    NUMERIC(18,2) NOT NULL DEFAULT 100,
            opens_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            draws_at          TIMESTAMPTZ NOT NULL,
            state             VARCHAR(20) NOT NULL DEFAULT 'open'
                                CHECK (state IN ('open','drawing','closed','cancelled')),
            winning_ticket_id UUID,
            ticket_count      INTEGER NOT NULL DEFAULT 0,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_lottery_rounds_state_draws ON lottery_rounds(state, draws_at);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS lottery_tickets (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            round_id    UUID NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ac_paid     NUMERIC(18,2) NOT NULL,
            purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_lottery_tickets_round ON lottery_tickets(round_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_lottery_tickets_user ON lottery_tickets(user_id, purchased_at DESC);")

    # Seed a single open round so the page renders something on first load.
    # Operators can disable / replace this via admin once they want to run a
    # real cadence.
    op.execute("""
        INSERT INTO lottery_rounds
          (slug, prize_label, prize_kind, prize_amount, ticket_cost_ac, draws_at)
        SELECT
          'weekly_2000_ac', 'Weekly 2,000 AC Prize', 'ac', 2000, 100, now() + interval '7 days'
         WHERE NOT EXISTS (
           SELECT 1 FROM lottery_rounds WHERE slug = 'weekly_2000_ac'
         );
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lottery_tickets;")
    op.execute("DROP TABLE IF EXISTS lottery_rounds;")
