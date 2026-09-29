//! WebSocket streams, authenticated by a one-time ticket (`POST /v1/terminal/stream-ticket` or
//! `POST /v1/dealing/stream-ticket`, valid 30 s) so browsers can connect directly.
//!
//! Terminal: `{"type":"snapshot", account, positions, orders}` on connect, then deltas: `position`
//! (op upsert/remove), `order` (op upsert/remove), `deal`, `ledger`, `account`, `notification`
//! (fill, sl, tp, margin_call, stop_out, order_filled, order_expired, …) and throttled `equity` frames
//! (≤ 4/s: balance, equity, margin, free margin, level, per-position profit). `{"type":"hb"}` every 5 s.
//! Dealing: `snapshot` (all positions + orders), then `position` / `order` / `deal` / `audit` deltas and a
//! `pnl` frame every second.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::broadcast::{self, error::RecvError};

use super::{ApiError, AppState};
use crate::auth::StreamGrant;
use crate::views;

#[derive(Deserialize)]
pub struct TicketQ {
    ticket: String,
}

pub async fn terminal(State(st): State<AppState>, Query(q): Query<TicketQ>, headers: HeaderMap, ws: WebSocketUpgrade) -> Response {
    let Some(StreamGrant::Account { login, read_only, session, .. }) = st.tickets.redeem(&st.keys, &q.ticket) else {
        return ApiError::Unauthorized.into_response();
    };
    // client presence: the client's own sessions are reported to the gateway while the stream is open
    let country = ["cf-ipcountry", "x-kalks-country"].iter().find_map(|h| headers.get(*h).and_then(|v| v.to_str().ok())).map(|c| c.trim().to_ascii_lowercase()).filter(|c| c.len() == 2 && c != "xx");
    let presence = session.as_ref().filter(|s| !s.staff && s.user_id > 0).map(|s| {
        st.presence.register(crate::controls::Conn { user_id: s.user_id, login, ip: Some(s.ip.clone()), country: country.clone(), user_agent: Some(s.user_agent.clone()), since: chrono::Utc::now() })
    });
    // the stream ends with the session: sign-in blocked in the Back Office, or a staff session's 30 minutes are up
    let check: Option<Check> = session.map(|s| {
        let r = st.hub.shared.restrictions.clone();
        Box::new(move || {
            let now = chrono::Utc::now();
            if r.login_blocked(s.user_id, now) {
                Some("suspended")
            } else if now >= s.expires_at {
                Some("expired")
            } else {
                None
            }
        }) as Check
    });
    ws.on_upgrade(move |socket| async move {
        let _presence = presence;
        let rx = st.hub.shared.streams.subscribe_account(login);
        let snap = st
            .hub
            .read(
                login,
                Box::new(move |x| match x {
                    Some((a, env)) => json!({
                        "type": "snapshot",
                        "readOnly": read_only,
                        "account": views::account_json(env, a),
                        "positions": a.positions.values().map(|p| views::position_json(env, a, p)).collect::<Vec<_>>(),
                        "orders": a.orders.values().map(views::order_json).collect::<Vec<_>>(),
                    }),
                    None => serde_json::Value::Null,
                }),
            )
            .await;
        pump(socket, rx, snap.to_string(), check).await;
    })
}

type Check = Box<dyn Fn() -> Option<&'static str> + Send>;

pub async fn dealing(State(st): State<AppState>, Query(q): Query<TicketQ>, ws: WebSocketUpgrade) -> Response {
    let Some(StreamGrant::Dealing { tenant_id, .. }) = st.tickets.redeem(&st.keys, &q.ticket) else {
        return ApiError::Unauthorized.into_response();
    };
    ws.on_upgrade(move |socket| async move {
        let rx = st.hub.shared.streams.subscribe_dealing(tenant_id);
        let positions = st
            .hub
            .scan(tenant_id, Arc::new(|a, env| a.positions.values().map(|p| views::desk_position_json(env, a, p)).collect()))
            .await;
        let orders = st.hub.scan(tenant_id, Arc::new(|a, _| a.orders.values().map(|o| views::desk_order_json(a, o)).collect())).await;
        let snap = json!({"type": "snapshot", "positions": positions, "orders": orders}).to_string();
        pump(socket, rx, snap, None).await;
    })
}

async fn pump(mut socket: WebSocket, mut rx: broadcast::Receiver<Arc<str>>, first: String, check: Option<Check>) {
    if socket.send(Message::text(first)).await.is_err() {
        return;
    }
    let mut hb = tokio::time::interval(std::time::Duration::from_secs(5));
    hb.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = hb.tick() => {
                if let Some(reason) = check.as_ref().and_then(|c| c()) {
                    let _ = socket.send(Message::text(format!(r#"{{"type":"ended","reason":"{reason}"}}"#))).await;
                    let _ = socket.send(Message::Close(None)).await;
                    break;
                }
                let f = format!(r#"{{"type":"hb","t":{}}}"#, chrono::Utc::now().timestamp_millis());
                if socket.send(Message::text(f)).await.is_err() { break; }
            }
            m = socket.recv() => match m {
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            },
            f = rx.recv() => match f {
                Ok(f) => if socket.send(Message::text(f.to_string())).await.is_err() { break; },
                // too slow: tell the client to re-sync (it reloads state over REST)
                Err(RecvError::Lagged(n)) => {
                    let f = format!(r#"{{"type":"resync","skipped":{n}}}"#);
                    if socket.send(Message::text(f)).await.is_err() { break; }
                }
                Err(RecvError::Closed) => break,
            }
        }
    }
}
