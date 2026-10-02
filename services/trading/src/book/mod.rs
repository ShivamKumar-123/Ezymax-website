//! Kalks FX Options **order book exchange** (docs/OPTIONS-EXCHANGE.md, decision O49): clients trade options with
//! each other (and with the Kalks market maker under the same rules) in a price-time priority book per series.
//!
//! * `types`: ticks / steps, orders, series books, commands, outputs.
//! * `matching`: the pure matching function (`apply`), deterministic, no IO, no clock.
//! * `actor`: one task per (tenant, kind, underlying): batches, ONE Postgres commit, then state swap, replies,
//!   market data and the outbox.
//! * `journal`: persistence, loading at start, the replay audit.
//! * `outbox`: applies fills / removals to the accounts in seq order per login, idempotently, with retries.
//! * `reserve`: order margin and the account side of working orders (`AccountState.book`).
//! * `md`: top of book for the mark clamp, depth views, the internal feed.
//! * `entry`: `submit(hub, login, req)`, the one way into the book (clients and the market maker alike).
//!
//! **Dormant by default:** a (tenant, kind) trades on the book only once its `option_book_venues` row exists;
//! without it every option keeps trading at the house price exactly as before.

pub mod actor;
pub mod enable;
pub mod entry;
pub mod journal;
pub mod liquidator;
pub mod matching;
pub mod md;
pub mod mm;
pub mod outbox;
pub mod reserve;
pub mod rfq;
pub mod types;

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::Duration;
use tokio::sync::{broadcast, watch};

pub use reserve::BookState;
pub use types::{BookKey, Cmd, Fill, Out, SeriesSpec, Steps, Ticks};

use crate::model::AccountKind;
use crate::money::D;
use crate::shard::{Hub, Op};

/// A book command an account transaction sends once it is committed (a stop that fired, a premium SL / TP, a
/// close). If the actor cannot take it, the reservation made for it is released.
#[derive(Clone, Debug)]
pub struct Outgoing {
    pub key: BookKey,
    pub cmd: Cmd,
    pub login: i64,
}

/// Crash kill points for tests (inert unless a test arms them).
#[derive(Default)]
pub struct Hooks {
    /// The next durable batch commits, then the actor stops before swapping its state, replying or dispatching.
    pub crash_after_journal: AtomicBool,
    /// > 0: the dispatcher stops right after applying that many more items, before marking the last one.
    pub crash_after_apply: AtomicI64,
}

impl Hooks {
    pub fn crash_now_after_apply(&self) -> bool {
        let n = self.crash_after_apply.load(Ordering::SeqCst);
        if n <= 0 {
            return false;
        }
        self.crash_after_apply.fetch_sub(1, Ordering::SeqCst) == 1
    }
}

/// A deadman switch: cancel every book order of `login` when no heartbeat came within `timeout_ms`.
#[derive(Clone, Copy, Debug)]
pub struct Deadman {
    pub tenant_id: i64,
    pub kind: AccountKind,
    pub timeout_ms: i64,
    pub last_ms: i64,
}

/// Group code of liquidity-provider (market-maker programme) accounts.
pub const LP_GROUP: &str = "options-mm";

pub struct Books {
    actors: RwLock<HashMap<BookKey, actor::Handle>>,
    gates: Mutex<HashMap<BookKey, watch::Sender<bool>>>,
    venues: RwLock<HashSet<(i64, AccountKind)>>,
    pub settling: outbox::Settling,
    pub applied: broadcast::Sender<outbox::Applied>,
    pub deadman: Mutex<HashMap<i64, Deadman>>,
    pub hooks: Hooks,
    /// User ids of liquidity-provider accounts (besides the `options-mm` group): the Kalks MM user.
    pub lp_users: RwLock<HashSet<i64>>,
    /// While crash recovery runs, new dispatchers wait for its go.
    recovering: AtomicBool,
    spawn: tokio::sync::Mutex<()>,
    /// Pending fill items found at load (crash recovery reconciles with them).
    pending: Mutex<HashMap<BookKey, Vec<outbox::Row>>>,
    /// The hub (set by `Hub::start`): shards hand committed book commands to the actors through it.
    pub hub: std::sync::OnceLock<Hub>,
    /// Accounts the stop-out handed to the liquidator (docs §8); None until the liquidator runs.
    pub liquidator: Mutex<Option<tokio::sync::mpsc::UnboundedSender<i64>>>,
    /// The Kalks market maker (docs §4): accounts, pauses, live status.
    pub mm: mm::Mm,
    /// Open combo RFQs (docs §5).
    pub rfqs: rfq::Registry,
    /// The last replay audit: (when, books that differed).
    pub last_audit: Mutex<Option<(DateTime<Utc>, usize)>>,
}

impl Default for Books {
    fn default() -> Self {
        Books {
            actors: Default::default(),
            gates: Default::default(),
            venues: Default::default(),
            settling: Default::default(),
            applied: broadcast::channel(16_384).0,
            deadman: Default::default(),
            hooks: Default::default(),
            lp_users: Default::default(),
            recovering: AtomicBool::new(false),
            spawn: tokio::sync::Mutex::new(()),
            pending: Default::default(),
            hub: std::sync::OnceLock::new(),
            liquidator: Mutex::new(None),
            mm: Default::default(),
            rfqs: Default::default(),
            last_audit: Mutex::new(None),
        }
    }
}

/// While a login has a fill unapplied for longer than this, its new orders get `settling`.
pub const SETTLING_MS: i64 = 2_000;

impl Books {
    /// Hands an account past its stop-out level to the liquidator (never blocks; repeated hands are merged).
    pub fn liquidate(&self, login: i64) {
        if let Some(tx) = self.liquidator.lock().unwrap().as_ref() {
            let _ = tx.send(login);
        }
    }

    pub fn venue_enabled(&self, tenant_id: i64, kind: AccountKind) -> bool {
        self.venues.read().unwrap().contains(&(tenant_id, kind))
    }

    pub fn set_venue(&self, tenant_id: i64, kind: AccountKind, on: bool) {
        let mut v = self.venues.write().unwrap();
        if on {
            v.insert((tenant_id, kind));
        } else {
            v.remove(&(tenant_id, kind));
        }
    }

    /// Reads `option_book_venues`.
    pub async fn load_venues(&self, pool: &sqlx::PgPool) -> anyhow::Result<usize> {
        let rows = sqlx::query("SELECT tenant_id, kind FROM option_book_venues").fetch_all(pool).await?;
        let mut v = self.venues.write().unwrap();
        v.clear();
        for r in rows {
            if let Some(k) = AccountKind::parse(&r.get::<String, _>("kind")) {
                v.insert((r.get("tenant_id"), k));
            }
        }
        Ok(v.len())
    }

    /// Writes the venue row and switches the book on for (tenant, kind) (used by the enable flow and tests).
    pub async fn enable_venue(&self, pool: &sqlx::PgPool, tenant_id: i64, kind: AccountKind, by: &str, reason: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO option_book_venues (tenant_id, kind, enabled_by, reason) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, kind) DO NOTHING")
            .bind(tenant_id)
            .bind(kind.as_str())
            .bind(by)
            .bind(reason)
            .execute(pool)
            .await?;
        self.set_venue(tenant_id, kind, true);
        Ok(())
    }

    pub fn handle(&self, key: &BookKey) -> Option<actor::Handle> {
        self.actors.read().unwrap().get(key).cloned()
    }

    pub fn handles(&self) -> Vec<actor::Handle> {
        let mut v: Vec<actor::Handle> = self.actors.read().unwrap().values().cloned().collect();
        v.sort_by(|a, b| a.key.cmp(&b.key));
        v
    }

    /// The actor of `key`, started (and loaded from the database) on first use.
    pub async fn actor(&self, hub: &Hub, key: &BookKey) -> anyhow::Result<actor::Handle> {
        if let Some(h) = self.handle(key) {
            return Ok(h);
        }
        let _g = self.spawn.lock().await;
        if let Some(h) = self.handle(key) {
            return Ok(h);
        }
        let slug = hub.shared.registry.get(key.tenant_id).map(|t| t.slug.clone()).ok_or_else(|| anyhow::anyhow!("unknown tenant {}", key.tenant_id))?;
        let loaded = journal::load(&hub.shared.pool, key).await?;
        let go = !self.recovering.load(Ordering::SeqCst);
        if !go {
            let pending_fills: Vec<outbox::Row> = loaded.pending.iter().filter(|r| r.item.is_fill()).cloned().collect();
            self.pending.lock().unwrap().insert(key.clone(), pending_fills);
        }
        let (h, gate) = actor::spawn(hub, slug, loaded, go);
        self.actors.write().unwrap().insert(key.clone(), h.clone());
        self.gates.lock().unwrap().insert(key.clone(), gate);
        Ok(h)
    }

    pub fn settling_add(&self, login: i64, book: &str, seq: u64, at_ms: i64) {
        self.settling.add(login, book, seq, at_ms);
    }
    pub fn settling_remove(&self, login: i64, book: &str, seq: u64) {
        self.settling.remove(login, book, seq);
    }
    /// Has `login` had a fill waiting for more than 2 s?
    pub fn is_settling(&self, login: i64, now_ms: i64) -> bool {
        self.settling.oldest(login).is_some_and(|t| now_ms - t > SETTLING_MS)
    }

    /// A liquidity-provider (market-maker programme) account: exempt from the no-open rule until cut − 1 min and
    /// allowed to mass-quote.
    pub fn is_lp(&self, user_id: i64, group: &str) -> bool {
        group == LP_GROUP || self.lp_users.read().unwrap().contains(&user_id)
    }

    pub fn heartbeat(&self, login: i64, tenant_id: i64, kind: AccountKind, timeout_ms: i64, now_ms: i64) {
        let mut m = self.deadman.lock().unwrap();
        if timeout_ms <= 0 {
            m.remove(&login);
        } else {
            m.insert(login, Deadman { tenant_id, kind, timeout_ms, last_ms: now_ms });
        }
    }

    /// Logins whose deadman fired (removed from the registry).
    pub fn deadman_due(&self, now_ms: i64) -> Vec<(i64, Deadman)> {
        let mut m = self.deadman.lock().unwrap();
        let due: Vec<(i64, Deadman)> = m.iter().filter(|(_, d)| now_ms - d.last_ms > d.timeout_ms).map(|(l, d)| (*l, *d)).collect();
        for (l, _) in &due {
            m.remove(l);
        }
        due
    }
}

/// Sends commands a committed account transaction produced (fired stops, SL / TP, closes). Never blocks the shard.
pub fn send_outgoing(hub: &Hub, out: Vec<Outgoing>) {
    if out.is_empty() {
        return;
    }
    let hub = hub.clone();
    tokio::spawn(async move {
        for o in out {
            let res = match hub.shared.books.actor(&hub, &o.key).await {
                Ok(h) => h.call(o.cmd.clone()).await,
                Err(e) => {
                    tracing::error!(book = %o.key.label(), error = %e, "options book actor unavailable");
                    Err(actor::CallError::NotSent)
                }
            };
            if let Err(actor::CallError::NotSent) = res {
                release_unsent(&hub, o.login, &o.cmd).await;
            }
        }
    });
}

/// A command never reached its actor: the account releases what it reserved for it.
pub async fn release_unsent(hub: &Hub, login: i64, cmd: &Cmd) {
    let item = match cmd {
        Cmd::New { series, order, .. } => outbox::Item::Done { done: types::Done { id: order.id, login, series: series.clone(), status: types::DoneStatus::Rejected, reason: "book_unavailable".into(), order: order.clone() } },
        Cmd::Amend { id, token, .. } => outbox::Item::Release { id: *id, token: *token },
        _ => return,
    };
    if let Err(e) = hub.exec(login, "system", None, "", "", None, outbox::op_for(item)).await {
        tracing::error!(login, error = ?e, "releasing an unsent book order failed");
    }
}

/// Records a system halt (outbox failure, reconcile mismatch) for the Back Office.
pub async fn record_halt(pool: &sqlx::PgPool, key: &BookKey, mode: &str, reason: &str) {
    let _ = sqlx::query("INSERT INTO book_halts (tenant_id, kind, underlying, scope, target, mode, reason) VALUES ($1,$2,$3,'underlying',$3,$4,$5)")
        .bind(key.tenant_id)
        .bind(key.kind.as_str())
        .bind(&key.underlying)
        .bind(mode)
        .bind(reason)
        .execute(pool)
        .await;
}

/* ------------------------------------------------------------------ */
/* Crash recovery                                                      */
/* ------------------------------------------------------------------ */

/// What recovery found.
#[derive(Clone, Debug, Default)]
pub struct Recovery {
    pub books: usize,
    pub orders: usize,
    pub pending: usize,
    /// Books put in cancel-only because actor and account positions disagree.
    pub mismatches: Vec<String>,
    pub stops_resubmitted: usize,
}

/// Start-up (main.rs, after the account replay): load every stored book (ephemeral orders are gone; a
/// `RestartCancel` is journaled), rebuild the shards' reservations, reconcile actor positions with the accounts
/// (counting the outbox items not applied yet; a mismatch puts that underlying in cancel-only and alerts), then
/// re-dispatch the pending outbox and resubmit stops that fired but never reached their book.
pub async fn recover(hub: &Hub) -> anyhow::Result<Recovery> {
    let books = &hub.shared.books;
    let pool = &hub.shared.pool;
    let mut rep = Recovery::default();
    books.load_venues(pool).await?;
    books.recovering.store(true, Ordering::SeqCst);
    let keys = journal::stored_keys(pool).await?;
    for key in &keys {
        // one unreadable book must not keep the others down (its accounts' positions are intact; it loads on use)
        if let Err(e) = books.actor(hub, key).await {
            tracing::error!(book = %key.label(), error = %e, "ALERT: options book could not be loaded");
            rep.mismatches.push(format!("{}: not loaded: {e}", key.label()));
        }
    }
    rep.books = keys.len();
    // 2. reservations of resting orders (and the clientOrderId guard of recent ones)
    let mut per_login: BTreeMap<i64, Vec<Value>> = BTreeMap::new();
    for h in books.handles() {
        let v = h
            .read(Box::new(|b| {
                let mut out = Vec::new();
                for sb in b.series.values() {
                    for o in sb.orders.values().filter(|o| !o.ephemeral()) {
                        out.push(json!({"order": o, "series": sb.series, "underlying": sb.spec.terms.underlying, "step": sb.spec.step, "tick": sb.spec.tick}));
                    }
                }
                json!(out)
            }))
            .await
            .unwrap_or(Value::Null);
        for x in v.as_array().cloned().unwrap_or_default() {
            if let Some(l) = x["order"]["login"].as_i64() {
                per_login.entry(l).or_default().push(x);
            }
        }
    }
    let cids: Vec<(i64, String, i64)> = sqlx::query_as("SELECT login, client_order_id, id FROM book_orders WHERE client_order_id IS NOT NULL AND created_at > now() - interval '7 days'").fetch_all(pool).await?;
    let mut cid_map: BTreeMap<i64, Vec<(String, i64)>> = BTreeMap::new();
    for (l, c, id) in cids {
        cid_map.entry(l).or_default().push((c, id));
    }
    let logins: std::collections::BTreeSet<i64> = per_login.keys().chain(cid_map.keys()).copied().collect();
    for login in logins {
        let orders = per_login.remove(&login).unwrap_or_default();
        rep.orders += orders.len();
        let ids = cid_map.remove(&login).unwrap_or_default();
        let op: Op = Box::new(move |tx, _| crate::engine::options_book::restore(tx, &orders, &ids));
        if let Err(e) = hub.exec(login, "system", None, "", "", None, op).await {
            tracing::error!(login, error = ?e, "options book: reservations not rebuilt for an account");
        }
    }
    // 3. reconcile
    for h in books.handles() {
        let pending = books.pending.lock().unwrap().remove(&h.key).unwrap_or_default();
        rep.pending += pending.len();
        if let Some(why) = reconcile(hub, &h, &pending).await {
            tracing::error!(book = %h.key.label(), mismatch = %why, "ALERT: options book positions disagree with the accounts; the underlying goes cancel-only");
            h.post(Cmd::Halt { scope: types::HaltScope::All, mode: types::HaltMode::CancelOnly, reason: "reconcile_mismatch".into(), at: hub.shared.clock.now().timestamp_millis() });
            record_halt(pool, &h.key, "cancel_only", &format!("reconcile: {why}")).await;
            rep.mismatches.push(format!("{}: {why}", h.key.label()));
        }
    }
    // 4. dispatch
    books.recovering.store(false, Ordering::SeqCst);
    for g in books.gates.lock().unwrap().values() {
        let _ = g.send(true);
    }
    // 5. stops that fired but never reached their book
    let rows = sqlx::query(
        "SELECT o.login, o.data FROM orders o WHERE o.status = 'filled' AND o.reason = 'book_stop_fired' AND o.done_at > now() - interval '2 days'
           AND NOT EXISTS (SELECT 1 FROM book_journal j WHERE j.order_id = o.ticket AND j.cmd_kind = 'new')",
    )
    .fetch_all(pool)
    .await?;
    for r in rows {
        let login: i64 = r.get("login");
        let o: sqlx::types::Json<crate::model::Order> = r.get("data");
        let order = o.0;
        let op: Op = Box::new(move |tx, env| crate::engine::options_book::refire_stop(tx, env, &order));
        match hub.exec(login, "system", None, "", "", None, op).await {
            Ok(_) => rep.stops_resubmitted += 1,
            Err(e) => tracing::error!(login, error = ?e, "a fired book stop could not be resubmitted"),
        }
    }
    tracing::info!(books = rep.books, orders = rep.orders, pending = rep.pending, mismatches = rep.mismatches.len(), stops = rep.stops_resubmitted, "options order book recovered");
    Ok(rep)
}

/// Actor positions == account book positions + pending fills, per (series, login). None = consistent.
pub async fn reconcile(hub: &Hub, h: &actor::Handle, pending: &[outbox::Row]) -> Option<String> {
    let key = h.key.clone();
    let actor_pos = h
        .read(Box::new(|b| {
            let mut m = serde_json::Map::new();
            for (s, sb) in &b.series {
                if sb.state == types::SeriesState::Closed {
                    // expired: settlement removes the positions on both sides
                    m.insert(format!("{s}|closed"), json!(true));
                    continue;
                }
                for (l, q) in &sb.pos {
                    m.insert(format!("{s}|{l}"), json!(q));
                }
                m.insert(format!("{s}|step"), json!(sb.spec.step.to_string()));
            }
            Value::Object(m)
        }))
        .await?;
    let actor_pos = actor_pos.as_object()?.clone();
    let steps_of: HashMap<String, D> = actor_pos.iter().filter(|(k, _)| k.ends_with("|step")).filter_map(|(k, v)| Some((k.trim_end_matches("|step").to_string(), v.as_str()?.parse().ok()?))).collect();
    let closed: HashSet<String> = actor_pos.keys().filter(|k| k.ends_with("|closed")).map(|k| k.trim_end_matches("|closed").to_string()).collect();
    let u = key.underlying.clone();
    let kind = key.kind;
    let rows = hub
        .scan(
            key.tenant_id,
            std::sync::Arc::new(move |a, _| {
                if a.account.kind != kind {
                    return vec![];
                }
                a.positions
                    .values()
                    .filter(|p| p.on_book() && p.option.as_ref().is_some_and(|t| t.underlying == u && t.barrier.is_none()))
                    .map(|p| json!({"series": p.symbol, "login": p.login, "contracts": (p.volume * p.side.sign()).to_string()}))
                    .collect()
            }),
        )
        .await;
    let mut acct: BTreeMap<(String, i64), D> = BTreeMap::new();
    for r in rows {
        let (Some(s), Some(l), Some(c)) = (r["series"].as_str(), r["login"].as_i64(), r["contracts"].as_str().and_then(|x| x.parse::<D>().ok())) else { continue };
        *acct.entry((s.to_string(), l)).or_default() += c;
    }
    let mut expected: BTreeMap<(String, i64), i64> = BTreeMap::new();
    for ((s, l), c) in acct {
        if closed.contains(&s) {
            continue;
        }
        let Some(step) = steps_of.get(&s).copied().filter(|x| !x.is_zero()) else {
            if !c.is_zero() {
                return Some(format!("{s}: account {l} holds {c} contracts but the book has no such series"));
            }
            continue;
        };
        let q = c / step;
        if !q.fract().is_zero() {
            return Some(format!("{s}: account {l} holds {c} contracts, not a whole number of steps"));
        }
        *expected.entry((s, l)).or_default() += rust_decimal::prelude::ToPrimitive::to_i64(&q).unwrap_or(i64::MAX);
    }
    // pending fills still to come — except those the account already booked (applied, then the process died
    // before the row was marked)
    let mut by_login: BTreeMap<i64, Vec<String>> = BTreeMap::new();
    for r in pending {
        if let Some(k) = r.item.applied_key() {
            by_login.entry(r.login).or_default().push(k);
        }
    }
    let mut booked: std::collections::BTreeSet<(i64, String)> = std::collections::BTreeSet::new();
    for (login, keys) in by_login {
        let v = hub.read(login, Box::new(move |x| json!(x.map(|(a, _)| keys.iter().filter(|k| a.book.applied.contains(*k)).cloned().collect::<Vec<_>>()).unwrap_or_default()))).await;
        for k in v.as_array().cloned().unwrap_or_default() {
            if let Some(k) = k.as_str() {
                booked.insert((login, k.to_string()));
            }
        }
    }
    for r in pending {
        if r.item.applied_key().is_some_and(|k| booked.contains(&(r.login, k))) {
            continue;
        }
        for (fill, _, d) in r.item.deltas() {
            if closed.contains(&fill.series) {
                continue;
            }
            *expected.entry((fill.series.clone(), r.login)).or_default() += d;
        }
    }
    let mut actor: BTreeMap<(String, i64), i64> = BTreeMap::new();
    for (k, v) in &actor_pos {
        if k.ends_with("|step") || k.ends_with("|closed") {
            continue;
        }
        let Some((s, l)) = k.rsplit_once('|') else { continue };
        if let (Ok(l), Some(q)) = (l.parse::<i64>(), v.as_i64()) {
            actor.insert((s.to_string(), l), q);
        }
    }
    expected.retain(|(s, _), q| *q != 0 && steps_of.contains_key(s));
    actor.retain(|_, q| *q != 0);
    if expected != actor {
        let diff: Vec<String> = expected
            .keys()
            .chain(actor.keys())
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .filter(|k| expected.get(*k) != actor.get(*k))
            .take(5)
            .map(|(s, l)| format!("{s} #{l}: accounts {} vs book {}", expected.get(&(s.clone(), *l)).unwrap_or(&0), actor.get(&(s.clone(), *l)).unwrap_or(&0)))
            .collect();
        return Some(diff.join("; "));
    }
    None
}

/* ------------------------------------------------------------------ */
/* Scheduler                                                           */
/* ------------------------------------------------------------------ */

/// Book housekeeping (single engine instance): GTD expiry (every second), deadman switches, the expiry cut-off
/// (`Expire` at cut − closeOnlyMinutes), the session-open band check (`OpenCheck`) and the throttled market-data
/// feed (every 250 ms).
pub fn spawn_scheduler(hub: Hub) {
    let h2 = hub.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_millis(250));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            let opts = h2.shared.options.clone();
            let now = h2.shared.clock.now();
            opts.top.flush(&|slug, kind, series| crate::engine::options_book::series_mark(&h2, slug, kind, series, now));
        }
    });
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(1));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut n: u64 = 0;
        let mut was_open: HashMap<BookKey, bool> = HashMap::new();
        let mut audited: Option<chrono::NaiveDate> = None;
        loop {
            tick.tick().await;
            n += 1;
            let now = hub.shared.clock.now();
            scheduler_pass(&hub, now, n % 5 == 0, &mut was_open).await;
            // the nightly replay audit, once per server day after 01:00 server time
            let day = crate::specs::server_date(now);
            if audited != Some(day) && now >= crate::specs::server_midnight(day) + chrono::Duration::hours(1) {
                audited = Some(day);
                let res = replay_audit(&hub).await;
                let bad = res.iter().filter(|r| r.1.is_err()).count();
                tracing::info!(books = res.len(), failed = bad, "options book replay audit {}", if bad == 0 { "OK" } else { "FAILED" });
            }
        }
    });
}

/// One scheduler pass (tests call it with a pinned clock).
pub async fn scheduler_pass(hub: &Hub, now: DateTime<Utc>, slow: bool, was_open: &mut HashMap<BookKey, bool>) {
    let books = &hub.shared.books;
    let now_ms = now.timestamp_millis();
    for (login, d) in books.deadman_due(now_ms) {
        for h in books.handles().into_iter().filter(|h| h.key.tenant_id == d.tenant_id && h.key.kind == d.kind) {
            h.post(Cmd::CancelAll { login, series: None, expiry: None, ephemeral_only: false, reason: "deadman".into(), at: now_ms });
        }
        tracing::warn!(login, "options book deadman fired: orders cancelled");
    }
    rfq::sweep(hub);
    let snap = crate::options::OptionPricing::snapshot(hub.shared.options.as_ref());
    for h in books.handles() {
        let due = h
            .read(Box::new(move |b| {
                let gtd = b.due_expiry(now_ms);
                let cuts: Vec<(String, i64)> = b.series.values().filter(|sb| sb.state != types::SeriesState::Closed).map(|sb| (sb.spec.terms.expiry.to_string(), sb.spec.terms.expiry_at.timestamp_millis())).collect();
                json!({"gtd": gtd, "cuts": cuts})
            }))
            .await
            .unwrap_or(Value::Null);
        if due["gtd"].as_bool() == Some(true) {
            h.post(Cmd::Timer { at: now_ms });
        }
        if slow {
            let close_only = snap.as_ref().and_then(|s| s.underlying(&h.key.underlying).map(|u| u.close_only_minutes.max(0) as i64)).unwrap_or(1);
            let mut sent = std::collections::BTreeSet::new();
            for c in due["cuts"].as_array().cloned().unwrap_or_default() {
                let (Some(d), Some(cut)) = (c[0].as_str(), c[1].as_i64()) else { continue };
                if now_ms >= cut - close_only * 60_000
                    && sent.insert(d.to_string())
                    && let Ok(date) = chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                {
                    h.post(Cmd::Expire { expiry: date, purge: false, at: now_ms });
                }
            }
            // session open (weekend gap): cancel resting orders outside the band against the new mark
            if let Some(spec) = hub.shared.specs.get(&h.key.underlying) {
                let open = spec.is_open(now);
                let prev = was_open.insert(h.key.clone(), open);
                if prev == Some(false) && open {
                    let bands = crate::engine::options_book::open_bands(hub, &h, now).await;
                    if !bands.is_empty() {
                        h.post(Cmd::OpenCheck { bands, at: now_ms });
                    }
                }
            }
        }
    }
}

/// The replay audit (docs §1 "Determinism"): every book's journal re-run through `matching::apply` from the
/// first command, outputs compared byte for byte, and the result compared with the live actor state.
/// Returns (book, Ok(last seq) | Err(first difference)).
pub async fn replay_audit(hub: &Hub) -> Vec<(String, Result<u64, String>)> {
    let pool = &hub.shared.pool;
    let mut out = Vec::new();
    let keys = journal::stored_keys(pool).await.unwrap_or_default();
    for key in keys {
        let res = match journal::entries(pool, &key, 1).await {
            Err(e) => Err(format!("journal unreadable: {e}")),
            Ok(entries) => match journal::replay(types::UnderlyingBooks::new(key.clone()), &entries) {
                Err(m) => Err(format!("seq {}: {}", m.seq, m.what)),
                Ok(b) => {
                    let replayed = journal::fingerprint(&b);
                    match hub.shared.books.handle(&key) {
                        Some(h) => match h.read(Box::new(journal::fingerprint_value)).await {
                            // the live book may have moved on while the journal was read: compare at equal seq only
                            Some(live) if live["seq"] == replayed["seq"] && live != replayed => Err("the live book differs from the replay".into()),
                            _ => Ok(b.seq),
                        },
                        None => Ok(b.seq),
                    }
                }
            },
        };
        if let Err(e) = &res {
            tracing::error!(book = %key.label(), error = %e, "ALERT: options book replay audit failed");
        }
        out.push((key.label(), res));
    }
    *hub.shared.books.last_audit.lock().unwrap() = Some((Utc::now(), out.iter().filter(|r| r.1.is_err()).count()));
    out
}

/// After an expiry settled (options::settle): the books drop its series and positions (`Expire{purge}`).
pub async fn purge_expiry(hub: &Hub, underlying: &str, date: chrono::NaiveDate) {
    let now_ms = hub.shared.clock.now().timestamp_millis();
    for h in hub.shared.books.handles().into_iter().filter(|h| h.key.underlying == underlying) {
        let has = h.read(Box::new(move |b| json!(b.series.values().any(|sb| sb.spec.terms.expiry == date)))).await;
        if has.and_then(|v| v.as_bool()) == Some(true) {
            let _ = h.call(Cmd::Expire { expiry: date, purge: true, at: now_ms }).await;
        }
    }
}

#[cfg(test)]
mod tests;
