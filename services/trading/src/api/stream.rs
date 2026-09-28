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

pub async fn terminal(State(st): State<AppState>, Query(q): Query<TicketQ>, ws: WebSocketUpgrade) -> Response {
    let Some(StreamGrant::Account { login, read_only, .. }) = st.tickets.redeem(&st.keys, &q.ticket) else {
        return ApiError::Unauthorized.into_response();
    };
    ws.on_upgrade(move |socket| async move {
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
        pump(socket, rx, snap.to_string()).await;
    })
}

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
        pump(socket, rx, snap).await;
    })
}

async fn pump(mut socket: WebSocket, mut rx: broadcast::Receiver<Arc<str>>, first: String) {
    if socket.send(Message::text(first)).await.is_err() {
        return;
    }
    let mut hb = tokio::time::interval(std::time::Duration::from_secs(5));
    hb.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = hb.tick() => {
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
