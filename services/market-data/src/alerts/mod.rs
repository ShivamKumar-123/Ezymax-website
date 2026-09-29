//! Price alerts: server-side, per client, on the live quotes this service already sees.
//!
//! * **Conditions** (`rules.rs`): `above` / `below` (the price crosses a level) and `change_up` / `change_down` (the
//!   price moves by a percentage from a reference: the price when the alert was set, or when it last triggered).
//! * **Price**: the bid or the ask of the client's account group, i.e. with the group's spread markup applied,
//!   exactly the quote the client sees in the apps. Out-of-session prints never reach alerts (the ingest drops them).
//! * **One-shot or repeating.** A one-shot alert is done after its trigger. A repeating level alert re-arms once the
//!   price is back on the other side of the level; a repeating % alert measures the next move from the trigger price.
//!   A repeating alert fires at most once per `ALERTS_REPEAT_COOLDOWN_SECS`.
//! * **Expiry** (optional) and a **per-client limit** of live (active or paused) alerts (`ALERTS_MAX_PER_USER`).
//! * **Evaluation** runs on every quote change of a symbol that has live alerts: an in-memory list per symbol, a few
//!   comparisons per alert, no IO. A trigger is committed in one statement together with its history row, guarded
//!   by the alert's revision (a trigger decided on a version the client has since edited or deleted is dropped).
//! * **Delivery** (`notify.rs`): the history row is also the outbox. Each trigger goes to the notifications service
//!   (services/support `POST /v1/notify`: bell, email per the client's "Price alerts" preference, push) exactly once
//!   (dedupe key `alert:<event id>`), with retries, so a support outage never loses a trigger.
//! * **API** (`api.rs`, internal): `/v1/internal/alerts…`, `X-Kalks-Internal: $MARKET_DATA_INTERNAL_TOKEN`; the Client
//!   Area BFF passes `X-Kalks-Tenant` and `X-Kalks-User-Id` from the client's session. The public edge never serves
//!   `/v1/internal/*` (Caddy).

pub mod api;
mod notify;
pub mod rules;
mod store;
#[cfg(test)]
mod tests;

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::fmt;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::broadcast::{self, error::RecvError};
use tokio::sync::{Notify, mpsc};

use crate::state::{Event, Market, Quote};
use rules::{Basis, Step, Watch};

pub use api::router;

/// Alerts settings (env; the repo-root `.env.local` in development).
#[derive(Clone)]
pub struct Config {
    /// `X-Kalks-Internal` for `/v1/internal/*` (the Client Area BFF). Empty = the alerts API answers 503; alerts
    /// already set keep being evaluated and delivered.
    pub internal_token: String,
    /// Notifications service (services/support) that delivers triggers. Empty token = delivery is off (logged).
    pub support_url: String,
    pub support_token: String,
    /// Live (active or paused) alerts per client.
    pub max_per_user: i64,
    /// Shortest time between two triggers of a repeating alert.
    pub repeat_cooldown: Duration,
    /// How often expired alerts are retired and the outbox is swept.
    pub tick: Duration,
}

fn var(k: &str, d: &str) -> String {
    std::env::var(k).unwrap_or_else(|_| d.to_string())
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            internal_token: var("MARKET_DATA_INTERNAL_TOKEN", "").trim().to_string(),
            support_url: var("MARKET_DATA_SUPPORT_URL", "http://127.0.0.1:8100").trim().trim_end_matches('/').to_string(),
            support_token: var("SUPPORT_INTERNAL_TOKEN", "").trim().to_string(),
            max_per_user: var("ALERTS_MAX_PER_USER", "50").parse().unwrap_or(50).clamp(1, 1000),
            repeat_cooldown: Duration::from_secs(var("ALERTS_REPEAT_COOLDOWN_SECS", "300").parse().unwrap_or(300).clamp(10, 86_400)),
            tick: Duration::from_secs(15),
        }
    }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let set = |v: &str| if v.is_empty() { "<empty>" } else { "<redacted>" };
        f.debug_struct("alerts::Config")
            .field("internal_token", &set(&self.internal_token))
            .field("support_url", &self.support_url)
            .field("support_token", &set(&self.support_token))
            .field("max_per_user", &self.max_per_user)
            .field("repeat_cooldown", &self.repeat_cooldown)
            .finish()
    }
}

/// One live (active) alert as the evaluator holds it.
#[derive(Clone, Debug)]
pub struct Live {
    pub id: i64,
    pub rev: i32,
    pub group: String,
    pub basis: Basis,
    pub value: f64,
    pub reference: Option<f64>,
    pub w: Watch,
}

/// A decision of the evaluator, committed by the writer task.
#[derive(Debug)]
enum Write {
    /// `live` is the alert as it was when it fired; `next` = the new reference and target of a repeating % alert.
    Fire { live: Live, price: f64, at: DateTime<Utc>, next: Option<(f64, f64)> },
    Rearm { id: i64, rev: i32 },
}

pub struct Alerts {
    pub cfg: Config,
    pub market: Arc<Market>,
    /// live alerts per symbol
    live: Mutex<HashMap<String, Vec<Live>>>,
    writes: mpsc::UnboundedSender<Write>,
    /// wakes the delivery loop after a trigger
    wake: Notify,
    http: reqwest::Client,
}

impl Alerts {
    /// Loads the live alerts and starts the evaluator, the writer, the delivery loop and the sweeps.
    pub async fn start(cfg: Config, market: Arc<Market>) -> anyhow::Result<Arc<Self>> {
        let (tx, rx) = mpsc::unbounded_channel();
        let http = reqwest::Client::builder().timeout(Duration::from_secs(10)).build()?;
        let a = Arc::new(Self { cfg, market, live: Mutex::new(HashMap::new()), writes: tx, wake: Notify::new(), http });
        // subscribe before loading, so no quote between the two is missed
        let quotes = a.market.tx.subscribe();
        let n = a.load().await?;
        if a.cfg.internal_token.is_empty() {
            tracing::warn!("MARKET_DATA_INTERNAL_TOKEN is not set: the price alerts API is off (alerts already set still run)");
        }
        if a.cfg.support_token.is_empty() {
            tracing::warn!("SUPPORT_INTERNAL_TOKEN is not set: price alert triggers are kept but not delivered");
        }
        tracing::info!(live = n, cfg = ?a.cfg, "price alerts ready");
        tokio::spawn(a.clone().evaluate(quotes));
        tokio::spawn(a.clone().writer(rx));
        tokio::spawn(a.clone().deliver_loop());
        tokio::spawn(a.clone().sweep_loop());
        Ok(a)
    }

    pub fn pool(&self) -> &PgPool {
        &self.market.pool
    }

    /// Every active alert into memory (start-up).
    async fn load(&self) -> anyhow::Result<usize> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {} FROM price_alerts WHERE status = 'active'", store::ALERT_COLS))).fetch_all(self.pool()).await?;
        let mut map: HashMap<String, Vec<Live>> = HashMap::new();
        let mut n = 0;
        for r in rows {
            let a = store::AlertRow::from_row(&r)?;
            if let Some(l) = a.live() {
                map.entry(a.symbol.clone()).or_default().push(l);
                n += 1;
            }
        }
        *self.live.lock().unwrap() = map;
        Ok(n)
    }

    /// Puts (or replaces) an alert in the evaluator; `None` takes it out.
    fn set_live(&self, symbol: &str, id: i64, l: Option<Live>) {
        let mut map = self.live.lock().unwrap();
        let list = map.entry(symbol.to_string()).or_default();
        list.retain(|x| x.id != id);
        if let Some(l) = l {
            list.push(l);
        }
        if list.is_empty() {
            map.remove(symbol);
        }
    }

    #[cfg(test)]
    fn live_ids(&self, symbol: &str) -> Vec<i64> {
        self.live.lock().unwrap().get(symbol).map(|v| v.iter().map(|l| l.id).collect()).unwrap_or_default()
    }

    /* ------------------------------------------------------------------ */
    /* Evaluation                                                          */
    /* ------------------------------------------------------------------ */

    async fn evaluate(self: Arc<Self>, mut quotes: broadcast::Receiver<Event>) {
        loop {
            match quotes.recv().await {
                Ok(Event::Quote { symbol, quote }) => self.on_quote(&symbol, &quote),
                Ok(_) => {}
                Err(RecvError::Lagged(skipped)) => {
                    // fell behind a burst: judge every alert on the current prices instead of the missed ones
                    tracing::warn!(skipped, "price alerts fell behind the quotes; checking every alert on the current prices");
                    let symbols: Vec<String> = self.live.lock().unwrap().keys().cloned().collect();
                    for s in symbols {
                        if let Some(q) = self.market.quote(&s) {
                            self.on_quote(&s, &q);
                        }
                    }
                }
                Err(RecvError::Closed) => return,
            }
        }
    }

    /// Judges the symbol's live alerts on a new raw quote (each on its group's bid or ask).
    fn on_quote(&self, symbol: &str, raw: &Quote) {
        // a price restored from the database at start-up is not a market move
        if raw.recv == 0 {
            return;
        }
        let Some(inst) = self.market.cat.get(symbol) else { return };
        let now = Utc::now();
        let now_ms = now.timestamp_millis();
        let cooldown = self.cfg.repeat_cooldown.as_millis() as i64;
        let mut out = Vec::new();
        {
            let mut map = self.live.lock().unwrap();
            let Some(list) = map.get_mut(symbol) else { return };
            // client quotes per group, computed once per quote
            let mut by_group: Vec<(String, Quote)> = Vec::with_capacity(2);
            list.retain_mut(|a| {
                let q = match by_group.iter().find(|(g, _)| *g == a.group) {
                    Some((_, q)) => *q,
                    None => {
                        let q = self.market.spreads.apply(&a.group, inst, *raw);
                        by_group.push((a.group.clone(), q));
                        q
                    }
                };
                let price = match a.basis {
                    Basis::Bid => q.bid,
                    Basis::Ask => q.ask,
                };
                match rules::step(&a.w, price, now_ms, cooldown) {
                    Step::Hold => true,
                    Step::Rearm => {
                        a.w.armed = true;
                        out.push(Write::Rearm { id: a.id, rev: a.rev });
                        true
                    }
                    Step::Fire => {
                        let before = a.clone();
                        if !a.w.repeat {
                            out.push(Write::Fire { live: before, price, at: now, next: None });
                            return false;
                        }
                        a.w.last_fire_ms = now_ms;
                        let next = if a.w.cond.is_level() {
                            a.w.armed = false;
                            None
                        } else {
                            let target = rules::target_of(a.w.cond, a.value, price, inst);
                            a.reference = Some(price);
                            a.w.target = target;
                            Some((price, target))
                        };
                        out.push(Write::Fire { live: before, price, at: now, next });
                        true
                    }
                }
            });
            if list.is_empty() {
                map.remove(symbol);
            }
        }
        for w in out {
            let _ = self.writes.send(w);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Writer                                                              */
    /* ------------------------------------------------------------------ */

    async fn writer(self: Arc<Self>, mut rx: mpsc::UnboundedReceiver<Write>) {
        while let Some(w) = rx.recv().await {
            // a short retry for a busy or restarting database; after that the alert is judged again from the
            // database at the next start (it is still active there)
            for attempt in 0..3u64 {
                match self.commit(&w).await {
                    Ok(()) => break,
                    Err(e) if attempt < 2 => {
                        tracing::warn!(error = %e, "price alert write failed; retrying");
                        tokio::time::sleep(Duration::from_millis(250 * (attempt + 1) * (attempt + 1))).await;
                    }
                    Err(e) => tracing::error!(error = %e, write = ?w, "price alert write failed"),
                }
            }
        }
    }

    async fn commit(&self, w: &Write) -> anyhow::Result<()> {
        match w {
            Write::Rearm { id, rev } => {
                sqlx::query("UPDATE price_alerts SET armed = TRUE WHERE id = $1 AND rev = $2 AND status = 'active'").bind(id).bind(rev).execute(self.pool()).await?;
            }
            Write::Fire { live, price, at, next } => {
                if self.commit_fire(live, *price, *at, *next).await?.is_some() {
                    self.wake.notify_one();
                }
            }
        }
        Ok(())
    }

    /// Records a trigger and its history row in one statement. None when the alert changed meanwhile (edited,
    /// paused, deleted, or already triggered): nothing is recorded then.
    async fn commit_fire(&self, l: &Live, price: f64, at: DateTime<Utc>, next: Option<(f64, f64)>) -> anyhow::Result<Option<i64>> {
        let row = sqlx::query(
            "WITH hit AS (
                UPDATE price_alerts SET
                    status = CASE WHEN repeat THEN status ELSE 'triggered' END,
                    armed = CASE WHEN repeat AND condition IN ('above', 'below') THEN FALSE ELSE armed END,
                    reference = COALESCE($5, reference),
                    target = COALESCE($6, target),
                    trigger_count = trigger_count + 1,
                    triggered_at = $3,
                    last_price = $4,
                    updated_at = now()
                WHERE id = $1 AND rev = $2 AND status = 'active'
                RETURNING id, tenant, user_id, symbol, condition, value, basis, repeat, note
             )
             INSERT INTO price_alert_events (alert_id, tenant, user_id, symbol, condition, value, basis, reference, target, price, repeat, note, triggered_at)
             SELECT id, tenant, user_id, symbol, condition, value, basis, $7, $8, $4, repeat, note, $3 FROM hit
             RETURNING id",
        )
        .bind(l.id)
        .bind(l.rev)
        .bind(at)
        .bind(price)
        .bind(next.map(|n| n.0))
        .bind(next.map(|n| n.1))
        .bind(l.reference)
        .bind(l.w.target)
        .fetch_optional(self.pool())
        .await?;
        let id = row.map(|r| r.get::<i64, _>("id"));
        match id {
            Some(ev) => tracing::info!(alert = l.id, event = ev, price, "price alert triggered"),
            None => tracing::debug!(alert = l.id, rev = l.rev, "price alert changed before its trigger was recorded; dropped"),
        }
        Ok(id)
    }

    /* ------------------------------------------------------------------ */
    /* Sweeps                                                              */
    /* ------------------------------------------------------------------ */

    async fn sweep_loop(self: Arc<Self>) {
        let mut every = tokio::time::interval(self.cfg.tick);
        every.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        let mut n: u64 = 0;
        loop {
            every.tick().await;
            if let Err(e) = self.sweep_expired().await {
                tracing::warn!(error = %e, "price alert expiry sweep failed");
            }
            // hourly (every 240 ticks of 15 s): finished alerts and old history
            if n % 240 == 0
                && let Err(e) = self.prune().await
            {
                tracing::warn!(error = %e, "price alert prune failed");
            }
            n += 1;
        }
    }

    /// Retires alerts past their expiry (active or paused) and takes them out of the evaluator.
    async fn sweep_expired(&self) -> anyhow::Result<usize> {
        let rows = sqlx::query("UPDATE price_alerts SET status = 'expired', rev = rev + 1, updated_at = now() WHERE status IN ('active', 'paused') AND expires_at <= now() RETURNING id, symbol")
            .fetch_all(self.pool())
            .await?;
        for r in &rows {
            self.set_live(&r.get::<String, _>("symbol"), r.get("id"), None);
        }
        if !rows.is_empty() {
            tracing::info!(expired = rows.len(), "price alerts expired");
        }
        Ok(rows.len())
    }

    /// Keeps the tables small: finished alerts and history rows after 90 days, at most 500 history rows per client
    /// (delivered ones only: nothing waiting for delivery is ever removed).
    async fn prune(&self) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM price_alerts WHERE status IN ('triggered', 'expired') AND updated_at < now() - interval '90 days'").execute(self.pool()).await?;
        sqlx::query(
            "DELETE FROM price_alert_events e USING (
                SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY tenant, user_id ORDER BY id DESC) AS n FROM price_alert_events) x WHERE x.n > 500
             ) old
             WHERE e.id = old.id AND (e.delivered_at IS NOT NULL OR e.failed)",
        )
        .execute(self.pool())
        .await?;
        sqlx::query("DELETE FROM price_alert_events WHERE triggered_at < now() - interval '90 days' AND (delivered_at IS NOT NULL OR failed)").execute(self.pool()).await?;
        Ok(())
    }
}
