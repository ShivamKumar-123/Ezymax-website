//! The outbox (docs/OPTIONS-EXCHANGE.md §1): what the book did, applied to the accounts.
//!
//! * Each fill produces two items (maker and taker), each run as `hub.exec(login, apply_fill)`; an order leaving
//!   the book produces `Done` (release what is still reserved); an amend produces `Amended` (new price / size,
//!   drop the amend's extra hold) or `Release` (the amend did not happen).
//! * Fills and non-ephemeral `Done`s are rows in `book_outbox`, written in the actor's group commit; `Amended`,
//!   `Release` and market-maker `Done`s are in memory only (a restart rebuilds reservations from `book_orders`).
//! * One dispatcher per actor applies the items **in seq order per login** (different logins in parallel),
//!   retrying with backoff from 100 ms to 30 s. While a login has a fill unapplied for more than 2 s its new
//!   orders get `settling`. After 10 failures the item is marked `failed`, the underlying goes cancel-only and
//!   ops are alerted; the item keeps being retried and is never dropped.
//! * Applying is idempotent: a fill already booked is recognised (`st.book.applied`, rebuilt from the deals'
//!   `option.fill`, and the unique ledger keys `fill:{id}:{login}:…`), so a crash between the account commit and
//!   marking the row applied re-applies nothing.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, watch};
use tokio::task::JoinSet;
use tokio::time::Instant;

use super::types::*;
use crate::shard::{ExecError, Hub, Op};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Item {
    Fill { fill: Fill, role: Role },
    Done { done: Done },
    Amended { amended: Amended },
    /// An amend did not take effect: drop its extra hold.
    Release { id: i64, token: u64 },
    /// Every leg of a combo RFQ fill on one account, applied in ONE account transaction (atomic per account).
    /// `quote`: the responder's RFQ hold to release once its legs are booked.
    Fills {
        fills: Vec<Fill>,
        role: Role,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        quote: Option<i64>,
    },
    /// A busted fill, reversed on this account (keys `bust:{fillId}:{login}:…`).
    Bust { fill: Fill, role: Role },
}

impl Item {
    /// Moves a book position (the `settling` gate and the reconcile count these).
    pub fn is_fill(&self) -> bool {
        matches!(self, Item::Fill { .. } | Item::Fills { .. } | Item::Bust { .. })
    }
    /// (fill, role, signed position change in steps for this account) of every position change this item makes.
    pub fn deltas(&self) -> Vec<(&Fill, Role, Steps)> {
        let d = |f: &Fill, r: Role| if f.party(r).side == crate::model::Side::Buy { f.qty } else { -f.qty };
        match self {
            Item::Fill { fill, role } => vec![(fill, *role, d(fill, *role))],
            Item::Fills { fills, role, .. } => fills.iter().map(|f| (f, *role, d(f, *role))).collect(),
            Item::Bust { fill, role } => vec![(fill, *role, -d(fill, *role))],
            _ => vec![],
        }
    }
    /// The `st.book.applied` key that marks this item booked on its account.
    pub fn applied_key(&self) -> Option<String> {
        match self {
            Item::Fill { fill, role } => Some(super::reserve::fill_key(&fill.id, role.as_str())),
            Item::Fills { fills, role, .. } => fills.first().map(|f| super::reserve::fill_key(&f.id, role.as_str())),
            Item::Bust { fill, role } => Some(super::reserve::bust_key(&fill.id, role.as_str())),
            _ => None,
        }
    }
    pub fn kind(&self) -> &'static str {
        match self {
            Item::Fill { .. } => "fill",
            Item::Done { .. } => "done",
            Item::Amended { .. } => "amended",
            Item::Release { .. } => "release",
            Item::Fills { .. } => "fills",
            Item::Bust { .. } => "bust",
        }
    }
}

/// One outbox entry.
#[derive(Clone, Debug, PartialEq)]
pub struct Row {
    /// Outbox sequence (per actor).
    pub seq: u64,
    /// Command sequence that produced it.
    pub book_seq: u64,
    pub login: i64,
    pub item: Item,
    /// Stored in `book_outbox` (fills and non-ephemeral removals).
    pub persist: bool,
}

/// Items of one command for the accounts, in causal order per login: amends, fills, removals.
pub fn items_of(cmd: &Cmd, out: &Out) -> Vec<(i64, Item, bool)> {
    let mut v = Vec::new();
    if matches!(cmd, Cmd::RestartCancel { .. }) {
        return v; // reservations of ephemeral orders did not survive the restart either
    }
    if let Cmd::Amend { id, login, token, .. } = cmd
        && !out.ok
    {
        v.push((*login, Item::Release { id: *id, token: *token }, false));
    }
    for a in &out.amended {
        v.push((a.login, Item::Amended { amended: a.clone() }, false));
    }
    if let Cmd::RfqAccept { quote, .. } = cmd
        && !out.fills.is_empty()
    {
        // a combo: every leg of an account in one item (atomic per account)
        let f0 = &out.fills[0];
        v.push((f0.maker.login, Item::Fills { fills: out.fills.clone(), role: Role::Maker, quote: Some(*quote) }, true));
        v.push((f0.taker.login, Item::Fills { fills: out.fills.clone(), role: Role::Taker, quote: None }, true));
    } else {
        for f in &out.fills {
            v.push((f.maker.login, Item::Fill { fill: f.clone(), role: Role::Maker }, true));
            v.push((f.taker.login, Item::Fill { fill: f.clone(), role: Role::Taker }, true));
        }
    }
    for f in &out.busted {
        v.push((f.maker.login, Item::Bust { fill: f.clone(), role: Role::Maker }, true));
        v.push((f.taker.login, Item::Bust { fill: f.clone(), role: Role::Taker }, true));
    }
    for d in &out.done {
        v.push((d.login, Item::Done { done: d.clone() }, !d.order.ephemeral()));
    }
    v
}

/// The account-side operation of an item.
pub fn op_for(item: Item) -> Op {
    match item {
        Item::Fill { fill, role } => Box::new(move |tx, env| crate::engine::options_book::apply_fill(tx, env, &fill, role)),
        Item::Done { done } => Box::new(move |tx, env| crate::engine::options_book::apply_done(tx, env, &done)),
        Item::Amended { amended } => Box::new(move |tx, env| crate::engine::options_book::apply_amended(tx, env, &amended)),
        Item::Release { id, token } => Box::new(move |tx, _| crate::engine::options_book::release_hold(tx, id, token)),
        Item::Fills { fills, role, quote } => Box::new(move |tx, env| crate::engine::options_book::apply_fills(tx, env, &fills, role, quote)),
        Item::Bust { fill, role } => Box::new(move |tx, env| crate::engine::options_book::apply_bust(tx, env, &fill, role)),
    }
}

/// An item was applied to its account (the HTTP handler waits for its own fills).
#[derive(Clone, Debug)]
pub struct Applied {
    pub key: BookKey,
    pub seq: u64,
    pub login: i64,
    pub value: Value,
}

/// Backoff before the `n`-th retry (n ≥ 1): 100 ms doubling, at most 30 s.
pub fn backoff(n: u32) -> Duration {
    let ms = 100u64.saturating_mul(1u64 << (n.saturating_sub(1)).min(20));
    Duration::from_millis(ms.min(30_000))
}

pub const FAIL_AFTER: u32 = 10;
/// In-memory items of one login applied in one account transaction at most.
pub const MEMORY_BATCH: usize = 500;

pub struct Dispatcher {
    pub key: BookKey,
    pub hub: Hub,
    pub rx: mpsc::UnboundedReceiver<Vec<Row>>,
    /// Sends the actor a halt when an item keeps failing.
    pub actor: mpsc::Sender<super::actor::Msg>,
    /// Starts dispatching when true (crash recovery reconciles first).
    pub go: watch::Receiver<bool>,
}

struct Waiting {
    queue: VecDeque<Row>,
    retry_at: Option<Instant>,
}

impl Dispatcher {
    pub async fn run(mut self) {
        let books = self.hub.shared.books.clone();
        let label = self.key.label();
        let mut queues: BTreeMap<i64, Waiting> = BTreeMap::new();
        let mut busy: HashSet<i64> = HashSet::new();
        let mut attempts: HashMap<u64, u32> = HashMap::new();
        let mut set: JoinSet<(i64, Vec<Row>, Result<Vec<Value>, String>)> = JoinSet::new();
        let mut inflight: HashMap<tokio::task::Id, i64> = HashMap::new();
        let mut halted = false;
        let mut closed = false;
        // recovery: wait for the go signal
        while !*self.go.borrow() {
            if self.go.changed().await.is_err() {
                return;
            }
        }
        let mut tick = tokio::time::interval(Duration::from_millis(50));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            if closed && set.is_empty() && queues.is_empty() {
                return;
            }
            // start every login that is idle and due
            let now = Instant::now();
            for (login, w) in queues.iter_mut() {
                if busy.contains(login) || w.retry_at.is_some_and(|t| t > now) {
                    continue;
                }
                let Some(head) = w.queue.front().cloned() else { continue };
                // in-memory items (removals of market-maker quotes, amends) at the head go together in ONE
                // account transaction, in order; a stored item (a fill, a durable removal) goes alone
                let batch: Vec<Row> = if head.persist { vec![head] } else { w.queue.iter().take_while(|r| !r.persist).take(MEMORY_BATCH).cloned().collect() };
                w.retry_at = None;
                busy.insert(*login);
                let hub = self.hub.clone();
                let login = *login;
                let h = set.spawn(async move {
                    let items: Vec<Item> = batch.iter().map(|r| r.item.clone()).collect();
                    let op: Op = if items.len() == 1 {
                        let op1 = op_for(items.into_iter().next().unwrap());
                        Box::new(move |tx, env| op1(tx, env).map(|v| json!([v])))
                    } else {
                        Box::new(move |tx, env| {
                            let mut vals = Vec::with_capacity(items.len());
                            for it in items {
                                vals.push(op_for(it)(tx, env)?);
                            }
                            Ok(Value::Array(vals))
                        })
                    };
                    let res = hub.exec(login, "system", None, "", "", None, op).await;
                    let r = match res {
                        Ok(d) => Ok(d.value.as_array().cloned().unwrap_or_default()),
                        // the ledger key exists: this fill was booked before (crash between commit and mark)
                        Err(ExecError::Duplicate(k)) if k.starts_with("fill:") || k.starts_with("bust:") => Ok(vec![json!({"duplicate": true, "key": k})]),
                        Err(e) => Err(format!("{e:?}")),
                    };
                    (login, batch, r)
                });
                inflight.insert(h.id(), login);
            }
            tokio::select! {
                rows = self.rx.recv(), if !closed => match rows {
                    Some(rows) => {
                        let now_ms = Utc::now().timestamp_millis();
                        for r in rows {
                            if r.item.is_fill() {
                                books.settling_add(r.login, &label, r.seq, now_ms);
                            }
                            queues.entry(r.login).or_insert_with(|| Waiting { queue: VecDeque::new(), retry_at: None }).queue.push_back(r);
                        }
                    }
                    None => closed = true,
                },
                Some(j) = set.join_next_with_id(), if !set.is_empty() => {
                    let (login, rows, res) = match j {
                        Ok((id, x)) => {
                            inflight.remove(&id);
                            x
                        }
                        Err(e) => {
                            // the apply task itself failed: free the login and retry its head item later
                            if let Some(login) = inflight.remove(&e.id()) {
                                busy.remove(&login);
                                if let Some(w) = queues.get_mut(&login) {
                                    w.retry_at = Some(Instant::now() + backoff(3));
                                }
                                tracing::error!(book = %label, login, error = %e, "outbox apply task failed; retrying");
                            }
                            continue;
                        }
                    };
                    busy.remove(&login);
                    let row = rows[0].clone();
                    match res {
                        Ok(values) => {
                            let n = attempts.remove(&row.seq).unwrap_or(0) + 1;
                            if books.hooks.crash_now_after_apply() {
                                tracing::warn!(book = %label, seq = row.seq, "test hook: dispatcher stops after applying (simulated crash)");
                                return;
                            }
                            if row.persist
                                && let Err(e) = super::journal::mark_applied(&self.hub.shared.pool, &self.key, row.seq, n).await
                            {
                                // applied but not marked: a restart re-dispatches it and the account recognises it
                                tracing::warn!(book = %label, seq = row.seq, error = %e, "outbox row applied but not marked");
                            }
                            for (i, r) in rows.iter().enumerate() {
                                if r.item.is_fill() {
                                    books.settling_remove(r.login, &label, r.seq);
                                }
                                let value = values.get(i).cloned().unwrap_or(Value::Null);
                                let _ = books.applied.send(Applied { key: self.key.clone(), seq: r.seq, login: r.login, value });
                            }
                            if let Some(w) = queues.get_mut(&login) {
                                for _ in 0..rows.len() {
                                    w.queue.pop_front();
                                }
                                if w.queue.is_empty() {
                                    queues.remove(&login);
                                }
                            }
                        }
                        Err(e) => {
                            let n = attempts.entry(row.seq).or_insert(0);
                            *n += 1;
                            let n = *n;
                            tracing::warn!(book = %label, seq = row.seq, login, attempt = n, error = %e, "outbox item not applied; retrying");
                            if row.persist {
                                let _ = super::journal::mark_failure(&self.hub.shared.pool, &self.key, row.seq, n, &e, n >= FAIL_AFTER).await;
                            }
                            if n >= FAIL_AFTER && !halted {
                                halted = true;
                                tracing::error!(book = %label, seq = row.seq, login, error = %e, "ALERT: options book outbox item failed 10 times; the underlying goes cancel-only");
                                let cmd = Cmd::Halt { scope: HaltScope::All, mode: HaltMode::CancelOnly, reason: "outbox_failed".into(), at: Utc::now().timestamp_millis() };
                                let _ = self.actor.try_send(super::actor::Msg::Cmd { cmd, reply: None });
                                super::record_halt(&self.hub.shared.pool, &self.key, "cancel_only", &format!("outbox item {} failed {n} times: {e}", row.seq)).await;
                            }
                            if let Some(w) = queues.get_mut(&login) {
                                w.retry_at = Some(Instant::now() + backoff(n));
                            }
                        }
                    }
                },
                _ = tick.tick() => {}
            }
        }
    }
}

/// Logins with fills not yet applied, for the `settling` gate: login → (book, seq) → enqueued (ms).
#[derive(Default)]
pub struct Settling(pub std::sync::Mutex<HashMap<i64, BTreeMap<(String, u64), i64>>>);

impl Settling {
    pub fn add(&self, login: i64, book: &str, seq: u64, at_ms: i64) {
        self.0.lock().unwrap().entry(login).or_default().insert((book.to_string(), seq), at_ms);
    }
    pub fn remove(&self, login: i64, book: &str, seq: u64) {
        let mut m = self.0.lock().unwrap();
        if let Some(x) = m.get_mut(&login) {
            x.remove(&(book.to_string(), seq));
            if x.is_empty() {
                m.remove(&login);
            }
        }
    }
    /// The oldest unapplied fill of `login` (ms).
    pub fn oldest(&self, login: i64) -> Option<i64> {
        self.0.lock().unwrap().get(&login).and_then(|x| x.values().min().copied())
    }
}

pub type SharedApplied = Arc<tokio::sync::broadcast::Sender<Applied>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_doubles_to_thirty_seconds() {
        assert_eq!(backoff(1), Duration::from_millis(100));
        assert_eq!(backoff(2), Duration::from_millis(200));
        assert_eq!(backoff(5), Duration::from_millis(1600));
        assert_eq!(backoff(9), Duration::from_millis(25_600));
        assert_eq!(backoff(10), Duration::from_secs(30));
        assert_eq!(backoff(60), Duration::from_secs(30));
    }
}
