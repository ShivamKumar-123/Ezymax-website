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

use chrono::{DateTime, Utc};
use optmath::OptionType::{self, Call, Put};
use optmath::volclock::{calendar_years, effective_vol, rates_in_vol_time};
use optmath::{DeltaConvention, Smile, SmileQuotes, greeks, norm_cdf, price};
use serde::Serialize;
use serde_json::{Value, json};

use crate::feed::Spot;
use crate::model::{Expiry, GroupSettings, RefData, Series, TradeState, Underlying};

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

/// Builds the pricing context. `spot` is the live mid (a freeze control overrides it).
pub fn context(rd: &RefData, u: &Underlying, e: &Expiry, spot: Option<f64>, usd_per_quote: Option<f64>, now_ms: i64, tenant: Option<&str>) -> Result<Ctx, PriceError> {
    let (manual_vol, frozen) = rd.overrides(tenant, &u.symbol, &e.key());
    let (spot, spot_source) = match (frozen, spot) {
        (Some(f), _) => (f, "frozen"),
        (None, Some(s)) if s > 0.0 => (s, "live"),
        _ => return Err(PriceError::NoSpot),
    };
    let usd_per_quote = usd_per_quote.filter(|x| *x > 0.0).ok_or_else(|| PriceError::NoUsdRate(u.quote_ccy.clone()))?;
    let cut_ms = e.cut_at.timestamp_millis();
    let cal = rd.pair_calendar(&u.symbol);
    let clock = u.clock();
    let t_cal = calendar_years(now_ms, cut_ms);
    let t_vol = clock.vol_years(now_ms, cut_ms, &cal);
    let next_day = now_ms + 86_400_000;
    let (t_cal_1d, t_vol_1d) = (calendar_years(next_day, cut_ms), clock.vol_years(next_day, cut_ms, &cal));
    let (r, b, rf) = model_rates(rd, u);

    let surf = rd.surfaces.get(&u.symbol);
    let quotes = surf.and_then(|s| s.surface.as_ref()).map(|s| s.quotes_at(t_cal.max(1.0 / 365.0 / 24.0)));
    let realized = rd.realized.get(&u.symbol).map(|r| r.value);
    let blend_weight = surf.map(|s| s.blend_weight).unwrap_or(0.0);
    let surface_atm = quotes.map(|q| q.atm);
    let mut atm = match (surface_atm, realized) {
        (Some(s), Some(rv)) => blend_weight * s + (1.0 - blend_weight) * rv,
        (Some(s), None) => s,
        (None, Some(rv)) => rv,
        (None, None) => return Err(PriceError::NoVol),
    };
    if let Some(m) = manual_vol {
        atm = m;
    }
    let quotes = quotes.map(|q| SmileQuotes { atm, ..q }).unwrap_or(SmileQuotes { atm, rr25: 0.0, bf25: 0.0, rr10: None, bf10: None });
    let smile = if t_vol > 0.0 && t_cal > 0.0 {
        let (r2, b2) = rates_in_vol_time(r, b, t_cal, t_vol);
        let conv = if u.delta_convention == "forward" { DeltaConvention::Forward } else { DeltaConvention::Spot };
        Smile::new(quotes, spot, t_vol, r2, r2 - b2, conv).ok()
    } else {
        None
    };
    Ok(Ctx {
        spot,
        spot_source,
        forward: spot * (b * t_cal).exp(),
        r,
        b,
        rf,
        t_cal,
        t_vol,
        t_cal_1d,
        t_vol_1d,
        atm_vol: atm,
        surface_atm,
        realized,
        blend_weight,
        manual_vol,
        surface_version: surf.map(|s| s.version),
        quotes: Some(quotes.into()),
        usd_per_quote,
        smile,
    })
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptQuote {
    pub code: String,
    pub bid: f64,
    pub ask: f64,
    pub mark: f64,
    pub bid_usd: f64,
    pub ask_usd: f64,
    pub mark_usd: f64,
    /// Mark in pips / points (pip_size units).
    pub mark_pips: f64,
    pub iv: f64,
    pub iv_bid: f64,
    pub iv_ask: f64,
    pub delta: f64,
    pub gamma: f64,
    pub vega: f64,
    pub theta: f64,
    pub prob_itm: f64,
    pub breakeven: f64,
    pub state: TradeState,
}

fn round_to(x: f64, decimals: i32) -> f64 {
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

fn intrinsic(kind: OptionType, s: f64, k: f64) -> f64 {
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

/// Full quote of one series for a group.
pub fn quote(ctx: &Ctx, u: &Underlying, s: &Series, group: &GroupSettings, state: TradeState) -> OptQuote {
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
    let breakeven = if kind == Call { k + ask } else { k - ask };
    let pd = u.digits + 2;
    OptQuote {
        code: s.code.clone(),
        bid: round_to(bid, pd),
        ask: round_to(ask, pd),
        mark: round_to(mark, pd),
        bid_usd: round_to(bid * usd, 2),
        ask_usd: round_to(ask * usd, 2),
        mark_usd: round_to(mark * usd, 2),
        mark_pips: round_to(mark / u.pip_size, 1),
        iv: round_to(sig, 5),
        iv_bid: round_to(iv_bid, 5),
        iv_ask: round_to(iv_ask, 5),
        delta: round_to(delta, 4),
        gamma: sig_round(gamma, 4),
        vega: round_to(vega, 2),
        theta: round_to(theta, 2),
        prob_itm: round_to(prob_itm, 4),
        breakeven: round_to(breakeven, u.digits),
        state,
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
}

/// Rows of a chain (ascending strikes) plus the header JSON.
pub fn chain(inp: &ChainInput) -> (Value, Vec<ChainRow>) {
    let ChainInput { rd, u, e, spot, usd_per_quote, tenant, group, now } = inp;
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
    });
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
        let q = quote(&ctx, u, s, &gs, st);
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
