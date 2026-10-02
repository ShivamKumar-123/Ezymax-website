//! Account lifecycle through the Client Area handlers (api/lifecycle.rs) against PostgreSQL: archive is refused
//! with open positions unless `empty`; a demo with a position is emptied and archived; archived accounts don't
//! count towards the account limit; restore brings the prior status back; rename; replaying the `events` table
//! after all of it gives the same state.
//!
//! Skipped with a message when PostgreSQL is not reachable (TRADING_TEST_DATABASE_URL, default :5433).

use axum::extract::{FromRequestParts, Path, Query, State};
use axum::http::HeaderMap;
use chrono::Utc;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use std::sync::atomic::AtomicI64;
use std::sync::{Arc, RwLock};

use trading::api::{AppState, Body, Ctx, LoginAlloc, accounts, lifecycle};
use trading::auth::{Keys, Limiter, StreamTickets};
use trading::config::Config;
use trading::engine::trade::{self, OrderReq};
use trading::engine::{Ids, Quote};
use trading::feed::QuoteBook;
use trading::model::{Side, Status};
use trading::money::D;
use trading::rules::Registry;
use trading::shard::{Hub, Index, NullLp, Op, Shared, Stats, Streams};
use trading::specs::Specs;

const USER: i64 = 4242;

fn headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("x-kalks-user-id", USER.to_string().parse().unwrap());
    h
}

fn q<T: serde::de::DeserializeOwned>() -> Query<T> {
    Query(serde_json::from_value(json!({})).unwrap())
}

fn body<T: serde::de::DeserializeOwned>(v: Value) -> Body<T> {
    Body(serde_json::from_value(v).unwrap())
}

async fn ctx(st: &AppState) -> Ctx {
    let req = axum::http::Request::builder().header("x-kalks-tenant", "kalks").body(()).unwrap();
    let (mut parts, _) = req.into_parts();
    Ctx::from_request_parts(&mut parts, st).await.unwrap_or_else(|_| panic!("tenant"))
}

async fn open_demo(st: &AppState, group: &str) -> Result<i64, trading::api::ApiError> {
    let body = serde_json::from_value(json!({"type": "demo", "group": group, "password": "Passw0rd!x1", "investorPassword": "Inv3stor!x2"})).unwrap();
    let r = accounts::open(State(st.clone()), ctx(st).await, headers(), Body(body)).await?;
    Ok(r.0["account"]["login"].as_i64().unwrap())
}

async fn snapshot(hub: &Hub, login: i64) -> Value {
    hub.read(login, Box::new(|x| x.map(|(s, _)| serde_json::to_value(s).unwrap()).unwrap_or(Value::Null))).await
}

#[test]
fn account_json_without_lifecycle_still_reads() {
    let old = json!({
        "tenant_id": 1, "login": 5, "user_id": 7, "kind": "demo", "group": "standard", "mode": "hedging", "cent": false,
        "leverage": 100, "status": "active", "name": "", "route_override": null,
        "controls": {"trading_disabled": false, "close_only": false, "max_lot": null, "exec_delay_ms": 0, "markup_pips": "0", "reason": "", "set_by": "", "updated": null},
        "demo": null, "created_at": "2026-01-01T00:00:00Z"
    });
    let a: trading::model::Account = serde_json::from_value(old).unwrap();
    assert!(a.lifecycle.is_none());
    // and it is not written back when absent (old readers see the same JSON)
    assert!(serde_json::to_value(&a).unwrap().get("lifecycle").is_none());
    assert_eq!(Status::parse("archived"), Some(Status::Archived));
    assert!(Status::Closed.is_retired() && !Status::Expired.is_retired());
}

#[tokio::test]
async fn archive_restore_rename_and_replay() {
    let base = std::env::var("TRADING_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let db = format!("kalks_trading_lifecycle_{}", std::process::id());
    let Ok(server) = PgConnectOptions::from_str(&base) else { return };
    if server.clone().database("postgres").connect().await.is_err() {
        eprintln!("SKIP: PostgreSQL not reachable at {base}");
        return;
    }
    let url = server.clone().database(&db).to_url_lossy().to_string();
    let pool = trading::persist::connect(&url).await.expect("connect + migrate");
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config");
    let specs = Arc::new(Specs::load(&format!("{root}/instruments.json"), &format!("{root}/trading-specs.json")).unwrap());
    let registry = Registry::default();
    for t in trading::persist::load_registry(&pool).await.unwrap() {
        registry.put(t);
    }
    let (ticket, deal, txn, live, demo) = trading::persist::max_ids(&pool).await.unwrap();
    let quotes = Arc::new(QuoteBook::default());
    let shared = Arc::new(Shared {
        pool: pool.clone(),
        registry: registry.clone(),
        specs,
        quotes: quotes.clone(),
        ids: Arc::new(Ids::new(ticket, deal, txn)),
        index: Arc::new(RwLock::new(Index::default())),
        streams: Streams::default(),
        stats: Arc::new(Stats::default()),
        lp: Arc::new(NullLp),
        max_quote_age_ms: 0,
        restrictions: Default::default(),
    });
    let hub = Hub::start(shared, 2, Default::default());
    let logins = Arc::new(LoginAlloc { live: AtomicI64::new(live), demo: AtomicI64::new(demo) });
    let social = trading::social::Social::new(pool.clone(), hub.clone(), trading::social::wallet::WalletClient::new("", ""), logins.clone()).await.unwrap();
    let cfg = Config {
        bind: String::new(), database_url: url.clone(), internal_token: String::new(), session_secret: "s".repeat(40), dev_mode: true,
        market_data_ws: String::new(), instruments_file: String::new(), specs_file: String::new(), shards: 1, max_quote_age_ms: 0, session_ttl_hours: 12,
        json_logs: false, rollover_enabled: false, wallet_url: String::new(), wallet_token: String::new(), ib_url: String::new(), ib_token: String::new(),
        gateway_url: String::new(), gateway_token: String::new(),
    };
    let st = AppState {
        hub: hub.clone(), pool: pool.clone(), keys: Keys::new(&cfg.session_secret), cfg: Arc::new(cfg.clone()), limiter: Limiter::default(),
        tickets: StreamTickets::default(), logins, open_lock: Arc::new(tokio::sync::Mutex::new(())), social,
        presence: Arc::new(trading::controls::Presence::default()),
        gateway: Arc::new(trading::controls::Gateway::new(&cfg.gateway_url, &cfg.gateway_token)),
    };
    let c = ctx(&st).await;
    let g = c.tenant.groups.values().filter(|g| g.enabled && g.allows("demo") && !g.code.starts_with("prop")).min_by_key(|g| g.code.clone()).expect("a demo group").clone();
    quotes.set(&g.spread_group, "BTCUSD", Quote { bid: D::from(80_000), ask: D::from(80_020), t_ms: Utc::now().timestamp_millis() });

    // fill the account limit of the group
    let mut mine = Vec::new();
    for _ in 0..g.max_accounts_per_user {
        mine.push(open_demo(&st, &g.code).await.unwrap_or_else(|e| panic!("open: {e:?}")));
    }
    assert!(open_demo(&st, &g.code).await.is_err(), "limit reached");
    let a = mine[0];

    // a position: archive without `empty` is refused, the check says why
    let op: Op = Box::new(|tx, env| trade::place_order(tx, env, OrderReq::market("BTCUSD", Side::Buy, D::from_str("0.01").unwrap())).map(|_| Value::Null));
    hub.exec(a, "test", None, "", "", None, op).await.unwrap();
    let chk = lifecycle::archive_check(State(st.clone()), ctx(&st).await, headers(), Path(a), q()).await.unwrap().0;
    assert_eq!((chk["positions"].as_u64(), chk["needsEmpty"].as_bool(), chk["canArchive"].as_bool()), (Some(1), Some(true), Some(true)), "{chk}");
    let refused = lifecycle::archive(State(st.clone()), ctx(&st).await, headers(), Path(a), q(), body(json!({"empty": false}))).await;
    assert!(refused.is_err());
    assert_eq!(hub.meta(a).unwrap().status, Status::Active);

    // someone else's account is a 404
    let mut other = HeaderMap::new();
    other.insert("x-kalks-user-id", "999".parse().unwrap());
    assert!(lifecycle::archive_check(State(st.clone()), ctx(&st).await, other, Path(a), q()).await.is_err());

    // empty = true: the position is closed and the demo archived
    let done = lifecycle::archive(State(st.clone()), ctx(&st).await, headers(), Path(a), q(), body(json!({"empty": true}))).await.unwrap().0;
    assert_eq!(done["ok"], json!(true), "{done}");
    assert_eq!(done["steps"].as_array().unwrap().iter().map(|s| s["step"].as_str().unwrap()).collect::<Vec<_>>(), vec!["close_positions", "archive"]);
    let snap = snapshot(&hub, a).await;
    assert!(snap["positions"].as_object().unwrap().is_empty());
    assert_eq!(snap["account"]["status"], json!("archived"));
    assert_eq!(snap["account"]["lifecycle"]["prior_status"], json!("active"));
    assert_eq!(snap["account"]["lifecycle"]["client_restorable"], json!(true));
    // idempotent
    let again = lifecycle::archive(State(st.clone()), ctx(&st).await, headers(), Path(a), q(), body(json!({}))).await.unwrap().0;
    assert_eq!((again["ok"].as_bool(), again["steps"].as_array().map(Vec::len)), (Some(true), Some(0)));
    // retired accounts can't get a terminal token
    assert!(accounts::sso(State(st.clone()), ctx(&st).await, headers(), Path(a), q()).await.is_err());

    // the archived account no longer counts: one more can be opened, and then restore is over the limit
    let extra = open_demo(&st, &g.code).await.expect("archived accounts don't count");
    assert!(lifecycle::restore(State(st.clone()), ctx(&st).await, headers(), Path(a), q()).await.is_err(), "restore re-checks the limit");
    let op: Op = Box::new(|tx, env| trading::engine::funds::archive(tx, env, "test", "TEST", true).map(|_| Value::Null));
    hub.exec(extra, "test", None, "", "", None, op).await.unwrap();
    let r = lifecycle::restore(State(st.clone()), ctx(&st).await, headers(), Path(a), q()).await.unwrap().0;
    assert_eq!(r, json!({"ok": true, "status": "active"}));
    assert!(snapshot(&hub, a).await["account"].get("lifecycle").is_none());

    // rename
    let r = lifecycle::rename(State(st.clone()), ctx(&st).await, headers(), Path(a), q(), body(json!({"name": "  Swing book "}))).await.unwrap().0;
    assert_eq!(r, json!({"ok": true}));
    assert_eq!(hub.meta(a).unwrap().name, "Swing book");
    assert!(lifecycle::rename(State(st.clone()), ctx(&st).await, headers(), Path(a), q(), body(json!({"name": "x".repeat(33)}))).await.is_err());

    // replay = live
    let replayed = trading::persist::replay_all(&pool).await.unwrap();
    for l in mine.iter().chain([&extra]) {
        assert_eq!(serde_json::to_value(&replayed[l]).unwrap(), snapshot(&hub, *l).await, "replay diverged for {l}");
    }
    assert_eq!(replayed[&extra].account.status, Status::Archived);
}
