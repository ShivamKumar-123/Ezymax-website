//! Client notifications (bell + email) through the support service.
//!
//! Producers call [`enqueue`] with the business change (ideally in the same transaction); a background worker
//! ([`spawn`]) delivers pending rows to support `POST /v1/notify` and retries until support confirms, so a support
//! outage never blocks trading or money movement. Nothing is sent when `SUPPORT_URL` is unset (rows stay pending).
//!
//! ```ignore
//! notify::enqueue(&pool, tenant_id, user_id, "copy.trade_skipped",
//!     json!({"title": "Trade not copied", "body": "…", "link": "/social/copy", "severity": "warning", "email": true, "data": {"subscriptionId": 7}}),
//!     &format!("copy:{sub}:{version}:skipped")).await?;
//! ```
//!
//! - `kind` is support's `type` (`category.event`, lower case: `copy.*`, `account.*`, …); the category picks the
//!   client's preference topic (see services/support README, "Notifications API").
//! - `data_json` fields: `title` (required), `body`, `link` (app path), `severity` (`info` | `success` | `warning` |
//!   `critical`), `email` (`false` = in-app only; omitted = the client's preference for the topic), `data` (any JSON
//!   kept on the notification). Unknown fields are ignored.
//! - `dedupe_key` is unique per tenant: enqueueing the same event again is a no-op, and support dedupes per recipient
//!   on the same key, so retries never show anything twice.
//!
//! Env: `SUPPORT_URL` (e.g. http://127.0.0.1:8100) and `SUPPORT_INTERNAL_TOKEN`, read directly here because the
//! worker is optional.

use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::time::Duration;

use crate::social::wallet::WalletClient;

/// Queues a notification for `user_id` (no-op on a repeated `dedupe_key`).
pub async fn enqueue<'e, E: sqlx::PgExecutor<'e>>(ex: E, tenant_id: i64, user_id: i64, kind: &str, data_json: Value, dedupe_key: &str) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO notify_outbox (tenant_id, user_id, kind, data, dedupe_key, status) VALUES ($1,$2,$3,$4,$5,'pending') ON CONFLICT (tenant_id, dedupe_key) DO NOTHING")
        .bind(tenant_id)
        .bind(user_id)
        .bind(kind)
        .bind(sqlx::types::Json(data_json))
        .bind(dedupe_key)
        .execute(ex)
        .await?;
    Ok(())
}

/// Best-effort [`enqueue`] that only logs a failure (for producers that must not fail on a notification).
pub async fn enqueue_or_log(pool: &PgPool, tenant_id: i64, user_id: i64, kind: &str, data_json: Value, dedupe_key: &str) {
    if let Err(e) = enqueue(pool, tenant_id, user_id, kind, data_json, dedupe_key).await {
        tracing::warn!(kind, dedupe_key, error = %e, "notification enqueue failed");
    }
}

/// The support `/v1/notify` body of an outbox row.
pub fn notify_body(kind: &str, user_id: i64, data: &Value, dedupe_key: &str) -> Value {
    let mut b = json!({
        "type": kind, "userId": user_id,
        "title": data.get("title").and_then(Value::as_str).unwrap_or(kind),
        "dedupeKey": dedupe_key,
        "severity": data.get("severity").and_then(Value::as_str).unwrap_or("info"),
        "data": data.get("data").cloned().unwrap_or_else(|| json!({})),
    });
    for k in ["body", "link"] {
        if let Some(v) = data.get(k).and_then(Value::as_str).filter(|v| !v.is_empty()) {
            b[k] = json!(v);
        }
    }
    if data.get("email").and_then(Value::as_bool) == Some(false) {
        b["email"] = json!(false);
    }
    b
}

/// The support client from `SUPPORT_URL` / `SUPPORT_INTERNAL_TOKEN` (None when unset).
pub fn client_from_env() -> Option<WalletClient> {
    let url = std::env::var("SUPPORT_URL").ok().filter(|v| !v.trim().is_empty())?;
    let token = std::env::var("SUPPORT_INTERNAL_TOKEN").unwrap_or_default();
    Some(WalletClient::new(&url, &token))
}

/// Starts the delivery worker (every 3 s). Without `SUPPORT_URL` it does nothing.
pub fn spawn(pool: PgPool) {
    let Some(client) = client_from_env() else {
        tracing::info!("SUPPORT_URL is not set: client notifications stay queued in notify_outbox");
        return;
    };
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(3));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            flush(&pool, &client).await;
        }
    });
}

/// Delivers up to 100 pending rows. Returns how many support accepted.
pub async fn flush(pool: &PgPool, client: &WalletClient) -> usize {
    let rows = match sqlx::query(
        "SELECT o.id, o.user_id, o.kind, o.data, o.dedupe_key, o.attempts, t.slug FROM notify_outbox o JOIN tenants t ON t.id = o.tenant_id
         WHERE o.status = 'pending' ORDER BY o.id LIMIT 100",
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "notify outbox read failed");
            return 0;
        }
    };
    let mut sent = 0;
    for r in rows {
        let id: i64 = r.get("id");
        let kind: String = r.get("kind");
        let key: String = r.get("dedupe_key");
        let attempts: i32 = r.get("attempts");
        let data: Value = r.get::<sqlx::types::Json<Value>, _>("data").0;
        let body = notify_body(&kind, r.get("user_id"), &data, &key);
        match client.post(&r.get::<String, _>("slug"), "/v1/notify", &body).await {
            Ok(_) => {
                sent += 1;
                let _ = sqlx::query("UPDATE notify_outbox SET status = 'done', attempts = attempts + 1, sent_at = now(), last_error = NULL WHERE id = $1").bind(id).execute(pool).await;
            }
            Err(e) => {
                let give_up = e.is_rejection() || attempts + 1 >= 30;
                let _ = sqlx::query("UPDATE notify_outbox SET attempts = attempts + 1, last_error = $2, status = CASE WHEN $3 THEN 'failed' ELSE status END WHERE id = $1")
                    .bind(id)
                    .bind(e.to_string())
                    .bind(give_up)
                    .execute(pool)
                    .await;
                if give_up {
                    tracing::warn!(key, error = %e, "notification dropped");
                } else {
                    tracing::debug!(key, error = %e, "notification retry later");
                    // support is down: stop this round, the next tick retries
                    if e.status == 0 {
                        break;
                    }
                }
            }
        }
    }
    sent
}

#[cfg(test)]
mod tests {
    use super::notify_body;
    use serde_json::json;

    #[test]
    fn builds_the_support_body() {
        let b = notify_body("copy.trade_opened", 7, &json!({"title": "Trade copied", "body": "Buy 0.1 EURUSD", "link": "/social/copy", "email": false, "data": {"subscriptionId": 3}}), "k1");
        assert_eq!(b["type"], "copy.trade_opened");
        assert_eq!(b["userId"], 7);
        assert_eq!(b["email"], false);
        assert_eq!(b["severity"], "info");
        assert_eq!(b["data"]["subscriptionId"], 3);
        assert_eq!(b["dedupeKey"], "k1");
        // email follows the preference unless explicitly off
        let b = notify_body("copy.protection_stop", 7, &json!({"title": "Stopped", "email": true}), "k2");
        assert!(b.get("email").is_none());
        assert!(b.get("link").is_none());
    }
}
