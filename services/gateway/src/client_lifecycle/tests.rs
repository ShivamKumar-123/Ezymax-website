//! Client management tests. The delete rules run everywhere against made-up wallet / engine answers; the flows run
//! the real handlers against a throwaway PostgreSQL database (see `testdb`), with a fake wallet and engine, and are
//! skipped, with a note, when no server is reachable.

use super::downstream::{Balance, Investment};
use super::*;
use crate::admin::{UsersQuery, users};
use crate::crypto;
use crate::identity::{self, Kind};
use crate::testdb::TestDb;
use axum::extract::Query;
use std::sync::Mutex;

fn target(referrals: i64) -> Target {
    Target {
        id: 42,
        tenant_slug: "ezymex".into(),
        email: "maya@example.com".into(),
        name: "Maya Rao".into(),
        status: "active".into(),
        kyc_status: "unverified".into(),
        hidden: false,
        deleted: false,
        referrals,
        kyc_documents: 0,
        active_sessions: 0,
        viewers: 0,
    }
}

fn usdt(available: &str, locked: &str) -> Balance {
    Balance { currency: "USDT".into(), available: available.into(), locked: locked.into() }
}

fn wallet(ledger_entries: i64) -> WalletFacts {
    WalletFacts { balances: vec![usdt("0", "0")], ledger_entries, ..Default::default() }
}

fn account(login: i64, live: bool) -> Account {
    Account { login, live, status: "active".into(), group: "standard".into(), currency: "USD".into(), ..Default::default() }
}

fn trading(accounts: Vec<Account>) -> TradingFacts {
    TradingFacts { accounts, investments: vec![] }
}

fn codes(c: &Check) -> Vec<&'static str> {
    c.blockers.iter().map(|(c, _)| *c).collect()
}

#[test]
fn never_funded_or_traded_is_a_purge() {
    let demo = Account { balance: 10_000.0, equity: 10_120.5, positions: 2, ..account(50_000_001, false) };
    let c = decide(&target(0), &Ok(wallet(0)), &Ok(trading(vec![account(10_000_001, true), demo])));
    assert_eq!(c.mode, Mode::Purge);
    assert!(c.blockers.is_empty() && c.history.is_empty());
    // demo money never blocks; both accounts are archived first
    assert_eq!(c.archive.iter().map(|a| a.login).collect::<Vec<_>>(), vec![10_000_001, 50_000_001]);
    assert_eq!(c.activity["trading"]["accounts"][1]["type"], "demo");
}

#[test]
fn any_history_is_an_anonymization() {
    let c = decide(&target(0), &Ok(wallet(3)), &Ok(trading(vec![])));
    assert_eq!((c.mode, c.history.clone()), (Mode::Anonymize, vec!["Wallet: 3 transactions".to_string()]));
    let traded = Account { deals: 12, ledger_entries: 4, ..account(10_000_002, true) };
    let c = decide(&target(0), &Ok(wallet(0)), &Ok(trading(vec![traded])));
    assert_eq!(c.mode, Mode::Anonymize);
    assert_eq!(c.history, vec!["Live account #10000002: 12 deals, 4 ledger entries"]);
    let c = decide(&target(2), &Ok(wallet(0)), &Ok(trading(vec![])));
    assert_eq!((c.mode, c.history[0].as_str()), (Mode::Anonymize, "Referred 2 clients"));
    // demo deals are not financial activity
    let demo = Account { deals: 40, ..account(50_000_002, false) };
    assert_eq!(decide(&target(0), &Ok(wallet(0)), &Ok(trading(vec![demo]))).mode, Mode::Purge);
}

#[test]
fn money_and_risk_block_the_delete() {
    let w = WalletFacts { balances: vec![usdt("125.500000", "0"), Balance { currency: "USDC".into(), available: "0".into(), locked: "10".into() }], pending_deposits: 1, open_withdrawals: 2, ledger_entries: 9 };
    let busy = Account { balance: 50.0, equity: 48.2, positions: 1, orders: 3, ..account(10_000_003, true) };
    let credit_only = Account { credit: 100.0, equity: 100.0, ..account(10_000_004, true) };
    let copying = Account { engine_blockers: vec![("copy_subscription".into(), "This account is copying a master.".into())], ..account(10_000_005, true) };
    let mut t = trading(vec![busy, credit_only, copying]);
    t.investments = vec![Investment { fund: "Gold Swing".into(), value: 997.9, pending_requests: 0 }, Investment { fund: "Empty".into(), value: 0.0, pending_requests: 1 }];
    let c = decide(&target(0), &Ok(w), &Ok(t));
    assert_eq!(c.mode, Mode::Blocked);
    assert_eq!(
        codes(&c),
        vec![
            "wallet_balance", "wallet_balance", "pending_deposit", "open_withdrawal", "account_balance", "open_positions", "pending_orders", "account_balance",
            "copy_subscription", "pamm_investment", "pamm_investment",
        ]
    );
    let text = c.blockers.iter().map(|(_, m)| m.as_str()).collect::<Vec<_>>().join("\n");
    assert!(text.contains("The wallet holds USDT (available 125.500000, locked 0)"));
    assert!(text.contains("2 withdrawals are still open"));
    assert!(text.contains("Live account #10000003 holds money (balance 50.00, equity 48.20, credit 0.00 USD)"));
    assert!(text.contains("Account #10000005: This account is copying a master."));
    assert!(text.contains("PAMM investment in Gold Swing: 997.90 USD"));
    assert!(text.contains("PAMM investment in Empty: 0.00 USD, 1 pending request"));
}

#[test]
fn unreachable_services_fail_closed() {
    let c = decide(&target(0), &Err("not reachable".into()), &Err("unauthorized (HTTP 403)".into()));
    assert_eq!(c.mode, Mode::Blocked);
    assert_eq!(codes(&c), vec!["wallet_unavailable", "engine_unavailable"]);
    assert_eq!(c.blockers[0].1, "Couldn't check the wallet: not reachable. Try again shortly.");
    assert!(c.activity["wallet"].is_null() && c.activity["trading"].is_null());
    // an amount the wallet sent in an unknown shape counts as money
    assert!(nonzero("n/a") && nonzero("0.000001") && !nonzero("0.000000") && !nonzero(" 0 "));
}

#[test]
fn retired_and_prop_accounts() {
    let archived = Account { status: "archived".into(), deals: 3, ledger_entries: 2, engine_blockers: vec![("already_archived".into(), "x".into())], ..account(10_000_006, true) };
    let failed_prop = Account { group: "prop-classic".into(), status: "disabled".into(), engine_blockers: vec![("prop_account".into(), "Prop challenge accounts cannot be archived.".into())], ..account(10_000_007, true) };
    let funded_prop = Account { group: "prop".into(), balance: 10_000.0, equity: 10_000.0, ..account(10_000_008, true) };
    let c = decide(&target(0), &Ok(wallet(1)), &Ok(trading(vec![archived, failed_prop.clone()])));
    assert_eq!(c.mode, Mode::Anonymize);
    // archived accounts stay as they are; a flat prop account is left to the prop service
    assert!(c.archive.is_empty());
    assert_eq!(c.skipped, vec![10_000_007]);
    let c = decide(&target(0), &Ok(wallet(1)), &Ok(trading(vec![failed_prop, funded_prop])));
    assert_eq!(codes(&c), vec!["account_balance"]);
}

#[test]
fn modes_round_trip() {
    for m in [Mode::Purge, Mode::Anonymize, Mode::Blocked] {
        assert_eq!(Mode::parse(m.as_str()), Some(m));
    }
    assert_eq!(Mode::parse(" purge "), Some(Mode::Purge));
    assert_eq!(Mode::parse("erase"), None);
}

// ---------- flows ----------

/// The wallet and the engine as a test wants them; records the archive calls.
struct Fake {
    wallet: Result<WalletFacts, String>,
    trading: Result<TradingFacts, String>,
    refuse_archive: Option<i64>,
    archived: Mutex<Vec<(i64, String, String)>>,
}

impl Fake {
    fn new(wallet: WalletFacts, trading: TradingFacts) -> Self {
        Fake { wallet: Ok(wallet), trading: Ok(trading), refuse_archive: None, archived: Mutex::new(vec![]) }
    }
}

impl Finance for Fake {
    async fn wallet(&self, _: &str, _: i64) -> Result<WalletFacts, String> {
        self.wallet.clone()
    }
    async fn trading(&self, _: &str, _: i64) -> Result<TradingFacts, String> {
        self.trading.clone()
    }
    async fn archive(&self, tenant: &str, staff: &EngineStaff, a: &Account, note: &str) -> Result<(), String> {
        if self.refuse_archive == Some(a.login) {
            return Err("Close all positions and cancel all orders before archiving (HTTP 422)".into());
        }
        assert_eq!(tenant, "ezymex");
        self.archived.lock().unwrap().push((a.login, staff.role.clone(), note.to_string()));
        Ok(())
    }
}

fn ctx(bearer: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.40".into(), user_agent: "Mozilla/5.0 (Macintosh) Chrome/131".into(), device: Some("device-lifecycle-aaaa".into()), tenant_slug: "ezymex".into(), bearer: bearer.map(str::to_string) }
}

async fn user(db: &TestDb, email: &str) -> i64 {
    let hash = crypto::hash_password("Ezymex@2026").unwrap();
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, email_verified_at, utm_source, landing_page)
         VALUES (1, $1, $2, 'Maya', 'Rao', '+971', '501234567', 'ae', '1990-01-01', $3, now(), now(), 'google', 'https://ezymex.com/?ref=maya')
         RETURNING id",
    )
    .bind(email)
    .bind(hash)
    .bind(format!("C{}", crypto::random_token(6)))
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

async fn staff(db: &TestDb, role: &str) -> (Staff, String) {
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
    let me = crate::admin::current(&db.st, &ctx(Some(&tok))).await.unwrap();
    (me, tok)
}

/// KYC: a case with one document whose (fake) file is on disk. Returns the file path.
async fn kyc_document(db: &TestDb, uid: i64) -> std::path::PathBuf {
    let case: i64 = sqlx::query_scalar("INSERT INTO kyc_cases (tenant_id, user_id, kind, status) VALUES (1, $1, 'individual', 'approved') RETURNING id").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    let fref = format!("{:0<32}", crypto::random_token(12).replace(['-', '_'], "x"));
    sqlx::query("INSERT INTO kyc_documents (tenant_id, case_id, user_id, kind, file_ref, sha256, mime, size_bytes) VALUES (1, $1, $2, 'selfie', $3, $4, 'image/jpeg', 10)")
        .bind(case)
        .bind(uid)
        .bind(&fref)
        .bind("a".repeat(64))
        .execute(&db.st.pool)
        .await
        .unwrap();
    let path = crate::kyc::settings().dir.join("1").join(&fref[..2]).join(&fref);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, b"encrypted").unwrap();
    path
}

async fn viewer(db: &TestDb, uid: i64) {
    sqlx::query("INSERT INTO client_viewers (tenant_id, user_id, label, username, password_hash) VALUES (1, $1, 'Accountant', $2, 'x')")
        .bind(uid)
        .bind(format!("acc{}", crypto::random_token(5).to_lowercase().replace(['-', '_'], "x")))
        .execute(&db.st.pool)
        .await
        .unwrap();
}

fn code(e: &ApiError) -> String {
    match e {
        ApiError::Coded { code, .. } => (*code).into(),
        ApiError::Validation { field, .. } => format!("field:{field}"),
        ApiError::NotFound => "not_found".into(),
        ApiError::Forbidden => "forbidden".into(),
        other => format!("{other:?}"),
    }
}

fn req(reason: &str, email: &str, mode: &str) -> DeleteReq {
    DeleteReq { reason: reason.into(), confirm_email: email.into(), mode: mode.into() }
}

async fn list(db: &TestDb, tok: &str, hidden: Option<&str>) -> Value {
    users(State(db.st.clone()), ctx(Some(tok)), Ok(Query(UsersQuery { hidden: hidden.map(str::to_string), ..Default::default() }))).await.unwrap().0
}

fn ids(v: &Value) -> Vec<i64> {
    v["items"].as_array().unwrap().iter().map(|u| u["id"].as_i64().unwrap()).collect()
}

async fn feed(db: &TestDb) -> Vec<Value> {
    let q = crate::internal::ReferralUsersQ::default();
    crate::internal::referral_users(State(db.st.clone()), Ok(Query(q))).await.unwrap().0["items"].as_array().unwrap().clone()
}

async fn audit_meta(db: &TestDb, action: &str, uid: i64) -> Option<Value> {
    sqlx::query_scalar::<_, sqlx::types::Json<Value>>("SELECT meta FROM audit_log WHERE action = $1 AND target_id = $2 ORDER BY id DESC LIMIT 1")
        .bind(action)
        .bind(uid)
        .fetch_optional(&db.st.pool)
        .await
        .unwrap()
        .map(|j| j.0)
}

#[tokio::test]
async fn hide_and_unhide_only_change_the_back_office_view() {
    let Some(db) = TestDb::new("client-lifecycle hide").await else { return };
    let st = || State(db.st.clone());
    let a = user(&db, "hide.a@example.com").await;
    let b = user(&db, "hide.b@example.com").await;
    sqlx::query("UPDATE users SET last_active_at = now() WHERE id = ANY($1)").bind(vec![a, b]).execute(&db.st.pool).await.unwrap();
    let (_, admin) = staff(&db, "admin").await;
    let (_, compliance) = staff(&db, "compliance").await;
    let body = |r: &str| Ok(Json(ReasonReq { reason: r.into() }));

    // clients.write: admins hide, Compliance (clients.block, not clients.write) can't; a reason is required
    assert_eq!(code(&hide(st(), ctx(Some(&compliance)), Path(a), body("Test account")).await.unwrap_err()), "forbidden");
    assert_eq!(code(&hide(st(), ctx(Some(&admin)), Path(a), body(" x ")).await.unwrap_err()), "field:reason");
    let Json(v) = hide(st(), ctx(Some(&admin)), Path(a), body("QA test account")).await.unwrap();
    assert_eq!((v["hidden"].as_bool(), v["changed"].as_bool()), (Some(true), Some(true)));
    let Json(v) = hide(st(), ctx(Some(&admin)), Path(a), body("QA test account")).await.unwrap();
    assert_eq!(v["changed"], false, "hiding twice changes nothing");

    // left out of the list, the counts and Online now by default; the "Show hidden" filters bring it back
    let v = list(&db, &admin, None).await;
    assert_eq!((ids(&v), v["counts"]["hidden"].as_i64()), (vec![b], Some(1)));
    let v = list(&db, &admin, Some("include")).await;
    assert_eq!(ids(&v), vec![b, a]);
    assert_eq!(v["items"][1]["hidden"], true);
    assert_eq!(ids(&list(&db, &admin, Some("only")).await), vec![a]);
    assert!(matches!(users(st(), ctx(Some(&admin)), Ok(Query(UsersQuery { hidden: Some("all".into()), ..Default::default() }))).await, Err(ApiError::BadRequest(_))));
    let Json(s) = crate::admin::stats(st(), ctx(Some(&admin))).await.unwrap();
    assert_eq!((s["clients"]["total"].as_i64(), s["clients"]["hidden"].as_i64(), s["clients"]["online"].as_i64()), (Some(1), Some(1), Some(1)));
    let Json(p) = crate::client_controls::presence_list(st(), ctx(Some(&admin))).await.unwrap();
    assert!(!p.to_string().contains("hide.a@"));
    let Json(d) = crate::admin::user_detail(st(), ctx(Some(&admin)), Path(a)).await.unwrap();
    assert_eq!((d["user"]["hidden_reason"].as_str(), d["user"]["hidden_by"].as_str()), (Some("QA test account"), Some("Staff admin")));

    // the client signs in as before; the mirrors get the flag
    let r = crate::client_auth::login(st(), ctx(None), Ok(Json(crate::client_auth::LoginReq { email: "hide.a@example.com".into(), password: "Ezymex@2026".into() }))).await;
    assert!(r.is_ok(), "a hidden client can still sign in");
    let f = feed(&db).await;
    assert_eq!(f.iter().find(|u| u["id"] == a).unwrap()["hidden"], true);
    assert_eq!(f.iter().find(|u| u["id"] == b).unwrap()["hidden"], false);

    let Json(v) = unhide(st(), ctx(Some(&admin)), Path(a), body("Real client after all")).await.unwrap();
    assert_eq!(v["hidden"], false);
    assert_eq!(ids(&list(&db, &admin, None).await), vec![b, a]);
    let meta = audit_meta(&db, "client.hidden", a).await.unwrap();
    assert_eq!((meta["reason"].as_str(), meta["after"]["hidden"].as_bool()), (Some("QA test account"), Some(true)));
    assert_eq!(audit_meta(&db, "client.unhidden", a).await.unwrap()["reason"], "Real client after all");
    assert_eq!(code(&hide(st(), ctx(Some(&admin)), Path(999_999), body("Nobody")).await.unwrap_err()), "not_found");
    db.drop_db().await;
}

#[tokio::test]
async fn purge_removes_a_client_that_never_funded_or_traded() {
    let Some(db) = TestDb::new("client-lifecycle purge").await else { return };
    let st = &db.st;
    let uid = user(&db, "purge.me@example.com").await;
    let referrer = user(&db, "purge.ref@example.com").await;
    sqlx::query("UPDATE users SET referred_by = $2 WHERE id = $1").bind(uid).bind(referrer).execute(&st.pool).await.unwrap();
    let file = kyc_document(&db, uid).await;
    viewer(&db, uid).await;
    identity::create_session(st, &ctx(None), Kind::User, 1, uid).await.unwrap();
    sqlx::query("INSERT INTO trade_shares (tenant_id, code, key_hash, login, title, tickets) VALUES (1, 'AbCdEf123456', '\\x01', '50000001', 'Demo', '{}')").execute(&st.pool).await.unwrap();
    let (admin, _) = staff(&db, "admin").await;
    let fake = Fake::new(wallet(0), trading(vec![account(50_000_001, false)]));

    // the check: never funded or traded
    let Json(v) = check_route(st, &admin, uid, &fake).await.unwrap();
    assert_eq!((v["mode"].as_str(), v["client"]["email"].as_str()), (Some("purge"), Some("purge.me@example.com")));
    assert_eq!(v["archive"], json!([50_000_001]));
    assert_eq!(v["activity"]["kyc_documents"], 1);

    // the typed email and the mode seen in the check must match
    let e = delete_with(st, &ctx(None), &admin, uid, req("Spam sign-up", "someone@else.com", "purge"), &fake).await.unwrap_err();
    assert_eq!(code(&e), "field:confirm_email");
    assert_eq!(code(&delete_with(st, &ctx(None), &admin, uid, req("Spam sign-up", "purge.me@example.com", ""), &fake).await.unwrap_err()), "field:mode");
    assert_eq!(code(&delete_with(st, &ctx(None), &admin, uid, req("", "purge.me@example.com", "purge"), &fake).await.unwrap_err()), "field:reason");
    let (s, Json(v)) = delete_with(st, &ctx(None), &admin, uid, req("Spam sign-up", " Purge.Me@example.com ", "anonymize"), &fake).await.unwrap();
    assert_eq!((s, v["error"]["code"].as_str(), v["error"]["check"]["mode"].as_str()), (StatusCode::CONFLICT, Some("mode_changed"), Some("purge")));
    assert!(fake.archived.lock().unwrap().is_empty(), "nothing happens before the confirmation matches");

    let (s, Json(v)) = delete_with(st, &ctx(None), &admin, uid, req("Spam sign-up", " Purge.Me@example.com ", "purge"), &fake).await.unwrap();
    assert_eq!((s, v["mode"].as_str()), (StatusCode::OK, Some("purge")));
    assert_eq!(v["summary"]["accounts_archived"], json!([50_000_001]));
    assert_eq!((v["summary"]["removed"]["kyc_files"].as_i64(), v["summary"]["removed"]["trade_shares"].as_i64(), v["summary"]["removed"]["viewers"].as_i64()), (Some(1), Some(1), Some(1)));
    let archived = fake.archived.lock().unwrap().clone();
    assert_eq!((archived[0].0, archived[0].1.as_str()), (50_000_001, "admin"));
    assert!(archived[0].2.contains(&format!("Client #{uid} deleted")));

    // gone from every gateway table; the KYC file is gone from disk
    for (sql, what) in [
        ("SELECT count(*) FROM users WHERE id = $1", "users"),
        ("SELECT count(*) FROM sessions WHERE subject_kind = 'user' AND subject_id = $1", "sessions"),
        ("SELECT count(*) FROM kyc_cases WHERE user_id = $1", "kyc_cases"),
        ("SELECT count(*) FROM kyc_documents WHERE user_id = $1", "kyc_documents"),
        ("SELECT count(*) FROM client_viewers WHERE user_id = $1", "viewers"),
    ] {
        assert_eq!(db.count(sql, uid).await, 0, "{what}");
    }
    assert!(!file.exists());
    assert_eq!(db.count("SELECT count(*) FROM deleted_users WHERE id = $1", uid).await, 1);
    // the mirrors get a placeholder row without signals; the address can register again
    let f = feed(&db).await;
    let row = f.iter().find(|u| u["id"] == uid).unwrap();
    assert_eq!((row["deleted"].as_bool(), row["purged"].as_bool(), row["email"].as_str()), (Some(true), Some(true), Some(format!("deleted-{uid}@deleted.invalid").as_str())));
    assert_eq!((row["identity"].as_array().unwrap().len(), row["status"].as_str(), row["first_name"].as_str()), (0, Some("closed"), Some("Deleted")));
    assert!(user(&db, "purge.me@example.com").await > uid);
    // audited without personal data
    let meta = audit_meta(&db, "client.deleted", uid).await.unwrap();
    assert_eq!((meta["mode"].as_str(), meta["after"]["status"].as_str(), meta["reason"].as_str()), (Some("purge"), Some("purged"), Some("Spam sign-up")));
    assert!(!meta.to_string().contains("purge.me@") && !meta.to_string().contains("Maya"));
    assert_eq!(code(&check_route(st, &admin, uid, &fake).await.unwrap_err()), "not_found");
    db.drop_db().await;
}

#[tokio::test]
async fn anonymize_keeps_the_record_and_erases_the_person() {
    let Some(db) = TestDb::new("client-lifecycle anonymize").await else { return };
    let st = &db.st;
    let uid = user(&db, "anon.me@example.com").await;
    let referee = user(&db, "anon.referee@example.com").await;
    sqlx::query("UPDATE users SET referred_by = $1 WHERE id = $2").bind(uid).bind(referee).execute(&st.pool).await.unwrap();
    // verified identity: name and date of birth are locked (D92) except for this erasure
    sqlx::query("UPDATE users SET kyc_status = 'verified', identity_locked_at = now(), google_sub = 'g-123', last_active_at = now() WHERE id = $1").bind(uid).execute(&st.pool).await.unwrap();
    let file = kyc_document(&db, uid).await;
    viewer(&db, uid).await;
    let client_tok = identity::create_session(st, &ctx(None), Kind::User, 1, uid).await.unwrap().token;
    sqlx::query("INSERT INTO client_requests (tenant_id, user_id, kind) VALUES (1, $1, 'closure')").bind(uid).execute(&st.pool).await.unwrap();
    let (admin, admin_tok) = staff(&db, "super_admin").await;
    let traded = Account { deals: 37, ledger_entries: 12, ..account(10_000_042, true) };
    let fake = Fake::new(wallet(5), trading(vec![traded, account(50_000_042, false)]));

    let Json(v) = check_route(st, &admin, uid, &fake).await.unwrap();
    assert_eq!(v["mode"], "anonymize");
    assert_eq!(v["history"], json!(["Wallet: 5 transactions", "Live account #10000042: 37 deals, 12 ledger entries", "Referred 1 client"]));
    let (s, Json(v)) = delete_with(st, &ctx(None), &admin, uid, req("Client asked for erasure, ticket #8812", "anon.me@example.com", "anonymize"), &fake).await.unwrap();
    assert_eq!((s, v["mode"].as_str()), (StatusCode::OK, Some("anonymize")));
    assert_eq!(v["summary"]["accounts_archived"], json!([10_000_042, 50_000_042]));
    assert_eq!(fake.archived.lock().unwrap()[0].1, "super_admin");

    // the row and its id stay, the person is gone
    let r = sqlx::query(
        "SELECT email, first_name, last_name, phone, date_of_birth::text AS dob, status, google_sub, landing_page, utm_source, password_hash,
                deleted_reason, country::text AS country FROM users WHERE id = $1 AND deleted_at IS NOT NULL",
    )
    .bind(uid)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let g = |c: &str| r.get::<Option<String>, _>(c);
    assert_eq!(g("email").unwrap(), format!("deleted-{uid}@deleted.invalid"));
    assert_eq!((g("first_name").unwrap(), g("last_name").unwrap(), g("phone").unwrap(), g("dob").unwrap()), ("Deleted".into(), "Client".into(), String::new(), "1900-01-01".into()));
    assert_eq!((g("status").unwrap(), g("google_sub"), g("landing_page")), ("closed".into(), None, None));
    assert_eq!((g("utm_source").unwrap(), g("country").unwrap().trim().to_string()), ("google".into(), "ae".into()), "campaign and country stay for reporting");
    assert!(g("deleted_reason").unwrap().contains("#8812"));
    // sign-in is impossible: sessions and view-only logins ended, the old address and the password lead nowhere
    assert!(identity::resolve_session(st, &ctx(Some(&client_tok)), Kind::User).await.is_err());
    assert_eq!(db.count("SELECT count(*) FROM client_viewers WHERE user_id = $1 AND revoked_at IS NULL", uid).await, 0);
    let login = crate::client_auth::login(State(st.clone()), ctx(None), Ok(Json(crate::client_auth::LoginReq { email: "anon.me@example.com".into(), password: "Ezymex@2026".into() }))).await;
    assert!(matches!(login, Err(ApiError::InvalidCredentials)));
    assert!(!crypto::verify_password("Ezymex@2026", &g("password_hash").unwrap()));
    // KYC erased (rows and files), the open closure request completed, the referee keeps the link
    assert_eq!(db.count("SELECT count(*) FROM kyc_cases WHERE user_id = $1", uid).await, 0);
    assert!(!file.exists());
    assert_eq!(db.count("SELECT count(*) FROM client_requests WHERE user_id = $1 AND status = 'completed'", uid).await, 1);
    assert_eq!(db.count("SELECT count(*) FROM users WHERE referred_by = $1", uid).await, 1);
    assert!(user(&db, "anon.me@example.com").await > uid, "the address can register again");

    // Back Office: out of the list by default, a Deleted row under "Show hidden"; nothing more to do on it
    assert!(!ids(&list(&db, &admin_tok, None).await).contains(&uid));
    let v = list(&db, &admin_tok, Some("only")).await;
    assert_eq!((ids(&v), v["items"][0]["deleted"].as_bool(), v["counts"]["deleted"].as_i64()), (vec![uid], Some(true), Some(1)));
    let Json(d) = crate::admin::user_detail(State(st.clone()), ctx(Some(&admin_tok)), Path(uid)).await.unwrap();
    assert_eq!((d["user"]["deleted_by"].as_str(), d["user"]["presence"].as_str()), (Some("Staff super_admin"), Some("offline")));
    assert_eq!(code(&check_route(st, &admin, uid, &fake).await.unwrap_err()), "already_deleted");
    assert_eq!(code(&hide(State(st.clone()), ctx(Some(&admin_tok)), Path(uid), Ok(Json(ReasonReq { reason: "Tidy up".into() }))).await.unwrap_err()), "already_deleted");
    // mirrors: placeholder data, no signals, still the same id
    let f = feed(&db).await;
    let row = f.iter().find(|u| u["id"] == uid).unwrap();
    assert_eq!((row["deleted"].as_bool(), row["purged"].as_bool(), row["birthday"].is_null()), (Some(true), Some(false), true));
    assert!(row["identity"].as_array().unwrap().is_empty() && row["ips"].as_array().unwrap().is_empty());
    let meta = audit_meta(&db, "client.deleted", uid).await.unwrap();
    assert_eq!((meta["before"]["kyc_status"].as_str(), meta["after"]["status"].as_str()), (Some("verified"), Some("closed")));
    assert!(!meta.to_string().contains("anon.me@") && !meta.to_string().contains("Maya"));
    db.drop_db().await;
}

#[tokio::test]
async fn money_blocks_and_failures_leave_the_client_untouched() {
    let Some(db) = TestDb::new("client-lifecycle blocked").await else { return };
    let st = &db.st;
    let uid = user(&db, "keep.me@example.com").await;
    let (admin, _) = staff(&db, "admin").await;
    let (_, support) = staff(&db, "support").await;
    let (_, compliance) = staff(&db, "compliance").await;

    // clients.delete: support and Compliance can neither check nor delete
    for tok in [&support, &compliance] {
        assert_eq!(code(&delete_check(State(st.clone()), ctx(Some(tok)), Path(uid)).await.unwrap_err()), "forbidden");
        let r = delete(State(st.clone()), ctx(Some(tok)), Path(uid), Ok(Json(req("Spam", "keep.me@example.com", "purge")))).await;
        assert_eq!(code(&r.unwrap_err()), "forbidden");
    }

    // money in the wallet: refused with the blockers, nothing archived
    let rich = Fake::new(WalletFacts { balances: vec![usdt("20.000000", "0")], ledger_entries: 1, ..Default::default() }, trading(vec![account(10_000_100, true)]));
    let (s, Json(v)) = delete_with(st, &ctx(None), &admin, uid, req("Closing a test account", "keep.me@example.com", "anonymize"), &rich).await.unwrap();
    assert_eq!((s, v["error"]["code"].as_str()), (StatusCode::CONFLICT, Some("delete_blocked")));
    assert_eq!(v["error"]["check"]["blockers"][0]["code"], "wallet_balance");
    assert!(rich.archived.lock().unwrap().is_empty());
    // a service that can't be reached blocks too
    let mut down = Fake::new(wallet(0), trading(vec![]));
    down.trading = Err("not reachable".into());
    let Json(v) = check_route(st, &admin, uid, &down).await.unwrap();
    assert_eq!((v["mode"].as_str(), v["blockers"][0]["code"].as_str()), (Some("blocked"), Some("engine_unavailable")));

    // the engine refuses to archive the second account: nothing is deleted, the first stays archived
    let mut stuck = Fake::new(wallet(0), trading(vec![account(10_000_101, true), account(50_000_101, false)]));
    stuck.refuse_archive = Some(50_000_101);
    let (s, Json(v)) = delete_with(st, &ctx(None), &admin, uid, req("Closing a test account", "keep.me@example.com", "purge"), &stuck).await.unwrap();
    assert_eq!((s, v["error"]["code"].as_str(), v["error"]["archived"].clone()), (StatusCode::BAD_GATEWAY, Some("archive_failed"), json!([10_000_101])));
    assert!(v["error"]["message"].as_str().unwrap().starts_with("Couldn't archive trading account #50000101"));
    let (email, status): (String, String) = sqlx::query_as("SELECT email, status FROM users WHERE id = $1").bind(uid).fetch_one(&st.pool).await.unwrap();
    assert_eq!((email.as_str(), status.as_str()), ("keep.me@example.com", "active"));
    assert!(audit_meta(&db, "client.deleted", uid).await.is_none());
    db.drop_db().await;
}
