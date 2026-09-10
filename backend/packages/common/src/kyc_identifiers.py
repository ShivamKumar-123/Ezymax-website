"""Validation and storage rules for KYC document numbers.

Kept in one place because the rule that matters is easy to get wrong by
accident: a full Aadhaar number must never reach the database. Everything
that accepts one funnels through ``prepare_aadhaar`` here, which returns
only the last four digits and a keyed HMAC and lets the number itself go
out of scope.
"""
import hashlib
import hmac
import re

from .config import get_settings

# PAN: five letters, four digits, one letter. The 4th character encodes the
# holder type and the 5th the surname initial, but validating those would
# reject legitimate edge cases, so only the shape is enforced.
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

# Aadhaar: 12 digits. Real numbers never start with 0 or 1.
AADHAAR_RE = re.compile(r"^[2-9][0-9]{11}$")


def normalise_pan(value: str | None) -> str | None:
    """Uppercased PAN, or None. Raises ValueError if present but malformed."""
    if value is None:
        return None
    pan = re.sub(r"\s+", "", str(value)).upper()
    if not pan:
        return None
    if not PAN_RE.match(pan):
        raise ValueError("PAN must be 5 letters, 4 digits, then 1 letter (e.g. ABCDE1234F)")
    return pan


def _verhoeff_ok(number: str) -> bool:
    """Aadhaar's checksum. Catches transpositions and single-digit typos that
    a length check alone would accept — worth doing when the number is about
    to be reduced to a hash we can never re-examine."""
    d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    ]
    p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
    ]
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = d[c][p[i % 8][int(ch)]]
    return c == 0


def prepare_aadhaar(value: str | None) -> tuple[str | None, str | None]:
    """Turn a full Aadhaar into (last4, hmac) and discard the rest.

    Returns (None, None) when nothing was supplied. Raises ValueError if the
    number is present but not a valid Aadhaar.

    The HMAC is keyed with the server's JWT secret, so the digest cannot be
    reproduced — or brute-forced against the mere 10^12 Aadhaar space — by
    anyone holding only the database. It exists to answer "is this Aadhaar
    already on another account?" and nothing else.
    """
    if value is None:
        return None, None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None, None
    if not AADHAAR_RE.match(digits):
        raise ValueError("Aadhaar must be 12 digits and cannot start with 0 or 1")
    if not _verhoeff_ok(digits):
        raise ValueError("Aadhaar number is not valid — please re-check the digits")

    secret = get_settings().JWT_SECRET.encode("utf-8")
    digest = hmac.new(secret, digits.encode("utf-8"), hashlib.sha256).hexdigest()
    return digits[-4:], digest


def mask_aadhaar(last4: str | None) -> str | None:
    """How an Aadhaar is shown: XXXX XXXX 1234."""
    if not last4:
        return None
    return f"XXXX XXXX {last4}"
