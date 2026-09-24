"""Per-tier trading terms: spread, commission, margin call, stop out, lot caps.

Account tiers used to differ only in leverage, minimum deposit and a
percentage commission. The published account specification asks for more than
that: each tier has its own spread, its own margin-call and stop-out levels,
a flat per-lot commission on the top tier, and swap-free offered on the entry
tiers only. Those all lived nowhere, so this adds the columns and fills in the
four tiers the specification covers.

Standard and Pro already exist and are re-tuned in place (their live accounts
keep trading, on the new terms). ECN and Prime are new. Micro, Cent, Islamic,
Elite and Demo are deliberately left alone.

The platform lot ceiling also moves from 100 to 200, because the specification
sells a 200-lot daytime maximum; the night-time step-down (20/30/60 lots by
instrument) is enforced in code, in packages.common.src.lot_limits.

Revision ID: 0068
Revises: 0067
"""
from alembic import op

revision = "0068"
down_revision = "0067"
branch_labels = None
depends_on = None


# name -> (min deposit, spread pips, commission/lot/side, commission pct,
#          leverage, margin call %, stop out %, swap-free available)
TIERS = [
    ("Standard", 15,   "0.3", "0",   None, 1000, 100, 0, True),
    ("ECN",      50,   "0.2", "0",   None,  500, 100, 0, True),
    ("Pro",      2000, "0.1", "0",   None,  200,  80, 0, False),
    ("Prime",    3000, "0.0", "3.5", None,  200,  80, 0, False),
]

DESCRIPTIONS = {
    "Standard": "Entry tier — 0.3 pip spread, no commission, leverage to 1:1000, swap-free on request.",
    "ECN": "Tighter 0.2 pip spread, no commission, leverage to 1:500, swap-free on request.",
    "Pro": "0.1 pip spread, no commission, leverage to 1:200, margin call at 80%.",
    "Prime": "Raw 0.0 pip spread with $3.5 per lot per side commission, leverage to 1:200.",
}


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE account_groups
            ADD COLUMN IF NOT EXISTS swap_free_available BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS margin_call_level NUMERIC(6,2),
            ADD COLUMN IF NOT EXISTS stop_out_level NUMERIC(6,2)
        """
    )

    for (name, min_dep, spread, comm_lot, comm_pct, leverage,
         margin_call, stop_out, swap_free_avail) in TIERS:
        desc = DESCRIPTIONS[name]
        pct = "NULL" if comm_pct is None else str(comm_pct)
        op.execute(
            f"""
            INSERT INTO account_groups (
                name, description, leverage_default, max_leverage,
                spread_markup_default, commission_default, commission_pct,
                minimum_deposit, swap_free, swap_free_available,
                margin_call_level, stop_out_level, is_demo, is_active
            )
            SELECT '{name}', '{desc}', {leverage}, {leverage},
                   {spread}, {comm_lot}, {pct},
                   {min_dep}, FALSE, {str(swap_free_avail).upper()},
                   {margin_call}, {stop_out}, FALSE, TRUE
            WHERE NOT EXISTS (
                SELECT 1 FROM account_groups WHERE name = '{name}' AND is_demo = FALSE
            )
            """
        )
        # Re-tune an existing tier of the same name. commission_pct is cleared
        # on purpose: these tiers are sold as "no commission", and a leftover
        # percentage would quietly keep charging.
        op.execute(
            f"""
            UPDATE account_groups SET
                description = '{desc}',
                leverage_default = {leverage},
                max_leverage = {leverage},
                spread_markup_default = {spread},
                commission_default = {comm_lot},
                commission_pct = {pct},
                minimum_deposit = {min_dep},
                swap_free_available = {str(swap_free_avail).upper()},
                margin_call_level = {margin_call},
                stop_out_level = {stop_out},
                is_active = TRUE
            WHERE name = '{name}' AND is_demo = FALSE
            """
        )

    # The specification's daytime maximum is 200 lots per position. Both the
    # platform setting and the per-instrument ceiling were 100, either of which
    # would reject the trade long before the tier rules were consulted.
    op.execute(
        """
        INSERT INTO system_settings (key, value, description)
        VALUES ('max_lot_size', '200'::jsonb,
                'Platform-wide maximum lots per position (daytime; see lot_limits for the night step-down)')
        ON CONFLICT (key) DO UPDATE SET value = '200'::jsonb
        """
    )
    op.execute("UPDATE instruments SET max_lot = 200 WHERE max_lot < 200")
    op.execute("UPDATE instrument_configs SET max_lot_size = 200 WHERE max_lot_size < 200")


def downgrade() -> None:
    op.execute("DELETE FROM account_groups WHERE name IN ('ECN', 'Prime') AND is_demo = FALSE")
    op.execute(
        """
        ALTER TABLE account_groups
            DROP COLUMN IF EXISTS swap_free_available,
            DROP COLUMN IF EXISTS margin_call_level,
            DROP COLUMN IF EXISTS stop_out_level
        """
    )
    op.execute(
        """
        INSERT INTO system_settings (key, value, description)
        VALUES ('max_lot_size', '100'::jsonb, 'Platform-wide maximum lots per position')
        ON CONFLICT (key) DO UPDATE SET value = '100'::jsonb
        """
    )
