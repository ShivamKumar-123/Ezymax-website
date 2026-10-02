//! End-to-end growth tests against a throw-away database `kalks_growth_test_<pid>_<n>` on the local PostgreSQL
//! (GROWTH_TEST_DATABASE_URL, default :5433). Skipped when PostgreSQL is unreachable. The trading engine and the
//! wallet are one mock HTTP server, so engine legs, idempotency keys and wallet retries are exercised for real.

use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{Duration, Utc};
use growth::bonus::{self, ClaimOpts};
use growth::calc::Segment;
use growth::clients;
use growth::config::Config;
use growth::deals::{self, AccountFacts, DealIn, Programme};
use growth::money::{D, dec};
use growth::state::AppState;
use growth::{contests, db, loyalty, payouts, promos};
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

static N: AtomicUsize = AtomicUsize::new(0);
static DEAL: AtomicI64 = AtomicI64::new(2_000_001);

// ---------------------------------------------------------------- mock engine + wallet

#[derive(Default)]
struct Mock {
    accounts: HashMap<i64, Value>,
    ledgers: HashMap<i64, Vec<Value>>,
    /// (login, type, amount, key)
    postings: Vec<(i64, String, D, String)>,
    keys: HashSet<String>,
    /// wallet transfers booked: (key, user, amount, kind)
    wallet: Vec<(String, i64, D, String)>,
    wallet_fail_next: usize,
}

type M = Arc<Mutex<Mock>>;

async fn m_account(State(m): State<M>, Path(login): Path<i64>) -> (axum::http::StatusCode, Json<Value>) {
    match m.lock().unwrap().accounts.get(&login) {
        Some(a) => (axum::http::StatusCode::OK, Json(json!({"account": a}))),
        None => (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": {"code": "not_found"}}))),
    }
}

async fn m_accounts(State(m): State<M>, Query(q): Query<HashMap<String, String>>) -> Json<Value> {
    let user: i64 = q.get("user_id").and_then(|u| u.parse().ok()).unwrap_or(0);
    let kind = q.get("type").cloned();
    let g = m.lock().unwrap();
    let items: Vec<Value> = g.accounts.values().filter(|a| a["userId"] == user && kind.as_ref().is_none_or(|k| a["type"] == k.as_str())).cloned().collect();
    Json(json!({"items": items, "total": items.len()}))
}

async fn m_balance(State(m): State<M>, Path(login): Path<i64>, Json(b): Json<Value>) -> (axum::http::StatusCode, Json<Value>) {
    let mut g = m.lock().unwrap();
    let key = b["idempotencyKey"].as_str().unwrap_or("").to_string();
    if !g.keys.insert(key.clone()) {
        return (axum::http::StatusCode::CONFLICT, Json(json!({"error": {"code": "duplicate_idempotency_key", "message": "already booked"}})));
    }
    let amount = D::from_str(b["amount"].as_str().unwrap()).unwrap();
    let kind = b["type"].as_str().unwrap().to_string();
    assert!(b["reasonCode"].as_str().unwrap().starts_with("GRW-"), "every growth posting carries a GRW reason code");
    let acc = g.accounts.get_mut(&login).expect("account");
    let field = match kind.as_str() {
        "bonus" => "bonus",
        "credit" => "credit",
        _ => "balance",
    };
    let cur = D::from_str(&acc[field].to_string()).unwrap();
    acc[field] = json!((cur + amount).to_string().parse::<f64>().unwrap());
    g.postings.push((login, kind, amount, key));
    (axum::http::StatusCode::OK, Json(json!({"data": {"txn": 1}})))
}

async fn m_ledger(State(m): State<M>, Path(login): Path<i64>) -> Json<Value> {
    Json(json!({"items": m.lock().unwrap().ledgers.get(&login).cloned().unwrap_or_default()}))
}

async fn m_wallet(State(m): State<M>, Json(b): Json<Value>) -> (axum::http::StatusCode, Json<Value>) {
    let mut g = m.lock().unwrap();
    if g.wallet_fail_next > 0 {
        g.wallet_fail_next -= 1;
        return (axum::http::StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": {"code": "unavailable"}})));
    }
    let key = b["idempotency_key"].as_str().unwrap().to_string();
    let replay = g.wallet.iter().any(|w| w.0 == key);
    if !replay {
        g.wallet.push((key, b["user_id"].as_i64().unwrap(), D::from_str(b["amount"].as_str().unwrap()).unwrap(), b["kind"].as_str().unwrap().to_string()));
    }
    (axum::http::StatusCode::OK, Json(json!({"status": "completed", "txn_id": g.wallet.len(), "replayed": replay})))
}

async fn mock() -> (String, M) {
    let m: M = Arc::new(Mutex::new(Mock::default()));
    let app = Router::new()
        .route("/v1/admin/accounts", get(m_accounts))
        .route("/v1/admin/accounts/{login}", get(m_account))
        .route("/v1/admin/accounts/{login}/balance", post(m_balance))
        .route("/v1/accounts/{login}/ledger", get(m_ledger))
        .route("/v1/wallets/transfers", post(m_wallet))
        .with_state(m.clone());
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    (url, m)
}

fn account(login: i64, user: i64, kind: &str) -> Value {
    json!({"login": login, "userId": user, "type": kind, "group": "standard", "cent": false, "currency": "USD", "status": "active",
           "balance": 1000.0, "credit": 0.0, "bonus": 0.0, "equity": 1000.0})
}

// ---------------------------------------------------------------- env

struct Env {
    st: AppState,
    m: M,
    admin: PgConnectOptions,
    name: String,
}

async fn env() -> Option<Env> {
    let base = std::env::var("GROWTH_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping growth DB tests: no PostgreSQL at {base}");
        return None;
    }
    let name = format!("kalks_growth_test_{}_{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst));
    let url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&url).await.expect("create + migrate");
    db::seed(&pool, "kalks").await.unwrap();
    let (mock_url, m) = mock().await;
    let mut cfg = Config::for_tests(&url);
    cfg.trading_url = mock_url.clone();
    cfg.wallet_url = mock_url;
    Some(Env { st: AppState::new(pool, cfg), m, admin, name })
}

impl Env {
    async fn drop(self) {
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    fn add_account(&self, login: i64, user: i64, kind: &str) {
        self.m.lock().unwrap().accounts.insert(login, account(login, user, kind));
    }

    async fn deal(&self, login: i64, user: i64, kind: &str, symbol: &str, lots: &str, profit: &str, opened_ago_min: i64) -> Option<deals::Produced> {
        let p = Programme::load(&self.st, "kalks").await.unwrap();
        let now = Utc::now();
        let d = DealIn {
            deal_id: DEAL.fetch_add(1, Ordering::SeqCst),
            tenant: "kalks".into(),
            login,
            user_id: user,
            symbol: symbol.into(),
            side: "buy".into(),
            volume: dec(lots),
            profit: dec(profit),
            open_time: now - Duration::minutes(opened_ago_min),
            close_time: now,
            kind: "close".into(),
            reversed: false,
            account: AccountFacts { kind: kind.into(), group: "standard".into(), cent: false },
            option: false,
        };
        deals::ingest(&self.st, &p, &d).await.unwrap()
    }

    /// A Kalks FX Options closing deal (volume = contracts).
    async fn option_deal(&self, login: i64, user: i64, contracts: &str, profit: &str, opened_ago_min: i64) -> (i64, Option<deals::Produced>) {
        let p = Programme::load(&self.st, "kalks").await.unwrap();
        let now = Utc::now();
        let id = DEAL.fetch_add(1, Ordering::SeqCst);
        let d = DealIn {
            deal_id: id,
            tenant: "kalks".into(),
            login,
            user_id: user,
            symbol: "EURUSD-20261009-1.1650-C".into(),
            side: "buy".into(),
            volume: dec(contracts),
            profit: dec(profit),
            open_time: now - Duration::minutes(opened_ago_min),
            close_time: now,
            kind: "expiry".into(),
            reversed: false,
            account: AccountFacts { kind: "live".into(), group: "standard".into(), cent: false },
            option: true,
        };
        (id, deals::ingest(&self.st, &p, &d).await.unwrap())
    }

    async fn one<T: for<'r> sqlx::Decode<'r, sqlx::Postgres> + sqlx::Type<sqlx::Postgres> + Send + Unpin>(&self, sql: &str) -> T {
        sqlx::query_scalar::<_, T>(sqlx::AssertSqlSafe(sql.to_string())).fetch_one(&self.st.pool).await.unwrap()
    }
}

// ---------------------------------------------------------------- tests

#[tokio::test]
async fn deals_earn_points_and_cashback_once() {
    let Some(e) = env().await else { return };
    sqlx::query("INSERT INTO cashback_programmes (tenant, name, asset_classes, usd_per_lot, max_per_month) VALUES ('kalks', 'FX cashback', '{forex}', 2.5, 6)").execute(&e.st.pool).await.unwrap();

    // 2 lots EURUSD on live, held 5 min: forex 10 pts/lot × Bronze 1.0 = 20 pts; cashback 2 × 2.5 = 5
    let p = e.deal(10000001, 42, "live", "EURUSD", "2", "35", 5).await.unwrap();
    assert_eq!(p.points, 20);
    assert_eq!(p.cashback, dec("5"));
    // a deal id seen before is ignored
    let dup = 9_000_001;
    let prog = Programme::load(&e.st, "kalks").await.unwrap();
    let again = DealIn {
        deal_id: dup,
        tenant: "kalks".into(),
        login: 10000001,
        user_id: 42,
        symbol: "EURUSD".into(),
        side: "buy".into(),
        volume: dec("2"),
        profit: D::ZERO,
        open_time: Utc::now() - Duration::minutes(5),
        close_time: Utc::now(),
        kind: "close".into(),
        reversed: false,
        account: AccountFacts { kind: "live".into(), group: "standard".into(), cent: false },
        option: false,
    };
    assert_eq!(deals::ingest(&e.st, &prog, &again).await.unwrap().unwrap().points, 20);
    assert!(deals::ingest(&e.st, &prog, &again).await.unwrap().is_none());
    // monthly cap 6: 5 + 1 reached, the next 2 lots accrue nothing (points still earn)
    let p = e.deal(10000001, 42, "live", "GBPUSD", "2", "0", 5).await.unwrap();
    assert_eq!((p.points, p.cashback), (20, D::ZERO));
    // scalps (< 60 s) earn no points; demo earns no points or cashback
    let p = e.deal(10000001, 42, "live", "XAUUSD", "1", "0", 0).await.unwrap();
    assert_eq!(p.points, 0);
    let p = e.deal(50000001, 42, "demo", "EURUSD", "5", "0", 10).await.unwrap();
    assert_eq!((p.points, p.cashback), (0, D::ZERO));
    // metals rule (15/lot) on 1.5 lots
    let p = e.deal(10000001, 42, "live", "XAUUSD", "1.5", "0", 10).await.unwrap();
    assert_eq!(p.points, 22);
    assert_eq!(loyalty::balance(&e.st.pool, "kalks", 42).await.unwrap(), 20 + 20 + 20 + 22);

    // cashback payout: one wallet transfer (refund) for the client, idempotent
    let (n, total) = payouts::cashback_batch(&e.st, "kalks", true).await.unwrap();
    assert_eq!((n, total), (1, dec("6")), "cap 6 reached: 5 + 1 + 0");
    e.m.lock().unwrap().wallet_fail_next = 1;
    assert_eq!(payouts::cashback_tick(&e.st).await.unwrap(), 0, "wallet down: retried later");
    sqlx::query("UPDATE cashback_payouts SET next_try_at = now()").execute(&e.st.pool).await.unwrap();
    assert_eq!(payouts::cashback_tick(&e.st).await.unwrap(), 1);
    let w = e.m.lock().unwrap().wallet.clone();
    assert_eq!(w.len(), 1);
    assert_eq!((w[0].1, w[0].2, w[0].3.as_str()), (42, dec("6"), "refund"));
    assert_eq!(e.one::<i64>("SELECT count(*) FROM cashback_accruals WHERE status = 'paid'").await, 2, "the capped-out deal accrued nothing");

    // reversal: points reversed, nothing else double counted
    deals::reverse_deal(&e.st, dup).await.unwrap();
    assert_eq!(loyalty::balance(&e.st.pool, "kalks", 42).await.unwrap(), 62);
    e.drop().await;
}

#[tokio::test]
async fn bonus_grant_releases_per_lot_and_is_removed_on_withdrawal() {
    let Some(e) = env().await else { return };
    let login = 10000011;
    e.add_account(login, 7, "live");
    let cid: i64 = sqlx::query_scalar("INSERT INTO bonus_campaigns (tenant, name, kind, fixed_amount, release_per_lot, expiry_days, status) VALUES ('kalks','Welcome $100','fixed',100,10,30,'active') RETURNING id")
        .fetch_one(&e.st.pool)
        .await
        .unwrap();
    let acc = clients::account(&e.st, "kalks", login).await.unwrap().unwrap();
    let mut tx = e.st.pool.begin().await.unwrap();
    let opts = ClaimOpts { source: "claim", require_public: true, amount_override: None, note: None, skip_limits: false };
    let gid = bonus::claim_in(&mut tx, "kalks", 7, cid, Some(&acc), &Segment::default(), &opts).await.unwrap();
    tx.commit().await.unwrap();
    // a second claim is refused (per-user limit 1)
    let mut tx = e.st.pool.begin().await.unwrap();
    assert!(bonus::claim_in(&mut tx, "kalks", 7, cid, Some(&acc), &Segment::default(), &opts).await.is_err());
    drop(tx);

    assert_eq!(bonus::post_tick(&e.st).await.unwrap(), 1);
    assert_eq!(e.one::<String>(&format!("SELECT status FROM bonus_grants WHERE id = {gid}")).await, "active");
    assert_eq!(e.m.lock().unwrap().accounts[&login]["bonus"], json!(100.0));
    sqlx::query("UPDATE bonus_grants SET granted_at = now() - interval '1 hour'").execute(&e.st.pool).await.unwrap();

    // 3 lots release $30: bonus −30, balance +30
    let p = e.deal(login, 7, "live", "EURUSD", "3", "0", 10).await.unwrap();
    assert_eq!(p.bonus_released, dec("30"));
    assert_eq!(bonus::post_tick(&e.st).await.unwrap(), 1);
    {
        let g = e.m.lock().unwrap();
        assert_eq!(g.accounts[&login]["bonus"], json!(70.0));
        assert_eq!(g.accounts[&login]["balance"], json!(1030.0));
        assert_eq!(g.postings.len(), 3);
    }
    // nothing pending: no new postings
    assert_eq!(bonus::post_tick(&e.st).await.unwrap(), 0);
    assert_eq!(e.m.lock().unwrap().postings.len(), 3);

    // withdrawal while the bonus is active: the remaining $70 is removed
    e.m.lock().unwrap().ledgers.insert(login, vec![json!({"txn": 9, "kind": "transfer_out", "subLedger": "balance", "amount": -50.0, "currency": "USD", "at": Utc::now().to_rfc3339()})]);
    assert_eq!(bonus::lifecycle_tick(&e.st).await.unwrap(), 1);
    assert_eq!(e.one::<String>(&format!("SELECT status FROM bonus_grants WHERE id = {gid}")).await, "forfeited");
    bonus::post_tick(&e.st).await.unwrap();
    assert_eq!(e.m.lock().unwrap().accounts[&login]["bonus"], json!(0.0));
    // later lots release nothing
    let p = e.deal(login, 7, "live", "EURUSD", "3", "0", 10).await.unwrap();
    assert_eq!(p.bonus_released, D::ZERO);
    e.drop().await;
}

#[tokio::test]
async fn deposit_bonus_completes_after_enough_lots() {
    let Some(e) = env().await else { return };
    let login = 10000021;
    e.add_account(login, 8, "live");
    let cid: i64 = sqlx::query_scalar(
        "INSERT INTO bonus_campaigns (tenant, name, kind, pct, cap, min_deposit, release_per_lot, expiry_days, status) VALUES ('kalks','50% deposit','deposit',50,120,100,20,30,'active') RETURNING id",
    )
    .fetch_one(&e.st.pool)
    .await
    .unwrap();
    let mut tx = e.st.pool.begin().await.unwrap();
    let opts = ClaimOpts { source: "claim", require_public: true, amount_override: None, note: None, skip_limits: false };
    let gid = bonus::claim_in(&mut tx, "kalks", 8, cid, None, &Segment::default(), &opts).await.unwrap();
    tx.commit().await.unwrap();
    assert_eq!(bonus::deposit_tick(&e.st).await.unwrap(), 0, "no deposit yet");
    // a $300 deposit → 50% = 150, capped at 120
    e.m.lock().unwrap().ledgers.insert(login, vec![json!({"txn": 5, "kind": "transfer_in", "subLedger": "balance", "amount": 300.0, "currency": "USD", "at": (Utc::now() + Duration::seconds(1)).to_rfc3339()})]);
    sqlx::query("UPDATE bonus_grants SET ledger_checked = NULL").execute(&e.st.pool).await.unwrap();
    assert_eq!(bonus::deposit_tick(&e.st).await.unwrap(), 1);
    assert_eq!(e.one::<D>(&format!("SELECT amount FROM bonus_grants WHERE id = {gid}")).await, dec("120"));
    bonus::post_tick(&e.st).await.unwrap();
    sqlx::query("UPDATE bonus_grants SET granted_at = now() - interval '1 hour'").execute(&e.st.pool).await.unwrap();
    // 120 / 20 per lot = 6 lots: 4 + 4 → the second deal releases only the last 40
    assert_eq!(e.deal(login, 8, "live", "EURUSD", "4", "0", 10).await.unwrap().bonus_released, dec("80"));
    assert_eq!(e.deal(login, 8, "live", "EURUSD", "4", "0", 10).await.unwrap().bonus_released, dec("40"));
    assert_eq!(e.one::<String>(&format!("SELECT status FROM bonus_grants WHERE id = {gid}")).await, "completed");
    bonus::post_tick(&e.st).await.unwrap();
    let g = e.m.lock().unwrap();
    assert_eq!(g.accounts[&login]["bonus"], json!(0.0));
    assert_eq!(g.accounts[&login]["balance"], json!(1120.0));
    drop(g);
    e.drop().await;
}

#[tokio::test]
async fn promo_limits_hold_under_concurrency() {
    let Some(e) = env().await else { return };
    sqlx::query("INSERT INTO promo_codes (tenant, code, kind, points, max_uses, per_user_limit) VALUES ('kalks','FIVE','points',500,5,1)").execute(&e.st.pool).await.unwrap();
    let mut tasks = vec![];
    for u in 0..20 {
        let st = e.st.clone();
        tasks.push(tokio::spawn(async move { promos::redeem(&st, "kalks", 1000 + u, "five", None, &Segment::default()).await.is_ok() }));
    }
    let mut ok = 0;
    for t in tasks {
        if t.await.unwrap() {
            ok += 1;
        }
    }
    assert_eq!(ok, 5);
    assert_eq!(e.one::<i32>("SELECT uses FROM promo_codes WHERE code = 'FIVE'").await, 5);
    assert_eq!(e.one::<i64>("SELECT count(*) FROM promo_redemptions WHERE status = 'blocked'").await, 15);
    assert_eq!(e.one::<i64>("SELECT sum(points)::bigint FROM points_ledger WHERE kind = 'promo'").await, 2500);

    // per-client limit, window and segment rules
    sqlx::query("INSERT INTO promo_codes (tenant, code, kind, points, per_user_limit, countries, kyc_required) VALUES ('kalks','INONLY','points',100,1,'{IN}',true)").execute(&e.st.pool).await.unwrap();
    let verified_in = Segment { country: "IN".into(), kyc: "verified".into(), signed_up_at: None };
    assert!(promos::redeem(&e.st, "kalks", 1, "INONLY", None, &Segment { country: "AE".into(), ..verified_in.clone() }).await.is_err());
    assert!(promos::redeem(&e.st, "kalks", 1, "INONLY", None, &Segment { kyc: "pending".into(), ..verified_in.clone() }).await.is_err());
    assert!(promos::redeem(&e.st, "kalks", 1, "INONLY", None, &verified_in).await.is_ok());
    assert!(promos::redeem(&e.st, "kalks", 1, "inonly", None, &verified_in).await.is_err(), "once per client");
    assert!(promos::redeem(&e.st, "kalks", 1, "NOPE", None, &verified_in).await.is_err());
    e.drop().await;
}

#[tokio::test]
async fn contest_scores_ranks_and_pays() {
    let Some(e) = env().await else { return };
    let cid: i64 = sqlx::query_scalar(
        "INSERT INTO contests (tenant, slug, name, kind, starts_at, ends_at, scoring, min_trades, starting_balance, prizes)
         VALUES ('kalks','sprint','Sprint','demo', now() - interval '2 hours', now() + interval '1 hour','return_pct',2,10000,
                 '[{\"rankFrom\":1,\"rankTo\":1,\"amount\":300,\"payout\":\"wallet\"},{\"rankFrom\":2,\"rankTo\":3,\"amount\":50,\"payout\":\"wallet\"}]') RETURNING id",
    )
    .fetch_one(&e.st.pool)
    .await
    .unwrap();
    for (i, (login, user)) in [(50000101, 101), (50000102, 102), (50000103, 103)].iter().enumerate() {
        e.add_account(*login, *user, "demo");
        e.m.lock().unwrap().accounts.get_mut(login).unwrap()["equity"] = json!(1000.0 + i as f64 * 10.0);
        sqlx::query("INSERT INTO contest_entries (contest_id, tenant, user_id, login, display_name, start_equity, joined_at) VALUES ($1,'kalks',$2,$3,$4,10000, now() - make_interval(mins => $5))")
            .bind(cid)
            .bind(user)
            .bind(login)
            .bind(format!("Trader {user}"))
            .bind(30 - i as i32)
            .execute(&e.st.pool)
            .await
            .unwrap();
    }
    // 101: +500 over 2 trades (5%); 102: +900 over 1 trade (unqualified); 103: +200 over 3 trades (2%)
    e.deal(50000101, 101, "demo", "EURUSD", "1", "300", 30).await;
    e.deal(50000101, 101, "demo", "EURUSD", "1", "200", 30).await;
    e.deal(50000102, 102, "demo", "EURUSD", "5", "900", 30).await;
    for _ in 0..3 {
        e.deal(50000103, 103, "demo", "XAUUSD", "1", "66.67", 30).await;
    }
    // a deal opened before the contest start does not count
    e.deal(50000103, 103, "demo", "XAUUSD", "1", "5000", 600).await;
    contests::refresh(&e.st, cid).await.unwrap();
    let ranks: Vec<(i64, Option<i32>)> = sqlx::query_as("SELECT user_id, rank FROM contest_entries WHERE contest_id = $1 ORDER BY user_id").bind(cid).fetch_all(&e.st.pool).await.unwrap();
    assert_eq!(ranks, vec![(101, Some(1)), (102, Some(3)), (103, Some(2))]);
    assert_eq!(e.one::<D>("SELECT return_pct FROM contest_entries WHERE user_id = 101").await, dec("5"));

    let actor = growth::audit::Actor { id: "staff:1".into(), name: Some("T".into()) };
    assert!(contests::finalize(&e.st, cid, &actor).await.is_err(), "not ended yet");
    sqlx::query("UPDATE contests SET ends_at = now() - interval '1 second' WHERE id = $1").bind(cid).execute(&e.st.pool).await.unwrap();
    contests::finalize(&e.st, cid, &actor).await.unwrap();
    // 102 is unqualified: ranked 3 but wins nothing
    let prizes: Vec<(i64, Option<D>)> = sqlx::query_as("SELECT user_id, prize_amount FROM contest_entries WHERE contest_id = $1 ORDER BY user_id").bind(cid).fetch_all(&e.st.pool).await.unwrap();
    assert_eq!(prizes, vec![(101, Some(dec("300"))), (102, None), (103, Some(dec("50")))]);
    let r = contests::pay(&e.st, cid, &actor).await.unwrap();
    assert_eq!(r["paid"], 2);
    let paid: i64 = e.one("SELECT count(*) FROM contest_entries WHERE prize_status = 'paid'").await;
    assert_eq!(paid, 2);
    // paying again books nothing new
    contests::pay(&e.st, cid, &actor).await.unwrap();
    assert_eq!(e.m.lock().unwrap().wallet.len(), 2);
    e.drop().await;
}

#[tokio::test]
async fn redemption_pays_wallet_with_retry() {
    let Some(e) = env().await else { return };
    sqlx::query("INSERT INTO points_ledger (tenant, user_id, kind, points, ref, description) VALUES ('kalks', 9, 'promo', 1500, 't', 'test')").execute(&e.st.pool).await.unwrap();
    let item: i64 = e.one("SELECT id FROM catalogue WHERE kind = 'cashback' ORDER BY cost_points LIMIT 1").await;
    e.m.lock().unwrap().wallet_fail_next = 1;
    let r = loyalty::redeem(&e.st, "kalks", 9, item, None).await.unwrap();
    assert_eq!(r["balance"], 500);
    assert!(loyalty::redeem(&e.st, "kalks", 9, item, None).await.is_err(), "not enough points");
    payouts::wallet_tick(&e.st).await.unwrap();
    assert_eq!(e.one::<String>("SELECT status FROM redemptions").await, "pending");
    sqlx::query("UPDATE wallet_credits SET next_try_at = now()").execute(&e.st.pool).await.unwrap();
    payouts::wallet_tick(&e.st).await.unwrap();
    assert_eq!(e.one::<String>("SELECT status FROM redemptions").await, "completed");
    let w = e.m.lock().unwrap().wallet.clone();
    assert_eq!(w.len(), 1);
    assert_eq!((w[0].2, w[0].3.as_str()), (dec("10"), "adjustment"));
    // voucher redemption + internal voucher use is idempotent on ref
    sqlx::query("INSERT INTO points_ledger (tenant, user_id, kind, points, ref, description) VALUES ('kalks', 9, 'promo', 3000, 't2', 'test')").execute(&e.st.pool).await.unwrap();
    let disc: i64 = e.one("SELECT id FROM catalogue WHERE kind = 'fee_discount'").await;
    let r = loyalty::redeem(&e.st, "kalks", 9, disc, None).await.unwrap();
    assert!(r["redemption"]["voucherCode"].as_str().unwrap().starts_with("KV-"));
    e.drop().await;
}

#[tokio::test]
async fn option_deals_and_premiums_earn_no_rewards_and_never_move_contests() {
    let Some(e) = env().await else { return };
    let login = 10000031;
    e.add_account(login, 51, "live");
    // every reward is switched on for this client: FX cashback, a bonus releasing per lot, a running live contest
    sqlx::query("INSERT INTO cashback_programmes (tenant, name, usd_per_lot) VALUES ('kalks', 'All cashback', 3)").execute(&e.st.pool).await.unwrap();
    let cid: i64 = sqlx::query_scalar("INSERT INTO bonus_campaigns (tenant, name, kind, fixed_amount, release_per_lot, expiry_days, status) VALUES ('kalks','Welcome $100','fixed',100,10,30,'active') RETURNING id")
        .fetch_one(&e.st.pool)
        .await
        .unwrap();
    let acc = clients::account(&e.st, "kalks", login).await.unwrap().unwrap();
    let mut tx = e.st.pool.begin().await.unwrap();
    let opts = ClaimOpts { source: "claim", require_public: true, amount_override: None, note: None, skip_limits: false };
    let gid = bonus::claim_in(&mut tx, "kalks", 51, cid, Some(&acc), &Segment::default(), &opts).await.unwrap();
    tx.commit().await.unwrap();
    bonus::post_tick(&e.st).await.unwrap();
    sqlx::query("UPDATE bonus_grants SET granted_at = now() - interval '1 hour'").execute(&e.st.pool).await.unwrap();
    let contest: i64 = sqlx::query_scalar(
        "INSERT INTO contests (tenant, slug, name, kind, starts_at, ends_at, scoring, min_trades) VALUES ('kalks','opt','Live sprint','live', now() - interval '2 hours', now() + interval '1 hour','profit',0) RETURNING id",
    )
    .fetch_one(&e.st.pool)
    .await
    .unwrap();
    let entry: i64 = sqlx::query_scalar("INSERT INTO contest_entries (contest_id, tenant, user_id, login, display_name, start_equity, joined_at) VALUES ($1,'kalks',51,$2,'T51',1000, now() - interval '90 minutes') RETURNING id")
        .bind(contest)
        .bind(login)
        .fetch_one(&e.st.pool)
        .await
        .unwrap();

    // 20 contracts settled with a big profit, held long enough: nothing at all
    let (oid, p) = e.option_deal(login, 51, "20", "450", 60).await;
    assert_eq!(p.unwrap(), deals::Produced::default(), "no points, cashback, bonus release or contest entry");
    assert_eq!(e.one::<i64>(&format!("SELECT count(*) FROM deals WHERE deal_id = {oid} AND instrument = 'option' AND lots = 0 AND asset_class = 'options'")).await, 1);
    assert_eq!(e.one::<i64>("SELECT count(*) FROM points_ledger WHERE user_id = 51").await, 0);
    assert_eq!(e.one::<i64>("SELECT count(*) FROM cashback_accruals WHERE user_id = 51").await, 0);
    assert_eq!(e.one::<i64>("SELECT count(*) FROM contest_trades").await, 0);
    assert_eq!(e.one::<D>(&format!("SELECT lots_traded FROM bonus_grants WHERE id = {gid}")).await, D::ZERO);
    assert_eq!(e.one::<D>(&format!("SELECT released FROM bonus_grants WHERE id = {gid}")).await, D::ZERO);
    // seen once (the poller overlap re-reads it), and its reversal (an options void) is harmless
    let prog = Programme::load(&e.st, "kalks").await.unwrap();
    let again = DealIn {
        deal_id: oid,
        tenant: "kalks".into(),
        login,
        user_id: 51,
        symbol: "EURUSD-20261009-1.1650-C".into(),
        side: "buy".into(),
        volume: dec("20"),
        profit: dec("450"),
        open_time: Utc::now() - Duration::minutes(60),
        close_time: Utc::now(),
        kind: "expiry".into(),
        reversed: false,
        account: AccountFacts { kind: "live".into(), group: "standard".into(), cent: false },
        option: false, // even without the flag, the series code gives it away
    };
    assert!(deals::ingest(&e.st, &prog, &again).await.unwrap().is_none());
    deals::reverse_deal(&e.st, oid).await.unwrap();
    assert_eq!(e.one::<i64>("SELECT count(*) FROM points_ledger WHERE user_id = 51").await, 0);
    // an unflagged deal with an option series code is still treated as an option
    let p = Programme::load(&e.st, "kalks").await.unwrap();
    let sneaky = DealIn { deal_id: DEAL.fetch_add(1, Ordering::SeqCst), ..again.clone() };
    assert_eq!(deals::ingest(&e.st, &p, &sneaky).await.unwrap().unwrap(), deals::Produced::default());

    // a CFD deal of the same client still earns everything (cashback 2 × 3, release 2 × 10, contest trade)
    let pr = e.deal(login, 51, "live", "EURUSD", "2", "35", 60).await.unwrap();
    assert_eq!((pr.cashback, pr.bonus_released, pr.contest_entries), (dec("6"), dec("20"), 1));
    assert!(pr.points > 0);

    // the contest score: the client holds a bought option worth 300 in equity (the premium already left the
    // balance) plus a CFD floating +10. Only the CFD part counts; premium / settlement postings are no balance change.
    {
        let mut g = e.m.lock().unwrap();
        let a = g.accounts.get_mut(&login).unwrap();
        // equity = balance 700 + bonus 100 + CFD floating 10 + options 300
        a["balance"] = json!(700.0);
        a["bonus"] = json!(100.0);
        a["equity"] = json!(1110.0);
        a["optionValue"] = json!(300.0);
        g.ledgers.insert(
            login,
            vec![
                json!({"txn": 41, "kind": "option_premium", "subLedger": "balance", "amount": -300.0, "currency": "USD", "at": Utc::now().to_rfc3339()}),
                json!({"txn": 42, "kind": "option_settlement", "subLedger": "balance", "amount": 450.0, "currency": "USD", "at": Utc::now().to_rfc3339()}),
            ],
        );
    }
    let acc = clients::account(&e.st, "kalks", login).await.unwrap().unwrap();
    assert_eq!((acc.floating_usd(), acc.equity_ex_options_usd()), (dec("10"), dec("810")));
    contests::refresh(&e.st, contest).await.unwrap();
    let (realised, floating, score, status): (D, D, D, String) = sqlx::query_as("SELECT realised, floating, score, status FROM contest_entries WHERE id = $1").bind(entry).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!((realised, floating, score), (dec("35"), dec("10"), dec("45")), "the CFD trade only");
    assert_eq!(status, "active", "option premiums and settlements are not deposits or withdrawals");
    assert_eq!(e.one::<i64>(&format!("SELECT count(*) FROM contest_flags WHERE entry_id = {entry} AND kind = 'balance_change'")).await, 0);
    // nor do they forfeit the bonus like a withdrawal would
    sqlx::query("UPDATE bonus_grants SET ledger_checked = NULL").execute(&e.st.pool).await.unwrap();
    assert_eq!(bonus::lifecycle_tick(&e.st).await.unwrap(), 0);
    assert_eq!(e.one::<String>(&format!("SELECT status FROM bonus_grants WHERE id = {gid}")).await, "active");
    e.drop().await;
}
