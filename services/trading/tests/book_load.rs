//! Order book LOAD test (docs/OPTIONS-EXCHANGE.md §13) against the REAL local services (market-data :8081, options
//! service :8104, PostgreSQL :5433; no mocked market data): the Ezymex market maker quotes the FULL chain of every
//! underlying at 4 Hz while 200 clients trade near the money — passive limits inside the MM's spread, marketable
//! IOCs against its quotes, cancels and reduce-only closes — through `book::entry::submit` (the gates, reservations,
//! actors, journal, outbox and shards of production; only the HTTP layer is skipped).
//!
//! Targets: actor batch p99 < 5 ms (apply + group commit + publish), outbox lag p99 < 50 ms (commit → applied on
//! the account). Afterwards: everything cancelled and drained, reserves 0, clearing 0, the ledger balances, the
//! account replay and every book's journal replay are identical.
//!
//! Run (FX open; release for meaningful latencies):
//! `cargo test -p trading --release --test book_load -- --ignored --nocapture`
//! Env: LOAD_SECS (60), LOAD_CLIENTS (200).

mod common;

use chrono::Utc;
use serde_json::json;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use common::*;
use trading::book::Perf;
use trading::book::entry;
use trading::book::types::*;
use trading::engine::options_book::BookReq;
use trading::model::{AccountKind, Side, Source};
use trading::money::D;
use trading::options::OptionPricing;

fn pct(v: &mut [u64], q: f64) -> u64 {
    if v.is_empty() {
        return 0;
    }
    v.sort_unstable();
    v[((v.len() - 1) as f64 * q) as usize]
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "needs the real market-data (:8081), options service (:8104) and PostgreSQL (:5433); run with --release"]
async fn full_chain_market_maker_at_4hz_and_200_clients() {
    let secs: u64 = env("LOAD_SECS", "60").parse().unwrap();
    let n_clients: i64 = env("LOAD_CLIENTS", "200").parse().unwrap();
    let rig = Arc::new(Rig::boot("book_load", 8).await);
    let hub = rig.hub.clone();
    let books = hub.shared.books.clone();
    books.enable_venue(&rig.pool, 1, AccountKind::Demo, "load", "load test").await.unwrap();
    let mm = trading::book::mm::account(&rig.st, 1, AccountKind::Demo).await.unwrap();
    let snap = rig.options.snapshot().unwrap();
    // the near-the-money series the clients trade: 4 underlyings × 2 expiries × 9 strikes × calls and puts
    let mut series: Vec<(String, D)> = Vec::new();
    for u in ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"] {
        let spot = rig.spot(u).await;
        let tick = trading::options::dec(snap.underlying(u).unwrap().tick());
        let now = Utc::now();
        let mut ex: Vec<_> = snap.expiries.iter().filter(|e| e.symbol == u && e.status == "listed" && e.cut_at > now + chrono::Duration::hours(3)).collect();
        ex.sort_by_key(|e| e.cut_at);
        for e in ex.iter().take(2) {
            let mut ss: Vec<_> = snap.series.values().filter(|s| s.expiry_id == e.id && s.status == "active").collect();
            ss.sort_by(|a, b| (a.strike - spot).abs().total_cmp(&(b.strike - spot).abs()));
            for s in ss.iter().take(18) {
                series.push((s.code.clone(), tick));
            }
        }
    }
    eprintln!("{} client series; market maker #{mm}", series.len());
    // the market maker at 4 Hz on the full chain (its own loop, as in production)
    tokio::spawn(trading::book::mm::run(rig.st.clone()));
    let t_warm = Instant::now();
    loop {
        tokio::time::sleep(Duration::from_millis(500)).await;
        let cov = trading::book::mm::coverage(&hub, 1, AccountKind::Demo);
        let quoted = series.iter().filter(|(s, _)| rig.options.top.get("ezymex", AccountKind::Demo, s).is_some_and(|t| t.bid.is_some() && t.ask.is_some())).count();
        if (cov >= 85.0 && quoted * 10 >= series.len() * 8) || t_warm.elapsed() > Duration::from_secs(120) {
            eprintln!("warm-up {:?}: MM coverage {cov:.1} %, client series quoted {quoted}/{}", t_warm.elapsed(), series.len());
            break;
        }
    }
    // 200 clients
    let mut logins = Vec::new();
    for i in 0..n_clients {
        let login = 50_100_000 + i;
        rig.account(login, 100_000 + i, 100_000).await;
        logins.push(login);
    }
    books.perf.clear();
    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let submits: Arc<std::sync::Mutex<Vec<u64>>> = Arc::default();
    let (n_orders, n_fills, n_refused) = (Arc::new(AtomicU64::new(0)), Arc::new(AtomicU64::new(0)), Arc::new(AtomicU64::new(0)));
    let series = Arc::new(series);
    let mut tasks = Vec::new();
    for (k, login) in logins.iter().copied().enumerate() {
        let (rig, stop, submits, series) = (rig.clone(), stop.clone(), submits.clone(), series.clone());
        let (n_orders, n_fills, n_refused) = (n_orders.clone(), n_fills.clone(), n_refused.clone());
        tasks.push(tokio::spawn(async move {
            let hub = rig.hub.clone();
            let mut rng: u64 = 0x9E37_79B9_7F4A_7C15 ^ (k as u64 + 1).wrapping_mul(0xBF58_476D_1CE4_E5B9);
            let mut next = move || {
                rng ^= rng << 13;
                rng ^= rng >> 7;
                rng ^= rng << 17;
                rng
            };
            while !stop.load(Ordering::Relaxed) {
                tokio::time::sleep(Duration::from_millis(300 + next() % 400)).await;
                let (s, tick) = &series[(next() % series.len() as u64) as usize];
                let Some(top) = rig.options.top.get("ezymex", AccountKind::Demo, s) else { continue };
                let roll = next() % 100;
                let t0 = Instant::now();
                let res = if roll < 20 {
                    // cancel one working order
                    let v = hub.read(login, Box::new(|x| json!(x.unwrap().0.book.orders.values().map(|w| json!([w.underlying, w.series, w.id])).collect::<Vec<_>>()))).await;
                    let Some(o) = v.as_array().and_then(|a| a.first().cloned()) else { continue };
                    let key = trading::book::BookKey::new(1, AccountKind::Demo, o[0].as_str().unwrap());
                    entry::call(&hub, login, &key, Cmd::Cancel { series: o[1].as_str().unwrap().into(), id: o[2].as_i64().unwrap(), login, reason: "load".into(), at: Utc::now().timestamp_millis() }).await.map(|x| Some(x.0))
                } else {
                    let buy = next() & 1 == 0;
                    let side = if buy { Side::Buy } else { Side::Sell };
                    let qty = D::from(1 + (next() % 3) as i64);
                    let mut req = match (roll < 65, buy) {
                        // passive: one tick inside the MM's spread (rests)
                        (true, true) => top.bid.map(|b| BookReq::limit(s, side, qty, b.0 + *tick)),
                        (true, false) => top.ask.map(|a| BookReq::limit(s, side, qty, a.0 - *tick)),
                        // aggressive: IOC at the other side's best
                        (false, true) => top.ask.map(|a| BookReq { tif: Tif::Ioc, ..BookReq::limit(s, side, D::ONE, a.0) }),
                        (false, false) => top.bid.map(|b| BookReq { tif: Tif::Ioc, ..BookReq::limit(s, side, D::ONE, b.0) }),
                    }
                    .unwrap_or_else(|| BookReq::market(s, side, D::ONE));
                    req.source = Source::Api;
                    req.reduce_only = roll >= 90;
                    if req.reduce_only {
                        req.tif = Tif::Ioc;
                    }
                    match entry::submit(&hub, login, "client", req).await {
                        Ok(sub) => Ok(sub.out),
                        Err(e) => Err(e),
                    }
                };
                submits.lock().unwrap().push(t0.elapsed().as_micros() as u64);
                n_orders.fetch_add(1, Ordering::Relaxed);
                match res {
                    Ok(Some(out)) => {
                        n_fills.fetch_add(out.fills.len() as u64, Ordering::Relaxed);
                    }
                    Ok(None) => {}
                    Err(_) => {
                        n_refused.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }));
    }
    let t_run = Instant::now();
    tokio::time::sleep(Duration::from_secs(secs)).await;
    stop.store(true, Ordering::Relaxed);
    for t in tasks {
        let _ = t.await;
    }
    let elapsed = t_run.elapsed();
    let (an, a50, a99, amax) = Perf::stats(&books.perf.actor_batch_us);
    let (_, c50, c99, cmax) = Perf::stats(&books.perf.actor_batch_cmds);
    let (on, o50, o99, omax) = Perf::stats(&books.perf.outbox_lag_us);
    let (_, k50, k99, kmax) = Perf::stats(&books.perf.commit_us);
    let (_, q50, q99, qmax) = Perf::stats(&books.perf.commit_quotes);
    let mut sub = submits.lock().unwrap().clone();
    let (s50, s99) = (pct(&mut sub, 0.5), pct(&mut sub, 0.99));
    let mms = trading::book::mm::status_json(&hub, 1, AccountKind::Demo);
    let fills_db: i64 = sqlx::query_scalar("SELECT count(*) FROM book_fills").fetch_one(&rig.pool).await.unwrap();
    let mq: i64 = sqlx::query_scalar("SELECT count(*) FROM book_quote_journal WHERE cmd_kind = 'mass_quote'").fetch_one(&rig.pool).await.unwrap();
    let report = json!({
        "secs": elapsed.as_secs_f64(), "clients": n_clients, "clientCommands": n_orders.load(Ordering::Relaxed),
        "clientCommandsPerSec": n_orders.load(Ordering::Relaxed) as f64 / elapsed.as_secs_f64(), "refused": n_refused.load(Ordering::Relaxed),
        "fills": fills_db, "massQuotes": mq, "mmQuotesLive": mms["quotesLive"], "mmCoveragePct": mms["coveragePct"], "mmLatency": mms["latency"],
        "actorBatchUs": {"n": an, "p50": a50, "p99": a99, "max": amax}, "commandsPerBatch": {"p50": c50, "p99": c99, "max": cmax},
        "outboxLagUs": {"n": on, "p50": o50, "p99": o99, "max": omax}, "groupCommitUs": {"p50": k50, "p99": k99, "max": kmax}, "quoteEntriesPerCommit": {"p50": q50, "p99": q99, "max": qmax}, "clientSubmitUs": {"p50": s50, "p99": s99},
    });
    eprintln!("LOAD REPORT {}", serde_json::to_string_pretty(&report).unwrap());
    // stop the market maker's quotes and every client order, then the money checks
    let at = Utc::now().timestamp_millis();
    books.set_venue(1, AccountKind::Demo, false);
    tokio::time::sleep(Duration::from_millis(600)).await;
    for l in logins.iter().copied().chain([mm]) {
        for h in books.handles() {
            let _ = entry::call(&hub, l, &h.key, Cmd::CancelAll { login: l, series: None, expiry: None, ephemeral_only: false, reason: "load end".into(), at }).await;
        }
    }
    rig.drained().await;
    tokio::time::sleep(Duration::from_millis(500)).await;
    for l in logins.iter().copied().chain([mm]) {
        assert_eq!(rig.reserve(l).await, D::ZERO, "reserve 0 when idle ({l})");
    }
    assert_eq!(rig.ledger_like("house:options_clearing.%").await, D::ZERO, "clearing nets to 0");
    let mut all = logins.clone();
    all.push(mm);
    rig.money_and_replay_ok(&all).await;
    assert!(an > 0 && on > 0 && fills_db > 0, "the load ran: {report}");
    assert!(a99 < 5_000, "actor batch p99 {a99} µs ≥ 5 ms");
    assert!(o99 < 50_000, "outbox lag p99 {o99} µs ≥ 50 ms");
    eprintln!("book load OK");
    match Arc::try_unwrap(rig) {
        Ok(r) => r.drop_db().await,
        Err(_) => eprintln!("rig still shared; database left"),
    }
}
