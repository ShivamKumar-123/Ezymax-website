"""Placeholder-email recognition for wallet-only (SIWE) signups.

A user who signs up with a wallet and no mailbox gets a synthetic address
``wallet_<addr>@<domain>`` written into ``users.email``. It is not a real
mailbox, so every path that would send mail, count a user as reachable or
treat the address as verified has to recognise it.

Why this is a list and not one constant
---------------------------------------
The domain carries the brand, so a rebrand changes it — but the addresses
ALREADY WRITTEN into ``users.email`` keep the old one forever. New signups
use :data:`WALLET_PLACEHOLDER_DOMAIN`; recognition must accept every domain
the platform has ever issued, or the day of the rebrand every pre-existing
wallet user silently becomes "has a real mailbox" and starts getting
undeliverable mail, monthly statements and verification nags.

Only ever APPEND to :data:`LEGACY_WALLET_PLACEHOLDER_DOMAINS`. An entry may
be dropped only once no row in ``users.email`` still ends with it.
"""
from __future__ import annotations

# Domain used for placeholder addresses minted from now on.
WALLET_PLACEHOLDER_DOMAIN = "wallet.ezymex.local"

# Domains issued by earlier brands. Recognised, never minted.
LEGACY_WALLET_PLACEHOLDER_DOMAINS: tuple[str, ...] = ("wallet.swisscresta.local",)

ALL_WALLET_PLACEHOLDER_DOMAINS: tuple[str, ...] = (
    WALLET_PLACEHOLDER_DOMAIN,
    *LEGACY_WALLET_PLACEHOLDER_DOMAINS,
)

# "@domain" suffixes, lower-cased, ready for str.endswith.
_SUFFIXES: tuple[str, ...] = tuple(f"@{d}" for d in ALL_WALLET_PLACEHOLDER_DOMAINS)


def is_wallet_placeholder_email(email: str | None) -> bool:
    """True when ``email`` is a synthetic wallet-signup address (any brand era)."""
    return (email or "").lower().endswith(_SUFFIXES)


def placeholder_email_for(wallet_address: str) -> str:
    """Mint a new placeholder address for ``wallet_address``."""
    return f"wallet_{wallet_address.lower()}@{WALLET_PLACEHOLDER_DOMAIN}"


def not_placeholder_sql(column: str = "email") -> str:
    """SQL predicate excluding placeholder addresses, every era covered.

    Returned as a fragment to interpolate into a larger statement, e.g.
    ``f"SELECT id FROM users WHERE {not_placeholder_sql('lower(email)')}"``.
    The domains are module constants (never user input), so there is nothing
    to parameterise here.
    """
    return " AND ".join(
        f"lower({column}) NOT LIKE '%@{d}'" for d in ALL_WALLET_PLACEHOLDER_DOMAINS
    )
