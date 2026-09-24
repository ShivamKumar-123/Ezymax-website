"""Resolve spread / commission / price impact for order execution (gateway, engines)."""

import json
import time as _time
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    ChargeConfig, SpreadConfig, Instrument, InstrumentConfig,
    AccountGroup, RewardsUserState, VipPass, StakingPosition, LevelBenefit,
)


# ─── XP-tier trading-cost discount ──────────────────────────────────
# Per XP_Reward_mechanism slide 7: higher XP levels make trading cheaper.
# The ladder lives in the `level_benefits` table (migration 0067) so the
# desk can retune it from the admin panel; these constants remain only as
# the fallback used when the table is missing or unreadable, and they
# reproduce the original behaviour exactly: 1% off commission per level
# above L1, capped at 9%, and nothing off spread or swap.
XP_DISCOUNT_PER_LEVEL = Decimal("0.01")
XP_DISCOUNT_MAX_LEVELS = 9  # so max discount = 9% at level 10

# Hard ceiling on any single level discount, whatever the table says. A
# fat-fingered 95% in the admin panel would otherwise hand out near-free
# execution on the B-book's main revenue line; this clamps the damage to
# something survivable while still letting the row be saved and noticed.
MAX_LEVEL_DISCOUNT = Decimal("0.50")

# XP thresholds per level — mirrors LEVEL_THRESHOLDS in rewards_service.py,
# duplicated here so this module keeps no service-layer dependency.
_LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 5000, 8000, 12000, 18000, 26000, 36000]

# The pricing path runs on every quote and every fill, so neither the ladder
# nor the user's level may cost a query per tick. Both are cached in-process
# with a short TTL — the same idiom as _FLOAT_PARAMS below. Each worker keeps
# its own copy; an admin edit is live everywhere within one TTL.
_LADDER_TTL = 60.0
_LEVEL_TTL = 60.0
_ladder_cache: dict = {"ts": 0.0, "rows": None}
_user_level_cache: dict = {}


def _level_for_xp(xp: int) -> int:
    level = 1
    for i, threshold in enumerate(_LEVEL_THRESHOLDS):
        if (xp or 0) >= threshold:
            level = i + 1
    return level


def _fallback_multipliers(level: int) -> Tuple[Decimal, Decimal, Decimal]:
    """Pre-table behaviour: commission only, 1% per level above L1."""
    steps = max(0, min(XP_DISCOUNT_MAX_LEVELS, level - 1))
    return (
        Decimal("1"),
        Decimal("1"),
        Decimal("1") - (XP_DISCOUNT_PER_LEVEL * Decimal(steps)),
    )


def _mult(pct) -> Decimal:
    """Percentage off → multiplier, clamped to [1 - MAX_LEVEL_DISCOUNT, 1]."""
    d = Decimal(str(pct or 0)) / Decimal("100")
    if d < 0:
        d = Decimal("0")
    if d > MAX_LEVEL_DISCOUNT:
        d = MAX_LEVEL_DISCOUNT
    return Decimal("1") - d


async def _load_ladder(db: AsyncSession) -> dict:
    """{level: (spread_mult, swap_mult, commission_mult)}, cached."""
    now = _time.time()
    if _ladder_cache["rows"] is not None and (now - _ladder_cache["ts"]) < _LADDER_TTL:
        return _ladder_cache["rows"]
    rows = (await db.execute(
        select(LevelBenefit).where(LevelBenefit.is_enabled == True)
    )).scalars().all()
    ladder = {
        int(r.level): (
            _mult(r.spread_discount_pct),
            _mult(r.swap_discount_pct),
            _mult(r.commission_discount_pct),
        )
        for r in rows
    }
    _ladder_cache["rows"] = ladder
    _ladder_cache["ts"] = now
    return ladder


async def _user_level(db: AsyncSession, user_id: UUID) -> int:
    now = _time.time()
    hit = _user_level_cache.get(user_id)
    if hit is not None and (now - hit[0]) < _LEVEL_TTL:
        return hit[1]
    xp = (await db.execute(
        select(RewardsUserState.xp).where(RewardsUserState.user_id == user_id)
    )).scalar_one_or_none()
    level = _level_for_xp(int(xp or 0))
    # Bound the cache so a long-lived worker can't grow it without limit.
    if len(_user_level_cache) > 5000:
        _user_level_cache.clear()
    _user_level_cache[user_id] = (now, level)
    return level


async def level_multipliers(
    db: AsyncSession, user_id: Optional[UUID]
) -> Tuple[Decimal, Decimal, Decimal]:
    """(spread, swap, commission) multipliers for this user's XP level.

    Never raises: any failure returns "no discount" rather than blocking a
    fill or a swap run, because a loyalty perk must not be able to stop
    someone trading.
    """
    if user_id is None:
        return (Decimal("1"), Decimal("1"), Decimal("1"))
    try:
        level = await _user_level(db, user_id)
        ladder = await _load_ladder(db)
        row = ladder.get(level)
        if row is None:
            return _fallback_multipliers(level)
        return row
    except Exception:
        return (Decimal("1"), Decimal("1"), Decimal("1"))


def invalidate_level_cache() -> None:
    """Called by the admin save path so an edited ladder takes effect at once
    in this process (other workers pick it up within _LADDER_TTL)."""
    _ladder_cache["rows"] = None
    _ladder_cache["ts"] = 0.0


# ─── VIP brokerage discount ─────────────────────────────────────────
# Pitch deck slide 7 / slide 11: VIP pass cuts trading fees so an
# Elite+VIP user pays roughly half of the Elite rack rate (0.03% → ~0.015%).
# We model that as a flat 40% multiplier on the resolved base commission,
# stacked multiplicatively with the XP discount: max-stack at level 10
# gives ~0.03% × 0.91 × 0.60 = ~0.0164% — close to the pitch promise
# without being a flat 50% off (which felt too generous against the
# B-book P&L target).
VIP_COMMISSION_DISCOUNT = Decimal("0.40")  # 40% off


# ─── Staking-balance brokerage discount ─────────────────────────────
# Pitch deck slide 9 / slide 11: stakers get a fee discount. Tiered on
# total active staked principal (USD-denominated) — keeps incentives
# meaningful without rewarding token grinding. Tiers are intentionally
# coarse so users don't optimise around micro thresholds.
#   $0–999      → 0%
#   $1,000+     → 5%
#   $5,000+     → 10%
#   $20,000+    → 15%
STAKING_DISCOUNT_TIERS: tuple[tuple[Decimal, Decimal], ...] = (
    (Decimal("20000"), Decimal("0.15")),
    (Decimal("5000"),  Decimal("0.10")),
    (Decimal("1000"),  Decimal("0.05")),
)


async def _xp_discount_for_user(db: AsyncSession, user_id: UUID) -> Decimal:
    """Commission multiplier from the level_benefits ladder. 1.00 = no discount."""
    _spread, _swap, commission = await level_multipliers(db, user_id)
    return commission


async def _vip_discount_for_user(db: AsyncSession, user_id: UUID) -> Decimal:
    """Returns a multiplier in [0.60, 1.00]. 1.00 means the user has no
    active VIP pass. Cancelled passes are ignored."""
    row = (await db.execute(
        select(VipPass.id).where(
            VipPass.user_id == user_id,
            VipPass.cancelled_at.is_(None),
        ).limit(1)
    )).scalar_one_or_none()
    if row is None:
        return Decimal("1")
    return Decimal("1") - VIP_COMMISSION_DISCOUNT


async def _staking_discount_for_user(db: AsyncSession, user_id: UUID) -> Decimal:
    """Returns a multiplier based on the user's active staked principal.
    Sums all StakingPosition rows in state='active' (locked + flexible)."""
    total = (await db.execute(
        select(func.coalesce(func.sum(StakingPosition.principal), 0)).where(
            StakingPosition.user_id == user_id,
            StakingPosition.state == "active",
        )
    )).scalar() or 0
    total_dec = Decimal(str(total))
    for threshold, discount in STAKING_DISCOUNT_TIERS:
        if total_dec >= threshold:
            return Decimal("1") - discount
    return Decimal("1")

async def _get_instrument_config_row(
    db: AsyncSession, instrument_id: UUID
) -> Optional[InstrumentConfig]:
    r = await db.execute(
        select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument_id)
    )
    return r.scalar_one_or_none()


async def _instrument_config_price_impact(
    db: AsyncSession, instrument_id: UUID
) -> Decimal:
    ic = await _get_instrument_config_row(db, instrument_id)
    if ic and ic.is_enabled and ic.price_impact:
        return Decimal(str(ic.price_impact))
    return Decimal("0")


async def resolve_spread_config(
    db: AsyncSession,
    instrument: Instrument,
    user_id: Optional[UUID] = None,
) -> Tuple[Decimal, str, Decimal]:
    """Returns (spread_value, spread_type, price_impact).

    Priority chain (highest → lowest), mirrors ``resolve_commission`` so admin's
    "All" + specific overrides behave the same across charges and spreads:
      1. User override for this specific instrument
      2. User override global (user, null instrument)
      3. Per-instrument rule (instrument scope, this instrument)
      4. Per-segment rule (segment scope, this instrument's segment)
      5. Default (all instruments)
      6. Zero

    A specific instrument rule wins for that symbol; "All" fills in for the rest.

    ``price_impact`` on ``instrument_configs`` is returned for APIs but is **not**
    applied to Redis stream quotes — widths come only from ``spread_configs``
    so the admin default matches the terminal ``Spr`` display.
    """
    pimp = await _instrument_config_price_impact(db, instrument.id)

    def _to_tuple(row: SpreadConfig) -> Tuple[Decimal, str, Decimal]:
        return (
            Decimal(str(row.value or 0)),
            (row.spread_type or "pips").lower(),
            pimp,
        )

    if user_id:
        ur = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "user",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id == user_id,
                SpreadConfig.instrument_id == instrument.id,
            )
            .limit(1)
        )
        urow = ur.scalar_one_or_none()
        if urow:
            return _to_tuple(urow)

        ur2 = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "user",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id == user_id,
                SpreadConfig.instrument_id.is_(None),
            )
            .limit(1)
        )
        urow2 = ur2.scalar_one_or_none()
        if urow2:
            return _to_tuple(urow2)

    ir = await db.execute(
        select(SpreadConfig)
        .where(
            func.lower(SpreadConfig.scope) == "instrument",
            SpreadConfig.is_enabled == True,
            SpreadConfig.user_id.is_(None),
            SpreadConfig.instrument_id == instrument.id,
        )
        .limit(1)
    )
    irow = ir.scalar_one_or_none()
    if irow:
        return _to_tuple(irow)

    if instrument.segment_id:
        sr = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "segment",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id.is_(None),
                SpreadConfig.segment_id == instrument.segment_id,
            )
            .limit(1)
        )
        srow = sr.scalar_one_or_none()
        if srow:
            return _to_tuple(srow)

    dr = await db.execute(
        select(SpreadConfig)
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
    default_cfg = dr.scalar_one_or_none()
    if default_cfg:
        return _to_tuple(default_cfg)

    return Decimal("0"), "pips", pimp


async def get_user_spread_override(
    db: AsyncSession, user_id: Optional[UUID], instrument_id,
) -> Optional[SpreadConfig]:
    """Return the user's explicit spread override for this instrument, if any —
    user+instrument first, then user-global (instrument NULL). Returns None when
    the user has no user-scope override, so callers keep the normal feed quote."""
    if user_id is None:
        return None
    for iid_filter in (
        SpreadConfig.instrument_id == instrument_id,
        SpreadConfig.instrument_id.is_(None),
    ):
        row = (await db.execute(
            select(SpreadConfig).where(
                func.lower(SpreadConfig.scope) == "user",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id == user_id,
                iid_filter,
            ).limit(1)
        )).scalar_one_or_none()
        if row is not None:
            return row
    return None


# ─── Floating spread (per-user) ─────────────────────────────────────────────
# A per-user spread override of type "floating" tracks the provider's LIVE
# market spread (broadcast in the tick as `market_spread`) instead of a fixed
# value: published spread = clamp(market × (1 + markup%), floor=row.value,
# cap=floor × max_mult). markup% / max_mult are the global system_settings
# knobs (same ones the admin Floating card writes). This applies to BOTH the
# user's display (my-spread-overrides) and their FILLS/closes (apply_user_spread_quote).
_FLOAT_PARAMS = {"ts": 0.0, "markup": 15.0, "max_mult": 4.0, "enabled": False}


async def get_floating_params(db: AsyncSession) -> dict:
    """Global floating knobs from system_settings, cached ~30s in-process."""
    now = _time.monotonic()
    if now - _FLOAT_PARAMS["ts"] < 30.0:
        return _FLOAT_PARAMS
    try:
        rows = (await db.execute(text(
            "SELECT key, value FROM system_settings WHERE key IN "
            "('floating_spread_enabled','floating_spread_markup_pct','floating_spread_max_mult')"
        ))).all()
        for k, v in rows:
            raw = v if not isinstance(v, str) else v.strip('"')
            if k == "floating_spread_enabled":
                _FLOAT_PARAMS["enabled"] = str(raw).lower() in ("true", "1", "yes")
            elif k == "floating_spread_markup_pct":
                _FLOAT_PARAMS["markup"] = max(0.0, min(100.0, float(raw)))
            elif k == "floating_spread_max_mult":
                _FLOAT_PARAMS["max_mult"] = max(1.0, min(10.0, float(raw)))
        _FLOAT_PARAMS["ts"] = now
    except Exception:
        pass
    return _FLOAT_PARAMS


def floating_adj_price(market_spread, floor_adj, markup_pct, max_mult) -> Decimal:
    """Floating spread in PRICE units: clamp(market × (1+markup), floor, floor×cap)."""
    try:
        ms = Decimal(str(market_spread))
        floor = Decimal(str(floor_adj))
        if ms <= 0 or floor <= 0:
            return floor if floor > 0 else Decimal("0")
        target = ms * (Decimal("1") + Decimal(str(markup_pct)) / Decimal("100"))
        cap = floor * Decimal(str(max(1.0, float(max_mult))))
        return min(max(target, floor), cap)
    except Exception:
        try:
            return Decimal(str(floor_adj))
        except Exception:
            return Decimal("0")


async def _tick_market_spread(symbol: str):
    """Provider's live market spread (price units) from the latest tick, or None."""
    try:
        from packages.common.src.redis_client import redis_client, PriceChannel
        raw = await redis_client.get(PriceChannel.tick_key((symbol or "").upper()))
        if not raw:
            return None
        d = json.loads(raw)
        ms = d.get("market_spread")
        return Decimal(str(ms)) if ms and float(ms) > 0 else None
    except Exception:
        return None


async def apply_user_spread_quote(
    db: AsyncSession, user_id: Optional[UUID], instrument: Instrument,
    bid: Decimal, ask: Decimal,
) -> Tuple[Decimal, Decimal]:
    """If the user has an explicit spread override, rebuild bid/ask symmetrically
    around mid using that spread so their FILLS reflect the admin-set per-user
    spread. Users without an override keep the feed's bid/ask unchanged (so the
    floating/default spread and every other user are untouched). A "floating"
    override tracks the live market spread × markup (capped)."""
    override = await get_user_spread_override(db, user_id, instrument.id)
    if override is None:
        return bid, ask
    bid = Decimal(str(bid))
    ask = Decimal(str(ask))
    mid = (bid + ask) / Decimal("2")
    st = (override.spread_type or "pips").lower()
    val = Decimal(str(override.value or 0))
    pip = Decimal(str(getattr(instrument, "pip_size", None) or "0.0001"))
    if st == "floating":
        floor_adj = val * pip
        ms = await _tick_market_spread(getattr(instrument, "symbol", ""))
        if ms is None or floor_adj <= 0:
            return bid, ask  # no market signal / no floor → feed quote (safe)
        params = await get_floating_params(db)
        adj = floating_adj_price(ms, floor_adj, params["markup"], params["max_mult"])
    elif st == "percentage":
        adj = mid * (val / Decimal("100"))
    else:
        adj = val * pip
    if adj <= 0:
        return bid, ask
    half = adj / Decimal("2")
    digits = int(getattr(instrument, "digits", None) or 5)
    q = Decimal("1") / (Decimal(10) ** max(digits, 0))
    return (mid - half).quantize(q), (mid + half).quantize(q)


async def apply_group_spread_quote(
    db: AsyncSession, account_group_id: Optional[UUID], instrument: Instrument,
    bid: Decimal, ask: Decimal,
) -> Tuple[Decimal, Decimal]:
    """Widen an executable quote by the account tier's spread markup.

    Each tier is sold a spread — 0.3 pips on Standard down to 0.0 on Prime —
    but the published tick is built per SYMBOL, before anyone's identity is
    known, so the tier's share has to go on at execution time: mid stays put
    and each side moves out by half the markup.

    Run it AFTER the per-user override and the XP discount: those two decide
    what the trader's own quote is, and this is the tier's cut on top.
    """
    if account_group_id is None:
        return bid, ask
    ag = (await db.execute(
        select(AccountGroup).where(AccountGroup.id == account_group_id)
    )).scalar_one_or_none()
    markup = Decimal(str((ag.spread_markup_default if ag is not None else 0) or 0))
    if markup <= 0:
        return bid, ask
    pip = Decimal(str(getattr(instrument, "pip_size", None) or "0.0001"))
    half = (markup * pip) / Decimal("2")
    digits = int(getattr(instrument, "digits", None) or 5)
    q = Decimal("1") / (Decimal(10) ** max(digits, 0))
    return (Decimal(str(bid)) - half).quantize(q), (Decimal(str(ask)) + half).quantize(q)


async def apply_level_spread_discount(
    db: AsyncSession, user_id: Optional[UUID], instrument: Instrument,
    bid: Decimal, ask: Decimal,
) -> Tuple[Decimal, Decimal]:
    """Tighten an executable quote by the user's XP-level spread discount.

    The platform spread is baked into the published tick per SYMBOL, not per
    user — market-data builds bid/ask around mid from spread_configs before
    anyone's identity is known. So a per-user discount cannot live in the
    spread resolver; it has to narrow the quote at execution time, which is
    what this does: keep mid fixed, shrink the half-spread.

    Run it AFTER apply_user_spread_quote so an explicit per-user override is
    the thing being discounted, and so users without an override are covered
    too (that function returns the feed quote untouched for them).
    """
    if user_id is None:
        return bid, ask
    spread_mult, _swap, _commission = await level_multipliers(db, user_id)
    if spread_mult >= 1:
        return bid, ask
    bid = Decimal(str(bid))
    ask = Decimal(str(ask))
    half = (ask - bid) / Decimal("2")
    if half <= 0:
        return bid, ask
    mid = (bid + ask) / Decimal("2")
    half = half * spread_mult
    # Quantize FINER than the instrument's own tick. Rounding to `digits` threw
    # the whole discount away on coarse instruments: XAUUSD quotes to 2dp, so a
    # 30-point spread has a half of $0.15 and 3% of that is $0.0045 — under half
    # a tick, which rounds straight back to $0.15. The trader saw an identical
    # fill and the perk did nothing. A discount is only meaningless below one
    # tick if we force it onto the tick grid; the fill price column is
    # NUMERIC(18,8), so two extra places cost nothing and make every level on
    # the ladder actually pay out. 30 points at 3% now really is 29.1 points,
    # half of it on the way in and half on the way out.
    digits = int(getattr(instrument, "digits", None) or 5)
    q = Decimal("1") / (Decimal(10) ** max(digits + 2, 0))
    new_bid = (mid - half).quantize(q)
    new_ask = (mid + half).quantize(q)
    # Never invert or collapse the quote: a discount that rounds the two sides
    # onto the same price would let a user open and close at one price.
    if new_ask <= new_bid:
        new_ask = new_bid + q
    return new_bid, new_ask


def symmetric_quote_from_mid(
    mid: Decimal,
    spread_value: Decimal,
    spread_type: str,
    pip_size: Decimal,
    decimals: int,
    price_impact: Decimal = Decimal("0"),
) -> Tuple[Decimal, Decimal]:
    """Build executable bid/ask symmetrically around mid (streamed quotes).

    Infoway and other feeds contribute a mid reference; platform spread from
    admin spread_configs (default / segment / instrument / user) is applied
    here so the terminal and order fill prices match.
    """
    st = (spread_type or "pips").lower()
    if st == "percentage":
        adj = mid * (spread_value / Decimal("100"))
    else:
        adj = spread_value * pip_size
    imp = price_impact or Decimal("0")
    half = (adj + imp) / Decimal("2")
    bid = mid - half
    ask = mid + half
    q = Decimal("1") / (Decimal(10) ** max(decimals, 0))
    bid = bid.quantize(q)
    ask = ask.quantize(q)
    if ask < bid:
        ask = bid + q
    elif ask == bid and half > 0:
        ask = bid + q
    return bid, ask


def apply_spread_and_impact_to_prices(
    bid: Decimal,
    ask: Decimal,
    side: str,
    spread_value: Decimal,
    spread_type: str,
    pip_size: Decimal,
    price_impact: Decimal,
) -> Tuple[Decimal, Decimal]:
    """Widen the active side by spread markup + adverse price impact."""
    bid_o, ask_o = bid, ask
    st = (spread_type or "pips").lower()
    mid = (bid + ask) / Decimal("2")

    if st == "percentage":
        adj = mid * (spread_value / Decimal("100"))
    else:
        # pips, fixed, variable → extra distance in price units
        adj = spread_value * pip_size

    imp = price_impact or Decimal("0")
    if side == "buy":
        ask_o = ask + adj + imp
    else:
        bid_o = bid - adj - imp
    return bid_o, ask_o


async def resolve_commission(
    db: AsyncSession,
    instrument: Instrument,
    lots: Decimal,
    fill_price: Decimal,
    user_id: Optional[UUID] = None,
    account_group_id: Optional[UUID] = None,
    apply_xp_discount: bool = True,
) -> Decimal:
    """Total commission for opening/closing a position.

    Priority (highest first):
      1. Admin per-user override + per-instrument
      2. Admin per-user override + any-instrument
      3. Admin per-instrument
      4. Admin per-segment
      5. Admin default
      6. Account-group commission_pct (Phase 2 smart-fee tier)
      7. 0 — last resort, only if there are no admin rows AND no account_group

    If apply_xp_discount=True, the resolved value is multiplied by an XP-tier
    discount (1% per level above L1, capped at 9%). Discount is *opt-out*
    so callers like the trading-catalog page that just preview a rate can
    pass apply_xp_discount=False to show the rack rate.
    """
    notional = lots * (instrument.contract_size or Decimal("100000")) * fill_price

    base_commission: Optional[Decimal] = None

    if user_id is not None:
        ur = await db.execute(
            select(ChargeConfig)
            .where(
                func.lower(ChargeConfig.scope) == "user",
                ChargeConfig.is_enabled == True,
                ChargeConfig.user_id == user_id,
                ChargeConfig.instrument_id == instrument.id,
            )
            .limit(1)
        )
        urow = ur.scalar_one_or_none()
        if urow:
            base_commission = _commission_from_config(urow, lots, notional)

        if base_commission is None:
            ur2 = await db.execute(
                select(ChargeConfig)
                .where(
                    func.lower(ChargeConfig.scope) == "user",
                    ChargeConfig.is_enabled == True,
                    ChargeConfig.user_id == user_id,
                    ChargeConfig.instrument_id.is_(None),
                )
                .limit(1)
            )
            urow2 = ur2.scalar_one_or_none()
            if urow2:
                base_commission = _commission_from_config(urow2, lots, notional)

    if base_commission is None:
        for scope, seg_id, inst_id in [
            ("instrument", None, instrument.id),
            ("segment", instrument.segment_id, None),
            ("default", None, None),
        ]:
            q = select(ChargeConfig).where(
                ChargeConfig.scope == scope,
                ChargeConfig.is_enabled == True,
                ChargeConfig.user_id.is_(None),
            )
            if scope == "instrument":
                q = q.where(ChargeConfig.instrument_id == inst_id)
            elif scope == "segment":
                q = q.where(ChargeConfig.segment_id == seg_id)
            else:
                q = q.where(
                    ChargeConfig.instrument_id.is_(None),
                    ChargeConfig.segment_id.is_(None),
                )
            r = await db.execute(q.limit(1))
            cfg = r.scalar_one_or_none()
            if cfg:
                base_commission = _commission_from_config(cfg, lots, notional)
                break

    # Smart-fee fallback: when no admin ChargeConfig matches, charge the
    # account tier's own rate — a flat figure per lot if the tier has one
    # (Prime), otherwise its percentage of notional.
    if base_commission is None and account_group_id is not None:
        ag = (await db.execute(
            select(AccountGroup).where(AccountGroup.id == account_group_id)
        )).scalar_one_or_none()
        if ag is not None:
            per_lot = Decimal(str(ag.commission_default or 0))
            if per_lot > 0:
                # The tier quotes this PER SIDE, and a position pays on the way
                # in and on the way out. The platform charges a position once,
                # at close, so the round turn is billed here in one go.
                base_commission = per_lot * lots * 2
            elif ag.commission_pct is not None:
                base_commission = notional * Decimal(str(ag.commission_pct))

    if base_commission is None:
        return Decimal("0")

    if apply_xp_discount and user_id is not None:
        try:
            xp_mult = await _xp_discount_for_user(db, user_id)
            vip_mult = await _vip_discount_for_user(db, user_id)
            stk_mult = await _staking_discount_for_user(db, user_id)
            # Discounts compose multiplicatively. A maxed-out user
            # (L10 + VIP + $20k staked) lands at 0.91 × 0.60 × 0.85
            # ≈ 0.46 — still leaves the B-book around half the rack rate.
            base_commission = base_commission * xp_mult * vip_mult * stk_mult
        except Exception:
            # Loyalty discounts are best-effort; never fail the trade
            # because the rewards / VIP / staking tables hiccup.
            pass

    return base_commission


def _commission_from_config(cfg: ChargeConfig, lots: Decimal, notional: Decimal) -> Decimal:
    v = Decimal(str(cfg.value or 0))
    ct = (cfg.charge_type or "").lower()
    if ct in ("commission_per_lot", "per_lot"):
        return v * lots
    if ct in ("commission_per_trade", "per_trade"):
        return v
    if ct in ("commission_percentage", "percentage", "spread_percentage"):
        return notional * (v / Decimal("100"))
    return v * lots
