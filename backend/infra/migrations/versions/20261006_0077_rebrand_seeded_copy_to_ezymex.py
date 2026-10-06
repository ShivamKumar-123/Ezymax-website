"""Rebrand seeded, user-visible copy from SwissCresta to Ezymex.

Two earlier migrations INSERTed brand-bearing text that is live in the
database and shown to traders:

  * 0015 — rewards mission ``daily_refer_friend``:
        "Invite a friend to join SwissCresta."
  * 0023 — lifestyle reward ``lifestyle_merch_50k``:
        "Premium SwissCresta branded merchandise pack (cap, t-shirt,
         accessories)."

Those migrations are history and are deliberately NOT edited — rewriting an
applied revision changes what a fresh database gets without touching any
existing one, so the two diverge. This forward migration fixes the rows
instead, which is the only thing that reaches a live deploy.

Scoped by slug AND by the exact outgoing string, so it is a no-op on a
database where an admin has already reworded the copy by hand. Idempotent:
re-running matches nothing the second time.

The downgrade restores the previous wording for symmetry.
"""
from alembic import op
import sqlalchemy as sa

revision = "0077"
down_revision = "0076"
branch_labels = None
depends_on = None

OLD_REFER = "Invite a friend to join SwissCresta."
NEW_REFER = "Invite a friend to join Ezymex."

OLD_MERCH = "Premium SwissCresta branded merchandise pack (cap, t-shirt, accessories)."
NEW_MERCH = "Premium Ezymex branded merchandise pack (cap, t-shirt, accessories)."


def _swap(table: str, slug: str, column: str, old: str, new: str) -> None:
    """Update one seeded row, only when it still holds the expected text.

    Wrapped so a missing table (a deployment that never ran the rewards
    feature migrations) cannot fail the whole upgrade.
    """
    bind = op.get_bind()
    if not sa.inspect(bind).has_table(table):
        return
    bind.execute(
        sa.text(
            f"UPDATE {table} SET {column} = :new "
            f" WHERE slug = :slug AND {column} = :old"
        ),
        {"new": new, "slug": slug, "old": old},
    )


def upgrade() -> None:
    _swap("rewards_missions", "daily_refer_friend", "description", OLD_REFER, NEW_REFER)
    _swap("reward_store_items", "lifestyle_merch_50k", "description", OLD_MERCH, NEW_MERCH)


def downgrade() -> None:
    _swap("rewards_missions", "daily_refer_friend", "description", NEW_REFER, OLD_REFER)
    _swap("reward_store_items", "lifestyle_merch_50k", "description", NEW_MERCH, OLD_MERCH)
