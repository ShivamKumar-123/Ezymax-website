"""Account-type guards for trader-facing trading paths (spec section B).

Platform-created copy / MAM sub-accounts (account numbers ``CF…`` for signal
copy funds and ``IF…`` for managed-fund sub-accounts, see
``social_service._gen_investor_account_number``) exist only to mirror a
master's trades. Letting the owner trade them manually made "risk-free"
trading possible: open a manual position on the copy account, then stop the
copy — the account was refunded and deactivated while the manual position
stayed open on an account nobody monitored any more.

Rules enforced from here:
  * no manual orders on platform-created copy sub-accounts;
  * leverage on copy / MAM sub-accounts follows the user's KYC cap
    (fallback ``DEFAULT_COPY_SUBACCOUNT_LEVERAGE`` = 50, never 500).
"""
from fastapi import HTTPException

# Account-number prefixes of platform-created follower sub-accounts.
PLATFORM_COPY_ACCOUNT_PREFIXES = ("CF", "IF")

# Leverage for a copy / MAM sub-account when no account group / KYC cap
# can be resolved. Matches account_service.DEFAULT_USER_MAX_LEVERAGE.
DEFAULT_COPY_SUBACCOUNT_LEVERAGE = 50


def is_platform_copy_subaccount(account) -> bool:
    """True if `account` is a platform-created copy / MAM follower sub-account."""
    num = (getattr(account, "account_number", None) or "").strip().upper()
    return num.startswith(PLATFORM_COPY_ACCOUNT_PREFIXES)


def assert_manual_trading_allowed(account) -> None:
    """Refuse manual (user / algo-key) orders on copy sub-accounts. The copy
    engine opens mirrored positions directly, not through place_order."""
    if is_platform_copy_subaccount(account):
        raise HTTPException(
            status_code=403,
            detail="This is a copy-trading account — its trades are placed by the "
                   "strategy you follow. Manual orders are not allowed on it.",
        )


def copy_subaccount_leverage(user, group=None) -> int:
    """Leverage for a new copy / MAM sub-account: the group's default leverage
    clamped to the user's effective cap (KYC-approved users get the group
    ceiling, everyone else DEFAULT_COPY_SUBACCOUNT_LEVERAGE). Without a group
    the conservative fallback is used."""
    if group is None:
        return DEFAULT_COPY_SUBACCOUNT_LEVERAGE
    group_cap = int(getattr(group, "max_leverage", None) or getattr(group, "leverage_default", None)
                    or DEFAULT_COPY_SUBACCOUNT_LEVERAGE)
    kyc_ok = (getattr(user, "kyc_status", None) or "").lower() in ("approved", "verified")
    cap = group_cap if kyc_ok else min(group_cap, DEFAULT_COPY_SUBACCOUNT_LEVERAGE)
    default = int(getattr(group, "leverage_default", None) or cap)
    return max(1, min(default, cap))
