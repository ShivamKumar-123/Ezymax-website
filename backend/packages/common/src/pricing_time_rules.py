"""Time-windowed spread / leverage rules — pure resolution logic.

No DB, no I/O — just the math of "which rule is active right now and what
does it say". Both the market-data feed (spread) and the gateway (leverage
cap) load ``pricing_time_rules`` rows from Postgres and feed them here as
plain dicts, so the matching semantics stay identical across services.

All times are **UTC**. Days are 0=Mon … 6=Sun (Python ``weekday()``).
Minutes are minutes-of-day, 0..1440.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable, Optional


# Preset market sessions (UTC, Mon–Fri). Minutes-of-day [start, end).
SESSION_PRESETS: dict[str, dict[str, Any]] = {
    "asian":             {"label": "Asian (Tokyo)",        "days": [0, 1, 2, 3, 4], "start_min": 0,    "end_min": 540},   # 00:00–09:00
    "london":            {"label": "London",               "days": [0, 1, 2, 3, 4], "start_min": 420,  "end_min": 960},   # 07:00–16:00
    "newyork":           {"label": "New York",             "days": [0, 1, 2, 3, 4], "start_min": 720,  "end_min": 1260},  # 12:00–21:00
    "overlap_london_ny": {"label": "London/NY overlap",    "days": [0, 1, 2, 3, 4], "start_min": 720,  "end_min": 960},   # 12:00–16:00
}

_SCOPE_RANK = {"instrument": 3, "segment": 2, "default": 1}


def _g(rule: Any, key: str, default=None):
    """Read a field from a dict or an ORM object uniformly."""
    if isinstance(rule, dict):
        return rule.get(key, default)
    return getattr(rule, key, default)


def _window(rule: Any) -> Optional[tuple[set[int], int, int]]:
    """(days_set, start_min, end_min) for a rule, or None if malformed."""
    kind = (_g(rule, "kind") or "custom").lower()
    if kind == "session":
        preset = SESSION_PRESETS.get((_g(rule, "session") or "").lower())
        if not preset:
            return None
        return set(preset["days"]), int(preset["start_min"]), int(preset["end_min"])
    days = _g(rule, "days_of_week") or []
    try:
        days_set = {int(d) for d in days}
    except (TypeError, ValueError):
        days_set = set()
    start = _g(rule, "start_min")
    end = _g(rule, "end_min")
    if start is None or end is None:
        return None
    return days_set, int(start), int(end)


def is_active(rule: Any, now_utc: datetime) -> bool:
    """True if ``rule``'s window contains ``now_utc`` (UTC)."""
    win = _window(rule)
    if win is None:
        return False
    days, start, end = win
    if days and now_utc.weekday() not in days:
        # For a window that wraps past midnight we still anchor the
        # day-of-week check on the start day, which is the common case
        # (sessions never wrap; custom wraps are rare). Keep it simple.
        if not (start > end):
            return False
    minute = now_utc.hour * 60 + now_utc.minute
    if start <= end:
        return start <= minute < end
    # Wraps midnight (e.g. 22:00–02:00): active late today or early "today".
    return minute >= start or minute < end


def _matches_target(rule: Any, instrument_id, segment_id) -> bool:
    scope = (_g(rule, "scope") or "default").lower()
    if scope == "instrument":
        return str(_g(rule, "instrument_id")) == str(instrument_id) if instrument_id else False
    if scope == "segment":
        return str(_g(rule, "segment_id")) == str(segment_id) if segment_id else False
    return scope == "default"


def resolve_active(
    rules: Iterable[Any],
    instrument_id,
    segment_id,
    now_utc: datetime,
) -> Optional[Any]:
    """Most-specific active rule for this instrument, or None.

    Precedence: scope (instrument > segment > default), then ``priority``
    (higher wins), then most recently considered.
    """
    best = None
    best_key = None
    for r in rules:
        if not _g(r, "is_enabled", True):
            continue
        if not _matches_target(r, instrument_id, segment_id):
            continue
        if not is_active(r, now_utc):
            continue
        scope = (_g(r, "scope") or "default").lower()
        key = (_SCOPE_RANK.get(scope, 0), int(_g(r, "priority", 0) or 0))
        if best_key is None or key > best_key:
            best, best_key = r, key
    return best


def effective_leverage_cap(
    rules: Iterable[Any],
    instrument_id,
    segment_id,
    now_utc: datetime,
) -> Optional[int]:
    """Leverage cap from the active rule (None = no cap)."""
    rule = resolve_active(rules, instrument_id, segment_id, now_utc)
    if rule is None:
        return None
    cap = _g(rule, "leverage_cap")
    try:
        cap = int(cap) if cap is not None else None
    except (TypeError, ValueError):
        return None
    return cap if (cap and cap > 0) else None


def apply_spread_rule(
    rule: Any,
    base_value: Decimal,
    base_type: str,
) -> tuple[Decimal, str]:
    """Fold an active rule into the base spread.

    Returns (value, type). ``multiplier`` scales the base; ``absolute``
    replaces it. No rule → base unchanged.
    """
    if rule is None:
        return base_value, base_type
    mode = (_g(rule, "spread_mode") or "multiplier").lower()
    if mode == "absolute":
        val = _g(rule, "spread_value")
        if val is not None:
            return Decimal(str(val)), (_g(rule, "spread_type") or base_type or "pips").lower()
        return base_value, base_type
    mult = _g(rule, "spread_multiplier")
    try:
        m = Decimal(str(mult)) if mult is not None else Decimal("1")
    except Exception:
        m = Decimal("1")
    return base_value * m, base_type
