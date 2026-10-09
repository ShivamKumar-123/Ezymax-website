//! Trader analytics, broker risk, scenarios and the broker capital setting end to end, against a throw-away
//! database `ezymex_reports_test_<pid>` (REPORTS_TEST_DATABASE_URL, default :5433; skipped without PostgreSQL) and
//! a fake trading engine on a local port serving `/v1/admin/accounts` and `/v1/dealing/positions`.

use std::str::FromStr;
use std::sync::Arc;

use axum::Json;
use axum::routing::get;
use chrono::{Duration, Utc};
use reports::config::Config;
use reports::db::{self, Actor};
use reports::state::Svc;
use reports::traders::{Filters, Gran};
use reports::{risk, sync, traders};
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;

fn exit_deal(id: i64, login: i64, profit: f64, book: &str, at: chrono::DateTime<Utc>, hold_secs: i64) -> Value {
    json!({
        "id": id, "login": login, "positionTicket": id, "orderTicket": id, "symbol": "EURUSD", "side": "sell", "positionSide": "buy",
        "entry": "out", "volume": 1.0, "price": 1.16, "profit": profit, "swap": 0, "commission": 0, "reason": "client",
        "book": book, "time": at.to_rfc3339(), "openPrice": 1.159, "openTime": (at - Duration::seconds(hold_secs)).to_rfc3339(), "source": "manual",
        "comment": "", "priceCorrection": false, "ledgerTxn": null, "reversed": false, "instrument": "cfd", "option": null,
    })
}

fn engine_account(login: i64, user: i64, group: &str, balance: f64, equity: f64, margin: f64, profit: f64) -> Value {
    json!({"login": login, "userId": user, "type": "live", "group": group, "cent": false, "currency": "USD", "balance": balance, "credit": 0, "bonus": 0,
           "equity": equity, "margin": margin, "profit": profit, "swap": 0, "marginLevel": if margin > 0.0 { json!(equity / margin * 100.0) } else { Value::Null },
           "marginCallLevel": 100, "stopOutLevel": 50, "positions": 1, "version": 1, "createdAt": "2026-01-01T00:00:00Z"})
}

#[tokio::test]
async fn traders_risk_scenarios_and_capital_end_to_end() {
    let base = std::env::var("REPORTS_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&base).unwrap().database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping reports DB tests: no PostgreSQL at {base}");
        return;
    }
    // fake engine: two live accounts and a prop account, one B-book position each
    let accounts = json!({"items": [
        engine_account(20000001, 1, "standard", 5000.0, 5600.0, 232.0, 600.0),
        engine_account(20000002, 2, "standard", 3000.0, 2500.0, 2320.0, -500.0),
        engine_account(20000003, 3, "prop-phase1", 100000.0, 100000.0, 0.0, 0.0),
    ], "page": 1, "limit": 500, "total": 3});
    let positions = json!([
        {"ticket": "1", "login": "20000001", "symbol": "EURUSD", "side": "buy", "volume": 1.0, "openPrice": 1.154, "currentPrice": 1.16, "profit": 600.0, "swap": 0, "route": "B", "currency": "USD"},
        {"ticket": "2", "login": "20000002", "symbol": "EURUSD", "side": "buy", "volume": 10.0, "openPrice": 1.1605, "currentPrice": 1.16, "profit": -500.0, "swap": 0, "route": "B", "currency": "USD"},
        {"ticket": "3", "login": "20000003", "symbol": "EURUSD", "side": "sell", "volume": 50.0, "openPrice": 1.16, "currentPrice": 1.16, "profit": 0.0, "swap": 0, "route": "B", "currency": "USD"},
    ]);
    let engine = axum::Router::new()
        .route("/v1/admin/accounts", get(move || { let a = accounts.clone(); async move { Json(a) } }))
        .route("/v1/dealing/positions", get(move || { let p = positions.clone(); async move { Json(p) } }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, engine).await.unwrap() });

    let name = format!("ezymex_reports_test_ba_{}", std::process::id());
    let url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&url).await.expect("create + migrate");
    let mut cfg = Config::from_env().unwrap();
    cfg.database_url = url.clone();
    for u in [&mut cfg.wallet_url, &mut cfg.gateway_url, &mut cfg.ib_url, &mut cfg.prop_url, &mut cfg.market_data_url] {
        *u = "http://127.0.0.1:9".into();
    }
    cfg.trading_url = format!("http://{addr}");
    cfg.workers = false;
    let app = Arc::new(Svc::new(cfg, pool.clone()));

    let now = Utc::now();
    for (u, first, country) in [(1i64, "Ana", "ae"), (2, "Ben", "ng"), (3, "Pat", "gb")] {
        sqlx::query("INSERT INTO clients (tenant, user_id, email, first_name, last_name, country, created_at, changed_at) VALUES ('ezymex', $1, $2, $3, 'Test', $4, $5, $5)")
            .bind(u)
            .bind(format!("{}@example.com", first.to_lowercase()))
            .bind(first)
            .bind(country)
            .bind(now - Duration::days(90))
            .execute(&pool)
            .await
            .unwrap();
    }
    for (login, user, group) in [(20000001i64, 1i64, "standard"), (20000002, 2, "standard"), (20000003, 3, "prop-phase1")] {
        sqlx::query("INSERT INTO accounts (tenant, login, user_id, kind, group_code, currency, leverage, created_at) VALUES ('ezymex', $1, $2, 'live', $3, 'USD', 500, $4)")
            .bind(login)
            .bind(user)
            .bind(group)
            .bind(now - Duration::days(60))
            .execute(&pool)
            .await
            .unwrap();
    }
    // Ana wins on four days of the last six (slow trades), Ben loses twice, the prop account is never counted
    let day = |d: i64| now - Duration::days(d);
    let deals = [
        exit_deal(1, 20000001, 100.0, "B", day(3), 7200),
        exit_deal(2, 20000001, 120.0, "B", day(2), 7200),
        exit_deal(3, 20000001, 80.0, "B", day(1), 7200),
        exit_deal(7, 20000001, 50.0, "B", now - Duration::minutes(10), 7200),
        exit_deal(4, 20000002, -150.0, "B", day(2), 30),
        exit_deal(5, 20000002, -100.0, "B", day(1), 30),
        exit_deal(6, 20000003, 5000.0, "B", day(1), 60),
    ];
    for d in &deals {
        sync::upsert_deal(&app, "ezymex", d).await.unwrap();
    }

    let (from, to, g) = traders::range(Some(now - Duration::days(10)), Some(now + Duration::hours(1)), Some(Gran::Day)).unwrap();
    let (v, files) = traders::report(&app, "ezymex", from, to, g, &Filters::default()).await.unwrap();
    let t = &v["totals"];
    assert_eq!((t["traders"].as_u64(), t["profitable"].as_u64(), t["losing"].as_u64()), (Some(2), Some(1), Some(1)), "{t}");
    assert_eq!((t["clientNet"].as_f64(), t["clientFloating"].as_f64(), t["bbook"].as_f64()), (Some(100.0), Some(100.0), Some(-100.0)), "{t}");
    assert_eq!(v["floatingSource"], "engine");
    let ana = &v["topWinners"][0];
    assert_eq!((ana["userId"].as_i64(), ana["net"].as_f64(), ana["floating"].as_f64(), ana["name"].as_str()), (Some(1), Some(350.0), Some(600.0), Some("Ana Test")));
    assert_eq!((ana["consistency"]["profitable"].as_u64(), ana["flags"]["consistent"].as_bool(), ana["routeHint"].as_str()), (Some(4), Some(true), Some("A")));
    assert_eq!(v["topLosers"][0]["userId"], 2);
    assert_eq!(files.len(), 4);
    // filters: Nigeria only
    let (only_ng, _) = traders::report(&app, "ezymex", from, to, g, &Filters { country: Some("NG".into()), ..Default::default() }).await.unwrap();
    assert_eq!((only_ng["totals"]["traders"].as_u64(), only_ng["totals"]["clientNet"].as_f64()), (Some(1), Some(-250.0)));

    // broker capital: a reason is required, every change is audited
    let staff = Actor { id: "staff:7".into(), name: "Risk Lead".into(), role: "admin".into() };
    assert!(risk::set_capital(&app, "ezymex", &staff, risk::CapitalIn { amount: 1000.0, reason: " ".into() }).await.is_err());
    assert!(risk::set_capital(&app, "ezymex", &staff, risk::CapitalIn { amount: -1.0, reason: "Wrong".into() }).await.is_err());
    let c = risk::set_capital(&app, "ezymex", &staff, risk::CapitalIn { amount: 250_000.0, reason: "Audited capital Q3".into() }).await.unwrap();
    assert_eq!((c["amount"].as_f64(), c["updatedBy"].as_str()), (Some(250_000.0), Some("Risk Lead")));
    let audited: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'settings.capital' AND detail->>'reason' = 'Audited capital Q3'").fetch_one(&pool).await.unwrap();
    assert_eq!(audited, 1);

    // live risk: prop excluded, B-book floating is the mirror of the clients' floating
    let (r, rfiles) = risk::report(&app, "ezymex").await.unwrap();
    let rt = &r["totals"];
    assert_eq!((rt["accounts"].as_u64(), rt["positions"].as_u64(), rt["bbookFloating"].as_f64()), (Some(2), Some(2), Some(-100.0)), "{rt}");
    assert_eq!(r["bySymbol"][0]["netLots"].as_f64(), Some(11.0));
    assert_eq!(r["atRisk"][0]["login"], 20000002);
    assert_eq!(r["capital"]["amount"].as_f64(), Some(250_000.0));
    assert!(["strong", "adequate", "weak"].contains(&r["capital"]["status"].as_str().unwrap()));
    assert_eq!(rfiles.len(), 7);

    // −1 % on EURUSD: Ana −1 160, Ben −11 600 → equity −9 100, stopped out, 9 100 written off
    let s = risk::scenario(&app, "ezymex", risk::ScenarioIn { shocks: Some(vec![risk::Shock { scope: "symbol".into(), target: "EURUSD".into(), pct: -1.0 }]), ..Default::default() }).await.unwrap();
    let st = &s["totals"];
    assert_eq!((st["clientPnl"].as_f64(), st["stopOuts"].as_u64(), st["negativeBalance"].as_f64()), (Some(-12_760.0), Some(1), Some(9100.0)), "{st}");
    assert_eq!((st["brokerImpact"].as_f64(), st["capitalAfter"].as_f64()), (Some(3660.0), Some(253_660.0)), "{st}");
    assert_eq!(s["accounts"][0]["login"], 20000002);

    pool.close().await;
    if let Ok(mut c) = admin.connect().await {
        let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)"))).execute(&mut c).await;
    }
}
