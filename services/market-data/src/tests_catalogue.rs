//! The repo's instrument catalogue (config/instruments.json + config/holidays) and, against PostgreSQL :5433 (a
//! throw-away database; the test fails, never skips, when it is not reachable), the instrument sync, the restart
//! restore of 1,000+ symbols and the delayed / live quote rules.

use chrono::{DateTime, Utc};
use std::collections::BTreeSet;
use std::str::FromStr;
use std::time::Instant;

use crate::db::{self, Bar, Source};
use crate::demand::{Demand, Limits, Tier};
use crate::instruments::Catalogue;
use crate::state::Market;
use crate::timeframes::Tf;

const ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config");

fn repo() -> Catalogue {
    Catalogue::load(&format!("{ROOT}/instruments.json"), &format!("{ROOT}/holidays")).unwrap()
}

fn t(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}

#[test]
fn repo_catalogue_loads() {
    let c = repo();
    assert!(c.list.len() > 1000, "{} instruments", c.list.len());
    let core = c.core();
    assert_eq!(core.len(), 28);
    // the core rows come first, unchanged in order
    assert_eq!(&c.list[0].symbol, "EURUSD");
    assert_eq!(&c.list[27].symbol, "NFLX");
    assert!(c.list[..28].iter().all(|i| i.is_core() && i.calendar.is_none()));
    let mut classes = BTreeSet::new();
    for i in c.list.iter().filter(|i| !i.is_core()) {
        classes.insert(i.asset_class.as_str());
        assert!(i.name.is_some() && i.template.is_some() && i.quote_ccy.is_some(), "{}", i.symbol);
        let q = i.quote_ccy.as_deref().unwrap();
        assert!(q == "USD" || c.usd_pair(q).is_some(), "{}: no USD pair for {q}", i.symbol);
        assert!(i.base_spread > 0.0 && i.digits <= 10, "{}", i.symbol);
    }
    assert_eq!(classes.into_iter().collect::<Vec<_>>(), vec!["crypto", "energies", "forex", "indices", "metals", "stocks"]);
    // provider codes map back (FX by code, crypto USDT → USD symbol, stocks with exchange suffix)
    assert_eq!(c.from_provider("crypto", "BNBUSDT").unwrap().symbol, "BNBUSD");
    assert_eq!(c.from_provider("stock", "MSFT.US").unwrap().symbol, "MSFT");
    assert_eq!(c.from_provider("stock", "00700.HK").unwrap().symbol, "00700.HK");
    assert_eq!(c.from_provider("japan", "7203.JP").unwrap().symbol, "7203.JP");
    assert_eq!(c.usd_pair("JPY").as_deref(), Some("USDJPY"));
    assert_eq!(c.usd_pair("SGD").as_deref(), Some("USDSGD"));
}

#[test]
fn ticks_follow_each_class_session_and_holidays() {
    let c = repo();
    let open = |s: &str, at: &str| c.get(s).unwrap().in_session(t(at));
    assert!(open("AUDCAD", "2026-11-26T15:00:00Z") && !open("AUDCAD", "2026-09-26T10:00:00Z"));
    assert!(open("BNBUSD", "2026-09-26T10:00:00Z"));
    assert!(!open("MSFT", "2026-11-26T15:00:00Z") && open("AAPL", "2026-11-26T15:00:00Z"), "NYSE holiday for the catalogue only");
    assert!(!open("MSFT", "2026-09-24T12:00:00Z") && open("MSFT", "2026-09-24T14:00:00Z"), "pre-market prints are ignored");
    assert!(!open("00700.HK", "2026-10-07T04:30:00Z") && open("00700.HK", "2026-10-07T06:00:00Z"));
    assert!(!open("7203.JP", "2026-10-12T02:00:00Z"));
    assert!(!open("WTI", "2026-11-26T15:00:00Z") && open("USOIL", "2026-11-26T15:00:00Z"));
}

#[test]
fn plan_streams_core_always_and_catalogue_on_demand_within_the_limit() {
    let c = repo();
    let now = Instant::now();
    let limits = Limits { default_per_market: 600, total: 30, ..Limits::default() };
    let mut d = Demand::new(c.core(), limits);
    d.add("MSFT", Tier::Watch, now);
    d.add("BNBUSD", Tier::Hold, now);
    d.add("AUDCAD", Tier::Focus, now);
    let p = d.plan(&c, &BTreeSet::new(), now);
    // total 30: 28 core + the held and the charted symbol; the watched one waits
    assert_eq!(p.len(), 30);
    assert!(p.symbols().contains("BNBUSD") && p.symbols().contains("AUDCAD") && !p.symbols().contains("MSFT"));
    assert_eq!(p.dropped, vec![("MSFT".to_string(), Tier::Watch)]);
    assert!(c.core().iter().all(|s| p.symbols().contains(s)));
}

#[tokio::test]
async fn sync_restore_and_delayed_quotes_against_postgres() {
    let base = std::env::var("MARKET_DATA_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let db_name = format!("kalks_md_test_{}", std::process::id());
    let server = sqlx::postgres::PgConnectOptions::from_str(&base).unwrap();
    let url = sqlx::ConnectOptions::to_url_lossy(&server.clone().database(&db_name)).to_string();
    let pool = db::connect(&url).await.expect("PostgreSQL :5433 must be running for this test");
    let cat = repo();
    let n = cat.list.len() as i64;
    db::sync_instruments(&pool, &cat).await.unwrap();
    db::sync_instruments(&pool, &cat).await.unwrap(); // idempotent
    let (rows, catalogue): (i64, i64) = sqlx::query_as("SELECT count(*), count(*) FILTER (WHERE tier = 'catalogue') FROM instruments").fetch_one(&pool).await.unwrap();
    assert_eq!((rows, catalogue), (n, n - 28));

    // stored bars: a core and a catalogue instrument; restart restores both, only the catalogue price is delayed
    let bar = |ts: &str, c: f64| Bar { t: t(ts), o: c, h: c, l: c, c, v: 1.0 };
    db::upsert_bars(&pool, &[("EURUSD".into(), 1, bar("2026-10-07T10:00:00Z", 1.16)), ("MSFT".into(), 1, bar("2026-10-06T19:59:00Z", 520.5)), ("MSFT".into(), 1440, bar("2026-10-05T21:00:00Z", 519.0))], Source::Reconciled)
        .await
        .unwrap();
    let latest = db::latest_bars(&pool, &cat.list.iter().map(|i| i.symbol.clone()).collect::<Vec<_>>()).await.unwrap();
    assert_eq!(latest.len(), 3);
    let spreads = crate::spreads::Spreads::load(&pool).await.unwrap();
    let mk = Market::new(cat, pool.clone(), spreads, false, Demand::new(Vec::<String>::new(), Limits::default()));
    mk.restore().await.unwrap();
    let (eu, ms) = (mk.quote("EURUSD").unwrap(), mk.quote("MSFT").unwrap());
    assert!(!eu.delayed && ms.delayed, "core restored as before; catalogue restored as delayed");
    assert_eq!(ms.last, 520.5);
    assert_eq!(mk.forming("MSFT", Tf::D1).unwrap().c, 519.0);
    // a delayed snapshot never replaces a newer live price; a live tick clears the delayed flag
    mk.set_streaming(["MSFT".to_string()].into());
    mk.set_snapshot("BNBUSD", 612.0, Some((600.0, 615.0, 598.0)), Utc::now().timestamp_millis());
    let bnb = mk.quote("BNBUSD").unwrap();
    assert!(bnb.delayed && bnb.last == 612.0);
    assert_eq!(mk.day_stats(mk.cat.get("BNBUSD").unwrap()), Some((600.0, 615.0, 598.0)));
    let ts = Utc::now().timestamp_millis();
    mk.on_trade("BNBUSD", 613.0, 1.0, ts);
    assert!(!mk.quote("BNBUSD").unwrap().delayed);
    mk.set_snapshot("BNBUSD", 500.0, None, ts - 60_000);
    assert_eq!(mk.quote("BNBUSD").unwrap().last, 613.0, "older snapshot ignored");

    pool.close().await;
    let mut admin = sqlx::ConnectOptions::connect(&server.database("postgres")).await.unwrap();
    let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{db_name}\" WITH (FORCE)"))).execute(&mut admin).await;
    eprintln!("market-data DB test ran against {base}");
}
