//! End-to-end tests against a throw-away database `kalks_support_test_<pid>_<n>` on the local PostgreSQL
//! (SUPPORT_TEST_DATABASE_URL, default :5433) and a real HTTP server on an ephemeral port.
//! Skipped when PostgreSQL is unreachable. No AI key: the bot answers through its retrieval fallback.

use futures_util::StreamExt;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use support::config::Config;
use support::state::AppState;
use support::{api, db, kb};

static N: AtomicUsize = AtomicUsize::new(0);
const TOKEN: &str = "test-internal-token";

struct Env {
    base: String,
    st: AppState,
    admin: PgConnectOptions,
    name: String,
    http: reqwest::Client,
    dir: String,
}

async fn env() -> Option<Env> {
    env_with(|_| {}).await
}

/// `env()` with configuration changes (e.g. mobile push pointed at a stub push service).
async fn env_with(tweak: impl FnOnce(&mut Config)) -> Option<Env> {
    let url = std::env::var("SUPPORT_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&url).ok()?.database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping support tests: no PostgreSQL at {url}");
        return None;
    }
    let name = format!("kalks_support_test_{}_{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst));
    let db_url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&db_url).await.expect("create + migrate");
    let dir = std::env::temp_dir().join(&name).to_string_lossy().to_string();
    let mut cfg = Config::for_tests(&db_url, &dir);
    cfg.internal_token = TOKEN.into();
    tweak(&mut cfg);
    kb::seed(&pool, "kalks", &cfg.academy_glossary).await.expect("seed");
    let st = AppState::new(pool, cfg);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let app = api::router(st.clone());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Some(Env { base, st, admin, name, http: reqwest::Client::new(), dir })
}

impl Env {
    async fn drop(self) {
        self.st.pool.close().await;
        let _ = std::fs::remove_dir_all(&self.dir);
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    fn user(&self, method: reqwest::Method, path: &str, uid: i64) -> reqwest::RequestBuilder {
        self.http.request(method, format!("{}{path}", self.base)).header("x-kalks-internal", TOKEN).header("x-kalks-user-id", uid.to_string()).header("x-kalks-user-name", "Ana%20Silva").header("x-kalks-user-email", "ana@example.com")
    }

    fn staff(&self, method: reqwest::Method, path: &str, id: &str, role: &str) -> reqwest::RequestBuilder {
        self.http.request(method, format!("{}{path}", self.base)).header("x-kalks-internal", TOKEN).header("x-kalks-staff-id", id).header("x-kalks-staff-name", "Mei%20Lin").header("x-kalks-staff-role", role)
    }

    async fn json(rb: reqwest::RequestBuilder) -> (u16, Value) {
        let r = rb.send().await.unwrap();
        let s = r.status().as_u16();
        (s, r.json().await.unwrap_or(Value::Null))
    }

    async fn wait_for(&self, uid: i64, pred: impl Fn(&Value) -> bool) -> Value {
        for _ in 0..100 {
            let (_, v) = Env::json(self.user(reqwest::Method::GET, "/v1/support/me", uid)).await;
            if pred(&v) {
                return v;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("condition not met");
    }

    async fn ws(&self, ticket_req: reqwest::RequestBuilder) -> tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>> {
        let (s, t) = Env::json(ticket_req).await;
        assert_eq!(s, 200, "{t}");
        let url = format!("{}/v1/stream?ticket={}", self.base.replace("http", "ws"), t["ticket"].as_str().unwrap());
        let (ws, _) = tokio_tungstenite::connect_async(url).await.expect("ws connect");
        ws
    }
}

async fn next_of(ws: &mut tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, ty: &str) -> Value {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    loop {
        let m = tokio::time::timeout_at(deadline, ws.next()).await.expect("frame in time").expect("open").expect("ok");
        if let tokio_tungstenite::tungstenite::Message::Text(t) = m {
            let v: Value = serde_json::from_str(&t).unwrap();
            if v["type"] == ty {
                return v;
            }
        }
    }
}

use reqwest::Method as M;

#[tokio::test]
async fn bot_answers_then_hands_over_and_agent_replies_live() {
    let Some(e) = env().await else { return };
    // an agent has used the inbox before, so handovers alert them
    let (s, _) = Env::json(e.staff(M::GET, "/v1/support/admin/conversations", "7", "support")).await;
    assert_eq!(s, 200);
    let mut client_ws = e.ws(e.user(M::POST, "/v1/stream/ticket", 42)).await;
    assert_eq!(next_of(&mut client_ws, "hello").await["who"], "user");
    let mut staff_ws = e.ws(e.staff(M::POST, "/v1/stream/ticket", "7", "support")).await;
    next_of(&mut staff_ws, "hello").await;

    // 1. KYC question -> bot answer citing the KYC article
    let (s, v) = Env::json(e.user(M::POST, "/v1/support/me/messages", 42).json(&json!({"body": "How long does KYC verification take?"}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["conversation"]["status"], "bot");
    let conv = v["conversation"]["id"].as_i64().unwrap();
    let bot = next_of(&mut client_ws, "message").await; // own message first
    assert_eq!(bot["message"]["author"], "client");
    let bot = next_of(&mut client_ws, "message").await;
    assert_eq!(bot["message"]["author"], "bot");
    let cites = bot["message"]["meta"]["cites"].as_array().unwrap();
    assert!(cites.iter().any(|c| c["slug"].as_str().unwrap().starts_with("kyc")), "{bot}");
    assert!(bot["message"]["body"].as_str().unwrap().to_lowercase().contains("business day"), "{bot}");

    // 2. asks for a human -> waiting, staff alerted in their bell
    let (s, _) = Env::json(e.user(M::POST, "/v1/support/me/messages", 42).json(&json!({"body": "Can I talk to a human?"}))).await;
    assert_eq!(s, 200);
    let v = e.wait_for(42, |v| v["conversation"]["status"] == "waiting").await;
    assert!(v["messages"].as_array().unwrap().iter().any(|m| m["meta"]["kind"] == "handover"));
    let n = next_of(&mut staff_ws, "notification").await;
    assert_eq!(n["item"]["type"], "support.waiting");
    let (_, q) = Env::json(e.staff(M::GET, "/v1/support/admin/conversations?queue=waiting", "7", "support")).await;
    assert_eq!(q["items"][0]["id"], conv);
    assert!(q["items"][0]["slaDueAt"].is_string());

    // a viewer can read the queue but not reply
    let (s, _) = Env::json(e.staff(M::POST, &format!("/v1/support/admin/conversations/{conv}/messages"), "9", "viewer").json(&json!({"body": "hi"}))).await;
    assert_eq!(s, 403);

    // 3. internal note is never shown to the client; the reply is, live
    let (s, _) = Env::json(e.staff(M::POST, &format!("/v1/support/admin/conversations/{conv}/messages"), "7", "support").json(&json!({"body": "checking KYC queue", "note": true}))).await;
    assert_eq!(s, 200);
    let (s, v) = Env::json(e.staff(M::POST, &format!("/v1/support/admin/conversations/{conv}/messages"), "7", "support").json(&json!({"body": "Hi Ana, Mei here. Your documents are in review."}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["conversation"]["status"], "assigned");
    assert!(v["conversation"]["firstResponseAt"].is_string());
    loop {
        let m = next_of(&mut client_ws, "message").await;
        assert_ne!(m["message"]["author"], "note", "notes must not reach the client");
        if m["message"]["author"] == "agent" {
            assert!(m["message"]["body"].as_str().unwrap().contains("Mei here"));
            break;
        }
    }
    let (_, me) = Env::json(e.user(M::GET, "/v1/support/me", 42)).await;
    assert!(me["messages"].as_array().unwrap().iter().all(|m| m["author"] != "note"));
    let (_, inbox) = Env::json(e.user(M::GET, "/v1/notifications/me", 42)).await;
    assert!(inbox["items"].as_array().unwrap().iter().any(|i| i["type"] == "support.reply"), "{inbox}");

    // 4. resolve + CSAT
    let (s, _) = Env::json(e.user(M::POST, &format!("/v1/support/me/conversations/{conv}/rate"), 42).json(&json!({"rating": 5}))).await;
    assert_eq!(s, 409, "rating before the chat ends");
    let (s, _) = Env::json(e.staff(M::POST, &format!("/v1/support/admin/conversations/{conv}/resolve"), "7", "support")).await;
    assert_eq!(s, 200);
    let (s, v) = Env::json(e.user(M::POST, &format!("/v1/support/me/conversations/{conv}/rate"), 42).json(&json!({"rating": 5, "comment": "Fast and kind"}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["conversation"]["csat"]["rating"], 5);
    let (_, stats) = Env::json(e.staff(M::GET, "/v1/support/admin/stats?days=7", "7", "support")).await;
    assert_eq!(stats["period"]["csatAvg"], 5.0);
    assert_eq!(stats["period"]["handedOver"], 1);
    assert_eq!(stats["period"]["slaMetPct"], 100.0);
    assert_eq!(stats["agents"][0]["id"], "7");

    // another client cannot see the conversation
    let (s, _) = Env::json(e.user(M::GET, &format!("/v1/support/me/conversations/{conv}"), 43)).await;
    assert_eq!(s, 404);
    // audit trail of staff actions
    let (_, audit) = Env::json(e.staff(M::GET, "/v1/support/admin/audit", "7", "support")).await;
    let actions: Vec<&str> = audit["items"].as_array().unwrap().iter().map(|a| a["action"].as_str().unwrap()).collect();
    assert!(actions.contains(&"conversation.resolve") && actions.contains(&"conversation.assign") && actions.contains(&"conversation.handover"), "{actions:?}");
    e.drop().await;
}

#[tokio::test]
async fn notify_ingestion_prefs_dedupe_and_live_push() {
    let Some(e) = env().await else { return };
    // internal token is required
    let r = e.http.post(format!("{}/v1/notify", e.base)).json(&json!({})).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 403);
    let mut ws = e.ws(e.user(M::POST, "/v1/stream/ticket", 42)).await;
    next_of(&mut ws, "hello").await;
    let body = json!({"type": "wallet.deposit_credited", "userId": 42, "title": "Deposit credited", "body": "100.00 USDT was credited to your wallet.", "link": "/wallet/history", "severity": "success", "dedupeKey": "dep:1", "emailTo": "ana@example.com"});
    let (s, v) = Env::json(e.http.post(format!("{}/v1/notify", e.base)).header("x-kalks-internal", TOKEN).header("x-kalks-service", "wallet").json(&body)).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["results"][0]["duplicate"], false);
    assert_eq!(v["results"][0]["emailed"], true, "wallet emails are on by default");
    let n = next_of(&mut ws, "notification").await;
    assert_eq!(n["item"]["title"], "Deposit credited");
    assert_eq!(n["item"]["category"], "wallet");
    assert_eq!(n["unread"], 1);
    // same dedupe key = no second notification
    let (_, v) = Env::json(e.http.post(format!("{}/v1/notify", e.base)).header("x-kalks-internal", TOKEN).json(&body)).await;
    assert_eq!(v["results"][0]["duplicate"], true);
    // outbox holds exactly one email
    let queued: i64 = sqlx::query_scalar("SELECT count(*) FROM email_outbox WHERE to_addr = 'ana@example.com'").fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(queued, 1);
    assert_eq!(support::notify::flush_outbox(&e.st).await.unwrap(), 1);
    let status: String = sqlx::query_scalar("SELECT status FROM email_outbox LIMIT 1").fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(status, "logged");

    // preferences: wallet email off, trading fills in-app off; security stays locked on
    let (s, p) = Env::json(e.user(M::PUT, "/v1/notifications/me/prefs", 42).json(&json!({"prefs": {"wallet": {"email": false}, "trading_fills": {"inApp": false}, "security": {"inApp": false, "email": false}}}))).await;
    assert_eq!(s, 200);
    assert_eq!(p["prefs"]["wallet"]["email"], false);
    assert_eq!(p["prefs"]["security"]["email"], true);
    let (_, v) = Env::json(e.http.post(format!("{}/v1/notify", e.base)).header("x-kalks-internal", TOKEN).json(&json!({"type": "wallet.withdrawal_approved", "userId": 42, "title": "Withdrawal approved", "emailTo": "ana@example.com"}))).await;
    assert_eq!(v["results"][0]["emailed"], false);
    let (_, v) = Env::json(e.http.post(format!("{}/v1/notify", e.base)).header("x-kalks-internal", TOKEN).json(&json!({"type": "trading.tp", "userId": 42, "title": "Take profit hit: EURUSD"}))).await;
    assert_eq!(v["results"][0]["inApp"], false);
    let (_, list) = Env::json(e.user(M::GET, "/v1/notifications/me", 42)).await;
    let titles: Vec<&str> = list["items"].as_array().unwrap().iter().map(|i| i["title"].as_str().unwrap()).collect();
    assert_eq!(titles, vec!["Withdrawal approved", "Deposit credited"]);
    assert_eq!(list["unread"], 2);
    let id = list["items"][1]["id"].as_i64().unwrap();
    let (_, r) = Env::json(e.user(M::POST, "/v1/notifications/me/read", 42).json(&json!({"ids": [id]}))).await;
    assert_eq!(r["unread"], 1);
    // another client's inbox is separate
    let (_, other) = Env::json(e.user(M::GET, "/v1/notifications/me", 43)).await;
    assert_eq!(other["items"].as_array().unwrap().len(), 0);
    // validation
    let (s, _) = Env::json(e.http.post(format!("{}/v1/notify", e.base)).header("x-kalks-internal", TOKEN).json(&json!({"type": "Bad Type", "userId": 1, "title": "x"}))).await;
    assert_eq!(s, 422);
    let (s, _) = Env::json(e.http.post(format!("{}/v1/notify", e.base)).header("x-kalks-internal", TOKEN).json(&json!({"type": "system.x", "userId": 1, "title": "x", "link": "javascript:alert(1)"}))).await;
    assert_eq!(s, 422);
    e.drop().await;
}

#[tokio::test]
async fn attachments_are_typed_sized_and_private() {
    let Some(e) = env().await else { return };
    let png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
    let (s, v) = Env::json(e.user(M::POST, "/v1/support/me/attachments", 42).header("x-file-name", "screen%20shot.png").body(png.clone())).await;
    assert_eq!(s, 200, "{v}");
    let att = v["attachment"]["id"].as_i64().unwrap();
    assert_eq!(v["attachment"]["mime"], "image/png");
    let (s, _) = Env::json(e.user(M::POST, "/v1/support/me/attachments", 42).header("x-file-name", "x.html").body("<html><script>alert(1)</script>")).await;
    assert_eq!(s, 415);
    let (s, _) = Env::json(e.user(M::POST, "/v1/support/me/attachments", 42).body(vec![0x25u8; 3 * 1024 * 1024])).await;
    assert!(s == 413 || s == 400, "{s}");
    // another client can neither attach nor read it
    let (s, _) = Env::json(e.user(M::POST, "/v1/support/me/messages", 43).json(&json!({"body": "", "attachmentId": att}))).await;
    assert_eq!(s, 422);
    let r = e.user(M::GET, &format!("/v1/support/me/attachments/{att}"), 43).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 404);
    // the owner attaches it; staff can open it
    let (s, v) = Env::json(e.user(M::POST, "/v1/support/me/messages", 42).json(&json!({"body": "here is the screenshot", "attachmentId": att}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["message"]["attachment"]["name"], "screen shot.png");
    let r = e.staff(M::GET, &format!("/v1/support/admin/attachments/{att}"), "7", "support").send().await.unwrap();
    assert_eq!(r.status().as_u16(), 200);
    assert_eq!(r.headers()["content-type"], "image/png");
    assert_eq!(r.headers()["x-content-type-options"], "nosniff");
    assert_eq!(r.bytes().await.unwrap().to_vec(), png);
    e.drop().await;
}

#[tokio::test]
async fn knowledge_base_canned_and_settings() {
    let Some(e) = env().await else { return };
    let (_, kbl) = Env::json(e.staff(M::GET, "/v1/support/admin/kb", "7", "support")).await;
    assert!(kbl["totals"]["published"].as_i64().unwrap() > 100, "help articles + glossary seeded");
    let (s, a) = Env::json(e.staff(M::POST, "/v1/support/admin/kb", "7", "support").json(&json!({"title": "Binance Pay withdrawals", "category": "Deposits and withdrawals", "body": "Withdrawals to a Binance Pay ID are not supported. Use a USDT address on TRON or BNB Chain.", "tags": ["binance pay"]}))).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(a["item"]["slug"], "binance-pay-withdrawals");
    let (_, t) = Env::json(e.staff(M::POST, "/v1/support/admin/kb/test", "7", "support").json(&json!({"question": "Can I withdraw to Binance Pay?"}))).await;
    assert_eq!(t["hits"][0]["slug"], "binance-pay-withdrawals", "{t}");
    // viewers can't edit
    let (s, _) = Env::json(e.staff(M::PUT, &format!("/v1/support/admin/kb/{}", a["item"]["id"]), "9", "viewer").json(&json!({"title": "x", "category": "y", "body": "zzzzzzzzzzzzzzzzzzzzzzzz"}))).await;
    assert_eq!(s, 403);
    let (_, c) = Env::json(e.staff(M::GET, "/v1/support/admin/canned", "7", "support")).await;
    assert!(c["items"].as_array().unwrap().iter().any(|x| x["shortcut"] == "/hi"));
    let (s, _) = Env::json(e.staff(M::POST, "/v1/support/admin/canned", "7", "support").json(&json!({"shortcut": "/hi", "title": "dup", "body": "dup"}))).await;
    assert_eq!(s, 422);
    // autopilot off: new chats go straight to the queue
    let (s, _) = Env::json(e.staff(M::PUT, "/v1/support/admin/settings", "7", "admin").json(&json!({"autopilot": false, "slaFirstSecs": 120}))).await;
    assert_eq!(s, 200);
    let (_, v) = Env::json(e.user(M::POST, "/v1/support/me/messages", 50).json(&json!({"body": "hello"}))).await;
    assert_eq!(v["conversation"]["status"], "waiting");
    // broadcasts need notifications.write (marketing may, support may not)
    let (s, _) = Env::json(e.staff(M::GET, "/v1/notifications/admin/broadcasts", "7", "support")).await;
    assert_eq!(s, 403);
    let (s, _) = Env::json(e.staff(M::GET, "/v1/notifications/admin/broadcasts", "8", "marketing")).await;
    assert_eq!(s, 200);
    // BFF-resolved permissions win over the role list
    let (s, _) = Env::json(e.staff(M::GET, "/v1/notifications/admin/broadcasts", "7", "support").header("x-kalks-staff-perms", "support.read,notifications.write")).await;
    assert_eq!(s, 200);
    e.drop().await;
}

/* ---------------- mobile push (a stub Expo push service) ---------------- */

#[derive(Default)]
struct ExpoStub {
    /// every request: ("send" | "getReceipts", body)
    calls: Vec<(String, Value)>,
    /// whole-request answers used first (HTTP status), e.g. 503 = outage
    outages: std::collections::VecDeque<u16>,
    /// tokens whose ticket says DeviceNotRegistered
    dead: std::collections::HashSet<String>,
    /// a request with one of these tokens is refused as a whole (400)
    poison: std::collections::HashSet<String>,
    /// receipt per token (default ok)
    receipts: std::collections::HashMap<String, Value>,
    tickets: std::collections::HashMap<String, String>,
    seq: usize,
}

type Stub = std::sync::Arc<std::sync::Mutex<ExpoStub>>;

async fn stub_send(axum::extract::State(stub): axum::extract::State<Stub>, axum::Json(body): axum::Json<Value>) -> (axum::http::StatusCode, axum::Json<Value>) {
    let mut s = stub.lock().unwrap();
    s.calls.push(("send".into(), body.clone()));
    if let Some(code) = s.outages.pop_front() {
        return (axum::http::StatusCode::from_u16(code).unwrap(), axum::Json(json!({"errors": [{"code": "UNAVAILABLE", "message": "try again later"}]})));
    }
    let msgs = body.as_array().cloned().unwrap_or_default();
    if msgs.iter().any(|m| s.poison.contains(m["to"].as_str().unwrap_or(""))) {
        return (axum::http::StatusCode::BAD_REQUEST, axum::Json(json!({"errors": [{"code": "VALIDATION_ERROR", "message": "\"sound\" must be a string"}]})));
    }
    let mut data = vec![];
    for m in &msgs {
        let to = m["to"].as_str().unwrap_or("").to_string();
        if s.dead.contains(&to) {
            data.push(json!({"status": "error", "message": format!("\"{to}\" is not a registered push notification recipient"), "details": {"error": "DeviceNotRegistered"}}));
            continue;
        }
        s.seq += 1;
        let id = format!("ticket-{}", s.seq);
        s.tickets.insert(id.clone(), to);
        data.push(json!({"status": "ok", "id": id}));
    }
    (axum::http::StatusCode::OK, axum::Json(json!({ "data": data })))
}

async fn stub_receipts(axum::extract::State(stub): axum::extract::State<Stub>, axum::Json(body): axum::Json<Value>) -> axum::Json<Value> {
    let mut s = stub.lock().unwrap();
    s.calls.push(("getReceipts".into(), body.clone()));
    let mut data = serde_json::Map::new();
    for id in body["ids"].as_array().into_iter().flatten().filter_map(Value::as_str) {
        if let Some(to) = s.tickets.get(id) {
            data.insert(id.to_string(), s.receipts.get(to).cloned().unwrap_or(json!({"status": "ok"})));
        }
    }
    axum::Json(json!({ "data": data }))
}

async fn expo_stub() -> (String, Stub) {
    let stub: Stub = Default::default();
    let app = axum::Router::new().route("/send", axum::routing::post(stub_send)).route("/getReceipts", axum::routing::post(stub_receipts)).with_state(stub.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (base, stub)
}

impl Env {
    fn phone(&self, uid: i64, token: &str, device: &str, platform: &str) -> reqwest::RequestBuilder {
        self.user(M::POST, "/v1/push/tokens", uid).json(&json!({"token": token, "deviceId": device, "platform": platform, "locale": "pt-BR", "appVersion": "1.0.0"}))
    }

    async fn notify(&self, body: Value) -> Value {
        let (s, v) = Env::json(self.http.post(format!("{}/v1/notify", self.base)).header("x-kalks-internal", TOKEN).header("x-kalks-service", "test").json(&body)).await;
        assert_eq!(s, 200, "{v}");
        v["results"][0].clone()
    }

    /// push_outbox rows of a token: (status, attempts, receipt, ticket_id, last_error)
    async fn pushes(&self, token: &str) -> Vec<(String, i32, Option<String>, Option<String>, Option<String>)> {
        sqlx::query_as("SELECT status, attempts, receipt, ticket_id, last_error FROM push_outbox WHERE token = $1 ORDER BY id").bind(token).fetch_all(&self.st.pool).await.unwrap()
    }

    async fn has_token(&self, token: &str) -> Option<i64> {
        sqlx::query_scalar("SELECT user_id FROM push_tokens WHERE token = $1").bind(token).fetch_optional(&self.st.pool).await.unwrap()
    }
}

#[tokio::test]
async fn mobile_push_registry_queue_tickets_receipts_and_dead_tokens() {
    let (expo, stub) = expo_stub().await;
    let Some(e) = env_with(|c| {
        c.push_enabled = true;
        c.expo_push_url = expo.clone();
        c.push_receipt_delay_secs = 0;
    })
    .await
    else {
        return;
    };
    const IOS: &str = "ExponentPushToken[iosiosiosiosiosiosios1]";
    const ANDROID: &str = "ExponentPushToken[androidandroidandroid1]";
    const OTHER: &str = "ExponentPushToken[otherotherotherother01]";
    let dev = |c: char| c.to_string().repeat(24);
    let sends = |s: &Stub| s.lock().unwrap().calls.iter().filter(|c| c.0 == "send").count();

    // validation: Expo tokens only, an installation id, the iOS / Android app only; a caller identity is required
    for (token, device, platform) in [("not-a-token", dev('a'), "ios"), (IOS, "short".to_string(), "ios"), (IOS, dev('a'), "web")] {
        let (s, v) = Env::json(e.phone(42, token, &device, platform)).await;
        assert_eq!(s, 422, "{v}");
    }
    let (s, _) = Env::json(e.http.post(format!("{}/v1/push/tokens", e.base)).header("x-kalks-internal", TOKEN).json(&json!({"token": IOS, "deviceId": dev('a'), "platform": "ios"}))).await;
    assert_eq!(s, 401);

    // two phones for client 42, one for client 43
    for (uid, token, d, p) in [(42, IOS, dev('a'), "ios"), (42, ANDROID, dev('b'), "android"), (43, OTHER, dev('c'), "ios")] {
        let (s, v) = Env::json(e.phone(uid, token, &d, p)).await;
        assert_eq!(s, 200, "{v}");
        assert_eq!(v["enabled"], true);
    }
    let locale: String = sqlx::query_scalar("SELECT locale FROM push_tokens WHERE token = $1").bind(IOS).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(locale, "pt-BR");

    // a deposit for 42 goes to both phones in one request; the Android app was uninstalled since
    stub.lock().unwrap().dead.insert(ANDROID.into());
    let r = e.notify(json!({"type": "wallet.deposit_credited", "userId": 42, "title": "Deposit credited", "body": "100.00 USDT was credited to your wallet.", "link": "/wallet/history", "severity": "success", "emailTo": "ana@example.com", "dedupeKey": "dep:push:1"})).await;
    assert_eq!(r["pushed"], 2);
    let note = r["id"].as_i64().unwrap();
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 2);
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 0, "nothing else due");
    {
        let s = stub.lock().unwrap();
        let batch = s.calls[0].1.as_array().unwrap();
        assert_eq!(batch.len(), 2);
        let ios = batch.iter().find(|m| m["to"] == IOS).expect("message for the iPhone");
        assert_eq!(ios["title"], "Deposit credited");
        assert_eq!(ios["body"], "100.00 USDT was credited to your wallet.");
        assert_eq!(ios["data"], json!({"id": note, "type": "wallet.deposit_credited", "link": "/wallet/history", "uid": 42}));
        assert_eq!(ios["badge"], 1);
        assert_eq!(ios["channelId"], "activity");
        assert_eq!(ios["sound"], "default");
    }
    let p = e.pushes(IOS).await;
    assert_eq!((p[0].0.as_str(), p[0].1, p[0].3.is_some()), ("sent", 1, true));
    assert_eq!(e.pushes(ANDROID).await[0].0, "dropped");
    assert_eq!(e.has_token(ANDROID).await, None, "DeviceNotRegistered removes the phone");
    // the delivery receipt comes back fine
    assert_eq!(support::push::receipts(&e.st).await.unwrap(), 1);
    assert_eq!(e.pushes(IOS).await[0].2.as_deref(), Some("ok"));
    assert_eq!(support::push::receipts(&e.st).await.unwrap(), 0);

    // preferences: News and offers is opt-in; in-app off or push off means no push
    let (_, p) = Env::json(e.user(M::GET, "/v1/notifications/me/prefs", 42)).await;
    assert_eq!(p["prefs"]["marketing"]["push"], false);
    assert_eq!(p["prefs"]["wallet"]["push"], true);
    assert!(p["catalog"].as_array().unwrap().iter().any(|c| c["key"] == "marketing" && c["defaults"]["push"] == false));
    assert_eq!(e.notify(json!({"type": "marketing.promo", "userId": 42, "title": "Double cashback week"})).await["pushed"], 0);
    let (s, p) = Env::json(e.user(M::PUT, "/v1/notifications/me/prefs", 42).json(&json!({"prefs": {"marketing": {"push": true}, "trading_fills": {"inApp": false}, "kyc": {"push": false}, "security": {"push": false}}}))).await;
    assert_eq!(s, 200);
    assert_eq!(p["prefs"]["security"]["push"], true, "security stays on");
    assert_eq!(e.notify(json!({"type": "marketing.promo", "userId": 42, "title": "Double cashback week", "dedupeKey": "m2"})).await["pushed"], 1);
    assert_eq!(e.notify(json!({"type": "trading.tp", "userId": 42, "title": "Take profit hit: EURUSD"})).await["pushed"], 0);
    let r = e.notify(json!({"type": "kyc.verified", "userId": 42, "title": "Your identity is verified"})).await;
    assert_eq!((r["inApp"].as_bool(), r["pushed"].as_i64()), (Some(true), Some(0)));
    assert_eq!(e.notify(json!({"type": "security.new_device", "userId": 42, "title": "New sign-in"})).await["pushed"], 1);
    // staff never get phone pushes
    assert_eq!(e.notify(json!({"type": "support.waiting", "staffId": "7", "title": "A client is waiting"})).await["pushed"], 0);
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 2);
    let sent: Vec<String> = e.pushes(IOS).await.iter().map(|x| x.0.clone()).collect();
    assert_eq!(sent, vec!["sent", "sent", "sent"]);

    // outage: retried with backoff, then sent
    stub.lock().unwrap().outages.push_back(503);
    assert_eq!(e.notify(json!({"type": "prop.passed", "userId": 43, "title": "Phase 1 passed"})).await["pushed"], 1);
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 1);
    let p = e.pushes(OTHER).await;
    assert_eq!((p[0].0.as_str(), p[0].1), ("pending", 1));
    assert!(p[0].4.as_deref().unwrap().contains("503"), "{:?}", p[0].4);
    let wait: f64 = sqlx::query_scalar("SELECT EXTRACT(EPOCH FROM next_attempt_at - now())::float8 FROM push_outbox WHERE token = $1").bind(OTHER).fetch_one(&e.st.pool).await.unwrap();
    assert!((5.0..=16.0).contains(&wait), "first retry after ~15 s, got {wait}");
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 0, "not due yet");
    sqlx::query("UPDATE push_outbox SET next_attempt_at = now() WHERE token = $1").bind(OTHER).execute(&e.st.pool).await.unwrap();
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 1);
    assert_eq!(e.pushes(OTHER).await[0].0, "sent");

    // a request refused as a whole is split: the good message still goes out, the bad one fails alone
    const GOOD: &str = "ExponentPushToken[goodgoodgoodgoodgood01]";
    const BAD: &str = "ExponentPushToken[badbadbadbadbadbadbad1]";
    for (t, d) in [(GOOD, dev('d')), (BAD, dev('f'))] {
        assert_eq!(Env::json(e.phone(44, t, &d, "android")).await.0, 200);
    }
    stub.lock().unwrap().poison.insert(BAD.into());
    let before = sends(&stub);
    assert_eq!(e.notify(json!({"type": "copy.fee", "userId": 44, "title": "Performance fee charged"})).await["pushed"], 2);
    assert_eq!(support::push::flush(&e.st).await.unwrap(), 2);
    assert_eq!(sends(&stub) - before, 3, "one batch, then one request per message");
    assert_eq!(e.pushes(GOOD).await[0].0, "sent");
    assert_eq!(e.pushes(BAD).await[0].0, "failed");
    // receipts: the good phone was uninstalled after all; a throttled one is sent again later
    stub.lock().unwrap().receipts.insert(GOOD.into(), json!({"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}}));
    stub.lock().unwrap().receipts.insert(OTHER.into(), json!({"status": "error", "message": "slow down", "details": {"error": "MessageRateExceeded"}}));
    assert!(support::push::receipts(&e.st).await.unwrap() >= 2);
    assert_eq!(e.pushes(GOOD).await[0].2.as_deref(), Some("DeviceNotRegistered"));
    assert_eq!(e.has_token(GOOD).await, None);
    let p = e.pushes(OTHER).await;
    // attempts: the outage, the send, and now the throttled delivery
    assert_eq!((p[0].0.as_str(), p[0].1, p[0].3.clone()), ("pending", 3, None), "requeued after MessageRateExceeded");

    // the phone changes hands: 45 signs in on 43's phone; pushes still queued for 43 never reach 45
    stub.lock().unwrap().receipts.clear();
    assert_eq!(Env::json(e.phone(45, OTHER, &dev('c'), "ios")).await.0, 200);
    assert_eq!(e.has_token(OTHER).await, Some(45));
    assert_eq!(e.pushes(OTHER).await[0].0, "dropped");
    // a reinstall on the same phone replaces its old token
    const IOS2: &str = "ExponentPushToken[iosiosiosiosiosiosios2]";
    assert_eq!(Env::json(e.phone(42, IOS2, &dev('a'), "ios")).await.0, 200);
    assert_eq!(e.has_token(IOS).await, None);
    assert_eq!(e.has_token(IOS2).await, Some(42));

    // sign-out on the phone: only the owner can remove the row with the session...
    let (_, v) = Env::json(e.user(M::POST, "/v1/push/tokens/delete", 46).json(&json!({"token": IOS2}))).await;
    assert_eq!(v["removed"], 0);
    let (_, v) = Env::json(e.user(M::POST, "/v1/push/tokens/delete", 45).json(&json!({"token": OTHER}))).await;
    assert_eq!(v["removed"], 1);
    // ...and without one (session already ended) only with the phone's installation id
    let forget = |token: &str, device: String| e.http.post(format!("{}/v1/push/tokens/forget", e.base)).header("x-kalks-internal", TOKEN).json(&json!({"token": token, "deviceId": device}));
    let (_, v) = Env::json(forget(IOS2, dev('z'))).await;
    assert_eq!(v["removed"], 0);
    let (s, _) = Env::json(forget(IOS2, "x".into())).await;
    assert_eq!(s, 422);
    let (_, v) = Env::json(forget(IOS2, dev('a'))).await;
    assert_eq!(v["removed"], 1);
    assert_eq!(e.notify(json!({"type": "wallet.withdrawal_approved", "userId": 42, "title": "Withdrawal approved"})).await["pushed"], 0, "no phones left");
    // the internal token is required for the service route
    let r = e.http.post(format!("{}/v1/push/tokens/forget", e.base)).json(&json!({"token": IOS2, "deviceId": dev('a')})).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 403);

    // clean-up: stale phones and day-old pending messages
    assert_eq!(Env::json(e.phone(47, IOS, &dev('g'), "ios")).await.0, 200);
    sqlx::query("UPDATE push_tokens SET last_seen_at = now() - interval '91 days' WHERE token = $1").bind(IOS).execute(&e.st.pool).await.unwrap();
    assert_eq!(e.notify(json!({"type": "wallet.credit", "userId": 47, "title": "Bonus credited"})).await["pushed"], 0, "stale phones get no pushes");
    sqlx::query("UPDATE push_outbox SET created_at = now() - interval '2 days' WHERE token = $1").bind(OTHER).execute(&e.st.pool).await.unwrap();
    support::push::sweep(&e.st).await.unwrap();
    assert_eq!(e.has_token(IOS).await, None);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM push_outbox WHERE status = 'pending'").fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(left, 0);
    e.drop().await;
}

#[tokio::test]
async fn revoked_sessions_remove_their_phones() {
    let (expo, _stub) = expo_stub().await;
    let Some(e) = env_with(|c| {
        c.push_enabled = true;
        c.expo_push_url = expo.clone();
    })
    .await
    else {
        return;
    };
    const A: &str = "ExponentPushToken[revokeaaaaaaaaaaaaaaa1]";
    const B: &str = "ExponentPushToken[revokebbbbbbbbbbbbbbb1]";
    const C: &str = "ExponentPushToken[revokeccccccccccccccc1]";
    const D: &str = "ExponentPushToken[revokeddddddddddddddd1]";
    let dev = |c: char| c.to_string().repeat(24);
    let dref = |c: char| support::push::device_ref(&c.to_string().repeat(24));
    let now = || chrono::Utc::now().to_rfc3339();
    // client 42 has two phones (a, b), client 43 one (c); client 42 of another broker has phone d
    assert_eq!(Env::json(e.phone(42, A, &dev('a'), "ios")).await.0, 200);
    assert_eq!(Env::json(e.phone(42, B, &dev('b'), "android")).await.0, 200);
    assert_eq!(Env::json(e.phone(43, C, &dev('c'), "ios")).await.0, 200);
    let (s, v) = Env::json(e.user(M::POST, "/v1/push/tokens", 42).header("x-kalks-tenant", "acme").json(&json!({"token": D, "deviceId": dev('d'), "platform": "ios"}))).await;
    assert_eq!(s, 200, "{v}");
    // a push is queued for both of 42's phones
    assert_eq!(e.notify(json!({"type": "wallet.credit", "userId": 42, "title": "Bonus credited"})).await["pushed"], 2);
    let revoke = |body: Value| e.http.post(format!("{}/v1/push/tokens/revoke", e.base)).header("x-kalks-internal", TOKEN).json(&body);

    // a service route: the internal token is required; the body is checked
    let r = e.http.post(format!("{}/v1/push/tokens/revoke", e.base)).json(&json!({"tenant": "kalks", "userId": 42, "all": true, "before": now()})).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 403);
    for (body, field) in [
        (json!({"userId": 42, "all": true, "before": now()}), "tenant"),
        (json!({"tenant": "kalks", "userId": 42, "all": true}), "before"),
        (json!({"tenant": "kalks", "userId": 42, "devices": ["not-a-reference"], "before": now()}), "devices"),
        (json!({"tenant": "kalks", "userId": -1, "all": true, "before": now()}), "userId"),
        (json!({"tenant": "kalks", "devices": [dref('a')], "before": now()}), "userId"),
    ] {
        let (s, v) = Env::json(revoke(body)).await;
        assert_eq!((s, v["error"]["field"].as_str()), (422, Some(field)), "{v}");
    }
    assert_eq!(e.has_token(A).await, Some(42));

    // one of 42's sessions ended (sign out other devices, a staff revoke): phone a goes with its queued push
    let (s, v) = Env::json(revoke(json!({"tenant": "kalks", "userId": 42, "devices": [dref('a'), dref('z')], "before": now()}))).await;
    assert_eq!((s, v["removed"].as_u64()), (200, Some(1)), "{v}");
    assert_eq!(e.has_token(A).await, None);
    assert_eq!(e.has_token(B).await, Some(42));
    assert_eq!(e.pushes(A).await[0].0, "dropped");
    assert_eq!(e.pushes(B).await[0].0, "pending");
    // another client's phone is never matched by 42's revocation
    let (_, v) = Env::json(revoke(json!({"tenant": "kalks", "userId": 42, "devices": [dref('c')], "before": now()}))).await;
    assert_eq!(v["removed"], 0);
    assert_eq!(e.has_token(C).await, Some(43));

    // a phone registered again after the revocation keeps its registration
    let earlier = (chrono::Utc::now() - chrono::Duration::seconds(60)).to_rfc3339();
    let (_, v) = Env::json(revoke(json!({"tenant": "kalks", "userId": 42, "all": true, "before": earlier}))).await;
    assert_eq!(v["removed"], 0);
    // a revocation "in the future" counts as now
    assert_eq!(Env::json(e.phone(42, A, &dev('a'), "ios")).await.0, 200);
    let (_, v) = Env::json(revoke(json!({"tenant": "kalks", "userId": 42, "all": true, "before": (chrono::Utc::now() + chrono::Duration::days(1)).to_rfc3339()}))).await;
    // signed out everywhere: every phone of 42 at this broker, never the other broker's
    assert_eq!(v["removed"], 2);
    assert_eq!((e.has_token(A).await, e.has_token(B).await), (None, None));
    assert_eq!(e.has_token(D).await, Some(42));
    assert_eq!(e.notify(json!({"type": "wallet.credit", "userId": 42, "title": "Bonus credited", "dedupeKey": "after"})).await["pushed"], 0);

    // the broker was suspended: every phone of its clients
    let (_, v) = Env::json(revoke(json!({"tenant": "kalks", "all": true, "before": now()}))).await;
    assert_eq!(v["removed"], 1);
    assert_eq!(e.has_token(C).await, None);
    assert_eq!(e.has_token(D).await, Some(42), "another broker");
    e.drop().await;
}
