"""Server-side password policy — the authoritative twin of the client's
frontend/trader/src/lib/passwordStrength.ts. Applied via Pydantic validators
on every path that SETS a password (register, reset, change), so weak
passwords like '12345678' are rejected even when the client is bypassed.

Policy (all required):
  - 8..128 characters (length bounds enforced by the schema Field)
  - at least 3 of 4 character classes (lower / upper / digit / symbol)
  - not a known-common password or a trivial sequence/repetition
"""
import re

_COMMON_PASSWORDS = {
    "12345678", "123456789", "1234567890", "87654321", "password", "password1",
    "password123", "passw0rd", "qwerty123", "qwertyuiop", "1q2w3e4r", "1qaz2wsx",
    "abc12345", "abcd1234", "iloveyou", "sunshine", "football", "monkey123",
    "letmein1", "admin123", "welcome1", "dragon123", "11111111", "00000000",
    "aa123456", "a1234567", "qwer1234", "asdf1234", "zaq12wsx", "swisscresta",
}


def _is_sequential_or_repeated(pw: str) -> bool:
    s = pw.lower()
    if re.fullmatch(r"(.)\1+", s):
        return True
    diffs = {ord(b) - ord(a) for a, b in zip(s, s[1:])}
    return diffs == {1} or diffs == {-1}


def validate_password_strength(pw: str) -> str:
    """Pydantic-compatible validator: returns the value or raises ValueError
    with a user-facing message."""
    if len(pw) < 8:
        raise ValueError("Password must be at least 8 characters.")
    classes = sum((
        bool(re.search(r"[a-z]", pw)),
        bool(re.search(r"[A-Z]", pw)),
        bool(re.search(r"[0-9]", pw)),
        bool(re.search(r"[^a-zA-Z0-9]", pw)),
    ))
    if classes < 3:
        raise ValueError(
            "Password must mix at least 3 of: lowercase, uppercase, number, symbol."
        )
    if pw.lower() in _COMMON_PASSWORDS or _is_sequential_or_repeated(pw):
        raise ValueError("Password is too common or predictable — choose something unique.")
    return pw
