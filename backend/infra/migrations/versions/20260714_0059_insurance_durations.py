"""Insurance coverage durations (1d/1w/1m) + repair stuck-active policies.

1. `insurance_policies.duration`   — coverage plan the user bought ('1d'|'1w'|'1m').
2. `insurance_policies.expires_at` — end of the coverage window. NULL = legacy
   open-ended policy (pre-duration behaviour, still honoured by the claim gate).
3. Data repair: before this release, `maybe_pay` crashed (NameError on
   `paid_so_far`) AFTER queueing the wallet credit but BEFORE flipping the
   policy to 'claimed'. Payouts committed fine, but every claimed policy was
   left status='active' forever. Any active policy that already has a claim
   and whose position is closed is really a settled claim — flip it, stamping
   settled_at from its latest payout.

Idempotent (ADD COLUMN IF NOT EXISTS; the repair UPDATE matches nothing on
a healthy database).

Revision ID: 0059
Revises: 0058
"""
from alembic import op


revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE insurance_policies "
        "ADD COLUMN IF NOT EXISTS duration VARCHAR(4) NOT NULL DEFAULT '1d'"
    )
    op.execute(
        "ALTER TABLE insurance_policies "
        "ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ"
    )
    # Guarded constraint add — IF NOT EXISTS is unsupported for constraints.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'insurance_policies_duration_check'
            ) THEN
                ALTER TABLE insurance_policies
                ADD CONSTRAINT insurance_policies_duration_check
                CHECK (duration IN ('1d','1w','1m'));
            END IF;
        END $$;
        """
    )

    # Repair policies stranded 'active' by the maybe_pay NameError.
    op.execute(
        """
        UPDATE insurance_policies p
        SET status = 'claimed',
            settled_at = c.last_paid
        FROM (
            SELECT policy_id, MAX(paid_at) AS last_paid
            FROM insurance_claims
            GROUP BY policy_id
        ) c
        WHERE c.policy_id = p.id
          AND p.status = 'active'
          AND EXISTS (
              SELECT 1 FROM positions pos
              WHERE pos.id = p.position_id AND pos.status = 'closed'
          );
        """
    )


def downgrade() -> None:
    # The data repair is intentionally not reverted — those policies were
    # always semantically 'claimed'.
    op.execute(
        "ALTER TABLE insurance_policies DROP CONSTRAINT IF EXISTS insurance_policies_duration_check"
    )
    op.execute("ALTER TABLE insurance_policies DROP COLUMN IF EXISTS expires_at")
    op.execute("ALTER TABLE insurance_policies DROP COLUMN IF EXISTS duration")
