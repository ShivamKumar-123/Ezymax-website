//! HTTP + WebSocket API.
//!
//! GET  /health                          service status (provider connections, tick rate)
//! GET  /v1/instruments                  instrument list
//! GET  /v1/quotes?symbols=&group=       latest quotes with the group's spread applied
//! GET  /v1/candles?symbol=&tf=&limit=&to=   OHLC history (+ the forming bar), ascending
//! GET  /v1/history/status               stored bars per symbol/timeframe
//! GET  /v1/admin/spreads                spread markups           (Bearer MARKET_DATA_ADMIN_TOKEN)
//! PUT  /v1/admin/spreads                upsert a markup          (Bearer MARKET_DATA_ADMIN_TOKEN)
//! WS   /v1/stream?group=                {"op":"subscribe","symbols":[..]} → {"type":"quote",...} (+ {"type":"hb"} every 5s)
//!                                       {"op":"bars","symbol":"XAUUSD","tf":"M15"} → {"type":"bar",...}

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::broadcast::error::RecvError;
use tower_http::cors::CorsLayer;

use crate::db::{self, Bar};
use crate::spreads::Markup;
use crate::state::{Event, Market, Quote};
use crate::timeframes::Tf;

#[derive(Clone)]
pub struct AppState {
    pub market: Arc<Market>,
    pub admin_token: String,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/instruments", get(instruments))
        .route("/v1/quotes", get(quotes))
        .route("/v1/candles", get(candles))
        .route("/v1/history/status", get(history_status))
        .route("/v1/admin/spreads", get(get_spreads).put(put_spread))
        .route("/v1/stream", get(stream))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

struct ApiError(anyhow::Error);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": self.0.to_string()}))).into_response()
    }
}
impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError(e.into())
    }
}
fn bad(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, Json(json!({"error": msg}))).into_response()
}

async fn health(State(s): State<AppState>) -> Json<Value> {
    let st = s.market.stats();
    let now = Utc::now().timestamp_millis();
    let stale: Vec<&String> = st.last_tick_ms.iter().filter(|(_, t)| now - **t > 60_000).map(|(k, _)| k).collect();
    Json(json!({
        "ok": !st.connected_markets.is_empty(),
        "provider_streams": st.connected_markets,
        "ticks_total": st.ticks_total,
        "symbols_ticking": st.last_tick_ms.len(),
        "stale_over_60s": stale,
    }))
}

async fn instruments(State(s): State<AppState>) -> Json<Value> {
    Json(json!(s.market.cat.list))
}

#[derive(Deserialize)]
struct QuotesQ {
    symbols: Option<String>,
    group: Option<String>,
}

async fn quotes(State(s): State<AppState>, Query(q): Query<QuotesQ>) -> Json<Value> {
    let group = q.group.unwrap_or_else(|| "raw".into());
    let wanted: Option<HashSet<String>> = q.symbols.map(|x| x.split(',').map(|s| s.trim().to_string()).collect());
    let mut out = serde_json::Map::new();
    for inst in &s.market.cat.list {
        if wanted.as_ref().is_some_and(|w| !w.contains(&inst.symbol)) {
            continue;
        }
        if let Some(qt) = s.market.quote(&inst.symbol) {
            let q = s.market.spreads.apply(&group, inst, qt);
            // today's (server-day) open/high/low from the raw D1 bar, for % change and day range
            let day = s.market.forming(&inst.symbol, Tf::D1).map(|d| inst.round_bar(d));
            out.insert(
                inst.symbol.clone(),
                json!({"bid": q.bid, "ask": q.ask, "last": q.last, "t": q.t,
                       "o": day.map(|d| d.o), "h": day.map(|d| d.h), "l": day.map(|d| d.l)}),
            );
        }
    }
    Json(Value::Object(out))
}

#[derive(Deserialize)]
struct CandlesQ {
    symbol: String,
    tf: String,
    limit: Option<i64>,
    /// unix seconds (inclusive) — page back through history
    to: Option<i64>,
}

async fn candles(State(s): State<AppState>, Query(q): Query<CandlesQ>) -> Result<Response, ApiError> {
    let Some(tf) = Tf::parse(&q.tf) else { return Ok(bad("tf must be one of M1 M5 M15 M30 H1 H4 D1 W1 MN")) };
    let Some(inst) = s.market.cat.get(&q.symbol) else { return Ok(bad("unknown symbol")) };
    let limit = q.limit.unwrap_or(500).clamp(1, 5000);
    let to: Option<DateTime<Utc>> = q.to.and_then(|t| DateTime::from_timestamp(t, 0));
    let mut bars = db::load_bars(&s.market.pool, &q.symbol, tf.minutes(), to, None, limit).await?;
    // merge the live forming bar (newest data) when serving the latest page
    if to.is_none() {
        if let Some(f) = s.market.forming(&q.symbol, tf) {
            match bars.last_mut() {
                Some(last) if last.t == f.t => {
                    last.h = last.h.max(f.h);
                    last.l = last.l.min(f.l);
                    last.c = f.c;
                    last.v = last.v.max(f.v);
                }
                Some(last) if last.t > f.t => {}
                _ => bars.push(f),
            }
        }
    }
    // provider history can carry more decimals than the symbol trades with
    let bars: Vec<_> = bars.into_iter().map(|b| inst.round_bar(b)).collect();
    Ok(Json(json!({"symbol": q.symbol, "tf": tf.name(), "digits": inst.digits, "bars": bars})).into_response())
}

async fn history_status(State(s): State<AppState>) -> Result<Json<Value>, ApiError> {
    let rows = db::bar_counts(&s.market.pool).await?;
    let out: Vec<Value> = rows
        .into_iter()
        .map(|(sym, tf, n, first, last)| json!({"symbol": sym, "tf": Tf::from_minutes(tf).map(|t| t.name()).unwrap_or("?"), "bars": n, "from": first, "to": last}))
        .collect();
    Ok(Json(json!(out)))
}

fn authorized(s: &AppState, h: &HeaderMap) -> bool {
    !s.admin_token.is_empty() && h.get("authorization").and_then(|v| v.to_str().ok()) == Some(&format!("Bearer {}", s.admin_token))
}

async fn get_spreads(State(s): State<AppState>, h: HeaderMap) -> Response {
    if !authorized(&s, &h) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    Json(json!(s.market.spreads.all())).into_response()
}

async fn put_spread(State(s): State<AppState>, h: HeaderMap, Json(m): Json<Markup>) -> Result<Response, ApiError> {
    if !authorized(&s, &h) {
        return Ok(StatusCode::UNAUTHORIZED.into_response());
    }
    if m.symbol != "*" && s.market.cat.get(&m.symbol).is_none() {
        return Ok(bad("unknown symbol"));
    }
    s.market.spreads.upsert(&s.market.pool, &m).await?;
    tracing::info!(group = %m.group_code, symbol = %m.symbol, markup = m.markup_points, "spread markup updated");
    Ok(Json(json!({"ok": true})).into_response())
}

#[derive(Deserialize)]
struct StreamQ {
    group: Option<String>,
}

async fn stream(State(s): State<AppState>, Query(q): Query<StreamQ>, ws: WebSocketUpgrade) -> Response {
    let group = q.group.unwrap_or_else(|| "raw".into());
    ws.on_upgrade(move |socket| client(socket, s, group))
}

/// One quote frame. `t` = provider event time, `r` = when this service received it (both ms).
fn quote_frame(symbol: &str, q: &Quote) -> String {
    format!(r#"{{"type":"quote","s":"{symbol}","b":{},"a":{},"l":{},"t":{},"r":{}}}"#, q.bid, q.ask, q.last, q.t, q.recv)
}

fn bar_frame(symbol: &str, tf: Tf, b: &Bar) -> String {
    format!(r#"{{"type":"bar","s":"{symbol}","tf":"{}","t":{},"o":{},"h":{},"l":{},"c":{},"v":{}}}"#, tf.name(), b.t.timestamp(), b.o, b.h, b.l, b.c, b.v)
}

/// Current quotes of `symbols` for `group` (snapshot after subscribe or after falling behind).
fn snapshot(s: &AppState, group: &str, symbols: impl IntoIterator<Item = String>) -> Vec<String> {
    symbols
        .into_iter()
        .filter_map(|x| {
            let inst = s.market.cat.get(&x)?;
            let q = s.market.spreads.apply(group, inst, s.market.quote(&x)?);
            Some(quote_frame(&x, &q))
        })
        .collect()
}

async fn client(mut socket: WebSocket, s: AppState, group: String) {
    let mut rx = s.market.tx.subscribe();
    let mut syms: HashSet<String> = HashSet::new();
    let mut bars: HashSet<(String, Tf)> = HashSet::new();
    // application heartbeat: lets the browser detect a dead connection (it cannot see WS pings)
    let mut hb = tokio::time::interval(std::time::Duration::from_secs(5));
    hb.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = hb.tick() => {
                let frame = format!(r#"{{"type":"hb","t":{}}}"#, Utc::now().timestamp_millis());
                if socket.send(Message::text(frame)).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                let Some(Ok(msg)) = incoming else { break };
                let Message::Text(text) = msg else { continue };
                let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
                match v["op"].as_str() {
                    Some("subscribe") => {
                        let mut added = Vec::new();
                        for x in v["symbols"].as_array().into_iter().flatten().filter_map(Value::as_str) {
                            if s.market.cat.get(x).is_some() && syms.insert(x.to_string()) {
                                added.push(x.to_string());
                            }
                        }
                        // snapshot so the client renders immediately
                        for frame in snapshot(&s, &group, added) {
                            if socket.send(Message::text(frame)).await.is_err() {
                                return;
                            }
                        }
                    }
                    Some("unsubscribe") => {
                        for x in v["symbols"].as_array().into_iter().flatten().filter_map(Value::as_str) {
                            syms.remove(x);
                        }
                    }
                    Some("bars") => {
                        if let (Some(sym), Some(tf)) = (v["symbol"].as_str(), v["tf"].as_str().and_then(Tf::parse)) {
                            bars.insert((sym.to_string(), tf));
                        }
                    }
                    Some("unbars") => {
                        if let (Some(sym), Some(tf)) = (v["symbol"].as_str(), v["tf"].as_str().and_then(Tf::parse)) {
                            bars.remove(&(sym.to_string(), tf));
                        }
                    }
                    _ => {}
                }
            }
            ev = rx.recv() => {
                let ev = match ev {
                    Ok(ev) => ev,
                    Err(RecvError::Lagged(n)) => {
                        // this client fell behind: skip the backlog and resend the current prices
                        tracing::debug!(skipped = n, "stream client lagged");
                        for frame in snapshot(&s, &group, syms.iter().cloned()) {
                            if socket.send(Message::text(frame)).await.is_err() {
                                return;
                            }
                        }
                        continue;
                    }
                    Err(RecvError::Closed) => break,
                };
                let out = match ev {
                    Event::Quote { symbol, quote } if syms.contains(&symbol) => {
                        let Some(inst) = s.market.cat.get(&symbol) else { continue };
                        quote_frame(&symbol, &s.market.spreads.apply(&group, inst, quote))
                    }
                    Event::Bar { symbol, tf, bar } if bars.iter().any(|(b, t)| *t == tf && *b == symbol) => {
                        let Some(inst) = s.market.cat.get(&symbol) else { continue };
                        bar_frame(&symbol, tf, &inst.round_bar(bar))
                    }
                    _ => continue,
                };
                if socket.send(Message::text(out)).await.is_err() {
                    break;
                }
            }
        }
    }
}
