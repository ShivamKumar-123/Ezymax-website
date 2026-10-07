//! Price feed from market-data.
//!
//! One WebSocket per spread group (`/v1/stream?group=<spread_group>`), subscribed to every symbol. market-data
//! applies the group's spread markup, so the engine fills at exactly the bid/ask the client sees on the
//! chart and in the terminal (one source of truth for markups, edited in the Back Office). Each quote updates
//! the shared `QuoteBook` and is fanned out to the shards, which evaluate only the accounts holding a
//! position or pending order on that symbol in that spread group.

use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio_tungstenite::tungstenite::Message;

use crate::engine::{Quote, Quotes};
use crate::money::from_f64;
use crate::shard::{Hub, TickMsg};

#[derive(Default)]
pub struct QuoteBook {
    quotes: RwLock<HashMap<(String, String), Quote>>,
    /// spread group → (connected, last frame ms)
    status: RwLock<HashMap<String, (bool, i64)>>,
}

impl Quotes for QuoteBook {
    fn get(&self, spread_group: &str, symbol: &str) -> Option<Quote> {
        self.quotes.read().unwrap().get(&(spread_group.to_string(), symbol.to_string())).copied()
    }
}

impl QuoteBook {
    pub fn set(&self, group: &str, symbol: &str, q: Quote) {
        self.quotes.write().unwrap().insert((group.to_string(), symbol.to_string()), q);
    }
    fn mark(&self, group: &str, connected: bool) {
        let now = Utc::now().timestamp_millis();
        let mut s = self.status.write().unwrap();
        let e = s.entry(group.to_string()).or_insert((false, 0));
        e.0 = connected;
        e.1 = now;
    }
    fn seen(&self, group: &str) {
        if let Some(e) = self.status.write().unwrap().get_mut(group) {
            e.1 = Utc::now().timestamp_millis();
        }
    }
    /// group → (connected, ms since last frame)
    pub fn status(&self) -> HashMap<String, (bool, i64)> {
        let now = Utc::now().timestamp_millis();
        self.status.read().unwrap().iter().map(|(k, (c, t))| (k.clone(), (*c, now - t))).collect()
    }
    pub fn snapshot(&self, group: &str) -> Vec<(String, Quote)> {
        self.quotes.read().unwrap().iter().filter(|((g, _), _)| g == group).map(|((_, s), q)| (s.clone(), *q)).collect()
    }
}

/// Parses `{"type":"quote","s","b","a","l","t"}`. Delayed snapshots (`"d":1`: the last price of a symbol
/// market-data is not streaming, taken from the provider's bars) are not tradable prices and are skipped.
pub fn parse_quote(text: &str) -> Option<(String, Quote)> {
    let v: Value = serde_json::from_str(text).ok()?;
    if v["type"] != "quote" || v["d"].as_i64().unwrap_or(0) != 0 {
        return None;
    }
    let s = v["s"].as_str()?.to_string();
    let bid = from_f64(v["b"].as_f64()?)?;
    let ask = from_f64(v["a"].as_f64()?)?;
    let t = v["t"].as_i64().unwrap_or_else(|| Utc::now().timestamp_millis());
    if bid <= crate::money::ZERO || ask < bid {
        return None;
    }
    Some((s, Quote { bid, ask, t_ms: t }))
}

/// Keeps one connection per spread group in use; new groups (created in the Back Office) get a connection
/// within a few seconds.
pub fn spawn(hub: Hub, base_url: String, symbols: Vec<String>) {
    tokio::spawn(async move {
        let mut running: HashSet<String> = HashSet::new();
        loop {
            for g in hub.shared.registry.spread_groups() {
                if running.insert(g.clone()) {
                    tokio::spawn(connection(hub.clone(), base_url.clone(), g, symbols.clone()));
                }
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
}

/// Kalks FX Options: one more socket on market-data's raw book (`group=raw`, mids without any client spread).
/// Its quotes land in the `QuoteBook` under the group `raw` and its ticks wake the accounts holding options on
/// the underlying (barrier knocks, premium SL / TP, option orders and triggers, margin).
pub fn spawn_raw(hub: Hub, base_url: String, symbols: Vec<String>) {
    tokio::spawn(connection(hub, base_url, crate::options::RAW.to_string(), symbols));
}

async fn connection(hub: Hub, base_url: String, group: String, symbols: Vec<String>) {
    let url = format!("{base_url}?group={group}");
    let mut backoff = 1u64;
    let quotes = hub.shared.quotes.clone();
    let group_arc: Arc<str> = Arc::from(group.as_str());
    loop {
        match tokio_tungstenite::connect_async(url.as_str()).await {
            Ok((mut ws, _)) => {
                backoff = 1;
                quotes.mark(&group, true);
                tracing::info!(%group, "feed connected");
                // passive: the engine takes every price market-data streams, but only what it holds (below) asks
                // market-data to stream a symbol (the catalogue is far larger than the provider plan streams at once)
                let sub = serde_json::json!({"op": "subscribe", "symbols": symbols, "passive": true}).to_string();
                if ws.send(Message::text(sub)).await.is_err() {
                    quotes.mark(&group, false);
                    continue;
                }
                let mut held_sent: Option<BTreeSet<String>> = None;
                let mut hold_tick = tokio::time::interval(Duration::from_secs(5));
                let mut last_frame = tokio::time::Instant::now();
                loop {
                    let next = tokio::select! {
                        m = ws.next() => m,
                        _ = hold_tick.tick() => {
                            // market-data sends a heartbeat every 5 s; 20 s of silence = dead connection
                            if last_frame.elapsed() > Duration::from_secs(20) {
                                tracing::warn!(%group, "feed silent for 20s; reconnecting");
                                break;
                            }
                            // positions and pending orders (+ their USD conversion pairs) must keep streaming
                            let hold = crate::catalogue::hold_set(&hub.shared.specs.load(), &hub.shared.held.all());
                            if held_sent.as_ref() != Some(&hold) {
                                let m = serde_json::json!({"op": "hold", "symbols": hold}).to_string();
                                if ws.send(Message::text(m)).await.is_err() {
                                    break;
                                }
                                held_sent = Some(hold);
                            }
                            continue;
                        }
                    };
                    let msg = match next {
                        Some(Ok(m)) => m,
                        Some(Err(e)) => {
                            tracing::warn!(%group, error = %e, "feed error");
                            break;
                        }
                        None => break,
                    };
                    last_frame = tokio::time::Instant::now();
                    let Message::Text(text) = msg else { continue };
                    quotes.seen(&group);
                    if let Some((sym, q)) = parse_quote(text.as_str()) {
                        quotes.set(&group, &sym, q);
                        hub.tick(Arc::new(TickMsg { group: group_arc.clone(), symbol: Arc::from(sym.as_str()), recv_ms: Utc::now().timestamp_millis() })).await;
                    }
                }
                quotes.mark(&group, false);
                tracing::warn!(%group, "feed disconnected");
            }
            Err(e) => {
                quotes.mark(&group, false);
                tracing::warn!(%group, error = %e, backoff, "feed connect failed");
            }
        }
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(30);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_market_data_frames() {
        let (s, q) = parse_quote(r#"{"type":"quote","s":"EURUSD","b":1.13591,"a":1.13603,"l":1.13596,"t":1790602618652,"r":1}"#).unwrap();
        assert_eq!(s, "EURUSD");
        assert_eq!(q.bid.to_string(), "1.13591");
        assert_eq!(q.ask.to_string(), "1.13603");
        assert!(parse_quote(r#"{"type":"hb","t":1}"#).is_none());
        assert!(parse_quote(r#"{"type":"quote","s":"X","b":0,"a":1}"#).is_none());
        // a delayed snapshot of a symbol that is not streaming is never a tradable price
        assert!(parse_quote(r#"{"type":"quote","s":"AUDDKK","b":4.21,"a":4.22,"l":4.215,"t":1790602618652,"r":1,"d":1}"#).is_none());
    }
}
