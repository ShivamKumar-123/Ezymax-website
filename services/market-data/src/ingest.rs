//! Live provider ingest: one WebSocket per Infoway market (common / crypto / stock).
//! Subscribes to trades (10000 → pushes 10002) and depth (10003 → pushes 10005), sends the
//! 10010 heartbeat every 30s and reconnects with backoff (reset after a healthy session).

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::config::Config;
use crate::state::Market;

fn num(v: &Value) -> Option<f64> {
    match v {
        Value::String(s) => s.parse().ok(),
        Value::Number(n) => n.as_f64(),
        _ => None,
    }
}

pub fn spawn_all(cfg: &Config, market: Arc<Market>) {
    for m in market.cat.markets() {
        let codes = market.cat.codes_for(&m);
        if codes.is_empty() {
            continue;
        }
        let url = format!("{}?business={}&apikey={}", cfg.infoway_ws, m, cfg.infoway_key);
        let mk = market.clone();
        tokio::spawn(async move { run(m, url, codes, mk).await });
    }
}

/// Minimum uptime for a session to count as healthy (resets the reconnect backoff).
const HEALTHY_SESSION: Duration = Duration::from_secs(30);

async fn run(business: String, url: String, codes: Vec<String>, market: Arc<Market>) {
    let mut backoff = 1u64;
    loop {
        let started = Instant::now();
        // run each session in its own task so a panic inside it becomes a reconnect, never a silent stop
        let (b, u, c, m) = (business.clone(), url.clone(), codes.clone(), market.clone());
        let joined = tokio::spawn(async move {
            let mut subscribed = false;
            let r = session(&b, &u, &c, &m, &mut subscribed).await;
            (r, subscribed)
        })
        .await;
        let (res, subscribed) = match joined {
            Ok(v) => v,
            Err(e) => (Err(anyhow::anyhow!("provider session task crashed: {e}")), false),
        };
        // a session that subscribed and stayed up was healthy: the next drop starts over at 1s
        if subscribed && started.elapsed() >= HEALTHY_SESSION {
            backoff = 1;
        }
        match res {
            Ok(()) => tracing::warn!(%business, "provider stream closed; reconnecting in {backoff}s"),
            Err(e) => tracing::warn!(%business, error = %e, "provider stream error; reconnecting in {backoff}s"),
        }
        market.set_connected(&business, false);
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(30);
    }
}

/// No frame at all for this long while the market is open = dead connection.
const IDLE_TIMEOUT: Duration = Duration::from_secs(25);
/// Crypto trades around the clock: this long without a single trade means the stream has silently stalled.
const CRYPTO_TRADE_TIMEOUT: Duration = Duration::from_secs(15);

async fn session(business: &str, url: &str, codes: &[String], market: &Arc<Market>, subscribed: &mut bool) -> anyhow::Result<()> {
    let (ws, _) = tokio::time::timeout(Duration::from_secs(10), connect_async(url)).await.map_err(|_| anyhow::anyhow!("connect timeout"))??;
    if let tokio_tungstenite::MaybeTlsStream::Rustls(s) = ws.get_ref() {
        let _ = s.get_ref().0.set_nodelay(true);
    }
    let (mut tx, mut rx) = ws.split();
    let joined = codes.join(",");
    tx.send(Message::text(json!({"code": 10000, "trace": format!("kalks-{business}-trade"), "data": {"codes": joined}}).to_string())).await?;
    tx.send(Message::text(json!({"code": 10003, "trace": format!("kalks-{business}-depth"), "data": {"codes": joined}}).to_string())).await?;
    tracing::info!(%business, symbols = codes.len(), "subscribed to provider stream");
    market.set_connected(business, true);
    *subscribed = true;

    let mut heartbeat = tokio::time::interval(Duration::from_secs(10));
    heartbeat.tick().await;
    let mut watchdog = tokio::time::interval(Duration::from_secs(1));
    let (mut last_frame, mut last_trade) = (Instant::now(), Instant::now());
    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                tx.send(Message::text(json!({"code": 10010, "trace": format!("kalks-{business}-hb")}).to_string())).await?;
            }
            _ = watchdog.tick() => {
                // the provider does not answer heartbeats, so silence only means "dead" while a symbol of this
                // stream is in its trading session (FX/indices are legitimately silent over the weekend)
                let now = chrono::Utc::now();
                let open = market.cat.list.iter().any(|i| i.provider.market == business && i.in_session(now));
                if open && last_frame.elapsed() > IDLE_TIMEOUT {
                    anyhow::bail!("no data for {}s", IDLE_TIMEOUT.as_secs());
                }
                if business == "crypto" && last_trade.elapsed() > CRYPTO_TRADE_TIMEOUT {
                    anyhow::bail!("no trades for {}s (stalled stream)", CRYPTO_TRADE_TIMEOUT.as_secs());
                }
            }
            msg = rx.next() => {
                let Some(msg) = msg else { return Ok(()) };
                last_frame = Instant::now();
                match msg? {
                    Message::Text(t) => {
                        if handle(business, &t, market) {
                            last_trade = last_frame;
                        }
                    }
                    Message::Ping(p) => tx.send(Message::Pong(p)).await?,
                    Message::Close(_) => return Ok(()),
                    _ => {}
                }
            }
        }
    }
}

/// Applies one provider frame; true when it was a trade.
fn handle(business: &str, text: &str, market: &Arc<Market>) -> bool {
    let Ok(v) = serde_json::from_str::<Value>(text) else { return false };
    let code = v.get("code").and_then(Value::as_i64).unwrap_or(0);
    let d = &v["data"];
    match code {
        10002 => {
            let (Some(code), Some(p)) = (d["s"].as_str(), num(&d["p"])) else { return false };
            let Some(inst) = market.cat.from_provider(business, code) else { return false };
            let t = d["t"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
            market.on_trade(&inst.symbol, p, num(&d["v"]).unwrap_or(0.0), t);
            return true;
        }
        10005 => {
            let Some(code) = d["s"].as_str() else { return false };
            let Some(inst) = market.cat.from_provider(business, code) else { return false };
            let (Some(b), Some(a)) = (num(&d["b"][0][0]), num(&d["a"][0][0])) else { return false };
            let t = d["t"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
            if b > 0.0 && a >= b {
                market.on_book(&inst.symbol, b, a, t);
            }
        }
        10001 | 10004 | 10011 | 200 => {}
        _ => {
            if v.get("msg").is_some() && code != 0 {
                tracing::debug!(%business, %text, "provider message");
            }
        }
    }
    false
}
