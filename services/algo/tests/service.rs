//! Service tests against a throw-away database `kalks_algo_test_<pid>` on the local Postgres (skipped when
//! Postgres is unreachable) with mock trading-engine, market-data and wallet servers:
//! - webhook auth: unknown URL, passphrase, replay (id / timestamp), rate limit, disabled, kill switch, fan-out;
//! - API key auth: bearer, wrong secret, HMAC + replay, scopes, IP whitelist, revocation, expiry;
//! - marketplace: paid subscription charges the wallet (price − platform cut) with idempotent keys; an
//!   insufficient balance cancels the subscription.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use algo::clients::{Engine, MarketData, Wallet};
use algo::config::Config;
use algo::security::Limiter;
use algo::specs::Specs;
use algo::state::AppState;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{Value, json};
use tokio::sync::Notify;

#[derive(Default)]
struct Mock {
    orders: Mutex<Vec<Value>>,
    transfers: Mutex<Vec<Value>>,
    wallet_balance: Mutex<f64>,
    /// house account calls to the engine's staff routes: (route, body)
    house: Mutex<Vec<(String, Value)>>,
}

async fn serve(app: Router) -> String {
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = l.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(l, app.into_make_service_with_connect_info::<SocketAddr>()).await.unwrap();
    });
    format!("http://{addr}")
}

fn account(login: i64) -> Value {
    json!({"login": login, "type": "demo", "group": "standard", "groupName": "Standard", "mode": "hedging", "status": "active", "balance": 10000.0, "equity": 10000.0, "currency": "USD"})
}

async fn mocks(m: Arc<Mock>) -> (String, String, String, String) {
    let engine = Router::new()
        .route("/v1/accounts", get(|| async { Json(json!({"accounts": [account(50000001), account(50000002)]})) }))
        .route("/v1/accounts/{login}", get(|Path(l): Path<i64>| async move { Json(json!({"account": account(l), "positions": [], "orders": []})) }))
        .route("/v1/accounts/{login}/sso", post(|Path(l): Path<i64>| async move { Json(json!({"token": format!("sso-{l}"), "login": l})) }))
        .route("/v1/terminal/sso", post(|Json(b): Json<Value>| async move { Json(json!({"token": format!("sess-{}", b["token"].as_str().unwrap_or(""))})) }))
        .route("/v1/groups", get(|| async { Json(json!({"groups": [{"code": "standard", "spreadGroup": "standard", "commissionPerLot": 0.0, "swapFree": false}]})) }))
        .route("/v1/terminal/state", get(|| async { Json(json!({"account": account(50000001), "positions": [], "orders": []})) }))
        .route(
            "/v1/terminal/orders",
            post(|State(m): State<Arc<Mock>>, Json(b): Json<Value>| async move {
                let mut o = m.orders.lock().unwrap();
                o.push(b);
                let t = 1_000_000 + o.len() as i64;
                Json(json!({"status": "filled", "orderTicket": t, "positionTicket": t, "price": 1.1, "book": "B"}))
            }),
        )
        // house accounts: the engine's staff routes (services/trading api/social_house.rs, social_admin.rs)
        .route(
            "/v1/social/admin/house",
            post(|State(m): State<Arc<Mock>>, Json(b): Json<Value>| async move {
                m.house.lock().unwrap().push(("provision".into(), b));
                Json(json!({"login": 50000009, "master": {"id": 77, "hidden": false}, "created": true}))
            }),
        )
        .route(
            "/v1/social/admin/masters/{id}/status",
            post(|State(m): State<Arc<Mock>>, Path(id): Path<i64>, Json(b): Json<Value>| async move {
                m.house.lock().unwrap().push((format!("status:{id}"), b));
                Json(json!({"master": {"id": id}}))
            }),
        )
        .route(
            "/v1/social/admin/house/{id}/capital",
            post(|State(m): State<Arc<Mock>>, Path(id): Path<i64>, Json(b): Json<Value>| async move {
                m.house.lock().unwrap().push((format!("capital:{id}"), b));
                Json(json!({"balance": 15000.0, "txn": 5}))
            }),
        )
        .route(
            "/v1/social/admin/house/{id}/retire",
            post(|State(m): State<Arc<Mock>>, Path(id): Path<i64>, Json(b): Json<Value>| async move {
                m.house.lock().unwrap().push((format!("retire:{id}"), b));
                Json(json!({"retired": true, "followersStopped": 0, "withdrawn": {"amount": 15000.0}}))
            }),
        )
        .route("/v1/social/admin/masters", get(|| async { Json(json!({"items": [{"id": 77, "status": "approved", "hidden": false, "stats": {"equity": 10000.0, "followers": 0, "aum": 0.0, "trades": 0}}]})) }))
        .with_state(m.clone());
    let gateway = Router::new().route(
        "/v1/internal/house-users",
        post(|State(m): State<Arc<Mock>>, Json(b): Json<Value>| async move {
            m.house.lock().unwrap().push(("house-user".into(), b));
            Json(json!({"user": {"id": 900, "isHouse": true}}))
        }),
    );
    let gateway = gateway.with_state(m.clone());
    let md = Router::new().route("/v1/quotes", get(|| async { Json(json!({"EURUSD": {"bid": 1.1, "ask": 1.1001, "t": 0}, "BTCUSD": {"bid": 80000.0, "ask": 80010.0, "t": 0}})) }));
    let wallet = Router::new()
        .route(
            "/v1/wallets/transfers",
            post(|State(m): State<Arc<Mock>>, Json(b): Json<Value>| async move {
                let amount: f64 = b["amount"].as_str().unwrap_or("0").parse().unwrap_or(0.0);
                let mut bal = m.wallet_balance.lock().unwrap();
                if b["direction"] == "debit" && amount > *bal {
                    return (axum::http::StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": {"code": "insufficient_funds", "message": "Insufficient available balance"}})));
                }
                if b["direction"] == "debit" {
                    *bal -= amount;
                }
                m.transfers.lock().unwrap().push(b.clone());
                (axum::http::StatusCode::OK, Json(json!({"status": "completed", "replayed": false})))
            }),
        )
        .with_state(m);
    (serve(engine).await, serve(md).await, serve(wallet).await, serve(gateway).await)
}

async fn setup() -> Option<(String, AppState, Arc<Mock>)> {
    let url = format!("postgres://postgres@127.0.0.1:5433/kalks_algo_test_{}", std::process::id());
    let pool = match tokio::time::timeout(std::time::Duration::from_secs(5), algo::db::connect(&url)).await {
        Ok(Ok(p)) => p,
        _ => {
            eprintln!("Postgres not reachable: skipping service tests");
            return None;
        }
    };
    let m = Arc::new(Mock::default());
    let (eng, md, wal, gw) = mocks(m.clone()).await;
    let mut cfg = Config::from_env().unwrap();
    cfg.internal_token = "test-internal".into();
    cfg.key_secret = "test-key-secret-0123456789abcdef0123456789".into();
    cfg.public_url = "http://test".into();
    cfg.anthropic_key = String::new();
    cfg.gateway_url = gw;
    let http = algo::clients::http();
    let st = AppState {
        cfg: Arc::new(cfg),
        pool,
        specs: Arc::new(Specs::repo()),
        md: MarketData { base: md, http: http.clone() },
        engine: Arc::new(Engine::new(eng, "t".into(), http.clone())),
        wallet: Wallet { base: wal, token: "w".into(), http: http.clone() },
        http,
        limiter: Arc::new(Limiter::default()),
        cancels: Arc::new(Mutex::new(HashMap::new())),
        runtime_wake: Arc::new(Notify::new()),
        jobs_wake: Arc::new(Notify::new()),
    };
    let base = serve(algo::api::router(st.clone())).await;
    Some((base, st, m))
}

async fn teardown(st: &AppState) {
    let db = format!("kalks_algo_test_{}", std::process::id());
    st.pool.close().await;
    if let Ok(mut c) = sqlx::ConnectOptions::connect(&"postgres://postgres@127.0.0.1:5433/postgres".parse::<sqlx::postgres::PgConnectOptions>().unwrap()).await {
        let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{db}\" WITH (FORCE)"))).execute(&mut c).await;
    }
}

struct C {
    base: String,
    http: reqwest::Client,
}

impl C {
    async fn user(&self, user: i64, method: reqwest::Method, path: &str, body: Option<Value>) -> (u16, Value) {
        let mut r = self.http.request(method, format!("{}{path}", self.base)).header("x-kalks-internal", "test-internal").header("x-kalks-user-id", user.to_string()).header("x-kalks-user-name", "Test%20User");
        if let Some(b) = body {
            r = r.json(&b);
        }
        let r = r.send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }
    async fn staff(&self, method: reqwest::Method, path: &str, body: Value) -> (u16, Value) {
        let r = self.http.request(method, format!("{}{path}", self.base)).header("x-kalks-internal", "test-internal").header("x-kalks-staff-id", "1").header("x-kalks-staff-role", "super_admin").json(&body).send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }
    async fn raw(&self, method: reqwest::Method, path: &str, headers: &[(&str, String)], body: &str) -> (u16, Value) {
        let mut r = self.http.request(method, format!("{}{path}", self.base)).body(body.to_string());
        for (k, v) in headers {
            r = r.header(*k, v);
        }
        let r = r.send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }
}

use reqwest::Method as M;

#[tokio::test]
async fn service_end_to_end() {
    let Some((base, st, mock)) = setup().await else { return };
    let c = C { base, http: reqwest::Client::new() };

    // internal routes need the internal token
    let (s, _) = c.raw(M::GET, "/v1/strategies", &[("x-kalks-user-id", "1".into())], "").await;
    assert_eq!(s, 403);

    /* ---------------- webhooks ---------------- */
    let (s, w) = c.user(1, M::POST, "/v1/webhooks", Some(json!({"name": "TV", "passphrase": "pw", "routes": [{"login": 50000001, "sizing": {"mode": "fixed", "value": 0.1}}, {"login": 50000002, "sizing": {"mode": "multiplier", "value": 3, "maxLots": 0.5}}]}))).await;
    assert_eq!(s, 200, "{w}");
    let token = w["token"].as_str().unwrap().to_string();
    let hook = format!("/hooks/{token}");
    // a route to someone else's account is refused
    let (s, _) = c.user(1, M::POST, "/v1/webhooks", Some(json!({"routes": [{"login": 99999999, "sizing": {"mode": "fixed", "value": 0.1}}]}))).await;
    assert_eq!(s, 422);
    let (s, _) = c.raw(M::POST, "/hooks/wh_unknown", &[], "{}").await;
    assert_eq!(s, 404);
    let (s, _) = c.raw(M::POST, &hook, &[], r#"{"passphrase":"bad","action":"buy","symbol":"EURUSD"}"#).await;
    assert_eq!(s, 401);
    let (s, r) = c.raw(M::POST, &hook, &[], r#"{"passphrase":"pw","action":"buy","symbol":"OANDA:EUR/USD","volume":0.2,"sl_pips":20,"id":"x1"}"#).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!(r["status"], "accepted");
    {
        let o = mock.orders.lock().unwrap();
        assert_eq!(o.len(), 2, "fan-out to both accounts");
        assert!(o.iter().all(|x| x["source"] == "webhook" && x["symbol"] == "EURUSD" && x["sl"].as_f64().is_some()));
        assert_eq!(o[0]["volume"], 0.1);
        assert_eq!(o[1]["volume"], 0.5); // 0.2 x 3 = 0.6, capped at 0.5
    }
    let (s, r) = c.raw(M::POST, &hook, &[], r#"{"passphrase":"pw","action":"buy","symbol":"EURUSD","id":"x1"}"#).await;
    assert_eq!((s, r["error"]["code"].as_str()), (409, Some("duplicate")));
    let (s, _) = c.raw(M::POST, &hook, &[], r#"{"passphrase":"pw","action":"buy","symbol":"EURUSD","timestamp":1500000000}"#).await;
    assert_eq!(s, 422);
    let (s, _) = c.raw(M::POST, &hook, &[], r#"{"passphrase":"pw","action":"jump","symbol":"EURUSD","id":"x2"}"#).await;
    assert_eq!(s, 422);
    let (s, _) = c.raw(M::POST, &hook, &[], "not json").await;
    assert_eq!(s, 400);
    // per-URL rate limit (tenant setting)
    let (s, _) = c.staff(M::PUT, "/v1/admin/settings", json!({"settings": {"webhookRatePerMin": 7}, "note": "test"})).await;
    assert_eq!(s, 200);
    let mut limited = false;
    for n in 0..10 {
        let (s, _) = c.raw(M::POST, &hook, &[], &format!(r#"{{"passphrase":"pw","action":"close","symbol":"EURUSD","id":"r{n}"}}"#)).await;
        if s == 429 {
            limited = true;
            break;
        }
    }
    assert!(limited, "rate limit applies");
    // kill switch blocks alerts
    let (s, _) = c.user(2, M::POST, "/v1/controls/kill", Some(json!({"killed": true}))).await;
    assert_eq!(s, 200);
    let (s2, w2) = c.user(2, M::POST, "/v1/webhooks", Some(json!({"routes": [{"login": 50000001, "sizing": {"mode": "fixed", "value": 0.1}}]}))).await;
    assert_eq!(s2, 200);
    let (s, r) = c.raw(M::POST, &format!("/hooks/{}", w2["token"].as_str().unwrap()), &[], r#"{"action":"buy","symbol":"EURUSD","id":"k1"}"#).await;
    assert_eq!((s, r["error"]["code"].as_str()), (409, Some("halted")));
    let (s, _) = c.user(1, M::PATCH, &format!("/v1/webhooks/{}", w["id"]), Some(json!({"status": "disabled"}))).await;
    assert_eq!(s, 200);
    let (s, _) = c.raw(M::POST, &hook, &[], r#"{"passphrase":"pw","action":"buy","symbol":"EURUSD","id":"d1"}"#).await;
    assert!(s == 403 || s == 429, "disabled webhook: {s}");

    /* ---------------- API keys ---------------- */
    let (s, k) = c.user(1, M::POST, "/v1/keys", Some(json!({"name": "bot", "login": 50000001, "scopes": ["read", "trade"]}))).await;
    assert_eq!(s, 200, "{k}");
    let (kid, secret) = (k["keyId"].as_str().unwrap().to_string(), k["secret"].as_str().unwrap().to_string());
    let bearer = |sec: &str| vec![("authorization", format!("Bearer {kid}:{sec}"))];
    let (s, _) = c.raw(M::GET, "/public/v1/account", &bearer(&secret), "").await;
    assert_eq!(s, 200);
    let (s, _) = c.raw(M::GET, "/public/v1/account", &bearer("ks_wrong"), "").await;
    assert_eq!(s, 401);
    let (s, _) = c.raw(M::GET, "/public/v1/account", &[], "").await;
    assert_eq!(s, 401);
    let before = mock.orders.lock().unwrap().len();
    let body = r#"{"symbol":"EURUSD","side":"sell","volume":0.1,"source":"manual"}"#;
    let mut h = bearer(&secret);
    h.push(("content-type", "application/json".into()));
    let (s, r) = c.raw(M::POST, "/public/v1/orders", &h, body).await;
    assert_eq!(s, 200, "{r}");
    assert!(r.get("book").is_none(), "dealing fields are stripped");
    assert_eq!(mock.orders.lock().unwrap()[before]["source"], "api", "the api source can't be overridden");
    // HMAC signature, then the same signature again (replay)
    let ts = chrono::Utc::now().timestamp_millis().to_string();
    let sig = algo::security::hmac_hex(secret.as_bytes(), format!("{ts}POST/public/v1/orders{body}").as_bytes());
    let hh = vec![("x-kalks-key", kid.clone()), ("x-kalks-timestamp", ts.clone()), ("x-kalks-signature", sig.clone()), ("content-type", "application/json".into())];
    let (s, _) = c.raw(M::POST, "/public/v1/orders", &hh, body).await;
    assert_eq!(s, 200);
    let (s, _) = c.raw(M::POST, "/public/v1/orders", &hh, body).await;
    assert_eq!(s, 401);
    let old = (chrono::Utc::now().timestamp_millis() - 120_000).to_string();
    let sig2 = algo::security::hmac_hex(secret.as_bytes(), format!("{old}POST/public/v1/orders{body}").as_bytes());
    let (s, _) = c.raw(M::POST, "/public/v1/orders", &[("x-kalks-key", kid.clone()), ("x-kalks-timestamp", old), ("x-kalks-signature", sig2)], body).await;
    assert_eq!(s, 401, "stale timestamp");
    // read-only key cannot trade; IP whitelist
    let (_, ro) = c.user(1, M::POST, "/v1/keys", Some(json!({"name": "ro", "login": 50000001, "scopes": ["read"], "ipWhitelist": ["10.9.0.0/16"]}))).await;
    let ro_h = vec![("authorization", format!("Bearer {}:{}", ro["keyId"].as_str().unwrap(), ro["secret"].as_str().unwrap())), ("x-forwarded-for", "10.9.3.4".into()), ("content-type", "application/json".into())];
    let (s, _) = c.raw(M::GET, "/public/v1/positions", &ro_h, "").await;
    assert_eq!(s, 200);
    let (s, _) = c.raw(M::POST, "/public/v1/orders", &ro_h, body).await;
    assert_eq!(s, 403, "read scope only");
    let mut other_ip = ro_h.clone();
    other_ip[1] = ("x-forwarded-for", "192.0.2.1".into());
    let (s, _) = c.raw(M::GET, "/public/v1/positions", &other_ip, "").await;
    assert_eq!(s, 403, "IP whitelist");
    // revoke
    let (s, _) = c.user(1, M::POST, &format!("/v1/keys/{}/revoke", k["id"]), None).await;
    assert_eq!(s, 200);
    let (s, _) = c.raw(M::GET, "/public/v1/account", &bearer(&secret), "").await;
    assert_eq!(s, 401);
    // expired key
    let (_, ex) = c.user(1, M::POST, "/v1/keys", Some(json!({"name": "ex", "login": 50000001, "scopes": ["read"], "expiresInDays": 1}))).await;
    sqlx::query("UPDATE api_keys SET expires_at = now() - interval '1 minute' WHERE id = $1").bind(ex["id"].as_i64().unwrap()).execute(&st.pool).await.unwrap();
    let (s, r) = c.raw(M::GET, "/public/v1/account", &[("authorization", format!("Bearer {}:{}", ex["keyId"].as_str().unwrap(), ex["secret"].as_str().unwrap()))], "").await;
    assert_eq!(s, 401, "{r}");

    /* ---------------- marketplace (paid) ---------------- */
    let (s, strat) = c.user(1, M::POST, "/v1/strategies", Some(json!({"kind": "code", "name": "Paid", "source": "symbol(\"EURUSD\")\ntimeframe(\"H1\")\nlots(0.1)\nbuy = crosses_above(ema(close, 10), ema(close, 30))\n"}))).await;
    assert_eq!(s, 200, "{strat}");
    let sid = strat["id"].as_i64().unwrap();
    // a track record with one closed trade
    let dep: i64 = sqlx::query_scalar("INSERT INTO deployments (user_id, strategy_id, version_id, login, account_type, status, start_balance) VALUES (1, $1, $2, 50000001, 'demo', 'stopped', 10000) RETURNING id")
        .bind(sid)
        .bind(strat["versionId"].as_i64().unwrap())
        .fetch_one(&st.pool)
        .await
        .unwrap();
    let (s, _) = c.user(1, M::POST, "/v1/market/listings", Some(json!({"strategyId": sid, "deploymentId": dep, "title": "Paid EMA", "description": "An EMA crossover on EURUSD H1 with fixed lots.", "priceMonthly": 50}))).await;
    assert_eq!(s, 422, "no closed trades yet");
    sqlx::query("INSERT INTO deployment_daily (deployment_id, day, realized, trades, wins) VALUES ($1, current_date, 25.5, 1, 1)").bind(dep).execute(&st.pool).await.unwrap();
    let (s, l) = c.user(1, M::POST, "/v1/market/listings", Some(json!({"strategyId": sid, "deploymentId": dep, "title": "Paid EMA", "description": "An EMA crossover on EURUSD H1 with fixed lots.", "priceMonthly": 50}))).await;
    assert_eq!(s, 200, "{l}");
    let lid = l["id"].as_i64().unwrap();
    let (s, _) = c.user(3, M::POST, &format!("/v1/market/listings/{lid}/subscribe"), Some(json!({"mode": "copy", "login": 50000002}))).await;
    assert_eq!(s, 404, "pending listings are not visible");
    let (s, _) = c.staff(M::POST, &format!("/v1/admin/listings/{lid}/moderate"), json!({"status": "approved", "note": "ok"})).await;
    assert_eq!(s, 200);
    let (s, _) = c.user(1, M::POST, &format!("/v1/market/listings/{lid}/subscribe"), Some(json!({"mode": "copy", "login": 50000001}))).await;
    assert_eq!(s, 409, "own listing");
    *mock.wallet_balance.lock().unwrap() = 10.0;
    let (s, r) = c.user(3, M::POST, &format!("/v1/market/listings/{lid}/subscribe"), Some(json!({"mode": "copy", "login": 50000002}))).await;
    assert_eq!((s, r["error"]["code"].as_str()), (422, Some("insufficient_funds")));
    *mock.wallet_balance.lock().unwrap() = 100.0;
    let (s, r) = c.user(3, M::POST, &format!("/v1/market/listings/{lid}/subscribe"), Some(json!({"mode": "copy", "login": 50000002}))).await;
    assert_eq!(s, 200, "{r}");
    assert!(r["deploymentId"].as_i64().is_some());
    {
        let t = mock.transfers.lock().unwrap();
        assert_eq!(t.len(), 2);
        let amt = |i: usize| t[i]["amount"].as_str().unwrap().parse::<f64>().unwrap();
        assert_eq!((t[0]["direction"].as_str(), amt(0), t[0]["user_id"].as_i64()), (Some("debit"), 50.0, Some(3)));
        assert_eq!((t[1]["direction"].as_str(), amt(1), t[1]["user_id"].as_i64()), (Some("credit"), 40.0, Some(1)));
        assert!(t[0]["idempotency_key"].as_str().unwrap().starts_with("algo:sub:"));
    }
    let (s, _) = c.user(3, M::POST, &format!("/v1/market/listings/{lid}/subscribe"), Some(json!({"mode": "copy", "login": 50000002}))).await;
    assert_eq!(s, 409, "already subscribed");
    let (s, _) = c.user(3, M::POST, &format!("/v1/market/listings/{lid}/reviews"), Some(json!({"rating": 4, "comment": "good"}))).await;
    assert_eq!(s, 200);
    let (s, _) = c.user(4, M::POST, &format!("/v1/market/listings/{lid}/reviews"), Some(json!({"rating": 1}))).await;
    assert_eq!(s, 403, "only subscribers review");
    let (_, mine) = c.user(1, M::GET, "/v1/market/mine", None).await;
    assert_eq!(mine["earned"], 40.0);
    assert_eq!(mine["platformFees"], 10.0);

    /* ---------------- house accounts ---------------- */
    // roles: a dealer can't provision
    let r = c.http.post(format!("{}/v1/admin/house", c.base)).header("x-kalks-internal", "test-internal").header("x-kalks-staff-id", "2").header("x-kalks-staff-role", "dealer").json(&json!({"preset": "gold-ema-trend", "note": "x"})).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 403);
    let (s, _) = c.staff(M::POST, "/v1/admin/house", json!({"preset": "gold-ema-trend"})).await;
    assert_eq!(s, 422, "a note is required");
    let (s, r) = c.staff(M::POST, "/v1/admin/house", json!({"preset": "gold-ema-trend", "capital": 10000, "note": "launch"})).await;
    assert_eq!(s, 200, "{r}");
    let h = r["item"].clone();
    let hid = h["id"].as_i64().unwrap();
    assert_eq!((h["status"].as_str(), h["userId"].as_i64(), h["login"].as_i64(), h["masterId"].as_i64()), (Some("active"), Some(900), Some(50000009), Some(77)));
    assert_eq!(h["deployment"]["status"], "running");
    assert_eq!(h["listing"]["status"], "approved");
    assert_eq!(h["backtest"]["status"], "queued");
    {
        let calls = mock.house.lock().unwrap();
        let prov = &calls.iter().find(|(k, _)| k == "provision").unwrap().1;
        assert_eq!((prov["userId"].as_i64(), prov["capital"].as_f64(), prov["group"].as_str()), (Some(900), Some(10000.0), Some("standard")));
        assert!(!calls.iter().any(|(k, _)| k.starts_with("status:")), "visible and on: nothing to hide");
    }
    // the preset is the house user's strategy, sized to the capital; nothing else is written for it
    let dep = h["deploymentId"].as_i64().unwrap();
    let (trades, src): (i64, String) = (
        sqlx::query_scalar("SELECT count(*) FROM deployment_positions WHERE deployment_id = $1").bind(dep).fetch_one(&st.pool).await.unwrap(),
        sqlx::query_scalar("SELECT v.source FROM strategy_versions v JOIN house_accounts h ON h.version_id = v.id WHERE h.id = $1").bind(hid).fetch_one(&st.pool).await.unwrap(),
    );
    assert_eq!(trades, 0, "no fabricated history");
    assert!(src.contains("max_daily_loss(200)"));
    // the marketplace shows it labelled as a house listing
    let (_, b) = c.user(5, M::GET, "/v1/market/listings", None).await;
    let l = b["items"].as_array().unwrap().iter().find(|l| l["id"] == h["listingId"]).cloned().unwrap();
    assert_eq!((l["house"].as_bool(), l["track"]["trades"].as_i64()), (Some(true), Some(0)));
    let (_, d) = c.user(5, M::GET, &format!("/v1/market/listings/{}", h["listingId"]), None).await;
    assert_eq!(d["house"], true);
    // provisioning the same preset twice is refused
    let (s, _) = c.staff(M::POST, "/v1/admin/house", json!({"preset": "gold-ema-trend", "note": "again"})).await;
    assert_eq!(s, 409);
    // off: paused, hidden, unlisted
    let (s, r) = c.staff(M::POST, &format!("/v1/admin/house/{hid}/switch"), json!({"enabled": false, "note": "pause"})).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!((r["applied"]["deployment"].as_str(), r["applied"]["leaderboard"].as_str(), r["applied"]["listing"].as_str()), (Some("paused"), Some("hidden"), Some("unlisted")));
    let (s, _) = c.user(5, M::GET, &format!("/v1/market/listings/{}", h["listingId"]), None).await;
    assert_eq!(s, 404, "unlisted while off");
    // on again: running, shown, listed
    let (_, r) = c.staff(M::POST, &format!("/v1/admin/house/{hid}/switch"), json!({"enabled": true, "note": "resume"})).await;
    assert_eq!((r["applied"]["deployment"].as_str(), r["applied"]["leaderboard"].as_str(), r["applied"]["listing"].as_str()), (Some("running"), Some("shown"), Some("approved")));
    // visibility off keeps it trading but hidden
    let (_, r) = c.staff(M::POST, &format!("/v1/admin/house/{hid}/visibility"), json!({"visible": false, "note": "hide"})).await;
    assert_eq!((r["applied"]["deployment"].as_str(), r["applied"]["leaderboard"].as_str()), (Some("running"), Some("hidden")));
    // master switch off overrides the account switch
    let (_, _) = c.staff(M::POST, &format!("/v1/admin/house/{hid}/visibility"), json!({"visible": true, "note": "show"})).await;
    let (s, r) = c.staff(M::PUT, "/v1/admin/house/settings", json!({"enabled": false, "note": "all off"})).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!(r["results"][0]["applied"]["deployment"], "paused");
    let (_, l) = c.staff(M::GET, "/v1/admin/house", json!({})).await;
    assert_eq!((l["settings"]["enabled"].as_bool(), l["totals"]["on"].as_i64()), (Some(false), Some(0)));
    let (_, r) = c.staff(M::PUT, "/v1/admin/house/settings", json!({"enabled": true, "note": "all on"})).await;
    assert_eq!(r["results"][0]["applied"]["deployment"], "running");
    // capital top-up goes to the engine as house capital
    let (s, _) = c.staff(M::POST, &format!("/v1/admin/house/{hid}/capital"), json!({"amount": 5000, "note": "top up"})).await;
    assert_eq!(s, 200);
    let (_, one) = c.staff(M::GET, &format!("/v1/admin/house/{hid}"), json!({})).await;
    assert_eq!(one["capital"], 15000.0);
    assert!(one["audit"].as_array().unwrap().len() >= 6, "every action audited");
    // delete: strategy stopped, listing unlisted, master retired in the engine
    let (s, r) = c.staff(M::POST, &format!("/v1/admin/house/{hid}/delete"), json!({"note": "wind down"})).await;
    assert_eq!(s, 200, "{r}");
    let status: String = sqlx::query_scalar("SELECT status FROM deployments WHERE id = $1").bind(dep).fetch_one(&st.pool).await.unwrap();
    assert_eq!(status, "stopped");
    {
        let calls = mock.house.lock().unwrap();
        assert!(calls.iter().any(|(k, b)| k == "retire:77" && b["withdrawCapital"] == true));
        assert!(calls.iter().any(|(k, b)| k == "capital:77" && b["amount"] == 5000.0));
        assert!(calls.iter().filter(|(k, _)| k == "status:77").count() >= 4);
    }
    let (_, l) = c.staff(M::GET, "/v1/admin/house", json!({})).await;
    assert_eq!(l["items"].as_array().unwrap().len(), 0);
    assert!(l["presets"].as_array().unwrap().iter().all(|p| p["houseId"].is_null()), "a deleted preset can be provisioned again");

    teardown(&st).await;
}
