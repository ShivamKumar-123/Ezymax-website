//! Referral codes and the "link counts after the first deposit" rule. Code format tests are pure; the sign-up tests
//! run the real register handler against a throwaway PostgreSQL database (GATEWAY_TEST_DATABASE_URL, skipped with
//! a note when none is reachable) with a stand-in wallet / support ([`Stub`]); the HTTP client is tested against a
//! local stand-in server.

use super::*;
use crate::state::Ctx;
use crate::testdb::TestDb;
use axum::http::StatusCode;
use std::collections::HashMap;
use std::sync::Mutex;

/// Stand-in wallet and support service: first deposits per user (`Err` = wallet unreachable), the wallet calls made
/// and the referrers notified.
#[derive(Default)]
pub(crate) struct Stub {
    pub deposits: Mutex<HashMap<i64, Result<Option<DateTime<Utc>>, String>>>,
    pub asked: Mutex<Vec<i64>>,
    pub notified: Mutex<Vec<(String, i64)>>,
}

impl Stub {
    pub fn set(&self, user: i64, v: Result<Option<DateTime<Utc>>, String>) {
        self.deposits.lock().unwrap().insert(user, v);
    }
    pub fn notified(&self) -> Vec<(String, i64)> {
        self.notified.lock().unwrap().clone()
    }
    pub fn asked(&self) -> usize {
        self.asked.lock().unwrap().len()
    }
}

impl Upstream for Stub {
    async fn first_deposit(&self, _tenant: &str, user_id: i64) -> Result<Option<DateTime<Utc>>, String> {
        self.asked.lock().unwrap().push(user_id);
        self.deposits.lock().unwrap().get(&user_id).cloned().unwrap_or(Ok(None))
    }
    async fn notify_inactive(&self, tenant: &str, referrer: i64) {
        self.notified.lock().unwrap().push((tenant.to_string(), referrer));
    }
}

#[test]
fn new_codes_carry_no_name_and_no_ambiguous_characters() {
    let mut seen = std::collections::HashSet::new();
    for _ in 0..2000 {
        let c = new_code();
        assert_eq!(c.len(), 8, "{c}");
        assert!(c.starts_with("EZ"), "{c}");
        assert!(!c[2..].contains(['0', 'O', '1', 'I', 'L']), "{c}");
        assert!(c.chars().all(|x| x.is_ascii_uppercase() || x.is_ascii_digit()), "{c}");
        assert!(is_new_code(&c), "{c}");
        seen.insert(c);
    }
    assert!(seen.len() > 1990, "codes are random");
    assert_eq!(ALPHABET.len(), 31);
    // the old format (first name + 4 digits) is not a new code
    for old in ["SHIVAM4821", "PRIYA1234", "EZYMEX1000", "EZ1234", "EZRA1234", "ez7kq4mx"] {
        assert!(!is_new_code(old), "{old}");
    }
}

#[test]
fn the_inactive_notice_names_nobody() {
    let n = inactive_notice(42, "2026-10-10");
    assert_eq!((n["type"].as_str(), n["userId"].as_i64(), n["link"].as_str()), (Some("ib.referral_inactive"), Some(42), Some("/wallet/deposit")));
    assert_eq!(n["title"], "Deposit to activate your referral link");
    assert_eq!(n["dedupeKey"], "referral:inactive:42:2026-10-10");
    assert!(n["body"].as_str().unwrap().starts_with("Someone signed up with your referral link"));
    assert!(n["data"].as_object().unwrap().keys().all(|k| k == "reason"), "no data about the new client");
}

async fn client(db: &TestDb, email: &str, first: &str, code: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, terms_accepted_at)
         VALUES (1, $1, 'x', $2, 'Tester', '+91', '9820144721', 'IN', '1990-01-01', $3, now()) RETURNING id",
    )
    .bind(email)
    .bind(first)
    .bind(code)
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn old_codes_move_aside_and_keep_resolving() {
    let Some(db) = TestDb::new("referral re-code").await else { return };
    let pool = &db.st.pool;
    // clients from before the change: first name + 4 digits
    let shivam = client(&db, "shivam@example.com", "Shivam", "SHIVAM4821").await;
    let priya = client(&db, "priya@example.com", "Priya", "PRIYA1234").await;
    let gone = client(&db, "gone@example.com", "Gone", "GONE5555").await;
    sqlx::query("UPDATE users SET deleted_at = now(), first_name = 'Deleted', last_name = 'Client' WHERE id = $1").bind(gone).execute(pool).await.unwrap();
    let house: i64 = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, terms_accepted_at, is_house)
         VALUES (1, 'house-x@ezymex.house.invalid', '!x', 'Desk', 'House account', '', '', 'XX', '1970-01-01', 'HOUSEAB12CD34EF', now(), true) RETURNING id",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    let before: DateTime<Utc> = sqlx::query_scalar("SELECT updated_at FROM users WHERE id = $1").bind(shivam).fetch_one(pool).await.unwrap();

    // what the migration ran on the live data (20261010120000_referral_codes.sql)
    let n: i32 = sqlx::query_scalar("SELECT ezymex_recode_referrals()").fetch_one(pool).await.unwrap();
    assert_eq!(n, 3);
    let row = |id: i64| async move {
        sqlx::query_as::<_, (String, Option<String>, DateTime<Utc>)>("SELECT referral_code, referral_code_legacy, updated_at FROM users WHERE id = $1").bind(id).fetch_one(pool).await.unwrap()
    };
    let (s_code, s_old, s_at) = row(shivam).await;
    let (p_code, p_old, _) = row(priya).await;
    assert!(is_new_code(&s_code) && is_new_code(&p_code) && s_code != p_code, "{s_code} {p_code}");
    assert_eq!((s_old.as_deref(), p_old.as_deref()), (Some("SHIVAM4821"), Some("PRIYA1234")));
    assert!(s_at > before, "the referral feed sends the new code to the mirrors");
    // a deleted client keeps no old code (it held their first name); a house user keeps its HOUSE code
    let (g_code, g_old, _) = row(gone).await;
    assert!(is_new_code(&g_code) && g_old.is_none());
    assert_eq!(row(house).await.0, "HOUSEAB12CD34EF");

    // both the new and the old code resolve to the client
    assert_eq!(resolve(pool, 1, &s_code).await.unwrap(), Some(shivam));
    assert_eq!(resolve(pool, 1, "SHIVAM4821").await.unwrap(), Some(shivam));
    assert_eq!(resolve(pool, 1, "PRIYA1234").await.unwrap(), Some(priya));
    assert_eq!(resolve(pool, 1, "GONE5555").await.unwrap(), None);
    assert_eq!(resolve(pool, 2, "SHIVAM4821").await.unwrap(), None, "codes are per broker");

    // running it again changes nothing (no EZ link ever changes)
    let n: i32 = sqlx::query_scalar("SELECT ezymex_recode_referrals()").fetch_one(pool).await.unwrap();
    assert_eq!(n, 0);
    assert_eq!(row(shivam).await.0, s_code);
    // an old code can't be taken as a current code by anybody else
    let clash = sqlx::query("UPDATE users SET referral_code_legacy = 'PRIYA1234' WHERE id = $1").bind(shivam).execute(pool).await;
    assert!(clash.is_err(), "old codes are unique per broker");
    db.drop_db().await;
}

fn ctx(n: u32) -> Ctx {
    // a different IP per sign-up keeps the per-IP sign-up limit out of the way
    Ctx { ip: format!("203.0.113.{n}"), user_agent: "test".into(), device: Some(format!("device-{n:012}")), tenant_slug: "ezymex".into(), bearer: None }
}

fn signup(email: &str, code: Option<&str>, campaign: Option<&str>) -> crate::client_auth::RegisterReq {
    serde_json::from_value(json!({
        "first_name": "Nina", "last_name": "Rao", "email": email, "phone_dial": "+91", "phone": "9820144721", "country": "IN",
        "date_of_birth": "1992-03-04", "password": "Sup3r-secret!", "accept_terms": true,
        "referral_code": code, "referral_campaign": campaign,
    }))
    .unwrap()
}

#[derive(Debug, PartialEq)]
struct Row {
    referred_by: Option<i64>,
    raw: Option<String>,
    campaign: Option<String>,
    held: Option<String>,
    held_for: Option<i64>,
}

async fn signed_up(db: &TestDb, email: &str) -> (i64, String, Row) {
    let r = sqlx::query_as::<_, (i64, String, Option<i64>, Option<String>, Option<String>, Option<String>, Option<i64>)>(
        "SELECT id, referral_code, referred_by, referred_code_raw, referral_campaign, referral_held, referral_held_for FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_one(&db.st.pool)
    .await
    .unwrap();
    (r.0, r.1, Row { referred_by: r.2, raw: r.3, campaign: r.4, held: r.5, held_for: r.6 })
}

#[tokio::test]
async fn sign_ups_count_only_once_the_referrer_has_deposited() {
    let Some(db) = TestDb::new("referral sign-ups").await else { return };
    let st = &db.st;
    let funded = client(&db, "funded@example.com", "Funded", "FUNDED1111").await;
    let fresh = client(&db, "fresh@example.com", "Fresh", "FRESH2222").await;
    let unknown = client(&db, "nowallet@example.com", "Nowallet", "NOWALLET3333").await;
    let n: i32 = sqlx::query_scalar("SELECT ezymex_recode_referrals()").fetch_one(&st.pool).await.unwrap();
    assert_eq!(n, 3);
    let code_of = |id: i64| async move { sqlx::query_scalar::<_, String>("SELECT referral_code FROM users WHERE id = $1").bind(id).fetch_one(&st.pool).await.unwrap() };
    let fresh_code = code_of(fresh).await;
    let stub = Stub::default();
    let first_deposit = Utc::now() - chrono::Duration::days(3);
    stub.set(funded, Ok(Some(first_deposit)));
    stub.set(unknown, Err("not reachable".into()));
    let register = |n: u32, email: &'static str, code: Option<String>, campaign: Option<&'static str>| {
        let stub = &stub;
        async move { crate::client_auth::register_with(st, &ctx(n), signup(email, code.as_deref(), campaign), stub).await }
    };

    // 1. a funded referrer: attributed (through the OLD code: links shared before the change still work), with the campaign
    let (status, _) = register(1, "a@example.com", Some("FUNDED1111".into()), Some("yt")).await.unwrap();
    assert_eq!(status, StatusCode::CREATED);
    let (_, code, row) = signed_up(&db, "a@example.com").await;
    assert_eq!(row, Row { referred_by: Some(funded), raw: Some("FUNDED1111".into()), campaign: Some("yt".into()), held: None, held_for: None });
    assert!(is_new_code(&code), "the new client's own code has no name: {code}");
    let cached: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT referral_active_at FROM users WHERE id = $1").bind(funded).fetch_one(&st.pool).await.unwrap();
    assert_eq!(cached.map(|c| c.timestamp()), Some(first_deposit.timestamp()), "the first deposit is cached");
    let asked = stub.asked();
    let _ = register(2, "a2@example.com", Some(code_of(funded).await), None).await.unwrap();
    assert_eq!(signed_up(&db, "a2@example.com").await.2.referred_by, Some(funded));
    assert_eq!(stub.asked(), asked, "an active link isn't asked again");
    assert!(stub.notified().is_empty());

    // 2. a referrer without a deposit: the sign-up goes through, not attributed, the referrer is told
    let (status, _) = register(3, "b@example.com", Some(fresh_code.clone()), Some("yt")).await.unwrap();
    assert_eq!(status, StatusCode::CREATED);
    let (b_id, _, row) = signed_up(&db, "b@example.com").await;
    assert_eq!(row, Row { referred_by: None, raw: Some(fresh_code.clone()), campaign: None, held: Some("not_funded".into()), held_for: Some(fresh) });
    assert_eq!(stub.notified(), vec![("ezymex".to_string(), fresh)]);
    let audit: Value = sqlx::query_scalar("SELECT meta FROM audit_log WHERE action = 'user.register' AND actor_id = $1").bind(b_id).fetch_one(&st.pool).await.unwrap();
    assert_eq!((audit["referral_held"].as_str(), audit["referral_held_for"].as_i64(), audit["referred_by"].as_i64()), (Some("not_funded"), Some(fresh), None));

    // 3. the wallet can't be asked: not attributed (the owner's rule), no notice, the sign-up still goes through
    let (status, _) = register(4, "c@example.com", Some("NOWALLET3333".into()), None).await.unwrap();
    assert_eq!(status, StatusCode::CREATED);
    let (_, _, row) = signed_up(&db, "c@example.com").await;
    assert_eq!((row.referred_by, row.held.as_deref(), row.held_for), (None, Some("unverified"), Some(unknown)));
    assert_eq!(stub.notified().len(), 1);

    // 4. an unknown code is kept raw, as before
    let _ = register(5, "d@example.com", Some("NOSUCH99".into()), None).await.unwrap();
    assert_eq!(signed_up(&db, "d@example.com").await.2, Row { referred_by: None, raw: Some("NOSUCH99".into()), campaign: None, held: None, held_for: None });

    // the clients' own records say whether their link counts
    let me = |id: i64| {
        let stub = &stub;
        async move {
        let mut u = crate::client_auth::user_json(st, id).await.unwrap();
        crate::client_auth::referral_fields(st, stub, &mut u, id).await.unwrap();
        (u["referral_active"].as_bool(), u["referral_inactive_reason"].as_str().map(str::to_string))
        }
    };
    assert_eq!(me(funded).await, (Some(true), None));
    assert_eq!(me(fresh).await, (Some(false), Some("no_deposit".into())));
    assert_eq!(me(unknown).await, (Some(false), Some("unavailable".into())));

    // 5. once the referrer deposits, the next sign-up counts (the earlier one stays as it was)
    stub.set(fresh, Ok(Some(Utc::now())));
    let _ = register(6, "e@example.com", Some(fresh_code.clone()), None).await.unwrap();
    assert_eq!(signed_up(&db, "e@example.com").await.2.referred_by, Some(fresh));
    assert_eq!(signed_up(&db, "b@example.com").await.2.referred_by, None);
    assert_eq!(me(fresh).await, (Some(true), None));
    assert_eq!(stub.notified().len(), 1);
    db.drop_db().await;
}

#[tokio::test]
async fn the_http_client_asks_the_wallet_and_tells_support() {
    use axum::extract::{Path, State as AxState};
    use axum::http::HeaderMap;
    use axum::routing::{get, post};
    use axum::{Json, Router};
    use std::sync::Arc;

    let seen: Arc<Mutex<Vec<Value>>> = Default::default();
    let app = Router::new()
        .route(
            "/v1/internal/users/{id}/funded",
            get(|Path(id): Path<i64>, h: HeaderMap| async move {
                assert_eq!((h["x-ezymex-internal"].to_str().unwrap(), h["x-ezymex-tenant"].to_str().unwrap()), ("w", "ezymex"));
                match id {
                    1 => (StatusCode::OK, Json(json!({"funded": true, "first_deposit_at": "2026-10-01T08:30:00Z"}))),
                    2 => (StatusCode::OK, Json(json!({"funded": false, "first_deposit_at": null}))),
                    3 => (StatusCode::OK, Json(json!({"status": "odd"}))),
                    _ => (StatusCode::FORBIDDEN, Json(json!({"error": {"code": "forbidden", "message": "Not allowed."}}))),
                }
            }),
        )
        .route(
            "/v1/notify",
            post(|AxState(seen): AxState<Arc<Mutex<Vec<Value>>>>, h: HeaderMap, Json(b): Json<Value>| async move {
                assert_eq!((h["x-ezymex-internal"].to_str().unwrap(), h["x-ezymex-service"].to_str().unwrap()), ("s", "gateway"));
                seen.lock().unwrap().push(b);
                Json(json!({"results": []}))
            }),
        )
        .with_state(seen.clone());
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    let h = Http::new(base.clone(), "w".into(), base, "s".into());

    assert_eq!(h.first_deposit("ezymex", 1).await.unwrap().map(|d| d.to_rfc3339()), Some("2026-10-01T08:30:00+00:00".into()));
    assert_eq!(h.first_deposit("ezymex", 2).await, Ok(None));
    assert!(h.first_deposit("ezymex", 3).await.is_err(), "an odd answer is not 'no deposit'");
    assert_eq!(h.first_deposit("ezymex", 4).await, Err("HTTP 403".into()));
    let down = Http::new("http://127.0.0.1:9".into(), String::new(), String::new(), String::new());
    assert_eq!(down.first_deposit("ezymex", 1).await, Err("not reachable".into()));

    h.notify_inactive("ezymex", 42).await;
    for _ in 0..50 {
        if !seen.lock().unwrap().is_empty() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    let sent = seen.lock().unwrap().clone();
    assert_eq!(sent.len(), 1);
    assert_eq!((sent[0]["type"].as_str(), sent[0]["userId"].as_i64()), (Some("ib.referral_inactive"), Some(42)));
}
