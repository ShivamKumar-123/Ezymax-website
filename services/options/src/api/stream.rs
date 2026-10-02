//! `WS /v1/options/stream` (browsers reach it at trade.* `/options/stream`).
//!
//! Auth: `?ticket=` from `POST /v1/options/stream/ticket {group}` (BFF, internal token + tenant header) gives
//! that tenant's group pricing; without a ticket the connection is a guest (tenant `kalks`, default group),
//! allowed only when `public_chain` is on.
//!
//! Client -> server:
//! * `{"op":"subscribe","u":"EURUSD","expiry":"2026-10-09"}` chain (max 8 per connection)
//! * `{"op":"subscribe","series":["EURUSD-20261009-1.1650-C", ...]}` single series (max 200)
//! * `{"op":"unsubscribe","u":..,"expiry":..}` / `{"op":"unsubscribe","series":[..]}`
//!
//! Server -> client:
//! * `{"type":"chain", ...chain header, "rows":[...]}` full chain on subscribe (and after a relisting)
//! * `{"type":"rows","u","expiry","spot","rows":[changed rows]}` at most every 250 ms per chain
//! * `{"type":"series","quotes":[changed quotes]}` at most every 250 ms
//! * `{"type":"hb","t"}` every 10 s, `{"type":"error","code","message"}`

use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::Json;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{ApiError, R, enabled_tenant};
use crate::model::PLATFORM_TENANT;
use crate::pricing::{self, ChainRow};
use crate::{AppState, StreamGrant};

const MAX_CHAINS: usize = 8;
const MAX_SERIES: usize = 200;
const TICK: Duration = Duration::from_millis(250);

#[derive(Deserialize)]
pub struct TicketPost {
    group: Option<String>,
}

/// `POST /v1/options/stream/ticket {group?}` -> `{ticket, expiresIn: 30, path: "/options/stream?ticket=..."}`.
pub async fn ticket(State(st): State<AppState>, h: HeaderMap, body: Option<Json<TicketPost>>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let group = super::public::group_param(body.as_ref().and_then(|b| b.group.as_deref()));
    let ticket = st.issue_ticket(StreamGrant { tenant: t.tenant.clone(), group });
    Ok(Json(json!({"ticket": ticket, "expiresIn": 30, "path": format!("/options/stream?ticket={ticket}")})))
}

#[derive(Deserialize)]
pub struct StreamQ {
    ticket: Option<String>,
}

pub async fn ws(State(st): State<AppState>, Query(q): Query<StreamQ>, upgrade: WebSocketUpgrade) -> Response {
    let rd = st.refdata().await;
    let grant = match q.ticket.as_deref() {
        Some(t) => match st.redeem_ticket(t) {
            Some(g) => g,
            None => return ApiError::new(axum::http::StatusCode::UNAUTHORIZED, "bad_ticket", "Ticket expired or already used.").into_response(),
        },
        None => {
            if !rd.tenant(PLATFORM_TENANT).public_chain {
                return ApiError::disabled().into_response();
            }
            StreamGrant { tenant: PLATFORM_TENANT.into(), group: "*".into() }
        }
    };
    upgrade.max_message_size(16 * 1024).on_upgrade(move |socket| client(socket, st, grant))
}

/// Chains computed within the last tick are shared between connections with the same view.
type ChainKey = (String, String, String, NaiveDate);
type ChainMemo = (Instant, i64, f64, Arc<(Value, Vec<ChainRow>)>);

fn memo() -> &'static Mutex<HashMap<ChainKey, ChainMemo>> {
    static M: OnceLock<Mutex<HashMap<ChainKey, ChainMemo>>> = OnceLock::new();
    M.get_or_init(Default::default)
}

async fn compute(st: &AppState, g: &StreamGrant, symbol: &str, date: NaiveDate) -> Option<Arc<(Value, Vec<ChainRow>)>> {
    let rd = st.refdata().await;
    let key = (g.tenant.clone(), g.group.clone(), symbol.to_string(), date);
    let mid = st.spots.get(symbol).await.map(|s| s.mid).unwrap_or(0.0);
    if let Some((at, v, m, c)) = memo().lock().unwrap().get(&key)
        && at.elapsed() < TICK
        && *v == rd.version
        && *m == mid
    {
        return Some(c.clone());
    }
    let u = rd.underlying(symbol).filter(|u| u.enabled)?;
    let e = rd.expiry(&u.symbol, date)?;
    let (mut head, rows) = super::public::build_chain(st, &rd, u, e, &g.tenant, &g.group).await;
    if let Some(o) = head.as_object_mut() {
        o.remove("modelInputs");
    }
    let out = Arc::new((head, rows));
    let mut m = memo().lock().unwrap();
    if m.len() > 2000 {
        m.retain(|_, (at, ..)| at.elapsed() < Duration::from_secs(5));
    }
    m.insert(key, (Instant::now(), rd.version, mid, out.clone()));
    Some(out)
}

struct ChainSub {
    symbol: String,
    date: NaiveDate,
    last: HashMap<String, ChainRow>,
    version: i64,
    mid: f64,
}

async fn send(socket: &mut WebSocket, v: Value) -> bool {
    socket.send(Message::text(v.to_string())).await.is_ok()
}

async fn client(mut socket: WebSocket, st: AppState, g: StreamGrant) {
    let mut chains: Vec<ChainSub> = Vec::new();
    let mut series: BTreeSet<String> = BTreeSet::new();
    let mut series_last: HashMap<String, pricing::OptQuote> = HashMap::new();
    let mut tick = tokio::time::interval(TICK);
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut hb = tokio::time::interval(Duration::from_secs(10));
    hb.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = hb.tick() => {
                if !send(&mut socket, json!({"type": "hb", "t": Utc::now().timestamp_millis()})).await { break; }
            }
            incoming = socket.recv() => {
                let Some(Ok(msg)) = incoming else { break };
                let Message::Text(text) = msg else { continue };
                let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
                let op = v["op"].as_str().unwrap_or("");
                if let Some(list) = v["series"].as_array() {
                    let codes = list.iter().filter_map(Value::as_str).map(str::to_string);
                    if op == "subscribe" {
                        for c in codes {
                            if series.len() >= MAX_SERIES { break; }
                            series.insert(c);
                        }
                    } else if op == "unsubscribe" {
                        for c in codes { series.remove(&c); series_last.remove(&c); }
                    }
                    continue;
                }
                let (Some(u), Some(d)) = (v["u"].as_str(), v["expiry"].as_str().and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())) else {
                    if !send(&mut socket, json!({"type": "error", "code": "bad_request", "message": "Give u and expiry (YYYY-MM-DD), or series[]."})).await { break; }
                    continue;
                };
                let u = u.to_ascii_uppercase();
                if op == "unsubscribe" {
                    chains.retain(|c| !(c.symbol == u && c.date == d));
                    continue;
                }
                if op != "subscribe" || chains.iter().any(|c| c.symbol == u && c.date == d) { continue; }
                if chains.len() >= MAX_CHAINS {
                    if !send(&mut socket, json!({"type": "error", "code": "too_many", "message": format!("At most {MAX_CHAINS} chains per connection.")})).await { break; }
                    continue;
                }
                let rd = st.refdata().await;
                if !rd.tenant(&g.tenant).allows(&u) {
                    if !send(&mut socket, json!({"type": "error", "code": "not_found", "message": "Underlying not available."})).await { break; }
                    continue;
                }
                match compute(&st, &g, &u, d).await {
                    Some(c) => {
                        let (head, rows) = &*c;
                        let mut frame = head.clone();
                        frame["type"] = json!("chain");
                        frame["rows"] = json!(rows);
                        if !send(&mut socket, frame).await { break; }
                        let mid = st.spots.get(&u).await.map(|s| s.mid).unwrap_or(0.0);
                        chains.push(ChainSub { symbol: u, date: d, last: rows.iter().map(|r| (r.strike_label.clone(), r.clone())).collect(), version: rd.version, mid });
                    }
                    None => {
                        if !send(&mut socket, json!({"type": "error", "code": "not_found", "message": "Unknown underlying or expiry."})).await { break; }
                    }
                }
            }
            _ = tick.tick() => {
                let version = st.refdata().await.version;
                let mut frames = Vec::new();
                for sub in chains.iter_mut() {
                    let mid = st.spots.get(&sub.symbol).await.map(|s| s.mid).unwrap_or(0.0);
                    if mid == sub.mid && version == sub.version { continue; }
                    let Some(c) = compute(&st, &g, &sub.symbol, sub.date).await else { continue };
                    let (head, rows) = &*c;
                    let relisted = rows.len() != sub.last.len() || version != sub.version && rows.iter().any(|r| !sub.last.contains_key(&r.strike_label));
                    if relisted {
                        let mut frame = head.clone();
                        frame["type"] = json!("chain");
                        frame["rows"] = json!(rows);
                        frames.push(frame);
                    } else {
                        let changed: Vec<&ChainRow> = rows.iter().filter(|r| sub.last.get(&r.strike_label) != Some(*r)).collect();
                        if !changed.is_empty() {
                            frames.push(json!({"type": "rows", "u": sub.symbol, "expiry": sub.date, "spot": head["spot"], "state": head["state"], "rows": changed}));
                        }
                    }
                    sub.last = rows.iter().map(|r| (r.strike_label.clone(), r.clone())).collect();
                    sub.mid = mid;
                    sub.version = version;
                }
                if !series.is_empty() {
                    let quotes = series_quotes(&st, &g, &series).await;
                    let changed: Vec<&pricing::OptQuote> = quotes.iter().filter(|q| series_last.get(&q.code) != Some(*q)).collect();
                    if !changed.is_empty() {
                        frames.push(json!({"type": "series", "quotes": changed}));
                    }
                    for q in quotes { series_last.insert(q.code.clone(), q); }
                }
                let mut ok = true;
                for f in frames {
                    if !send(&mut socket, f).await { ok = false; break; }
                }
                if !ok { break; }
            }
        }
    }
}

async fn series_quotes(st: &AppState, g: &StreamGrant, codes: &BTreeSet<String>) -> Vec<pricing::OptQuote> {
    let rd = st.refdata().await;
    let now = Utc::now();
    let mut ctxs: HashMap<i64, Option<pricing::Ctx>> = HashMap::new();
    let mut out = Vec::new();
    for code in codes {
        let Some(s) = rd.series.iter().find(|s| &s.code == code) else { continue };
        let Some(u) = rd.underlying(&s.symbol) else { continue };
        let Some(e) = rd.expiries.iter().find(|e| e.id == s.expiry_id) else { continue };
        if !ctxs.contains_key(&e.id) {
            let spot = st.spots.get(&u.symbol).await.map(|x| x.mid);
            let usd = st.spots.usd_per(&u.quote_ccy).await;
            ctxs.insert(e.id, pricing::context(&rd, u, e, spot, usd, now.timestamp_millis(), Some(&g.tenant)).ok());
        }
        if let Some(Some(ctx)) = ctxs.get(&e.id) {
            let gs = rd.group(&g.tenant, &g.group, &u.symbol);
            out.push(pricing::quote(ctx, u, s, &gs, rd.trade_state(&g.tenant, u, e, Some(&s.code), now)));
        }
    }
    out
}
