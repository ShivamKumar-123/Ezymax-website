//! Contract specs and sessions for the backtester and the runtime, read from the same files as the trading
//! engine (`config/instruments.json` + `config/trading-specs.json`) with the same server-time rules
//! (GMT+3 during US DST, GMT+2 otherwise). Floats are fine here: the backtester is a simulation and the
//! runtime only uses specs to size and round orders that the engine then validates with its own decimals.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc, Weekday};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Session {
    Fx,
    Always,
    UsEquity,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spec {
    pub symbol: String,
    pub asset_class: String,
    pub digits: u32,
    pub point: f64,
    pub pip_size: f64,
    pub contract_size: f64,
    pub quote_ccy: String,
    pub base_ccy: Option<String>,
    pub lot_min: f64,
    pub lot_max: f64,
    pub lot_step: f64,
    pub swap_long: f64,
    pub swap_short: f64,
    #[serde(skip)]
    pub triple_swap_day: Option<Weekday>,
    pub swap_all_days: bool,
    pub session: Session,
    pub commission_per_lot: Option<f64>,
    /// Raw spread from the instrument catalogue (price units), used when no live quote is available.
    pub base_spread: f64,
}

impl Spec {
    pub fn round_price(&self, p: f64) -> f64 {
        let m = 10f64.powi(self.digits as i32);
        (p * m).round() / m
    }

    /// Floors a volume to the lot step, `None` when it ends up below the minimum.
    pub fn floor_volume(&self, v: f64) -> Option<f64> {
        let steps = (v / self.lot_step + 1e-9).floor();
        let out = (steps * self.lot_step * 1e8).round() / 1e8;
        if out + 1e-12 < self.lot_min { None } else { Some(out.min(self.lot_max)) }
    }

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

    /// Swap multiplier for the server day that just ended (0 = none, 3 = triple).
    pub fn swap_multiplier(&self, day: NaiveDate) -> f64 {
        let wd = day.weekday();
        if !self.swap_all_days && matches!(wd, Weekday::Sat | Weekday::Sun) {
            return 0.0;
        }
        if self.triple_swap_day == Some(wd) { 3.0 } else { 1.0 }
    }
}

#[derive(Deserialize, Clone, Default)]
struct RawSpec {
    contract_size: Option<f64>,
    lot_min: Option<f64>,
    lot_max: Option<f64>,
    lot_step: Option<f64>,
    swap_long: Option<f64>,
    swap_short: Option<f64>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    triple_swap_day: Option<Option<String>>,
    swap_days: Option<String>,
    session: Option<String>,
    commission_per_lot: Option<f64>,
    quote_ccy: Option<String>,
    base_ccy: Option<String>,
    pip_size: Option<f64>,
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
    base_spread: f64,
    #[serde(default)]
    session: Option<String>,
}

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

    /// The repo's own config files (tests, and the default paths).
    pub fn repo() -> Self {
        Self::parse(include_str!("../../../config/instruments.json"), include_str!("../../../config/trading-specs.json")).expect("repo config parses")
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
            let point = 10f64.powi(-(i.digits as i32));
            let triple = match sym.triple_swap_day.clone().or(class.triple_swap_day.clone()) {
                Some(Some(d)) => Some(Weekday::from_str(&d).map_err(|_| anyhow::anyhow!("{}: bad triple_swap_day {d}", i.symbol))?),
                _ => None,
            };
            let session = match (i.session.as_deref(), pick!(session, String::new()).as_str()) {
                (Some("us_equity"), _) | (_, "us_equity") => Session::UsEquity,
                (_, "24x7") => Session::Always,
                (_, "fx") => Session::Fx,
                _ if i.asset_class == "crypto" => Session::Always,
                _ => Session::Fx,
            };
            let pip = pick!(pip_size, 0.0);
            let spec = Spec {
                symbol: i.symbol.clone(),
                asset_class: i.asset_class.clone(),
                digits: i.digits,
                point,
                pip_size: if pip > 0.0 { pip } else { point },
                contract_size: pick!(contract_size, 1.0),
                quote_ccy: pick!(quote_ccy, "USD".to_string()),
                base_ccy: sym.base_ccy.clone(),
                lot_min: pick!(lot_min, 0.01),
                lot_max: pick!(lot_max, 100.0),
                lot_step: pick!(lot_step, 0.01),
                swap_long: pick!(swap_long, 0.0),
                swap_short: pick!(swap_short, 0.0),
                triple_swap_day: triple,
                swap_all_days: pick!(swap_days, "mon-fri".to_string()) == "all",
                session,
                commission_per_lot: sym.commission_per_lot.or(class.commission_per_lot),
                base_spread: i.base_spread,
            };
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

    /// The symbol converting `ccy` to USD and whether its price multiplies (`EURUSD`) or divides (`USDJPY`).
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

/* ------------------------------------------------------------------ */
/* Server time                                                         */
/* ------------------------------------------------------------------ */

fn midnight(d: NaiveDate) -> DateTime<Utc> {
    Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
}

fn nth_weekday(year: i32, month: u32, weekday: Weekday, n: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let shift = (7 + weekday.num_days_from_sunday() as i64 - first.weekday().num_days_from_sunday() as i64) % 7;
    first + Duration::days(shift + 7 * (n as i64 - 1))
}

/// +3h during US DST, +2h otherwise.
pub fn server_offset_secs(ts: DateTime<Utc>) -> i64 {
    let y = ts.year();
    let start = midnight(nth_weekday(y, 3, Weekday::Sun, 2)) + Duration::hours(7);
    let end = midnight(nth_weekday(y, 11, Weekday::Sun, 1)) + Duration::hours(6);
    if ts >= start && ts < end { 3 * 3600 } else { 2 * 3600 }
}

pub fn server_time(ts: DateTime<Utc>) -> DateTime<Utc> {
    ts + Duration::seconds(server_offset_secs(ts))
}

pub fn server_date(ts: DateTime<Utc>) -> NaiveDate {
    server_time(ts).date_naive()
}

pub fn ts(secs: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(secs, 0).unwrap_or_default()
}

/// Timeframes (market-data names) and their length in seconds (MN approximated as 30 days).
pub const TIMEFRAMES: [&str; 9] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

pub fn tf_secs(tf: &str) -> Option<i64> {
    Some(match tf {
        "M1" => 60,
        "M5" => 300,
        "M15" => 900,
        "M30" => 1800,
        "H1" => 3600,
        "H4" => 14400,
        "D1" => 86400,
        "W1" => 604800,
        "MN" => 2_592_000,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repo_specs_load() {
        let s = Specs::repo();
        let e = s.get("EURUSD").unwrap();
        assert_eq!(e.digits, 5);
        assert_eq!(e.contract_size, 100000.0);
        assert_eq!(e.swap_long, -7.2);
        assert_eq!(e.triple_swap_day, Some(Weekday::Wed));
        let b = s.get("BTCUSD").unwrap();
        assert_eq!(b.session, Session::Always);
        assert!(b.swap_all_days);
        assert_eq!(e.floor_volume(0.129), Some(0.12));
        assert_eq!(e.floor_volume(0.004), None);
        assert_eq!(s.usd_pair("JPY"), Some(("USDJPY".into(), false)));
    }

    #[test]
    fn dst_offsets() {
        let summer = DateTime::parse_from_rfc3339("2026-07-01T12:00:00Z").unwrap().with_timezone(&Utc);
        let winter = DateTime::parse_from_rfc3339("2026-12-01T12:00:00Z").unwrap().with_timezone(&Utc);
        assert_eq!(server_offset_secs(summer), 3 * 3600);
        assert_eq!(server_offset_secs(winter), 2 * 3600);
    }
}
