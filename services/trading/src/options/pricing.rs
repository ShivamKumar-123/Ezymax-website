//! Option prices from the snapshot, computed exactly like the options service (services/options/src/pricing.rs and
//! the snapshot's `conventions`), so the chain a client sees and the fill the engine books agree:
//!
//! 1. `tCal` = ACT/365 to the cut; `tVol` = the underlying's vol clock over its pair calendar.
//! 2. Rates: GK `r = rate(quote)`, `b = rate(quote) - rate(base)`; BS the same with the lease rate; Black-76 `b = 0`.
//! 3. ATM: the surface at `tCal` blended with realized vol (`w * surface + (1 - w) * realized`); a manual-vol control
//!    replaces it; the smile (25D/10D RR/BF) is built in vol time with rescaled rates.
//! 4. Bid / ask at `sigma -/+ volSpread` (bid vol floored at `max(0.25 sigma, 0.001)`), widened to the group's
//!    minimum USD spread per contract, bid floored at 0; rounded to `digits + 2` decimals.
//!
//! Barrier options (not listed by the service, priced here) use Reiner-Rubinstein on the vanilla's smile vol at the
//! strike; their bid / ask are the lower / higher of the prices at the two spread vols (a knock-out can lose value
//! when vol rises), and their Greeks are finite differences.

use optmath::volclock::{calendar_years, effective_vol, rates_in_vol_time};
use optmath::{BarrierType, DeltaConvention, OptionType, Smile, SmileQuotes, barrier_price, greeks, norm_cdf, price};

use super::snapshot::{GroupSettings, OptSnapshot, Underlying};
use crate::model::{BarrierKind, BarrierTerms, OptRight};

#[derive(Clone, Debug, PartialEq)]
pub enum PriceError {
    NoSpot,
    NoVol,
    NoUsdRate(String),
    UnknownUnderlying(String),
}

impl std::fmt::Display for PriceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PriceError::NoSpot => write!(f, "no price for the underlying"),
            PriceError::NoVol => write!(f, "no volatility for the underlying"),
            PriceError::NoUsdRate(c) => write!(f, "no USD conversion rate for {c}"),
            PriceError::UnknownUnderlying(u) => write!(f, "{u} is not an options underlying"),
        }
    }
}

/// Model inputs for one (underlying, expiry) at one instant.
#[derive(Clone, Debug)]
pub struct Ctx {
    pub spot: f64,
    pub frozen: bool,
    pub r: f64,
    pub b: f64,
    pub t_cal: f64,
    pub t_vol: f64,
    pub t_cal_1d: f64,
    pub t_vol_1d: f64,
    pub atm_vol: f64,
    pub usd_per_quote: f64,
    pub smile: Option<Smile>,
}

pub fn kind_of(r: OptRight) -> OptionType {
    match r {
        OptRight::Call => OptionType::Call,
        OptRight::Put => OptionType::Put,
    }
}

pub fn barrier_type(k: BarrierKind) -> BarrierType {
    match k {
        BarrierKind::UO => BarrierType::UpOut,
        BarrierKind::DO => BarrierType::DownOut,
        BarrierKind::UI => BarrierType::UpIn,
        BarrierKind::DI => BarrierType::DownIn,
    }
}

pub fn model_rates(snap: &OptSnapshot, u: &Underlying) -> (f64, f64) {
    let r = snap.rate(&u.quote_ccy);
    match u.model.as_str() {
        "black76" => (r, 0.0),
        _ => (r, r - snap.rate(&u.base_ccy)),
    }
}

/// Builds the pricing context. `spot` is the live raw mid (a freeze control overrides it).
#[allow(clippy::too_many_arguments)]
pub fn context(snap: &OptSnapshot, u: &Underlying, expiry_key: &str, cut_ms: i64, spot: Option<f64>, usd_per_quote: Option<f64>, now_ms: i64, tenant: &str) -> Result<Ctx, PriceError> {
    let now = chrono::DateTime::from_timestamp_millis(now_ms).unwrap_or_default();
    let (manual_vol, frozen) = snap.overrides(tenant, &u.symbol, expiry_key, now);
    let (spot, frozen) = match (frozen, spot) {
        (Some(f), _) if f > 0.0 => (f, true),
        (_, Some(s)) if s > 0.0 && s.is_finite() => (s, false),
        _ => return Err(PriceError::NoSpot),
    };
    let usd_per_quote = usd_per_quote.filter(|x| *x > 0.0 && x.is_finite()).ok_or_else(|| PriceError::NoUsdRate(u.quote_ccy.clone()))?;
    let cal = snap.pair_calendar(&u.symbol);
    let clock = u.clock();
    let t_cal = calendar_years(now_ms, cut_ms);
    let t_vol = clock.vol_years(now_ms, cut_ms, &cal);
    let next_day = now_ms + 86_400_000;
    let (t_cal_1d, t_vol_1d) = (calendar_years(next_day, cut_ms), clock.vol_years(next_day, cut_ms, &cal));
    let (r, b) = model_rates(snap, u);
    let surf = snap.surfaces.get(&u.symbol);
    let quotes = surf.and_then(|s| s.surface.as_ref()).map(|s| s.quotes_at(t_cal.max(1.0 / 365.0 / 24.0)));
    let realized = snap.realized.get(&u.symbol).copied();
    let w = surf.map(|s| s.blend_weight).unwrap_or(0.0);
    let mut atm = match (quotes.map(|q| q.atm), realized) {
        (Some(s), Some(rv)) => w * s + (1.0 - w) * rv,
        (Some(s), None) => s,
        (None, Some(rv)) => rv,
        (None, None) => return Err(PriceError::NoVol),
    };
    if let Some(m) = manual_vol {
        atm = m;
    }
    if !(atm > 0.0 && atm.is_finite()) {
        return Err(PriceError::NoVol);
    }
    let quotes = quotes.map(|q| SmileQuotes { atm, ..q }).unwrap_or(SmileQuotes { atm, rr25: 0.0, bf25: 0.0, rr10: None, bf10: None });
    let smile = if t_vol > 0.0 && t_cal > 0.0 {
        let (r2, b2) = rates_in_vol_time(r, b, t_cal, t_vol);
        let conv = if u.delta_convention == "forward" { DeltaConvention::Forward } else { DeltaConvention::Spot };
        Smile::new(quotes, spot, t_vol, r2, r2 - b2, conv).ok()
    } else {
        None
    };
    Ok(Ctx { spot, frozen, r, b, t_cal, t_vol, t_cal_1d, t_vol_1d, atm_vol: atm, usd_per_quote, smile })
}

/// Vol at a strike (smile, or flat ATM).
pub fn vol_at(ctx: &Ctx, k: f64) -> f64 {
    ctx.smile.as_ref().map(|s| s.vol_at_strike(k)).filter(|v| v.is_finite() && *v > 0.0).unwrap_or(ctx.atm_vol)
}

pub fn round_to(x: f64, decimals: i32) -> f64 {
    if !x.is_finite() {
        return 0.0;
    }
    let p = 10f64.powi(decimals);
    (x * p).round() / p
}

/// One option quote per unit of the underlying (quote currency) with Greeks.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Quote {
    pub bid: f64,
    pub ask: f64,
    pub mark: f64,
    /// Mid vol at the strike.
    pub iv: f64,
    /// Per unit.
    pub delta: f64,
    /// Delta change per 1 % spot move, per unit.
    pub gamma: f64,
    /// USD per contract per vol point.
    pub vega: f64,
    /// USD per contract over the next calendar day.
    pub theta: f64,
    pub prob_itm: f64,
}

fn alive(ctx: &Ctx) -> bool {
    ctx.t_vol > 0.0 && ctx.t_cal > 0.0
}

/// Applies the group's minimum USD spread per contract and the zero floor; rounds to `digits + 2`.
fn spread(mark: f64, mut bid: f64, mut ask: f64, ctx: &Ctx, u: &Underlying, g: &GroupSettings) -> (f64, f64, f64) {
    let usd = u.contract_size * ctx.usd_per_quote;
    let min_unit = if usd > 0.0 { g.min_spread_usd / usd } else { 0.0 };
    if alive(ctx) && ask - bid < min_unit {
        bid = mark - 0.5 * min_unit;
        ask = mark + 0.5 * min_unit;
    }
    if bid < 0.0 {
        bid = 0.0;
        ask = ask.max(min_unit);
    }
    let pd = u.digits + 2;
    (round_to(bid, pd), round_to(ask, pd), round_to(mark, pd))
}

/// Vanilla quote (the options service's `quote`).
pub fn vanilla(ctx: &Ctx, u: &Underlying, right: OptRight, k: f64, g: &GroupSettings) -> Quote {
    let kind = kind_of(right);
    let sig = vol_at(ctx, k);
    let intrinsic = (kind.sign() * (ctx.spot - k)).max(0.0);
    let mark = if alive(ctx) { price(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, effective_vol(sig, ctx.t_vol, ctx.t_cal)) } else { intrinsic };
    let usd = u.contract_size * ctx.usd_per_quote;
    let (bid, ask) = if alive(ctx) {
        let kf = (ctx.t_vol / ctx.t_cal).sqrt();
        let sb = (sig - g.vol_spread).max(0.25 * sig).max(0.001);
        let sa = sig + g.vol_spread;
        (price(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, sb * kf), price(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, sa * kf))
    } else {
        (mark, mark)
    };
    let (delta, gamma, vega, prob_itm) = if alive(ctx) {
        let kf = (ctx.t_vol / ctx.t_cal).sqrt();
        let se = sig * kf;
        let gr = greeks(kind, ctx.spot, k, ctx.t_cal, ctx.r, ctx.b, se);
        let d2 = ((ctx.spot / k).ln() + (ctx.b - 0.5 * se * se) * ctx.t_cal) / (se * ctx.t_cal.sqrt());
        (gr.delta, gr.gamma * ctx.spot * 0.01, gr.vega * kf * 0.01 * usd, norm_cdf(kind.sign() * d2))
    } else {
        let itm = intrinsic > 0.0;
        (if itm { kind.sign() } else { 0.0 }, 0.0, 0.0, if itm { 1.0 } else { 0.0 })
    };
    let tomorrow = if ctx.t_cal_1d > 0.0 && ctx.t_vol_1d > 0.0 { price(kind, ctx.spot, k, ctx.t_cal_1d, ctx.r, ctx.b, effective_vol(sig, ctx.t_vol_1d, ctx.t_cal_1d)) } else { intrinsic };
    let theta = (tomorrow - mark) * usd;
    let (bid, ask, mark) = spread(mark, bid, ask, ctx, u, g);
    Quote { bid, ask, mark, iv: sig, delta, gamma, vega, theta, prob_itm }
}

/// Price per unit of a barrier option at spot `s`, vol `sig`, times `t_cal` / `t_vol`.
fn barrier_value(ctx: &Ctx, right: OptRight, k: f64, b: &BarrierTerms, rebate: f64, level: f64, s: f64, sig: f64, t_cal: f64, t_vol: f64) -> f64 {
    let kind = kind_of(right);
    let bt = barrier_type(b.kind);
    let breached = if b.kind.is_up() { s >= level } else { s <= level };
    if t_cal <= 0.0 || t_vol <= 0.0 {
        let intrinsic = (kind.sign() * (s - k)).max(0.0);
        return match (b.kind.is_in(), breached) {
            (true, true) | (false, false) => intrinsic,
            _ => rebate,
        };
    }
    let v = barrier_price(kind, bt, s, k, level, rebate, t_cal, ctx.r, ctx.b, effective_vol(sig, t_vol, t_cal));
    if v.is_finite() { v.max(0.0) } else { 0.0 }
}

/// Barrier quote. `b` must be alive (a knocked-in barrier prices as its vanilla).
pub fn barrier(ctx: &Ctx, u: &Underlying, right: OptRight, k: f64, b: &BarrierTerms, g: &GroupSettings) -> Quote {
    let level = crate::options::f(b.level);
    let rebate = crate::options::f(b.rebate).max(0.0);
    let sig = vol_at(ctx, k);
    let val = |s: f64, sg: f64, tc: f64, tv: f64| barrier_value(ctx, right, k, b, rebate, level, s, sg, tc, tv);
    let mark = val(ctx.spot, sig, ctx.t_cal, ctx.t_vol);
    let usd = u.contract_size * ctx.usd_per_quote;
    let (bid, ask) = if alive(ctx) {
        let sb = (sig - g.vol_spread).max(0.25 * sig).max(0.001);
        let sa = sig + g.vol_spread;
        let (pb, pa) = (val(ctx.spot, sb, ctx.t_cal, ctx.t_vol), val(ctx.spot, sa, ctx.t_cal, ctx.t_vol));
        (pb.min(pa).min(mark), pb.max(pa).max(mark))
    } else {
        (mark, mark)
    };
    let h = ctx.spot * 1e-4;
    let (delta, gamma, vega) = if alive(ctx) && h > 0.0 {
        let up = val(ctx.spot + h, sig, ctx.t_cal, ctx.t_vol);
        let dn = val(ctx.spot - h, sig, ctx.t_cal, ctx.t_vol);
        let delta = (up - dn) / (2.0 * h);
        let gamma = (up - 2.0 * mark + dn) / (h * h) * ctx.spot * 0.01;
        let dv = 0.001;
        let vega = (val(ctx.spot, sig + dv, ctx.t_cal, ctx.t_vol) - val(ctx.spot, (sig - dv).max(1e-4), ctx.t_cal, ctx.t_vol)) / (2.0 * dv) * 0.01 * usd;
        (delta, gamma, vega)
    } else {
        (0.0, 0.0, 0.0)
    };
    let tomorrow = val(ctx.spot, sig, ctx.t_cal_1d, ctx.t_vol_1d);
    let theta = (tomorrow - mark) * usd;
    let (bid, ask, mark) = spread(mark, bid, ask, ctx, u, g);
    Quote { bid, ask, mark, iv: sig, delta, gamma, vega, theta, prob_itm: 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::options::snapshot::OptSnapshot;
    use serde_json::json;

    pub fn snap() -> OptSnapshot {
        OptSnapshot::from_json(json!({
            "version": 1,
            "underlyings": [{"symbol": "EURUSD", "model": "gk", "baseCcy": "EUR", "quoteCcy": "USD", "calendarCodes": ["EUR", "USD"], "contractSize": 10000,
                             "digits": 5, "pipSize": 0.0001, "weekendVolWeight": 0.15, "holidayVolWeight": 0.5, "enabled": true}],
            "rates": [{"ccy": "USD", "rate": 0.04}, {"ccy": "EUR", "rate": 0.02}],
            "surfaces": [{"symbol": "EURUSD", "version": 1, "blendWeight": 1.0, "pillars": [{"tenor": "1W", "days": 7, "atm": 0.07, "rr25": -0.002, "bf25": 0.002}, {"tenor": "1M", "days": 30, "atm": 0.075, "rr25": -0.003, "bf25": 0.0025}]}],
            "expiries": [{"id": 1, "symbol": "EURUSD", "expiryDate": "2026-10-09", "cutAt": "2026-10-09T14:00:00Z", "status": "listed"}],
        }))
        .unwrap()
    }

    #[test]
    fn vanilla_bid_mark_ask_and_parity() {
        let s = snap();
        let u = s.underlying("EURUSD").unwrap();
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-05T12:00:00Z").unwrap().timestamp_millis();
        let cut = chrono::DateTime::parse_from_rfc3339("2026-10-09T14:00:00Z").unwrap().timestamp_millis();
        let ctx = context(&s, u, "EURUSD:2026-10-09", cut, Some(1.16), Some(1.0), now, "ezymex").unwrap();
        let g = GroupSettings::builtin("ezymex");
        let c = vanilla(&ctx, u, OptRight::Call, 1.16, &g);
        let p = vanilla(&ctx, u, OptRight::Put, 1.16, &g);
        assert!(c.bid <= c.mark && c.mark <= c.ask && c.bid > 0.0, "{c:?}");
        // minimum spread: 0.5 USD per 10 000 units
        assert!(c.ask - c.bid >= 0.5 / 10_000.0 - 1e-9);
        // put-call parity on marks: C - P = e^{-rT}(F - K)
        let fwd = 1.16 * (ctx.b * ctx.t_cal).exp();
        let parity = (-ctx.r * ctx.t_cal).exp() * (fwd - 1.16);
        assert!((c.mark - p.mark - parity).abs() < 2e-7, "{} vs {parity}", c.mark - p.mark);
        assert!(c.delta > 0.4 && c.delta < 0.6 && p.delta < 0.0);
        assert!(c.theta < 0.0 && c.vega > 0.0);
    }

    #[test]
    fn knock_out_is_cheaper_than_the_vanilla_and_in_plus_out_is_vanilla() {
        let s = snap();
        let u = s.underlying("EURUSD").unwrap();
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-05T12:00:00Z").unwrap().timestamp_millis();
        let cut = chrono::DateTime::parse_from_rfc3339("2026-10-09T14:00:00Z").unwrap().timestamp_millis();
        let ctx = context(&s, u, "EURUSD:2026-10-09", cut, Some(1.16), Some(1.0), now, "ezymex").unwrap();
        let g = GroupSettings { min_spread_usd: 0.0, vol_spread: 0.0, ..GroupSettings::builtin("ezymex") };
        let lvl = crate::money::from_f64(1.18).unwrap();
        let uo = BarrierTerms { kind: BarrierKind::UO, level: lvl, rebate: crate::money::ZERO, knocked_in: false, knocked_at: None, knock_spot: None };
        let ui = BarrierTerms { kind: BarrierKind::UI, ..uo.clone() };
        let v = vanilla(&ctx, u, OptRight::Call, 1.16, &g).mark;
        let o = barrier(&ctx, u, OptRight::Call, 1.16, &uo, &g).mark;
        let i = barrier(&ctx, u, OptRight::Call, 1.16, &ui, &g).mark;
        assert!(o < v && o > 0.0);
        assert!((o + i - v).abs() < 1e-6, "{o} + {i} vs {v}");
    }
}
