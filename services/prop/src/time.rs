//! Server time (same rule as the trading engine and market-data): GMT+3 while US daylight saving time is on,
//! GMT+2 otherwise, so 00:00 server time is always 17:00 New York, the FX "NY close". The prop trading day,
//! the daily-loss reset and trading-day counting all use this calendar.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc, Weekday};

fn nth_sunday(year: i32, month: u32, n: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let to_sun = (7 - first.weekday().num_days_from_sunday()) % 7;
    first + Duration::days((to_sun + 7 * (n - 1)) as i64)
}

fn midnight(d: NaiveDate) -> DateTime<Utc> {
    Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
}

/// Seconds east of UTC for server time at `ts`: US DST starts 2nd Sunday of March 02:00 EST (07:00 UTC) and
/// ends 1st Sunday of November 02:00 EDT (06:00 UTC).
pub fn server_offset_secs(ts: DateTime<Utc>) -> i64 {
    let y = ts.year();
    let start = midnight(nth_sunday(y, 3, 2)) + Duration::hours(7);
    let end = midnight(nth_sunday(y, 11, 1)) + Duration::hours(6);
    if ts >= start && ts < end { 3 * 3600 } else { 2 * 3600 }
}

/// Wall-clock server time.
pub fn server_local(ts: DateTime<Utc>) -> chrono::NaiveDateTime {
    (ts + Duration::seconds(server_offset_secs(ts))).naive_utc()
}

/// The prop trading day of `ts` (server-time calendar date; it rolls at 17:00 New York).
pub fn server_date(ts: DateTime<Utc>) -> NaiveDate {
    server_local(ts).date()
}

/// UTC instant of 00:00 server time on `day`.
pub fn server_midnight(day: NaiveDate) -> DateTime<Utc> {
    let local = midnight(day);
    let guess = local - Duration::seconds(server_offset_secs(local - Duration::hours(2)));
    local - Duration::seconds(server_offset_secs(guess))
}

/// Next daily reset (NY close) strictly after `ts`.
pub fn next_reset(ts: DateTime<Utc>) -> DateTime<Utc> {
    server_midnight(server_date(ts).succ_opt().unwrap())
}

/// Weekend-holding window: from Friday 23:45 server time (16:45 New York, 15 minutes before the FX close)
/// until Sunday 23:59 server time. Positions still open in this window break the weekend rule.
pub fn in_weekend_window(ts: DateTime<Utc>) -> bool {
    let l = server_local(ts);
    match l.weekday() {
        Weekday::Fri => l.hour() == 23 && l.minute() >= 45,
        Weekday::Sat | Weekday::Sun => true,
        _ => false,
    }
}

/// Whole server days between two instants (by calendar date).
pub fn days_between(from: DateTime<Utc>, to: DateTime<Utc>) -> i64 {
    (server_date(to) - server_date(from)).num_days()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn reset_is_ny_close_in_summer_and_winter() {
        // summer (EDT): 17:00 NY = 21:00 UTC = 00:00 GMT+3
        assert_eq!(server_date(t("2026-07-15T20:59:59Z")), NaiveDate::from_ymd_opt(2026, 7, 15).unwrap());
        assert_eq!(server_date(t("2026-07-15T21:00:00Z")), NaiveDate::from_ymd_opt(2026, 7, 16).unwrap());
        assert_eq!(next_reset(t("2026-07-15T12:00:00Z")), t("2026-07-15T21:00:00Z"));
        // winter (EST): 17:00 NY = 22:00 UTC = 00:00 GMT+2
        assert_eq!(server_date(t("2026-01-15T21:59:59Z")), NaiveDate::from_ymd_opt(2026, 1, 15).unwrap());
        assert_eq!(server_date(t("2026-01-15T22:00:00Z")), NaiveDate::from_ymd_opt(2026, 1, 16).unwrap());
        assert_eq!(next_reset(t("2026-01-15T12:00:00Z")), t("2026-01-15T22:00:00Z"));
    }

    #[test]
    fn dst_switch_days() {
        // 2026: DST starts Sun 8 Mar 07:00 UTC, ends Sun 1 Nov 06:00 UTC
        assert_eq!(server_offset_secs(t("2026-03-08T06:59:59Z")), 7200);
        assert_eq!(server_offset_secs(t("2026-03-08T07:00:00Z")), 10800);
        assert_eq!(server_offset_secs(t("2026-11-01T05:59:59Z")), 10800);
        assert_eq!(server_offset_secs(t("2026-11-01T06:00:00Z")), 7200);
        // the reset closing Friday 6 Mar (winter) is 22:00 UTC; the one closing Monday 9 Mar (summer) is 21:00 UTC
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 3, 7).unwrap()), t("2026-03-06T22:00:00Z"));
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 3, 10).unwrap()), t("2026-03-09T21:00:00Z"));
        // November: the reset closing Friday 30 Oct is still summer (21:00 UTC), Monday 2 Nov winter (22:00 UTC)
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 10, 31).unwrap()), t("2026-10-30T21:00:00Z"));
        assert_eq!(server_midnight(NaiveDate::from_ymd_opt(2026, 11, 3).unwrap()), t("2026-11-02T22:00:00Z"));
    }

    #[test]
    fn weekend_window() {
        // Fri 2 Oct 2026, summer: 23:45 server = 20:45 UTC
        assert!(!in_weekend_window(t("2026-10-02T20:44:00Z")));
        assert!(in_weekend_window(t("2026-10-02T20:45:00Z")));
        assert!(in_weekend_window(t("2026-10-03T12:00:00Z")));
        assert!(in_weekend_window(t("2026-10-04T20:59:00Z")));
        // Sunday 21:00 UTC = Monday 00:00 server: market reopens
        assert!(!in_weekend_window(t("2026-10-04T21:00:00Z")));
    }
}
