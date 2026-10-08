//! Client security tests. Pure helpers run everywhere; the flows run the real handlers against a throwaway
//! PostgreSQL database (see `testdb`) and are skipped, with a note, when no server is reachable.

use super::*;
use crate::stepup::{self, StepupReq, VerifyReq};
use crate::testdb::TestDb;

#[test]
fn usernames() {
    assert_eq!(clean_username(" Priya.View-01 ").as_deref(), Some("priya.view-01"));
    assert!(clean_username("abc").is_none());
    assert!(clean_username("a@b.com").is_none());
    assert!(clean_username("-lead").is_none());
    assert!(clean_username("has space").is_none());
    assert!(clean_username(&"a".repeat(33)).is_none());
    let d = default_username("Priya");
    assert!(d.starts_with("priya-view-") && clean_username(&d).as_deref() == Some(d.as_str()));
    assert!(default_username("Ó").starts_with("client-view-"));
}

#[test]
fn generated_passwords_meet_the_rules() {
    for _ in 0..200 {
        let p = generate_password();
        assert_eq!(p.chars().count(), 16);
        assert!(crate::validate::password(&p).is_ok(), "{p}");
    }
    assert_ne!(generate_password(), generate_password());
}

#[test]
fn countries_and_sections() {
    assert_eq!(identity::clean_country(Some("IN")).as_deref(), Some("in"));
    assert_eq!(identity::clean_country(Some("XX")), None);
    assert_eq!(identity::clean_country(Some("T1")), None);
    assert_eq!(identity::clean_country(None), None);
    assert!(clean_sections(&["accounts".into(), "accounts".into(), "history".into()]).unwrap().len() == 2);
    assert!(clean_sections(&[]).is_err());
    assert!(clean_sections(&["profile".into()]).is_err());
    assert!(clean_accounts(&["10000123".into(), "x1".into()]).is_err());
}

fn code(e: &ApiError) -> String {
    match e {
        ApiError::Coded { code, .. } => (*code).into(),
        ApiError::Validation { field, .. } => format!("field:{field}"),
        ApiError::Unauthorized => "unauthorized".into(),
        ApiError::InvalidCredentials => "invalid_credentials".into(),
        ApiError::BadRequest(_) => "bad_request".into(),
        ApiError::NotFound => "not_found".into(),
        ApiError::Forbidden => "forbidden".into(),
        ApiError::Locked { .. } => "locked".into(),
        other => format!("{other:?}"),
    }
}

fn ctx(bearer: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.20".into(), user_agent: "Mozilla/5.0 (Macintosh) Chrome/131".into(), device: Some("device-security-aaaa".into()), tenant_slug: "ezymex".into(), bearer: bearer.map(str::to_string) }
}

async fn user(db: &TestDb, email: &str) -> i64 {
    let hash = crypto::hash_password("Ezymex@2026").unwrap();
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

/// A verified `viewer_access` step-up token for the session in `c`.
async fn stepup_token(db: &TestDb, c: impl Fn() -> Ctx) -> String {
    let Json(ch) = stepup::request(State(db.st.clone()), c(), Ok(Json(StepupReq { action: "viewer_access".into(), target: None }))).await.unwrap();
    let Json(ok) = stepup::verify(
        State(db.st.clone()),
        c(),
        Ok(Json(VerifyReq { challenge: ch["challenge"].as_str().unwrap().into(), code: ch["dev_code"].as_str().unwrap().into(), action: "viewer_access".into(), target: None })),
    )
    .await
    .unwrap();
    ok["stepup_token"].as_str().unwrap().to_string()
}

fn login_req(id: &str, pw: &str) -> Json<crate::client_auth::LoginReq> {
    Json(crate::client_auth::LoginReq { email: id.into(), password: pw.into() })
}

#[tokio::test]
async fn sessions_list_and_revoke() {
    let Some(db) = TestDb::new("client-security sessions").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "sessions@gmail.com").await;
    let other = user(&db, "someone@gmail.com").await;
    let a = identity::COUNTRY.scope(Some("in".into()), identity::create_session(&db.st, &ctx(None), K, 1, uid)).await.unwrap();
    let b = identity::create_session(&db.st, &ctx(None), K, 1, uid).await.unwrap();
    let c = identity::create_session(&db.st, &ctx(None), K, 1, uid).await.unwrap();
    let theirs = identity::create_session(&db.st, &ctx(None), K, 1, other).await.unwrap();
    let me = || ctx(Some(&a.token));

    let Json(v) = sessions(st(), me()).await.unwrap();
    let items = v["items"].as_array().unwrap();
    assert_eq!(items.len(), 3);
    assert_eq!(items[0]["current"], true);
    assert_eq!(items[0]["country"], "in");
    assert_eq!(v["idle_minutes"], 1440);
    let b_id = items.iter().find(|x| x["current"] == false).unwrap()["id"].as_i64().unwrap();

    // the current session can't be revoked from the list; another client's session is not found
    let a_id = items[0]["id"].as_i64().unwrap();
    assert_eq!(code(&revoke_session(st(), me(), Path(a_id)).await.unwrap_err()), "bad_request");
    let their_id: i64 = sqlx::query_scalar("SELECT id FROM sessions WHERE subject_id = $1").bind(other).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(code(&revoke_session(st(), me(), Path(their_id)).await.unwrap_err()), "not_found");

    // revoke one: that device is signed out at once, the others stay
    revoke_session(st(), me(), Path(b_id)).await.unwrap();
    let revoked_tok = if sqlx::query_scalar::<_, i64>("SELECT id FROM sessions WHERE token_hash = $1").bind(db.st.keys.hash("session", &b.token)).fetch_one(&db.st.pool).await.unwrap() == b_id { &b } else { &c };
    assert!(identity::resolve_session(&db.st, &ctx(Some(&revoked_tok.token)), K).await.is_err());
    assert!(identity::resolve_session(&db.st, &me(), K).await.is_ok());
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'user.session_revoked'", uid).await, 1);

    // revoke all others
    let Json(v) = revoke_others(st(), me()).await.unwrap();
    assert_eq!(v["revoked"], 1);
    assert!(identity::resolve_session(&db.st, &ctx(Some(&c.token)), K).await.is_err());
    assert!(identity::resolve_session(&db.st, &ctx(Some(&b.token)), K).await.is_err());
    assert!(identity::resolve_session(&db.st, &me(), K).await.is_ok());
    // other clients are untouched
    assert!(identity::resolve_session(&db.st, &ctx(Some(&theirs.token)), K).await.is_ok());

    // the tenant idle setting ends quiet sessions
    sqlx::query("UPDATE tenants SET client_idle_minutes = 5 WHERE id = 1").execute(&db.st.pool).await.unwrap();
    sqlx::query("UPDATE sessions SET last_seen_at = now() - interval '6 minutes' WHERE subject_id = $1").bind(other).execute(&db.st.pool).await.unwrap();
    assert!(identity::resolve_session(&db.st, &ctx(Some(&theirs.token)), K).await.is_err());
    assert!(identity::resolve_session(&db.st, &me(), K).await.is_ok());

    // login history shows the revocations
    let Json(h) = logins(st(), me()).await.unwrap();
    assert!(h["items"].as_array().unwrap().iter().any(|x| x["result"] == "signed_out_device"));

    db.drop_db().await;
}

#[tokio::test]
async fn viewer_logins_are_read_only() {
    let Some(db) = TestDb::new("client-security viewers").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "owner@gmail.com").await;
    let owner = identity::create_session(&db.st, &ctx(None), K, 1, uid).await.unwrap();
    let me = || ctx(Some(&owner.token));

    // creating a viewer needs a fresh email confirmation
    let mk = |token: String, username: Option<&str>| {
        Json(CreateViewerReq {
            label: "My accountant".into(),
            username: username.map(str::to_string),
            accounts: vec!["10000123".into()],
            sections: vec!["accounts".into(), "history".into()],
            expires_at: None,
            stepup_token: token,
        })
    };
    assert_eq!(code(&create_viewer(st(), me(), Ok(mk(String::new(), None))).await.unwrap_err()), "stepup_required");
    let tok = stepup_token(&db, me).await;
    let (status, Json(created)) = create_viewer(st(), me(), Ok(mk(tok, Some("priya-acct")))).await.unwrap();
    assert_eq!(status, StatusCode::CREATED);
    let password = created["password"].as_str().unwrap().to_string();
    let vid = created["viewer"]["id"].as_i64().unwrap();
    assert_eq!(created["viewer"]["username"], "priya-acct");
    // only the hash is stored
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM client_viewers WHERE id = $1").bind(vid).fetch_one(&db.st.pool).await.unwrap();
    assert!(!hash.contains(&password) && crypto::verify_password(&password, &hash));
    // usernames are unique per tenant
    let tok = stepup_token(&db, me).await;
    assert_eq!(code(&create_viewer(st(), me(), Ok(mk(tok, Some("priya-acct")))).await.unwrap_err()), "field:username");

    // viewer sign-in on the normal login route (an id without '@')
    let e = crate::client_auth::login(st(), ctx(None), Ok(login_req("priya-acct", "Wrong#Pass1"))).await.unwrap_err();
    assert_eq!(code(&e), "invalid_credentials");
    let Json(v) = crate::client_auth::login(st(), ctx(None), Ok(login_req("Priya-Acct", &password))).await.unwrap();
    assert_eq!(v["status"], "ok");
    let vtok = v["session"]["token"].as_str().unwrap().to_string();
    assert!(vtok.starts_with(identity::VIEWER_TOKEN_PREFIX));
    assert_eq!(v["viewer"]["sections"], json!(["accounts", "history"]));
    // the viewer sees no contact details
    assert_ne!(v["user"]["email"], "owner@gmail.com");
    assert_eq!(v["user"]["phone"], "");
    let viewer = || ctx(Some(&vtok));

    // /me works and carries the scope
    let Json(m) = crate::client_auth::me(st(), viewer()).await.unwrap();
    assert_eq!(m["viewer"]["id"], vid);
    assert_eq!(m["user"]["id"], uid);
    let Json(m) = crate::client_auth::me(st(), me()).await.unwrap();
    assert!(m["viewer"].is_null());

    // every change is refused for the viewer session
    let ro = |r: ApiResult<()>| assert_eq!(code(&r.unwrap_err()), "viewer_read_only");
    ro(identity::resolve_session(&db.st, &viewer(), K).await.map(|_| ()));
    ro(sessions(st(), viewer()).await.map(|_| ()));
    ro(revoke_others(st(), viewer()).await.map(|_| ()));
    ro(logins(st(), viewer()).await.map(|_| ()));
    ro(viewers(st(), viewer()).await.map(|_| ()));
    ro(create_viewer(st(), viewer(), Ok(mk("x".into(), None))).await.map(|_| ()));
    ro(revoke_viewer(st(), viewer(), Path(vid)).await.map(|_| ()));
    ro(create_request(st(), viewer(), Ok(Json(CreateRequestReq { kind: "closure".into(), reason: None }))).await.map(|_| ()));
    ro(stepup::request(st(), viewer(), Ok(Json(StepupReq { action: "withdrawal".into(), target: None }))).await.map(|_| ()));
    ro(stepup::change_password(st(), viewer(), Ok(Json(stepup::PasswordReq { current: "Ezymex@2026".into(), new_password: "Other#Pass99".into(), stepup_token: "x".into(), sign_out_others: true }))).await.map(|_| ()));
    ro(crate::kyc::start(st(), viewer(), Ok(Json(crate::kyc::StartReq { kind: "individual".into() }))).await.map(|_| ()));
    // the owner's password is unchanged and nothing was created
    assert_eq!(db.count("SELECT count(*) FROM client_requests WHERE user_id = $1", uid).await, 0);
    assert_eq!(db.count("SELECT count(*) FROM kyc_cases WHERE user_id = $1", uid).await, 0);

    // page views are logged for the owner (deduplicated)
    for _ in 0..3 {
        viewer_activity(st(), viewer(), Ok(Json(ActivityReq { path: "/accounts".into() }))).await.unwrap();
    }
    assert_eq!(code(&viewer_activity(st(), viewer(), Ok(Json(ActivityReq { path: "/api/x".into() }))).await.unwrap_err()), "field:path");
    let Json(list) = viewers(st(), me()).await.unwrap();
    let acts = list["activity"].as_array().unwrap();
    assert_eq!(acts.iter().filter(|a| a["action"] == "viewer.page_view").count(), 1);
    assert!(acts.iter().any(|a| a["action"] == "viewer.login"));
    assert!(acts.iter().any(|a| a["action"] == "viewer.login_failed"));
    // the owner sees the viewer's session in their list, labelled
    let Json(s) = sessions(st(), me()).await.unwrap();
    assert!(s["items"].as_array().unwrap().iter().any(|x| x["viewer"]["label"] == "My accountant"));

    // editing the scope applies to the live session; expiry in the past is refused
    let Json(u) = update_viewer(st(), me(), Path(vid), Ok(Json(UpdateViewerReq { label: None, accounts: None, sections: Some(vec!["dashboard".into()]), expires_at: None }))).await.unwrap();
    assert_eq!(u["viewer"]["sections"], json!(["dashboard"]));
    let past = Utc::now() - Duration::days(1);
    let e = update_viewer(st(), me(), Path(vid), Ok(Json(UpdateViewerReq { label: None, accounts: None, sections: None, expires_at: Some(Some(past)) }))).await.unwrap_err();
    assert_eq!(code(&e), "field:expires_at");

    // an expired login can't sign in and its sessions stop working
    sqlx::query("UPDATE client_viewers SET expires_at = now() - interval '1 minute' WHERE id = $1").bind(vid).execute(&db.st.pool).await.unwrap();
    assert!(identity::resolve_session_any(&db.st, &viewer(), K).await.is_err());
    let e = crate::client_auth::login(st(), ctx(None), Ok(login_req("priya-acct", &password))).await.unwrap_err();
    assert_eq!(code(&e), "viewer_inactive");
    sqlx::query("UPDATE client_viewers SET expires_at = NULL WHERE id = $1").bind(vid).execute(&db.st.pool).await.unwrap();

    // a new password ends the viewer's sessions; the old password stops working
    let tok = stepup_token(&db, me).await;
    let Json(np) = viewer_password(st(), me(), Path(vid), Ok(Json(ViewerPasswordReq { stepup_token: tok }))).await.unwrap();
    let new_pw = np["password"].as_str().unwrap().to_string();
    assert!(identity::resolve_session_any(&db.st, &viewer(), K).await.is_err());
    assert_eq!(code(&crate::client_auth::login(st(), ctx(None), Ok(login_req("priya-acct", &password))).await.unwrap_err()), "invalid_credentials");
    let Json(v2) = crate::client_auth::login(st(), ctx(None), Ok(login_req("priya-acct", &new_pw))).await.unwrap();
    let vtok2 = v2["session"]["token"].as_str().unwrap().to_string();

    // revoking ends access at once
    revoke_viewer(st(), me(), Path(vid)).await.unwrap();
    assert!(identity::resolve_session_any(&db.st, &ctx(Some(&vtok2)), K).await.is_err());
    assert_eq!(code(&crate::client_auth::login(st(), ctx(None), Ok(login_req("priya-acct", &new_pw))).await.unwrap_err()), "viewer_inactive");
    // the owner is still signed in
    assert!(identity::resolve_session(&db.st, &me(), K).await.is_ok());

    db.drop_db().await;
}

#[tokio::test]
async fn closure_and_export_requests() {
    let Some(db) = TestDb::new("client-security requests").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "closing@gmail.com").await;
    let sess = identity::create_session(&db.st, &ctx(None), K, 1, uid).await.unwrap();
    let me = || ctx(Some(&sess.token));
    let req = |kind: &str| Ok(Json(CreateRequestReq { kind: kind.into(), reason: Some("Moving brokers".into()) }));

    assert_eq!(code(&create_request(st(), me(), req("delete_all")).await.unwrap_err()), "field:kind");
    let (_, Json(exp)) = create_request(st(), me(), req("data_export")).await.unwrap();
    let exp_id = exp["request"]["id"].as_i64().unwrap();
    // one pending request per kind
    assert_eq!(code(&create_request(st(), me(), req("data_export")).await.unwrap_err()), "request_pending");
    // the export isn't downloadable before staff complete it
    assert_eq!(code(&export(st(), me(), Path(exp_id)).await.unwrap_err()), "not_found");
    sqlx::query("UPDATE client_requests SET status = 'completed' WHERE id = $1").bind(exp_id).execute(&db.st.pool).await.unwrap();
    let Json(data) = export(st(), me(), Path(exp_id)).await.unwrap();
    assert_eq!(data["profile"]["email"], "closing@gmail.com");
    assert!(!data["sessions"].as_array().unwrap().is_empty());

    let (_, Json(cl)) = create_request(st(), me(), req("closure")).await.unwrap();
    let cl_id = cl["request"]["id"].as_i64().unwrap();
    let Json(c) = cancel_request(st(), me(), Path(cl_id)).await.unwrap();
    assert_eq!(c["request"]["status"], "cancelled");
    // a cancelled request frees the slot
    let (_, Json(cl)) = create_request(st(), me(), req("closure")).await.unwrap();
    assert_eq!(cl["request"]["status"], "open");
    let Json(list) = requests(st(), me()).await.unwrap();
    assert_eq!(list["items"].as_array().unwrap().len(), 3);

    db.drop_db().await;
}
