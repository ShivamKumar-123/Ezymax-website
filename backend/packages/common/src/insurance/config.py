"""Strongly-typed accessor over SystemSetting rows for insurance constants.

Reading via this dataclass means a single Redis round-trip per request
instead of one per setting key.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..settings_store import get_system_setting


@dataclass
class InsuranceConfig:
    enabled: bool
    base_constant: float
    tier_multipliers: dict[str, float]   # {"basic":1, ...}
    coverage_pct: dict[str, float]        # {"basic":20, ...}
    fee_cap: float
    fee_cap_high_volume: float
    high_volume_lots: float
    max_cap_rules: dict[str, list[float]]  # {"basic":[100, 0.10], ...}
    min_trade_duration_seconds: int
    daily_claim_limit: int
    daily_payout_limit: float
    cooldown_hours: int
    high_lev_threshold: float
    high_lev_surcharge: float
    no_sl_surcharge: float
    winrate_threshold: float
    winrate_surcharge: float
    atr_floor: float
    # Trade_Insurance.docx slide 17: disable insurance when volatility is
    # extreme (the inverse of atr_floor). NULL means "no ceiling" — keeps
    # the existing behaviour for installs that don't care about vol caps.
    atr_ceiling: Optional[float]
    # Slide 16 — frequent-claim coverage reduction. When a user has had
    # ≥ frequent_claim_count claims in the last frequent_claim_window_days
    # days, the offered coverage_pct on every tier is multiplied by
    # (1 - frequent_claim_coverage_reduction_pct).
    frequent_claim_count: int
    frequent_claim_window_days: int
    frequent_claim_coverage_reduction_pct: float
    # Slide 18 — copy-trade fee surcharge. Multiplies fee by (1 + this)
    # when caller marks the quote as a copy-trade context.
    copy_trade_surcharge: float
    # Coverage-duration plans. The user picks how long the policy stays
    # claimable (1 day / 1 week / 1 month); the fee (after the cap) is
    # multiplied by the plan's factor. Keys are the wire values.
    duration_fee_multipliers: dict[str, float]  # {"1d":1.0, "1w":1.5, "1m":2.5}
    news_blackout_until: Optional[datetime]


_DEFAULTS = InsuranceConfig(
    enabled=True,
    base_constant=1.2,
    tier_multipliers={"basic": 1, "advanced": 2, "pro": 3, "elite": 4},
    coverage_pct={"basic": 20, "advanced": 30, "pro": 40, "elite": 50},
    fee_cap=6.0,
    fee_cap_high_volume=12.0,
    high_volume_lots=5.0,
    max_cap_rules={
        "basic": [100, 0.10],
        "advanced": [300, 0.20],
        "pro": [600, 0.30],
        "elite": [1000, 0.50],
    },
    min_trade_duration_seconds=300,
    daily_claim_limit=2,
    daily_payout_limit=2000,
    cooldown_hours=12,
    high_lev_threshold=200,
    high_lev_surcharge=0.20,
    no_sl_surcharge=0.15,
    winrate_threshold=0.65,
    winrate_surcharge=0.15,
    atr_floor=0.0001,
    atr_ceiling=None,
    frequent_claim_count=4,                      # 4+ claims in 30d → reduce
    frequent_claim_window_days=30,
    frequent_claim_coverage_reduction_pct=0.25,  # 25% off coverage
    copy_trade_surcharge=0.10,                   # +10% fee on copy trades
    duration_fee_multipliers={"1d": 1.0, "1w": 1.5, "1m": 2.5},
    news_blackout_until=None,
)


async def load_config() -> InsuranceConfig:
    async def _get(key: str, default):
        v = await get_system_setting(key, default)
        return v if v is not None else default

    blackout_raw = await _get("insurance_news_blackout_until", None)
    blackout: Optional[datetime] = None
    if isinstance(blackout_raw, str):
        try:
            blackout = datetime.fromisoformat(blackout_raw.replace("Z", "+00:00"))
        except ValueError:
            blackout = None

    return InsuranceConfig(
        enabled=bool(await _get("insurance_enabled", True)),
        base_constant=float(await _get("insurance_base_constant", _DEFAULTS.base_constant)),
        tier_multipliers=dict(await _get("insurance_tier_multipliers", _DEFAULTS.tier_multipliers)),
        coverage_pct=dict(await _get("insurance_coverage_pct", _DEFAULTS.coverage_pct)),
        fee_cap=float(await _get("insurance_fee_cap", _DEFAULTS.fee_cap)),
        fee_cap_high_volume=float(await _get("insurance_fee_cap_high_volume", _DEFAULTS.fee_cap_high_volume)),
        high_volume_lots=float(await _get("insurance_high_volume_lots", _DEFAULTS.high_volume_lots)),
        max_cap_rules=dict(await _get("insurance_max_cap_rules", _DEFAULTS.max_cap_rules)),
        min_trade_duration_seconds=int(await _get("insurance_min_trade_duration_seconds", _DEFAULTS.min_trade_duration_seconds)),
        daily_claim_limit=int(await _get("insurance_anti_abuse_daily_claims", _DEFAULTS.daily_claim_limit)),
        daily_payout_limit=float(await _get("insurance_anti_abuse_daily_payout", _DEFAULTS.daily_payout_limit)),
        cooldown_hours=int(await _get("insurance_anti_abuse_cooldown_hours", _DEFAULTS.cooldown_hours)),
        high_lev_threshold=float(await _get("insurance_dynamic_high_lev_threshold", _DEFAULTS.high_lev_threshold)),
        high_lev_surcharge=float(await _get("insurance_dynamic_high_lev_surcharge", _DEFAULTS.high_lev_surcharge)),
        no_sl_surcharge=float(await _get("insurance_dynamic_no_sl_surcharge", _DEFAULTS.no_sl_surcharge)),
        winrate_threshold=float(await _get("insurance_dynamic_winrate_threshold", _DEFAULTS.winrate_threshold)),
        winrate_surcharge=float(await _get("insurance_dynamic_winrate_surcharge", _DEFAULTS.winrate_surcharge)),
        atr_floor=float(await _get("insurance_disable_atr_floor", _DEFAULTS.atr_floor)),
        atr_ceiling=(
            float(await _get("insurance_disable_atr_ceiling", _DEFAULTS.atr_ceiling))
            if (await _get("insurance_disable_atr_ceiling", None)) is not None
            else None
        ),
        frequent_claim_count=int(await _get("insurance_frequent_claim_count", _DEFAULTS.frequent_claim_count)),
        frequent_claim_window_days=int(await _get("insurance_frequent_claim_window_days", _DEFAULTS.frequent_claim_window_days)),
        frequent_claim_coverage_reduction_pct=float(await _get("insurance_frequent_claim_coverage_reduction_pct", _DEFAULTS.frequent_claim_coverage_reduction_pct)),
        copy_trade_surcharge=float(await _get("insurance_copy_trade_surcharge", _DEFAULTS.copy_trade_surcharge)),
        duration_fee_multipliers=dict(await _get("insurance_duration_fee_multipliers", _DEFAULTS.duration_fee_multipliers)),
        news_blackout_until=blackout,
    )
