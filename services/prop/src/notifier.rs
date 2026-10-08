//! Pushes prop notifications to the support service (`POST $SUPPORT_URL/v1/notify`): the trader's bell in
//! the Client Area and Ezymex Trader, the realtime stream and email per the `prop` preference.
//!
//! `store::notify` writes the prop inbox row (the outbox); this worker delivers it afterwards, so a support
//! outage never delays the rule evaluator or a payout. `dedupeKey = prop:n:<id>` makes retries safe.
//! Failed pushes back off (15 s doubling, capped at 1 h) and give up after `MAX_ATTEMPTS`; 4xx answers are
//! not retried.

use std::time::Duration;

use serde_json::json;
use sqlx::Row;
use tokio::sync::Notify;

use crate::ops::App;

/// Woken by `store::notify`; the worker also runs every `IDLE_SECS`.
pub static WAKE: Notify = Notify::const_new();
pub const MAX_ATTEMPTS: i32 = 12;
const IDLE_SECS: u64 = 5;
const BATCH: i64 = 50;

/// Prop inbox kind → (support type, severity, Client Area link).
pub fn map(kind: &str) -> (String, &'static str, &'static str) {
    const CHALLENGES: &str = "/prop/mine";
    const PAYOUTS: &str = "/prop/payouts";
    match kind {
        "passed" => ("prop.passed".into(), "success", CHALLENGES),
        "breach" => ("prop.failed".into(), "critical", CHALLENGES),
        "funded" => ("prop.funded".into(), "success", CHALLENGES),
        "phase_started" => ("prop.phase_started".into(), "info", CHALLENGES),
        "scaled" => ("prop.scaled".into(), "success", CHALLENGES),
        "warning" => ("prop.loss_warning".into(), "warning", CHALLENGES),
        "violation" => ("prop.violation".into(), "warning", CHALLENGES),
        "payout_requested" => ("prop.payout_requested".into(), "info", PAYOUTS),
        "payout_paid" => ("prop.payout_paid".into(), "success", PAYOUTS),
        "payout_rejected" => ("prop.payout_rejected".into(), "warning", PAYOUTS),
        other => {
            let ev: String = other.chars().map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '_' }).take(48).collect();
            (format!("prop.{}", if ev.is_empty() { "update" } else { &ev }), "info", CHALLENGES)
        }
    }
}

pub fn dedupe_key(id: i64) -> String {
    format!("prop:n:{id}")
}

pub fn backoff_secs(attempts: i32) -> i64 {
    (15i64 << attempts.clamp(0, 12)).min(3600)
}

/// One pass: sends due notifications. Returns (sent, failed).
pub async fn push_pending(app: &App, http: &reqwest::Client) -> anyhow::Result<(usize, usize)> {
    if app.cfg.support_url.is_empty() {
        return Ok((0, 0));
    }
    let rows = sqlx::query(
        "SELECT id, tenant, user_id, challenge_id, kind, title, body, push_attempts FROM notifications
          WHERE pushed_at IS NULL AND push_attempts < $1 AND (push_next_at IS NULL OR push_next_at <= now())
          ORDER BY id LIMIT $2",
    )
    .bind(MAX_ATTEMPTS)
    .bind(BATCH)
    .fetch_all(&app.pool)
    .await?;
    let (mut sent, mut failed) = (0, 0);
    for r in &rows {
        let id: i64 = r.get("id");
        let kind: String = r.get("kind");
        let (ty, severity, link) = map(&kind);
        let tenant: String = r.get("tenant");
        let body = json!({
            "type": ty,
            "userId": r.get::<i64, _>("user_id"),
            "title": r.get::<String, _>("title"),
            "body": r.get::<String, _>("body"),
            "severity": severity,
            "link": link,
            "data": {"challengeId": r.get::<Option<i64>, _>("challenge_id"), "kind": kind},
            "dedupeKey": dedupe_key(id),
        });
        let res = http
            .post(format!("{}/v1/notify", app.cfg.support_url))
            .header("x-ezymex-internal", &app.cfg.support_token)
            .header("x-ezymex-tenant", &tenant)
            .header("x-ezymex-service", "prop")
            .json(&body)
            .send()
            .await;
        let err = match res {
            Ok(r) if r.status().is_success() => None,
            Ok(r) if r.status().is_client_error() && r.status() != 408 && r.status() != 429 => {
                sqlx::query("UPDATE notifications SET push_attempts = $2, push_error = $3 WHERE id = $1").bind(id).bind(MAX_ATTEMPTS).bind(format!("HTTP {}", r.status())).execute(&app.pool).await?;
                tracing::error!(notification = id, status = %r.status(), "support notify refused the notification");
                failed += 1;
                continue;
            }
            Ok(r) => Some(format!("HTTP {}", r.status())),
            Err(e) => Some(if e.is_timeout() { "timeout".to_string() } else { "connection failed".to_string() }),
        };
        match err {
            None => {
                sqlx::query("UPDATE notifications SET pushed_at = now(), push_attempts = push_attempts + 1, push_error = NULL WHERE id = $1").bind(id).execute(&app.pool).await?;
                sent += 1;
            }
            Some(e) => {
                let attempts: i32 = r.get("push_attempts");
                sqlx::query("UPDATE notifications SET push_attempts = push_attempts + 1, push_error = $2, push_next_at = now() + make_interval(secs => $3) WHERE id = $1")
                    .bind(id)
                    .bind(&e)
                    .bind(backoff_secs(attempts) as f64)
                    .execute(&app.pool)
                    .await?;
                tracing::warn!(notification = id, error = %e, "support notify failed; will retry");
                failed += 1;
                break;
            }
        }
    }
    Ok((sent, failed))
}

/// Delivery loop: right after a wake-up and every `IDLE_SECS`.
pub fn spawn(app: App) {
    if app.cfg.support_url.is_empty() {
        tracing::warn!("SUPPORT_URL is empty: prop notifications stay in the prop inbox only");
        return;
    }
    tokio::spawn(async move {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().expect("http client");
        loop {
            match push_pending(&app, &http).await {
                Ok((sent, _)) if sent > 0 => tracing::info!(sent, "prop notifications pushed to support"),
                Ok(_) => {}
                Err(e) => tracing::warn!(error = %e, "notification push pass failed"),
            }
            tokio::select! {
                _ = WAKE.notified() => tokio::time::sleep(Duration::from_millis(200)).await,
                _ = tokio::time::sleep(Duration::from_secs(IDLE_SECS)) => {}
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_prop_kinds() {
        assert_eq!(map("breach"), ("prop.failed".to_string(), "critical", "/prop/mine"));
        assert_eq!(map("payout_paid").0, "prop.payout_paid");
        assert_eq!(map("payout_rejected").2, "/prop/payouts");
        assert_eq!(map("Odd Kind").0, "prop.odd_kind");
        assert_eq!(dedupe_key(4), "prop:n:4");
    }
}
