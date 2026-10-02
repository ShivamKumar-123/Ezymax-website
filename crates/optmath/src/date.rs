//! Civil dates and the few time zones the option calendar needs (UTC, New York, London, Tokyo), without
//! dependencies.
//!
//! * [`Date`] is a proleptic Gregorian date stored as days since 1970-01-01 (Howard Hinnant's
//!   `days_from_civil` / `civil_from_days`), so ordering and arithmetic are plain integer operations.
//! * [`Zone`] implements the current DST rules: United States (second Sunday of March 02:00 local to the
//!   first Sunday of November 02:00 local, since 2007) and European Union / UK (last Sunday of March 01:00
//!   UTC to the last Sunday of October 01:00 UTC). Tokyo has no DST. Older rule sets are not modelled.
//! * Instants are Unix milliseconds (`i64`).

use std::fmt;

pub const MINUTE_MS: i64 = 60_000;
pub const HOUR_MS: i64 = 3_600_000;
pub const DAY_MS: i64 = 86_400_000;

/// Day of the week, Monday first.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl Weekday {
    /// 0 = Monday ... 6 = Sunday.
    pub fn index(self) -> u32 {
        self as u32
    }
    fn from_index(i: u32) -> Weekday {
        [Weekday::Mon, Weekday::Tue, Weekday::Wed, Weekday::Thu, Weekday::Fri, Weekday::Sat, Weekday::Sun][(i % 7) as usize]
    }
    pub fn is_weekend(self) -> bool {
        matches!(self, Weekday::Sat | Weekday::Sun)
    }
}

/// A calendar date (no time, no zone).
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Date {
    days: i32,
}

fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m as i64 + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Number of days in `month` of `year`.
pub fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        _ => 0,
    }
}

impl Date {
    /// `None` for an impossible date (month 13, Feb 30, ...).
    pub fn from_ymd(year: i32, month: u32, day: u32) -> Option<Date> {
        if !(1..=12).contains(&month) || day == 0 || day > days_in_month(year, month) {
            return None;
        }
        Some(Date { days: days_from_civil(year as i64, month, day) as i32 })
    }

    /// Days since 1970-01-01.
    pub fn from_days(days: i32) -> Date {
        Date { days }
    }

    pub fn days(self) -> i32 {
        self.days
    }

    pub fn ymd(self) -> (i32, u32, u32) {
        let (y, m, d) = civil_from_days(self.days as i64);
        (y as i32, m, d)
    }

    pub fn year(self) -> i32 {
        self.ymd().0
    }

    pub fn month(self) -> u32 {
        self.ymd().1
    }

    pub fn day(self) -> u32 {
        self.ymd().2
    }

    pub fn weekday(self) -> Weekday {
        // 1970-01-01 was a Thursday (index 3).
        Weekday::from_index((self.days as i64 + 3).rem_euclid(7) as u32)
    }

    pub fn add_days(self, n: i32) -> Date {
        Date { days: self.days + n }
    }

    /// The UTC calendar date of a Unix-millisecond instant.
    pub fn from_unix_ms(ms: i64) -> Date {
        Date { days: ms.div_euclid(DAY_MS) as i32 }
    }

    /// Midnight UTC of this date in Unix milliseconds.
    pub fn unix_ms(self) -> i64 {
        self.days as i64 * DAY_MS
    }

    /// Parses `YYYY-MM-DD`.
    pub fn parse(s: &str) -> Option<Date> {
        let s = s.trim();
        let b = s.as_bytes();
        if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
            return None;
        }
        let y = s[0..4].parse().ok()?;
        let m = s[5..7].parse().ok()?;
        let d = s[8..10].parse().ok()?;
        Date::from_ymd(y, m, d)
    }

    /// The `n`-th (1-based) `wd` of a month, e.g. the 3rd Friday.
    pub fn nth_weekday(year: i32, month: u32, wd: Weekday, n: u32) -> Option<Date> {
        let first = Date::from_ymd(year, month, 1)?;
        let shift = (wd.index() + 7 - first.weekday().index()) % 7;
        let d = first.add_days((shift + 7 * (n.max(1) - 1)) as i32);
        (d.month() == month).then_some(d)
    }

    /// The last `wd` of a month, e.g. the last Friday.
    pub fn last_weekday(year: i32, month: u32, wd: Weekday) -> Option<Date> {
        let last = Date::from_ymd(year, month, days_in_month(year, month))?;
        let back = (last.weekday().index() + 7 - wd.index()) % 7;
        Some(last.add_days(-(back as i32)))
    }

    /// First day of the next month.
    pub fn next_month_start(self) -> Date {
        let (y, m, _) = self.ymd();
        if m == 12 { Date::from_ymd(y + 1, 1, 1).unwrap() } else { Date::from_ymd(y, m + 1, 1).unwrap() }
    }
}

impl fmt::Display for Date {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (y, m, d) = self.ymd();
        write!(f, "{y:04}-{m:02}-{d:02}")
    }
}

impl fmt::Debug for Date {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, f)
    }
}

/// A time zone with its DST rule.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
pub enum Zone {
    Utc,
    /// America/New_York: EST UTC-5, EDT UTC-4.
    #[default]
    NewYork,
    /// Europe/London: GMT, BST UTC+1.
    London,
    /// Asia/Tokyo: JST UTC+9, no DST.
    Tokyo,
}

impl Zone {
    /// Accepts IANA names and short aliases (`NY`, `LDN`, `TKY`, `UTC`).
    pub fn parse(s: &str) -> Option<Zone> {
        match s.trim().to_ascii_lowercase().as_str() {
            "utc" | "gmt" | "etc/utc" | "z" => Some(Zone::Utc),
            "america/new_york" | "ny" | "nyc" | "new york" | "us/eastern" => Some(Zone::NewYork),
            "europe/london" | "ldn" | "london" => Some(Zone::London),
            "asia/tokyo" | "tky" | "tokyo" => Some(Zone::Tokyo),
            _ => None,
        }
    }

    /// IANA name.
    pub fn name(self) -> &'static str {
        match self {
            Zone::Utc => "UTC",
            Zone::NewYork => "America/New_York",
            Zone::London => "Europe/London",
            Zone::Tokyo => "Asia/Tokyo",
        }
    }

    fn standard_offset_min(self) -> i64 {
        match self {
            Zone::Utc | Zone::London => 0,
            Zone::NewYork => -300,
            Zone::Tokyo => 540,
        }
    }

    /// (DST start date, DST end date) of `year`, if the zone has DST.
    fn dst_dates(self, year: i32) -> Option<(Date, Date)> {
        match self {
            Zone::NewYork => Some((
                Date::nth_weekday(year, 3, Weekday::Sun, 2).unwrap(),
                Date::nth_weekday(year, 11, Weekday::Sun, 1).unwrap(),
            )),
            Zone::London => Some((Date::last_weekday(year, 3, Weekday::Sun).unwrap(), Date::last_weekday(year, 10, Weekday::Sun).unwrap())),
            _ => None,
        }
    }

    /// UTC offset in minutes at a Unix instant.
    pub fn offset_minutes_at(self, unix_ms: i64) -> i64 {
        let std = self.standard_offset_min();
        let Some((start, end)) = self.dst_dates(Date::from_unix_ms(unix_ms).year()) else { return std };
        // Transition instants in UTC.
        let (s, e) = match self {
            // 02:00 EST = 07:00 UTC; 02:00 EDT = 06:00 UTC.
            Zone::NewYork => (start.unix_ms() + 7 * HOUR_MS, end.unix_ms() + 6 * HOUR_MS),
            // 01:00 UTC both ways.
            _ => (start.unix_ms() + HOUR_MS, end.unix_ms() + HOUR_MS),
        };
        if unix_ms >= s && unix_ms < e { std + 60 } else { std }
    }

    /// UTC offset in minutes for a local wall-clock time. A non-existent time (spring forward) is read
    /// with the summer offset; an ambiguous time (fall back) resolves to the first occurrence (summer).
    pub fn offset_minutes_local(self, date: Date, minute_of_day: u32) -> i64 {
        let std = self.standard_offset_min();
        let Some((start, end)) = self.dst_dates(date.year()) else { return std };
        let m = minute_of_day as i64;
        let (start_min, end_min) = match self {
            Zone::NewYork => (120, 120), // 02:00 local both ways
            _ => (60, 120),              // 01:00 GMT -> BST, 02:00 BST -> GMT
        };
        let after_start = date > start || (date == start && m >= start_min);
        let before_end = date < end || (date == end && m < end_min);
        if after_start && before_end { std + 60 } else { std }
    }

    /// Unix ms of local wall time `hh:mm` on `date`.
    pub fn local_to_unix_ms(self, date: Date, hour: u32, minute: u32) -> i64 {
        let mod_ = hour * 60 + minute;
        let off = self.offset_minutes_local(date, mod_);
        date.unix_ms() + (mod_ as i64 - off) * MINUTE_MS
    }

    /// Local calendar date of an instant.
    pub fn local_date(self, unix_ms: i64) -> Date {
        Date::from_unix_ms(unix_ms + self.offset_minutes_at(unix_ms) * MINUTE_MS)
    }

    /// Local minute of the day (0..1440) of an instant.
    pub fn local_minute_of_day(self, unix_ms: i64) -> u32 {
        let local = unix_ms + self.offset_minutes_at(unix_ms) * MINUTE_MS;
        (local.rem_euclid(DAY_MS) / MINUTE_MS) as u32
    }
}
