"""Trade Insurance — micro-insurance engine.

Per-trade protection product. User pays a fee at order placement; if the
trade closes in loss and a set of anti-abuse + volatility + hedge gates
pass, a partial payout is credited to the user's main wallet.

Math is documented in `Trade Insurance.docx` at the repo root.
"""

from .pricing import quote_all_tiers, TIERS
from .claims import maybe_pay, evaluate_claim
from .config import load_config, InsuranceConfig

__all__ = [
    "quote_all_tiers",
    "TIERS",
    "maybe_pay",
    "evaluate_claim",
    "load_config",
    "InsuranceConfig",
]
