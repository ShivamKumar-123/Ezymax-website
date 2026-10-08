//! Suitability tests. The quiz and the eligibility rule run everywhere; the flows run the real handlers against a
//! throwaway PostgreSQL database (see `testdb`) and are skipped, with a note, when no server is reachable.

use super::*;
use crate::crypto;
use crate::testdb::TestDb;
use axum::http::HeaderValue;
use std::collections::HashSet;

// ---------- quiz ----------

#[test]
fn options_quiz_is_well_formed() {
    let qs = OPTIONS_QUIZ;
    assert_eq!(qs.len(), 10);
    assert_eq!(PASS_MARK, 8);
    let mut ids = HashSet::new();
    for q in qs {
        assert!(ids.insert(q.id), "duplicate id {}", q.id);
        assert!(q.id.chars().all(|c| c.is_ascii_lowercase() || c == '-'), "id {} must be kebab-case (i18n keys use it)", q.id);
        assert!(q.text.ends_with('?'), "{}", q.id);
        assert!(q.answer < q.options.len(), "{}", q.id);
        assert!(q.explanation.len() > 60, "{} needs a real explanation", q.id);
        let opts: HashSet<&str> = q.options.iter().copied().collect();
        assert_eq!(opts.len(), 4, "{}: options must differ", q.id);
        assert!(q.options.iter().all(|o| !o.trim().is_empty()), "{}", q.id);
    }
    // the right answer isn't always in the same place
    let places: HashSet<usize> = qs.iter().map(|q| q.answer).collect();
    assert_eq!(places.len(), 4);
    assert!(quiz_for("futures").is_empty());
}

#[test]
fn public_questions_never_carry_answers() {
    let v = Value::Array(public_questions(OPTIONS_QUIZ));
    let s = v.to_string();
    assert!(!s.contains("\"answer\"") && !s.contains("\"explanation\""));
    for q in OPTIONS_QUIZ {
        assert!(!s.contains(q.explanation), "{} explanation leaked", q.id);
    }
    assert_eq!(v[0]["id"], "call-right");
    assert_eq!(v[0]["options"].as_array().unwrap().len(), 4);
}

/// The friendly v2 disclosure (migration `20261002190000_options_onboarding_light.sql`): one short, calm paragraph of
/// key points first, then the full terms; the demo build of the Client Area shows the same text.
#[test]
fn disclosure_v2_is_short_up_front_and_the_demo_copy_matches() {
    let sql = include_str!("../../migrations/20261002190000_options_onboarding_light.sql");
    let demo = include_str!("../../../../apps/crm/components/options/demo.ts");
    let body = sql.split("$md$").nth(1).expect("v2 body between $md$ markers").trim_matches(|c| c == ' ' || c == '\n');
    assert!(demo.contains(body), "demo.ts: the disclosure differs from migration 20261002190000");
    let (key_points, full) = body.split_once("\n\n## Full terms\n").expect("a key-points paragraph, then ## Full terms");
    assert!(!key_points.contains('\n') && key_points.len() < 600, "the key points stay one short paragraph");
    for must in ["the most you can lose is what you pay", "you can lose more than you receive", "uses margin", "Ezymex order book", "settle in cash at expiry"] {
        assert!(key_points.contains(must), "key points must say: {must}");
    }
    for calm in ["high level of risk", "complex instruments", "WARNING"] {
        assert!(!key_points.contains(calm), "key points stay calm: {calm}");
    }
    // the substance of v1 stays in the full terms
    for must in ["lose the whole premium", "Losses on a sold call grow without limit", "margin call", "knock-out option is cancelled", "30 minutes before the cut", "conflict of interest", "Bonus and credit cannot be used"] {
        assert!(full.contains(must), "full terms must say: {must}");
    }
}

/// Answers with the first `correct` questions right and the rest wrong.
fn answers(correct: usize) -> BTreeMap<String, i64> {
    OPTIONS_QUIZ.iter().enumerate().map(|(i, q)| (q.id.to_string(), if i < correct { q.answer } else { (q.answer + 1) % 4 } as i64)).collect()
}

fn code(e: &ApiError) -> String {
    match e {
        ApiError::Coded { code, .. } => (*code).into(),
        ApiError::Validation { field, .. } => format!("field:{field}"),
        ApiError::Unauthorized => "unauthorized".into(),
        ApiError::BadRequest(_) => "bad_request".into(),
        ApiError::NotFound => "not_found".into(),
        ApiError::Forbidden => "forbidden".into(),
        other => format!("{other:?}"),
    }
}

#[test]
fn grading_needs_eight_of_ten() {
    let g = grade(OPTIONS_QUIZ, &answers(10)).unwrap();
    assert_eq!((g.score, g.total, g.passed()), (10, 10, true));
    assert!(g.wrong.is_empty());
    let g = grade(OPTIONS_QUIZ, &answers(8)).unwrap();
    assert_eq!((g.score, g.passed()), (8, true));
    assert_eq!(g.wrong, vec![OPTIONS_QUIZ[8].id, OPTIONS_QUIZ[9].id]);
    let g = grade(OPTIONS_QUIZ, &answers(7)).unwrap();
    assert_eq!((g.score, g.passed()), (7, false));
    assert_eq!(g.wrong.len(), 3);
    assert_eq!(grade(OPTIONS_QUIZ, &answers(0)).unwrap().score, 0);

    let mut a = answers(10);
    a.remove("delta");
    assert_eq!(code(&grade(OPTIONS_QUIZ, &a).unwrap_err()), "field:answers");
    let mut a = answers(10);
    a.insert("bogus".into(), 0);
    assert_eq!(code(&grade(OPTIONS_QUIZ, &a).unwrap_err()), "field:answers");
    for bad in [-1, 4, 99] {
        let mut a = answers(10);
        a.insert("delta".into(), bad);
        assert_eq!(code(&grade(OPTIONS_QUIZ, &a).unwrap_err()), "field:answers");
    }
    assert!(grade(OPTIONS_QUIZ, &BTreeMap::new()).is_err());
}

#[test]
fn eligible_needs_only_the_disclosure() {
    let now = Utc::now();
    let mut s = Status {
        product: "options",
        kyc_status: "unverified".into(),
        disclosure: Some(Disclosure { version: 2, title: "t".into(), body_md: "b".into(), published_at: now }),
        accepted_version: None,
        accepted_at: None,
        quiz_passed_at: None,
        quiz_score: None,
        quiz_attempts: 0,
    };
    assert!(!s.disclosure_accepted() && !s.eligible());
    assert_eq!(s.missing(), vec!["disclosure"]);
    // a passed quiz or verified identity alone changes nothing
    s.quiz_passed_at = Some(now);
    s.kyc_status = "verified".into();
    assert!(!s.eligible());
    assert_eq!(s.missing(), vec!["disclosure"]);
    // any accepted version counts, also one older than the current disclosure; identity and quiz don't matter
    s.quiz_passed_at = None;
    s.kyc_status = "pending".into();
    s.accepted_version = Some(1);
    s.accepted_at = Some(now);
    assert!(s.disclosure_accepted() && s.eligible());
    assert!(s.missing().is_empty());
    assert!(!s.kyc_verified() && !s.quiz_passed());
    s.accepted_version = Some(2);
    assert!(s.eligible());
}

// ---------- flows ----------

fn ctx(bearer: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.40".into(), user_agent: "Mozilla/5.0 (Macintosh) Chrome/131".into(), device: Some("device-suitability-aaaa".into()), tenant_slug: "ezymex".into(), bearer: bearer.map(str::to_string) }
}

async fn user(db: &TestDb, tenant: i64, email: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, email_verified_at)
         VALUES ($1, $2, 'x', 'Arjun', 'Mehta', '+971', '501234567', 'ae', '1990-01-01', $3, now(), now()) RETURNING id",
    )
    .bind(tenant)
    .bind(email)
    .bind(format!("S{}", crypto::random_token(6)))
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

async fn session(db: &TestDb, tenant: i64, uid: i64) -> String {
    identity::create_session(&db.st, &ctx(None), Kind::User, tenant, uid).await.unwrap().token
}

const P: &str = "options";

async fn get_state(db: &TestDb, tok: &str) -> Value {
    get(State(db.st.clone()), ctx(Some(tok)), Path(P.into())).await.unwrap().0
}

async fn accept_v(db: &TestDb, tok: &str, version: Option<i64>) -> ApiResult<Value> {
    accept(State(db.st.clone()), ctx(Some(tok)), Path(P.into()), Ok(Json(AcceptReq { version }))).await.map(|j| j.0)
}

async fn take_quiz(db: &TestDb, tok: &str, a: BTreeMap<String, i64>) -> ApiResult<Value> {
    quiz(State(db.st.clone()), ctx(Some(tok)), Path(P.into()), Ok(Json(QuizReq { answers: a }))).await.map(|j| j.0)
}

async fn check(db: &TestDb, uid: i64, headers: &[(&'static str, &'static str)], product: Option<&str>) -> ApiResult<Value> {
    let mut h = HeaderMap::new();
    for (k, v) in headers {
        h.insert(*k, HeaderValue::from_static(v));
    }
    internal(State(db.st.clone()), h, Path(uid), Ok(Query(InternalQ { product: product.map(str::to_string) }))).await.map(|j| j.0)
}

#[tokio::test]
async fn onboarding_flow_needs_only_the_disclosure() {
    let Some(db) = TestDb::new("suitability flow").await else { return };
    let uid = user(&db, 1, "arjun@ezymex.test").await;
    let tok = session(&db, 1, uid).await;

    // a fresh client: v2 of the options disclosure (key points, then the full terms), only the disclosure to do
    let v = get_state(&db, &tok).await;
    assert_eq!(v["product"], "options");
    assert_eq!(v["kycVerified"], false);
    assert_eq!(v["kycStatus"], "unverified");
    assert_eq!(v["disclosure"]["version"], 2);
    assert_eq!(v["disclosure"]["title"], "Ezymex FX Options: key points and terms");
    let body = v["disclosure"]["bodyMd"].as_str().unwrap();
    for must in ["the most you can lose is what you pay", "## Full terms", "lose the whole premium", "knock-out option is cancelled", "30 minutes before the cut", "Ezymex order book"] {
        assert!(body.contains(must), "disclosure must say: {must}");
    }
    assert!(!body.starts_with('\n') && !body.ends_with('\n'));
    // v1 stays on record
    assert_eq!(db.count("SELECT count(*) FROM disclosures WHERE tenant_id = $1 AND product = 'options'", 1).await, 2);
    assert_eq!(v["disclosureAccepted"], false);
    assert_eq!(v["quizPassed"], false);
    assert_eq!(v["eligible"], false);
    assert_eq!(v["missing"], json!(["disclosure"]));
    assert_eq!(v["quiz"]["total"], 10);
    assert_eq!(v["quiz"]["passMark"], 8);
    assert_eq!(v["quiz"]["questions"].as_array().unwrap().len(), 10);
    assert!(!v["quiz"].to_string().contains("explanation"));
    let c = check(&db, uid, &[], Some("options")).await.unwrap();
    assert_eq!((c["eligible"].as_bool(), c["disclosureAccepted"].as_bool()), (Some(false), Some(false)));
    assert_eq!(c["missing"], json!(["disclosure"]));

    // only the current version can be accepted
    assert_eq!(code(&accept_v(&db, &tok, Some(1)).await.unwrap_err()), "disclosure_outdated");
    assert_eq!(code(&accept_v(&db, &tok, Some(3)).await.unwrap_err()), "disclosure_outdated");
    assert_eq!(code(&accept_v(&db, &tok, None).await.unwrap_err()), "field:version");
    assert_eq!(code(&accept_v(&db, &tok, Some(0)).await.unwrap_err()), "field:version");

    // accepting is all it takes: identity unverified and no quiz, yet eligible
    let v = accept_v(&db, &tok, Some(2)).await.unwrap();
    assert_eq!(v["disclosureAccepted"], true);
    assert_eq!(v["acceptedVersion"], 2);
    assert_eq!((v["eligible"].as_bool(), v["kycVerified"].as_bool(), v["quizPassed"].as_bool()), (Some(true), Some(false), Some(false)));
    assert_eq!(v["missing"], json!([]));
    let (ip, ua, at1): (String, String, DateTime<Utc>) = sqlx::query_as("SELECT ip, user_agent, accepted_at FROM suitability WHERE user_id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(ip, "203.0.113.40");
    assert!(ua.contains("Chrome"));
    // accepting again changes nothing (first acceptance kept, one audit row)
    accept_v(&db, &tok, Some(2)).await.unwrap();
    let at2: DateTime<Utc> = sqlx::query_scalar("SELECT accepted_at FROM suitability WHERE user_id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(at1, at2);
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'suitability.disclosure_accepted'", uid).await, 1);

    // the engine's view: eligible; identity and quiz are reported for information only
    let c = check(&db, uid, &[], Some("options")).await.unwrap();
    assert_eq!(
        (c["eligible"].as_bool(), c["kycVerified"].as_bool(), c["disclosureAccepted"].as_bool(), c["quizPassed"].as_bool()),
        (Some(true), Some(false), Some(true), Some(false))
    );
    assert_eq!(c["missing"], json!([]));
    assert_eq!((c["disclosureVersion"].as_i64(), c["acceptedVersion"].as_i64()), (Some(2), Some(2)));

    // the quiz is an optional self-test: graded and audited, never needed
    let r = take_quiz(&db, &tok, answers(7)).await.unwrap();
    assert_eq!((r["passed"].as_bool(), r["score"].as_i64(), r["total"].as_i64()), (Some(false), Some(7), Some(10)));
    let wrong = r["wrong"].as_array().unwrap();
    assert_eq!(wrong.len(), 3);
    assert_eq!(wrong[0]["id"], OPTIONS_QUIZ[7].id);
    assert_eq!(wrong[0]["explanation"], OPTIONS_QUIZ[7].explanation);
    assert_eq!((r["quizPassed"].as_bool(), r["eligible"].as_bool()), (Some(false), Some(true)));
    let r = take_quiz(&db, &tok, answers(8)).await.unwrap();
    assert_eq!((r["passed"].as_bool(), r["quizPassed"].as_bool(), r["eligible"].as_bool()), (Some(true), Some(true), Some(true)));
    // a later failed attempt never undoes the pass
    let r = take_quiz(&db, &tok, answers(3)).await.unwrap();
    assert_eq!((r["passed"].as_bool(), r["quizPassed"].as_bool()), (Some(false), Some(true)));
    let (score, attempts): (i16, i32) = sqlx::query_as("SELECT quiz_score, quiz_attempts FROM suitability WHERE user_id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!((score, attempts), (8, 3));
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action LIKE 'suitability.quiz_%'", uid).await, 3);

    // a new disclosure version doesn't undo the acceptance; accepting it records the newer version
    sqlx::query("INSERT INTO disclosures (tenant_id, product, version, title, body_md) VALUES (1, 'options', 3, 'Ezymex FX Options: key points and terms (v3)', $1)")
        .bind("Updated text. ".repeat(10))
        .execute(&db.st.pool)
        .await
        .unwrap();
    let v = get_state(&db, &tok).await;
    assert_eq!((v["disclosure"]["version"].as_i64(), v["acceptedVersion"].as_i64()), (Some(3), Some(2)));
    assert_eq!((v["disclosureAccepted"].as_bool(), v["eligible"].as_bool()), (Some(true), Some(true)));
    let c = check(&db, uid, &[], None).await.unwrap();
    assert_eq!((c["eligible"].as_bool(), c["disclosureVersion"].as_i64(), c["acceptedVersion"].as_i64()), (Some(true), Some(3), Some(2)));
    assert_eq!(code(&accept_v(&db, &tok, Some(2)).await.unwrap_err()), "disclosure_outdated");
    assert_eq!(accept_v(&db, &tok, Some(3)).await.unwrap()["acceptedVersion"], 3);
    assert_eq!(db.count("SELECT count(*) FROM audit_log WHERE actor_id = $1 AND action = 'suitability.disclosure_accepted'", uid).await, 2);

    // a version scheduled for later isn't current yet
    sqlx::query("INSERT INTO disclosures (tenant_id, product, version, title, body_md, published_at) VALUES (1, 'options', 4, 'Next', $1, now() + interval '1 day')")
        .bind("Future text. ".repeat(10))
        .execute(&db.st.pool)
        .await
        .unwrap();
    assert_eq!(get_state(&db, &tok).await["disclosure"]["version"], 3);

    // a client who accepted v1 before v2 was published stays eligible
    let early = user(&db, 1, "early@ezymex.test").await;
    sqlx::query("INSERT INTO suitability (tenant_id, user_id, product, disclosure_version, accepted_at) VALUES (1, $1, 'options', 1, now() - interval '1 hour')")
        .bind(early)
        .execute(&db.st.pool)
        .await
        .unwrap();
    let c = check(&db, early, &[], None).await.unwrap();
    assert_eq!((c["eligible"].as_bool(), c["acceptedVersion"].as_i64(), c["missing"].clone()), (Some(true), Some(1), json!([])));

    // the self-test works before the disclosure too, and never makes a client eligible on its own
    let quizzer = user(&db, 1, "quiz-first@ezymex.test").await;
    let qtok = session(&db, 1, quizzer).await;
    let r = take_quiz(&db, &qtok, answers(10)).await.unwrap();
    assert_eq!((r["passed"].as_bool(), r["quizPassed"].as_bool(), r["eligible"].as_bool()), (Some(true), Some(true), Some(false)));
    assert_eq!(r["missing"], json!(["disclosure"]));
    assert_eq!(check(&db, quizzer, &[], None).await.unwrap()["eligible"], false);
    assert_eq!(accept_v(&db, &qtok, Some(3)).await.unwrap()["eligible"], true);

    // unknown products, users and sessions
    assert_eq!(code(&get(State(db.st.clone()), ctx(Some(&tok)), Path("futures".into())).await.unwrap_err()), "not_found");
    assert_eq!(code(&check(&db, uid, &[], Some("futures")).await.unwrap_err()), "not_found");
    assert_eq!(code(&check(&db, uid + 999, &[], None).await.unwrap_err()), "not_found");
    assert_eq!(code(&get(State(db.st.clone()), ctx(None), Path(P.into())).await.unwrap_err()), "unauthorized");
    assert_eq!(code(&accept_v(&db, "not-a-session", Some(3)).await.unwrap_err()), "unauthorized");
    db.drop_db().await;
}

#[tokio::test]
async fn view_only_logins_can_read_but_not_attest() {
    let Some(db) = TestDb::new("suitability viewer").await else { return };
    let uid = user(&db, 1, "owner@ezymex.test").await;
    let vid: i64 = sqlx::query_scalar("INSERT INTO client_viewers (tenant_id, user_id, label, username, password_hash) VALUES (1, $1, 'Accountant', 'acct-view', 'x') RETURNING id")
        .bind(uid)
        .fetch_one(&db.st.pool)
        .await
        .unwrap();
    let vtok = identity::create_session_as(&db.st, &ctx(None), Kind::User, 1, uid, Some(vid)).await.unwrap().token;
    assert_eq!(get_state(&db, &vtok).await["disclosure"]["version"], 2);
    assert_eq!(code(&accept_v(&db, &vtok, Some(2)).await.unwrap_err()), "viewer_read_only");
    assert_eq!(code(&take_quiz(&db, &vtok, answers(10)).await.unwrap_err()), "viewer_read_only");
    assert_eq!(db.count("SELECT count(*) FROM suitability WHERE user_id = $1", uid).await, 0);
    db.drop_db().await;
}

#[tokio::test]
async fn brokers_are_isolated_and_disclosures_append_only() {
    let Some(db) = TestDb::new("suitability tenants").await else { return };
    let t2: i64 = sqlx::query_scalar("INSERT INTO tenants (slug, name) VALUES ('broker-two', 'Broker Two') RETURNING id").fetch_one(&db.st.pool).await.unwrap();
    let u1 = user(&db, 1, "one@ezymex.test").await;
    let u2 = user(&db, t2, "two@broker2.test").await;
    let tok1 = session(&db, 1, u1).await;
    let tok2 = session(&db, t2, u2).await;

    // a broker created after the seed gets a copy of the platform's current disclosure on first use
    assert_eq!(db.count("SELECT count(*) FROM disclosures WHERE tenant_id = $1", t2).await, 0);
    let v = get_state(&db, &tok2).await;
    assert_eq!(v["disclosure"]["version"], 2);
    assert_eq!(v["disclosure"]["title"], "Ezymex FX Options: key points and terms");
    assert_eq!(db.count("SELECT count(*) FROM disclosures WHERE tenant_id = $1", t2).await, 1);
    get_state(&db, &tok2).await;
    assert_eq!(db.count("SELECT count(*) FROM disclosures WHERE tenant_id = $1", t2).await, 1);
    accept_v(&db, &tok1, Some(2)).await.unwrap();
    accept_v(&db, &tok2, Some(2)).await.unwrap();

    // row-level security: a broker's scope sees only its own disclosures and records
    let mut tx = domains::tenant_tx(&db.st.pool, t2).await.unwrap();
    let users: Vec<i64> = sqlx::query_scalar("SELECT user_id FROM suitability").fetch_all(&mut *tx).await.unwrap();
    assert_eq!(users, vec![u2]);
    let tenants: Vec<i64> = sqlx::query_scalar("SELECT DISTINCT tenant_id FROM disclosures").fetch_all(&mut *tx).await.unwrap();
    assert_eq!(tenants, vec![t2]);
    let r = sqlx::query("UPDATE suitability SET quiz_attempts = 99 WHERE user_id = $1").bind(u1).execute(&mut *tx).await.unwrap();
    assert_eq!(r.rows_affected(), 0);
    tx.rollback().await.unwrap();

    // the engine naming a broker only sees that broker's clients
    assert_eq!(code(&check(&db, u2, &[("x-ezymex-tenant", "ezymex")], None).await.unwrap_err()), "not_found");
    assert_eq!(check(&db, u2, &[("x-ezymex-tenant", "broker-two")], None).await.unwrap()["tenantId"], t2);
    assert_eq!(check(&db, u2, &[], None).await.unwrap()["disclosureAccepted"], true);
    assert_eq!(check(&db, u1, &[("x-ezymex-tenant", "ezymex")], None).await.unwrap()["tenantId"], 1);

    // what a client accepted can't be rewritten or removed
    let e = sqlx::query("UPDATE disclosures SET body_md = body_md || ' edited' WHERE tenant_id = 1").execute(&db.st.pool).await.unwrap_err().to_string();
    assert!(e.contains("append-only"), "{e}");
    let e = sqlx::query("DELETE FROM disclosures WHERE tenant_id = $1").bind(t2).execute(&db.st.pool).await.unwrap_err().to_string();
    assert!(e.contains("append-only"), "{e}");
    db.drop_db().await;
}
