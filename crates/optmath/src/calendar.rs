//! Business-day calendars and the option expiry calendar.
//!
//! * [`HolidayCalendar`]: a set of holidays; Saturday and Sunday are never business days. A pair's calendar
//!   is the [`HolidayCalendar::union`] of both currencies and USD (New York), so an expiry has to be a
//!   business day in all of them.
//! * Expiry rules ([`ExpiryKind`]):
//!   - **daily**: every business day;
//!   - **weekly**: the Friday of each week;
//!   - **monthly**: the last Friday of each month.
//!
//!   A weekly or monthly date that is not a business day rolls to the **previous** business day (never into
//!   the previous week).
//! * [`Cut`]: the expiry cut as local wall time in a zone (default 10:00 New York, DST-aware), converted to
//!   a UTC instant per date.

use std::collections::BTreeSet;

use crate::date::{Date, Weekday, Zone};

/// Holidays of one or more currencies. Weekends are implicit.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct HolidayCalendar {
    days: BTreeSet<Date>,
}

impl HolidayCalendar {
    pub fn new(days: impl IntoIterator<Item = Date>) -> Self {
        Self { days: days.into_iter().collect() }
    }

    /// Union of several calendars (a date is a holiday if it is one in any of them).
    pub fn union<'a>(cals: impl IntoIterator<Item = &'a HolidayCalendar>) -> Self {
        let mut days = BTreeSet::new();
        for c in cals {
            days.extend(c.days.iter().copied());
        }
        Self { days }
    }

    pub fn insert(&mut self, d: Date) {
        self.days.insert(d);
    }

    pub fn holidays(&self) -> impl Iterator<Item = Date> + '_ {
        self.days.iter().copied()
    }

    pub fn len(&self) -> usize {
        self.days.len()
    }

    pub fn is_empty(&self) -> bool {
        self.days.is_empty()
    }

    pub fn is_holiday(&self, d: Date) -> bool {
        self.days.contains(&d)
    }

    pub fn is_business_day(&self, d: Date) -> bool {
        !d.weekday().is_weekend() && !self.days.contains(&d)
    }

    /// `d` if it is a business day, else the previous business day.
    pub fn adjust_preceding(&self, d: Date) -> Date {
        let mut x = d;
        // Bounded: a run of 370 non-business days would be a broken calendar.
        for _ in 0..370 {
            if self.is_business_day(x) {
                return x;
            }
            x = x.add_days(-1);
        }
        d
    }

    /// `d` if it is a business day, else the next business day.
    pub fn adjust_following(&self, d: Date) -> Date {
        let mut x = d;
        for _ in 0..370 {
            if self.is_business_day(x) {
                return x;
            }
            x = x.add_days(1);
        }
        d
    }

    /// First business day strictly after `d`.
    pub fn next_business_day(&self, d: Date) -> Date {
        self.adjust_following(d.add_days(1))
    }

    /// Last business day strictly before `d`.
    pub fn previous_business_day(&self, d: Date) -> Date {
        self.adjust_preceding(d.add_days(-1))
    }

    /// Moves `n` business days forward (negative = back) from `d`.
    pub fn add_business_days(&self, d: Date, n: i32) -> Date {
        let mut x = d;
        for _ in 0..n.unsigned_abs() {
            x = if n > 0 { self.next_business_day(x) } else { self.previous_business_day(x) };
        }
        x
    }

    /// Business days in `[from, to)`.
    pub fn business_days_between(&self, from: Date, to: Date) -> u32 {
        (from.days()..to.days()).filter(|&d| self.is_business_day(Date::from_days(d))).count() as u32
    }
}

/// Listed expiry cycles.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ExpiryKind {
    Daily,
    Weekly,
    Monthly,
}

impl ExpiryKind {
    pub const ALL: [ExpiryKind; 3] = [ExpiryKind::Daily, ExpiryKind::Weekly, ExpiryKind::Monthly];

    pub fn parse(s: &str) -> Option<ExpiryKind> {
        match s.trim().to_ascii_lowercase().as_str() {
            "daily" | "d" => Some(ExpiryKind::Daily),
            "weekly" | "w" => Some(ExpiryKind::Weekly),
            "monthly" | "m" => Some(ExpiryKind::Monthly),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            ExpiryKind::Daily => "daily",
            ExpiryKind::Weekly => "weekly",
            ExpiryKind::Monthly => "monthly",
        }
    }
}

/// Weekly expiry of the week containing `d` (Monday-Sunday): that week's Friday, rolled back to a business
/// day within the same week. `None` when the whole Monday-Friday is closed.
pub fn weekly_expiry(d: Date, cal: &HolidayCalendar) -> Option<Date> {
    let monday = d.add_days(-(d.weekday().index() as i32));
    let friday = monday.add_days(4);
    let x = cal.adjust_preceding(friday);
    (x >= monday).then_some(x)
}

/// Monthly expiry of a month: its last Friday, rolled back to a business day (staying in the same week).
pub fn monthly_expiry(year: i32, month: u32, cal: &HolidayCalendar) -> Option<Date> {
    let last_friday = Date::last_weekday(year, month, Weekday::Fri)?;
    weekly_expiry(last_friday, cal)
}

/// Expiry dates of `kind` that fall in `[from, to]` (inclusive), ascending.
pub fn expiry_dates(kind: ExpiryKind, from: Date, to: Date, cal: &HolidayCalendar) -> Vec<Date> {
    let mut out = Vec::new();
    if to < from {
        return out;
    }
    match kind {
        ExpiryKind::Daily => {
            for d in from.days()..=to.days() {
                let d = Date::from_days(d);
                if cal.is_business_day(d) {
                    out.push(d);
                }
            }
        }
        ExpiryKind::Weekly => {
            // Mondays from the week of `from` to the week of `to`.
            let mut monday = from.add_days(-(from.weekday().index() as i32));
            while monday <= to {
                if let Some(x) = weekly_expiry(monday, cal)
                    && x >= from
                    && x <= to
                {
                    out.push(x);
                }
                monday = monday.add_days(7);
            }
        }
        ExpiryKind::Monthly => {
            let (y, m, _) = from.ymd();
            let mut first = Date::from_ymd(y, m, 1).unwrap();
            while first <= to {
                let (y, m, _) = first.ymd();
                if let Some(x) = monthly_expiry(y, m, cal)
                    && x >= from
                    && x <= to
                {
                    out.push(x);
                }
                first = first.next_month_start();
            }
        }
    }
    out
}

/// The next `count` expiry dates of `kind` on or after `from`.
pub fn next_expiries(kind: ExpiryKind, from: Date, count: usize, cal: &HolidayCalendar) -> Vec<Date> {
    let mut out = Vec::with_capacity(count);
    let mut start = from;
    // Look ahead in growing windows; 40 years is a hard stop for a broken calendar.
    while out.len() < count && start.year() < from.year() + 40 {
        let span = match kind {
            ExpiryKind::Daily => 31,
            ExpiryKind::Weekly => 7 * 8,
            ExpiryKind::Monthly => 366,
        };
        let end = start.add_days(span);
        for d in expiry_dates(kind, start, end, cal) {
            if out.len() < count {
                out.push(d);
            }
        }
        start = end.add_days(1);
    }
    out
}

/// Expiry cut: local wall time in a zone, e.g. 10:00 New York.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Cut {
    pub hour: u32,
    pub minute: u32,
    pub zone: Zone,
}

impl Default for Cut {
    fn default() -> Self {
        Cut::NY10
    }
}

impl Cut {
    /// The FX market's standard New York cut, 10:00 America/New_York.
    pub const NY10: Cut = Cut { hour: 10, minute: 0, zone: Zone::NewYork };

    /// Parses `HH:MM` and a zone name (see [`Zone::parse`]).
    pub fn parse(time: &str, zone: &str) -> Option<Cut> {
        let (h, m) = time.trim().split_once(':')?;
        let (hour, minute): (u32, u32) = (h.parse().ok()?, m.parse().ok()?);
        (hour < 24 && minute < 60).then_some(())?;
        Some(Cut { hour, minute, zone: Zone::parse(zone)? })
    }

    /// The cut instant on `date` as Unix ms (DST-aware).
    pub fn instant_ms(&self, date: Date) -> i64 {
        self.zone.local_to_unix_ms(date, self.hour, self.minute)
    }

    /// `HH:MM`.
    pub fn time_str(&self) -> String {
        format!("{:02}:{:02}", self.hour, self.minute)
    }
}
