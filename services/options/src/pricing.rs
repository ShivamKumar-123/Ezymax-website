//! Chain pricing with optmath. The trading engine prices fills itself from the same snapshot inputs; these
//! numbers are for display (chain, stream, public page) and the end-of-day marks.
//!
//! Per expiry:
//! * `t_cal` = ACT/365 to the cut (carry, discounting); `t_vol` = the underlying's business-time clock
//!   (weekend / holiday weights) over its pair calendar.
//! * Rates: GK `r = rate(quote)`, `b = rate(quote) - rate(base)`; BS (metals) the base "currency" rate is the
//!   lease rate `q`; Black-76 `b = 0` and the price is the forward.
//! * ATM vol: the latest surface interpolated at `t_cal`, blended with our realized vol
//!   (`w * surface + (1 - w) * realized`, `w` = the surface version's blend weight); a manual-vol control
//!   replaces it. The smile (25D/10D RR/BF) is built in vol time with rates rescaled so the forward and the
//!   spot-delta discounting stay exact.
//! * Bid / ask: vol -/+ the group's vol spread, widened to the group's minimum USD spread per contract.
//! * Greeks per unit: `delta`; `gamma` = delta change for a 1% spot move; per contract in USD: `vega` per
//!   vol point, `theta` = value change over the next calendar day (vol clock, sticky strike).
//! * Order book (docs/OPTIONS-EXCHANGE.md §6, §10), only while the tenant's book is live for the account kind:
//!   `bid` / `ask` are the book's best bid / offer (null when that side is empty) with `bidQty` / `askQty`; `mark`
//!   is the model mid clamped inside the book (`optmath::mark::clamp_mark`, the engine's rule); `theo` / `theoIv`
//!   the model mid and its smile vol; `markIv` / `bidIv` / `askIv` the implied vols of those prices on the vol
//!   clock; `last`, `change` (last − the previous 17:00 New York EOD mark), `oi` and `volume` from the engine.
//!   Greeks stay the model's. Without a live book the quote is the house model quote, unchanged.

use chrono::{DateTime, Utc};
use optmath::OptionType::{self, Call, Put};
use optmath::volclock::{calendar_years, effective_vol, rates_in_vol_time};
use optmath::mark::{BookSide, MarkSource, clamp_mark};
use optmath::{BarrierType, DeltaConvention, HolidayCalendar, Smile, SmileQuotes, VolClock, VolSurface, barrier_price, greeks, implied_vol, norm_cdf, price};
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::HashMap;

use crate::feed::Spot;
use crate::model::{BARRIER_LABEL, BARRIER_VENUE, Expiry, GroupSettings, RefData, Series, TradeState, Underlying};

#[derive(Debug)]
pub enum PriceError {
    NoSpot,
    NoVol,
    NoUsdRate(String),
}

impl std::fmt::Display for PriceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PriceError::NoSpot => write!(f, "no price for the underlying yet"),
            PriceError::NoVol => write!(f, "no volatility (no surface and no realized vol)"),
            PriceError::NoUsdRate(c) => write!(f, "no USD conversion rate for {c}"),
        }
    }
}

/// Model inputs for one (underlying, expiry) at one instant.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ctx {
    pub spot: f64,
    pub spot_source: &'static str,
    pub forward: f64,
    pub r: f64,
    pub b: f64,
    pub rf: f64,
    pub t_cal: f64,
    pub t_vol: f64,
    /// Calendar / vol time one calendar day later (theta).
    pub t_cal_1d: f64,
    pub t_vol_1d: f64,
    pub atm_vol: f64,
    pub surface_atm: Option<f64>,
    pub realized: Option<f64>,
    pub blend_weight: f64,
    pub manual_vol: Option<f64>,
    pub surface_version: Option<i32>,
    pub quotes: Option<QuotesOut>,
    pub usd_per_quote: f64,
    #[serde(skip)]
    pub smile: Option<Smile>,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct QuotesOut {
    pub atm: f64,
    pub rr25: f64,
    pub bf25: f64,
    pub rr10: Option<f64>,
    pub bf10: Option<f64>,
}

impl From<SmileQuotes> for QuotesOut {
    fn from(q: SmileQuotes) -> Self {
        QuotesOut { atm: q.atm, rr25: q.rr25, bf25: q.bf25, rr10: q.rr10, bf10: q.bf10 }
    }
}

pub fn model_rates(rd: &RefData, u: &Underlying) -> (f64, f64, f64) {
    let r = rd.rate(&u.quote_ccy);
    match u.model.as_str() {
        "black76" => (r, 0.0, r),
        _ => {
            let rf = rd.rate(&u.base_ccy);
            (r, r - rf, rf)
        }
    }
}

/// The part of a pricing context that depends on neither the instant nor the spot: rates, the pair calendar and
/// vol clock, the latest surface, realized vol and a manual-vol override. `context` builds the live price from it;
/// premium candles (`crate::candles`) evaluate the same model at past instants and spots.
pub struct Model<'a> {
    pub cut_ms: i64,
    pub cal: HolidayCalendar,
    pub clock: VolClock,
    pub r: f64,
    pub b: f64,
    pub rf: f64,
    pub surface: Option<&'a VolSurface>,
    pub surface_version: Option<i32>,
    pub blend_weight: f64,
    pub realized: Option<f64>,
    pub manual_vol: Option<f64>,
    pub delta_convention: DeltaConvention,
}

impl<'a> Model<'a> {
    /// The model of one (underlying, expiry). `manual_vol` comes from a dealer control (`RefData::overrides`).
    pub fn new(rd: &'a RefData, u: &Underlying, e: &Expiry, manual_vol: Option<f64>) -> Result<Self, PriceError> {
        let surf = rd.surfaces.get(&u.symbol);
        let surface = surf.and_then(|s| s.surface.as_ref());
        let realized = rd.realized.get(&u.symbol).map(|r| r.value);
        if surface.is_none() && realized.is_none() {
            return Err(PriceError::NoVol);
        }
        let (r, b, rf) = model_rates(rd, u);
        Ok(Model {
            cut_ms: e.cut_at.timestamp_millis(),
            cal: rd.pair_calendar(&u.symbol),
            clock: u.clock(),
            r,
            b,
            rf,
            surface,
            surface_version: surf.map(|s| s.version),
            blend_weight: surf.map(|s| s.blend_weight).unwrap_or(0.0),
            realized,
            manual_vol,
            delta_convention: if u.delta_convention == "forward" { DeltaConvention::Forward } else { DeltaConvention::Spot },
        })
    }

    /// `(t_cal, t_vol)` from `now_ms` to the cut: ACT/365 and the business-time vol clock.
    pub fn times(&self, now_ms: i64) -> (f64, f64) {
        (calendar_years(now_ms, self.cut_ms), self.clock.vol_years(now_ms, self.cut_ms, &self.cal))
    }

    /// The context at `spot` with `t_cal` / `t_vol` left to the cut (from `times`). The theta times `t_cal_1d` /
    /// `t_vol_1d` are left at 0: `context` fills them in, callers that only need `mid_price` do not.
    pub fn ctx(&self, spot: f64, spot_source: &'static str, usd_per_quote: f64, t_cal: f64, t_vol: f64) -> Ctx {
        let (r, b) = (self.r, self.b);
        let quotes = self.surface.map(|s| s.quotes_at(t_cal.max(1.0 / 365.0 / 24.0)));
        let surface_atm = quotes.map(|q| q.atm);
        let mut atm = match (surface_atm, self.realized) {
            (Some(s), Some(rv)) => self.blend_weight * s + (1.0 - self.blend_weight) * rv,
            (Some(s), None) => s,
            // `new` guarantees a surface or a realized vol
            (None, rv) => rv.unwrap_or(0.0),
        };
        if let Some(m) = self.manual_vol {
            atm = m;
        }
        let quotes = quotes.map(|q| SmileQuotes { atm, ..q }).unwrap_or(SmileQuotes { atm, rr25: 0.0, bf25: 0.0, rr10: None, bf10: None });
        let smile = if t_vol > 0.0 && t_cal > 0.0 {
            let (r2, b2) = rates_in_vol_time(r, b, t_cal, t_vol);
            Smile::new(quotes, spot, t_vol, r2, r2 - b2, self.delta_convention).ok()
        } else {
            None
        };
        Ctx {
            spot,
            spot_source,
            forward: spot * (b * t_cal).exp(),
            r,
            b,
            rf: self.rf,
            t_cal,
            t_vol,
            t_cal_1d: 0.0,
            t_vol_1d: 0.0,
            atm_vol: atm,
            surface_atm,
            realized: self.realized,
            blend_weight: self.blend_weight,
            manual_vol: self.manual_vol,
            surface_version: self.surface_version,
            quotes: Some(quotes.into()),
            usd_per_quote,
            smile,
        }
    }
}

/// Builds the pricing context. `spot` is the live mid (a freeze control overrides it).
pub fn context(rd: &RefData, u: &Underlying, e: &Expiry, spot: Option<f64>, usd_per_quote: Option<f64>, now_ms: i64, tenant: Option<&str>) -> Result<Ctx, PriceError> {
    let (manual_vol, frozen) = rd.overrides(tenant, &u.symbol, &e.key());
    let (spot, spot_source) = match (frozen, spot) {
        (Some(f), _) => (f, "frozen"),
        (None, Some(s)) if s > 0.0 => (s, "live"),
        _ => return Err(PriceError::NoSpot),
    };
    let usd_per_quote = usd_per_quote.filter(|x| *x > 0.0).ok_or_else(|| PriceError::NoUsdRate(u.quote_ccy.clone()))?;
    let model = Model::new(rd, u, e, manual_vol)?;
    let (t_cal, t_vol) = model.times(now_ms);
    let mut ctx = model.ctx(spot, spot_source, usd_per_quote, t_cal, t_vol);
    (ctx.t_cal_1d, ctx.t_vol_1d) = model.times(now_ms + 86_400_000);
    Ok(ctx)
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptQuote {
    pub code: String,
    /// House model bid; with a live order book the best bid (null when there is none).
    pub bid: Option<f64>,
    /// House model ask; with a live order book the best offer (null when there is none).
    pub ask: Option<f64>,
    pub mark: f64,
    pub bid_usd: Option<f64>,
    pub ask_usd: Option<f64>,
    pub mark_usd: f64,
    /// Mark in pips / points (pip_size units).
    pub mark_pips: f64,
    pub iv: f64,
    pub iv_bid: Option<f64>,
    pub iv_ask: Option<f64>,
    pub delta: f64,
    pub gamma: f64,
    pub vega: f64,
    pub theta: f64,
    pub prob_itm: f64,
    pub breakeven: f64,
    pub state: TradeState,
    /// Order book fields (only while the book is live).
    #[serde(flatten)]
    pub book: Option<BookFields>,
}

/// The order book part of a quote (docs/OPTIONS-EXCHANGE.md §10). Premiums per unit (quote currency), USD per
/// contract, quantities in contracts.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookFields {
    pub bid_qty: Option<f64>,
    pub ask_qty: Option<f64>,
    pub last: Option<f64>,
    pub last_qty: Option<f64>,
    pub last_usd: Option<f64>,
    /// `last` − the previous 17:00 New York EOD mark (null without a trade or an EOD mark).
    pub change: Option<f64>,
    /// Open interest: Σ long contracts.
    pub oi: f64,
    /// Contracts traded today.
    pub volume: f64,
    pub mark_iv: Option<f64>,
    /// Where the mark came from: `model` (inside the book or no qualifying book), `bid` or `ask` (clamped).
    pub mark_source: &'static str,
    /// Model mid at the smile vol.
    pub theo: f64,
    pub theo_usd: f64,
    pub theo_iv: f64,
    pub bid_iv: Option<f64>,
    pub ask_iv: Option<f64>,
}

/// Top of book of one series from the engine feed (premium per unit, contracts).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BookTop {
    pub bid: Option<(f64, f64)>,
    pub ask: Option<(f64, f64)>,
    pub last: Option<f64>,
    pub last_qty: Option<f64>,
    pub oi: f64,
    pub volume: f64,
}

pub fn round_to(x: f64, decimals: i32) -> f64 {
    if !x.is_finite() {
        return 0.0;
    }
    let p = 10f64.powi(decimals);
    (x * p).round() / p
}

fn sig_round(x: f64, digits: i32) -> f64 {
    if x == 0.0 || !x.is_finite() {
        return 0.0;
    }
    let mag = x.abs().log10().floor() as i32;
    round_to(x, (digits - 1 - mag).clamp(0, 12))
}

pub fn intrinsic(kind: OptionType, s: f64, k: f64) -> f64 {
    (kind.sign() * (s - k)).max(0.0)
}

/// Vol at a strike (smile, or flat ATM).
pub fn vol_at(ctx: &Ctx, k: f64) -> f64 {
    ctx.smile.as_ref().map(|s| s.vol_at_strike(k)).filter(|v| v.is_finite() && *v > 0.0).unwrap_or(ctx.atm_vol)
}

/// Model mid per unit (quote currency).
pub fn mid_price(ctx: &Ctx, kind: OptionType, k: f64) -> (f64, f64) {
    let sig = vol_at(ctx, k);
    if ctx.t_vol <= 0.0 || ctx.t_cal <= 0.0 {
        return (intrinsic(kind, ctx.spot, k), sig);
    }
    (price(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, effective_vol(sig, ctx.t_vol, ctx.t_cal)), sig)
}

/// Model mid per unit (quote currency) of a continuously monitored single-barrier option on the vanilla's smile vol
/// at the strike (Reiner-Rubinstein, `optmath::barrier_price`), exactly as the trading engine values barrier
/// positions. `rebate` is per unit in the quote currency. A breached knock-out is worth its rebate, a breached
/// knock-in its vanilla; with no time left: intrinsic if (knock-in and breached) or (knock-out and not), else the
/// rebate.
pub fn barrier_mid(ctx: &Ctx, kind: OptionType, k: f64, barrier: BarrierType, level: f64, rebate: f64) -> f64 {
    let s = ctx.spot;
    if ctx.t_cal <= 0.0 || ctx.t_vol <= 0.0 {
        let breached = if barrier.is_down() { s <= level } else { s >= level };
        return if barrier.is_in() == breached { intrinsic(kind, s, k) } else { rebate };
    }
    let sig = vol_at(ctx, k);
    let v = barrier_price(kind, barrier, s, k, level, rebate, ctx.t_cal, ctx.r, ctx.b, effective_vol(sig, ctx.t_vol, ctx.t_cal));
    if v.is_finite() { v.max(0.0) } else { 0.0 }
}

/// Implied vol (on the vol clock, comparable with the smile) of a premium per unit; `None` without time left or when
/// the price is outside the no-arbitrage bounds.
pub fn iv_of(ctx: &Ctx, kind: OptionType, k: f64, premium: f64) -> Option<f64> {
    if !(ctx.t_cal > 0.0 && ctx.t_vol > 0.0 && premium.is_finite() && premium > 0.0) {
        return None;
    }
    let se = implied_vol(kind, premium, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b).ok()?;
    let sig = se / (ctx.t_vol / ctx.t_cal).sqrt();
    sig.is_finite().then(|| round_to(sig, 5))
}

/// Unrounded model numbers of one series for a group.
struct Raw {
    kind: OptionType,
    k: f64,
    mark: f64,
    sig: f64,
    bid: f64,
    ask: f64,
    iv_bid: f64,
    iv_ask: f64,
    delta: f64,
    gamma: f64,
    vega: f64,
    theta: f64,
    prob_itm: f64,
    /// USD per contract for one unit of premium.
    usd: f64,
}

fn raw(ctx: &Ctx, u: &Underlying, s: &Series, group: &GroupSettings) -> Raw {
    let kind = if s.kind == "call" { Call } else { Put };
    let k = s.strike;
    let (mark, sig) = mid_price(ctx, kind, k);
    let usd = u.contract_size * ctx.usd_per_quote;
    let min_unit = if usd > 0.0 { group.min_spread_usd / usd } else { 0.0 };
    let alive = ctx.t_vol > 0.0 && ctx.t_cal > 0.0;
    let (mut bid, mut ask, iv_bid, iv_ask) = if alive {
        let kf = (ctx.t_vol / ctx.t_cal).sqrt();
        let sb = (sig - group.vol_spread).max(0.25 * sig).max(0.001);
        let sa = sig + group.vol_spread;
        (price(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, sb * kf), price(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, sa * kf), sb, sa)
    } else {
        (mark, mark, sig, sig)
    };
    if alive && ask - bid < min_unit {
        bid = mark - 0.5 * min_unit;
        ask = mark + 0.5 * min_unit;
    }
    if bid < 0.0 {
        bid = 0.0;
        ask = ask.max(min_unit);
    }
    let (delta, gamma, vega, prob_itm) = if alive {
        let kf = (ctx.t_vol / ctx.t_cal).sqrt();
        let se = sig * kf;
        let g = greeks(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, se);
        let d2 = ((ctx.spot / k).ln() + (ctx.b - 0.5 * se * se) * ctx.t_cal) / (se * ctx.t_cal.sqrt());
        (g.delta, g.gamma * ctx.spot * 0.01, g.vega * kf * 0.01 * usd, norm_cdf(kind.sign() * d2))
    } else {
        let itm = intrinsic(kind, ctx.spot, k) > 0.0;
        (if itm { kind.sign() } else { 0.0 }, 0.0, 0.0, if itm { 1.0 } else { 0.0 })
    };
    let tomorrow = if ctx.t_cal_1d > 0.0 && ctx.t_vol_1d > 0.0 {
        price(kind, ctx.spot, k, ctx.t_cal_1d, ctx.r, ctx.b, effective_vol(sig, ctx.t_vol_1d, ctx.t_cal_1d))
    } else {
        intrinsic(kind, ctx.spot, k)
    };
    let theta = (tomorrow - mark) * usd;
    Raw { kind, k, mark, sig, bid, ask, iv_bid, iv_ask, delta, gamma, vega, theta, prob_itm, usd }
}

/// Full house quote of one series for a group (model bid / mark / ask).
pub fn quote(ctx: &Ctx, u: &Underlying, s: &Series, group: &GroupSettings, state: TradeState) -> OptQuote {
    let r = raw(ctx, u, s, group);
    let breakeven = if r.kind == Call { r.k + r.ask } else { r.k - r.ask };
    let pd = u.digits + 2;
    OptQuote {
        code: s.code.clone(),
        bid: Some(round_to(r.bid, pd)),
        ask: Some(round_to(r.ask, pd)),
        mark: round_to(r.mark, pd),
        bid_usd: Some(round_to(r.bid * r.usd, 2)),
        ask_usd: Some(round_to(r.ask * r.usd, 2)),
        mark_usd: round_to(r.mark * r.usd, 2),
        mark_pips: round_to(r.mark / u.pip_size, 1),
        iv: round_to(r.sig, 5),
        iv_bid: Some(round_to(r.iv_bid, 5)),
        iv_ask: Some(round_to(r.iv_ask, 5)),
        delta: round_to(r.delta, 4),
        gamma: sig_round(r.gamma, 4),
        vega: round_to(r.vega, 2),
        theta: round_to(r.theta, 2),
        prob_itm: round_to(r.prob_itm, 4),
        breakeven: round_to(breakeven, u.digits),
        state,
        book: None,
    }
}

/// Book prices are exact tick multiples: only float noise is removed.
fn px(x: f64) -> f64 {
    round_to(x, 12)
}

/// The quote of one series while the tenant's order book is live (docs/OPTIONS-EXCHANGE.md §6, §10): best bid / offer
/// and sizes from the book (`top`, `None` = an empty book), the mark clamped inside the book exactly as the engine
/// does, theo = the model mid, implied vols of the book prices, last / change / OI / volume. Greeks from the model.
pub fn quote_book(ctx: &Ctx, u: &Underlying, s: &Series, group: &GroupSettings, state: TradeState, top: Option<&BookTop>, prev_close: Option<f64>) -> OptQuote {
    let r = raw(ctx, u, s, group);
    let top = top.copied().unwrap_or_default();
    let ok = |x: Option<(f64, f64)>| x.filter(|(p, q)| p.is_finite() && *p > 0.0 && q.is_finite() && *q > 0.0);
    let (bid, ask) = (ok(top.bid), ok(top.ask));
    let side = |x: Option<(f64, f64)>| x.map(|(price, qty)| BookSide { price, qty });
    let (mark, src) = clamp_mark(r.mark, r.ask - r.bid, side(bid), side(ask), u.mark_min_qty, u.mark_max_spread_mult);
    let pd = u.digits + 2;
    let mark = match src {
        MarkSource::Model => round_to(mark, pd),
        _ => px(mark),
    };
    let mark_iv = match src {
        MarkSource::Model => Some(round_to(r.sig, 5)),
        _ => iv_of(ctx, r.kind, r.k, mark),
    };
    let bid_iv = bid.and_then(|(p, _)| iv_of(ctx, r.kind, r.k, p));
    let ask_iv = ask.and_then(|(p, _)| iv_of(ctx, r.kind, r.k, p));
    let last = top.last.filter(|x| x.is_finite() && *x > 0.0).map(px);
    let be_px = ask.map(|a| a.0).unwrap_or(mark);
    let breakeven = if r.kind == Call { r.k + be_px } else { r.k - be_px };
    let usd2 = |x: f64| round_to(x * r.usd, 2);
    OptQuote {
        code: s.code.clone(),
        bid: bid.map(|b| px(b.0)),
        ask: ask.map(|a| px(a.0)),
        mark,
        bid_usd: bid.map(|b| usd2(b.0)),
        ask_usd: ask.map(|a| usd2(a.0)),
        mark_usd: usd2(mark),
        mark_pips: round_to(mark / u.pip_size, 1),
        iv: mark_iv.unwrap_or(round_to(r.sig, 5)),
        iv_bid: bid_iv,
        iv_ask: ask_iv,
        delta: round_to(r.delta, 4),
        gamma: sig_round(r.gamma, 4),
        vega: round_to(r.vega, 2),
        theta: round_to(r.theta, 2),
        prob_itm: round_to(r.prob_itm, 4),
        breakeven: round_to(breakeven, u.digits),
        state,
        book: Some(BookFields {
            bid_qty: bid.map(|b| b.1),
            ask_qty: ask.map(|a| a.1),
            last,
            last_qty: last.and(top.last_qty),
            last_usd: last.map(usd2),
            change: last.zip(prev_close.filter(|x| x.is_finite())).map(|(l, c)| round_to(l - c, pd)),
            oi: top.oi.max(0.0),
            volume: top.volume.max(0.0),
            mark_iv,
            mark_source: match src {
                MarkSource::Model => "model",
                MarkSource::Bid => "bid",
                MarkSource::Ask => "ask",
            },
            theo: round_to(r.mark, pd),
            theo_usd: usd2(r.mark),
            theo_iv: round_to(r.sig, 5),
            bid_iv,
            ask_iv,
        }),
    }
}

/// One strike row of the chain.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChainRow {
    pub strike: f64,
    pub strike_label: String,
    pub call: Option<OptQuote>,
    pub put: Option<OptQuote>,
}

pub struct ChainInput<'a> {
    pub rd: &'a RefData,
    pub u: &'a Underlying,
    pub e: &'a Expiry,
    pub spot: Option<Spot>,
    pub usd_per_quote: Option<f64>,
    pub tenant: &'a str,
    pub group: &'a str,
    pub now: DateTime<Utc>,
    /// The tenant's order book for the account kind, when it is live (`None` = house model quotes).
    pub book: Option<BookIn<'a>>,
}

/// A live order book merged into a chain (docs/OPTIONS-EXCHANGE.md §10).
#[derive(Clone, Copy)]
pub struct BookIn<'a> {
    /// Top of book per series code; a series without an entry has an empty book.
    pub tops: &'a HashMap<String, BookTop>,
    /// The previous EOD mark per series code (for `change`).
    pub prev_close: &'a HashMap<String, f64>,
}

/// The chain header's `book` block: whether the tenant's order book is live for this account kind, the underlying's
/// tick, bands, contract limits and mark rules, and the group's maker / taker fees (§2, §6, §7). Both the nested
/// `bands` / `makerFee` / `takerFee` names and the flat `…Pct` / `…PerContract` names are sent.
pub fn book_header(u: &Underlying, gs: &GroupSettings, active: bool) -> Value {
    let (maker, taker) = gs.book_fees();
    json!({
        "active": active,
        "venue": if active { "book" } else { "house" },
        "premiumTick": u.premium_tick,
        "bands": {"market": u.market_band_pct, "limit": u.limit_band_pct, "minTicks": u.band_min_ticks},
        "makerFee": maker,
        "takerFee": taker,
        "feeCapPct": gs.commission_cap_pct,
        "marketBandPct": u.market_band_pct,
        "limitBandPct": u.limit_band_pct,
        "bandMinTicks": u.band_min_ticks,
        "makerFeePerContract": maker,
        "takerFeePerContract": taker,
        "minContracts": u.min_contracts,
        "contractStep": u.contract_step,
        "maxContracts": u.max_contracts,
        "markMinQty": u.mark_min_qty,
        "markMaxSpreadMult": u.mark_max_spread_mult,
        "rfqQuoteTtlSecs": u.rfq_quote_ttl_secs,
    })
}

/// Barrier options are RFQ only, quoted by Ezymex (never on the order book, §5).
pub fn barriers_header(u: &Underlying) -> Value {
    json!({"enabled": u.barriers_enabled, "venue": BARRIER_VENUE, "quotedBy": "ezymex", "ezymexQuoted": true, "orderBook": false, "label": BARRIER_LABEL})
}

/// Put / call ratio (`None` without call interest).
pub fn ratio(puts: f64, calls: f64) -> Option<f64> {
    (calls > 0.0).then(|| round_to(puts / calls, 4))
}

/// Rows of a chain (ascending strikes) plus the header JSON.
pub fn chain(inp: &ChainInput) -> (Value, Vec<ChainRow>) {
    let ChainInput { rd, u, e, spot, usd_per_quote, tenant, group, now, book } = inp;
    let gs = rd.group(tenant, group, &u.symbol);
    let series: Vec<&Series> = rd.series_of(e.id).filter(|s| s.status != "delisted").collect();
    let state = rd.trade_state(tenant, u, e, None, *now);
    let mut header = json!({
        "underlying": u.symbol,
        "name": u.name,
        "model": u.model,
        "expiry": e.expiry_date,
        "kinds": e.kinds,
        "cutAt": e.cut_at,
        "cut": {"time": u.cut_time, "zone": u.cut_zone},
        "twapStart": e.twap_start,
        "status": e.status,
        "state": state,
        "contractSize": u.contract_size,
        "contractUnit": u.contract_unit,
        "quoteCcy": u.quote_ccy,
        "digits": u.digits,
        "pipSize": u.pip_size,
        "group": group,
        "volSpread": gs.vol_spread,
        "minSpreadUsd": gs.min_spread_usd,
        "commission": {"perContract": gs.commission_per_contract, "capPct": gs.commission_cap_pct},
        "spot": spot.map(|s| json!({"bid": s.bid, "ask": s.ask, "mid": s.mid, "t": s.t, "ageMs": crate::feed::now_ms() - s.recv})),
        "fixing": e.fixing.map(|f| json!({"price": f, "source": e.fixing_source, "run": e.fixing_run, "samples": e.fixing_samples, "expected": e.fixing_expected, "coverage": e.fixing_coverage, "fixedAt": e.fixed_at})),
        "version": rd.version,
        "book": book_header(u, &gs, book.is_some()),
        "barriers": barriers_header(u),
    });
    if let Some(b) = book {
        // put / call ratios of the expiry from the engine's open interest and today's volume
        let (mut oi, mut vol) = ([0.0f64; 2], [0.0f64; 2]);
        for s in &series {
            if let Some(t) = b.tops.get(&s.code) {
                let i = usize::from(s.kind != "call");
                oi[i] += t.oi.max(0.0);
                vol[i] += t.volume.max(0.0);
            }
        }
        header["pcr"] = json!(ratio(oi[1], oi[0]));
        header["pcrVolume"] = json!(ratio(vol[1], vol[0]));
        header["oi"] = json!({"calls": oi[0], "puts": oi[1]});
        header["volume"] = json!({"calls": vol[0], "puts": vol[1]});
    }
    let ctx = match context(rd, u, e, spot.map(|s| s.mid), *usd_per_quote, now.timestamp_millis(), Some(tenant)) {
        Ok(c) => c,
        Err(err) => {
            header["error"] = json!({"code": "no_price", "message": err.to_string()});
            let rows = strikes_only(u, &series);
            return (header, rows);
        }
    };
    header["modelInputs"] = json!(ctx);
    let atm_k = ctx.smile.as_ref().map(|s| s.atm_strike()).unwrap_or(ctx.forward);
    header["atmStrike"] = json!(round_to(atm_k, u.digits));
    let mut rows: Vec<ChainRow> = Vec::new();
    for s in series {
        let st = rd.trade_state(tenant, u, e, Some(&s.code), *now);
        let q = match book {
            Some(b) => quote_book(&ctx, u, s, &gs, st, b.tops.get(&s.code), b.prev_close.get(&s.code).copied()),
            None => quote(&ctx, u, s, &gs, st),
        };
        let label = optmath::ladder::format_strike(s.strike_ticks, u.strike_step);
        let row = match rows.last_mut() {
            Some(r) if r.strike_label == label => r,
            _ => {
                rows.push(ChainRow { strike: s.strike, strike_label: label, call: None, put: None });
                rows.last_mut().unwrap()
            }
        };
        if s.kind == "call" {
            row.call = Some(q);
        } else {
            row.put = Some(q);
        }
    }
    (header, rows)
}

fn strikes_only(u: &Underlying, series: &[&Series]) -> Vec<ChainRow> {
    let mut rows: Vec<ChainRow> = Vec::new();
    for s in series {
        let label = optmath::ladder::format_strike(s.strike_ticks, u.strike_step);
        if rows.last().is_none_or(|r| r.strike_label != label) {
            rows.push(ChainRow { strike: s.strike, strike_label: label, call: None, put: None });
        }
    }
    rows
}

/// Smile points for charts: strike, vol and call delta across the listed strikes plus the pillars.
pub fn smile_points(ctx: &Ctx, strikes: &[f64]) -> Value {
    let pts: Vec<Value> = strikes.iter().map(|k| json!({"strike": k, "vol": round_to(vol_at(ctx, *k), 5)})).collect();
    let pillars: Vec<Value> = ctx
        .smile
        .as_ref()
        .map(|s| {
            s.pillars()
                .iter()
                .map(|(d, v)| json!({"callDelta": round_to(*d, 4), "vol": round_to(*v, 5), "strike": s.strike_at_call_delta(*d)}))
                .collect()
        })
        .unwrap_or_default();
    json!({"points": pts, "pillars": pillars})
}

#[cfg(test)]
mod tests {
    //! Pure-logic tests of the order book merge (no market data: a fixed model context).
    use super::*;
    use crate::model::{GroupSettings, Series, Underlying};

    fn und() -> Underlying {
        let now = Utc::now();
        Underlying {
            symbol: "EURUSD".into(),
            name: "Euro / US Dollar".into(),
            asset_class: "forex".into(),
            model: "gk".into(),
            base_ccy: "EUR".into(),
            quote_ccy: "USD".into(),
            calendars: vec!["EUR".into(), "USD".into()],
            contract_size: 10_000.0,
            contract_unit: "EUR".into(),
            digits: 5,
            pip_size: 0.0001,
            strike_step: 0.0025,
            strikes_each_side: 10,
            extend_threshold: 3,
            expiry_kinds: vec!["daily".into()],
            daily_count: 5,
            weekly_count: 4,
            monthly_count: 3,
            cut_time: "10:00".into(),
            cut_zone: "America/New_York".into(),
            twap_minutes: 30,
            no_open_minutes: 15,
            close_only_minutes: 1,
            delta_convention: "spot".into(),
            weekend_vol_weight: 0.15,
            holiday_vol_weight: 0.5,
            price_scan: 0.03,
            vol_scan: 0.03,
            extreme_multiple: 3.0,
            extreme_cover: 0.35,
            min_contracts: 1.0,
            max_contracts: 100.0,
            contract_step: 1.0,
            barriers_enabled: true,
            enabled: true,
            sort: 0,
            notes: String::new(),
            updated_at: now,
            updated_by: "test".into(),
            premium_tick: 0.00001,
            market_band_pct: 10.0,
            limit_band_pct: 50.0,
            band_min_ticks: 5,
            liq_band_pct: 5.0,
            liq_fee_pct: 2.0,
            rfq_quote_ttl_secs: 5,
            mark_min_qty: 1.0,
            mark_max_spread_mult: 3.0,
        }
    }

    /// A fixed model context: 7 calendar days, 5.3 vol days, flat 7 % vol.
    fn ctx() -> Ctx {
        let (t_cal, t_vol) = (7.0 / 365.0, 5.3 / 365.0);
        Ctx {
            spot: 1.17,
            spot_source: "live",
            forward: 1.17,
            r: 0.036,
            b: 0.016,
            rf: 0.02,
            t_cal,
            t_vol,
            t_cal_1d: 6.0 / 365.0,
            t_vol_1d: 4.3 / 365.0,
            atm_vol: 0.07,
            surface_atm: None,
            realized: None,
            blend_weight: 0.0,
            manual_vol: None,
            surface_version: None,
            quotes: None,
            usd_per_quote: 1.0,
            smile: None,
        }
    }

    fn series(kind: &str) -> Series {
        Series { code: format!("EURUSD-20261009-1.1700-{}", if kind == "call" { "C" } else { "P" }), symbol: "EURUSD".into(), expiry_id: 1, strike: 1.17, strike_ticks: 468, kind: kind.into(), status: "active".into() }
    }

    fn gs() -> GroupSettings {
        GroupSettings::builtin("ezymex")
    }

    #[test]
    fn house_quote_is_unchanged_without_a_book() {
        let q = quote(&ctx(), &und(), &series("call"), &gs(), TradeState::Open);
        let j = serde_json::to_value(&q).unwrap();
        assert!(j["bid"].is_number() && j["ask"].is_number() && j["ivBid"].is_number() && j["ivAsk"].is_number(), "{j}");
        for k in ["bidQty", "askQty", "theo", "markIv", "oi", "volume", "last", "change"] {
            assert!(j.get(k).is_none(), "{k} must not appear on a house quote: {j}");
        }
        assert!(q.bid.unwrap() < q.mark && q.mark < q.ask.unwrap());
    }

    #[test]
    fn empty_book_has_null_sides_and_the_model_mark() {
        let (c, u, s) = (ctx(), und(), series("call"));
        let house = quote(&c, &u, &s, &gs(), TradeState::Open);
        let q = quote_book(&c, &u, &s, &gs(), TradeState::Open, None, None);
        let j = serde_json::to_value(&q).unwrap();
        for k in ["bid", "ask", "bidUsd", "askUsd", "bidQty", "askQty", "last", "change", "bidIv", "askIv"] {
            assert!(j[k].is_null(), "{k}: {j}");
        }
        assert_eq!(q.mark, house.mark);
        let b = q.book.unwrap();
        assert_eq!((b.mark_source, b.theo, b.oi, b.volume), ("model", house.mark, 0.0, 0.0));
        assert_eq!(b.mark_iv, Some(b.theo_iv));
        assert_eq!((q.delta, q.gamma, q.vega, q.theta), (house.delta, house.gamma, house.vega, house.theta), "Greeks from the model");
    }

    #[test]
    fn mark_clamps_inside_a_tight_book_like_the_engine() {
        let (c, u, s) = (ctx(), und(), series("call"));
        let house = quote(&c, &u, &s, &gs(), TradeState::Open);
        let (theo, spread) = (house.mark, house.ask.unwrap() - house.bid.unwrap());
        // a tight book entirely above the model: the mark is the best bid
        let bid = theo + 0.3 * spread;
        let ask = bid + 0.5 * spread;
        let top = BookTop { bid: Some((bid, 4.0)), ask: Some((ask, 2.0)), last: Some(bid), last_qty: Some(1.0), oi: 30.0, volume: 6.0 };
        let q = quote_book(&c, &u, &s, &gs(), TradeState::Open, Some(&top), Some(theo));
        let b = q.book.clone().unwrap();
        assert_eq!((q.bid, q.ask, b.bid_qty, b.ask_qty), (Some(px(bid)), Some(px(ask)), Some(4.0), Some(2.0)));
        assert_eq!((q.mark, b.mark_source), (px(bid), "bid"));
        assert!(b.mark_iv.unwrap() > b.theo_iv, "{b:?}");
        assert_eq!(b.change, Some(round_to(bid - theo, 7)));
        assert_eq!((b.oi, b.volume, b.last), (30.0, 6.0, Some(px(bid))));
        assert!((q.mark_usd - round_to(bid * 10_000.0, 2)).abs() < 1e-9);
        // implied vols of the book prices bracket the mark's
        assert!(b.bid_iv.unwrap() <= b.mark_iv.unwrap() + 1e-9 && b.mark_iv.unwrap() < b.ask_iv.unwrap());
        assert_eq!((q.iv_bid, q.iv_ask, q.iv), (b.bid_iv, b.ask_iv, b.mark_iv.unwrap()));
        // breakeven uses the book's ask
        assert_eq!(q.breakeven, round_to(1.17 + px(ask), 5));
    }

    #[test]
    fn thin_or_wide_books_keep_the_model_and_one_side_bounds_it() {
        let (c, u, s) = (ctx(), und(), series("put"));
        let house = quote(&c, &u, &s, &gs(), TradeState::Open);
        let (theo, spread) = (house.mark, house.ask.unwrap() - house.bid.unwrap());
        let mk = |bid: Option<(f64, f64)>, ask: Option<(f64, f64)>| quote_book(&c, &u, &s, &gs(), TradeState::Open, Some(&BookTop { bid, ask, ..Default::default() }), None);
        // below markMinQty on both sides
        let q = mk(Some((theo + 0.2 * spread, 0.5)), Some((theo + 0.6 * spread, 0.5)));
        assert_eq!((q.mark, q.book.unwrap().mark_source), (theo, "model"));
        // wider than 3 x the model spread
        let q = mk(Some((theo + 0.1 * spread, 5.0)), Some((theo + 3.5 * spread, 5.0)));
        assert_eq!(q.mark, theo);
        // only an ask, below the model: min(model, ask)
        let a = theo - 0.25 * spread;
        let q = mk(None, Some((a, 5.0)));
        assert_eq!((q.mark, q.bid, q.book.as_ref().unwrap().mark_source), (px(a), None, "ask"));
        // only a bid below the model: the model stands
        let q = mk(Some((theo - 0.25 * spread, 5.0)), None);
        assert_eq!(q.mark, theo);
    }

    #[test]
    fn merge_agrees_with_the_shared_clamp_helper() {
        // deterministic pseudo-random books around the model: the chain mark is exactly optmath::mark::clamp_mark
        let (c, u) = (ctx(), und());
        let mut seed = 0x2545_f491_4f6c_dd1du64;
        let mut rnd = || {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            (seed >> 11) as f64 / (1u64 << 53) as f64
        };
        for i in 0..400 {
            let s = series(if i % 2 == 0 { "call" } else { "put" });
            let r = raw(&c, &u, &s, &gs());
            let spread = r.ask - r.bid;
            let bid_px = r.mark + (rnd() - 0.5) * 4.0 * spread;
            let ask_px = bid_px + rnd() * 5.0 * spread;
            let (keep_b, keep_a, qb, qa) = (rnd() > 0.2, rnd() > 0.2, (rnd() * 3.0).floor(), (rnd() * 3.0).floor());
            let side = |keep: bool, p: f64, q: f64| (keep && p > 0.0).then_some((p, q));
            let (bid, ask) = (side(keep_b, bid_px, qb), side(keep_a, ask_px, qa));
            let q = quote_book(&c, &u, &s, &gs(), TradeState::Open, Some(&BookTop { bid, ask, ..Default::default() }), None);
            let ok = |x: Option<(f64, f64)>| x.filter(|(_, q)| *q > 0.0).map(|(price, qty)| BookSide { price, qty });
            let (m, src) = clamp_mark(r.mark, spread, ok(bid), ok(ask), u.mark_min_qty, u.mark_max_spread_mult);
            let want = if src == MarkSource::Model { round_to(m, 7) } else { px(m) };
            assert_eq!(q.mark, want, "case {i}: {bid:?} {ask:?}");
            if let (Some(b), Some(a)) = (ok(bid), ok(ask))
                && b.qty >= 1.0
                && a.qty >= 1.0
                && a.price - b.price <= 3.0 * spread
            {
                assert!(q.mark >= px(b.price) - 1e-12 && q.mark <= px(a.price) + 1e-12, "inside a qualifying book");
            }
        }
    }

    #[test]
    fn implied_vol_round_trips_on_the_vol_clock() {
        let c = ctx();
        for (kind, k) in [(Call, 1.16), (Call, 1.18), (Put, 1.17), (Put, 1.15)] {
            let p = price(kind, c.spot, k, c.t_cal, c.r, c.b, effective_vol(0.083, c.t_vol, c.t_cal));
            assert!((iv_of(&c, kind, k, p).unwrap() - 0.083).abs() < 1e-5, "{kind:?} {k}");
        }
        assert_eq!(iv_of(&c, Call, 1.17, 0.0), None);
        assert_eq!(iv_of(&c, Call, 1.17, 5.0), None, "above the no-arbitrage maximum");
    }

    #[test]
    fn header_blocks() {
        let (u, g) = (und(), gs());
        let h = book_header(&u, &g, true);
        assert_eq!(h["active"], true);
        assert_eq!(h["premiumTick"], 0.00001);
        assert_eq!(h["bands"], json!({"market": 10.0, "limit": 50.0, "minTicks": 5}));
        assert_eq!((h["makerFee"].as_f64(), h["takerFee"].as_f64()), (Some(-0.05), Some(0.25)));
        assert_eq!((h["makerFeePerContract"].as_f64(), h["takerFeePerContract"].as_f64(), h["feeCapPct"].as_f64()), (Some(-0.05), Some(0.25), Some(10.0)));
        assert_eq!(book_header(&u, &g, false)["active"], false);
        let b = barriers_header(&u);
        assert_eq!((b["venue"].as_str(), b["label"].as_str(), b["orderBook"].as_bool()), (Some("rfq"), Some("Ezymex-quoted (RFQ only)"), Some(false)));
        assert_eq!(ratio(30.0, 20.0), Some(1.5));
        assert_eq!(ratio(30.0, 0.0), None);
    }
}
