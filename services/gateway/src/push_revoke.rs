//! Phones of revoked sessions stop receiving pushes.
//!
//! The mobile app registers the phone's Expo push token with the support service (services/support src/push.rs)
//! for the signed-in client, together with the app's installation id: the `X-Kalks-Device` it sends here too. Each
//! session keeps a reference to that installation, `sessions.device_ref` ([`device_ref`]: hex SHA-256 of
//! `kalks-push-device:<id>`; the id itself is never stored, devices are recognised by a keyed hash). When sessions
//! are revoked, the phones concerned are queued in `push_revocations` and [`deliver`] tells the support service
//! (`POST /v1/push/tokens/revoke`), retrying with backoff until it confirms:
//!
//! - some sessions ended ([`sessions_ended`]: one session or "sign out other devices" on the security page, a
//!   password change that signs the others out, a staff member revoking one session): the phones of those sessions
//!   that no live session of the client still uses;
//! - the client is signed out everywhere ([`client_signed_out`]: password reset, a sign-in block, account closure,
//!   staff "sign out everywhere", a Google link that restarts an unverified account): every phone of the client;
//! - the Platform Owner suspended the broker ([`tenant_signed_out`]): every phone of its clients.
//!
//! The support service removes only registrations older than the revocation, so a phone that signs in again (and
//! registers again) keeps its new one. View-only logins and staff sessions are left out: they never register a
//! phone. Queueing never fails a revocation (an error is logged). Signing out on the phone itself is handled by the
//! app, which removes its own registration (`/api/mobile/push/unregister`).

use sha2::{Digest, Sha256};
use sqlx::Row;
use std::time::Duration;

use crate::state::AppState;

/// Deliveries tried before a revocation is given up (15 s doubling, at most an hour apart: about a day).
pub const MAX_ATTEMPTS: i32 = 30;

/// `sessions.device_ref` of an installation id: hex SHA-256 of `kalks-push-device:<id>`, the reference the support
/// service matches against the installation id each phone registered with.
pub fn device_ref(device: &str) -> String {
    Sha256::digest(format!("kalks-push-device:{device}").as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

/// Seconds before try `attempts + 1`: 15, 30, 60 … at most an hour.
pub fn backoff_secs(attempts: i32) -> i64 {
    (15i64 << attempts.clamp(0, 12)).min(3600)
}

/// Sessions of client `user_id` ended (`refs`: their `device_ref`s, the client's own sessions only): queues the
/// phones no live session of the client still uses. Call it after the revocation has committed (a failed insert
/// inside the revoking transaction would abort it).
pub async fn sessions_ended<'e, E: sqlx::PgExecutor<'e>>(ex: E, tenant_id: i64, user_id: i64, refs: &[String]) {
    if refs.is_empty() {
        return;
    }
    let r = sqlx::query(
        "INSERT INTO push_revocations (tenant_id, user_id, devices)
         SELECT $1, $2, array_agg(DISTINCT d ORDER BY d) FROM unnest($3::text[]) AS d
         WHERE NOT EXISTS (SELECT 1 FROM sessions s
                            WHERE s.subject_kind = 'user' AND s.subject_id = $2 AND s.device_ref = d AND s.revoked_at IS NULL
                              AND s.expires_at > now() AND s.viewer_id IS NULL AND s.impersonator_id IS NULL)
         HAVING count(*) > 0",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(refs)
    .execute(ex)
    .await;
    if let Err(e) = r {
        tracing::error!(error = %e, user_id, "push revocation not queued: the phones of the revoked sessions keep their pushes");
    }
}

/// Every session of client `user_id` ended: queues every phone of the client.
pub async fn client_signed_out<'e, E: sqlx::PgExecutor<'e>>(ex: E, tenant_id: i64, user_id: i64) {
    let r = sqlx::query("INSERT INTO push_revocations (tenant_id, user_id, all_devices) VALUES ($1, $2, TRUE)").bind(tenant_id).bind(user_id).execute(ex).await;
    if let Err(e) = r {
        tracing::error!(error = %e, user_id, "push revocation not queued: the client's phones keep their pushes");
    }
}

/// Every session of the broker ended (suspended): queues every phone of its clients.
pub async fn tenant_signed_out<'e, E: sqlx::PgExecutor<'e>>(ex: E, tenant_id: i64) {
    let r = sqlx::query("INSERT INTO push_revocations (tenant_id, all_devices) VALUES ($1, TRUE)").bind(tenant_id).execute(ex).await;
    if let Err(e) = r {
        tracing::error!(error = %e, tenant_id, "push revocation not queued: the broker's phones keep their pushes");
    }
}

/// HTTP client for the support service (loopback).
pub fn http() -> reqwest::Client {
    reqwest::Client::builder().timeout(Duration::from_secs(10)).connect_timeout(Duration::from_secs(3)).build().expect("http client")
}

/// Sends due revocations to the support service. Returns (delivered, not delivered).
pub async fn deliver(st: &AppState, http: &reqwest::Client) -> anyhow::Result<(usize, usize)> {
    if st.cfg.support_url.is_empty() {
        return Ok((0, 0));
    }
    // leased for a minute, so an overlapping run (a restart) can't send the same rows at once
    let rows = sqlx::query(
        "UPDATE push_revocations p SET next_attempt_at = now() + interval '60 seconds' FROM tenants t
          WHERE t.id = p.tenant_id AND p.id IN (SELECT id FROM push_revocations WHERE delivered_at IS NULL AND attempts < $1 AND next_attempt_at <= now()
                                                ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED)
          RETURNING p.id, t.slug, p.user_id, p.devices, p.all_devices, p.revoked_at, p.attempts",
    )
    .bind(MAX_ATTEMPTS)
    .fetch_all(&st.pool)
    .await?;
    let (mut sent, mut failed) = (0, 0);
    for r in &rows {
        let id: i64 = r.get("id");
        let slug: String = r.get("slug");
        let body = serde_json::json!({
            "tenant": slug,
            "userId": r.get::<Option<i64>, _>("user_id"),
            "devices": r.get::<Vec<String>, _>("devices"),
            "all": r.get::<bool, _>("all_devices"),
            "before": r.get::<chrono::DateTime<chrono::Utc>, _>("revoked_at").to_rfc3339(),
        });
        let res = http
            .post(format!("{}/v1/push/tokens/revoke", st.cfg.support_url))
            .header("x-kalks-internal", &st.cfg.support_token)
            .header("x-kalks-tenant", &slug)
            .header("x-kalks-service", "gateway")
            .json(&body)
            .send()
            .await;
        let attempts: i32 = r.get("attempts");
        let error = match res {
            Ok(x) if x.status().is_success() => None,
            // refused as a whole (a bad request, a wrong token): an operator has to look, retrying won't help
            Ok(x) if x.status().is_client_error() && x.status() != 408 && x.status() != 429 => {
                tracing::error!(id, status = %x.status(), "the support service refused a push revocation");
                sqlx::query("UPDATE push_revocations SET attempts = $2, last_error = $3 WHERE id = $1").bind(id).bind(MAX_ATTEMPTS).bind(format!("HTTP {}", x.status())).execute(&st.pool).await?;
                failed += 1;
                continue;
            }
            Ok(x) => Some(format!("HTTP {}", x.status())),
            Err(e) => Some(if e.is_timeout() { "timeout".to_string() } else { "connection failed".to_string() }),
        };
        match error {
            None => {
                sqlx::query("UPDATE push_revocations SET delivered_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1").bind(id).execute(&st.pool).await?;
                sent += 1;
            }
            Some(e) => {
                if attempts + 1 >= MAX_ATTEMPTS {
                    tracing::error!(id, error = %e, "push revocation given up: the phones keep their pushes");
                } else {
                    tracing::warn!(id, error = %e, "push revocation not delivered; will retry");
                }
                sqlx::query("UPDATE push_revocations SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + make_interval(secs => $3) WHERE id = $1")
                    .bind(id)
                    .bind(&e)
                    .bind(backoff_secs(attempts) as f64)
                    .execute(&st.pool)
                    .await?;
                failed += 1;
                // the service is down: the rest waits for the next run
                break;
            }
        }
    }
    Ok((sent, failed))
}

/// Housekeeping: delivered or abandoned revocations go after 30 days.
pub async fn sweep(pool: &sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM push_revocations WHERE created_at < now() - interval '30 days' AND (delivered_at IS NOT NULL OR attempts >= $1)").bind(MAX_ATTEMPTS).execute(pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests;
