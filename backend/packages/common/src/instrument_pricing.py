"""Resolve spread / commission / price impact for order execution (gateway, engines)."""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    ChargeConfig, SpreadConfig, SwapConfig, Instrument, InstrumentConfig,
    AccountGroup, VipPass,
)


# Hardcoded daily swap rate (Trading_Mechanism.docx: 0.01%/day on borrowed capital).
# Used as the last-resort fallback by ``resolve_swap_rate`` when no SwapConfig
# row applies. Historically this lived in overnight_fee_engine as a module-level
# constant, but moving it here keeps the rate resolution in one file.
DEFAULT_SWAP_DAILY_RATE = Decimal("0.0001")


# ─── VIP brokerage discount ─────────────────────────────────────────
# Pitch deck slide 7 / slide 11: VIP pass cuts trading fees so an
# Elite+VIP user pays roughly half of the Elite rack rate (0.03% → ~0.015%).
# We model that as a flat 40% multiplier on the resolved base commission.
VIP_COMMISSION_DISCOUNT = Decimal("0.40")  # 40% off


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
    account_group_id: Optional[UUID] = None,
    trading_account_id: Optional[UUID] = None,
) -> Tuple[Decimal, str, Decimal]:
    """Returns (spread_value, spread_type, price_impact).

    Priority chain (highest → lowest), mirrors ``resolve_commission`` so admin's
    "All" + specific overrides behave the same across charges and spreads:
      1. User override for this specific instrument
         (account-pinned row beats user-wide when the caller passes
         ``trading_account_id``; rows pinned to OTHER accounts never match)
      2. User override global (user, null instrument) — same account rule
      3. Account-group + this instrument         (Layer C — new scope)
      4. Account-group + any instrument          (Layer C — new scope)
      5. Per-instrument rule
      6. Per-segment rule
      7. Default (all instruments) ``SpreadConfig``
      8. ``AccountGroup.spread_markup_default``  (Layer A — tier-default fallback)
      9. Zero

    A specific rule wins for that symbol; broader rules fill in for the rest.

    The ``account_group_id`` arg is best-effort: market-data tick widening
    (which publishes ONE quote to all subscribers) passes ``None`` and only
    gets the global default; per-tier widening happens at the gateway layer
    (catalog snapshot + order fill) where the trader's account is known.

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
        # Account filter: a row pinned to one of the user's trading
        # accounts matches only when the caller trades THAT account. With
        # no account context, only user-wide (NULL) rows apply.
        if trading_account_id is not None:
            acct_clause = or_(
                SpreadConfig.trading_account_id == trading_account_id,
                SpreadConfig.trading_account_id.is_(None),
            )
        else:
            acct_clause = SpreadConfig.trading_account_id.is_(None)

        for inst_clause in (
            SpreadConfig.instrument_id == instrument.id,
            SpreadConfig.instrument_id.is_(None),
        ):
            ur = await db.execute(
                select(SpreadConfig)
                .where(
                    func.lower(SpreadConfig.scope) == "user",
                    SpreadConfig.is_enabled == True,
                    SpreadConfig.user_id == user_id,
                    inst_clause,
                    acct_clause,
                )
                # Account-pinned row first (NULLS LAST puts the specific
                # account ahead of the user-wide fallback).
                .order_by(SpreadConfig.trading_account_id.desc().nulls_last())
                .limit(1)
            )
            urow = ur.scalar_one_or_none()
            if urow:
                return _to_tuple(urow)

    # Per-account-group scope (Layer C) — only checked when the caller knows
    # the trader's group (gateway-side catalog + order fill); skipped by the
    # global market-data tick widener.
    if account_group_id is not None:
        agir = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "account_group",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id.is_(None),
                SpreadConfig.account_group_id == account_group_id,
                SpreadConfig.instrument_id == instrument.id,
            )
            .limit(1)
        )
        agirow = agir.scalar_one_or_none()
        if agirow:
            return _to_tuple(agirow)

        agr = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "account_group",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id.is_(None),
                SpreadConfig.account_group_id == account_group_id,
                SpreadConfig.instrument_id.is_(None),
            )
            .limit(1)
        )
        agrow = agr.scalar_one_or_none()
        if agrow:
            return _to_tuple(agrow)

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

    # Layer A — Tier-default fallback: when no SpreadConfig row matched at any
    # scope, honour ``AccountGroup.spread_markup_default``. This is what makes
    # the Account Types page's spread_markup field actually apply at execution.
    if account_group_id is not None:
        ag = (await db.execute(
            select(AccountGroup).where(AccountGroup.id == account_group_id)
        )).scalar_one_or_none()
        if ag is not None and ag.spread_markup_default and Decimal(str(ag.spread_markup_default)) > 0:
            return Decimal(str(ag.spread_markup_default)), "pips", pimp

    return Decimal("0"), "pips", pimp


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
    total = adj + imp  # full bid→ask width in price units

    q = Decimal("1") / (Decimal(10) ** max(decimals, 0))  # tick size
    mid_q = mid.quantize(q)

    if total <= 0:
        return mid_q, mid_q

    # Quantise the spread to a whole number of ticks ONCE, then split it so
    # that ``ask - bid`` is EXACTLY that width on every tick. The previous
    # version quantised bid and ask independently around the mid; when half
    # the spread was not a whole number of ticks (e.g. 1.5 pips on a 5-digit
    # symbol → a 7.5-tick half-spread) the two roundings did not cancel, so
    # the realised spread wobbled by ±1 tick as the mid moved — surfacing as
    # a "fluctuating spread" in the terminal even though the admin value was
    # fixed. Splitting a single tick-quantised width keeps it rock steady.
    ticks = (total / q).to_integral_value(rounding=ROUND_HALF_UP)
    if ticks < 1:
        ticks = Decimal(1)
    bid_ticks = ticks // Decimal(2)        # floor; odd remainder goes to ask
    ask_ticks = ticks - bid_ticks
    bid = mid_q - bid_ticks * q
    ask = mid_q + ask_ticks * q
    return bid, ask


async def resolve_user_quote(
    db: AsyncSession,
    instrument: Instrument,
    broadcast_bid: Decimal,
    broadcast_ask: Decimal,
    user_id: Optional[UUID] = None,
    account_group_id: Optional[UUID] = None,
    trading_account_id: Optional[UUID] = None,
) -> Tuple[Decimal, Decimal]:
    """Re-derive the USER's executable bid/ask from the broadcast MID.

    The broadcast quote is symmetric around the true mid, so mid=(bid+ask)/2.
    We resolve the user's spread with the FULL priority chain (per-user →
    per-tier → instrument → segment → default) and rebuild bid/ask symmetrically
    around that mid. Using this at BOTH the open fill and the close makes the
    admin spread cross exactly ONCE per round trip at the USER's own rate,
    instead of trusting the single global broadcast spread. A user with no
    config and no tier default collapses to zero spread (trades at mid).

    Only affects pricing where the account is known; the broadcast stream and
    any consumer that hasn't opted in keep using the global quote.
    """
    b = Decimal(str(broadcast_bid))
    a = Decimal(str(broadcast_ask))
    mid = (b + a) / Decimal("2")
    spread_value, spread_type, price_impact = await resolve_spread_config(
        db, instrument, user_id=user_id, account_group_id=account_group_id,
        trading_account_id=trading_account_id,
    )
    pip = Decimal(str(getattr(instrument, "pip_size", None) or "0.0001"))
    digits = int(getattr(instrument, "digits", None) or 5)
    return symmetric_quote_from_mid(mid, spread_value, spread_type, pip, digits, price_impact)


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
      3. Account-group + this instrument             (Layer C — new scope)
      4. Account-group + any instrument              (Layer C — new scope)
      5. Admin per-instrument
      6. Admin per-segment
      7. Admin default
      8. Account-group ``commission_default`` (per-lot)  (Layer A — tier default)
      9. Account-group ``commission_pct`` (% of notional) (existing fallback)
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

    # Per-account-group scope (Layer C) — gateway-side only (account_group_id
    # is required). Checked between user-scope and instrument-scope so a
    # broker-wide instrument rule still wins over a tier-default but
    # account-tier overrides beat a generic segment/default rule.
    if base_commission is None and account_group_id is not None:
        agir = await db.execute(
            select(ChargeConfig)
            .where(
                func.lower(ChargeConfig.scope) == "account_group",
                ChargeConfig.is_enabled == True,
                ChargeConfig.user_id.is_(None),
                ChargeConfig.account_group_id == account_group_id,
                ChargeConfig.instrument_id == instrument.id,
            )
            .limit(1)
        )
        agirow = agir.scalar_one_or_none()
        if agirow:
            base_commission = _commission_from_config(agirow, lots, notional)

        if base_commission is None:
            agr = await db.execute(
                select(ChargeConfig)
                .where(
                    func.lower(ChargeConfig.scope) == "account_group",
                    ChargeConfig.is_enabled == True,
                    ChargeConfig.user_id.is_(None),
                    ChargeConfig.account_group_id == account_group_id,
                    ChargeConfig.instrument_id.is_(None),
                )
                .limit(1)
            )
            agrow = agr.scalar_one_or_none()
            if agrow:
                base_commission = _commission_from_config(agrow, lots, notional)

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

    # Tier-default fallbacks (Layer A): when nothing else matched, honour the
    # AccountGroup's own commission knobs. ``commission_default`` is a per-lot
    # dollar amount; ``commission_pct`` is a percentage of notional. We prefer
    # commission_default if set, then fall back to commission_pct.
    if base_commission is None and account_group_id is not None:
        ag = (await db.execute(
            select(AccountGroup).where(AccountGroup.id == account_group_id)
        )).scalar_one_or_none()
        if ag is not None:
            if ag.commission_default is not None and Decimal(str(ag.commission_default)) > 0:
                base_commission = Decimal(str(ag.commission_default)) * lots
            elif ag.commission_pct is not None:
                base_commission = notional * Decimal(str(ag.commission_pct))

    if base_commission is None:
        return Decimal("0")

    if apply_xp_discount and user_id is not None:
        try:
            vip_mult = await _vip_discount_for_user(db, user_id)
            base_commission = base_commission * vip_mult
        except Exception:
            # VIP discount is best-effort; never fail the trade
            # because the VIP table hiccups.
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


async def resolve_swap_rate(
    db: AsyncSession,
    instrument: Instrument,
    side: str,
    *,
    user_id: Optional[UUID] = None,
    account_group_id: Optional[UUID] = None,
) -> Tuple[Decimal, bool]:
    """Returns ``(daily_rate, is_swap_free)`` for one open position.

    ``daily_rate`` is the per-day swap rate to apply to the position's
    borrowed notional. ``is_swap_free`` is True when the resolved config
    explicitly marks the position swap-free (admin can do this per scope).

    Priority chain (mirrors commission resolution):
      1. User override + this instrument
      2. User override + any instrument
      3. Account-group + this instrument        (Layer C — new scope)
      4. Account-group + any instrument         (Layer C — new scope)
      5. Per-instrument SwapConfig
      6. Per-segment SwapConfig
      7. Default SwapConfig
      8. InstrumentConfig.swap_long / swap_short
      9. ``DEFAULT_SWAP_DAILY_RATE`` (hardcoded fallback so old positions still charge)

    ``side`` is ``"long"`` / ``"short"`` (long positions pay swap_long, etc).
    SwapConfig.swap_free=True at any matched scope short-circuits with rate=0.
    """
    side_l = (side or "long").lower()
    is_long = side_l in ("long", "buy")

    def _rate_from_swap_cfg(cfg: SwapConfig) -> Tuple[Decimal, bool]:
        if bool(getattr(cfg, "swap_free", False)):
            return Decimal("0"), True
        raw = cfg.swap_long if is_long else cfg.swap_short
        return Decimal(str(raw or 0)), False

    # 1-2. User scope
    if user_id is not None:
        for inst_clause in (SwapConfig.instrument_id == instrument.id, SwapConfig.instrument_id.is_(None)):
            r = await db.execute(
                select(SwapConfig)
                .where(
                    func.lower(SwapConfig.scope) == "user",
                    SwapConfig.is_enabled == True,
                    SwapConfig.user_id == user_id,
                    inst_clause,
                )
                .limit(1)
            )
            row = r.scalar_one_or_none()
            if row:
                return _rate_from_swap_cfg(row)

    # 3-4. Account-group scope (Layer C)
    if account_group_id is not None:
        for inst_clause in (SwapConfig.instrument_id == instrument.id, SwapConfig.instrument_id.is_(None)):
            r = await db.execute(
                select(SwapConfig)
                .where(
                    func.lower(SwapConfig.scope) == "account_group",
                    SwapConfig.is_enabled == True,
                    SwapConfig.user_id.is_(None),
                    SwapConfig.account_group_id == account_group_id,
                    inst_clause,
                )
                .limit(1)
            )
            row = r.scalar_one_or_none()
            if row:
                return _rate_from_swap_cfg(row)

    # 5. Per-instrument
    r = await db.execute(
        select(SwapConfig)
        .where(
            func.lower(SwapConfig.scope) == "instrument",
            SwapConfig.is_enabled == True,
            SwapConfig.user_id.is_(None),
            SwapConfig.instrument_id == instrument.id,
        )
        .limit(1)
    )
    row = r.scalar_one_or_none()
    if row:
        return _rate_from_swap_cfg(row)

    # 6. Per-segment
    if instrument.segment_id:
        r = await db.execute(
            select(SwapConfig)
            .where(
                func.lower(SwapConfig.scope) == "segment",
                SwapConfig.is_enabled == True,
                SwapConfig.user_id.is_(None),
                SwapConfig.segment_id == instrument.segment_id,
            )
            .limit(1)
        )
        row = r.scalar_one_or_none()
        if row:
            return _rate_from_swap_cfg(row)

    # 7. Default SwapConfig
    r = await db.execute(
        select(SwapConfig)
        .where(
            func.lower(SwapConfig.scope) == "default",
            SwapConfig.is_enabled == True,
            SwapConfig.user_id.is_(None),
            SwapConfig.instrument_id.is_(None),
            SwapConfig.segment_id.is_(None),
        )
        .order_by(SwapConfig.created_at.desc())
        .limit(1)
    )
    row = r.scalar_one_or_none()
    if row:
        return _rate_from_swap_cfg(row)

    # 8. InstrumentConfig swap fields (legacy per-instrument storage)
    ic = await _get_instrument_config_row(db, instrument.id)
    if ic is not None:
        if bool(getattr(ic, "swap_free", False)):
            return Decimal("0"), True
        raw = ic.swap_long if is_long else ic.swap_short
        if raw is not None and Decimal(str(raw)) != 0:
            return Decimal(str(raw)), False

    # 9. Last-resort hardcoded fallback so existing positions keep being charged
    # even before admins ever touch the swap config UI.
    return DEFAULT_SWAP_DAILY_RATE, False
