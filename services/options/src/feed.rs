//! Raw spot feed: market-data `WS /v1/stream?group=raw` (mids without any client spread), with a REST
//! fallback (`/v1/quotes?group=raw`) while the stream is down. market-data being absent is normal in
//! development: the service keeps running, chains show "no price" and the TWAP sampler records gaps.

use std::collections::{BTreeSet, HashMap};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::sync::{RwLock, broadcast};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::AppState;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Spot {
    pub bid: f64,
    pub ask: f64,
    pub mid: f64,
    /// Provider time (ms).
    pub t: i64,
    /// Received here (ms, local clock).
    pub recv: i64,
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub struct Spots {
    map: RwLock<HashMap<String, Spot>>,
    /// Symbol whose mid changed (stream re-pricing).
    pub tx: broadcast::Sender<String>,
    pub ws_connected: AtomicBool,
}

impl Default for Spots {
    fn default() -> Self {
        Self { map: RwLock::new(HashMap::new()), tx: broadcast::channel(4096).0, ws_connected: AtomicBool::new(false) }
    }
}

impl Spots {
    pub async fn get(&self, symbol: &str) -> Option<Spot> {
        self.map.read().await.get(symbol).copied()
    }

    pub async fn all(&self) -> HashMap<String, Spot> {
        self.map.read().await.clone()
    }

    /// Sets a quote (tests and the feed). Ignores crossed / non-positive quotes.
    pub async fn set(&self, symbol: &str, bid: f64, ask: f64, t: i64) {
        if !(bid.is_finite() && ask.is_finite() && bid > 0.0 && ask >= bid) {
            return;
        }
        let s = Spot { bid, ask, mid: 0.5 * (bid + ask), t, recv: now_ms() };
        let changed = {
            let mut m = self.map.write().await;
            let changed = m.get(symbol).is_none_or(|o| o.mid != s.mid);
            m.insert(symbol.to_string(), s);
            changed
        };
        if changed {
            let _ = self.tx.send(symbol.to_string());
        }
    }

    pub fn connected(&self) -> bool {
        self.ws_connected.load(Ordering::Relaxed)
    }

    /// Value of one unit of `ccy` in USD from the spots (USD = 1; XXXUSD = mid; USDXXX = 1 / mid).
    pub async fn usd_per(&self, ccy: &str) -> Option<f64> {
        if ccy == "USD" {
            return Some(1.0);
        }
        let m = self.map.read().await;
        if let Some(s) = m.get(&format!("{ccy}USD")) {
            return Some(s.mid);
        }
        m.get(&format!("USD{ccy}")).map(|s| 1.0 / s.mid)
    }
}

/// Symbols the feed needs: every enabled underlying plus the USD conversion pairs of the quote currencies.
pub fn wanted_symbols(st: &AppState, rd: &crate::model::RefData) -> BTreeSet<String> {
    let _ = st;
    let mut out = BTreeSet::new();
    for u in rd.underlyings.iter().filter(|u| u.enabled) {
        out.insert(u.symbol.clone());
        if u.quote_ccy != "USD" {
            out.insert(format!("USD{}", u.quote_ccy));
        }
    }
    out
}

fn parse_quote(v: &Value) -> Option<(String, f64, f64, i64)> {
    if v["type"] != "quote" {
        return None;
    }
    Some((v["s"].as_str()?.to_string(), v["b"].as_f64()?, v["a"].as_f64()?, v["t"].as_i64().unwrap_or(0)))
}

/// REST fallback: one poll of `/v1/quotes`.
pub async fn poll_rest(st: &AppState, symbols: &BTreeSet<String>) -> anyhow::Result<usize> {
    if symbols.is_empty() {
        return Ok(0);
    }
    let list: Vec<&str> = symbols.iter().map(String::as_str).collect();
    let url = format!("{}/v1/quotes?symbols={}&group=raw", st.cfg.market_data_url, list.join(","));
    let v: Value = st.http.get(&url).timeout(Duration::from_secs(5)).send().await?.error_for_status()?.json().await?;
    let mut n = 0;
    if let Some(o) = v.as_object() {
        for (k, q) in o {
            if let (Some(b), Some(a)) = (q["bid"].as_f64(), q["ask"].as_f64()) {
                st.spots.set(k, b, a, q["t"].as_i64().unwrap_or(0)).await;
                n += 1;
            }
        }
    }
    Ok(n)
}

/// Runs forever: stream while possible, poll REST while not, reconnect with backoff, and reconnect when the
/// set of wanted symbols changes.
pub async fn run(st: AppState) {
    let mut backoff = 1u64;
    let mut warned = false;
    loop {
        let symbols = wanted_symbols(&st, &*st.refdata().await);
        match stream_once(&st, &symbols).await {
            Ok(()) => backoff = 1,
            Err(e) => {
                if !warned {
                    tracing::warn!(error = %e, url = %st.cfg.market_data_ws, "market-data stream unavailable; polling REST quotes until it is back");
                    warned = true;
                } else {
                    tracing::debug!(error = %e, "market-data stream still unavailable");
                }
            }
        }
        st.spots.ws_connected.store(false, Ordering::Relaxed);
        if let Err(e) = poll_rest(&st, &symbols).await {
            tracing::debug!(error = %e, "market-data REST quotes unavailable");
        }
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(30);
        if st.spots.connected() {
            warned = false;
        }
    }
}

async fn stream_once(st: &AppState, symbols: &BTreeSet<String>) -> anyhow::Result<()> {
    let sep = if st.cfg.market_data_ws.contains('?') { '&' } else { '?' };
    let url = format!("{}{sep}group=raw", st.cfg.market_data_ws);
    let (ws, _) = tokio::time::timeout(Duration::from_secs(10), connect_async(url.as_str())).await.map_err(|_| anyhow::anyhow!("connect timeout"))??;
    let (mut tx, mut rx) = ws.split();
    tx.send(Message::text(json!({"op": "subscribe", "symbols": symbols}).to_string())).await?;
    st.spots.ws_connected.store(true, Ordering::Relaxed);
    tracing::info!(symbols = symbols.len(), "market-data raw stream connected");
    let mut check = tokio::time::interval(Duration::from_secs(30));
    check.tick().await;
    loop {
        tokio::select! {
            msg = tokio::time::timeout(Duration::from_secs(20), rx.next()) => {
                let msg = msg.map_err(|_| anyhow::anyhow!("no frame for 20 s"))?;
                let Some(msg) = msg else { anyhow::bail!("stream closed") };
                match msg? {
                    Message::Text(t) => {
                        if let Ok(v) = serde_json::from_str::<Value>(&t)
                            && let Some((s, b, a, t)) = parse_quote(&v)
                        {
                            st.spots.set(&s, b, a, t).await;
                        }
                    }
                    Message::Ping(p) => tx.send(Message::Pong(p)).await?,
                    Message::Close(_) => anyhow::bail!("stream closed by server"),
                    _ => {}
                }
            }
            _ = check.tick() => {
                if wanted_symbols(st, &*st.refdata().await) != *symbols {
                    tracing::info!("underlying set changed; resubscribing");
                    return Ok(());
                }
            }
        }
    }
}

/// Shared handle type.
pub type SharedSpots = Arc<Spots>;
