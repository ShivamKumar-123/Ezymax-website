//! Instrument catalogue: the 28 core instruments keep exactly their specs, catalogue instruments take their
//! templates (with Back Office overrides), sessions follow their exchange and holiday calendar, forex / metals /
//! energies / indices / crypto trade live by default (stocks and kept-off symbols do not, unless switched on), and
//! every live-enabled catalogue symbol opens, values, stops out and closes with a balanced ledger.

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
        let default_on = ["forex", "metals", "energies", "indices", "crypto"].contains(&x.asset_class.as_str()) && x.live_off.is_none();
        assert!(x.template.is_some(), "{}", x.symbol);
        assert_eq!(x.live, default_on, "{}: live by default for the five classes unless kept off", x.symbol);
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
    assert!(bnb.swap_all_days && bnb.session == Session::Always && bnb.max_leverage == 10);
    assert_eq!(bnb.swap_mode, crate::specs::SwapMode::PercentYear);
    assert_eq!(s.get("EURUSD").unwrap().swap_mode, crate::specs::SwapMode::Points, "core swaps stay in points");
    // kept off live trading by default, with the reason
    assert!(s.get("USDTRY").unwrap().live_off.is_some() && !s.get("USDTRY").unwrap().live);
    assert!(!s.get("MSFT").unwrap().live && s.get("MSFT").unwrap().live_off.is_none(), "stocks wait for corporate actions");
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
fn live_defaults_class_and_symbol_switches() {
    // defaults: forex live, stocks demo only, a kept-off pair demo only
    let mut kit = catalogue_kit(Overrides::default());
    kit.now = t("2026-09-28T15:00:00Z"); // Monday, US session open
    kit.quote("AUDCAD", "0.91000", "0.91015");
    kit.quote("USDCAD", "1.38000", "1.38010");
    kit.quote("MSFT", "520.00", "520.10");
    kit.quote("USDTRY", "49.1900", "49.2100");
    kit.quote("EURUSD", "1.10000", "1.10010");
    let mut live = Harness::live(&kit, "hedge", "10000");
    let r = live.run(&kit, |tx, env| trade::place_order(tx, env, buy("AUDCAD", "0.1"))).unwrap();
    let PlaceResult::Filled { position_ticket: Some(ticket), .. } = r else { panic!("{r:?}") };
    for sym in ["MSFT", "USDTRY"] {
        let v = if sym == "MSFT" { "1" } else { "0.01" };
        assert_eq!(live.run(&kit, |tx, env| trade::place_order(tx, env, buy(sym, v))).unwrap_err().code, "symbol_demo_only", "{sym}");
    }
    let mut lim = buy("MSFT", "1");
    lim.kind = OrderType::Limit;
    lim.price = Some(d("500.00"));
    assert_eq!(live.run(&kit, |tx, env| trade::place_order(tx, env, lim.clone())).unwrap_err().code, "symbol_demo_only", "pending orders too");
    // demo trades everything, stocks included
    let mut demo = Harness::demo(&kit, "hedge");
    for (sym, v) in [("MSFT", "1"), ("USDTRY", "0.01"), ("AUDCAD", "0.1")] {
        assert!(matches!(demo.run(&kit, |tx, env| trade::place_order(tx, env, buy(sym, v))).unwrap(), PlaceResult::Filled { .. }), "{sym}");
    }
    demo.assert_ledger();
    demo.assert_replay();

    // the platform switches forex off: new live forex positions refused, the open one still closes
    let off = Overrides { live_classes: BTreeMap::from([("forex".to_string(), false)]), ..Default::default() };
    let mut kit2 = catalogue_kit(off.clone());
    kit2.now = kit.now;
    for (s, b, a) in [("AUDCAD", "0.91100", "0.91115"), ("USDCAD", "1.38000", "1.38010")] {
        kit2.quote(s, b, a);
    }
    assert_eq!(live.run(&kit2, |tx, env| trade::place_order(tx, env, buy("AUDCAD", "0.1"))).unwrap_err().code, "symbol_demo_only");
    let (_, profit) = live.run(&kit2, |tx, env| trade::close_position(tx, env, ticket, CloseReq::default())).unwrap();
    // (0.91100 − 0.91015) × 10 000 CAD = 8.5 CAD → / 1.38005 USD (converted, never taken as USD)
    assert_eq!(crate::money::r2(profit), d("6.16"));
    // ... a symbol switched on wins over its class; a class switched on does not turn on a kept-off symbol
    let mut ov = off;
    ov.live_symbols.insert("AUDCAD".into(), true);
    ov.live_classes.insert("stocks".into(), true);
    ov.live_classes.insert("forex".into(), true);
    let s = kit.specs.with_overrides(ov.clone()).unwrap();
    assert!(s.get("AUDCAD").unwrap().live && s.get("MSFT").unwrap().live && !s.get("USDTRY").unwrap().live);
    ov.live_symbols.insert("USDTRY".into(), true);
    assert!(kit.specs.with_overrides(ov).unwrap().get("USDTRY").unwrap().live, "only its own switch turns it on");
    live.assert_ledger();
    live.assert_replay();
}

#[test]
fn percent_swaps_follow_the_position_value() {
    let kit = catalogue_kit(Overrides::default());
    let spec = kit.specs.get("BNBUSD").unwrap().clone();
    kit.quote("BNBUSD", "770.00", "770.20");
    let mut h = Harness::live(&kit, "hedge", "100000");
    h.run(&kit, |tx, env| trade::place_order(tx, env, buy("BNBUSD", "1"))).unwrap();
    // the rollover after opening: crypto swaps every night, −20 % a year / 365 of 1 lot × 10 coins × 770.10 (mid)
    let day = chrono::NaiveDate::from_ymd_opt(2026, 9, 28).unwrap();
    h.run(&kit, |tx, env| {
        super::risk::rollover(tx, env, day, t("2026-09-28T21:00:00Z"));
        Ok(())
    })
    .unwrap();
    let swap = h.st.positions.values().next().unwrap().swap;
    let want = crate::money::r2(d("-20") / d("100") / d("365") * spec.contract_size * d("770.10"));
    assert_eq!(swap, want);
    assert_eq!(want, d("-4.22"));
    // core swaps are unchanged (points)
    let eu = kit.specs.get("EURUSD").unwrap();
    assert_eq!(eu.swap_per_night(true, D::ONE, d("1.1")), d("-7.2") * eu.point * eu.contract_size);
    h.assert_ledger();
    h.assert_replay();
}

/// Snapshot price of every provider code (config/provider/infoway-snapshot.json).
fn snapshot_prices() -> std::collections::HashMap<String, f64> {
    let v: serde_json::Value = serde_json::from_str(include_str!("../../../../config/provider/infoway-snapshot.json")).unwrap();
    v["rows"].as_array().unwrap().iter().map(|r| (r["code"].as_str().unwrap().to_string(), r["close"].as_f64().unwrap())).collect()
}

fn instruments() -> Vec<serde_json::Value> {
    serde_json::from_str(include_str!("../../../../config/instruments.json")).unwrap()
}

fn px(x: f64, digits: u32) -> D {
    crate::money::rdp(crate::money::from_f64(x).unwrap(), digits)
}

/// Every catalogue symbol that trades live: a minimum lot opens on a live account at the snapshot price with the
/// expected USD margin, its P&L converts to USD, a move against it stops the account out (negative balance
/// protection included), it closes, and the ledger and the event replay stay exact.
#[test]
fn every_live_catalogue_symbol_opens_values_stops_out_and_closes() {
    let prices = snapshot_prices();
    let rows = instruments();
    let mut kit = catalogue_kit(Overrides::default());
    // conversion pairs: every core FX pair and catalogue FX pair at its snapshot price
    let quote_all = |kit: &Kit| {
        for r in rows.iter().filter(|r| r["asset_class"] == "forex") {
            let (sym, code, digits) = (r["symbol"].as_str().unwrap(), r["provider"]["code"].as_str().unwrap(), r["digits"].as_u64().unwrap() as u32);
            if let Some(p) = prices.get(code) {
                let spec = kit.specs.get(sym).unwrap();
                let half = spec.round_price(crate::money::from_f64(r["base_spread"].as_f64().unwrap()).unwrap() / D::TWO);
                let mid = px(*p, digits);
                kit.quote(sym, &(mid - half).to_string(), &(mid + half).to_string());
            }
        }
    };
    let live: Vec<_> = kit.specs.all().filter(|s| !s.core && s.live).map(|s| s.symbol.clone()).collect();
    assert!(live.len() > 200, "{} live catalogue symbols", live.len());
    let mut checked = 0;
    for sym in live {
        let spec = kit.specs.get(&sym).unwrap().clone();
        let row = rows.iter().find(|r| r["symbol"] == sym.as_str()).unwrap();
        let p = *prices.get(row["provider"]["code"].as_str().unwrap()).unwrap_or_else(|| panic!("{sym}: no snapshot price"));
        // a moment its market is open (Monday 2026-09-28 onwards)
        let mut at = t("2026-09-28T00:00:00Z");
        while !spec.is_open(at) {
            at += chrono::Duration::minutes(30);
        }
        kit.now = at;
        quote_all(&kit);
        let mid = px(p, spec.digits);
        let half = spec.round_price(crate::money::from_f64(row["base_spread"].as_f64().unwrap()).unwrap() / D::TWO).max(spec.point);
        kit.quote(&sym, &(mid - half).to_string(), &(mid + half).to_string());

        // open the minimum lot on a well-funded live account
        let mut h = Harness::live(&kit, "hedge", "1000000");
        let r = h.run(&kit, |tx, env| trade::place_order(tx, env, buy(&sym, &spec.lot_min.to_string()))).unwrap_or_else(|e| panic!("{sym}: {e}"));
        let PlaceResult::Filled { position_ticket: Some(ticket), .. } = r else { panic!("{sym}: {r:?}") };
        let env = kit.env(&h.st);
        let usd_per_quote = env.to_usd(&h.st.account, &spec.quote_ccy, D::ONE, (&sym, mid)).unwrap_or_else(|| panic!("{sym}: {} does not convert", spec.quote_ccy));
        let lev = D::from(h.st.account.leverage.min(spec.max_leverage));
        let want_margin = spec.contract_size * mid * spec.lot_min * usd_per_quote * spec.margin_pct / crate::money::HUNDRED / lev;
        let m = super::metrics(&env, &h.st);
        assert!((m.margin - want_margin).abs() <= want_margin * d("0.001") + d("0.01"), "{sym}: margin {} vs {}", m.margin, want_margin);
        // one lot is a sensible amount of money for the classes sized by notional
        if spec.asset_class == "crypto" || spec.asset_class == "indices" {
            let lot_usd = spec.contract_size * mid * usd_per_quote;
            // 1,000-10,000 USD, or a single unit when one unit is already worth more
            assert!(lot_usd >= d("900") && (lot_usd < d("11000") || spec.contract_size == D::ONE), "{sym}: one lot = {lot_usd} USD");
        }
        // close at the bid: the round trip costs the spread, converted to USD
        let (_, profit) = h.run(&kit, |tx, env| trade::close_position(tx, env, ticket, CloseReq::default())).unwrap();
        let want = -(D::TWO * half) * spec.contract_size * spec.lot_min * usd_per_quote;
        assert!((profit - want).abs() <= want.abs() * d("0.01") + d("0.02"), "{sym}: round trip {profit} vs {want}");
        h.assert_ledger();
        h.assert_replay();

        // stop-out: an account holding just over the margin, then the price falls far enough to wipe it out
        let deposit = crate::money::r2(want_margin * d("1.5") + d("1"));
        let mut h = Harness::live(&kit, "hedge", &deposit.to_string());
        h.run(&kit, |tx, env| trade::place_order(tx, env, buy(&sym, &spec.lot_min.to_string()))).unwrap_or_else(|e| panic!("{sym} (small account): {e}"));
        let drop = spec.round_price(deposit * d("1.5") / (spec.contract_size * spec.lot_min * usd_per_quote)) + spec.point;
        assert!(mid - drop > D::ZERO, "{sym}: test move below zero");
        kit.quote(&sym, &(mid - drop - half).to_string(), &(mid - drop + half).to_string());
        h.tick(&kit, &sym);
        assert!(h.st.positions.is_empty(), "{sym}: stopped out");
        assert!(h.st.balance >= D::ZERO, "{sym}: negative balance protection");
        h.assert_ledger();
        h.assert_replay();
        checked += 1;
    }
    assert!(checked > 200);
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
