//! Dates, DST, expiry calendar and the business-time vol clock.

use optmath::OptionType::{Call, Put};
use optmath::calendar::{Cut, ExpiryKind, HolidayCalendar, expiry_dates, monthly_expiry, next_expiries, weekly_expiry};
use optmath::date::{Date, HOUR_MS, MINUTE_MS, Weekday, Zone};
use optmath::volclock::{VolClock, calendar_years, effective_vol, rates_in_vol_time};
use optmath::price;
use proptest::prelude::*;

fn d(s: &str) -> Date {
    Date::parse(s).unwrap()
}

fn utc(s: &str) -> i64 {
    // "YYYY-MM-DDTHH:MM"
    let date = d(&s[..10]);
    let h: i64 = s[11..13].parse().unwrap();
    let m: i64 = s[14..16].parse().unwrap();
    date.unix_ms() + h * HOUR_MS + m * MINUTE_MS
}

/// USD (Fed) and EUR (TARGET2) 2026 holidays.
fn eurusd_2026() -> HolidayCalendar {
    let usd = HolidayCalendar::new(
        [
            "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19", "2026-09-07", "2026-10-12", "2026-11-11",
            "2026-11-26", "2026-12-25",
        ]
        .map(d),
    );
    let eur = HolidayCalendar::new(["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25"].map(d));
    HolidayCalendar::union([&usd, &eur])
}

// ------------------------------------------------------------ dates

#[test]
fn civil_dates_round_trip_and_weekdays() {
    for days in -800_000..800_000 {
        if days % 997 != 0 {
            continue;
        }
        let x = Date::from_days(days);
        let (y, m, dd) = x.ymd();
        assert_eq!(Date::from_ymd(y, m, dd), Some(x));
    }
    assert_eq!(d("1970-01-01").days(), 0);
    assert_eq!(d("2026-10-02").weekday(), Weekday::Fri);
    assert_eq!(d("2000-02-29").weekday(), Weekday::Tue);
    assert_eq!(Date::from_ymd(2026, 2, 29), None);
    assert!(Date::from_ymd(2028, 2, 29).is_some());
    assert_eq!(Date::parse("2026-13-01"), None);
    assert_eq!(d("2026-12-31").add_days(1).to_string(), "2027-01-01");
    assert_eq!(Date::nth_weekday(2026, 3, Weekday::Sun, 2), Some(d("2026-03-08")));
    assert_eq!(Date::nth_weekday(2026, 11, Weekday::Sun, 1), Some(d("2026-11-01")));
    assert_eq!(Date::nth_weekday(2026, 11, Weekday::Thu, 4), Some(d("2026-11-26")));
    assert_eq!(Date::nth_weekday(2026, 2, Weekday::Mon, 5), None);
    assert_eq!(Date::last_weekday(2026, 3, Weekday::Sun), Some(d("2026-03-29")));
    assert_eq!(Date::last_weekday(2026, 10, Weekday::Fri), Some(d("2026-10-30")));
}

#[test]
fn time_zone_offsets_follow_dst() {
    let ny = Zone::NewYork;
    assert_eq!(ny.offset_minutes_at(utc("2026-03-08T06:59")), -300);
    assert_eq!(ny.offset_minutes_at(utc("2026-03-08T07:00")), -240);
    assert_eq!(ny.offset_minutes_at(utc("2026-11-01T05:59")), -240);
    assert_eq!(ny.offset_minutes_at(utc("2026-11-01T06:00")), -300);
    let ldn = Zone::London;
    assert_eq!(ldn.offset_minutes_at(utc("2026-03-29T00:59")), 0);
    assert_eq!(ldn.offset_minutes_at(utc("2026-03-29T01:00")), 60);
    assert_eq!(ldn.offset_minutes_at(utc("2026-10-25T00:59")), 60);
    assert_eq!(ldn.offset_minutes_at(utc("2026-10-25T01:00")), 0);
    assert_eq!(Zone::Tokyo.offset_minutes_at(utc("2026-07-01T00:00")), 540);
    assert_eq!(Zone::parse("America/New_York"), Some(Zone::NewYork));
    assert_eq!(Zone::parse("mars"), None);
    // local date / minute
    assert_eq!(ny.local_date(utc("2026-10-02T03:00")), d("2026-10-01"));
    assert_eq!(ny.local_minute_of_day(utc("2026-10-02T14:00")), 600);
}

#[test]
fn ten_am_new_york_cut_is_dst_aware() {
    let cut = Cut::NY10;
    assert_eq!(cut.instant_ms(d("2026-03-06")), utc("2026-03-06T15:00")); // EST
    assert_eq!(cut.instant_ms(d("2026-03-09")), utc("2026-03-09T14:00")); // EDT (US changed, London not yet)
    assert_eq!(cut.instant_ms(d("2026-10-30")), utc("2026-10-30T14:00"));
    assert_eq!(cut.instant_ms(d("2026-11-02")), utc("2026-11-02T15:00"));
    assert_eq!(cut.instant_ms(d("2027-03-15")), utc("2027-03-15T14:00"));
    let tokyo = Cut::parse("15:00", "Asia/Tokyo").unwrap();
    assert_eq!(tokyo.instant_ms(d("2026-10-05")), utc("2026-10-05T06:00"));
    let london = Cut::parse("16:00", "Europe/London").unwrap();
    assert_eq!(london.instant_ms(d("2026-03-27")), utc("2026-03-27T16:00"));
    assert_eq!(london.instant_ms(d("2026-03-30")), utc("2026-03-30T15:00"));
    assert_eq!(Cut::parse("25:00", "NY"), None);
    assert_eq!(cut.time_str(), "10:00");
}

// ------------------------------------------------------------ expiry calendar

#[test]
fn daily_expiries_skip_weekends_and_holidays() {
    let cal = eurusd_2026();
    let days = expiry_dates(ExpiryKind::Daily, d("2026-11-21"), d("2026-11-30"), &cal);
    assert_eq!(days, ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-27", "2026-11-30"].map(d));
    let next = next_expiries(ExpiryKind::Daily, d("2026-10-02"), 8, &cal);
    assert_eq!(next, ["2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-13", "2026-10-14"].map(d));
}

#[test]
fn weekly_expiries_are_fridays_rolled_back() {
    let cal = eurusd_2026();
    // Good Friday (TARGET2) -> Thursday; Christmas Friday -> Thursday 24th.
    assert_eq!(weekly_expiry(d("2026-03-30"), &cal), Some(d("2026-04-02")));
    assert_eq!(weekly_expiry(d("2026-12-21"), &cal), Some(d("2026-12-24")));
    assert_eq!(weekly_expiry(d("2026-10-04"), &cal), Some(d("2026-10-02"))); // Sunday belongs to Mon-Sun week
    // May 1 (TARGET2 Labour Day) is a Friday: that week expires on Thursday 30 April.
    let w = expiry_dates(ExpiryKind::Weekly, d("2026-03-28"), d("2026-04-30"), &cal);
    assert_eq!(w, ["2026-04-02", "2026-04-10", "2026-04-17", "2026-04-24", "2026-04-30"].map(d));
    // A week that is closed Thursday and Friday rolls to Wednesday, a fully closed week has none.
    let mut odd = HolidayCalendar::new(["2026-10-15", "2026-10-16"].map(d));
    assert_eq!(weekly_expiry(d("2026-10-12"), &odd), Some(d("2026-10-14")));
    for x in ["2026-10-12", "2026-10-13", "2026-10-14"] {
        odd.insert(d(x));
    }
    assert_eq!(weekly_expiry(d("2026-10-12"), &odd), None);
}

#[test]
fn monthly_expiries_are_last_fridays_rolled_back() {
    let cal = eurusd_2026();
    assert_eq!(monthly_expiry(2026, 10, &cal), Some(d("2026-10-30")));
    assert_eq!(monthly_expiry(2026, 11, &cal), Some(d("2026-11-27"))); // day after Thanksgiving is open
    assert_eq!(monthly_expiry(2026, 12, &cal), Some(d("2026-12-24"))); // Christmas Friday
    assert_eq!(monthly_expiry(2026, 4, &cal), Some(d("2026-04-24")));
    let m = expiry_dates(ExpiryKind::Monthly, d("2026-10-02"), d("2027-01-31"), &cal);
    assert_eq!(m, ["2026-10-30", "2026-11-27", "2026-12-24", "2027-01-29"].map(d));
    assert_eq!(next_expiries(ExpiryKind::Monthly, d("2026-10-31"), 3, &cal), ["2026-11-27", "2026-12-24", "2027-01-29"].map(d));
    assert_eq!(ExpiryKind::parse("Weekly"), Some(ExpiryKind::Weekly));
}

#[test]
fn business_day_helpers() {
    let cal = eurusd_2026();
    assert!(!cal.is_business_day(d("2026-12-25")));
    assert!(!cal.is_business_day(d("2026-12-26")));
    assert_eq!(cal.next_business_day(d("2026-12-24")), d("2026-12-28"));
    assert_eq!(cal.previous_business_day(d("2026-04-06")), d("2026-04-02"));
    assert_eq!(cal.add_business_days(d("2026-04-02"), 1), d("2026-04-07"));
    assert_eq!(cal.add_business_days(d("2026-04-07"), -1), d("2026-04-02"));
    assert_eq!(cal.business_days_between(d("2026-11-23"), d("2026-11-30")), 4);
}

// ------------------------------------------------------------ vol clock

#[test]
fn vol_clock_weights_weekends_and_holidays() {
    let cal = eurusd_2026();
    let clock = VolClock::new(0.15, 0.5);
    let basis = clock.year_basis();
    assert!((basis - (365.0 * 5.0 / 7.0 + 365.0 * 2.0 / 7.0 * 0.15)).abs() < 1e-12);
    // Fri 17:00 NY -> Mon 17:00 NY (EDT): Saturday + Sunday + Monday trading days.
    let t = clock.vol_years(utc("2026-10-02T21:00"), utc("2026-10-05T21:00"), &cal);
    assert!((t - (0.15 + 0.15 + 1.0) / basis).abs() < 1e-15, "{t}");
    // Fri 16:00 NY -> Mon 10:00 NY: 1 h of Friday, the weekend, 17 h of Monday's day.
    let t = clock.vol_years(utc("2026-10-02T20:00"), utc("2026-10-05T14:00"), &cal);
    assert!((t - (1.0 / 24.0 + 0.3 + 17.0 / 24.0) / basis).abs() < 1e-15, "{t}");
    // Thanksgiving (USD holiday) counts half.
    let t = clock.vol_years(utc("2026-11-25T22:00"), utc("2026-11-26T22:00"), &cal);
    assert!((t - 0.5 / basis).abs() < 1e-15, "{t}");
    // DST change inside a trading day (23 h long): still exactly one weighted day.
    let t = clock.vol_years(utc("2026-03-07T22:00"), utc("2026-03-08T21:00"), &cal);
    assert!((t - 0.15 / basis).abs() < 1e-15, "{t}");
    // Event-day override.
    let ev = VolClock::new(0.15, 0.5).with_override(d("2026-10-06"), 2.0);
    let t = ev.vol_years(utc("2026-10-05T21:00"), utc("2026-10-06T21:00"), &cal);
    assert!((t - 2.0 / ev.year_basis()).abs() < 1e-15);
    assert_eq!(clock.vol_years(10, 5, &cal), 0.0);
    // Trading date rolls at 17:00 New York.
    assert_eq!(clock.trading_date(utc("2026-10-02T20:59")), d("2026-10-02"));
    assert_eq!(clock.trading_date(utc("2026-10-02T21:00")), d("2026-10-03"));
}

#[test]
fn flat_clock_matches_calendar_time_over_whole_weeks() {
    let clock = VolClock::new(1.0, 1.0);
    let cal = HolidayCalendar::default();
    let (a, b) = (utc("2026-06-01T12:00"), utc("2026-06-29T12:00"));
    assert!((clock.vol_years(a, b, &cal) - calendar_years(a, b)).abs() < 1e-15);
}

#[test]
fn weekend_is_almost_free_for_a_short_option() {
    // Friday 15:00 NY -> Monday 10:00 NY cut: the business clock gives far less variance than calendar time.
    let cal = eurusd_2026();
    let clock = VolClock::default();
    let (now, cut) = (utc("2026-10-02T19:00"), Cut::NY10.instant_ms(d("2026-10-05")));
    let tv = clock.vol_years(now, cut, &cal);
    let tc = calendar_years(now, cut);
    // 1h Friday + 2 x 0.15 weekend + 17h Monday = 1.09 weighted days vs 2.79 calendar days.
    assert!(tv < 0.55 * tc, "vol time {tv} vs calendar {tc}");
    let v_bt = price(Call, 1.17, 1.17, tc, 0.04, 0.02, effective_vol(0.08, tv, tc));
    let v_cal = price(Call, 1.17, 1.17, tc, 0.04, 0.02, 0.08);
    assert!(v_bt < v_cal);
}

proptest! {
    #[test]
    fn vol_time_is_additive_and_monotone(a in 0i64..60 * 86_400_000, len1 in 0i64..20 * 86_400_000, len2 in 0i64..20 * 86_400_000) {
        let cal = eurusd_2026();
        let clock = VolClock::new(0.2, 0.4);
        let t0 = utc("2026-09-01T00:00") + a;
        let (t1, t2) = (t0 + len1, t0 + len1 + len2);
        let x = clock.vol_years(t0, t1, &cal);
        let y = clock.vol_years(t1, t2, &cal);
        let z = clock.vol_years(t0, t2, &cal);
        prop_assert!((x + y - z).abs() < 1e-12);
        prop_assert!(x >= 0.0 && z >= x);
    }

    #[test]
    fn business_time_pricing_equals_rescaled_rates(s in 0.5f64..2.0, k in 0.5f64..2.0, tc in 0.001f64..1.0, ratio in 0.05f64..1.5, r in -0.01f64..0.08, b in -0.05f64..0.05, sig in 0.03f64..0.6) {
        let tv = tc * ratio;
        for kind in [Call, Put] {
            let a = price(kind, s, k, tc, r, b, effective_vol(sig, tv, tc));
            let (r2, b2) = rates_in_vol_time(r, b, tc, tv);
            let c = price(kind, s, k, tv, r2, b2, sig);
            prop_assert!((a - c).abs() < 1e-12 * a.abs().max(1.0), "{a} vs {c}");
        }
    }

    #[test]
    fn cut_is_always_ten_new_york_local(days in 18_000i32..22_000) {
        let date = Date::from_days(days);
        let ms = Cut::NY10.instant_ms(date);
        prop_assert_eq!(Zone::NewYork.local_date(ms), date);
        prop_assert_eq!(Zone::NewYork.local_minute_of_day(ms), 600);
    }

    #[test]
    fn expiries_are_business_days_in_order(start in 20_000i32..21_000, span in 1i32..200) {
        let cal = eurusd_2026();
        let (from, to) = (Date::from_days(start), Date::from_days(start + span));
        for kind in ExpiryKind::ALL {
            let v = expiry_dates(kind, from, to, &cal);
            prop_assert!(v.windows(2).all(|w| w[0] < w[1]));
            for x in &v {
                prop_assert!(cal.is_business_day(*x) && *x >= from && *x <= to);
                if kind != ExpiryKind::Daily {
                    // never later than that week's Friday
                    prop_assert!(x.weekday() <= Weekday::Fri);
                }
            }
        }
    }
}
