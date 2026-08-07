"""Shared realized-P&L settlement — consume bonus credit before real balance.

Bonus money lives on a trading account as `credit` (moved there from the
user's non-withdrawable bonus wallet). Business rule:

  • On a PROFIT  → the whole amount goes to `balance` (real, withdrawable cash).
  • On a LOSS    → drain `credit` (bonus) FIRST, then the rest from `balance`.

This is the single place that money rule lives. Every settlement path
(manual close, SL/TP, stop-out, overnight fee) applies P&L through here so the
behaviour is identical everywhere.

The caller is still responsible for recomputing equity / free margin after
(equity = balance + credit) — every existing call site already does that.
"""
from decimal import Decimal


def apply_realized_pnl(account, pnl) -> None:
    """Apply signed realized P&L to `account`, consuming `credit` before
    `balance` on losses. Mutates account.balance and account.credit in place."""
    amount = Decimal(str(pnl or 0))
    balance = Decimal(str(account.balance or 0))
    credit = Decimal(str(account.credit or 0))

    if amount >= 0:
        # Profit → real (withdrawable) balance. Bonus credit is untouched.
        account.balance = balance + amount
        return

    loss = -amount
    from_credit = credit if credit < loss else loss  # min(credit, loss)
    account.credit = credit - from_credit
    account.balance = balance - (loss - from_credit)
