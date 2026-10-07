//! Corporate actions on one account (engine/corporate.rs): a split keeps every position's value and P&L, adjusts
//! SL / TP and pending orders; a dividend credits longs net of withholding and debits shorts gross through the
//! ledger in the account currency; a second run changes nothing; replay rebuilds the same account; while an action
//! is due but not applied, the symbol does not trade and the account is not stopped out.

use std::collections::BTreeMap;

use super::corporate::{self, CorpAction, CorpKind};
use super::testkit::{Harness, Kit, d, t};
use super::trade::{self, OrderReq, PlaceResult};
use crate::model::{OrderType, Side};
use crate::money::r2;
use crate::specs::Overrides;

/// Stocks live, Wednesday 2026-10-14 15:00 UTC (US session open).
fn kit() -> Kit {
    let mut k = Kit::new();
    k.specs = k.specs.with_overrides(Overrides { live_classes: BTreeMap::from([("stocks".to_string(), true)]), ..Default::default() }).unwrap();
    k.now = t("2026-10-14T15:00:00Z");
    k
}

/// Ex-date Thursday 2026-10-15: applies at 00:00 New York (04:00 UTC).
const APPLY_AT: &str = "2026-10-15T04:00:00Z";

fn split(id: i64, symbol: &str, from: &str, to: &str) -> CorpAction {
    CorpAction { id, symbol: symbol.into(), ex_date: chrono::NaiveDate::from_ymd_opt(2026, 10, 15).unwrap(), apply_at: t(APPLY_AT), kind: CorpKind::Split { from: d(from), to: d(to) } }
}

fn dividend(id: i64, symbol: &str, amount: &str, ccy: &str, wh: &str) -> CorpAction {
    CorpAction { id, symbol: symbol.into(), ex_date: chrono::NaiveDate::from_ymd_opt(2026, 10, 15).unwrap(), apply_at: t(APPLY_AT), kind: CorpKind::Dividend { amount: d(amount), currency: ccy.into(), withholding_pct: d(wh) } }
}

/// The scheduler's moment (05:00 UTC, market closed) and the next session (15:00 UTC).
fn overnight(mut k: Kit) -> Kit {
    k.now = t("2026-10-15T05:00:00Z");
    k
}
fn next_session(mut k: Kit) -> Kit {
    k.now = t("2026-10-15T15:00:00Z");
    k
}

fn order(sym: &str, side: Side, v: &str) -> OrderReq {
    OrderReq::market(sym, side, d(v))
}

fn ticket(r: &PlaceResult) -> i64 {
    match r {
        PlaceResult::Filled { position_ticket: Some(t), .. } => *t,
        PlaceResult::Pending { ticket, .. } => *ticket,
        other => panic!("{other:?}"),
    }
}

#[test]
fn split_keeps_value_and_pnl_and_adjusts_orders() {
    let kit = kit();
    kit.quote("MSFT", "400.00", "400.10");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let mut req = order("MSFT", Side::Buy, "10");
    req.sl = Some(d("380.00"));
    req.tp = Some(d("450.00"));
    let long = ticket(&h.run(&kit, |tx, env| trade::place_order(tx, env, req)).unwrap());
    let short = ticket(&h.run(&kit, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Sell, "3"))).unwrap());
    let mut lim = order("MSFT", Side::Buy, "5");
    lim.kind = OrderType::Limit;
    lim.price = Some(d("390.00"));
    let pending = ticket(&h.run(&kit, |tx, env| trade::place_order(tx, env, lim)).unwrap());
    // the market moves before the ex-date: P&L and margin at 410 / 410.10
    kit.quote("MSFT", "410.00", "410.10");
    let before = super::metrics(&kit.env(&h.st), &h.st);

    // 4-for-1 split overnight; the next quote is ÷ 4
    let kit2 = overnight(kit);
    let a = split(7, "MSFT", "1", "4");
    let out = h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
    assert_eq!(out["positions"].as_array().unwrap().len(), 2);
    kit2.quote("MSFT", "102.50", "102.525");
    let after = super::metrics(&kit2.env(&h.st), &h.st);
    assert_eq!(r2(after.profit), r2(before.profit), "P&L unchanged by the split");
    assert_eq!(r2(after.equity), r2(before.equity));
    assert_eq!(r2(after.margin), r2(before.margin), "margin unchanged (same notional)");
    let p = &h.st.positions[&long];
    assert_eq!((p.volume, p.open_price, p.sl, p.tp), (d("40"), d("100.025"), Some(d("95.00")), Some(d("112.50"))));
    assert_eq!(h.st.positions[&short].volume, d("12"));
    let o = &h.st.orders[&pending];
    assert_eq!((o.volume, o.price), (d("20"), d("97.50")));
    assert_eq!(h.st.balance, d("100000"), "no cash moves on a split");

    // a second run is a no-op
    let again = h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
    assert_eq!(again["skipped"], "already applied");
    assert_eq!(h.st.positions[&long].volume, d("40"));
    // closing in the next session realises exactly the pre-split P&L of the move
    let kit3 = next_session(kit2);
    kit3.quote("MSFT", "102.50", "102.525");
    let (_, profit) = h.run(&kit3, |tx, env| trade::close_position(tx, env, long, Default::default())).unwrap();
    // long 10 @ 400.10 → 40 @ 100.025, closed at the bid 102.50: (102.50 − 100.025) × 40 = (410 − 400.10) × 10 = 99
    assert_eq!(r2(profit), d("99.00"));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn uneven_and_reverse_splits_keep_the_pnl() {
    for (from, to, px_after) in [("2", "3", "273.40"), ("5", "1", "2050.50")] {
        let kit = kit();
        kit.quote("MSFT", "410.10", "410.10");
        let mut h = Harness::live(&kit, "hedge", "100000");
        h.run(&kit, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Buy, "10"))).unwrap();
        kit.quote("MSFT", "410.10", "410.10");
        let kit2 = overnight(kit);
        let a = split(8, "MSFT", from, to);
        h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
        let k = d(to) / d(from);
        let p = h.st.positions.values().next().unwrap();
        assert_eq!(p.volume, d("10") * k);
        // a price that is the same company value after the split: profit within a cent of before
        kit2.quote("MSFT", px_after, px_after);
        let m = super::metrics(&kit2.env(&h.st), &h.st);
        let expected = (d(px_after) * k - d("410.10")) * d("10");
        assert!((m.profit - expected).abs() < d("0.01"), "{from}:{to}: {} vs {expected}", m.profit);
        h.assert_ledger();
        h.assert_replay();
    }
}

#[test]
fn dividend_credits_longs_net_and_debits_shorts_gross() {
    let kit = kit();
    kit.quote("MSFT", "400.00", "400.10");
    let mut h = Harness::live(&kit, "hedge", "100000");
    h.run(&kit, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Buy, "10"))).unwrap();
    h.run(&kit, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Sell, "5"))).unwrap();
    let bal = h.st.balance;
    let kit2 = overnight(kit);
    // 0.83 USD a share, 30 % withheld: long 10 × 0.83 × 0.7 = 5.81, short −5 × 0.83 = −4.15
    let a = dividend(9, "MSFT", "0.83", "USD", "30");
    let out = h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
    assert_eq!(out["cash"].as_f64(), Some(1.66));
    assert_eq!(h.st.balance - bal, d("1.66"));
    let txns: Vec<_> = h.log.iter().filter_map(|e| if let crate::state::Event::Ledger { txn } = e { Some(txn.clone()) } else { None }).filter(|t| t.kind == crate::model::TxnKind::Dividend).collect();
    assert_eq!(txns.len(), 2);
    assert!(txns.iter().all(|t| t.idempotency_key.starts_with("corp:9:") && t.note.as_deref().is_some_and(|n| n.starts_with("Dividend adjustment MSFT"))));
    // idempotent
    h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
    assert_eq!(h.st.balance - bal, d("1.66"));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn foreign_currency_dividend_converts_and_later_positions_are_not_paid() {
    let kit = kit();
    kit.quote("00700.HK", "420.00", "420.20");
    kit.quote("USDHKD", "7.80000", "7.80000");
    let mut h = Harness::demo(&kit, "hedge");
    // Hong Kong: 100 shares a lot. Placed by a dealer at a manual price (the HK market is closed at 15:00 UTC).
    let mut req = order("00700.HK", Side::Buy, "1");
    req.price = Some(d("420.20"));
    req.dealer = Some(trade::DealerCtx { staff: "IT".into(), reason_code: "DLR-01".into(), force: false });
    h.run(&kit, |tx, env| trade::place_order(tx, env, req.clone())).unwrap();
    let bal = h.st.balance;
    let kit2 = overnight(kit);
    let a = dividend(10, "00700.HK", "2.10", "HKD", "0");
    // a position opened after apply_at (the ex-date started; a late run) gets nothing
    kit2.quote("00700.HK", "418.00", "418.20");
    kit2.quote("USDHKD", "7.80000", "7.80000");
    h.run(&kit2, |tx, env| trade::place_order(tx, env, req)).unwrap();
    h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
    assert_eq!(h.st.positions.len(), 2);
    // 100 shares × 2.10 HKD = 210 HKD = 26.92 USD
    assert_eq!(h.st.balance - bal, d("26.92"));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn due_action_pauses_the_symbol_until_applied() {
    let kit = kit();
    kit.quote("MSFT", "400.00", "400.10");
    let mut h = Harness::live(&kit, "hedge", "100000");
    h.run(&kit, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Buy, "10"))).unwrap();
    kit.quote("AAPL", "250.00", "250.10");
    let kit2 = next_session(kit);
    let a = split(11, "MSFT", "1", "4");
    kit2.corp.set(BTreeMap::from([("MSFT".to_string(), vec![(11, a.apply_at)])]));
    // new post-split quotes arrive before the account is adjusted: no trading on MSFT, no stop-out
    kit2.quote("MSFT", "100.00", "100.025");
    assert_eq!(h.run(&kit2, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Buy, "1"))).unwrap_err().code, "corporate_action");
    h.tick(&kit2, "MSFT");
    assert_eq!(h.st.positions.len(), 1, "no stop-out on old sizes with new prices");
    // other symbols trade
    assert!(h.run(&kit2, |tx, env| trade::place_order(tx, env, order("AAPL", Side::Buy, "1"))).is_ok());
    h.run(&kit2, |tx, env| corporate::apply(tx, env, &a)).unwrap();
    assert!(h.run(&kit2, |tx, env| trade::place_order(tx, env, order("MSFT", Side::Buy, "1"))).is_ok(), "trading resumes once applied");
    h.assert_ledger();
    h.assert_replay();
}
