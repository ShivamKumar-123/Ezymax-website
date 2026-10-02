//! Premium candles: the chart of an option series' **model mid premium** (USD per contract, the unit of the chain's
//! `markUsd`), bar by bar, derived from the underlying's market-data candles. The premium moves at the same moments
//! as the underlying, by the option's amount, and melts as the cut approaches (theta), like a real option chart.
//!
//! For every bar:
//! * the time left is measured from the bar's own instants (business-time vol clock and ACT/365, as live pricing):
//!   `o` at the bar open, `c` at the bar close (`now` for the forming bar);
//! * the model is today's: latest surface (interpolated at that bar's time to the cut), realized-vol blend, smile,
//!   rates and a manual-vol control. Historical vol / rates are **not** replayed;
//! * OHLC mapping: a call is increasing in spot, so `o = f(open)`, `h = f(high)`, `l = f(low)`, `c = f(close)`; a put
//!   is decreasing, so `h = f(low)` and `l = f(high)`. The high side is taken at the bar open and the low side at the
//!   bar close, which bounds the in-bar premium path (time value only melts inside the bar), then `h >= max(o, c)`
//!   and `l <= min(o, c)` are enforced;
//! * at / after the cut the value is intrinsic at the fixing (at the spot while there is no fixing yet);
//! * barrier options (engine positions on a vanilla series): Reiner-Rubinstein like the engine. Without the
//!   engine's knock time, the first bar whose range touches the level knocks the option: a knock-out is worth its
//!   rebate from then on, a knock-in becomes the vanilla. A barrier premium is not monotone in spot, so `h` / `l`
//!   take the max / min over the open, close, high and low spots.
//!
//! USD conversion: XXXUSD = 1; USDXXX (USDJPY, USDCAD, USDCHF) converts each point at its own spot (1 / S); crosses
//! (EURJPY, GBPJPY) use today's USD rate.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use optmath::BarrierType;
use optmath::OptionType::{self, Call};
use optmath::volclock::calendar_years;
use serde::Serialize;
use serde_json::Value;

use crate::AppState;
use crate::model::Underlying;
use crate::pricing::{self, Model};

/// Underlying bars and computed series candles are cached this long (protects market-data).
pub const CACHE_TTL: Duration = Duration::from_secs(30);
pub const DEFAULT_LIMIT: usize = 500;
pub const MAX_LIMIT: usize = 1500;
/// History before the listing time goes back at most this far (and never before `cut - tenor`).
pub const LOOKBACK_DAYS: i64 = 30;
/// Premiums are rounded to this many decimals (USD per contract; the chain rounds to cents).
pub const USD_DECIMALS: i32 = 4;

/// Supported timeframes: minutes and the market-data name.
pub const TIMEFRAMES: [(i64, &str); 7] = [(1, "M1"), (5, "M5"), (15, "M15"), (30, "M30"), (60, "H1"), (240, "H4"), (1440, "D1")];

/// `"60"` or `"H1"` -> `(60, "H1")`.
pub fn parse_tf(s: &str) -> Option<(i64, &'static str)> {
    let s = s.trim();
    TIMEFRAMES.iter().copied().find(|(m, n)| s == m.to_string() || s.eq_ignore_ascii_case(n))
}

/// One underlying bar from market-data (`t` = open, unix seconds).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bar {
    pub t: i64,
    pub o: f64,
    pub h: f64,
    pub l: f64,
    pub c: f64,
}

impl Bar {
    pub fn flat(t: i64, p: f64) -> Self {
        Bar { t, o: p, h: p, l: p, c: p }
    }
    fn from_json(v: &Value) -> Option<Self> {
        let b = Bar { t: v["t"].as_i64()?, o: v["o"].as_f64()?, h: v["h"].as_f64()?, l: v["l"].as_f64()?, c: v["c"].as_f64()? };
        b.is_valid().then_some(b)
    }
    pub fn is_valid(&self) -> bool {
        [self.o, self.h, self.l, self.c].iter().all(|x| x.is_finite() && *x > 0.0) && self.h >= self.l
    }
}

/// One premium candle: `o h l c` in USD per contract, `u` = the underlying close.
#[derive(Clone, Copy, Debug, Serialize, PartialEq)]
pub struct Candle {
    pub t: i64,
    pub o: f64,
    pub h: f64,
    pub l: f64,
    pub c: f64,
    pub u: f64,
}

/// USD value of one unit of the quote currency.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum UsdConv {
    /// Quote USD (1) or a cross at today's rate.
    Fixed(f64),
    /// `USDXXX`: 1 / the underlying at that point.
    InverseSpot,
}

impl UsdConv {
    pub fn at(self, spot: f64) -> f64 {
        match self {
            UsdConv::Fixed(x) => x,
            UsdConv::InverseSpot => 1.0 / spot,
        }
    }
}

/// Barrier terms of an engine position on a vanilla series.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Barrier {
    pub kind: BarrierType,
    pub level: f64,
    /// Per unit of the underlying, quote currency (the engine's `BarrierTerms.rebate`).
    pub rebate: f64,
    /// The engine's knock time (ms) when known; otherwise the first bar touching the level knocks.
    pub knocked_at_ms: Option<i64>,
}

impl Barrier {
    pub fn parse_kind(s: &str) -> Option<BarrierType> {
        match s.trim().to_ascii_uppercase().as_str() {
            "UO" => Some(BarrierType::UpOut),
            "DO" => Some(BarrierType::DownOut),
            "UI" => Some(BarrierType::UpIn),
            "DI" => Some(BarrierType::DownIn),
            _ => None,
        }
    }
    pub fn code(&self) -> &'static str {
        match self.kind {
            BarrierType::UpOut => "UO",
            BarrierType::DownOut => "DO",
            BarrierType::UpIn => "UI",
            BarrierType::DownIn => "DI",
        }
    }
    fn touched(&self, b: &Bar) -> bool {
        if self.kind.is_down() { b.l <= self.level } else { b.h >= self.level }
    }
}

/// The contract being charted.
#[derive(Clone, Copy, Debug)]
pub struct Spec {
    pub kind: OptionType,
    pub strike: f64,
    pub contract_size: f64,
    /// Settlement price once fixed (intrinsic at / after the cut uses it).
    pub fixing: Option<f64>,
    pub barrier: Option<Barrier>,
    pub usd: UsdConv,
    /// Decimals of the underlying (rounds `u`).
    pub digits: i32,
}

/// `(t_cal, t_vol)` to the cut for each instant. Vol time is accumulated backwards over the gaps between instants,
/// which equals `vol_years(t, cut)` because the clock is additive, and the latest instant (`now` on a live page) is
/// computed directly so the last candle matches the live chain exactly.
fn time_table(model: &Model, instants: &mut Vec<i64>) -> HashMap<i64, (f64, f64)> {
    instants.sort_unstable();
    instants.dedup();
    let mut out = HashMap::with_capacity(instants.len());
    let mut next: Option<(i64, f64)> = None;
    for &t in instants.iter().rev() {
        if t >= model.cut_ms {
            out.insert(t, (0.0, 0.0));
            continue;
        }
        let tv = match next {
            Some((n, v)) => model.clock.vol_years(t, n, &model.cal) + v,
            None => model.clock.vol_years(t, model.cut_ms, &model.cal),
        };
        out.insert(t, (calendar_years(t, model.cut_ms), tv));
        next = Some((t, tv));
    }
    out
}

/// Premium per unit (quote currency) at instant `t_ms` and spot `s`; `knocked` = the barrier has been touched.
fn unit_value(model: &Model, spec: &Spec, t_ms: i64, times: (f64, f64), s: f64, knocked: bool) -> f64 {
    let k = spec.strike;
    if t_ms >= model.cut_ms {
        let intrinsic = pricing::intrinsic(spec.kind, spec.fixing.unwrap_or(s), k);
        return match spec.barrier {
            None => intrinsic,
            // knock-in that knocked in / knock-out still alive: the vanilla payoff; otherwise the rebate
            Some(b) => {
                if b.kind.is_in() == knocked {
                    intrinsic
                } else {
                    b.rebate
                }
            }
        };
    }
    let ctx = model.ctx(s, "history", 1.0, times.0, times.1);
    match spec.barrier {
        None => pricing::mid_price(&ctx, spec.kind, k).0,
        Some(b) if knocked => {
            if b.kind.is_in() {
                pricing::mid_price(&ctx, spec.kind, k).0
            } else {
                b.rebate
            }
        }
        Some(b) => pricing::barrier_mid(&ctx, spec.kind, k, b.kind, b.level, b.rebate),
    }
}

fn max4(a: f64, b: f64, c: f64, d: f64) -> f64 {
    a.max(b).max(c).max(d)
}

fn min4(a: f64, b: f64, c: f64, d: f64) -> f64 {
    a.min(b).min(c).min(d)
}

/// Underlying bars (ascending, all opening before the cut) -> premium candles. The close of a bar is valued at
/// `min(open + tf, now_ms)`. `knocked` is the barrier state before the first bar; the state after the last bar is
/// returned with the candles.
pub fn premium_candles(model: &Model, spec: &Spec, bars: &[Bar], tf_secs: i64, now_ms: i64, mut knocked: bool) -> (Vec<Candle>, bool) {
    let span = |b: &Bar| {
        let t_o = b.t * 1000;
        (t_o, ((b.t + tf_secs) * 1000).min(now_ms).max(t_o))
    };
    let mut instants: Vec<i64> = bars.iter().flat_map(|b| <[i64; 2]>::from(span(b))).collect();
    let table = time_table(model, &mut instants);
    let usd_per_contract = |s: f64| spec.contract_size * spec.usd.at(s);
    let val = |t: i64, s: f64, kn: bool| {
        let times = table.get(&t).copied().unwrap_or((0.0, 0.0));
        unit_value(model, spec, t, times, s, kn) * usd_per_contract(s)
    };
    let round = |x: f64| pricing::round_to(x, USD_DECIMALS);
    let mut out = Vec::with_capacity(bars.len());
    for bar in bars {
        let (t_o, t_c) = span(bar);
        let (o, h, l, c);
        match spec.barrier {
            None => {
                // vanilla: monotone in spot (USD conversion included), high side at the open, low side at the close
                let (hi_s, lo_s) = if spec.kind == Call { (bar.h, bar.l) } else { (bar.l, bar.h) };
                o = val(t_o, bar.o, false);
                c = val(t_c, bar.c, false);
                h = val(t_o, hi_s, false).max(o).max(c);
                l = val(t_c, lo_s, false).min(o).min(c);
            }
            Some(b) => {
                if b.knocked_at_ms.is_some_and(|at| at <= t_o) {
                    knocked = true;
                }
                let knocks_here = !knocked && t_o < model.cut_ms && b.knocked_at_ms.map_or_else(|| b.touched(bar), |at| at < (bar.t + tf_secs) * 1000);
                let after = knocked || knocks_here;
                o = val(t_o, bar.o, knocked);
                c = val(t_c, bar.c, after);
                // not monotone in spot: extremes over the bar's high / low spots before (open) and after (close)
                let (oh, ol) = (val(t_o, bar.h, knocked), val(t_o, bar.l, knocked));
                let (ch, cl) = (val(t_c, bar.h, after), val(t_c, bar.l, after));
                h = max4(o, c, oh, ol).max(ch).max(cl);
                l = min4(o, c, oh, ol).min(ch).min(cl);
                knocked = after;
            }
        }
        out.push(Candle { t: bar.t, o: round(o), h: round(h), l: round(l), c: round(c), u: pricing::round_to(bar.c, spec.digits) });
    }
    (out, knocked)
}

/// Listing horizon of an expiry's longest cycle in days (how far ahead such an expiry is listed): daily = the
/// configured business days plus a weekend, weekly = weeks, monthly = 31-day months.
pub fn tenor_days(u: &Underlying, kinds: &[String]) -> i64 {
    kinds
        .iter()
        .filter_map(|k| match k.as_str() {
            "daily" => Some((u.daily_count.max(1) as i64 * 7 + 4) / 5 + 2),
            "weekly" => Some(u.weekly_count.max(1) as i64 * 7),
            "monthly" => Some(u.monthly_count.max(1) as i64 * 31),
            _ => None,
        })
        .max()
        .unwrap_or(LOOKBACK_DAYS)
}

/// First instant (unix s) a series' candles may cover: its listing time, or up to 30 days earlier when that history
/// is useful, but never before `cut - tenor` (the series could not have been listed earlier).
pub fn window_start(listed_s: i64, cut_s: i64, tenor_days: i64, now_s: i64) -> i64 {
    (cut_s - tenor_days * 86_400).max(listed_s.min(now_s - LOOKBACK_DAYS * 86_400))
}

/// Puts the live mid into the latest bar (`tick_s` = the tick's time): it closes the forming bar, or opens the next
/// bar when the tick is past the latest bar's end. A tick older than the latest bar is ignored (the bar is fresher).
/// Without bars, intraday timeframes (aligned on UTC) open the tick's bar.
pub fn overlay_live(bars: &mut Vec<Bar>, tf_secs: i64, mid: f64, tick_s: i64) {
    if !(mid.is_finite() && mid > 0.0) {
        return;
    }
    match bars.last_mut() {
        None if tf_secs <= 3600 => bars.push(Bar::flat(tick_s - tick_s.rem_euclid(tf_secs), mid)),
        None => {}
        Some(last) if tick_s < last.t => {}
        Some(last) if tick_s < last.t + tf_secs => {
            last.c = mid;
            last.h = last.h.max(mid);
            last.l = last.l.min(mid);
        }
        Some(last) => {
            let t = last.t + (tick_s - last.t) / tf_secs * tf_secs;
            bars.push(Bar::flat(t, mid));
        }
    }
}

/* ------------------------------------------------------------------ */
/* Caches + market-data                                                */
/* ------------------------------------------------------------------ */

/// History of one request shape, computed from cached underlying bars: every candle but the last, which is
/// recomputed on each request (live mid, decay up to `now`).
pub struct Computed {
    pub head: Vec<Candle>,
    /// The latest underlying bar as market-data sent it (before the live overlay).
    pub tail: Option<Bar>,
    /// Barrier state after `head`.
    pub knocked: bool,
}

#[derive(Default)]
pub struct Cache {
    bars: Mutex<HashMap<String, (Instant, Arc<Vec<Bar>>)>>,
    computed: Mutex<HashMap<String, (Instant, Arc<Computed>)>>,
    /// Series listing times (unix s); immutable.
    listed: Mutex<HashMap<String, i64>>,
}

fn get_fresh<T: ?Sized>(m: &Mutex<HashMap<String, (Instant, Arc<T>)>>, key: &str) -> Option<Arc<T>> {
    m.lock().unwrap().get(key).filter(|(at, _)| at.elapsed() < CACHE_TTL).map(|(_, v)| v.clone())
}

fn put<T: ?Sized>(m: &Mutex<HashMap<String, (Instant, Arc<T>)>>, key: String, v: Arc<T>) {
    let mut m = m.lock().unwrap();
    if m.len() >= 256 {
        m.retain(|_, (at, _)| at.elapsed() < CACHE_TTL);
        if m.len() >= 2048 {
            m.clear();
        }
    }
    m.insert(key, (Instant::now(), v));
}

impl Cache {
    pub fn computed(&self, key: &str) -> Option<Arc<Computed>> {
        get_fresh(&self.computed, key)
    }
    pub fn put_computed(&self, key: String, v: Arc<Computed>) {
        put(&self.computed, key, v)
    }
    pub fn listed(&self, code: &str) -> Option<i64> {
        self.listed.lock().unwrap().get(code).copied()
    }
    pub fn put_listed(&self, code: &str, t: i64) {
        let mut m = self.listed.lock().unwrap();
        if m.len() > 50_000 {
            m.clear();
        }
        m.insert(code.to_string(), t);
    }
}

/// Underlying bars from market-data (`GET /v1/candles`), ascending and de-duplicated, cached 30 s per
/// (symbol, tf, limit, to) so every series of an underlying shares one fetch.
pub async fn fetch_bars(st: &AppState, symbol: &str, tf: &str, limit: usize, to: Option<i64>) -> anyhow::Result<Arc<Vec<Bar>>> {
    let key = format!("{symbol}|{tf}|{limit}|{}", to.map(|t| t.to_string()).unwrap_or_default());
    if let Some(hit) = get_fresh(&st.candles.bars, &key) {
        return Ok(hit);
    }
    let mut url = format!("{}/v1/candles?symbol={symbol}&tf={tf}&limit={limit}", st.cfg.market_data_url);
    if let Some(t) = to {
        url.push_str(&format!("&to={t}"));
    }
    let v: Value = st.http.get(&url).timeout(Duration::from_secs(8)).send().await?.error_for_status()?.json().await?;
    let mut bars: Vec<Bar> = v["bars"].as_array().map(|a| a.iter().filter_map(Bar::from_json).collect()).unwrap_or_default();
    bars.sort_by_key(|b| b.t);
    bars.dedup_by_key(|b| b.t);
    let bars = Arc::new(bars);
    put(&st.candles.bars, key, bars.clone());
    Ok(bars)
}

#[cfg(test)]
mod tests {
    use super::*;
    use optmath::OptionType::Put;
    use optmath::{DeltaConvention, HolidayCalendar, VolClock};

    const H: i64 = 3600;
    /// Friday 9 October 2026 14:00 UTC (10:00 New York).
    const CUT_S: i64 = 1_791_554_400;

    fn model() -> Model<'static> {
        Model {
            cut_ms: CUT_S * 1000,
            cal: HolidayCalendar::default(),
            clock: VolClock::new(0.15, 0.5),
            r: 0.036,
            b: 0.016,
            rf: 0.02,
            surface: None,
            surface_version: None,
            blend_weight: 0.0,
            realized: Some(0.08),
            manual_vol: None,
            delta_convention: DeltaConvention::Spot,
        }
    }

    fn spec(kind: OptionType, strike: f64) -> Spec {
        Spec { kind, strike, contract_size: 10_000.0, fixing: None, barrier: None, usd: UsdConv::Fixed(1.0), digits: 5 }
    }

    /// The premium in USD per contract the way the candles value one point.
    fn value(m: &Model, sp: &Spec, t_s: i64, s: f64) -> f64 {
        let (tc, tv) = m.times(t_s * 1000);
        let v = if t_s * 1000 >= m.cut_ms {
            pricing::intrinsic(sp.kind, sp.fixing.unwrap_or(s), sp.strike)
        } else {
            pricing::mid_price(&m.ctx(s, "t", 1.0, tc, tv), sp.kind, sp.strike).0
        };
        pricing::round_to(v * sp.contract_size * sp.usd.at(s), USD_DECIMALS)
    }

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() <= 2e-4
    }

    #[test]
    fn timeframes_parse() {
        assert_eq!(parse_tf("60"), Some((60, "H1")));
        assert_eq!(parse_tf("h4"), Some((240, "H4")));
        assert_eq!(parse_tf("1440"), Some((1440, "D1")));
        assert_eq!(parse_tf("2"), None);
        assert_eq!(parse_tf("W1"), None);
    }

    #[test]
    fn call_ohlc_maps_open_high_low_close() {
        let m = model();
        let sp = spec(Call, 1.17);
        let t = CUT_S - 50 * H;
        let bar = Bar { t, o: 1.1700, h: 1.1740, l: 1.1650, c: 1.1720 };
        let (cs, _) = premium_candles(&m, &sp, &[bar], H, i64::MAX, false);
        let c = cs[0];
        assert!(close(c.o, value(&m, &sp, t, 1.1700)), "{c:?}");
        assert!(close(c.c, value(&m, &sp, t + H, 1.1720)), "{c:?}");
        assert!(close(c.h, value(&m, &sp, t, 1.1740)), "high of a call = f(high) at the open: {c:?}");
        assert!(close(c.l, value(&m, &sp, t + H, 1.1650)), "low of a call = f(low) at the close: {c:?}");
        assert!(c.h > c.c && c.c > c.o && c.o > c.l, "{c:?}");
        assert_eq!(c.u, 1.172);
    }

    #[test]
    fn put_ohlc_maps_high_to_the_underlying_low() {
        let m = model();
        let sp = spec(Put, 1.17);
        let t = CUT_S - 50 * H;
        let bar = Bar { t, o: 1.1700, h: 1.1740, l: 1.1650, c: 1.1720 };
        let (cs, _) = premium_candles(&m, &sp, &[bar], H, i64::MAX, false);
        let c = cs[0];
        assert!(close(c.o, value(&m, &sp, t, 1.1700)));
        assert!(close(c.c, value(&m, &sp, t + H, 1.1720)));
        assert!(close(c.h, value(&m, &sp, t, 1.1650)), "high of a put = f(low): {c:?}");
        assert!(close(c.l, value(&m, &sp, t + H, 1.1740)), "low of a put = f(high): {c:?}");
        // the underlying closed up: the put closed below its open
        assert!(c.h > c.o && c.o > c.c && c.c > c.l, "{c:?}");
    }

    #[test]
    fn flat_underlying_call_melts_bar_over_bar_to_intrinsic() {
        let m = model();
        let sp = spec(Call, 1.165);
        // hourly bars over the last two days, the last one closing on the cut
        let bars: Vec<Bar> = (1..=48).rev().map(|i| Bar::flat(CUT_S - i * H, 1.17)).collect();
        let (cs, _) = premium_candles(&m, &sp, &bars, H, i64::MAX, false);
        let intrinsic = (1.17 - 1.165) * 10_000.0;
        for w in cs.windows(2) {
            assert!(w[1].c < w[0].c, "decays bar over bar: {:?} -> {:?}", w[0], w[1]);
            assert!(w[0].c > intrinsic);
        }
        for c in &cs {
            assert!(c.o >= c.c && c.h == c.o && c.l == c.c, "a melting candle: {c:?}");
        }
        // the bar ending on the cut closes on intrinsic
        assert!(close(cs.last().unwrap().c, intrinsic), "{:?}", cs.last());
        // an hour before the cut little time value is left
        assert!(cs[cs.len() - 2].c - intrinsic < 0.25 * (cs[0].c - intrinsic));
    }

    #[test]
    fn at_expiry_value_is_intrinsic_at_the_fixing() {
        let m = model();
        let mut sp = spec(Put, 1.18);
        sp.fixing = Some(1.1712);
        let bar = Bar { t: CUT_S - 1800, o: 1.17, h: 1.171, l: 1.169, c: 1.1705 };
        let (cs, _) = premium_candles(&m, &sp, &[bar], H, i64::MAX, false);
        assert!(close(cs[0].c, (1.18 - 1.1712) * 10_000.0), "{:?}", cs[0]);
        // without a fixing: intrinsic at the close
        sp.fixing = None;
        let (cs, _) = premium_candles(&m, &sp, &[bar], H, i64::MAX, false);
        assert!(close(cs[0].c, (1.18 - 1.1705) * 10_000.0), "{:?}", cs[0]);
    }

    #[test]
    fn forming_bar_closes_at_now() {
        let m = model();
        let sp = spec(Call, 1.17);
        let t = CUT_S - 30 * H;
        let now = t + 600;
        let (cs, _) = premium_candles(&m, &sp, &[Bar::flat(t, 1.17)], H, now * 1000, false);
        assert!(close(cs[0].c, value(&m, &sp, now, 1.17)));
        // vol time accumulated backwards equals the direct vol clock
        let mut inst = vec![(CUT_S - 100 * H) * 1000, (CUT_S - 60 * H) * 1000, (CUT_S - 2 * H) * 1000];
        let tt = time_table(&m, &mut inst);
        for t in inst {
            assert!((tt[&t].1 - m.times(t).1).abs() < 1e-15);
        }
    }

    #[test]
    fn usdxxx_converts_each_point_at_its_own_spot() {
        let m = model();
        let mut sp = spec(Call, 147.0);
        sp.usd = UsdConv::InverseSpot;
        let t = CUT_S - 50 * H;
        let (cs, _) = premium_candles(&m, &sp, &[Bar { t, o: 147.0, h: 148.0, l: 146.0, c: 147.5 }], H, i64::MAX, false);
        let c = cs[0];
        assert!(close(c.c, value(&m, &sp, t + H, 147.5)));
        assert!(c.h >= c.c && c.c >= c.o && c.o >= c.l, "still monotone in USD: {c:?}");
    }

    #[test]
    fn knock_out_pays_the_rebate_after_the_touching_bar() {
        let m = model();
        let mut sp = spec(Call, 1.17);
        sp.barrier = Some(Barrier { kind: BarrierType::UpOut, level: 1.18, rebate: 0.0005, knocked_at_ms: None });
        let t0 = CUT_S - 60 * H;
        let bars = [Bar::flat(t0, 1.172), Bar { t: t0 + H, o: 1.172, h: 1.1805, l: 1.171, c: 1.176 }, Bar::flat(t0 + 2 * H, 1.174), Bar::flat(t0 + 3 * H, 1.16)];
        let (cs, knocked) = premium_candles(&m, &sp, &bars, H, i64::MAX, false);
        assert!(knocked);
        let rebate = 0.0005 * 10_000.0;
        assert!(cs[0].c > rebate && cs[0].c < value(&m, &spec(Call, 1.17), t0 + H, 1.172), "alive KO < vanilla: {:?}", cs[0]);
        assert!(close(cs[1].c, rebate), "knocked in the touching bar: {:?}", cs[1]);
        for c in &cs[2..] {
            assert!(close(c.o, rebate) && close(c.h, rebate) && close(c.l, rebate) && close(c.c, rebate), "{c:?}");
        }
        // the engine's knock time wins over the bar ranges
        sp.barrier = Some(Barrier { kind: BarrierType::UpOut, level: 1.18, rebate: 0.0005, knocked_at_ms: Some((t0 + 2 * H + 60) * 1000) });
        let (cs, _) = premium_candles(&m, &sp, &bars, H, i64::MAX, false);
        assert!(cs[1].c > rebate && close(cs[2].c, rebate) && close(cs[3].c, rebate), "{cs:?}");
    }

    #[test]
    fn knock_in_becomes_the_vanilla() {
        let m = model();
        let mut sp = spec(Put, 1.17);
        sp.barrier = Some(Barrier { kind: BarrierType::DownIn, level: 1.16, rebate: 0.0, knocked_at_ms: None });
        let t0 = CUT_S - 60 * H;
        let bars = [Bar::flat(t0, 1.17), Bar { t: t0 + H, o: 1.17, h: 1.17, l: 1.159, c: 1.165 }, Bar::flat(t0 + 2 * H, 1.172)];
        let (cs, _) = premium_candles(&m, &sp, &bars, H, i64::MAX, false);
        let vanilla = spec(Put, 1.17);
        assert!(cs[0].c < value(&m, &vanilla, t0 + H, 1.17));
        assert!(close(cs[2].c, value(&m, &vanilla, t0 + 3 * H, 1.172)), "{:?}", cs[2]);
    }

    #[test]
    fn window_and_live_overlay() {
        let day = 86_400;
        let now = CUT_S - 3 * day;
        // weekly listed today: history back to cut - 28 days
        assert_eq!(window_start(now, CUT_S, 28, now), CUT_S - 28 * day);
        // monthly listed 40 days ago: from the listing
        assert_eq!(window_start(now - 40 * day, CUT_S, 93, now), now - 40 * day);
        // listed long ago: never before cut - tenor
        assert_eq!(window_start(now - 100 * day, CUT_S, 9, now), CUT_S - 9 * day);

        let mut bars = vec![Bar::flat(7200, 1.0)];
        overlay_live(&mut bars, H, 1.01, 7200 + 100);
        assert_eq!(bars, vec![Bar { t: 7200, o: 1.0, h: 1.01, l: 1.0, c: 1.01 }]);
        overlay_live(&mut bars, H, 0.99, 7200 + 2 * H + 5);
        assert_eq!(bars.len(), 2);
        assert_eq!(bars[1], Bar::flat(7200 + 2 * H, 0.99));
        overlay_live(&mut bars, H, 2.0, 100);
        assert_eq!(bars.len(), 2, "an old tick is ignored");
        let mut empty = vec![];
        overlay_live(&mut empty, 300, 1.2, 1000);
        assert_eq!(empty, vec![Bar::flat(900, 1.2)]);
        let mut empty = vec![];
        overlay_live(&mut empty, 1440 * 60, 1.2, 1000);
        assert!(empty.is_empty(), "D1 bars are aligned on New York close: wait for market-data");
    }
}
