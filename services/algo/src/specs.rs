//! Contract specs and sessions for the backtester and the runtime, read from the same files as the trading
//! engine (`config/instruments.json` + `config/trading-specs.json`) with the same server-time rules
//! (GMT+3 during US DST, GMT+2 otherwise). Floats are fine here: the backtester is a simulation and the
//! runtime only uses specs to size and round orders that the engine then validates with its own decimals.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc, Weekday};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;

pub use markethours::{Holidays, Session};
use std::sync::Arc;

/// Session as the API shows it: `fx`, `always`, or the exchange key (`us_equity`, `hk_equity`, ...).
pub fn session_key(s: &Session) -> &'static str {
    match s {
        Session::Always => "always",
        other => other.key(),
    }
}

fn ser_session<S: serde::Serializer>(s: &Session, ser: S) -> Result<S::Ok, S::Error> {
    ser.serialize_str(session_key(s))
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
    /// Swaps in points per lot (false) or as a yearly percentage of the position value (true).
    #[serde(skip)]
    pub swap_percent: bool,
    #[serde(serialize_with = "ser_session")]
    pub session: Session,
    /// Holiday calendar of a catalogue instrument (None for the core instruments).
    #[serde(skip)]
    pub holidays: Option<Arc<Holidays>>,
    pub commission_per_lot: Option<f64>,
    /// Raw spread from the instrument catalogue (price units), used when no live quote is available.
    pub base_spread: f64,
    /// One of the hand-maintained core instruments (not from the provider catalogue).
    pub core: bool,
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
        self.session.is_open(ts, self.holidays.as_deref())
    }

    /// Swap of `volume` lots for one night at `price`, in the profit currency (same rule as the engine: points, or
    /// a yearly % of the value / 360, / 365 when charged every night).
    pub fn swap_per_night(&self, buy: bool, volume: f64, price: f64) -> f64 {
        let rate = if buy { self.swap_long } else { self.swap_short };
        if self.swap_percent {
            rate / 100.0 / if self.swap_all_days { 365.0 } else { 360.0 } * self.contract_size * volume * price
        } else {
            rate * self.point * self.contract_size * volume
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
    swap_mode: Option<String>,
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
    /// Templates of the provider catalogue instruments (the trading engine applies Back Office overrides on top;
    /// the engine validates every order, so the file values are what ALGO sizes with).
    #[serde(default)]
    templates: HashMap<String, RawSpec>,
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
    #[serde(default)]
    tier: Option<String>,
    #[serde(default)]
    template: Option<String>,
    #[serde(default)]
    calendar: Option<String>,
    #[serde(default)]
    base_ccy: Option<String>,
    #[serde(default)]
    quote_ccy: Option<String>,
    #[serde(default)]
    pip_size: Option<f64>,
    #[serde(default)]
    contract_size: Option<f64>,
}

#[derive(Clone, Debug, Default)]
pub struct Specs {
    map: BTreeMap<String, Spec>,
}

/// The repo's holiday calendars (config/holidays).
const REPO_HOLIDAYS: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/holidays");

impl Specs {
    /// Holiday calendars come from the `holidays` directory next to the specs file.
    pub fn load(instruments_file: &str, specs_file: &str) -> anyhow::Result<Self> {
        let inst = std::fs::read_to_string(instruments_file).map_err(|e| anyhow::anyhow!("reading {instruments_file}: {e}"))?;
        let specs = std::fs::read_to_string(specs_file).map_err(|e| anyhow::anyhow!("reading {specs_file}: {e}"))?;
        let dir = std::path::Path::new(specs_file).parent().map(|p| p.join("holidays")).unwrap_or_else(|| "holidays".into());
        Self::parse_with(&inst, &specs, &dir.to_string_lossy())
    }

    /// The repo's own config files (tests, and the default paths).
    pub fn repo() -> Self {
        Self::parse(include_str!("../../../config/instruments.json"), include_str!("../../../config/trading-specs.json")).expect("repo config parses")
    }

    pub fn parse(instruments_json: &str, specs_json: &str) -> anyhow::Result<Self> {
        Self::parse_with(instruments_json, specs_json, REPO_HOLIDAYS)
    }

    pub fn parse_with(instruments_json: &str, specs_json: &str, holidays_dir: &str) -> anyhow::Result<Self> {
        let list: Vec<RawInstrument> = serde_json::from_str(instruments_json)?;
        let file: RawFile = serde_json::from_str(specs_json)?;
        let calendars: HashMap<String, Arc<Holidays>> = Holidays::load_dir(holidays_dir).map_err(|e| anyhow::anyhow!("holiday calendars: {e}"))?.into_iter().map(|(k, v)| (k, Arc::new(v))).collect();
        let mut map = BTreeMap::new();
        for i in list {
            let core = i.tier.as_deref() != Some("catalogue");
            // core: symbol over class (unchanged); catalogue: symbol over the row's own fields over its template
            let class = if core {
                file.classes.get(&i.asset_class).cloned().unwrap_or_default()
            } else {
                let key = i.template.clone().unwrap_or_else(|| i.asset_class.clone());
                file.templates.get(&key).cloned().ok_or_else(|| anyhow::anyhow!("{}: no template {key} in trading-specs.json", i.symbol))?
            };
            let mut sym = file.symbols.get(&i.symbol).cloned().unwrap_or_default();
            if !core {
                sym.quote_ccy = sym.quote_ccy.or(i.quote_ccy.clone());
                sym.base_ccy = sym.base_ccy.or(i.base_ccy.clone());
                sym.pip_size = sym.pip_size.or(i.pip_size);
                sym.contract_size = sym.contract_size.or(i.contract_size);
            }
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
            let (session, holidays) = if core {
                let s = match (i.session.as_deref(), pick!(session, String::new()).as_str()) {
                    (Some("us_equity"), _) | (_, "us_equity") => Session::parse("us_equity").unwrap(),
                    (_, "24x7") => Session::Always,
                    (_, "fx") => Session::Fx,
                    _ if i.asset_class == "crypto" => Session::Always,
                    _ => Session::Fx,
                };
                (s, None)
            } else {
                let name = i.session.clone().or(class.session.clone()).unwrap_or_else(|| "fx".into());
                let s = Session::parse(&name).ok_or_else(|| anyhow::anyhow!("{}: unknown session {name}", i.symbol))?;
                let h = match &i.calendar {
                    Some(c) => Some(calendars.get(c).cloned().ok_or_else(|| anyhow::anyhow!("{}: holiday calendar {c} not found", i.symbol))?),
                    None => None,
                };
                (s, h)
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
                swap_percent: pick!(swap_mode, "points".to_string()) == "percent",
                session,
                holidays,
                commission_per_lot: sym.commission_per_lot.or(class.commission_per_lot),
                base_spread: i.base_spread,
                core,
            };
            if map.insert(i.symbol.clone(), spec).is_some() {
                anyhow::bail!("{}: listed twice in the instrument catalogue", i.symbol);
            }
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

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    /// The symbol converting `ccy` to USD and whether its price multiplies (`EURUSD`) or divides (`USDJPY`).
    /// Core instruments first, like the engine (services/trading/src/specs.rs).
    pub fn usd_pair(&self, ccy: &str) -> Option<(String, bool)> {
        for core in [true, false] {
            let direct = format!("{ccy}USD");
            if self.map.get(&direct).is_some_and(|s| s.core == core) {
                return Some((direct, true));
            }
            let inverse = format!("USD{ccy}");
            if self.map.get(&inverse).is_some_and(|s| s.core == core) {
                return Some((inverse, false));
            }
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
    fn catalogue_specs_load_with_templates_and_sessions() {
        let s = Specs::repo();
        assert!(s.len() > 1000, "{} instruments", s.len());
        assert_eq!(s.all().filter(|x| x.core).count(), 28);
        // core unchanged: identical to the specs built from the original core-only files
        let old = Specs::parse(
            include_str!("../../trading/tests/fixtures/instruments-core-2026-10-07.json"),
            include_str!("../../trading/tests/fixtures/trading-specs-core-2026-10-07.json"),
        )
        .unwrap();
        assert_eq!(old.len(), 28);
        for o in old.all() {
            assert_eq!(format!("{o:?}"), format!("{:?}", s.get(&o.symbol).unwrap()), "{} changed", o.symbol);
        }
        let msft = s.get("MSFT").unwrap();
        assert_eq!((msft.lot_min, msft.lot_step, msft.contract_size), (1.0, 1.0, 1.0));
        assert_eq!(session_key(&msft.session), "us_equity");
        let ts = |x: &str| DateTime::parse_from_rfc3339(x).unwrap().with_timezone(&Utc);
        assert!(!msft.is_open(ts("2026-11-26T15:00:00Z")), "NYSE Thanksgiving");
        assert!(s.get("AAPL").unwrap().is_open(ts("2026-11-26T15:00:00Z")), "core keeps its rules");
        let bnb = s.get("BNBUSD").unwrap();
        assert_eq!(session_key(&bnb.session), "always");
        assert!(bnb.swap_all_days);
        assert_eq!(s.get("AUDCAD").unwrap().floor_volume(0.129), Some(0.12));
        assert_eq!(s.get("AUDCAD").unwrap().quote_ccy, "CAD");
        assert_eq!(s.usd_pair("JPY"), Some(("USDJPY".into(), false)));
        assert_eq!(s.usd_pair("SGD"), Some(("USDSGD".into(), false)));
        // API shape of the session is unchanged for the core instruments
        assert_eq!(serde_json::to_value(s.get("BTCUSD").unwrap()).unwrap()["session"], "always");
        assert_eq!(serde_json::to_value(s.get("AAPL").unwrap()).unwrap()["session"], "us_equity");
        assert_eq!(serde_json::to_value(s.get("EURUSD").unwrap()).unwrap()["session"], "fx");
    }

    #[test]
    fn dst_offsets() {
        let summer = DateTime::parse_from_rfc3339("2026-07-01T12:00:00Z").unwrap().with_timezone(&Utc);
        let winter = DateTime::parse_from_rfc3339("2026-12-01T12:00:00Z").unwrap().with_timezone(&Utc);
        assert_eq!(server_offset_secs(summer), 3 * 3600);
        assert_eq!(server_offset_secs(winter), 2 * 3600);
    }
}
