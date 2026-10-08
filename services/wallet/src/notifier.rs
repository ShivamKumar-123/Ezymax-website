//! Pushes wallet notifications to the support service (`POST $SUPPORT_URL/v1/notify`): the client's bell in
//! the Client Area and Ezymex Trader, the realtime stream and email per the client's `wallet` preference.
//!
//! `ops::notify` writes the row inside the money transaction (the outbox); this worker delivers it after the
//! commit, so a support outage never blocks or rolls back a deposit, withdrawal or transfer. Each row is
//! sent with `dedupeKey = wallet:n:<id>`, the same key support's polling adapter uses, so a retry (or the
//! adapter racing the worker) never shows or emails a notification twice. Failed pushes back off
//! (15 s doubling, capped at 1 h) and give up after `MAX_ATTEMPTS`; client errors (4xx) are not retried.

use std::time::Duration;

use serde_json::{Value, json};
use sqlx::Row;
use tokio::sync::Notify;

use crate::state::AppState;

/// Woken by `ops::notify`; the worker also runs every `IDLE_SECS`.
pub static WAKE: Notify = Notify::const_new();
pub const MAX_ATTEMPTS: i32 = 12;
const IDLE_SECS: u64 = 5;
const BATCH: i64 = 50;

/// Wallet notification kind → support type: `deposit.credited` → `wallet.deposit_credited`,
/// `wallet.credit` → `wallet.credit`.
pub fn support_type(kind: &str) -> String {
    let k = kind.replace('.', "_");
    if k.starts_with("wallet_") { k.replacen("wallet_", "wallet.", 1) } else { format!("wallet.{k}") }
}

pub fn severity(kind: &str) -> &'static str {
    if kind.contains("rejected") || kind.contains("failed") {
        "warning"
    } else if kind.contains("credited") || kind.contains("completed") || kind.contains("approved") || kind == "wallet.credit" || (kind.starts_with("adjustment.") && kind.ends_with("_in")) {
        "success"
    } else {
        "info"
    }
}

/// Client Area path the notification opens.
pub fn link(kind: &str) -> &'static str {
    if kind.starts_with("withdrawal") || kind.starts_with("deposit") || kind.starts_with("transfer") || kind.starts_with("adjustment.wallet") {
        "/wallet/history"
    } else if kind.starts_with("adjustment.") {
        // trading account balance / credit adjustments
        "/accounts"
    } else {
        "/wallet"
    }
}

pub fn dedupe_key(id: i64) -> String {
    format!("wallet:n:{id}")
}

/// Seconds to wait before the next attempt after `attempts` failures.
pub fn backoff_secs(attempts: i32) -> i64 {
    (15i64 << attempts.clamp(0, 12)).min(3600)
}

enum Outcome {
    Sent,
    Retry(String),
    GiveUp(String),
}

async fn send(st: &AppState, http: &reqwest::Client, tenant: &str, r: &sqlx::postgres::PgRow) -> Outcome {
    let (id, kind): (i64, String) = (r.get("id"), r.get("kind"));
    let data: sqlx::types::Json<Value> = r.get("data");
    let body = json!({
        "type": support_type(&kind),
        "userId": r.get::<i64, _>("user_id"),
        "title": r.get::<String, _>("title"),
        "body": r.get::<String, _>("body"),
        "severity": severity(&kind),
        "link": link(&kind),
        "data": data.0,
        "dedupeKey": dedupe_key(id),
    });
    let res = http
        .post(format!("{}/v1/notify", st.cfg.support_url))
        .header("x-ezymex-internal", &st.cfg.support_token)
        .header("x-ezymex-tenant", tenant)
        .header("x-ezymex-service", "wallet")
        .json(&body)
        .send()
        .await;
    match res {
        Ok(r) if r.status().is_success() => Outcome::Sent,
        Ok(r) if r.status().is_client_error() && r.status() != 408 && r.status() != 429 => Outcome::GiveUp(format!("HTTP {}", r.status())),
        Ok(r) => Outcome::Retry(format!("HTTP {}", r.status())),
        Err(e) => Outcome::Retry(if e.is_timeout() { "timeout".into() } else { "connection failed".into() }),
    }
}

/// One pass: sends due notifications. Returns (sent, failed).
pub async fn push_pending(st: &AppState, http: &reqwest::Client) -> anyhow::Result<(usize, usize)> {
    if st.cfg.support_url.is_empty() {
        return Ok((0, 0));
    }
    let rows = sqlx::query(
        "SELECT id, tenant_id, user_id, kind, title, body, data, push_attempts FROM notifications
          WHERE pushed_at IS NULL AND push_attempts < $1 AND (push_next_at IS NULL OR push_next_at <= now())
          ORDER BY id LIMIT $2",
    )
    .bind(MAX_ATTEMPTS)
    .bind(BATCH)
    .fetch_all(&st.pool)
    .await?;
    let (mut sent, mut failed) = (0, 0);
    for r in &rows {
        let id: i64 = r.get("id");
        let tenant_id: i64 = r.get("tenant_id");
        let tenant = match st.tenants.slug_of(tenant_id) {
            Some(s) => s,
            None => {
                let _ = st.tenants.reload(&st.pool).await;
                st.tenants.slug_of(tenant_id).unwrap_or_else(|| "ezymex".into())
            }
        };
        match send(st, http, &tenant, r).await {
            Outcome::Sent => {
                sqlx::query("UPDATE notifications SET pushed_at = now(), push_attempts = push_attempts + 1, push_error = NULL WHERE id = $1").bind(id).execute(&st.pool).await?;
                sent += 1;
            }
            Outcome::Retry(e) => {
                let attempts: i32 = r.get("push_attempts");
                sqlx::query("UPDATE notifications SET push_attempts = push_attempts + 1, push_error = $2, push_next_at = now() + make_interval(secs => $3) WHERE id = $1")
                    .bind(id)
                    .bind(&e)
                    .bind(backoff_secs(attempts) as f64)
                    .execute(&st.pool)
                    .await?;
                if attempts + 1 >= MAX_ATTEMPTS {
                    tracing::error!(notification = id, error = %e, "support notify gave up after retries");
                } else {
                    tracing::warn!(notification = id, error = %e, "support notify failed; will retry");
                }
                failed += 1;
                // support is down: leave the rest of the batch for the next pass
                break;
            }
            Outcome::GiveUp(e) => {
                sqlx::query("UPDATE notifications SET push_attempts = $2, push_error = $3 WHERE id = $1").bind(id).bind(MAX_ATTEMPTS).bind(&e).execute(&st.pool).await?;
                tracing::error!(notification = id, error = %e, "support notify refused the notification");
                failed += 1;
            }
        }
    }
    Ok((sent, failed))
}

/// Delivery loop (workers instance only): runs right after a wake-up (a short pause lets the writing
/// transaction commit) and every `IDLE_SECS`.
pub fn spawn(st: AppState) {
    if st.cfg.support_url.is_empty() {
        tracing::warn!("SUPPORT_URL is empty: wallet notifications stay in-app only");
        return;
    }
    tokio::spawn(async move {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().expect("http client");
        loop {
            match push_pending(&st, &http).await {
                Ok((sent, _)) if sent > 0 => tracing::info!(sent, "wallet notifications pushed to support"),
                Ok(_) => {}
                Err(e) => tracing::warn!(error = %e, "notification push pass failed"),
            }
            tokio::select! {
                _ = WAKE.notified() => tokio::time::sleep(Duration::from_millis(300)).await,
                _ = tokio::time::sleep(Duration::from_secs(IDLE_SECS)) => {}
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_kinds_like_the_support_adapter() {
        assert_eq!(support_type("deposit.credited"), "wallet.deposit_credited");
        assert_eq!(support_type("withdrawal.approved"), "wallet.withdrawal_approved");
        assert_eq!(support_type("withdrawal.completed"), "wallet.withdrawal_completed");
        assert_eq!(support_type("wallet.credit"), "wallet.credit");
        assert_eq!(severity("withdrawal.rejected"), "warning");
        assert_eq!(severity("deposit.credited"), "success");
        assert_eq!(severity("withdrawal.requested"), "info");
        assert_eq!(link("withdrawal.completed"), "/wallet/history");
        assert_eq!(dedupe_key(991), "wallet:n:991");
        // manual adjustments (Back Office "Balance & credit")
        assert_eq!(support_type("adjustment.wallet_in"), "wallet.adjustment_wallet_in");
        assert_eq!(link("adjustment.wallet_out"), "/wallet/history");
        assert_eq!(link("adjustment.credit_in"), "/accounts");
        assert_eq!(severity("adjustment.account_in"), "success");
        assert_eq!(severity("adjustment.wallet_out"), "info");
    }

    #[test]
    fn backs_off_to_an_hour() {
        assert_eq!(backoff_secs(0), 15);
        assert_eq!(backoff_secs(1), 30);
        assert_eq!(backoff_secs(20), 3600);
    }
}
