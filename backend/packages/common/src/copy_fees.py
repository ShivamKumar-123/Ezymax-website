"""High-water-mark performance fees for copy trading.

WHY THIS EXISTS
---------------
Performance fees used to be charged on EVERY profitable close, with no
memory of previous losses. In a choppy market that silently overcharges
the follower:

    +$100 → fee on 100        (20% = $20)
    -$100 → no fee            (follower now net $0, but $20 poorer)
    +$100 → fee on 100 again  (another $20)

Gross swing +$100, fee paid $40 — an effective 40% on the real gain.

A high-water mark (the industry standard for managed money, used by
every serious fund and copy platform) fixes this: the fee is charged
only on profit that lifts the follower ABOVE their previous peak
cumulative P&L. Losses must be earned back before the manager is paid
again.

    +$100 → cum 100, peak 0   → fee on 100, peak := 100
    -$100 → cum   0, peak 100 → no fee, peak stays 100
    +$100 → cum 100, peak 100 → NO fee (only recovering old ground)
    + $50 → cum 150, peak 100 → fee on 50 only, peak := 150

Two fields on InvestorAllocation carry the state:
  * gross_pnl_cum — cumulative GROSS realised P&L (before fees)
  * hwm_profit    — the highest gross_pnl_cum ever charged against

Both start at 0, so the mark applies from activation forward: existing
followers are never retro-charged, and past fees are never refunded.
"""
from __future__ import annotations

from decimal import Decimal

ZERO = Decimal("0")


def compute_hwm_fee(
    *,
    gross_profit: Decimal,
    prev_cum: Decimal,
    prev_hwm: Decimal,
    perf_pct: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    """Pure fee math — no DB, fully unit-testable.

    Args:
      gross_profit: this trade's realised P&L, before fees (may be negative)
      prev_cum:     allocation's cumulative gross P&L before this trade
      prev_hwm:     allocation's high-water mark before this trade
      perf_pct:     the master's performance fee percentage (0-100)

    Returns (performance_fee, new_cum, new_hwm). The fee is never negative
    and never exceeds this trade's own profit.
    """
    g = Decimal(str(gross_profit or 0))
    cum = Decimal(str(prev_cum or 0))
    hwm = Decimal(str(prev_hwm or 0))
    pct = Decimal(str(perf_pct or 0))

    new_cum = cum + g
    # Only the portion ABOVE the previous peak is fee-bearing, and never
    # more than this trade actually made (a trade can't be charged for
    # profit it didn't produce).
    billable = new_cum - hwm
    if billable < ZERO:
        billable = ZERO
    if billable > g:
        billable = g if g > ZERO else ZERO

    fee = (billable * pct / Decimal("100")) if (billable > ZERO and pct > ZERO) else ZERO
    new_hwm = new_cum if new_cum > hwm else hwm
    return fee, new_cum, new_hwm


def apply_hwm_fee(allocation, gross_profit: Decimal, perf_pct: Decimal) -> Decimal:
    """Charge `allocation` for one closed copy trade and ADVANCE its
    high-water state in place. Returns the performance fee to collect.

    The allocation's gross_pnl_cum / hwm_profit are updated here and
    persisted by the caller's commit — so every close path (engine mirror
    close, stop-copy, managed-account withdrawal) shares one implementation
    and cannot drift apart.
    """
    fee, new_cum, new_hwm = compute_hwm_fee(
        gross_profit=gross_profit,
        prev_cum=getattr(allocation, "gross_pnl_cum", None) or ZERO,
        prev_hwm=getattr(allocation, "hwm_profit", None) or ZERO,
        perf_pct=perf_pct,
    )
    allocation.gross_pnl_cum = new_cum
    allocation.hwm_profit = new_hwm
    return fee
