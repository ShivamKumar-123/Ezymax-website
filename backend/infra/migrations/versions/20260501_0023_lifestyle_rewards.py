"""Phase 5: PS-gated lifestyle rewards.

Extends reward_store_items.category to include 'lifestyle' (smartphone,
Dubai trip, etc. — PS milestone redemptions per XP_Reward_mechanism table 7)
and seeds the milestones. Lifestyle redemptions are gated by the user's PS
balance and create a manual fulfillment ticket on the admin side.

Revision ID: 0023
Revises: 0022
"""
import json

import sqlalchemy as sa
from alembic import op


revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Widen the category CHECK constraint. The original was an inline
    #    unnamed CHECK; the DO block below drops whichever name Postgres
    #    auto-assigned and replaces it with the wider list.
    op.execute("""
        DO $$
        DECLARE
            con_name TEXT;
        BEGIN
            SELECT conname INTO con_name
              FROM pg_constraint
             WHERE conrelid = 'reward_store_items'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%category%';
            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE reward_store_items DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    """)
    op.execute("""
        ALTER TABLE reward_store_items
          ADD CONSTRAINT reward_store_items_category_check
          CHECK (category IN ('cashback','bonus','perk','tool','lifestyle'));
    """)

    # 2. Seed lifestyle items per XP_Reward_mechanism table 7. PS milestone
    #    is stored in payload.min_ps so the service can gate redemption on it
    #    without a schema column. fulfillment='manual' tells the admin queue
    #    that someone has to ship physical goods or coordinate the trip.
    seeds = [
        ("lifestyle_merch_50k",         "Branded Merchandise",
         "Premium FXArtha branded merchandise pack (cap, t-shirt, accessories).",
         5_000,    50_000),
        ("lifestyle_earbuds_150k",       "Wireless Earbuds",
         "Premium wireless earbuds, shipped to your KYC address.",
         12_000,  150_000),
        ("lifestyle_smartphone_400k",    "Premium Smartphone",
         "Latest-gen flagship smartphone, shipped to your KYC address.",
         40_000,  400_000),
        ("lifestyle_laptop_1m",          "MacBook / Laptop",
         "MacBook or equivalent premium laptop, shipped to your KYC address.",
         80_000, 1_000_000),
        ("lifestyle_appliances_2_5m",    "Home Appliances Pack",
         "Premium home appliances bundle, shipped to your KYC address.",
         180_000, 2_500_000),
        ("lifestyle_dubai_5m",           "Dubai Trip",
         "All-expenses-paid Dubai trip for two — flights, hotel, activities.",
         350_000, 5_000_000),
        ("lifestyle_luxury_10m",         "Luxury Travel Package",
         "Bespoke luxury travel package — destination of your choice.",
         700_000, 10_000_000),
    ]
    stmt = sa.text("""
        INSERT INTO reward_store_items
          (slug, category, label, description, ac_price, payload, display_order, is_active)
        VALUES
          (:slug, 'lifestyle', :label, :description, :ac_price,
           CAST(:payload AS JSONB), :display_order, TRUE)
        ON CONFLICT (slug) DO NOTHING
    """)
    bind = op.get_bind()
    for i, (slug, label, desc, ac_price, min_ps) in enumerate(seeds, start=1):
        bind.execute(stmt, dict(
            slug=slug, label=label, description=desc, ac_price=ac_price,
            payload=json.dumps({"kind": "lifestyle", "min_ps": min_ps, "fulfillment": "manual"}),
            display_order=i,
        ))


def downgrade() -> None:
    op.execute("DELETE FROM reward_store_items WHERE category = 'lifestyle';")
    op.execute("""
        DO $$
        DECLARE
            con_name TEXT;
        BEGIN
            SELECT conname INTO con_name
              FROM pg_constraint
             WHERE conrelid = 'reward_store_items'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%category%';
            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE reward_store_items DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    """)
    op.execute("""
        ALTER TABLE reward_store_items
          ADD CONSTRAINT reward_store_items_category_check
          CHECK (category IN ('cashback','bonus','perk','tool'));
    """)
