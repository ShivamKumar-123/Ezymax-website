//! Step-up tests. Wording / parsing tests are pure; the flow test runs the real handlers against a throwaway
//! PostgreSQL database (see `testdb`) and is skipped, with a note, when no server is reachable.

use super::*;
use crate::testdb::TestDb;

#[test]
fn actions_and_targets() {
    assert_eq!(parse_action("leverage"), Some("leverage"));
    assert_eq!(parse_action(" trading_password "), Some("trading_password"));
    assert_eq!(parse_action("delete_everything"), None);
    assert_eq!(parse_action(""), None);
    assert_eq!(clean_target(None).as_deref(), Some(""));
    assert_eq!(clean_target(Some(" 10000123 ")).as_deref(), Some("10000123"));
    assert!(clean_target(Some("<b>x</b>")).is_none());
    assert!(clean_target(Some("has space")).is_none());
    assert!(clean_target(Some(&"1".repeat(41))).is_none());
}

#[test]
fn email_wording_names_the_change() {
    assert_eq!(describe("trading_password", "10000123"), "change the trading password of trading account #10000123");
    assert_eq!(describe("investor_password", ""), "change the investor password of a trading account");
    assert_eq!(describe("leverage", "10000123"), "change the leverage of trading account #10000123");
    assert_eq!(describe("account_password", ""), "change your Client Area password");
    for a in ACTIONS {
        assert!(!describe(a, "1").contains("make a change"), "{a} has no wording");
    }
}

// ---------- flow test against PostgreSQL ----------

fn code(e: &ApiError) -> String {
    match e {
        ApiError::Coded { code, .. } => (*code).into(),
        ApiError::Validation { field, .. } => format!("field:{field}"),
        ApiError::InvalidCode { .. } => "invalid_code".into(),
        ApiError::CodeExpired => "code_expired".into(),
        ApiError::RateLimited { .. } => "rate_limited".into(),
        ApiError::Unauthorized => "unauthorized".into(),
        ApiError::BadRequest(_) => "bad_request".into(),
        other => format!("{other:?}"),
    }
}

fn ctx(bearer: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.9".into(), user_agent: "test".into(), device: Some("device-stepup-aaaa".into()), tenant_slug: "kalks".into(), bearer: bearer.map(str::to_string) }
}

async fn user(db: &TestDb, email: &str, password: &str) -> i64 {
    let hash = crypto::hash_password(password).unwrap();
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, email_verified_at)
         VALUES (1, $1, $2, 'Priya', 'Shah', '+971', '501234567', 'ae', '1990-01-01', $3, now(), now()) RETURNING id",
    )
    .bind(email)
    .bind(hash)
    .bind(format!("T{}", crypto::random_token(6)))
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

fn sreq(action: &str, target: Option<&str>) -> Json<StepupReq> {
    Json(StepupReq { action: action.into(), target: target.map(str::to_string) })
}

fn vreq(challenge: &str, code: &str, action: &str, target: Option<&str>) -> Json<VerifyReq> {
    Json(VerifyReq { challenge: challenge.into(), code: code.into(), action: action.into(), target: target.map(str::to_string) })
}

fn creq(token: &str, user_id: i64, action: &str, target: Option<&str>) -> Json<ConsumeReq> {
    Json(ConsumeReq { token: token.into(), user_id, action: action.into(), target: target.map(str::to_string) })
}

fn wrong(code: &str) -> String {
    format!("{:06}", (code.parse::<u32>().unwrap() + 1) % 1_000_000)
}

#[tokio::test]
async fn stepup_flows() {
    let Some(db) = TestDb::new("step-up").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "stepup@gmail.com", "Kalks@2026").await;
    let other = user(&db, "other@gmail.com", "Kalks@2026").await;
    let sess = identity::create_session(&db.st, &ctx(None), K, 1, uid).await.unwrap();
    let other_sess = identity::create_session(&db.st, &ctx(None), K, 1, other).await.unwrap();
    let me = || ctx(Some(&sess.token));

    // a session is required; unknown actions and odd targets are refused
    assert_eq!(code(&request(st(), ctx(None), Ok(sreq("leverage", None))).await.unwrap_err()), "unauthorized");
    assert_eq!(code(&request(st(), me(), Ok(sreq("drop_tables", None))).await.unwrap_err()), "field:action");
    assert_eq!(code(&request(st(), me(), Ok(sreq("leverage", Some("#1 <b>"))) ).await.unwrap_err()), "field:target");

    // request -> challenge with the dev code (dev mode, no SMTP), masked email and the action
    let Json(ch) = request(st(), me(), Ok(sreq("investor_password", Some("10000123")))).await.unwrap();
    assert_eq!(ch["status"], "otp_required");
    assert_eq!(ch["purpose"], "confirm");
    assert_eq!(ch["action"], "investor_password");
    assert_eq!(ch["target"], "10000123");
    assert_ne!(ch["email_masked"], "stepup@gmail.com");
    assert_eq!(ch["resend_in"], 30);
    let challenge = ch["challenge"].as_str().unwrap().to_string();
    let dev = ch["dev_code"].as_str().unwrap().to_string();
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'user.stepup_requested'", uid).await, 1);

    // a confirmation code never signs anyone in
    let e = crate::client_auth::verify_email(st(), ctx(None), Ok(Json(crate::client_auth::VerifyReq { challenge: challenge.clone(), code: dev.clone() }))).await.unwrap_err();
    assert_eq!(code(&e), "code_expired");
    // ...and that attempt consumed it: start again
    let Json(ch) = request(st(), me(), Ok(sreq("investor_password", Some("10000123")))).await.unwrap();
    let challenge = ch["challenge"].as_str().unwrap().to_string();
    let dev = ch["dev_code"].as_str().unwrap().to_string();

    // another client can't use or resend it
    let e = verify(st(), ctx(Some(&other_sess.token)), Ok(vreq(&challenge, &dev, "investor_password", Some("10000123")))).await.unwrap_err();
    assert_eq!(code(&e), "code_expired");
    let e = resend(st(), ctx(Some(&other_sess.token)), Ok(Json(ResendReq { challenge: challenge.clone() }))).await.unwrap_err();
    assert_eq!(code(&e), "code_expired");
    // a code for one change can't confirm another
    let e = verify(st(), me(), Ok(vreq(&challenge, &dev, "leverage", Some("10000123")))).await.unwrap_err();
    assert_eq!(code(&e), "bad_request");
    let e = verify(st(), me(), Ok(vreq(&challenge, &dev, "investor_password", Some("10000999")))).await.unwrap_err();
    assert_eq!(code(&e), "bad_request");
    // wrong code counts an attempt and is audited
    let e = verify(st(), me(), Ok(vreq(&challenge, &wrong(&dev), "investor_password", Some("10000123")))).await.unwrap_err();
    assert!(matches!(e, ApiError::InvalidCode { attempts_left: 4 }));
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'user.stepup_failed'", uid).await, 1);
    // resend is on cooldown right after sending
    let e = resend(st(), me(), Ok(Json(ResendReq { challenge: challenge.clone() }))).await.unwrap_err();
    assert_eq!(code(&e), "rate_limited");

    // correct code -> single-use token bound to user + action + target
    let Json(ok) = verify(st(), me(), Ok(vreq(&challenge, &dev, "investor_password", Some("10000123")))).await.unwrap();
    assert_eq!(ok["status"], "ok");
    assert_eq!(ok["expires_in"], TOKEN_TTL_SECS);
    let token = ok["stepup_token"].as_str().unwrap().to_string();
    assert!(token.len() >= 43);
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'user.stepup_verified'", uid).await, 1);
    // stored hashed only
    let stored: Vec<u8> = sqlx::query_scalar("SELECT token_hash FROM stepup_tokens WHERE user_id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(stored, db.st.keys.hash("stepup", &token));
    // the code itself is spent
    let e = verify(st(), me(), Ok(vreq(&challenge, &dev, "investor_password", Some("10000123")))).await.unwrap_err();
    assert_eq!(code(&e), "code_expired");

    // consume: wrong user / action / target / token all fail without burning the token
    for (t, u, a, tg) in [
        (token.as_str(), other, "investor_password", Some("10000123")),
        (token.as_str(), uid, "trading_password", Some("10000123")),
        (token.as_str(), uid, "investor_password", Some("10000124")),
        (token.as_str(), uid, "investor_password", None),
        ("not-the-token", uid, "investor_password", Some("10000123")),
    ] {
        let e = consume(st(), ctx(None), Ok(creq(t, u, a, tg))).await.unwrap_err();
        assert_eq!(code(&e), "stepup_invalid");
    }
    assert_eq!(code(&consume(st(), ctx(None), Ok(creq("", uid, "investor_password", Some("10000123")))).await.unwrap_err()), "stepup_required");
    let Json(v) = consume(st(), ctx(None), Ok(creq(&token, uid, "investor_password", Some("10000123")))).await.unwrap();
    assert_eq!(v["status"], "ok");
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'user.stepup_consumed'", uid).await, 1);
    // single use
    let e = consume(st(), ctx(None), Ok(creq(&token, uid, "investor_password", Some("10000123")))).await.unwrap_err();
    assert_eq!(code(&e), "stepup_invalid");

    // expired tokens are refused
    let Json(ch) = request(st(), me(), Ok(sreq("leverage", Some("10000123")))).await.unwrap();
    let Json(ok) = verify(st(), me(), Ok(vreq(ch["challenge"].as_str().unwrap(), ch["dev_code"].as_str().unwrap(), "leverage", Some("10000123")))).await.unwrap();
    let lev_token = ok["stepup_token"].as_str().unwrap().to_string();
    sqlx::query("UPDATE stepup_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND action = 'leverage'").bind(uid).execute(&db.st.pool).await.unwrap();
    let e = consume(st(), ctx(None), Ok(creq(&lev_token, uid, "leverage", Some("10000123")))).await.unwrap_err();
    assert_eq!(code(&e), "stepup_invalid");

    // pending codes for different actions don't cancel each other
    let Json(a) = request(st(), me(), Ok(sreq("trading_password", Some("10000123")))).await.unwrap();
    let Json(_b) = request(st(), me(), Ok(sreq("leverage", Some("10000123")))).await.unwrap();
    let _ = verify(st(), me(), Ok(vreq(a["challenge"].as_str().unwrap(), a["dev_code"].as_str().unwrap(), "trading_password", Some("10000123")))).await.unwrap();

    // ---------- Client Area password ----------
    let second = identity::create_session(&db.st, &ctx(None), K, 1, uid).await.unwrap();
    let preq = |current: &str, new: &str, token: &str, others: bool| Json(PasswordReq { current: current.into(), new_password: new.into(), stepup_token: token.into(), sign_out_others: others });
    // weak / unchanged new password
    assert_eq!(code(&change_password(st(), me(), Ok(preq("Kalks@2026", "short", "", true))).await.unwrap_err()), "field:new");
    assert_eq!(code(&change_password(st(), me(), Ok(preq("Kalks@2026", "Kalks@2026", "", true))).await.unwrap_err()), "field:new");
    // no step-up token
    assert_eq!(code(&change_password(st(), me(), Ok(preq("Kalks@2026", "Better#Pass9", "", true))).await.unwrap_err()), "stepup_required");
    // a token for another action doesn't work
    let Json(ch) = request(st(), me(), Ok(sreq("leverage", None))).await.unwrap();
    let Json(ok) = verify(st(), me(), Ok(vreq(ch["challenge"].as_str().unwrap(), ch["dev_code"].as_str().unwrap(), "leverage", None))).await.unwrap();
    let e = change_password(st(), me(), Ok(preq("Kalks@2026", "Better#Pass9", ok["stepup_token"].as_str().unwrap(), true))).await.unwrap_err();
    assert_eq!(code(&e), "stepup_invalid");

    let Json(ch) = request(st(), me(), Ok(sreq("account_password", None))).await.unwrap();
    let Json(ok) = verify(st(), me(), Ok(vreq(ch["challenge"].as_str().unwrap(), ch["dev_code"].as_str().unwrap(), "account_password", None))).await.unwrap();
    let pw_token = ok["stepup_token"].as_str().unwrap().to_string();
    // wrong current password: refused, counted, token kept
    let e = change_password(st(), me(), Ok(preq("Wrong@2026", "Better#Pass9", &pw_token, true))).await.unwrap_err();
    assert_eq!(code(&e), "field:current");
    assert_eq!(db.count("SELECT failed_logins::bigint FROM users WHERE id = $1", uid).await, 1);
    let Json(v) = change_password(st(), me(), Ok(preq("Kalks@2026", "Better#Pass9", &pw_token, true))).await.unwrap();
    assert_eq!(v["status"], "ok");
    // the other session (and nothing else) was signed out; this one stays
    assert!(v["sessions_revoked"].as_u64().unwrap() >= 1);
    assert_eq!(db.count("SELECT count(*) FROM sessions WHERE subject_id = $1 AND revoked_at IS NULL", uid).await, 1);
    assert!(identity::resolve_session(&db.st, &me(), K).await.is_ok());
    assert!(identity::resolve_session(&db.st, &ctx(Some(&second.token)), K).await.is_err());
    assert!(identity::resolve_session(&db.st, &ctx(Some(&other_sess.token)), K).await.is_ok());
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert!(crypto::verify_password("Better#Pass9", &hash));
    assert_eq!(db.count("SELECT failed_logins::bigint FROM users WHERE id = $1", uid).await, 0);
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'user.password_changed'", uid).await, 1);
    // the token is spent
    let e = change_password(st(), me(), Ok(preq("Better#Pass9", "Third#Pass10", &pw_token, false))).await.unwrap_err();
    assert_eq!(code(&e), "stepup_invalid");

    // requests are rate limited per user
    let mut limited = false;
    for _ in 0..15 {
        if let Err(e) = request(st(), me(), Ok(sreq("withdrawal", None))).await
            && code(&e) == "rate_limited"
        {
            limited = true;
            break;
        }
    }
    assert!(limited);

    db.drop_db().await;
}
