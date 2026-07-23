"""IB Commission engine — thin re-export.

The distribution logic moved to ``packages/common/src/ib_commission.py`` so
the standalone b-book-engine can call it too (a pending/limit order that fills
in that service must earn the IB the same commission a market order does).
Gateway call-sites (`trading_service`, `copy_engine`) keep importing from here
unchanged.
"""
from packages.common.src.ib_commission import (  # noqa: F401
    distribute_ib_commission,
    get_mlm_distribution,
    DEFAULT_MLM_DISTRIBUTION,
)
