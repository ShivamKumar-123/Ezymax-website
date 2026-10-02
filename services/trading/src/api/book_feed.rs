//! Options order book market data for the options service (docs/OPTIONS-EXCHANGE.md §10). Internal token.
//!
//! * `GET /v1/internal/options/book/stream?tenant=&kind=` (WebSocket): on connect a `depth` (10 levels) and a `top`
//!   frame for every series of every book (optionally one tenant / kind), then
//!   `{type:"top", tenant, kind, underlying, series, bid, bidQty, ask, askQty, last, lastQty, mark, oi, vol, state, seq}`
//!   and `{type:"depth", …, bids:[{price, qty, orders}], asks, seq}` for changed series at most every 250 ms
//!   (≤ 4/s per series), `{type:"trade", tenant, kind, underlying, series, fillId, price, qty, side, tradeKind, combo, at, seq}`
//!   as trades happen, `{type:"hb", t}` every 5 s and `{type:"resync", skipped}` when the consumer lags (reload the
//!   snapshot). Prices are premiums per unit (quote currency), quantities contracts; `side` is the aggressor's.
//! * `GET /v1/internal/options/book/{tenant}/{kind}/snapshot` → `{tenant, kind, books:[{underlying, seq, series:[…]}]}`.
//! * `GET /v1/internal/options/book/{tenant}/{kind}/trades?series=&limit=&since=` → `{trades:[…]}` newest first.

use axum::Json;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use tokio::sync::broadcast::error::RecvError;

use super::{ApiError, ApiResult, AppState, parse_time};
use crate::model::AccountKind;
use crate::money::{D, num};

#[derive(Deserialize, Default)]
pub struct StreamQ {
    pub tenant: Option<String>,
    pub kind: Option<String>,
}

fn kind_of(s: &str) -> ApiResult<AccountKind> {
    AccountKind::parse(s).ok_or_else(|| ApiError::BadRequest("kind must be live or demo".into()))
}

/// A tenant given as slug or id → (id, slug).
fn tenant_of(st: &AppState, t: &str) -> ApiResult<(i64, String)> {
    let reg = &st.hub.shared.registry;
    let cfg = match t.parse::<i64>() {
        Ok(id) => reg.get(id),
        Err(_) => reg.by_slug(&t.to_ascii_lowercase()),
    };
    cfg.map(|c| (c.tenant_id, c.slug.clone())).ok_or_else(|| ApiError::NotFound(format!("Unknown tenant {t}")))
}

fn mark_fn(st: &AppState) -> impl Fn(&str, AccountKind, &str) -> Option<D> + '_ {
    let now = st.hub.shared.clock.now();
    move |slug, kind, series| crate::engine::options_book::series_mark(&st.hub, slug, kind, series, now)
}

/// `GET /v1/internal/options/book/stream`
pub async fn stream(State(st): State<AppState>, Query(q): Query<StreamQ>, ws: WebSocketUpgrade) -> Response {
    let tenant = q.tenant.clone().map(|t| t.to_ascii_lowercase());
    let kind = q.kind.as_deref().and_then(AccountKind::parse);
    ws.on_upgrade(move |socket| pump(st, socket, tenant, kind))
}

async fn pump(st: AppState, mut socket: WebSocket, tenant: Option<String>, kind: Option<AccountKind>) {
    let top = st.hub.shared.options.top.clone();
    let mut rx = top.subscribe();
    let first = {
        let m = mark_fn(&st);
        top.initial(tenant.as_deref(), kind, &m)
    };
    for f in first {
        if socket.send(Message::text(f.to_string())).await.is_err() {
            return;
        }
    }
    let keep = |f: &str| -> bool {
        if tenant.is_none() && kind.is_none() {
            return true;
        }
        let Ok(v) = serde_json::from_str::<Value>(f) else { return false };
        tenant.as_ref().is_none_or(|t| v["tenant"].as_str() == Some(t.as_str())) && kind.is_none_or(|k| v["kind"].as_str() == Some(k.as_str()))
    };
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
                Ok(f) => {
                    if keep(&f) && socket.send(Message::text(f.to_string())).await.is_err() { break; }
                }
                Err(RecvError::Lagged(n)) => {
                    let f = format!(r#"{{"type":"resync","skipped":{n}}}"#);
                    if socket.send(Message::text(f)).await.is_err() { break; }
                }
                Err(RecvError::Closed) => break,
            }
        }
    }
}

/// `GET /v1/internal/options/book/{tenant}/{kind}/snapshot`
pub async fn snapshot(State(st): State<AppState>, Path((tenant, kind)): Path<(String, String)>) -> ApiResult<Json<Value>> {
    let (tid, slug) = tenant_of(&st, &tenant)?;
    let kind = kind_of(&kind)?;
    let top = &st.hub.shared.options.top;
    let m = mark_fn(&st);
    let mut books = Vec::new();
    for key in top.keys().into_iter().filter(|k| k.tenant_id == tid && k.kind == kind) {
        let views = top.views(&key);
        let seq = views.iter().map(|v| v.seq).max().unwrap_or(0);
        let series: Vec<Value> = views
            .iter()
            .map(|v| {
                let mut j = v.json();
                j["mark"] = crate::money::num_opt(m(&slug, kind, &v.series));
                j
            })
            .collect();
        books.push(json!({"underlying": key.underlying, "seq": seq, "series": series}));
    }
    Ok(Json(json!({"tenant": slug, "kind": kind.as_str(), "enabled": st.hub.shared.books.venue_enabled(tid, kind), "books": books, "at": chrono::Utc::now()})))
}

#[derive(Deserialize, Default)]
pub struct TradesQ {
    pub series: Option<String>,
    pub underlying: Option<String>,
    pub since: Option<String>,
    pub limit: Option<i64>,
}

/// `GET /v1/internal/options/book/{tenant}/{kind}/trades`
pub async fn trades(State(st): State<AppState>, Path((tenant, kind)): Path<(String, String)>, Query(q): Query<TradesQ>) -> ApiResult<Json<Value>> {
    let (tid, slug) = tenant_of(&st, &tenant)?;
    let kind = kind_of(&kind)?;
    let rows = sqlx::query(
        "SELECT fill_id, underlying, series, price, contracts, aggressor, fill_kind, combo, at, seq FROM book_fills
         WHERE tenant_id = $1 AND kind = $2 AND ($3::text IS NULL OR series = $3) AND ($4::text IS NULL OR underlying = $4) AND ($5::timestamptz IS NULL OR at >= $5)
         ORDER BY at DESC, seq DESC LIMIT $6",
    )
    .bind(tid)
    .bind(kind.as_str())
    .bind(&q.series)
    .bind(q.underlying.as_ref().map(|u| u.to_ascii_uppercase()))
    .bind(parse_time(&q.since)?)
    .bind(q.limit.unwrap_or(100).clamp(1, 1000))
    .fetch_all(&st.pool)
    .await?;
    let trades: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "fillId": r.get::<String, _>("fill_id"), "underlying": r.get::<String, _>("underlying"), "series": r.get::<String, _>("series"),
                "price": num(r.get::<D, _>("price")), "qty": num(r.get::<D, _>("contracts")), "side": r.get::<String, _>("aggressor"),
                "tradeKind": r.get::<String, _>("fill_kind"), "combo": r.get::<Option<i64>, _>("combo"), "at": r.get::<chrono::DateTime<chrono::Utc>, _>("at"), "seq": r.get::<i64, _>("seq"),
            })
        })
        .collect();
    Ok(Json(json!({"tenant": slug, "kind": kind.as_str(), "trades": trades})))
}
