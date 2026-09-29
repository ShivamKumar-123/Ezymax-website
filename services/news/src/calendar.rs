//! Economic calendar: the weekly Forex Factory export, server-time conversion, affected instruments and
//! actual-vs-forecast surprise.
//!
//! Server time follows the "New York close" convention every MT-style broker uses: GMT+3 while the US is on
//! daylight saving time (second Sunday of March 02:00 ET → first Sunday of November 02:00 ET), GMT+2
//! otherwise, so the trading day always rolls over at 17:00 New York = 00:00 server time.

use chrono::{DateTime, Datelike, Duration, FixedOffset, NaiveDate, TimeZone, Utc, Weekday};
use serde_json::Value;

use crate::feed::sha;
use crate::tagging;

/// The n-th `weekday` of a month (1-based).
fn nth_weekday(year: i32, month: u32, weekday: Weekday, n: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).expect("valid date");
    let shift = (7 + weekday.num_days_from_monday() as i64 - first.weekday().num_days_from_monday() as i64) % 7;
    first + Duration::days(shift + 7 * (n as i64 - 1))
}

/// Whether US daylight saving time is in force at `t` (transitions at 02:00 local: 07:00 UTC in March,
/// 06:00 UTC in November).
pub fn us_dst(t: DateTime<Utc>) -> bool {
    let y = t.year();
    let start = Utc.from_utc_datetime(&nth_weekday(y, 3, Weekday::Sun, 2).and_hms_opt(7, 0, 0).unwrap());
    let end = Utc.from_utc_datetime(&nth_weekday(y, 11, Weekday::Sun, 1).and_hms_opt(6, 0, 0).unwrap());
    t >= start && t < end
}

/// Server time offset from UTC in hours (3 in US summer, 2 otherwise).
pub fn server_offset_hours(t: DateTime<Utc>) -> i32 {
    if us_dst(t) { 3 } else { 2 }
}

pub fn to_server(t: DateTime<Utc>) -> DateTime<FixedOffset> {
    t.with_timezone(&FixedOffset::east_opt(server_offset_hours(t) * 3600).unwrap())
}

/// Monday 00:00 server time of the week containing `t`, as UTC.
pub fn server_week_start(t: DateTime<Utc>) -> DateTime<Utc> {
    let s = to_server(t);
    let monday = s.date_naive() - Duration::days(s.weekday().num_days_from_monday() as i64);
    let naive = monday.and_hms_opt(0, 0, 0).unwrap();
    // the offset at the start of that Monday can differ from `t`'s (DST week): resolve with the Monday's own
    let guess = Utc.from_utc_datetime(&(naive - Duration::hours(server_offset_hours(t) as i64)));
    Utc.from_utc_datetime(&(naive - Duration::hours(server_offset_hours(guess) as i64)))
}

#[derive(Debug, Clone, PartialEq)]
pub struct CalEvent {
    pub ext_key: String,
    pub title: String,
    pub currency: String,
    pub country: String,
    pub starts_at: DateTime<Utc>,
    pub all_day: bool,
    /// 0 holiday / non-economic, 1 low, 2 medium, 3 high
    pub impact: i16,
    pub forecast: String,
    pub previous: String,
    pub actual: String,
    pub symbols: Vec<String>,
    pub url: String,
}

pub fn impact_of(s: &str) -> i16 {
    match s.trim().to_ascii_lowercase().as_str() {
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

pub fn impact_label(i: i16) -> &'static str {
    match i {
        3 => "high",
        2 => "medium",
        1 => "low",
        _ => "holiday",
    }
}

fn s(v: &Value, k: &str) -> String {
    v.get(k).and_then(Value::as_str).unwrap_or("").trim().chars().take(60).collect()
}

/// Instruments an event moves: the currency's instruments plus title-specific ones (oil inventories, …).
pub fn event_symbols(currency: &str, title: &str) -> Vec<String> {
    let t = title.to_lowercase();
    let mut out: Vec<String> = vec![];
    if t.contains("crude") || t.contains("oil") || t.contains("opec") {
        out.extend(["USOIL", "UKOIL"].map(String::from));
    }
    if t.contains("natural gas") {
        out.push("USOIL".into());
    }
    for x in tagging::currency_symbols(currency) {
        if !out.iter().any(|o| o == x) {
            out.push((*x).to_string());
        }
    }
    out.truncate(4);
    out
}

/// Parse the Forex Factory weekly JSON export (`[{title, country: "USD", date: RFC 3339 in ET, impact,
/// forecast, previous, actual?}]`). Events keep a stable key (currency, title, ET date and occurrence index),
/// so a rescheduled time or a new forecast updates the same row.
pub fn parse_ff(json: &str) -> anyhow::Result<Vec<CalEvent>> {
    let v: Value = serde_json::from_str(json)?;
    let arr = v.as_array().ok_or_else(|| anyhow::anyhow!("calendar export is not a JSON array"))?;
    let mut seen: std::collections::HashMap<String, u32> = Default::default();
    let mut out = vec![];
    for e in arr {
        let title = s(e, "title");
        let currency = s(e, "country").to_ascii_uppercase();
        let Some(date) = e.get("date").and_then(Value::as_str).and_then(|d| DateTime::parse_from_rfc3339(d).ok()) else { continue };
        if title.is_empty() || currency.len() != 3 {
            continue;
        }
        let impact_raw = s(e, "impact");
        let impact = impact_of(&impact_raw);
        // all-day items (holidays, tentative) are exported at 00:00 ET
        let all_day = impact == 0 || (date.format("%H:%M").to_string() == "00:00" && impact_raw.eq_ignore_ascii_case("holiday"));
        let base = format!("{currency}|{}|{}", crate::feed::normalize_title(&title), date.date_naive());
        let n = seen.entry(base.clone()).or_insert(0);
        *n += 1;
        let ext_key = sha(&format!("ff:{base}|{n}"));
        out.push(CalEvent {
            ext_key,
            symbols: event_symbols(&currency, &title),
            country: tagging::country_of_currency(&currency).to_string(),
            title,
            currency,
            starts_at: date.with_timezone(&Utc),
            all_day,
            impact,
            forecast: s(e, "forecast"),
            previous: s(e, "previous"),
            actual: s(e, "actual"),
            url: String::new(),
        });
    }
    Ok(out)
}

/// "1.5%", "-0.2%", "250K", "3.44B", "1.2M", "<0.10%" → number (suffixes scale to the same unit per event).
pub fn figure(s: &str) -> Option<f64> {
    let t = s.trim().trim_start_matches(['<', '>', '~']).replace(',', "");
    if t.is_empty() {
        return None;
    }
    let (num, mult) = match t.chars().last()? {
        'K' | 'k' => (&t[..t.len() - 1], 1e3),
        'M' | 'm' => (&t[..t.len() - 1], 1e6),
        'B' | 'b' => (&t[..t.len() - 1], 1e9),
        'T' | 't' => (&t[..t.len() - 1], 1e12),
        '%' => (&t[..t.len() - 1], 1.0),
        _ => (t.as_str(), 1.0),
    };
    num.trim().parse::<f64>().ok().map(|x| x * mult)
}

/// Releases where a lower print is good for the currency.
pub fn lower_is_better(title: &str) -> bool {
    let t = title.to_lowercase();
    ["unemployment", "jobless", "claims", "claimant", "deficit", "bankruptcies", "layoffs", "job cuts"].iter().any(|k| t.contains(k))
}

/// +1 actual better than forecast for the currency, -1 worse, 0 in line / not comparable.
pub fn surprise(title: &str, actual: &str, forecast: &str) -> i32 {
    match (figure(actual), figure(forecast)) {
        (Some(a), Some(f)) if (a - f).abs() > 1e-12 => {
            let better = if lower_is_better(title) { a < f } else { a > f };
            if better { 1 } else { -1 }
        }
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn dst_boundaries_2026() {
        // 2026: DST starts Sun 8 Mar 07:00 UTC, ends Sun 1 Nov 06:00 UTC
        assert_eq!(server_offset_hours(utc("2026-03-08T06:59:59Z")), 2);
        assert_eq!(server_offset_hours(utc("2026-03-08T07:00:00Z")), 3);
        assert_eq!(server_offset_hours(utc("2026-11-01T05:59:59Z")), 3);
        assert_eq!(server_offset_hours(utc("2026-11-01T06:00:00Z")), 2);
        assert_eq!(server_offset_hours(utc("2026-09-29T12:00:00Z")), 3);
        assert_eq!(server_offset_hours(utc("2026-01-15T12:00:00Z")), 2);
        // 2027: 14 Mar / 7 Nov
        assert_eq!(server_offset_hours(utc("2027-03-14T07:00:00Z")), 3);
        assert_eq!(server_offset_hours(utc("2027-03-13T12:00:00Z")), 2);
        assert_eq!(server_offset_hours(utc("2027-11-07T06:00:00Z")), 2);
    }

    #[test]
    fn server_time_matches_new_york_close() {
        // 17:00 New York is always 00:00 server time
        let summer = to_server(utc("2026-09-28T21:00:00Z")); // 17:00 EDT
        assert_eq!(summer.format("%Y-%m-%d %H:%M").to_string(), "2026-09-29 00:00");
        let winter = to_server(utc("2026-12-07T22:00:00Z")); // 17:00 EST
        assert_eq!(winter.format("%Y-%m-%d %H:%M").to_string(), "2026-12-08 00:00");
        // an ET-stamped export time converts across the change: Friday 8:30 ET NFP
        let ev = DateTime::parse_from_rfc3339("2026-11-06T08:30:00-05:00").unwrap().with_timezone(&Utc);
        assert_eq!(to_server(ev).format("%H:%M %:z").to_string(), "15:30 +02:00");
        let ev = DateTime::parse_from_rfc3339("2026-10-02T08:30:00-04:00").unwrap().with_timezone(&Utc);
        assert_eq!(to_server(ev).format("%H:%M %:z").to_string(), "15:30 +03:00");
    }

    #[test]
    fn week_start() {
        assert_eq!(server_week_start(utc("2026-09-30T10:00:00Z")), utc("2026-09-27T21:00:00Z")); // Mon 00:00 +03
        // Sunday 22:00 UTC in summer is already Monday 01:00 server time
        assert_eq!(server_week_start(utc("2026-09-27T22:00:00Z")), utc("2026-09-27T21:00:00Z"));
        assert_eq!(server_week_start(utc("2026-12-09T10:00:00Z")), utc("2026-12-06T22:00:00Z")); // Mon 00:00 +02
        // the week of the November change: Monday 2 Nov is already +02
        assert_eq!(server_week_start(utc("2026-11-04T10:00:00Z")), utc("2026-11-01T22:00:00Z"));
    }

    #[test]
    fn parse_export() {
        let json = r#"[
          {"title":"Cash Rate","country":"AUD","date":"2026-09-29T00:30:00-04:00","impact":"High","forecast":"4.60%","previous":"4.35%"},
          {"title":"FOMC Member Cook Speaks","country":"USD","date":"2026-09-28T13:25:00-04:00","impact":"Low","forecast":"","previous":""},
          {"title":"FOMC Member Cook Speaks","country":"USD","date":"2026-09-28T16:00:00-04:00","impact":"Low","forecast":"","previous":""},
          {"title":"Bank Holiday","country":"CNY","date":"2026-10-01T00:00:00-04:00","impact":"Holiday","forecast":"","previous":""},
          {"title":"Crude Oil Inventories","country":"USD","date":"2026-09-30T10:30:00-04:00","impact":"Medium","forecast":"-1.2M","previous":"0.8M","actual":"-2.1M"},
          {"title":"","country":"USD","date":"2026-09-30T10:30:00-04:00","impact":"Low"},
          {"title":"Bad date","country":"USD","date":"soon","impact":"Low"}
        ]"#;
        let ev = parse_ff(json).unwrap();
        assert_eq!(ev.len(), 5);
        assert_eq!(ev[0].starts_at, utc("2026-09-29T04:30:00Z"));
        assert_eq!(to_server(ev[0].starts_at).format("%a %H:%M").to_string(), "Tue 07:30");
        assert_eq!(ev[0].impact, 3);
        assert_eq!(ev[0].country, "au");
        assert_eq!(ev[0].symbols, vec!["AUDUSD"]);
        assert_ne!(ev[1].ext_key, ev[2].ext_key, "same title twice a day gets two rows");
        assert!(ev[3].all_day && ev[3].impact == 0);
        assert_eq!(ev[4].actual, "-2.1M");
        assert_eq!(ev[4].symbols, vec!["USOIL", "UKOIL", "EURUSD", "USDJPY"]);
        // re-parsing gives the same keys (idempotent upserts)
        assert_eq!(parse_ff(json).unwrap()[1].ext_key, ev[1].ext_key);
    }

    #[test]
    fn figures_and_surprise() {
        assert_eq!(figure("4.60%"), Some(4.6));
        assert_eq!(figure("250K"), Some(250_000.0));
        assert_eq!(figure("-1.2M"), Some(-1_200_000.0));
        assert_eq!(figure("<0.10%"), Some(0.1));
        assert_eq!(figure(""), None);
        assert_eq!(surprise("Non-Farm Employment Change", "254K", "150K"), 1);
        assert_eq!(surprise("Unemployment Rate", "4.3%", "4.1%"), -1);
        assert_eq!(surprise("Unemployment Claims", "210K", "225K"), 1);
        assert_eq!(surprise("CPI m/m", "0.2%", "0.2%"), 0);
        assert_eq!(surprise("CPI m/m", "0.2%", ""), 0);
    }
}
