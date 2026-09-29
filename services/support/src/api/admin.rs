//! Back Office routes (`/v1/support/admin/*`): inbox queues, replies and notes, assignment, context panel,
//! canned replies, knowledge base, SLA / CSAT stats, settings and the audit log.
//! Permissions: `support.read` (view) and `support.write` (reply, assign, resolve, edit canned / KB / settings).

use super::{Body, Staff, Upload, clamp_limit, file_response};
use crate::audit;
use crate::chat::{self, conv_json};
use crate::db;
use crate::error::{ApiError, ApiResult, invalid};
use crate::kb;
use crate::state::{AppState, Target};
use crate::util::clean;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

async fn seen(st: &AppState, s: &Staff) {
    let _ = sqlx::query(
        "INSERT INTO agents (tenant, staff_id, name, role) VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant, staff_id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, last_seen = now()",
    )
    .bind(&s.agent.tenant)
    .bind(&s.agent.id)
    .bind(&s.agent.name)
    .bind(&s.agent.role)
    .execute(&st.pool)
    .await;
}

#[derive(Deserialize)]
pub struct ListQ {
    queue: Option<String>,
    q: Option<String>,
    limit: Option<i64>,
    user_id: Option<i64>,
}

/// Queues: `bot` (AI handling), `waiting` (needs an agent), `mine`, `open` / `all` (not resolved), `resolved`.
pub async fn conversations(State(st): State<AppState>, s: Staff, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    seen(&st, &s).await;
    let t = &s.agent.tenant;
    let queue = q.queue.as_deref().unwrap_or("open");
    let limit = clamp_limit(q.limit, 100, 300);
    let term = q.q.as_deref().map(str::trim).filter(|x| !x.is_empty()).map(|x| format!("%{}%", x.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")));
    let rows = sqlx::query(
        "SELECT * FROM conversations WHERE tenant = $1
           AND CASE $2 WHEN 'bot' THEN status = 'bot' WHEN 'waiting' THEN status = 'waiting' WHEN 'mine' THEN status <> 'resolved' AND assignee_id = $3
                       WHEN 'resolved' THEN status = 'resolved' WHEN 'everything' THEN true ELSE status <> 'resolved' END
           AND ($4::text IS NULL OR user_name ILIKE $4 OR user_email ILIKE $4 OR subject ILIKE $4 OR preview ILIKE $4 OR id::text = trim(both '%' from $4))
           AND ($6::bigint IS NULL OR user_id = $6)
         ORDER BY CASE WHEN $2 = 'resolved' THEN 0 ELSE (CASE status WHEN 'waiting' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END) END, last_message_at DESC
         LIMIT $5",
    )
    .bind(t)
    .bind(queue)
    .bind(&s.agent.id)
    .bind(term)
    .bind(limit)
    .bind(q.user_id)
    .fetch_all(&st.pool)
    .await?;
    let counts = sqlx::query(
        "SELECT count(*) FILTER (WHERE status = 'bot') AS bot, count(*) FILTER (WHERE status = 'waiting') AS waiting,
                count(*) FILTER (WHERE status <> 'resolved' AND assignee_id = $2) AS mine, count(*) FILTER (WHERE status <> 'resolved') AS open,
                count(*) FILTER (WHERE status IN ('waiting','assigned') AND (sla_breached OR sla_due_at < now())) AS breached
         FROM conversations WHERE tenant = $1",
    )
    .bind(t)
    .bind(&s.agent.id)
    .fetch_one(&st.pool)
    .await?;
    Ok(Json(json!({
        "items": rows.iter().map(conv_json).collect::<Vec<_>>(),
        "counts": {"bot": counts.get::<i64, _>("bot"), "waiting": counts.get::<i64, _>("waiting"), "mine": counts.get::<i64, _>("mine"), "open": counts.get::<i64, _>("open"), "breached": counts.get::<i64, _>("breached")},
        "me": {"id": s.agent.id, "name": s.agent.name},
        "agentsOnline": st.hub.staff_online_ids(t).len(),
    })))
}

async fn conv(st: &AppState, s: &Staff, id: i64) -> ApiResult<sqlx::postgres::PgRow> {
    sqlx::query("SELECT * FROM conversations WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)
}

pub async fn conversation(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    let r = conv(&st, &s, id).await?;
    let user: i64 = r.get("user_id");
    let history: Vec<Value> = sqlx::query("SELECT id, subject, status, created_at, csat_rating FROM conversations WHERE tenant = $1 AND user_id = $2 AND id <> $3 ORDER BY created_at DESC LIMIT 10")
        .bind(&s.agent.tenant)
        .bind(user)
        .bind(id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|h| json!({"id": h.get::<i64, _>("id"), "subject": h.get::<String, _>("subject"), "status": h.get::<String, _>("status"), "createdAt": h.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "csat": h.get::<Option<i16>, _>("csat_rating")}))
        .collect();
    Ok(Json(json!({"conversation": conv_json(&r), "messages": chat::messages(&st, id, true).await?, "history": history})))
}

pub async fn send(State(st): State<AppState>, s: Staff, Path(id): Path<i64>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    seen(&st, &s).await;
    let note = b["note"].as_bool().unwrap_or(false);
    let msg = chat::agent_message(&st, &s.agent, id, b["body"].as_str().unwrap_or(""), note, b["attachmentId"].as_i64()).await?;
    Ok(Json(json!({"message": msg, "conversation": conv_json(&conv(&st, &s, id).await?)})))
}

pub async fn assign(State(st): State<AppState>, s: Staff, Path(id): Path<i64>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let (to_id, to_name) = match b["staffId"].as_str().map(str::trim).filter(|x| !x.is_empty()) {
        Some(sid) => {
            let name: Option<String> = sqlx::query_scalar("SELECT name FROM agents WHERE tenant = $1 AND staff_id = $2").bind(&s.agent.tenant).bind(sid).fetch_optional(&st.pool).await?;
            let name = name.or_else(|| b["staffName"].as_str().map(|n| clean(n, 80))).ok_or_else(|| invalid("staffId", "Unknown agent."))?;
            (sid.to_string(), name)
        }
        None => (s.agent.id.clone(), s.agent.name.clone()),
    };
    Ok(Json(json!({"conversation": chat::take(&st, &s.agent, id, &to_id, &to_name, false).await?})))
}

pub async fn takeover(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    seen(&st, &s).await;
    Ok(Json(json!({"conversation": chat::take(&st, &s.agent, id, &s.agent.id.clone(), &s.agent.name.clone(), false).await?})))
}

pub async fn resolve(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    conv(&st, &s, id).await?;
    Ok(Json(json!({"conversation": chat::resolve(&st, &s.agent.tenant, id, &s.agent.actor(), false).await?})))
}

pub async fn reopen(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    Ok(Json(json!({"conversation": chat::reopen(&st, &s.agent, id).await?})))
}

pub async fn tags(State(st): State<AppState>, s: Staff, Path(id): Path<i64>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let tags: Vec<String> = b["tags"].as_array().map(|a| a.iter().filter_map(|t| t.as_str().map(str::to_string)).collect()).unwrap_or_default();
    Ok(Json(json!({"conversation": chat::set_tags(&st, &s.agent, id, &tags, b["priority"].as_str()).await?})))
}

pub async fn read(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    sqlx::query("UPDATE conversations SET staff_unread = 0 WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).execute(&st.pool).await?;
    chat::push_conv(&st, &s.agent.tenant, id).await;
    Ok(Json(json!({"status": "ok"})))
}

pub async fn typing(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let r = conv(&st, &s, id).await?;
    st.hub.send(&s.agent.tenant, Target::User(r.get("user_id")), json!({"type": "typing", "conversationId": id, "from": "agent", "name": s.agent.name}));
    Ok(Json(json!({"status": "ok"})))
}

/// User context panel: profile + KYC, trading accounts, wallet, previous chats.
pub async fn context(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    let r = conv(&st, &s, id).await?;
    let user: i64 = r.get("user_id");
    let mut ctx = crate::upstream::context(&st, &s.agent.tenant, user).await;
    let agg = sqlx::query("SELECT count(*) AS n, avg(csat_rating)::float8 AS csat FROM conversations WHERE tenant = $1 AND user_id = $2").bind(&s.agent.tenant).bind(user).fetch_one(&st.pool).await?;
    ctx["support"] = json!({"conversations": agg.get::<i64, _>("n"), "csatAvg": agg.get::<Option<f64>, _>("csat")});
    ctx["userId"] = json!(user);
    Ok(Json(ctx))
}

pub async fn upload(State(st): State<AppState>, s: Staff, Path(id): Path<i64>, up: Upload) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let r = conv(&st, &s, id).await?;
    Ok(Json(json!({"attachment": chat::upload(&st, &s.agent.tenant, r.get("user_id"), &format!("staff:{}", s.agent.id), &up.name, &up.bytes).await?})))
}

pub async fn attachment(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Response> {
    s.require("support.read")?;
    let (bytes, mime, name) = chat::read_attachment(&st, &s.agent.tenant, id, None).await?;
    Ok(file_response(bytes, &mime, &name))
}

pub async fn agents(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    seen(&st, &s).await;
    let rows = sqlx::query(
        "SELECT a.*, (SELECT count(*) FROM conversations c WHERE c.tenant = a.tenant AND c.assignee_id = a.staff_id AND c.status = 'assigned') AS open
         FROM agents a WHERE a.tenant = $1 AND a.last_seen > now() - interval '30 days' ORDER BY a.name",
    )
    .bind(&s.agent.tenant)
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let id: String = r.get("staff_id");
            let online = st.hub.staff_online(&s.agent.tenant, &id);
            json!({"id": id, "name": r.get::<String, _>("name"), "role": r.get::<String, _>("role"), "status": if online { r.get::<String, _>("status") } else { "offline".into() }, "open": r.get::<i64, _>("open"), "lastSeen": r.get::<chrono::DateTime<chrono::Utc>, _>("last_seen")})
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

pub async fn my_status(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    seen(&st, &s).await;
    let status = match b["status"].as_str() {
        Some("online") => "online",
        Some("away") => "away",
        _ => return Err(invalid("status", "online or away")),
    };
    sqlx::query("UPDATE agents SET status = $3 WHERE tenant = $1 AND staff_id = $2").bind(&s.agent.tenant).bind(&s.agent.id).bind(status).execute(&st.pool).await?;
    Ok(Json(json!({"status": status})))
}

/* ---------------- canned replies ---------------- */

fn canned_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({"id": r.get::<i64, _>("id"), "shortcut": r.get::<String, _>("shortcut"), "title": r.get::<String, _>("title"), "body": r.get::<String, _>("body"), "tags": r.get::<Vec<String>, _>("tags"), "useCount": r.get::<i32, _>("use_count"), "createdBy": r.get::<String, _>("created_by"), "updatedAt": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at")})
}

const DEFAULT_CANNED: &[(&str, &str, &str)] = &[
    ("/hi", "Greeting", "Hi {{first_name}}, {{agent_name}} here from Kalks support. I've read your conversation with our assistant. How can I help?"),
    ("/kyc", "Verification in review", "Thanks {{first_name}}. Your documents are with our compliance team, who usually decide within one business day. We'll email you as soon as there is a decision."),
    ("/wd", "Withdrawal check", "Thanks {{first_name}}. I'm checking your withdrawal with our payments team now and will update you here shortly."),
    ("/hash", "Ask for transaction hash", "Could you send me the transaction hash (TXID) of your deposit? You'll find it in the wallet you sent from."),
    ("/bye", "Closing", "Is there anything else I can help you with today, {{first_name}}? If not, I'll close this chat. You can rate it once it's closed."),
];

async fn ensure_canned(st: &AppState, tenant: &str) -> ApiResult<()> {
    if db::cursor(&st.pool, &format!("canned-seed:{tenant}")).await?.is_some() {
        return Ok(());
    }
    for (sc, title, body) in DEFAULT_CANNED {
        sqlx::query("INSERT INTO canned_replies (tenant, shortcut, title, body, created_by) VALUES ($1,$2,$3,$4,'system') ON CONFLICT DO NOTHING").bind(tenant).bind(sc).bind(title).bind(body).execute(&st.pool).await?;
    }
    db::set_cursor(&st.pool, &format!("canned-seed:{tenant}"), "v1").await?;
    Ok(())
}

pub async fn canned(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    ensure_canned(&st, &s.agent.tenant).await?;
    let rows = sqlx::query("SELECT * FROM canned_replies WHERE tenant = $1 ORDER BY use_count DESC, shortcut").bind(&s.agent.tenant).fetch_all(&st.pool).await?;
    Ok(Json(json!({"items": rows.iter().map(canned_json).collect::<Vec<_>>()})))
}

fn canned_fields(b: &Value) -> ApiResult<(String, String, String, Vec<String>)> {
    let mut shortcut = clean(b["shortcut"].as_str().unwrap_or(""), 32).to_lowercase().replace(' ', "-");
    if !shortcut.starts_with('/') {
        shortcut = format!("/{shortcut}");
    }
    if shortcut.len() < 2 || !shortcut[1..].chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(invalid("shortcut", "Use letters, digits, - or _ after the slash."));
    }
    let title = clean(b["title"].as_str().unwrap_or(""), 120);
    let body = clean(b["body"].as_str().unwrap_or(""), 4000);
    if title.is_empty() {
        return Err(invalid("title", "Add a title."));
    }
    if body.is_empty() {
        return Err(invalid("body", "Write the reply."));
    }
    let tags = b["tags"].as_array().map(|a| a.iter().filter_map(|t| t.as_str()).map(|t| clean(t, 32).to_lowercase()).filter(|t| !t.is_empty()).take(10).collect()).unwrap_or_default();
    Ok((shortcut, title, body, tags))
}

pub async fn canned_create(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let (sc, title, body, tags) = canned_fields(&b)?;
    let r = sqlx::query("INSERT INTO canned_replies (tenant, shortcut, title, body, tags, created_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant, shortcut) DO NOTHING RETURNING *")
        .bind(&s.agent.tenant)
        .bind(&sc)
        .bind(&title)
        .bind(&body)
        .bind(&tags)
        .bind(&s.agent.name)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| invalid("shortcut", "This shortcut is already used."))?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "canned.create", Some(format!("canned:{}", r.get::<i64, _>("id"))), None, Some(canned_json(&r)), None).await?;
    Ok(Json(json!({"item": canned_json(&r)})))
}

pub async fn canned_update(State(st): State<AppState>, s: Staff, Path(id): Path<i64>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let (sc, title, body, tags) = canned_fields(&b)?;
    let before = sqlx::query("SELECT * FROM canned_replies WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let r = sqlx::query("UPDATE canned_replies SET shortcut = $3, title = $4, body = $5, tags = $6, updated_at = now() WHERE tenant = $1 AND id = $2 RETURNING *")
        .bind(&s.agent.tenant)
        .bind(id)
        .bind(&sc)
        .bind(&title)
        .bind(&body)
        .bind(&tags)
        .fetch_one(&st.pool)
        .await
        .map_err(|_| invalid("shortcut", "This shortcut is already used."))?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "canned.update", Some(format!("canned:{id}")), Some(canned_json(&before)), Some(canned_json(&r)), None).await?;
    Ok(Json(json!({"item": canned_json(&r)})))
}

pub async fn canned_delete(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let r = sqlx::query("DELETE FROM canned_replies WHERE tenant = $1 AND id = $2 RETURNING *").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "canned.delete", Some(format!("canned:{id}")), Some(canned_json(&r)), None, None).await?;
    Ok(Json(json!({"status": "deleted"})))
}

pub async fn canned_use(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    sqlx::query("UPDATE canned_replies SET use_count = use_count + 1 WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).execute(&st.pool).await?;
    Ok(Json(json!({"status": "ok"})))
}

/* ---------------- knowledge base ---------------- */

#[derive(Deserialize)]
pub struct KbQ {
    q: Option<String>,
    category: Option<String>,
    source: Option<String>,
}

pub async fn kb_list(State(st): State<AppState>, s: Staff, Query(q): Query<KbQ>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    let rows = sqlx::query(
        "SELECT * FROM kb_articles WHERE tenant = $1 AND ($2::text IS NULL OR category = $2) AND ($3::text IS NULL OR source = $3)
           AND ($4::text IS NULL OR title ILIKE '%' || $4 || '%' OR body ILIKE '%' || $4 || '%' OR slug ILIKE '%' || $4 || '%')
         ORDER BY source = 'glossary', category, title LIMIT 600",
    )
    .bind(&s.agent.tenant)
    .bind(q.category.as_deref().filter(|x| !x.is_empty()))
    .bind(q.source.as_deref().filter(|x| !x.is_empty()))
    .bind(q.q.as_deref().map(str::trim).filter(|x| !x.is_empty()))
    .fetch_all(&st.pool)
    .await?;
    let cats: Vec<Value> = sqlx::query("SELECT category, count(*) AS n FROM kb_articles WHERE tenant = $1 GROUP BY category ORDER BY category")
        .bind(&s.agent.tenant)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| json!({"category": r.get::<String, _>("category"), "count": r.get::<i64, _>("n")}))
        .collect();
    let totals = sqlx::query("SELECT count(*) FILTER (WHERE status = 'published') AS published, count(*) FILTER (WHERE status = 'draft') AS drafts, COALESCE(sum(used_count), 0)::bigint AS used FROM kb_articles WHERE tenant = $1")
        .bind(&s.agent.tenant)
        .fetch_one(&st.pool)
        .await?;
    Ok(Json(json!({
        "items": rows.iter().map(kb::article_row).collect::<Vec<_>>(),
        "categories": cats,
        "totals": {"published": totals.get::<i64, _>("published"), "drafts": totals.get::<i64, _>("drafts"), "used": totals.get::<i64, _>("used")},
    })))
}

pub async fn kb_get(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    let r = sqlx::query("SELECT * FROM kb_articles WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    Ok(Json(json!({"item": kb::article_row(&r)})))
}

fn kb_fields(b: &Value) -> ApiResult<(String, String, String, Vec<String>, String)> {
    let title = clean(b["title"].as_str().unwrap_or(""), 160);
    let category = clean(b["category"].as_str().unwrap_or(""), 60);
    let body = clean(b["body"].as_str().unwrap_or(""), 20_000);
    if title.is_empty() {
        return Err(invalid("title", "Add a title."));
    }
    if category.is_empty() {
        return Err(invalid("category", "Choose a category."));
    }
    if body.chars().count() < 20 {
        return Err(invalid("body", "Write at least a couple of sentences."));
    }
    let tags = b["tags"].as_array().map(|a| a.iter().filter_map(|t| t.as_str()).map(|t| clean(t, 40).to_lowercase()).filter(|t| !t.is_empty()).take(20).collect()).unwrap_or_default();
    let status = if b["status"].as_str() == Some("draft") { "draft" } else { "published" }.to_string();
    Ok((title, category, body, tags, status))
}

fn slugify(s: &str) -> String {
    let mut out = String::new();
    for c in s.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-').chars().take(80).collect()
}

pub async fn kb_create(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let (title, category, body, tags, status) = kb_fields(&b)?;
    let base = b["slug"].as_str().map(slugify).filter(|x| !x.is_empty()).unwrap_or_else(|| slugify(&title));
    let base = if base.is_empty() { "article".to_string() } else { base };
    let mut slug = base.clone();
    for i in 2..50 {
        let taken: Option<i32> = sqlx::query_scalar("SELECT 1 FROM kb_articles WHERE tenant = $1 AND slug = $2").bind(&s.agent.tenant).bind(&slug).fetch_optional(&st.pool).await?;
        if taken.is_none() {
            break;
        }
        slug = format!("{base}-{i}");
    }
    let r = sqlx::query("INSERT INTO kb_articles (tenant, slug, title, category, body, tags, status, source, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'staff',$8) RETURNING *")
        .bind(&s.agent.tenant)
        .bind(&slug)
        .bind(&title)
        .bind(&category)
        .bind(&body)
        .bind(&tags)
        .bind(&status)
        .bind(&s.agent.name)
        .fetch_one(&st.pool)
        .await?;
    let a = kb::article_row(&r);
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "kb.create", Some(format!("kb:{}", a.slug)), None, Some(json!({"title": a.title, "status": a.status})), None).await?;
    Ok(Json(json!({"item": a})))
}

pub async fn kb_update(State(st): State<AppState>, s: Staff, Path(id): Path<i64>, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let (title, category, body, tags, status) = kb_fields(&b)?;
    let before = sqlx::query("SELECT * FROM kb_articles WHERE tenant = $1 AND id = $2").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let r = sqlx::query("UPDATE kb_articles SET title = $3, category = $4, body = $5, tags = $6, status = $7, updated_by = $8, updated_at = now() WHERE tenant = $1 AND id = $2 RETURNING *")
        .bind(&s.agent.tenant)
        .bind(id)
        .bind(&title)
        .bind(&category)
        .bind(&body)
        .bind(&tags)
        .bind(&status)
        .bind(&s.agent.name)
        .fetch_one(&st.pool)
        .await?;
    let b4 = kb::article_row(&before);
    let a = kb::article_row(&r);
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "kb.update", Some(format!("kb:{}", a.slug)), Some(json!({"title": b4.title, "status": b4.status, "body": b4.body})), Some(json!({"title": a.title, "status": a.status, "body": a.body})), None).await?;
    Ok(Json(json!({"item": a})))
}

pub async fn kb_delete(State(st): State<AppState>, s: Staff, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let r = sqlx::query("DELETE FROM kb_articles WHERE tenant = $1 AND id = $2 RETURNING *").bind(&s.agent.tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let a = kb::article_row(&r);
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "kb.delete", Some(format!("kb:{}", a.slug)), Some(json!({"title": a.title, "body": a.body})), None, None).await?;
    Ok(Json(json!({"status": "deleted"})))
}

/// Tests the bot: which articles retrieval picks for a question, and the answer (Claude when configured).
pub async fn kb_test(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    let q = clean(b["question"].as_str().unwrap_or(""), 1000);
    if q.is_empty() {
        return Err(invalid("question", "Ask a question."));
    }
    if !st.limiter.hit(&format!("kbtest:{}:{}", s.agent.tenant, s.agent.id), 30, std::time::Duration::from_secs(3600)) {
        return Err(ApiError::RateLimited("Too many test questions. Try again later.".into()));
    }
    let hits = kb::search(&st, &s.agent.tenant, &q, 5).await?;
    let turns = vec![crate::bot::Turn { from_client: true, text: q.clone() }];
    let reply = crate::bot::answer(&st, &s.agent.tenant, &turns, "", &|_| {}).await;
    Ok(Json(json!({
        "hits": hits.iter().map(|h| json!({"id": h.id, "slug": h.slug, "title": h.title, "category": h.category, "score": h.score})).collect::<Vec<_>>(),
        "answer": reply.text, "handover": reply.handover, "confidence": reply.confidence, "engine": reply.engine, "model": reply.model,
        "cites": reply.cites.iter().map(|(s, t)| json!({"slug": s, "title": t})).collect::<Vec<_>>(),
    })))
}

/* ---------------- stats, settings, audit ---------------- */

#[derive(Deserialize)]
pub struct StatsQ {
    days: Option<i64>,
}

pub async fn stats(State(st): State<AppState>, s: Staff, Query(q): Query<StatsQ>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    Ok(Json(crate::stats::stats(&st, &s.agent.tenant, q.days.unwrap_or(30)).await?))
}

pub async fn settings(State(st): State<AppState>, s: Staff) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    Ok(Json(json!({"settings": db::settings(&st.pool, &s.agent.tenant).await?, "ai": !st.cfg.anthropic_key.is_empty(), "model": st.cfg.ai_model})))
}

pub async fn settings_put(State(st): State<AppState>, s: Staff, Body(b): Body) -> ApiResult<Json<Value>> {
    s.require("support.write")?;
    let before = db::settings(&st.pool, &s.agent.tenant).await?;
    let mut next = before.clone();
    if let Some(v) = b["autopilot"].as_bool() {
        next.autopilot = v;
    }
    if let Some(v) = b["botName"].as_str() {
        let v = clean(v, 40);
        if v.is_empty() {
            return Err(invalid("botName", "Give the assistant a name."));
        }
        next.bot_name = v;
    }
    if let Some(v) = b["greeting"].as_str() {
        next.greeting = clean(v, 500);
    }
    if let Some(v) = b["slaFirstSecs"].as_i64() {
        if !(30..=86_400).contains(&v) {
            return Err(invalid("slaFirstSecs", "Between 30 seconds and 24 hours."));
        }
        next.sla_first_secs = v;
    }
    if let Some(v) = b["slaReplySecs"].as_i64() {
        if !(30..=86_400).contains(&v) {
            return Err(invalid("slaReplySecs", "Between 30 seconds and 24 hours."));
        }
        next.sla_reply_secs = v;
    }
    if let Some(v) = b["botPerHour"].as_i64() {
        next.bot_per_hour = v.clamp(1, 500);
    }
    if let Some(v) = b["emailReplies"].as_bool() {
        next.email_replies = v;
    }
    db::save_settings(&st.pool, &s.agent.tenant, &next, &format!("staff:{}", s.agent.id)).await?;
    audit::record(&st.pool, &s.agent.tenant, &s.agent.actor(), "settings.update", Some("support:settings".into()), Some(serde_json::to_value(&before)?), Some(serde_json::to_value(&next)?), None).await?;
    Ok(Json(json!({"settings": next})))
}

#[derive(Deserialize)]
pub struct AuditQ {
    before: Option<i64>,
    limit: Option<i64>,
    action: Option<String>,
}

pub async fn audit(State(st): State<AppState>, s: Staff, Query(q): Query<AuditQ>) -> ApiResult<Json<Value>> {
    s.require("support.read")?;
    let rows = sqlx::query(
        "SELECT * FROM audit_log WHERE tenant = $1 AND ($2::bigint IS NULL OR id < $2) AND ($4::text IS NULL OR action LIKE $4 || '%') ORDER BY id DESC LIMIT $3",
    )
    .bind(&s.agent.tenant)
    .bind(q.before)
    .bind(clamp_limit(q.limit, 50, 200))
    .bind(q.action.as_deref().filter(|x| !x.is_empty()))
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"id": r.get::<i64, _>("id"), "actor": r.get::<String, _>("actor"), "actorName": r.get::<Option<String>, _>("actor_name"), "action": r.get::<String, _>("action"), "target": r.get::<Option<String>, _>("target"),
                   "before": r.get::<Option<sqlx::types::Json<Value>>, _>("before").map(|j| j.0), "after": r.get::<Option<sqlx::types::Json<Value>>, _>("after").map(|j| j.0), "note": r.get::<Option<String>, _>("note"), "at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at")})
        })
        .collect();
    Ok(Json(json!({"items": items})))
}
