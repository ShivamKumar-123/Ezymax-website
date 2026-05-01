"""Tier pricing engine — produce the four-quote response for `/insurance/quote`."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import InsuranceConfig
from .risk import risk_score

TIERS: tuple[str, ...] = ("basic", "advanced", "pro", "elite")


async def _frequent_claim_reduction(
    db: AsyncSession, user_id: Optional[UUID], cfg: InsuranceConfig,
) -> float:
    """Returns the coverage multiplier (≤1.0) for frequent claimers.
    1.0 = no reduction. Best-effort: returns 1.0 if anything fails."""
    if user_id is None:
        return 1.0
    try:
        # Local import — avoid circular load when this module is read at
        # gateway boot before models/__init__ finishes.
        from ..models import InsuranceClaim
        since = datetime.now(timezone.utc) - timedelta(days=cfg.frequent_claim_window_days)
        cnt = (await db.execute(
            select(func.count())
            .select_from(InsuranceClaim)
            .where(
                InsuranceClaim.user_id == user_id,
                InsuranceClaim.paid_at >= since,
            )
        )).scalar() or 0
        if int(cnt) >= cfg.frequent_claim_count:
            return max(0.0, 1.0 - float(cfg.frequent_claim_coverage_reduction_pct))
    except Exception:
        pass
    return 1.0


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


async def quote_all_tiers(
    *,
    cfg: InsuranceConfig,
    leverage: float,
    atr: float,
    lots: float,
    trade_size_usd: float,
    has_stop_loss: bool,
    sl_distance: Optional[float],
    win_rate: float,
    db: Optional[AsyncSession] = None,
    user_id: Optional[UUID] = None,
    is_copy_trade: bool = False,
) -> list[TierQuote]:
    """Return the four tiered quotes. Caller is expected to pre-check
    `cfg.enabled`, news blackout, and ATR bounds — this function only
    does the math.

    `db` + `user_id` are optional but enable the slide-16 frequent-claim
    coverage reduction. `is_copy_trade=True` adds slide-18's copy-trade
    fee surcharge."""
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
    if is_copy_trade:
        surcharge += cfg.copy_trade_surcharge

    # Slide 16 — frequent-claim coverage reduction. Caller must pass db +
    # user_id for the lookup to fire; otherwise the multiplier is 1.0.
    coverage_multiplier = 1.0
    if db is not None and user_id is not None:
        coverage_multiplier = await _frequent_claim_reduction(db, user_id, cfg)

    quotes: list[TierQuote] = []
    for tier in TIERS:
        mult = cfg.tier_multipliers.get(tier, 1)
        tier_fee = base_fee * mult * (1 + surcharge)
        final_fee = min(tier_fee, fee_cap)

        rack_coverage = cfg.coverage_pct.get(tier, 0)
        coverage = rack_coverage * coverage_multiplier
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
