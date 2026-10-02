//! Business-time volatility clock.
//!
//! Variance does not accrue evenly in calendar time: FX is shut from Friday 17:00 to Sunday 17:00 New York
//! and is quiet on holidays. Pricing a 0DTE option or an option over a weekend with calendar time would
//! overstate the variance left. The clock counts **trading days** (17:00 New York to 17:00 New York, so
//! Monday's trading day starts on Sunday at 17:00) and weights each one:
//!
//! | trading day             | default weight |
//! |-------------------------|----------------|
//! | business day            | 1.0            |
//! | Saturday / Sunday       | `weekend_weight` (0.15: gap risk only) |
//! | holiday of the calendar | `holiday_weight` (0.5) |
//! | override (event day)    | any (e.g. 1.5 on an NFP / central-bank day) |
//!
//! Vol time between two instants is the weighted fraction of each trading day crossed, divided by the
//! weighted days in an average year (`365 * 5/7 + 365 * 2/7 * weekend_weight`), so an annual vol stays an
//! annual vol. Inside a day the weight accrues linearly (no intraday seasonality yet).
//!
//! Rates still discount on calendar time ([`calendar_years`], ACT/365). The generalized BSM formula only
//! depends on `r t`, `b t` and `sigma^2 t`, so a price with calendar time `t_cal` for carry and vol time
//! `t_vol` for variance is `price(.., t_cal, r, b, effective_vol(sigma, t_vol, t_cal))`.

use std::collections::BTreeMap;

use crate::calendar::HolidayCalendar;
use crate::date::{Date, HOUR_MS, Weekday, Zone};

/// Milliseconds in an ACT/365 year.
pub const YEAR_MS: f64 = 365.0 * 86_400_000.0;

/// Calendar time in years (ACT/365) between two instants (0 if `to <= from`).
pub fn calendar_years(from_ms: i64, to_ms: i64) -> f64 {
    ((to_ms - from_ms).max(0)) as f64 / YEAR_MS
}

/// Vol to use with calendar time `t_cal` so that the variance equals `sigma^2 * t_vol`.
pub fn effective_vol(sigma: f64, t_vol: f64, t_cal: f64) -> f64 {
    if t_cal <= 0.0 || t_vol <= 0.0 {
        return 0.0;
    }
    sigma * (t_vol / t_cal).sqrt()
}

/// The weighted trading-day clock.
#[derive(Clone, Debug, PartialEq)]
pub struct VolClock {
    pub weekend_weight: f64,
    pub holiday_weight: f64,
    overrides: BTreeMap<Date, f64>,
}

impl Default for VolClock {
    fn default() -> Self {
        VolClock::new(0.15, 0.5)
    }
}

/// Trading days roll at 17:00 New York.
const ROLL_HOUR: u32 = 17;

impl VolClock {
    pub fn new(weekend_weight: f64, holiday_weight: f64) -> Self {
        let w = |x: f64| if x.is_finite() { x.clamp(0.0, 10.0) } else { 0.0 };
        VolClock { weekend_weight: w(weekend_weight), holiday_weight: w(holiday_weight), overrides: BTreeMap::new() }
    }

    /// Sets the weight of one trading day (e.g. an event day).
    pub fn with_override(mut self, d: Date, weight: f64) -> Self {
        if weight.is_finite() && weight >= 0.0 {
            self.overrides.insert(d, weight);
        }
        self
    }

    /// Weighted trading days in an average ACT/365 year.
    pub fn year_basis(&self) -> f64 {
        365.0 * 5.0 / 7.0 + 365.0 * 2.0 / 7.0 * self.weekend_weight
    }

    /// The trading day an instant belongs to (after 17:00 New York it is the next day's).
    pub fn trading_date(&self, unix_ms: i64) -> Date {
        let z = Zone::NewYork;
        let local = z.local_date(unix_ms);
        if z.local_minute_of_day(unix_ms) >= ROLL_HOUR * 60 { local.add_days(1) } else { local }
    }

    /// Start of trading day `d` (17:00 New York on the previous calendar day), Unix ms.
    pub fn trading_day_start(&self, d: Date) -> i64 {
        Zone::NewYork.local_to_unix_ms(d.add_days(-1), ROLL_HOUR, 0)
    }

    /// Weight of trading day `d` under the holidays of `cal`.
    pub fn day_weight(&self, d: Date, cal: &HolidayCalendar) -> f64 {
        if let Some(w) = self.overrides.get(&d) {
            return *w;
        }
        if matches!(d.weekday(), Weekday::Sat | Weekday::Sun) {
            self.weekend_weight
        } else if cal.is_holiday(d) {
            self.holiday_weight
        } else {
            1.0
        }
    }

    /// Vol time in years between two instants (0 if `to <= from`).
    pub fn vol_years(&self, from_ms: i64, to_ms: i64, cal: &HolidayCalendar) -> f64 {
        if to_ms <= from_ms {
            return 0.0;
        }
        let mut d = self.trading_date(from_ms);
        let mut start = self.trading_day_start(d);
        let mut acc = 0.0;
        // Bounded loop: one iteration per trading day crossed.
        while start < to_ms {
            let next = self.trading_day_start(d.add_days(1));
            let len = (next - start).max(HOUR_MS) as f64;
            let overlap = (to_ms.min(next) - from_ms.max(start)).max(0) as f64;
            if overlap > 0.0 {
                acc += self.day_weight(d, cal) * overlap / len;
            }
            d = d.add_days(1);
            start = next;
        }
        acc / self.year_basis()
    }
}

/// Rates rescaled so that a model run on vol time `t_vol` discounts and carries exactly as `r` / `b` on
/// calendar time `t_cal`: returns `(r * t_cal / t_vol, b * t_cal / t_vol)`. Used to build a smile (whose
/// deltas live in vol time) with the right forward and spot-delta discounting.
pub fn rates_in_vol_time(r: f64, b: f64, t_cal: f64, t_vol: f64) -> (f64, f64) {
    if t_vol <= 0.0 {
        return (r, b);
    }
    let k = t_cal / t_vol;
    (r * k, b * k)
}
