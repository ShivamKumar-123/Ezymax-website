//! Delivery of triggers to the notifications service (services/support `POST /v1/notify`). The history rows are the
//! outbox: each trigger is sent exactly once (dedupe key `alert:<event id>`, so a retry after a lost answer is
//! harmless), retried with back-off while the service is down, and marked failed after 12 attempts or a day (it
//! stays in the client's history either way).

use chrono::{DateTime, Duration as Span, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

use super::Alerts;
use super::rules::{self, Basis, Cond};

const MAX_ATTEMPTS: i32 = 12;
const BATCH: i64 = 50;

impl Alerts {
    pub(super) async fn deliver_loop(self: Arc<Self>) {
        loop {
            tokio::select! {
                _ = self.wake.notified() => {}
                _ = tokio::time::sleep(Duration::from_secs(5)) => {}
            }
            if self.cfg.support_token.is_empty() || self.cfg.support_url.is_empty() {
                continue;
            }
            // drain: a burst of triggers goes out batch after batch
            loop {
                match self.deliver_due().await {
                    Ok(n) if n as i64 == BATCH => continue,
                    Ok(_) => break,
                    Err(e) => {
                        tracing::warn!(error = %e, "price alert delivery failed");
                        break;
                    }
                }
            }
        }
    }

    /// Sends the triggers that are due; returns how many were picked up.
    pub(super) async fn deliver_due(&self) -> anyhow::Result<usize> {
        let rows = sqlx::query(
            "SELECT id, tenant, user_id, alert_id, symbol, condition, value, basis, reference, target, price, repeat, note, triggered_at, attempts
               FROM price_alert_events WHERE delivered_at IS NULL AND NOT failed AND next_attempt_at <= now() ORDER BY id LIMIT $1",
        )
        .bind(BATCH)
        .fetch_all(self.pool())
        .await?;
        let n = rows.len();
        for r in rows {
            let id: i64 = r.get("id");
            let tenant: String = r.get("tenant");
            let symbol: String = r.get("symbol");
            let cond = Cond::parse(&r.get::<String, _>("condition")).unwrap_or(Cond::Above);
            let basis = Basis::parse(&r.get::<String, _>("basis")).unwrap_or(Basis::Bid);
            let (value, target, price): (f64, f64, f64) = (r.get("value"), r.get("target"), r.get("price"));
            let reference: Option<f64> = r.get("reference");
            let note: String = r.get("note");
            let triggered_at: DateTime<Utc> = r.get("triggered_at");
            let digits = self.market.cat.get(&symbol).map(|i| i.digits).unwrap_or(5);
            let (title, body) = rules::message(&rules::Fired { symbol: &symbol, digits, cond, value, basis, reference, target, price, repeat: r.get("repeat"), note: &note });
            let payload = json!({
                "type": "alerts.price",
                "userId": r.get::<i64, _>("user_id"),
                "title": title,
                "body": body,
                "link": "/alerts",
                "severity": "info",
                "dedupeKey": format!("alert:{id}"),
                "data": {"eventId": id, "alertId": r.get::<Option<i64>, _>("alert_id"), "symbol": symbol, "condition": cond.as_str(), "target": target, "price": price, "basis": basis.as_str()},
            });
            match self.post(&tenant, &payload).await {
                Ok(()) => {
                    sqlx::query("UPDATE price_alert_events SET delivered_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1").bind(id).execute(self.pool()).await?;
                }
                Err((retry, err)) => {
                    let attempts = r.get::<i32, _>("attempts") + 1;
                    let give_up = !retry || attempts >= MAX_ATTEMPTS || Utc::now() - triggered_at > Span::hours(24);
                    if give_up {
                        tracing::error!(event = id, attempts, error = %err, "price alert not delivered; giving up");
                    } else {
                        tracing::warn!(event = id, attempts, error = %err, "price alert not delivered; will retry");
                    }
                    sqlx::query("UPDATE price_alert_events SET attempts = $2, next_attempt_at = now() + make_interval(secs => $3), failed = $4, last_error = $5 WHERE id = $1")
                        .bind(id)
                        .bind(attempts)
                        .bind(rules::retry_delay_secs(attempts - 1) as f64)
                        .bind(give_up)
                        .bind(err.chars().take(300).collect::<String>())
                        .execute(self.pool())
                        .await?;
                }
            }
        }
        Ok(n)
    }

    /// One notification; Err((retryable, reason)).
    async fn post(&self, tenant: &str, payload: &Value) -> Result<(), (bool, String)> {
        let res = self
            .http
            .post(format!("{}/v1/notify", self.cfg.support_url))
            .header("x-kalks-internal", &self.cfg.support_token)
            .header("x-kalks-tenant", tenant)
            .header("x-kalks-service", "market-data")
            .json(payload)
            .send()
            .await
            .map_err(|e| (true, format!("notifications service unreachable: {e}")))?;
        let status = res.status().as_u16();
        if (200..300).contains(&status) {
            return Ok(());
        }
        // a malformed notification never gets better; anything else (down, overloaded, token being rotated) might
        let retry = !matches!(status, 400 | 404 | 413 | 422);
        let detail = res.text().await.unwrap_or_default();
        Err((retry, format!("HTTP {status}: {}", detail.chars().take(200).collect::<String>())))
    }
}
