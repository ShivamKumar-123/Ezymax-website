"""Session lot ceilings — how big a single position may be, by time of day.

Liquidity thins out overnight, so the published account specification caps a
position at 200 lots between 07:00 and 20:59 GMT and steps that down hard
between 21:00 and 06:59: 20 lots on crypto, indices and the thin metals and
energies, 30 on gold, 10 on nickel, 60 on everything else.

The cap is per position, applies to every account tier alike, and is enforced
on top of (never instead of) the platform and per-instrument ceilings — the
smallest of the three wins.
"""
from datetime import datetime, time, timezone
from decimal import Decimal
from typing import Optional

# Daytime window, GMT. The specification writes it as 07:00–20:59, i.e. the
# night rules take over at 21:00 sharp and hold until 07:00.
DAY_START = time(7, 0)
DAY_END = time(21, 0)

DAY_MAX_LOTS = Decimal("200")
NIGHT_DEFAULT_LOTS = Decimal("60")
NIGHT_THIN_LOTS = Decimal("20")

# Symbols the specification names one by one for the 20-lot night cap. NATGAS
# is our ticker for the spec's XNGUSD.
NIGHT_THIN_SYMBOLS = {
    "UKOIL", "USOIL", "XNGUSD", "NATGAS",
    "XAGUSD", "XAGAUD", "XAGGBP", "XAGEUR",
    "XPDUSD", "XPTUSD", "XALUSD", "XCUUSD", "XZNUSD", "XPBUSD",
}

# Symbols with their own night cap, ahead of every rule below.
NIGHT_SYMBOL_OVERRIDES = {
    "XAUUSD": Decimal("30"),
    "XNIUSD": Decimal("10"),
}

# Segments that are thin overnight as a whole, whatever the symbol.
NIGHT_THIN_SEGMENTS = {"crypto", "index", "indices"}


def is_night_session(now: Optional[datetime] = None) -> bool:
    """True inside the 21:00–06:59 GMT window."""
    now = now or datetime.now(timezone.utc)
    t = now.timetz().replace(tzinfo=None) if now.tzinfo else now.time()
    return not (DAY_START <= t < DAY_END)


def session_max_lots(
    symbol: Optional[str],
    segment_name: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Decimal:
    """Largest position, in lots, allowed for this symbol right now."""
    if not is_night_session(now):
        return DAY_MAX_LOTS

    sym = (symbol or "").strip().upper()
    if sym in NIGHT_SYMBOL_OVERRIDES:
        return NIGHT_SYMBOL_OVERRIDES[sym]
    if sym in NIGHT_THIN_SYMBOLS:
        return NIGHT_THIN_LOTS
    if (segment_name or "").strip().lower() in NIGHT_THIN_SEGMENTS:
        return NIGHT_THIN_LOTS
    return NIGHT_DEFAULT_LOTS


def session_window_label(now: Optional[datetime] = None) -> str:
    """Human-readable window, for the message a rejected trader reads."""
    return "21:00–06:59 GMT" if is_night_session(now) else "07:00–20:59 GMT"
