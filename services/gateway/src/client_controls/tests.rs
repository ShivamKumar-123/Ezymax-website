//! Client controls tests. Pure rules (presence, freeze expansion, reasons, expiry) run everywhere; the flows
//! run the real handlers against a throwaway PostgreSQL database (see `testdb`) and are skipped, with a note,
//! when no server is reachable.

use super::*;
use crate::testdb::TestDb;

#[test]
fn presence_is_online_away_offline() {
    let now = Utc::now();
    assert_eq!(presence(Some(now), now), Presence::Online);
    assert_eq!(presence(Some(now - Duration::seconds(119)), now), Presence::Online);
    assert_eq!(presence(Some(now - Duration::seconds(120)), now), Presence::Away);
    assert_eq!(presence(Some(now - Duration::minutes(14)), now), Presence::Away);
    assert_eq!(presence(Some(now - Duration::minutes(15)), now), Presence::Offline);
    assert_eq!(presence(Some(now - Duration::days(3)), now), Presence::Offline);
    assert_eq!(presence(None, now), Presence::Offline);
    assert_eq!(Presence::Away.as_str(), "away");
}

#[test]
fn freeze_expands_to_everything_but_sign_in() {
    let now = Utc::now();
    let e = expand(&[("freeze".into(), None)]);
    assert_eq!(e.keys().copied().collect::<Vec<_>>(), vec!["deposits", "ib", "social", "trading", "transfers", "withdrawals"]);
    assert!(!e.contains_key("login") && !e.contains_key("close_only"));
    // the longest expiry wins; "until lifted" beats any date
    let soon = now + Duration::hours(1);
    let later = now + Duration::days(2);
    let e = expand(&[("freeze".into(), Some(soon)), ("withdrawals".into(), Some(later)), ("trading".into(), None), ("login".into(), Some(soon)), ("bogus".into(), None)]);
    assert_eq!(e["withdrawals"], Some(later));
    assert_eq!(e["deposits"], Some(soon));
    assert_eq!(e["trading"], None);
    assert_eq!(e["login"], Some(soon));
    assert!(!e.contains_key("bogus"));
    assert!(expand(&[]).is_empty());
}

#[test]
fn kinds_reasons_and_expiry() {
    assert_eq!(kind(" trading "), Some("trading"));
    assert_eq!(kind("root"), None);
    assert_eq!(perm_for("login"), "clients.block");
    assert_eq!(perm_for("freeze"), "clients.restrict");
    assert!(KINDS.iter().all(|k| label(k) != "Restricted"));
    assert!(clean_reason("  no ").is_err());
    assert_eq!(clean_reason(" AML review #42\u{7} ").unwrap(), "AML review #42");
    let now = Utc::now();
    assert!(clean_expiry(Some(now), now).is_err());
    assert!(clean_expiry(Some(now + Duration::days(6 * 366)), now).is_err());
    assert!(clean_expiry(Some(now + Duration::days(7)), now).unwrap().is_some());
    assert_eq!(clean_expiry(None, now).unwrap(), None);
    assert_eq!(code(&account_suspended()), "account_suspended");
    assert_eq!(code(&inactive_error("closed")), "account_disabled");
}

fn code(e: &ApiError) -> String {
    match e {
        ApiError::Coded { code, .. } => (*code).into(),
        ApiError::Validation { field, .. } => format!("field:{field}"),
        ApiError::Unauthorized => "unauthorized".into(),
        ApiError::AccountDisabled => "account_disabled".into(),
        ApiError::BadRequest(_) => "bad_request".into(),
        ApiError::NotFound => "not_found".into(),
        ApiError::Forbidden => "forbidden".into(),
        other => format!("{other:?}"),
    }
}

fn ctx(bearer: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.30".into(), user_agent: "Mozilla/5.0 (Macintosh) Chrome/131".into(), device: Some("device-controls-aaaa".into()), tenant_slug: "ezymex".into(), bearer: bearer.map(str::to_string) }
}

async fn user(db: &TestDb, email: &str) -> i64 {
    let hash = crypto::hash_password("Ezymex@2026").unwrap();
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, email_verified_at)
         VALUES (1, $1, $2, 'Maya', 'Rao', '+971', '501234567', 'ae', '1990-01-01', $3, now(), now()) RETURNING id",
    )
    .bind(email)
    .bind(hash)
    .bind(format!("C{}", crypto::random_token(6)))
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

/// A staff member with a built-in role (linked to the tenant's role row) and a live session token.
async fn staff(db: &TestDb, role: &str) -> (i64, String) {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO staff (tenant_id, email, password_hash, name, role, role_id)
         VALUES (1, $1, 'x', $2, $3, (SELECT id FROM roles WHERE tenant_id = 1 AND key = $3)) RETURNING id",
    )
    .bind(format!("{role}-{}@ezymex.test", crypto::random_token(4).to_lowercase()))
    .bind(format!("Staff {role}"))
    .bind(role)
    .fetch_one(&db.st.pool)
    .await
    .unwrap();
    let tok = identity::create_session(&db.st, &ctx(None), Kind::Staff, 1, id).await.unwrap().token;
    (id, tok)
}

fn set_body(reason: &str, expires_at: Option<DateTime<Utc>>) -> Json<SetReq> {
    Json(SetReq { reason: reason.into(), expires_at })
}

fn lift_body(reason: &str) -> Json<LiftReq> {
    Json(LiftReq { reason: reason.into() })
}

async fn login(db: &TestDb, email: &str) -> Result<Json<Value>, ApiError> {
    crate::client_auth::login(State(db.st.clone()), ctx(None), Ok(Json(crate::client_auth::LoginReq { email: email.into(), password: "Ezymex@2026".into() }))).await
}

#[tokio::test]
async fn sign_in_block_suspends_and_ends_every_session() {
    let Some(db) = TestDb::new("client-controls block").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "blocked@gmail.com").await;
    let other = user(&db, "fine@gmail.com").await;
    let (_, compliance) = staff(&db, "compliance").await;
    let (_, support) = staff(&db, "support").await;
    let own = identity::create_session(&db.st, &ctx(None), Kind::User, 1, uid).await.unwrap();
    let viewer_id: i64 = sqlx::query_scalar("INSERT INTO client_viewers (tenant_id, user_id, label, username, password_hash, sections) VALUES (1,$1,'Acct','acct-view-1',$2,'{accounts}') RETURNING id")
        .bind(uid)
        .bind(crypto::hash_password("View#Pass2026").unwrap())
        .fetch_one(&db.st.pool)
        .await
        .unwrap();
    let viewer = identity::create_session_as(&db.st, &ctx(None), Kind::User, 1, uid, Some(viewer_id)).await.unwrap();
    let theirs = identity::create_session(&db.st, &ctx(None), Kind::User, 1, other).await.unwrap();

    // support can read but not block; a reason is required
    let e = put_restriction(st(), ctx(Some(&support)), Path((uid, "login".into())), Ok(set_body("Fraud report", None))).await.unwrap_err();
    assert_eq!(code(&e), "forbidden");
    let e = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "login".into())), Ok(set_body("x", None))).await.unwrap_err();
    assert_eq!(code(&e), "field:reason");
    let e = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "nonsense".into())), Ok(set_body("Fraud report", None))).await.unwrap_err();
    assert_eq!(code(&e), "field:kind");

    let Json(v) = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "login".into())), Ok(set_body("Chargeback fraud, ticket 118", None))).await.unwrap();
    assert_eq!(v["result"]["sessions_ended"], 2);
    assert_eq!(v["status"], "blocked");
    assert_eq!(v["restrictions"][0]["kind"], "login");
    assert_eq!(v["restrictions"][0]["created_by"]["name"], "Staff compliance");
    // every session of the client ends (own + view-only); other clients are untouched
    assert_eq!(code(&identity::resolve_session_any(&db.st, &ctx(Some(&own.token)), Kind::User).await.err().unwrap()), "unauthorized");
    assert_eq!(code(&identity::resolve_session_any(&db.st, &ctx(Some(&viewer.token)), Kind::User).await.err().unwrap()), "unauthorized");
    assert!(identity::resolve_session(&db.st, &ctx(Some(&theirs.token)), Kind::User).await.is_ok());
    // sign-in is refused with a plain message, for the client and their view-only logins
    assert_eq!(code(&login(&db, "blocked@gmail.com").await.unwrap_err()), "account_suspended");
    let e = crate::client_security::viewer_login(&db.st, &ctx(None), 1, "acct-view-1", "View#Pass2026").await.unwrap_err();
    assert_eq!(code(&e), "viewer_inactive");
    // a staff session can't be opened while suspended
    let (_, sa) = staff(&db, "super_admin").await;
    let e = impersonate(st(), ctx(Some(&sa)), Path(uid), Ok(Json(ImpersonateReq { reason: "Check".into(), mode: None, confirm: false, login: None }))).await.unwrap_err();
    assert_eq!(code(&e), "bad_request");
    // services see it
    let Json(i) = internal_list(st(), Ok(Query(InternalQ { user_id: Some(uid) }))).await.unwrap();
    assert_eq!(i["items"][0]["kinds"][0]["kind"], "login");
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE target_id = $1 AND action = 'client.restriction_set'", uid).await, 1);

    // lift: sign-in works again (needs a reason); the history keeps both
    assert_eq!(code(&lift(st(), ctx(Some(&compliance)), Path((uid, "login".into())), Ok(lift_body(""))).await.unwrap_err()), "field:reason");
    let Json(v) = lift(st(), ctx(Some(&compliance)), Path((uid, "login".into())), Ok(lift_body("Cleared by the bank"))).await.unwrap();
    assert_eq!(v["status"], "active");
    assert!(v["restrictions"].as_array().unwrap().is_empty());
    assert_eq!(v["history"][0]["state"], "lifted");
    assert_eq!(v["history"][0]["lift_reason"], "Cleared by the bank");
    assert!(login(&db, "blocked@gmail.com").await.is_ok());
    assert_eq!(code(&lift(st(), ctx(Some(&compliance)), Path((uid, "login".into())), Ok(lift_body("again please"))).await.unwrap_err()), "bad_request");

    // a timed block expires: the sweep re-activates the client and audits it
    let _ = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "login".into())), Ok(set_body("Cooling-off 24h", Some(Utc::now() + Duration::hours(24))))).await.unwrap();
    assert_eq!(code(&login(&db, "blocked@gmail.com").await.unwrap_err()), "account_suspended");
    sqlx::query("UPDATE client_restrictions SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND lifted_at IS NULL").bind(uid).execute(&db.st.pool).await.unwrap();
    sweep(&db.st).await.unwrap();
    assert!(login(&db, "blocked@gmail.com").await.is_ok());
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE target_id = $1 AND action = 'client.restriction_expired'", uid).await, 1);

    // bulk block / unblock from the client list
    let Json(b) = bulk(st(), ctx(Some(&compliance)), Ok(Json(BulkReq { user_ids: vec![uid, other, 999_999], kind: "login".into(), action: "set".into(), reason: "Batch AML hold".into(), expires_at: None }))).await.unwrap();
    assert_eq!(b["done"].as_array().unwrap().len(), 2);
    assert_eq!(b["skipped"][0]["reason"], "not_found");
    assert!(identity::resolve_session(&db.st, &ctx(Some(&theirs.token)), Kind::User).await.is_err());
    let Json(b) = bulk(st(), ctx(Some(&compliance)), Ok(Json(BulkReq { user_ids: vec![uid, other], kind: "login".into(), action: "lift".into(), reason: "Batch cleared".into(), expires_at: None }))).await.unwrap();
    assert_eq!(b["done"].as_array().unwrap().len(), 2);
    assert!(login(&db, "fine@gmail.com").await.is_ok());

    db.drop_db().await;
}

#[tokio::test]
async fn restrictions_reach_the_services_and_the_client() {
    let Some(db) = TestDb::new("client-controls restrictions").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "restricted@gmail.com").await;
    let (_, compliance) = staff(&db, "compliance").await;
    let own = identity::create_session(&db.st, &ctx(None), Kind::User, 1, uid).await.unwrap();

    let _ = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "withdrawals".into())), Ok(set_body("Source of funds pending", None))).await.unwrap();
    let _ = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "close_only".into())), Ok(set_body("Margin abuse review", Some(Utc::now() + Duration::days(3))))).await.unwrap();
    // replacing keeps one open row and records the change
    let Json(v) = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "close_only".into())), Ok(set_body("Margin abuse review, extended", None))).await.unwrap();
    assert_eq!(v["result"]["replaced"], true);
    assert_eq!(v["restrictions"].as_array().unwrap().len(), 2);
    assert_eq!(v["effective"], json!(["close_only", "withdrawals"]));
    // the client can still sign in (no sign-in block) and sees what is restricted
    assert!(identity::resolve_session(&db.st, &ctx(Some(&own.token)), Kind::User).await.is_ok());
    let Json(m) = crate::client_auth::me(st(), ctx(Some(&own.token))).await.unwrap();
    assert_eq!(m["user"]["restricted"], json!(["close_only", "withdrawals"]));
    // the wallet reads the effective kinds from the internal user record
    let Json(u) = crate::users_internal::user(st(), ctx(None), Path(uid)).await.unwrap();
    assert_eq!(u["user"]["restrictions"], json!(["close_only", "withdrawals"]));

    // freeze = every restriction except sign-in
    let _ = put_restriction(st(), ctx(Some(&compliance)), Path((uid, "freeze".into())), Ok(set_body("Regulator request", None))).await.unwrap();
    let Json(u) = crate::users_internal::user(st(), ctx(None), Path(uid)).await.unwrap();
    assert_eq!(u["user"]["restrictions"], json!(["close_only", "deposits", "ib", "social", "trading", "transfers", "withdrawals"]));
    let Json(i) = internal_list(st(), Ok(Query(InternalQ::default()))).await.unwrap();
    let mine = i["items"].as_array().unwrap().iter().find(|x| x["user_id"] == uid).unwrap().clone();
    assert_eq!(mine["frozen"], true);
    assert!(identity::resolve_session(&db.st, &ctx(Some(&own.token)), Kind::User).await.is_ok());
    let Json(h) = heartbeat(st(), ctx(Some(&own.token))).await.unwrap();
    assert!(h["restricted"].as_array().unwrap().iter().any(|k| k == "deposits"));

    // the client list shows the chips and filters by them
    let Json(l) = crate::admin::users(st(), ctx(Some(&compliance)), Ok(Query(crate::admin::UsersQuery { restricted: Some("true".into()), ..Default::default() }))).await.unwrap();
    assert_eq!(l["total"], 1);
    assert_eq!(l["items"][0]["restrictions"], json!(["close_only", "freeze", "withdrawals"]));
    db.drop_db().await;
}

#[tokio::test]
async fn presence_follows_the_client_not_viewers_or_staff() {
    let Some(db) = TestDb::new("client-controls presence").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "online@gmail.com").await;
    let trader_only = user(&db, "trader@gmail.com").await;
    let idle = user(&db, "idle@gmail.com").await;
    let (_, support) = staff(&db, "support").await;
    let own = identity::create_session(&db.st, &ctx(None), Kind::User, 1, uid).await.unwrap();
    // a stale session: the heartbeat moves the client's presence forward (at most every 30 s)
    sqlx::query("UPDATE sessions SET last_seen_at = now() - interval '10 minutes' WHERE subject_id = $1").bind(uid).execute(&db.st.pool).await.unwrap();
    let _ = heartbeat(st(), ctx(Some(&own.token))).await.unwrap();
    let last: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT last_active_at FROM users WHERE id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(presence(last, Utc::now()), Presence::Online);

    // a view-only login's activity never makes the owner look online
    let vid: i64 = sqlx::query_scalar("INSERT INTO client_viewers (tenant_id, user_id, label, username, password_hash, sections) VALUES (1,$1,'Acct','idle-view-1','x','{accounts}') RETURNING id")
        .bind(idle)
        .fetch_one(&db.st.pool)
        .await
        .unwrap();
    let v = identity::create_session_as(&db.st, &ctx(None), Kind::User, 1, idle, Some(vid)).await.unwrap();
    sqlx::query("UPDATE sessions SET last_seen_at = now() - interval '10 minutes' WHERE viewer_id = $1").bind(vid).execute(&db.st.pool).await.unwrap();
    identity::resolve_session_any(&db.st, &ctx(Some(&v.token)), Kind::User).await.unwrap();
    let last: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT last_active_at FROM users WHERE id = $1").bind(idle).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(last, None);

    // Ezymex Trader connections reported by the engine
    let report = |items: Value, ended: Value| Json(serde_json::from_value::<TraderReport>(json!({ "items": items, "ended": ended })).unwrap());
    let Json(r) = trader_report(st(), Ok(report(json!([{ "conn": "e1-7", "user_id": trader_only, "login": 10000042, "ip": "198.51.100.7", "country": "IN", "user_agent": "Chrome", "since": Utc::now() }]), json!([])))).await.unwrap();
    assert_eq!(r["live"], 1);
    let Json(p) = presence_list(st(), ctx(Some(&support))).await.unwrap();
    assert_eq!(p["online"], 2);
    let t = p["items"].as_array().unwrap().iter().find(|x| x["id"] == trader_only).unwrap().clone();
    assert_eq!(t["apps"], json!(["trader"]));
    assert_eq!(t["location"], "in");
    assert_eq!(t["trader_login"], 10000042);
    let c = p["items"].as_array().unwrap().iter().find(|x| x["id"] == uid).unwrap().clone();
    assert_eq!(c["apps"], json!(["client_area"]));

    // closing Ezymex Trader: Away after 2 minutes, Offline after 15
    let _ = trader_report(st(), Ok(report(json!([]), json!(["e1-7"])))).await.unwrap();
    let Json(d) = controls(st(), ctx(Some(&support)), Path(trader_only)).await.unwrap();
    assert_eq!(d["presence"]["state"], "online");
    assert!(d["presence"]["devices"].as_array().unwrap().is_empty());
    sqlx::query("UPDATE users SET last_active_at = now() - interval '5 minutes' WHERE id = $1").bind(trader_only).execute(&db.st.pool).await.unwrap();
    let Json(d) = controls(st(), ctx(Some(&support)), Path(trader_only)).await.unwrap();
    assert_eq!(d["presence"]["state"], "away");
    let Json(l) = crate::admin::users(st(), ctx(Some(&support)), Ok(Query(crate::admin::UsersQuery { presence: Some("away".into()), ..Default::default() }))).await.unwrap();
    assert_eq!(l["total"], 1);
    assert_eq!(l["items"][0]["presence"], "away");
    sqlx::query("UPDATE users SET last_active_at = now() - interval '20 minutes' WHERE id = $1").bind(trader_only).execute(&db.st.pool).await.unwrap();
    let Json(l) = crate::admin::users(st(), ctx(Some(&support)), Ok(Query(crate::admin::UsersQuery { presence: Some("offline".into()), ..Default::default() }))).await.unwrap();
    assert_eq!(l["total"], 2);
    // sort by activity: most recently active first; one query for the page
    let Json(l) = crate::admin::users(st(), ctx(Some(&support)), Ok(Query(crate::admin::UsersQuery { sort: Some("online".into()), ..Default::default() }))).await.unwrap();
    assert_eq!(l["items"][0]["id"], uid);
    assert_eq!(l["items"][0]["presence"], "online");
    assert_eq!(l["items"][0]["apps"], json!(["client_area"]));
    let Json(s) = crate::admin::stats(st(), ctx(Some(&support))).await.unwrap();
    assert_eq!(s["clients"]["online"], 1);
    // the client's devices: IP, country, app and since
    let Json(d) = controls(st(), ctx(Some(&support)), Path(uid)).await.unwrap();
    assert_eq!(d["presence"]["devices"][0]["app"], "client_area");
    assert_eq!(d["presence"]["devices"][0]["ip"], "203.0.113.30");
    db.drop_db().await;
}

#[tokio::test]
async fn staff_sessions_are_read_only_bound_and_time_limited() {
    let Some(db) = TestDb::new("client-controls impersonation").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "helpme@gmail.com").await;
    let (compliance_id, compliance) = staff(&db, "compliance").await;
    let (_, support) = staff(&db, "support").await;
    let (_, sa) = staff(&db, "super_admin").await;
    let (_, admin) = staff(&db, "admin").await;
    let req = |reason: &str, mode: Option<&str>, confirm: bool| Ok(Json(ImpersonateReq { reason: reason.into(), mode: mode.map(str::to_string), confirm, login: None }));

    // permission, a reason, and full access only for the Super Admin with a confirmation
    assert_eq!(code(&impersonate(st(), ctx(Some(&support)), Path(uid), req("Ticket 1", None, false)).await.unwrap_err()), "forbidden");
    assert_eq!(code(&impersonate(st(), ctx(Some(&compliance)), Path(uid), req("", None, false)).await.unwrap_err()), "field:reason");
    assert_eq!(code(&impersonate(st(), ctx(Some(&compliance)), Path(uid), req("Ticket 1", Some("full"), true)).await.unwrap_err()), "forbidden");
    assert_eq!(code(&impersonate(st(), ctx(Some(&admin)), Path(uid), req("Ticket 1", Some("full"), true)).await.unwrap_err()), "forbidden");
    assert_eq!(code(&impersonate(st(), ctx(Some(&sa)), Path(uid), req("Ticket 1", Some("full"), false)).await.unwrap_err()), "field:confirm");

    // read-only: a one-time ticket becomes a 30-minute session of the client
    let Json(t) = impersonate(st(), ctx(Some(&compliance)), Path(uid), req("Ticket 5521: can't find statement", None, false)).await.unwrap();
    let ticket = t["ticket"].as_str().unwrap().to_string();
    let Json(r) = redeem(st(), ctx(None), Ok(Json(RedeemReq { ticket: ticket.clone() }))).await.unwrap();
    assert_eq!(code(&redeem(st(), ctx(None), Ok(Json(RedeemReq { ticket }))).await.unwrap_err()), "ticket_expired");
    let tok = r["session"]["token"].as_str().unwrap().to_string();
    assert!(tok.starts_with(READ_ONLY_PREFIX));
    let exp = DateTime::parse_from_rfc3339(r["session"]["expires_at"].as_str().unwrap()).unwrap().with_timezone(&Utc);
    assert!(exp <= Utc::now() + Duration::minutes(30) && exp > Utc::now() + Duration::minutes(29));
    let staff_ctx = || ctx(Some(&tok));
    // reads work, and /me says who is acting
    let Json(m) = crate::client_auth::me(st(), staff_ctx()).await.unwrap();
    assert_eq!(m["user"]["id"], uid);
    assert_eq!(m["impersonation"]["mode"], "read_only");
    assert_eq!(m["impersonation"]["staff"]["name"], "Staff compliance");
    // every write is refused server-side, and the attempt is audited with the staff id
    let e = identity::resolve_session(&db.st, &staff_ctx(), Kind::User).await.err().unwrap();
    assert_eq!(code(&e), "staff_read_only");
    let e = crate::client_security::revoke_others(st(), staff_ctx()).await.unwrap_err();
    assert_eq!(code(&e), "staff_read_only");
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'client.impersonation_write_refused' AND actor_kind = 'staff' AND actor_id = $1 AND target_id = $2")
        .bind(compliance_id)
        .bind(uid)
        .fetch_one(&db.st.pool)
        .await
        .unwrap();
    assert_eq!(n, 2);
    // actions reported by the Client Area are audited too
    let _ = event(st(), staff_ctx(), Ok(Json(EventReq { kind: "write_refused".into(), method: "post".into(), path: "/api/wallet/withdrawals".into(), status: Some(403) }))).await.unwrap();
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE action = 'client.impersonation_write_refused' AND meta->>'path' = '/api/wallet/withdrawals' AND target_id = $1", uid).await, 1);
    // a staff session never makes the client look online
    sqlx::query("UPDATE sessions SET last_seen_at = now() - interval '5 minutes' WHERE impersonator_id IS NOT NULL").execute(&db.st.pool).await.unwrap();
    let _ = crate::client_auth::me(st(), staff_ctx()).await.unwrap();
    let last: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT last_active_at FROM users WHERE id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(last, None);
    // the client's own sign-in history shows the staff access, without the staff member's network details
    let own = identity::create_session(&db.st, &ctx(None), Kind::User, 1, uid).await.unwrap();
    let Json(h) = crate::client_security::logins(st(), ctx(Some(&own.token))).await.unwrap();
    let s = h["items"].as_array().unwrap().iter().find(|x| x["result"] == "staff_access").unwrap().clone();
    assert!(s["ip"].is_null() && s["user_agent"].is_null());
    // the client's own session is unaffected by the staff session and vice versa
    assert!(identity::resolve_session(&db.st, &ctx(Some(&own.token)), Kind::User).await.is_ok());

    // bound to the staff member's own Back Office session
    sqlx::query("UPDATE sessions SET revoked_at = now() WHERE subject_kind = 'staff' AND subject_id = $1").bind(compliance_id).execute(&db.st.pool).await.unwrap();
    assert_eq!(code(&identity::resolve_session_any(&db.st, &staff_ctx(), Kind::User).await.err().unwrap()), "unauthorized");

    // full access (Super Admin, confirmed): writes pass; the session expires after 30 minutes and the end is audited
    let Json(t) = impersonate(st(), ctx(Some(&sa)), Path(uid), req("Client asked us to fix a setting", Some("full"), true)).await.unwrap();
    let Json(r) = redeem(st(), ctx(None), Ok(Json(RedeemReq { ticket: t["ticket"].as_str().unwrap().into() }))).await.unwrap();
    let full = r["session"]["token"].as_str().unwrap().to_string();
    assert!(full.starts_with(FULL_PREFIX));
    assert!(identity::resolve_session(&db.st, &ctx(Some(&full)), Kind::User).await.is_ok());
    sqlx::query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1").bind(db.st.keys.hash("session", &full)).execute(&db.st.pool).await.unwrap();
    assert_eq!(code(&identity::resolve_session_any(&db.st, &ctx(Some(&full)), Kind::User).await.err().unwrap()), "unauthorized");
    sweep(&db.st).await.unwrap();
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE action = 'client.impersonation_ended' AND meta->>'via' = 'expired' AND target_id = $1", uid).await, 1);
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE action = 'client.impersonation_started' AND target_id = $1", uid).await, 2);

    // ending from the banner (logout) is audited
    let Json(t) = impersonate(st(), ctx(Some(&sa)), Path(uid), req("Walkthrough", None, false)).await.unwrap();
    let Json(r) = redeem(st(), ctx(None), Ok(Json(RedeemReq { ticket: t["ticket"].as_str().unwrap().into() }))).await.unwrap();
    let ro = r["session"]["token"].as_str().unwrap().to_string();
    let _ = crate::client_auth::logout(st(), ctx(Some(&ro))).await.unwrap();
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE action = 'client.impersonation_ended' AND meta->>'via' = 'ended' AND target_id = $1", uid).await, 1);
    db.drop_db().await;
}
