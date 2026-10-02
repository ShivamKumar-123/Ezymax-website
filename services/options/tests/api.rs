//! Integration test against PostgreSQL: seeds a throw-away database through the real store / seed code,
//! lists series from injected spots, then drives the HTTP API end to end: module switches, chain, series,
//! smile, snapshot + ETag, Back Office writes with audit, controls, TWAP fixing, expiry golden lists against
//! the seeded holiday calendars, and the WebSocket frame rate.
//!
//! Needs the local Postgres (127.0.0.1:5433). Uses `kalks_options_test_<pid>`; skipped with a message when
//! Postgres is not reachable. Override with OPTIONS_TEST_DATABASE_URL (a server URL).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::{Duration, NaiveDate, TimeZone, Utc};
use futures_util::{SinkExt, StreamExt};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use tower::ServiceExt;

use options::api::router;
use options::config::Config;
use options::{AppState, jobs, seed, store};

async fn test_db(tag: &str) -> Option<String> {
    let server = std::env::var("OPTIONS_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let opts = PgConnectOptions::from_str(&server).ok()?;
    let db = format!("kalks_options_test_{}_{tag}", std::process::id());
    let mut conn = match opts.clone().database("postgres").connect().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("skipping: Postgres not reachable ({e})");
            return None;
        }
    };
    let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{db}\""))).execute(&mut conn).await;
    let base = server.rsplit_once('/').map(|x| x.0).unwrap_or(&server).to_string();
    Some(format!("{base}/{db}"))
}

async fn drop_db(url: &str) {
    let opts = PgConnectOptions::from_str(url).unwrap();
    let db = opts.get_database().unwrap().to_string();
    if let Ok(mut c) = opts.database("postgres").connect().await {
        let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{db}\" WITH (FORCE)"))).execute(&mut c).await;
    }
}

struct T {
    app: axum::Router,
    st: AppState,
}

const STAFF: (&str, &str) = ("x-kalks-staff", "ops@kalks");

impl T {
    async fn call(&self, method: &str, path: &str, headers: &[(&str, &str)], body: Option<Value>) -> (StatusCode, Value) {
        let mut req = Request::builder().method(method).uri(path).header("x-kalks-internal", "test-token");
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let req = match body {
            Some(b) => req.header("content-type", "application/json").body(Body::from(b.to_string())).unwrap(),
            None => req.body(Body::empty()).unwrap(),
        };
        let res = self.app.clone().oneshot(req).await.unwrap();
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
    }
    async fn get(&self, path: &str) -> Value {
        let (s, v) = self.call("GET", path, &[], None).await;
        assert_eq!(s, StatusCode::OK, "{path}: {v}");
        v
    }
}

async fn setup(tag: &str) -> Option<(T, String)> {
    let url = test_db(tag).await?;
    let pool = store::connect(&url).await.expect("connect + migrate");
    let cfg = Config::for_tests(&url);
    let n = seed::run(&pool, &cfg.holidays_dir).await.unwrap();
    assert!(n > 100, "seed inserted {n} rows");
    assert_eq!(seed::run(&pool, &cfg.holidays_dir).await.unwrap(), 0, "seed is idempotent");
    let st = AppState::new(pool, cfg).await.unwrap();
    // Spots for every enabled underlying + conversions.
    for (s, b, a) in [
        ("EURUSD", 1.17000, 1.17008),
        ("GBPUSD", 1.34500, 1.34510),
        ("USDJPY", 147.250, 147.262),
        ("AUDUSD", 0.66000, 0.66010),
        ("USDCAD", 1.38000, 1.38012),
        ("USDCHF", 0.80000, 0.80012),
        ("EURJPY", 172.30, 172.32),
        ("GBPJPY", 198.10, 198.12),
        ("XAUUSD", 3990.00, 3990.18),
        ("XAGUSD", 48.00, 48.02),
        ("USOIL", 62.10, 62.13),
        ("UKOIL", 65.40, 65.43),
    ] {
        st.spots.set(s, b, a, 0).await;
    }
    let app = router(st.clone());
    Some((T { app, st }, url))
}

#[tokio::test]
async fn options_service_end_to_end() {
    let Some((t, url)) = setup("e2e").await else { return };

    // ---------------- seed + module switches
    let rd = t.st.refdata().await;
    let k = rd.tenant("kalks");
    assert!(k.enabled_demo && k.enabled_live && !k.public_chain, "tenant 1 seeded demo + live ON, public chain OFF");
    assert!(!rd.tenant("otherbroker").any_enabled(), "unknown tenants are OFF");
    assert!(!rd.underlying("NZDUSD").unwrap().enabled, "NZDUSD has no feed yet");
    assert_eq!(rd.underlyings.len(), 13);
    assert_eq!(rd.underlying("XAGUSD").unwrap().contract_size, 50.0);
    assert!(rd.calendars.get("EUR").unwrap().is_holiday(optmath::Date::parse("2026-12-25").unwrap()));
    drop(rd);

    let (s, v) = t.call("GET", "/v1/options/underlyings", &[("x-kalks-tenant", "otherbroker")], None).await;
    assert_eq!((s, v["error"]["code"].as_str()), (StatusCode::NOT_FOUND, Some("options_disabled")));
    let (s, _) = t.call("GET", "/v1/options/underlyings", &[("x-kalks-account-kind", "live")], None).await;
    assert_eq!(s, StatusCode::OK, "live accounts are on for tenant 1");
    let (s, _) = t.call("GET", "/v1/options/underlyings", &[("x-kalks-account-kind", "demo")], None).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _) = t.call("GET", "/v1/public/options/chain/EURUSD", &[], None).await;
    assert_eq!(s, StatusCode::NOT_FOUND, "public chain off by default");
    // the internal token is required
    let res = t.app.clone().oneshot(Request::get("/v1/options/underlyings").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // ---------------- listing
    let rep = jobs::list_series(&t.st).await.unwrap();
    assert!(rep.expiries_added >= 12 * 6, "{rep:?}");
    assert!(rep.series_added > 1000, "{rep:?}");
    assert!(rep.skipped_no_price.is_empty());
    let again = jobs::list_series(&t.st).await.unwrap();
    assert_eq!((again.expiries_added, again.series_added), (0, 0), "listing is idempotent");

    let u = t.get("/v1/options/underlyings").await;
    assert_eq!(u["underlyings"].as_array().unwrap().len(), 12);
    let ex = t.get("/v1/options/expiries?u=EURUSD").await;
    let list = ex["expiries"].as_array().unwrap();
    assert!(list.len() >= 6);
    for e in list {
        // 10:00 New York is 14:00 or 15:00 UTC depending on DST (exact DST golden tests live in optmath).
        let cut: chrono::DateTime<Utc> = serde_json::from_value(e["cutAt"].clone()).unwrap();
        assert!(cut.format("%H:%M").to_string() == "14:00" || cut.format("%H:%M").to_string() == "15:00", "{e}");
        assert!(e["series"].as_u64().unwrap() >= 42, "{e}");
    }

    // ---------------- chain
    let chain = t.get("/v1/options/chain?u=EURUSD").await;
    let rows = chain["rows"].as_array().unwrap();
    assert!(rows.len() >= 21, "{}", rows.len());
    assert!(chain["error"].is_null(), "{}", chain["error"]);
    let atm = rows.iter().min_by(|a, b| (a["strike"].as_f64().unwrap() - 1.17).abs().total_cmp(&(b["strike"].as_f64().unwrap() - 1.17).abs())).unwrap();
    let (c, p) = (&atm["call"], &atm["put"]);
    assert_eq!(atm["strikeLabel"], "1.1700");
    for q in [c, p] {
        let (bid, ask, mark) = (q["bid"].as_f64().unwrap(), q["ask"].as_f64().unwrap(), q["mark"].as_f64().unwrap());
        assert!(bid > 0.0 && bid <= mark && mark <= ask, "{q}");
        assert!(q["askUsd"].as_f64().unwrap() - q["bidUsd"].as_f64().unwrap() >= 0.5 - 0.011, "min USD spread: {q}");
        assert!(q["iv"].as_f64().unwrap() > 0.03 && q["iv"].as_f64().unwrap() < 0.2);
        assert!(q["vega"].as_f64().unwrap() > 0.0 && q["theta"].as_f64().unwrap() < 0.0, "{q}");
    }
    assert!(c["delta"].as_f64().unwrap() > 0.3 && p["delta"].as_f64().unwrap() < -0.3);
    // put-call parity on marks (per unit): C - P = S e^{(b-r)t} - K e^{-rt}, near zero at the money short dated
    let inputs = &chain["modelInputs"];
    let (s0, r, b, tc) = (inputs["spot"].as_f64().unwrap(), inputs["r"].as_f64().unwrap(), inputs["b"].as_f64().unwrap(), inputs["tCal"].as_f64().unwrap());
    let kk = atm["strike"].as_f64().unwrap();
    let parity = s0 * ((b - r) * tc).exp() - kk * (-r * tc).exp();
    assert!((c["mark"].as_f64().unwrap() - p["mark"].as_f64().unwrap() - parity).abs() < 2e-6, "parity");
    // JPY quote converted to USD per contract (10,000 USD notional)
    let jpy = t.get("/v1/options/chain?u=USDJPY").await;
    let jr = jpy["rows"].as_array().unwrap();
    let mid = &jr[jr.len() / 2]["call"];
    let usd = mid["markUsd"].as_f64().unwrap();
    assert!((usd - mid["mark"].as_f64().unwrap() * 10_000.0 / 147.256).abs() < 0.02, "{mid}");

    // series + smile
    let code = c["code"].as_str().unwrap().to_string();
    let sv = t.get(&format!("/v1/options/series/{code}?group=standard")).await;
    assert_eq!(sv["quote"]["code"], code.as_str());
    let sm = t.get(&format!("/v1/options/smile?u=EURUSD&expiry={}", chain["expiry"].as_str().unwrap())).await;
    assert!(sm["points"].as_array().unwrap().len() >= 21 && sm["pillars"].as_array().unwrap().len() == 5);

    // ---------------- snapshot + ETag
    let res = t.app.clone().oneshot(Request::get("/v1/internal/options/snapshot").header("x-kalks-internal", "test-token").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let etag = res.headers().get("etag").unwrap().to_str().unwrap().to_string();
    let snap: Value = serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(etag, format!("\"opt-{}\"", snap["version"]));
    for k in ["underlyings", "rates", "surfaces", "expiries", "series", "tenants", "groups", "controls", "clientLimits"] {
        assert!(snap[k].is_array(), "{k}");
    }
    assert!(snap["holidays"]["USD"].as_array().unwrap().iter().any(|d| d == "2026-11-26"));
    assert!(snap["underlyings"][0]["calendarCodes"].is_array() && snap["conventions"]["vol"].is_string());
    let res = t
        .app
        .clone()
        .oneshot(Request::get("/v1/internal/options/snapshot").header("x-kalks-internal", "test-token").header("if-none-match", &etag).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_MODIFIED);

    // ---------------- Back Office
    let (s, v) = t.call("PUT", "/v1/admin/options/rates/USD", &[STAFF], Some(json!({"rate": 0.035}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "reason required: {v}");
    let (s, v) = t.call("PUT", "/v1/admin/options/rates/USD", &[STAFF], Some(json!({"rate": 3.5, "reason": "Fed cut"}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "percent instead of decimal rejected: {v}");
    let (s, v) = t.call("PUT", "/v1/admin/options/rates/USD", &[STAFF], Some(json!({"rate": 0.035, "reason": "Fed cut 25bp"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert!(v["version"].as_i64().unwrap() > snap["version"].as_i64().unwrap());
    let hist = t.call("GET", "/v1/admin/options/rates/USD/history", &[STAFF], None).await.1;
    assert_eq!(hist["history"][0]["prevRate"], 0.03625);
    let (s, _) = t.call("PUT", "/v1/admin/options/rates/USD", &[STAFF, ("x-kalks-tenant", "otherbroker")], Some(json!({"rate": 0.01, "reason": "nope"}))).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "brokers cannot change platform rates");
    let (s, _) = t.call("PUT", "/v1/admin/options/rates/USD", &[], Some(json!({"rate": 0.01, "reason": "nope"}))).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED, "staff header required");

    // surface: calendar arbitrage rejected, a clean one publishes v2
    let bad = json!({"reason": "test", "pillars": [{"tenor": "1W", "days": 7, "atm": 0.12, "rr25": 0, "bf25": 0}, {"tenor": "1M", "days": 30, "atm": 0.05, "rr25": 0, "bf25": 0}]});
    let (s, v) = t.call("POST", "/v1/admin/options/surfaces/EURUSD", &[STAFF], Some(bad)).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(v["error"]["message"].as_str().unwrap().contains("calendar arbitrage"), "{v}");
    let good = json!({"reason": "ECB week", "blendWeight": 1.0, "pillars": [{"tenor": "1W", "days": 7, "atm": 0.08, "rr25": 0.001, "bf25": 0.002}, {"tenor": "1M", "days": 30, "atm": 0.085, "rr25": 0.001, "bf25": 0.002}]});
    let (s, v) = t.call("POST", "/v1/admin/options/surfaces/EURUSD", &[STAFF], Some(good)).await;
    assert_eq!((s, v["version"].as_i64()), (StatusCode::OK, Some(2)), "{v}");
    let chain2 = t.get("/v1/options/chain?u=EURUSD").await;
    assert_eq!(chain2["modelInputs"]["surfaceVersion"], 2);
    assert!((chain2["modelInputs"]["atmVol"].as_f64().unwrap() - 0.08).abs() < 0.0051);

    // groups: a group-specific spread changes the chain for that group only
    let (s, v) = t.call("PUT", "/v1/admin/options/groups/vip/*", &[STAFF], Some(json!({"volSpread": 0.001, "minSpreadUsd": 0.1}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let vip = t.get("/v1/options/chain?u=EURUSD&group=vip").await;
    let std = t.get("/v1/options/chain?u=EURUSD&group=standard").await;
    let w = |c: &Value| {
        let r = &c["rows"].as_array().unwrap()[10]["call"];
        r["ask"].as_f64().unwrap() - r["bid"].as_f64().unwrap()
    };
    assert!(w(&vip) < w(&std), "vip spread tighter");
    let (s, _) = t.call("DELETE", "/v1/admin/options/groups/*/*", &[STAFF], None).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY);

    // tenant switch: Kalks staff only, reason required, audited
    let (s, _) = t.call("PUT", "/v1/admin/options/tenants/otherbroker", &[STAFF, ("x-kalks-tenant", "otherbroker")], Some(json!({"enabledDemo": true, "reason": "self-enable"}))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, v) = t.call("PUT", "/v1/admin/options/tenants/otherbroker", &[STAFF], Some(json!({"enabledDemo": true, "underlyings": ["XAUUSD"], "reason": "pilot"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!(v["tenant"]["enabledLive"], false);
    let ob = t.call("GET", "/v1/options/underlyings", &[("x-kalks-tenant", "otherbroker")], None).await.1;
    assert_eq!(ob["underlyings"].as_array().unwrap().len(), 1);

    // controls: halt one expiry, freeze another, manual vol
    let date = chain["expiry"].as_str().unwrap().to_string();
    let (s, v) = t.call("POST", "/v1/admin/options/controls", &[STAFF], Some(json!({"scope": "expiry", "target": format!("EURUSD:{date}"), "mode": "halt", "reason": "bad feed"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let ctl_id = v["control"]["id"].as_i64().unwrap();
    let halted = t.get(&format!("/v1/options/chain?u=EURUSD&expiry={date}")).await;
    assert_eq!(halted["state"], "halted");
    assert_eq!(halted["rows"][0]["call"]["state"], "halted");
    let (s, _) = t.call("DELETE", &format!("/v1/admin/options/controls/{ctl_id}"), &[STAFF, ("x-kalks-tenant", "otherbroker")], None).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "reason required");
    let (s, _) = t.call("DELETE", &format!("/v1/admin/options/controls/{ctl_id}?reason=feed%20ok"), &[STAFF, ("x-kalks-tenant", "otherbroker")], None).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "a broker cannot clear another tenant's control");
    let (s, _) = t.call("DELETE", &format!("/v1/admin/options/controls/{ctl_id}?reason=feed%20ok"), &[STAFF], None).await;
    assert_eq!(s, StatusCode::OK);
    let (s, v) = t.call("POST", "/v1/admin/options/controls", &[STAFF], Some(json!({"scope": "underlying", "target": "EURUSD", "mode": "manual_vol", "manualVol": 0.2, "reason": "event"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let mv = t.get("/v1/options/chain?u=EURUSD").await;
    assert_eq!(mv["modelInputs"]["atmVol"], 0.2);
    let (s, v) = t.call("POST", "/v1/admin/options/controls", &[STAFF], Some(json!({"scope": "underlying", "target": "EURUSD", "mode": "freeze", "reason": "freeze"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert!((v["control"]["frozenSpot"].as_f64().unwrap() - 1.17004).abs() < 1e-12, "{v}");

    // client limits + audit trail
    let (s, _) = t.call("PUT", "/v1/admin/options/limits/42", &[STAFF], Some(json!({"maxContracts": 5, "reason": "new client"}))).await;
    assert_eq!(s, StatusCode::OK);
    let audit = t.call("GET", "/v1/admin/options/audit?limit=50", &[STAFF], None).await.1;
    let actions: Vec<&str> = audit["audit"].as_array().unwrap().iter().map(|a| a["action"].as_str().unwrap()).collect();
    for a in ["rate.update", "surface.publish", "group.upsert", "tenant.update", "control.add", "control.clear", "limit.upsert", "seed"] {
        assert!(actions.contains(&a), "{a} in {actions:?}");
    }

    // public chain once enabled, cached 1 s, without internal inputs
    t.call("PUT", "/v1/admin/options/tenants/kalks", &[STAFF], Some(json!({"publicChain": true, "reason": "guest page"}))).await;
    let res = t.app.clone().oneshot(Request::get("/v1/public/options/chain/xauusd").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let pc: Value = serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert!(pc["modelInputs"].is_null() && pc["rows"].as_array().unwrap().len() >= 21 && pc["expiries"].is_array());

    drop(t);
    drop_db(&url).await;
}

#[tokio::test]
async fn expiry_lists_follow_the_holiday_calendars() {
    let Some((t, url)) = setup("cal").await else { return };
    let rd = t.st.refdata().await;
    let d = |s: &str| optmath::Date::parse(s).unwrap();
    let at = |s: &str| Utc.from_utc_datetime(&chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()).timestamp_millis();

    // EURUSD from Monday 21 Dec 2026: daily skips Christmas, weekly/monthly roll to Thursday 24th.
    let eur = jobs::wanted_expiries(&rd, rd.underlying("EURUSD").unwrap(), at("2026-12-21 12:00"));
    let dates: Vec<_> = eur.keys().copied().collect();
    assert_eq!(&dates[..5], &["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24", "2026-12-28"].map(d));
    assert!(eur[&d("2026-12-24")].contains(&"weekly".to_string()) && eur[&d("2026-12-24")].contains(&"monthly".to_string()));
    assert!(eur.contains_key(&d("2027-01-29")), "January monthly");
    // USDJPY: 31 Dec and 1 Jan are JPY holidays.
    let jpy = jobs::wanted_expiries(&rd, rd.underlying("USDJPY").unwrap(), at("2026-12-28 12:00"));
    let jd: Vec<_> = jpy.keys().copied().take(4).collect();
    assert_eq!(jd, ["2026-12-28", "2026-12-29", "2026-12-30", "2027-01-04"].map(d));
    // Golden Week 2026: 4-6 May closed for JPY; the weekly expiry of that week is Friday 8 May.
    let gw = jobs::wanted_expiries(&rd, rd.underlying("EURJPY").unwrap(), at("2026-05-01 12:00"));
    assert!(!gw.contains_key(&d("2026-05-04")) && !gw.contains_key(&d("2026-05-05")) && !gw.contains_key(&d("2026-05-06")));
    assert!(!gw.contains_key(&d("2026-05-01")), "TARGET2 Labour Day");
    // Gold (London + New York): 31 Aug 2026 UK summer bank holiday is not an expiry.
    let xau = jobs::wanted_expiries(&rd, rd.underlying("XAUUSD").unwrap(), at("2026-08-28 16:00"));
    assert!(!xau.contains_key(&d("2026-08-31")) && xau.contains_key(&d("2026-09-01")));
    // After today's cut, today is no longer listed (10:00 NY = 14:00 UTC in October).
    let late = jobs::wanted_expiries(&rd, rd.underlying("EURUSD").unwrap(), at("2026-10-02 14:30"));
    assert!(!late.contains_key(&d("2026-10-02")) && late.contains_key(&d("2026-10-05")));
    let early = jobs::wanted_expiries(&rd, rd.underlying("EURUSD").unwrap(), at("2026-10-02 13:30"));
    assert!(early.contains_key(&d("2026-10-02")));
    drop(rd);
    drop(t);
    drop_db(&url).await;
}

#[tokio::test]
async fn twap_fixing_and_m1_fallback_path() {
    let Some((t, url)) = setup("fix").await else { return };
    jobs::list_series(&t.st).await.unwrap();
    let pool = &t.st.pool;
    // An expiry whose cut was 30 s ago, with 1 s samples over the 30-minute window (one 5-minute gap).
    let cut = Utc::now() - Duration::seconds(30);
    let cut = Utc.timestamp_opt(cut.timestamp(), 0).unwrap();
    let start = cut - Duration::minutes(30);
    let id: i64 = sqlx::query_scalar("INSERT INTO expiries (symbol, expiry_date, kinds, cut_at, twap_start) VALUES ('GBPUSD', '2026-01-02', '{daily}', $1, $2) RETURNING id")
        .bind(cut)
        .bind(start)
        .fetch_one(pool)
        .await
        .unwrap();
    let mut buf = vec![];
    for i in 0..1800 {
        if (600..900).contains(&i) {
            continue;
        }
        buf.push((id, start + Duration::seconds(i), if i < 900 { 1.3400 } else { 1.3500 }));
    }
    jobs::flush_samples(&t.st, &buf).await.unwrap();
    // A second expiry with no samples at all: waits for the M1 fallback (market-data absent here) and records an error.
    let id2: i64 = sqlx::query_scalar("INSERT INTO expiries (symbol, expiry_date, kinds, cut_at, twap_start) VALUES ('AUDUSD', '2026-01-02', '{daily}', $1, $2) RETURNING id")
        .bind(cut - Duration::minutes(5))
        .bind(start - Duration::minutes(5))
        .fetch_one(pool)
        .await
        .unwrap();
    let fixed = jobs::run_fixings(&t.st).await.unwrap();
    assert_eq!(fixed, 1);
    let fx = t.get("/v1/internal/options/fixings?expiry=2026-01-02").await;
    let f = fx["fixings"].as_array().unwrap().iter().find(|f| f["expiryId"] == id).unwrap().clone();
    assert_eq!((f["status"].as_str(), f["source"].as_str(), f["run"].as_i64()), (Some("fixed"), Some("twap"), Some(1)));
    // 900 s at 1.34 (600 sampled + 300 held through the gap) and 900 s at 1.35.
    assert!((f["fixing"].as_f64().unwrap() - 1.345).abs() < 1e-9, "{f}");
    assert_eq!((f["samples"].as_i64(), f["expected"].as_i64(), f["maxGapMs"].as_i64()), (Some(1500), Some(1800), Some(301_000)));
    let f2 = fx["fixings"].as_array().unwrap().iter().find(|f| f["expiryId"] == id2).unwrap().clone();
    assert_eq!(f2["status"], "fixing");
    assert!(f2["error"].as_str().unwrap().contains("no TWAP samples"), "{f2}");
    // Running again is a no-op for the fixed one.
    assert_eq!(jobs::run_fixings(&t.st).await.unwrap(), 0);
    // Manual re-fix within the window: run 2, audited; reason required.
    let (s, _) = t.call("POST", &format!("/v1/admin/options/expiries/{id}/refix"), &[STAFF], Some(json!({"price": 1.3449}))).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY);
    let (s, v) = t.call("POST", &format!("/v1/admin/options/expiries/{id}/refix"), &[STAFF], Some(json!({"price": 1.3449, "reason": "feed spike removed"}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!((v["expiry"]["fixing"].as_f64(), v["expiry"]["fixingRun"].as_i64(), v["expiry"]["fixingSource"].as_str()), (Some(1.3449), Some(2), Some("manual")));
    let runs = t.get(&format!("/v1/internal/options/fixings?u=GBPUSD&expiry={}", NaiveDate::from_ymd_opt(2026, 1, 2).unwrap())).await;
    assert_eq!(runs["fixings"][0]["runs"].as_array().unwrap().len(), 2);
    drop(t);
    drop_db(&url).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stream_sends_changed_rows_at_most_four_times_a_second() {
    let Some((t, url)) = setup("ws").await else { return };
    jobs::list_series(&t.st).await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let app = t.app.clone();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    // Guests are refused while the public chain is off; a BFF ticket works.
    assert!(tokio_tungstenite::connect_async(format!("ws://{addr}/v1/options/stream")).await.is_err());
    let tk = t.call("POST", "/v1/options/stream/ticket", &[], Some(json!({"group": "standard"}))).await.1;
    let (mut ws, _) = tokio_tungstenite::connect_async(format!("ws://{addr}/v1/options/stream?ticket={}", tk["ticket"].as_str().unwrap())).await.unwrap();
    let date = t.st.refdata().await.expiries.iter().filter(|e| e.symbol == "EURUSD" && e.status == "listed").map(|e| e.expiry_date).max().unwrap();
    ws.send(tokio_tungstenite::tungstenite::Message::text(json!({"op": "subscribe", "u": "EURUSD", "expiry": date}).to_string())).await.unwrap();
    let first: Value = serde_json::from_str(ws.next().await.unwrap().unwrap().to_text().unwrap()).unwrap();
    assert_eq!(first["type"], "chain");
    let rows_total = first["rows"].as_array().unwrap().len();
    // Tick the spot every 10 ms for 2 s.
    let spots = t.st.spots.clone();
    let ticker = tokio::spawn(async move {
        for i in 0..200 {
            let m = 1.17 + (i % 7) as f64 * 0.00003;
            spots.set("EURUSD", m - 0.00004, m + 0.00004, 0).await;
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    });
    let mut frames = 0;
    let mut partial = false;
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(2000);
    while let Ok(Some(Ok(m))) = tokio::time::timeout_at(deadline, ws.next()).await {
        let v: Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
        if v["type"] == "rows" {
            frames += 1;
            partial |= v["rows"].as_array().unwrap().len() <= rows_total;
        }
    }
    ticker.await.unwrap();
    // 250 ms throttle: at most 9 ticks fit in a 2 s window (fewer under CPU contention is fine).
    assert!((1..=9).contains(&frames), "{frames} frames in 2 s");
    assert!(partial);
    drop(t);
    drop_db(&url).await;
}
