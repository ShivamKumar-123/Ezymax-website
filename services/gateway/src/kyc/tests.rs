//! KYC tests. Storage, sniffing and requirement rules are pure; the flow tests run the real handlers against a
//! throwaway PostgreSQL database (see `testdb`) and skip, with a note, when no server is reachable.

#![allow(unused_must_use)]

use super::*;
use crate::crypto;
use crate::testdb::TestDb;
use axum::extract::Path;
use axum::http::HeaderValue;

// ---------- pure ----------

#[test]
fn encryption_roundtrip_and_tamper_detection() {
    let k = DataKey::from_bytes([9u8; 32]);
    let sealed = store::encrypt(&k, "ref-a", b"passport photo page").unwrap();
    assert!(sealed.starts_with(b"KKYC1"));
    assert!(!sealed.windows(8).any(|w| w == b"passport"), "ciphertext must not contain the plaintext");
    assert_eq!(store::decrypt(&k, "ref-a", &sealed).unwrap(), b"passport photo page");
    // bound to its ref (associated data), its key, and every byte
    assert!(store::decrypt(&k, "ref-b", &sealed).is_err());
    assert!(store::decrypt(&DataKey::from_bytes([8u8; 32]), "ref-a", &sealed).is_err());
    let mut bad = sealed.clone();
    let last = bad.len() - 1;
    bad[last] ^= 1;
    assert!(store::decrypt(&k, "ref-a", &bad).is_err());
    // fresh nonce every time
    assert_ne!(store::encrypt(&k, "ref-a", b"x").unwrap(), store::encrypt(&k, "ref-a", b"x").unwrap());
}

#[test]
fn key_parsing() {
    let hex = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    assert!(DataKey::parse(hex).is_some());
    assert!(DataKey::parse("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=").is_some());
    assert!(DataKey::parse("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8").is_some());
    assert!(DataKey::parse("too-short").is_none());
    assert!(DataKey::parse(&hex[..62]).is_none());
}

#[test]
fn file_refs_never_escape_the_store() {
    let dir = std::path::Path::new("/srv/kyc");
    assert!(store::path_for(dir, 1, "../../etc/passwd").is_none());
    assert!(store::path_for(dir, 1, "a/b").is_none());
    let r = store::new_ref();
    assert!(store::valid_ref(&r));
    let p = store::path_for(dir, 7, &r).unwrap();
    assert!(p.starts_with("/srv/kyc/7/"));
}

#[test]
fn requirements_per_document_type() {
    let d = Details::default();
    let passport = required_slots("individual", Some("passport"), &d);
    assert_eq!(passport.iter().map(|s| (s.kind.as_str(), s.side.as_str())).collect::<Vec<_>>(), vec![("id_document", "front"), ("proof_of_address", "single"), ("selfie", "single")]);
    let id = required_slots("individual", Some("national_id"), &d);
    assert!(id.contains(&Slot::new("id_document", "back", None)));
    let corp = Details {
        parties: vec![
            Party { key: "p1".into(), first_name: "Ana".into(), last_name: "Ruiz".into(), id_type: "passport".into(), ..Default::default() },
            Party { key: "p2".into(), first_name: "Omar".into(), last_name: "Haddad".into(), id_type: "driving_licence".into(), ..Default::default() },
        ],
        ..Default::default()
    };
    let slots = required_slots("corporate", None, &corp);
    assert!(slots.contains(&Slot::new("incorporation", "single", None)));
    assert!(slots.contains(&Slot::new("party_id", "front", Some("p1"))));
    assert!(!slots.contains(&Slot::new("party_id", "back", Some("p1"))));
    assert!(slots.contains(&Slot::new("party_id", "back", Some("p2"))));
    assert_eq!(slot_label(&Slot::new("party_id", "back", Some("p2")), None, &corp), "Omar Haddad: Driving licence (back)");
    assert_eq!(slot_label(&Slot::new("id_document", "front", None), Some("passport"), &d), "Passport photo page");
}

#[test]
fn references_and_filenames() {
    assert_eq!(reference(42), "KYC-000042");
    assert_eq!(clean_filename(Some("bank%20statement%20(june).pdf")).as_deref(), Some("bank statement (june).pdf"));
    assert_eq!(clean_filename(Some("..%2F..%2Fetc%2Fpasswd")).as_deref(), Some("....etcpasswd"));
    assert_eq!(clean_filename(Some("   ")), None);
    assert_eq!(clean_filename(Some("<script>.png")).as_deref(), Some("script.png"));
    assert!(reason_label("document_expired").is_some());
    assert!(reason_label("made_up").is_none());
}

// ---------- flow ----------

/// A JPEG-shaped file (SOI, APP0, SOF0 with the given size) padded with bytes derived from `seed`.
fn jpeg(w: u16, h: u16, seed: u8) -> Vec<u8> {
    let mut b = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, b'J', b'F', b'I', b'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
    b.extend_from_slice(&[0xFF, 0xC0, 0x00, 0x11, 0x08]);
    b.extend_from_slice(&h.to_be_bytes());
    b.extend_from_slice(&w.to_be_bytes());
    b.extend_from_slice(&[0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    b.extend((0..20_000u32).map(|i| (i as u8).wrapping_mul(31).wrapping_add(seed)));
    b
}

fn pdf(seed: u8) -> Vec<u8> {
    let mut b = b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n".to_vec();
    b.extend((0..12_000u32).map(|i| b'a' + ((i as u8).wrapping_add(seed) % 26)));
    b
}

fn ctx(bearer: &str) -> Ctx {
    Ctx { ip: "203.0.113.7".into(), user_agent: "kyc-test".into(), device: None, tenant_slug: "kalks".into(), bearer: Some(bearer.to_string()) }
}

fn code(e: &ApiError) -> String {
    match e {
        ApiError::Coded { code, .. } => (*code).into(),
        ApiError::Validation { field, .. } => format!("field:{field}"),
        ApiError::Unauthorized => "unauthorized".into(),
        ApiError::Forbidden => "forbidden".into(),
        ApiError::NotFound => "not_found".into(),
        ApiError::BadRequest(m) => format!("bad_request:{m}"),
        other => format!("{other:?}"),
    }
}

async fn user(db: &TestDb, email: &str, first: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, email_verified_at)
         VALUES (1, $1, 'x', $2, 'Sample', '+971', '501234567', 'ae', '1990-04-12', $3, now(), now()) RETURNING id",
    )
    .bind(email)
    .bind(first)
    .bind(format!("K{}", crypto::random_token(6)))
    .fetch_one(&db.st.pool)
    .await
    .unwrap()
}

async fn staff(db: &TestDb, role: &str) -> (i64, String) {
    let id: i64 = sqlx::query_scalar("INSERT INTO staff (tenant_id, email, password_hash, name, role) VALUES (1,$1,'x',$2,$3) RETURNING id")
        .bind(format!("{role}-{}@example.com", crypto::random_token(4).to_lowercase()))
        .bind(format!("Reviewer {role}"))
        .bind(role)
        .fetch_one(&db.st.pool)
        .await
        .unwrap();
    let tok = identity::create_session(&db.st, &ctx("x"), Kind::Staff, 1, id).await.unwrap().token;
    (id, tok)
}

async fn session(db: &TestDb, uid: i64) -> String {
    identity::create_session(&db.st, &ctx("x"), Kind::User, 1, uid).await.unwrap().token
}

fn q(kind: &str, side: &str, issue: Option<&str>) -> Result<Query<UploadQuery>, QueryRejection> {
    Ok(Query(UploadQuery { kind: Some(kind.into()), side: Some(side.into()), party: None, doc_type: None, issue_date: issue.map(str::to_string) }))
}

fn hdrs(mime: &str) -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("content-type", HeaderValue::from_str(mime).unwrap());
    h.insert("x-kalks-filename", HeaderValue::from_static("id%20front.jpg"));
    h.insert("x-kalks-kyc-checks", HeaderValue::from_static(r#"{"blur":{"score":212.5,"ok":true},"glare":{"pct":0.4,"ok":true}}"#));
    h
}

async fn up(db: &TestDb, tok: &str, kind: &str, side: &str, issue: Option<&str>, bytes: Vec<u8>) -> ApiResult<Json<Value>> {
    let mime = if bytes.starts_with(b"%PDF") { "application/pdf" } else { "image/jpeg" };
    upload(State(db.st.clone()), ctx(tok), q(kind, side, issue), hdrs(mime), Bytes::from(bytes)).await
}

fn days_ago(n: i64) -> String {
    (Utc::now().date_naive() - Duration::days(n)).to_string()
}

fn addr() -> Address {
    Address { line1: "Office 1204, Marina Plaza".into(), line2: String::new(), city: "Dubai".into(), postcode: "00000".into(), country: "ae".into() }
}

async fn kyc_status(db: &TestDb, uid: i64) -> String {
    sqlx::query_scalar("SELECT kyc_status FROM users WHERE id = $1").bind(uid).fetch_one(&db.st.pool).await.unwrap()
}

#[tokio::test]
async fn individual_flow_more_info_then_approve() {
    let Some(db) = TestDb::new("kyc").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "kyc.flow@example.com", "Priya").await;
    let tok = session(&db, uid).await;

    // nothing yet
    let Json(v) = get(st(), ctx(&tok)).await.unwrap();
    assert_eq!(v["case"], Value::Null);
    assert_eq!(v["can_start"], true);
    assert_eq!(v["kyc_status"], "unverified");
    assert!(get(st(), Ctx { bearer: None, ..ctx("") }).await.is_err());

    // start + details
    let Json(v) = start(st(), ctx(&tok), Ok(Json(StartReq { kind: "individual".into() }))).await.unwrap();
    assert_eq!(v["case"]["status"], "draft");
    let case_id = v["case"]["id"].as_i64().unwrap();
    assert_eq!(code(&up(&db, &tok, "id_document", "front", None, jpeg(1600, 1000, 1)).await.unwrap_err()), "field:doc_type");
    assert_eq!(
        code(&details(st(), ctx(&tok), Ok(Json(DetailsReq { id_doc_type: Some("library_card".into()), ..Default::default() }))).await.unwrap_err()),
        "field:id_doc_type"
    );
    let Json(v) = details(
        st(),
        ctx(&tok),
        Ok(Json(DetailsReq {
            id_doc_type: Some("national_id".into()),
            address: Some(addr()),
            identity: Some(Identity { first_name: "Priya".into(), last_name: "Shah".into(), date_of_birth: "1990-04-12".into() }),
            ..Default::default()
        })),
    )
    .await
    .unwrap();
    assert_eq!(v["profile"]["last_name"], "Shah");
    assert_eq!(v["required"].as_array().unwrap().len(), 4, "front, back, address, selfie");

    // server-side checks: type sniffing, size, resolution, proof-of-address age
    assert_eq!(code(&up(&db, &tok, "id_document", "front", None, b"GIF89a".repeat(3000)).await.unwrap_err()), "unsupported_type");
    assert_eq!(code(&up(&db, &tok, "id_document", "front", None, jpeg(1600, 1000, 1)[..4000].to_vec()).await.unwrap_err()), "too_small");
    assert_eq!(code(&up(&db, &tok, "id_document", "front", None, jpeg(500, 320, 1)).await.unwrap_err()), "low_resolution");
    assert_eq!(code(&up(&db, &tok, "selfie", "single", None, pdf(1)).await.unwrap_err()), "unsupported_type");
    assert_eq!(code(&up(&db, &tok, "proof_of_address", "single", None, pdf(2)).await.unwrap_err()), "field:issue_date");
    assert_eq!(code(&up(&db, &tok, "proof_of_address", "single", Some(&days_ago(120)), pdf(2)).await.unwrap_err()), "poa_too_old");
    let mut evil = pdf(3);
    evil.extend_from_slice(b"<< /S /JavaScript /JS (app.alert(1)) >>");
    assert_eq!(code(&up(&db, &tok, "proof_of_address", "single", Some(&days_ago(10)), evil).await.unwrap_err()), "unsafe_pdf");
    assert_eq!(code(&up(&db, &tok, "party_id", "front", None, jpeg(1600, 1000, 1)).await.unwrap_err()), "field:kind");

    let Json(r) = up(&db, &tok, "id_document", "front", None, jpeg(1600, 1000, 1)).await.unwrap();
    assert_eq!(r["document"]["width"], 1600);
    assert_eq!(r["document"]["checks"]["format"]["detected"], "image/jpeg");
    assert_eq!(r["document"]["checks"]["client"]["blur"]["ok"], true);
    assert!(r["document"].get("sha256").is_none(), "clients never see hashes or file refs");
    // the same file can't be used for two documents
    assert_eq!(code(&up(&db, &tok, "id_document", "back", None, jpeg(1600, 1000, 1)).await.unwrap_err()), "same_file");

    // the file on disk is encrypted and decrypts to the upload
    let fref: String = sqlx::query_scalar("SELECT file_ref FROM kyc_documents WHERE case_id = $1 AND kind = 'id_document'").bind(case_id).fetch_one(&db.st.pool).await.unwrap();
    let raw = std::fs::read(store::path_for(&settings().dir, 1, &fref).unwrap()).unwrap();
    assert!(raw.starts_with(b"KKYC1"));
    assert_eq!(store::read(&settings().dir, settings().key.as_ref().unwrap(), 1, &fref).unwrap(), jpeg(1600, 1000, 1));

    // submit needs everything
    let e = submit(st(), ctx(&tok), Ok(Json(SubmitReq { confirm: true }))).await.unwrap_err();
    assert_eq!(code(&e), "incomplete");
    up(&db, &tok, "id_document", "back", None, jpeg(1600, 1000, 2)).await.unwrap();
    up(&db, &tok, "proof_of_address", "single", Some(&days_ago(20)), pdf(4)).await.unwrap();
    up(&db, &tok, "selfie", "single", None, jpeg(1080, 1080, 3)).await.unwrap();
    assert_eq!(code(&submit(st(), ctx(&tok), Ok(Json(SubmitReq { confirm: false }))).await.unwrap_err()), "field:confirm");
    let Json(v) = submit(st(), ctx(&tok), Ok(Json(SubmitReq { confirm: true }))).await.unwrap();
    assert_eq!(v["case"]["status"], "submitted");
    assert_eq!(v["kyc_status"], "pending");
    assert_eq!(kyc_status(&db, uid).await, "pending");
    assert_eq!(v["timeline"].as_array().unwrap().last().unwrap()["kind"], "submitted");
    // locked while with the team
    assert_eq!(code(&up(&db, &tok, "selfie", "single", None, jpeg(1080, 1080, 9)).await.unwrap_err()), "not_editable");

    // staff: permissions
    let (_, support) = staff(&db, "support").await;
    let (rid, officer) = staff(&db, "compliance").await;
    assert_eq!(code(&staff::queue(st(), ctx(&support), Ok(Query(staff::QueueQuery::default()))).await.unwrap_err()), "forbidden");
    let Json(qv) = staff::queue(st(), ctx(&officer), Ok(Query(staff::QueueQuery::default()))).await.unwrap();
    assert_eq!(qv["total"], 1);
    assert_eq!(qv["items"][0]["reference"], reference(case_id));
    assert_eq!(qv["items"][0]["sla"]["breached"], false);
    assert_eq!(qv["counts"]["submitted"], 1);

    // claim -> in review (client sees it)
    staff::claim(st(), ctx(&officer), Path(case_id), Ok(Json(staff::ClaimReq::default()))).await.unwrap();
    let Json(v) = get(st(), ctx(&tok)).await.unwrap();
    assert_eq!(v["case"]["status"], "in_review");

    // case detail: documents with checks, file streaming
    let Json(d) = staff::case_detail(st(), ctx(&officer), Path(case_id)).await.unwrap();
    assert_eq!(d["documents"].as_array().unwrap().len(), 4);
    assert_eq!(d["case"]["reviewer"]["id"], rid);
    let doc_id = d["documents"][0]["id"].as_i64().unwrap();
    assert_eq!(code(&staff::file(st(), ctx(&support), Path(doc_id)).await.unwrap_err()), "forbidden");
    let res = staff::file(st(), ctx(&officer), Path(doc_id)).await.unwrap();
    assert_eq!(res.headers()["content-type"], "image/jpeg");
    assert!(res.headers()["cache-control"].to_str().unwrap().contains("no-store"));
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
    assert_eq!(bytes.as_ref(), jpeg(1600, 1000, 1).as_slice());

    // request more info: only the proof of address
    let e = staff::request_info(st(), ctx(&officer), Path(case_id), Ok(Json(staff::RequestInfoReq { items: vec![Slot::new("party_id", "front", Some("p1"))], message: None }))).await.unwrap_err();
    assert_eq!(code(&e), "field:items");
    staff::request_info(
        st(),
        ctx(&officer),
        Path(case_id),
        Ok(Json(staff::RequestInfoReq { items: vec![Slot::new("proof_of_address", "single", None)], message: Some("The statement must show your full name.".into()) })),
    )
    .await
    .unwrap();
    let Json(v) = get(st(), ctx(&tok)).await.unwrap();
    assert_eq!(v["case"]["status"], "more_info");
    assert_eq!(v["case"]["requested_labels"][0], "Proof of address");
    assert_eq!(v["kyc_status"], "pending");
    // only the requested document can be replaced
    assert_eq!(code(&up(&db, &tok, "selfie", "single", None, jpeg(1080, 1080, 10)).await.unwrap_err()), "not_requested");
    assert_eq!(code(&submit(st(), ctx(&tok), Ok(Json(SubmitReq { confirm: true }))).await.unwrap_err()), "incomplete");
    up(&db, &tok, "proof_of_address", "single", Some(&days_ago(5)), pdf(11)).await.unwrap();
    let Json(v) = submit(st(), ctx(&tok), Ok(Json(SubmitReq { confirm: true }))).await.unwrap();
    assert_eq!(v["case"]["status"], "submitted");
    assert_eq!(v["case"]["submissions"], 2);
    assert_eq!(v["timeline"].as_array().unwrap().last().unwrap()["kind"], "resubmitted");

    // approve: checklist required, then verified + identity locked
    let e = staff::approve(st(), ctx(&officer), Path(case_id), Ok(Json(staff::ApproveReq::default()))).await.unwrap_err();
    assert_eq!(code(&e), "field:checklist");
    let checklist = staff::checklist_keys("individual").iter().map(|(k, _)| (k.to_string(), Value::Bool(true))).collect();
    staff::approve(st(), ctx(&officer), Path(case_id), Ok(Json(staff::ApproveReq { checklist, risk_level: Some("low".into()), note: Some("All clear.".into()) }))).await.unwrap();
    assert_eq!(kyc_status(&db, uid).await, "verified");
    let Json(v) = get(st(), ctx(&tok)).await.unwrap();
    assert_eq!(v["case"]["status"], "approved");
    assert_eq!(v["identity_locked"], true);
    assert_eq!(v["can_start"], false);
    let me = crate::client_auth::user_json(&db.st, uid).await.unwrap();
    assert_eq!(me["kyc_status"], "verified");
    assert_eq!(me["kyc_case_status"], "approved");
    assert_eq!(me["identity_locked"], true);
    // D92: the database refuses name / date-of-birth changes now
    assert!(sqlx::query("UPDATE users SET first_name = 'Someone' WHERE id = $1").bind(uid).execute(&db.st.pool).await.is_err());
    assert!(sqlx::query("UPDATE users SET date_of_birth = '1991-01-01' WHERE id = $1").bind(uid).execute(&db.st.pool).await.is_err());
    sqlx::query("UPDATE users SET phone = '509999999' WHERE id = $1").bind(uid).execute(&db.st.pool).await.unwrap();
    assert_eq!(code(&start(st(), ctx(&tok), Ok(Json(StartReq { kind: "individual".into() }))).await.unwrap_err()), "already_verified");

    // audit trail
    for action in ["kyc.started", "kyc.document_uploaded", "kyc.submitted", "kyc.review_started", "kyc.more_info_requested", "kyc.resubmitted", "kyc.approved", "kyc.document_viewed"] {
        let n: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = $1 AND (target_id = $2)").bind(action).bind(uid).fetch_one(&db.st.pool).await.unwrap();
        assert!(n >= 1, "{action} audited");
    }
    let n = erase_user(&db.st.pool, uid).await.unwrap();
    assert!(n >= 5);
    assert!(!store::path_for(&settings().dir, 1, &fref).unwrap().exists());
    db.drop_db().await;
}

#[tokio::test]
async fn reject_resubmit_and_duplicates() {
    let Some(db) = TestDb::new("kyc-reject").await else { return };
    let st = || State(db.st.clone());
    let a = user(&db, "kyc.a@example.com", "Omar").await;
    let b = user(&db, "kyc.b@example.com", "Lena").await;
    let (ta, tb) = (session(&db, a).await, session(&db, b).await);
    let (_, officer) = staff(&db, "compliance").await;

    for (tok, seed) in [(&ta, 40u8), (&tb, 50u8)] {
        start(st(), ctx(tok), Ok(Json(StartReq { kind: "individual".into() }))).await.unwrap();
        details(st(), ctx(tok), Ok(Json(DetailsReq { id_doc_type: Some("passport".into()), address: Some(addr()), ..Default::default() }))).await.unwrap();
        up(&db, tok, "id_document", "front", None, jpeg(1600, 1100, seed)).await.unwrap();
        up(&db, tok, "proof_of_address", "single", Some(&days_ago(3)), pdf(seed)).await.unwrap();
    }
    // client B uploads client A's exact selfie file: flagged for staff, invisible to the client
    up(&db, &ta, "selfie", "single", None, jpeg(900, 900, 77)).await.unwrap();
    let Json(r) = up(&db, &tb, "selfie", "single", None, jpeg(900, 900, 77)).await.unwrap();
    assert!(r["document"]["checks"].get("duplicate_other_clients").is_none());
    let dup: i64 = sqlx::query_scalar("SELECT (checks->'server'->>'duplicate_other_clients')::bigint FROM kyc_documents WHERE user_id = $1 AND kind = 'selfie'").bind(b).fetch_one(&db.st.pool).await.unwrap();
    assert_eq!(dup, 1);
    submit(st(), ctx(&tb), Ok(Json(SubmitReq { confirm: true }))).await.unwrap();
    let case_b: i64 = sqlx::query_scalar("SELECT id FROM kyc_cases WHERE user_id = $1").bind(b).fetch_one(&db.st.pool).await.unwrap();
    let Json(d) = staff::case_detail(st(), ctx(&officer), Path(case_b)).await.unwrap();
    assert_eq!(d["flags"]["duplicate_documents"][0]["user_id"], a);

    // reject: "other" needs a message; a known reason emails the client and sets rejected
    let e = staff::reject(st(), ctx(&officer), Path(case_b), Ok(Json(staff::RejectReq { reason_code: "other".into(), message: None, allow_resubmit: true }))).await.unwrap_err();
    assert_eq!(code(&e), "field:message");
    let e = staff::reject(st(), ctx(&officer), Path(case_b), Ok(Json(staff::RejectReq { reason_code: "nope".into(), message: None, allow_resubmit: true }))).await.unwrap_err();
    assert_eq!(code(&e), "field:reason_code");
    staff::reject(st(), ctx(&officer), Path(case_b), Ok(Json(staff::RejectReq { reason_code: "selfie_mismatch".into(), message: Some("Please take a new selfie in good light.".into()), allow_resubmit: true })))
        .await
        .unwrap();
    assert_eq!(kyc_status(&db, b).await, "rejected");
    let Json(v) = get(st(), ctx(&tb)).await.unwrap();
    assert_eq!(v["case"]["status"], "rejected");
    assert_eq!(v["case"]["decision"]["code"], "selfie_mismatch");
    assert_eq!(v["can_start"], true);
    // decided cases can't be decided again
    let checklist = staff::checklist_keys("individual").iter().map(|(k, _)| (k.to_string(), Value::Bool(true))).collect();
    assert_eq!(code(&staff::approve(st(), ctx(&officer), Path(case_b), Ok(Json(staff::ApproveReq { checklist, ..Default::default() }))).await.unwrap_err()), "invalid_state");
    // start again: a new draft
    let Json(v) = start(st(), ctx(&tb), Ok(Json(StartReq { kind: "individual".into() }))).await.unwrap();
    assert_eq!(v["case"]["status"], "draft");
    assert_ne!(v["case"]["id"].as_i64().unwrap(), case_b);
    assert_eq!(v["history"].as_array().unwrap().len(), 2);

    // other tenants' staff see nothing
    let t2: i64 = sqlx::query_scalar("INSERT INTO tenants (slug, name) VALUES ('other', 'Other') RETURNING id").fetch_one(&db.st.pool).await.unwrap();
    let s2: i64 = sqlx::query_scalar("INSERT INTO staff (tenant_id, email, password_hash, name, role) VALUES ($1,'o@example.com','x','O','compliance') RETURNING id").bind(t2).fetch_one(&db.st.pool).await.unwrap();
    let t2tok = identity::create_session(&db.st, &ctx("x"), Kind::Staff, t2, s2).await.unwrap().token;
    assert_eq!(code(&staff::case_detail(st(), ctx(&t2tok), Path(case_b)).await.unwrap_err()), "not_found");

    for u in [a, b] {
        erase_user(&db.st.pool, u).await.unwrap();
    }
    db.drop_db().await;
}

#[tokio::test]
async fn corporate_details_and_requirements() {
    let Some(db) = TestDb::new("kyc-corp").await else { return };
    let st = || State(db.st.clone());
    let uid = user(&db, "kyc.corp@example.com", "Ana").await;
    let tok = session(&db, uid).await;
    start(st(), ctx(&tok), Ok(Json(StartReq { kind: "corporate".into() }))).await.unwrap();
    let company = Company { name: "Sample Trading FZE".into(), reg_number: "FZE-2024-118".into(), country: "ae".into(), incorporated_on: "2021-03-04".into(), business: "Proprietary trading".into(), address: addr() };
    let director = Party { first_name: "Ana".into(), last_name: "Ruiz".into(), date_of_birth: "1985-02-01".into(), nationality: "es".into(), roles: vec!["director".into(), "ubo".into()], ownership: Some(60.0), id_type: "passport".into(), ..Default::default() };
    let owner = Party { first_name: "Omar".into(), last_name: "Haddad".into(), date_of_birth: "1979-11-30".into(), nationality: "ae".into(), roles: vec!["ubo".into()], ownership: Some(10.0), id_type: "national_id".into(), ..Default::default() };
    // a UBO below 25% is not a UBO
    let e = details(st(), ctx(&tok), Ok(Json(DetailsReq { company: Some(company.clone()), parties: Some(vec![director.clone(), owner.clone()]), ..Default::default() }))).await.unwrap_err();
    assert_eq!(code(&e), "field:parties");
    let owner = Party { ownership: Some(40.0), ..owner };
    let Json(v) = details(st(), ctx(&tok), Ok(Json(DetailsReq { company: Some(company), parties: Some(vec![director, owner]), ..Default::default() }))).await.unwrap();
    assert_eq!(v["case"]["details"]["parties"][1]["key"], "p2");
    let labels: Vec<String> = v["required"].as_array().unwrap().iter().map(|r| r["label"].as_str().unwrap().to_string()).collect();
    assert_eq!(labels, vec!["Certificate of incorporation", "Company proof of address", "Ana Ruiz: Passport photo page", "Omar Haddad: National ID card (front)", "Omar Haddad: National ID card (back)", "Selfie"]);
    // party documents are addressed by party key
    let r = upload(State(db.st.clone()), ctx(&tok), Ok(Query(UploadQuery { kind: Some("party_id".into()), side: Some("front".into()), party: Some("p2".into()), ..Default::default() })), hdrs("image/jpeg"), Bytes::from(jpeg(1400, 900, 5))).await.unwrap();
    assert_eq!(r.0["document"]["doc_type"], "national_id");
    let e = upload(State(db.st.clone()), ctx(&tok), Ok(Query(UploadQuery { kind: Some("party_id".into()), side: Some("front".into()), party: Some("p9".into()), ..Default::default() })), hdrs("image/jpeg"), Bytes::from(jpeg(1400, 900, 6))).await.unwrap_err();
    assert_eq!(code(&e), "field:kind");
    erase_user(&db.st.pool, uid).await.unwrap();
    db.drop_db().await;
}
