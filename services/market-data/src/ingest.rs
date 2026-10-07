//! Live provider ingest: one WebSocket per Infoway market (common / crypto / stock).
//! Subscribes to trades (10000 → pushes 10002) and depth (10003 → pushes 10005), sends the
//! 10010 heartbeat every 20s and reconnects with backoff (reset after a healthy session).
//!
//! What each connection subscribes to follows the planner (demand.rs): the symbols someone needs, within the plan's
//! limit. A plan change is applied on the open connection (`apply_plan`); a market with nothing to stream does not
//! connect at all.

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::watch;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::config::Config;
use crate::state::{HistoryJob, Market};

fn num(v: &Value) -> Option<f64> {
    match v {
        Value::String(s) => s.parse().ok(),
        Value::Number(n) => n.as_f64(),
        _ => None,
    }
}

/// Provider codes to subscribe per market (the planner's output).
pub type Plans = BTreeMap<String, watch::Receiver<Arc<BTreeSet<String>>>>;

pub fn spawn_all(cfg: &Config, market: Arc<Market>) {
    let plans = spawn_planner(market.clone());
    if !cfg.upstream.is_empty() {
        let (url, mk) = (cfg.upstream.clone(), market.clone());
        let all = plans.values().cloned().collect::<Vec<_>>();
        tokio::spawn(async move { relay(url, mk, all).await });
        return;
    }
    for (m, plan) in plans {
        let url = format!("{}?business={}&apikey={}", cfg.infoway_ws, m, cfg.infoway_key);
        let mk = market.clone();
        tokio::spawn(async move { run(m, url, plan, mk).await });
    }
}

/// Recomputes the plan whenever demand changes (and every 5 s for grace periods), publishes each market's
/// provider codes, and asks for history of catalogue symbols that start streaming (their bars have a gap).
fn spawn_planner(market: Arc<Market>) -> Plans {
    let mut txs: BTreeMap<String, watch::Sender<Arc<BTreeSet<String>>>> = BTreeMap::new();
    let mut rxs: Plans = BTreeMap::new();
    for m in market.cat.markets() {
        let (tx, rx) = watch::channel(Arc::new(BTreeSet::new()));
        txs.insert(m.clone(), tx);
        rxs.insert(m, rx);
    }
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(5));
        let mut last_dropped = 0usize;
        loop {
            tokio::select! {
                _ = market.demand_changed.notified() => {
                    // coalesce a burst of subscribe / unsubscribe messages into one plan change
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
                _ = tick.tick() => {}
            }
            let before = market.streaming();
            let plan = market.demand.lock().unwrap().plan(&market.cat, &before, std::time::Instant::now());
            let after = plan.symbols();
            if after != before {
                let added: Vec<&String> = after.difference(&before).collect();
                let removed = before.difference(&after).count();
                tracing::info!(streaming = after.len(), added = added.len(), removed, "provider subscriptions changed");
                market.set_streaming(after.clone());
                for s in added {
                    if market.cat.get(s).is_some_and(|i| !i.is_core()) {
                        market.request_history(HistoryJob::Recent { symbol: s.clone(), first: None });
                    }
                }
            }
            if plan.dropped.len() != last_dropped {
                if !plan.dropped.is_empty() {
                    tracing::warn!(over_limit = plan.dropped.len(), first = ?plan.dropped.iter().take(5).collect::<Vec<_>>(), "demand exceeds the plan's symbol limit: lowest-priority symbols get delayed prices");
                }
                last_dropped = plan.dropped.len();
            }
            for (m, tx) in &txs {
                let codes: BTreeSet<String> = plan.markets.get(m).into_iter().flatten().filter_map(|s| market.cat.get(s)).map(|i| i.provider.code.clone()).collect();
                if **tx.borrow() != codes {
                    let _ = tx.send(Arc::new(codes));
                }
            }
        }
    });
    rxs
}

/// Provider frames for moving a connection's subscription from `current` to `want` (codes):
/// unsubscribe what goes first (11000 trades, 11001 depth), so the plan's symbol count is never exceeded even for
/// a moment, then subscribe the whole wanted list (10000 trades, 10003 depth). Re-sending codes already subscribed
/// is harmless whether the provider adds to the list or replaces it (its docs don't say; its SDK adds), so this is
/// correct either way. At most four frames per change: the provider allows 60 frames a minute per connection.
pub fn subscription_messages(business: &str, current: &BTreeSet<String>, want: &BTreeSet<String>) -> Vec<String> {
    let mut out = Vec::new();
    if current == want {
        return out;
    }
    let removed: Vec<&str> = current.difference(want).map(String::as_str).collect();
    if !removed.is_empty() {
        let codes = removed.join(",");
        out.push(json!({"code": 11000, "trace": format!("kalks-{business}-untrade"), "data": {"codes": codes}}).to_string());
        out.push(json!({"code": 11001, "trace": format!("kalks-{business}-undepth"), "data": {"codes": codes}}).to_string());
    }
    if !want.is_empty() && want.difference(current).next().is_some() {
        let codes = want.iter().map(String::as_str).collect::<Vec<_>>().join(",");
        out.push(json!({"code": 10000, "trace": format!("kalks-{business}-trade"), "data": {"codes": codes}}).to_string());
        out.push(json!({"code": 10003, "trace": format!("kalks-{business}-depth"), "data": {"codes": codes}}).to_string());
    }
    out
}

/// Plan changes are applied to a connection at most this often (frames are rate-limited by the provider).
const PLAN_MIN_INTERVAL: Duration = Duration::from_secs(10);

/// Minimum uptime for a session to count as healthy (resets the reconnect backoff).
const HEALTHY_SESSION: Duration = Duration::from_secs(30);

async fn run(business: String, url: String, mut plan: watch::Receiver<Arc<BTreeSet<String>>>, market: Arc<Market>) {
    let mut backoff = 1u64;
    loop {
        // nothing to stream on this market: stay disconnected until there is
        while plan.borrow_and_update().is_empty() {
            if plan.changed().await.is_err() {
                return;
            }
        }
        let started = Instant::now();
        // run each session in its own task so a panic inside it becomes a reconnect, never a silent stop
        let (b, u, p, m) = (business.clone(), url.clone(), plan.clone(), market.clone());
        let joined = tokio::spawn(async move {
            let mut subscribed = false;
            let r = session(&b, &u, p, &m, &mut subscribed).await;
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

async fn session(business: &str, url: &str, mut plan: watch::Receiver<Arc<BTreeSet<String>>>, market: &Arc<Market>, subscribed: &mut bool) -> anyhow::Result<()> {
    let (ws, _) = tokio::time::timeout(Duration::from_secs(10), connect_async(url)).await.map_err(|_| anyhow::anyhow!("connect timeout"))??;
    if let tokio_tungstenite::MaybeTlsStream::Rustls(s) = ws.get_ref() {
        let _ = s.get_ref().0.set_nodelay(true);
    }
    let (mut tx, mut rx) = ws.split();
    let mut current: BTreeSet<String> = BTreeSet::new();
    let want = plan.borrow_and_update().clone();
    for m in subscription_messages(business, &current, &want) {
        tx.send(Message::text(m)).await?;
    }
    current = (*want).clone();
    tracing::info!(%business, symbols = current.len(), "subscribed to provider stream");
    market.set_connected(business, true);
    *subscribed = true;

    // the provider times a connection out after 90 s without a frame and counts every frame (60 a minute)
    let mut heartbeat = tokio::time::interval(Duration::from_secs(20));
    let mut last_plan = Instant::now();
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
                let open = current.iter().filter_map(|c| market.cat.from_provider(business, c)).any(|i| i.in_session(now));
                if open && last_frame.elapsed() > IDLE_TIMEOUT {
                    anyhow::bail!("no data for {}s", IDLE_TIMEOUT.as_secs());
                }
                if business == "crypto" && !current.is_empty() && last_trade.elapsed() > CRYPTO_TRADE_TIMEOUT {
                    anyhow::bail!("no trades for {}s (stalled stream)", CRYPTO_TRADE_TIMEOUT.as_secs());
                }
            }
            changed = plan.changed() => {
                if changed.is_err() {
                    return Ok(());
                }
                // at most one subscription change per PLAN_MIN_INTERVAL (later changes merge into it)
                let since = last_plan.elapsed();
                if since < PLAN_MIN_INTERVAL {
                    tokio::time::sleep(PLAN_MIN_INTERVAL - since).await;
                }
                last_plan = Instant::now();
                let want = plan.borrow_and_update().clone();
                for m in subscription_messages(business, &current, &want) {
                    tx.send(Message::text(m)).await?;
                }
                let (added, removed) = (want.difference(&current).count(), current.difference(&want).count());
                current = (*want).clone();
                // a newly streamed symbol counts as trading from now (the crypto stall check)
                last_trade = Instant::now();
                tracing::info!(%business, symbols = current.len(), added, removed, "provider subscription updated");
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
    let Ok(v) = serde_json::from_str::<Value>(text) else {
        // e.g. "Subscribe fail: ..." (plan limit): never retried as is; the next plan change sends a new list
        if text.starts_with("Subscribe fail") {
            tracing::error!(%business, frame = %text.chars().take(300).collect::<String>(), "provider refused a subscription");
        }
        return false;
    };
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
                // more than one priced level: keep the book for the depth-of-market ladder (D97)
                let levels = |v: &Value| v.as_array().map(|l| l.iter().filter_map(|x| Some((num(&x[0])?, num(&x[1])?))).collect::<Vec<_>>()).unwrap_or_default();
                let (bl, al) = (levels(&d["b"]), levels(&d["a"]));
                if bl.len() > 1 && al.len() > 1 {
                    market.on_depth(&inst.symbol, bl, al, t);
                }
            }
        }
        10001 | 10004 | 10011 | 11010 | 200 => {}
        _ => {
            if v.get("msg").is_some() && code != 0 {
                tracing::debug!(%business, %text, "provider message");
            }
        }
    }
    false
}

/// Relay mode: mirror quotes from another Kalks market-data stream (`{"type":"quote","s","b","a","l","t"}`).
/// Every catalogue symbol is subscribed passively (whatever the upstream streams arrives here); the symbols wanted
/// locally (this service's own plan) are subscribed actively, so the upstream streams them too.
async fn relay(url: String, market: Arc<Market>, mut plans: Vec<watch::Receiver<Arc<BTreeSet<String>>>>) {
    let mut backoff = 1u64;
    loop {
        let symbols: Vec<String> = market.cat.list.iter().map(|i| i.symbol.clone()).collect();
        let res: anyhow::Result<()> = async {
            let (ws, _) = tokio::time::timeout(Duration::from_secs(15), connect_async(&url)).await??;
            let (mut tx, mut rx) = ws.split();
            tx.send(Message::text(json!({"op": "subscribe", "symbols": symbols, "passive": true}).to_string())).await?;
            // provider depth only (never the upstream's indicative ladders); upstreams without depth ignore it
            tx.send(Message::text(json!({"op": "depth", "symbols": symbols, "src": "feed"}).to_string())).await?;
            let mut active: BTreeSet<String> = market.streaming();
            if !active.is_empty() {
                tx.send(Message::text(json!({"op": "subscribe", "symbols": active}).to_string())).await?;
            }
            market.set_connected("relay", true);
            tracing::info!(%url, active = active.len(), "relay connected");
            backoff = 1;
            let mut check = tokio::time::interval(Duration::from_secs(1));
            loop {
                let msg = tokio::select! {
                    m = tokio::time::timeout(Duration::from_secs(30), rx.next()) => m?,
                    _ = check.tick() => {
                        // the local plan changed: upstream demand follows it
                        if plans.iter_mut().any(|p| p.has_changed().unwrap_or(false)) {
                            for p in plans.iter_mut() {
                                p.borrow_and_update();
                            }
                        }
                        let want = market.streaming();
                        if want != active {
                            let added: Vec<&String> = want.difference(&active).collect();
                            let removed: Vec<&String> = active.difference(&want).collect();
                            if !added.is_empty() {
                                tx.send(Message::text(json!({"op": "subscribe", "symbols": added}).to_string())).await?;
                            }
                            if !removed.is_empty() {
                                tx.send(Message::text(json!({"op": "subscribe", "symbols": removed, "passive": true}).to_string())).await?;
                            }
                            active = want;
                        }
                        continue;
                    }
                };
                let Some(msg) = msg else { return Ok(()) };
                match msg? {
                    Message::Text(t) => {
                        let Ok(v) = serde_json::from_str::<Value>(&t) else { continue };
                        if v["type"] == "depth" && v["src"] == "feed" {
                            if let Some(s) = v["s"].as_str() {
                                let levels = |x: &Value| x.as_array().map(|l| l.iter().filter_map(|p| Some((num(&p[0])?, num(&p[1])?))).collect::<Vec<_>>()).unwrap_or_default();
                                let t = v["t"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
                                market.on_depth(s, levels(&v["b"]), levels(&v["a"]), t);
                            }
                            continue;
                        }
                        if v["type"] != "quote" { continue }
                        let (Some(s), Some(b), Some(a)) = (v["s"].as_str(), num(&v["b"]), num(&v["a"])) else { continue };
                        let t = v["t"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
                        let last = num(&v["l"]).unwrap_or((b + a) / 2.0);
                        if v["d"].as_i64().unwrap_or(0) != 0 {
                            // the upstream's delayed snapshot: a price to show, never a live tick (no bars from it)
                            market.set_snapshot(s, last, None, t);
                            continue;
                        }
                        market.on_book(s, b, a, t);
                        market.on_trade(s, last, 0.0, t);
                    }
                    Message::Ping(p) => tx.send(Message::Pong(p)).await?,
                    Message::Close(_) => return Ok(()),
                    _ => {}
                }
            }
        }
        .await;
        market.set_connected("relay", false);
        if let Err(e) = res {
            tracing::warn!(error = %e, "relay stream error; reconnecting in {backoff}s");
        }
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(15);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(v: &[&str]) -> BTreeSet<String> {
        v.iter().map(|s| s.to_string()).collect()
    }
    fn codes(frames: &[String]) -> Vec<(i64, String)> {
        frames.iter().map(|f| serde_json::from_str::<Value>(f).unwrap()).map(|v| (v["code"].as_i64().unwrap(), v["data"]["codes"].as_str().unwrap().to_string())).collect()
    }

    #[test]
    fn subscription_changes_unsubscribe_first_then_send_the_full_list() {
        // first connect: everything
        let f = subscription_messages("common", &BTreeSet::new(), &set(&["EURUSD", "AUDCAD"]));
        assert_eq!(codes(&f), vec![(10000, "AUDCAD,EURUSD".into()), (10003, "AUDCAD,EURUSD".into())]);
        // one leaves, one joins: unsubscribe the leaver, then the whole wanted list
        let f = subscription_messages("common", &set(&["EURUSD", "AUDCAD"]), &set(&["EURUSD", "USDSGD"]));
        assert_eq!(codes(&f), vec![(11000, "AUDCAD".into()), (11001, "AUDCAD".into()), (10000, "EURUSD,USDSGD".into()), (10003, "EURUSD,USDSGD".into())]);
        // only removals: no subscribe frames
        let f = subscription_messages("common", &set(&["EURUSD", "USDSGD"]), &set(&["EURUSD"]));
        assert_eq!(codes(&f).iter().map(|c| c.0).collect::<Vec<_>>(), vec![11000, 11001]);
        // nothing changed: nothing sent (every frame counts against the provider's 60 a minute)
        assert!(subscription_messages("common", &set(&["EURUSD"]), &set(&["EURUSD"])).is_empty());
    }
}
