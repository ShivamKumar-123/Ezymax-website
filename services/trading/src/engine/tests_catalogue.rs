//! Instrument catalogue: the 28 core instruments keep exactly their specs, catalogue instruments take the
//! conservative templates (with Back Office overrides), sessions follow their exchange and holiday calendar, and
//! live trading on a catalogue instrument is refused until the platform enables it (demo always trades).

use std::collections::BTreeMap;

use super::testkit::{Harness, Kit, d, t};
use super::trade::{self, CloseReq, OrderReq, PlaceResult};
use crate::model::{OrderType, Side};
use crate::money::D;
use crate::specs::{Overrides, RawSpec, Session, Specs};

const OLD_INSTRUMENTS: &str = include_str!("../../tests/fixtures/instruments-core-2026-10-07.json");
const OLD_SPECS: &str = include_str!("../../tests/fixtures/trading-specs-core-2026-10-07.json");

fn repo() -> Specs {
    crate::specs::test_specs()
}

fn buy(sym: &str, v: &str) -> OrderReq {
    OrderReq::market(sym, Side::Buy, d(v))
}

/// Debug text of every field that decides trading (holidays and catalogue metadata excluded: core has none).
fn key(s: &crate::specs::Spec) -> String {
    format!(
        "{} {} {} {} {} {} {} {} {} {} {} {} {} {:?} {} {:?} {} {:?} {:?}",
        s.symbol, s.asset_class, s.digits, s.point, s.pip_size, s.contract_size, s.quote_ccy, s.lot_min, s.lot_max, s.lot_step, s.margin_pct, s.max_leverage, s.swap_long, s.swap_short, s.swap_all_days, s.triple_swap_day, s.stops_level_points, s.session, s.commission_per_lot
    )
}

#[test]
fn the_28_core_instruments_keep_exactly_their_specs() {
    let old = Specs::parse(OLD_INSTRUMENTS, OLD_SPECS).unwrap();
    let new = repo();
    assert_eq!(old.len(), 28);
    for o in old.all() {
        let n = new.get(&o.symbol).unwrap_or_else(|| panic!("{} disappeared", o.symbol));
        assert_eq!(key(o), key(n), "{} changed", o.symbol);
        assert!(n.core && n.live && n.holidays.is_none() && n.template.is_none(), "{} must stay a core, live instrument", o.symbol);
    }
    assert_eq!(new.all().filter(|s| s.core).count(), 28);
    // conversion pairs of the core currencies are unchanged by the catalogue (core pairs win)
    for ccy in ["JPY", "EUR", "GBP", "CAD", "CHF", "INR", "AUD"] {
        assert_eq!(new.usd_pair(ccy), old.usd_pair(ccy), "{ccy}");
    }
}

#[test]
fn catalogue_loads_with_templates_sessions_and_calendars() {
    let s = repo();
    assert!(s.len() > 1000, "catalogue has {} instruments", s.len());
    let cat: Vec<_> = s.all().filter(|x| !x.core).collect();
    assert_eq!(cat.len() + 28, s.len());
    for x in &cat {
        assert!(x.template.is_some() && !x.live, "{}: template and live off by default", x.symbol);
        if x.quote_ccy != "USD" {
            assert!(s.usd_pair(&x.quote_ccy).is_some(), "{}: {} does not convert to USD", x.symbol, x.quote_ccy);
        }
    }
    // file templates are valid as they stand
    let src = s.source().unwrap();
    for k in src.template_keys() {
        src.template(&k).unwrap().validate_template().unwrap_or_else(|e| panic!("template {k}: {e:?}"));
    }
    let fx = s.get("AUDCAD").unwrap();
    assert_eq!((fx.contract_size, fx.max_leverage, fx.session), (D::from(100000), 100, Session::Fx));
    assert_eq!(fx.pip_size, d("0.0001"));
    assert_eq!(s.get("USDTRY").unwrap().max_leverage, 20, "exotic template");
    let msft = s.get("MSFT").unwrap();
    assert_eq!((msft.lot_min, msft.lot_step, msft.max_leverage), (D::ONE, D::ONE, 5));
    assert_eq!(msft.session, Session::parse("us_equity").unwrap());
    assert_eq!(msft.holidays.as_ref().unwrap().calendar, "NYSE");
    assert_eq!(s.get("00700.HK").unwrap().quote_ccy, "HKD");
    assert_eq!(s.get("00700.HK").unwrap().contract_size, D::from(100));
    assert_eq!(s.get("XCUUSD").unwrap().contract_size, D::from(10000), "per-symbol override over the template");
    let bnb = s.get("BNBUSD").unwrap();
    assert!(bnb.swap_all_days && bnb.session == Session::Always && bnb.max_leverage == 5);
    assert_eq!(s.get("DOGEUSD").unwrap().contract_size, D::from(1000), "cheap coins: 1,000 per lot");
    // new currencies convert through catalogue pairs
    assert_eq!(s.usd_pair("SGD"), Some(("USDSGD".into(), false)));
    assert_eq!(s.usd_pair("NZD"), Some(("NZDUSD".into(), true)));
    assert_eq!(s.usd_pair("HKD"), Some(("USDHKD".into(), false)));
}

#[test]
fn sessions_and_holidays_per_class() {
    let s = repo();
    let open = |sym: &str, at: &str| s.get(sym).unwrap_or_else(|| panic!("{sym}")).is_open(t(at));
    // forex: weekend close (Friday 21:00 UTC in September), no holiday closures
    assert!(open("AUDCAD", "2026-09-25T20:59:00Z") && !open("AUDCAD", "2026-09-26T10:00:00Z"));
    assert!(open("AUDCAD", "2026-11-26T15:00:00Z"), "FX trades on US Thanksgiving");
    // crypto: around the clock
    assert!(open("BNBUSD", "2026-09-26T10:00:00Z") && open("BNBUSD", "2026-12-25T10:00:00Z"));
    // US stocks: NYSE hours and holidays, early close; the core AAPL keeps its original rules (no calendar)
    assert!(open("MSFT", "2026-11-25T15:00:00Z"));
    assert!(!open("MSFT", "2026-11-26T15:00:00Z"), "Thanksgiving");
    assert!(open("AAPL", "2026-11-26T15:00:00Z"), "core instrument unchanged");
    assert!(open("MSFT", "2026-11-27T17:59:00Z") && !open("MSFT", "2026-11-27T18:00:00Z"), "13:00 early close");
    assert!(!open("MSFT", "2026-04-03T15:00:00Z"), "Good Friday");
    // Hong Kong: lunch break, HKEX holiday (National Day), half day
    assert!(open("00700.HK", "2026-10-07T02:00:00Z") && !open("00700.HK", "2026-10-07T04:30:00Z"));
    assert!(!open("00700.HK", "2026-10-01T02:00:00Z"));
    assert!(open("00700.HK", "2026-12-24T03:59:00Z") && !open("00700.HK", "2026-12-24T05:30:00Z"), "Christmas Eve half day");
    // Tokyo: JPY calendar (Sports Day), 15:30 close
    assert!(!open("7203.JP", "2026-10-12T02:00:00Z"));
    assert!(open("7203.JP", "2026-10-13T06:29:00Z") && !open("7203.JP", "2026-10-13T06:30:00Z"));
    // index CFD on the server-day schedule, closed on its exchange's holidays
    assert!(open("HK50", "2026-10-02T10:00:00Z") && !open("HK50", "2026-10-01T10:00:00Z"));
    // metals / energies: London + New York / NYMEX holidays
    assert!(!open("XPTUSD", "2026-12-25T12:00:00Z") && open("XPTUSD", "2026-12-23T12:00:00Z"));
    assert!(!open("WTI", "2026-11-26T15:00:00Z"));
}

#[test]
fn template_overrides_change_catalogue_only_and_bad_values_are_refused() {
    let s = repo();
    let mut ov = Overrides::default();
    ov.templates.insert("forex".into(), RawSpec { max_leverage: Some(30), lot_max: Some(5.0), ..Default::default() });
    let s2 = s.with_overrides(ov).unwrap();
    assert_eq!(s2.get("AUDCAD").unwrap().max_leverage, 30);
    assert_eq!(s2.get("AUDCAD").unwrap().lot_max, d("5"));
    assert_eq!(key(s.get("EURUSD").unwrap()), key(s2.get("EURUSD").unwrap()), "core untouched");
    assert_eq!(s2.get("USDTRY").unwrap().max_leverage, 20, "other templates untouched");
    let base = s.source().unwrap().template("forex").unwrap().clone();
    for (bad, field) in [
        (RawSpec { lot_min: Some(0.0), ..Default::default() }, "lot_min"),
        (RawSpec { lot_min: Some(10.0), lot_max: Some(1.0), ..Default::default() }, "lot_min"),
        (RawSpec { lot_min: Some(0.015), ..Default::default() }, "lot_step"),
        (RawSpec { margin_pct: Some(0.5), ..Default::default() }, "margin_pct"),
        (RawSpec { max_leverage: Some(5000), ..Default::default() }, "max_leverage"),
        (RawSpec { session: Some("moon".into()), ..Default::default() }, "session"),
        (RawSpec { swap_days: Some("weekends".into()), ..Default::default() }, "swap_days"),
        (RawSpec { triple_swap_day: Some(Some("someday".into())), ..Default::default() }, "triple_swap_day"),
        (RawSpec { commission_per_lot: Some(-1.0), ..Default::default() }, "commission_per_lot"),
    ] {
        assert_eq!(base.merged(&bad).validate_template().unwrap_err().0, field);
    }
}

fn catalogue_kit(ov: Overrides) -> Kit {
    let mut kit = Kit::new();
    kit.specs = kit.specs.with_overrides(ov).unwrap();
    kit
}

#[test]
fn live_accounts_are_refused_on_catalogue_symbols_until_enabled_demo_trades() {
    let kit = catalogue_kit(Overrides::default());
    kit.quote("AUDCAD", "0.91000", "0.91015");
    kit.quote("USDCAD", "1.38000", "1.38010");
    // live: refused, market and pending alike
    let mut live = Harness::live(&kit, "hedge", "10000");
    let e = live.run(&kit, |tx, env| trade::place_order(tx, env, buy("AUDCAD", "0.1"))).unwrap_err();
    assert_eq!(e.code, "symbol_demo_only");
    let mut lim = buy("AUDCAD", "0.1");
    lim.kind = OrderType::Limit;
    lim.price = Some(d("0.90000"));
    assert_eq!(live.run(&kit, |tx, env| trade::place_order(tx, env, lim.clone())).unwrap_err().code, "symbol_demo_only");
    // core symbols are not affected
    kit.quote("EURUSD", "1.10000", "1.10010");
    assert!(matches!(live.run(&kit, |tx, env| trade::place_order(tx, env, buy("EURUSD", "0.1"))).unwrap(), PlaceResult::Filled { .. }));
    // demo: trades
    let mut demo = Harness::demo(&kit, "hedge");
    let r = demo.run(&kit, |tx, env| trade::place_order(tx, env, buy("AUDCAD", "0.1"))).unwrap();
    assert!(matches!(r, PlaceResult::Filled { .. }), "{r:?}");
    demo.assert_ledger();
    demo.assert_replay();

    // the platform enables forex: live trades; then disables AUDCAD alone: new positions refused, closing allowed
    let kit = catalogue_kit(Overrides { live_classes: ["forex".to_string()].into(), ..Default::default() });
    kit.quote("AUDCAD", "0.91000", "0.91015");
    kit.quote("USDCAD", "1.38000", "1.38010");
    let r = live.run(&kit, |tx, env| trade::place_order(tx, env, buy("AUDCAD", "0.1"))).unwrap();
    let PlaceResult::Filled { position_ticket: Some(ticket), .. } = r else { panic!("{r:?}") };
    // P&L in CAD is converted with USDCAD (never taken as USD)
    let kit = catalogue_kit(Overrides { live_classes: ["forex".to_string()].into(), live_symbols: BTreeMap::from([("AUDCAD".to_string(), false)]), ..Default::default() });
    kit.quote("AUDCAD", "0.91100", "0.91115");
    kit.quote("USDCAD", "1.38000", "1.38010");
    assert_eq!(live.run(&kit, |tx, env| trade::place_order(tx, env, buy("AUDCAD", "0.1"))).unwrap_err().code, "symbol_demo_only");
    let (_, profit) = live.run(&kit, |tx, env| trade::close_position(tx, env, ticket, CloseReq::default())).unwrap();
    // (0.91100 − 0.91015) × 10 000 CAD = 8.5 CAD → / 1.38005 USD
    assert_eq!(crate::money::r2(profit), d("6.16"));
    live.assert_ledger();
    live.assert_replay();
}

#[test]
fn no_conversion_price_means_no_new_position() {
    let kit = catalogue_kit(Overrides::default());
    // XAUTHB is quoted in THB; USDTHB has no price yet
    kit.quote("XAUTHB", "134000.00", "134050.00");
    let mut demo = Harness::demo(&kit, "hedge");
    assert_eq!(demo.run(&kit, |tx, env| trade::place_order(tx, env, buy("XAUTHB", "0.01"))).unwrap_err().code, "no_conversion");
    kit.quote("USDTHB", "32.5000", "32.5200");
    assert!(matches!(demo.run(&kit, |tx, env| trade::place_order(tx, env, buy("XAUTHB", "0.01"))).unwrap(), PlaceResult::Filled { .. }));
}
