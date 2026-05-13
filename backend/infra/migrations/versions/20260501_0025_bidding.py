"""Phase 6b: Play Zone — Bidding (auctions).

Two new tables:
  bidding_rounds  — admin-scheduled auctions with prize + min_bid + closes_at.
                    State: open -> closed.
  bids            — every bid; the highest stays in, losers refunded 50% AC
                    when the round closes (XP_Reward_mechanism slide 10).

Revision ID: 0025
Revises: 0024
"""
from alembic import op


revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS bidding_rounds (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug            VARCHAR(80) NOT NULL,
            prize_label     VARCHAR(120) NOT NULL,
            prize_kind      VARCHAR(20) NOT NULL CHECK (prize_kind IN ('xp','ac','cashback','external')),
            prize_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
            min_bid_ac      NUMERIC(18,2) NOT NULL DEFAULT 100,
            opens_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            closes_at       TIMESTAMPTZ NOT NULL,
            state           VARCHAR(20) NOT NULL DEFAULT 'open'
                              CHECK (state IN ('open','closed','cancelled')),
            winning_bid_id  UUID,
            bid_count       INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bidding_rounds_state_closes ON bidding_rounds(state, closes_at);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS bids (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            round_id      UUID NOT NULL REFERENCES bidding_rounds(id) ON DELETE CASCADE,
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ac_amount     NUMERIC(18,2) NOT NULL,
            placed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            refunded_ac   NUMERIC(18,2) NOT NULL DEFAULT 0
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bids_round_amount ON bids(round_id, ac_amount DESC, placed_at);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bids_user ON bids(user_id, placed_at DESC);")

    # Seed one starter round to match the lottery seed pattern.
    op.execute("""
        INSERT INTO bidding_rounds
          (slug, prize_label, prize_kind, prize_amount, min_bid_ac, closes_at)
        SELECT
          'weekly_phone_auction', 'Premium Smartphone Auction', 'external', 0, 200, now() + interval '7 days'
         WHERE NOT EXISTS (
           SELECT 1 FROM bidding_rounds WHERE slug = 'weekly_phone_auction'
         );
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS bids;")
    op.execute("DROP TABLE IF EXISTS bidding_rounds;")
