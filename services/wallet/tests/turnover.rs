//! Deposit turnover requirements end to end: a credited deposit raises one, closed deals pay it down, and the
//! withdrawal path refuses until it is met.
//!
//! The same throw-away-database harness as flows.rs, with a mock chain and a mock engine whose volume feed the
//! test drives deal by deal. Skipped with a note when PostgreSQL is not reachable.

use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use wallet::chain::mock::MockChain;
use wallet::chain::{Chain, ChainId, TokenTransfer, TxLookup, TxStatus};
use wallet::config::Config;
use wallet::engine::MockEngine;
use wallet::money::D;
use wallet::state::{AppState, Tenants};
use wallet::users::MockUsers;
use wallet::{db, watcher};

const TRON_ADDR: &str = "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ";
const CLIENT_TRON: &str = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USER: i64 = 7;

fn d(s: &str) -> D {
    D::from_str(s).unwrap()
}

struct T {
    st: AppState,
    base: String,
    http: reqwest::Client,
    tron: Arc<MockChain>,
    engine: Arc<MockEngine>,
    admin: PgConnectOptions,
    name: String,
    block: std::sync::atomic::AtomicI64,
}

impl T {
    async fn new(what: &str) -> Option<Self> {
        let base = std::env::var("WALLET_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
        let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
        if admin.connect().await.is_err() {
            eprintln!("skipping {what}: no PostgreSQL at {base} — set WALLET_TEST_DATABASE_URL to a server where this role may CREATE DATABASE");
            return None;
        }
        let mut b = [0u8; 5];
        getrandom::fill(&mut b).unwrap();
        let name = format!("ezymex_wallet_test_{}", b.iter().map(|x| format!("{x:02x}")).collect::<String>());
        let url = admin.clone().database(&name).to_url_lossy().to_string();
        let pool = db::connect(&url).await.expect("create + migrate test db");
        let cfg = Config::for_tests(&url);
        wallet::settings::seed(&pool, &cfg).await.unwrap();
        let tron = Arc::new(MockChain::new(ChainId::Tron));
        let mut chains: HashMap<ChainId, Arc<dyn Chain>> = HashMap::new();
        chains.insert(ChainId::Tron, tron.clone());
        let engine = Arc::new(MockEngine::default().with_account(USER, 10_000_007, "live"));
        let users = Arc::new(MockUsers::default());
        users.set(USER, "verified");
        let st = AppState { tenants: Tenants::load(&pool).await.unwrap(), pool, cfg: Arc::new(cfg), chains: Arc::new(chains), engine: engine.clone(), users, transfer_lock: Default::default() };
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let app = wallet::api::router(st.clone());
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Some(T { st, base: base_url, http: reqwest::Client::new(), tron, engine, admin, name, block: 1000.into() })
    }

    async fn call(&self, method: &str, path: &str, body: Option<Value>, staff: Option<&str>) -> (u16, Value) {
        let mut rb = match method {
            "GET" => self.http.get(format!("{}{path}", self.base)),
            "PUT" => self.http.put(format!("{}{path}", self.base)),
            _ => self.http.post(format!("{}{path}", self.base)),
        };
        rb = rb.header("x-ezymex-internal", "test-internal-token").header("x-forwarded-for", "203.0.113.7");
        if let Some(role) = staff {
            rb = rb.header("x-ezymex-staff-id", "5").header("x-ezymex-staff-name", "Finance%20Desk").header("x-ezymex-staff-role", role);
        }
        if let Some(b) = body {
            rb = rb.json(&b);
        }
        let r = rb.send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }

    async fn get(&self, path: &str) -> (u16, Value) {
        self.call("GET", path, None, None).await
    }

    /// Turns the policy on (or off) through the real Back Office endpoint, as a broker would.
    async fn set_policy(&self, enabled: bool, multiplier: &str, min_deposit: &str) {
        let body = json!({"reason": "turnover policy test", "limits": {"turnover_enabled": enabled, "turnover_multiplier": multiplier, "turnover_min_deposit": min_deposit, "deposit_cooldown_hours": 0}});
        let (s, v) = self.call("PUT", "/v1/admin/settings", Some(body), Some("super_admin")).await;
        assert_eq!(s, 200, "{v}");
    }

    /// A real on-chain deposit, all the way to credited, so the ledger row is the one a rail really writes.
    async fn deposit(&self, amount: &str, nonce: u64) {
        let (s, v) = self.call("POST", "/v1/deposits/intents", Some(json!({"user_id": USER, "chain": "tron", "amount": amount})), None).await;
        assert_eq!(s, 200, "{v}");
        let intent = v["intent"]["id"].clone();
        let h = format!("{nonce:064x}");
        let block = self.block.fetch_add(100, std::sync::atomic::Ordering::SeqCst);
        self.tron.put(
            &h,
            TxLookup {
                status: TxStatus::Success,
                block: Some(block),
                block_time: Some(chrono::Utc::now()),
                transfers: vec![TokenTransfer { log_index: Some(0), token: ChainId::Tron.usdt_contract().into(), from: CLIENT_TRON.into(), to: TRON_ADDR.into(), amount: d(amount) }],
            },
        );
        self.tron.set_head(block + 25);
        let (s, v) = self.call("POST", "/v1/deposits/submit", Some(json!({"user_id": USER, "intent_id": intent, "tx_hash": h})), None).await;
        assert_eq!(s, 200, "{v}");
        watcher::tick(&self.st).await.unwrap();
    }

    async fn summary(&self) -> Value {
        let (s, v) = self.get(&format!("/v1/turnover/{USER}")).await;
        assert_eq!(s, 200, "{v}");
        v
    }

    /// What the client gets for pressing Withdraw: the quote runs every check the request runs.
    async fn try_withdraw(&self, amount: &str) -> (u16, Value) {
        self.call("POST", "/v1/withdrawals/quote", Some(json!({"user_id": USER, "amount": amount, "method": "crypto", "chain": "tron", "to_address": CLIENT_TRON})), None).await
    }

    async fn drop_db(self) {
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }
}

/// The spec's worked example, start to finish: deposit $2,000, trade it off, withdraw.
#[tokio::test]
async fn a_deposit_asks_for_volume_before_it_can_leave() {
    let Some(t) = T::new("turnover end to end").await else { return };
    t.set_policy(true, "1.0", "0").await;

    // Test case 1: $2,000 in raises a $2,000 requirement
    t.deposit("2000", 1).await;
    let s = t.summary().await;
    assert_eq!((s["total_deposits"].as_str(), s["required_volume"].as_str()), (Some("2000"), Some("2000")), "{s}");
    assert_eq!((s["completed_volume"].as_str(), s["remaining_volume"].as_str()), (Some("0"), Some("2000")));
    assert_eq!((s["completion_percentage"].as_i64(), s["eligible"].as_bool()), (Some(0), Some(false)));

    // Test case 2: $800 of volume leaves $1,200, and Withdraw is refused with the numbers behind it
    t.engine.close_deal(1, USER, Some(d("800")));
    watcher::tick(&t.st).await.unwrap();
    let s = t.summary().await;
    assert_eq!((s["completed_volume"].as_str(), s["remaining_volume"].as_str()), (Some("800"), Some("1200")), "{s}");
    assert_eq!(s["completion_percentage"].as_i64(), Some(40));
    let (code, v) = t.try_withdraw("100").await;
    assert_eq!((code, v["error"]["code"].as_str()), (422, Some("turnover_pending")), "{v}");

    // Test case 7: the same deal delivered twice is counted once
    t.engine.close_deal(1, USER, Some(d("800")));
    watcher::tick(&t.st).await.unwrap();
    assert_eq!(t.summary().await["completed_volume"].as_str(), Some("800"), "a replayed deal must not count twice");

    // Test case 3: the rest of the volume opens the gate
    t.engine.close_deal(2, USER, Some(d("1200")));
    watcher::tick(&t.st).await.unwrap();
    let s = t.summary().await;
    assert_eq!((s["remaining_volume"].as_str(), s["completion_percentage"].as_i64(), s["eligible"].as_bool()), (Some("0"), Some(100), Some(true)), "{s}");
    let (code, v) = t.try_withdraw("100").await;
    assert_eq!(code, 200, "the gate must open once the volume is there: {v}");

    // the allocation ledger explains the progress rather than asserting it
    let hist = t.summary().await;
    assert_eq!(hist["history"].as_array().unwrap().len(), 2);
    assert_eq!(hist["deposits"][0]["status"], "completed");
    t.drop_db().await;
}

/// Several deposits: one combined figure, a deposit-by-deposit breakdown, and volume applied oldest first.
#[tokio::test]
async fn deposits_are_worked_off_oldest_first() {
    let Some(t) = T::new("turnover fifo").await else { return };
    t.set_policy(true, "1.0", "0").await;

    // Test case 5: $2,000 + $1,000 = a $3,000 requirement
    t.deposit("2000", 11).await;
    t.deposit("1000", 12).await;
    let s = t.summary().await;
    assert_eq!((s["total_deposits"].as_str(), s["required_volume"].as_str()), (Some("3000"), Some("3000")), "{s}");
    assert_eq!(s["open_requirements"].as_i64(), Some(2));

    // $2,500 of volume: the first deposit is paid off, the second is left owing $500
    t.engine.close_deal(1, USER, Some(d("2500")));
    watcher::tick(&t.st).await.unwrap();
    let s = t.summary().await;
    assert_eq!((s["completed_volume"].as_str(), s["remaining_volume"].as_str()), (Some("2500"), Some("500")), "{s}");
    assert_eq!((s["required_volume"].as_str(), s["total_deposits"].as_str()), (Some("3000"), Some("3000")), "a finished deposit stays in the total");
    assert_eq!(s["completion_percentage"].as_i64(), Some(83));
    assert_eq!(s["open_requirements"].as_i64(), Some(1), "only one is still open");
    let deps = s["deposits"].as_array().unwrap();
    // newest first: the $1,000 deposit took the remainder, the $2,000 one is done
    assert_eq!((deps[0]["deposit_amount"].as_str(), deps[0]["completed_volume"].as_str(), deps[0]["status"].as_str()), (Some("1000"), Some("500"), Some("pending")), "{s}");
    assert_eq!((deps[1]["deposit_amount"].as_str(), deps[1]["status"].as_str()), (Some("2000"), Some("completed")));
    t.drop_db().await;
}

/// The restriction is the broker's to switch on, and it never reaches backwards.
#[tokio::test]
async fn the_policy_is_off_until_a_broker_turns_it_on() {
    let Some(t) = T::new("turnover prospective").await else { return };
    t.set_policy(false, "0", "0").await;

    // Off out of the box: a deposit raises nothing and Withdraw behaves exactly as it did before
    t.deposit("2000", 21).await;
    let s = t.summary().await;
    assert_eq!((s["required_volume"].as_str(), s["eligible"].as_bool()), (Some("0"), Some(true)), "{s}");
    assert_eq!(t.try_withdraw("100").await.0, 200);

    // Test case 10: turning it on applies to what comes next, not to money already in
    t.set_policy(true, "1.0", "0").await;
    watcher::tick(&t.st).await.unwrap();
    assert_eq!(t.summary().await["required_volume"].as_str(), Some("0"), "a deposit taken under the old policy keeps it");
    assert_eq!(t.try_withdraw("100").await.0, 200);

    t.deposit("500", 22).await;
    assert_eq!(t.summary().await["required_volume"].as_str(), Some("500"));

    // and a later change does not move the goalposts under the deposit already taken
    t.set_policy(true, "3.0", "0").await;
    watcher::tick(&t.st).await.unwrap();
    assert_eq!(t.summary().await["required_volume"].as_str(), Some("500"), "the multiplier is frozen per deposit");
    t.deposit("500", 23).await;
    assert_eq!(t.summary().await["required_volume"].as_str(), Some("2000"), "500 at 1x plus 500 at 3x");

    // a deposit under the floor raises nothing at all
    t.set_policy(true, "1.0", "1000").await;
    t.deposit("100", 24).await;
    assert_eq!(t.summary().await["required_volume"].as_str(), Some("2000"), "below the minimum deposit");
    t.drop_db().await;
}

/// A deal the engine could not value must not be counted as nothing, and a reopened one must be taken back.
#[tokio::test]
async fn unpriced_and_reopened_deals_are_handled_honestly() {
    let Some(t) = T::new("turnover edge cases").await else { return };
    t.set_policy(true, "1.0", "0").await;
    t.deposit("1000", 31).await;

    // an unvalued deal holds the cursor: nothing is credited, and the deal behind it waits its turn
    t.engine.close_deal(1, USER, None);
    t.engine.close_deal(2, USER, Some(d("400")));
    watcher::tick(&t.st).await.unwrap();
    let s = t.summary().await;
    assert_eq!(s["completed_volume"].as_str(), Some("0"), "an unpriced deal must not be credited as zero: {s}");

    // once it can be valued both go through, in order
    {
        let mut deals = t.engine.deals.lock().unwrap();
        deals[0].notional = Some(d("300"));
    }
    watcher::tick(&t.st).await.unwrap();
    assert_eq!(t.summary().await["completed_volume"].as_str(), Some("700"));

    // Test case 8 / corrections: the desk reopens the first deal and its credit comes off again
    t.engine.reverse_deal(1);
    watcher::tick(&t.st).await.unwrap();
    let s = t.summary().await;
    assert_eq!((s["completed_volume"].as_str(), s["remaining_volume"].as_str()), (Some("400"), Some("600")), "{s}");
    let kinds: Vec<&str> = s["history"].as_array().unwrap().iter().map(|h| h["kind"].as_str().unwrap()).collect();
    assert!(kinds.contains(&"reversal"), "the reversal is on the record: {kinds:?}");
    t.drop_db().await;
}

/// The restriction is server side, and staff can lift one requirement with a reason when it must not apply.
#[tokio::test]
async fn the_gate_cannot_be_talked_round_but_can_be_waived() {
    let Some(t) = T::new("turnover gate").await else { return };
    t.set_policy(true, "1.0", "0").await;
    t.deposit("1000", 41).await;

    // Test case 4: straight at the API, with no UI in the way
    let (code, v) = t
        .call("POST", "/v1/withdrawals", Some(json!({"user_id": USER, "amount": "50", "method": "crypto", "chain": "tron", "to_address": CLIENT_TRON, "idempotency_key": "w-1"})), None)
        .await;
    assert_eq!((code, v["error"]["code"].as_str()), (422, Some("turnover_pending")), "{v}");
    let open: i64 = sqlx::query_scalar("SELECT count(*) FROM withdrawals").fetch_one(&t.st.pool).await.unwrap();
    assert_eq!(open, 0, "a refused withdrawal must not leave a row behind");

    // Test case 9: two at once get the same answer, and neither slips through
    let both = tokio::join!(t.try_withdraw("50"), t.try_withdraw("50"));
    assert_eq!((both.0.0, both.1.0), (422, 422));

    // the compliant exception: a named member of staff lifts it, with a reason, and moves no money
    let req: i64 = sqlx::query_scalar("SELECT id FROM turnover_requirements ORDER BY id LIMIT 1").fetch_one(&t.st.pool).await.unwrap();
    let (code, v) = t.call("POST", &format!("/v1/admin/turnover/requirements/{req}/waive"), Some(json!({"reason": "no"})), Some("finance")).await;
    assert_eq!((code, v["error"]["code"].as_str()), (422, Some("validation")), "a waiver needs a real reason: {v}");
    let (code, v) = t.call("POST", &format!("/v1/admin/turnover/requirements/{req}/waive"), Some(json!({"reason": "Compliance review 4412: requirement not applicable"})), Some("finance")).await;
    assert_eq!(code, 200, "{v}");
    assert_eq!(t.try_withdraw("50").await.0, 200, "the gate opens once the requirement is waived");

    let audited: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'turnover.waived'").fetch_one(&t.st.pool).await.unwrap();
    assert_eq!(audited, 1, "the waiver is in the audit trail");
    t.drop_db().await;
}
