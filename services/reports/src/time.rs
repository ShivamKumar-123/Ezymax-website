//! Server time (MT5 convention, same rule as market-data and the engine): GMT+3 while US daylight saving time
//! is active, GMT+2 otherwise. Days, weeks and months in reports are server days.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc, Weekday};

/// n-th `weekday` of a month (1-based).
fn nth_weekday(year: i32, month: u32, weekday: Weekday, n: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let shift = (7 + weekday.num_days_from_monday() as i64 - first.weekday().num_days_from_monday() as i64) % 7;
    first + Duration::days(shift + 7 * (n as i64 - 1))
}

/// US DST: second Sunday of March 07:00 UTC to first Sunday of November 06:00 UTC.
pub fn us_dst(t: DateTime<Utc>) -> bool {
    let y = t.year();
    let start = Utc.from_utc_datetime(&nth_weekday(y, 3, Weekday::Sun, 2).and_hms_opt(7, 0, 0).unwrap());
    let end = Utc.from_utc_datetime(&nth_weekday(y, 11, Weekday::Sun, 1).and_hms_opt(6, 0, 0).unwrap());
    t >= start && t < end
}

pub fn offset_hours(t: DateTime<Utc>) -> i64 {
    if us_dst(t) { 3 } else { 2 }
}

/// Server-time wall clock of an instant (as a naive UTC-shifted time).
pub fn server_naive(t: DateTime<Utc>) -> chrono::NaiveDateTime {
    (t + Duration::hours(offset_hours(t))).naive_utc()
}

pub fn server_day(t: DateTime<Utc>) -> NaiveDate {
    server_naive(t).date()
}

/// The UTC instant a server day starts.
pub fn day_start(d: NaiveDate) -> DateTime<Utc> {
    let guess = Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap()) - Duration::hours(3);
    // offset of the instant itself (the switch happens at 06:00/07:00 UTC, never near server midnight)
    Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap()) - Duration::hours(offset_hours(guess))
}

pub fn month_start(d: NaiveDate) -> NaiveDate {
    NaiveDate::from_ymd_opt(d.year(), d.month(), 1).unwrap()
}

pub fn add_months(d: NaiveDate, n: i32) -> NaiveDate {
    let m0 = d.year() * 12 + d.month() as i32 - 1 + n;
    NaiveDate::from_ymd_opt(m0.div_euclid(12), (m0.rem_euclid(12) + 1) as u32, 1).unwrap()
}

/// Parses `YYYY-MM-DD` (server day start) or RFC 3339.
pub fn parse_time(s: &str) -> Option<DateTime<Utc>> {
    let s = s.trim();
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Some(day_start(d));
    }
    DateTime::parse_from_rfc3339(s).ok().map(|t| t.with_timezone(&Utc))
}

pub fn fmt_server(t: DateTime<Utc>) -> String {
    server_naive(t).format("%Y.%m.%d %H:%M:%S").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dst_offsets_and_day_starts() {
        let summer = Utc.with_ymd_and_hms(2026, 7, 1, 12, 0, 0).unwrap();
        let winter = Utc.with_ymd_and_hms(2026, 12, 1, 12, 0, 0).unwrap();
        assert_eq!(offset_hours(summer), 3);
        assert_eq!(offset_hours(winter), 2);
        assert_eq!(day_start(NaiveDate::from_ymd_opt(2026, 7, 1).unwrap()), Utc.with_ymd_and_hms(2026, 6, 30, 21, 0, 0).unwrap());
        assert_eq!(day_start(NaiveDate::from_ymd_opt(2026, 12, 1).unwrap()), Utc.with_ymd_and_hms(2026, 11, 30, 22, 0, 0).unwrap());
        // 22:30 UTC on 30 June is already 1 July server time
        assert_eq!(server_day(Utc.with_ymd_and_hms(2026, 6, 30, 22, 30, 0).unwrap()), NaiveDate::from_ymd_opt(2026, 7, 1).unwrap());
        assert_eq!(add_months(NaiveDate::from_ymd_opt(2026, 11, 5).unwrap(), 3), NaiveDate::from_ymd_opt(2027, 2, 1).unwrap());
    }
}
