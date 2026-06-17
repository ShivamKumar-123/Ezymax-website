"""Load admin spread settings and widen mid prices for Redis/WebSocket quotes.

Spread applied to each streamed tick is the product of three layers:

  1. **Base** — admin ``spread_configs`` / ``instrument_configs`` (resolved
     by ``resolve_spread_config``). If admin has configured nothing for an
     instrument (no per-instrument / segment / default rule), the base
     spread is 0 — bid == ask. Admin settings are the single source of
     truth; there is no hardcoded fallback.
  2. **Time-rule** — an active ``pricing_time_rules`` window (preset market
     session or custom UTC day/hour range) either multiplies the base or
     replaces it with an absolute value.
  3. **Live volatility** — when ``dynamic_spread_enabled`` is on, the spread
     widens with recent price movement (fast market ⇒ wider), capped at
     ``dynamic_spread_max_mult``.

Layers 2 and 3 are exactly the admin's "set it, then let it fluctuate with
the market" requirement.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from datetime import datetime, timezone
from decimal import Decimal
from typing import Deque, Dict, Optional, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.instrument_pricing import resolve_spread_config, symmetric_quote_from_mid
from packages.common.src.models import Instrument, SpreadConfig, PricingTimeRule
from packages.common.src.pricing_time_rules import resolve_active, apply_spread_rule

logger = logging.getLogger("market-data.spread-cache")

# How often to reload spread params + time rules from Postgres (admin edits).
RELOAD_INTERVAL_SEC = 30.0

# Hard ceiling on the volatility multiplier regardless of admin setting —
# stops a runaway feed from producing absurd spreads.
_VOL_MULT_HARD_CAP = 10.0


class StreamSpreadCache:
    """symbol -> (spread_value, spread_type, pip_size, digits) plus the
    active time-rule set and a short per-symbol price history for the
    live-volatility multiplier."""

    def __init__(self) -> None:
        self._params: Dict[str, Tuple[Decimal, str, Decimal, int]] = {}
        # symbol -> (instrument_id|None, segment_id|None) for time-rule matching
        self._meta: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
        self._rules: list[dict] = []
        self._default_spread: Tuple[Decimal, str] = (Decimal("0"), "pips")
        # Dynamic-spread tunables (system_settings); refreshed on reload.
        self._dyn = {"enabled": False, "max_mult": 3.0, "sensitivity": 1.0, "window_sec": 60.0}
        # symbol -> deque[(monotonic_ts, mid)] within the volatility window
        self._hist: Dict[str, Deque[Tuple[float, float]]] = {}
        self._lock = asyncio.Lock()
        self._last_reload = 0.0

    async def reload_if_stale(self, force: bool = False) -> None:
        now = time.monotonic()
        if not force and (now - self._last_reload) < RELOAD_INTERVAL_SEC and self._params:
            return
        async with self._lock:
            now = time.monotonic()
            if not force and (now - self._last_reload) < RELOAD_INTERVAL_SEC and self._params:
                return
            try:
                async with AsyncSessionLocal() as db:
                    r = await db.execute(
                        select(Instrument)
                        .where(Instrument.is_active == True)
                        .options(selectinload(Instrument.segment))
                    )
                    rows = r.scalars().unique().all()
                    new: Dict[str, Tuple[Decimal, str, Decimal, int]] = {}
                    meta: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
                    for inst in rows:
                        sv, st, _pimp = await resolve_spread_config(db, inst)
                        pip = Decimal(str(inst.pip_size or 0.0001))
                        digits = int(inst.digits or 5)
                        sym = (inst.symbol or "").strip().upper()
                        if sym:
                            new[sym] = (sv, st, pip, digits)
                            meta[sym] = (
                                str(inst.id),
                                str(inst.segment_id) if inst.segment_id else None,
                            )
                    dr = await db.execute(
                        select(SpreadConfig.value, SpreadConfig.spread_type)
                        .where(
                            func.lower(SpreadConfig.scope) == "default",
                            SpreadConfig.is_enabled == True,
                            SpreadConfig.instrument_id.is_(None),
                            SpreadConfig.segment_id.is_(None),
                            SpreadConfig.user_id.is_(None),
                        )
                        .order_by(SpreadConfig.created_at.desc())
                        .limit(1)
                    )
                    drow = dr.first()
                    self._default_spread = (
                        (Decimal(str(drow[0] or 0)), (drow[1] or "pips").lower())
                        if drow else (Decimal("0"), "pips")
                    )

                    # Active time-rule set (detached plain dicts so we never
                    # touch ORM objects outside the session).
                    self._rules = await self._load_rules(db)
                    self._dyn = await self._load_dynamic_settings(db)

                    self._params = new
                    self._meta = meta
                    self._last_reload = time.monotonic()
                    logger.info(
                        "Reloaded spread params for %d instruments, %d time-rule(s), "
                        "dynamic=%s (max_mult=%.1f, sens=%.2f, win=%ds)",
                        len(new), len(self._rules), self._dyn["enabled"],
                        self._dyn["max_mult"], self._dyn["sensitivity"], int(self._dyn["window_sec"]),
                    )
            except Exception as exc:
                logger.warning("Spread cache reload failed: %s", exc)

    async def _load_rules(self, db) -> list[dict]:
        try:
            rows = (await db.execute(
                select(PricingTimeRule).where(PricingTimeRule.is_enabled == True)
            )).scalars().all()
        except Exception as exc:
            logger.warning("time-rule load skipped: %s", exc)
            return []
        out = []
        for r in rows:
            out.append({
                "scope": r.scope, "segment_id": str(r.segment_id) if r.segment_id else None,
                "instrument_id": str(r.instrument_id) if r.instrument_id else None,
                "kind": r.kind, "session": r.session,
                "days_of_week": r.days_of_week, "start_min": r.start_min, "end_min": r.end_min,
                "spread_mode": r.spread_mode, "spread_multiplier": r.spread_multiplier,
                "spread_value": r.spread_value, "spread_type": r.spread_type,
                "leverage_cap": r.leverage_cap, "priority": r.priority, "is_enabled": r.is_enabled,
            })
        return out

    async def _load_dynamic_settings(self, db) -> dict:
        dyn = {"enabled": False, "max_mult": 3.0, "sensitivity": 1.0, "window_sec": 60.0}
        try:
            rows = (await db.execute(text(
                "SELECT key, value FROM system_settings WHERE key IN "
                "('dynamic_spread_enabled','dynamic_spread_max_mult',"
                "'dynamic_spread_sensitivity','dynamic_spread_window_sec')"
            ))).all()
            for key, value in rows:
                raw = value if not isinstance(value, str) else value.strip('"')
                if key == "dynamic_spread_enabled":
                    dyn["enabled"] = str(raw).lower() in ("true", "1", "yes")
                elif key == "dynamic_spread_max_mult":
                    dyn["max_mult"] = max(1.0, min(_VOL_MULT_HARD_CAP, float(raw)))
                elif key == "dynamic_spread_sensitivity":
                    dyn["sensitivity"] = max(0.0, float(raw))
                elif key == "dynamic_spread_window_sec":
                    dyn["window_sec"] = max(5.0, float(raw))
        except Exception:
            pass
        return dyn

    def _volatility_mult(self, symbol: str, mid: float, base_adj_price: float) -> float:
        """Multiplier (>=1) from recent price movement relative to the base
        spread width. Updates the rolling window as a side effect."""
        win = self._dyn["window_sec"]
        now = time.monotonic()
        hist = self._hist.get(symbol)
        if hist is None:
            hist = deque(maxlen=512)
            self._hist[symbol] = hist
        hist.append((now, mid))
        cutoff = now - win
        while hist and hist[0][0] < cutoff:
            hist.popleft()
        if not self._dyn["enabled"] or base_adj_price <= 0 or len(hist) < 3:
            return 1.0
        mids = [m for _, m in hist]
        rng = max(mids) - min(mids)
        if rng <= 0:
            return 1.0
        # How big was the recent move vs the base spread width?
        ratio = rng / base_adj_price
        mult = 1.0 + self._dyn["sensitivity"] * ratio
        return max(1.0, min(self._dyn["max_mult"], mult))

    def widen(self, symbol: str, mid: float) -> Tuple[float, float]:
        """Return bid/ask around mid using admin spread + active time-rule +
        live volatility; pass-through if unknown symbol."""
        from .feed_handler import INSTRUMENTS

        key = (symbol or "").strip().upper()
        p: Optional[Tuple[Decimal, str, Decimal, int]] = self._params.get(key)
        if p:
            sv, st, pip, digits = p
        elif key in INSTRUMENTS:
            info = INSTRUMENTS[key]
            sv, st = self._default_spread
            pip = Decimal(str(info["pip"]))
            digits = int(info["decimals"])
        else:
            return mid, mid

        # No category fallback: if admin hasn't configured any spread
        # (per-instrument / segment / default), the spread is 0 — bid == ask.
        # Admin's settings are the single source of truth for spread.

        # ── Layer 2: active time-rule (multiplier or absolute) ──
        if self._rules:
            inst_id, seg_id = self._meta.get(key, (None, None))
            rule = resolve_active(self._rules, inst_id, seg_id, datetime.now(timezone.utc))
            if rule is not None:
                sv, st = apply_spread_rule(rule, sv, st)

        # ── Layer 3: live volatility widening ──
        # base adjustment in price units (matches symmetric_quote_from_mid)
        if (st or "pips").lower() == "percentage":
            base_adj = float(mid) * (float(sv) / 100.0)
        else:
            base_adj = float(sv) * float(pip)
        vmult = self._volatility_mult(key, float(mid), base_adj)
        if vmult > 1.0:
            sv = sv * Decimal(str(vmult))

        b, a = symmetric_quote_from_mid(
            Decimal(str(mid)), sv, st, pip, digits, Decimal("0"),
        )
        return float(b), float(a)
