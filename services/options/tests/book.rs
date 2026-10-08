//! Order book side of the options service (docs/OPTIONS-EXCHANGE.md §2, §4, §6, §7, §10, §12), end to end over HTTP and
//! WebSocket against PostgreSQL:
//!
//! * `order_book_settings_and_snapshot`: the migration's per-underlying defaults, admin validation, group maker / taker
//!   fees with the min(taker) ≥ max(|maker rebate|) rule, `mm_settings` CRUD with broker scoping, and the snapshot
//!   (`underlyings[]` fields, `groups[]` fees, `mm[]`).
//! * `book_feed_merges_into_chain_stream_and_public_routes`: real spots from the local market-data (:8081, no mocked
//!   prices; skipped when it is down), a minimal in-test engine that speaks the documented engine feed contract
//!   (`services/trading/src/api/book_feed.rs`: WS `top` / `depth` / `trade` frames, `snapshot` and `trades` routes) with
//!   book prices placed around the real model theo, then: chain merge (best bid / offer, sizes, the clamped mark, theo,
//!   implied vols, OI, PCR), demo vs live, the stream's `depth` / `tape` ops and live `rows`, the public routes with
//!   their 1 s cache and 10 req/s limit.
//! * `absent_engine_keeps_house_prices`: engine refused or without book routes (404) = today's house quotes.
//! * `book_feed_against_the_real_engine` (`--ignored`): the same consumer against a running trading engine
//!   (`TRADING_URL`, default :8090, `TRADING_INTERNAL_TOKEN`).
//!
//! Needs the local Postgres (127.0.0.1:5433); uses `ezymex_options_test_<pid>_<tag>` databases.

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::ws::{Message as AxMessage, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, Request, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use futures_util::{SinkExt, StreamExt};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use tokio_tungstenite::tungstenite::Message;
use tower::ServiceExt;

use options::api::router;
use options::book_feed::{self, Kind};
use options::config::Config;
use options::{AppState, feed, jobs, seed, store};

const STAFF: (&str, &str) = ("x-ezymex-staff", "ops@ezymex");
const LIVE: (&str, &str) = ("x-ezymex-account-kind", "live");
const DEMO: (&str, &str) = ("x-ezymex-account-kind", "demo");
const ENGINE_TOKEN: &str = "engine-test-token";

async fn test_db(tag: &str) -> Option<String> {
    let server = std::env::var("OPTIONS_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let opts = PgConnectOptions::from_str(&server).ok()?;
    let db = format!("ezymex_options_test_{}_{tag}", std::process::id());
    let mut conn = match opts.clone().database("postgres").connect().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("skipping: Postgres not reachable ({e})");
            return None;
        }
    };
    let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{db}\""))).execute(&mut conn).await;
    let base = server.rsplit_once('/').map(|x| x.0).unwrap_or(&server).to_string();
    Some(format!("{base}/{db}"))
}

async fn drop_db(url: &str) {
    let opts = PgConnectOptions::from_str(url).unwrap();
    let db = opts.get_database().unwrap().to_string();
    if let Ok(mut c) = opts.database("postgres").connect().await {
        let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{db}\" WITH (FORCE)"))).execute(&mut c).await;
    }
}

struct T {
    app: axum::Router,
    st: AppState,
    url: String,
}

impl T {
    async fn call(&self, method: &str, path: &str, headers: &[(&str, &str)], body: Option<Value>) -> (StatusCode, Value) {
        let (s, _, v) = self.call_h(method, path, headers, body).await;
        (s, v)
    }
    async fn call_h(&self, method: &str, path: &str, headers: &[(&str, &str)], body: Option<Value>) -> (StatusCode, HeaderMap, Value) {
        let mut req = Request::builder().method(method).uri(path).header("x-ezymex-internal", "test-token");
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let req = match body {
            Some(b) => req.header("content-type", "application/json").body(Body::from(b.to_string())).unwrap(),
            None => req.body(Body::empty()).unwrap(),
        };
        let res = self.app.clone().oneshot(req).await.unwrap();
        let (status, headers) = (res.status(), res.headers().clone());
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, headers, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
    }
    /// A public route: no internal token.
    async fn public(&self, path: &str, headers: &[(&str, &str)]) -> (StatusCode, HeaderMap, Value) {
        let mut req = Request::builder().uri(path);
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let res = self.app.clone().oneshot(req.body(Body::empty()).unwrap()).await.unwrap();
        let (status, headers) = (res.status(), res.headers().clone());
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, headers, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
    }
    async fn get(&self, path: &str, headers: &[(&str, &str)]) -> Value {
        let (s, v) = self.call("GET", path, headers, None).await;
        assert_eq!(s, StatusCode::OK, "{path}: {v}");
        v
    }
    async fn snapshot(&self) -> Value {
        self.get("/v1/internal/options/snapshot", &[]).await
    }
}

/// Closes the pool (background feed tasks keep `AppState` clones alive) and drops the database.
async fn finish(t: T) {
    let url = t.url.clone();
    t.st.pool.close().await;
    drop(t);
    drop_db(&url).await;
}

async fn setup(tag: &str, edit: impl FnOnce(&mut Config)) -> Option<T> {
    let url = test_db(tag).await?;
    let pool = store::connect(&url).await.expect("connect + migrate");
    let mut cfg = Config::for_tests(&url);
    edit(&mut cfg);
    seed::run(&pool, &cfg.holidays_dir).await.unwrap();
    let st = AppState::new(pool, cfg).await.unwrap();
    let app = router(st.clone());
    Some(T { app, st, url })
}

/// Real raw quotes from the local market-data service (no mocked prices). False when it is not reachable.
async fn real_spots(st: &AppState) -> bool {
    let rd = st.refdata().await;
    let symbols = feed::wanted_symbols(st, &rd);
    match feed::poll_rest(st, &symbols).await {
        Ok(n) if st.spots.get("EURUSD").await.is_some() => {
            eprintln!("using {n} real quotes from {}", st.cfg.market_data_url);
            true
        }
        Ok(_) => {
            eprintln!("skipping the priced part: market-data at {} has no EURUSD quote", st.cfg.market_data_url);
            false
        }
        Err(e) => {
            eprintln!("skipping the priced part: market-data at {} unreachable ({e})", st.cfg.market_data_url);
            false
        }
    }
}

fn market_data_url() -> String {
    std::env::var("MARKET_DATA_URL").unwrap_or_else(|_| "http://127.0.0.1:8081".into())
}

/* ------------------------------------------------------------------ */
/* Settings, fees, market maker, snapshot                              */
/* ------------------------------------------------------------------ */

#[tokio::test]
async fn order_book_settings_and_snapshot() {
    let Some(t) = setup("bookcfg", |_| {}).await else { return };

    // ---------------- migration / seed defaults (§2): tick FX pip/10, XAU 0.01, other metals and oil 0.001
    let snap = t.snapshot().await;
    let und = |s: &Value, sym: &str| s["underlyings"].as_array().unwrap().iter().find(|u| u["symbol"] == sym).unwrap().clone();
    for (sym, tick) in [("EURUSD", 0.00001), ("GBPUSD", 0.00001), ("USDJPY", 0.001), ("EURJPY", 0.001), ("XAUUSD", 0.01), ("XAGUSD", 0.001), ("USOIL", 0.001), ("UKOIL", 0.001)] {
        let u = und(&snap, sym);
        assert_eq!(u["premiumTick"].as_f64(), Some(tick), "{sym}");
        assert_eq!(
            (u["marketBandPct"].as_f64(), u["limitBandPct"].as_f64(), u["bandMinTicks"].as_i64(), u["liqBandPct"].as_f64(), u["liqFeePct"].as_f64()),
            (Some(10.0), Some(50.0), Some(5), Some(5.0), Some(2.0)),
            "{sym}"
        );
        assert_eq!((u["rfqQuoteTtlSecs"].as_i64(), u["markMinQty"].as_f64(), u["markMaxSpreadMult"].as_f64()), (Some(5), Some(1.0), Some(3.0)), "{sym}");
        assert_eq!((u["minContracts"].as_f64(), u["contractStep"].as_f64(), u["maxContracts"].as_f64()), (Some(1.0), Some(1.0), Some(100.0)));
    }
    let g0 = &snap["groups"][0];
    assert_eq!((g0["groupCode"].as_str(), g0["makerFeePerContract"].as_f64(), g0["takerFeePerContract"].as_f64()), (Some("*"), Some(-0.05), Some(0.25)));
    let mm = snap["mm"].as_array().unwrap();
    assert_eq!(mm.len(), 1, "{mm:?}");
    assert_eq!((mm[0]["tenant"].as_str(), mm[0]["kind"].as_str(), mm[0]["underlying"].as_str()), (Some("*"), Some("*"), Some("*")));
    assert_eq!((mm[0]["spreadVol0dte"].as_f64(), mm[0]["minSpreadTicks"].as_i64(), mm[0]["baseSize"].as_f64(), mm[0]["maxVega"].as_f64()), (Some(0.008), Some(2), Some(10.0), Some(25_000.0)));
    for k in ["orderBook", "mark", "bookFees", "marketMaker"] {
        assert!(snap["conventions"][k].is_string(), "{k}");
    }
    // the client underlying list carries the order book parameters and the barrier label
    let ul = t.get("/v1/options/underlyings", &[LIVE]).await;
    let eur = ul["underlyings"].as_array().unwrap().iter().find(|u| u["symbol"] == "EURUSD").unwrap().clone();
    assert_eq!((eur["premiumTick"].as_f64(), eur["orderBook"].as_bool(), eur["barrierVenue"].as_str(), eur["barrierLabel"].as_str()), (Some(0.00001), Some(false), Some("rfq"), Some("Ezymex-quoted (RFQ only)")));

    // ---------------- underlying order-book fields: validation, platform only, audited, in the snapshot
    let v0 = snap["version"].as_i64().unwrap();
    let put = |body: Value| async { t.call("PUT", "/v1/admin/options/underlyings/EURUSD", &[STAFF], Some(body)).await };
    for bad in [
        json!({"marketBandPct": 0, "reason": "x"}),
        json!({"limitBandPct": 150, "reason": "x"}),
        json!({"premiumTick": -0.00001, "reason": "x"}),
        json!({"bandMinTicks": -1, "reason": "x"}),
        json!({"liqFeePct": 60, "reason": "x"}),
        json!({"rfqQuoteTtlSecs": 120, "reason": "x"}),
        json!({"markMaxSpreadMult": 0.5, "reason": "x"}),
        json!({"minContracts": 1.5, "reason": "x"}),
    ] {
        let (s, v) = put(bad.clone()).await;
        assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{bad} -> {v}");
    }
    let (s, _) = t.call("PUT", "/v1/admin/options/underlyings/EURUSD", &[STAFF, ("x-ezymex-tenant", "otherbroker")], Some(json!({"premiumTick": 0.00002, "reason": "x"}))).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "platform data");
    let (s, v) = put(json!({"premiumTick": 0.00002, "marketBandPct": 8, "limitBandPct": 40, "bandMinTicks": 3, "liqBandPct": 4, "liqFeePct": 1.5, "rfqQuoteTtlSecs": 7, "markMinQty": 2, "markMaxSpreadMult": 2.5, "contractStep": 0.5, "minContracts": 0.5, "reason": "tick test"})).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!((v["underlying"]["premiumTick"].as_f64(), v["underlying"]["contractStep"].as_f64()), (Some(0.00002), Some(0.5)));
    let snap2 = t.snapshot().await;
    assert!(snap2["version"].as_i64().unwrap() > v0);
    let e2 = und(&snap2, "EURUSD");
    assert_eq!(
        (e2["premiumTick"].as_f64(), e2["marketBandPct"].as_f64(), e2["limitBandPct"].as_f64(), e2["bandMinTicks"].as_i64(), e2["liqBandPct"].as_f64(), e2["liqFeePct"].as_f64()),
        (Some(0.00002), Some(8.0), Some(40.0), Some(3), Some(4.0), Some(1.5))
    );
    assert_eq!((e2["rfqQuoteTtlSecs"].as_i64(), e2["markMinQty"].as_f64(), e2["markMaxSpreadMult"].as_f64(), e2["minContracts"].as_f64()), (Some(7), Some(2.0), Some(2.5), Some(0.5)));

    // ---------------- group fees (§7): min(taker) >= max(|maker rebate|) over the broker's rows
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/vip/*", &[STAFF], Some(json!({"takerFeePerContract": 0.03, "reason": "cheap"}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{v}");
    assert!(v["error"]["message"].as_str().unwrap().contains("min(taker)"), "{v}");
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/vip/*", &[STAFF], Some(json!({"takerFeePerContract": -0.1, "reason": "neg"}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{v}");
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/vip/*", &[STAFF], Some(json!({"makerFeePerContract": 2000, "reason": "big"}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{v}");
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/vip/*", &[STAFF], Some(json!({"makerFeePerContract": -0.02, "takerFeePerContract": 0.1, "reason": "vip tier"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!((v["group"]["makerFeePerContract"].as_f64(), v["group"]["takerFeePerContract"].as_f64()), (Some(-0.02), Some(0.1)));
    // a bigger default rebate would now exceed the vip taker fee
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/*/*", &[STAFF], Some(json!({"makerFeePerContract": -0.2, "reason": "promo"}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{v}");
    assert!(v["error"]["message"].as_str().unwrap().contains("vip"), "{v}");
    // another broker's rows are checked on their own
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/*/*", &[STAFF, ("x-ezymex-tenant", "otherbroker")], Some(json!({"makerFeePerContract": -0.3, "takerFeePerContract": 0.3, "reason": "own"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let snap3 = t.snapshot().await;
    let vip = snap3["groups"].as_array().unwrap().iter().find(|g| g["tenant"] == "ezymex" && g["groupCode"] == "vip").unwrap().clone();
    assert_eq!((vip["makerFeePerContract"].as_f64(), vip["takerFeePerContract"].as_f64()), (Some(-0.02), Some(0.1)));

    // ---------------- mm_settings CRUD (§4)
    let base = "/v1/admin/options/mm-settings";
    let (s, v) = t.call("PUT", &format!("{base}/ezymex/live/XAUUSD"), &[STAFF], Some(json!({"baseSize": 5}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "reason required: {v}");
    for bad in [json!({"spreadVol7d": 0.5, "reason": "x"}), json!({"baseSize": 2.5, "reason": "x"}), json!({"minSpreadTicks": 0, "reason": "x"}), json!({"maxGamma": 0, "reason": "x"})] {
        let (s, v) = t.call("PUT", &format!("{base}/ezymex/live/XAUUSD"), &[STAFF], Some(bad.clone())).await;
        assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{bad} -> {v}");
    }
    for path in ["ezymex/paper/XAUUSD", "ezymex/live/NOPE", "Bad Tenant/live/*"] {
        let (s, _) = t.call("PUT", &format!("{base}/{}", path.replace(' ', "%20")), &[STAFF], Some(json!({"baseSize": 5, "reason": "x"}))).await;
        assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{path}");
    }
    let (s, v) = t.call("PUT", &format!("{base}/ezymex/live/XAUUSD"), &[STAFF], Some(json!({"baseSize": 5, "spreadVol0dte": 0.012, "maxVega": 15000, "reason": "gold is jumpy"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let row = &v["settings"];
    assert_eq!((row["baseSize"].as_f64(), row["spreadVol0dte"].as_f64(), row["maxVega"].as_f64(), row["spreadVol7d"].as_f64(), row["updatedBy"].as_str()), (Some(5.0), Some(0.012), Some(15000.0), Some(0.005), Some("ops@ezymex")));
    let (s, v) = t.call("PUT", &format!("{base}/*/demo/*"), &[STAFF], Some(json!({"baseSize": 25, "maxNetDelta": 2000, "reason": "demo depth"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let rd = t.st.refdata().await;
    assert_eq!(rd.mm_for("ezymex", "live", "XAUUSD").base_size, 5.0);
    assert_eq!(rd.mm_for("ezymex", "demo", "XAUUSD").base_size, 25.0);
    assert_eq!(rd.mm_for("otherbroker", "live", "EURUSD").base_size, 10.0);
    drop(rd);
    // a broker tunes only its own rows and sees the platform's plus its own
    let ob = [STAFF, ("x-ezymex-tenant", "otherbroker")];
    let (s, _) = t.call("PUT", &format!("{base}/*/*/*"), &ob, Some(json!({"baseSize": 1, "reason": "mine"}))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = t.call("PUT", &format!("{base}/ezymex/live/*"), &ob, Some(json!({"baseSize": 1, "reason": "mine"}))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, v) = t.call("PUT", &format!("{base}/otherbroker/demo/*"), &ob, Some(json!({"enabled": false, "reason": "pilot off"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!((v["settings"]["enabled"].as_bool(), v["settings"]["baseSize"].as_f64()), (Some(false), Some(25.0)), "starts from what applies: (*, demo, *)");
    let mine = t.get(base, &ob).await;
    let keys: Vec<String> = mine["settings"].as_array().unwrap().iter().map(|r| format!("{}/{}/{}", r["tenant"].as_str().unwrap(), r["kind"].as_str().unwrap(), r["underlying"].as_str().unwrap())).collect();
    assert_eq!(keys, ["*/*/*", "*/demo/*", "otherbroker/demo/*"], "{keys:?}");
    let all = t.get(base, &[STAFF]).await;
    assert_eq!(all["settings"].as_array().unwrap().len(), 4);
    assert_eq!(t.snapshot().await["mm"].as_array().unwrap().len(), 4);
    // delete: reason required, the default stays, then gone
    let (s, _) = t.call("DELETE", &format!("{base}/*/*/*?reason=cleanup"), &[STAFF], None).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY);
    let (s, _) = t.call("DELETE", &format!("{base}/ezymex/live/XAUUSD"), &[STAFF], None).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY);
    let (s, _) = t.call("DELETE", &format!("{base}/ezymex/live/XAUUSD?reason=back%20to%20default"), &[STAFF], None).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _) = t.call("DELETE", &format!("{base}/ezymex/live/XAUUSD?reason=again"), &[STAFF], None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    assert_eq!(t.st.refdata().await.mm_for("ezymex", "live", "XAUUSD").base_size, 10.0);
    let audit = t.get("/v1/admin/options/audit?limit=100", &[STAFF]).await;
    let actions: Vec<&str> = audit["audit"].as_array().unwrap().iter().map(|a| a["action"].as_str().unwrap()).collect();
    for a in ["mm_settings.upsert", "mm_settings.delete", "group.upsert", "underlying.update"] {
        assert!(actions.contains(&a), "{a} in {actions:?}");
    }

    finish(t).await;
}

/* ------------------------------------------------------------------ */
/* A minimal engine speaking the documented book feed contract         */
/* ------------------------------------------------------------------ */

/// `services/trading/src/api/book_feed.rs` + `book/md.rs`: series views, `top` / `depth` / `trade` frames, the
/// `snapshot` and `trades` routes, internal token required. Only tenant `ezymex` live has a book.
#[derive(Clone)]
struct FakeEngine {
    views: Arc<Mutex<Vec<Value>>>,
    trades: Arc<Mutex<Vec<Value>>>,
    tx: tokio::sync::broadcast::Sender<String>,
    unauthorized: Arc<AtomicUsize>,
    streams: Arc<AtomicUsize>,
}

/// An engine series view (`SeriesView::json` plus `mark`).
fn view(series: &str, bids: &[(f64, f64, u32)], asks: &[(f64, f64, u32)], last: Option<(f64, f64)>, oi: f64, vol: f64, seq: u64, mark: f64) -> Value {
    let lv = |l: &[(f64, f64, u32)]| l.iter().map(|(p, q, n)| json!({"price": p, "qty": q, "orders": n})).collect::<Vec<_>>();
    json!({"series": series, "underlying": "EURUSD", "expiry": "2026-10-09", "state": "open", "bids": lv(bids), "asks": lv(asks),
           "last": last.map(|l| l.0), "lastQty": last.map(|l| l.1), "oi": oi, "vol": vol, "seq": seq, "mark": mark})
}

/// The engine's `depth` and `top` frames of a view (`book::md::frames`).
fn engine_frames(v: &Value) -> [Value; 2] {
    let base = |ty: &str| json!({"type": ty, "tenant": "ezymex", "kind": "live", "underlying": v["underlying"], "series": v["series"]});
    let mut depth = base("depth");
    depth["bids"] = v["bids"].clone();
    depth["asks"] = v["asks"].clone();
    depth["seq"] = v["seq"].clone();
    let mut top = base("top");
    let first = |side: &str, k: &str| v[side].as_array().and_then(|a| a.first()).map(|l| l[k].clone()).unwrap_or(Value::Null);
    for (k, x) in [
        ("bid", first("bids", "price")),
        ("bidQty", first("bids", "qty")),
        ("ask", first("asks", "price")),
        ("askQty", first("asks", "qty")),
        ("last", v["last"].clone()),
        ("lastQty", v["lastQty"].clone()),
        ("mark", v["mark"].clone()),
        ("oi", v["oi"].clone()),
        ("vol", v["vol"].clone()),
        ("state", v["state"].clone()),
        ("seq", v["seq"].clone()),
    ] {
        top[k] = x;
    }
    [depth, top]
}

impl FakeEngine {
    fn new(views: Vec<Value>, trades: Vec<Value>) -> Self {
        FakeEngine { views: Arc::new(Mutex::new(views)), trades: Arc::new(Mutex::new(trades)), tx: tokio::sync::broadcast::channel(256).0, unauthorized: Default::default(), streams: Default::default() }
    }
    /// Replaces a view and publishes its frames (as the actor does after a commit).
    fn publish(&self, v: Value) {
        let mut views = self.views.lock().unwrap();
        views.retain(|x| x["series"] != v["series"]);
        views.push(v.clone());
        for f in engine_frames(&v) {
            let _ = self.tx.send(f.to_string());
        }
    }
    fn trade(&self, series: &str, id: &str, price: f64, qty: f64, side: &str, seq: u64) {
        let at = chrono::Utc::now().to_rfc3339();
        let f = json!({"type": "trade", "tenant": "ezymex", "kind": "live", "underlying": "EURUSD", "series": series, "fillId": id, "price": price, "qty": qty,
                       "side": side, "tradeKind": "book", "combo": null, "at": at, "seq": seq});
        self.trades.lock().unwrap().insert(0, json!({"fillId": id, "underlying": "EURUSD", "series": series, "price": price, "qty": qty, "side": side, "tradeKind": "book", "combo": null, "at": at, "seq": seq}));
        let _ = self.tx.send(f.to_string());
    }
    async fn serve(self) -> String {
        fn authed(e: &FakeEngine, h: &HeaderMap) -> bool {
            let ok = h.get("x-ezymex-internal").is_some_and(|v| v.as_bytes() == ENGINE_TOKEN.as_bytes());
            if !ok {
                e.unauthorized.fetch_add(1, Ordering::Relaxed);
            }
            ok
        }
        async fn stream(State(e): State<FakeEngine>, h: HeaderMap, ws: WebSocketUpgrade) -> Response {
            if !authed(&e, &h) {
                return StatusCode::UNAUTHORIZED.into_response();
            }
            ws.on_upgrade(move |mut s| async move {
                e.streams.fetch_add(1, Ordering::Relaxed);
                let mut rx = e.tx.subscribe();
                let first: Vec<Value> = e.views.lock().unwrap().iter().flat_map(engine_frames).collect();
                for f in first {
                    if s.send(AxMessage::text(f.to_string())).await.is_err() {
                        return;
                    }
                }
                let mut hb = tokio::time::interval(Duration::from_secs(5));
                loop {
                    tokio::select! {
                        _ = hb.tick() => { if s.send(AxMessage::text(json!({"type": "hb", "t": 0}).to_string())).await.is_err() { break; } }
                        f = rx.recv() => match f {
                            Ok(f) => { if s.send(AxMessage::text(f)).await.is_err() { break; } }
                            Err(_) => break,
                        },
                        m = s.recv() => if !matches!(m, Some(Ok(_))) { break; },
                    }
                }
            })
        }
        async fn snapshot(State(e): State<FakeEngine>, h: HeaderMap, Path((tenant, kind)): Path<(String, String)>) -> Response {
            if !authed(&e, &h) {
                return StatusCode::UNAUTHORIZED.into_response();
            }
            if tenant != "ezymex" {
                return (StatusCode::NOT_FOUND, axum::Json(json!({"code": "not_found", "message": format!("Unknown tenant {tenant}")}))).into_response();
            }
            let live = kind == "live";
            let views = if live { e.views.lock().unwrap().clone() } else { vec![] };
            let seq = views.iter().filter_map(|v| v["seq"].as_u64()).max().unwrap_or(0);
            let books = if views.is_empty() { json!([]) } else { json!([{"underlying": "EURUSD", "seq": seq, "series": views}]) };
            axum::Json(json!({"tenant": tenant, "kind": kind, "enabled": live, "books": books, "at": chrono::Utc::now()})).into_response()
        }
        async fn trades(State(e): State<FakeEngine>, h: HeaderMap, Path((tenant, kind)): Path<(String, String)>, Query(q): Query<HashMap<String, String>>) -> Response {
            if !authed(&e, &h) {
                return StatusCode::UNAUTHORIZED.into_response();
            }
            let limit: usize = q.get("limit").and_then(|l| l.parse().ok()).unwrap_or(100);
            let list: Vec<Value> = e.trades.lock().unwrap().iter().filter(|t| q.get("series").is_none_or(|s| t["series"] == s.as_str())).take(limit).cloned().collect();
            axum::Json(json!({"tenant": tenant, "kind": kind, "trades": list})).into_response()
        }
        let app = axum::Router::new()
            .route("/v1/internal/options/book/stream", get(stream))
            .route("/v1/internal/options/book/{tenant}/{kind}/snapshot", get(snapshot))
            .route("/v1/internal/options/book/{tenant}/{kind}/trades", get(trades))
            .with_state(self);
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        format!("http://{addr}")
    }
}

async fn wait_for(what: &str, secs: u64, mut f: impl FnMut() -> bool) {
    let until = Instant::now() + Duration::from_secs(secs);
    while !f() {
        assert!(Instant::now() < until, "timed out waiting for {what}");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

/// Reads frames until one matches (or the deadline passes).
async fn next_frame<S>(ws: &mut S, secs: u64, mut f: impl FnMut(&Value) -> bool) -> Option<Value>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    let deadline = tokio::time::Instant::now() + Duration::from_secs(secs);
    while let Ok(Some(Ok(m))) = tokio::time::timeout_at(deadline, ws.next()).await {
        let Ok(text) = m.to_text() else { continue };
        let Ok(v) = serde_json::from_str::<Value>(text) else { continue };
        if f(&v) {
            return Some(v);
        }
    }
    None
}

fn row_of<'a>(chain: &'a Value, label: &str) -> &'a Value {
    chain["rows"].as_array().unwrap().iter().find(|r| r["strikeLabel"] == label).unwrap()
}

/* ------------------------------------------------------------------ */
/* Feed merge, stream ops, public routes                               */
/* ------------------------------------------------------------------ */

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn book_feed_merges_into_chain_stream_and_public_routes() {
    let engine = FakeEngine::new(vec![], vec![]);
    let engine_url = engine.clone().serve().await;
    let Some(t) = setup("bookfeed", |c| {
        c.market_data_url = market_data_url();
        c.trading_url = engine_url.clone();
        c.trading_token = ENGINE_TOKEN.into();
    })
    .await
    else {
        return;
    };
    if !real_spots(&t.st).await {
        finish(t).await;
        return;
    }
    jobs::list_series(&t.st).await.unwrap();

    // ---------------- before any book: house quotes, `book.active: false`
    let house = t.get("/v1/options/chain?u=EURUSD", &[LIVE]).await;
    assert_eq!(house["book"]["active"], false, "{}", house["book"]);
    assert_eq!((house["book"]["premiumTick"].as_f64(), house["book"]["bands"]["minTicks"].as_i64()), (Some(0.00001), Some(5)));
    assert_eq!(house["barriers"]["label"], "Ezymex-quoted (RFQ only)");
    assert!(house["pcr"].is_null());
    let expiry = house["expiry"].as_str().unwrap().to_string();
    let spot = house["spot"]["mid"].as_f64().unwrap();
    let atm = house["rows"].as_array().unwrap().iter().min_by(|a, b| (a["strike"].as_f64().unwrap() - spot).abs().total_cmp(&(b["strike"].as_f64().unwrap() - spot).abs())).unwrap().clone();
    let label = atm["strikeLabel"].as_str().unwrap().to_string();
    let (call, put) = (atm["call"]["code"].as_str().unwrap().to_string(), atm["put"]["code"].as_str().unwrap().to_string());
    assert!(atm["call"]["bid"].is_number() && atm["call"].get("bidQty").is_none());
    let theo = atm["call"]["mark"].as_f64().unwrap();
    let model_spread = atm["call"]["ask"].as_f64().unwrap() - atm["call"]["bid"].as_f64().unwrap();
    // book prices placed around the real model theo, on the 0.00001 tick: 2 ticks above it, 3 ticks wide
    let tick = 0.00001;
    let snap = |x: f64| ((x / tick).round() * tick * 1e5).round() / 1e5;
    let bid = snap(theo) + 2.0 * tick;
    let bid = (bid * 1e5).round() / 1e5;
    let ask = ((bid + 3.0 * tick) * 1e5).round() / 1e5;
    assert!(3.0 * tick <= 3.0 * model_spread, "the book qualifies for the clamp: model spread {model_spread}");
    let bid2 = ((bid - tick) * 1e5).round() / 1e5;
    engine.publish(view(&call, &[(bid, 4.0, 1), (bid2, 6.0, 2)], &[(ask, 2.0, 1)], None, 25.0, 0.0, 100, bid));
    engine.publish(view(&put, &[], &[], None, 40.0, 0.0, 100, 0.0));
    engine.trade(&call, "fx-0", bid, 3.0, "sell", 99);

    // ---------------- the consumer: snapshot poll + WebSocket, internal token sent
    book_feed::spawn(t.st.clone());
    let st = t.st.clone();
    let c2 = call.clone();
    wait_for("the live book", 10, || st.books.active("ezymex", Kind::Live) && st.books.book("ezymex", Kind::Live, &c2).is_some_and(|b| b.bid.is_some())).await;
    wait_for("the stream", 10, || st.books.connected()).await;
    assert_eq!(engine.unauthorized.load(Ordering::Relaxed), 0, "the engine token is sent");
    assert!(!t.st.books.active("ezymex", Kind::Demo), "demo has no book");
    let status = t.get("/v1/internal/options/status", &[]).await;
    assert_eq!((status["bookFeed"]["connected"].as_bool(), status["bookFeed"]["engineHasBook"].as_bool()), (Some(true), Some(true)), "{}", status["bookFeed"]);

    // ---------------- chain merge (live): book sides, sizes, the clamped mark, theo, implied vols, OI, PCR
    let chain = t.get(&format!("/v1/options/chain?u=EURUSD&expiry={expiry}"), &[LIVE]).await;
    let b = &chain["book"];
    assert_eq!((b["active"].as_bool(), b["kind"].as_str(), b["venue"].as_str()), (Some(true), Some("live"), Some("book")));
    assert_eq!((b["makerFee"].as_f64(), b["takerFee"].as_f64(), b["bands"]["market"].as_f64(), b["bands"]["limit"].as_f64()), (Some(-0.05), Some(0.25), Some(10.0), Some(50.0)));
    assert_eq!((b["makerFeePerContract"].as_f64(), b["marketBandPct"].as_f64(), b["bandMinTicks"].as_i64()), (Some(-0.05), Some(10.0), Some(5)));
    assert_eq!(chain["pcr"].as_f64(), Some(1.6), "put OI 40 / call OI 25");
    let row = row_of(&chain, &label);
    let c = &row["call"];
    assert_eq!((c["bid"].as_f64(), c["ask"].as_f64(), c["bidQty"].as_f64(), c["askQty"].as_f64()), (Some(bid), Some(ask), Some(4.0), Some(2.0)), "{c}");
    assert_eq!((c["mark"].as_f64(), c["markSource"].as_str()), (Some(bid), Some("bid")), "model below the bid: clamped up: {c}");
    assert!((c["theo"].as_f64().unwrap() - theo).abs() < tick, "theo is the model mid: {c}");
    assert!(c["markIv"].as_f64().unwrap() > c["theoIv"].as_f64().unwrap());
    assert!(c["bidIv"].as_f64().unwrap() < c["askIv"].as_f64().unwrap());
    assert_eq!((c["oi"].as_f64(), c["volume"].as_f64(), c["last"].as_f64()), (Some(25.0), Some(0.0), None));
    assert!((c["bidUsd"].as_f64().unwrap() - bid * 10_000.0).abs() < 0.006 && (c["markUsd"].as_f64().unwrap() - bid * 10_000.0).abs() < 0.006);
    // Greeks stay the model's (the demo chain right below is the house quote of the same instant, give or take)
    let model_delta = atm["call"]["delta"].as_f64().unwrap();
    assert!((c["delta"].as_f64().unwrap() - model_delta).abs() < 0.02, "greeks from the model: {} vs {model_delta}", c["delta"]);
    let p = &row["put"];
    assert!(p["bid"].is_null() && p["ask"].is_null() && p["bidQty"].is_null() && p["askQty"].is_null(), "empty book sides are null: {p}");
    assert_eq!((p["oi"].as_f64(), p["markSource"].as_str()), (Some(40.0), Some("model")));
    // a strike without any book: null sides, the model mark
    let far = chain["rows"].as_array().unwrap().iter().find(|r| r["strikeLabel"] != label.as_str()).unwrap();
    assert!(far["call"]["bid"].is_null() && far["call"]["theo"].is_number() && far["call"]["mark"] == far["call"]["theo"]);

    // demo accounts: no book there, today's house quotes
    let demo = t.get(&format!("/v1/options/chain?u=EURUSD&expiry={expiry}"), &[DEMO]).await;
    assert_eq!(demo["book"]["active"], false);
    let dc = &row_of(&demo, &label)["call"];
    assert!(dc["bid"].is_number() && dc.get("bidQty").is_none() && dc.get("theo").is_none(), "{dc}");
    assert!((dc["mark"].as_f64().unwrap() - c["theo"].as_f64().unwrap()).abs() < tick, "theo = the house model mid");
    assert!((dc["delta"].as_f64().unwrap() - c["delta"].as_f64().unwrap()).abs() < 0.005, "same Greeks as the house quote");

    // series metadata: the vanilla trades on the book; a barrier code is Ezymex-quoted, RFQ only
    let sv = t.get(&format!("/v1/options/series/{call}"), &[LIVE]).await;
    assert_eq!((sv["venue"].as_str(), sv["quote"]["bidQty"].as_f64()), (Some("book"), Some(4.0)));
    let bar = t.get(&format!("/v1/options/series/{call}-UO1.5000"), &[LIVE]).await;
    assert_eq!((bar["venue"].as_str(), bar["ezymexQuoted"].as_bool(), bar["label"].as_str(), bar["barrier"]["kind"].as_str()), (Some("rfq"), Some(true), Some("Ezymex-quoted (RFQ only)"), Some("UO")));
    assert!(bar["quote"].is_null() && bar["series"]["code"] == call.as_str());
    let ul = t.get("/v1/options/underlyings", &[LIVE]).await;
    assert_eq!(ul["underlyings"].as_array().unwrap().iter().find(|u| u["symbol"] == "EURUSD").unwrap()["orderBook"], true);

    // ---------------- stream: chain with the book, then depth / tape ops and live rows
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let app = t.app.clone();
    tokio::spawn(async move { axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await.unwrap() });
    let tk = t.call("POST", "/v1/options/stream/ticket", &[LIVE], Some(json!({"group": "*"}))).await.1;
    let (mut ws, _) = tokio_tungstenite::connect_async(format!("ws://{addr}/v1/options/stream?ticket={}", tk["ticket"].as_str().unwrap())).await.unwrap();
    ws.send(Message::text(json!({"op": "subscribe", "u": "EURUSD", "expiry": expiry}).to_string())).await.unwrap();
    let first = next_frame(&mut ws, 5, |v| v["type"] == "chain").await.expect("chain frame");
    assert_eq!(first["book"]["active"], true);
    assert_eq!(row_of(&first, &label)["call"]["bidQty"].as_f64(), Some(4.0));
    ws.send(Message::text(json!({"op": "depth", "series": [call]}).to_string())).await.unwrap();
    let d = next_frame(&mut ws, 5, |v| v["type"] == "depth").await.expect("depth on subscribe");
    assert_eq!(d["series"], call.as_str());
    assert_eq!(d["bids"], json!([[bid, 4.0, 1], [bid2, 6.0, 2]]));
    assert_eq!(d["asks"], json!([[ask, 2.0, 1]]));
    ws.send(Message::text(json!({"op": "tape", "series": [call]}).to_string())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(300)).await;
    // a client buys 1 at the ask: trade print, new depth and top
    engine.trade(&call, "fx-1", ask, 1.0, "buy", 101);
    engine.publish(view(&call, &[(bid, 4.0, 1), (bid2, 6.0, 2)], &[(ask, 1.0, 1)], Some((ask, 1.0)), 26.0, 1.0, 101, bid));
    let (mut tape, mut depth, mut rows) = (None, None, None);
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    while (tape.is_none() || depth.is_none() || rows.is_none()) && tokio::time::Instant::now() < deadline {
        let Some(v) = next_frame(&mut ws, 5, |v| matches!(v["type"].as_str(), Some("tape" | "depth" | "rows"))).await else { break };
        match v["type"].as_str() {
            Some("tape") => tape = Some(v),
            Some("depth") => depth = Some(v),
            Some("rows") if v["rows"].as_array().unwrap().iter().any(|r| r["strikeLabel"] == label.as_str() && r["call"]["last"].as_f64() == Some(ask)) => rows = Some(v),
            _ => {}
        }
    }
    let tape = tape.expect("tape frame");
    let tr = &tape["trades"][0];
    assert_eq!((tr["series"].as_str(), tr["price"].as_f64(), tr["qty"].as_f64(), tr["takerSide"].as_str(), tr["id"].as_str()), (Some(call.as_str()), Some(ask), Some(1.0), Some("buy"), Some("fx-1")));
    assert!(tr["time"].as_i64().unwrap() > 1_700_000_000_000, "time in ms: {tr}");
    assert_eq!(tape["trades"].as_array().unwrap().len(), 1, "only trades after the tape op: {tape}");
    assert_eq!(depth.expect("depth update")["asks"], json!([[ask, 1.0, 1]]));
    let rows = rows.expect("rows frame with the trade");
    let rc = &rows["rows"].as_array().unwrap().iter().find(|r| r["strikeLabel"] == label.as_str()).unwrap()["call"];
    assert_eq!((rc["volume"].as_f64(), rc["askQty"].as_f64(), rc["oi"].as_f64()), (Some(1.0), Some(1.0), Some(26.0)));
    // an empty list stops the depth
    ws.send(Message::text(json!({"op": "depth", "series": []}).to_string())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(300)).await;
    engine.publish(view(&call, &[(bid, 5.0, 2)], &[(ask, 1.0, 1)], Some((ask, 1.0)), 26.0, 1.0, 102, bid));
    assert!(next_frame(&mut ws, 1, |v| v["type"] == "depth").await.is_none(), "no depth after an empty list");
    let too_many: Vec<String> = (0..21).map(|i| format!("S{i}")).collect();
    ws.send(Message::text(json!({"op": "depth", "series": too_many}).to_string())).await.unwrap();
    let err = next_frame(&mut ws, 3, |v| v["type"] == "error").await.expect("too many");
    assert_eq!(err["code"], "too_many");

    // ---------------- public routes: depth, tape, stats; cached 1 s; 10 requests / s per IP
    let c3 = call.clone();
    let st = t.st.clone();
    wait_for("bid size 5", 5, || st.books.book("ezymex", Kind::Live, &c3).is_some_and(|b| b.bid == Some((bid, 5.0)))).await;
    let t0 = Instant::now();
    let (s, h, pb) = t.public(&format!("/v1/public/options/book/{call}"), &[]).await;
    assert_eq!(s, StatusCode::OK, "{pb}");
    assert_eq!(h.get("cache-control").unwrap(), "public, max-age=1");
    assert_eq!((pb["bids"].clone(), pb["asks"].clone()), (json!([[bid, 5.0, 2]]), json!([[ask, 1.0, 1]])));
    assert_eq!((pb["underlying"].as_str(), pb["kind"].as_str(), pb["oi"].as_f64(), pb["volume"].as_f64(), pb["last"].as_f64(), pb["mark"].as_f64()), (Some("EURUSD"), Some("live"), Some(26.0), Some(1.0), Some(ask), Some(bid)));
    engine.publish(view(&call, &[(bid, 9.0, 3)], &[(ask, 1.0, 1)], Some((ask, 1.0)), 26.0, 1.0, 103, bid));
    let st = t.st.clone();
    let c4 = call.clone();
    wait_for("bid size 9", 5, || st.books.book("ezymex", Kind::Live, &c4).is_some_and(|b| b.bid == Some((bid, 9.0)))).await;
    let (_, _, again) = t.public(&format!("/v1/public/options/book/{call}"), &[]).await;
    if t0.elapsed() < Duration::from_millis(900) {
        assert_eq!(again["bids"], json!([[bid, 5.0, 2]]), "served from the 1 s cache");
    }
    tokio::time::sleep(Duration::from_millis(1100).saturating_sub(t0.elapsed())).await;
    let (_, _, fresh) = t.public(&format!("/v1/public/options/book/{call}"), &[]).await;
    assert_eq!(fresh["bids"], json!([[bid, 9.0, 3]]), "fresh after a second");
    let (s, _, v) = t.public(&format!("/v1/public/options/book/{call}?kind=demo"), &[]).await;
    assert_eq!((s, v["error"]["code"].as_str()), (StatusCode::NOT_FOUND, Some("book_inactive")));
    let (s, _, _) = t.public("/v1/public/options/book/EURUSD-20200101-1.0000-C", &[]).await;
    assert_eq!(s, StatusCode::NOT_FOUND);

    let (s, _, tp) = t.public(&format!("/v1/public/options/trades/{call}?limit=10"), &[]).await;
    assert_eq!(s, StatusCode::OK, "{tp}");
    let ids: Vec<&str> = tp["trades"].as_array().unwrap().iter().map(|x| x["id"].as_str().unwrap()).collect();
    assert_eq!(ids, ["fx-1", "fx-0"], "newest first, from the engine's trades route");
    let t1 = &tp["trades"][0];
    assert_eq!((t1["price"].as_f64(), t1["qty"].as_f64(), t1["takerSide"].as_str(), t1["kind"].as_str()), (Some(ask), Some(1.0), Some("buy"), Some("book")));

    let (s, _, stats) = t.public("/v1/public/options/stats/eurusd", &[]).await;
    assert_eq!(s, StatusCode::OK, "{stats}");
    let ex = stats["expiries"].as_array().unwrap().iter().find(|e| e["date"] == expiry.as_str()).unwrap();
    assert_eq!((ex["callOi"].as_f64(), ex["putOi"].as_f64(), ex["callVolume"].as_f64(), ex["pcr"].as_f64()), (Some(26.0), Some(40.0), Some(1.0), Some(round4(40.0 / 26.0))));
    let sr = ex["strikes"].as_array().unwrap().iter().find(|r| r["strikeLabel"] == label.as_str()).unwrap();
    assert_eq!((sr["call"]["series"].as_str(), sr["call"]["oi"].as_f64(), sr["put"]["oi"].as_f64()), (Some(call.as_str()), Some(26.0), Some(40.0)));
    assert_eq!(stats["totals"]["callOi"].as_f64(), Some(26.0));

    // 10 requests / s per client IP (behind Caddy: the first X-Forwarded-For hop)
    let mut codes = Vec::new();
    for _ in 0..14 {
        let (s, h, _) = t.public("/v1/public/options/stats/EURUSD", &[("x-forwarded-for", "198.51.100.23, 10.0.0.2")]).await;
        if s == StatusCode::TOO_MANY_REQUESTS {
            assert_eq!(h.get("retry-after").unwrap(), "1");
        }
        codes.push(s.as_u16());
    }
    let ok = codes.iter().filter(|c| **c == 200).count();
    assert!((10..=11).contains(&ok) && codes.contains(&429), "{codes:?}");
    assert!(codes[..10].iter().all(|c| *c == 200), "{codes:?}");
    let (s, _, _) = t.public("/v1/public/options/stats/EURUSD", &[("x-forwarded-for", "198.51.100.24")]).await;
    assert_eq!(s, StatusCode::OK, "another client is not limited");

    drop(ws);
    finish(t).await;
}

fn round4(x: f64) -> f64 {
    (x * 1e4).round() / 1e4
}

/* ------------------------------------------------------------------ */
/* No engine: today's behaviour                                        */
/* ------------------------------------------------------------------ */

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn absent_engine_keeps_house_prices() {
    // an engine without the book routes (404 on everything) and a refused port
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let no_book = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, axum::Router::new()).await.unwrap() });
    for (tag, engine) in [("noeng404", no_book), ("noengrefused", "http://127.0.0.1:1".to_string())] {
        let Some(t) = setup(tag, |c| {
            c.market_data_url = market_data_url();
            c.trading_url = engine.clone();
        })
        .await
        else {
            return;
        };
        let priced = real_spots(&t.st).await;
        if priced {
            jobs::list_series(&t.st).await.unwrap();
        }
        book_feed::spawn(t.st.clone());
        tokio::time::sleep(Duration::from_millis(1500)).await;
        assert!(!t.st.books.active("ezymex", Kind::Live) && !t.st.books.connected(), "{tag}");
        let status = t.get("/v1/internal/options/status", &[]).await;
        assert_eq!((status["bookFeed"]["connected"].as_bool(), status["bookFeed"]["engineHasBook"].as_bool()), (Some(false), Some(false)), "{tag}");
        if priced {
            let chain = t.get("/v1/options/chain?u=EURUSD", &[LIVE]).await;
            assert_eq!(chain["book"]["active"], false, "{tag}");
            assert!(chain["pcr"].is_null());
            for r in chain["rows"].as_array().unwrap() {
                for side in ["call", "put"] {
                    let q = &r[side];
                    assert!(q["bid"].is_number() && q["ask"].is_number() && q.get("bidQty").is_none() && q.get("theo").is_none(), "{tag}: {q}");
                }
            }
            let (s, _, v) = t.public("/v1/public/options/stats/EURUSD", &[]).await;
            assert_eq!((s, v["error"]["code"].as_str()), (StatusCode::NOT_FOUND, Some("book_inactive")), "{tag}");
        }
        finish(t).await;
    }
}

/* ------------------------------------------------------------------ */
/* The real engine (run with --ignored while services/trading runs)    */
/* ------------------------------------------------------------------ */

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "needs the trading engine (TRADING_URL, default :8090) and market-data running"]
async fn book_feed_against_the_real_engine() {
    let trading = std::env::var("TRADING_URL").unwrap_or_else(|_| "http://127.0.0.1:8090".into());
    let token = std::env::var("TRADING_INTERNAL_TOKEN").unwrap_or_default();
    let http = reqwest::Client::new();
    let mut rb = http.get(format!("{trading}/v1/internal/options/book/ezymex/live/snapshot"));
    if !token.is_empty() {
        rb = rb.header("x-ezymex-internal", &token);
    }
    let snap: Value = match rb.send().await {
        Ok(r) if r.status().is_success() => r.json().await.unwrap(),
        Ok(r) => panic!("engine snapshot route answered {}", r.status()),
        Err(e) => panic!("trading engine not reachable at {trading}: {e}"),
    };
    assert!(snap["books"].is_array() && snap["enabled"].is_boolean(), "{snap}");
    let enabled = snap["enabled"].as_bool().unwrap();
    let Some(t) = setup("realeng", |c| {
        c.market_data_url = market_data_url();
        c.trading_url = trading.clone();
        c.trading_token = token.clone();
    })
    .await
    else {
        return;
    };
    assert!(real_spots(&t.st).await, "market-data must be running");
    jobs::list_series(&t.st).await.unwrap();
    book_feed::spawn(t.st.clone());
    let st = t.st.clone();
    wait_for("the engine stream", 15, || st.books.connected()).await;
    let st = t.st.clone();
    wait_for("the venue flag", 20, || st.books.active("ezymex", Kind::Live) == enabled).await;
    let chain = t.get("/v1/options/chain?u=EURUSD", &[LIVE]).await;
    assert_eq!(chain["book"]["active"].as_bool(), Some(enabled));
    if enabled {
        // every engine series of the chain's expiry: best bid / offer as the engine publishes them
        let views: Vec<&Value> = snap["books"].as_array().unwrap().iter().flat_map(|b| b["series"].as_array().unwrap().iter()).collect();
        for r in chain["rows"].as_array().unwrap() {
            for side in ["call", "put"] {
                let q = &r[side];
                assert!(q["theo"].is_number() && q["markIv"].is_number(), "book fields: {q}");
                let Some(v) = views.iter().find(|v| v["series"] == q["code"]) else {
                    // no orders in this series: empty sides, the model mark
                    assert!(q["bid"].is_null() && q["ask"].is_null() && q["mark"] == q["theo"], "{q}");
                    continue;
                };
                let best = v["bids"].as_array().and_then(|b| b.first()).map(|l| l["price"].as_f64().unwrap());
                assert!(q["bid"].as_f64().is_some() == best.is_some(), "{q} vs {v}");
            }
        }
    } else {
        assert!(chain["rows"][0]["call"]["bid"].is_number(), "house prices while the engine's book is dormant");
    }
    eprintln!("real engine at {trading}: book enabled for ezymex/live = {enabled}, feed status {}", t.st.books.status());
    finish(t).await;
}
