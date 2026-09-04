"""High-water-mark performance fee math (packages/common/src/copy_fees.py).

The rule: a follower is charged only on gross profit that lifts their
cumulative P&L ABOVE its previous peak. Losses must be earned back
before the master earns another fee.
"""
from decimal import Decimal

from packages.common.src.copy_fees import apply_hwm_fee, compute_hwm_fee

PCT = Decimal("20")


def _fee(gross, cum, hwm, pct=PCT):
    return compute_hwm_fee(
        gross_profit=Decimal(str(gross)),
        prev_cum=Decimal(str(cum)),
        prev_hwm=Decimal(str(hwm)),
        perf_pct=pct,
    )


def test_first_profit_is_fully_billable():
    fee, cum, hwm = _fee(100, 0, 0)
    assert fee == Decimal("20")
    assert cum == Decimal("100")
    assert hwm == Decimal("100")


def test_loss_is_never_charged_and_does_not_lower_the_mark():
    fee, cum, hwm = _fee(-100, 100, 100)
    assert fee == Decimal("0")
    assert cum == Decimal("0")
    assert hwm == Decimal("100")  # peak remembered


def test_recovering_old_ground_is_free():
    # Follower is at cum 0 after a drawdown, peak still 100.
    fee, cum, hwm = _fee(100, 0, 100)
    assert fee == Decimal("0"), "recovering to the old peak must not be charged"
    assert cum == Decimal("100")
    assert hwm == Decimal("100")


def test_only_the_portion_above_the_peak_is_charged():
    fee, cum, hwm = _fee(50, 100, 100)
    assert fee == Decimal("10")  # 20% of 50
    assert hwm == Decimal("150")

    # Partially above the peak: cum 80 → 130 with peak 100 ⇒ bill 30, not 50.
    fee2, cum2, hwm2 = _fee(50, 80, 100)
    assert fee2 == Decimal("6")  # 20% of 30
    assert cum2 == Decimal("130")
    assert hwm2 == Decimal("130")


def test_choppy_market_is_not_double_charged():
    """The bug this exists to fix: +100, -100, +100 netted +100 gross but
    used to cost two full fees (40% effective)."""
    cum = hwm = Decimal("0")
    paid = Decimal("0")
    for g in (100, -100, 100):
        fee, cum, hwm = _fee(g, cum, hwm)
        paid += fee
    assert cum == Decimal("100"), "net gross gain is +100"
    assert paid == Decimal("20"), "exactly one 20% fee on the real +100 gain"


def test_fee_never_exceeds_the_trade_that_earned_it():
    # Deep drawdown, then a big win that only partly clears the peak.
    fee, cum, hwm = _fee(500, -400, 200)
    assert cum == Decimal("100")
    assert fee == Decimal("0"), "still below the old peak"
    assert hwm == Decimal("200")

    # A win that clears the peak bills only the excess, never the whole trade.
    fee2, cum2, hwm2 = _fee(300, 100, 200)
    assert cum2 == Decimal("400")
    assert fee2 == Decimal("40")  # 20% of the 200 above the peak
    assert fee2 <= Decimal("300") * PCT / Decimal("100")


def test_zero_percent_master_never_charges():
    fee, _, _ = _fee(1000, 0, 0, pct=Decimal("0"))
    assert fee == Decimal("0")


class _Alloc:
    """Minimal stand-in for InvestorAllocation."""
    def __init__(self):
        self.gross_pnl_cum = None   # NULL on legacy rows
        self.hwm_profit = None


def test_apply_advances_state_on_the_allocation():
    alloc = _Alloc()
    assert apply_hwm_fee(alloc, Decimal("100"), PCT) == Decimal("20")
    assert alloc.gross_pnl_cum == Decimal("100")
    assert alloc.hwm_profit == Decimal("100")

    # A loss updates the running total but leaves the mark.
    assert apply_hwm_fee(alloc, Decimal("-60"), PCT) == Decimal("0")
    assert alloc.gross_pnl_cum == Decimal("40")
    assert alloc.hwm_profit == Decimal("100")

    # Recovery below the mark stays free; only the excess is billed.
    assert apply_hwm_fee(alloc, Decimal("80"), PCT) == Decimal("4")  # 20% of 20
    assert alloc.gross_pnl_cum == Decimal("120")
    assert alloc.hwm_profit == Decimal("120")


def test_legacy_null_columns_are_treated_as_zero():
    alloc = _Alloc()
    fee = apply_hwm_fee(alloc, Decimal("50"), PCT)
    assert fee == Decimal("10")
