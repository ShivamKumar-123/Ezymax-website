//! Public order-book market data (docs/OPTIONS-EXCHANGE.md §10), no login, exposed on `api.*` by Caddy. Tenant `kalks`
//! (the platform book); `?kind=live|demo` picks the account kind's book (default live). Every answer is cached 1 s;
//! each client IP may make 10 requests / s (429 `rate_limited` beyond).
//!
//! * `GET /v1/public/options/book/{series}` → `{series, underlying, kind, bids:[[price, qty, orders]], asks, seq, t,
//!   bid, bidQty, ask, askQty, last, lastQty, mark, oi, volume, state}`: 10 levels each side, premiums per unit in the
//!   quote currency, quantities in contracts (`t` = when the depth arrived, ms).
//! * `GET /v1/public/options/trades/{series}?limit=` (1–200, default 50) → `{series, kind, trades:[{id, series, time,
//!   t, price, qty, takerSide, side, kind, combo}]}` newest first (`time` / `t` in ms).
//! * `GET /v1/public/options/stats/{u}?expiry=` → `{underlying, kind, at, totals:{callOi, putOi, callVolume,
//!   putVolume, pcr, pcrVolume}, expiries:[{date, cutAt, …totals, strikes:[{strike, strikeLabel, call:{series, oi,
//!   volume, last}, put}]}]}`: open interest (Σ long contracts) and today's volume per strike.
//!
//! 404 `book_inactive` while the platform's book is not live for that kind.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Json;
use axum::extract::{ConnectInfo, Path, Query, Request, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Value, json};
use subtle::ConstantTimeEq;

use super::ApiError;
use crate::AppState;
use crate::book_feed::{self, Kind};
use crate::model::PLATFORM_TENANT;
use crate::pricing::{ratio, round_to};

const CACHE: Duration = Duration::from_secs(1);
const MAX_TRADES: usize = 200;

/// The client's IP for the rate limit: the first `X-Forwarded-For` hop (Caddy), else `X-Real-IP`, else the peer.
/// `None` for internal callers (a valid internal token, or a loopback peer without forwarding headers, e.g. the BFFs).
pub fn client_ip(h: &HeaderMap, peer: Option<IpAddr>, internal_token: &str) -> Option<IpAddr> {
    if !internal_token.is_empty() && h.get("x-kalks-internal").is_some_and(|v| bool::from(v.as_bytes().ct_eq(internal_token.as_bytes()))) {
        return None;
    }
    let fwd = h
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .and_then(|x| x.trim().parse::<IpAddr>().ok())
        .or_else(|| h.get("x-real-ip").and_then(|v| v.to_str().ok()).and_then(|x| x.trim().parse::<IpAddr>().ok()));
    match (fwd, peer) {
        (Some(ip), _) => Some(ip),
        (None, Some(p)) if !p.is_loopback() => Some(p),
        _ => None,
    }
}

/// 10 requests / s per client IP on the public book routes.
pub async fn rate_limit(State(st): State<AppState>, req: Request, next: Next) -> Response {
    let peer = req.extensions().get::<ConnectInfo<SocketAddr>>().map(|c| c.0.ip());
    if let Some(ip) = client_ip(req.headers(), peer, &st.cfg.internal_token)
        && !st.public_limiter.lock().unwrap().check(&ip, Instant::now())
    {
        let mut res = ApiError::new(StatusCode::TOO_MANY_REQUESTS, "rate_limited", "Too many requests: at most 10 per second.").into_response();
        res.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from_static("1"));
        return res;
    }
    next.run(req).await
}

#[derive(Deserialize, Default)]
pub struct BookQ {
    kind: Option<String>,
    limit: Option<String>,
    expiry: Option<String>,
}

fn kind_of(q: &BookQ) -> Result<Kind, ApiError> {
    match q.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(Kind::Live),
        Some(k) => Kind::parse(k).ok_or_else(|| ApiError::bad("kind must be live or demo.")),
    }
}

fn inactive() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "book_inactive", "The options order book is not live.")
}

fn ok(v: Arc<Value>) -> Response {
    let mut res = Json((*v).clone()).into_response();
    res.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=1"));
    res
}

fn cached(st: &AppState, key: &str) -> Option<Arc<Value>> {
    st.public_book_cache.lock().unwrap().get(key).filter(|(at, ..)| at.elapsed() < CACHE).map(|(_, _, v)| v.clone())
}

fn store(st: &AppState, key: String, v: Value) -> Arc<Value> {
    let v = Arc::new(v);
    let mut m = st.public_book_cache.lock().unwrap();
    if m.len() > 5000 {
        m.retain(|_, (at, ..)| at.elapsed() < CACHE);
    }
    m.insert(key, (Instant::now(), StatusCode::OK, v.clone()));
    v
}

fn valid_code(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
}

/// `GET /v1/public/options/book/{series}?kind=`
pub async fn book(State(st): State<AppState>, Path(series): Path<String>, Query(q): Query<BookQ>) -> Result<Response, ApiError> {
    let kind = kind_of(&q)?;
    if !valid_code(&series) {
        return Err(ApiError::not_found("Series"));
    }
    let key = format!("book|{}|{series}", kind.as_str());
    if let Some(v) = cached(&st, &key) {
        return Ok(ok(v));
    }
    if !st.books.active(PLATFORM_TENANT, kind) {
        return Err(inactive());
    }
    let rd = st.refdata().await;
    let listed = rd.series.iter().find(|s| s.code == series);
    let b = st.books.book(PLATFORM_TENANT, kind, &series);
    let underlying = match (listed, &b) {
        (Some(s), _) => s.symbol.clone(),
        (None, Some(b)) => b.underlying.clone(),
        (None, None) => return Err(ApiError::not_found("Series")),
    };
    let mut v = book_feed::depth_json(&series, b.as_ref());
    if let Some(o) = v.as_object_mut() {
        o.remove("type");
    }
    v["underlying"] = json!(underlying);
    v["kind"] = json!(kind.as_str());
    let top = b.as_ref().map(|b| b.top()).unwrap_or_default();
    v["bid"] = json!(top.bid.map(|x| x.0));
    v["bidQty"] = json!(top.bid.map(|x| x.1));
    v["ask"] = json!(top.ask.map(|x| x.0));
    v["askQty"] = json!(top.ask.map(|x| x.1));
    v["last"] = json!(top.last);
    v["lastQty"] = json!(top.last.and(top.last_qty));
    v["mark"] = json!(b.as_ref().and_then(|b| b.mark));
    v["oi"] = json!(top.oi);
    v["volume"] = json!(top.volume);
    v["state"] = json!(b.as_ref().map(|b| b.state.as_str()).filter(|s| !s.is_empty()).unwrap_or("open"));
    Ok(ok(store(&st, key, v)))
}

/// `GET /v1/public/options/trades/{series}?kind=&limit=`
pub async fn trades(State(st): State<AppState>, Path(series): Path<String>, Query(q): Query<BookQ>) -> Result<Response, ApiError> {
    let kind = kind_of(&q)?;
    if !valid_code(&series) {
        return Err(ApiError::not_found("Series"));
    }
    let limit = match q.limit.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => 50,
        Some(l) => l.parse::<usize>().map_err(|_| ApiError::bad("limit must be a number."))?.clamp(1, MAX_TRADES),
    };
    let key = format!("trades|{}|{series}|{limit}", kind.as_str());
    if let Some(v) = cached(&st, &key) {
        return Ok(ok(v));
    }
    if !st.books.active(PLATFORM_TENANT, kind) {
        return Err(inactive());
    }
    let list = book_feed::fetch_trades(&st, PLATFORM_TENANT, kind, &series, limit).await;
    let v = json!({"series": series, "kind": kind.as_str(), "trades": list.iter().map(|t| t.json()).collect::<Vec<_>>()});
    Ok(ok(store(&st, key, v)))
}

#[derive(Default, Clone, Copy)]
struct Tot {
    call_oi: f64,
    put_oi: f64,
    call_vol: f64,
    put_vol: f64,
}

impl Tot {
    fn add(&mut self, call: bool, oi: f64, vol: f64) {
        if call {
            self.call_oi += oi;
            self.call_vol += vol;
        } else {
            self.put_oi += oi;
            self.put_vol += vol;
        }
    }
    fn json(&self) -> Value {
        json!({"callOi": self.call_oi, "putOi": self.put_oi, "callVolume": self.call_vol, "putVolume": self.put_vol,
               "pcr": ratio(self.put_oi, self.call_oi), "pcrVolume": ratio(self.put_vol, self.call_vol)})
    }
}

/// `GET /v1/public/options/stats/{u}?kind=&expiry=`
pub async fn stats(State(st): State<AppState>, Path(u): Path<String>, Query(q): Query<BookQ>) -> Result<Response, ApiError> {
    let kind = kind_of(&q)?;
    let sym = u.trim().to_ascii_uppercase();
    let expiry = q.expiry.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")).transpose().map_err(|_| ApiError::bad("expiry must be YYYY-MM-DD."))?;
    let key = format!("stats|{}|{sym}|{expiry:?}", kind.as_str());
    if let Some(v) = cached(&st, &key) {
        return Ok(ok(v));
    }
    if !st.books.active(PLATFORM_TENANT, kind) {
        return Err(inactive());
    }
    let rd = st.refdata().await;
    let und = rd.underlying(&sym).filter(|x| x.enabled).ok_or_else(|| ApiError::not_found("Underlying"))?;
    let mut exps: Vec<&crate::model::Expiry> = super::public::open_expiries(&rd, &und.symbol).filter(|e| expiry.is_none_or(|d| d == e.expiry_date)).collect();
    exps.sort_by_key(|e| e.cut_at);
    let mut total = Tot::default();
    let mut out = Vec::new();
    for e in exps {
        let series: Vec<&crate::model::Series> = rd.series_of(e.id).filter(|s| s.status != "delisted").collect();
        let tops = st.books.tops(PLATFORM_TENANT, kind, series.iter().map(|s| s.code.as_str()));
        let mut tot = Tot::default();
        let mut strikes: Vec<(String, f64, Value)> = Vec::new();
        for s in series {
            let t = tops.get(&s.code).copied().unwrap_or_default();
            let call = s.kind == "call";
            tot.add(call, t.oi, t.volume);
            let label = optmath::ladder::format_strike(s.strike_ticks, und.strike_step);
            let side = json!({"series": s.code, "oi": t.oi, "volume": t.volume, "last": t.last.map(|x| round_to(x, 12))});
            if strikes.last().is_none_or(|r| r.0 != label) {
                strikes.push((label.clone(), s.strike, json!({"strike": s.strike, "strikeLabel": label, "call": null, "put": null})));
            }
            strikes.last_mut().unwrap().2[if call { "call" } else { "put" }] = side;
        }
        total.call_oi += tot.call_oi;
        total.put_oi += tot.put_oi;
        total.call_vol += tot.call_vol;
        total.put_vol += tot.put_vol;
        let mut ev = tot.json();
        ev["date"] = json!(e.expiry_date);
        ev["cutAt"] = json!(e.cut_at);
        ev["strikes"] = json!(strikes.into_iter().map(|x| x.2).collect::<Vec<_>>());
        out.push(ev);
    }
    let v = json!({"underlying": und.symbol, "kind": kind.as_str(), "at": Utc::now(), "totals": total.json(), "expiries": out});
    Ok(ok(store(&st, key, v)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_ip_rules() {
        let mut h = HeaderMap::new();
        let lo: IpAddr = "127.0.0.1".parse().unwrap();
        let ext: IpAddr = "203.0.113.9".parse().unwrap();
        // a loopback peer without forwarding headers is internal (the BFFs)
        assert_eq!(client_ip(&h, Some(lo), "tok"), None);
        assert_eq!(client_ip(&h, None, "tok"), None);
        // a direct external peer is limited
        assert_eq!(client_ip(&h, Some(ext), "tok"), Some(ext));
        // behind Caddy: the first X-Forwarded-For hop
        h.insert("x-forwarded-for", "198.51.100.7, 10.0.0.1".parse().unwrap());
        assert_eq!(client_ip(&h, Some(lo), "tok"), Some("198.51.100.7".parse().unwrap()));
        // the internal token exempts
        h.insert("x-kalks-internal", "tok".parse().unwrap());
        assert_eq!(client_ip(&h, Some(lo), "tok"), None);
        h.insert("x-kalks-internal", "nope".parse().unwrap());
        assert!(client_ip(&h, Some(lo), "tok").is_some());
        // X-Real-IP when there is no X-Forwarded-For
        let mut h2 = HeaderMap::new();
        h2.insert("x-real-ip", "192.0.2.1".parse().unwrap());
        assert_eq!(client_ip(&h2, Some(lo), ""), Some("192.0.2.1".parse().unwrap()));
    }
}
