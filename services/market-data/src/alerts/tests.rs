//! End-to-end tests of price alerts: a throw-away database `kalks_md_alerts_test_<pid>_<n>` on the local PostgreSQL
//! (MARKET_DATA_TEST_DATABASE_URL, default :5433), the real internal API on an ephemeral port, quotes pushed through
//! the market state like the feed does, and a stub notifications service. Skipped when PostgreSQL is unreachable.
//! BTCUSD (24/7) is the test symbol, so the tests pass on any day.

use super::*;
use crate::db;
use crate::instruments::Catalogue;
use crate::spreads::Spreads;
use axum::extract::State as AxState;
use axum::http::HeaderMap;
use axum::routing::post;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use std::sync::atomic::{AtomicU16, AtomicUsize, Ordering};

static N: AtomicUsize = AtomicUsize::new(0);
const TOKEN: &str = "test-internal-token";
const SYM: &str = "BTCUSD";

type Notes = Arc<Mutex<Vec<(HeaderMap, Value)>>>;

struct Env {
    base: String,
    alerts: Arc<Alerts>,
    admin: PgConnectOptions,
    name: String,
    http: reqwest::Client,
    notes: Notes,
    /// status the stub notifications service answers with
    notify_status: Arc<AtomicU16>,
}

async fn env_with(max: i64, cooldown: Duration) -> Option<Env> {
    let url = std::env::var("MARKET_DATA_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&url).ok()?.database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping price alert tests: no PostgreSQL at {url}");
        return None;
    }
    let name = format!("kalks_md_alerts_test_{}_{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst));
    let db_url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&db_url).await.expect("create + migrate");
    let cat = Catalogue::load(concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")).expect("instruments");
    let spreads = Spreads::load(&pool).await.expect("spreads");
    let market = Market::new(cat, pool, spreads, false);

    // stub notifications service: records every call, answers with `notify_status`
    let notes: Notes = Arc::new(Mutex::new(Vec::new()));
    let notify_status = Arc::new(AtomicU16::new(200));
    async fn notify(AxState((notes, status)): AxState<(Notes, Arc<AtomicU16>)>, h: HeaderMap, axum::Json(b): axum::Json<Value>) -> (axum::http::StatusCode, axum::Json<Value>) {
        let s = status.load(Ordering::SeqCst);
        if s == 200 {
            notes.lock().unwrap().push((h, b));
        }
        (axum::http::StatusCode::from_u16(s).unwrap(), axum::Json(json!({"results": []})))
    }
    let stub = axum::Router::new().route("/v1/notify", post(notify)).with_state((notes.clone(), notify_status.clone()));
    let sl = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let support_url = format!("http://{}", sl.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(sl, stub).await.unwrap() });

    let cfg = Config { internal_token: TOKEN.into(), support_url, support_token: "support-token".into(), max_per_user: max, repeat_cooldown: cooldown, tick: Duration::from_secs(3600) };
    let alerts = Alerts::start(cfg, market).await.expect("start");
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let app = router(alerts.clone());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Some(Env { base, alerts, admin, name, http: reqwest::Client::new(), notes, notify_status })
}

async fn env() -> Option<Env> {
    env_with(50, Duration::from_millis(0)).await
}

impl Env {
    async fn drop(self) {
        self.alerts.pool().close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    fn req(&self, method: reqwest::Method, path: &str, user: i64) -> reqwest::RequestBuilder {
        self.http.request(method, format!("{}{path}", self.base)).header("x-kalks-internal", TOKEN).header("x-kalks-tenant", "kalks").header("x-kalks-user-id", user.to_string())
    }

    async fn call(&self, method: reqwest::Method, path: &str, user: i64, body: Option<Value>) -> (u16, Value) {
        let mut rb = self.req(method, path, user);
        if let Some(b) = body {
            rb = rb.json(&b);
        }
        let r = rb.send().await.unwrap();
        let s = r.status().as_u16();
        (s, r.json().await.unwrap_or(Value::Null))
    }

    async fn create(&self, user: i64, body: Value) -> (u16, Value) {
        self.call(reqwest::Method::POST, "/v1/internal/alerts", user, Some(body)).await
    }

    /// A raw top of book from the feed (BTCUSD, 24/7).
    fn quote(&self, bid: f64, ask: f64) {
        self.alerts.market.on_book(SYM, bid, ask, Utc::now().timestamp_millis());
    }

    async fn history(&self, user: i64) -> Vec<Value> {
        let (s, v) = self.call(reqwest::Method::GET, "/v1/internal/alerts/history", user, None).await;
        assert_eq!(s, 200);
        v["items"].as_array().cloned().unwrap_or_default()
    }

    async fn wait_for<F: Fn() -> bool>(&self, what: &str, f: F) {
        for _ in 0..200 {
            if f() {
                return;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("timed out waiting for {what}");
    }

    async fn wait_history(&self, user: i64, n: usize) -> Vec<Value> {
        for _ in 0..200 {
            let h = self.history(user).await;
            if h.len() >= n {
                return h;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("timed out waiting for {n} triggers");
    }

    async fn alert(&self, user: i64, id: i64) -> Value {
        let (_, v) = self.call(reqwest::Method::GET, "/v1/internal/alerts", user, None).await;
        v["items"].as_array().unwrap().iter().find(|a| a["id"] == id).cloned().unwrap_or(Value::Null)
    }

    /// Lets the evaluator and the writer settle.
    async fn settle(&self) {
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}

fn above(value: f64) -> Value {
    json!({"symbol": SYM, "condition": "above", "value": value, "group": "raw"})
}

#[tokio::test]
async fn the_api_needs_the_internal_token_and_a_client() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let r = e.http.get(format!("{}/v1/internal/alerts", e.base)).header("x-kalks-user-id", "1").send().await.unwrap();
    assert_eq!(r.status().as_u16(), 401);
    let r = e.http.get(format!("{}/v1/internal/alerts", e.base)).header("x-kalks-internal", "wrong").header("x-kalks-user-id", "1").send().await.unwrap();
    assert_eq!(r.status().as_u16(), 401);
    let r = e.http.get(format!("{}/v1/internal/alerts", e.base)).header("x-kalks-internal", TOKEN).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 401);
    let (s, v) = e.call(reqwest::Method::GET, "/v1/internal/alerts", 1, None).await;
    assert_eq!(s, 200);
    assert_eq!(v, json!({"items": [], "limit": 50, "live": 0}));
    e.drop().await;
}

#[tokio::test]
async fn a_client_only_sees_and_changes_its_own_alerts() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (s, v) = e.create(1, above(60500.0)).await;
    assert_eq!(s, 201, "{v}");
    let id = v["alert"]["id"].as_i64().unwrap();
    let (_, other) = e.call(reqwest::Method::GET, "/v1/internal/alerts", 2, None).await;
    assert_eq!(other["items"], json!([]));
    let (s, _) = e.call(reqwest::Method::PATCH, &format!("/v1/internal/alerts/{id}"), 2, Some(json!({"note": "mine now"}))).await;
    assert_eq!(s, 404);
    let (s, _) = e.call(reqwest::Method::DELETE, &format!("/v1/internal/alerts/{id}"), 2, None).await;
    assert_eq!(s, 404);
    // another tenant with the same user id is another client
    let r = e.http.get(format!("{}/v1/internal/alerts", e.base)).header("x-kalks-internal", TOKEN).header("x-kalks-tenant", "otherbroker").header("x-kalks-user-id", "1").send().await.unwrap();
    assert_eq!(r.json::<Value>().await.unwrap()["items"], json!([]));
    let (s, _) = e.call(reqwest::Method::DELETE, &format!("/v1/internal/alerts/{id}"), 1, None).await;
    assert_eq!(s, 200);
    assert!(e.alerts.live_ids(SYM).is_empty());
    e.drop().await;
}

#[tokio::test]
async fn a_new_alert_is_checked_against_the_market() {
    let Some(e) = env().await else { return };
    let (s, v) = e.create(1, above(60500.0)).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("no_price")));
    e.quote(60000.0, 60010.0);
    let (s, v) = e.create(1, json!({"symbol": "btcusd", "condition": "above", "value": "60500.004", "group": "raw", "note": "  breakout\n"})).await;
    assert_eq!(s, 201, "{v}");
    let a = &v["alert"];
    assert_eq!((a["symbol"].as_str(), a["target"].as_f64(), a["value"].as_f64()), (Some(SYM), Some(60500.0), Some(60500.0)));
    assert_eq!((a["status"].as_str(), a["basis"].as_str(), a["repeat"].as_bool(), a["note"].as_str()), (Some("active"), Some("bid"), Some(false), Some("breakout")));
    // already past the level (on the bid)
    let (s, v) = e.create(1, above(59990.0)).await;
    assert_eq!((s, v["error"]["code"].as_str(), v["error"]["field"].as_str()), (409, Some("level_reached"), Some("value")));
    assert!(v["error"]["message"].as_str().unwrap().contains("already above 59990.00"));
    // the ask is 60010: a level of 60005 is reached on the ask, not on the bid
    let (s, _) = e.create(1, json!({"symbol": SYM, "condition": "above", "value": 60005, "basis": "ask", "group": "raw"})).await;
    assert_eq!(s, 409);
    let (s, _) = e.create(1, json!({"symbol": SYM, "condition": "below", "value": 60005, "basis": "ask", "group": "raw"})).await;
    assert_eq!(s, 201);
    for (body, field) in [
        (json!({"symbol": "NOPE", "condition": "above", "value": 1}), "symbol"),
        (json!({"symbol": SYM, "condition": "sideways", "value": 1}), "condition"),
        (json!({"symbol": SYM, "condition": "above", "value": "abc"}), "value"),
        (json!({"symbol": SYM, "condition": "above"}), "value"),
        (json!({"symbol": SYM, "condition": "above", "value": 700000}), "value"),
        (json!({"symbol": SYM, "condition": "change_up", "value": 75}), "value"),
        (json!({"symbol": SYM, "condition": "above", "value": 61000, "basis": "mid"}), "basis"),
        (json!({"symbol": SYM, "condition": "above", "value": 61000, "group": "no such group!"}), "group"),
        (json!({"symbol": SYM, "condition": "above", "value": 61000, "expiresAt": "2020-01-01T00:00:00Z"}), "expiresAt"),
        (json!({"symbol": SYM, "condition": "above", "value": 61000, "expiresAt": "tomorrow"}), "expiresAt"),
        (json!({"symbol": SYM, "condition": "above", "value": 61000, "repeat": "yes"}), "repeat"),
    ] {
        let (s, v) = e.create(1, body.clone()).await;
        assert_eq!((s, v["error"]["field"].as_str()), (422, Some(field)), "{body} -> {v}");
    }
    e.drop().await;
}

#[tokio::test]
async fn alerts_watch_the_price_of_the_clients_group() {
    let Some(e) = env().await else { return };
    // raw 60000.00 / 60010.00; the standard group adds 10 points: 59999.95 / 60010.05
    e.quote(60000.0, 60010.0);
    let (s, _) = e.create(1, json!({"symbol": SYM, "condition": "above", "value": 60000, "group": "raw"})).await;
    assert_eq!(s, 409);
    let (s, v) = e.create(1, json!({"symbol": SYM, "condition": "above", "value": 60000, "group": "standard"})).await;
    assert_eq!(s, 201, "{v}");
    assert_eq!(v["alert"]["group"], "standard");
    // raw bid 60000.04 -> standard bid 59999.99: not yet
    e.quote(60000.04, 60010.04);
    e.settle().await;
    assert!(e.history(1).await.is_empty());
    e.quote(60000.10, 60010.10); // standard bid 60000.05
    let h = e.wait_history(1, 1).await;
    assert_eq!(h[0]["price"].as_f64(), Some(60000.05));
    e.drop().await;
}

#[tokio::test]
async fn a_one_shot_alert_fires_once_and_is_delivered() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (_, v) = e.create(42, json!({"symbol": SYM, "condition": "above", "value": 60500, "group": "raw", "note": "breakout"})).await;
    let id = v["alert"]["id"].as_i64().unwrap();
    assert_eq!(e.alerts.live_ids(SYM), vec![id]);
    e.quote(60400.0, 60410.0);
    e.settle().await;
    assert!(e.history(42).await.is_empty());
    e.quote(60600.0, 60610.0);
    let h = e.wait_history(42, 1).await;
    assert_eq!((h[0]["alertId"].as_i64(), h[0]["price"].as_f64(), h[0]["target"].as_f64(), h[0]["condition"].as_str()), (Some(id), Some(60600.0), Some(60500.0), Some("above")));
    assert!(e.alerts.live_ids(SYM).is_empty());
    let a = e.alert(42, id).await;
    assert_eq!((a["status"].as_str(), a["triggerCount"].as_i64(), a["lastPrice"].as_f64()), (Some("triggered"), Some(1), Some(60600.0)));
    // delivered to the notifications service, once
    let notes = e.notes.clone();
    e.wait_for("the notification", || !notes.lock().unwrap().is_empty()).await;
    let event_id = h_id(&e, 42).await;
    {
        let n = e.notes.lock().unwrap();
        let (h, b) = &n[0];
        assert_eq!(h["x-kalks-internal"], "support-token");
        assert_eq!(h["x-kalks-tenant"], "kalks");
        assert_eq!(h["x-kalks-service"], "market-data");
        assert_eq!(b["type"], "alerts.price");
        assert_eq!(b["userId"], 42);
        assert_eq!(b["title"], "BTCUSD rose above 60500.00");
        assert_eq!(b["body"], "Bid 60600.00 · your alert at 60500.00 · breakout");
        assert_eq!(b["link"], "/alerts");
        assert_eq!(b["dedupeKey"], format!("alert:{event_id}"));
        assert_eq!(b["data"]["symbol"], SYM);
    }
    let h = e.history(42).await;
    assert_eq!(h[0]["delivery"], "sent");
    // further moves don't fire it again
    e.quote(60700.0, 60710.0);
    e.quote(60300.0, 60310.0);
    e.quote(60800.0, 60810.0);
    e.settle().await;
    assert_eq!(e.history(42).await.len(), 1);
    assert_eq!(e.notes.lock().unwrap().len(), 1);
    e.drop().await;
}

async fn h_id(e: &Env, user: i64) -> i64 {
    e.history(user).await[0]["id"].as_i64().unwrap()
}

#[tokio::test]
async fn a_repeating_level_rearms_on_the_other_side() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (_, v) = e.create(1, json!({"symbol": SYM, "condition": "above", "value": 60500, "group": "raw", "repeat": true})).await;
    let id = v["alert"]["id"].as_i64().unwrap();
    e.quote(60600.0, 60610.0);
    e.wait_history(1, 1).await;
    e.quote(60700.0, 60710.0); // still above: no second trigger
    e.settle().await;
    assert_eq!(e.history(1).await.len(), 1);
    e.quote(60400.0, 60410.0); // back under: re-armed
    e.settle().await;
    e.quote(60550.0, 60560.0);
    let h = e.wait_history(1, 2).await;
    assert_eq!(h[0]["price"].as_f64(), Some(60550.0));
    let a = e.alert(1, id).await;
    assert_eq!((a["status"].as_str(), a["triggerCount"].as_i64()), (Some("active"), Some(2)));
    assert_eq!(e.alerts.live_ids(SYM), vec![id]);
    e.drop().await;
}

#[tokio::test]
async fn a_repeating_alert_waits_for_the_cooldown() {
    let Some(e) = env_with(50, Duration::from_secs(3600)).await else { return };
    e.quote(60000.0, 60010.0);
    e.create(1, json!({"symbol": SYM, "condition": "above", "value": 60500, "group": "raw", "repeat": true})).await;
    e.quote(60600.0, 60610.0);
    e.wait_history(1, 1).await;
    e.quote(60400.0, 60410.0);
    e.quote(60600.0, 60610.0);
    e.settle().await;
    assert_eq!(e.history(1).await.len(), 1);
    e.drop().await;
}

#[tokio::test]
async fn a_repeating_move_measures_from_its_last_trigger() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (s, v) = e.create(1, json!({"symbol": SYM, "condition": "change_up", "value": 1, "group": "raw", "repeat": true})).await;
    assert_eq!(s, 201, "{v}");
    let id = v["alert"]["id"].as_i64().unwrap();
    assert_eq!((v["alert"]["reference"].as_f64(), v["alert"]["target"].as_f64()), (Some(60000.0), Some(60600.0)));
    e.quote(60600.0, 60610.0);
    e.wait_history(1, 1).await;
    let a = e.alert(1, id).await;
    assert_eq!((a["reference"].as_f64(), a["target"].as_f64()), (Some(60600.0), Some(61206.0)));
    e.quote(61000.0, 61010.0);
    e.settle().await;
    assert_eq!(e.history(1).await.len(), 1);
    e.quote(61210.0, 61220.0);
    let h = e.wait_history(1, 2).await;
    assert_eq!((h[0]["reference"].as_f64(), h[0]["target"].as_f64()), (Some(60600.0), Some(61206.0)));
    // a fall
    let (_, v) = e.create(1, json!({"symbol": SYM, "condition": "change_down", "value": 0.5, "group": "raw"})).await;
    assert_eq!(v["alert"]["target"].as_f64(), Some(60903.95));
    e.quote(60900.0, 60910.0);
    let h = e.wait_history(1, 3).await;
    assert_eq!(h[0]["condition"], "change_down");
    e.drop().await;
}

#[tokio::test]
async fn the_live_alert_limit_is_per_client() {
    let Some(e) = env_with(2, Duration::from_millis(0)).await else { return };
    e.quote(60000.0, 60010.0);
    let (_, a) = e.create(1, above(61000.0)).await;
    e.create(1, above(62000.0)).await;
    let (s, v) = e.create(1, above(63000.0)).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("limit")));
    assert_eq!(e.create(2, above(63000.0)).await.0, 201);
    // a paused alert still counts
    let id = a["alert"]["id"].as_i64().unwrap();
    let (s, v) = e.call(reqwest::Method::PATCH, &format!("/v1/internal/alerts/{id}"), 1, Some(json!({"active": false}))).await;
    assert_eq!((s, v["alert"]["status"].as_str()), (200, Some("paused")));
    assert_eq!(e.create(1, above(63000.0)).await.0, 409);
    e.call(reqwest::Method::DELETE, &format!("/v1/internal/alerts/{id}"), 1, None).await;
    assert_eq!(e.create(1, above(63000.0)).await.0, 201);
    let (_, list) = e.call(reqwest::Method::GET, "/v1/internal/alerts", 1, None).await;
    assert_eq!((list["live"].as_i64(), list["limit"].as_i64()), (Some(2), Some(2)));
    e.drop().await;
}

#[tokio::test]
async fn pause_resume_and_edit() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (_, v) = e.create(1, above(60500.0)).await;
    let id = v["alert"]["id"].as_i64().unwrap();
    let path = format!("/v1/internal/alerts/{id}");
    let (_, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"active": false}))).await;
    assert_eq!(v["alert"]["status"], "paused");
    assert!(e.alerts.live_ids(SYM).is_empty());
    e.quote(60600.0, 60610.0);
    e.settle().await;
    assert!(e.history(1).await.is_empty());
    // resuming while the price is past the level is refused; with a new level it works
    let (s, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"active": true}))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("level_reached")));
    let (s, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"active": true, "value": 61000}))).await;
    assert_eq!((s, v["alert"]["status"].as_str(), v["alert"]["target"].as_f64()), (200, Some("active"), Some(61000.0)));
    assert_eq!(e.alerts.live_ids(SYM), vec![id]);
    // a note, repeat and expiry change keeps the level armed
    let exp = (Utc::now() + chrono::Duration::days(7)).to_rfc3339();
    let (s, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"note": "weekly high", "repeat": true, "expiresAt": exp}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["alert"]["note"].as_str(), v["alert"]["repeat"].as_bool(), v["alert"]["target"].as_f64()), (Some("weekly high"), Some(true), Some(61000.0)));
    assert!(v["alert"]["expiresAt"].is_string());
    let (_, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"expiresAt": null}))).await;
    assert!(v["alert"]["expiresAt"].is_null());
    // switching a level alert to a move needs a percentage
    let (s, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"condition": "change_down"}))).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("value")));
    let (s, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"condition": "change_down", "value": 2, "repeat": false}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["alert"]["reference"].as_f64(), v["alert"]["target"].as_f64()), (Some(60600.0), Some(59388.0)));
    // a triggered (one-shot) alert can be set again
    e.quote(59300.0, 59310.0);
    e.wait_history(1, 1).await;
    assert_eq!(e.alert(1, id).await["status"], "triggered");
    let (s, v) = e.call(reqwest::Method::PATCH, &path, 1, Some(json!({"condition": "above", "value": 60000, "active": true}))).await;
    assert_eq!((s, v["alert"]["status"].as_str(), v["alert"]["triggerCount"].as_i64()), (200, Some("active"), Some(1)));
    e.drop().await;
}

#[tokio::test]
async fn a_trigger_decided_on_an_older_version_is_dropped() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (_, v) = e.create(1, above(60500.0)).await;
    let id = v["alert"]["id"].as_i64().unwrap();
    let before = e.alerts.live.lock().unwrap().get(SYM).unwrap()[0].clone();
    e.call(reqwest::Method::PATCH, &format!("/v1/internal/alerts/{id}"), 1, Some(json!({"value": 60800}))).await;
    assert_eq!(e.alerts.commit_fire(&before, 60600.0, Utc::now(), None).await.unwrap(), None);
    assert!(e.history(1).await.is_empty());
    // the same trigger on the current version is recorded
    let now = e.alerts.live.lock().unwrap().get(SYM).unwrap()[0].clone();
    assert!(e.alerts.commit_fire(&now, 60900.0, Utc::now(), None).await.unwrap().is_some());
    assert_eq!(e.history(1).await.len(), 1);
    e.drop().await;
}

#[tokio::test]
async fn expired_alerts_are_retired() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let exp = (Utc::now() + chrono::Duration::minutes(5)).to_rfc3339();
    let (s, v) = e.create(1, json!({"symbol": SYM, "condition": "above", "value": 60500, "group": "raw", "expiresAt": exp})).await;
    assert_eq!(s, 201, "{v}");
    let id = v["alert"]["id"].as_i64().unwrap();
    sqlx::query("UPDATE price_alerts SET expires_at = now() - interval '1 second' WHERE id = $1").bind(id).execute(e.alerts.pool()).await.unwrap();
    assert_eq!(e.alerts.sweep_expired().await.unwrap(), 1);
    assert!(e.alerts.live_ids(SYM).is_empty());
    assert_eq!(e.alert(1, id).await["status"], "expired");
    e.quote(60600.0, 60610.0);
    e.settle().await;
    assert!(e.history(1).await.is_empty());
    // setting it again needs a new expiry
    let (s, v) = e.call(reqwest::Method::PATCH, &format!("/v1/internal/alerts/{id}"), 1, Some(json!({"active": true, "value": 61000}))).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("expiresAt")));
    let (s, _) = e.call(reqwest::Method::PATCH, &format!("/v1/internal/alerts/{id}"), 1, Some(json!({"active": true, "value": 61000, "expiresAt": null}))).await;
    assert_eq!(s, 200);
    e.drop().await;
}

#[tokio::test]
async fn delivery_is_retried_until_the_notifications_service_takes_it() {
    let Some(e) = env().await else { return };
    e.notify_status.store(503, Ordering::SeqCst);
    e.quote(60000.0, 60010.0);
    e.create(1, above(60500.0)).await;
    e.quote(60600.0, 60610.0);
    e.wait_history(1, 1).await;
    let pool = e.alerts.pool().clone();
    let mut attempts = 0;
    for _ in 0..200 {
        attempts = sqlx::query_scalar::<_, i32>("SELECT attempts FROM price_alert_events").fetch_one(&pool).await.unwrap();
        if attempts > 0 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(attempts, 1);
    assert_eq!(e.history(1).await[0]["delivery"], "pending");
    e.notify_status.store(200, Ordering::SeqCst);
    sqlx::query("UPDATE price_alert_events SET next_attempt_at = now()").execute(&pool).await.unwrap();
    assert_eq!(e.alerts.deliver_due().await.unwrap(), 1);
    assert_eq!(e.history(1).await[0]["delivery"], "sent");
    assert_eq!(e.notes.lock().unwrap().len(), 1);
    // a malformed notification is not retried
    e.notify_status.store(422, Ordering::SeqCst);
    e.create(1, above(61000.0)).await;
    e.quote(61100.0, 61110.0);
    e.wait_history(1, 2).await;
    for _ in 0..200 {
        if e.history(1).await[0]["delivery"] == "failed" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(e.history(1).await[0]["delivery"], "failed");
    e.drop().await;
}

#[tokio::test]
async fn history_pages_and_clears() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    for lvl in [60100.0, 60200.0, 60300.0] {
        e.create(1, above(lvl)).await;
    }
    e.quote(60400.0, 60410.0);
    e.wait_history(1, 3).await;
    let (_, p1) = e.call(reqwest::Method::GET, "/v1/internal/alerts/history?limit=2", 1, None).await;
    assert_eq!(p1["items"].as_array().unwrap().len(), 2);
    let next = p1["next"].as_i64().unwrap();
    let (_, p2) = e.call(reqwest::Method::GET, &format!("/v1/internal/alerts/history?limit=2&before={next}"), 1, None).await;
    assert_eq!(p2["items"].as_array().unwrap().len(), 1);
    assert!(p2["next"].is_null());
    let (_, only) = e.call(reqwest::Method::GET, "/v1/internal/alerts/history?symbol=ETHUSD", 1, None).await;
    assert_eq!(only["items"], json!([]));
    let (s, v) = e.call(reqwest::Method::DELETE, "/v1/internal/alerts/history", 1, None).await;
    assert_eq!((s, v["cleared"].as_i64()), (200, Some(3)));
    assert!(e.history(1).await.is_empty());
    // cleared rows are only hidden: delivery still has them
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM price_alert_events").fetch_one(e.alerts.pool()).await.unwrap();
    assert_eq!(n, 3);
    e.drop().await;
}

#[tokio::test]
async fn alerts_survive_a_restart() {
    let Some(e) = env().await else { return };
    e.quote(60000.0, 60010.0);
    let (_, v) = e.create(1, above(60500.0)).await;
    let id = v["alert"]["id"].as_i64().unwrap();
    e.alerts.live.lock().unwrap().clear();
    assert_eq!(e.alerts.load().await.unwrap(), 1);
    assert_eq!(e.alerts.live_ids(SYM), vec![id]);
    e.drop().await;
}
