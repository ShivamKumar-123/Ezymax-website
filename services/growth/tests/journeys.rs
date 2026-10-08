//! Journeys end to end against a throw-away database (GROWTH_TEST_DATABASE_URL, default :5433) with the gateway
//! mailer and the support notify endpoint mocked on one local HTTP server.

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use chrono::{Duration, Utc};
use growth::config::Config;
use growth::journeys;
use growth::state::AppState;
use growth::db;
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct Mock {
    mails: Vec<Value>,
    notes: Vec<Value>,
    /// user ids the "gateway" reports as unsubscribed
    unsubscribed: Vec<i64>,
    fail_mail: usize,
}
type M = Arc<Mutex<Mock>>;

async fn mail(State(m): State<M>, Json(b): Json<Value>) -> (axum::http::StatusCode, Json<Value>) {
    let mut g = m.lock().unwrap();
    if g.fail_mail > 0 {
        g.fail_mail -= 1;
        return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error": {"message": "smtp down"}})));
    }
    let uid = b["user_id"].as_i64().unwrap_or(0);
    let status = if g.unsubscribed.contains(&uid) { "suppressed" } else { "logged" };
    g.mails.push(b);
    (axum::http::StatusCode::OK, Json(json!({"status": status, "to": "a•••••@example.com"})))
}

async fn notify(State(m): State<M>, Json(b): Json<Value>) -> Json<Value> {
    m.lock().unwrap().notes.push(b);
    Json(json!({"results": []}))
}

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
        eprintln!("skipping journeys DB tests: no PostgreSQL at {base}");
        return None;
    }
    let name = format!("ezymex_growth_jtest_{}", std::process::id());
    let url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&url).await.expect("create + migrate");
    let m: M = Arc::new(Mutex::new(Mock::default()));
    let app = Router::new().route("/v1/internal/mail/marketing", post(mail)).route("/v1/notify", post(notify)).with_state(m.clone());
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_url = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    let mut cfg = Config::for_tests(&url);
    cfg.gateway_url = mock_url.clone();
    cfg.notify_url = mock_url;
    Some(Env { st: AppState::new(pool, cfg), m, admin, name })
}

impl Env {
    async fn drop(self) {
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    async fn profile(&self, user: i64, signed_up_ago_min: i64, deposited: bool) {
        sqlx::query("INSERT INTO profiles (tenant, user_id, first_name, last_name, email, signed_up_at, first_deposit_at) VALUES ('ezymex', $1, 'Ann', 'Lee', $2, $3, $4)")
            .bind(user)
            .bind(format!("u{user}@example.com"))
            .bind(Utc::now() - Duration::minutes(signed_up_ago_min))
            .bind(deposited.then(Utc::now))
            .execute(&self.st.pool)
            .await
            .unwrap();
    }

    async fn journey(&self, trigger: Value, steps: Value, live_since_ago_min: i64) -> i64 {
        sqlx::query_scalar("INSERT INTO journeys (tenant, name, trigger, steps, status, live_since, created_by) VALUES ('ezymex', 'J', $1, $2, 'live', $3, 'test') RETURNING id")
            .bind(sqlx::types::Json(trigger))
            .bind(sqlx::types::Json(steps))
            .bind(Utc::now() - Duration::minutes(live_since_ago_min))
            .fetch_one(&self.st.pool)
            .await
            .unwrap()
    }

    async fn status(&self, j: i64, user: i64) -> (String, i32) {
        let r: (String, i32) = sqlx::query_as("SELECT status, step_index FROM journey_enrollments WHERE journey_id = $1 AND user_id = $2").bind(j).bind(user).fetch_one(&self.st.pool).await.unwrap();
        r
    }

    async fn events(&self, j: i64, user: i64) -> Vec<String> {
        sqlx::query_scalar("SELECT kind FROM journey_events WHERE journey_id = $1 AND user_id = $2 ORDER BY id").bind(j).bind(user).fetch_all(&self.st.pool).await.unwrap()
    }
}

#[tokio::test]
async fn journey_enrols_sends_waits_and_exits() {
    let Some(e) = env().await else { return };
    // 1: signed up after the journey went live, 2: before (never enrolled), 3: deposited (fails the condition), 4: unsubscribed
    e.profile(1, 5, false).await;
    e.profile(2, 120, false).await;
    e.profile(3, 5, true).await;
    e.profile(4, 5, false).await;
    e.m.lock().unwrap().unsubscribed.push(4);
    let steps = json!([
        {"kind": "email", "id": "welcome", "subject": "Welcome {{first_name}}", "heading": "Hi {{first_name}}", "body": "Glad you're here.", "buttonLabel": "Deposit", "buttonUrl": "/wallet/deposit"},
        {"kind": "condition", "id": "nodep", "check": "has_deposit", "expect": false},
        {"kind": "inapp", "id": "nudge", "title": "Fund your account", "body": "Deposit to start trading", "link": "/wallet/deposit"},
        {"kind": "wait", "id": "w1", "amount": 2, "unit": "days"},
        {"kind": "email", "id": "later", "subject": "Still there?", "heading": "Hi", "body": "Reminder."}
    ]);
    let j = e.journey(json!({"kind": "signed_up"}), steps, 60).await;

    assert_eq!(journeys::enrol_tick(&e.st).await.unwrap(), 3);
    assert_eq!(journeys::enrol_tick(&e.st).await.unwrap(), 0, "enrolment is once per client");
    assert_eq!(journeys::run_tick(&e.st).await.unwrap(), 3);

    // client 1: email, condition, in-app, parked on the wait
    assert_eq!(e.status(j, 1).await, ("active".into(), 4));
    assert_eq!(e.events(j, 1).await, ["enrolled", "email_logged", "condition_met", "inapp_sent", "waiting"]);
    // client 3 deposited: exits at the condition
    assert_eq!(e.status(j, 3).await.0, "exited");
    // client 4 is unsubscribed: the email is suppressed, the journey still carries on in-app
    assert!(e.events(j, 4).await.contains(&"email_suppressed".to_string()));
    {
        let g = e.m.lock().unwrap();
        let first = g.mails.iter().find(|m| m["user_id"] == 1).unwrap();
        assert_eq!(first["subject"], "Welcome Ann");
        assert_eq!(first["button_url"], "/wallet/deposit");
        assert_eq!(first["test"], false);
        let note = g.notes.iter().find(|n| n["userId"] == 1).unwrap();
        assert_eq!(note["type"], "marketing.journey");
        assert_eq!(note["email"], false);
        assert!(note["dedupeKey"].as_str().unwrap().starts_with("journey:"));
    }
    // nothing is due until the wait ends
    assert_eq!(journeys::run_tick(&e.st).await.unwrap(), 0);
    sqlx::query("UPDATE journey_enrollments SET next_run_at = now() WHERE journey_id = $1 AND user_id = 1").bind(j).execute(&e.st.pool).await.unwrap();
    // a mailer outage is retried, not skipped
    e.m.lock().unwrap().fail_mail = 1;
    journeys::run_tick(&e.st).await.unwrap();
    assert_eq!(e.status(j, 1).await, ("active".into(), 4));
    sqlx::query("UPDATE journey_enrollments SET next_run_at = now() WHERE journey_id = $1 AND user_id = 1").bind(j).execute(&e.st.pool).await.unwrap();
    journeys::run_tick(&e.st).await.unwrap();
    assert_eq!(e.status(j, 1).await.0, "completed");
    assert!(e.events(j, 1).await.ends_with(&["error".to_string(), "email_logged".to_string(), "completed".to_string()]));

    // step stats count outcomes per step
    let parsed: Vec<journeys::Step> = serde_json::from_value(sqlx::query_scalar::<_, sqlx::types::Json<Value>>("SELECT steps FROM journeys WHERE id = $1").bind(j).fetch_one(&e.st.pool).await.unwrap().0).unwrap();
    let stats = journeys::step_stats(&e.st, j, &parsed).await.unwrap();
    assert_eq!(stats[0]["counts"]["email_logged"], 2);
    assert_eq!(stats[0]["counts"]["email_suppressed"], 1);
    assert_eq!(stats[1]["counts"]["condition_not_met"], 1);

    // a paused journey doesn't move; no_deposit triggers after N days
    sqlx::query("UPDATE journeys SET status = 'paused' WHERE id = $1").bind(j).execute(&e.st.pool).await.unwrap();
    sqlx::query("UPDATE journey_enrollments SET next_run_at = now() WHERE journey_id = $1").bind(j).execute(&e.st.pool).await.unwrap();
    assert_eq!(journeys::run_tick(&e.st).await.unwrap(), 0);
    sqlx::query("UPDATE profiles SET signed_up_at = now() - interval '3 days' WHERE user_id = 2").execute(&e.st.pool).await.unwrap();
    let j2 = e.journey(json!({"kind": "no_deposit", "days": 2}), json!([{"kind": "inapp", "id": "n", "title": "Need help depositing?"}]), 60 * 24 * 2).await;
    journeys::enrol_tick(&e.st).await.unwrap();
    let enrolled: Vec<i64> = sqlx::query_scalar("SELECT user_id FROM journey_enrollments WHERE journey_id = $1 ORDER BY user_id").bind(j2).fetch_all(&e.st.pool).await.unwrap();
    assert_eq!(enrolled, [2]);
    e.drop().await;
}
