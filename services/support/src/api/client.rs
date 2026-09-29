//! Client Area routes (`/v1/support/me/*`): the signed-in client's chat with the bot and agents.

use super::{Body, Upload, file_response};
use crate::audit::Actor;
use crate::chat::{self, Client, conv_client_json};
use crate::db;
use crate::error::{ApiError, ApiResult};
use crate::state::{AppState, Target};
use axum::Json;
use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::{Value, json};
use sqlx::Row;

/// Chat home: settings, the open conversation (or the latest resolved one, for rating) and its messages.
pub async fn home(State(st): State<AppState>, c: Client) -> ApiResult<Json<Value>> {
    let s = db::settings(&st.pool, &c.tenant).await?;
    let conv = match chat::open_for(&st, &c).await? {
        Some(r) => Some(r),
        None => sqlx::query("SELECT * FROM conversations WHERE tenant = $1 AND user_id = $2 AND status = 'resolved' AND resolved_at > now() - interval '7 days' ORDER BY resolved_at DESC LIMIT 1")
            .bind(&c.tenant)
            .bind(c.id)
            .fetch_optional(&st.pool)
            .await?,
    };
    let messages = match &conv {
        Some(r) => chat::messages(&st, r.get("id"), false).await?,
        None => vec![],
    };
    Ok(Json(json!({
        "settings": {"botName": s.bot_name, "greeting": s.greeting, "autopilot": s.autopilot, "ai": !st.cfg.anthropic_key.is_empty(), "agentsOnline": st.hub.staff_online_ids(&c.tenant).len(), "maxAttachmentMb": st.cfg.max_attachment_bytes / 1024 / 1024},
        "conversation": conv.as_ref().map(conv_client_json),
        "messages": messages,
    })))
}

pub async fn conversations(State(st): State<AppState>, c: Client) -> ApiResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM conversations WHERE tenant = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50").bind(&c.tenant).bind(c.id).fetch_all(&st.pool).await?;
    Ok(Json(json!({"items": rows.iter().map(conv_client_json).collect::<Vec<_>>()})))
}

pub async fn conversation(State(st): State<AppState>, c: Client, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let r = chat::conv_for_client(&st, &c, id).await?;
    Ok(Json(json!({"conversation": conv_client_json(&r), "messages": chat::messages(&st, id, false).await?})))
}

pub async fn send(State(st): State<AppState>, c: Client, Body(b): Body) -> ApiResult<Json<Value>> {
    let body = b["body"].as_str().unwrap_or("");
    let att = b["attachmentId"].as_i64();
    Ok(Json(chat::client_message(&st, &c, body, att).await?))
}

pub async fn handover(State(st): State<AppState>, c: Client, Body(b): Body) -> ApiResult<Json<Value>> {
    let conv = match chat::open_for(&st, &c).await? {
        Some(r) => r,
        None => {
            // no chat yet: open one straight into the queue
            chat::client_message(&st, &c, b["message"].as_str().filter(|s| !s.trim().is_empty()).unwrap_or("I'd like to talk to a person."), None).await?;
            chat::open_for(&st, &c).await?.ok_or(ApiError::NotFound)?
        }
    };
    let id: i64 = conv.get("id");
    if conv.get::<String, _>("status") == "bot" {
        let reason = b["reason"].as_str().map(|r| crate::util::clean(r, 120)).filter(|r| !r.is_empty()).unwrap_or_else(|| "client asked for a human".into());
        chat::handover(&st, &c.tenant, id, &reason, &Actor { id: format!("user:{}", c.id), name: Some(c.name.clone()) }).await?;
    }
    Ok(Json(json!({"conversation": conv_client_json(&chat::conv_for_client(&st, &c, id).await?)})))
}

pub async fn resolve(State(st): State<AppState>, c: Client, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    chat::conv_for_client(&st, &c, id).await?;
    chat::resolve(&st, &c.tenant, id, &Actor { id: format!("user:{}", c.id), name: Some(c.name.clone()) }, true).await?;
    Ok(Json(json!({"conversation": conv_client_json(&chat::conv_for_client(&st, &c, id).await?)})))
}

pub async fn rate(State(st): State<AppState>, c: Client, Path(id): Path<i64>, Body(b): Body) -> ApiResult<Json<Value>> {
    let rating = b["rating"].as_i64().unwrap_or(0);
    Ok(Json(json!({"conversation": chat::rate(&st, &c, id, rating, b["comment"].as_str().unwrap_or("")).await?})))
}

pub async fn read(State(st): State<AppState>, c: Client) -> ApiResult<Json<Value>> {
    sqlx::query("UPDATE conversations SET client_unread = 0 WHERE tenant = $1 AND user_id = $2 AND client_unread > 0").bind(&c.tenant).bind(c.id).execute(&st.pool).await?;
    Ok(Json(json!({"status": "ok"})))
}

/// "Client is typing" for the agents (throttled by the browser).
pub async fn typing(State(st): State<AppState>, c: Client) -> ApiResult<Json<Value>> {
    if let Some(r) = chat::open_for(&st, &c).await? {
        st.hub.send(&c.tenant, Target::AllStaff, json!({"type": "typing", "conversationId": r.get::<i64, _>("id"), "from": "client"}));
    }
    Ok(Json(json!({"status": "ok"})))
}

pub async fn upload(State(st): State<AppState>, c: Client, up: Upload) -> ApiResult<Json<Value>> {
    if !st.limiter.hit(&format!("upload:{}:{}", c.tenant, c.id), 20, std::time::Duration::from_secs(3600)) {
        return Err(ApiError::RateLimited("Too many uploads. Please try again later.".into()));
    }
    Ok(Json(json!({"attachment": chat::upload(&st, &c.tenant, c.id, &format!("user:{}", c.id), &up.name, &up.bytes).await?})))
}

pub async fn attachment(State(st): State<AppState>, c: Client, Path(id): Path<i64>) -> ApiResult<Response> {
    let (bytes, mime, name) = chat::read_attachment(&st, &c.tenant, id, Some(c.id)).await?;
    Ok(file_response(bytes, &mime, &name))
}
