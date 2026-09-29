//! Notification routes: ingestion from other services (`POST /v1/notify`), the client and staff inboxes,
//! preferences, and Back Office broadcasts to segments (permission `notifications.write`).

use super::{Body, Service, Staff, Tenant, clamp_limit};
use crate::audit;
use crate::chat::Client;
use crate::error::{ApiError, ApiResult, invalid};
use crate::notify::{self, EmailMode, NewNotification, PREF_KEYS};
use crate::state::AppState;
use crate::upstream;
use crate::util::clean;
use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

fn severity(v: &Value) -> String {
    match v.as_str() {
        Some(s @ ("info" | "success" | "warning" | "critical")) => s.to_string(),
        _ => "info".into(),
    }
}

fn link(v: &Value) -> ApiResult<Option<String>> {
    match v.as_str().map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(None),
        Some(l) if (l.starts_with('/') && !l.starts_with("//")) || l.starts_with("https://") => Ok(Some(l.chars().take(500).collect())),
        Some(_) => Err(invalid("link", "Use an app path such as /wallet or an https:// URL.")),
    }
}

/// `POST /v1/notify` — see README "Notifications API". One notification to one or many recipients.
pub async fn ingest(State(st): State<AppState>, Tenant(tenant): Tenant, Service(service): Service, Body(b): Body) -> ApiResult<Json<Value>> {
    let kind = b["type"].as_str().unwrap_or("");
    if !notify::valid_type(kind) {
        return Err(invalid("type", "type is required: lower-case `category.event`, e.g. wallet.deposit_credited."));
    }
    let title = clean(b["title"].as_str().unwrap_or(""), 200);
    if title.is_empty() {
        return Err(invalid("title", "title is required."));
    }
    let body = clean(b["body"].as_str().unwrap_or(""), 2000);
    let link = link(&b["link"])?;
    let mut recipients: Vec<(&'static str, String)> = Vec::new();
    if let Some(u) = b["userId"].as_i64() {
        recipients.push(("user", u.to_string()));
    }
    for u in b["userIds"].as_array().into_iter().flatten().filter_map(Value::as_i64) {
        recipients.push(("user", u.to_string()));
    }
    for v in std::iter::once(&b["staffId"]).chain(b["staffIds"].as_array().into_iter().flatten()) {
        if let Some(x) = v.as_str().map(|x| x.trim().to_string()).or(v.as_i64().map(|n| n.to_string())).filter(|x| !x.is_empty() && x.len() <= 64) {
            recipients.push(("staff", x));
        }
    }
    if recipients.is_empty() {
        return Err(invalid("userId", "Give userId, userIds, staffId or staffIds."));
    }
    if recipients.len() > 1000 {
        return Err(invalid("userIds", "At most 1000 recipients per call."));
    }
    if recipients.iter().any(|(a, r)| *a == "user" && r.parse::<i64>().map(|x| x <= 0).unwrap_or(true)) {
        return Err(invalid("userId", "User ids are positive integers."));
    }
    let dedupe = b["dedupeKey"].as_str().map(|d| clean(d, 200)).filter(|d| !d.is_empty());
    let email = b["email"].as_bool().unwrap_or(true);
    let mut results = Vec::new();
    for (aud, r) in recipients {
        let mut n = if aud == "user" { NewNotification::user(r.parse().unwrap_or(0), kind, &title, &body) } else { NewNotification::staff(&r, kind, &title, &body) };
        n.severity = severity(&b["severity"]);
        n.link = link.clone();
        n.data = if b["data"].is_object() { b["data"].clone() } else { json!({}) };
        n.source = service.clone();
        n.dedupe_key = dedupe.clone();
        if !email {
            n.email = EmailMode::Never;
        }
        if let Some(e) = b["emailTo"].as_str().filter(|e| e.contains('@') && e.len() < 200) {
            n.email_to = Some(e.to_string());
        }
        n.email_subject = b["emailSubject"].as_str().map(|s| clean(s, 200)).filter(|s| !s.is_empty());
        let o = notify::deliver(&st, &tenant, n).await?;
        results.push(json!({"audience": aud, "recipient": r, "id": o.id, "duplicate": o.duplicate, "inApp": o.in_app, "emailed": o.emailed}));
    }
    Ok(Json(json!({"results": results})))
}

#[derive(Deserialize)]
pub struct ListQ {
    before: Option<i64>,
    limit: Option<i64>,
    unread: Option<bool>,
}

pub async fn my_list(State(st): State<AppState>, c: Client, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    Ok(Json(notify::list(&st, &c.tenant, "user", &c.id.to_string(), q.before, clamp_limit(q.limit, 30, 100), q.unread.unwrap_or(false)).await?))
}

fn ids(b: &Value) -> Vec<i64> {
    b["ids"].as_array().map(|a| a.iter().filter_map(Value::as_i64).take(500).collect()).unwrap_or_default()
}

pub async fn my_read(State(st): State<AppState>, c: Client, Body(b): Body) -> ApiResult<Json<Value>> {
    let unread = notify::mark_read(&st, &c.tenant, "user", &c.id.to_string(), &ids(&b), b["all"].as_bool().unwrap_or(false)).await?;
    Ok(Json(json!({"unread": unread})))
}

pub async fn my_clear(State(st): State<AppState>, c: Client) -> ApiResult<Json<Value>> {
    notify::clear(&st, &c.tenant, "user", &c.id.to_string()).await?;
    Ok(Json(json!({"unread": 0})))
}

pub async fn my_prefs(State(st): State<AppState>, c: Client) -> ApiResult<Json<Value>> {
    Ok(Json(json!({"catalog": notify::prefs_catalog("user"), "prefs": notify::prefs(&st, &c.tenant, "user", &c.id.to_string()).await?})))
}

pub async fn my_prefs_put(State(st): State<AppState>, c: Client, Body(b): Body) -> ApiResult<Json<Value>> {
    let p = notify::save_prefs(&st, &c.tenant, "user", &c.id.to_string(), &b["prefs"]).await?;
    Ok(Json(json!({"catalog": notify::prefs_catalog("user"), "prefs": p})))
}

pub async fn staff_list(State(st): State<AppState>, s: Staff, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    Ok(Json(notify::list(&st, &s.agent.tenant, "staff", &s.agent.id, q.before, clamp_limit(q.limit, 30, 100), q.unread.unwrap_or(false)).await?))
}

pub async fn staff_read(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    let unread = notify::mark_read(&st, &s.agent.tenant, "staff", &s.agent.id, &ids(&b), b["all"].as_bool().unwrap_or(false)).await?;
    Ok(Json(json!({"unread": unread})))
}

pub async fn staff_clear(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    notify::clear(&st, &s.agent.tenant, "staff", &s.agent.id).await?;
    Ok(Json(json!({"unread": 0})))
}

/// Notification types and preference categories (for the composer and docs).
pub async fn types(s: Staff) -> ApiResult<Json<Value>> {
    s.require("support.read").or_else(|_| s.require("notifications.write"))?;
    Ok(Json(json!({"categories": PREF_KEYS.iter().map(|p| json!({"key": p.key, "label": p.label, "hint": p.hint, "locked": p.locked})).collect::<Vec<_>>()})))
}

/* ---------------- broadcasts ---------------- */

#[derive(Clone, Debug)]
struct Segment {
    kind: String,
    countries: Vec<String>,
    user_ids: Vec<i64>,
}

fn segment(v: &Value) -> ApiResult<Segment> {
    let kind = v["kind"].as_str().unwrap_or("all").to_string();
    if !matches!(kind.as_str(), "all" | "kyc_verified" | "kyc_unverified" | "countries" | "users") {
        return Err(invalid("segment", "Unknown segment."));
    }
    let countries: Vec<String> = v["countries"].as_array().map(|a| a.iter().filter_map(Value::as_str).map(|c| c.trim().to_lowercase()).filter(|c| c.len() == 2).collect()).unwrap_or_default();
    let user_ids: Vec<i64> = v["userIds"].as_array().map(|a| a.iter().filter_map(Value::as_i64).filter(|x| *x > 0).take(5000).collect()).unwrap_or_default();
    if kind == "countries" && countries.is_empty() {
        return Err(invalid("segment", "Pick at least one country."));
    }
    if kind == "users" && user_ids.is_empty() {
        return Err(invalid("segment", "Add at least one client id."));
    }
    Ok(Segment { kind, countries, user_ids })
}

fn matches(seg: &Segment, tenant: &str, u: &Value) -> bool {
    if u["tenant"].as_str().unwrap_or("kalks") != tenant || u["status"].as_str() != Some("active") {
        return false;
    }
    let id = u["id"].as_i64().unwrap_or(0);
    match seg.kind.as_str() {
        "kyc_verified" => u["kyc_status"] == "verified",
        "kyc_unverified" => u["kyc_status"] != "verified",
        "countries" => seg.countries.contains(&u["country"].as_str().unwrap_or("").trim().to_lowercase()),
        "users" => seg.user_ids.contains(&id),
        _ => true,
    }
}

/// Every gateway client in the segment: `(id, email)`.
async fn recipients(st: &AppState, tenant: &str, seg: &Segment) -> anyhow::Result<Vec<(i64, String)>> {
    let mut out = Vec::new();
    let mut since = "1970-01-01T00:00:00Z".to_string();
    let mut after = 0i64;
    for _ in 0..500 {
        let page = upstream::users_page(st, &since, after, 1000).await?;
        if page.is_empty() {
            break;
        }
        for u in &page {
            if matches(seg, tenant, u) {
                out.push((u["id"].as_i64().unwrap_or(0), u["email"].as_str().unwrap_or("").to_string()));
            }
        }
        let last = page.last().unwrap();
        since = last["changed_at"].as_str().unwrap_or(&since).to_string();
        after = last["id"].as_i64().unwrap_or(after);
        if page.len() < 1000 {
            break;
        }
    }
    out.sort();
    out.dedup_by_key(|x| x.0);
    Ok(out)
}

pub async fn broadcast_preview(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let seg = segment(&b["segment"])?;
    let list = recipients(&st, &s.agent.tenant, &seg).await.map_err(|e| ApiError::Unavailable(format!("Could not load clients from the gateway: {e}")))?;
    Ok(Json(json!({"recipients": list.len(), "sample": list.iter().take(5).map(|(id, _)| id).collect::<Vec<_>>()})))
}

fn broadcast_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "title": r.get::<String, _>("title"), "body": r.get::<String, _>("body"), "link": r.get::<Option<String>, _>("link"),
        "type": r.get::<String, _>("type"), "segment": r.get::<sqlx::types::Json<Value>, _>("segment").0, "inApp": r.get::<bool, _>("in_app"), "email": r.get::<bool, _>("email"),
        "status": r.get::<String, _>("status"), "recipients": r.get::<i32, _>("recipients"), "emailed": r.get::<i32, _>("emailed"), "error": r.get::<Option<String>, _>("error"),
        "createdBy": r.get::<Option<String>, _>("created_by_name"), "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "finishedAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
        "read": r.try_get::<i64, _>("read").ok(),
    })
}

pub async fn broadcasts(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let rows = sqlx::query("SELECT b.*, (SELECT count(*) FROM notifications n WHERE n.broadcast_id = b.id AND n.read_at IS NOT NULL AND NOT n.hidden) AS read FROM broadcasts b WHERE b.tenant = $1 ORDER BY b.id DESC LIMIT 100")
        .bind(&s.agent.tenant)
        .fetch_all(&st.pool)
        .await?;
    Ok(Json(json!({"items": rows.iter().map(broadcast_json).collect::<Vec<_>>()})))
}

/// Sends an announcement to a client segment (in-app and / or email, per the recipients' preferences for the
/// category). Runs in the background; the row tracks progress. Audited.
pub async fn broadcast(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("notifications.write")?;
    let title = clean(b["title"].as_str().unwrap_or(""), 140);
    let body = clean(b["body"].as_str().unwrap_or(""), 2000);
    if title.is_empty() {
        return Err(invalid("title", "Add a title."));
    }
    if body.is_empty() {
        return Err(invalid("body", "Write the message."));
    }
    let link = link(&b["link"])?;
    let kind = match b["category"].as_str().unwrap_or("system") {
        "marketing" => "marketing.announcement",
        "security" => "security.announcement",
        _ => "system.announcement",
    };
    let in_app = b["inApp"].as_bool().unwrap_or(true);
    let email = b["email"].as_bool().unwrap_or(false);
    if !in_app && !email {
        return Err(invalid("channels", "Choose in-app, email or both."));
    }
    let seg = segment(&b["segment"])?;
    let row = sqlx::query(
        "INSERT INTO broadcasts (tenant, title, body, link, type, segment, in_app, email, created_by, created_by_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *, 0::bigint AS read",
    )
    .bind(&s.agent.tenant)
    .bind(&title)
    .bind(&body)
    .bind(&link)
    .bind(kind)
    .bind(sqlx::types::Json(&b["segment"]))
    .bind(in_app)
    .bind(email)
    .bind(format!("staff:{}", s.agent.id))
    .bind(&s.agent.name)
    .fetch_one(&st.pool)
    .await?;
    let id: i64 = row.get("id");
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "broadcast.send", Some(format!("broadcast:{id}")), None, Some(json!({"title": title, "type": kind, "segment": b["segment"], "inApp": in_app, "email": email})), None).await?;
    let st2 = st.clone();
    let tenant = s.agent.tenant.clone();
    tokio::spawn(async move {
        let res: anyhow::Result<(i32, i32)> = async {
            let list = recipients(&st2, &tenant, &seg).await?;
            sqlx::query("UPDATE broadcasts SET recipients = $2 WHERE id = $1").bind(id).bind(list.len() as i32).execute(&st2.pool).await?;
            let (mut sent, mut mailed) = (0, 0);
            for (uid, mail) in list {
                let mut n = NewNotification::user(uid, kind, &title, &body).source("broadcast").dedupe(format!("broadcast:{id}"));
                n.link = link.clone();
                n.broadcast_id = Some(id);
                n.in_app = in_app;
                n.email = if email { EmailMode::Prefs } else { EmailMode::Never };
                if mail.contains('@') {
                    n.email_to = Some(mail);
                }
                let o = notify::deliver(&st2, &tenant, n).await?;
                sent += 1;
                if o.emailed {
                    mailed += 1;
                }
            }
            Ok((sent, mailed))
        }
        .await;
        let _ = match res {
            Ok((sent, mailed)) => sqlx::query("UPDATE broadcasts SET status = 'sent', recipients = $2, emailed = $3, finished_at = now() WHERE id = $1").bind(id).bind(sent).bind(mailed).execute(&st2.pool).await,
            Err(e) => {
                tracing::error!(error = %e, broadcast = id, "broadcast failed");
                sqlx::query("UPDATE broadcasts SET status = 'failed', error = $2, finished_at = now() WHERE id = $1").bind(id).bind(e.to_string().chars().take(300).collect::<String>()).execute(&st2.pool).await
            }
        };
    });
    Ok(Json(json!({"item": broadcast_json(&row)})))
}
