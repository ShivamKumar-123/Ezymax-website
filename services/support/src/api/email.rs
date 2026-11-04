//! Email management for the Back Office (Content -> Email): what went out and whether it arrived, a retry for
//! what did not, the switches (every email, or a category of it, off), and the templates - an admin's own
//! subject, headline and body for a kind, previewed and test-sent before it is used. Also the client's own
//! email history (`/v1/notifications/me/emails`): the emails sent to them, never anyone else's.
//!
//! Permissions: reading (stats, logs, templates) needs `support.read` or `notifications.write`; changing
//! anything needs `notifications.write`. Security emails cannot be switched off here - the switch refuses it.

use super::{Body, Staff, clamp_limit};
use crate::audit;
use crate::chat::Client;
use crate::error::{ApiError, ApiResult, invalid};
use crate::notify::{self, PREF_KEYS};
use crate::state::AppState;
use crate::util::clean;
use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::Row;

fn can_read(s: &Staff) -> ApiResult<()> {
    s.require("support.read").or_else(|_| s.require("notifications.write"))
}

/// The kinds the platform sends, so the templates page lists them before any has gone out.
pub const KNOWN_KINDS: &[(&str, &str)] = &[
    ("security.new_device", "New sign-in to the account"),
    ("security.password_changed", "Password changed"),
    ("security.password_reset", "Password reset"),
    ("security.locked", "Sign-in locked after failed attempts"),
    ("account.restricted", "Account suspended / restricted"),
    ("account.restriction_lifted", "Restriction lifted"),
    ("account.closure_requested", "Account closure request received"),
    ("account.closed", "Trading account closed"),
    ("account.reopened", "Trading account reopened"),
    ("account.dormant", "Trading account inactive"),
    ("account.archived", "Trading account archived"),
    ("wallet.deposit_received", "Deposit request received"),
    ("wallet.deposit_pending", "Deposit detected on the chain"),
    ("wallet.deposit_under_review", "Deposit under review"),
    ("wallet.deposit_credited", "Deposit credited"),
    ("wallet.deposit_rejected", "Deposit rejected"),
    ("wallet.deposit_failed", "Deposit failed"),
    ("wallet.withdrawal_requested", "Withdrawal requested"),
    ("wallet.withdrawal_approved", "Withdrawal approved"),
    ("wallet.withdrawal_processing", "Withdrawal sent, waiting for the network"),
    ("wallet.withdrawal_completed", "Withdrawal paid"),
    ("wallet.withdrawal_rejected", "Withdrawal rejected"),
    ("wallet.withdrawal_cancelled", "Withdrawal cancelled"),
    ("wallet.withdrawal_failed", "Withdrawal payout delayed"),
    ("wallet.transfer_completed", "Wallet / account transfer"),
    ("wallet.credit", "Wallet credit (adjustment)"),
    ("trading.opened", "Trade opened"),
    ("trading.closed", "Trade closed"),
    ("trading.sl", "Stop loss hit"),
    ("trading.tp", "Take profit hit"),
    ("trading.dealer_close", "Closed by the dealing desk"),
    ("trading.stop_out", "Stop-out"),
    ("trading.margin_call", "Margin call"),
    ("trading.order_placed", "Pending order placed"),
    ("trading.order_filled", "Pending order filled"),
    ("trading.order_cancelled", "Pending order cancelled"),
    ("trading.order_expired", "Pending order expired"),
    ("trading.order_rejected", "Pending order rejected"),
    ("kyc.verified", "Identity verified"),
    ("kyc.rejected", "Identity verification rejected"),
    ("copy.trade_opened", "Copy trading: trade copied"),
    ("copy.trade_closed", "Copy trading: trade closed"),
    ("copy.trade_skipped", "Copy trading: trade skipped"),
    ("copy.protection_stop", "Copy trading: protection stop"),
    ("support.reply", "Support reply"),
    ("system.broadcast", "Platform notice (broadcast)"),
    ("birthday.wish", "Birthday greeting"),
    ("reports.weekly_summary", "Weekly trading summary"),
    ("reports.monthly_statement", "Monthly statement ready"),
    ("marketing.journey", "Marketing journey email"),
];

/* ---------------- stats ---------------- */

pub async fn stats(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    can_read(&s)?;
    let t = &s.agent.tenant;
    let r = sqlx::query(
        "SELECT count(*) AS total,
                count(*) FILTER (WHERE status = 'sent') AS sent,
                count(*) FILTER (WHERE status = 'failed') AS failed,
                count(*) FILTER (WHERE status = 'pending') AS pending,
                count(*) FILTER (WHERE status = 'logged') AS logged,
                count(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS today,
                count(*) FILTER (WHERE created_at >= date_trunc('day', now()) AND status = 'sent') AS today_sent,
                count(*) FILTER (WHERE created_at >= date_trunc('day', now()) AND status = 'failed') AS today_failed,
                count(*) FILTER (WHERE kind = 'birthday.wish' AND created_at >= date_trunc('month', now())) AS birthday_month,
                count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS week
         FROM email_outbox WHERE tenant = $1",
    )
    .bind(t)
    .fetch_one(&st.pool)
    .await?;
    let by_kind = sqlx::query("SELECT kind, count(*) AS n, count(*) FILTER (WHERE status = 'sent') AS sent, count(*) FILTER (WHERE status = 'failed') AS failed FROM email_outbox WHERE tenant = $1 AND created_at >= now() - interval '30 days' GROUP BY kind ORDER BY n DESC LIMIT 12")
        .bind(t)
        .fetch_all(&st.pool)
        .await?;
    let by_day = sqlx::query(
        "SELECT to_char(d, 'YYYY-MM-DD') AS day,
                (SELECT count(*) FROM email_outbox e WHERE e.tenant = $1 AND e.status = 'sent' AND e.created_at >= d AND e.created_at < d + interval '1 day') AS sent,
                (SELECT count(*) FROM email_outbox e WHERE e.tenant = $1 AND e.status = 'failed' AND e.created_at >= d AND e.created_at < d + interval '1 day') AS failed
         FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d ORDER BY d",
    )
    .bind(t)
    .fetch_all(&st.pool)
    .await?;
    let sent: i64 = r.get("sent");
    let failed: i64 = r.get("failed");
    let settings = crate::db::settings(&st.pool, t).await?;
    Ok(Json(json!({
        "total": r.get::<i64, _>("total"), "sent": sent, "failed": failed, "pending": r.get::<i64, _>("pending"), "logged": r.get::<i64, _>("logged"),
        "today": r.get::<i64, _>("today"), "todaySent": r.get::<i64, _>("today_sent"), "todayFailed": r.get::<i64, _>("today_failed"),
        "week": r.get::<i64, _>("week"), "birthdayMonth": r.get::<i64, _>("birthday_month"),
        "successRate": if sent + failed > 0 { (sent as f64 / (sent + failed) as f64 * 1000.0).round() / 10.0 } else { 100.0 },
        "smtp": st.mailer.is_some(),
        "enabled": settings.email_enabled,
        "byKind": by_kind.iter().map(|k| json!({"kind": k.get::<String, _>("kind"), "n": k.get::<i64, _>("n"), "sent": k.get::<i64, _>("sent"), "failed": k.get::<i64, _>("failed")})).collect::<Vec<_>>(),
        "byDay": by_day.iter().map(|d| json!({"day": d.get::<String, _>("day"), "sent": d.get::<i64, _>("sent"), "failed": d.get::<i64, _>("failed")})).collect::<Vec<_>>(),
    })))
}

/* ---------------- logs ---------------- */

#[derive(Deserialize)]
pub struct LogsQ {
    pub q: Option<String>,
    pub status: Option<String>,
    pub kind: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

fn day(s: Option<&str>, end: bool) -> Option<DateTime<Utc>> {
    let d = chrono::NaiveDate::parse_from_str(s?.trim(), "%Y-%m-%d").ok()?;
    let d = if end { d.succ_opt()? } else { d };
    Some(d.and_hms_opt(0, 0, 0)?.and_utc())
}

fn log_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "to": r.get::<String, _>("to_addr"), "userId": r.get::<Option<i64>, _>("user_id"), "kind": r.get::<String, _>("kind"),
        "subject": r.get::<String, _>("subject"), "status": r.get::<String, _>("status"), "attempts": r.get::<i32, _>("attempts"),
        "error": r.get::<Option<String>, _>("last_error"), "providerMessageId": r.get::<Option<String>, _>("provider_message_id"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"), "sentAt": r.get::<Option<DateTime<Utc>>, _>("sent_at"),
    })
}

pub async fn logs(State(st): State<AppState>, s: Staff, Query(q): Query<LogsQ>) -> ApiResult<Json<Value>> {
    can_read(&s)?;
    let per = clamp_limit(q.per_page, 50, 200);
    let page = q.page.unwrap_or(1).max(1);
    let status = q.status.as_deref().map(str::trim).filter(|v| ["pending", "sent", "failed", "logged"].contains(v)).map(str::to_string);
    let kind = q.kind.as_deref().map(|k| clean(k, 64)).filter(|k| !k.is_empty());
    let text = q.q.as_deref().map(|k| clean(k, 120)).filter(|k| !k.is_empty()).map(|k| format!("%{k}%"));
    let (from, to) = (day(q.from.as_deref(), false), day(q.to.as_deref(), true));
    let total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM email_outbox WHERE tenant = $1 AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR kind = $3)
           AND ($4::text IS NULL OR to_addr ILIKE $4 OR subject ILIKE $4) AND ($5::timestamptz IS NULL OR created_at >= $5) AND ($6::timestamptz IS NULL OR created_at < $6)",
    )
    .bind(&s.agent.tenant)
    .bind(&status)
    .bind(&kind)
    .bind(&text)
    .bind(from)
    .bind(to)
    .fetch_one(&st.pool)
    .await?;
    let rows = sqlx::query(
        "SELECT id, to_addr, user_id, kind, subject, status, attempts, last_error, provider_message_id, created_at, sent_at FROM email_outbox
         WHERE tenant = $1 AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR kind = $3)
           AND ($4::text IS NULL OR to_addr ILIKE $4 OR subject ILIKE $4) AND ($5::timestamptz IS NULL OR created_at >= $5) AND ($6::timestamptz IS NULL OR created_at < $6)
         ORDER BY id DESC LIMIT $7 OFFSET $8",
    )
    .bind(&s.agent.tenant)
    .bind(&status)
    .bind(&kind)
    .bind(&text)
    .bind(from)
    .bind(to)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({"items": rows.iter().map(log_json).collect::<Vec<_>>(), "total": total, "page": page, "perPage": per})))
}

/// The whole of one email, for the preview pane.
pub async fn log_get(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    can_read(&s)?;
    let r = sqlx::query("SELECT * FROM email_outbox WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let mut v = log_json(&r);
    v["text"] = json!(r.get::<String, _>("text_body"));
    v["html"] = json!(r.get::<String, _>("html_body"));
    Ok(Json(v))
}

/// Queues a failed (or stuck) email again, from the start.
pub async fn retry(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let n = sqlx::query("UPDATE email_outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE tenant = $1 AND id = $2 AND status IN ('failed', 'pending', 'logged')")
        .bind(&s.agent.tenant)
        .bind(id)
        .execute(&st.pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(ApiError::NotFound);
    }
    st.wake_mail.notify_one();
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "email.retried", Some(format!("email:{id}")), None, None, None).await?;
    Ok(Json(json!({"status": "ok"})))
}

/* ---------------- settings ---------------- */

pub async fn settings(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    can_read(&s)?;
    let x = crate::db::settings(&st.pool, &s.agent.tenant).await?;
    Ok(Json(settings_json(&st, &x)))
}

fn settings_json(st: &AppState, x: &crate::db::Settings) -> Value {
    json!({
        "enabled": x.email_enabled,
        "offCategories": x.email_off_categories,
        "categories": PREF_KEYS.iter().filter(|p| p.audience.contains(&"user")).map(|p| json!({"key": p.key, "label": p.label, "hint": p.hint, "locked": p.locked, "emailDefault": p.email})).collect::<Vec<_>>(),
        "smtp": st.mailer.is_some(),
        "from": st.cfg.smtp_from,
    })
}

pub async fn settings_put(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let mut x = crate::db::settings(&st.pool, &s.agent.tenant).await?;
    if let Some(e) = b["enabled"].as_bool() {
        x.email_enabled = e;
    }
    if let Some(list) = b["offCategories"].as_array() {
        let mut off: Vec<String> = Vec::new();
        for v in list {
            let Some(k) = v.as_str() else { continue };
            let Some(p) = PREF_KEYS.iter().find(|p| p.key == k) else { return Err(invalid("offCategories", format!("Unknown category {k}."))) };
            if p.locked {
                return Err(invalid("offCategories", "Security emails cannot be switched off: a client must always hear about a new sign-in or a password change."));
            }
            if !off.contains(&p.key.to_string()) {
                off.push(p.key.to_string());
            }
        }
        x.email_off_categories = off;
    }
    crate::db::save_settings(&st.pool, &s.agent.tenant, &x, &s.agent.id).await?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "email.settings", Some("settings:email".into()), None, Some(json!({"enabled": x.email_enabled, "offCategories": x.email_off_categories})), None).await?;
    Ok(Json(settings_json(&st, &x)))
}

/* ---------------- templates ---------------- */

/// `{{title}}`, `{{body}}`, `{{name}}`, `{{data.key}}` filled from the notification; unknown names stay as written.
pub fn fill(template: &str, vars: &Map<String, Value>) -> String {
    let mut out = String::with_capacity(template.len());
    let mut rest = template;
    while let Some(i) = rest.find("{{") {
        out.push_str(&rest[..i]);
        let after = &rest[i + 2..];
        match after.find("}}") {
            Some(j) => {
                let key = after[..j].trim();
                let val = if let Some(k) = key.strip_prefix("data.") { vars.get("data").and_then(|d| d.get(k)) } else { vars.get(key) };
                match val {
                    Some(Value::String(s)) => out.push_str(s),
                    Some(Value::Null) | None => out.push_str(&rest[i..i + 2 + j + 2]),
                    Some(v) => out.push_str(&v.to_string().trim_matches('"').to_string()),
                }
                rest = &after[j + 2..];
            }
            None => {
                out.push_str(rest[i..].as_ref());
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

fn template_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({"subject": r.get::<String, _>("subject"), "title": r.get::<String, _>("title"), "body": r.get::<String, _>("body"), "enabled": r.get::<bool, _>("enabled"),
           "updatedBy": r.get::<Option<String>, _>("updated_by"), "updatedAt": r.get::<DateTime<Utc>, _>("updated_at")})
}

/// Every kind: what it is for, the producer's last wording (the default a template replaces), and the override.
pub async fn templates(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    can_read(&s)?;
    let t = &s.agent.tenant;
    let overrides = sqlx::query("SELECT * FROM email_templates WHERE tenant = $1").bind(t).fetch_all(&st.pool).await?;
    let samples = sqlx::query("SELECT DISTINCT ON (kind) kind, subject, text_body, sent_at FROM email_outbox WHERE tenant = $1 ORDER BY kind, id DESC").bind(t).fetch_all(&st.pool).await?;
    let counts = sqlx::query("SELECT kind, count(*) AS n FROM email_outbox WHERE tenant = $1 AND created_at >= now() - interval '30 days' GROUP BY kind").bind(t).fetch_all(&st.pool).await?;
    let mut kinds: Vec<(String, String)> = KNOWN_KINDS.iter().map(|(k, l)| (k.to_string(), l.to_string())).collect();
    for r in &samples {
        let k: String = r.get("kind");
        if !kinds.iter().any(|(x, _)| *x == k) {
            kinds.push((k.clone(), k.clone()));
        }
    }
    let items: Vec<Value> = kinds
        .iter()
        .map(|(k, label)| {
            let sample = samples.iter().find(|r| r.get::<String, _>("kind") == *k);
            let o = overrides.iter().find(|r| r.get::<String, _>("kind") == *k);
            let n = counts.iter().find(|r| r.get::<String, _>("kind") == *k).map(|r| r.get::<i64, _>("n")).unwrap_or(0);
            json!({
                "kind": k, "label": label, "category": notify::pref_key(k),
                "categoryLabel": PREF_KEYS.iter().find(|p| p.key == notify::pref_key(k)).map(|p| p.label).unwrap_or(""),
                "sent30d": n,
                "sample": sample.map(|r| json!({"subject": r.get::<String, _>("subject"), "text": r.get::<String, _>("text_body"), "sentAt": r.get::<Option<DateTime<Utc>>, _>("sent_at")})),
                "override": o.map(template_json),
            })
        })
        .collect();
    Ok(Json(json!({"items": items, "variables": ["{{title}}", "{{body}}", "{{name}}", "{{data.<key>}}"]})))
}

fn valid_kind(k: &str) -> ApiResult<String> {
    let k = clean(k, 64);
    if !notify::valid_type(&k) {
        return Err(invalid("kind", "Unknown email kind."));
    }
    Ok(k)
}

pub async fn template_put(State(st): State<AppState>, s: Staff, Path(kind): Path<String>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let kind = valid_kind(&kind)?;
    let subject = clean(b["subject"].as_str().unwrap_or(""), 200);
    let title = clean(b["title"].as_str().unwrap_or(""), 200);
    let body = clean(b["body"].as_str().unwrap_or(""), 4000);
    if subject.is_empty() || title.is_empty() || body.is_empty() {
        return Err(invalid("body", "Subject, headline and body are all required."));
    }
    let enabled = b["enabled"].as_bool().unwrap_or(true);
    let r = sqlx::query(
        "INSERT INTO email_templates (tenant, kind, subject, title, body, enabled, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant, kind) DO UPDATE SET subject = EXCLUDED.subject, title = EXCLUDED.title, body = EXCLUDED.body, enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING *",
    )
    .bind(&s.agent.tenant)
    .bind(&kind)
    .bind(&subject)
    .bind(&title)
    .bind(&body)
    .bind(enabled)
    .bind(&s.agent.name)
    .fetch_one(&st.pool)
    .await?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "email.template", Some(format!("email_template:{kind}")), None, Some(json!({"enabled": enabled, "subject": subject})), None).await?;
    Ok(Json(json!({"kind": kind, "override": template_json(&r)})))
}

/// Back to the producer's wording.
pub async fn template_delete(State(st): State<AppState>, s: Staff, Path(kind): Path<String>) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let kind = valid_kind(&kind)?;
    sqlx::query("DELETE FROM email_templates WHERE tenant = $1 AND kind = $2").bind(&s.agent.tenant).bind(&kind).execute(&st.pool).await?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "email.template_reset", Some(format!("email_template:{kind}")), None, None, None).await?;
    Ok(Json(json!({"status": "ok"})))
}

/// Sample variables for a kind: its last real email's words, with the recipient's name blanked.
async fn sample_vars(st: &AppState, tenant: &str, kind: &str) -> Map<String, Value> {
    let last = sqlx::query("SELECT subject, text_body FROM email_outbox WHERE tenant = $1 AND kind = $2 ORDER BY id DESC LIMIT 1").bind(tenant).bind(kind).fetch_optional(&st.pool).await.ok().flatten();
    let mut m = Map::new();
    let (title, body) = match last {
        Some(r) => {
            let text: String = r.get("text_body");
            // the text part is "title\n\nparagraphs…\n\n<footer>": the paragraphs up to the footer line
            let mut parts = text.splitn(2, "\n\n");
            let t = parts.next().unwrap_or("").to_string();
            let b = parts.next().unwrap_or("").split("\n\nYou get this email").next().unwrap_or("").trim().to_string();
            (t, b)
        }
        None => (KNOWN_KINDS.iter().find(|(k, _)| *k == kind).map(|(_, l)| l.to_string()).unwrap_or_else(|| kind.to_string()), "This is a sample of the producer's wording for this email.".to_string()),
    };
    m.insert("title".into(), json!(title));
    m.insert("body".into(), json!(body));
    m.insert("name".into(), json!("Client"));
    m.insert("data".into(), json!({"amount": "100.00 USDT", "reference": "SAMPLE-1", "login": "10000001"}));
    m
}

/// Renders a kind (the override as sent in the body, or the saved one) with sample variables.
pub async fn template_preview(State(st): State<AppState>, s: Staff, Path(kind): Path<String>, Body(b): Body) -> ApiResult<Json<Value>> {
    can_read(&s)?;
    let kind = valid_kind(&kind)?;
    let vars = sample_vars(&st, &s.agent.tenant, &kind).await;
    let (subject, title, body) = (b["subject"].as_str().unwrap_or("{{title}}"), b["title"].as_str().unwrap_or("{{title}}"), b["body"].as_str().unwrap_or("{{body}}"));
    let (subject, title, body) = (fill(subject, &vars), fill(title, &vars), fill(body, &vars));
    let tag = PREF_KEYS.iter().find(|p| p.key == notify::pref_key(&kind)).map(|p| p.label).unwrap_or("Notice");
    let (text, html) = crate::mailer::render(&crate::mailer::Mail { title: &title, tag, body: &body, facts: &[], note: None, button: Some(("Open Ezymex", &st.cfg.app_url)), footer_note: "You get this email because these notifications are on. Change it in the Client Area under Profile -> Notifications.", app_url: &st.cfg.app_url });
    Ok(Json(json!({"subject": subject, "title": title, "body": body, "text": text, "html": html, "variables": vars})))
}

/// Sends the rendered kind to an address of the admin's choosing (not to a client).
pub async fn template_test(State(st): State<AppState>, s: Staff, Path(kind): Path<String>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let kind = valid_kind(&kind)?;
    let to = clean(b["to"].as_str().unwrap_or(""), 200);
    if !to.contains('@') || to.len() < 5 {
        return Err(invalid("to", "Enter the address to send the test to."));
    }
    let vars = sample_vars(&st, &s.agent.tenant, &kind).await;
    let (subject, title, body) = (b["subject"].as_str().unwrap_or("{{title}}"), b["title"].as_str().unwrap_or("{{title}}"), b["body"].as_str().unwrap_or("{{body}}"));
    let (subject, title, body) = (fill(subject, &vars), fill(title, &vars), fill(body, &vars));
    let tag = PREF_KEYS.iter().find(|p| p.key == notify::pref_key(&kind)).map(|p| p.label).unwrap_or("Notice");
    let (text, html) = crate::mailer::render(&crate::mailer::Mail { title: &title, tag, body: &body, facts: &[], note: None, button: Some(("Open Ezymex", &st.cfg.app_url)), footer_note: "This is a test email sent from the Back Office.", app_url: &st.cfg.app_url });
    notify::queue_email(&st, &s.agent.tenant, &to, &format!("[TEST] {subject}"), &text, &html, &format!("{kind}"), None).await?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "email.test_sent", Some(format!("email_template:{kind}")), None, Some(json!({"to": to})), None).await?;
    Ok(Json(json!({"status": "queued", "to": to})))
}

/* ---------------- the client's own history ---------------- */

#[derive(Deserialize)]
pub struct MyQ {
    pub before: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn my_emails(State(st): State<AppState>, c: Client, Query(q): Query<MyQ>) -> ApiResult<Json<Value>> {
    let limit = clamp_limit(q.limit, 30, 100);
    let rows = sqlx::query(
        "SELECT id, to_addr, user_id, kind, subject, status, attempts, last_error, provider_message_id, created_at, sent_at FROM email_outbox
         WHERE tenant = $1 AND user_id = $2 AND ($3::bigint IS NULL OR id < $3) ORDER BY id DESC LIMIT $4",
    )
    .bind(&c.tenant)
    .bind(c.id)
    .bind(q.before)
    .bind(limit + 1)
    .fetch_all(&st.pool)
    .await?;
    let more = rows.len() as i64 > limit;
    let items: Vec<Value> = rows
        .iter()
        .take(limit as usize)
        .map(|r| json!({"id": r.get::<i64, _>("id"), "kind": r.get::<String, _>("kind"), "subject": r.get::<String, _>("subject"), "status": r.get::<String, _>("status"), "createdAt": r.get::<DateTime<Utc>, _>("created_at"), "sentAt": r.get::<Option<DateTime<Utc>>, _>("sent_at")}))
        .collect();
    let next = if more { items.last().and_then(|v| v["id"].as_i64()) } else { None };
    Ok(Json(json!({"items": items, "next": next})))
}

#[cfg(test)]
mod tests {
    use super::fill;
    use serde_json::json;

    #[test]
    fn variables_fill_and_unknown_ones_stay() {
        let vars = json!({"title": "Deposit credited", "body": "194.17 USDT is in your wallet.", "name": "Jugnu", "data": {"amount": "194.17 USDT"}});
        let m = vars.as_object().unwrap();
        assert_eq!(fill("Hi {{name}} - {{title}}: {{data.amount}} / {{data.missing}} / {{nope}}", m), "Hi Jugnu - Deposit credited: 194.17 USDT / {{data.missing}} / {{nope}}");
        assert_eq!(fill("no braces", m), "no braces");
        assert_eq!(fill("open {{title", m), "open {{title");
    }
}
