//! Server-time months and the return formula.
//!
//! Periods are calendar months in broker server time (GMT+3 during US daylight saving, GMT+2 otherwise; see
//! `markethours`), written "YYYY-MM". A position earns from the server day it starts (counted) to the server day it
//! matures (not counted), so a term of N months earns exactly the days between the two dates. One month's return is
//! `principal × rate % × days active in the month ÷ days in the month`, rounded to cents.

use crate::money::{D, HUNDRED, ZERO, r2};
use chrono::{DateTime, Datelike, Duration, Months, NaiveDate, TimeZone, Utc};
use markethours::{server_date, server_offset_secs};
use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Period {
    pub year: i32,
    pub month: u32,
}

impl Period {
    pub fn parse(s: &str) -> Option<Self> {
        let (y, m) = s.trim().split_once('-')?;
        if y.len() != 4 || m.len() != 2 {
            return None;
        }
        let (year, month) = (y.parse::<i32>().ok()?, m.parse::<u32>().ok()?);
        ((2000..=2999).contains(&year) && (1..=12).contains(&month)).then_some(Period { year, month })
    }

    /// The server-time month that contains `ts`.
    pub fn of(ts: DateTime<Utc>) -> Self {
        let d = server_date(ts);
        Period { year: d.year(), month: d.month() }
    }

    pub fn first_day(self) -> NaiveDate {
        NaiveDate::from_ymd_opt(self.year, self.month, 1).expect("valid period")
    }

    pub fn next(self) -> Self {
        if self.month == 12 { Period { year: self.year + 1, month: 1 } } else { Period { year: self.year, month: self.month + 1 } }
    }

    pub fn prev(self) -> Self {
        if self.month == 1 { Period { year: self.year - 1, month: 12 } } else { Period { year: self.year, month: self.month - 1 } }
    }

    pub fn days(self) -> i64 {
        (self.next().first_day() - self.first_day()).num_days()
    }

    /// 00:00 server time on the 1st, as a UTC instant.
    pub fn start(self) -> DateTime<Utc> {
        server_midnight(self.first_day())
    }

    /// 00:00 server time on the 1st of the next month (exclusive end).
    pub fn end(self) -> DateTime<Utc> {
        self.next().start()
    }

    /// The month is over in server time (its returns can be settled).
    pub fn is_closed(self, now: DateTime<Utc>) -> bool {
        now >= self.end()
    }
}

impl fmt::Display for Period {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}", self.year, self.month)
    }
}

/// 00:00 server time of `d` as a UTC instant. The offset is read just before that midnight, which is correct on
/// both sides of the US daylight-saving switches (they happen on Sunday mornings UTC).
pub fn server_midnight(d: NaiveDate) -> DateTime<Utc> {
    let wall = Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).expect("midnight"));
    let off = server_offset_secs(wall - Duration::hours(3));
    wall - Duration::seconds(off)
}

/// When a position started at `started_at` for `term_months` matures: 00:00 server time on the same calendar day
/// `term_months` later (the last day of a shorter month when that day doesn't exist).
pub fn maturity(started_at: DateTime<Utc>, term_months: i32) -> DateTime<Utc> {
    let start = server_date(started_at);
    let end = start.checked_add_months(Months::new(term_months.max(0) as u32)).unwrap_or(start);
    server_midnight(end)
}

/// Days of `period` a position earns for (start day counted, maturity day not).
pub fn days_active(started_at: DateTime<Utc>, matures_at: DateTime<Utc>, period: Period) -> i64 {
    let from = server_date(started_at).max(period.first_day());
    let to = server_date(matures_at).min(period.next().first_day());
    (to - from).num_days().max(0)
}

/// One month's return of a position, in cents.
pub fn accrual(principal: D, rate_pct: D, days: i64, days_in_month: i64) -> D {
    if days <= 0 || days_in_month <= 0 || rate_pct <= ZERO || principal <= ZERO {
        return ZERO;
    }
    r2(principal * rate_pct * D::from(days) / (HUNDRED * D::from(days_in_month)))
}

/// Total days of a term (start day counted, maturity day not).
pub fn term_days(started_at: DateTime<Utc>, matures_at: DateTime<Utc>) -> i64 {
    (server_date(matures_at) - server_date(started_at)).num_days().max(0)
}

/// Days of a term already behind the client (0 before it starts, capped at the term).
pub fn days_elapsed(started_at: DateTime<Utc>, matures_at: DateTime<Utc>, now: DateTime<Utc>) -> i64 {
    let total = term_days(started_at, matures_at);
    ((server_date(now) - server_date(started_at)).num_days()).clamp(0, total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::money::dec;

    fn t(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn parses_and_steps() {
        let p = Period::parse("2026-09").unwrap();
        assert_eq!(p.to_string(), "2026-09");
        assert_eq!(p.next().to_string(), "2026-10");
        assert_eq!(Period::parse("2026-12").unwrap().next().to_string(), "2027-01");
        assert_eq!(Period::parse("2027-01").unwrap().prev().to_string(), "2026-12");
        assert_eq!(p.days(), 30);
        assert_eq!(Period::parse("2028-02").unwrap().days(), 29);
        for bad in ["2026-13", "2026-0", "26-09", "2026/09", "", "abcd-ef"] {
            assert!(Period::parse(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn months_follow_server_time() {
        // September (US DST): server GMT+3, so the month starts at 21:00 UTC on 31 August
        let sep = Period::parse("2026-09").unwrap();
        assert_eq!(sep.start(), t("2026-08-31T21:00:00Z"));
        // 1 November 2026 is the Sunday DST ends: midnight server time is still GMT+3
        assert_eq!(sep.next().next().start(), t("2026-10-31T21:00:00Z"));
        // January: GMT+2
        assert_eq!(Period::parse("2027-01").unwrap().start(), t("2026-12-31T22:00:00Z"));
        // 22:30 UTC on 31 August is already September on the server
        assert_eq!(Period::of(t("2026-08-31T22:30:00Z")).to_string(), "2026-09");
        assert_eq!(Period::of(t("2026-08-31T20:59:59Z")).to_string(), "2026-08");
        assert!(sep.is_closed(t("2026-09-30T21:00:00Z")));
        assert!(!sep.is_closed(t("2026-09-30T20:59:59Z")));
    }

    #[test]
    fn maturity_keeps_the_server_day() {
        // started 15 Sep 14:00 server time (11:00 UTC): matures 15 Dec 00:00 server time (GMT+2 → 14 Dec 22:00 UTC)
        let start = t("2026-09-15T11:00:00Z");
        let m = maturity(start, 3);
        assert_eq!(m, t("2026-12-14T22:00:00Z"));
        assert_eq!(term_days(start, m), 91);
        // 31 January + 1 month → the last day of February
        assert_eq!(server_date(maturity(t("2027-01-31T10:00:00Z"), 1)), NaiveDate::from_ymd_opt(2027, 2, 28).unwrap());
    }

    #[test]
    fn days_active_split_by_month() {
        let start = t("2026-09-15T11:00:00Z");
        let m = maturity(start, 3);
        let days: Vec<i64> = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"].iter().map(|p| days_active(start, m, Period::parse(p).unwrap())).collect();
        // 15–30 Sep, all of October and November, 1–14 December
        assert_eq!(days, vec![0, 16, 31, 30, 14, 0]);
        assert_eq!(days.iter().sum::<i64>(), term_days(start, m));
    }

    #[test]
    fn accrual_formula() {
        // 10,000 × 1.5% × 16 / 30 = 80
        assert_eq!(accrual(dec("10000"), dec("1.5"), 16, 30), dec("80"));
        // full month
        assert_eq!(accrual(dec("2500"), dec("1.2"), 31, 31), dec("30"));
        // cents, half away from zero: 1000 × 1% × 1 / 30 = 0.3333… → 0.33
        assert_eq!(accrual(dec("1000"), dec("1"), 1, 30), dec("0.33"));
        // 0.125 → 0.13
        assert_eq!(accrual(dec("12.5"), dec("1"), 30, 30), dec("0.13"));
        assert_eq!(accrual(dec("1000"), dec("0"), 30, 30), ZERO);
        assert_eq!(accrual(dec("1000"), dec("1"), 0, 30), ZERO);
    }

    #[test]
    fn elapsed_is_clamped() {
        let start = t("2026-09-15T11:00:00Z");
        let m = maturity(start, 1);
        assert_eq!(days_elapsed(start, m, t("2026-09-01T00:00:00Z")), 0);
        assert_eq!(days_elapsed(start, m, t("2026-09-20T11:00:00Z")), 5);
        assert_eq!(days_elapsed(start, m, t("2027-01-01T00:00:00Z")), 30);
    }
}
