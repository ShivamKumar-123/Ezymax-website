"""Tier pricing engine — produce the four-quote response for `/insurance/quote`."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional, TypedDict

from .config import InsuranceConfig
from .risk import risk_score

TIERS: tuple[str, ...] = ("basic", "advanced", "pro", "elite")


class TierQuote(TypedDict):
    tier: str
    fee: float
    coverage_pct: float
    max_cap: float
    estimated_refund: float
    risk_score: float


def _max_cap_for(tier: str, trade_size_usd: float, cfg: InsuranceConfig) -> float:
    flat, pct = cfg.max_cap_rules[tier]
    return float(min(flat, pct * trade_size_usd))


def _estimated_refund(
    *,
    coverage_pct: float,
    sl_distance: Optional[float],
    position_value_usd: float,
) -> float:
    """Display-only number — what a user could expect if SL is hit.
    Falls back to 0 when no SL given (UI just hides the line)."""
    if not sl_distance or position_value_usd <= 0:
        return 0.0
    return float(sl_distance * position_value_usd * (coverage_pct / 100.0))


def quote_all_tiers(
    *,
    cfg: InsuranceConfig,
    leverage: float,
    atr: float,
    lots: float,
    trade_size_usd: float,
    has_stop_loss: bool,
    sl_distance: Optional[float],
    win_rate: float,
) -> list[TierQuote]:
    """Return the four tiered quotes. Caller is expected to pre-check
    `cfg.enabled`, news blackout, and ATR floor — this function only
    does the math."""
    rs = risk_score(leverage, atr, lots)
    base_fee = rs * cfg.base_constant

    # Fee cap — high-volume threshold widens the cap.
    fee_cap = cfg.fee_cap_high_volume if lots >= cfg.high_volume_lots else cfg.fee_cap

    # Dynamic surcharges
    surcharge = 0.0
    if leverage > cfg.high_lev_threshold:
        surcharge += cfg.high_lev_surcharge
    if not has_stop_loss:
        surcharge += cfg.no_sl_surcharge
    if win_rate >= cfg.winrate_threshold:
        surcharge += cfg.winrate_surcharge

    quotes: list[TierQuote] = []
    for tier in TIERS:
        mult = cfg.tier_multipliers.get(tier, 1)
        tier_fee = base_fee * mult * (1 + surcharge)
        final_fee = min(tier_fee, fee_cap)

        coverage = cfg.coverage_pct.get(tier, 0)
        max_cap = _max_cap_for(tier, trade_size_usd, cfg)
        est_refund = _estimated_refund(
            coverage_pct=coverage,
            sl_distance=sl_distance,
            position_value_usd=trade_size_usd,
        )

        quotes.append({
            "tier": tier,
            "fee": round(final_fee, 2),
            "coverage_pct": round(coverage, 2),
            "max_cap": round(max_cap, 2),
            "estimated_refund": round(est_refund, 2),
            "risk_score": round(rs, 4),
        })
    return quotes


def fee_to_decimal(fee: float) -> Decimal:
    """Convenience for callers that need a Decimal-typed fee for the wallet ledger."""
    return Decimal(str(round(fee, 2)))
