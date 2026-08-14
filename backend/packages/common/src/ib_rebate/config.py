"""Config for the Milele-style IB rebate model — read from `system_settings`
so admins can retune the ladder / overrides / thresholds without a deploy.

All keys are prefixed `ib_` and seeded with the Milele defaults on startup.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from ..settings_store import get_system_setting, get_float_setting, get_bool_setting

# ── Milele defaults ──────────────────────────────────────────────────────────
# Tier ladder: highest tier whose BOTH thresholds (lots + active clients) are met
# wins. Rate is USD per eligible closed lot.
DEFAULT_TIERS: list[dict[str, Any]] = [
    {"tier": "starter", "min_lots": 0,   "min_clients": 0,  "rate": 3},
    {"tier": "builder", "min_lots": 200, "min_clients": 3,  "rate": 5},
    {"tier": "pro",     "min_lots": 500, "min_clients": 10, "rate": 7},
]

# Override percentages by upline depth (L1, L2, L3, …). Beyond the list length the
# last value halves at each further level; the running total is capped at
# `override_cap_pct` (Milele: "never more than 20% on top of any rebate").
DEFAULT_OVERRIDE_PCTS: list[float] = [10.0, 5.0, 2.5]
DEFAULT_OVERRIDE_CAP_PCT = 20.0
DEFAULT_OVERRIDE_MAX_LEVELS = 8

DEFAULT_ACTIVE_MIN_LOTS = 0.5


@dataclass
class IbRebateConfig:
    # 'instant' = legacy flat per-lot at fill (unchanged). 'accrual' = this model.
    model: str = "instant"
    tiers: list[dict[str, Any]] = field(default_factory=lambda: list(DEFAULT_TIERS))
    override_pcts: list[float] = field(default_factory=lambda: list(DEFAULT_OVERRIDE_PCTS))
    override_cap_pct: float = DEFAULT_OVERRIDE_CAP_PCT
    override_max_levels: int = DEFAULT_OVERRIDE_MAX_LEVELS
    # active-client definition
    active_min_lots: float = DEFAULT_ACTIVE_MIN_LOTS
    active_require_kyc: bool = True
    active_require_deposit: bool = True
    # count every instrument's closed lots (True) or only a configured set (future)
    all_instruments: bool = True

    def tier_for(self, lots: Decimal, active_clients: int) -> tuple[str, Decimal]:
        """Highest tier whose lots AND client thresholds are both met."""
        chosen = ("starter", Decimal("0"))
        best_rank = -1
        for i, t in enumerate(self.tiers):
            if float(lots) >= float(t.get("min_lots", 0)) and active_clients >= int(t.get("min_clients", 0)):
                if i >= best_rank:
                    best_rank = i
                    chosen = (str(t.get("tier", "starter")), Decimal(str(t.get("rate", 0))))
        return chosen

    def override_pct_for_level(self, level: int) -> float:
        """Override % at a given upline depth (1-indexed), applying the halving
        tail beyond the explicit list."""
        if level <= 0:
            return 0.0
        if level <= len(self.override_pcts):
            return float(self.override_pcts[level - 1])
        last = float(self.override_pcts[-1]) if self.override_pcts else 0.0
        return last / (2 ** (level - len(self.override_pcts)))


async def load_config() -> IbRebateConfig:
    tiers = await get_system_setting("ib_rebate_tiers", None)
    if not isinstance(tiers, list) or not tiers:
        tiers = list(DEFAULT_TIERS)
    pcts = await get_system_setting("ib_override_pcts", None)
    if not isinstance(pcts, list) or not pcts:
        pcts = list(DEFAULT_OVERRIDE_PCTS)
    return IbRebateConfig(
        model=str(await get_system_setting("ib_commission_model", "instant") or "instant"),
        tiers=tiers,
        override_pcts=[float(p) for p in pcts],
        override_cap_pct=await get_float_setting("ib_override_cap_pct", DEFAULT_OVERRIDE_CAP_PCT),
        override_max_levels=int(await get_float_setting("ib_override_max_levels", DEFAULT_OVERRIDE_MAX_LEVELS)),
        active_min_lots=await get_float_setting("ib_active_client_min_lots", DEFAULT_ACTIVE_MIN_LOTS),
        active_require_kyc=await get_bool_setting("ib_active_require_kyc", True),
        active_require_deposit=await get_bool_setting("ib_active_require_deposit", True),
        all_instruments=await get_bool_setting("ib_rebate_all_instruments", True),
    )
