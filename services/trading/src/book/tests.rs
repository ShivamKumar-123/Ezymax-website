//! Matching property tests (docs/OPTIONS-EXCHANGE.md §13): random command streams against a naive O(n²)
//! reference, plus the invariants: never crossed, price-time priority (= the reference), quantity conserved,
//! FOK all-or-nothing, IOC never rests, post-only never takes, STP never fills one user against itself,
//! reduce-only never grows |position|, positions net to zero, and the journal replays to identical outputs.
//! Pure logic: no market data, no clock.

use proptest::prelude::*;
use std::collections::BTreeMap;
use std::str::FromStr;

use super::journal::{Entry, fingerprint, replay};
use super::matching::apply;
use super::types::*;
use crate::model::{AccountKind, OptRight, OptionTerms, Side};
use crate::money::D;

fn d(s: &str) -> D {
    D::from_str(s).unwrap()
}

pub fn spec() -> SeriesSpec {
    let at = chrono::DateTime::parse_from_rfc3339("2026-10-09T14:00:00Z").unwrap().with_timezone(&chrono::Utc);
    SeriesSpec {
        terms: OptionTerms { series: "EURUSD-20261009-1.1650-C".into(), underlying: "EURUSD".into(), right: OptRight::Call, strike: d("1.165"), expiry: at.date_naive(), expiry_at: at, contract_size: d("10000"), quote_ccy: "USD".into(), barrier: None },
        tick: d("0.00001"),
        step: D::ONE,
    }
}

const S: &str = "EURUSD-20261009-1.1650-C";
const AT: i64 = 1_790_000_000_000;

fn key() -> BookKey {
    BookKey::new(1, AccountKind::Demo, "EURUSD")
}

/// login → user (logins 1 and 2 share user 10: self-trade prevention across accounts of one client)
fn user(login: i64) -> i64 {
    match login {
        1 | 2 => 10,
        x => 10 + x,
    }
}

fn order(id: i64, login: i64, side: Side, px: Ticks, qty: Steps, tif: Tif, flags: u8) -> Resting {
    Resting {
        id,
        login,
        stp: user(login),
        side,
        px,
        qty,
        left: qty,
        filled: 0,
        notional: 0,
        prio: 0,
        tif,
        flags,
        expire_ms: None,
        reserve_per_step: D::ONE,
        ext: OrderExt { origin: "client".into(), ..Default::default() },
    }
}

fn new(o: Resting) -> Cmd {
    Cmd::New { series: S.into(), spec: spec(), order: o, usd_per_quote: D::ONE, at: AT }
}

/* ------------------------------------------------------------------ */
/* Naive reference                                                     */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Default)]
struct RefBook {
    orders: Vec<Resting>,
    pos: BTreeMap<i64, i64>,
    seq: u64,
}

#[derive(Clone, Debug, Default, PartialEq)]
struct RefOut {
    /// (maker id, taker id, px, qty)
    fills: Vec<(i64, i64, Ticks, Steps)>,
    /// (id, status)
    done: Vec<(i64, DoneStatus)>,
    rested: Vec<i64>,
    ok: bool,
}

fn cap(pos: &BTreeMap<i64, i64>, login: i64, side: Side) -> i64 {
    let p = pos.get(&login).copied().unwrap_or(0);
    if side == Side::Buy { (-p).max(0) } else { p.max(0) }
}

impl RefBook {
    fn crosses(&self, side: Side, px: Ticks) -> bool {
        self.orders.iter().any(|o| o.side != side && if side == Side::Buy { o.px <= px } else { o.px >= px })
    }

    /// Best opposite order for a taker by a full scan: best price, then earliest priority.
    fn best(&self, side: Side, px: Ticks) -> Option<usize> {
        let mut best: Option<usize> = None;
        for (i, o) in self.orders.iter().enumerate() {
            if o.side == side || !(if side == Side::Buy { o.px <= px } else { o.px >= px }) {
                continue;
            }
            best = match best {
                None => Some(i),
                Some(j) => {
                    let b = &self.orders[j];
                    let better = if side == Side::Buy { o.px < b.px || (o.px == b.px && o.prio < b.prio) } else { o.px > b.px || (o.px == b.px && o.prio < b.prio) };
                    Some(if better { i } else { j })
                }
            };
        }
        best
    }

    /// Returns why it stopped: 0 filled, 1 no cross, 2 self trade, 3 reduce cap.
    fn take(&mut self, t: &mut Resting, out: &mut RefOut) -> u8 {
        loop {
            if t.left == 0 {
                return 0;
            }
            let tcap = if t.flags & REDUCE_ONLY != 0 { cap(&self.pos, t.login, t.side) } else { i64::MAX };
            if tcap <= 0 {
                return 3;
            }
            let Some(i) = self.best(t.side, t.px) else { return 1 };
            if self.orders[i].stp == t.stp {
                return 2;
            }
            let m = self.orders[i].clone();
            let mcap = if m.flags & REDUCE_ONLY != 0 { cap(&self.pos, m.login, m.side) } else { i64::MAX };
            if mcap <= 0 {
                self.orders.remove(i);
                out.done.push((m.id, DoneStatus::Cancelled));
                continue;
            }
            let q = t.left.min(m.left).min(tcap).min(mcap);
            let (buyer, seller) = if t.side == Side::Buy { (t.login, m.login) } else { (m.login, t.login) };
            *self.pos.entry(buyer).or_default() += q;
            *self.pos.entry(seller).or_default() -= q;
            t.left -= q;
            t.filled += q;
            out.fills.push((m.id, t.id, m.px, q));
            let mo = &mut self.orders[i];
            mo.left -= q;
            mo.filled += q;
            if mo.left == 0 {
                let id = mo.id;
                self.orders.remove(i);
                out.done.push((id, DoneStatus::Filled));
            } else if mo.flags & REDUCE_ONLY != 0 && cap(&self.pos, mo.login, mo.side) <= 0 {
                let id = mo.id;
                self.orders.remove(i);
                out.done.push((id, DoneStatus::Cancelled));
            }
        }
    }

    fn finish(&mut self, mut t: Resting, stop: u8, out: &mut RefOut) {
        match stop {
            0 => out.done.push((t.id, DoneStatus::Filled)),
            2 | 3 => out.done.push((t.id, DoneStatus::Cancelled)),
            _ => {
                if t.tif.rests() && !self.crosses(t.side, t.px) {
                    t.left = t.qty - t.filled;
                    out.rested.push(t.id);
                    self.orders.push(t);
                } else {
                    out.done.push((t.id, DoneStatus::Cancelled));
                }
            }
        }
    }

    fn apply(&mut self, cmd: &Cmd) -> RefOut {
        self.seq += 1;
        let seq = self.seq;
        let mut out = RefOut { ok: true, ..Default::default() };
        match cmd {
            Cmd::New { order, .. } => {
                let mut o = order.clone();
                o.prio = seq;
                o.left = o.qty;
                o.filled = 0;
                if self.orders.iter().any(|x| x.id == o.id) {
                    out.ok = false;
                    return out;
                }
                if o.flags & POST_ONLY != 0 && self.crosses(o.side, o.px) {
                    out.ok = false;
                    out.done.push((o.id, DoneStatus::Rejected));
                    return out;
                }
                if o.flags & REDUCE_ONLY != 0 && cap(&self.pos, o.login, o.side) <= 0 {
                    out.done.push((o.id, DoneStatus::Cancelled));
                    return out;
                }
                if o.tif == Tif::Fok {
                    let mut trial = self.clone();
                    let mut tout = RefOut::default();
                    let mut t = o.clone();
                    if trial.take(&mut t, &mut tout) != 0 {
                        out.done.push((o.id, DoneStatus::Cancelled));
                        return out;
                    }
                    trial.seq = self.seq;
                    *self = trial;
                    out.fills = tout.fills;
                    out.done = tout.done;
                    out.done.push((o.id, DoneStatus::Filled));
                    return out;
                }
                let stop = self.take(&mut o, &mut out);
                self.finish(o, stop, &mut out);
            }
            Cmd::Cancel { id, login, .. } => match self.orders.iter().position(|o| o.id == *id && o.login == *login) {
                Some(i) => {
                    self.orders.remove(i);
                    out.done.push((*id, DoneStatus::Cancelled));
                }
                None => out.ok = false,
            },
            Cmd::Amend { id, login, px, qty, .. } => {
                let Some(i) = self.orders.iter().position(|o| o.id == *id && o.login == *login) else {
                    out.ok = false;
                    return out;
                };
                let cur = self.orders[i].clone();
                let npx = px.unwrap_or(cur.px);
                let nq = qty.unwrap_or(cur.qty);
                if npx <= 0 || nq <= cur.filled {
                    out.ok = false;
                    return out;
                }
                let keeps = npx == cur.px && nq <= cur.qty;
                if keeps && nq == cur.qty {
                    out.ok = false;
                    return out;
                }
                if !keeps && cur.flags & POST_ONLY != 0 && {
                    let mut tmp = self.clone();
                    tmp.orders.remove(i);
                    tmp.crosses(cur.side, npx)
                } {
                    out.ok = false;
                    return out;
                }
                if keeps {
                    let o = &mut self.orders[i];
                    o.qty = nq;
                    o.left = nq - o.filled;
                    return out;
                }
                let mut o = self.orders.remove(i);
                o.px = npx;
                o.qty = nq;
                o.left = nq - o.filled;
                o.prio = seq;
                let stop = self.take(&mut o, &mut out);
                self.finish(o, stop, &mut out);
            }
            _ => unreachable!(),
        }
        out
    }
}

fn summarize(out: &Out) -> RefOut {
    RefOut {
        fills: out.fills.iter().map(|f| (f.maker.order.as_ref().unwrap().id, f.taker.order.as_ref().unwrap().id, f.px, f.qty)).collect(),
        done: out.done.iter().map(|d| (d.id, d.status)).collect(),
        rested: out.rested.clone(),
        ok: out.ok,
    }
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug)]
enum Op {
    New { login: i64, buy: bool, px: i64, qty: i64, tif: u8, post: bool, reduce: bool },
    Cancel { pick: usize },
    Amend { pick: usize, px: Option<i64>, qty: Option<i64> },
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        6 => (1i64..=4, any::<bool>(), 95i64..=105, 1i64..=5, 0u8..4, prop::bool::weighted(0.15), prop::bool::weighted(0.15)).prop_map(|(login, buy, px, qty, tif, post, reduce)| Op::New { login, buy, px, qty, tif, post, reduce }),
        2 => (0usize..50).prop_map(|pick| Op::Cancel { pick }),
        1 => (0usize..50, prop::option::of(95i64..=105), prop::option::of(1i64..=8)).prop_map(|(pick, px, qty)| Op::Amend { pick, px, qty }),
    ]
}

fn to_cmd(op: &Op, next_id: &mut i64, live: &[(i64, i64)]) -> Option<Cmd> {
    Some(match op {
        Op::New { login, buy, px, qty, tif, post, reduce } => {
            *next_id += 1;
            let tif = match tif {
                0 | 1 => Tif::Gtc,
                2 => Tif::Ioc,
                _ => Tif::Fok,
            };
            let mut flags = 0;
            if *post && tif == Tif::Gtc {
                flags |= POST_ONLY;
            }
            if *reduce {
                flags |= REDUCE_ONLY;
            }
            new(order(*next_id, *login, if *buy { Side::Buy } else { Side::Sell }, *px, *qty, tif, flags))
        }
        Op::Cancel { pick } => {
            let (id, login) = *live.get(pick % live.len().max(1))?;
            Cmd::Cancel { series: S.into(), id, login, reason: "cancelled".into(), at: AT }
        }
        Op::Amend { pick, px, qty } => {
            let (id, login) = *live.get(pick % live.len().max(1))?;
            Cmd::Amend { series: S.into(), id, login, px: *px, qty: *qty, reserve_per_step: D::ONE, token: 7, usd_per_quote: D::ONE, at: AT }
        }
    })
}

/// Checks every invariant of one step.
fn check(b: &UnderlyingBooks, cmd: &Cmd, out: &Out, pos_before: &BTreeMap<i64, i64>) {
    let Some(sb) = b.book(S) else { return };
    // never crossed
    if let (Some(bb), Some(ba)) = (sb.best_bid(), sb.best_ask()) {
        assert!(bb < ba, "crossed book {bb} >= {ba} after {cmd:?}");
    }
    // levels and orders agree; quantities conserved on resting orders
    let mut n = 0;
    for (p, q) in &sb.bids {
        for id in q {
            let o = &sb.orders[id];
            assert_eq!((o.side, o.px), (Side::Buy, p.0));
            n += 1;
        }
    }
    for (p, q) in &sb.asks {
        for id in q {
            let o = &sb.orders[id];
            assert_eq!((o.side, o.px), (Side::Sell, *p));
            n += 1;
        }
    }
    assert_eq!(n, sb.orders.len(), "level index out of sync");
    for o in sb.orders.values() {
        assert!(o.left > 0 && o.left + o.filled == o.qty, "qty not conserved {o:?}");
        assert!(o.tif.rests(), "IOC / FOK resting {o:?}");
    }
    // positions net to zero
    assert_eq!(sb.pos.values().sum::<i64>(), 0);
    // fills
    let mut pos = pos_before.clone();
    for f in &out.fills {
        assert_ne!(f.maker.stp, f.taker.stp, "self trade");
        assert!(f.qty > 0 && f.px > 0);
        let m = f.maker.order.as_ref().unwrap();
        assert_eq!(f.px, m.px, "trades print at the resting price");
        let t = f.taker.order.as_ref().unwrap();
        assert!(t.flags & POST_ONLY == 0, "post-only took liquidity");
        assert!(if t.side == Side::Buy { m.px <= t.px } else { m.px >= t.px }, "traded through the limit");
        for p in [&f.maker, &f.taker] {
            let before = pos.get(&p.login).copied().unwrap_or(0);
            let after = before + if p.side == Side::Buy { f.qty } else { -f.qty };
            if p.order.as_ref().is_some_and(|o| o.flags & REDUCE_ONLY != 0) {
                assert!(after.abs() <= before.abs() && after.signum() * before.signum() >= 0, "reduce-only grew or flipped |pos|: {before} → {after}");
            }
            pos.insert(p.login, after);
        }
    }
    pos.retain(|_, v| *v != 0);
    assert_eq!(&pos, &sb.pos, "positions = before + fills");
    // FOK all-or-nothing; IOC never rests
    if let Cmd::New { order, .. } = cmd {
        let mine: Steps = out.fills.iter().filter(|f| f.taker.order.as_ref().is_some_and(|o| o.id == order.id)).map(|f| f.qty).sum();
        if order.tif == Tif::Fok {
            assert!(mine == 0 || mine == order.qty, "FOK partially filled: {mine} of {}", order.qty);
        }
        if !order.tif.rests() {
            assert!(!sb.orders.contains_key(&order.id) && !out.rested.contains(&order.id));
        }
        // every order that does not rest ends with exactly one Done (a duplicate id has none)
        let dones = out.done.iter().filter(|d| d.id == order.id).count();
        if out.code.as_deref() != Some("duplicate") {
            assert_eq!(dones + usize::from(out.rested.contains(&order.id)), 1, "one Done or rested: {out:?}");
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 300, .. ProptestConfig::default() })]

    #[test]
    fn matching_equals_the_naive_reference_and_keeps_every_invariant(ops in prop::collection::vec(op(), 1..120)) {
        let mut b = UnderlyingBooks::new(key());
        let mut r = RefBook::default();
        let mut next_id = 1000;
        let mut journal: Vec<Entry> = Vec::new();
        for op in &ops {
            let live: Vec<(i64, i64)> = b.book(S).map(|sb| sb.orders.values().map(|o| (o.id, o.login)).collect()).unwrap_or_default();
            let Some(cmd) = to_cmd(op, &mut next_id, &live) else { continue };
            let pos_before = b.book(S).map(|sb| sb.pos.clone()).unwrap_or_default();
            let out = apply(&mut b, &cmd);
            let want = r.apply(&cmd);
            prop_assert_eq!(summarize(&out), want, "differs from the reference on {:?}", cmd);
            check(&b, &cmd, &out, &pos_before);
            // the reference's book holds the same orders in the same priority
            let mut mine: Vec<(i64, i64, i64, u64)> = b.book(S).map(|sb| sb.orders.values().map(|o| (o.id, o.px, o.left, o.prio)).collect()).unwrap_or_default();
            let mut theirs: Vec<(i64, i64, i64, u64)> = r.orders.iter().map(|o| (o.id, o.px, o.left, o.prio)).collect();
            mine.sort();
            theirs.sort();
            prop_assert_eq!(mine, theirs);
            journal.push(Entry { seq: out.seq, cmd, out });
        }
        // the journal replays to byte-identical outputs and the same state
        let replayed = replay(UnderlyingBooks::new(key()), &journal).expect("replay identical");
        prop_assert_eq!(fingerprint(&replayed), fingerprint(&b));
    }
}

/* ------------------------------------------------------------------ */
/* Focused cases                                                       */
/* ------------------------------------------------------------------ */

fn run(b: &mut UnderlyingBooks, cmds: Vec<Cmd>) -> Vec<Out> {
    cmds.iter().map(|c| apply(b, c)).collect()
}

#[test]
fn price_time_priority_and_resting_price() {
    let mut b = UnderlyingBooks::new(key());
    let o = run(
        &mut b,
        vec![
            new(order(1, 3, Side::Sell, 101, 2, Tif::Gtc, 0)),
            new(order(2, 4, Side::Sell, 100, 1, Tif::Gtc, 0)),
            new(order(3, 5, Side::Sell, 100, 1, Tif::Gtc, 0)),
            new(order(4, 1, Side::Buy, 105, 3, Tif::Gtc, 0)),
        ],
    );
    let f = &o[3].fills;
    // best price first (100), FIFO inside it (2 before 3), then 101; each at the resting price
    assert_eq!(f.iter().map(|f| (f.maker.order.as_ref().unwrap().id, f.px, f.qty)).collect::<Vec<_>>(), vec![(2, 100, 1), (3, 100, 1), (1, 101, 1)]);
    assert_eq!(f.iter().map(|f| f.id.as_str()).collect::<Vec<_>>(), vec!["EURUSD.D4.0", "EURUSD.D4.1", "EURUSD.D4.2"]);
    // 1 left of order 1 rests; the buyer is filled
    assert_eq!(b.book(S).unwrap().orders[&1].left, 1);
    assert!(o[3].done.iter().any(|d| d.id == 4 && d.status == DoneStatus::Filled));
    // premium rounded once: 0.00100 × 1 × 10 000 = 10.00 USD
    assert_eq!(f[0].premium_usd, d("10.00"));
}

#[test]
fn self_trade_prevention_cancels_the_incoming_remainder_across_one_clients_accounts() {
    let mut b = UnderlyingBooks::new(key());
    let o = run(&mut b, vec![new(order(1, 1, Side::Sell, 100, 2, Tif::Gtc, 0)), new(order(2, 2, Side::Buy, 100, 2, Tif::Gtc, 0))]);
    // logins 1 and 2 are the same user: nothing trades, the resting sell stays
    assert!(o[1].fills.is_empty());
    assert_eq!(o[1].done[0].reason, "self_trade");
    assert!(b.book(S).unwrap().orders.contains_key(&1));
}

#[test]
fn post_only_fok_ioc_and_reduce_only() {
    let mut b = UnderlyingBooks::new(key());
    let o = run(
        &mut b,
        vec![
            new(order(1, 3, Side::Sell, 100, 2, Tif::Gtc, 0)),
            new(order(2, 4, Side::Buy, 100, 1, Tif::Gtc, POST_ONLY)),
            new(order(3, 4, Side::Buy, 100, 3, Tif::Fok, 0)),
            new(order(4, 4, Side::Buy, 100, 3, Tif::Ioc, 0)),
            // 4 is long 2 now: a reduce-only sell of 5 is clipped to 2
            new(order(5, 5, Side::Buy, 90, 5, Tif::Gtc, 0)),
            new(order(6, 4, Side::Sell, 90, 5, Tif::Ioc, REDUCE_ONLY)),
        ],
    );
    assert_eq!((o[1].ok, o[1].code.as_deref(), o[1].done[0].status), (false, Some("would_take"), DoneStatus::Rejected));
    assert!(o[2].fills.is_empty() && o[2].done[0].reason == "fok", "FOK cannot fill 3 of 2");
    assert_eq!(o[3].fills.iter().map(|f| f.qty).sum::<i64>(), 2);
    assert_eq!(o[3].done.iter().find(|d| d.id == 4).unwrap().reason, "ioc_remainder");
    assert_eq!(o[5].fills.iter().map(|f| f.qty).sum::<i64>(), 2);
    assert_eq!(b.book(S).unwrap().position(4), 0);
    assert_eq!(o[5].done.iter().find(|d| d.id == 6).unwrap().reason, "reduce_only");
}

#[test]
fn amend_keeps_priority_on_size_down_and_loses_it_otherwise() {
    let mut b = UnderlyingBooks::new(key());
    run(&mut b, vec![new(order(1, 3, Side::Sell, 100, 3, Tif::Gtc, 0)), new(order(2, 4, Side::Sell, 100, 3, Tif::Gtc, 0))]);
    let a = apply(&mut b, &Cmd::Amend { series: S.into(), id: 1, login: 3, px: None, qty: Some(2), reserve_per_step: D::ONE, token: 1, usd_per_quote: D::ONE, at: AT });
    assert!(a.ok && a.amended[0].left == 2);
    assert_eq!(b.book(S).unwrap().asks[&100].front(), Some(&1), "size down keeps the queue position");
    apply(&mut b, &Cmd::Amend { series: S.into(), id: 1, login: 3, px: None, qty: Some(4), reserve_per_step: D::ONE, token: 2, usd_per_quote: D::ONE, at: AT });
    assert_eq!(b.book(S).unwrap().asks[&100].iter().copied().collect::<Vec<_>>(), vec![2, 1], "size up goes to the back");
    // an amend that crosses trades like a new order
    run(&mut b, vec![new(order(3, 5, Side::Buy, 98, 1, Tif::Gtc, 0))]);
    let x = apply(&mut b, &Cmd::Amend { series: S.into(), id: 3, login: 5, px: Some(100), qty: None, reserve_per_step: D::ONE, token: 3, usd_per_quote: D::ONE, at: AT });
    assert_eq!((x.fills.len(), x.fills[0].maker.order.as_ref().unwrap().id), (1, 2));
}

#[test]
fn halt_expire_seed_backstop_timer_and_restart_cancel() {
    let mut b = UnderlyingBooks::new(key());
    run(&mut b, vec![new(order(1, 3, Side::Sell, 100, 3, Tif::Gtc, 0))]);
    let mut gtd = order(2, 4, Side::Buy, 90, 1, Tif::Gtd, 0);
    gtd.expire_ms = Some(AT + 1000);
    apply(&mut b, &new(gtd));
    let t = apply(&mut b, &Cmd::Timer { at: AT + 1000 });
    assert_eq!((t.done.len(), t.done[0].status), (1, DoneStatus::Expired));
    // a GTD maker past its expiry never trades, even before the timer removed it
    let mut gtd = order(9, 4, Side::Buy, 99, 1, Tif::Gtd, 0);
    gtd.expire_ms = Some(AT + 10);
    apply(&mut b, &new(gtd));
    let late = apply(&mut b, &Cmd::New { series: S.into(), spec: spec(), order: order(10, 5, Side::Sell, 99, 1, Tif::Ioc, 0), usd_per_quote: D::ONE, at: AT + 10 });
    assert!(late.fills.is_empty() && late.done.iter().any(|d| d.id == 9 && d.status == DoneStatus::Expired));
    // seed: positions must net to zero
    assert!(!apply(&mut b, &Cmd::Seed { series: S.into(), spec: spec(), entries: vec![(7, 2)], at: AT }).ok);
    assert!(apply(&mut b, &Cmd::Seed { series: S.into(), spec: spec(), entries: vec![(7, 2), (8, -2)], at: AT }).ok);
    // backstop: the liquidated long 7 sells 5 to 9 at 80, clipped to its 2
    let bs = apply(&mut b, &Cmd::Backstop { series: S.into(), spec: spec(), login: 7, stp: 17, side: Side::Sell, qty: 5, px: 80, counterparty: 9, counter_stp: 19, usd_per_quote: D::ONE, at: AT });
    assert_eq!((bs.fills[0].qty, bs.fills[0].kind, b.book(S).unwrap().position(9)), (2, FillKind::Backstop, 2));
    // cancel-only: no new orders, cancels work
    apply(&mut b, &Cmd::Halt { scope: HaltScope::All, mode: HaltMode::CancelOnly, reason: "test".into(), at: AT });
    assert_eq!(apply(&mut b, &new(order(3, 4, Side::Buy, 90, 1, Tif::Gtc, 0))).code.as_deref(), Some("series_cancel_only"));
    apply(&mut b, &Cmd::Halt { scope: HaltScope::All, mode: HaltMode::Resume, reason: "test".into(), at: AT });
    // mass quote (ephemeral), then a restart drops it
    let q = QuoteIn { series: S.into(), spec: spec(), id: 50, side: Side::Buy, px: 95, qty: 2, reserve_per_step: D::ONE, ext: OrderExt::default() };
    let mq = apply(&mut b, &Cmd::MassQuote { login: 6, stp: 16, series: vec![S.into()], quotes: vec![q], at: AT });
    assert_eq!(mq.rested, vec![50]);
    let rc = apply(&mut b, &Cmd::RestartCancel { at: AT });
    assert_eq!(rc.done.iter().map(|d| d.id).collect::<Vec<_>>(), vec![50]);
    // expiry: every order goes, the series closes; purge drops it
    let e = apply(&mut b, &Cmd::Expire { expiry: spec().terms.expiry, purge: false, at: AT });
    assert!(e.done.iter().all(|d| d.status == DoneStatus::Expired) && b.book(S).unwrap().state == SeriesState::Closed);
    apply(&mut b, &Cmd::Expire { expiry: spec().terms.expiry, purge: true, at: AT });
    assert!(b.book(S).is_none());
}

/* ------------------------------------------------------------------ */
/* Combo RFQ, bust, liquidation prints                                  */
/* ------------------------------------------------------------------ */

const S2: &str = "EURUSD-20261009-1.1700-C";

fn spec2() -> SeriesSpec {
    let mut s = spec();
    s.terms.series = S2.into();
    s.terms.strike = d("1.17");
    s
}

fn leg(series: &str, side: Side, ratio: i64) -> RfqLeg {
    RfqLeg { series: series.into(), spec: if series == S { spec() } else { spec2() }, side, ratio }
}

/// A call spread quoted by responder 9 (user 19) to requester 3 (user 13): buy 1× 1.1650 C, sell 1× 1.1700 C.
fn spread_quote(rfq: i64, quote: i64, qty: Steps, valid_until: i64) -> RfqQuoteIn {
    RfqQuoteIn {
        rfq,
        quote,
        requester: 3,
        requester_stp: user(3),
        login: 9,
        stp: user(9),
        legs: vec![leg(S, Side::Buy, 1), leg(S2, Side::Sell, 1)],
        qty,
        reduce_only: false,
        bid: Some(190),
        ask: Some(210),
        theos: vec![520, 320],
        valid_until,
        usd_per_quote: D::ONE,
    }
}

fn leg_order(id: i64, login: i64, side: Side, qty: Steps) -> Resting {
    order(id, login, side, 0, qty, Tif::Ioc, 0)
}

#[test]
fn rfq_split_hits_the_net_on_ticks_without_negative_legs() {
    let legs = vec![leg(S, Side::Buy, 1), leg(S2, Side::Sell, 1)];
    // theo net 200, ask 210: the 10 ticks are spread pro rata to ratio × theo, the sum is exact
    let p = super::matching::rfq_split(&legs, &[520, 320], 210, Side::Buy);
    assert_eq!(rfq_net(&legs, &p), 210);
    assert!(p.iter().all(|x| *x >= 0));
    // a butterfly 1:2:1 (buy, sell 2, buy)
    let fly = vec![leg(S, Side::Buy, 1), leg(S2, Side::Sell, 2), RfqLeg { series: "X".into(), spec: spec(), side: Side::Buy, ratio: 1 }];
    for net in [-7, 0, 1, 3, 40, 41] {
        let p = super::matching::rfq_split(&fly, &[500, 300, 150], net, Side::Buy);
        assert!(p.iter().all(|x| *x >= 0), "{p:?}");
        assert_eq!(rfq_net(&fly, &p), net, "butterfly at {net}: {p:?}");
    }
    // 2:2 ratios cannot make an odd net: the last tick goes the taker's way
    let two = vec![leg(S, Side::Buy, 2), leg(S2, Side::Sell, 2)];
    let p = super::matching::rfq_split(&two, &[500, 300], 401, Side::Buy);
    assert!(rfq_net(&two, &p) <= 401 && rfq_net(&two, &p) >= 399, "a buyer never pays above the net: {p:?}");
    let p = super::matching::rfq_split(&two, &[500, 300], 401, Side::Sell);
    assert!(rfq_net(&two, &p) >= 401 && rfq_net(&two, &p) <= 403, "a seller never receives below it: {p:?}");
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 512, ..ProptestConfig::default() })]

    /// Every split is on whole ticks and never below 0; it errs from the net only in the taker's favour and by
    /// less than one leg's ratio; with every leg above 0 and a ratio-1 leg it makes the net exactly.
    #[test]
    fn rfq_split_properties(n in 1usize..5, theos in prop::collection::vec(0i64..5_000, 5), ratios in prop::collection::vec(1i64..4, 5), sides in prop::collection::vec(any::<bool>(), 5), shift in -500i64..500, buy in any::<bool>()) {
        let mut legs: Vec<RfqLeg> = (0..n).map(|i| RfqLeg { series: format!("L{i}"), spec: spec(), side: if sides[i] { Side::Buy } else { Side::Sell }, ratio: ratios[i] }).collect();
        legs[0].ratio = 1;
        let th = &theos[..n];
        let net = rfq_net(&legs, th) + shift;
        let side = if buy { Side::Buy } else { Side::Sell };
        let p = super::matching::rfq_split(&legs, th, net, side);
        prop_assert!(p.iter().all(|x| *x >= 0));
        let made = rfq_net(&legs, &p);
        if made != net {
            // a ratio-1 leg takes any remainder: only a leg held at 0 can leave the net out of reach
            prop_assert!(p.iter().any(|x| *x == 0), "{p:?} {made} vs {net}");
        }
        // a net between the legs' theos ± their prices (what a quote around the theo is) is always made exactly
        if th.iter().all(|t| *t > 600) && shift.abs() < 500 {
            prop_assert_eq!(made, net, "{:?}", p);
        }
    }
}

#[test]
fn rfq_accept_fills_every_leg_atomically_and_replays() {
    let mut b = UnderlyingBooks::new(key());
    let mut j = Vec::new();
    let mut go = |b: &mut UnderlyingBooks, c: Cmd| {
        let o = apply(b, &c);
        j.push(Entry { seq: o.seq, cmd: c, out: o.clone() });
        o
    };
    // a resting outright order is never touched by a combo
    go(&mut b, new(order(1, 4, Side::Sell, 600, 5, Tif::Gtc, 0)));
    assert!(go(&mut b, Cmd::RfqQuote { quote: spread_quote(77, 501, 2, AT + 5_000), at: AT }).ok);
    // limit / size mismatch / wrong requester: rejected, every leg order released (Done rejected)
    let orders = vec![leg_order(11, 3, Side::Buy, 2), leg_order(12, 3, Side::Sell, 2)];
    let x = go(&mut b, Cmd::RfqAccept { rfq: 77, quote: 501, login: 3, stp: user(3), side: Side::Buy, limit_net: 209, orders: orders.clone(), at: AT + 10 });
    assert_eq!((x.ok, x.code.as_deref(), x.fills.len()), (false, Some("price_moved"), 0));
    assert_eq!(x.done.iter().map(|d| (d.id, d.status)).collect::<Vec<_>>(), vec![(11, DoneStatus::Rejected), (12, DoneStatus::Rejected)]);
    let x = go(&mut b, Cmd::RfqAccept { rfq: 77, quote: 501, login: 3, stp: user(3), side: Side::Buy, limit_net: 210, orders: vec![leg_order(13, 3, Side::Buy, 3), leg_order(14, 3, Side::Sell, 3)], at: AT + 10 });
    assert_eq!(x.code.as_deref(), Some("invalid_order"), "the size must be ratio × qty");
    let x = go(&mut b, Cmd::RfqAccept { rfq: 77, quote: 501, login: 5, stp: user(5), side: Side::Buy, limit_net: 210, orders: vec![leg_order(15, 5, Side::Buy, 2), leg_order(16, 5, Side::Sell, 2)], at: AT + 10 });
    assert_eq!(x.code.as_deref(), Some("quote_expired"), "only the requester can accept");
    // accepted: both legs, one seq, combo id, positions both ways, the outright book untouched
    let x = go(&mut b, Cmd::RfqAccept { rfq: 77, quote: 501, login: 3, stp: user(3), side: Side::Buy, limit_net: 210, orders: orders.clone(), at: AT + 20 });
    assert!(x.ok, "{x:?}");
    assert_eq!(x.fills.len(), 2);
    assert!(x.fills.iter().all(|f| f.kind == FillKind::Rfq && f.combo == Some(77) && f.seq == x.seq && f.maker.login == 9 && f.taker.login == 3 && f.maker.order.is_none()));
    assert_eq!(rfq_net(&[leg(S, Side::Buy, 1), leg(S2, Side::Sell, 1)], &[x.fills[0].px, x.fills[1].px]), 210);
    assert_eq!((b.book(S).unwrap().position(3), b.book(S2).unwrap().position(3), b.book(S).unwrap().position(9), b.book(S2).unwrap().position(9)), (2, -2, -2, 2));
    assert_eq!((b.book(S).unwrap().orders.len(), b.book(S).unwrap().last), (1, None), "outright book and last trade untouched");
    assert_eq!(x.done.iter().filter(|d| d.status == DoneStatus::Filled).count(), 2);
    // the quote is consumed: a second accept is refused
    let x = go(&mut b, Cmd::RfqAccept { rfq: 77, quote: 501, login: 3, stp: user(3), side: Side::Buy, limit_net: 210, orders: vec![leg_order(17, 3, Side::Buy, 2), leg_order(18, 3, Side::Sell, 2)], at: AT + 30 });
    assert_eq!(x.code.as_deref(), Some("quote_expired"));
    // an expired quote; reduce-only that would grow a position (all legs or none); self trade
    go(&mut b, Cmd::RfqQuote { quote: spread_quote(78, 502, 1, AT + 100), at: AT + 40 });
    let x = go(&mut b, Cmd::RfqAccept { rfq: 78, quote: 502, login: 3, stp: user(3), side: Side::Sell, limit_net: 190, orders: vec![leg_order(19, 3, Side::Sell, 1), leg_order(20, 3, Side::Buy, 1)], at: AT + 101 });
    assert_eq!(x.code.as_deref(), Some("quote_expired"));
    let mut q = spread_quote(79, 503, 3, AT + 5_000);
    q.reduce_only = true;
    go(&mut b, Cmd::RfqQuote { quote: q, at: AT + 50 });
    let x = go(&mut b, Cmd::RfqAccept { rfq: 79, quote: 503, login: 3, stp: user(3), side: Side::Sell, limit_net: 190, orders: vec![leg_order(21, 3, Side::Sell, 3), leg_order(22, 3, Side::Buy, 3)], at: AT + 60 });
    assert_eq!((x.code.as_deref(), x.fills.len()), (Some("reduce_only"), 0), "3 would flip the 2 held: nothing fills");
    assert_eq!(b.book(S).unwrap().position(3), 2);
    let mut q = spread_quote(80, 504, 1, AT + 5_000);
    q.requester = 1;
    q.requester_stp = user(1);
    q.stp = user(2);
    go(&mut b, Cmd::RfqQuote { quote: q, at: AT + 60 });
    let x = go(&mut b, Cmd::RfqAccept { rfq: 80, quote: 504, login: 1, stp: user(1), side: Side::Buy, limit_net: 210, orders: vec![leg_order(23, 1, Side::Buy, 1), leg_order(24, 1, Side::Sell, 1)], at: AT + 70 });
    assert_eq!(x.code.as_deref(), Some("self_trade"), "accounts 1 and 2 belong to one client");
    // Σ positions per series stays 0
    for (_, (sum, _)) in super::journal::position_sums(&b) {
        assert_eq!(sum, 0);
    }
    // the journal replays to byte-identical outputs and the same state
    let r = replay(UnderlyingBooks::new(key()), &j).expect("replay identical");
    assert_eq!(fingerprint(&r), fingerprint(&b));
    // a restart forgets the quotes (like market-maker quotes)
    apply(&mut b, &Cmd::RfqQuote { quote: spread_quote(81, 505, 1, AT + 9_000), at: AT + 80 });
    apply(&mut b, &Cmd::RestartCancel { at: AT + 90 });
    assert!(b.rfqs.is_empty());
}

#[test]
fn bust_moves_the_positions_back_and_liquidation_orders_print_as_liquidation() {
    let mut b = UnderlyingBooks::new(key());
    run(&mut b, vec![new(order(1, 3, Side::Sell, 500, 4, Tif::Gtc, 0))]);
    let x = apply(&mut b, &new(order(2, 4, Side::Buy, 500, 3, Tif::Ioc, LIQUIDATION)));
    assert_eq!((x.fills[0].kind, x.fills[0].qty), (FillKind::Liquidation, 3));
    let f = x.fills[0].clone();
    assert_eq!((b.book(S).unwrap().position(3), b.book(S).unwrap().position(4)), (-3, 3));
    let y = apply(&mut b, &Cmd::Bust { fill: f.clone(), reason: "off market".into(), at: AT });
    assert!(y.ok && y.busted == vec![f.clone()]);
    assert_eq!((b.book(S).unwrap().position(3), b.book(S).unwrap().position(4)), (0, 0));
    // an expired series cannot be busted
    apply(&mut b, &Cmd::Expire { expiry: spec().terms.expiry, purge: false, at: AT });
    assert_eq!(apply(&mut b, &Cmd::Bust { fill: f, reason: "late".into(), at: AT }).code.as_deref(), Some("series_closed"));
}

/// Same-rules guarantee 2: the matching engine and the actor never refer to a market-maker login or group.
#[test]
fn matching_and_actor_never_mention_the_market_maker() {
    for (name, src) in [("matching.rs", include_str!("matching.rs")), ("actor.rs", include_str!("actor.rs"))] {
        let code: String = src.lines().filter(|l| !l.trim_start().starts_with("//")).collect::<Vec<_>>().join("\n");
        for word in ["OPTIONS_MM", "options-mm", "LP_GROUP", "is_lp", "lp_users", "mm_user"] {
            assert!(!code.contains(word), "{name} mentions {word}");
        }
    }
}

/// Matching cost per command on a busy book (run: `cargo test -p trading --release --lib book_matching_cost -- --ignored --nocapture`).
#[test]
#[ignore]
fn book_matching_cost() {
    let mut b = UnderlyingBooks::new(key());
    let mut rng: u64 = 42;
    let mut next = || {
        rng ^= rng << 13;
        rng ^= rng >> 7;
        rng ^= rng << 17;
        rng
    };
    let mut times = Vec::with_capacity(200_000);
    for i in 0..200_000i64 {
        let r = next();
        let login = (r % 200) as i64 + 3;
        let side = if r & 1 == 0 { Side::Buy } else { Side::Sell };
        let px = 900 + ((r >> 8) % 200) as i64;
        let tif = if (r >> 20) % 5 == 0 { Tif::Ioc } else { Tif::Gtc };
        let cmd = if (r >> 24) % 4 == 0 {
            let live = b.book(S).map(|sb| sb.orders.keys().copied().next()).flatten();
            match live {
                Some(id) => Cmd::Cancel { series: S.into(), id, login: b.book(S).unwrap().orders[&id].login, reason: "x".into(), at: AT },
                None => continue,
            }
        } else {
            new(order(10_000 + i, login, side, px, 1 + ((r >> 30) % 5) as i64, tif, 0))
        };
        let t = std::time::Instant::now();
        let w = b.clone();
        let mut w2 = w;
        let _ = apply(&mut w2, &cmd);
        b = w2;
        times.push(t.elapsed().as_nanos() as u64);
    }
    times.sort();
    let p = |q: f64| times[((times.len() as f64) * q) as usize] as f64 / 1000.0;
    eprintln!("orders resting {}, apply incl. CoW clone: p50 {:.1} µs, p99 {:.1} µs, p99.9 {:.1} µs", b.resting(), p(0.5), p(0.99), p(0.999));
}
