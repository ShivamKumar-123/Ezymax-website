"""Phase 2: account-tier rebrand to Micro/Standard/Pro/Elite + Islamic.

Adds two columns (`commission_pct`, `max_leverage`) to account_groups, then
data-migrates the existing rows in place so existing trading_accounts keep
their FK references intact.

Mapping (per Trading_Mechanism.docx):
  Standard → Micro     min_deposit=10,    commission_pct=0.0006, max_leverage=100
  ECN      → Standard  min_deposit=100,   commission_pct=0.0005, max_leverage=200
  VIP      → Pro       min_deposit=500,   commission_pct=0.0004, max_leverage=300
  Islamic  → (kept)    min_deposit=100,   commission_pct=0.0005, max_leverage=200, swap_free=TRUE
  Cent     → soft-deprecated (is_active=FALSE) — existing accounts keep working
  Demo     → (untouched)

A new row `Elite` is inserted (min_deposit=1000, commission_pct=0.0003,
max_leverage=500). The downgrade reverses the column adds and rename, but
Elite/Cent state changes are not reversed (data-only).

Revision ID: 0020
Revises: 0019
"""
from alembic import op


revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. New columns. NULL allowed initially so legacy rows have a value once
    #    we backfill below; the application still falls back to leverage_default
    #    if max_leverage happens to be NULL.
    op.execute("ALTER TABLE account_groups ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(6,4);")
    op.execute("ALTER TABLE account_groups ADD COLUMN IF NOT EXISTS max_leverage INTEGER;")

    # 2. Data migration — rename existing groups in place + populate the two
    #    new fields. Keys are matched on the (current) name so this migration
    #    is idempotent against a partially-rebranded environment if needed.
    op.execute("""
        UPDATE account_groups
           SET name = 'Micro',
               description = 'Entry-level account for beginners and small trades',
               minimum_deposit = 10,
               commission_pct = 0.0006,
               max_leverage = 100,
               leverage_default = 100,
               is_active = TRUE
         WHERE name = 'Standard' AND is_demo = FALSE;
    """)
    op.execute("""
        UPDATE account_groups
           SET name = 'Standard',
               description = 'Regular trading account with low commission',
               minimum_deposit = 100,
               commission_pct = 0.0005,
               max_leverage = 200,
               leverage_default = 200,
               is_active = TRUE
         WHERE name = 'ECN' AND is_demo = FALSE;
    """)
    op.execute("""
        UPDATE account_groups
           SET name = 'Pro',
               description = 'Active traders — tighter spreads and lower commission',
               minimum_deposit = 500,
               commission_pct = 0.0004,
               max_leverage = 300,
               leverage_default = 300,
               is_active = TRUE
         WHERE name = 'VIP' AND is_demo = FALSE;
    """)
    op.execute("""
        UPDATE account_groups
           SET description = COALESCE(description, 'Swap-free Islamic account'),
               minimum_deposit = 100,
               commission_pct = 0.0005,
               max_leverage = 200,
               leverage_default = 200,
               swap_free = TRUE,
               is_active = TRUE
         WHERE name = 'Islamic';
    """)
    # Soft-deprecate Cent — leave existing accounts in place but don't offer it
    # in the picker.
    op.execute("""
        UPDATE account_groups
           SET is_active = FALSE
         WHERE name = 'Cent';
    """)
    # Demo: backfill the new columns so the SELECT in the picker doesn't see
    # NULLs. Keep all other fields untouched.
    op.execute("""
        UPDATE account_groups
           SET commission_pct = COALESCE(commission_pct, 0.0006),
               max_leverage = COALESCE(max_leverage, 100)
         WHERE is_demo = TRUE;
    """)

    # 3. Insert the new Elite tier (live only). Idempotent: only insert if there
    #    isn't already a row called Elite for live accounts.
    op.execute("""
        INSERT INTO account_groups (name, description, leverage_default, minimum_deposit,
                                    commission_pct, max_leverage, swap_free, is_demo, is_active)
        SELECT 'Elite', 'High-volume / VIP — ultra-low commission, max leverage',
               500, 1000, 0.0003, 500, FALSE, FALSE, TRUE
         WHERE NOT EXISTS (
            SELECT 1 FROM account_groups WHERE name = 'Elite' AND is_demo = FALSE
         );
    """)


def downgrade() -> None:
    # Best-effort reversal: rename live tiers back to their previous labels.
    # Cent stays deprecated unless an operator manually flips is_active.
    op.execute("DELETE FROM account_groups WHERE name = 'Elite' AND is_demo = FALSE;")
    op.execute("UPDATE account_groups SET name = 'VIP'      WHERE name = 'Pro'      AND is_demo = FALSE;")
    op.execute("UPDATE account_groups SET name = 'ECN'      WHERE name = 'Standard' AND is_demo = FALSE;")
    op.execute("UPDATE account_groups SET name = 'Standard' WHERE name = 'Micro'    AND is_demo = FALSE;")
    op.execute("ALTER TABLE account_groups DROP COLUMN IF EXISTS max_leverage;")
    op.execute("ALTER TABLE account_groups DROP COLUMN IF EXISTS commission_pct;")
