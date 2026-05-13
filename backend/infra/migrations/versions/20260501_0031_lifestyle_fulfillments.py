"""Phase 9c: PS lifestyle fulfillment queue.

Lifestyle redemptions (smartphones, Dubai trips, etc.) require manual
shipping/booking by ops. This table tracks each redemption from "queued"
through "shipped" / "cancelled" so the admin queue isn't a SQL hunt.

Revision ID: 0031
Revises: 0030
"""
from alembic import op


revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS lifestyle_fulfillments (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            item_id       UUID NOT NULL REFERENCES reward_store_items(id),
            ac_paid       NUMERIC(18,2) NOT NULL,
            user_ps_at_redeem INTEGER NOT NULL DEFAULT 0,
            shipping_address TEXT,
            tracking_number  VARCHAR(120),
            status        VARCHAR(20) NOT NULL DEFAULT 'queued'
                            CHECK (status IN ('queued','processing','shipped','delivered','cancelled')),
            note          TEXT,
            requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            processed_at  TIMESTAMPTZ,
            shipped_at    TIMESTAMPTZ,
            delivered_at  TIMESTAMPTZ,
            cancelled_at  TIMESTAMPTZ,
            handled_by    UUID REFERENCES users(id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_lifestyle_fulfillments_status ON lifestyle_fulfillments(status, requested_at);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_lifestyle_fulfillments_user ON lifestyle_fulfillments(user_id, requested_at DESC);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lifestyle_fulfillments;")
