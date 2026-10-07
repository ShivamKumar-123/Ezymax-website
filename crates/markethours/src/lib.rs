//! Trading sessions shared by market-data (which ticks count), the trading engine (when orders are accepted) and
//! ALGO (backtests), so all three always agree on whether a market is open.
//!
//! * **Server time** is the MT4/MT5 broker standard: GMT+3 while US daylight saving is active, GMT+2 otherwise, so
//!   00:00 server time is the New York close.
//! * **Sessions**: `fx` (Monday 00:00 to Friday 24:00 server time: FX, metals, energies, index CFDs), `24x7`
//!   (crypto), and exchange hours (`us_equity`, `hk_equity`, ...) in the exchange's own time zone, with its
//!   daylight-saving rule.
//! * **Holiday calendars**: `config/holidays/*.json` (currency / settlement calendars) and
//!   `config/holidays/exchanges/*.json` (exchange calendars, with early closes). A calendar closes the whole day
//!   (the exchange's local day for exchange hours, the server day for `fx`); an early close ends the last window.
//!
//! The three original sessions (`fx`, `24x7`, `us_equity` without a calendar) behave exactly as the services'
//! own copies did before this crate existed; tests pin that.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc, Weekday};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::Path;

/* ------------------------------------------------------------------ */
/* Server time                                                         */
/* ------------------------------------------------------------------ */

fn midnight(d: NaiveDate) -> DateTime<Utc> {
    Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
}

/// The `n`th `weekday` of a month (n = 1..5).
pub fn nth_weekday(year: i32, month: u32, weekday: Weekday, n: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let shift = (7 + weekday.num_days_from_sunday() as i64 - first.weekday().num_days_from_sunday() as i64) % 7;
    first + Duration::days(shift + 7 * (n as i64 - 1))
}

/// The last `weekday` of a month.
pub fn last_weekday(year: i32, month: u32, weekday: Weekday) -> NaiveDate {
    let next = if month == 12 { NaiveDate::from_ymd_opt(year + 1, 1, 1) } else { NaiveDate::from_ymd_opt(year, month + 1, 1) }.unwrap();
    let last = next - Duration::days(1);
    let back = (7 + last.weekday().num_days_from_sunday() as i64 - weekday.num_days_from_sunday() as i64) % 7;
    last - Duration::days(back)
}

/// US daylight saving: second Sunday of March 07:00 UTC to first Sunday of November 06:00 UTC.
pub fn us_dst(ts: DateTime<Utc>) -> bool {
    let y = ts.year();
    let start = midnight(nth_weekday(y, 3, Weekday::Sun, 2)) + Duration::hours(7);
    let end = midnight(nth_weekday(y, 11, Weekday::Sun, 1)) + Duration::hours(6);
    ts >= start && ts < end
}

/// EU / UK summer time: last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC.
pub fn eu_dst(ts: DateTime<Utc>) -> bool {
    let y = ts.year();
    let start = midnight(last_weekday(y, 3, Weekday::Sun)) + Duration::hours(1);
    let end = midnight(last_weekday(y, 10, Weekday::Sun)) + Duration::hours(1);
    ts >= start && ts < end
}

/// New South Wales daylight saving: first Sunday of October 02:00 AEST to first Sunday of April 03:00 AEDT
/// (both Saturday 16:00 UTC).
pub fn au_dst(ts: DateTime<Utc>) -> bool {
    let y = ts.year();
    let ends = midnight(nth_weekday(y, 4, Weekday::Sun, 1)) - Duration::hours(8);
    let starts = midnight(nth_weekday(y, 10, Weekday::Sun, 1)) - Duration::hours(8);
    ts < ends || ts >= starts
}

/// Server-time offset (seconds east of UTC): +3h during US DST, +2h otherwise.
pub fn server_offset_secs(ts: DateTime<Utc>) -> i64 {
    if us_dst(ts) { 3 * 3600 } else { 2 * 3600 }
}

/// Server-time wall clock of `ts` (as a UTC-labelled value).
pub fn server_time(ts: DateTime<Utc>) -> DateTime<Utc> {
    ts + Duration::seconds(server_offset_secs(ts))
}

/// Server-time calendar date of `ts`.
pub fn server_date(ts: DateTime<Utc>) -> NaiveDate {
    server_time(ts).date_naive()
}

/* ------------------------------------------------------------------ */
/* Time zones and exchange hours                                       */
/* ------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Zone {
    NewYork,
    London,
    /// Frankfurt / Paris / Amsterdam / Zurich (CET / CEST).
    Europe,
    HongKong,
    Shanghai,
    Singapore,
    Tokyo,
    India,
    Sydney,
}

impl Zone {
    /// Seconds east of UTC at `ts`.
    pub fn offset_secs(self, ts: DateTime<Utc>) -> i64 {
        let h = |x: i64| x * 3600;
        match self {
            Zone::NewYork => h(if us_dst(ts) { -4 } else { -5 }),
            Zone::London => h(if eu_dst(ts) { 1 } else { 0 }),
            Zone::Europe => h(if eu_dst(ts) { 2 } else { 1 }),
            Zone::HongKong | Zone::Shanghai | Zone::Singapore => h(8),
            Zone::Tokyo => h(9),
            Zone::India => h(5) + 1800,
            Zone::Sydney => h(if au_dst(ts) { 11 } else { 10 }),
        }
    }

    pub fn local(self, ts: DateTime<Utc>) -> DateTime<Utc> {
        ts + Duration::seconds(self.offset_secs(ts))
    }
}

/// Regular trading hours of an exchange: Monday–Friday, local time windows in minutes from midnight.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Hours {
    pub key: &'static str,
    pub label: &'static str,
    pub zone: Zone,
    pub windows: &'static [(u16, u16)],
}

/// Exchange sessions by key (the `session` of a catalogue instrument).
pub const EXCHANGES: &[Hours] = &[
    Hours { key: "us_equity", label: "US stocks 09:30–16:00 New York", zone: Zone::NewYork, windows: &[(570, 960)] },
    Hours { key: "uk_equity", label: "London 08:00–16:30", zone: Zone::London, windows: &[(480, 990)] },
    Hours { key: "eu_equity", label: "Xetra / Euronext 09:00–17:30 CET", zone: Zone::Europe, windows: &[(540, 1050)] },
    Hours { key: "hk_equity", label: "Hong Kong 09:30–12:00, 13:00–16:00", zone: Zone::HongKong, windows: &[(570, 720), (780, 960)] },
    Hours { key: "cn_equity", label: "Shanghai / Shenzhen 09:30–11:30, 13:00–15:00", zone: Zone::Shanghai, windows: &[(570, 690), (780, 900)] },
    Hours { key: "sg_equity", label: "Singapore 09:00–12:00, 13:00–17:00", zone: Zone::Singapore, windows: &[(540, 720), (780, 1020)] },
    Hours { key: "jp_equity", label: "Tokyo 09:00–11:30, 12:30–15:30", zone: Zone::Tokyo, windows: &[(540, 690), (750, 930)] },
    Hours { key: "in_equity", label: "NSE / BSE 09:15–15:30 IST", zone: Zone::India, windows: &[(555, 930)] },
    Hours { key: "au_equity", label: "ASX 10:00–16:00 Sydney", zone: Zone::Sydney, windows: &[(600, 960)] },
];

pub fn exchange(key: &str) -> Option<&'static Hours> {
    EXCHANGES.iter().find(|h| h.key == key)
}

/* ------------------------------------------------------------------ */
/* Holiday calendars                                                   */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Holidays {
    pub calendar: String,
    closed: BTreeSet<NaiveDate>,
    /// local close time (minutes from midnight) on early-close days
    early: BTreeMap<NaiveDate, u16>,
}

#[derive(Deserialize)]
struct HolidayFile {
    calendar: String,
    #[serde(default)]
    holidays: Vec<HolidayEntry>,
    #[serde(default, rename = "earlyCloses")]
    early_closes: Vec<EarlyEntry>,
}

#[derive(Deserialize)]
struct HolidayEntry {
    date: NaiveDate,
}

#[derive(Deserialize)]
struct EarlyEntry {
    date: NaiveDate,
    /// "HH:MM" local time
    close: String,
}

fn hhmm(s: &str) -> Option<u16> {
    let (h, m) = s.split_once(':')?;
    let (h, m): (u16, u16) = (h.parse().ok()?, m.parse().ok()?);
    (h < 24 && m < 60).then_some(h * 60 + m)
}

impl Holidays {
    pub fn new(calendar: &str, closed: impl IntoIterator<Item = NaiveDate>, early: impl IntoIterator<Item = (NaiveDate, u16)>) -> Self {
        Self { calendar: calendar.to_string(), closed: closed.into_iter().collect(), early: early.into_iter().collect() }
    }

    /// One calendar file (`{calendar, holidays:[{date}], earlyCloses?:[{date, close:"HH:MM"}]}`).
    pub fn parse(json: &str) -> Result<Self, String> {
        let f: HolidayFile = serde_json::from_str(json).map_err(|e| e.to_string())?;
        let mut early = BTreeMap::new();
        for e in f.early_closes {
            early.insert(e.date, hhmm(&e.close).ok_or_else(|| format!("{}: bad early close {}", f.calendar, e.close))?);
        }
        Ok(Self { calendar: f.calendar, closed: f.holidays.into_iter().map(|h| h.date).collect(), early })
    }

    /// Every calendar in `dir` and `dir/exchanges` by name. Unreadable files are reported, not skipped silently.
    pub fn load_dir(dir: &str) -> Result<HashMap<String, Holidays>, String> {
        let mut out = HashMap::new();
        for d in [Path::new(dir).to_path_buf(), Path::new(dir).join("exchanges")] {
            let Ok(entries) = std::fs::read_dir(&d) else { continue };
            let mut files: Vec<_> = entries.filter_map(|e| e.ok().map(|e| e.path())).filter(|p| p.extension().is_some_and(|x| x == "json")).collect();
            files.sort();
            for p in files {
                let raw = std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))?;
                let h = Holidays::parse(&raw).map_err(|e| format!("{}: {e}", p.display()))?;
                out.insert(h.calendar.clone(), h);
            }
        }
        Ok(out)
    }

    pub fn is_closed(&self, day: NaiveDate) -> bool {
        self.closed.contains(&day)
    }

    pub fn early_close(&self, day: NaiveDate) -> Option<u16> {
        self.early.get(&day).copied()
    }

    /// Last date the calendar covers (sessions past it have no holiday data).
    pub fn last_day(&self) -> Option<NaiveDate> {
        self.closed.iter().chain(self.early.keys()).max().copied()
    }

    pub fn len(&self) -> usize {
        self.closed.len()
    }

    pub fn is_empty(&self) -> bool {
        self.closed.is_empty()
    }
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Session {
    /// Closed Saturday and Sunday server time.
    Fx,
    /// Around the clock.
    Always,
    /// Exchange hours (Monday–Friday local time).
    Exchange(&'static Hours),
}

impl Session {
    /// `fx`, `24x7` or an exchange key; None when unknown.
    pub fn parse(s: &str) -> Option<Session> {
        match s {
            "fx" => Some(Session::Fx),
            "24x7" => Some(Session::Always),
            k => exchange(k).map(Session::Exchange),
        }
    }

    pub fn key(&self) -> &'static str {
        match self {
            Session::Fx => "fx",
            Session::Always => "24x7",
            Session::Exchange(h) => h.key,
        }
    }

    pub fn is_open(&self, ts: DateTime<Utc>, holidays: Option<&Holidays>) -> bool {
        match self {
            Session::Always => true,
            Session::Fx => {
                let server = server_time(ts);
                !matches!(server.weekday(), Weekday::Sat | Weekday::Sun) && !holidays.is_some_and(|h| h.is_closed(server.date_naive()))
            }
            Session::Exchange(x) => {
                let local = x.zone.local(ts);
                let day = local.date_naive();
                if matches!(local.weekday(), Weekday::Sat | Weekday::Sun) || holidays.is_some_and(|h| h.is_closed(day)) {
                    return false;
                }
                let mins = (local.hour() * 60 + local.minute()) as u16;
                let close = holidays.and_then(|h| h.early_close(day));
                x.windows.iter().any(|(o, c)| mins >= *o && mins < close.map_or(*c, |e| e.min(*c)))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }
    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    /// The services' original copies (pinned): FX weekend close and US stocks by `server - 7h`.
    fn legacy_fx(ts: DateTime<Utc>) -> bool {
        let server = ts + Duration::seconds(server_offset_secs(ts));
        !matches!(server.weekday(), Weekday::Sat | Weekday::Sun)
    }
    fn legacy_us(ts: DateTime<Utc>) -> bool {
        let ny = ts + Duration::seconds(server_offset_secs(ts)) - Duration::hours(7);
        let mins = ny.hour() * 60 + ny.minute();
        !matches!(ny.weekday(), Weekday::Sat | Weekday::Sun) && (570..960).contains(&mins)
    }

    #[test]
    fn original_sessions_unchanged_over_two_years() {
        let us = Session::parse("us_equity").unwrap();
        let mut ts = t("2025-12-30T00:00:00Z");
        let end = t("2027-12-31T00:00:00Z");
        while ts < end {
            assert_eq!(Session::Fx.is_open(ts, None), legacy_fx(ts), "fx {ts}");
            assert_eq!(us.is_open(ts, None), legacy_us(ts), "us {ts}");
            ts += Duration::minutes(7);
        }
    }

    #[test]
    fn dst_rules() {
        assert!(us_dst(t("2026-07-01T12:00:00Z")) && !us_dst(t("2026-12-01T12:00:00Z")));
        assert!(!eu_dst(t("2026-03-29T00:59:59Z")) && eu_dst(t("2026-03-29T01:00:00Z")));
        assert!(eu_dst(t("2026-10-25T00:59:59Z")) && !eu_dst(t("2026-10-25T01:00:00Z")));
        // Sydney: DST ends Sun 2026-04-05 03:00 AEDT (Sat 16:00 UTC), starts Sun 2026-10-04 02:00 AEST (Sat 16:00 UTC)
        assert!(au_dst(t("2026-04-04T15:59:59Z")) && !au_dst(t("2026-04-04T16:00:00Z")));
        assert!(!au_dst(t("2026-10-03T15:59:59Z")) && au_dst(t("2026-10-03T16:00:00Z")));
        assert_eq!(server_offset_secs(t("2026-07-01T12:00:00Z")), 3 * 3600);
        assert_eq!(last_weekday(2026, 3, Weekday::Sun), d("2026-03-29"));
    }

    #[test]
    fn exchange_hours_with_lunch_breaks_and_time_zones() {
        let hk = Session::parse("hk_equity").unwrap();
        // 2026-10-07 (Wed): HK 09:30 = 01:30 UTC; lunch 12:00–13:00 HKT = 04:00–05:00 UTC; close 16:00 = 08:00 UTC
        assert!(!hk.is_open(t("2026-10-07T01:29:00Z"), None));
        assert!(hk.is_open(t("2026-10-07T01:30:00Z"), None));
        assert!(!hk.is_open(t("2026-10-07T04:30:00Z"), None));
        assert!(hk.is_open(t("2026-10-07T05:00:00Z"), None));
        assert!(!hk.is_open(t("2026-10-07T08:00:00Z"), None));
        let lse = Session::parse("uk_equity").unwrap();
        // London summer (BST): 08:00 = 07:00 UTC; winter: 08:00 UTC
        assert!(lse.is_open(t("2026-07-01T07:00:00Z"), None));
        assert!(!lse.is_open(t("2026-12-01T07:30:00Z"), None));
        assert!(lse.is_open(t("2026-12-01T08:00:00Z"), None));
        let tse = Session::parse("jp_equity").unwrap();
        // Tokyo closes 15:30 JST = 06:30 UTC
        assert!(tse.is_open(t("2026-10-07T06:29:00Z"), None));
        assert!(!tse.is_open(t("2026-10-07T06:30:00Z"), None));
        // weekend in local time: Monday 08:00 JST is Sunday 23:00 UTC
        assert!(!tse.is_open(t("2026-10-04T23:00:00Z"), None));
        assert!(tse.is_open(t("2026-10-05T00:00:00Z"), None));
        assert_eq!(Session::parse("nope"), None);
        assert_eq!(Session::parse("24x7"), Some(Session::Always));
    }

    #[test]
    fn holidays_and_early_closes() {
        let nyse = Holidays::new("NYSE", [d("2026-11-26")], [(d("2026-11-27"), 13 * 60)]);
        let us = Session::parse("us_equity").unwrap();
        // Thanksgiving: closed all day; the day after closes at 13:00 New York (18:00 UTC in November)
        assert!(!us.is_open(t("2026-11-26T15:00:00Z"), Some(&nyse)));
        assert!(us.is_open(t("2026-11-26T15:00:00Z"), None));
        assert!(us.is_open(t("2026-11-27T17:59:00Z"), Some(&nyse)));
        assert!(!us.is_open(t("2026-11-27T18:00:00Z"), Some(&nyse)));
        // fx-type sessions close on the server day of a holiday (Christmas 2026 is a Friday)
        let oil = Holidays::new("OIL", [d("2026-12-25")], []);
        assert!(Session::Fx.is_open(t("2026-12-24T21:59:00Z"), Some(&oil)));
        assert!(!Session::Fx.is_open(t("2026-12-24T22:00:00Z"), Some(&oil)));
        assert!(!Session::Fx.is_open(t("2026-12-25T12:00:00Z"), Some(&oil)));
        assert!(Session::Always.is_open(t("2026-12-25T12:00:00Z"), Some(&oil)));
    }

    #[test]
    fn repo_calendars_load() {
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/holidays");
        let all = Holidays::load_dir(dir).unwrap();
        for c in ["USD", "XAU", "XAG", "OIL", "NYSE"] {
            assert!(all.get(c).is_some_and(|h| !h.is_empty()), "calendar {c} missing");
        }
        let nyse = &all["NYSE"];
        assert!(nyse.is_closed(d("2026-04-03")), "Good Friday");
        assert!(nyse.is_closed(d("2026-11-26")), "Thanksgiving");
        assert!(!nyse.is_closed(d("2026-10-12")), "Columbus Day is a bank holiday, not an NYSE one");
        assert_eq!(nyse.early_close(d("2026-11-27")), Some(13 * 60));
        assert!(Holidays::parse(r#"{"calendar":"X","holidays":[],"earlyCloses":[{"date":"2026-01-02","close":"25:00"}]}"#).is_err());
    }
}
