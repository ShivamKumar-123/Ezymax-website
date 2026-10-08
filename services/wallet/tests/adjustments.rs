//! Back Office "Balance & credit" (manual adjustments) against PostgreSQL through the real HTTP router, with a
//! mock engine for trading accounts. Throw-away database per test (skipped when PostgreSQL is not reachable).
//! Covers: ledger balance after each operation, over-deduction refusal, idempotency (double submit books once),
//! credit take-back limits, free-margin refusal and force, four-eyes (pending → second staff approves), reject /
//! cancel, permissions (403) and engine-timeout recovery.

use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use wallet::chain::mock::MockChain;
use wallet::chain::{Chain, ChainId};
use wallet::config::Config;
use wallet::engine::MockEngine;
use wallet::state::{AppState, Tenants};
use wallet::users::MockUsers;
use wallet::{db, ledger};

const FINANCE: &str = "finance.read,finance.write,finance.adjust,finance.credit,finance.adjust_approve";
const SUPER: &str = "finance.read,finance.write,finance.adjust,finance.credit,finance.adjust_approve,finance.adjust_force,finance.settings";

struct T {
    st: AppState,
    base: String,
    http: reqwest::Client,
    engine: Arc<MockEngine>,
    admin: PgConnectOptions,
    name: String,
}

impl T {
    async fn new(what: &str) -> Option<Self> {
        let base = std::env::var("WALLET_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
        let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
        if admin.connect().await.is_err() {
            eprintln!("skipping {what}: no PostgreSQL at {base}");
            return None;
        }
        let mut b = [0u8; 5];
        getrandom::fill(&mut b).unwrap();
        let name = format!("ezymex_wallet_test_{}", b.iter().map(|x| format!("{x:02x}")).collect::<String>());
        let url = admin.clone().database(&name).to_url_lossy().to_string();
        let pool = db::connect(&url).await.expect("create + migrate test db");
        let cfg = Config::for_tests(&url);
        wallet::settings::seed(&pool, &cfg).await.unwrap();
        let mut chains: HashMap<ChainId, Arc<dyn Chain>> = HashMap::new();
        chains.insert(ChainId::Tron, Arc::new(MockChain::new(ChainId::Tron)));
        let engine = Arc::new(MockEngine::default().with_account(7, 10000001, "live").with_account(7, 50000001, "demo").with_account(8, 10000002, "live"));
        let st = AppState {
            tenants: Tenants::load(&pool).await.unwrap(),
            pool,
            cfg: Arc::new(cfg),
            chains: Arc::new(chains),
            engine: engine.clone(),
            users: Arc::new(MockUsers::default()),
            transfer_lock: Default::default(),
        };
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let app = wallet::api::router(st.clone());
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Some(T { st, base: base_url, http: reqwest::Client::new(), engine, admin, name })
    }

    /// Staff call: id, service role and the forwarded gateway permission list.
    async fn as_staff(&self, id: &str, role: &str, perms: &str, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
        let mut rb = match method {
            "GET" => self.http.get(format!("{}{path}", self.base)),
            "PUT" => self.http.put(format!("{}{path}", self.base)),
            _ => self.http.post(format!("{}{path}", self.base)),
        };
        rb = rb
            .header("x-ezymex-internal", "test-internal-token")
            .header("x-ezymex-staff-id", id)
            .header("x-ezymex-staff-name", format!("Staff%20{id}"))
            .header("x-ezymex-staff-role", role)
            .header("x-ezymex-staff-perms", perms);
        if let Some(b) = body {
            rb = rb.json(&b);
        }
        let r = rb.send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }
    async fn fin(&self, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
        self.as_staff("5", "finance", FINANCE, method, path, body).await
    }
    async fn adjust(&self, body: Value) -> (u16, Value) {
        self.fin("POST", "/v1/admin/adjustments", Some(body)).await
    }
    async fn available(&self, user: i64) -> String {
        let (_, v) = self
            .http
            .get(format!("{}/v1/wallets/{user}", self.base))
            .header("x-ezymex-internal", "test-internal-token")
            .send()
            .await
            .unwrap()
            .json::<Value>()
            .await
            .map(|v| (0, v))
            .unwrap();
        v["balances"][0]["available"].as_str().unwrap().to_string()
    }
    async fn count(&self, sql: &str) -> i64 {
        sqlx::query_scalar(sqlx::AssertSqlSafe(sql.to_string())).fetch_one(&self.st.pool).await.unwrap()
    }
    async fn invariants(&self) {
        let p = ledger::verify(&self.st.pool).await.unwrap();
        assert!(p.is_empty(), "ledger invariants: {p:?}");
    }
    async fn drop_db(self) {
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }
}

fn wallet_req(key: &str, op: &str, category: &str, amount: &str) -> Value {
    json!({"idempotency_key": key, "user_id": 42, "target": "wallet", "currency": "USDT", "op": op, "category": category, "amount": amount,
           "comment": "Desk ticket SUP-1", "client_note": "Compensation for the outage", "notify": true})
}

#[tokio::test]
async fn wallet_add_and_deduct_keep_the_ledger_balanced_and_book_once() {
    let Some(t) = T::new("wallet adjustments").await else { return };
    // add 100 (compensation), with a client notification
    let (s, v) = t.adjust(wallet_req("k-1", "add", "compensation", "100")).await;
    assert_eq!(s, 200, "{v}");
    let a = &v["adjustment"];
    assert_eq!((a["status"].as_str(), a["ledger_kind"].as_str(), a["replayed"].as_bool()), (Some("applied"), Some("adjustment_in"), Some(false)));
    assert_eq!((a["before"]["available"].as_str(), a["after"]["available"].as_str()), (Some("0"), Some("100")));
    assert_eq!(t.available(42).await, "100");
    t.invariants().await;
    // a double click (same key) returns the same adjustment and books nothing more
    let (s, again) = t.adjust(wallet_req("k-1", "add", "compensation", "100")).await;
    assert_eq!((s, again["adjustment"]["replayed"].as_bool(), &again["adjustment"]["id"]), (200, Some(true), &a["id"]));
    assert_eq!(t.available(42).await, "100");
    assert_eq!(t.count("SELECT count(*) FROM ledger_txns WHERE kind = 'adjustment_in'").await, 1);
    // the same key for a different request is a conflict
    let (s, v) = t.adjust(wallet_req("k-1", "add", "compensation", "101")).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("idempotency_conflict")));
    // client bell + email outbox row, with the statement note
    let (kind, body): (String, String) = sqlx::query_as("SELECT kind, body FROM notifications WHERE user_id = 42 ORDER BY id DESC LIMIT 1").fetch_one(&t.st.pool).await.unwrap();
    assert_eq!(kind, "adjustment.wallet_in");
    assert!(body.contains("100.00 USDT was added to your wallet.") && body.contains("Compensation for the outage"), "{body}");
    // deduct 30 (fee)
    let (s, v) = t.adjust(wallet_req("k-2", "deduct", "fee", "30")).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["adjustment"]["ledger_kind"], "adjustment_out");
    assert_eq!(t.available(42).await, "70");
    t.invariants().await;
    // over-deduction is refused, recorded in the audit, nothing booked
    let (s, v) = t.adjust(wallet_req("k-3", "deduct", "correction", "70.01")).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("insufficient_funds")), "{v}");
    assert!(v["error"]["message"].as_str().unwrap().contains("70"));
    assert_eq!(t.available(42).await, "70");
    assert_eq!(t.count("SELECT count(*) FROM audit_log WHERE action = 'adjustment.refused'").await, 1);
    // external deposit / withdrawal are distinct ledger kinds (the reports count them as real money)
    let (_, v) = t.adjust(wallet_req("k-4", "add", "deposit", "500")).await;
    assert_eq!(v["adjustment"]["ledger_kind"], "manual_deposit");
    let (_, v) = t.adjust(wallet_req("k-5", "deduct", "withdrawal", "200")).await;
    assert_eq!(v["adjustment"]["ledger_kind"], "manual_withdrawal");
    assert_eq!(t.available(42).await, "370");
    // the client's history shows them with the statement note
    let (_, act) = t.as_staff("5", "finance", FINANCE, "GET", "/v1/wallets/42/activity?type=other", None).await;
    let items = act["items"].as_array().unwrap();
    assert_eq!(items.len(), 4, "{act}");
    assert!(items.iter().all(|i| i["note"] == "Compensation for the outage"));
    // wrong shapes
    let mut credit = wallet_req("k-6", "credit_in", "bonus", "10");
    let (s, v) = t.adjust(credit.clone()).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("op")), "credit is for trading accounts only");
    credit["op"] = json!("add");
    credit["category"] = json!("withdrawal");
    let (s, _) = t.adjust(credit).await;
    assert_eq!(s, 422);
    let mut short = wallet_req("k-7", "add", "other", "1");
    short["comment"] = json!("x");
    assert_eq!(t.adjust(short).await.0, 422, "a comment is required");
    // every change is in the audit with before / after and the staff member
    assert_eq!(t.count("SELECT count(*) FROM audit_log WHERE action = 'adjustment.applied' AND actor_id = '5' AND before IS NOT NULL").await, 4);
    t.invariants().await;
    t.drop_db().await;
}

#[tokio::test]
async fn four_eyes_above_the_threshold() {
    let Some(t) = T::new("four eyes").await else { return };
    // only finance.settings may set the threshold
    let (s, _) = t.fin("PUT", "/v1/admin/adjustments/settings", Some(json!({"approval_threshold_usd": "500"}))).await;
    assert_eq!(s, 403);
    let (s, v) = t.as_staff("1", "super_admin", SUPER, "PUT", "/v1/admin/adjustments/settings", Some(json!({"approval_threshold_usd": "500"}))).await;
    assert_eq!((s, v["approval_threshold_usd"].as_str()), (200, Some("500")), "{v}");
    // at the threshold: applies at once; above: pending, nothing booked
    let (_, v) = t.adjust(wallet_req("f-1", "add", "compensation", "500")).await;
    assert_eq!(v["adjustment"]["status"], "applied");
    let (s, v) = t.adjust(wallet_req("f-2", "add", "compensation", "1000")).await;
    assert_eq!((s, v["adjustment"]["status"].as_str()), (200, Some("pending")), "{v}");
    let id = v["adjustment"]["id"].as_i64().unwrap();
    assert_eq!(t.available(42).await, "500");
    // the requester can't approve their own request
    let (s, v) = t.fin("POST", &format!("/v1/admin/adjustments/{id}/approve"), Some(json!({}))).await;
    assert_eq!(s, 403, "{v}");
    // staff without finance.adjust_approve: 403
    let (s, _) = t.as_staff("9", "finance", "finance.read,finance.adjust", "POST", &format!("/v1/admin/adjustments/{id}/approve"), Some(json!({}))).await;
    assert_eq!(s, 403);
    // a second staff member approves: booked once, audited with both names
    let (s, v) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{id}/approve"), Some(json!({"note": "ticket checked"}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["adjustment"]["status"].as_str(), v["adjustment"]["decided_by"]["id"].as_str()), (Some("applied"), Some("6")));
    assert_eq!(t.available(42).await, "1500");
    let (s, _) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{id}/approve"), Some(json!({}))).await;
    assert_eq!(s, 409, "approving twice books nothing");
    assert_eq!(t.available(42).await, "1500");
    assert_eq!(t.count("SELECT count(*) FROM audit_log WHERE action = 'adjustment.approved' AND actor_id = '6'").await, 1);
    // reject and cancel book nothing
    let (_, v) = t.adjust(wallet_req("f-3", "deduct", "chargeback", "900")).await;
    let rid = v["adjustment"]["id"].as_i64().unwrap();
    let (s, _) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{rid}/reject"), Some(json!({"reason": ""}))).await;
    assert_eq!(s, 422, "a rejection needs a reason");
    let (s, v) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{rid}/reject"), Some(json!({"reason": "No chargeback notice"}))).await;
    assert_eq!((s, v["adjustment"]["status"].as_str()), (200, Some("rejected")));
    let (_, v) = t.adjust(wallet_req("f-4", "add", "bonus", "800")).await;
    let cid = v["adjustment"]["id"].as_i64().unwrap();
    let (s, _) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{cid}/cancel"), Some(json!({}))).await;
    assert_eq!(s, 403, "only the requester cancels");
    let (s, v) = t.fin("POST", &format!("/v1/admin/adjustments/{cid}/cancel"), Some(json!({}))).await;
    assert_eq!((s, v["adjustment"]["status"].as_str()), (200, Some("cancelled")));
    assert_eq!(t.available(42).await, "1500");
    // an approval that can no longer be booked fails cleanly (wallet spent meanwhile)
    let (_, v) = t.adjust(wallet_req("f-5", "deduct", "chargeback", "1400")).await;
    let pid = v["adjustment"]["id"].as_i64().unwrap();
    t.adjust(wallet_req("f-6", "deduct", "fee", "300")).await;
    let (s, v) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{pid}/approve"), Some(json!({}))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("insufficient_funds")), "{v}");
    let (_, v) = t.fin("GET", &format!("/v1/admin/adjustments/{pid}"), None).await;
    assert_eq!(v["adjustment"]["status"], "failed");
    assert_eq!(t.available(42).await, "1200");
    // list: filters and totals (USD, applied only)
    let (s, v) = t.fin("GET", "/v1/admin/adjustments?user_id=42", None).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["total"], 6);
    assert_eq!((v["totals"]["added_usd"].as_str(), v["totals"]["deducted_usd"].as_str(), v["totals"]["pending"].as_i64()), (Some("1500"), Some("300"), Some(0)));
    let (_, v) = t.fin("GET", "/v1/admin/adjustments?status=rejected&staff=6", None).await;
    assert_eq!(v["total"], 1);
    let (_, v) = t.fin("GET", "/v1/admin/adjustments?category=bonus&from=2000-01-01&to=2999-01-01", None).await;
    assert_eq!(v["total"], 1);
    t.invariants().await;
    t.drop_db().await;
}

#[tokio::test]
async fn permissions_are_enforced_by_the_service() {
    let Some(t) = T::new("adjustment permissions").await else { return };
    // no finance.adjust: 403 (support desk, dealer)
    let (s, _) = t.as_staff("3", "support", "clients.read,support.read", "POST", "/v1/admin/adjustments", Some(wallet_req("p-1", "add", "other", "5"))).await;
    assert_eq!(s, 403);
    let (s, _) = t.as_staff("3", "support", "clients.read", "GET", "/v1/admin/adjustments", None).await;
    assert_eq!(s, 403);
    // finance.adjust without finance.credit can't give credit
    let credit = json!({"idempotency_key": "p-2", "user_id": 7, "target": "trading", "login": 10000001, "op": "credit_in", "category": "bonus", "amount": "10", "comment": "promo"});
    let (s, _) = t.as_staff("4", "finance", "finance.read,finance.adjust", "POST", "/v1/admin/adjustments", Some(credit)).await;
    assert_eq!(s, 403);
    // force needs finance.adjust_force (Super Admin)
    t.engine.set_book(10000001, "100", "0", "0");
    let forced = json!({"idempotency_key": "p-3", "user_id": 7, "target": "trading", "login": 10000001, "op": "deduct", "category": "chargeback", "amount": "10", "comment": "cb", "force": true});
    let (s, _) = t.adjust(forced).await;
    assert_eq!(s, 403);
    // without the perms header (older BFF) the role decides
    let r = t
        .http
        .post(format!("{}/v1/admin/adjustments", t.base))
        .header("x-ezymex-internal", "test-internal-token")
        .header("x-ezymex-staff-id", "8")
        .header("x-ezymex-staff-role", "dealer")
        .json(&wallet_req("p-4", "add", "other", "5"))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status().as_u16(), 403);
    assert_eq!(t.count("SELECT count(*) FROM adjustments").await, 0);
    t.drop_db().await;
}

fn trading_req(key: &str, login: i64, op: &str, category: &str, amount: &str) -> Value {
    json!({"idempotency_key": key, "user_id": 7, "target": "trading", "login": login, "op": op, "category": category, "amount": amount, "comment": "desk", "client_note": "Welcome credit", "notify": true})
}

#[tokio::test]
async fn trading_account_adjustments_go_through_the_engine_idempotently() {
    let Some(t) = T::new("trading adjustments").await else { return };
    // balance 1000, margin 400 → 600 free own funds
    t.engine.set_book(10000001, "1000", "0", "400");
    // preview: before → after without booking
    let (s, v) = t.fin("POST", "/v1/admin/adjustments/preview", Some(trading_req("x", 10000001, "deduct", "correction", "700"))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["preview"]["ok"].as_bool(), v["preview"]["error"]["code"].as_str()), (Some(false), Some("insufficient_funds")));
    // free-margin refusal
    let (s, v) = t.adjust(trading_req("t-1", 10000001, "deduct", "correction", "700")).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("insufficient_funds")), "{v}");
    assert_eq!(t.engine.book(10000001).0.to_string(), "1000");
    // force (Super Admin): past the free margin
    let mut forced = trading_req("t-2", 10000001, "deduct", "chargeback", "700");
    forced["force"] = json!(true);
    let (s, v) = t.as_staff("1", "super_admin", SUPER, "POST", "/v1/admin/adjustments", Some(forced)).await;
    assert_eq!((s, v["adjustment"]["status"].as_str()), (200, Some("applied")), "{v}");
    assert_eq!(t.engine.book(10000001).0.to_string(), "300");
    // the engine got the requester's permissions and a stable key
    assert!(t.engine.adjust_staff.lock().unwrap().last().unwrap().1.as_ref().unwrap().contains(&"finance.adjust_force".to_string()));
    // give 50 credit, take it back; more than held is refused
    let (s, v) = t.adjust(trading_req("t-3", 10000001, "credit_in", "bonus", "50")).await;
    assert_eq!((s, v["adjustment"]["ledger_kind"].as_str()), (200, Some("credit")), "{v}");
    assert_eq!(t.engine.book(10000001).1.to_string(), "50");
    let (s, v) = t.adjust(trading_req("t-4", 10000001, "credit_out", "correction", "60")).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("insufficient_credit")));
    // balance 300 + credit 50 on margin 400: no free margin, so the credit can't be taken back without force
    let (s, v) = t.adjust(trading_req("t-5a", 10000001, "credit_out", "correction", "50")).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("insufficient_funds")), "{v}");
    t.engine.set_book(10000001, "300", "50", "0");
    let (s, v) = t.adjust(trading_req("t-5", 10000001, "credit_out", "correction", "50")).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(t.engine.book(10000001).1.to_string(), "0");
    // an account of another client is refused
    let (s, v) = t.adjust(trading_req("t-6", 10000002, "add", "other", "5")).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("login")));
    // engine answer lost after booking: stays processing, recovery settles it with the same key (booked once)
    t.engine.set_mode("timeout_after");
    let (s, v) = t.adjust(trading_req("t-7", 10000001, "add", "compensation", "25")).await;
    assert_eq!((s, v["error"]["code"].as_str()), (503, Some("engine_unavailable")), "{v}");
    t.engine.set_mode("ok");
    let id: i64 = sqlx::query_scalar("SELECT id FROM adjustments WHERE idempotency_key = 't-7'").fetch_one(&t.st.pool).await.unwrap();
    assert_eq!(t.count(&format!("SELECT count(*) FROM adjustments WHERE id = {id} AND status = 'processing'")).await, 1);
    let calls = t.engine.adjust_calls.load(Ordering::SeqCst);
    assert_eq!(wallet::ops::adjustments::recover(&t.st, 0).await.unwrap(), 1);
    assert!(t.engine.adjust_calls.load(Ordering::SeqCst) > calls);
    assert_eq!(t.count(&format!("SELECT count(*) FROM adjustments WHERE id = {id} AND status = 'applied'")).await, 1);
    assert_eq!(t.engine.book(10000001).0.to_string(), "325", "booked once");
    // four-eyes on a trading account: pending, then another staff member approves
    t.as_staff("1", "super_admin", SUPER, "PUT", "/v1/admin/adjustments/settings", Some(json!({"approval_threshold_usd": 100}))).await;
    let (_, v) = t.adjust(trading_req("t-8", 10000001, "credit_in", "bonus", "150")).await;
    let pid = v["adjustment"]["id"].as_i64().unwrap();
    assert_eq!(v["adjustment"]["status"], "pending");
    assert_eq!(t.engine.book(10000001).1.to_string(), "0");
    let (s, v) = t.as_staff("6", "finance", FINANCE, "POST", &format!("/v1/admin/adjustments/{pid}/approve"), Some(json!({}))).await;
    assert_eq!((s, v["adjustment"]["status"].as_str()), (200, Some("applied")), "{v}");
    assert_eq!(t.engine.book(10000001).1.to_string(), "150");
    // targets: wallet + accounts + open requests for the dialog
    let (s, v) = t.fin("GET", "/v1/admin/adjustments/targets/7", None).await;
    assert_eq!(s, 200);
    assert_eq!(v["accounts"].as_array().unwrap().len(), 2);
    assert_eq!(v["can"]["force"], false);
    // notifications for the client, one per applied adjustment with notify on
    assert_eq!(t.count("SELECT count(*) FROM notifications WHERE user_id = 7 AND kind LIKE 'adjustment.%'").await, 5);
    t.invariants().await;
    t.drop_db().await;
}
