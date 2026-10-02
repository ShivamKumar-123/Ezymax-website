//! One book actor per (tenant, kind, underlying) (docs/OPTIONS-EXCHANGE.md §1).
//!
//! * Drains up to 256 messages, applies every command to a copy-on-write working copy of the books.
//! * Group-commits ONE Postgres transaction (journal, quote journal, orders, positions, series, fills, outbox).
//!   When the commit result is unknown (connection lost) it looks at the journal before deciding.
//! * Only then swaps the state in, publishes market data, hands the outbox items to the dispatcher and replies.
//! * A failed commit rolls the batch back and sends in-memory `Done{rejected}` / `Release` items so the accounts
//!   release what they reserved for it. Batches of market-maker quotes only (ephemeral) are not committed: they
//!   are journaled asynchronously (≤ 1 s) or with the next durable batch, which keeps every journaled fill
//!   replayable.
//!
//! The actor never looks at who an account is: priority is (price, seq).

use serde_json::Value;
use std::collections::BTreeSet;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot, watch};

use super::journal::{self, Entry, Loaded};
use super::matching;
use super::outbox::{self, Item, Row};
use super::types::*;
use crate::shard::Hub;

pub type ReadFn = Box<dyn FnOnce(&UnderlyingBooks) -> Value + Send>;

pub enum Msg {
    Cmd { cmd: Cmd, reply: Option<oneshot::Sender<Result<Reply, String>>> },
    /// Runs `f` on the committed state (previews, reconcile, scheduler).
    Read { f: ReadFn, reply: oneshot::Sender<Value> },
}

/// What a command did and the outbox items it produced: (outbox seq, login, is a fill).
#[derive(Clone, Debug)]
pub struct Reply {
    pub out: Out,
    pub items: Vec<(u64, i64, bool)>,
}

#[derive(Debug)]
pub enum CallError {
    /// The actor is gone: the command was not delivered.
    NotSent,
    /// Delivered, but not committed (the actor released what it could) or the reply was lost.
    Failed(String),
}

#[derive(Clone)]
pub struct Handle {
    pub key: BookKey,
    pub tx: mpsc::Sender<Msg>,
}

impl Handle {
    pub async fn call(&self, cmd: Cmd) -> Result<Reply, CallError> {
        let (reply, rx) = oneshot::channel();
        self.tx.send(Msg::Cmd { cmd, reply: Some(reply) }).await.map_err(|_| CallError::NotSent)?;
        match rx.await {
            Ok(Ok(r)) => Ok(r),
            Ok(Err(e)) => Err(CallError::Failed(e)),
            Err(_) => Err(CallError::Failed("the book actor stopped".into())),
        }
    }
    /// Fire and forget (scheduler, system halts).
    pub fn post(&self, cmd: Cmd) -> bool {
        self.tx.try_send(Msg::Cmd { cmd, reply: None }).is_ok()
    }
    pub async fn read(&self, f: ReadFn) -> Option<Value> {
        let (reply, rx) = oneshot::channel();
        self.tx.send(Msg::Read { f, reply }).await.ok()?;
        rx.await.ok()
    }
}

pub struct Actor {
    key: BookKey,
    slug: String,
    hub: Hub,
    books: UnderlyingBooks,
    outbox_seq: u64,
    /// Ephemeral commands applied but not journaled yet.
    quotes: Vec<Entry>,
    dispatch: mpsc::UnboundedSender<Vec<Row>>,
}

/// Starts an actor and its outbox dispatcher on a loaded state. `go` = dispatch at once (false while crash
/// recovery reconciles). The first command journaled is a `RestartCancel` when the book existed before.
pub fn spawn(hub: &Hub, slug: String, loaded: Loaded, go: bool) -> (Handle, watch::Sender<bool>) {
    let key = loaded.books.key.clone();
    let (tx, rx) = mpsc::channel(4096);
    let (dtx, drx) = mpsc::unbounded_channel();
    let (go_tx, go_rx) = watch::channel(go);
    let handle = Handle { key: key.clone(), tx: tx.clone() };
    if !loaded.pending.is_empty() {
        let _ = dtx.send(loaded.pending.clone());
    }
    let restarted = loaded.books.seq > 0;
    let actor = Actor { key: key.clone(), slug, hub: hub.clone(), books: loaded.books, outbox_seq: loaded.outbox_seq, quotes: Vec::new(), dispatch: dtx };
    let d = outbox::Dispatcher { key, hub: hub.clone(), rx: drx, actor: tx.clone(), go: go_rx };
    tokio::spawn(d.run());
    tokio::spawn(actor.run(rx, restarted));
    (handle, go_tx)
}

impl Actor {
    async fn run(mut self, mut rx: mpsc::Receiver<Msg>, restarted: bool) {
        self.hub.shared.options.top.publish(&self.slug, &self.books, None);
        if restarted {
            let at = self.hub.shared.clock.now().timestamp_millis();
            self.process(vec![Msg::Cmd { cmd: Cmd::RestartCancel { at }, reply: None }]).await;
        }
        tracing::info!(book = %self.key.label(), seq = self.books.seq, series = self.books.series.len(), resting = self.books.resting(), "options book actor started");
        let mut flush = tokio::time::interval(Duration::from_secs(1));
        flush.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            let first = tokio::select! {
                m = rx.recv() => match m {
                    Some(m) => m,
                    None => break,
                },
                _ = flush.tick() => {
                    self.flush_quotes().await;
                    continue;
                }
            };
            let mut msgs = vec![first];
            while msgs.len() < 256 {
                match rx.try_recv() {
                    Ok(m) => msgs.push(m),
                    Err(_) => break,
                }
            }
            if !self.process(msgs).await {
                tracing::warn!(book = %self.key.label(), "options book actor stopped (simulated crash)");
                return;
            }
        }
        self.flush_quotes().await;
    }

    async fn flush_quotes(&mut self) {
        if self.quotes.is_empty() {
            return;
        }
        let q = std::mem::take(&mut self.quotes);
        if let Err(e) = journal::flush_quotes(&self.hub.shared.pool, &self.key, &q).await {
            tracing::warn!(book = %self.key.label(), error = %e, "quote journal flush failed; retrying");
            let mut q = q;
            q.append(&mut self.quotes);
            self.quotes = q;
        }
    }

    /// Commits; when the outcome is unknown, the journal decides.
    async fn commit_verified(&self, durable: &[Entry], quotes: &[Entry], work: &UnderlyingBooks, rows: &[Row]) -> bool {
        let pool = &self.hub.shared.pool;
        let t0 = std::time::Instant::now();
        let res = journal::commit(pool, &self.key, durable, quotes, &self.books, work, rows).await;
        let perf = &self.hub.shared.books.perf;
        super::Perf::push(&perf.commit_us, t0.elapsed().as_micros() as u64);
        super::Perf::push(&perf.commit_quotes, quotes.len() as u64);
        match res {
            Ok(()) => true,
            Err(e) => {
                tracing::error!(book = %self.key.label(), error = %e, "options book commit failed");
                self.hub.shared.stats.commit_errors.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let Some(want) = durable.last().map(|e| e.seq) else { return false };
                for i in 0.. {
                    match journal::last_durable_seq(pool, &self.key).await {
                        Ok(s) => return s >= want,
                        Err(e) => {
                            if i % 10 == 0 {
                                tracing::error!(book = %self.key.label(), error = %e, "options book: cannot verify the commit; waiting for the database");
                            }
                            tokio::time::sleep(Duration::from_secs(1)).await;
                        }
                    }
                }
                false
            }
        }
    }

    /// Applies a batch. Returns false when a test hook simulated a crash.
    async fn process(&mut self, msgs: Vec<Msg>) -> bool {
        let t0 = std::time::Instant::now();
        let r = self.process_batch(msgs).await;
        if let Some(n) = r.1 {
            let perf = &self.hub.shared.books.perf;
            super::Perf::push(&perf.actor_batch_us, t0.elapsed().as_micros() as u64);
            super::Perf::push(&perf.actor_batch_cmds, n as u64);
        }
        r.0
    }

    /// (keep running, commands processed).
    async fn process_batch(&mut self, msgs: Vec<Msg>) -> (bool, Option<usize>) {
        let mut work = self.books.clone();
        let mut results: Vec<(Entry, Option<oneshot::Sender<Result<Reply, String>>>)> = Vec::new();
        for m in msgs {
            match m {
                Msg::Read { f, reply } => {
                    let _ = reply.send(f(&self.books));
                }
                Msg::Cmd { cmd, reply } => {
                    let out = matching::apply(&mut work, &cmd);
                    results.push((Entry { seq: out.seq, cmd, out }, reply));
                }
            }
        }
        if results.is_empty() {
            return (true, None);
        }
        let n = results.len();
        let mut rows: Vec<Row> = Vec::new();
        let mut per: Vec<Vec<(u64, i64, bool)>> = Vec::new();
        let mut oseq = self.outbox_seq;
        for (e, _) in &results {
            let mut mine = Vec::new();
            for (login, item, persist) in outbox::items_of(&e.cmd, &e.out) {
                oseq += 1;
                mine.push((oseq, login, item.is_fill()));
                rows.push(Row { seq: oseq, book_seq: e.seq, login, item, persist });
            }
            per.push(mine);
        }
        let durable: Vec<Entry> = results.iter().filter(|(e, _)| !e.cmd.ephemeral()).map(|(e, _)| e.clone()).collect();
        let eph: Vec<Entry> = results.iter().filter(|(e, _)| e.cmd.ephemeral()).map(|(e, _)| e.clone()).collect();
        if !durable.is_empty() || rows.iter().any(|r| r.persist) {
            let prev = std::mem::take(&mut self.quotes);
            let mut quotes = prev.clone();
            quotes.extend(eph);
            if !self.commit_verified(&durable, &quotes, &work, &rows).await {
                self.quotes = prev;
                self.fail(results).await;
                return (true, Some(n));
            }
            if self.hub.shared.books.hooks.crash_after_journal.swap(false, std::sync::atomic::Ordering::SeqCst) {
                return (false, Some(n));
            }
        } else {
            self.quotes.extend(eph);
        }
        // committed: swap, publish, dispatch, reply
        let mut touched: BTreeSet<String> = BTreeSet::new();
        let mut fills = Vec::new();
        for (e, _) in &results {
            touched.extend(e.out.touched.iter().cloned());
            fills.extend(e.out.fills.iter().cloned());
        }
        self.books = work;
        self.outbox_seq = oseq;
        let top = &self.hub.shared.options.top;
        top.publish(&self.slug, &self.books, Some(&touched));
        top.trades(&self.slug, &self.key, &fills);
        if !rows.is_empty() {
            let _ = self.dispatch.send(rows);
        }
        for ((e, reply), items) in results.into_iter().zip(per) {
            if let Some(r) = reply {
                let _ = r.send(Ok(Reply { out: e.out, items }));
            }
        }
        (true, Some(n))
    }

    /// The batch was not committed: nothing of it happened. The accounts get back what they reserved for it.
    async fn fail(&mut self, results: Vec<(Entry, Option<oneshot::Sender<Result<Reply, String>>>)>) {
        let mut rows = Vec::new();
        for (e, reply) in results {
            let mut items: Vec<(i64, Item)> = Vec::new();
            match &e.cmd {
                Cmd::New { series, order, .. } => {
                    items.push((order.login, Item::Done { done: Done { id: order.id, login: order.login, series: series.clone(), status: DoneStatus::Rejected, reason: "not_committed".into(), order: order.clone() } }));
                }
                Cmd::Amend { id, login, token, .. } => items.push((*login, Item::Release { id: *id, token: *token })),
                Cmd::MassQuote { login, stp, quotes, .. } => {
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
                            prio: 0,
                            tif: Tif::Gtc,
                            flags: POST_ONLY | EPHEMERAL,
                            expire_ms: None,
                            reserve_per_step: q.reserve_per_step,
                            ext: q.ext.clone(),
                        };
                        items.push((*login, Item::Done { done: Done { id: q.id, login: *login, series: q.series.clone(), status: DoneStatus::Rejected, reason: "not_committed".into(), order: o } }));
                    }
                }
                _ => {}
            }
            for (login, item) in items {
                self.outbox_seq += 1;
                rows.push(Row { seq: self.outbox_seq, book_seq: 0, login, item, persist: false });
            }
            if let Some(r) = reply {
                let _ = r.send(Err("The order book could not record this right now; nothing was done".into()));
            }
        }
        if !rows.is_empty() {
            let _ = self.dispatch.send(rows);
        }
    }
}
