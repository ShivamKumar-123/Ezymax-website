//! End-to-end staking tests against a throw-away database `ezymex_staking_test_<pid>_<n>` on the local PostgreSQL
//! (STAKING_TEST_DATABASE_URL, default :5433). Skipped when PostgreSQL is unreachable. The gateway, the wallet and
//! the notifications service are one mock HTTP server, so idempotency keys, refusals and retries run for real.

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{Duration, Utc};
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use staking::audit::Actor;
use staking::config::Config;
use staking::error::ApiError;
use staking::money::{D, dec};
use staking::period::{self, Period};
use staking::positions::{self, Subscribe};
use staking::state::AppState;
use staking::{db, plans, rates, settlements};
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

static N: AtomicUsize = AtomicUsize::new(0);

// ---------------------------------------------------------------- mock gateway + wallet + notify

#[derive(Default)]
struct Mock {
    /// gateway users: id → (kyc, status, restrictions)
    users: HashMap<i64, (String, String, Vec<String>)>,
    balances: HashMap<i64, D>,
    /// booked transfers: (key, user, direction, kind, amount)
    booked: Vec<(String, i64, String, String, D)>,
    keys: HashSet<String>,
    fail_next: usize,
    reject_next: usize,
    notices: Vec<Value>,
}

type M = Arc<Mutex<Mock>>;

async fn m_user(State(m): State<M>, Path(id): Path<i64>) -> (axum::http::StatusCode, Json<Value>) {
    match m.lock().unwrap().users.get(&id) {
        Some((kyc, status, r)) => (axum::http::StatusCode::OK, Json(json!({"user": {"id": id, "name": format!("Client {id}"), "kyc_status": kyc, "status": status, "restrictions": r}}))),
        None => (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": {"code": "not_found"}}))),
    }
}

async fn m_transfer(State(m): State<M>, Json(b): Json<Value>) -> (axum::http::StatusCode, Json<Value>) {
    let mut g = m.lock().unwrap();
    if g.fail_next > 0 {
        g.fail_next -= 1;
        return (axum::http::StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": {"code": "unavailable"}})));
    }
    if g.reject_next > 0 {
        g.reject_next -= 1;
        return (axum::http::StatusCode::BAD_REQUEST, Json(json!({"error": {"code": "validation", "message": "kind not allowed"}})));
    }
    let key = b["idempotency_key"].as_str().unwrap().to_string();
    let user = b["user_id"].as_i64().unwrap();
    let amount = D::from_str(&b["amount"].to_string().trim_matches('"').to_string()).unwrap();
    let dir = b["direction"].as_str().unwrap().to_string();
    let kind = b["kind"].as_str().unwrap().to_string();
    assert!(["staking_subscribe", "staking_reward", "staking_redeem"].contains(&kind.as_str()), "kind {kind}");
    assert_eq!(b["currency"], "USDT");
    if !g.keys.insert(key.clone()) {
        return (axum::http::StatusCode::OK, Json(json!({"status": "completed", "txn_id": 1, "replayed": true})));
    }
    let bal = g.balances.entry(user).or_default();
    if dir == "debit" {
        if *bal < amount {
            g.keys.remove(&key);
            return (axum::http::StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": {"code": "insufficient_funds", "message": "Insufficient funds"}})));
        }
        *bal -= amount;
    } else {
        *bal += amount;
    }
    g.booked.push((key, user, dir, kind, amount));
    let n = g.booked.len();
    (axum::http::StatusCode::OK, Json(json!({"status": "completed", "txn_id": n, "replayed": false})))
}

async fn m_notify(State(m): State<M>, Json(b): Json<Value>) -> Json<Value> {
    m.lock().unwrap().notices.push(b);
    Json(json!({"results": []}))
}

async fn mock() -> (String, M) {
    let m: M = Arc::new(Mutex::new(Mock::default()));
    let app = Router::new()
        .route("/v1/internal/users/{id}", get(m_user))
        .route("/v1/wallets/transfers", post(m_transfer))
        .route("/v1/notify", post(m_notify))
        .with_state(m.clone());
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    (url, m)
}

// ---------------------------------------------------------------- env

struct Env {
    st: AppState,
    m: M,
    admin: PgConnectOptions,
    name: String,
}

async fn env() -> Option<Env> {
    let base = std::env::var("STAKING_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping staking DB tests: no PostgreSQL at {base}");
        return None;
    }
    let name = format!("ezymex_staking_test_{}_{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst));
    let url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&url).await.expect("create + migrate");
    let (mock_url, m) = mock().await;
    let mut cfg = Config::for_tests(&url);
    cfg.gateway_url = mock_url.clone();
    cfg.wallet_url = mock_url.clone();
    cfg.notify_url = mock_url;
    Some(Env { st: AppState::new(pool, cfg), m, admin, name })
}

fn staff(id: u32) -> Actor {
    Actor { id: format!("staff:{id}"), name: Some(format!("Staff {id}")) }
}

impl Env {
    async fn drop(self) {
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    fn client(&self, id: i64, kyc: &str, balance: &str) {
        let mut g = self.m.lock().unwrap();
        g.users.insert(id, (kyc.into(), "active".into(), vec![]));
        g.balances.insert(id, dec(balance));
    }

    fn balance(&self, id: i64) -> D {
        self.m.lock().unwrap().balances.get(&id).copied().unwrap_or_default()
    }

    async fn plan(&self, extra: Value) -> plans::Plan {
        let mut b = json!({"name": "Fixed 3M", "minAmount": 100, "termMonths": 3, "maxMonthlyRatePct": 3, "status": "active",
                           "riskText": "Returns are set every month and can be zero. Your amount is locked until the end of the term.", "reason": "Launch"});
        for (k, v) in extra.as_object().unwrap() {
            b[k] = v.clone();
        }
        plans::create(&self.st, "ezymex", &staff(1), &b).await.unwrap()
    }

    async fn subscribe(&self, user: i64, plan: i64, amount: &str, key: &str) -> Result<positions::Position, ApiError> {
        positions::subscribe(&self.st, "ezymex", user, "Ana Lima", Subscribe { plan_id: plan, amount: Some(dec(amount)), key: key.into(), accept_terms: true, accept_risk: true }).await
    }

    /// Moves a position's start back to `started` (server time), with its maturity recomputed.
    async fn backdate(&self, id: i64, started: chrono::DateTime<Utc>, term: i32) {
        sqlx::query("UPDATE positions SET started_at = $2, matures_at = $3 WHERE id = $1").bind(id).bind(started).bind(period::maturity(started, term)).execute(&self.st.pool).await.unwrap();
    }

    async fn line_status(&self, settlement: i64) -> Vec<String> {
        sqlx::query_scalar("SELECT status FROM settlement_lines WHERE settlement_id = $1 ORDER BY id").bind(settlement).fetch_all(&self.st.pool).await.unwrap()
    }
}

fn code(e: ApiError) -> String {
    match e {
        ApiError::Rule { code, .. } | ApiError::Conflict { code, .. } | ApiError::Upstream { code, .. } => code.to_string(),
        ApiError::Validation { field, .. } => format!("validation:{field}"),
        ApiError::Forbidden(_) => "forbidden".into(),
        other => format!("{other:?}"),
    }
}

// ---------------------------------------------------------------- subscribe

#[tokio::test]
async fn subscribe_checks_limits_and_charges_once() {
    let Some(e) = env().await else { return };
    let plan = e.plan(json!({"capacity": 15000, "perUserMax": 12000, "maxAmount": 10000})).await;
    e.client(42, "verified", "20000");

    let p = e.subscribe(42, plan.id, "10000", "k-1").await.unwrap();
    assert_eq!(p.status, "active");
    let (s, m) = (p.started_at.unwrap(), p.matures_at.unwrap());
    assert_eq!(m, period::maturity(s, 3));
    assert_eq!(e.balance(42), dec("10000"));
    // the same key continues the same subscription: one position, one debit
    let again = e.subscribe(42, plan.id, "10000", "k-1").await.unwrap();
    assert_eq!(again.id, p.id);
    assert_eq!(e.m.lock().unwrap().booked.len(), 1);
    assert_eq!(e.m.lock().unwrap().booked[0].0, format!("staking:subscribe:{}", p.id));
    assert_eq!(code(e.subscribe(42, plan.id, "500", "k-1").await.unwrap_err()), "idempotency_conflict");

    // limits
    assert_eq!(code(e.subscribe(42, plan.id, "50", "k-2").await.unwrap_err()), "below_minimum");
    assert_eq!(code(e.subscribe(42, plan.id, "10001", "k-2").await.unwrap_err()), "above_maximum");
    assert_eq!(code(e.subscribe(42, plan.id, "2500", "k-2").await.unwrap_err()), "user_limit");
    e.client(43, "verified", "9000");
    assert_eq!(code(e.subscribe(43, plan.id, "6000", "k-3").await.unwrap_err()), "capacity_reached");
    let ok = e.subscribe(43, plan.id, "5000", "k-3").await.unwrap();
    assert_eq!(ok.status, "active");
    assert_eq!(code(e.subscribe(43, plan.id, "100", "k-4").await.unwrap_err()), "capacity_reached");

    // terms, risk, KYC, restrictions, unknown client
    let p2 = e.plan(json!({"name": "Open 6M", "termMonths": 6})).await;
    let no_risk = positions::subscribe(&e.st, "ezymex", 42, "", Subscribe { plan_id: p2.id, amount: Some(dec("100")), key: "k-5".into(), accept_terms: true, accept_risk: false }).await;
    assert_eq!(code(no_risk.unwrap_err()), "risk_ack_required");
    let no_terms = positions::subscribe(&e.st, "ezymex", 42, "", Subscribe { plan_id: p2.id, amount: Some(dec("100")), key: "k-5".into(), accept_terms: false, accept_risk: true }).await;
    assert_eq!(code(no_terms.unwrap_err()), "terms_required");
    e.client(44, "pending", "1000");
    assert_eq!(code(e.subscribe(44, p2.id, "100", "k-6").await.unwrap_err()), "kyc_required");
    e.client(45, "verified", "1000");
    e.m.lock().unwrap().users.get_mut(&45).unwrap().2 = vec!["withdrawals".into()];
    assert_eq!(code(e.subscribe(45, p2.id, "100", "k-7").await.unwrap_err()), "wallet_restricted");
    assert_eq!(code(e.subscribe(99, p2.id, "100", "k-8").await.unwrap_err()), "account_unavailable");
    // a paused plan isn't sold
    plans::update(&e.st, "ezymex", p2.id, &staff(1), &json!({"status": "paused", "reason": "Review"})).await.unwrap();
    assert_eq!(code(e.subscribe(42, p2.id, "100", "k-9").await.unwrap_err()), "plan_unavailable");

    // no funds: the position fails and nothing is booked
    let p3 = e.plan(json!({"name": "Open 1M", "termMonths": 1})).await;
    e.client(46, "verified", "50");
    assert_eq!(code(e.subscribe(46, p3.id, "100", "k-10").await.unwrap_err()), "insufficient_funds");
    let failed: String = sqlx::query_scalar("SELECT status FROM positions WHERE idempotency_key = 'u46:k-10'").fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(failed, "payment_failed");
    assert_eq!(code(e.subscribe(46, p3.id, "100", "k-10").await.unwrap_err()), "payment_failed");

    // wallet unreachable: pending, then the reconciler finishes it with the same key
    e.client(47, "verified", "1000");
    e.m.lock().unwrap().fail_next = 1;
    assert_eq!(code(e.subscribe(47, p3.id, "300", "k-11").await.unwrap_err()), "payment_pending");
    sqlx::query("UPDATE positions SET updated_at = now() - interval '1 minute' WHERE idempotency_key = 'u47:k-11'").execute(&e.st.pool).await.unwrap();
    assert_eq!(positions::reconcile(&e.st).await.unwrap(), 1);
    let st: String = sqlx::query_scalar("SELECT status FROM positions WHERE idempotency_key = 'u47:k-11'").fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(st, "active");
    assert_eq!(e.balance(47), dec("700"));

    // plan currency is locked once clients hold it; drafts can't come back
    let bad = plans::update(&e.st, "ezymex", plan.id, &staff(1), &json!({"status": "draft", "reason": "Oops"})).await;
    assert_eq!(code(bad.unwrap_err()), "plan_in_use");
    let audit: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'position.subscribe'").fetch_one(&e.st.pool).await.unwrap();
    assert!(audit >= 4);
    assert!(sqlx::query("DELETE FROM audit_log").execute(&e.st.pool).await.is_err(), "audit log is append-only");
    e.drop().await;
}

// ---------------------------------------------------------------- rates + settlement

#[tokio::test]
async fn monthly_settlement_four_eyes_and_idempotent_credits() {
    let Some(e) = env().await else { return };
    let plan = e.plan(json!({})).await;
    let other = e.plan(json!({"name": "Fixed 12M", "termMonths": 12, "maxMonthlyRatePct": 2})).await;
    e.client(42, "verified", "50000");
    e.client(43, "verified", "50000");
    let now = Utc::now();
    let month = Period::of(now).prev().prev();
    let pm = month.to_string();
    // A: from the 15th of `month` (16 or 17 days in it); B: the whole month; C: other plan, whole month
    let a = e.subscribe(42, plan.id, "10000", "a").await.unwrap();
    let b = e.subscribe(43, plan.id, "2500", "b").await.unwrap();
    let c = e.subscribe(43, other.id, "1000", "c").await.unwrap();
    let a_start = month.start() + Duration::days(14) + Duration::hours(11);
    e.backdate(a.id, a_start, 3).await;
    e.backdate(b.id, month.prev().start() + Duration::hours(10), 3).await;
    e.backdate(c.id, month.prev().start() + Duration::hours(10), 12).await;

    // rates: never for a future month, never above the ceiling; the month is locked by its settlement
    let r = |plan: i64, period: &str, rate: &str| json!({"planId": plan, "period": period, "ratePct": rate, "reason": "Monthly committee"});
    let next = Period::of(now).next().to_string();
    assert_eq!(code(rates::set(&e.st, "ezymex", &staff(1), &r(plan.id, &next, "1")).await.unwrap_err()), "future_period");
    assert_eq!(code(rates::set(&e.st, "ezymex", &staff(1), &r(plan.id, &pm, "3.5")).await.unwrap_err()), "above_ceiling");
    assert_eq!(code(rates::set(&e.st, "ezymex", &staff(1), &json!({"planId": plan.id, "period": pm, "ratePct": 1})).await.unwrap_err()), "validation:reason");
    rates::set(&e.st, "ezymex", &staff(1), &r(plan.id, &pm, "1.5")).await.unwrap();

    // the other plan has no rate yet
    let pv = settlements::preview(&e.st, "ezymex", month).await.unwrap();
    assert_eq!(pv["canCreate"], false);
    assert_eq!(pv["ratesMissing"][0]["planId"], other.id);
    assert_eq!(code(settlements::create(&e.st, "ezymex", &staff(1), month, "September").await.unwrap_err()), "rates_missing");
    rates::set(&e.st, "ezymex", &staff(1), &r(other.id, &pm, "0.8")).await.unwrap();
    // the open month can't be settled
    assert_eq!(code(settlements::create(&e.st, "ezymex", &staff(1), Period::of(now), "Too early").await.unwrap_err()), "period_open");

    let pv = settlements::preview(&e.st, "ezymex", month).await.unwrap();
    assert_eq!(pv["canCreate"], true);
    let dim = month.days();
    let a_days = period::days_active(a_start, period::maturity(a_start, 3), month);
    assert_eq!(a_days, dim - 14);
    let want_a = period::accrual(dec("10000"), dec("1.5"), a_days, dim);
    let want_b = period::accrual(dec("2500"), dec("1.5"), dim, dim);
    let want_c = period::accrual(dec("1000"), dec("0.8"), dim, dim);
    assert_eq!(want_b, dec("37.5"));
    assert_eq!(want_c, dec("8"));
    assert_eq!(pv["totals"]["lines"], 3);
    assert_eq!(D::from_str(&pv["totals"]["amount"].to_string()).unwrap(), want_a + want_b + want_c);
    // the Back Office estimate is rounded line by line like the settlement
    let mv = rates::month(&e.st, "ezymex", month).await.unwrap();
    let item = mv["items"].as_array().unwrap().iter().find(|i| i["plan"]["id"] == plan.id).unwrap();
    assert_eq!(D::from_str(&item["estimate"].to_string()).unwrap(), want_a + want_b);
    assert_eq!((item["positions"].as_i64(), mv["editable"].as_bool()), (Some(2), Some(true)));

    let id = settlements::create(&e.st, "ezymex", &staff(1), month, "Month closed").await.unwrap();
    assert_eq!(code(settlements::create(&e.st, "ezymex", &staff(2), month, "Again").await.unwrap_err()), "settlement_exists");
    assert_eq!(code(rates::set(&e.st, "ezymex", &staff(1), &r(plan.id, &pm, "1")).await.unwrap_err()), "period_locked");
    // four-eyes: the creator can't approve
    assert_eq!(code(settlements::approve(&e.st, "ezymex", id, &staff(1), "Looks right").await.unwrap_err()), "forbidden");
    assert!(sqlx::query("UPDATE settlements SET status = 'approved', decided_by = created_by WHERE id = $1").bind(id).execute(&e.st.pool).await.is_err(), "database CHECK");
    assert!(e.m.lock().unwrap().booked.iter().all(|b| b.3 == "staking_subscribe"), "nothing paid before approval");

    // approved; the wallet is down for the first line
    settlements::approve(&e.st, "ezymex", id, &staff(2), "Checked against the committee minutes").await.unwrap();
    e.m.lock().unwrap().fail_next = 1;
    let (paid, pending, failed) = settlements::transfer_tick(&e.st).await.unwrap();
    assert_eq!((paid, pending, failed), (2, 1, 0));
    let s: String = sqlx::query_scalar("SELECT status FROM settlements WHERE id = $1").bind(id).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(s, "approved");
    sqlx::query("UPDATE settlement_lines SET next_attempt_at = now() WHERE settlement_id = $1").bind(id).execute(&e.st.pool).await.unwrap();
    assert_eq!(settlements::transfer_tick(&e.st).await.unwrap(), (1, 0, 0));
    assert_eq!(settlements::transfer_tick(&e.st).await.unwrap(), (0, 0, 0));
    let s: String = sqlx::query_scalar("SELECT status FROM settlements WHERE id = $1").bind(id).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(s, "paid");
    {
        let g = e.m.lock().unwrap();
        let rewards: Vec<_> = g.booked.iter().filter(|b| b.3 == "staking_reward").collect();
        assert_eq!(rewards.len(), 3);
        assert!(rewards.iter().any(|b| b.0 == format!("staking:reward:ezymex:{pm}:{}", a.id) && b.4 == want_a && b.1 == 42));
        assert!(g.notices.iter().any(|n| n["type"] == "staking.reward_paid" && n["userId"] == 42));
    }
    let paid_a: D = sqlx::query_scalar("SELECT returns_paid FROM positions WHERE id = $1").bind(a.id).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(paid_a, want_a);
    let pf = positions::portfolio(&e.st, "ezymex", 42).await.unwrap();
    assert_eq!(D::from_str(&pf["summary"]["returnsPaid"].to_string()).unwrap(), want_a);
    assert_eq!(pf["monthly"][0]["period"], pm);
    let h = positions::history(&e.st, "ezymex", 42, 0, 10).await.unwrap();
    assert_eq!(h["total"], 2);
    assert_eq!(h["items"][0]["kind"], "reward");

    // the next month: a refused line, partly paid, retried
    let month2 = month.next();
    rates::set(&e.st, "ezymex", &staff(1), &r(plan.id, &month2.to_string(), "1")).await.unwrap();
    rates::set(&e.st, "ezymex", &staff(1), &r(other.id, &month2.to_string(), "0")).await.unwrap();
    let id2 = settlements::create(&e.st, "ezymex", &staff(2), month2, "Month closed").await.unwrap();
    // a 0 % month earns nothing: only plan 1's lines
    assert_eq!(e.line_status(id2).await.len(), 2);
    // rejected → can be created again
    settlements::reject(&e.st, "ezymex", id2, &staff(1), "Wrong rate").await.unwrap();
    assert!(e.line_status(id2).await.iter().all(|s| s == "rejected"));
    let id3 = settlements::create(&e.st, "ezymex", &staff(2), month2, "Second try").await.unwrap();
    settlements::approve(&e.st, "ezymex", id3, &staff(3), "OK").await.unwrap();
    e.m.lock().unwrap().reject_next = 1;
    assert_eq!(settlements::transfer_tick(&e.st).await.unwrap(), (1, 0, 1));
    let s: String = sqlx::query_scalar("SELECT status FROM settlements WHERE id = $1").bind(id3).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(s, "partially_paid");
    settlements::retry(&e.st, "ezymex", id3, &staff(3), "Wallet fixed").await.unwrap();
    assert_eq!(settlements::transfer_tick(&e.st).await.unwrap(), (1, 0, 0));
    let s: String = sqlx::query_scalar("SELECT status FROM settlements WHERE id = $1").bind(id3).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(s, "paid");
    assert_eq!(code(settlements::retry(&e.st, "ezymex", id3, &staff(3), "Again").await.unwrap_err()), "invalid_state");

    // past rates are shown to clients only for settled months
    let hist = rates::settled_history(&e.st, "ezymex", 6).await.unwrap();
    assert_eq!(hist[&plan.id].len(), 2);
    assert_eq!(hist[&plan.id][0], (month2.to_string(), dec("1")));
    let month_view = rates::month(&e.st, "ezymex", month2).await.unwrap();
    assert_eq!(month_view["editable"], false);
    e.drop().await;
}

// ---------------------------------------------------------------- maturity

#[tokio::test]
async fn principal_returns_at_maturity_once() {
    let Some(e) = env().await else { return };
    let plan = e.plan(json!({"termMonths": 1})).await;
    e.client(42, "verified", "1000");
    let p = e.subscribe(42, plan.id, "600", "m").await.unwrap();
    assert_eq!(e.balance(42), dec("400"));
    assert_eq!(positions::maturity_tick(&e.st).await.unwrap(), (0, 0));
    e.backdate(p.id, Utc::now() - Duration::days(40), 1).await;
    e.m.lock().unwrap().fail_next = 1;
    assert_eq!(positions::maturity_tick(&e.st).await.unwrap(), (0, 1));
    let attempts: i32 = sqlx::query_scalar("SELECT redeem_attempts FROM positions WHERE id = $1").bind(p.id).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(attempts, 1);
    sqlx::query("UPDATE positions SET redeem_next_at = now() WHERE id = $1").bind(p.id).execute(&e.st.pool).await.unwrap();
    assert_eq!(positions::maturity_tick(&e.st).await.unwrap(), (1, 0));
    assert_eq!(positions::maturity_tick(&e.st).await.unwrap(), (0, 0));
    assert_eq!(e.balance(42), dec("1000"));
    let fresh = positions::get(&e.st, p.id).await.unwrap().unwrap();
    assert_eq!(fresh.status, "matured");
    {
        let g = e.m.lock().unwrap();
        assert_eq!(g.booked.iter().filter(|b| b.0 == format!("staking:principal:{}", p.id) && b.3 == "staking_redeem").count(), 1);
        assert!(g.notices.iter().any(|n| n["type"] == "staking.matured"));
    }
    // the matured month still settles its last days
    let h = positions::history(&e.st, "ezymex", 42, 0, 10).await.unwrap();
    assert_eq!(h["items"][0]["kind"], "principal");
    e.drop().await;
}

// ---------------------------------------------------------------- HTTP

#[tokio::test]
async fn http_routes_check_token_identity_and_permissions() {
    let Some(mut e) = env().await else { return };
    let mut cfg = (*e.st.cfg).clone();
    cfg.internal_token = "secret".into();
    e.st = AppState::new(e.st.pool.clone(), cfg);
    let plan = e.plan(json!({})).await;
    e.client(42, "verified", "5000");
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", l.local_addr().unwrap());
    let app = staking::api::router(e.st.clone());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    let http = reqwest::Client::new();

    let r = http.get(format!("{base}/health")).send().await.unwrap();
    assert_eq!(r.status(), 200);
    let r = http.get(format!("{base}/v1/staking/me/plans")).header("x-ezymex-user-id", "42").send().await.unwrap();
    assert_eq!(r.status(), 403, "internal token required");
    let r = http.get(format!("{base}/v1/staking/me/plans")).header("x-ezymex-internal", "secret").send().await.unwrap();
    assert_eq!(r.status(), 401, "user required");
    let v: Value = http.get(format!("{base}/v1/staking/me/plans")).header("x-ezymex-internal", "secret").header("x-ezymex-user-id", "42").send().await.unwrap().json().await.unwrap();
    assert_eq!(v["plans"][0]["id"], plan.id);
    assert!(v["plans"][0].get("maxMonthlyRatePct").is_none(), "the ceiling is never shown to clients");
    assert_eq!(v["plans"][0]["recentRates"], json!([]));

    let r = http
        .post(format!("{base}/v1/staking/me/positions"))
        .header("x-ezymex-internal", "secret")
        .header("x-ezymex-user-id", "42")
        .json(&json!({"planId": plan.id, "amount": "250.50", "idempotencyKey": "web-1", "acceptTerms": true, "acceptRisk": true}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 200);
    let v: Value = r.json().await.unwrap();
    assert_eq!(v["position"]["status"], "active");
    assert_eq!(v["position"]["principal"], 250.5);
    let pf: Value = http.get(format!("{base}/v1/staking/me/portfolio")).header("x-ezymex-internal", "secret").header("x-ezymex-user-id", "42").send().await.unwrap().json().await.unwrap();
    assert_eq!(pf["summary"]["invested"], 250.5);
    // another client can't read the position
    let r = http.get(format!("{base}/v1/staking/me/positions/{}", v["position"]["id"])).header("x-ezymex-internal", "secret").header("x-ezymex-user-id", "43").send().await.unwrap();
    assert_eq!(r.status(), 404);

    let admin = |rb: reqwest::RequestBuilder, perms: &str| rb.header("x-ezymex-internal", "secret").header("x-ezymex-staff-id", "9").header("x-ezymex-staff-role", "admin").header("x-ezymex-staff-name", "Julia%20Novak").header("x-ezymex-staff-perms", perms);
    let r = admin(http.get(format!("{base}/v1/staking/admin/overview")), "staking.read").send().await.unwrap();
    assert_eq!(r.status(), 200);
    let v: Value = r.json().await.unwrap();
    assert_eq!(v["liability"], 250.5);
    let r = admin(http.post(format!("{base}/v1/staking/admin/plans")), "staking.read").json(&json!({"name": "X plan", "minAmount": 10, "termMonths": 2, "maxMonthlyRatePct": 1, "reason": "test"})).send().await.unwrap();
    assert_eq!(r.status(), 403, "write needs staking.write");
    let r = admin(http.post(format!("{base}/v1/staking/admin/plans")), "staking.read,staking.write").json(&json!({"name": "X plan", "minAmount": 10, "termMonths": 2, "maxMonthlyRatePct": 1})).send().await.unwrap();
    assert_eq!(r.status(), 422, "reason required");
    let r = admin(http.get(format!("{base}/v1/staking/admin/positions/export")), "staking.read").send().await.unwrap();
    assert_eq!(r.status(), 403, "export needs staking.export");
    let r = admin(http.get(format!("{base}/v1/staking/admin/positions?q=Client")), "staking.read").send().await.unwrap();
    let v: Value = r.json().await.unwrap();
    assert_eq!(v["total"], 1);
    let r = admin(http.get(format!("{base}/v1/staking/admin/audit")), "staking.read").send().await.unwrap();
    let v: Value = r.json().await.unwrap();
    assert!(v["items"].as_array().unwrap().iter().any(|a| a["action"] == "plan.create" && a["reason"] == "Launch"));
    e.drop().await;
}
