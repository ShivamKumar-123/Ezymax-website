//! The one way into the book: `submit(hub, login, req)`. Clients (terminal), closes, stops, SL / TP and the Ezymex
//! market maker all come through here, under the same gates, reservations and matching rules.
//!
//! 1. `hub.exec(login, engine::options_book::enter)`: gates and the reservation in the account shard (the working
//!    order lives in `AccountState.book`).
//! 2. The command goes to the book actor (started on first use).
//! 3. The caller waits up to 1 s for its own outbox items (its fills and the order's removal) to be applied to
//!    the account, so the answer can carry the position tickets.
//!
//! If the actor cannot take the command, the reservation is released at once; if it took it but could not commit,
//! the actor releases it through the outbox.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::actor::{CallError, Handle, Reply};
use super::outbox::Applied;
use super::types::*;
use crate::engine::options_book::{BookReq, Entered, enter};
use crate::shard::{ExecError, Hub, Op};

/// How long a request waits for its own fills to be booked on the account.
pub const APPLY_WAIT: Duration = Duration::from_secs(1);

#[derive(Debug)]
pub enum SubmitError {
    /// Refused by the account gates (or not found).
    Exec(ExecError),
    /// The book could not take it (actor gone, commit failed); nothing was done and nothing stays reserved.
    Book(String),
}

impl From<ExecError> for SubmitError {
    fn from(e: ExecError) -> Self {
        SubmitError::Exec(e)
    }
}

/// What happened to a command in the book.
#[derive(Debug)]
pub struct Submitted {
    pub key: Option<BookKey>,
    pub id: i64,
    /// None = a duplicate clientOrderId (nothing new was sent).
    pub out: Option<Out>,
    /// This login's outbox items already applied (fills: the position tickets are in `value`).
    pub applied: Vec<Applied>,
    /// Every item of this login was applied within the wait.
    pub settled: bool,
    /// The order as sent and its series (None for a duplicate).
    pub order: Option<Resting>,
    pub spec: Option<SeriesSpec>,
}

/// Runs an account op that yields a typed value next to its JSON.
pub async fn exec_typed<T: Send + 'static>(hub: &Hub, login: i64, actor: &str, f: impl FnOnce(&mut crate::engine::Tx, &crate::engine::Env) -> Result<T, crate::engine::Reject> + Send + 'static) -> Result<T, ExecError> {
    let slot: Arc<Mutex<Option<T>>> = Arc::new(Mutex::new(None));
    let s2 = slot.clone();
    let op: Op = Box::new(move |tx, env| {
        let v = f(tx, env)?;
        *s2.lock().unwrap() = Some(v);
        Ok(serde_json::Value::Null)
    });
    hub.exec(login, actor, None, "", "", None, op).await?;
    let v = slot.lock().unwrap().take();
    v.ok_or_else(|| ExecError::Internal("no result".into()))
}

/// Submits a new order for `login`.
pub async fn submit(hub: &Hub, login: i64, actor: &str, req: BookReq) -> Result<Submitted, SubmitError> {
    let entered = exec_typed(hub, login, actor, move |tx, env| enter(tx, env, req)).await?;
    match entered {
        Entered::Duplicate { key, id } => Ok(Submitted { key, id, out: None, applied: vec![], settled: true, order: None, spec: None }),
        Entered::New { key, cmd, id } => {
            let (order, spec) = match &cmd {
                Cmd::New { order, spec, .. } => (Some(order.clone()), Some(spec.clone())),
                _ => (None, None),
            };
            let (out, applied, settled) = call(hub, login, &key, cmd).await?;
            Ok(Submitted { key: Some(key), id, out: Some(out), applied, settled, order, spec })
        }
    }
}

/// Sends a command for `login` and waits (up to 1 s) for this login's items to be applied.
pub async fn call(hub: &Hub, login: i64, key: &BookKey, cmd: Cmd) -> Result<(Out, Vec<Applied>, bool), SubmitError> {
    let books = &hub.shared.books;
    let mut sub = books.applied.subscribe();
    let h: Handle = match books.actor(hub, key).await {
        Ok(h) => h,
        Err(e) => {
            super::release_unsent(hub, login, &cmd).await;
            return Err(SubmitError::Book(format!("The options order book is unavailable: {e}")));
        }
    };
    let reply: Reply = match h.call(cmd.clone()).await {
        Ok(r) => r,
        Err(CallError::NotSent) => {
            super::release_unsent(hub, login, &cmd).await;
            return Err(SubmitError::Book("The options order book is unavailable right now".into()));
        }
        Err(CallError::Failed(m)) => return Err(SubmitError::Book(m)),
    };
    let want: BTreeSet<u64> = reply.items.iter().filter(|(_, l, _)| *l == login).map(|(s, _, _)| *s).collect();
    let mut applied = Vec::new();
    let deadline = tokio::time::Instant::now() + APPLY_WAIT;
    while applied.len() < want.len() {
        match tokio::time::timeout_at(deadline, sub.recv()).await {
            Ok(Ok(a)) if &a.key == key && want.contains(&a.seq) => applied.push(a),
            Ok(Ok(_)) => continue,
            Ok(Err(tokio::sync::broadcast::error::RecvError::Lagged(_))) => continue,
            _ => break,
        }
    }
    let settled = applied.len() == want.len();
    Ok((reply.out, applied, settled))
}

/// Market-maker mass quote for `login` (`POST …/book/mass-quote`; the Ezymex MM uses the same path): the quotes
/// are reserved like any order, then each book replaces the account's quotes in the listed series.
pub async fn mass_quote(hub: &Hub, login: i64, actor: &str, lines: Vec<crate::engine::options_book::QuoteLine>) -> Result<serde_json::Value, SubmitError> {
    let (books, refused) = exec_typed(hub, login, actor, move |tx, env| crate::engine::options_book::enter_mass(tx, env, lines)).await?;
    let stp = hub.meta(login).map(|m| m.user_id).unwrap_or(0);
    let at = hub.shared.clock.now().timestamp_millis();
    let mut out = Vec::new();
    for (key, (series, quotes)) in books {
        let ids: Vec<i64> = quotes.iter().map(|q| q.id).collect();
        let cmd = Cmd::MassQuote { login, stp, series, quotes, at };
        match call(hub, login, &key, cmd).await {
            Ok((o, _, _)) => {
                let rejected: Vec<serde_json::Value> = o.done.iter().filter(|d| ids.contains(&d.id) && d.status == DoneStatus::Rejected).map(|d| serde_json::json!({"id": d.id, "series": d.series, "side": d.order.side.as_str(), "code": d.reason})).collect();
                out.push(serde_json::json!({"underlying": key.underlying, "seq": o.seq, "rested": o.rested, "replaced": o.done.iter().filter(|d| d.status == DoneStatus::Replaced).count(), "rejected": rejected}));
            }
            Err(e) => out.push(serde_json::json!({"underlying": key.underlying, "error": format!("{e:?}")})),
        }
    }
    Ok(serde_json::json!({"books": out, "refused": refused}))
}
