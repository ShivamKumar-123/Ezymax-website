//! Notifications (D37, D41): per-user and per-staff inbox rows, read / unread, per-category preferences
//! (in-app / email), realtime push over the stream and emails through the outbox.
//!
//! Every producer goes through [`deliver`]: `POST /v1/notify` (other services), the polling adapters
//! (`adapters.rs`), support replies and Back Office broadcasts.

use crate::mailer;
use crate::state::{AppState, Target};
use crate::util::clean;
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::{Map, Value, json};
use sqlx::Row;

/// A preference category: which notification types it covers and its defaults.
pub struct PrefKey {
    pub key: &'static str,
    pub label: &'static str,
    pub hint: &'static str,
    pub in_app: bool,
    pub email: bool,
    /// Security notices can't be switched off.
    pub locked: bool,
    pub audience: &'static [&'static str],
}

pub const PREF_KEYS: &[PrefKey] = &[
    PrefKey { key: "security", label: "Security", hint: "Sign-ins from new devices, password and email changes", in_app: true, email: true, locked: true, audience: &["user", "staff"] },
    PrefKey { key: "trading_alerts", label: "Margin call and stop-out", hint: "When an account reaches its margin call or stop-out level", in_app: true, email: true, locked: false, audience: &["user"] },
    PrefKey { key: "trading_fills", label: "Order fills and closes", hint: "Stop loss, take profit and dealer closes", in_app: true, email: false, locked: false, audience: &["user"] },
    PrefKey { key: "wallet", label: "Deposits and withdrawals", hint: "Deposits credited, withdrawals approved, rejected or paid", in_app: true, email: true, locked: false, audience: &["user"] },
    PrefKey { key: "kyc", label: "Identity verification", hint: "Verification decisions and requests for documents", in_app: true, email: true, locked: false, audience: &["user"] },
    PrefKey { key: "ib", label: "Partner commissions", hint: "IB commissions, payouts and level changes", in_app: true, email: false, locked: false, audience: &["user"] },
    // email on by default: copier alerts that need action (skipped trades, protection stops, new terms, a stopped
    // master); routine fills are sent in-app only by the engine (`"email": false`)
    PrefKey { key: "copy", label: "Copy trading and PAMM", hint: "Copied trades, skipped trades, protection stops, new terms, fees and fund rollovers", in_app: true, email: true, locked: false, audience: &["user"] },
    PrefKey { key: "prop", label: "Prop challenges", hint: "Phase passed or failed, funded account and payouts", in_app: true, email: true, locked: false, audience: &["user"] },
    PrefKey { key: "support", label: "Support replies", hint: "Replies from our support team", in_app: true, email: true, locked: false, audience: &["user", "staff"] },
    PrefKey { key: "system", label: "Platform notices", hint: "Maintenance and service announcements", in_app: true, email: true, locked: false, audience: &["user", "staff"] },
    PrefKey { key: "marketing", label: "News and offers", hint: "Promotions, contests and product news", in_app: true, email: false, locked: false, audience: &["user"] },
];

/// Preference category of a notification type (`category.event`).
pub fn pref_key(kind: &str) -> &'static str {
    let (cat, ev) = kind.split_once('.').unwrap_or((kind, ""));
    match cat {
        "security" => "security",
        "trading" if matches!(ev, "margin_call" | "stop_out") => "trading_alerts",
        "trading" => "trading_fills",
        "wallet" => "wallet",
        "kyc" => "kyc",
        "ib" => "ib",
        "copy" | "pamm" | "social" => "copy",
        "prop" => "prop",
        "support" => "support",
        "marketing" | "broadcast" => "marketing",
        _ => "system",
    }
}

pub fn valid_type(kind: &str) -> bool {
    !kind.is_empty() && kind.len() <= 64 && kind.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_')
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EmailMode {
    /// Follow the recipient's preference for the category.
    Prefs,
    /// Never email (in-app only).
    Never,
}

#[derive(Clone, Debug)]
pub struct NewNotification {
    pub audience: &'static str,
    pub recipient: String,
    pub kind: String,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    pub data: Value,
    pub source: String,
    pub dedupe_key: Option<String>,
    pub broadcast_id: Option<i64>,
    pub email: EmailMode,
    /// In-app channel (false = email only, e.g. an email-only broadcast).
    pub in_app: bool,
    /// Known email address (skips the gateway lookup).
    pub email_to: Option<String>,
    /// Custom email subject (default: the title).
    pub email_subject: Option<String>,
}

impl NewNotification {
    pub fn user(user_id: i64, kind: &str, title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            audience: "user",
            recipient: user_id.to_string(),
            kind: kind.to_string(),
            severity: "info".into(),
            title: title.into(),
            body: body.into(),
            link: None,
            data: json!({}),
            source: "support".into(),
            dedupe_key: None,
            broadcast_id: None,
            email: EmailMode::Prefs,
            in_app: true,
            email_to: None,
            email_subject: None,
        }
    }

    pub fn staff(staff_id: &str, kind: &str, title: impl Into<String>, body: impl Into<String>) -> Self {
        let mut n = Self::user(0, kind, title, body);
        n.audience = "staff";
        n.recipient = staff_id.to_string();
        n.email = EmailMode::Never;
        n
    }

    pub fn severity(mut self, s: &str) -> Self {
        self.severity = s.into();
        self
    }
    pub fn link(mut self, l: impl Into<String>) -> Self {
        self.link = Some(l.into());
        self
    }
    pub fn dedupe(mut self, k: impl Into<String>) -> Self {
        self.dedupe_key = Some(k.into());
        self
    }
    pub fn data(mut self, d: Value) -> Self {
        self.data = d;
        self
    }
    pub fn source(mut self, s: &str) -> Self {
        self.source = s.into();
        self
    }
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: i64,
    #[serde(rename = "type")]
    pub kind: String,
    pub category: &'static str,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    pub data: Value,
    pub read: bool,
    pub created_at: DateTime<Utc>,
}

pub fn item_row(r: &sqlx::postgres::PgRow) -> Item {
    let kind: String = r.get("type");
    Item {
        id: r.get("id"),
        category: pref_key(&kind),
        kind,
        severity: r.get("severity"),
        title: r.get("title"),
        body: r.get("body"),
        link: r.get("link"),
        data: r.get::<sqlx::types::Json<Value>, _>("data").0,
        read: r.get::<Option<DateTime<Utc>>, _>("read_at").is_some(),
        created_at: r.get("created_at"),
    }
}

/// Effective preferences of a recipient: `{key: {inApp, email}}` with defaults filled in.
pub async fn prefs(st: &AppState, tenant: &str, audience: &str, recipient: &str) -> anyhow::Result<Map<String, Value>> {
    let saved: Option<sqlx::types::Json<Value>> = sqlx::query_scalar("SELECT prefs FROM notification_prefs WHERE tenant = $1 AND audience = $2 AND recipient = $3")
        .bind(tenant)
        .bind(audience)
        .bind(recipient)
        .fetch_optional(&st.pool)
        .await?;
    let saved = saved.map(|j| j.0).unwrap_or(Value::Null);
    let mut out = Map::new();
    for p in PREF_KEYS.iter().filter(|p| p.audience.contains(&audience)) {
        let s = &saved[p.key];
        let in_app = if p.locked { true } else { s["inApp"].as_bool().unwrap_or(p.in_app) };
        let email = if p.locked { true } else { s["email"].as_bool().unwrap_or(p.email) };
        out.insert(p.key.into(), json!({"inApp": in_app, "email": email}));
    }
    Ok(out)
}

pub fn prefs_catalog(audience: &str) -> Vec<Value> {
    PREF_KEYS
        .iter()
        .filter(|p| p.audience.contains(&audience))
        .map(|p| json!({"key": p.key, "label": p.label, "hint": p.hint, "locked": p.locked, "defaults": {"inApp": p.in_app, "email": p.email}}))
        .collect()
}

pub async fn save_prefs(st: &AppState, tenant: &str, audience: &str, recipient: &str, patch: &Value) -> anyhow::Result<Map<String, Value>> {
    let mut cur = prefs(st, tenant, audience, recipient).await?;
    if let Some(obj) = patch.as_object() {
        for (k, v) in obj {
            let Some(p) = PREF_KEYS.iter().find(|p| p.key == k && p.audience.contains(&audience)) else { continue };
            if p.locked {
                continue;
            }
            let entry = cur.get_mut(p.key).and_then(Value::as_object_mut).expect("default present");
            if let Some(b) = v["inApp"].as_bool() {
                entry.insert("inApp".into(), Value::Bool(b));
            }
            if let Some(b) = v["email"].as_bool() {
                entry.insert("email".into(), Value::Bool(b));
            }
        }
    }
    sqlx::query(
        "INSERT INTO notification_prefs (tenant, audience, recipient, prefs) VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant, audience, recipient) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()",
    )
    .bind(tenant)
    .bind(audience)
    .bind(recipient)
    .bind(sqlx::types::Json(Value::Object(cur.clone())))
    .execute(&st.pool)
    .await?;
    Ok(cur)
}

pub async fn unread(st: &AppState, tenant: &str, audience: &str, recipient: &str) -> anyhow::Result<i64> {
    Ok(sqlx::query_scalar("SELECT count(*) FROM notifications WHERE tenant = $1 AND audience = $2 AND recipient = $3 AND read_at IS NULL AND NOT hidden")
        .bind(tenant)
        .bind(audience)
        .bind(recipient)
        .fetch_one(&st.pool)
        .await?)
}

fn target(audience: &str, recipient: &str) -> Target {
    if audience == "staff" { Target::Staff(recipient.to_string()) } else { Target::User(recipient.parse().unwrap_or(0)) }
}

#[derive(Debug, Default, Serialize)]
pub struct Outcome {
    pub id: Option<i64>,
    pub duplicate: bool,
    pub in_app: bool,
    pub emailed: bool,
}

/// Stores, pushes and (per preferences) emails one notification. A repeated `dedupe_key` for the same
/// recipient is a no-op (`duplicate: true`), so producers and polling adapters can retry safely.
pub async fn deliver(st: &AppState, tenant: &str, n: NewNotification) -> anyhow::Result<Outcome> {
    let p = prefs(st, tenant, n.audience, &n.recipient).await?;
    let key = pref_key(&n.kind);
    let in_app = n.in_app && p.get(key).and_then(|v| v["inApp"].as_bool()).unwrap_or(true);
    let email = n.email == EmailMode::Prefs && n.audience == "user" && p.get(key).and_then(|v| v["email"].as_bool()).unwrap_or(false);
    let title = clean(&n.title, 200);
    let body = clean(&n.body, 2000);
    let row = sqlx::query(
        "INSERT INTO notifications (tenant, audience, recipient, type, severity, title, body, link, data, source, dedupe_key, broadcast_id, hidden, read_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, CASE WHEN $13 THEN now() END)
         ON CONFLICT (tenant, audience, recipient, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING *",
    )
    .bind(tenant)
    .bind(n.audience)
    .bind(&n.recipient)
    .bind(&n.kind)
    .bind(&n.severity)
    .bind(&title)
    .bind(&body)
    .bind(&n.link)
    .bind(sqlx::types::Json(&n.data))
    .bind(&n.source)
    .bind(&n.dedupe_key)
    .bind(n.broadcast_id)
    .bind(!in_app)
    .fetch_optional(&st.pool)
    .await?;
    let Some(row) = row else {
        return Ok(Outcome { duplicate: true, ..Default::default() });
    };
    let item = item_row(&row);
    if in_app {
        let unread = unread(st, tenant, n.audience, &n.recipient).await.unwrap_or(0);
        st.hub.send(tenant, target(n.audience, &n.recipient), json!({"type": "notification", "item": item, "unread": unread}));
    }
    let mut emailed = false;
    if email {
        let to = match &n.email_to {
            Some(e) => Some(e.clone()),
            None => crate::upstream::user_email(st, tenant, n.recipient.parse().unwrap_or(0)).await,
        };
        match to {
            Some(to) => {
                let url = n.link.as_deref().map(|l| if l.starts_with("http") { l.to_string() } else { format!("{}{}", st.cfg.app_url, l) });
                let footer = format!("You get this email because {} notifications are on. Change it in the Client Area under Profile -> Notifications.", PREF_KEYS.iter().find(|x| x.key == key).map(|x| x.label.to_lowercase()).unwrap_or_default());
                let (text, html) = mailer::render(&title, &body, url.as_deref().map(|u| ("Open Kalks", u)), &footer);
                let subject = n.email_subject.clone().unwrap_or_else(|| title.clone());
                queue_email(st, tenant, &to, &subject, &text, &html, &n.kind).await?;
                emailed = true;
            }
            None => tracing::warn!(user = %n.recipient, kind = %n.kind, "no email address for notification"),
        }
    }
    Ok(Outcome { id: Some(item.id), duplicate: false, in_app, emailed })
}

pub async fn queue_email(st: &AppState, tenant: &str, to: &str, subject: &str, text: &str, html: &str, kind: &str) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO email_outbox (tenant, to_addr, subject, text_body, html_body, kind) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(tenant)
        .bind(to)
        .bind(subject)
        .bind(text)
        .bind(html)
        .bind(kind)
        .execute(&st.pool)
        .await?;
    st.wake_mail.notify_one();
    Ok(())
}

/// Sends pending emails (SMTP, or logged as `DEV email` without SMTP). Returns how many were processed.
pub async fn flush_outbox(st: &AppState) -> anyhow::Result<usize> {
    let rows = sqlx::query("SELECT id, to_addr, subject, text_body, html_body, kind, attempts FROM email_outbox WHERE status = 'pending' ORDER BY id LIMIT 50").fetch_all(&st.pool).await?;
    for r in &rows {
        let id: i64 = r.get("id");
        let to: String = r.get("to_addr");
        let subject: String = r.get("subject");
        let kind: String = r.get("kind");
        let attempts: i32 = r.get("attempts");
        match &st.mailer {
            None => {
                tracing::info!(target: "email", to = %to, subject = %subject, kind = %kind, text = %r.get::<String, _>("text_body"), "DEV email (SMTP not configured)");
                sqlx::query("UPDATE email_outbox SET status = 'logged', sent_at = now(), attempts = attempts + 1 WHERE id = $1").bind(id).execute(&st.pool).await?;
            }
            Some(m) => match m.send(&to, &subject, &r.get::<String, _>("text_body"), &r.get::<String, _>("html_body")).await {
                Ok(()) => {
                    sqlx::query("UPDATE email_outbox SET status = 'sent', sent_at = now(), attempts = attempts + 1 WHERE id = $1").bind(id).execute(&st.pool).await?;
                }
                Err(e) => {
                    let failed = attempts + 1 >= 5;
                    tracing::warn!(error = %e, id, attempts = attempts + 1, "email send failed");
                    sqlx::query("UPDATE email_outbox SET status = CASE WHEN $2 THEN 'failed' ELSE 'pending' END, attempts = attempts + 1, last_error = $3 WHERE id = $1")
                        .bind(id)
                        .bind(failed)
                        .bind(e.to_string().chars().take(500).collect::<String>())
                        .execute(&st.pool)
                        .await?;
                }
            },
        }
    }
    Ok(rows.len())
}

/// Inbox page for a recipient: newest first, `before` = id cursor.
pub async fn list(st: &AppState, tenant: &str, audience: &str, recipient: &str, before: Option<i64>, limit: i64, unread_only: bool) -> anyhow::Result<Value> {
    let rows = sqlx::query(
        "SELECT * FROM notifications WHERE tenant = $1 AND audience = $2 AND recipient = $3 AND NOT hidden
           AND ($4::bigint IS NULL OR id < $4) AND (NOT $6 OR read_at IS NULL)
         ORDER BY id DESC LIMIT $5",
    )
    .bind(tenant)
    .bind(audience)
    .bind(recipient)
    .bind(before)
    .bind(limit)
    .bind(unread_only)
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Item> = rows.iter().map(item_row).collect();
    let next = if items.len() as i64 == limit { items.last().map(|i| i.id) } else { None };
    Ok(json!({"items": items, "unread": unread(st, tenant, audience, recipient).await?, "next": next}))
}

/// Marks `ids` (or everything when `all`) read; returns the new unread count and pushes it.
pub async fn mark_read(st: &AppState, tenant: &str, audience: &str, recipient: &str, ids: &[i64], all: bool) -> anyhow::Result<i64> {
    sqlx::query(
        "UPDATE notifications SET read_at = now() WHERE tenant = $1 AND audience = $2 AND recipient = $3 AND read_at IS NULL AND ($4 OR id = ANY($5))",
    )
    .bind(tenant)
    .bind(audience)
    .bind(recipient)
    .bind(all)
    .bind(ids)
    .execute(&st.pool)
    .await?;
    let n = unread(st, tenant, audience, recipient).await?;
    st.hub.send(tenant, target(audience, recipient), json!({"type": "notifications.read", "ids": ids, "all": all, "unread": n}));
    Ok(n)
}

pub async fn clear(st: &AppState, tenant: &str, audience: &str, recipient: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE notifications SET hidden = true, read_at = COALESCE(read_at, now()) WHERE tenant = $1 AND audience = $2 AND recipient = $3")
        .bind(tenant)
        .bind(audience)
        .bind(recipient)
        .execute(&st.pool)
        .await?;
    st.hub.send(tenant, target(audience, recipient), json!({"type": "notifications.read", "ids": [], "all": true, "unread": 0, "cleared": true}));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_types_to_preference_keys() {
        assert_eq!(pref_key("trading.stop_out"), "trading_alerts");
        assert_eq!(pref_key("trading.margin_call"), "trading_alerts");
        assert_eq!(pref_key("trading.sl"), "trading_fills");
        assert_eq!(pref_key("wallet.deposit_credited"), "wallet");
        assert_eq!(pref_key("pamm.fee"), "copy");
        assert_eq!(pref_key("security.new_device"), "security");
        assert_eq!(pref_key("whatever"), "system");
        assert!(valid_type("wallet.deposit_credited"));
        assert!(!valid_type("Wallet Deposit"));
        assert!(!valid_type(""));
    }
}
