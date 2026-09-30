//! Mobile push notifications through the Expo push service
//! (<https://docs.expo.dev/push-notifications/sending-notifications/>).
//!
//! - **Registry.** The app registers its Expo push token for the signed-in client (`POST /v1/push/tokens`, through
//!   the Client Area BFF `/api/mobile/push/register`) and deletes it when the client signs out on that phone. One row
//!   per phone; a sign-in by someone else on the same phone moves the row to them.
//! - **Queue.** `notify::deliver` calls [`enqueue`] for every in-app notification of a client whose push preference
//!   for the category is on (`prefs[category].push`, default on except News and offers): one `push_outbox` row per
//!   registered phone.
//! - **Sender** ([`flush`], run by `workers.rs`). Due rows go out in batches of 100 (Expo's limit) to
//!   `POST <base>/send`. Per ticket: `ok` keeps the ticket id for the receipt check; `DeviceNotRegistered` drops the
//!   phone's token; `MessageRateExceeded`, HTTP 429 / 5xx / 401 and network errors retry with exponential backoff
//!   (15 s doubling, at most 30 min, [`MAX_ATTEMPTS`] tries); any other error fails the message. A batch the service
//!   refuses as a whole (400 / 413) is sent again one message at a time, so one bad message can't block the others.
//! - **Receipts** ([`receipts`]). `POST <base>/getReceipts` for tickets older than `push_receipt_delay_secs`
//!   (15 min), 1000 ids per call: `DeviceNotRegistered` drops the token, `MessageRateExceeded` sends again later.
//! - **Clean-up** ([`sweep`]). Messages still pending after a day fail, finished rows go after 7 days, phones not
//!   seen for [`STALE_DAYS`] days are removed.
//! - **Revoked sessions** ([`revoke`]). When the gateway revokes sessions (sign out other devices or one session,
//!   password change or reset, staff revoke, block, closure, a suspended broker) it names the phones that lost
//!   their session by [`device_ref`], or all of a client's (or the broker's) phones: their rows go, with any push
//!   still queued for them.
//!
//! Behind `SUPPORT_PUSH_ENABLED` (default on in production). The text is the notification's title and body,
//! shortened to fit the 4 KB payload; `data` carries the notification id, type, app link and the client id, so the
//! app opens the right screen and ignores a push meant for someone who has since signed out on that phone.

use crate::notify::Item;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::time::Duration;

/// Messages per `send` request (Expo's limit).
pub const BATCH: usize = 100;
/// Ticket ids per `getReceipts` request (Expo's limit).
pub const RECEIPT_BATCH: usize = 1000;
/// Tries before a message is given up.
pub const MAX_ATTEMPTS: i32 = 8;
/// Phones one client keeps registered (the least recently seen go first).
pub const MAX_DEVICES: i64 = 10;
/// Phones not seen for this many days get no pushes and are removed.
pub const STALE_DAYS: i32 = 90;

/// An Expo push token: `ExponentPushToken[…]` (or the newer `ExpoPushToken[…]`).
pub fn valid_token(t: &str) -> bool {
    let inner = t.strip_prefix("ExponentPushToken[").or_else(|| t.strip_prefix("ExpoPushToken[")).and_then(|r| r.strip_suffix(']'));
    matches!(inner, Some(i) if (8..=256).contains(&i.len()) && i.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'))
}

/// The app's installation id (`X-Kalks-Device`): base64url, 16 to 64 characters.
pub fn valid_device(d: &str) -> bool {
    (16..=64).contains(&d.len()) && d.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// The reference to a phone's installation id that the gateway keeps on each session (`sessions.device_ref`): hex
/// SHA-256 of `kalks-push-device:<id>`. The gateway never stores the id itself (it recognises devices by a keyed
/// hash); with this reference it can name the phones whose sessions it revoked ([`revoke`]).
pub fn device_ref(device_id: &str) -> String {
    Sha256::digest(format!("kalks-push-device:{device_id}").as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

/// A `device_ref`: 64 lowercase hex digits.
pub fn valid_device_ref(r: &str) -> bool {
    r.len() == 64 && r.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// Seconds to wait after failure number `attempts` (1-based): 15, 30, 60 … at most 30 minutes.
pub fn backoff_secs(attempts: i32) -> i64 {
    (15i64 << (attempts - 1).clamp(0, 16)).min(1800)
}

/// Android notification channel for a preference category (the app creates these channels).
pub fn channel(category: &str) -> &'static str {
    match category {
        "security" | "trading_alerts" | "price_alerts" => "alerts",
        "marketing" => "news",
        _ => "activity",
    }
}

fn shorten(s: &str, max: usize) -> String {
    let s = s.trim();
    if s.chars().count() <= max {
        return s.to_string();
    }
    let cut: String = s.chars().take(max.saturating_sub(1)).collect();
    format!("{}…", cut.trim_end())
}

/// The Expo message for one notification (everything but `to`).
pub fn message(user_id: i64, item: &Item, unread: i64) -> Value {
    let marketing = item.category == "marketing";
    let mut m = json!({
        "title": shorten(&item.title, 120),
        "data": {"id": item.id, "type": item.kind, "link": item.link, "uid": user_id},
        "sound": "default",
        "badge": unread.max(0),
        "channelId": channel(item.category),
        "priority": if marketing { "normal" } else { "high" },
        "ttl": if marketing { 3 * 86_400 } else { 86_400 },
    });
    let body = shorten(&item.body, 600);
    if !body.is_empty() {
        m["body"] = Value::String(body);
    }
    m
}

/// What to do with a message after the push service answered for it.
#[derive(Debug, PartialEq)]
pub enum Outcome {
    /// Accepted (ticket id kept for the receipt check).
    Accepted(String),
    /// Delivered to Apple / Google (receipt).
    Delivered,
    /// The phone uninstalled the app or turned the token off: remove the token.
    DropToken(String),
    /// Temporary: send again after the backoff.
    Retry(String),
    /// Permanent: give up on this message.
    Fail(String),
}

fn error_code(v: &Value) -> &str {
    v["details"]["error"].as_str().unwrap_or("")
}

fn error_outcome(v: &Value) -> Outcome {
    let code = error_code(v);
    let msg: String = v["message"].as_str().unwrap_or("push refused").chars().take(300).collect();
    let text = if code.is_empty() { msg } else { format!("{code}: {msg}") };
    match code {
        "DeviceNotRegistered" => Outcome::DropToken(text),
        "MessageRateExceeded" => Outcome::Retry(text),
        _ => Outcome::Fail(text),
    }
}

/// A push ticket (`POST /send` answer, one per message, in order).
pub fn classify_ticket(t: &Value) -> Outcome {
    match t["status"].as_str() {
        Some("ok") => match t["id"].as_str().filter(|id| !id.is_empty()) {
            Some(id) => Outcome::Accepted(id.to_string()),
            None => Outcome::Fail("ticket without an id".into()),
        },
        _ => error_outcome(t),
    }
}

/// A push receipt (`POST /getReceipts` answer, per ticket id).
pub fn classify_receipt(r: &Value) -> Outcome {
    match r["status"].as_str() {
        Some("ok") => Outcome::Delivered,
        _ => error_outcome(r),
    }
}

/* ---------------- registry ---------------- */

/// A phone as the app registers it.
pub struct Device<'a> {
    pub token: &'a str,
    pub device_id: &'a str,
    pub platform: &'a str,
    pub locale: &'a str,
    pub app_version: &'a str,
}

/// Registers (or refreshes) a phone for `user_id`. The token moves to this client if someone else had it, and
/// pushes still queued for the previous owner are dropped, never delivered to the new one.
pub async fn register(st: &AppState, tenant: &str, user_id: i64, d: &Device<'_>) -> anyhow::Result<()> {
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "INSERT INTO push_tokens (tenant, user_id, token, device_id, platform, locale, app_version) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant, token) DO UPDATE SET
           created_at = CASE WHEN push_tokens.user_id = EXCLUDED.user_id THEN push_tokens.created_at ELSE now() END,
           user_id = EXCLUDED.user_id, device_id = EXCLUDED.device_id, platform = EXCLUDED.platform,
           locale = EXCLUDED.locale, app_version = EXCLUDED.app_version, last_seen_at = now()",
    )
    .bind(tenant)
    .bind(user_id)
    .bind(d.token)
    .bind(d.device_id)
    .bind(d.platform)
    .bind(d.locale)
    .bind(d.app_version)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE push_outbox SET status = 'dropped', last_error = 'the phone changed hands' WHERE tenant = $1 AND token = $2 AND status = 'pending' AND user_id <> $3")
        .bind(tenant)
        .bind(d.token)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    // the same phone under an older token (reinstall, token rotation): keep only the current one
    sqlx::query("DELETE FROM push_tokens WHERE tenant = $1 AND device_id = $2 AND token <> $3").bind(tenant).bind(d.device_id).bind(d.token).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM push_tokens WHERE id IN (SELECT id FROM push_tokens WHERE tenant = $1 AND user_id = $2 ORDER BY last_seen_at DESC, id DESC OFFSET $3)")
        .bind(tenant)
        .bind(user_id)
        .bind(MAX_DEVICES)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

async fn drop_pending(st: &AppState, tenant: &str, token: &str, why: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE push_outbox SET status = 'dropped', last_error = $3 WHERE tenant = $1 AND token = $2 AND status = 'pending'")
        .bind(tenant)
        .bind(token)
        .bind(why)
        .execute(&st.pool)
        .await?;
    Ok(())
}

/// Signed-out on the phone (the client's own session): removes their row for `token`.
pub async fn unregister(st: &AppState, tenant: &str, user_id: i64, token: &str) -> anyhow::Result<u64> {
    let n = sqlx::query("DELETE FROM push_tokens WHERE tenant = $1 AND user_id = $2 AND token = $3").bind(tenant).bind(user_id).bind(token).execute(&st.pool).await?.rows_affected();
    if n > 0 {
        drop_pending(st, tenant, token, "signed out on the phone").await?;
    }
    Ok(n)
}

/// The session already ended (expired or revoked elsewhere): the phone proves it is the one that registered by
/// sending both its push token and its installation id.
pub async fn forget(st: &AppState, token: &str, device_id: &str) -> anyhow::Result<u64> {
    let rows = sqlx::query("DELETE FROM push_tokens WHERE token = $1 AND device_id = $2 RETURNING tenant").bind(token).bind(device_id).fetch_all(&st.pool).await?;
    for r in &rows {
        drop_pending(st, &r.get::<String, _>("tenant"), token, "signed out on the phone").await?;
    }
    Ok(rows.len() as u64)
}

/// Whose phones a session revocation removes ([`revoke`]).
#[derive(Debug, Clone, Copy)]
pub enum Revoked<'a> {
    /// Every phone of the broker's clients (the broker was suspended: every session ended).
    Tenant,
    /// Every phone of one client (signed out everywhere: blocked, password reset, closure, staff "sign out all").
    User(i64),
    /// The phones of one client whose sessions ended and that have no other live session, by [`device_ref`].
    Devices(i64, &'a [String]),
}

/// The gateway revoked sessions: those phones stop receiving pushes (their rows go, with any push still queued for
/// them). Only registrations older than the revocation (`before`, the gateway's time of it) are removed, so a phone
/// that signed in again since keeps its new one. Returns how many phones were removed.
pub async fn revoke(st: &AppState, tenant: &str, who: Revoked<'_>, before: DateTime<Utc>) -> anyhow::Result<u64> {
    let removed: Vec<String> = match who {
        Revoked::Tenant => sqlx::query_scalar("DELETE FROM push_tokens WHERE tenant = $1 AND last_seen_at <= $2 RETURNING token").bind(tenant).bind(before).fetch_all(&st.pool).await?,
        Revoked::User(user) => {
            sqlx::query_scalar("DELETE FROM push_tokens WHERE tenant = $1 AND user_id = $2 AND last_seen_at <= $3 RETURNING token").bind(tenant).bind(user).bind(before).fetch_all(&st.pool).await?
        }
        Revoked::Devices(user, refs) => {
            // a client has at most MAX_DEVICES phones: match their installation ids here
            let phones: Vec<(i64, String)> = sqlx::query_as("SELECT id, device_id FROM push_tokens WHERE tenant = $1 AND user_id = $2 AND last_seen_at <= $3").bind(tenant).bind(user).bind(before).fetch_all(&st.pool).await?;
            let ids: Vec<i64> = phones.iter().filter(|(_, d)| refs.contains(&device_ref(d))).map(|(id, _)| *id).collect();
            if ids.is_empty() {
                vec![]
            } else {
                sqlx::query_scalar("DELETE FROM push_tokens WHERE id = ANY($1) AND user_id = $2 AND last_seen_at <= $3 RETURNING token").bind(&ids).bind(user).bind(before).fetch_all(&st.pool).await?
            }
        }
    };
    for token in &removed {
        drop_pending(st, tenant, token, "signed out: the session was revoked").await?;
    }
    if !removed.is_empty() {
        tracing::info!(%tenant, phones = removed.len(), "push registrations removed: sessions revoked");
    }
    Ok(removed.len() as u64)
}

/// Queues `item` for every phone of `user_id` seen in the last [`STALE_DAYS`] days. Returns how many.
pub async fn enqueue(st: &AppState, tenant: &str, user_id: i64, item: &Item, unread: i64) -> anyhow::Result<u64> {
    let msg = message(user_id, item, unread);
    let r = sqlx::query(
        "INSERT INTO push_outbox (tenant, notification_id, user_id, token, message)
         SELECT tenant, $3, user_id, token, $4 FROM push_tokens
         WHERE tenant = $1 AND user_id = $2 AND last_seen_at > now() - make_interval(days => $5)",
    )
    .bind(tenant)
    .bind(user_id)
    .bind(item.id)
    .bind(sqlx::types::Json(&msg))
    .bind(STALE_DAYS)
    .execute(&st.pool)
    .await?;
    Ok(r.rows_affected())
}

/* ---------------- sender ---------------- */

struct Pending {
    id: i64,
    tenant: String,
    token: String,
    message: Value,
    attempts: i32,
}

enum Sent {
    Tickets(Vec<Value>),
    Retry(String),
    Refused(String),
}

fn errors_text(v: &Value) -> String {
    let text = v["errors"].as_array().map(|a| a.iter().map(|e| format!("{} {}", e["code"].as_str().unwrap_or(""), e["message"].as_str().unwrap_or(""))).collect::<Vec<_>>().join("; ")).unwrap_or_default();
    text.trim().chars().take(300).collect()
}

async fn post(st: &AppState, path: &str, body: &Value) -> Result<(u16, Value), String> {
    let mut rb = st.http.post(format!("{}/{path}", st.cfg.expo_push_url)).header("accept", "application/json").json(body).timeout(Duration::from_secs(20));
    if !st.cfg.expo_access_token.is_empty() {
        rb = rb.bearer_auth(&st.cfg.expo_access_token);
    }
    let r = rb.send().await.map_err(|e| format!("push service unreachable: {e}"))?;
    let status = r.status().as_u16();
    Ok((status, r.json::<Value>().await.unwrap_or(Value::Null)))
}

async fn send(st: &AppState, batch: &[Pending]) -> Sent {
    let body: Vec<Value> = batch
        .iter()
        .map(|p| {
            let mut m = p.message.clone();
            m["to"] = Value::String(p.token.clone());
            m
        })
        .collect();
    match post(st, "send", &Value::Array(body)).await {
        Err(e) => Sent::Retry(e),
        Ok((status, v)) if (200..300).contains(&status) => match v["data"].as_array() {
            Some(a) => Sent::Tickets(a.clone()),
            None => Sent::Retry(format!("unexpected answer: {}", errors_text(&v))),
        },
        // rate limit, outage, or credentials (a configuration problem an operator can fix): try again later
        Ok((status, v)) if status == 429 || status >= 500 || status == 401 || status == 403 => {
            if status == 401 || status == 403 {
                tracing::error!(status, error = %errors_text(&v), "push service refused our credentials (SUPPORT_EXPO_ACCESS_TOKEN)");
            }
            Sent::Retry(format!("HTTP {status}: {}", errors_text(&v)))
        }
        Ok((status, v)) => Sent::Refused(format!("HTTP {status}: {}", errors_text(&v))),
    }
}

async fn drop_token(st: &AppState, tenant: &str, token: &str, why: &str) -> anyhow::Result<()> {
    let n = sqlx::query("DELETE FROM push_tokens WHERE tenant = $1 AND token = $2").bind(tenant).bind(token).execute(&st.pool).await?.rows_affected();
    drop_pending(st, tenant, token, why).await?;
    if n > 0 {
        tracing::info!(%tenant, "push token removed: the phone is no longer registered");
    }
    Ok(())
}

async fn retry(st: &AppState, id: i64, attempts: i32, err: &str) -> anyhow::Result<()> {
    let n = attempts + 1;
    if n >= MAX_ATTEMPTS {
        sqlx::query("UPDATE push_outbox SET status = 'failed', attempts = $2, last_error = $3 WHERE id = $1").bind(id).bind(n).bind(err).execute(&st.pool).await?;
        tracing::warn!(id, attempts = n, error = %err, "push given up");
    } else {
        sqlx::query("UPDATE push_outbox SET status = 'pending', attempts = $2, last_error = $3, next_attempt_at = now() + make_interval(secs => $4) WHERE id = $1")
            .bind(id)
            .bind(n)
            .bind(err)
            .bind(backoff_secs(n) as f64)
            .execute(&st.pool)
            .await?;
    }
    Ok(())
}

async fn settle(st: &AppState, p: &Pending, o: Outcome) -> anyhow::Result<()> {
    match o {
        Outcome::Accepted(ticket) => {
            sqlx::query("UPDATE push_outbox SET status = 'sent', attempts = attempts + 1, ticket_id = $2, sent_at = now(), last_error = NULL WHERE id = $1").bind(p.id).bind(ticket).execute(&st.pool).await?;
        }
        Outcome::Delivered => {
            sqlx::query("UPDATE push_outbox SET status = 'sent', attempts = attempts + 1, sent_at = now(), receipt = 'ok' WHERE id = $1").bind(p.id).execute(&st.pool).await?;
        }
        Outcome::DropToken(e) => {
            drop_token(st, &p.tenant, &p.token, &e).await?;
            sqlx::query("UPDATE push_outbox SET status = 'dropped', attempts = attempts + 1, last_error = $2 WHERE id = $1").bind(p.id).bind(e).execute(&st.pool).await?;
        }
        Outcome::Retry(e) => retry(st, p.id, p.attempts, &e).await?,
        Outcome::Fail(e) => {
            tracing::warn!(id = p.id, error = %e, "push refused");
            sqlx::query("UPDATE push_outbox SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1").bind(p.id).bind(e).execute(&st.pool).await?;
        }
    }
    Ok(())
}

/// Sends one batch of due messages. Returns how many were handled (0 = nothing due).
pub async fn flush(st: &AppState) -> anyhow::Result<usize> {
    // lease the batch for two minutes, so an overlapping sender (e.g. during a restart) can't take the same rows
    let rows = sqlx::query(
        "UPDATE push_outbox SET next_attempt_at = now() + interval '120 seconds'
         WHERE id IN (SELECT id FROM push_outbox WHERE status = 'pending' AND next_attempt_at <= now() ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
         RETURNING id, tenant, token, message, attempts",
    )
    .bind(BATCH as i64)
    .fetch_all(&st.pool)
    .await?;
    let mut batch: Vec<Pending> = rows
        .iter()
        .map(|r| Pending { id: r.get("id"), tenant: r.get("tenant"), token: r.get("token"), message: r.get::<sqlx::types::Json<Value>, _>("message").0, attempts: r.get("attempts") })
        .collect();
    if batch.is_empty() {
        return Ok(0);
    }
    batch.sort_by_key(|p| p.id);
    match send(st, &batch).await {
        Sent::Tickets(t) if t.len() == batch.len() => {
            for (p, ticket) in batch.iter().zip(&t) {
                settle(st, p, classify_ticket(ticket)).await?;
            }
        }
        Sent::Tickets(t) => {
            let e = format!("{} tickets for {} messages", t.len(), batch.len());
            for p in &batch {
                settle(st, p, Outcome::Retry(e.clone())).await?;
            }
        }
        Sent::Retry(e) => {
            tracing::warn!(messages = batch.len(), error = %e, "push batch will be retried");
            for p in &batch {
                settle(st, p, Outcome::Retry(e.clone())).await?;
            }
        }
        // one bad message (or tokens of different Expo projects) refuses the whole request: one at a time
        Sent::Refused(_) if batch.len() > 1 => {
            for p in &batch {
                let o = match send(st, std::slice::from_ref(p)).await {
                    Sent::Tickets(t) if t.len() == 1 => classify_ticket(&t[0]),
                    Sent::Tickets(_) => Outcome::Retry("no ticket for the message".into()),
                    Sent::Retry(e) => Outcome::Retry(e),
                    Sent::Refused(e) => Outcome::Fail(e),
                };
                settle(st, p, o).await?;
            }
        }
        Sent::Refused(e) => settle(st, &batch[0], Outcome::Fail(e)).await?,
    }
    Ok(batch.len())
}

/// Checks the delivery receipts of messages sent at least `push_receipt_delay_secs` ago. Returns how many
/// tickets were asked about.
pub async fn receipts(st: &AppState) -> anyhow::Result<usize> {
    let rows = sqlx::query(
        "SELECT id, tenant, token, ticket_id, attempts, sent_at < now() - interval '24 hours' AS old FROM push_outbox
         WHERE status = 'sent' AND receipt IS NULL AND ticket_id IS NOT NULL AND sent_at <= now() - make_interval(secs => $1)
         ORDER BY sent_at LIMIT $2",
    )
    .bind(st.cfg.push_receipt_delay_secs as f64)
    .bind(RECEIPT_BATCH as i64)
    .fetch_all(&st.pool)
    .await?;
    if rows.is_empty() {
        return Ok(0);
    }
    let ids: Vec<String> = rows.iter().map(|r| r.get::<String, _>("ticket_id")).collect();
    let (status, v) = post(st, "getReceipts", &json!({ "ids": ids })).await.map_err(anyhow::Error::msg)?;
    if !(200..300).contains(&status) {
        anyhow::bail!("push receipts: HTTP {status} {}", errors_text(&v));
    }
    for r in &rows {
        let id: i64 = r.get("id");
        let ticket: String = r.get("ticket_id");
        let receipt = &v["data"][ticket.as_str()];
        if receipt.is_null() {
            // not ready yet; Expo keeps receipts for 24 hours
            if r.get::<bool, _>("old") {
                sqlx::query("UPDATE push_outbox SET receipt = 'expired' WHERE id = $1").bind(id).execute(&st.pool).await?;
            }
            continue;
        }
        match classify_receipt(receipt) {
            Outcome::Delivered | Outcome::Accepted(_) => {
                sqlx::query("UPDATE push_outbox SET receipt = 'ok' WHERE id = $1").bind(id).execute(&st.pool).await?;
            }
            Outcome::DropToken(e) => {
                let tenant: String = r.get("tenant");
                let token: String = r.get("token");
                drop_token(st, &tenant, &token, &e).await?;
                sqlx::query("UPDATE push_outbox SET receipt = 'DeviceNotRegistered', last_error = $2 WHERE id = $1").bind(id).bind(e).execute(&st.pool).await?;
            }
            Outcome::Retry(e) => {
                // not delivered (the provider throttled this phone): send it again after the backoff
                sqlx::query("UPDATE push_outbox SET status = 'pending', ticket_id = NULL, sent_at = NULL WHERE id = $1").bind(id).execute(&st.pool).await?;
                retry(st, id, r.get("attempts"), &e).await?;
            }
            Outcome::Fail(e) => {
                tracing::warn!(id, error = %e, "push not delivered");
                let code: String = error_code(receipt).chars().take(64).collect();
                sqlx::query("UPDATE push_outbox SET receipt = $2, last_error = $3 WHERE id = $1")
                    .bind(id)
                    .bind(if code.is_empty() { "error".to_string() } else { code })
                    .bind(e)
                    .execute(&st.pool)
                    .await?;
            }
        }
    }
    Ok(rows.len())
}

/// Clean-up: messages still pending after a day fail, finished rows go after 7 days, stale phones are removed.
pub async fn sweep(st: &AppState) -> anyhow::Result<()> {
    sqlx::query("UPDATE push_outbox SET status = 'failed', last_error = COALESCE(last_error, 'not sent within a day') WHERE status = 'pending' AND created_at < now() - interval '1 day'").execute(&st.pool).await?;
    sqlx::query("DELETE FROM push_outbox WHERE status <> 'pending' AND created_at < now() - interval '7 days'").execute(&st.pool).await?;
    sqlx::query("DELETE FROM push_tokens WHERE last_seen_at < now() - make_interval(days => $1)").bind(STALE_DAYS).execute(&st.pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn item(category: &'static str, title: &str, body: &str) -> Item {
        Item {
            id: 7,
            kind: "wallet.deposit_credited".into(),
            category,
            severity: "success".into(),
            title: title.into(),
            body: body.into(),
            link: Some("/wallet/history".into()),
            data: json!({}),
            read: false,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn validates_tokens_and_devices() {
        assert!(valid_token("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"));
        assert!(valid_token("ExpoPushToken[AbC_def-123456]"));
        assert!(!valid_token("ExponentPushToken[short]"));
        assert!(!valid_token("ExponentPushToken[has space here]"));
        assert!(!valid_token("ExponentPushToken[xxxxxxxxxxxxxxxx"));
        assert!(!valid_token("fcm:xxxxxxxxxxxxxxxxxxxxxxxx"));
        assert!(!valid_token(""));
        assert!(valid_device("AbCdEfGhIjKlMnOpQrStUvWx"));
        assert!(!valid_device("short"));
        assert!(!valid_device("has spaces in it, sixteen+"));
    }

    #[test]
    fn device_refs_match_the_gateway() {
        // the same vector is asserted in services/gateway src/push_revoke.rs
        assert_eq!(device_ref("AbCdEfGhIjKlMnOpQrStUvWx"), "e53524511f4ac4100ef53c6238fc293d65bd8f1cbfc63284d8007d9d669b06a1");
        assert!(valid_device_ref(&device_ref("x")));
        assert!(!valid_device_ref("E53524511F4AC4100EF53C6238FC293D65BD8F1CBFC63284D8007D9D669B06A1"));
        assert!(!valid_device_ref("e5352451"));
        assert!(!valid_device_ref(&"g".repeat(64)));
    }

    #[test]
    fn backs_off_exponentially_with_a_cap() {
        assert_eq!(backoff_secs(1), 15);
        assert_eq!(backoff_secs(2), 30);
        assert_eq!(backoff_secs(3), 60);
        assert_eq!(backoff_secs(7), 960);
        assert_eq!(backoff_secs(8), 1800);
        assert_eq!(backoff_secs(40), 1800);
        assert_eq!(backoff_secs(0), 15);
    }

    #[test]
    fn builds_the_expo_message() {
        let m = message(42, &item("wallet", "Deposit credited", "100.00 USDT was credited to your wallet."), 3);
        assert_eq!(m["title"], "Deposit credited");
        assert_eq!(m["body"], "100.00 USDT was credited to your wallet.");
        assert_eq!(m["data"], json!({"id": 7, "type": "wallet.deposit_credited", "link": "/wallet/history", "uid": 42}));
        assert_eq!(m["badge"], 3);
        assert_eq!(m["channelId"], "activity");
        assert_eq!(m["priority"], "high");
        assert_eq!(m["sound"], "default");
        assert!(m.get("to").is_none());
        // no body key for an empty body; long text shortened to fit the payload
        let m = message(42, &item("marketing", &"T".repeat(300), ""), 0);
        assert!(m.get("body").is_none());
        assert_eq!(m["title"].as_str().unwrap().chars().count(), 120);
        assert!(m["title"].as_str().unwrap().ends_with('…'));
        assert_eq!(m["channelId"], "news");
        assert_eq!(m["priority"], "normal");
        assert_eq!(message(1, &item("trading_alerts", "Stop-out", "x"), -1)["badge"], 0);
        assert_eq!(channel("trading_alerts"), "alerts");
        assert_eq!(channel("security"), "alerts");
        assert_eq!(channel("price_alerts"), "alerts");
        assert_eq!(channel("prop"), "activity");
    }

    #[test]
    fn classifies_tickets_and_receipts() {
        assert_eq!(classify_ticket(&json!({"status": "ok", "id": "XXXX-1"})), Outcome::Accepted("XXXX-1".into()));
        assert!(matches!(classify_ticket(&json!({"status": "ok"})), Outcome::Fail(_)));
        assert!(matches!(classify_ticket(&json!({"status": "error", "message": "not registered", "details": {"error": "DeviceNotRegistered"}})), Outcome::DropToken(_)));
        assert!(matches!(classify_ticket(&json!({"status": "error", "message": "slow down", "details": {"error": "MessageRateExceeded"}})), Outcome::Retry(_)));
        assert!(matches!(classify_ticket(&json!({"status": "error", "message": "too big", "details": {"error": "MessageTooBig"}})), Outcome::Fail(_)));
        assert!(matches!(classify_ticket(&json!({"status": "error", "message": "odd"})), Outcome::Fail(_)));
        assert_eq!(classify_receipt(&json!({"status": "ok"})), Outcome::Delivered);
        assert!(matches!(classify_receipt(&json!({"status": "error", "details": {"error": "DeviceNotRegistered"}})), Outcome::DropToken(_)));
        assert!(matches!(classify_receipt(&json!({"status": "error", "details": {"error": "MessageRateExceeded"}})), Outcome::Retry(_)));
        assert!(matches!(classify_receipt(&json!({"status": "error", "details": {"error": "InvalidCredentials"}})), Outcome::Fail(_)));
    }
}
