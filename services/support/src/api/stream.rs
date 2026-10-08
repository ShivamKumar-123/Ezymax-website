//! Realtime WebSocket stream for the Client Area chat / bell and the Back Office inbox / bell.
//!
//! 1. The BFF calls `POST /v1/stream/ticket` with the client (`X-Ezymex-User-Id`) or staff identity headers
//!    and gets a one-time ticket (30 s).
//! 2. The browser opens `wss://<app host>/support/stream?ticket=…` (Caddy -> `GET /v1/stream`).
//!
//! Frames (server -> browser), JSON:
//! - `{"type":"hello", "who":"user"|"staff", "unread": n}`
//! - `{"type":"message", "message": {...}}` (clients never receive internal notes)
//! - `{"type":"conversation", "conversation": {...}}`
//! - `{"type":"bot.typing"|"bot.delta", "conversationId", "streamId", "text"?}` (streamed AI answer)
//! - `{"type":"typing", "conversationId", "from":"client"|"agent"}`
//! - `{"type":"notification", "item": {...}, "unread": n}`, `{"type":"notifications.read", "unread": n}`
//! - `{"type":"ping"}` every 25 s
//!
//! Browser -> server: `{"type":"ping"}` (ignored); everything else goes through the BFF's HTTP routes.

use crate::chat::Client;
use crate::error::ApiResult;
use crate::notify;
use crate::state::{AppState, Target, Who};
use axum::Json;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{FromRequestParts, Query, State};
use axum::http::request::Parts;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::{Value, json};
use std::time::Duration;

use super::Staff;

/// Either identity, for the ticket route.
pub enum Caller {
    User(Client),
    Staff(Staff),
}

impl<S: Send + Sync> FromRequestParts<S> for Caller {
    type Rejection = crate::error::ApiError;
    async fn from_request_parts(parts: &mut Parts, s: &S) -> Result<Self, Self::Rejection> {
        if parts.headers.contains_key("x-ezymex-staff-id") {
            Ok(Caller::Staff(Staff::from_request_parts(parts, s).await?))
        } else {
            Ok(Caller::User(Client::from_request_parts(parts, s).await?))
        }
    }
}

pub async fn ticket(State(st): State<AppState>, caller: Caller) -> ApiResult<Json<Value>> {
    let (tenant, who) = match caller {
        Caller::User(c) => (c.tenant, Who::User { id: c.id }),
        Caller::Staff(s) => {
            let inbox = s.require("support.read").is_ok();
            (s.agent.tenant.clone(), Who::Staff { id: s.agent.id.clone(), name: s.agent.name.clone(), role: s.agent.role.clone(), inbox })
        }
    };
    let t = st.hub.issue(&tenant, who);
    Ok(Json(json!({"ticket": t, "expiresIn": crate::state::TICKET_TTL.as_secs()})))
}

#[derive(Deserialize)]
pub struct TicketQ {
    ticket: Option<String>,
}

pub async fn stream(State(st): State<AppState>, Query(q): Query<TicketQ>, ws: WebSocketUpgrade) -> Response {
    let Some((tenant, who)) = q.ticket.as_deref().and_then(|t| st.hub.redeem(t)) else {
        return (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": {"code": "unauthorized", "message": "Invalid or expired stream ticket."}}))).into_response();
    };
    ws.max_message_size(16 * 1024).on_upgrade(move |socket| run(st, tenant, who, socket))
}

fn wants(who: &Who, to: &Target) -> bool {
    match (who, to) {
        (Who::User { id }, Target::User(u)) => id == u,
        (Who::Staff { inbox, .. }, Target::AllStaff) => *inbox,
        (Who::Staff { id, .. }, Target::Staff(s)) => id == s,
        _ => false,
    }
}

async fn run(st: AppState, tenant: String, who: Who, mut socket: WebSocket) {
    let mut rx = st.hub.subscribe();
    st.hub.connected(&tenant, &who, 1);
    if let Who::Staff { id, name, role, inbox: true } = &who {
        let _ = sqlx::query(
            "INSERT INTO agents (tenant, staff_id, name, role) VALUES ($1,$2,$3,$4)
             ON CONFLICT (tenant, staff_id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, last_seen = now()",
        )
        .bind(&tenant)
        .bind(id)
        .bind(name)
        .bind(role)
        .execute(&st.pool)
        .await;
    }
    let (aud, rid) = match &who {
        Who::User { id } => ("user", id.to_string()),
        Who::Staff { id, .. } => ("staff", id.clone()),
    };
    let unread = notify::unread(&st, &tenant, aud, &rid).await.unwrap_or(0);
    let hello = json!({"type": "hello", "who": aud, "unread": unread, "agentsOnline": st.hub.staff_online_ids(&tenant).len()});
    if socket.send(Message::Text(hello.to_string().into())).await.is_err() {
        st.hub.connected(&tenant, &who, -1);
        return;
    }
    let mut ping = tokio::time::interval(Duration::from_secs(25));
    ping.tick().await;
    loop {
        tokio::select! {
            ev = rx.recv() => match ev {
                Ok(ev) => {
                    if ev.tenant == tenant && wants(&who, &ev.to) && socket.send(Message::Text(ev.payload.to_string().into())).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    // tell the browser to reload its state
                    if socket.send(Message::Text(json!({"type": "resync", "missed": n}).to_string().into())).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            },
            msg = socket.recv() => match msg {
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            },
            _ = ping.tick() => {
                if socket.send(Message::Text(json!({"type": "ping"}).to_string().into())).await.is_err() {
                    break;
                }
            }
        }
    }
    st.hub.connected(&tenant, &who, -1);
}
