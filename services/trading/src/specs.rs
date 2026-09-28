//! Instrument contract specifications and trading sessions.
//!
//! Built from two files: `config/instruments.json` (the market-data catalogue: symbol, asset class, digits,
//! session filter) and `config/trading-specs.json` (contract size, lots, margin, swaps, sessions). Session
//! and server-time rules are the same as market-data's `instruments.rs` / `timeframes.rs`: server time is
//! GMT+3 while US DST is active and GMT+2 otherwise (New York close = 00:00 server time).

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc, Weekday};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;

use crate::money::{D, HUNDRED, ZERO, from_f64, rdp};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Session {
    /// FX, metals, indices, energies: closed Saturday and Sunday server time.
    Fx,
    /// Crypto: 24/7.
    Always,
    /// US stocks: 09:30–16:00 New York, Monday–Friday.
    UsEquity,
}

#[derive(Clone, Debug)]
pub struct Spec {
    pub symbol: String,
    pub asset_class: String,
    pub digits: u32,
    pub point: D,
    pub pip_size: D,
    pub contract_size: D,
    /// Profit currency (P&L is computed in it, then converted to USD).
    pub quote_ccy: String,
    pub lot_min: D,
    pub lot_max: D,
    pub lot_step: D,
    /// 100 = margin is notional / leverage.
    pub margin_pct: D,
    /// Cap on the account leverage for this symbol.
    pub max_leverage: u32,
    /// Points per lot per night (negative = the client pays).
    pub swap_long: D,
    pub swap_short: D,
    pub triple_swap_day: Option<Weekday>,
    /// Swaps are charged every night (crypto) instead of Monday–Friday nights only.
    pub swap_all_days: bool,
    pub session: Session,
    pub stops_level_points: i64,
    /// Round-turn commission per lot overriding the group value.
    pub commission_per_lot: Option<D>,
}

impl Spec {
    pub fn round_price(&self, p: D) -> D {
        rdp(p, self.digits)
    }

    /// Validates a lot size against min / max / step.
    pub fn volume_error(&self, v: D) -> Option<String> {
        if v <= ZERO {
            return Some("Enter a volume above 0".into());
        }
        if v < self.lot_min {
            return Some(format!("Minimum volume for {} is {} lots", self.symbol, self.lot_min.normalize()));
        }
        if v > self.lot_max {
            return Some(format!("Maximum volume for {} is {} lots", self.symbol, self.lot_max.normalize()));
        }
        if !(v % self.lot_step).is_zero() {
            return Some(format!("Volume step for {} is {} lots", self.symbol, self.lot_step.normalize()));
        }
        None
    }

    /// Is the market open for trading at `ts` (same rules as market-data's session filter).
    pub fn is_open(&self, ts: DateTime<Utc>) -> bool {
        match self.session {
            Session::Always => true,
            Session::Fx => {
                let server = ts + Duration::seconds(server_offset_secs(ts));
                !matches!(server.weekday(), Weekday::Sat | Weekday::Sun)
            }
            Session::UsEquity => {
                let ny = ts + Duration::seconds(server_offset_secs(ts)) - Duration::hours(7);
                let mins = ny.hour() * 60 + ny.minute();
                !matches!(ny.weekday(), Weekday::Sat | Weekday::Sun) && (570..960).contains(&mins)
            }
        }
    }

    /// Nights on which a swap is charged: the server day that just ended (`day`).
    /// Returns the multiplier (0 = no swap that night, 3 = triple).
    pub fn swap_multiplier(&self, day: NaiveDate) -> i64 {
        let wd = day.weekday();
        if !self.swap_all_days && matches!(wd, Weekday::Sat | Weekday::Sun) {
            return 0;
        }
        if self.triple_swap_day == Some(wd) { 3 } else { 1 }
    }
}

#[derive(Deserialize, Clone, Default)]
struct RawSpec {
    contract_size: Option<f64>,
    lot_min: Option<f64>,
    lot_max: Option<f64>,
    lot_step: Option<f64>,
    margin_pct: Option<f64>,
    max_leverage: Option<u32>,
    swap_long: Option<f64>,
    swap_short: Option<f64>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    triple_swap_day: Option<Option<String>>,
    swap_days: Option<String>,
    session: Option<String>,
    stops_level_points: Option<i64>,
    commission_per_lot: Option<f64>,
    quote_ccy: Option<String>,
    pip_size: Option<f64>,
    #[allow(dead_code)]
    base_ccy: Option<String>,
}

fn de_opt_opt<'de, De: serde::Deserializer<'de>>(d: De) -> Result<Option<Option<String>>, De::Error> {
    Ok(Some(Option::<String>::deserialize(d)?))
}

#[derive(Deserialize)]
struct RawFile {
    classes: HashMap<String, RawSpec>,
    symbols: HashMap<String, RawSpec>,
}

#[derive(Deserialize)]
struct RawInstrument {
    symbol: String,
    asset_class: String,
    digits: u32,
    #[serde(default)]
    session: Option<String>,
}

fn weekday(s: &str) -> Option<Weekday> {
    Weekday::from_str(s).ok()
}

/// All tradable symbols (ordered by name).
#[derive(Clone, Debug, Default)]
pub struct Specs {
    map: BTreeMap<String, Spec>,
}

impl Specs {
    pub fn load(instruments_file: &str, specs_file: &str) -> anyhow::Result<Self> {
        let inst = std::fs::read_to_string(instruments_file).map_err(|e| anyhow::anyhow!("reading {instruments_file}: {e}"))?;
        let specs = std::fs::read_to_string(specs_file).map_err(|e| anyhow::anyhow!("reading {specs_file}: {e}"))?;
        Self::parse(&inst, &specs)
    }

    pub fn parse(instruments_json: &str, specs_json: &str) -> anyhow::Result<Self> {
        let list: Vec<RawInstrument> = serde_json::from_str(instruments_json)?;
        let file: RawFile = serde_json::from_str(specs_json)?;
        let mut map = BTreeMap::new();
        for i in list {
            let class = file.classes.get(&i.asset_class).cloned().unwrap_or_default();
            let sym = file.symbols.get(&i.symbol).cloned().unwrap_or_default();
            macro_rules! pick {
                ($f:ident, $d:expr) => {
                    sym.$f.clone().or(class.$f.clone()).unwrap_or($d)
                };
            }
            let dec = |f: f64, what: &str| from_f64(f).ok_or_else(|| anyhow::anyhow!("{}: invalid {what}", i.symbol));
            let point = D::new(1, i.digits);
            let triple = match sym.triple_swap_day.clone().or(class.triple_swap_day.clone()) {
                Some(Some(d)) => Some(weekday(&d).ok_or_else(|| anyhow::anyhow!("{}: bad triple_swap_day {d}", i.symbol))?),
                _ => None,
            };
            let session = match (i.session.as_deref(), pick!(session, String::new()).as_str()) {
                (Some("us_equity"), _) | (_, "us_equity") => Session::UsEquity,
                (_, "24x7") => Session::Always,
                (_, "fx") => Session::Fx,
                _ if i.asset_class == "crypto" => Session::Always,
                _ => Session::Fx,
            };
            let spec = Spec {
                symbol: i.symbol.clone(),
                asset_class: i.asset_class.clone(),
                digits: i.digits,
                point,
                pip_size: dec(pick!(pip_size, 0.0), "pip_size").map(|p| if p.is_zero() { point } else { p })?,
                contract_size: dec(pick!(contract_size, 1.0), "contract_size")?,
                quote_ccy: pick!(quote_ccy, "USD".to_string()),
                lot_min: dec(pick!(lot_min, 0.01), "lot_min")?,
                lot_max: dec(pick!(lot_max, 100.0), "lot_max")?,
                lot_step: dec(pick!(lot_step, 0.01), "lot_step")?,
                margin_pct: dec(pick!(margin_pct, 100.0), "margin_pct")?,
                max_leverage: pick!(max_leverage, 1000),
                swap_long: dec(pick!(swap_long, 0.0), "swap_long")?,
                swap_short: dec(pick!(swap_short, 0.0), "swap_short")?,
                triple_swap_day: triple,
                swap_all_days: pick!(swap_days, "mon-fri".to_string()) == "all",
                session,
                stops_level_points: pick!(stops_level_points, 0),
                commission_per_lot: sym.commission_per_lot.or(class.commission_per_lot).map(|c| dec(c, "commission_per_lot")).transpose()?,
            };
            if spec.lot_step <= ZERO || spec.lot_min <= ZERO || spec.contract_size <= ZERO || spec.margin_pct <= ZERO {
                anyhow::bail!("{}: lot_step, lot_min, contract_size and margin_pct must be > 0", spec.symbol);
            }
            map.insert(i.symbol, spec);
        }
        Ok(Self { map })
    }

    pub fn get(&self, symbol: &str) -> Option<&Spec> {
        self.map.get(symbol)
    }

    pub fn all(&self) -> impl Iterator<Item = &Spec> {
        self.map.values()
    }

    pub fn symbols(&self) -> Vec<String> {
        self.map.keys().cloned().collect()
    }

    /// The symbol that converts `ccy` to USD and whether its price multiplies (`EURUSD`) or divides (`USDJPY`).
    pub fn usd_pair(&self, ccy: &str) -> Option<(String, bool)> {
        let direct = format!("{ccy}USD");
        if self.map.contains_key(&direct) {
            return Some((direct, true));
        }
        let inverse = format!("USD{ccy}");
        if self.map.contains_key(&inverse) {
            return Some((inverse, false));
        }
        None
    }
}

pub fn pct(v: D) -> D {
    v / HUNDRED
}

/* ------------------------------------------------------------------ */
/* Server time (NY close)                                              */
/* ------------------------------------------------------------------ */

fn midnight(d: NaiveDate) -> DateTime<Utc> {
    Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
}

fn nth_weekday(year: i32, month: u32, weekday: Weekday, n: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let shift = (7 + weekday.num_days_from_sunday() as i64 - first.weekday().num_days_from_sunday() as i64) % 7;
    first + Duration::days(shift + 7 * (n as i64 - 1))
}

/// Server-time offset (seconds east of UTC): +3h during US DST, +2h otherwise (same as market-data).
/// US DST: second Sunday of March 07:00 UTC → first Sunday of November 06:00 UTC.
pub fn server_offset_secs(ts: DateTime<Utc>) -> i64 {
    let y = ts.year();
    let start = midnight(nth_weekday(y, 3, Weekday::Sun, 2)) + Duration::hours(7);
    let end = midnight(nth_weekday(y, 11, Weekday::Sun, 1)) + Duration::hours(6);
    if ts >= start && ts < end { 3 * 3600 } else { 2 * 3600 }
}

/// Server-time calendar date of `ts`.
pub fn server_date(ts: DateTime<Utc>) -> NaiveDate {
    (ts + Duration::seconds(server_offset_secs(ts))).date_naive()
}

/// The UTC instant of 00:00 server time on `day` (the rollover that ends `day - 1`).
pub fn server_midnight(day: NaiveDate) -> DateTime<Utc> {
    let local = midnight(day);
    // offset at the rollover instant; DST switches happen on Sunday mornings, never at midnight,
    // so one correction step is exact
    let guess = local - Duration::seconds(server_offset_secs(local - Duration::hours(2)));
    local - Duration::seconds(server_offset_secs(guess))
}

/// The first rollover strictly after `ts`, with the server day it closes.
pub fn next_rollover(ts: DateTime<Utc>) -> (DateTime<Utc>, NaiveDate) {
    let today = server_date(ts);
    let tomorrow = today.succ_opt().unwrap();
    (server_midnight(tomorrow), today)
}

/// End of the current server day (expiry of "Today" orders).
pub fn end_of_server_day(ts: DateTime<Utc>) -> DateTime<Utc> {
    next_rollover(ts).0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    pub fn test_specs() -> Specs {
        let inst = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")).unwrap();
        let specs = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/trading-specs.json")).unwrap();
        Specs::parse(&inst, &specs).unwrap()
    }

    #[test]
    fn loads_repo_specs() {
        let s = test_specs();
        let eu = s.get("EURUSD").unwrap();
        assert_eq!(eu.contract_size, D::from(100000));
        assert_eq!(eu.triple_swap_day, Some(Weekday::Wed));
        assert_eq!(eu.session, Session::Fx);
        let btc = s.get("BTCUSD").unwrap();
        assert_eq!(btc.session, Session::Always);
        assert!(btc.swap_all_days);
        assert_eq!(s.get("AAPL").unwrap().session, Session::UsEquity);
        assert_eq!(s.get("XAGUSD").unwrap().contract_size, D::from(5000));
        assert_eq!(s.usd_pair("JPY"), Some(("USDJPY".into(), false)));
        assert_eq!(s.usd_pair("EUR"), Some(("EURUSD".into(), true)));
    }

    #[test]
    fn volume_steps() {
        let s = test_specs();
        let eu = s.get("EURUSD").unwrap();
        assert!(eu.volume_error(D::from_str("0.01").unwrap()).is_none());
        assert!(eu.volume_error(D::from_str("0.015").unwrap()).is_some());
        assert!(eu.volume_error(D::from_str("0.001").unwrap()).is_some());
        assert!(eu.volume_error(D::from(101)).is_some());
        let idx = s.get("US30").unwrap();
        assert!(idx.volume_error(D::from_str("0.1").unwrap()).is_none());
        assert!(idx.volume_error(D::from_str("0.15").unwrap()).is_some());
    }

    #[test]
    fn sessions_match_market_data() {
        let s = test_specs();
        let fx = s.get("EURUSD").unwrap();
        assert!(fx.is_open(t("2026-09-25T20:59:59Z")));
        assert!(!fx.is_open(t("2026-09-25T21:00:00Z")));
        assert!(!fx.is_open(t("2026-09-27T20:59:00Z")));
        assert!(fx.is_open(t("2026-09-27T21:00:00Z")));
        assert!(!fx.is_open(t("2026-01-11T21:30:00Z")));
        assert!(fx.is_open(t("2026-01-11T22:00:00Z")));
        assert!(s.get("BTCUSD").unwrap().is_open(t("2026-09-26T09:00:00Z")));
        let aapl = s.get("AAPL").unwrap();
        assert!(!aapl.is_open(t("2026-09-24T13:29:59Z")));
        assert!(aapl.is_open(t("2026-09-24T13:30:00Z")));
        assert!(!aapl.is_open(t("2026-09-24T20:00:00Z")));
        assert!(!aapl.is_open(t("2026-09-26T15:00:00Z")));
    }

    #[test]
    fn rollover_instants_follow_dst() {
        // September: GMT+3 → 00:00 server = 21:00 UTC
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 9, 25).unwrap()), t("2026-09-24T21:00:00Z"));
        // January: GMT+2 → 22:00 UTC
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 1, 15).unwrap()), t("2026-01-14T22:00:00Z"));
        // DST starts Sunday 2026-03-08 07:00 UTC. Sunday 00:00 server is still GMT+2, Monday 00:00 is GMT+3.
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 3, 8).unwrap()), t("2026-03-07T22:00:00Z"));
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 3, 9).unwrap()), t("2026-03-08T21:00:00Z"));
        // DST ends Sunday 2026-11-01 06:00 UTC.
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 11, 1).unwrap()), t("2026-10-31T21:00:00Z"));
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 11, 2).unwrap()), t("2026-11-01T22:00:00Z"));
        // next rollover after Sunday evening 2026-03-08 20:00 UTC (server Sunday 23:00) is 21:00 UTC
        let (at, day) = next_rollover(t("2026-03-08T20:00:00Z"));
        assert_eq!(at, t("2026-03-08T21:00:00Z"));
        assert_eq!(day, NaiveDate::from_ymd_opt(2026, 3, 8).unwrap());
        // server date flips exactly at the rollover
        assert_eq!(server_date(t("2026-09-24T20:59:59Z")), NaiveDate::from_ymd_opt(2026, 9, 24).unwrap());
        assert_eq!(server_date(t("2026-09-24T21:00:00Z")), NaiveDate::from_ymd_opt(2026, 9, 25).unwrap());
    }

    #[test]
    fn swap_nights() {
        let s = test_specs();
        let fx = s.get("EURUSD").unwrap();
        let d = |y, m, dd| NaiveDate::from_ymd_opt(y, m, dd).unwrap();
        assert_eq!(fx.swap_multiplier(d(2026, 9, 21)), 1); // Monday night
        assert_eq!(fx.swap_multiplier(d(2026, 9, 23)), 3); // Wednesday night: triple
        assert_eq!(fx.swap_multiplier(d(2026, 9, 26)), 0); // Saturday: closed
        let btc = s.get("BTCUSD").unwrap();
        assert_eq!(btc.swap_multiplier(d(2026, 9, 26)), 1);
        assert_eq!(btc.swap_multiplier(d(2026, 9, 23)), 1);
        let idx = s.get("US30").unwrap();
        assert_eq!(idx.swap_multiplier(d(2026, 9, 25)), 3); // Friday triple for indices
    }
}

#[cfg(test)]
pub use tests::test_specs;
