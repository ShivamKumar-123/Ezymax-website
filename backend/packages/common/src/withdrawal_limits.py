"""Single source of truth for how much a user may withdraw from a debit source.

C-MONEY-3 / H-MONEY-1: several withdrawal paths (main-wallet withdrawal, manual
UPI payout, on-chain USDT) each derived the withdrawable figure inline, and two
of them used the raw account *balance* — letting a user pull out funds that
collateralise open positions (margin). This helper centralises the rule so every
path agrees:

  * trading account → only funds NOT backing open positions:
    (balance - margin_used), additionally capped by free_margin when the
    account tracks it. Never negative.
  * main wallet     → the full main_wallet_balance (no positions attached).
"""
from decimal import Decimal


def _d(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def available_to_withdraw(
    kind: str,
    *,
    balance=None,
    margin_used=None,
    free_margin=None,
    main_wallet_balance=None,
) -> Decimal:
    """Return the amount withdrawable from the given source. See module docstring."""
    if kind == "trading":
        avail = _d(balance) - _d(margin_used)
        if free_margin is not None:
            avail = min(avail, _d(free_margin))
        return avail if avail > Decimal("0") else Decimal("0")
    return _d(main_wallet_balance)
