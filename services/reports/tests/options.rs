//! Kalks FX Options in the reports mirror, against a throw-away database `kalks_reports_test_<pid>` on the local
//! PostgreSQL (REPORTS_TEST_DATABASE_URL, default :5433). Skipped when PostgreSQL is unreachable. Option deals
//! are mirrored with their `option` object, statements get their own lines and Options section, monthly results
//! count the realised option P&L, and broker revenue counts option commission on every trade but never lots.

use std::str::FromStr;
use std::sync::Arc;

use chrono::{Duration, Utc};
use reports::config::Config;
use reports::state::Svc;
use reports::{broker, client, db, statement, sync};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;

fn d(s: &str) -> Decimal {
    Decimal::from_str(s).unwrap()
}

#[allow(clippy::too_many_arguments)]
fn engine_deal(id: i64, ticket: i64, symbol: &str, entry: &str, side: &str, reason: &str, volume: f64, price: f64, profit: f64, commission: f64, at: chrono::DateTime<Utc>, option: Value) -> Value {
    json!({
        "id": id, "login": 10000001, "positionTicket": ticket, "orderTicket": ticket, "symbol": symbol, "side": side,
        "positionSide": if entry == "in" { side } else if side == "buy" { "sell" } else { "buy" },
        "entry": entry, "volume": volume, "price": price, "profit": profit, "swap": 0, "commission": commission, "reason": reason,
        "book": "B", "time": at.to_rfc3339(), "openPrice": 0.0052, "openTime": (at - Duration::minutes(30)).to_rfc3339(), "source": "manual",
        "comment": "", "priceCorrection": false, "ledgerTxn": null, "reversed": false,
        "instrument": if option.is_null() { "cfd" } else { "option" }, "option": option,
    })
}

#[tokio::test]
async fn option_deals_flow_through_statements_months_and_broker_reports() {
    let base = std::env::var("REPORTS_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&base).unwrap().database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping reports DB tests: no PostgreSQL at {base}");
        return;
    }
    let name = format!("kalks_reports_test_{}", std::process::id());
    let url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&url).await.expect("create + migrate");
    let mut cfg = Config::from_env().unwrap();
    cfg.database_url = url.clone();
    // no upstream services: the live part of a statement is skipped
    for u in [&mut cfg.trading_url, &mut cfg.wallet_url, &mut cfg.gateway_url, &mut cfg.ib_url, &mut cfg.prop_url, &mut cfg.market_data_url] {
        *u = "http://127.0.0.1:9".into();
    }
    cfg.workers = false;
    let app = Arc::new(Svc::new(cfg, pool.clone()));

    let now = Utc::now();
    let t0 = now - Duration::hours(3);
    sqlx::query("INSERT INTO accounts (tenant, login, user_id, kind, group_code, group_name, mode, currency, leverage, name, created_at) VALUES ('kalks', 10000001, 1, 'live', 'standard', 'Standard', 'hedging', 'USD', 500, 'T', $1)")
        .bind(now - Duration::days(2))
        .execute(&pool)
        .await
        .unwrap();
    let opt = |cash: f64, charged: f64, fixing: Value| json!({"series": "EURUSD-20261009-1.1650-C", "underlying": "EURUSD", "right": "call", "strike": 1.165, "expiry": "2026-10-09", "style": "vanilla", "cash": cash, "usdPerQuote": 1, "spot": 1.17, "fixing": fixing, "run": null, "comboId": null, "commissionCharged": charged});
    let series = "EURUSD-20261009-1.1650-C";
    let deals = [
        engine_deal(2000001, 1000001, series, "in", "buy", "client", 2.0, 0.0052, 0.0, 0.5, t0, opt(-104.0, 0.5, Value::Null)),
        engine_deal(2000002, 1000002, "EURUSD", "in", "buy", "client", 1.0, 1.16, 0.0, 7.0, t0 + Duration::minutes(1), Value::Null),
        engine_deal(2000003, 1000001, series, "out", "sell", "client", 1.0, 0.0060, 8.0, 0.5, t0 + Duration::minutes(10), opt(60.0, 0.25, Value::Null)),
        engine_deal(2000004, 1000002, "EURUSD", "out", "sell", "client", 1.0, 1.162, 20.0, 7.0, t0 + Duration::minutes(20), Value::Null),
        engine_deal(2000005, 1000001, series, "out", "sell", "expiry", 1.0, 0.0062, 10.0, 0.25, t0 + Duration::minutes(30), opt(62.0, 0.0, json!(1.1712))),
    ];
    for x in &deals {
        sync::upsert_deal(&app, "kalks", x).await.unwrap();
    }
    // re-reading a deal from a feed without the option object never drops it
    let mut bare = deals[0].clone();
    bare["option"] = Value::Null;
    bare["instrument"] = Value::Null;
    bare["symbol"] = json!("EURUSD-OPT");
    sync::upsert_deal(&app, "kalks", &bare).await.unwrap();
    let kept: i64 = sqlx::query_scalar("SELECT count(*) FROM deals WHERE option IS NOT NULL").fetch_one(&pool).await.unwrap();
    assert_eq!(kept, 3);
    let ledger = [
        (1, "option_premium", "-104", 0),
        (2, "commission", "-0.50", 0),
        (3, "commission", "-7", 1),
        (4, "option_premium", "60", 10),
        (5, "commission", "-0.25", 10),
        (6, "trade_pnl", "20", 20),
        (7, "option_settlement", "62", 30),
    ];
    for (txn, kind, amt, min) in ledger {
        sqlx::query("INSERT INTO ledger (tenant, login, txn, sub_ledger, kind, amount, currency, at) VALUES ('kalks', 10000001, $1, 'balance', $2, $3, 'USD', $4)")
            .bind(txn as i64)
            .bind(kind)
            .bind(d(amt))
            .bind(t0 + Duration::minutes(min))
            .execute(&pool)
            .await
            .unwrap();
    }

    // statement: premiums and settlements are their own lines, the options section adds up, everything reconciles
    let s = statement::generate(&app, "kalks", 10000001, t0 - Duration::hours(1), now + Duration::hours(1)).await.unwrap();
    assert!(s.reconciliation.ok, "{:?}", s.reconciliation.notes);
    assert_eq!((s.summary.option_premiums, s.summary.option_settlements, s.summary.deposits, s.summary.adjustments), (d("-44"), d("62"), d("0"), d("0")));
    assert_eq!(s.summary.closing_balance, d("30.25"));
    assert_eq!((s.options.premiums_paid, s.options.premiums_received, s.options.settlements_received, s.options.commission, s.options.realised_pnl), (d("104"), d("60"), d("62"), d("0.75"), d("18")));
    assert_eq!(s.options.deals.len(), 3);
    assert_eq!(s.options.deals.iter().find(|x| x.reason == "expiry").unwrap().option_fixing(), Some(d("1.1712")));
    assert_eq!(s.trades.len(), 1, "closed trades: CFD only");
    assert_eq!(s.stats.trades, 3);
    assert!((s.stats.lots - 1.0).abs() < 1e-9, "contracts are not lots: {}", s.stats.lots);
    assert_eq!(s.summary.net_pnl, d("30.25"));
    let labels: Vec<&str> = s.ledger.iter().map(|l| l.label.as_str()).collect();
    assert!(labels.contains(&"Option premium") && labels.contains(&"Option settlement"));

    // months: the month's result is realised (CFD 20 + options 18 − commission 7.75), premiums are not deposits
    let m = client::months(&app, "kalks", 10000001).await.unwrap();
    let month = m["months"].as_array().unwrap().iter().find(|x| x["trades"].as_i64().unwrap_or(0) > 0).unwrap();
    assert_eq!((month["net"].as_f64(), month["deposits"].as_f64(), month["trades"].as_i64()), (Some(30.25), Some(0.0), Some(3)));

    // broker: option commission on every trade (0.75), the house's option P&L (−18), no lots for contracts
    let ds = broker::deals(&app, "kalks", t0 - Duration::hours(1), now + Duration::hours(1)).await.unwrap();
    let o: Vec<&broker::D> = ds.iter().filter(|x| x.option).collect();
    assert_eq!(o.len(), 3);
    assert!(o.iter().all(|x| x.lots == 0.0));
    let (v, _) = broker::pnl(&app, "kalks", t0 - Duration::hours(1), now + Duration::hours(1)).await.unwrap();
    let tot = &v["totals"];
    assert_eq!((tot["commission"].as_f64(), tot["lots"].as_f64(), tot["optionContracts"].as_f64(), tot["optionsPnl"].as_f64()), (Some(7.75), Some(1.0), Some(2.0), Some(-18.0)), "{tot}");
    assert_eq!(tot["bbook"].as_f64(), Some(-38.0), "−(CFD 20 + options 18)");
    let (a, _) = broker::activity(&app, "kalks", t0 - Duration::hours(1), now + Duration::hours(1)).await.unwrap();
    let top = a["topAccounts"].as_array().cloned().unwrap_or_default();
    assert!(top.iter().all(|x| x["lots"].as_f64().unwrap_or(0.0) <= 1.0), "{top:?}");

    pool.close().await;
    if let Ok(mut c) = admin.connect().await {
        let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)"))).execute(&mut c).await;
    }
}
