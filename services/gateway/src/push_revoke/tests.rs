//! Push revocation tests. The reference and backoff rules run everywhere; the flows run the real revocation
//! handlers against a throwaway PostgreSQL database (see `testdb`) and deliver to a stub support service; they are
//! skipped, with a note, when no server is reachable.

use super::*;
use crate::identity::{self, Kind};
use crate::state::Ctx;
use crate::testdb::TestDb;
use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};

#[test]
fn device_refs_match_the_support_service() {
    // the same vector is asserted in services/support src/push.rs
    assert_eq!(device_ref("AbCdEfGhIjKlMnOpQrStUvWx"), "e53524511f4ac4100ef53c6238fc293d65bd8f1cbfc63284d8007d9d669b06a1");
    assert_ne!(device_ref("a"), device_ref("b"));
    assert!(device_ref("x").bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()));
}

#[test]
fn backs_off_to_an_hour() {
    assert_eq!(backoff_secs(0), 15);
    assert_eq!(backoff_secs(1), 30);
    assert_eq!(backoff_secs(5), 480);
    assert_eq!(backoff_secs(8), 3600);
    assert_eq!(backoff_secs(40), 3600);
}

const PHONE: &str = "phone-installation-aaaaaaaa";
const TABLET: &str = "tablet-installation-bbbbbbb";
const BROWSER: &str = "web-browser-device-ccccccc";

fn on(device: &str, bearer: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.40".into(), user_agent: "Kalks/1 CFNetwork/1568.100.1 Darwin/24.0.0".into(), device: Some(device.into()), tenant_slug: "kalks".into(), bearer: bearer.map(str::to_string) }
}

async fn client(db: &TestDb, email: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, email_verified_at)
         VALUES (1, $1, 'x', 'Lena', 'Ortiz', '+971', '501234567', 'ae', '1990-01-01', $2, now(), now()) RETURNING id",
    )
    .bind(email)
    .bind(format!("P{}", crate::crypto::random_token(6)))
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

async fn staff(db: &TestDb, role: &str) -> String {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO staff (tenant_id, email, password_hash, name, role, role_id)
         VALUES (1, $1, 'x', $2, $3, (SELECT id FROM roles WHERE tenant_id = 1 AND key = $3)) RETURNING id",
    )
    .bind(format!("{role}-{}@kalks.test", crate::crypto::random_token(4).to_lowercase()))
    .bind(format!("Staff {role}"))
    .bind(role)
    .fetch_one(&db.st.pool)
    .await
    .unwrap();
    identity::create_session(&db.st, &on(BROWSER, None), Kind::Staff, 1, id).await.unwrap().token
}

async fn session_id(db: &TestDb, token: &str) -> i64 {
    sqlx::query_scalar("SELECT id FROM sessions WHERE token_hash = $1").bind(db.st.keys.hash("session", token)).fetch_one(&db.st.pool).await.unwrap()
}

/// Queued revocations: (user_id, devices, all_devices), oldest first; clears the queue.
async fn take(db: &TestDb) -> Vec<(Option<i64>, Vec<String>, bool)> {
    let rows = sqlx::query_as("SELECT user_id, devices, all_devices FROM push_revocations WHERE delivered_at IS NULL ORDER BY id").fetch_all(&db.st.pool).await.unwrap();
    sqlx::query("DELETE FROM push_revocations").execute(&db.st.pool).await.unwrap();
    rows
}

#[tokio::test]
async fn revoked_sessions_queue_their_phones() {
    let Some(db) = TestDb::new("push revocations").await else { return };
    let st = || State(db.st.clone());
    let uid = client(&db, "lena@gmail.com").await;
    let other = client(&db, "omar@gmail.com").await;
    let web = identity::create_session(&db.st, &on(BROWSER, None), Kind::User, 1, uid).await.unwrap();
    let phone = identity::create_session(&db.st, &on(PHONE, None), Kind::User, 1, uid).await.unwrap();
    let phone_again = identity::create_session(&db.st, &on(PHONE, None), Kind::User, 1, uid).await.unwrap();
    let tablet = identity::create_session(&db.st, &on(TABLET, None), Kind::User, 1, uid).await.unwrap();
    let theirs = identity::create_session(&db.st, &on(TABLET, None), Kind::User, 1, other).await.unwrap();
    // sessions remember their installation by reference, never the id itself
    let refs: Vec<Option<String>> = sqlx::query_scalar("SELECT device_ref FROM sessions WHERE subject_id = $1 ORDER BY id").bind(uid).fetch_all(&db.st.pool).await.unwrap();
    assert_eq!(refs, vec![Some(device_ref(BROWSER)), Some(device_ref(PHONE)), Some(device_ref(PHONE)), Some(device_ref(TABLET))]);
    let raw: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions WHERE device_ref LIKE '%installation%'").fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(raw, 0);
    let me = || on(BROWSER, Some(&web.token));

    // the client signs the tablet out from the web: its phone's pushes end
    let _ = crate::client_security::revoke_session(st(), me(), Path(session_id(&db, &tablet.token).await)).await.unwrap();
    assert_eq!(take(&db).await, vec![(Some(uid), vec![device_ref(TABLET)], false)]);
    // one of two sessions on the phone ends: the phone is still signed in, nothing is queued
    let _ = crate::client_security::revoke_session(st(), me(), Path(session_id(&db, &phone.token).await)).await.unwrap();
    assert_eq!(take(&db).await, vec![]);
    // "sign out other devices": the phone's last session goes, the web (this device) stays; a view-only login on
    // another device is never a phone of the client
    sqlx::query("INSERT INTO sessions (tenant_id, subject_kind, subject_id, token_hash, expires_at, viewer_id, device_ref) VALUES (1, 'user', $1, 'viewer-x', now() + interval '1 day', 77, $2)")
        .bind(uid)
        .bind(device_ref("viewer-laptop-dddddddddd"))
        .execute(&db.st.pool)
        .await
        .unwrap();
    let Json(v) = crate::client_security::revoke_others(st(), me()).await.unwrap();
    assert_eq!(v["revoked"], 2);
    assert_eq!(take(&db).await, vec![(Some(uid), vec![device_ref(PHONE)], false)]);
    assert!(identity::resolve_session(&db.st, &on(PHONE, Some(&phone_again.token)), Kind::User).await.is_err());

    // a staff member revokes one session from the Back Office
    let again = identity::create_session(&db.st, &on(PHONE, None), Kind::User, 1, uid).await.unwrap();
    let sa = staff(&db, "super_admin").await;
    let _ = crate::admin::revoke_session(st(), on(BROWSER, Some(&sa)), Path(session_id(&db, &again.token).await), Ok(Json(crate::admin::RevokeReq { reason: Some("Lost phone".into()) }))).await.unwrap();
    assert_eq!(take(&db).await, vec![(Some(uid), vec![device_ref(PHONE)], false)]);
    // ...or signs the client out everywhere: every phone
    let req = serde_json::from_value(json!({"reason": "Account takeover report"})).unwrap();
    let _ = crate::client_security::admin_revoke_all(st(), on(BROWSER, Some(&sa)), Path(uid), Ok(Json(req))).await.unwrap();
    assert_eq!(take(&db).await, vec![(Some(uid), vec![], true)]);
    // a password reset signs the client out everywhere too
    identity::revoke_all(&db.st.pool, Kind::User, uid).await.unwrap();
    assert_eq!(take(&db).await, vec![(Some(uid), vec![], true)]);
    // staff sign-outs never concern phones
    identity::revoke_all(&db.st.pool, Kind::Staff, 1).await.unwrap();
    assert_eq!(take(&db).await, vec![]);

    // a sign-in block ends every session in the same transaction
    let compliance = staff(&db, "compliance").await;
    let req = serde_json::from_value(json!({"reason": "Chargeback fraud, ticket 118"})).unwrap();
    let _ = crate::client_controls::put_restriction(st(), on(BROWSER, Some(&compliance)), Path((other, "login".into())), Ok(Json(req))).await.unwrap();
    assert_eq!(take(&db).await, vec![(Some(other), vec![], true)]);
    assert!(identity::resolve_session(&db.st, &on(TABLET, Some(&theirs.token)), Kind::User).await.is_err());

    // the Platform Owner suspends a broker: every phone of its clients
    let owner = staff(&db, "platform_owner").await;
    let broker: i64 = sqlx::query_scalar("INSERT INTO tenants (slug, name) VALUES ('acme-fx', 'Acme FX') RETURNING id").fetch_one(&db.st.pool).await.unwrap();
    let req = serde_json::from_value(json!({"reason": "Unpaid invoices"})).unwrap();
    let _ = crate::owner::suspend_tenant(st(), on(BROWSER, Some(&owner)), Path(broker), Ok(Json(req))).await.unwrap();
    let q: Vec<(i64, Option<i64>, bool)> = sqlx::query_as("SELECT tenant_id, user_id, all_devices FROM push_revocations").fetch_all(&db.st.pool).await.unwrap();
    assert_eq!(q, vec![(broker, None, true)]);
    db.drop_db().await;
}

/// A stub support service: answers each call with the next status (then 200) and keeps every body.
#[derive(Default)]
struct Stub {
    statuses: Vec<u16>,
    bodies: Vec<(Value, Option<String>)>,
}

async fn stub_support(stub: Arc<Mutex<Stub>>) -> String {
    let app = axum::Router::new()
        .route(
            "/v1/push/tokens/revoke",
            axum::routing::post(|State(s): State<Arc<Mutex<Stub>>>, h: axum::http::HeaderMap, Json(b): Json<Value>| async move {
                let mut s = s.lock().unwrap();
                s.bodies.push((b, h.get("x-kalks-internal").and_then(|v| v.to_str().ok()).map(str::to_string)));
                let status = if s.statuses.is_empty() { 200 } else { s.statuses.remove(0) };
                (axum::http::StatusCode::from_u16(status).unwrap(), Json(json!({"removed": 1})))
            }),
        )
        .with_state(stub);
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    base
}

#[tokio::test]
async fn revocations_reach_the_support_service() {
    let Some(mut db) = TestDb::new("push revocation delivery").await else { return };
    let stub = Arc::new(Mutex::new(Stub { statuses: vec![503], ..Default::default() }));
    let base = stub_support(stub.clone()).await;
    let mut cfg = (*db.st.cfg).clone();
    cfg.support_url = base;
    cfg.support_token = "support-token".into();
    db.st.cfg = Arc::new(cfg);
    let http = http();
    let uid = client(&db, "zara@gmail.com").await;
    sessions_ended(&db.st.pool, 1, uid, &[device_ref(PHONE), device_ref(PHONE), device_ref(TABLET)]).await;
    client_signed_out(&db.st.pool, 1, uid).await;

    // the service is down: nothing is lost, the queue waits with a backoff
    assert_eq!(deliver(&db.st, &http).await.unwrap(), (0, 1));
    let (attempts, error, wait): (i32, Option<String>, f64) = sqlx::query_as("SELECT attempts, last_error, EXTRACT(EPOCH FROM next_attempt_at - now())::float8 FROM push_revocations ORDER BY id LIMIT 1").fetch_one(&db.st.pool).await.unwrap();
    assert_eq!((attempts, error.as_deref()), (1, Some("HTTP 503 Service Unavailable")));
    assert!((10.0..=16.0).contains(&wait), "{wait}");
    assert_eq!(deliver(&db.st, &http).await.unwrap(), (0, 0), "not due yet");
    sqlx::query("UPDATE push_revocations SET next_attempt_at = now()").execute(&db.st.pool).await.unwrap();
    assert_eq!(deliver(&db.st, &http).await.unwrap(), (2, 0));
    assert_eq!(deliver(&db.st, &http).await.unwrap(), (0, 0), "delivered once");
    {
        let s = stub.lock().unwrap();
        assert_eq!(s.bodies.len(), 3);
        let (b, token) = &s.bodies[1];
        assert_eq!(token.as_deref(), Some("support-token"));
        assert_eq!((b["tenant"].as_str(), b["userId"].as_i64(), b["all"].as_bool()), (Some("kalks"), Some(uid), Some(false)));
        let mut want = vec![device_ref(PHONE), device_ref(TABLET)];
        want.sort();
        assert_eq!(b["devices"], json!(want), "each phone once");
        assert!(chrono::DateTime::parse_from_rfc3339(b["before"].as_str().unwrap()).is_ok());
        assert_eq!((s.bodies[2].0["all"].as_bool(), s.bodies[2].0["devices"].as_array().map(Vec::len)), (Some(true), Some(0)));
    }
    // a refusal (a wrong token, a bad request) is not retried
    stub.lock().unwrap().statuses = vec![403];
    tenant_signed_out(&db.st.pool, 1).await;
    assert_eq!(deliver(&db.st, &http).await.unwrap(), (0, 1));
    sqlx::query("UPDATE push_revocations SET next_attempt_at = now()").execute(&db.st.pool).await.unwrap();
    assert_eq!(deliver(&db.st, &http).await.unwrap(), (0, 0));
    assert_eq!(stub.lock().unwrap().bodies.last().unwrap().0["userId"], Value::Null);
    let given_up: i64 = sqlx::query_scalar("SELECT count(*) FROM push_revocations WHERE attempts >= $1 AND delivered_at IS NULL").bind(MAX_ATTEMPTS).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(given_up, 1);
    // housekeeping keeps a month
    sweep(&db.st.pool).await.unwrap();
    assert_eq!(db.count("SELECT count(*) FROM push_revocations WHERE id > $1", 0).await, 3);
    sqlx::query("UPDATE push_revocations SET created_at = now() - interval '31 days'").execute(&db.st.pool).await.unwrap();
    sweep(&db.st.pool).await.unwrap();
    assert_eq!(db.count("SELECT count(*) FROM push_revocations WHERE id > $1", 0).await, 0);
    db.drop_db().await;
}
