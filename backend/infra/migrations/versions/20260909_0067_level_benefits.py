"""Per-level trading-cost discounts (spread / swap / commission).

The XP level ladder already discounted commission, but the numbers lived in
instrument_pricing.py as constants (1% per level above L1, capped at 9%) and
spread and swap ignored the level entirely. This adds a `level_benefits`
table — one row per level — so the desk can retune the ladder from the admin
panel instead of a deploy, and so spread and swap can read the same source.

The commission column is seeded with exactly the old formula (level - 1,
capped at 9), so deploying this migration changes nothing about what users
pay until an admin edits a row. Spread and swap start at a deliberately
conservative ladder: spread is the B-book's main revenue line, so the top
level gives 15% off, not half price.

Revision ID: 0067
Revises: 0066
"""
from alembic import op

revision = "0067"
down_revision = "0066"
branch_labels = None
depends_on = None


# level: (spread %, swap %, commission %)
# Commission column == min(level - 1, 9), matching XP_DISCOUNT_PER_LEVEL=0.01
# and XP_DISCOUNT_MAX_LEVELS=9 exactly, so behaviour is unchanged on deploy.
SEED = [
    (1,   0,  0, 0),   # Novice
    (2,   1,  1, 1),   # Apprentice
    (3,   2,  2, 2),   # Skilled Trader
    (4,   3,  3, 3),   # Veteran
    (5,   5,  5, 4),   # Expert
    (6,   6,  6, 5),   # Master
    (7,   8,  8, 6),   # Champion
    (8,  10, 10, 7),   # Legend
    (9,  12, 12, 8),   # Sovereign
    (10, 15, 15, 9),   # Mythic
]


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS level_benefits (
            level                    INTEGER PRIMARY KEY,
            spread_discount_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
            swap_discount_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
            commission_discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
            is_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
            updated_by               UUID REFERENCES users(id),
            updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT level_benefits_level_range CHECK (level BETWEEN 1 AND 10),
            CONSTRAINT level_benefits_pct_range CHECK (
                spread_discount_pct     BETWEEN 0 AND 100 AND
                swap_discount_pct       BETWEEN 0 AND 100 AND
                commission_discount_pct BETWEEN 0 AND 100
            )
        )
    """)
    # ON CONFLICT DO NOTHING so a re-run never clobbers a ladder the desk has
    # already retuned.
    for level, spread, swap, commission in SEED:
        op.execute(
            "INSERT INTO level_benefits "
            "(level, spread_discount_pct, swap_discount_pct, commission_discount_pct) "
            f"VALUES ({level}, {spread}, {swap}, {commission}) "
            "ON CONFLICT (level) DO NOTHING"
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS level_benefits")
