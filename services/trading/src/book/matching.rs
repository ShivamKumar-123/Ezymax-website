//! The matching engine: `apply(&mut UnderlyingBooks, &Cmd) -> Out`, pure (no IO, no clock: time comes in the
//! command), deterministic (ordered maps only), so the journal replays to byte-identical outputs.
//!
//! Rules (docs/OPTIONS-EXCHANGE.md §1, §2):
//! * Price-time priority, FIFO per level; a trade prints at the resting order's price.
//! * Self-trade prevention by user id (`stp`): the incoming remainder is cancelled, the resting order stays.
//! * IOC matches what it can and cancels the rest; FOK fills completely or not at all; post-only never takes
//!   (`would_take`); reduce-only is clipped to the net book position at every match (taker and maker), the rest
//!   is cancelled. Only GTC / GTD orders rest, and an order never rests crossing the book.
//! * Every order that leaves the book (or never enters it) produces exactly one `Done`, so the account shard can
//!   release what it reserved; a duplicate id produces none (the original keeps its reservation).
//! * Every command takes the next sequence number, rejected ones included.
//!
//! Priority is (price, seq) only: nothing here knows which account is a market maker.

use std::sync::Arc;

use super::types::*;
use crate::model::Side;
use crate::money::{D, r2};

/// `{UNDERLYING}.{L|D}{seq}.{n}`.
pub fn fill_id(key: &BookKey, seq: u64, n: usize) -> String {
    format!("{}.{}{}.{}", key.underlying, key.kind_char(), seq, n)
}

/// Premium of a fill in USD, rounded once to cents.
pub fn premium_usd(spec: &SeriesSpec, px: Ticks, qty: Steps, usd_per_quote: D) -> D {
    r2(D::from(px) * spec.tick * D::from(qty) * spec.step * spec.terms.contract_size * usd_per_quote)
}

/// Server day (days since 1970-01-01) of an instant.
fn day_of(at_ms: i64) -> i64 {
    let t = chrono::DateTime::from_timestamp_millis(at_ms).unwrap_or_default();
    (crate::specs::server_date(t) - chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap()).num_days()
}

/// How much `login` may still trade on `side` without growing |position| (reduce-only).
pub fn reduce_cap(sb: &SeriesBook, login: i64, side: Side) -> Steps {
    let p = sb.position(login);
    match side {
        Side::Buy => (-p).max(0),
        Side::Sell => p.max(0),
    }
}

fn crosses(sb: &SeriesBook, side: Side, px: Ticks) -> bool {
    match side {
        Side::Buy => sb.best_ask().is_some_and(|a| a <= px),
        Side::Sell => sb.best_bid().is_some_and(|b| b >= px),
    }
}

fn add_pos(sb: &mut SeriesBook, login: i64, d: Steps) {
    let v = sb.position(login) + d;
    if v == 0 {
        sb.pos.remove(&login);
    } else {
        sb.pos.insert(login, v);
    }
}

fn done(o: Resting, series: &str, status: DoneStatus, reason: &str) -> Done {
    Done { id: o.id, login: o.login, series: series.to_string(), status, reason: reason.to_string(), order: o }
}

/// Why matching stopped.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stop {
    /// Fully filled.
    Filled,
    /// Nothing crossing any more.
    NoCross,
    SelfTrade,
    /// Reduce-only: the position is flat in that direction.
    ReduceCap,
}

struct Ctx<'a> {
    key: &'a BookKey,
    seq: u64,
    at: i64,
    usd_per_quote: D,
}

/// Matches `taker` against the opposite side until it is filled, stops crossing, meets its own user, or a
/// reduce-only cap. Fills and maker removals are appended to `out`.
fn take(sb: &mut SeriesBook, c: &Ctx, taker: &mut Resting, out: &mut Out) -> Stop {
    loop {
        if taker.left <= 0 {
            return Stop::Filled;
        }
        let tcap = if taker.reduce_only() { reduce_cap(sb, taker.login, taker.side) } else { Steps::MAX };
        if tcap <= 0 {
            return Stop::ReduceCap;
        }
        let level = match taker.side {
            Side::Buy => sb.asks.iter().next().filter(|(p, _)| **p <= taker.px).map(|(p, q)| (*p, q.front().copied())),
            Side::Sell => sb.bids.iter().next().filter(|(p, _)| p.0 >= taker.px).map(|(p, q)| (p.0, q.front().copied())),
        };
        let Some((px, Some(mid))) = level else { return Stop::NoCross };
        let maker = sb.orders.get(&mid).cloned().expect("level points at a live order");
        // a GTD order past its expiry never trades (the timer may not have removed it yet)
        if maker.expire_ms.is_some_and(|e| e <= c.at) {
            let o = sb.remove(mid).unwrap();
            out.done.push(done(o, &sb.series, DoneStatus::Expired, "gtd"));
            out.touched.insert(sb.series.clone());
            continue;
        }
        if maker.stp == taker.stp {
            return Stop::SelfTrade;
        }
        let mcap = if maker.reduce_only() { reduce_cap(sb, maker.login, maker.side) } else { Steps::MAX };
        if mcap <= 0 {
            let o = sb.remove(mid).unwrap();
            out.done.push(done(o, &sb.series, DoneStatus::Cancelled, "reduce_only"));
            out.touched.insert(sb.series.clone());
            continue;
        }
        let qty = taker.left.min(maker.left).min(tcap).min(mcap);
        let (maker_before, taker_before) = (maker.clone(), taker.clone());
        // positions: the buyer goes up, the seller down
        let (buyer, seller) = if taker.side == Side::Buy { (taker.login, maker.login) } else { (maker.login, taker.login) };
        add_pos(sb, buyer, qty);
        add_pos(sb, seller, -qty);
        taker.left -= qty;
        taker.filled += qty;
        taker.notional += px * qty;
        let mut m = maker;
        m.left -= qty;
        m.filled += qty;
        m.notional += px * qty;
        let n = out.fills.len();
        out.fills.push(Fill {
            id: fill_id(c.key, c.seq, n),
            seq: c.seq,
            series: sb.series.clone(),
            px,
            qty,
            maker: Party { login: maker_before.login, stp: maker_before.stp, side: maker_before.side, order: Some(maker_before) },
            kind: if taker_before.flags & LIQUIDATION != 0 { FillKind::Liquidation } else { FillKind::Book },
            taker: Party { login: taker_before.login, stp: taker_before.stp, side: taker_before.side, order: Some(taker_before) },
            combo: None,
            usd_per_quote: c.usd_per_quote,
            premium_usd: premium_usd(&sb.spec, px, qty, c.usd_per_quote),
            at: c.at,
            spec: sb.spec.clone(),
        });
        sb.last = Some((px, qty));
        let day = day_of(c.at);
        if sb.vol_day.0 != day {
            sb.vol_day = (day, 0);
        }
        sb.vol_day.1 += qty;
        out.touched.insert(sb.series.clone());
        if m.left == 0 {
            sb.remove(mid);
            out.done.push(done(m, &sb.series, DoneStatus::Filled, "filled"));
        } else if m.reduce_only() && reduce_cap(sb, m.login, m.side) <= 0 {
            sb.remove(mid);
            out.done.push(done(m, &sb.series, DoneStatus::Cancelled, "reduce_only"));
        } else {
            sb.orders.insert(mid, m);
        }
    }
}

/// After `take`: rest the remainder (GTC / GTD that no longer crosses) or end the order.
fn finish(sb: &mut SeriesBook, mut taker: Resting, stop: Stop, out: &mut Out) {
    let series = sb.series.clone();
    match stop {
        Stop::Filled => out.done.push(done(taker, &series, DoneStatus::Filled, "filled")),
        Stop::SelfTrade => out.done.push(done(taker, &series, DoneStatus::Cancelled, "self_trade")),
        Stop::ReduceCap => out.done.push(done(taker, &series, DoneStatus::Cancelled, "reduce_only")),
        Stop::NoCross => {
            if taker.tif.rests() && !crosses(sb, taker.side, taker.px) {
                taker.left = taker.qty - taker.filled;
                out.rested.push(taker.id);
                out.touched.insert(series);
                sb.insert(taker);
            } else {
                let why = if taker.tif == Tif::Fok { "fok" } else { "ioc_remainder" };
                out.done.push(done(taker, &series, DoneStatus::Cancelled, why));
            }
        }
    }
}

fn series_mut<'a>(b: &'a mut UnderlyingBooks, series: &str) -> Option<&'a mut SeriesBook> {
    b.series.get_mut(series).map(Arc::make_mut)
}

/// Applies one command. Every command takes the next sequence number.
pub fn apply(b: &mut UnderlyingBooks, cmd: &Cmd) -> Out {
    b.seq += 1;
    let seq = b.seq;
    let key = b.key.clone();
    let mut out = Out { seq, ok: true, ..Default::default() };
    match cmd {
        Cmd::New { series, spec, order, usd_per_quote, at } => {
            let c = Ctx { key: &key, seq, at: *at, usd_per_quote: *usd_per_quote };
            let mut o = order.clone();
            o.prio = seq;
            o.left = o.qty;
            o.filled = 0;
            o.notional = 0;
            if let Some(sb) = b.book(series)
                && sb.orders.contains_key(&o.id)
            {
                // the original order keeps its reservation: no Done
                return Out::reject(seq, "duplicate", format!("Order #{} is already in the book", o.id));
            }
            let reject = |out: &mut Out, o: Resting, code: &str, msg: String| {
                out.ok = false;
                out.code = Some(code.to_string());
                out.message = Some(msg);
                out.done.push(done(o, series, DoneStatus::Rejected, code));
            };
            if o.qty <= 0 || o.px <= 0 || o.left <= 0 {
                reject(&mut out, o, "invalid_order", "Quantity and price must be at least one step / tick".into());
                return out;
            }
            if o.tif == Tif::Gtd && o.expire_ms.is_none_or(|e| e <= *at) {
                reject(&mut out, o, "invalid_expiry", "A GTD order needs an expiry in the future".into());
                return out;
            }
            match b.book(series) {
                Some(sb) if sb.state != SeriesState::Open => {
                    let st = sb.state;
                    reject(&mut out, o, if st == SeriesState::Closed { "series_closed" } else { "series_cancel_only" }, format!("{series} is {}: only cancels are accepted", st.as_str()));
                    return out;
                }
                Some(sb) if !sb.spec.compatible(spec) => {
                    reject(&mut out, o, "spec_changed", format!("{series}: the contract's tick or step changed while orders rest; ask the desk"));
                    return out;
                }
                Some(_) => {}
                None => {
                    b.series.insert(series.clone(), Arc::new(SeriesBook::new(series, spec.clone())));
                    out.touched.insert(series.clone());
                }
            }
            let sb = series_mut(b, series).unwrap();
            if o.post_only() && crosses(sb, o.side, o.px) {
                reject(&mut out, o, "would_take", "A post-only order would trade immediately".into());
                return out;
            }
            if o.reduce_only() && reduce_cap(sb, o.login, o.side) <= 0 {
                out.done.push(done(o, series, DoneStatus::Cancelled, "reduce_only"));
                return out;
            }
            if o.tif == Tif::Fok {
                // fill completely or not at all: run it on a copy first
                let mut trial = sb.clone();
                let mut t_out = Out::default();
                let mut t = o.clone();
                let stop = take(&mut trial, &c, &mut t, &mut t_out);
                if stop != Stop::Filled {
                    out.done.push(done(o, series, DoneStatus::Cancelled, "fok"));
                    return out;
                }
                *sb = trial;
                out.fills = t_out.fills;
                out.done = t_out.done;
                out.touched = t_out.touched;
                finish(sb, t, Stop::Filled, &mut out);
                return out;
            }
            let stop = take(sb, &c, &mut o, &mut out);
            finish(sb, o, stop, &mut out);
            out
        }
        Cmd::Cancel { series, id, login, reason, .. } => {
            let found = b.book(series).and_then(|sb| sb.orders.get(id)).is_some_and(|o| o.login == *login);
            if !found {
                return Out::reject(seq, "not_found", format!("Order #{id} is not working"));
            }
            let sb = series_mut(b, series).unwrap();
            let o = sb.remove(*id).unwrap();
            out.done.push(done(o, series, DoneStatus::Cancelled, if reason.is_empty() { "cancelled" } else { reason }));
            out.touched.insert(series.clone());
            out
        }
        Cmd::CancelAll { login, series, expiry, ephemeral_only, reason, .. } => {
            let names: Vec<String> = b
                .series
                .iter()
                .filter(|(s, sb)| series.as_ref().is_none_or(|x| x == *s) && expiry.is_none_or(|e| sb.spec.terms.expiry == e))
                .filter(|(_, sb)| sb.orders.values().any(|o| o.login == *login && (!ephemeral_only || o.ephemeral())))
                .map(|(s, _)| s.clone())
                .collect();
            for s in names {
                let sb = series_mut(b, &s).unwrap();
                let ids: Vec<i64> = sb.orders.values().filter(|o| o.login == *login && (!ephemeral_only || o.ephemeral())).map(|o| o.id).collect();
                for id in ids {
                    let o = sb.remove(id).unwrap();
                    out.done.push(done(o, &s, DoneStatus::Cancelled, if reason.is_empty() { "cancelled" } else { reason }));
                }
                out.touched.insert(s);
            }
            out
        }
        Cmd::Amend { series, id, login, px, qty, reserve_per_step, token, usd_per_quote, at } => {
            let Some(cur) = b.book(series).and_then(|sb| sb.orders.get(id)).filter(|o| o.login == *login).cloned() else {
                return Out::reject(seq, "not_found", format!("Order #{id} is not working"));
            };
            let sb_state = b.book(series).unwrap().state;
            let new_px = px.unwrap_or(cur.px);
            let new_qty = qty.unwrap_or(cur.qty);
            if new_px <= 0 {
                return Out::reject(seq, "invalid_price", "The price must be at least one tick");
            }
            if new_qty <= cur.filled {
                return Out::reject(seq, "invalid_qty", format!("Order #{id} has already filled {} steps: cancel it instead", cur.filled));
            }
            let keeps = new_px == cur.px && new_qty <= cur.qty;
            if sb_state != SeriesState::Open && !keeps {
                return Out::reject(seq, "series_cancel_only", format!("{series} accepts cancels and size reductions only"));
            }
            if keeps && new_qty == cur.qty {
                return Out::reject(seq, "no_change", "Nothing changed");
            }
            let sb = series_mut(b, series).unwrap();
            if !keeps && cur.post_only() && crosses(sb, cur.side, new_px) {
                return Out::reject(seq, "would_take", "A post-only order would trade immediately");
            }
            out.touched.insert(series.clone());
            if keeps {
                // size down in place: priority kept
                let mut o = cur;
                o.qty = new_qty;
                o.left = new_qty - o.filled;
                o.reserve_per_step = *reserve_per_step;
                out.amended.push(Amended { id: *id, login: *login, series: series.clone(), px: o.px, qty: o.qty, left: o.left, reserve_per_step: o.reserve_per_step, token: *token });
                sb.orders.insert(*id, o);
                return out;
            }
            // price change or size up: loses priority; an amend that crosses trades like a new order
            let mut o = sb.remove(*id).unwrap();
            o.px = new_px;
            o.qty = new_qty;
            o.left = new_qty - o.filled;
            o.prio = seq;
            o.reserve_per_step = *reserve_per_step;
            out.amended.push(Amended { id: *id, login: *login, series: series.clone(), px: o.px, qty: o.qty, left: o.left, reserve_per_step: o.reserve_per_step, token: *token });
            let c = Ctx { key: &key, seq, at: *at, usd_per_quote: *usd_per_quote };
            let stop = take(sb, &c, &mut o, &mut out);
            finish(sb, o, stop, &mut out);
            out
        }
        Cmd::MassQuote { login, stp, series, quotes, .. } => {
            for s in series {
                if let Some(sb) = series_mut(b, s) {
                    let ids: Vec<i64> = sb.orders.values().filter(|o| o.login == *login && o.ephemeral()).map(|o| o.id).collect();
                    for id in ids {
                        let o = sb.remove(id).unwrap();
                        out.done.push(done(o, s, DoneStatus::Replaced, "replaced"));
                    }
                    out.touched.insert(s.clone());
                }
            }
            for q in quotes {
                let o = Resting {
                    id: q.id,
                    login: *login,
                    stp: *stp,
                    side: q.side,
                    px: q.px,
                    qty: q.qty,
                    left: q.qty,
                    filled: 0,
                    notional: 0,
                    prio: seq,
                    tif: Tif::Gtc,
                    flags: POST_ONLY | EPHEMERAL,
                    expire_ms: None,
                    reserve_per_step: q.reserve_per_step,
                    ext: q.ext.clone(),
                };
                if b.book(&q.series).is_some_and(|sb| sb.orders.contains_key(&q.id)) {
                    continue; // duplicate id: the resting one keeps its reservation
                }
                let why = match b.book(&q.series) {
                    _ if q.qty <= 0 || q.px <= 0 => Some("invalid_order"),
                    Some(sb) if sb.state != SeriesState::Open => Some("series_cancel_only"),
                    Some(sb) if !sb.spec.compatible(&q.spec) => Some("spec_changed"),
                    Some(sb) if crosses(sb, q.side, q.px) => Some("would_take"),
                    _ => None,
                };
                if let Some(code) = why {
                    out.done.push(done(o, &q.series, DoneStatus::Rejected, code));
                    continue;
                }
                if b.book(&q.series).is_none() {
                    b.series.insert(q.series.clone(), Arc::new(SeriesBook::new(&q.series, q.spec.clone())));
                }
                let sb = series_mut(b, &q.series).unwrap();
                out.rested.push(o.id);
                sb.insert(o);
                out.touched.insert(q.series.clone());
            }
            out
        }
        Cmd::RfqQuote { quote: q, at } => {
            if q.legs.is_empty() || q.legs.len() != q.theos.len() || q.qty <= 0 || q.legs.iter().any(|l| l.ratio < 1) || q.theos.iter().any(|t| *t < 0) {
                return Out::reject(seq, "invalid_quote", "A quote needs legs with whole ratios, a size and a theo per leg");
            }
            if (q.bid.is_none() && q.ask.is_none()) || q.bid.zip(q.ask).is_some_and(|(b, a)| b > a) || q.valid_until <= *at {
                return Out::reject(seq, "invalid_quote", "A quote needs a bid and / or an ask (bid ≤ ask) and a validity in the future");
            }
            for l in &q.legs {
                match b.book(&l.series) {
                    Some(sb) if sb.state != SeriesState::Open => {
                        let st = sb.state;
                        return Out::reject(seq, if st == SeriesState::Closed { "series_closed" } else { "series_cancel_only" }, format!("{} is {}", l.series, st.as_str()));
                    }
                    Some(sb) if !sb.spec.compatible(&l.spec) => return Out::reject(seq, "spec_changed", format!("{}: contract units changed", l.series)),
                    _ => {}
                }
            }
            for l in &q.legs {
                if b.book(&l.series).is_none() {
                    b.series.insert(l.series.clone(), Arc::new(SeriesBook::new(&l.series, l.spec.clone())));
                    out.touched.insert(l.series.clone());
                }
            }
            // one live quote per (RFQ, responder); quotes past their validity are dropped
            b.rfqs.retain(|_, x| x.valid_until > *at && !(x.rfq == q.rfq && x.login == q.login));
            b.rfqs.insert(q.quote, q.clone());
            out
        }
        Cmd::RfqAccept { rfq, quote, login, stp, side, limit_net, orders, at } => {
            let fail = |code: &str, msg: String, legs: Option<&[RfqLeg]>| {
                let mut o = Out::reject(seq, code, msg);
                for (i, ord) in orders.iter().enumerate() {
                    let series = legs.and_then(|l| l.get(i)).map(|l| l.series.clone()).unwrap_or_default();
                    o.done.push(done(ord.clone(), &series, DoneStatus::Rejected, code));
                }
                o
            };
            let Some(q) = b.rfqs.get(quote).cloned().filter(|q| q.rfq == *rfq && q.requester == *login) else {
                return fail("quote_expired", "This quote is no longer available: ask for a new one".into(), None);
            };
            if *at > q.valid_until {
                b.rfqs.remove(quote);
                return fail("quote_expired", "The quote has expired: accept the new one".into(), Some(&q.legs));
            }
            if *stp == q.stp || *login == q.login {
                return fail("self_trade", "You cannot trade with your own quote".into(), Some(&q.legs));
            }
            let Some(net) = (if *side == Side::Buy { q.ask } else { q.bid }) else {
                return fail("no_price", "The quote has no price on that side".into(), Some(&q.legs));
            };
            if (*side == Side::Buy && net > *limit_net) || (*side == Side::Sell && net < *limit_net) {
                return fail("price_moved", "The price moved past your limit".into(), Some(&q.legs));
            }
            if orders.len() != q.legs.len() {
                return fail("invalid_order", "One order per leg".into(), Some(&q.legs));
            }
            for (l, o) in q.legs.iter().zip(orders) {
                let leg_side = if *side == Side::Buy { l.side } else { l.side.opposite() };
                if o.side != leg_side || o.qty != l.ratio * q.qty || o.login != *login || o.qty <= 0 {
                    return fail("invalid_order", format!("The order for {} does not match the quote", l.series), Some(&q.legs));
                }
                match b.book(&l.series) {
                    None => return fail("not_found", format!("{} has no book", l.series), Some(&q.legs)),
                    Some(sb) if sb.state != SeriesState::Open => {
                        let st = sb.state;
                        return fail(if st == SeriesState::Closed { "series_closed" } else { "series_cancel_only" }, format!("{} is {}", l.series, st.as_str()), Some(&q.legs));
                    }
                    Some(sb) if (q.reduce_only || o.reduce_only()) && reduce_cap(sb, *login, o.side) < o.qty => {
                        return fail("reduce_only", format!("{}: the combo would grow your position", l.series), Some(&q.legs));
                    }
                    Some(_) => {}
                }
            }
            let px = rfq_split(&q.legs, &q.theos, net, *side);
            b.rfqs.retain(|_, x| x.rfq != *rfq);
            let day = day_of(*at);
            for (i, (l, o)) in q.legs.iter().zip(orders).enumerate() {
                let sb = series_mut(b, &l.series).unwrap();
                let qty = o.qty;
                let (buyer, seller) = if o.side == Side::Buy { (*login, q.login) } else { (q.login, *login) };
                add_pos(sb, buyer, qty);
                add_pos(sb, seller, -qty);
                let mut taker = o.clone();
                taker.prio = seq;
                taker.left = qty;
                taker.filled = 0;
                taker.notional = 0;
                let before = taker.clone();
                taker.left = 0;
                taker.filled = qty;
                taker.notional = px[i] * qty;
                out.fills.push(Fill {
                    id: fill_id(&key, seq, i),
                    seq,
                    series: l.series.clone(),
                    px: px[i],
                    qty,
                    maker: Party { login: q.login, stp: q.stp, side: o.side.opposite(), order: None },
                    taker: Party { login: *login, stp: *stp, side: o.side, order: Some(before) },
                    kind: FillKind::Rfq,
                    combo: Some(*rfq),
                    usd_per_quote: q.usd_per_quote,
                    premium_usd: premium_usd(&sb.spec, px[i], qty, q.usd_per_quote),
                    at: *at,
                    spec: sb.spec.clone(),
                });
                // combo legs move positions and volume; the outright book (levels, last trade) is not touched
                if sb.vol_day.0 != day {
                    sb.vol_day = (day, 0);
                }
                sb.vol_day.1 += qty;
                out.touched.insert(l.series.clone());
                out.done.push(done(taker, &l.series, DoneStatus::Filled, "filled"));
            }
            out
        }
        Cmd::Bust { fill, .. } => {
            let Some(sb) = b.book(&fill.series) else { return Out::reject(seq, "not_found", format!("{} has no book", fill.series)) };
            if sb.state == SeriesState::Closed {
                return Out::reject(seq, "series_closed", format!("{} has expired: a settled fill cannot be busted", fill.series));
            }
            if fill.qty <= 0 || fill.maker.login == fill.taker.login {
                return Out::reject(seq, "invalid_fill", "Not a fill between two accounts");
            }
            let sb = series_mut(b, &fill.series).unwrap();
            let (buyer, seller) = if fill.taker.side == Side::Buy { (fill.taker.login, fill.maker.login) } else { (fill.maker.login, fill.taker.login) };
            add_pos(sb, buyer, -fill.qty);
            add_pos(sb, seller, fill.qty);
            out.busted.push(fill.clone());
            out.touched.insert(fill.series.clone());
            out
        }
        Cmd::Backstop { series, spec, login, stp, side, qty, px, counterparty, counter_stp, usd_per_quote, at } => {
            if *qty <= 0 || *px <= 0 {
                return Out::reject(seq, "invalid_order", "Quantity and price must be at least one step / tick");
            }
            if stp == counter_stp || login == counterparty {
                return Out::reject(seq, "self_trade", "The backstop counterparty is the liquidated client");
            }
            match b.book(series) {
                Some(sb) if sb.state == SeriesState::Closed => return Out::reject(seq, "series_closed", format!("{series} is closed")),
                Some(sb) if !sb.spec.compatible(spec) => return Out::reject(seq, "spec_changed", format!("{series}: contract units changed")),
                Some(_) => {}
                None => {
                    b.series.insert(series.clone(), Arc::new(SeriesBook::new(series, spec.clone())));
                }
            }
            let sb = series_mut(b, series).unwrap();
            let q = (*qty).min(reduce_cap(sb, *login, *side));
            if q <= 0 {
                return Out::reject(seq, "nothing_to_close", format!("No book position to close in {series}"));
            }
            let (buyer, seller) = if *side == Side::Buy { (*login, *counterparty) } else { (*counterparty, *login) };
            add_pos(sb, buyer, q);
            add_pos(sb, seller, -q);
            out.fills.push(Fill {
                id: fill_id(&key, seq, 0),
                seq,
                series: series.clone(),
                px: *px,
                qty: q,
                maker: Party { login: *counterparty, stp: *counter_stp, side: side.opposite(), order: None },
                taker: Party { login: *login, stp: *stp, side: *side, order: None },
                kind: FillKind::Backstop,
                combo: None,
                usd_per_quote: *usd_per_quote,
                premium_usd: premium_usd(&sb.spec, *px, q, *usd_per_quote),
                at: *at,
                spec: sb.spec.clone(),
            });
            sb.last = Some((*px, q));
            let day = day_of(*at);
            if sb.vol_day.0 != day {
                sb.vol_day = (day, 0);
            }
            sb.vol_day.1 += q;
            out.touched.insert(series.clone());
            out
        }
        Cmd::Halt { scope, mode, reason, .. } => {
            let names: Vec<String> = b
                .series
                .iter()
                .filter(|(s, sb)| match scope {
                    HaltScope::All => true,
                    HaltScope::Series(x) => x == *s,
                    HaltScope::Expiry(d) => sb.spec.terms.expiry == *d,
                })
                .filter(|(_, sb)| sb.state != SeriesState::Closed)
                .map(|(s, _)| s.clone())
                .collect();
            for s in names {
                let sb = series_mut(b, &s).unwrap();
                match mode {
                    HaltMode::Halt => {
                        let ids: Vec<i64> = sb.orders.keys().copied().collect();
                        for id in ids {
                            let o = sb.remove(id).unwrap();
                            out.done.push(done(o, &s, DoneStatus::Cancelled, if reason.is_empty() { "halted" } else { reason }));
                        }
                        sb.state = SeriesState::CancelOnly;
                    }
                    HaltMode::CancelOnly => sb.state = SeriesState::CancelOnly,
                    HaltMode::Resume => sb.state = SeriesState::Open,
                }
                out.touched.insert(s);
            }
            out
        }
        Cmd::OpenCheck { bands, .. } => {
            for (s, (lo, hi)) in bands {
                let Some(sb) = series_mut(b, s) else { continue };
                let ids: Vec<i64> = sb.orders.values().filter(|o| (o.side == Side::Buy && o.px > *hi) || (o.side == Side::Sell && o.px < *lo)).map(|o| o.id).collect();
                for id in ids {
                    let o = sb.remove(id).unwrap();
                    out.done.push(done(o, s, DoneStatus::Cancelled, "out_of_band_at_open"));
                    out.touched.insert(s.clone());
                }
            }
            out
        }
        Cmd::Expire { expiry, purge, .. } => {
            b.rfqs.retain(|_, q| q.legs.iter().all(|l| l.spec.terms.expiry != *expiry));
            let names: Vec<String> = b.series.iter().filter(|(_, sb)| sb.spec.terms.expiry == *expiry).map(|(s, _)| s.clone()).collect();
            for s in names {
                let sb = series_mut(b, &s).unwrap();
                let ids: Vec<i64> = sb.orders.keys().copied().collect();
                for id in ids {
                    let o = sb.remove(id).unwrap();
                    out.done.push(done(o, &s, DoneStatus::Expired, "expiry"));
                }
                sb.state = SeriesState::Closed;
                if *purge {
                    b.series.remove(&s);
                }
                out.touched.insert(s);
            }
            out
        }
        Cmd::Seed { series, spec, entries, .. } => {
            let net: i64 = entries.iter().map(|(_, q)| *q).sum();
            if net != 0 || entries.is_empty() {
                return Out::reject(seq, "unbalanced_seed", format!("Seed entries must net to zero (net {net})"));
            }
            match b.book(series) {
                Some(sb) if !sb.spec.compatible(spec) => return Out::reject(seq, "spec_changed", format!("{series}: contract units changed")),
                Some(_) => {}
                None => {
                    b.series.insert(series.clone(), Arc::new(SeriesBook::new(series, spec.clone())));
                }
            }
            let sb = series_mut(b, series).unwrap();
            for (login, q) in entries {
                add_pos(sb, *login, *q);
            }
            out.touched.insert(series.clone());
            out
        }
        Cmd::Timer { at } => {
            let names: Vec<String> = b.series.iter().filter(|(_, sb)| sb.orders.values().any(|o| o.expire_ms.is_some_and(|e| e <= *at))).map(|(s, _)| s.clone()).collect();
            for s in names {
                let sb = series_mut(b, &s).unwrap();
                let ids: Vec<i64> = sb.orders.values().filter(|o| o.expire_ms.is_some_and(|e| e <= *at)).map(|o| o.id).collect();
                for id in ids {
                    let o = sb.remove(id).unwrap();
                    out.done.push(done(o, &s, DoneStatus::Expired, "gtd"));
                }
                out.touched.insert(s);
            }
            out
        }
        Cmd::RestartCancel { .. } => {
            // RFQ quotes did not survive the restart either
            b.rfqs.clear();
            let names: Vec<String> = b.series.iter().filter(|(_, sb)| sb.orders.values().any(|o| o.ephemeral())).map(|(s, _)| s.clone()).collect();
            for s in names {
                let sb = series_mut(b, &s).unwrap();
                let ids: Vec<i64> = sb.orders.values().filter(|o| o.ephemeral()).map(|o| o.id).collect();
                for id in ids {
                    let o = sb.remove(id).unwrap();
                    out.done.push(done(o, &s, DoneStatus::Cancelled, "restart"));
                }
                out.touched.insert(s);
            }
            // a series with nothing left (no order, no position, never traded, open) goes: a series only market-maker
            // quotes created was never stored, so the book loaded after a restart does not have it either — the
            // replay and the live book stay identical
            let empty: Vec<String> = b.series.iter().filter(|(_, sb)| sb.orders.is_empty() && sb.pos.is_empty() && sb.last.is_none() && sb.vol_day.1 == 0 && sb.state == SeriesState::Open).map(|(s, _)| s.clone()).collect();
            for s in empty {
                b.series.remove(&s);
                out.touched.insert(s);
            }
            out
        }
    }
}

/// Leg prices (ticks) of a combo fill at `net` per combo unit, the strategy as built (docs §5): the theos shifted
/// pro rata by ratio × theo so they sum to the net, rounded to ticks, the remainder on the largest leg (then the
/// next ones), no leg below 0. When no whole-tick split makes the net exactly, the last tick goes the taker's way
/// (`side`: the taker buys the strategy as built, or sells it). Integer arithmetic only.
pub fn rfq_split(legs: &[RfqLeg], theos: &[Ticks], net: i64, side: Side) -> Vec<Ticks> {
    let n = legs.len();
    let sign = |i: usize| if legs[i].side == Side::Buy { 1i128 } else { -1i128 };
    let ratio = |i: usize| legs[i].ratio.max(1) as i128;
    let theo_net: i128 = (0..n).map(|i| sign(i) * ratio(i) * theos[i] as i128).sum();
    let diff = net as i128 - theo_net;
    let w: Vec<i128> = (0..n).map(|i| ratio(i) * (theos[i].max(0) as i128)).collect();
    let total: i128 = w.iter().sum();
    // round half away from zero
    let rdiv = |a: i128, b: i128| -> i128 {
        if b == 0 {
            return 0;
        }
        let (a, b) = if b < 0 { (-a, -b) } else { (a, b) };
        if a >= 0 { (2 * a + b) / (2 * b) } else { -((-2 * a + b) / (2 * b)) }
    };
    let mut p: Vec<i128> = (0..n).map(|i| (theos[i] as i128 + if total > 0 { rdiv(sign(i) * diff * w[i], total * ratio(i)) } else { 0 }).max(0)).collect();
    let made = |p: &[i128]| -> i128 { (0..n).map(|i| sign(i) * ratio(i) * p[i]).sum() };
    let mut order: Vec<usize> = (0..n).collect();
    order.sort_by(|a, b| w[*b].cmp(&w[*a]).then(a.cmp(b)));
    let mut r = net as i128 - made(&p);
    // the remainder on the largest leg that takes it exactly
    for &j in &order {
        if r == 0 {
            break;
        }
        if r % ratio(j) == 0 {
            let np = p[j] + sign(j) * (r / ratio(j));
            if np >= 0 {
                p[j] = np;
                r = 0;
            }
        }
    }
    // else as much as each leg takes, largest first
    for &j in &order {
        if r == 0 {
            break;
        }
        let mut q = sign(j) * r / ratio(j);
        if p[j] + q < 0 {
            q = -p[j];
        }
        p[j] += q;
        r = net as i128 - made(&p);
    }
    // what is left is under one tick of one leg: it goes the taker's way (a buyer never pays above the net, a
    // seller never receives below it)
    let mut by_ratio: Vec<usize> = (0..n).collect();
    by_ratio.sort_by(|a, b| ratio(*a).cmp(&ratio(*b)).then(a.cmp(b)));
    for _ in 0..64 {
        let up_wanted = match side {
            Side::Buy if r < 0 => false,
            Side::Sell if r > 0 => true,
            _ => break,
        };
        // a buyer pays less with a buy leg lower or a sell leg higher; a seller receives more the other way round
        let Some(j) = by_ratio.iter().copied().find(|&j| ((sign(j) > 0) == up_wanted) || p[j] > 0) else { break };
        if (sign(j) > 0) == up_wanted {
            p[j] += 1;
        } else {
            p[j] -= 1;
        }
        r = net as i128 - made(&p);
    }
    p.into_iter().map(|x| x as i64).collect()
}

/// Preview: (steps that would fill, Σ px × qty) for an aggressive order of `qty` up to `limit`; stops at the
/// caller's own orders (self-trade prevention would cancel the rest there).
pub fn estimate(sb: &SeriesBook, side: Side, qty: Steps, limit: Ticks, stp: i64) -> (Steps, i64) {
    let mut left = qty;
    let mut notional = 0i64;
    let levels: Vec<(Ticks, Vec<i64>)> = match side {
        Side::Buy => sb.asks.iter().filter(|(p, _)| **p <= limit).map(|(p, q)| (*p, q.iter().copied().collect())).collect(),
        Side::Sell => sb.bids.iter().filter(|(p, _)| p.0 >= limit).map(|(p, q)| (p.0, q.iter().copied().collect())).collect(),
    };
    'outer: for (px, ids) in levels {
        for id in ids {
            let Some(o) = sb.orders.get(&id) else { continue };
            if o.stp == stp {
                break 'outer;
            }
            let q = left.min(o.left);
            notional += px * q;
            left -= q;
            if left == 0 {
                break 'outer;
            }
        }
    }
    (qty - left, notional)
}
