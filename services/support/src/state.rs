//! Shared state: DB pool, config, the realtime hub (WebSocket fan-out), one-time stream tickets and presence.

use crate::config::Config;
use crate::mailer::Mailer;
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::{Notify, broadcast};

/// Who a realtime event is for.
#[derive(Clone, Debug, PartialEq)]
pub enum Target {
    User(i64),
    Staff(String),
    AllStaff,
}

#[derive(Clone, Debug)]
pub struct Event {
    pub tenant: String,
    pub to: Target,
    pub payload: Arc<Value>,
}

/// Identity bound to a stream ticket.
#[derive(Clone, Debug)]
pub enum Who {
    User { id: i64 },
    /// `inbox` = may read support conversations (receives the inbox events, not only their own bell).
    Staff { id: String, name: String, role: String, inbox: bool },
}

struct Ticket {
    tenant: String,
    who: Who,
    expires: Instant,
}

#[derive(Clone)]
pub struct Hub {
    tx: broadcast::Sender<Event>,
    tickets: Arc<Mutex<HashMap<String, Ticket>>>,
    online_users: Arc<Mutex<HashMap<(String, i64), usize>>>,
    online_staff: Arc<Mutex<HashMap<(String, String), usize>>>,
    /// Clients seen on the stream recently (the wallet adapter polls their wallet notifications).
    recent_users: Arc<Mutex<HashMap<(String, i64), Instant>>>,
}

impl Default for Hub {
    fn default() -> Self {
        let (tx, _) = broadcast::channel(4096);
        Self { tx, tickets: Default::default(), online_users: Default::default(), online_staff: Default::default(), recent_users: Default::default() }
    }
}

pub const TICKET_TTL: Duration = Duration::from_secs(30);

impl Hub {
    pub fn send(&self, tenant: &str, to: Target, payload: Value) {
        let _ = self.tx.send(Event { tenant: tenant.to_string(), to, payload: Arc::new(payload) });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.tx.subscribe()
    }

    /// One-time ticket for `GET /v1/stream?ticket=` (30 s).
    pub fn issue(&self, tenant: &str, who: Who) -> String {
        let t = crate::util::token(24);
        let mut m = self.tickets.lock().unwrap();
        let now = Instant::now();
        m.retain(|_, v| v.expires > now);
        m.insert(t.clone(), Ticket { tenant: tenant.to_string(), who, expires: now + TICKET_TTL });
        t
    }

    pub fn redeem(&self, ticket: &str) -> Option<(String, Who)> {
        let mut m = self.tickets.lock().unwrap();
        let t = m.remove(ticket)?;
        (t.expires > Instant::now()).then_some((t.tenant, t.who))
    }

    pub fn connected(&self, tenant: &str, who: &Who, delta: i64) {
        match who {
            Who::User { id } => {
                bump(&self.online_users, (tenant.to_string(), *id), delta);
                self.recent_users.lock().unwrap().insert((tenant.to_string(), *id), Instant::now());
            }
            Who::Staff { id, inbox: true, .. } => bump(&self.online_staff, (tenant.to_string(), id.clone()), delta),
            Who::Staff { .. } => {}
        }
    }

    pub fn user_online(&self, tenant: &str, id: i64) -> bool {
        self.online_users.lock().unwrap().get(&(tenant.to_string(), id)).copied().unwrap_or(0) > 0
    }

    pub fn staff_online(&self, tenant: &str, id: &str) -> bool {
        self.online_staff.lock().unwrap().get(&(tenant.to_string(), id.to_string())).copied().unwrap_or(0) > 0
    }

    /// Clients connected now or within `within`.
    pub fn recent_users(&self, within: Duration) -> Vec<(String, i64)> {
        let now = Instant::now();
        let online = self.online_users.lock().unwrap();
        let mut m = self.recent_users.lock().unwrap();
        m.retain(|k, t| now.duration_since(*t) < within || online.get(k).copied().unwrap_or(0) > 0);
        m.keys().cloned().collect()
    }

    pub fn staff_online_ids(&self, tenant: &str) -> Vec<String> {
        self.online_staff.lock().unwrap().iter().filter(|((t, _), n)| t == tenant && **n > 0).map(|((_, id), _)| id.clone()).collect()
    }
}

fn bump<K: std::hash::Hash + Eq>(m: &Mutex<HashMap<K, usize>>, k: K, delta: i64) {
    let mut m = m.lock().unwrap();
    let e = m.entry(k).or_insert(0);
    *e = (*e as i64 + delta).max(0) as usize;
}

/// Sliding-window limiter (bot answers per client, uploads).
#[derive(Clone, Default)]
pub struct Limiter(Arc<Mutex<HashMap<String, Vec<Instant>>>>);

impl Limiter {
    pub fn hit(&self, key: &str, max: usize, window: Duration) -> bool {
        let mut m = self.0.lock().unwrap();
        let now = Instant::now();
        let v = m.entry(key.to_string()).or_default();
        v.retain(|t| now.duration_since(*t) < window);
        if v.len() >= max {
            return false;
        }
        v.push(now);
        true
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
    pub http: reqwest::Client,
    pub hub: Hub,
    pub limiter: Limiter,
    pub mailer: Option<Mailer>,
    /// Wakes the email sender when something was queued.
    pub wake_mail: Arc<Notify>,
    /// One bot answer at a time per conversation.
    pub bot_locks: Arc<Mutex<HashMap<i64, Arc<tokio::sync::Mutex<()>>>>>,
}

impl AppState {
    pub fn bot_lock(&self, conv: i64) -> Arc<tokio::sync::Mutex<()>> {
        let mut m = self.bot_locks.lock().unwrap();
        if m.len() > 10_000 {
            m.retain(|_, v| Arc::strong_count(v) > 1);
        }
        m.entry(conv).or_default().clone()
    }

    pub fn new(pool: PgPool, cfg: Config) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(20)).build().expect("http client");
        let mailer = if cfg.smtp_host.is_empty() {
            None
        } else {
            match Mailer::new(&cfg) {
                Ok(m) => Some(m),
                Err(e) => {
                    tracing::error!(error = %e, "SMTP settings invalid: emails will only be logged");
                    None
                }
            }
        };
        Self { pool, cfg: Arc::new(cfg), http, hub: Hub::default(), limiter: Limiter::default(), mailer, wake_mail: Arc::new(Notify::new()), bot_locks: Default::default() }
    }
}
