//! Liquidation of order-book positions (docs/OPTIONS-EXCHANGE.md §8).
//!
//! 1. At stop-out, `engine::options::stop_out` closes what closes at the house (CFDs, house-priced options) and
//!    flags the transaction (`tx.liquidate`) when an order-book unit would free the most margin; the shard hands
//!    the account to this loop once the transaction is committed.
//! 2. The loop cancels every book order of the account (and waits until that is applied), then re-reads the
//!    account and picks the book unit that frees the most margin (`engine::options_book::liq_plan`: `units_of` /
//!    `margin_without`, strategies with all their legs).
//! 3. Closing: an option leg is a reduce-only IOC on the book at mark × (1 ∓ `liqBandPct`) (its fills print
//!    `liquidation`); a strategy goes to the market maker as a reduce-only combo RFQ, auto-accepted (legged on the
//!    book when that fails).
//! 4. **Backstop**: whatever is left goes to `Cmd::Backstop` — the Kalks market maker takes it at mark ∓
//!    max(`liqFeePct` × mark, 1 tick), outside its quoting limits (tape: `backstop`).
//! 5. Repeat until the margin level is above stop-out or nothing more closes. Every step is a row of
//!    `option_liquidations`. Negative balance protection applies afterwards (the account's own stop-out path).

use chrono::Utc;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use super::types::*;
use super::{BookKey, entry};
use crate::api::AppState;
use crate::engine::options_book::{self as ob, BookReq, LiqLeg, LiqPlan};
use crate::model::{AccountKind, Side, Source};
use crate::money::{D, ZERO, num};

/// A login is liquidated at most once per this interval (a closed market keeps it past stop-out; ticks would
/// hand it over again and again).
pub const COOLDOWN_MS: i64 = 5_000;
pub const MAX_STEPS: usize = 50;

/// Starts the liquidator (single engine instance) and registers its channel with the books.
pub fn spawn(st: AppState) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<i64>();
    *st.hub.shared.books.liquidator.lock().unwrap() = Some(tx);
    let busy: Arc<Mutex<HashSet<i64>>> = Arc::default();
    let last: Arc<Mutex<HashMap<i64, i64>>> = Arc::default();
    tokio::spawn(async move {
        while let Some(login) = rx.recv().await {
            let now = Utc::now().timestamp_millis();
            if busy.lock().unwrap().contains(&login) || last.lock().unwrap().get(&login).is_some_and(|t| now - t < COOLDOWN_MS) {
                continue;
            }
            busy.lock().unwrap().insert(login);
            last.lock().unwrap().insert(login, now);
            let (st2, busy2) = (st.clone(), busy.clone());
            tokio::spawn(async move {
                match liquidate(&st2, login).await {
                    Ok(r) if r.steps > 0 => tracing::warn!(login, steps = r.steps, closed = %r.closed, level = ?r.level_after, "options liquidation run"),
                    Ok(_) => {}
                    Err(e) => tracing::error!(login, error = %e, "options liquidation failed"),
                }
                busy2.lock().unwrap().remove(&login);
            });
        }
    });
}

/// What a liquidation run did.
#[derive(Clone, Debug, Default)]
pub struct Report {
    pub run_id: String,
    pub steps: usize,
    /// Contracts closed (book, RFQ and backstop).
    pub closed: D,
    pub backstopped: D,
    pub level_after: Option<D>,
    pub rows: Vec<Value>,
}

async fn level_of(st: &AppState, login: i64) -> Option<D> {
    let v = st.hub.read(login, Box::new(|x| x.map(|(a, env)| json!(crate::engine::metrics(env, a).level.map(|l| l.to_string()))).unwrap_or(Value::Null))).await;
    v.as_str().and_then(|s| s.parse().ok())
}

#[allow(clippy::too_many_arguments)]
async fn log(st: &AppState, tenant_id: i64, kind: AccountKind, login: i64, run: &str, step: usize, route: &str, unit: Value, result: Value, before: Option<D>, after: Option<D>) -> Value {
    let _ = sqlx::query("INSERT INTO option_liquidations (tenant_id, login, run_id, step, action, unit, result, level_before, level_after, kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)")
        .bind(tenant_id)
        .bind(login)
        .bind(run)
        .bind(step as i32)
        .bind(route)
        .bind(sqlx::types::Json(&unit))
        .bind(sqlx::types::Json(&result))
        .bind(before)
        .bind(after)
        .bind(kind.as_str())
        .execute(&st.pool)
        .await;
    json!({"step": step, "route": route, "unit": unit, "result": result, "before": before.map(num), "after": after.map(num)})
}

/// Liquidates `login` until its margin level is above stop-out or nothing more closes.
pub async fn liquidate(st: &AppState, login: i64) -> anyhow::Result<Report> {
    let hub = &st.hub;
    let meta = hub.meta(login).ok_or_else(|| anyhow::anyhow!("unknown account {login}"))?;
    let (tenant_id, kind) = (meta.tenant_id, meta.kind);
    let now_ms = hub.shared.clock.now().timestamp_millis();
    let mut rep = Report { run_id: format!("liq:{login}:{now_ms}"), ..Default::default() };
    // 1. every book order of the account goes first (its reservations come back)
    let at = hub.shared.clock.now().timestamp_millis();
    let working = hub.read(login, Box::new(|x| json!(x.map(|(a, _)| a.book.orders.values().map(|w| w.underlying.clone()).collect::<std::collections::BTreeSet<_>>()).unwrap_or_default()))).await;
    for u in working.as_array().cloned().unwrap_or_default().iter().filter_map(Value::as_str) {
        let key = BookKey::new(tenant_id, kind, u);
        let _ = entry::call(hub, login, &key, Cmd::CancelAll { login, series: None, expiry: None, ephemeral_only: false, reason: "liquidation".into(), at }).await;
    }
    let mut skip: Vec<i64> = Vec::new();
    for step in 1..=MAX_STEPS {
        let sk = skip.clone();
        let plan: Option<LiqPlan> = match entry::exec_typed(hub, login, "system:liquidator", move |tx, env| ob::liq_plan(tx, env, &sk)).await {
            Ok(p) => p,
            Err(e) => anyhow::bail!("liquidation plan of {login}: {e:?}"),
        };
        let Some(plan) = plan else { break };
        let before = plan.level;
        let tickets: Vec<i64> = plan.legs.iter().map(|l| l.ticket).collect();
        let unit = json!({"type": plan.unit, "combo": plan.combo, "tickets": tickets, "series": plan.legs.iter().map(|l| l.series.clone()).collect::<Vec<_>>(), "userId": plan.user_id});
        let mut closed_now = ZERO;
        // a strategy: one reduce-only combo RFQ to the market maker, auto-accepted
        if plan.legs.len() > 1
            && let Some((c, row)) = by_rfq(st, login, tenant_id, kind, &plan, &rep.run_id, step, before, unit.clone()).await
        {
            closed_now += c;
            rep.rows.push(row);
        }
        if closed_now.is_zero() {
            for leg in &plan.legs {
                let share = plan.freed / D::from(plan.legs.len().max(1) as i64);
                let (c, rows) = close_leg(st, login, tenant_id, kind, meta.user_id, leg, &rep.run_id, step, before, unit.clone(), share).await;
                closed_now += c;
                rep.rows.extend(rows);
            }
        }
        rep.steps = step;
        rep.closed += closed_now;
        if closed_now.is_zero() {
            skip.extend(tickets);
        }
    }
    rep.backstopped = rep.rows.iter().filter(|r| r["route"] == "backstop").filter_map(|r| r["result"]["qty"].as_str().and_then(|s| s.parse::<D>().ok())).sum();
    rep.level_after = level_of(st, login).await;
    Ok(rep)
}

/// Book first (a reduce-only IOC within the liquidation band), then the backstop for the rest. Returns the
/// contracts closed and the log rows.
#[allow(clippy::too_many_arguments)]
async fn close_leg(st: &AppState, login: i64, tenant_id: i64, kind: AccountKind, user_id: i64, leg: &LiqLeg, run: &str, step: usize, before: Option<D>, unit: Value, freed: D) -> (D, Vec<Value>) {
    let hub = &st.hub;
    let mut rows = Vec::new();
    let px = ob::liq_limit(leg);
    let mut req = BookReq::limit(&leg.series, leg.side, leg.contracts, D::from(px) * leg.tick);
    req.tif = Tif::Ioc;
    req.reduce_only = true;
    req.liquidation = true;
    req.origin = run.to_string();
    req.source = Source::System;
    let mut filled = ZERO;
    let mut notional = ZERO;
    let (status, note) = match entry::submit(hub, login, "system:liquidator", req).await {
        Ok(sub) => {
            if let Some(out) = &sub.out {
                for f in out.fills.iter().filter(|f| f.taker.order.as_ref().is_some_and(|o| o.id == sub.id)) {
                    filled += f.spec.contracts(f.qty);
                    notional += f.spec.price(f.px) * f.spec.contracts(f.qty);
                }
            }
            (if filled >= leg.contracts { "done" } else if filled > ZERO { "partial" } else { "failed" }, if filled.is_zero() { Some("no bids or offers inside the liquidation band".to_string()) } else { None })
        }
        Err(e) => ("failed", Some(format!("{e:?}"))),
    };
    let after = level_of(st, login).await;
    let avg = if filled > ZERO { Some(num(notional / filled)) } else { None };
    rows.push(log(st, tenant_id, kind, login, run, step, "book", with(&unit, json!({"series": leg.series, "ticket": leg.ticket})), json!({"qty": filled.to_string(), "price": avg, "limit": num(D::from(px) * leg.tick), "status": status, "note": note, "side": leg.side.as_str(), "freedMarginUsd": num(crate::money::r2(freed * filled / leg.contracts))}), before, after).await);
    let rest = leg.contracts - filled;
    if rest <= ZERO || after.is_some_and(|l| l > stop_out_of(st, login)) {
        return (filled, rows);
    }
    // the backstop: the Kalks market maker takes the rest at mark ∓ the liquidation fee
    let mm = match crate::book::mm::account(st, tenant_id, kind).await {
        Ok(l) => l,
        Err(e) => {
            rows.push(log(st, tenant_id, kind, login, run, step, "backstop", json!({"series": leg.series, "ticket": leg.ticket}), json!({"qty": "0", "status": "failed", "note": format!("no market-maker account: {e}")}), after, after).await);
            return (filled, rows);
        }
    };
    let mm_user = hub.meta(mm).map(|m| m.user_id).unwrap_or(0);
    let bpx = ob::backstop_px(leg);
    let steps = rust_decimal::prelude::ToPrimitive::to_i64(&(rest / leg.step).floor()).unwrap_or(0);
    let key = BookKey::new(tenant_id, kind, &leg.underlying);
    let cmd = Cmd::Backstop { series: leg.series.clone(), spec: leg.spec.clone(), login, stp: user_id, side: leg.side, qty: steps, px: bpx, counterparty: mm, counter_stp: mm_user, usd_per_quote: leg.usd_per_quote, at: hub.shared.clock.now().timestamp_millis() };
    let (bq, bstatus, bnote) = match entry::call(hub, login, &key, cmd).await {
        Ok((out, _, _)) if out.ok => (out.fills.iter().map(|f| f.spec.contracts(f.qty)).sum::<D>(), "done", None),
        Ok((out, _, _)) => (ZERO, "failed", out.message),
        Err(e) => (ZERO, "failed", Some(format!("{e:?}"))),
    };
    let after2 = level_of(st, login).await;
    rows.push(log(st, tenant_id, kind, login, run, step, "backstop", with(&unit, json!({"series": leg.series, "ticket": leg.ticket})), json!({"qty": bq.to_string(), "price": num(D::from(bpx) * leg.tick), "mark": num(leg.mark), "status": bstatus, "note": bnote, "side": leg.side.as_str(), "counterparty": mm, "freedMarginUsd": num(crate::money::r2(freed * bq / leg.contracts))}), after, after2).await);
    (filled + bq, rows)
}

/// `unit` with the fields of `extra` added.
fn with(unit: &Value, extra: Value) -> Value {
    let mut m = unit.as_object().cloned().unwrap_or_default();
    if let Value::Object(e) = extra {
        m.extend(e);
    }
    Value::Object(m)
}

fn stop_out_of(st: &AppState, login: i64) -> D {
    st.hub.meta(login).and_then(|m| st.hub.shared.registry.get(m.tenant_id).and_then(|t| t.groups.get(&m.group).map(|g| g.stop_out_pct))).unwrap_or(D::from(50))
}

/// A strategy closed in one piece: a reduce-only combo RFQ to the market maker, accepted at its quote.
#[allow(clippy::too_many_arguments)]
async fn by_rfq(st: &AppState, login: i64, tenant_id: i64, kind: AccountKind, plan: &LiqPlan, run: &str, step: usize, before: Option<D>, unit: Value) -> Option<(D, Value)> {
    let hub = &st.hub;
    fn gcd(a: i64, b: i64) -> i64 {
        if b == 0 { a.abs() } else { gcd(b, a % b) }
    }
    let steps: Vec<i64> = plan.legs.iter().map(|l| rust_decimal::prelude::ToPrimitive::to_i64(&(l.contracts / l.step)).unwrap_or(0)).collect();
    let g = steps.iter().fold(0, |a, b| gcd(a, *b)).max(1);
    let legs: Vec<super::rfq::LegIn> = plan.legs.iter().zip(&steps).map(|(l, s)| (l.series.clone(), l.side, s / g)).collect();
    let qty = D::from(g) * plan.legs[0].step;
    let r = super::rfq::open(hub, &st.pool, tenant_id, kind, login, plan.user_id, legs, qty, true).await.ok()?;
    let q = r.quote.clone()?;
    let ask = q.ask?;
    let base = BookReq { reduce_only: true, liquidation: true, source: Source::System, ..BookReq::limit("", Side::Buy, ZERO, ZERO) };
    let res = super::rfq::accept(hub, r.id, login, "system:liquidator", q.id, Side::Buy, D::from(ask) * r.tick(), base).await;
    let after = level_of(st, login).await;
    let (closed, status, note) = match &res {
        Ok(a) if a.out.ok => (a.out.fills.iter().map(|f| f.spec.contracts(f.qty)).sum::<D>(), "done", None),
        Ok(a) => (ZERO, "failed", a.out.message.clone()),
        Err(e) => (ZERO, "failed", Some(format!("{e:?}"))),
    };
    if closed.is_zero() {
        return None;
    }
    let row = log(st, tenant_id, kind, login, run, step, "rfq", unit, json!({"qty": closed.to_string(), "price": num(D::from(ask) * r.tick()), "status": status, "note": note, "rfq": r.id, "freedMarginUsd": num(crate::money::r2(plan.freed))}), before, after).await;
    Some((closed, row))
}
