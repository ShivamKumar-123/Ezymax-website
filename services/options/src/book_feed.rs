//! The trading engine's order book market data (docs/OPTIONS-EXCHANGE.md §10), merged into chains, the stream and the
//! public routes. The engine is the source of depth, trades, open interest and volume.
//!
//! * `WS {TRADING_URL}/v1/internal/options/book/stream` (with `X-Ezymex-Internal: TRADING_INTERNAL_TOKEN`): on connect
//!   a `depth` + `top` frame for every series of every book, then
//!   `{type:"top", tenant, kind, underlying, series, bid, bidQty, ask, askQty, last, lastQty, mark, oi, vol, state, seq}`
//!   and `{type:"depth", …, bids:[{price, qty, orders}], asks, seq}` (≤ 4/s per series), `{type:"trade", tenant, kind,
//!   underlying, series, fillId, price, qty, side, tradeKind, combo, at, seq}`, `{type:"hb"}` and `{type:"resync"}`.
//!   Reconnects with backoff (1 s doubling to 30 s; 60 s while the engine has no book feed, HTTP 404).
//! * `GET {TRADING_URL}/v1/internal/options/book/{tenant}/{kind}/snapshot` every 15 s for each tenant with the module
//!   on: `enabled` says whether that tenant's book is live for the account kind (the venue is forward-only), and the
//!   series views seed / repair the cache. 404 = no book there (house prices).
//! * `GET …/{tenant}/{kind}/trades?series=&limit=`: the public tape (the in-memory ring when the engine is down).
//!
//! When the engine is absent (refused / 404) nothing is active and every chain keeps today's house model quotes.
//! A dropped stream clears the cached books (the chain then shows empty sides and the model mark) until the
//! reconnect replays them.

use std::collections::{HashMap, VecDeque};
use std::sync::RwLock;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use serde_json::{Value, json};
use tokio_tungstenite::tungstenite::{self, Message, client::IntoClientRequest};

use crate::AppState;
use crate::pricing::BookTop;

/// Trades kept per series for the stream tape and the public fallback.
pub const TAPE_KEEP: usize = 200;
/// Depth levels per side.
pub const DEPTH_LEVELS: usize = 10;

/// Account kind of a book: demo and live never match.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Live,
    Demo,
}

impl Kind {
    pub const ALL: [Kind; 2] = [Kind::Live, Kind::Demo];
    pub fn parse(s: &str) -> Option<Kind> {
        match s.trim().to_ascii_lowercase().as_str() {
            "live" => Some(Kind::Live),
            "demo" => Some(Kind::Demo),
            _ => None,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Live => "live",
            Kind::Demo => "demo",
        }
    }
}

/// One price level: (premium per unit, contracts, orders).
pub type Level = (f64, f64, u32);

/// Everything public about one series' book.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct SeriesBook {
    pub underlying: String,
    pub bid: Option<(f64, f64)>,
    pub ask: Option<(f64, f64)>,
    pub last: Option<f64>,
    pub last_qty: Option<f64>,
    /// The engine's public mark (default group, clamped inside the book).
    pub mark: Option<f64>,
    pub oi: f64,
    pub volume: f64,
    pub state: String,
    /// Engine book sequence of the last top.
    pub seq: u64,
    pub bids: Vec<Level>,
    pub asks: Vec<Level>,
    pub depth_seq: u64,
    /// Local revision of the depth (stream clients send a series when it moves).
    pub depth_rev: u64,
    /// When the depth was received (ms).
    pub depth_at: i64,
}

impl SeriesBook {
    pub fn top(&self) -> BookTop {
        BookTop { bid: self.bid, ask: self.ask, last: self.last, last_qty: self.last_qty, oi: self.oi, volume: self.volume }
    }
}

/// The client depth frame `{type:"depth", series, bids:[[price, qty, orders]], asks, seq, t}` (10 levels each side;
/// an empty book when there is none).
pub fn depth_json(series: &str, b: Option<&SeriesBook>) -> Value {
    let lv = |l: &[Level]| l.iter().take(DEPTH_LEVELS).map(|(p, q, n)| json!([p, q, n])).collect::<Vec<_>>();
    match b {
        Some(b) => json!({"type": "depth", "series": series, "bids": lv(&b.bids), "asks": lv(&b.asks), "seq": b.depth_seq, "t": b.depth_at}),
        None => json!({"type": "depth", "series": series, "bids": [], "asks": [], "seq": null, "t": crate::feed::now_ms()}),
    }
}

/// One trade print.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Trade {
    pub id: String,
    pub series: String,
    pub price: f64,
    pub qty: f64,
    /// The aggressor's side.
    pub taker_side: String,
    /// book | rfq | liquidation | backstop | novation
    pub kind: String,
    pub combo: Option<i64>,
    /// ms since the epoch.
    pub at: i64,
    pub seq: u64,
    /// Local arrival number (monotonic across all books).
    #[serde(skip)]
    pub n: u64,
}

impl Trade {
    /// The client tape shape: `{id, series, time, t, price, qty, takerSide, side, kind, combo}` (`time` / `t` in ms).
    pub fn json(&self) -> Value {
        json!({"id": self.id, "series": self.series, "time": self.at, "t": self.at, "price": self.price, "qty": self.qty,
               "takerSide": self.taker_side, "side": self.taker_side, "kind": self.kind, "combo": self.combo})
    }
}

/// Top of book fields of a `top` frame.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct TopFields {
    pub bid: Option<(f64, f64)>,
    pub ask: Option<(f64, f64)>,
    pub last: Option<f64>,
    pub last_qty: Option<f64>,
    pub mark: Option<f64>,
    pub oi: f64,
    pub volume: f64,
    pub state: String,
    pub seq: u64,
}

/// A parsed engine frame.
#[derive(Clone, Debug, PartialEq)]
pub enum Frame {
    Top { tenant: String, kind: Kind, underlying: String, series: String, top: TopFields },
    Depth { tenant: String, kind: Kind, underlying: String, series: String, bids: Vec<Level>, asks: Vec<Level>, seq: u64 },
    Trade { tenant: String, kind: Kind, underlying: String, trade: Trade },
    Hb,
    Resync,
}

/// A number from a JSON number or a numeric string (the engine sends decimals as numbers, strings when exotic).
pub fn num(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
    .filter(|x: &f64| x.is_finite())
}

/// A level as `{price, qty, orders}` or `[price, qty, orders]`.
fn level(v: &Value) -> Option<Level> {
    let (p, q, n) = match v {
        Value::Array(a) => (a.first()?, a.get(1)?, a.get(2).unwrap_or(&Value::Null)),
        Value::Object(_) => (&v["price"], &v["qty"], &v["orders"]),
        _ => return None,
    };
    let (p, q) = (num(p)?, num(q)?);
    (p > 0.0 && q > 0.0).then_some((p, q, num(n).map(|x| x.max(0.0) as u32).unwrap_or(0)))
}

fn levels(v: &Value) -> Vec<Level> {
    v.as_array().map(|a| a.iter().filter_map(level).take(DEPTH_LEVELS).collect()).unwrap_or_default()
}

fn side(price: &Value, qty: &Value) -> Option<(f64, f64)> {
    let (p, q) = (num(price)?, num(qty)?);
    (p > 0.0 && q > 0.0).then_some((p, q))
}

fn at_ms(v: &Value) -> Option<i64> {
    match v {
        Value::String(s) => chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.timestamp_millis()),
        Value::Number(n) => n.as_i64().map(|x| if x < 100_000_000_000 { x * 1000 } else { x }),
        _ => None,
    }
}

/// Parses one engine frame (`None` for unknown or malformed frames).
pub fn parse_frame(v: &Value) -> Option<Frame> {
    let ty = v["type"].as_str()?;
    match ty {
        "hb" => return Some(Frame::Hb),
        "resync" => return Some(Frame::Resync),
        _ => {}
    }
    let tenant = v["tenant"].as_str()?.to_ascii_lowercase();
    let kind = Kind::parse(v["kind"].as_str()?)?;
    let underlying = v["underlying"].as_str().unwrap_or("").to_ascii_uppercase();
    let series = v["series"].as_str()?.to_string();
    let seq = v["seq"].as_u64().unwrap_or(0);
    match ty {
        "top" => Some(Frame::Top {
            tenant,
            kind,
            underlying,
            series,
            top: TopFields {
                bid: side(&v["bid"], &v["bidQty"]),
                ask: side(&v["ask"], &v["askQty"]),
                last: num(&v["last"]).filter(|x| *x > 0.0),
                last_qty: num(&v["lastQty"]),
                mark: num(&v["mark"]),
                oi: num(&v["oi"]).unwrap_or(0.0),
                volume: num(&v["vol"]).or_else(|| num(&v["volume"])).unwrap_or(0.0),
                state: v["state"].as_str().unwrap_or("open").to_string(),
                seq,
            },
        }),
        "depth" => Some(Frame::Depth { tenant, kind, underlying, series, bids: levels(&v["bids"]), asks: levels(&v["asks"]), seq }),
        "trade" => {
            let price = num(&v["price"])?;
            let qty = num(&v["qty"])?;
            let id = match &v["fillId"] {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                _ => format!("{series}-{seq}"),
            };
            let taker_side = match v["side"].as_str().or(v["takerSide"].as_str()) {
                Some("sell") => "sell",
                _ => "buy",
            };
            Some(Frame::Trade {
                tenant,
                kind,
                underlying,
                trade: Trade {
                    id,
                    series,
                    price,
                    qty,
                    taker_side: taker_side.into(),
                    kind: v["tradeKind"].as_str().or(v["kind"].as_str()).unwrap_or("book").to_string(),
                    combo: v["combo"].as_i64(),
                    at: at_ms(&v["at"]).unwrap_or_else(crate::feed::now_ms),
                    seq,
                    n: 0,
                },
            })
        }
        _ => None,
    }
}

type SeriesKey = (String, Kind, String);
type BookKey = (String, Kind, String);

/// The cache the feed maintains. Pure (no IO): frames and snapshots are applied by the caller.
#[derive(Default)]
pub struct FeedState {
    /// Whether a tenant's book is live for an account kind (from the engine snapshot's `enabled`).
    venues: HashMap<(String, Kind), bool>,
    books: HashMap<SeriesKey, SeriesBook>,
    tape: HashMap<SeriesKey, VecDeque<Trade>>,
    /// Revision of the tops of one (tenant, kind, underlying): chains are re-priced when it moves.
    revs: HashMap<BookKey, u64>,
    venue_rev: u64,
    counter: u64,
}

impl FeedState {
    fn next(&mut self) -> u64 {
        self.counter += 1;
        self.counter
    }

    fn bump(&mut self, tenant: &str, kind: Kind, underlying: &str) {
        let n = self.next();
        self.revs.insert((tenant.to_string(), kind, underlying.to_string()), n);
    }

    pub fn active(&self, tenant: &str, kind: Kind) -> bool {
        self.venues.get(&(tenant.to_string(), kind)).copied().unwrap_or(false)
    }

    /// Changes whenever the venue flags or the tops of this underlying's book change.
    pub fn rev(&self, tenant: &str, kind: Kind, underlying: &str) -> u64 {
        self.venue_rev + self.revs.get(&(tenant.to_string(), kind, underlying.to_string())).copied().unwrap_or(0)
    }

    /// Sets the venue flag; switching a venue off drops its data. True when it changed.
    pub fn set_venue(&mut self, tenant: &str, kind: Kind, enabled: bool) -> bool {
        let prev = self.venues.insert((tenant.to_string(), kind), enabled).unwrap_or(false);
        if !enabled {
            self.books.retain(|k, _| !(k.0 == tenant && k.1 == kind));
            self.tape.retain(|k, _| !(k.0 == tenant && k.1 == kind));
        }
        if prev != enabled {
            self.venue_rev += 1;
        }
        prev != enabled
    }

    /// Applies one frame (`now_ms` stamps depth arrivals). Returns true when anything changed.
    pub fn apply(&mut self, f: Frame, now_ms: i64) -> bool {
        match f {
            Frame::Top { tenant, kind, underlying, series, top } => {
                let key = (tenant.clone(), kind, series);
                let b = self.books.entry(key).or_default();
                if top.seq > 0 && b.seq > top.seq {
                    return false;
                }
                let changed = b.bid != top.bid || b.ask != top.ask || b.last != top.last || b.oi != top.oi || b.volume != top.volume || b.state != top.state || b.mark != top.mark;
                if !underlying.is_empty() {
                    b.underlying = underlying.clone();
                }
                let u = b.underlying.clone();
                (b.bid, b.ask, b.last, b.last_qty, b.mark, b.oi, b.volume, b.state, b.seq) = (top.bid, top.ask, top.last, top.last_qty, top.mark, top.oi, top.volume, top.state, top.seq.max(b.seq));
                if changed {
                    self.bump(&tenant, kind, &u);
                }
                changed
            }
            Frame::Depth { tenant, kind, underlying, series, bids, asks, seq } => {
                let rev = self.next();
                let b = self.books.entry((tenant, kind, series)).or_default();
                if seq > 0 && b.depth_seq > seq {
                    return false;
                }
                if !underlying.is_empty() {
                    b.underlying = underlying;
                }
                let changed = b.bids != bids || b.asks != asks;
                (b.bids, b.asks, b.depth_seq, b.depth_at) = (bids, asks, seq.max(b.depth_seq), now_ms);
                if changed || b.depth_rev == 0 {
                    b.depth_rev = rev;
                }
                changed
            }
            Frame::Trade { tenant, kind, underlying, mut trade } => {
                trade.n = self.next();
                let key = (tenant.clone(), kind, trade.series.clone());
                let ring = self.tape.entry(key).or_default();
                if ring.iter().any(|t| t.id == trade.id) {
                    return false;
                }
                ring.push_back(trade);
                while ring.len() > TAPE_KEEP {
                    ring.pop_front();
                }
                if !underlying.is_empty() {
                    self.bump(&tenant, kind, &underlying);
                }
                true
            }
            Frame::Hb | Frame::Resync => false,
        }
    }

    /// Applies an engine snapshot `{tenant, kind, enabled, books:[{underlying, seq, series:[view]}]}`: the venue flag
    /// (`enabled`, else "has books") and every series view that is not older than the cache. Returns the flag.
    pub fn apply_snapshot(&mut self, tenant: &str, kind: Kind, v: &Value, now_ms: i64) -> bool {
        let books = v["books"].as_array().cloned().unwrap_or_default();
        let enabled = v["enabled"].as_bool().unwrap_or(!books.is_empty());
        self.set_venue(tenant, kind, enabled);
        if !enabled {
            return false;
        }
        for b in &books {
            let underlying = b["underlying"].as_str().unwrap_or("").to_ascii_uppercase();
            for s in b["series"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
                let Some(series) = s["series"].as_str() else { continue };
                let bids = levels(&s["bids"]);
                let asks = levels(&s["asks"]);
                let seq = s["seq"].as_u64().unwrap_or(0);
                let top = TopFields {
                    bid: bids.first().map(|l| (l.0, l.1)),
                    ask: asks.first().map(|l| (l.0, l.1)),
                    last: num(&s["last"]).filter(|x| *x > 0.0),
                    last_qty: num(&s["lastQty"]),
                    mark: num(&s["mark"]),
                    oi: num(&s["oi"]).unwrap_or(0.0),
                    volume: num(&s["vol"]).or_else(|| num(&s["volume"])).unwrap_or(0.0),
                    state: s["state"].as_str().unwrap_or("open").to_string(),
                    seq,
                };
                let u = s["underlying"].as_str().map(str::to_ascii_uppercase).unwrap_or_else(|| underlying.clone());
                self.apply(Frame::Top { tenant: tenant.into(), kind, underlying: u.clone(), series: series.into(), top }, now_ms);
                self.apply(Frame::Depth { tenant: tenant.into(), kind, underlying: u, series: series.into(), bids, asks, seq }, now_ms);
            }
        }
        true
    }

    /// Drops every cached book (stream lost); the venue flags stay.
    pub fn clear_books(&mut self) {
        let keys: Vec<BookKey> = self.books.iter().map(|((t, k, _), b)| (t.clone(), *k, b.underlying.clone())).collect();
        self.books.clear();
        for (t, k, u) in keys {
            self.bump(&t, k, &u);
        }
    }

    pub fn book(&self, tenant: &str, kind: Kind, series: &str) -> Option<&SeriesBook> {
        self.books.get(&(tenant.to_string(), kind, series.to_string()))
    }

    /// Trades of a series newer than local number `after`, oldest first.
    pub fn trades_after(&self, tenant: &str, kind: Kind, series: &str, after: u64) -> Vec<Trade> {
        self.tape.get(&(tenant.to_string(), kind, series.to_string())).map(|r| r.iter().filter(|t| t.n > after).cloned().collect()).unwrap_or_default()
    }

    /// The latest `limit` trades of a series, newest first.
    pub fn recent(&self, tenant: &str, kind: Kind, series: &str, limit: usize) -> Vec<Trade> {
        self.tape.get(&(tenant.to_string(), kind, series.to_string())).map(|r| r.iter().rev().take(limit).cloned().collect()).unwrap_or_default()
    }

    /// The highest local number handed out so far.
    pub fn counter(&self) -> u64 {
        self.counter
    }

    pub fn venues(&self) -> Vec<(String, Kind, bool)> {
        let mut v: Vec<_> = self.venues.iter().map(|((t, k), on)| (t.clone(), *k, *on)).collect();
        v.sort();
        v
    }

    pub fn series_count(&self) -> usize {
        self.books.len()
    }
}

/// The shared feed handle (in `AppState`).
#[derive(Default)]
pub struct BookFeed {
    state: RwLock<FeedState>,
    connected: AtomicBool,
    /// The engine answered a book route at least once.
    present: AtomicBool,
    frames: AtomicU64,
    /// Latest EOD mark per series (per unit), for `change`.
    eod: RwLock<HashMap<String, f64>>,
}

impl BookFeed {
    pub fn read<R>(&self, f: impl FnOnce(&FeedState) -> R) -> R {
        f(&self.state.read().unwrap())
    }

    pub fn write<R>(&self, f: impl FnOnce(&mut FeedState) -> R) -> R {
        f(&mut self.state.write().unwrap())
    }

    pub fn active(&self, tenant: &str, kind: Kind) -> bool {
        self.read(|s| s.active(tenant, kind))
    }

    pub fn rev(&self, tenant: &str, kind: Kind, underlying: &str) -> u64 {
        self.read(|s| s.rev(tenant, kind, underlying))
    }

    /// Tops of the given series (series without a book are left out).
    pub fn tops<'a>(&self, tenant: &str, kind: Kind, codes: impl IntoIterator<Item = &'a str>) -> HashMap<String, BookTop> {
        self.read(|s| codes.into_iter().filter_map(|c| s.book(tenant, kind, c).map(|b| (c.to_string(), b.top()))).collect())
    }

    pub fn book(&self, tenant: &str, kind: Kind, series: &str) -> Option<SeriesBook> {
        self.read(|s| s.book(tenant, kind, series).cloned())
    }

    /// The previous EOD mark of the given series.
    pub fn prev_close<'a>(&self, codes: impl IntoIterator<Item = &'a str>) -> HashMap<String, f64> {
        let m = self.eod.read().unwrap();
        codes.into_iter().filter_map(|c| m.get(c).map(|x| (c.to_string(), *x))).collect()
    }

    pub fn set_eod(&self, m: HashMap<String, f64>) {
        *self.eod.write().unwrap() = m;
    }

    pub fn connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    pub fn present(&self) -> bool {
        self.present.load(Ordering::Relaxed)
    }

    /// Feed status for `/v1/internal/options/status` and the Back Office.
    pub fn status(&self) -> Value {
        let (venues, series) = self.read(|s| (s.venues(), s.series_count()));
        json!({
            "connected": self.connected(),
            "engineHasBook": self.present(),
            "frames": self.frames.load(Ordering::Relaxed),
            "series": series,
            "venues": venues.iter().map(|(t, k, on)| json!({"tenant": t, "kind": k.as_str(), "active": on})).collect::<Vec<_>>(),
        })
    }
}

/// `http(s)://host` → `ws(s)://host`.
pub fn ws_base(http: &str) -> String {
    match http.split_once("://") {
        Some(("https", rest)) => format!("wss://{rest}"),
        Some((_, rest)) => format!("ws://{rest}"),
        None => format!("ws://{http}"),
    }
}

/// Starts the stream consumer and the venue / EOD poller.
pub fn spawn(st: AppState) {
    tokio::spawn(venues_loop(st.clone()));
    tokio::spawn(stream_loop(st));
}

async fn venues_loop(st: AppState) {
    let mut eod_at: Option<std::time::Instant> = None;
    loop {
        refresh_venues(&st).await;
        if eod_at.is_none_or(|t| t.elapsed() > Duration::from_secs(300)) {
            match refresh_eod(&st).await {
                Ok(_) => eod_at = Some(std::time::Instant::now()),
                Err(e) => tracing::debug!(error = %e, "EOD marks for book changes not loaded"),
            }
        }
        tokio::time::sleep(Duration::from_secs(15)).await;
    }
}

/// Loads the latest EOD mark per series (the reference of `change`).
pub async fn refresh_eod(st: &AppState) -> anyhow::Result<usize> {
    let rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT DISTINCT ON (series_code) series_code, mark FROM marks_eod WHERE day >= CURRENT_DATE - 10 ORDER BY series_code, day DESC",
    )
    .fetch_all(&st.pool)
    .await?;
    let n = rows.len();
    st.books.set_eod(rows.into_iter().collect());
    Ok(n)
}

fn engine_get(st: &AppState, path: &str) -> reqwest::RequestBuilder {
    let mut rb = st.http.get(format!("{}{path}", st.cfg.trading_url)).timeout(Duration::from_secs(5));
    if !st.cfg.trading_token.is_empty() {
        rb = rb.header("x-ezymex-internal", &st.cfg.trading_token);
    }
    rb
}

/// Polls the engine snapshot of every (tenant with the module on, kind switched on): the venue flags and a cache
/// repair. 404 = no book there; an unreachable engine keeps the flags as they are.
pub async fn refresh_venues(st: &AppState) {
    let rd = st.refdata().await;
    let mut wanted: Vec<(String, Kind)> = Vec::new();
    for t in rd.tenants.values() {
        if t.enabled_live {
            wanted.push((t.tenant.clone(), Kind::Live));
        }
        if t.enabled_demo {
            wanted.push((t.tenant.clone(), Kind::Demo));
        }
    }
    drop(rd);
    // a tenant whose module was switched off keeps no venue
    let stale: Vec<(String, Kind)> = st.books.read(|s| s.venues().into_iter().filter(|(t, k, on)| *on && !wanted.contains(&(t.clone(), *k))).map(|(t, k, _)| (t, k)).collect());
    for (t, k) in stale {
        st.books.write(|s| s.set_venue(&t, k, false));
    }
    for (tenant, kind) in wanted {
        let res = engine_get(st, &format!("/v1/internal/options/book/{tenant}/{}/snapshot", kind.as_str())).send().await;
        match res {
            Ok(r) if r.status().is_success() => match r.json::<Value>().await {
                Ok(v) => {
                    st.books.present.store(true, Ordering::Relaxed);
                    let on = st.books.write(|s| s.apply_snapshot(&tenant, kind, &v, crate::feed::now_ms()));
                    tracing::trace!(%tenant, kind = kind.as_str(), on, "book venue refreshed");
                }
                Err(e) => tracing::debug!(%tenant, error = %e, "book snapshot unreadable"),
            },
            Ok(r) if r.status() == reqwest::StatusCode::NOT_FOUND => {
                if st.books.write(|s| s.set_venue(&tenant, kind, false)) {
                    tracing::info!(%tenant, kind = kind.as_str(), "order book not live: house prices");
                }
            }
            Ok(r) => tracing::debug!(%tenant, status = %r.status(), "book snapshot refused"),
            Err(e) => tracing::trace!(%tenant, error = %e, "trading engine unreachable"),
        }
    }
}

/// Why a stream attempt ended.
#[derive(Debug)]
enum StreamEnd {
    /// The engine has no book feed (HTTP 404 / 405 on upgrade).
    Absent,
    Error(anyhow::Error),
    Closed,
}

async fn stream_loop(st: AppState) {
    let mut backoff = 1u64;
    let mut warned = false;
    loop {
        let end = stream_once(&st).await;
        let was = st.books.connected.swap(false, Ordering::Relaxed);
        st.books.write(|s| s.clear_books());
        let wait = match end {
            StreamEnd::Closed => {
                backoff = 1;
                1
            }
            StreamEnd::Absent => {
                if !warned {
                    tracing::info!(url = %st.cfg.trading_url, "trading engine has no order book feed; chains keep house prices");
                    warned = true;
                }
                60
            }
            StreamEnd::Error(e) => {
                if was || !warned {
                    tracing::info!(error = %e, url = %st.cfg.trading_url, "order book feed unavailable; retrying");
                    warned = true;
                } else {
                    tracing::debug!(error = %e, "order book feed still unavailable");
                }
                let w = backoff;
                backoff = (backoff * 2).min(30);
                w
            }
        };
        // jitter up to 25 %
        let mut b = [0u8; 1];
        let _ = getrandom::fill(&mut b);
        let ms = wait * 1000 + (wait * 250 * b[0] as u64) / 255;
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }
}

async fn stream_once(st: &AppState) -> StreamEnd {
    let url = format!("{}/v1/internal/options/book/stream", ws_base(&st.cfg.trading_url));
    let mut req = match url.as_str().into_client_request() {
        Ok(r) => r,
        Err(e) => return StreamEnd::Error(e.into()),
    };
    if !st.cfg.trading_token.is_empty() {
        match st.cfg.trading_token.parse() {
            Ok(h) => {
                req.headers_mut().insert("x-ezymex-internal", h);
            }
            Err(_) => return StreamEnd::Error(anyhow::anyhow!("TRADING_INTERNAL_TOKEN is not a valid header value")),
        }
    }
    let ws = match tokio::time::timeout(Duration::from_secs(10), tokio_tungstenite::connect_async(req)).await {
        Err(_) => return StreamEnd::Error(anyhow::anyhow!("connect timeout")),
        Ok(Err(tungstenite::Error::Http(r))) if matches!(r.status().as_u16(), 404 | 405) => return StreamEnd::Absent,
        Ok(Err(e)) => return StreamEnd::Error(e.into()),
        Ok(Ok((ws, _))) => ws,
    };
    st.books.connected.store(true, Ordering::Relaxed);
    st.books.present.store(true, Ordering::Relaxed);
    tracing::info!(url = %url, "order book feed connected");
    {
        let st = st.clone();
        tokio::spawn(async move { refresh_venues(&st).await });
    }
    let (mut tx, mut rx) = ws.split();
    loop {
        let msg = match tokio::time::timeout(Duration::from_secs(20), rx.next()).await {
            Err(_) => return StreamEnd::Error(anyhow::anyhow!("no frame for 20 s")),
            Ok(None) => return StreamEnd::Closed,
            Ok(Some(Err(e))) => return StreamEnd::Error(e.into()),
            Ok(Some(Ok(m))) => m,
        };
        match msg {
            Message::Text(t) => {
                let Ok(v) = serde_json::from_str::<Value>(&t) else { continue };
                st.books.frames.fetch_add(1, Ordering::Relaxed);
                match parse_frame(&v) {
                    Some(Frame::Resync) => {
                        let st = st.clone();
                        tokio::spawn(async move { refresh_venues(&st).await });
                    }
                    Some(f) => {
                        st.books.write(|s| s.apply(f, crate::feed::now_ms()));
                    }
                    None => {}
                }
            }
            Message::Ping(p) => {
                if tx.send(Message::Pong(p)).await.is_err() {
                    return StreamEnd::Closed;
                }
            }
            Message::Close(_) => return StreamEnd::Closed,
            _ => {}
        }
    }
}

/// The public tape of a series: the engine's `trades` route, else the in-memory ring. Newest first.
pub async fn fetch_trades(st: &AppState, tenant: &str, kind: Kind, series: &str, limit: usize) -> Vec<Trade> {
    let path = format!("/v1/internal/options/book/{tenant}/{}/trades?series={}&limit={limit}", kind.as_str(), urlencode(series));
    if let Ok(r) = engine_get(st, &path).send().await
        && r.status().is_success()
        && let Ok(v) = r.json::<Value>().await
        && let Some(list) = v["trades"].as_array()
    {
        let mut out: Vec<Trade> = list
            .iter()
            .filter_map(|t| {
                let mut x = t.clone();
                x["type"] = json!("trade");
                x["tenant"] = json!(tenant);
                x["kind"] = json!(kind.as_str());
                if x["series"].is_null() {
                    x["series"] = json!(series);
                }
                match parse_frame(&x)? {
                    Frame::Trade { trade, .. } => Some(trade),
                    _ => None,
                }
            })
            .collect();
        out.sort_by(|a, b| b.at.cmp(&a.at).then(b.seq.cmp(&a.seq)));
        out.truncate(limit);
        return out;
    }
    st.books.read(|s| s.recent(tenant, kind, series, limit))
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn top(series: &str, bid: Option<(f64, f64)>, ask: Option<(f64, f64)>, seq: u64) -> Value {
        json!({"type": "top", "tenant": "ezymex", "kind": "live", "underlying": "EURUSD", "series": series,
               "bid": bid.map(|b| b.0), "bidQty": bid.map(|b| b.1), "ask": ask.map(|a| a.0), "askQty": ask.map(|a| a.1),
               "last": null, "lastQty": null, "mark": 0.0042, "oi": 12, "vol": 3, "state": "open", "seq": seq})
    }

    #[test]
    fn parses_the_engine_frames() {
        let f = parse_frame(&top("EURUSD-20261009-1.1700-C", Some((0.0041, 5.0)), None, 7)).unwrap();
        let Frame::Top { tenant, kind, underlying, series, top } = f else { panic!() };
        assert_eq!((tenant.as_str(), kind, underlying.as_str(), series.as_str()), ("ezymex", Kind::Live, "EURUSD", "EURUSD-20261009-1.1700-C"));
        assert_eq!((top.bid, top.ask, top.oi, top.volume, top.seq), (Some((0.0041, 5.0)), None, 12.0, 3.0, 7));

        // depth levels as objects (the engine) or tuples; decimals as numbers or strings; at most 10 levels
        let lv: Vec<Value> = (0..12).map(|i| json!({"price": format!("0.00{}", 40 - i), "qty": 2, "orders": 1})).collect();
        let d = json!({"type": "depth", "tenant": "Ezymex", "kind": "demo", "underlying": "eurusd", "series": "S", "bids": lv, "asks": [[0.005, 3, 2]], "seq": 9});
        let Some(Frame::Depth { tenant, kind, bids, asks, seq, .. }) = parse_frame(&d) else { panic!() };
        assert_eq!((tenant.as_str(), kind, bids.len(), asks, seq), ("ezymex", Kind::Demo, 10, vec![(0.005, 3.0, 2)], 9));
        assert_eq!(bids[0], (0.0040, 2.0, 1));

        let t = json!({"type": "trade", "tenant": "ezymex", "kind": "live", "underlying": "EURUSD", "series": "S", "fillId": "f-1", "price": 0.0043,
                       "qty": 2, "side": "sell", "tradeKind": "book", "combo": null, "at": "2026-10-02T12:00:00Z", "seq": 10});
        let Some(Frame::Trade { trade, .. }) = parse_frame(&t) else { panic!() };
        assert_eq!((trade.id.as_str(), trade.taker_side.as_str(), trade.kind.as_str(), trade.at), ("f-1", "sell", "book", 1_790_942_400_000));
        let j = trade.json();
        for k in ["series", "time", "price", "qty", "takerSide"] {
            assert!(!j[k].is_null(), "{k}");
        }

        assert_eq!(parse_frame(&json!({"type": "hb", "t": 1})), Some(Frame::Hb));
        assert_eq!(parse_frame(&json!({"type": "resync", "skipped": 3})), Some(Frame::Resync));
        assert_eq!(parse_frame(&json!({"type": "top", "tenant": "ezymex", "kind": "paper", "series": "S"})), None);
        assert_eq!(parse_frame(&json!({"nope": 1})), None);
    }

    #[test]
    fn cache_follows_frames_in_sequence() {
        let mut s = FeedState::default();
        assert!(!s.active("ezymex", Kind::Live));
        s.set_venue("ezymex", Kind::Live, true);
        let r0 = s.rev("ezymex", Kind::Live, "EURUSD");
        s.apply(parse_frame(&top("A", Some((0.004, 5.0)), Some((0.005, 5.0)), 5)).unwrap(), 0);
        let r1 = s.rev("ezymex", Kind::Live, "EURUSD");
        assert!(r1 > r0);
        // an older top is ignored
        assert!(!s.apply(parse_frame(&top("A", None, None, 4)).unwrap(), 0));
        assert_eq!(s.book("ezymex", Kind::Live, "A").unwrap().bid, Some((0.004, 5.0)));
        // the same top again does not move the revision
        s.apply(parse_frame(&top("A", Some((0.004, 5.0)), Some((0.005, 5.0)), 6)).unwrap(), 0);
        assert_eq!(s.rev("ezymex", Kind::Live, "EURUSD"), r1);
        // an emptied side
        s.apply(parse_frame(&top("A", None, Some((0.005, 5.0)), 7)).unwrap(), 0);
        assert_eq!(s.book("ezymex", Kind::Live, "A").unwrap().top().bid, None);
        assert!(s.rev("ezymex", Kind::Live, "EURUSD") > r1);
        // demo is a different book
        assert!(s.book("ezymex", Kind::Demo, "A").is_none());

        // tape: dedupe by id, ring order, cursor
        let tr = |id: &str| parse_frame(&json!({"type": "trade", "tenant": "ezymex", "kind": "live", "underlying": "EURUSD", "series": "A", "fillId": id, "price": 0.0045, "qty": 1, "side": "buy", "at": 1000, "seq": 8})).unwrap();
        let c0 = s.counter();
        assert!(s.apply(tr("1"), 0));
        assert!(!s.apply(tr("1"), 0));
        assert!(s.apply(tr("2"), 0));
        let after = s.trades_after("ezymex", Kind::Live, "A", c0);
        assert_eq!(after.iter().map(|t| t.id.as_str()).collect::<Vec<_>>(), ["1", "2"]);
        assert_eq!(s.recent("ezymex", Kind::Live, "A", 1)[0].id, "2");
        assert_eq!(after[0].at, 1_000_000, "unix seconds become ms");
        for i in 0..(TAPE_KEEP + 5) {
            s.apply(tr(&format!("x{i}")), 0);
        }
        assert_eq!(s.recent("ezymex", Kind::Live, "A", 10_000).len(), TAPE_KEEP);

        // depth revision moves only on a change
        let d = |q: f64, seq: u64| Frame::Depth { tenant: "ezymex".into(), kind: Kind::Live, underlying: "EURUSD".into(), series: "A".into(), bids: vec![(0.004, q, 1)], asks: vec![], seq };
        s.apply(d(5.0, 10), 0);
        let dr = s.book("ezymex", Kind::Live, "A").unwrap().depth_rev;
        s.apply(d(5.0, 11), 0);
        assert_eq!(s.book("ezymex", Kind::Live, "A").unwrap().depth_rev, dr);
        s.apply(d(6.0, 12), 0);
        assert!(s.book("ezymex", Kind::Live, "A").unwrap().depth_rev > dr);

        // venue off drops the data; a lost stream clears books but keeps the venue
        s.clear_books();
        assert!(s.book("ezymex", Kind::Live, "A").is_none() && s.active("ezymex", Kind::Live));
        s.set_venue("ezymex", Kind::Live, false);
        assert!(!s.active("ezymex", Kind::Live) && s.recent("ezymex", Kind::Live, "A", 5).is_empty());
    }

    #[test]
    fn snapshot_sets_the_venue_and_seeds_the_cache() {
        let mut s = FeedState::default();
        let snap = json!({"tenant": "ezymex", "kind": "live", "enabled": true, "books": [{"underlying": "EURUSD", "seq": 40, "series": [
            {"series": "A", "underlying": "EURUSD", "expiry": "2026-10-09", "state": "open", "bids": [{"price": 0.004, "qty": 5, "orders": 2}],
             "asks": [{"price": 0.0046, "qty": 3, "orders": 1}, {"price": 0.0047, "qty": 9, "orders": 1}], "last": 0.0043, "lastQty": 1, "oi": 25, "vol": 4, "seq": 40, "mark": 0.0043}]}]});
        assert!(s.apply_snapshot("ezymex", Kind::Live, &snap, 0));
        let b = s.book("ezymex", Kind::Live, "A").unwrap();
        assert_eq!((b.bid, b.ask, b.last, b.oi, b.volume, b.asks.len()), (Some((0.004, 5.0)), Some((0.0046, 3.0)), Some(0.0043), 25.0, 4.0, 2));
        // not enabled: inactive and nothing cached
        let off = json!({"tenant": "ezymex", "kind": "demo", "enabled": false, "books": []});
        assert!(!s.apply_snapshot("ezymex", Kind::Demo, &off, 0));
        assert!(!s.active("ezymex", Kind::Demo));
    }

    #[test]
    fn client_frame_shapes() {
        let b = SeriesBook { bids: vec![(0.004, 5.0, 2), (0.0039, 1.0, 1)], asks: vec![(0.0045, 3.0, 1)], depth_seq: 12, depth_at: 99, ..Default::default() };
        let d = depth_json("A", Some(&b));
        assert_eq!(d, json!({"type": "depth", "series": "A", "bids": [[0.004, 5.0, 2], [0.0039, 1.0, 1]], "asks": [[0.0045, 3.0, 1]], "seq": 12, "t": 99}));
        let e = depth_json("B", None);
        assert_eq!((e["bids"].as_array().unwrap().len(), e["asks"].as_array().unwrap().len()), (0, 0));
        let t = Trade { id: "9".into(), series: "A".into(), price: 0.0042, qty: 2.0, taker_side: "buy".into(), kind: "book".into(), combo: None, at: 5_000, seq: 3, n: 1 };
        let j = t.json();
        assert_eq!((j["series"].as_str(), j["time"].as_i64(), j["price"].as_f64(), j["qty"].as_f64(), j["takerSide"].as_str()), (Some("A"), Some(5_000), Some(0.0042), Some(2.0), Some("buy")));
    }

    #[test]
    fn ws_urls() {
        assert_eq!(ws_base("http://127.0.0.1:8090"), "ws://127.0.0.1:8090");
        assert_eq!(ws_base("https://engine.internal"), "wss://engine.internal");
        assert_eq!(urlencode("EURUSD-20261009-1.1700-C"), "EURUSD-20261009-1.1700-C");
        assert_eq!(urlencode("a b/c"), "a%20b%2Fc");
    }
}
