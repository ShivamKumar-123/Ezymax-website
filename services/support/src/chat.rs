//! Conversations: client messages, the AI bot, handover to humans, assignment, SLA timers, resolve, CSAT,
//! attachments. Every change is pushed on the realtime hub to the client and to Back Office agents.

use crate::audit::{self, Actor};
use crate::bot::{self, Turn};
use crate::db;
use crate::error::{ApiError, ApiResult, conflict, invalid};
use crate::notify::{self, EmailMode, NewNotification};
use crate::state::{AppState, Target};
use crate::util::{clean, preview};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use sqlx::postgres::PgRow;

pub const MAX_BODY: usize = 4000;

/// The signed-in client, as the CRM BFF resolved it.
#[derive(Clone, Debug)]
pub struct Client {
    pub tenant: String,
    pub id: i64,
    pub name: String,
    pub email: String,
}

impl Client {
    pub fn first_name(&self) -> String {
        self.name.split_whitespace().next().unwrap_or("").to_string()
    }
}

/// A Back Office agent, as the admin BFF verified it.
#[derive(Clone, Debug)]
pub struct Agent {
    pub tenant: String,
    pub id: String,
    pub name: String,
    pub role: String,
}

impl Agent {
    pub fn actor(&self) -> Actor {
        Actor { id: format!("staff:{}", self.id), name: Some(self.name.clone()) }
    }
}

pub fn conv_json(r: &PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "userId": r.get::<i64, _>("user_id"),
        "userName": r.get::<String, _>("user_name"),
        "userEmail": r.get::<String, _>("user_email"),
        "subject": r.get::<String, _>("subject"),
        "status": r.get::<String, _>("status"),
        "channel": r.get::<String, _>("channel"),
        "priority": r.get::<String, _>("priority"),
        "tags": r.get::<Vec<String>, _>("tags"),
        "assigneeId": r.get::<Option<String>, _>("assignee_id"),
        "assigneeName": r.get::<Option<String>, _>("assignee_name"),
        "handoverReason": r.get::<Option<String>, _>("handover_reason"),
        "handedOverAt": r.get::<Option<DateTime<Utc>>, _>("handed_over_at"),
        "firstResponseAt": r.get::<Option<DateTime<Utc>>, _>("first_response_at"),
        "slaDueAt": r.get::<Option<DateTime<Utc>>, _>("sla_due_at"),
        "slaBreached": r.get::<bool, _>("sla_breached"),
        "preview": r.get::<String, _>("preview"),
        "clientUnread": r.get::<i32, _>("client_unread"),
        "staffUnread": r.get::<i32, _>("staff_unread"),
        "botReplies": r.get::<i32, _>("bot_replies"),
        "csat": r.get::<Option<i16>, _>("csat_rating").map(|x| json!({"rating": x, "comment": r.get::<Option<String>, _>("csat_comment"), "at": r.get::<Option<DateTime<Utc>>, _>("csat_at")})),
        "resolvedAt": r.get::<Option<DateTime<Utc>>, _>("resolved_at"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "lastMessageAt": r.get::<DateTime<Utc>, _>("last_message_at"),
    })
}

/// Conversation as the client sees it (no staff-only fields).
pub fn conv_client_json(r: &PgRow) -> Value {
    let mut v = conv_json(r);
    if let Some(o) = v.as_object_mut() {
        for k in ["userEmail", "tags", "priority", "handoverReason", "slaDueAt", "slaBreached", "staffUnread", "botReplies", "assigneeId"] {
            o.remove(k);
        }
    }
    v
}

const MSG_SELECT: &str = "SELECT m.*, a.file_name, a.mime, a.size_bytes FROM messages m LEFT JOIN attachments a ON a.id = m.attachment_id";

pub fn msg_json(r: &PgRow) -> Value {
    let att = r.get::<Option<i64>, _>("attachment_id").map(|id| json!({"id": id, "name": r.get::<Option<String>, _>("file_name"), "mime": r.get::<Option<String>, _>("mime"), "size": r.get::<Option<i32>, _>("size_bytes")}));
    json!({
        "id": r.get::<i64, _>("id"),
        "conversationId": r.get::<i64, _>("conversation_id"),
        "author": r.get::<String, _>("author"),
        "authorId": r.get::<Option<String>, _>("author_id"),
        "authorName": r.get::<Option<String>, _>("author_name"),
        "body": r.get::<String, _>("body"),
        "attachment": att,
        "meta": r.get::<sqlx::types::Json<Value>, _>("meta").0,
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
    })
}

async fn load_conv(st: &AppState, tenant: &str, id: i64) -> ApiResult<PgRow> {
    sqlx::query("SELECT * FROM conversations WHERE tenant = $1 AND id = $2").bind(tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)
}

pub async fn conv_for_client(st: &AppState, c: &Client, id: i64) -> ApiResult<PgRow> {
    let r = load_conv(st, &c.tenant, id).await?;
    if r.get::<i64, _>("user_id") != c.id {
        return Err(ApiError::NotFound);
    }
    Ok(r)
}

pub async fn messages(st: &AppState, conv: i64, include_notes: bool) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("{MSG_SELECT} WHERE m.conversation_id = $1 AND ($2 OR m.author <> 'note') ORDER BY m.id")))
        .bind(conv)
        .bind(include_notes)
        .fetch_all(&st.pool)
        .await?;
    Ok(rows.iter().map(msg_json).collect())
}

async fn message_by_id(st: &AppState, id: i64) -> ApiResult<Value> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("{MSG_SELECT} WHERE m.id = $1"))).bind(id).fetch_one(&st.pool).await?;
    Ok(msg_json(&r))
}

/// Pushes the conversation to its client and to every agent.
pub async fn push_conv(st: &AppState, tenant: &str, id: i64) {
    if let Ok(r) = load_conv(st, tenant, id).await {
        let user: i64 = r.get("user_id");
        st.hub.send(tenant, Target::User(user), json!({"type": "conversation", "conversation": conv_client_json(&r)}));
        st.hub.send(tenant, Target::AllStaff, json!({"type": "conversation", "conversation": conv_json(&r)}));
    }
}

fn push_msg(st: &AppState, tenant: &str, user: i64, msg: &Value) {
    if msg["author"] != "note" {
        st.hub.send(tenant, Target::User(user), json!({"type": "message", "message": msg}));
    }
    st.hub.send(tenant, Target::AllStaff, json!({"type": "message", "message": msg}));
}

async fn insert_msg(st: &AppState, tenant: &str, conv: i64, author: &str, author_id: Option<&str>, author_name: Option<&str>, body: &str, attachment: Option<i64>, meta: Value) -> ApiResult<Value> {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO messages (tenant, conversation_id, author, author_id, author_name, body, attachment_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    )
    .bind(tenant)
    .bind(conv)
    .bind(author)
    .bind(author_id)
    .bind(author_name)
    .bind(body)
    .bind(attachment)
    .bind(sqlx::types::Json(&meta))
    .fetch_one(&st.pool)
    .await?;
    message_by_id(st, id).await
}

/// The client's open conversation, if any.
pub async fn open_for(st: &AppState, c: &Client) -> ApiResult<Option<PgRow>> {
    Ok(sqlx::query("SELECT * FROM conversations WHERE tenant = $1 AND user_id = $2 AND status <> 'resolved'").bind(&c.tenant).bind(c.id).fetch_optional(&st.pool).await?)
}

async fn check_attachment(st: &AppState, tenant: &str, user_id: i64, conv: i64, id: Option<i64>) -> ApiResult<Option<i64>> {
    let Some(id) = id else { return Ok(None) };
    let r = sqlx::query("SELECT user_id, conversation_id, (SELECT count(*) FROM messages WHERE attachment_id = attachments.id) AS used FROM attachments WHERE tenant = $1 AND id = $2")
        .bind(tenant)
        .bind(id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| invalid("attachmentId", "Attachment not found."))?;
    if r.get::<i64, _>("user_id") != user_id || r.get::<i64, _>("used") > 0 || r.get::<Option<i64>, _>("conversation_id").is_some_and(|c| c != conv) {
        return Err(invalid("attachmentId", "Attachment not found."));
    }
    sqlx::query("UPDATE attachments SET conversation_id = $2 WHERE id = $1").bind(id).bind(conv).execute(&st.pool).await?;
    Ok(Some(id))
}

/// A client message. Opens a conversation when none is open (bot first when autopilot is on), then either
/// runs the bot or queues it for the agents.
pub async fn client_message(st: &AppState, c: &Client, body: &str, attachment: Option<i64>) -> ApiResult<Value> {
    let body = clean(body, MAX_BODY);
    if body.is_empty() && attachment.is_none() {
        return Err(invalid("body", "Write a message."));
    }
    if !st.limiter.hit(&format!("msg:{}:{}", c.tenant, c.id), 30, std::time::Duration::from_secs(60)) {
        return Err(ApiError::RateLimited("You're sending messages too quickly. Please wait a moment.".into()));
    }
    let settings = db::settings(&st.pool, &c.tenant).await?;
    let (conv, created) = match open_for(st, c).await? {
        Some(r) => (r, false),
        None => {
            let status = if settings.autopilot { "bot" } else { "waiting" };
            let subject: String = preview(if body.is_empty() { "Attachment" } else { &body }).chars().take(80).collect();
            let r = sqlx::query(
                "INSERT INTO conversations (tenant, user_id, user_name, user_email, subject, status, handed_over_at, sla_due_at, handover_reason)
                 VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $6 = 'waiting' THEN now() END, CASE WHEN $6 = 'waiting' THEN now() + make_interval(secs => $7) END,
                         CASE WHEN $6 = 'waiting' THEN 'AI autopilot off' END)
                 ON CONFLICT (tenant, user_id) WHERE status <> 'resolved' DO NOTHING RETURNING *",
            )
            .bind(&c.tenant)
            .bind(c.id)
            .bind(&c.name)
            .bind(&c.email)
            .bind(&subject)
            .bind(status)
            .bind(settings.sla_first_secs as f64)
            .fetch_optional(&st.pool)
            .await?;
            match r {
                Some(r) => (r, true),
                None => (open_for(st, c).await?.ok_or(ApiError::Internal(anyhow::anyhow!("conversation race")))?, false),
            }
        }
    };
    let conv_id: i64 = conv.get("id");
    let status: String = conv.get("status");
    let attachment = check_attachment(st, &c.tenant, c.id, conv_id, attachment).await?;
    let msg = insert_msg(st, &c.tenant, conv_id, "client", Some(&c.id.to_string()), Some(&c.name), &body, attachment, json!({})).await?;
    let pv = if body.is_empty() { "Sent an attachment".to_string() } else { preview(&body) };
    // an agent owes a reply: start the reply SLA if none is running
    sqlx::query(
        "UPDATE conversations SET preview = $2, last_message_at = now(), updated_at = now(), staff_unread = staff_unread + CASE WHEN status = 'bot' THEN 0 ELSE 1 END,
                user_name = CASE WHEN $3 <> '' THEN $3 ELSE user_name END, user_email = CASE WHEN $4 <> '' THEN $4 ELSE user_email END,
                sla_due_at = CASE WHEN status = 'assigned' AND sla_due_at IS NULL THEN now() + make_interval(secs => $5) ELSE sla_due_at END
         WHERE id = $1",
    )
    .bind(conv_id)
    .bind(&pv)
    .bind(&c.name)
    .bind(&c.email)
    .bind(settings.sla_reply_secs as f64)
    .execute(&st.pool)
    .await?;
    push_msg(st, &c.tenant, c.id, &msg);
    if created && status == "waiting" {
        insert_system(st, &c.tenant, c.id, conv_id, "You're in the queue. A support agent will join shortly.", json!({"kind": "queued"})).await?;
        alert_agents(st, &c.tenant, conv_id, &c.name, &pv).await;
    }
    push_conv(st, &c.tenant, conv_id).await;
    if status == "bot" {
        let st2 = st.clone();
        let c2 = c.clone();
        tokio::spawn(async move {
            if let Err(e) = run_bot(&st2, &c2, conv_id).await {
                tracing::error!(error = ?e, conv = conv_id, "bot failed");
            }
        });
    }
    Ok(json!({"conversation": conv_client_json(&load_conv(st, &c.tenant, conv_id).await?), "message": msg}))
}

async fn insert_system(st: &AppState, tenant: &str, user: i64, conv: i64, text: &str, meta: Value) -> ApiResult<Value> {
    let m = insert_msg(st, tenant, conv, "system", None, None, text, None, meta).await?;
    push_msg(st, tenant, user, &m);
    Ok(m)
}

/// Runs the bot on the latest client message (one answer at a time per conversation).
pub async fn run_bot(st: &AppState, c: &Client, conv_id: i64) -> ApiResult<()> {
    let lock = st.bot_lock(conv_id);
    let _g = lock.lock().await;
    let conv = load_conv(st, &c.tenant, conv_id).await?;
    if conv.get::<String, _>("status") != "bot" {
        return Ok(());
    }
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("{MSG_SELECT} WHERE m.conversation_id = $1 AND m.author IN ('client', 'bot', 'agent') ORDER BY m.id")))
        .bind(conv_id)
        .fetch_all(&st.pool)
        .await?;
    // already answered (several client messages queued behind one answer)
    if rows.last().map(|r| r.get::<String, _>("author")) != Some("client".into()) {
        return Ok(());
    }
    let turns: Vec<Turn> = rows
        .iter()
        .map(|r| {
            let author: String = r.get("author");
            let mut text: String = r.get("body");
            if let Some(name) = r.get::<Option<String>, _>("file_name") {
                text = format!("{text}\n[attached file: {name}]").trim().to_string();
            }
            Turn { from_client: author == "client", text }
        })
        .collect();
    let settings = db::settings(&st.pool, &c.tenant).await?;
    let stream_id = crate::util::token(6);
    st.hub.send(&c.tenant, Target::User(c.id), json!({"type": "bot.typing", "conversationId": conv_id, "streamId": stream_id}));
    let reply = if !st.limiter.hit(&format!("bot:{}:{}", c.tenant, c.id), settings.bot_per_hour.max(1) as usize, std::time::Duration::from_secs(3600)) {
        bot::Reply { text: "You've asked a lot of questions in a short time, so I'm passing this conversation to our support team.".into(), handover: Some("bot limit reached".into()), engine: "rules", ..Default::default() }
    } else {
        let hub = st.hub.clone();
        let tenant = c.tenant.clone();
        let uid = c.id;
        let sid = stream_id.clone();
        let on_delta = move |d: &str| {
            let payload = json!({"type": "bot.delta", "conversationId": conv_id, "streamId": sid, "text": d});
            hub.send(&tenant, Target::User(uid), payload.clone());
            hub.send(&tenant, Target::AllStaff, payload);
        };
        bot::answer(st, &c.tenant, &turns, &c.first_name(), &on_delta).await
    };
    let cites: Vec<Value> = reply.cites.iter().map(|(s, t)| json!({"slug": s, "title": t})).collect();
    let meta = json!({"cites": cites, "confidence": reply.confidence, "engine": reply.engine, "model": reply.model, "streamId": stream_id, "handover": reply.handover});
    let msg = insert_msg(st, &c.tenant, conv_id, "bot", Some("bot"), Some(&settings.bot_name), &reply.text, None, meta).await?;
    sqlx::query("UPDATE conversations SET preview = $2, last_message_at = now(), updated_at = now(), bot_replies = bot_replies + 1 WHERE id = $1").bind(conv_id).bind(preview(&reply.text)).execute(&st.pool).await?;
    for (slug, _) in &reply.cites {
        sqlx::query("UPDATE kb_articles SET used_count = used_count + 1 WHERE tenant = $1 AND slug = $2").bind(&c.tenant).bind(slug).execute(&st.pool).await?;
    }
    push_msg(st, &c.tenant, c.id, &msg);
    if let Some(reason) = reply.handover {
        handover(st, &c.tenant, conv_id, &reason, &Actor { id: "bot".into(), name: Some(settings.bot_name.clone()) }).await?;
    } else {
        push_conv(st, &c.tenant, conv_id).await;
    }
    Ok(())
}

/// Staff in-app alert for a conversation waiting for an agent: online agents, else every known agent.
async fn alert_agents(st: &AppState, tenant: &str, conv: i64, client: &str, pv: &str) {
    let mut ids = st.hub.staff_online_ids(tenant);
    if ids.is_empty() {
        ids = sqlx::query_scalar("SELECT staff_id FROM agents WHERE tenant = $1 AND last_seen > now() - interval '30 days'").bind(tenant).fetch_all(&st.pool).await.unwrap_or_default();
    }
    for id in ids {
        let n = NewNotification::staff(&id, "support.waiting", format!("{client} is waiting for an agent"), pv.to_string())
            .severity("warning")
            .link(format!("/support?c={conv}"))
            .dedupe(format!("support:waiting:{conv}:{}", Utc::now().timestamp() / 60))
            .data(json!({"conversationId": conv}));
        if let Err(e) = notify::deliver(st, tenant, n).await {
            tracing::warn!(error = %e, "staff alert failed");
        }
    }
}

/// Hands the conversation to the human queue (client request, bot decision or staff).
pub async fn handover(st: &AppState, tenant: &str, conv_id: i64, reason: &str, by: &Actor) -> ApiResult<Value> {
    let settings = db::settings(&st.pool, tenant).await?;
    let r = sqlx::query(
        "UPDATE conversations SET status = 'waiting', handover_reason = $2, handed_over_at = now(), sla_due_at = now() + make_interval(secs => $3), sla_breached = false,
                staff_unread = GREATEST(staff_unread, 1), updated_at = now()
         WHERE id = $1 AND tenant = $4 AND status = 'bot' RETURNING *",
    )
    .bind(conv_id)
    .bind(reason)
    .bind(settings.sla_first_secs as f64)
    .bind(tenant)
    .fetch_optional(&st.pool)
    .await?;
    let Some(r) = r else {
        let cur = load_conv(st, tenant, conv_id).await?;
        return Ok(conv_json(&cur));
    };
    let user: i64 = r.get("user_id");
    let online = st.hub.staff_online_ids(tenant).len();
    let text = if online > 0 { "Connecting you with a support agent. They'll see this conversation, so you won't need to repeat anything." } else { "Connecting you with a support agent. Our team will reply here as soon as possible, and we'll email you when they do." };
    insert_system(st, tenant, user, conv_id, text, json!({"kind": "handover", "reason": reason, "by": by.id})).await?;
    audit::record(&st.pool, tenant, by, "conversation.handover", Some(format!("conversation:{conv_id}")), None, Some(json!({"reason": reason})), None).await?;
    alert_agents(st, tenant, conv_id, &r.get::<String, _>("user_name"), &r.get::<String, _>("preview")).await;
    push_conv(st, tenant, conv_id).await;
    Ok(conv_json(&load_conv(st, tenant, conv_id).await?))
}

/// An agent reply (or internal note). Replying takes the conversation if nobody owns it.
pub async fn agent_message(st: &AppState, a: &Agent, conv_id: i64, body: &str, note: bool, attachment: Option<i64>) -> ApiResult<Value> {
    let body = clean(body, MAX_BODY);
    if body.is_empty() && attachment.is_none() {
        return Err(invalid("body", "Write a message."));
    }
    let conv = load_conv(st, &a.tenant, conv_id).await?;
    let status: String = conv.get("status");
    let user: i64 = conv.get("user_id");
    if status == "resolved" && !note {
        return Err(conflict("resolved", "This conversation is resolved. Reopen it to reply."));
    }
    if !note && conv.get::<Option<String>, _>("assignee_id").is_none() {
        take(st, a, conv_id, &a.id, &a.name, true).await?;
    }
    let attachment = check_attachment(st, &a.tenant, user, conv_id, attachment).await?;
    let author = if note { "note" } else { "agent" };
    let msg = insert_msg(st, &a.tenant, conv_id, author, Some(&a.id), Some(&a.name), &body, attachment, json!({})).await?;
    if !note {
        let pv = if body.is_empty() { "Sent an attachment".to_string() } else { preview(&body) };
        sqlx::query(
            "UPDATE conversations SET preview = $2, last_message_at = now(), updated_at = now(), client_unread = client_unread + 1, staff_unread = 0,
                    first_response_at = COALESCE(first_response_at, now()), sla_due_at = NULL
             WHERE id = $1",
        )
        .bind(conv_id)
        .bind(&pv)
        .execute(&st.pool)
        .await?;
    }
    push_msg(st, &a.tenant, user, &msg);
    push_conv(st, &a.tenant, conv_id).await;
    if !note {
        // bell + email (per preferences) when the client isn't watching the chat
        let settings = db::settings(&st.pool, &a.tenant).await?;
        let online = st.hub.user_online(&a.tenant, user);
        let mut n = NewNotification::user(user, "support.reply", format!("{} replied to your support chat", a.name), preview(if body.is_empty() { "Sent you a file" } else { &body }))
            .link("/support")
            .data(json!({"conversationId": conv_id}))
            .dedupe(format!("support:reply:{}", msg["id"]));
        n.email = if !online && settings.email_replies { EmailMode::Prefs } else { EmailMode::Never };
        let email = conv.get::<String, _>("user_email");
        if email.contains('@') {
            n.email_to = Some(email);
        }
        n.email_subject = Some("New reply from Ezymex support".into());
        if let Err(e) = notify::deliver(st, &a.tenant, n).await {
            tracing::warn!(error = %e, "reply notification failed");
        }
    }
    Ok(msg)
}

/// Assigns (or takes) a conversation. `silent_join` = the agent's first reply takes it.
pub async fn take(st: &AppState, by: &Agent, conv_id: i64, to_id: &str, to_name: &str, silent_join: bool) -> ApiResult<Value> {
    let before = load_conv(st, &by.tenant, conv_id).await?;
    if before.get::<String, _>("status") == "resolved" {
        return Err(conflict("resolved", "This conversation is resolved."));
    }
    let prev: Option<String> = before.get("assignee_id");
    if prev.as_deref() == Some(to_id) {
        return Ok(conv_json(&before));
    }
    let settings = db::settings(&st.pool, &by.tenant).await?;
    sqlx::query(
        "UPDATE conversations SET status = 'assigned', assignee_id = $2, assignee_name = $3, updated_at = now(),
                handed_over_at = COALESCE(handed_over_at, now()), handover_reason = COALESCE(handover_reason, 'agent took over'),
                sla_due_at = CASE WHEN sla_due_at IS NULL AND first_response_at IS NULL THEN now() + make_interval(secs => $4) ELSE sla_due_at END
         WHERE id = $1",
    )
    .bind(conv_id)
    .bind(to_id)
    .bind(to_name)
    .bind(settings.sla_first_secs as f64)
    .execute(&st.pool)
    .await?;
    let user: i64 = before.get("user_id");
    let text = if prev.is_some() { format!("{to_name} took over the chat") } else { format!("{to_name} joined the chat") };
    insert_system(st, &by.tenant, user, conv_id, &text, json!({"kind": "join", "agentId": to_id, "agentName": to_name, "silent": silent_join})).await?;
    audit::record(&st.pool, &by.tenant, &by.actor(), "conversation.assign", Some(format!("conversation:{conv_id}")), Some(json!({"assignee": prev})), Some(json!({"assignee": to_id, "name": to_name})), None).await?;
    if to_id != by.id {
        let n = NewNotification::staff(to_id, "support.assigned", format!("{} assigned you a conversation", by.name), before.get::<String, _>("preview"))
            .link(format!("/support?c={conv_id}"))
            .data(json!({"conversationId": conv_id}));
        let _ = notify::deliver(st, &by.tenant, n).await;
    }
    push_conv(st, &by.tenant, conv_id).await;
    Ok(conv_json(&load_conv(st, &by.tenant, conv_id).await?))
}

pub async fn resolve(st: &AppState, tenant: &str, conv_id: i64, by: &Actor, by_client: bool) -> ApiResult<Value> {
    let r = sqlx::query("UPDATE conversations SET status = 'resolved', resolved_at = now(), resolved_by = $3, sla_due_at = NULL, updated_at = now() WHERE id = $1 AND tenant = $2 AND status <> 'resolved' RETURNING user_id")
        .bind(conv_id)
        .bind(tenant)
        .bind(&by.id)
        .fetch_optional(&st.pool)
        .await?;
    if let Some(r) = r {
        let user: i64 = r.get("user_id");
        let text = if by_client { "You ended the chat".to_string() } else { format!("Conversation resolved by {}", by.name.clone().unwrap_or_default()) };
        insert_system(st, tenant, user, conv_id, &text, json!({"kind": "resolved", "by": by.id})).await?;
        if !by_client {
            audit::record(&st.pool, tenant, by, "conversation.resolve", Some(format!("conversation:{conv_id}")), None, None, None).await?;
        }
        push_conv(st, tenant, conv_id).await;
    }
    Ok(conv_json(&load_conv(st, tenant, conv_id).await?))
}

pub async fn reopen(st: &AppState, a: &Agent, conv_id: i64) -> ApiResult<Value> {
    let conv = load_conv(st, &a.tenant, conv_id).await?;
    let user: i64 = conv.get("user_id");
    if conv.get::<String, _>("status") != "resolved" {
        return Ok(conv_json(&conv));
    }
    let open: Option<i64> = sqlx::query_scalar("SELECT id FROM conversations WHERE tenant = $1 AND user_id = $2 AND status <> 'resolved'").bind(&a.tenant).bind(user).fetch_optional(&st.pool).await?;
    if open.is_some() {
        return Err(conflict("open_exists", "The client already has an open conversation."));
    }
    sqlx::query("UPDATE conversations SET status = 'assigned', assignee_id = $2, assignee_name = $3, resolved_at = NULL, resolved_by = NULL, updated_at = now() WHERE id = $1")
        .bind(conv_id)
        .bind(&a.id)
        .bind(&a.name)
        .execute(&st.pool)
        .await?;
    insert_system(st, &a.tenant, user, conv_id, &format!("{} reopened the chat", a.name), json!({"kind": "reopened"})).await?;
    audit::record(&st.pool, &a.tenant, &a.actor(), "conversation.reopen", Some(format!("conversation:{conv_id}")), None, None, None).await?;
    push_conv(st, &a.tenant, conv_id).await;
    Ok(conv_json(&load_conv(st, &a.tenant, conv_id).await?))
}

/// CSAT: 1–5 stars (+ optional comment) on a resolved conversation. Can be changed for 7 days.
pub async fn rate(st: &AppState, c: &Client, conv_id: i64, rating: i64, comment: &str) -> ApiResult<Value> {
    if !(1..=5).contains(&rating) {
        return Err(invalid("rating", "Choose 1 to 5 stars."));
    }
    let conv = conv_for_client(st, c, conv_id).await?;
    if conv.get::<String, _>("status") != "resolved" {
        return Err(conflict("not_resolved", "You can rate the chat once it has ended."));
    }
    if conv.get::<Option<DateTime<Utc>>, _>("resolved_at").is_some_and(|t| Utc::now() - t > chrono::Duration::days(7)) {
        return Err(conflict("expired", "This chat can no longer be rated."));
    }
    let comment = clean(comment, 1000);
    sqlx::query("UPDATE conversations SET csat_rating = $2, csat_comment = NULLIF($3, ''), csat_at = now() WHERE id = $1").bind(conv_id).bind(rating as i16).bind(&comment).execute(&st.pool).await?;
    let m = insert_msg(st, &c.tenant, conv_id, "system", None, None, &format!("Rated the chat {rating} out of 5"), None, json!({"kind": "csat", "rating": rating, "comment": comment})).await?;
    st.hub.send(&c.tenant, Target::AllStaff, json!({"type": "message", "message": m}));
    push_conv(st, &c.tenant, conv_id).await;
    Ok(conv_client_json(&load_conv(st, &c.tenant, conv_id).await?))
}

pub async fn set_tags(st: &AppState, a: &Agent, conv_id: i64, tags: &[String], priority: Option<&str>) -> ApiResult<Value> {
    let before = load_conv(st, &a.tenant, conv_id).await?;
    let mut clean_tags: Vec<String> = tags.iter().map(|t| clean(t, 32).to_lowercase()).filter(|t| !t.is_empty()).collect();
    clean_tags.sort();
    clean_tags.dedup();
    clean_tags.truncate(12);
    let prio = priority.filter(|p| *p == "normal" || *p == "high").unwrap_or(&before.get::<String, _>("priority")).to_string();
    sqlx::query("UPDATE conversations SET tags = $2, priority = $3, updated_at = now() WHERE id = $1").bind(conv_id).bind(&clean_tags).bind(&prio).execute(&st.pool).await?;
    audit::record(&st.pool, &a.tenant, &a.actor(), "conversation.tags", Some(format!("conversation:{conv_id}")), Some(json!({"tags": before.get::<Vec<String>, _>("tags"), "priority": before.get::<String, _>("priority")})), Some(json!({"tags": clean_tags, "priority": prio})), None).await?;
    push_conv(st, &a.tenant, conv_id).await;
    Ok(conv_json(&load_conv(st, &a.tenant, conv_id).await?))
}

/// Marks SLA breaches (waiting / assigned past `sla_due_at`) and tells the agents. Returns how many.
pub async fn sla_sweep(st: &AppState) -> anyhow::Result<usize> {
    let rows = sqlx::query("UPDATE conversations SET sla_breached = true WHERE status IN ('waiting', 'assigned') AND sla_due_at < now() AND NOT sla_breached RETURNING id, tenant, assignee_id, user_name").fetch_all(&st.pool).await?;
    for r in &rows {
        let id: i64 = r.get("id");
        let tenant: String = r.get("tenant");
        let who: String = r.get("user_name");
        let targets: Vec<String> = match r.get::<Option<String>, _>("assignee_id") {
            Some(a) => vec![a],
            None => st.hub.staff_online_ids(&tenant),
        };
        for t in targets {
            let n = NewNotification::staff(&t, "support.sla_breached", format!("SLA breached: {who} is still waiting"), "Reply now to keep the client informed.").severity("critical").link(format!("/support?c={id}")).dedupe(format!("support:sla:{id}"));
            let _ = notify::deliver(st, &tenant, n).await;
        }
        push_conv(st, &tenant, id).await;
    }
    Ok(rows.len())
}

/* ---------------- attachments ---------------- */

/// Sniffs the file type from its first bytes: PNG, JPEG, GIF, WEBP or PDF only.
pub fn sniff(b: &[u8]) -> Option<(&'static str, &'static str)> {
    if b.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("image/png", "png"))
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("image/jpeg", "jpg"))
    } else if b.starts_with(b"GIF87a") || b.starts_with(b"GIF89a") {
        Some(("image/gif", "gif"))
    } else if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else if b.starts_with(b"%PDF-") {
        Some(("application/pdf", "pdf"))
    } else {
        None
    }
}

fn safe_name(name: &str, ext: &str) -> String {
    let base: String = name.chars().filter(|c| c.is_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ' | '(' | ')')).take(100).collect();
    let base = base.trim().trim_start_matches('.').to_string();
    let base = if base.is_empty() { "file".to_string() } else { base };
    if base.to_lowercase().ends_with(&format!(".{ext}")) || (ext == "jpg" && base.to_lowercase().ends_with(".jpeg")) { base } else { format!("{base}.{ext}") }
}

/// Stores an uploaded file (private storage dir, 0600) for a client's conversation.
pub async fn upload(st: &AppState, tenant: &str, user_id: i64, uploaded_by: &str, file_name: &str, bytes: &[u8]) -> ApiResult<Value> {
    if bytes.is_empty() {
        return Err(invalid("file", "The file is empty."));
    }
    if bytes.len() > st.cfg.max_attachment_bytes {
        return Err(ApiError::TooLarge(format!("Files can be up to {} MB.", st.cfg.max_attachment_bytes / 1024 / 1024)));
    }
    let Some((mime, ext)) = sniff(bytes) else {
        return Err(ApiError::Unsupported("Only images (PNG, JPG, GIF, WEBP) and PDF files can be attached.".into()));
    };
    let key = format!("{}/{}/{}.{ext}", tenant.replace(['/', '.'], ""), Utc::now().format("%Y%m"), crate::util::token(16));
    let path = std::path::Path::new(&st.cfg.storage_dir).join(&key);
    if let Some(dir) = path.parent() {
        tokio::fs::create_dir_all(dir).await?;
    }
    tokio::fs::write(&path, bytes).await?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = tokio::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).await;
    }
    let sha = Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect::<String>();
    let name = safe_name(file_name, ext);
    let id: i64 = sqlx::query_scalar("INSERT INTO attachments (tenant, user_id, uploaded_by, file_name, mime, size_bytes, sha256, storage_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id")
        .bind(tenant)
        .bind(user_id)
        .bind(uploaded_by)
        .bind(&name)
        .bind(mime)
        .bind(bytes.len() as i32)
        .bind(&sha)
        .bind(&key)
        .fetch_one(&st.pool)
        .await?;
    Ok(json!({"id": id, "name": name, "mime": mime, "size": bytes.len()}))
}

/// Reads an attachment; `user` restricts it to that client's files.
pub async fn read_attachment(st: &AppState, tenant: &str, id: i64, user: Option<i64>) -> ApiResult<(Vec<u8>, String, String)> {
    let r = sqlx::query("SELECT user_id, file_name, mime, storage_key FROM attachments WHERE tenant = $1 AND id = $2").bind(tenant).bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    if user.is_some_and(|u| u != r.get::<i64, _>("user_id")) {
        return Err(ApiError::NotFound);
    }
    let key: String = r.get("storage_key");
    if key.contains("..") {
        return Err(ApiError::NotFound);
    }
    let bytes = tokio::fs::read(std::path::Path::new(&st.cfg.storage_dir).join(&key)).await.map_err(|_| ApiError::NotFound)?;
    Ok((bytes, r.get("mime"), r.get("file_name")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_allowed_types_only() {
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\nrest").unwrap().0, "image/png");
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0]).unwrap().0, "image/jpeg");
        assert_eq!(sniff(b"%PDF-1.7").unwrap().0, "application/pdf");
        assert_eq!(sniff(b"RIFF\0\0\0\0WEBPVP8 ").unwrap().0, "image/webp");
        assert!(sniff(b"<html>").is_none());
        assert!(sniff(b"MZ\x90\0").is_none());
    }

    #[test]
    fn sanitises_file_names() {
        assert_eq!(safe_name("../../etc/passwd", "pdf"), "etcpasswd.pdf");
        assert_eq!(safe_name("statement.PDF", "pdf"), "statement.PDF");
        assert_eq!(safe_name("photo.jpeg", "jpg"), "photo.jpeg");
        assert_eq!(safe_name("", "png"), "file.png");
    }
}
