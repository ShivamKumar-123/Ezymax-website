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
