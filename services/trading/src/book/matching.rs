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
            taker: Party { login: taker_before.login, stp: taker_before.stp, side: taker_before.side, order: Some(taker_before) },
            kind: FillKind::Book,
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
        Cmd::RfqQuote { .. } | Cmd::RfqAccept { .. } => Out::reject(seq, "not_implemented", "Combo RFQ is not available yet (docs/OPTIONS-EXCHANGE.md §5, next milestone)"),
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
            out
        }
    }
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
