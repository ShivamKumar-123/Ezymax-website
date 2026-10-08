//! Engine unit tests: netting/hedging/cent maths, margin, SL/TP, trailing, pending orders, OCO, Close By,
//! reversal, margin call and stop-out ordering, NBP, swaps, book transfer, ledger invariant, replay.

use super::dealing::{self, BookMove};
use super::funds::{self, AdjustKind, Direction};
use super::testkit::{Harness, Kit, d, group, t};
use super::trade::{self, BulkFilter, CloseReq, DealerCtx, OrderReq, PlaceResult, PositionPatch};
use super::{metrics, risk};
use crate::model::{AccountKind, Book, DealReason, Expiry, OrderType, Side, Status};
use crate::money::{D, r2};
use crate::rules::Product;
use crate::state::Event;

fn buy(sym: &str, v: &str) -> OrderReq {
    OrderReq::market(sym, Side::Buy, d(v))
}
fn sell(sym: &str, v: &str) -> OrderReq {
    OrderReq::market(sym, Side::Sell, d(v))
}

fn place(h: &mut Harness, kit: &Kit, req: OrderReq) -> PlaceResult {
    h.run(kit, |tx, env| trade::place_order(tx, env, req)).unwrap()
}

fn pos_ticket(r: &PlaceResult) -> i64 {
    match r {
        PlaceResult::Filled { position_ticket: Some(t), .. } => *t,
        other => panic!("not filled: {other:?}"),
    }
}

fn last_deal(h: &Harness) -> crate::model::Deal {
    h.log
        .iter()
        .rev()
        .find_map(|e| match e {
            Event::PositionClosed { deal, .. } => Some(deal.clone()),
            _ => None,
        })
        .expect("no closing deal")
}

#[test]
fn hedging_open_close_pnl_and_margin() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10010");
    let mut h = Harness::live(&kit, "hedge", "10000");
    let r = place(&mut h, &kit, buy("EURUSD", "1"));
    let t = pos_ticket(&r);
    let p = &h.st.positions[&t];
    assert_eq!(p.open_price, d("1.10010")); // buy fills at ask
    let m = metrics(&kit.env(&h.st), &h.st);
    // 100 000 × mid 1.10005 / 100
    assert_eq!(r2(m.margin), d("1100.05"));
    assert_eq!(r2(m.profit), d("-10.00")); // spread cost
    kit.quote("EURUSD", "1.10110", "1.10120");
    let (_, profit) = h.run(&kit, |tx, env| trade::close_position(tx, env, t, CloseReq::default())).unwrap();
    assert_eq!(profit, d("100.00"));
    assert_eq!(h.st.balance, d("10100.00"));
    assert!(h.st.positions.is_empty());
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn hedged_margin_percentage() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "hedge", "10000");
    place(&mut h, &kit, buy("EURUSD", "1"));
    place(&mut h, &kit, sell("EURUSD", "1"));
    // fully hedged at 50 %: 2 legs × 50 % = one lot of margin
    let m = metrics(&kit.env(&h.st), &h.st);
    assert_eq!(r2(m.margin), d("1100.00"));
    place(&mut h, &kit, buy("EURUSD", "1"));
    // net 1 lot + hedged 1 lot (×2×50 %) = 2 lots
    assert_eq!(r2(metrics(&kit.env(&h.st), &h.st).margin), d("2200.00"));
}

#[test]
fn quote_currency_conversion_usdjpy_and_cross() {
    let kit = Kit::new();
    kit.quote("USDJPY", "150.000", "150.000");
    kit.quote("GBPJPY", "190.000", "190.000");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let t1 = pos_ticket(&place(&mut h, &kit, buy("USDJPY", "1")));
    let t2 = pos_ticket(&place(&mut h, &kit, buy("GBPJPY", "1")));
    // USDJPY margin = 100 000 USD / 100
    kit.quote("USDJPY", "151.000", "151.000");
    kit.quote("GBPJPY", "191.000", "191.000");
    let (_, p1) = h.run(&kit, |tx, env| trade::close_position(tx, env, t1, CloseReq::default())).unwrap();
    // 1.000 × 100 000 JPY / 151 (own closing price)
    assert_eq!(p1, d("662.25"));
    let (_, p2) = h.run(&kit, |tx, env| trade::close_position(tx, env, t2, CloseReq::default())).unwrap();
    // 100 000 JPY converted at USDJPY mid 151
    assert_eq!(p2, d("662.25"));
    h.assert_ledger();
}

#[test]
fn cent_account_is_usc_times_100() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "cent", "50"); // 50 USD → 5000 USC
    assert_eq!(h.st.balance, d("5000.00"));
    assert_eq!(h.st.account.ccy(), "USC");
    let t = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "0.01"))); // 0.01 lot = 1000 EUR, unchanged lot size (D30)
    let m = metrics(&kit.env(&h.st), &h.st);
    assert_eq!(r2(m.margin), d("1100.00")); // 11 USD = 1100 USC
    kit.quote("EURUSD", "1.10100", "1.10100");
    let (_, p) = h.run(&kit, |tx, env| trade::close_position(tx, env, t, CloseReq::default())).unwrap();
    assert_eq!(p, d("100.00")); // 1 USD = 100 USC
    assert_eq!(h.st.balance, d("5100.00"));
    // withdrawing 51 USD takes 5100 USC; the transfer nets to 0 in both currencies
    h.run(&kit, |tx, env| funds::transfer(tx, env, Direction::Out, d("51"), "w1", None)).unwrap();
    assert_eq!(h.st.balance, d("0.00"));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn netting_add_reduce_and_reversal() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "net", "100000");
    let t = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    kit.quote("EURUSD", "1.10200", "1.10200");
    assert_eq!(pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1"))), t); // one position per symbol
    let p = &h.st.positions[&t];
    assert_eq!(p.volume, d("2"));
    assert_eq!(p.open_price, d("1.10100")); // volume-weighted average
    // reduce by 0.5 at 1.10300: P&L on 0.5 lot = 0.002 × 50 000 = 100
    kit.quote("EURUSD", "1.10300", "1.10300");
    place(&mut h, &kit, sell("EURUSD", "0.5"));
    assert_eq!(h.st.positions[&t].volume, d("1.5"));
    assert_eq!(last_deal(&h).profit, d("100.00"));
    // D18: long 1.5, sell 3 → short 1.5
    let r = place(&mut h, &kit, sell("EURUSD", "3"));
    let nt = pos_ticket(&r);
    assert_ne!(nt, t);
    assert_eq!(h.st.positions.len(), 1);
    let np = &h.st.positions[&nt];
    assert_eq!((np.side, np.volume, np.reversed_from), (Side::Sell, d("1.5"), Some(t)));
    assert_eq!(np.open_price, d("1.10300"));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn netting_close_only_allows_reduction_only() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "net", "100000");
    place(&mut h, &kit, buy("EURUSD", "1"));
    h.run(&kit, |tx, _| funds::set_status(tx, Status::CloseOnly)).unwrap();
    let err = h.run(&kit, |tx, env| trade::place_order(tx, env, sell("EURUSD", "2"))).unwrap_err();
    assert_eq!(err.code, "close_only");
    assert!(h.run(&kit, |tx, env| trade::place_order(tx, env, sell("EURUSD", "0.4"))).is_ok());
    assert_eq!(h.st.position_for("EURUSD").unwrap().volume, d("0.6"));
}

#[test]
fn partial_close_splits_swap_and_commission() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "ecn", "100000");
    let t = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    assert_eq!(h.st.balance, d("99993.00")); // 7 USD round-turn commission at open
    let mut p = h.st.positions[&t].clone();
    p.swap = d("-3.00");
    h.run(&kit, |tx, _| {
        tx.emit(Event::PositionUpdated { position: p.clone(), change: "test swap".into(), deal: None });
        Ok(())
    })
    .unwrap();
    kit.quote("EURUSD", "1.10100", "1.10100");
    // below min remaining / bad step
    assert!(h.run(&kit, |tx, env| trade::close_position(tx, env, t, CloseReq { volume: Some(d("0.995")), ..Default::default() })).is_err());
    let (_, net) = h.run(&kit, |tx, env| trade::close_position(tx, env, t, CloseReq { volume: Some(d("0.4")), ..Default::default() })).unwrap();
    let deal = last_deal(&h);
    assert_eq!((deal.volume, deal.profit, deal.swap, deal.commission), (d("0.4"), d("40.00"), d("-1.20"), d("2.80")));
    assert_eq!(net, d("38.80"));
    let rest = &h.st.positions[&t];
    assert_eq!((rest.volume, rest.swap, rest.commission), (d("0.6"), d("-1.80"), d("4.20")));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn close_by_uses_the_opposite_open_price() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10010");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let a = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1"))); // 1.10010
    kit.quote("EURUSD", "1.10500", "1.10510");
    let b = pos_ticket(&place(&mut h, &kit, sell("EURUSD", "0.4"))); // 1.10500
    let before = h.st.balance;
    h.run(&kit, |tx, env| trade::close_by(tx, env, a, b)).unwrap();
    assert!(!h.st.positions.contains_key(&b));
    assert_eq!(h.st.positions[&a].volume, d("0.6"));
    // (1.10500 − 1.10010) × 40 000 = 196 on the overlap, no spread paid
    assert_eq!(h.st.balance - before, d("196.00"));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn sl_tp_trigger_on_tick() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "hedge", "10000");
    let mut req = buy("EURUSD", "1");
    req.sl = Some(d("1.09500"));
    req.tp = Some(d("1.10500"));
    let t = pos_ticket(&place(&mut h, &kit, req));
    // invalid SL on modify (above the bid)
    assert!(h.run(&kit, |tx, env| trade::modify_position(tx, env, t, PositionPatch { sl: Some(Some(d("1.2"))), ..Default::default() }, None)).is_err());
    kit.quote("EURUSD", "1.10499", "1.10509");
    h.tick(&kit, "EURUSD");
    assert!(h.st.positions.contains_key(&t));
    kit.quote("EURUSD", "1.10510", "1.10520");
    h.tick(&kit, "EURUSD");
    assert!(h.st.positions.is_empty());
    let deal = last_deal(&h);
    assert_eq!((deal.reason, deal.price, deal.profit), (DealReason::Tp, d("1.10510"), d("510.00")));
    h.assert_replay();
}

#[test]
fn trailing_stop_follows_and_closes() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "hedge", "10000");
    let mut req = buy("EURUSD", "1");
    req.trailing_points = Some(100); // 0.00100
    let t = pos_ticket(&place(&mut h, &kit, req));
    kit.quote("EURUSD", "1.10050", "1.10050");
    h.tick(&kit, "EURUSD");
    assert_eq!(h.st.positions[&t].sl, None); // not yet `distance` in profit
    kit.quote("EURUSD", "1.10200", "1.10200");
    h.tick(&kit, "EURUSD");
    assert_eq!(h.st.positions[&t].sl, Some(d("1.10100")));
    kit.quote("EURUSD", "1.10150", "1.10150");
    h.tick(&kit, "EURUSD");
    assert_eq!(h.st.positions[&t].sl, Some(d("1.10100"))); // never moves back
    kit.quote("EURUSD", "1.10300", "1.10300");
    h.tick(&kit, "EURUSD");
    assert_eq!(h.st.positions[&t].sl, Some(d("1.10200")));
    kit.quote("EURUSD", "1.10195", "1.10195");
    h.tick(&kit, "EURUSD");
    assert!(h.st.positions.is_empty());
    assert_eq!(last_deal(&h).reason, DealReason::Sl);
    h.assert_replay();
}

#[test]
fn pending_limit_stop_and_stop_limit() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10010");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let mut lim = OrderReq { kind: OrderType::Limit, price: Some(d("1.09900")), ..buy("EURUSD", "1") };
    // a buy limit above the market is refused
    assert!(h.run(&kit, |tx, env| trade::place_order(tx, env, OrderReq { price: Some(d("1.2")), ..lim.clone() })).is_err());
    lim.sl = Some(d("1.09000"));
    let PlaceResult::Pending { ticket: lt, .. } = place(&mut h, &kit, lim) else { panic!() };
    let PlaceResult::Pending { ticket: st, .. } = place(&mut h, &kit, OrderReq { kind: OrderType::Stop, price: Some(d("1.10500")), ..buy("EURUSD", "1") }) else { panic!() };
    let PlaceResult::Pending { ticket: sl, .. } = place(&mut h, &kit, OrderReq { kind: OrderType::StopLimit, price: Some(d("1.09500")), stop_limit: Some(d("1.09600")), ..sell("EURUSD", "1") }) else { panic!() };
    // limit fills when the ask reaches it, at the market (≤ limit)
    kit.quote("EURUSD", "1.09880", "1.09890");
    h.tick(&kit, "EURUSD");
    assert!(!h.st.orders.contains_key(&lt));
    let p = &h.st.positions[&lt];
    assert_eq!((p.open_price, p.sl), (d("1.09890"), Some(d("1.09000"))));
    // sell stop-limit: stop at bid ≤ 1.09500 → becomes sell limit 1.09600 (bid must come back up)
    kit.quote("EURUSD", "1.09490", "1.09500");
    h.tick(&kit, "EURUSD");
    assert!(h.st.orders[&sl].triggered);
    kit.quote("EURUSD", "1.09610", "1.09620");
    h.tick(&kit, "EURUSD");
    assert!(!h.st.orders.contains_key(&sl));
    assert_eq!(h.st.positions[&sl].open_price, d("1.09610"));
    // buy stop
    kit.quote("EURUSD", "1.10500", "1.10510");
    h.tick(&kit, "EURUSD");
    assert_eq!(h.st.positions[&st].open_price, d("1.10510"));
    h.assert_replay();
}

#[test]
fn oco_and_expiry() {
    let mut kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10010");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let PlaceResult::Pending { ticket: a, .. } = place(&mut h, &kit, OrderReq { kind: OrderType::Stop, price: Some(d("1.10500")), ..buy("EURUSD", "1") }) else { panic!() };
    let PlaceResult::Pending { ticket: b, .. } = place(&mut h, &kit, OrderReq { kind: OrderType::Stop, price: Some(d("1.09500")), oco_with: Some(a), ..sell("EURUSD", "1") }) else { panic!() };
    assert_eq!(h.st.orders[&a].oco, Some(b));
    let PlaceResult::Pending { ticket: today, .. } = place(&mut h, &kit, OrderReq { kind: OrderType::Limit, price: Some(d("1.05")), expiry: Expiry::Today, ..buy("EURUSD", "1") }) else { panic!() };
    assert_eq!(h.st.orders[&today].expiry_at, Some(t("2026-09-28T21:00:00Z")));
    kit.quote("EURUSD", "1.09490", "1.09500");
    h.tick(&kit, "EURUSD");
    assert!(h.st.positions.contains_key(&b));
    assert!(!h.st.orders.contains_key(&a)); // partner cancelled
    kit.now = t("2026-09-28T21:00:01Z");
    kit.quote("EURUSD", "1.09490", "1.09500");
    h.tick(&kit, "EURUSD");
    assert!(h.st.orders.is_empty());
    assert!(h.log.iter().any(|e| matches!(e, Event::OrderRemoved { ticket, status: crate::model::OrderStatus::Expired, .. } if *ticket == today)));
    h.assert_replay();
}

#[test]
fn market_closed_on_weekend_but_crypto_trades() {
    let mut kit = Kit::new();
    kit.now = t("2026-09-26T10:00:00Z"); // Saturday
    kit.quote("EURUSD", "1.10000", "1.10010");
    kit.quote("BTCUSD", "83000", "83010");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let e = h.run(&kit, |tx, env| trade::place_order(tx, env, buy("EURUSD", "0.1"))).unwrap_err();
    assert_eq!(e.code, "market_closed");
    assert!(h.run(&kit, |tx, env| trade::place_order(tx, env, buy("BTCUSD", "0.1"))).is_ok());
}

#[test]
fn requote_when_deviation_exceeded() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10020");
    let mut h = Harness::live(&kit, "hedge", "10000");
    let req = OrderReq { requested_price: Some(d("1.10000")), deviation_points: Some(10), ..buy("EURUSD", "1") };
    let e = h.run(&kit, |tx, env| trade::place_order(tx, env, req.clone())).unwrap_err();
    assert_eq!(e.code, "requote");
    assert_eq!(e.requote, Some((d("1.10000"), d("1.10020"))));
    assert!(h.run(&kit, |tx, env| trade::place_order(tx, env, OrderReq { deviation_points: Some(20), ..req })).is_ok());
}

#[test]
fn free_margin_check() {
    let kit = Kit::new();
    kit.quote("XAUUSD", "2600.00", "2600.00");
    let mut h = Harness::live(&kit, "hedge", "1000");
    // 1 lot gold = 260 000 notional / 100 = 2600 margin > 1000 equity
    let e = h.run(&kit, |tx, env| trade::place_order(tx, env, buy("XAUUSD", "1"))).unwrap_err();
    assert_eq!(e.code, "no_money");
    assert!(h.run(&kit, |tx, env| trade::place_order(tx, env, buy("XAUUSD", "0.3"))).is_ok());
}

#[test]
fn margin_call_then_stop_out_closes_largest_loser_first_and_nbp() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    kit.quote("GBPUSD", "1.30000", "1.30000");
    let mut h = Harness::live(&kit, "hedge", "3000");
    let e = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1"))); // margin 1100
    let g = pos_ticket(&place(&mut h, &kit, buy("GBPUSD", "1"))); // margin 1300
    // EURUSD −1500 → equity 1500 / margin ~2400 = 62 % → margin call (100 %) but no stop-out (50 %)
    kit.quote("EURUSD", "1.08500", "1.08500");
    h.tick(&kit, "EURUSD");
    assert!(h.st.margin_call);
    assert_eq!(h.st.positions.len(), 2);
    // GBPUSD −500 more: equity 1000 / margin 2385 = 42 % → stop-out: EURUSD (largest loser) goes first
    kit.quote("GBPUSD", "1.29500", "1.29500");
    h.tick(&kit, "GBPUSD");
    assert!(!h.st.positions.contains_key(&e));
    assert!(h.st.positions.contains_key(&g)); // after EURUSD is closed: equity 1000 / 1295 = 77 % > 50 %
    assert!(h.log.iter().any(|x| matches!(x, Event::StopOut { .. })));
    assert_eq!(h.st.balance, d("1500.00"));
    // gap far below: the remaining position closes and the negative balance is reset to 0 (D16)
    kit.quote("GBPUSD", "1.27000", "1.27000");
    h.tick(&kit, "GBPUSD");
    assert!(h.st.positions.is_empty());
    assert_eq!(h.st.balance, d("0.00"));
    assert!(h.log.iter().any(|x| matches!(x, Event::Ledger { txn } if txn.kind == crate::model::TxnKind::Nbp && txn.postings[0].amount == d("1500.00"))));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn swaps_triple_day_weekend_and_swap_free() {
    let mut kit = Kit::new();
    kit.now = t("2026-09-21T12:00:00Z"); // Monday
    kit.quote("EURUSD", "1.10000", "1.10000");
    kit.quote("BTCUSD", "80000", "80000");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let e = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    let b = pos_ticket(&place(&mut h, &kit, buy("BTCUSD", "1")));
    let roll = |h: &mut Harness, kit: &Kit, day: &str| {
        let day = chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d").unwrap();
        let at = crate::specs::server_midnight(day.succ_opt().unwrap());
        h.run(kit, |tx, env| {
            risk::rollover(tx, env, day, at);
            Ok(())
        })
        .unwrap();
    };
    // EURUSD long swap −7.2 points × 0.00001 × 100 000 = −7.20 per night
    roll(&mut h, &kit, "2026-09-21");
    assert_eq!(h.st.positions[&e].swap, d("-7.20"));
    roll(&mut h, &kit, "2026-09-21"); // idempotent
    assert_eq!(h.st.positions[&e].swap, d("-7.20"));
    roll(&mut h, &kit, "2026-09-23"); // Wednesday: triple
    assert_eq!(h.st.positions[&e].swap, d("-28.80"));
    roll(&mut h, &kit, "2026-09-26"); // Saturday: nothing for FX
    assert_eq!(h.st.positions[&e].swap, d("-28.80"));
    // BTC charged every night: −4200 points × 0.01 × 1 = −42 per night, 3 nights charged
    assert_eq!(h.st.positions[&b].swap, d("-126.00"));
    // swap is realised on close
    let before = h.st.balance;
    h.run(&kit, |tx, env| trade::close_position(tx, env, e, CloseReq::default())).unwrap();
    assert_eq!(h.st.balance - before, d("-28.80"));
    h.assert_ledger();
    h.assert_replay();

    let mut f = Harness::live(&kit, "free", "100000");
    let ft = pos_ticket(&place(&mut f, &kit, buy("EURUSD", "1")));
    roll(&mut f, &kit, "2026-09-23");
    assert_eq!(f.st.positions[&ft].swap, D::ZERO);
}

#[test]
fn swap_skips_positions_opened_after_rollover() {
    let mut kit = Kit::new();
    kit.now = t("2026-09-22T20:30:00Z");
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let tk = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    // rollover of server day 09-21 happened at 2026-09-21T21:00Z, before the position opened
    let day = chrono::NaiveDate::from_ymd_opt(2026, 9, 21).unwrap();
    h.run(&kit, |tx, env| {
        risk::rollover(tx, env, day, crate::specs::server_midnight(day.succ_opt().unwrap()));
        Ok(())
    })
    .unwrap();
    assert_eq!(h.st.positions[&tk].swap, D::ZERO);
}

#[test]
fn book_transfer_full_and_partial_split() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "ecn", "100000");
    let t0 = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    assert_eq!(h.st.positions[&t0].book, Book::B);
    let dealer = DealerCtx { staff: "Dealer".into(), reason_code: "DLR-03 · Risk management".into(), force: false };
    kit.quote("EURUSD", "1.10100", "1.10100");
    let (child, ..) = h.run(&kit, |tx, env| dealing::transfer_book(tx, env, t0, Book::A, BookMove::Volume(d("0.3")), &dealer)).unwrap();
    let c = child.unwrap();
    let parent = &h.st.positions[&t0];
    let kid = &h.st.positions[&c];
    assert_eq!((parent.volume, parent.book), (d("0.7"), Book::B));
    assert_eq!((kid.volume, kid.book, kid.parent_ticket), (d("0.3"), Book::A, Some(t0)));
    assert_eq!(parent.child_tickets, vec![c]);
    assert_eq!(parent.commission + kid.commission, d("7.00"));
    assert_eq!(kid.open_price, parent.open_price); // client terms unchanged
    assert_eq!(r2(kid.book_carry_b), d("30.00")); // P&L so far stays with B
    // full transfer of the parent
    h.run(&kit, |tx, env| dealing::transfer_book(tx, env, t0, Book::A, BookMove::Full, &dealer)).unwrap();
    assert_eq!(h.st.positions[&t0].book, Book::A);
    assert_eq!(h.st.positions[&t0].route_history.len(), 3);
    h.assert_replay();
}

#[test]
fn dealer_reopen_void_and_price_correction() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10000");
    let mut h = Harness::live(&kit, "ecn", "100000");
    let dealer = DealerCtx { staff: "Dealer".into(), reason_code: "DLR-02 · Error correction".into(), force: false };
    let t0 = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    kit.quote("EURUSD", "1.10200", "1.10200");
    h.run(&kit, |tx, env| trade::close_position(tx, env, t0, CloseReq { dealer: Some(dealer.clone()), ..Default::default() })).unwrap();
    let deal = last_deal(&h);
    assert_eq!(h.st.balance, d("100193.00"));
    h.run(&kit, |tx, env| dealing::reopen_deal(tx, env, &deal, &dealer)).unwrap();
    assert_eq!(h.st.balance, d("99993.00"));
    assert_eq!(h.st.positions[&t0].volume, d("1"));
    assert!(h.run(&kit, |tx, env| dealing::reopen_deal(tx, env, &deal, &dealer)).is_err());
    h.run(&kit, |tx, env| dealing::price_correction(tx, env, t0, d("1.10050"))).unwrap();
    assert!(h.st.positions[&t0].price_corrected);
    h.run(&kit, |tx, env| dealing::void_position(tx, env, t0, &dealer)).unwrap();
    assert_eq!(h.st.balance, d("100000.00")); // commission refunded, no P&L
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn gates_halt_close_only_max_lot_disabled() {
    let mut kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let tk = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    kit.tenant.symbol_controls.push(crate::rules::SymbolControl { id: "SC-1".into(), symbol: "EURUSD".into(), group: "all".into(), mode: crate::rules::ControlMode::CloseOnly, reason_code: "x".into(), note: None, staff: "s".into(), at: kit.now });
    assert_eq!(h.run(&kit, |tx, env| trade::place_order(tx, env, buy("EURUSD", "1"))).unwrap_err().code, "symbol_close_only");
    kit.tenant.symbol_controls[0].mode = crate::rules::ControlMode::Halt;
    assert_eq!(h.run(&kit, |tx, env| trade::close_position(tx, env, tk, CloseReq::default())).unwrap_err().code, "symbol_halted");
    let force = DealerCtx { staff: "s".into(), reason_code: "r".into(), force: true };
    assert!(h.run(&kit, |tx, env| trade::close_position(tx, env, tk, CloseReq { dealer: Some(force.clone()), ..Default::default() })).is_ok());
    kit.tenant.symbol_controls.clear();
    let mut c = h.st.account.controls.clone();
    c.max_lot = Some(d("2"));
    h.run(&kit, |tx, _| funds::set_controls(tx, c.clone())).unwrap();
    assert_eq!(h.run(&kit, |tx, env| trade::place_order(tx, env, buy("EURUSD", "3"))).unwrap_err().code, "max_lot");
    c.trading_disabled = true;
    h.run(&kit, |tx, _| funds::set_controls(tx, c.clone())).unwrap();
    assert_eq!(h.run(&kit, |tx, env| trade::place_order(tx, env, buy("EURUSD", "1"))).unwrap_err().code, "trading_disabled");
    h.run(&kit, |tx, _| funds::set_status(tx, Status::ReadOnly)).unwrap();
    assert_eq!(h.run(&kit, |tx, env| trade::place_order(tx, env, buy("EURUSD", "1"))).unwrap_err().code, "account_status");
}

#[test]
fn pending_order_waits_while_symbol_is_halted() {
    let mut kit = Kit::new();
    kit.quote("EURUSD", "1.10000", "1.10010");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let PlaceResult::Pending { ticket, .. } = place(&mut h, &kit, OrderReq { kind: OrderType::Limit, price: Some(d("1.09900")), ..buy("EURUSD", "1") }) else { panic!() };
    kit.tenant.symbol_controls.push(crate::rules::SymbolControl { id: "SC-1".into(), symbol: "EURUSD".into(), group: "all".into(), mode: crate::rules::ControlMode::Halt, reason_code: "x".into(), note: None, staff: "s".into(), at: kit.now });
    kit.quote("EURUSD", "1.09800", "1.09810");
    h.tick(&kit, "EURUSD");
    assert!(h.st.orders.contains_key(&ticket), "halted: the order must stay pending");
    kit.tenant.symbol_controls.clear();
    h.tick(&kit, "EURUSD");
    assert!(h.st.positions.contains_key(&ticket));
    // a staff adjustment that makes a flat balance negative is not written off by NBP on the next tick
    let mut g = Harness::live(&kit, "hedge", "100");
    g.run(&kit, |tx, env| funds::adjust(tx, env, AdjustKind::Adjustment, d("-150"), "adj", "FIN", "clawback").map(|_| ())).unwrap();
    g.run(&kit, |tx, env| trade::place_order(tx, env, OrderReq { kind: OrderType::Limit, price: Some(d("1.0")), ..buy("EURUSD", "0.01") }).map(|_| ())).ok();
    g.tick(&kit, "EURUSD");
    assert_eq!(g.st.balance, d("-50.00"));
}

#[test]
fn duplicate_client_order_id_is_not_executed_twice() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "100000");
    let req = OrderReq { client_order_id: Some("abc-1".into()), ..buy("EURUSD", "1") };
    let first = place(&mut h, &kit, req.clone());
    let second = place(&mut h, &kit, req);
    let PlaceResult::Filled { order_ticket, .. } = first else { panic!() };
    assert_eq!(second, PlaceResult::Duplicate { ticket: order_ticket });
    assert_eq!(h.st.positions.len(), 1);
    h.assert_replay();
}

#[test]
fn demo_refill_cap_and_leverage_change_when_flat() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::demo(&kit, "hedge");
    assert_eq!(h.st.balance, d("10000.00"));
    assert_eq!(h.run(&kit, |tx, env| funds::demo_refill(tx, env)).unwrap_err().code, "refill_not_needed");
    let tk = pos_ticket(&place(&mut h, &kit, buy("EURUSD", "1")));
    kit.quote("EURUSD", "1.09", "1.09");
    h.run(&kit, |tx, env| trade::close_position(tx, env, tk, CloseReq::default())).unwrap();
    assert_eq!(h.st.balance, d("9000.00"));
    assert_eq!(h.run(&kit, |tx, env| funds::demo_refill(tx, env)).unwrap(), d("1000.00"));
    assert_eq!(h.st.balance, d("10000.00"));
    // transfers are live-only
    assert_eq!(h.run(&kit, |tx, env| funds::transfer(tx, env, Direction::In, d("5"), "x", None)).unwrap_err().code, "demo_account");
    // leverage only while flat
    place(&mut h, &kit, buy("EURUSD", "0.1"));
    assert_eq!(h.run(&kit, |tx, env| funds::change_leverage(tx, env, 200, false)).unwrap_err().code, "positions_open");
    h.run(&kit, |tx, env| trade::bulk_close(tx, env, BulkFilter::All, None).done.len().eq(&1).then_some(()).ok_or(super::Reject::new("x", "x"))).unwrap();
    h.run(&kit, |tx, env| funds::change_leverage(tx, env, 200, false)).unwrap();
    assert_eq!(h.st.account.leverage, 200);
    assert!(h.run(&kit, |tx, env| funds::change_leverage(tx, env, 333, false)).is_err());
    h.assert_replay();
}

#[test]
fn withdrawal_respects_free_margin_and_credit() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "2000");
    h.run(&kit, |tx, env| funds::adjust(tx, env, AdjustKind::Credit, d("500"), "c1", "BON-01", "welcome credit")).unwrap();
    place(&mut h, &kit, buy("EURUSD", "1")); // margin 1100
    // equity 2500, margin 1100, free 1400 − credit 500 = 900 withdrawable
    assert_eq!(h.run(&kit, |tx, env| funds::transfer(tx, env, Direction::Out, d("901"), "w1", None)).unwrap_err().code, "insufficient_funds");
    assert!(h.run(&kit, |tx, env| funds::transfer(tx, env, Direction::Out, d("900"), "w2", None)).is_ok());
    assert_eq!(h.run(&kit, |tx, env| funds::adjust(tx, env, AdjustKind::Credit, d("-600"), "c2", "x", "x")).unwrap_err().code, "invalid_amount");
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn house_capital_is_booked_against_house_capital_not_as_a_deposit() {
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "0");
    h.run(&kit, |tx, env| funds::adjust(tx, env, AdjustKind::HouseCapital, d("10000"), "house:h1:capital:initial", "HOUSE", "house account")).unwrap();
    assert_eq!(h.st.balance, d("10000.00"));
    let txn = h.log.iter().rev().find_map(|x| match x { Event::Ledger { txn } => Some(txn.clone()), _ => None }).unwrap();
    assert_eq!(txn.kind, crate::model::TxnKind::HouseCapital);
    assert_eq!(txn.kind.as_str(), "house_capital");
    assert!(txn.postings.iter().any(|p| p.account == crate::model::house_code("house_capital", "USD") && p.amount == d("-10000.00")));
    // a withdrawal of house capital is limited to the free funds, like any withdrawal
    place(&mut h, &kit, buy("EURUSD", "1")); // margin 1100
    assert_eq!(h.run(&kit, |tx, env| funds::adjust(tx, env, AdjustKind::HouseCapital, d("-9000"), "house:h1:capital:w1", "HOUSE", "too much")).unwrap_err().code, "insufficient_funds");
    h.run(&kit, |tx, env| funds::adjust(tx, env, AdjustKind::HouseCapital, d("-5000"), "house:h1:capital:w2", "HOUSE", "withdraw")).unwrap();
    assert_eq!(h.st.balance, d("5000.00"));
    // the admin balance API can't book it (only the house routes construct this kind)
    assert!(AdjustKind::parse("house_capital").is_none());
    h.assert_ledger();
    h.assert_replay();
}

fn adj(h: &mut Harness, kit: &Kit, op: funds::AdjustOp, category: &str, amount: &str, force: bool, key: &str) -> Result<i64, super::Reject> {
    h.run(kit, |tx, env| funds::staff_adjust(tx, env, funds::StaffAdjust { op, category, amount: d(amount), force, key, reason_code: "ADJ", statement: "" }))
}

fn last_txn(h: &Harness) -> crate::model::LedgerTxn {
    h.log.iter().rev().find_map(|x| match x { Event::Ledger { txn } => Some(txn.clone()), _ => None }).unwrap()
}

#[test]
fn manual_adjustments_book_the_right_kind_and_keep_the_ledger_balanced() {
    use funds::AdjustOp::*;
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "1000");
    // add funds, reason correction: an adjustment against house:adjustments (never a deposit)
    adj(&mut h, &kit, Add, "correction", "100", false, "a1").unwrap();
    assert_eq!(h.st.balance, d("1100.00"));
    let t = last_txn(&h);
    assert_eq!(t.kind.as_str(), "adjustment");
    assert!(t.postings.iter().any(|p| p.account == crate::model::house_code("adjustments", "USD") && p.amount == d("-100.00")));
    assert_eq!(t.note.as_deref(), Some("Balance adjustment"));
    h.assert_ledger();
    // external payment received: a real deposit against house:external
    adj(&mut h, &kit, Add, "deposit", "250", false, "a2").unwrap();
    assert_eq!(last_txn(&h).kind.as_str(), "deposit");
    assert_eq!(h.st.balance, d("1350.00"));
    h.assert_ledger();
    // deduct 30 (fee), then a withdrawal paid externally
    adj(&mut h, &kit, Deduct, "fee", "30", false, "a3").unwrap();
    assert_eq!((h.st.balance, last_txn(&h).kind.as_str()), (d("1320.00"), "adjustment"));
    adj(&mut h, &kit, Deduct, "withdrawal", "20", false, "a4").unwrap();
    assert_eq!((h.st.balance, last_txn(&h).kind.as_str()), (d("1300.00"), "withdrawal"));
    h.assert_ledger();
    // give 50 credit, take 20 back: the credit sub-ledger against house:credit_issued, equity follows
    adj(&mut h, &kit, CreditIn, "bonus", "50", false, "a5").unwrap();
    assert_eq!(h.st.credit, d("50.00"));
    assert_eq!(metrics(&kit.env(&h.st), &h.st).equity, d("1350.00"));
    adj(&mut h, &kit, CreditOut, "correction", "20", false, "a6").unwrap();
    assert_eq!(h.st.credit, d("30.00"));
    assert_eq!(last_txn(&h).effect(h.st.account.login, "credit"), d("-20.00"));
    // category / direction mismatches and bad amounts are refused
    assert_eq!(adj(&mut h, &kit, Add, "withdrawal", "1", false, "a7").unwrap_err().code, "invalid_category");
    assert_eq!(adj(&mut h, &kit, Deduct, "deposit", "1", false, "a8").unwrap_err().code, "invalid_category");
    assert_eq!(adj(&mut h, &kit, Add, "gift", "1", false, "a9").unwrap_err().code, "invalid_category");
    assert_eq!(adj(&mut h, &kit, Add, "other", "0.001", false, "a10").unwrap_err().code, "invalid_amount");
    assert_eq!(adj(&mut h, &kit, Add, "other", "-5", false, "a11").unwrap_err().code, "invalid_amount");
    // every transaction balances; the house side mirrors the client side
    for e in &h.log {
        if let Event::Ledger { txn } = e {
            assert!(txn.is_balanced());
        }
    }
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn manual_deduction_is_limited_to_free_margin_unless_forced_and_never_below_zero() {
    use funds::AdjustOp::*;
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "2000");
    place(&mut h, &kit, buy("EURUSD", "1")); // margin 1100 → free funds 900
    let e = adj(&mut h, &kit, Deduct, "correction", "901", false, "d1").unwrap_err();
    assert_eq!(e.code, "insufficient_funds");
    assert!(e.message.contains("900"), "{}", e.message);
    assert_eq!(h.st.balance, d("2000.00"));
    adj(&mut h, &kit, Deduct, "correction", "900", false, "d2").unwrap();
    assert_eq!(h.st.balance, d("1100.00"));
    // force (Super Admin): past the free margin — the margin level drops to 100% → margin call
    adj(&mut h, &kit, Deduct, "chargeback", "50", true, "d3").unwrap();
    assert_eq!(h.st.balance, d("1050.00"));
    assert!(h.st.margin_call, "a forced deduction below the margin call level raises the margin call");
    // negative balance protection is always on: even a forced deduction stops at the balance
    assert_eq!(adj(&mut h, &kit, Deduct, "chargeback", "1050.01", true, "d4").unwrap_err().code, "negative_balance");
    // a forced deduction that pushes the level under stop-out closes the position at once
    adj(&mut h, &kit, Deduct, "chargeback", "600", true, "d5").unwrap();
    assert!(h.st.positions.is_empty(), "stop-out closed the position");
    assert!(h.st.balance >= D::ZERO);
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn taking_credit_back_is_limited_to_the_credit_held_and_the_free_margin() {
    use funds::AdjustOp::*;
    let kit = Kit::new();
    kit.quote("EURUSD", "1.1", "1.1");
    let mut h = Harness::live(&kit, "hedge", "600");
    adj(&mut h, &kit, CreditIn, "bonus", "500", false, "c1").unwrap();
    // more than the credit held: refused, force or not
    assert_eq!(adj(&mut h, &kit, CreditOut, "correction", "500.01", false, "c2").unwrap_err().code, "insufficient_credit");
    assert_eq!(adj(&mut h, &kit, CreditOut, "correction", "500.01", true, "c3").unwrap_err().code, "insufficient_credit");
    place(&mut h, &kit, buy("EURUSD", "1")); // equity 1100, margin 1100 → free margin 0
    assert_eq!(adj(&mut h, &kit, CreditOut, "correction", "100", false, "c4").unwrap_err().code, "insufficient_funds");
    assert_eq!(h.st.credit, d("500.00"));
    // forced: allowed up to the credit held; equity 600 on margin 1100 = 54.5 % → margin call (stop-out at 50 %)
    adj(&mut h, &kit, CreditOut, "correction", "500", true, "c5").unwrap();
    assert_eq!(h.st.credit, d("0.00"));
    assert!(h.st.margin_call && h.st.positions.len() == 1);
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn manual_adjustments_on_demo_accounts_never_touch_real_money_accounts() {
    use funds::AdjustOp::*;
    let kit = Kit::new();
    let mut h = Harness::demo(&kit, "hedge");
    adj(&mut h, &kit, Add, "deposit", "100", false, "m1").unwrap();
    let t = last_txn(&h);
    assert_eq!(t.kind.as_str(), "adjustment", "a demo 'deposit' is never a real deposit");
    assert!(t.postings.iter().any(|p| p.account == crate::model::house_code("demo_funding", "USD")));
    adj(&mut h, &kit, CreditIn, "bonus", "50", false, "m2").unwrap();
    assert!(last_txn(&h).postings.iter().any(|p| p.account == crate::model::house_code("demo_funding", "USD")));
    assert_eq!((h.st.balance, h.st.credit), (d("10100.00"), d("50.00")));
    h.assert_ledger();
    h.assert_replay();
}

#[test]
fn live_account_kind() {
    let kit = Kit::new();
    let h = Harness::live(&kit, "hedge", "0");
    assert_eq!(h.st.account.kind, AccountKind::Live);
}

#[test]
fn options_accounts_open_no_cfds_and_group_changes_stay_within_the_product() {
    let mut kit = Kit::new();
    kit.quote("EURUSD", "1.09990", "1.10010");
    let mut pro = group("options-pro", crate::model::Mode::Hedging, false);
    pro.product = Product::Options;
    kit.tenant.groups.insert("options-pro".into(), pro);
    // an options account: no CFD opens of any kind (market, pending, dealer)
    let mut o = Harness::live(&kit, "options", "10000");
    let dealer = DealerCtx { staff: "Dealer".into(), reason_code: "DLR-01".into(), force: true };
    for req in [buy("EURUSD", "0.1"), OrderReq { kind: OrderType::Limit, price: Some(d("1.09")), ..buy("EURUSD", "0.1") }, OrderReq { dealer: Some(dealer), ..sell("EURUSD", "0.1") }] {
        let e = o.run(&kit, |tx, env| trade::place_order(tx, env, req)).unwrap_err();
        assert_eq!(e.code, "product_mismatch");
        assert_eq!(e.message, "This is an Options account: CFD trading isn't available on it.");
    }
    assert!(o.st.positions.is_empty() && o.st.orders.is_empty());
    // group changes (client and staff both run funds::change_group) stay within the product
    let mut c = Harness::live(&kit, "hedge", "10000");
    let options = kit.tenant.groups["options"].clone();
    assert_eq!(c.run(&kit, |tx, env| funds::change_group(tx, env, &options)).unwrap_err().code, "product_mismatch");
    let hedge = kit.tenant.groups["hedge"].clone();
    assert_eq!(o.run(&kit, |tx, env| funds::change_group(tx, env, &hedge)).unwrap_err().code, "product_mismatch");
    let ecn = kit.tenant.groups["ecn"].clone();
    c.run(&kit, |tx, env| funds::change_group(tx, env, &ecn)).unwrap();
    let pro = kit.tenant.groups["options-pro"].clone();
    o.run(&kit, |tx, env| funds::change_group(tx, env, &pro)).unwrap();
    assert_eq!((c.st.account.group.as_str(), o.st.account.group.as_str()), ("ecn", "options-pro"));
    // CFDs still trade on the CFD account
    place(&mut c, &kit, buy("EURUSD", "0.1"));
    c.assert_replay();
    o.assert_replay();
}

/* ------------------------------------------------------------------ */
/* Property tests                                                      */
/* ------------------------------------------------------------------ */

mod props {
    use super::*;
    use proptest::prelude::*;

    #[derive(Clone, Debug)]
    enum Op {
        Buy(u8, u8),
        Sell(u8, u8),
        Move(u8, i16),
        ClosePart(u8, u8),
        CloseAll,
        Rollover,
        Deposit(u16),
        Withdraw(u16),
    }

    fn op() -> impl Strategy<Value = Op> {
        prop_oneof![
            (0u8..3, 1u8..50).prop_map(|(s, v)| Op::Buy(s, v)),
            (0u8..3, 1u8..50).prop_map(|(s, v)| Op::Sell(s, v)),
            (0u8..3, -300i16..300).prop_map(|(s, m)| Op::Move(s, m)),
            (0u8..8, 1u8..100).prop_map(|(i, v)| Op::ClosePart(i, v)),
            Just(Op::CloseAll),
            Just(Op::Rollover),
            (1u16..5000).prop_map(Op::Deposit),
            (1u16..5000).prop_map(Op::Withdraw),
        ]
    }

    const SYMS: [(&str, &str); 3] = [("EURUSD", "0.00001"), ("USDJPY", "0.001"), ("XAUUSD", "0.01")];

    fn run_ops(group: &str, ops: Vec<Op>) {
        let mut kit = Kit::new();
        kit.now = t("2026-09-21T10:00:00Z");
        let mut px = [d("1.10000"), d("150.000"), d("2600.00")];
        let set = |kit: &Kit, px: &[D; 3]| {
            for (i, (s, pt)) in SYMS.iter().enumerate() {
                let spread = d(pt) * D::from(10);
                kit.quote(s, &px[i].to_string(), &(px[i] + spread).to_string());
            }
        };
        set(&kit, &px);
        let mut h = Harness::live(&kit, group, "20000");
        let mut day = chrono::NaiveDate::from_ymd_opt(2026, 9, 20).unwrap();
        let mut n = 0;
        for o in ops {
            n += 1;
            let key = format!("k{n}");
            let _ = match o {
                Op::Buy(s, v) | Op::Sell(s, v) => {
                    let side = if matches!(o, Op::Buy(..)) { Side::Buy } else { Side::Sell };
                    let vol = D::new(v as i64, 2);
                    h.run(&kit, |tx, env| trade::place_order(tx, env, OrderReq::market(SYMS[s as usize].0, side, vol)).map(|_| ()))
                }
                Op::Move(s, m) => {
                    let i = s as usize;
                    let step = d(SYMS[i].1) * D::from(m as i64 * 10);
                    if px[i] + step > D::ZERO {
                        px[i] += step;
                    }
                    set(&kit, &px);
                    h.tick(&kit, SYMS[i].0);
                    Ok(())
                }
                Op::ClosePart(i, v) => {
                    let Some(p) = h.st.positions.values().nth(i as usize % h.st.positions.len().max(1)).cloned() else { continue };
                    let vol = (p.volume * D::from(v as i64) / D::ONE_HUNDRED).round_dp(2).max(d("0.01"));
                    h.run(&kit, |tx, env| trade::close_position(tx, env, p.ticket, CloseReq { volume: Some(vol), ..Default::default() }).map(|_| ()))
                }
                Op::CloseAll => h.run(&kit, |tx, env| {
                    trade::bulk_close(tx, env, BulkFilter::All, None);
                    Ok(())
                }),
                Op::Rollover => {
                    day = day.succ_opt().unwrap();
                    let at = crate::specs::server_midnight(day.succ_opt().unwrap());
                    h.run(&kit, |tx, env| {
                        risk::rollover(tx, env, day, at);
                        risk::check_margin(tx, env);
                        Ok(())
                    })
                }
                Op::Deposit(a) => h.run(&kit, |tx, env| funds::transfer(tx, env, Direction::In, D::from(a), &key, None).map(|_| ())),
                Op::Withdraw(a) => h.run(&kit, |tx, env| funds::transfer(tx, env, Direction::Out, D::from(a), &key, None).map(|_| ())),
            };
            // invariants after every step
            if h.st.positions.is_empty() {
                assert!(h.st.balance >= D::ZERO, "NBP: flat account with negative balance");
            }
            if h.st.account.mode == crate::model::Mode::Netting {
                let mut seen = std::collections::HashSet::new();
                assert!(h.st.positions.values().all(|p| seen.insert(p.symbol.clone())), "netting: one position per symbol");
            }
            assert!(h.st.positions.values().all(|p| p.volume > D::ZERO));
        }
        h.assert_ledger();
        h.assert_replay();
        // Σ of every posting in every currency is 0 (whole ledger)
        let mut total: std::collections::BTreeMap<String, D> = Default::default();
        for e in &h.log {
            if let Event::Ledger { txn } = e {
                for p in &txn.postings {
                    *total.entry(p.ccy.clone()).or_default() += p.amount;
                }
            }
        }
        assert!(total.values().all(|v| v.is_zero()), "ledger does not net to zero: {total:?}");
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(96))]
        #[test]
        fn hedging_invariants(ops in proptest::collection::vec(op(), 1..60)) {
            run_ops("hedge", ops);
        }
        #[test]
        fn netting_invariants(ops in proptest::collection::vec(op(), 1..60)) {
            run_ops("net", ops);
        }
        #[test]
        fn cent_invariants(ops in proptest::collection::vec(op(), 1..40)) {
            run_ops("cent", ops);
        }
        /// Closing a position in two parts books the same P&L as closing it at once (± 1 cent rounding).
        #[test]
        fn partial_close_additivity(v in 2u32..500, cut in 1u32..99, mv in -5000i64..5000) {
            let kit = Kit::new();
            kit.quote("EURUSD", "1.10000", "1.10000");
            let vol = D::new(v as i64, 2);
            let part = (vol * D::from(cut) / D::ONE_HUNDRED).round_dp(2);
            prop_assume!(part >= d("0.01") && vol - part >= d("0.01"));
            let mut a = Harness::live(&kit, "hedge", "1000000");
            let mut b = Harness::live(&kit, "hedge", "1000000");
            let ta = pos_ticket(&place(&mut a, &kit, buy("EURUSD", &vol.to_string())));
            let tb = pos_ticket(&place(&mut b, &kit, buy("EURUSD", &vol.to_string())));
            let p = d("1.10000") + D::new(mv, 5);
            kit.quote("EURUSD", &p.to_string(), &p.to_string());
            a.run(&kit, |tx, env| trade::close_position(tx, env, ta, CloseReq::default())).unwrap();
            b.run(&kit, |tx, env| trade::close_position(tx, env, tb, CloseReq { volume: Some(part), ..Default::default() })).unwrap();
            b.run(&kit, |tx, env| trade::close_position(tx, env, tb, CloseReq::default())).unwrap();
            prop_assert!((a.st.balance - b.st.balance).abs() <= d("0.01"));
        }
    }
}
