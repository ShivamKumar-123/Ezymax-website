//! Live crypto prices straight from Binance.
//!
//! Every crypto instrument's provider code already *is* its Binance symbol (`BTCUSD` → `BTCUSDT`), because the
//! upstream relays Binance pairs. Going to the source removes a hop that was costing most of the ticks: measured
//! on the live service, the relayed crypto feed delivered 0.3–0.9 updates per second per symbol, while Binance
//! pushes on every change of the best bid / ask. Prices matched the relay to the cent, so this is about how often
//! the chart moves, not about which number is right.
//!
//! Two streams per symbol, the same two kinds of event the relay sent:
//!
//! * `@aggTrade` → `on_trade` (last price and volume: what the candles are built from)
//! * `@bookTicker` → `on_book` (best bid / ask: what the quotes and fills use)
//!
//! Crypto is **not** part of the provider's plan limit any more, so every crypto instrument streams all the time
//! and `demand.rs` never has to choose between them. That also hands the plan's slots back to forex, metals,
//! indices and stocks, which do have to share them.
//!
//! Closed candles are still reconciled against the provider's klines (`backfill.rs`). That stays correct: the
//! upstream's crypto klines are Binance's own, so the reconciler keeps replacing our live-built bars with
//! Binance's official OHLC, exactly as before.

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::protocol::{CloseFrame, frame::coding::CloseCode};

use crate::config::Config;
use crate::ingest::{Backoff, Outcome, Stop};
use crate::state::Market;

/// The business name this feed reports itself as on `/health`, next to the provider's own markets.
pub const BUSINESS: &str = "binance";

/// Binance accepts at most 1024 streams on one connection and 5 incoming messages a second; 167 crypto
/// instruments make 334 streams, so one connection is enough, subscribed in modest batches.
const STREAMS_PER_MESSAGE: usize = 150;

/// A silent socket means a dead socket: Binance sends a ping every 20 minutes, and any busy market sends far
/// more often than this.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);

/// The Binance symbols of every crypto instrument, lower-cased the way the stream names want them.
pub fn symbols(market: &Market) -> Vec<String> {
    let mut v: Vec<String> = market
        .cat
        .list
        .iter()
        .filter(|i| i.asset_class == "crypto")
        .map(|i| i.provider.code.to_ascii_lowercase())
        .collect();
    v.sort();
    v.dedup();
    v
}

/// `["btcusdt", …]` → the `{"method":"SUBSCRIBE","params":[…],"id":n}` frames that subscribe to both streams of
/// each symbol, in batches Binance will accept.
pub fn subscribe_messages(symbols: &[String]) -> Vec<String> {
    let mut streams: Vec<String> = Vec::with_capacity(symbols.len() * 2);
    for s in symbols {
        streams.push(format!("{s}@aggTrade"));
        streams.push(format!("{s}@bookTicker"));
    }
    streams
        .chunks(STREAMS_PER_MESSAGE)
        .enumerate()
        .map(|(n, c)| serde_json::json!({"method": "SUBSCRIBE", "params": c, "id": n + 1}).to_string())
        .collect()
}

fn f64_of(v: &Value) -> Option<f64> {
    match v {
        Value::String(s) => s.parse().ok(),
        Value::Number(n) => n.as_f64(),
        _ => None,
    }
}

/// Applies one stream payload. Returns true when it was a price we understood.
fn apply(market: &Market, data: &Value) -> bool {
    let Some(code) = data["s"].as_str() else { return false };
    // the catalogue is keyed by the provider's market name and the upper-case code, which is what Binance sends
    let Some(inst) = market.cat.from_provider("crypto", code) else { return false };
    let symbol = inst.symbol.clone();
    let now = chrono::Utc::now().timestamp_millis();
    match data["e"].as_str() {
        // aggregate trade: price `p`, quantity `q`, trade time `T`
        Some("aggTrade") => {
            let Some(p) = f64_of(&data["p"]) else { return false };
            let t = data["T"].as_i64().unwrap_or(now);
            market.on_trade(&symbol, p, f64_of(&data["q"]).unwrap_or(0.0), t);
            true
        }
        // bookTicker carries no "e" on the combined stream; it is recognised by its b/a fields
        _ => {
            let (Some(b), Some(a)) = (f64_of(&data["b"]), f64_of(&data["a"])) else { return false };
            if b <= 0.0 || a <= 0.0 {
                return false;
            }
            market.on_book(&symbol, b, a, now);
            true
        }
    }
}

/// One connection, held until it drops or we are told to stop.
async fn session(url: &str, symbols: &[String], market: &Market, mut stop: Stop) -> anyhow::Result<()> {
    let (mut ws, _) = connect_async(url).await?;
    market.set_connected(BUSINESS, true);
    for m in subscribe_messages(symbols) {
        ws.send(Message::text(m)).await?;
        // stay under the 5 messages a second Binance allows
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    tracing::info!(symbols = symbols.len(), "binance crypto feed subscribed");

    let mut idle = tokio::time::interval(IDLE_TIMEOUT);
    idle.tick().await;
    let mut seen = Instant::now();
    loop {
        tokio::select! {
            _ = stop.changed() => break,
            _ = idle.tick() => {
                if seen.elapsed() >= IDLE_TIMEOUT {
                    anyhow::bail!("no frame for {}s", IDLE_TIMEOUT.as_secs());
                }
            }
            msg = ws.next() => {
                let Some(msg) = msg else { break };
                match msg? {
                    Message::Text(t) => {
                        seen = Instant::now();
                        let Ok(v) = serde_json::from_str::<Value>(&t) else { continue };
                        // combined stream: {"stream": "...", "data": {...}}; a bare object is a control reply
                        let data = if v["data"].is_object() { &v["data"] } else { &v };
                        apply(market, data);
                    }
                    // tokio-tungstenite answers pings itself; a pong keeps some proxies happy
                    Message::Ping(p) => {
                        seen = Instant::now();
                        ws.send(Message::Pong(p)).await?;
                    }
                    Message::Pong(_) | Message::Binary(_) | Message::Frame(_) => seen = Instant::now(),
                    Message::Close(_) => break,
                }
            }
        }
    }
    let _ = ws.send(Message::Close(Some(CloseFrame { code: CloseCode::Normal, reason: "ezymex market-data shutting down".into() }))).await;
    Ok(())
}

/// Runs the crypto feed, reconnecting with the same backoff the provider ingest uses.
pub fn spawn(cfg: &Config, market: Arc<Market>, stop: Stop) -> Option<tokio::task::JoinHandle<()>> {
    if !cfg.binance_enabled {
        return None;
    }
    let syms = symbols(&market);
    if syms.is_empty() {
        tracing::warn!("binance feed enabled but the catalogue has no crypto instruments");
        return None;
    }
    let url = cfg.binance_ws.clone();
    Some(tokio::spawn(async move {
        // the planner is what marks crypto as streaming (ingest::spawn_planner); this task only reports
        // whether the socket is up
        market.set_expected(BUSINESS, true);
        let mut backoff = Backoff::default();
        let mut stop2 = stop.clone();
        loop {
            if *stop2.borrow() {
                break;
            }
            let started = Instant::now();
            let res = session(&url, &syms, &market, stop.clone()).await;
            market.set_connected(BUSINESS, false);
            if *stop2.borrow() {
                break;
            }
            let (delay, _) = backoff.next(Outcome::Dropped, started.elapsed(), 1.0, chrono::Utc::now());
            match res {
                Ok(()) => tracing::warn!("binance stream closed; reconnecting in {}s", delay.as_secs()),
                Err(e) => tracing::warn!(error = %e, "binance stream error; reconnecting in {}s", delay.as_secs()),
            }
            tokio::select! {
                _ = tokio::time::sleep(delay) => {}
                _ = stop2.changed() => break,
            }
        }
        market.set_expected(BUSINESS, false);
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn subscribes_to_both_streams_of_every_symbol_in_batches() {
        let syms: Vec<String> = (0..100).map(|i| format!("sym{i}usdt")).collect();
        let msgs = subscribe_messages(&syms);
        // 200 streams in batches of 150
        assert_eq!(msgs.len(), 2);
        let all: Vec<String> = msgs
            .iter()
            .flat_map(|m| {
                let v: Value = serde_json::from_str(m).unwrap();
                assert_eq!(v["method"], "SUBSCRIBE");
                v["params"].as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect::<Vec<_>>()
            })
            .collect();
        assert_eq!(all.len(), 200);
        assert!(all.contains(&"sym0usdt@aggTrade".to_string()));
        assert!(all.contains(&"sym0usdt@bookTicker".to_string()));
        // ids are distinct, which is what Binance acknowledges against
        let ids: BTreeSet<i64> = msgs.iter().map(|m| serde_json::from_str::<Value>(m).unwrap()["id"].as_i64().unwrap()).collect();
        assert_eq!(ids.len(), msgs.len());
    }

    #[test]
    fn one_symbol_is_one_message() {
        let msgs = subscribe_messages(&["btcusdt".into()]);
        assert_eq!(msgs.len(), 1);
        assert!(msgs[0].contains("btcusdt@aggTrade") && msgs[0].contains("btcusdt@bookTicker"));
    }

    #[test]
    fn numbers_arrive_as_strings() {
        assert_eq!(f64_of(&serde_json::json!("83154.48")), Some(83154.48));
        assert_eq!(f64_of(&serde_json::json!(83154.48)), Some(83154.48));
        assert_eq!(f64_of(&serde_json::json!("")), None);
        assert_eq!(f64_of(&Value::Null), None);
    }
}
