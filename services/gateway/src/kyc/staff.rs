//! Back Office KYC review: /v1/admin/kyc/*  (staff session + `kyc.read` / `kyc.review`)
//!
//!   GET  /v1/admin/kyc/cases?status&kind&q&user&page&per_page   queue (open cases oldest first = closest to SLA), counts
//!   GET  /v1/admin/kyc/cases/{id}                              case, client, documents + checks, duplicates, timeline, notes
//!   POST /v1/admin/kyc/cases/{id}/claim     {force?}           submitted -> in_review (reviewer = me)
//!   POST /v1/admin/kyc/cases/{id}/approve   {checklist, risk_level?, note?}
//!   POST /v1/admin/kyc/cases/{id}/reject    {reason_code, message?, allow_resubmit?}
//!   POST /v1/admin/kyc/cases/{id}/request-info {items: [{kind, side, party}], message?}
//!   POST /v1/admin/kyc/cases/{id}/notes     {body?, risk_level?, risk_notes?}
//!   GET  /v1/admin/kyc/documents/{id}/file                     decrypted file, streamed to staff only (never a public URL)
//!
//! Every action is written to the audit log (target = the client) and the client is emailed on each decision.

use axum::Json;
use axum::body::Body;
use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{Path, Query, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{
    CASE_COLS, CaseRow, DocRow, OPEN, REASONS, STATUSES, Slot, case_row, documents, event, events, missing, notify, reason_label, reference, requirements,
    required_slots, settings, sla, slot_label, sniff, store, typical_hours,
};
use crate::admin::{Perm, Staff, like_pattern, paging, require};
use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::error::{ApiError, ApiResult};
use crate::mailer::KycMail;
use crate::state::{AppState, Ctx};

fn q_err(_: QueryRejection) -> ApiError {
    ApiError::BadRequest("Invalid query parameters.")
}

fn conflict(message: &'static str) -> ApiError {
    ApiError::Coded { status: StatusCode::CONFLICT, code: "invalid_state", message }
}

/// Review checklist the approver must confirm, per case kind.
pub fn checklist_keys(kind: &str) -> &'static [(&'static str, &'static str)] {
    if kind == "corporate" {
        &[
            ("company_registered", "Company is registered and active (registry check)"),
            ("directors_verified", "Every director's ID is valid and matches the details"),
            ("ubos_identified", "All owners with 25% or more are identified"),
            ("company_address_valid", "Company proof of address is under 3 months old"),
            ("applicant_match", "Selfie matches a listed director"),
            ("sanctions_clear", "No sanctions / PEP / adverse media hits"),
        ]
    } else {
        &[
            ("id_valid", "ID is genuine, in colour and not expired"),
            ("name_dob_match", "Name and date of birth match the profile"),
            ("photo_match", "Selfie matches the ID photo"),
            ("poa_valid", "Proof of address shows the name and is under 3 months old"),
            ("sanctions_clear", "No sanctions / PEP / adverse media hits"),
        ]
    }
}

async fn load(st: &AppState, me: &Staff, id: i64) -> ApiResult<CaseRow> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {CASE_COLS} FROM kyc_cases c WHERE c.id = $1 AND c.tenant_id = $2")))
        .bind(id)
        .bind(me.tenant_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(case_row(&r))
}

// ---------- GET /v1/admin/kyc/cases ----------

#[derive(Deserialize, Default)]
pub struct QueueQuery {
    pub status: Option<String>,
    pub kind: Option<String>,
    pub q: Option<String>,
    pub user: Option<i64>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

fn status_filter(raw: Option<&str>) -> Result<Option<Vec<String>>, ApiError> {
    let v = |xs: &[&str]| Some(xs.iter().map(|s| s.to_string()).collect());
    Ok(match raw.map(str::trim).unwrap_or("queue") {
        "" | "queue" => v(&["submitted", "in_review"]),
        "open" => v(&["submitted", "in_review", "more_info"]),
        "decided" => v(&["approved", "rejected"]),
        "all" => None,
        s if STATUSES.contains(&s) => v(&[s]),
        _ => return Err(ApiError::BadRequest("Unknown status filter.")),
    })
}

pub async fn queue(State(st): State<AppState>, ctx: Ctx, q: Result<Query<QueueQuery>, QueryRejection>) -> ApiResult<Json<Value>> {
    let Query(q) = q.map_err(q_err)?;
    let me = require(&st, &ctx, Perm::KycRead).await?;
    let (page, per, offset) = paging(q.page, q.per_page, 25, 200);
    // a client's own history (client profile) lists every case
    let statuses = if q.user.is_some() && q.status.is_none() { None } else { status_filter(q.status.as_deref())? };
    let kind = q.kind.as_deref().map(str::trim).filter(|k| !k.is_empty() && *k != "all");
    if let Some(k) = kind
        && k != "individual"
        && k != "corporate"
    {
        return Err(ApiError::BadRequest("kind must be individual or corporate."));
    }
    let term = q.q.as_deref().map(str::trim).filter(|t| !t.is_empty());
    let pat = term.and_then(like_pattern);
    let id_eq = term.and_then(|t| t.trim_start_matches(['#']).trim_start_matches("KYC-").trim_start_matches("kyc-").parse::<i64>().ok());
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {CASE_COLS}, u.email, u.first_name, u.last_name, u.country, u.date_of_birth, u.kyc_status AS user_kyc, s.name AS reviewer_name,
                (SELECT count(*) FROM kyc_documents d WHERE d.case_id = c.id AND d.status IN ('uploaded','accepted')) AS docs,
                (SELECT count(*) FROM kyc_documents d WHERE d.case_id = c.id AND d.status IN ('uploaded','accepted')
                   AND COALESCE((d.checks->'server'->>'duplicate_other_clients')::int, 0) > 0) AS dup_docs,
                count(*) OVER () AS total
         FROM kyc_cases c JOIN users u ON u.id = c.user_id LEFT JOIN staff s ON s.id = c.reviewer_id
         WHERE c.tenant_id = $1
           AND ($2::text[] IS NULL OR c.status = ANY($2))
           AND ($3::text IS NULL OR c.kind = $3)
           AND ($4::text IS NULL OR u.email ILIKE $4 OR (u.first_name || ' ' || u.last_name) ILIKE $4 OR c.id = $5 OR u.id = $5)
           AND ($6::bigint IS NULL OR c.user_id = $6)
         ORDER BY CASE WHEN c.status IN ('submitted','in_review') THEN 0 WHEN c.status = 'more_info' THEN 1 WHEN c.status = 'draft' THEN 3 ELSE 2 END,
                  CASE WHEN c.status IN ('submitted','in_review','more_info') THEN c.submitted_at END ASC NULLS LAST,
                  c.decided_at DESC NULLS LAST, c.id DESC
         LIMIT $7 OFFSET $8"
    )))
    .bind(me.tenant_id)
    .bind(statuses)
    .bind(kind)
    .bind(pat)
    .bind(id_eq)
    .bind(q.user)
    .bind(per)
    .bind(offset)
    .fetch_all(&st.pool)
    .await?;
    let now = Utc::now();
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let items = rows
        .iter()
        .map(|r| {
            let c = case_row(r);
            let (first, last): (String, String) = (r.get("first_name"), r.get("last_name"));
            let open = OPEN.contains(&c.status.as_str()) && c.status != "draft";
            json!({
                "id": c.id,
                "reference": reference(c.id),
                "kind": c.kind,
                "status": c.status,
                "level": c.level,
                "id_doc_type": c.id_doc_type,
                "company": c.details.company.as_ref().map(|co| co.name.clone()),
                "user": {
                    "id": c.user_id,
                    "name": format!("{first} {last}"),
                    "email": r.get::<String, _>("email"),
                    "country": r.get::<String, _>("country").trim().to_lowercase(),
                    "date_of_birth": r.get::<NaiveDate, _>("date_of_birth"),
                    "kyc_status": r.get::<String, _>("user_kyc"),
                },
                "reviewer": c.reviewer_id.map(|id| json!({ "id": id, "name": r.get::<Option<String>, _>("reviewer_name") })),
                "documents": r.get::<i64, _>("docs"),
                "flags": { "duplicate_documents": r.get::<i64, _>("dup_docs") },
                "submissions": c.submissions,
                "risk_level": c.risk_level,
                "decision": c.decision_code.as_deref().map(|code| json!({ "code": code, "label": reason_label(code) })),
                "submitted_at": c.submitted_at,
                "first_submitted_at": c.first_submitted_at,
                "decided_at": c.decided_at,
                "created_at": c.created_at,
                "sla": if open { sla(c.submitted_at, now) } else { Value::Null },
            })
        })
        .collect::<Vec<_>>();
    let counts = sqlx::query(
        "SELECT count(*) FILTER (WHERE status = 'submitted') AS submitted,
                count(*) FILTER (WHERE status = 'in_review') AS in_review,
                count(*) FILTER (WHERE status = 'more_info') AS more_info,
                count(*) FILTER (WHERE status = 'draft') AS draft,
                count(*) FILTER (WHERE status = 'approved' AND decided_at > now() - interval '7 days') AS approved_7d,
                count(*) FILTER (WHERE status = 'rejected' AND decided_at > now() - interval '7 days') AS rejected_7d,
                count(*) FILTER (WHERE status IN ('submitted','in_review') AND submitted_at < now() - make_interval(hours => $2::int)) AS breached
         FROM kyc_cases WHERE tenant_id = $1",
    )
    .bind(me.tenant_id)
    .bind(settings().sla_hours as i32)
    .fetch_one(&st.pool)
    .await?;
    let n = |k: &str| counts.get::<i64, _>(k);
    Ok(Json(json!({
        "items": items,
        "total": total,
        "page": page,
        "per_page": per,
        "counts": {
            "submitted": n("submitted"), "in_review": n("in_review"), "more_info": n("more_info"), "draft": n("draft"),
            "approved_7d": n("approved_7d"), "rejected_7d": n("rejected_7d"), "breached": n("breached"),
        },
        "sla_hours": settings().sla_hours,
        "typical_hours": typical_hours(&st, me.tenant_id).await?,
        "can_review": crate::admin::role_allows(&me.role, Perm::KycReview),
    })))
}

// ---------- GET /v1/admin/kyc/cases/{id} ----------

fn staff_doc(d: &DocRow, dups: &[Value], c: &CaseRow) -> Value {
    json!({
        "id": d.id,
        "kind": d.kind,
        "side": d.side,
        "party": d.party,
        "label": slot_label(&d.slot(), c.id_doc_type.as_deref(), &c.details),
        "doc_type": d.doc_type,
        "sha256": d.sha256,
        "mime": d.mime,
        "size_bytes": d.size_bytes,
        "width": d.width,
        "height": d.height,
        "original_name": d.original_name,
        "issue_date": d.issue_date,
        "checks": d.checks,
        "status": d.status,
        "current": d.current(),
        "created_at": d.created_at,
        "viewable": sniff::is_image(&d.mime) && d.mime != sniff::HEIC,
        "duplicates": dups.iter().filter(|x| x["sha256"] == d.sha256).cloned().collect::<Vec<_>>(),
    })
}

pub async fn case_detail(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let me = require(&st, &ctx, Perm::KycRead).await?;
    let c = load(&st, &me, id).await?;
    let u = sqlx::query(
        "SELECT id, email, first_name, last_name, date_of_birth, country, phone_dial, phone, kyc_status, status, created_at,
                email_verified_at IS NOT NULL AS email_verified, identity_locked_at
         FROM users WHERE id = $1",
    )
    .bind(c.user_id)
    .fetch_one(&st.pool)
    .await?;
    let docs = documents(&st, c.id).await?;
    let shas: Vec<String> = docs.iter().map(|d| d.sha256.clone()).collect();
    let dups = sqlx::query(
        "SELECT DISTINCT d.sha256, d.user_id, u.first_name || ' ' || u.last_name AS name, u.email
         FROM kyc_documents d JOIN users u ON u.id = d.user_id
         WHERE d.tenant_id = $1 AND d.sha256 = ANY($2) AND d.user_id <> $3 LIMIT 50",
    )
    .bind(me.tenant_id)
    .bind(&shas)
    .bind(c.user_id)
    .fetch_all(&st.pool)
    .await?
    .iter()
    .map(|r| json!({ "sha256": r.get::<String, _>("sha256"), "user_id": r.get::<i64, _>("user_id"), "name": r.get::<String, _>("name"), "email": r.get::<String, _>("email") }))
    .collect::<Vec<_>>();
    let (first, last, dob): (String, String, NaiveDate) = (u.get("first_name"), u.get("last_name"), u.get("date_of_birth"));
    let same_identity = sqlx::query(
        "SELECT id, email, kyc_status FROM users WHERE tenant_id = $1 AND id <> $2 AND lower(first_name) = lower($3) AND lower(last_name) = lower($4) AND date_of_birth = $5 LIMIT 10",
    )
    .bind(me.tenant_id)
    .bind(c.user_id)
    .bind(&first)
    .bind(&last)
    .bind(dob)
    .fetch_all(&st.pool)
    .await?
    .iter()
    .map(|r| json!({ "id": r.get::<i64, _>("id"), "email": r.get::<String, _>("email"), "kyc_status": r.get::<String, _>("kyc_status") }))
    .collect::<Vec<_>>();
    let notes = sqlx::query("SELECT n.id, n.body, n.created_at, s.id AS staff_id, s.name FROM kyc_notes n JOIN staff s ON s.id = n.staff_id WHERE n.case_id = $1 ORDER BY n.id DESC")
        .bind(c.id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| json!({ "id": r.get::<i64, _>("id"), "body": r.get::<String, _>("body"), "at": r.get::<DateTime<Utc>, _>("created_at"), "staff": { "id": r.get::<i64, _>("staff_id"), "name": r.get::<String, _>("name") } }))
        .collect::<Vec<_>>();
    let history = sqlx::query("SELECT id, kind, status, decision_code, submitted_at, decided_at, created_at FROM kyc_cases WHERE user_id = $1 AND id <> $2 ORDER BY id DESC LIMIT 20")
        .bind(c.user_id)
        .bind(c.id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| {
            let code: Option<String> = r.get("decision_code");
            json!({
                "id": r.get::<i64, _>("id"), "reference": reference(r.get("id")), "kind": r.get::<String, _>("kind"), "status": r.get::<String, _>("status"),
                "decision_label": code.as_deref().and_then(reason_label), "submitted_at": r.get::<Option<DateTime<Utc>>, _>("submitted_at"),
                "decided_at": r.get::<Option<DateTime<Utc>>, _>("decided_at"), "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect::<Vec<_>>();
    let reviewer: Option<String> = match c.reviewer_id {
        Some(rid) => sqlx::query_scalar("SELECT name FROM staff WHERE id = $1").bind(rid).fetch_optional(&st.pool).await?,
        None => None,
    };
    let open = matches!(c.status.as_str(), "submitted" | "in_review" | "more_info");
    Ok(Json(json!({
        "case": {
            "id": c.id,
            "reference": reference(c.id),
            "kind": c.kind,
            "status": c.status,
            "level": c.level,
            "id_doc_type": c.id_doc_type,
            "details": c.details_raw,
            "requested": c.requested,
            "requested_labels": c.requested.iter().map(|s| slot_label(s, c.id_doc_type.as_deref(), &c.details)).collect::<Vec<_>>(),
            "request_message": c.request_message,
            "decision": c.decision_code.as_deref().map(|code| json!({ "code": code, "label": reason_label(code), "message": c.decision_message })),
            "allow_resubmit": c.allow_resubmit,
            "risk_level": c.risk_level,
            "risk_notes": c.risk_notes,
            "checklist": c.checklist,
            "reviewer": c.reviewer_id.map(|id| json!({ "id": id, "name": reviewer, "is_me": id == me.id })),
            "submissions": c.submissions,
            "first_submitted_at": c.first_submitted_at,
            "submitted_at": c.submitted_at,
            "review_started_at": c.review_started_at,
            "decided_at": c.decided_at,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "sla": if open && c.status != "more_info" { sla(c.submitted_at, Utc::now()) } else { Value::Null },
        },
        "user": {
            "id": u.get::<i64, _>("id"),
            "email": u.get::<String, _>("email"),
            "first_name": first,
            "last_name": last,
            "name": format!("{} {}", u.get::<String, _>("first_name"), u.get::<String, _>("last_name")),
            "date_of_birth": dob,
            "country": u.get::<String, _>("country").trim().to_lowercase(),
            "phone": format!("{} {}", u.get::<String, _>("phone_dial"), u.get::<String, _>("phone")),
            "kyc_status": u.get::<String, _>("kyc_status"),
            "status": u.get::<String, _>("status"),
            "email_verified": u.get::<bool, _>("email_verified"),
            "identity_locked_at": u.get::<Option<DateTime<Utc>>, _>("identity_locked_at"),
            "created_at": u.get::<DateTime<Utc>, _>("created_at"),
        },
        "documents": docs.iter().filter(|d| d.status != "superseded").map(|d| staff_doc(d, &dups, &c)).collect::<Vec<_>>(),
        "superseded": docs.iter().filter(|d| d.status == "superseded").map(|d| staff_doc(d, &dups, &c)).collect::<Vec<_>>(),
        "required": requirements(&c, &docs),
        "missing": missing(&c, &docs).map(|(f, m)| json!({ "field": f, "message": m })),
        "flags": { "duplicate_documents": dups, "same_identity": same_identity },
        "timeline": events(&st, c.id).await?,
        "notes": notes,
        "history": history,
        "checklist": checklist_keys(&c.kind).iter().map(|(k, l)| json!({ "key": k, "label": l })).collect::<Vec<_>>(),
        "reasons": REASONS.iter().map(|(c, l)| json!({ "code": c, "label": l })).collect::<Vec<_>>(),
        "can_review": crate::admin::role_allows(&me.role, Perm::KycReview),
    })))
}

// ---------- POST claim ----------

#[derive(Deserialize, Default)]
pub struct ClaimReq {
    #[serde(default)]
    pub force: bool,
}

pub async fn claim(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<ClaimReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let force = req.map(|Json(r)| r.force).unwrap_or(false);
    let me = require(&st, &ctx, Perm::KycReview).await?;
    let c = load(&st, &me, id).await?;
    match c.status.as_str() {
        "submitted" => {}
        "in_review" if c.reviewer_id == Some(me.id) => return Ok(Json(json!({ "status": "ok", "already": true }))),
        "in_review" if force => {}
        "in_review" => return Ok(Json(json!({ "status": "ok", "already": true, "reviewer_id": c.reviewer_id }))),
        _ => return Err(conflict("Only submitted cases can be taken for review.")),
    }
    sqlx::query("UPDATE kyc_cases SET status = 'in_review', reviewer_id = $2, review_started_at = COALESCE(review_started_at, now()), updated_at = now() WHERE id = $1")
        .bind(c.id)
        .bind(me.id)
        .execute(&st.pool)
        .await?;
    if c.status == "submitted" {
        event(&st, c.id, "review_started", ("staff", Some(me.id)), json!({})).await?;
    }
    audit::record(&st.pool, &ctx, Entry { tenant_id: me.tenant_id, actor_kind: "staff", actor_id: Some(me.id), action: "kyc.review_started", target: Some(("user", c.user_id)), meta: json!({ "case_id": c.id, "took_over_from": if force { c.reviewer_id } else { None } }) }).await;
    Ok(Json(json!({ "status": "ok" })))
}

// ---------- POST approve ----------

#[derive(Deserialize, Default)]
pub struct ApproveReq {
    #[serde(default)]
    pub checklist: serde_json::Map<String, Value>,
    #[serde(default)]
    pub risk_level: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

fn risk(raw: Option<&str>) -> ApiResult<Option<String>> {
    match raw.map(str::trim).filter(|r| !r.is_empty()) {
        None => Ok(None),
        Some(r @ ("low" | "medium" | "high")) => Ok(Some(r.to_string())),
        Some(_) => Err(ApiError::Validation { field: "risk_level", message: "Risk must be low, medium or high." }),
    }
}

fn note_text(raw: Option<&str>, max: usize) -> Option<String> {
    raw.map(str::trim).filter(|s| !s.is_empty()).map(|s| s.chars().take(max).collect())
}

pub async fn approve(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<ApproveReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require(&st, &ctx, Perm::KycReview).await?;
    let c = load(&st, &me, id).await?;
    if !matches!(c.status.as_str(), "submitted" | "in_review") {
        return Err(conflict("Only submitted cases can be approved."));
    }
    let keys = checklist_keys(&c.kind);
    if let Some((_, label)) = keys.iter().find(|(k, _)| r.checklist.get(*k) != Some(&Value::Bool(true))) {
        let _ = label;
        return Err(ApiError::Validation { field: "checklist", message: "Confirm every item of the review checklist before approving." });
    }
    let docs = documents(&st, c.id).await?;
    if missing(&c, &docs).is_some() {
        return Err(conflict("A required document is missing. Request more information instead."));
    }
    let risk_level = risk(r.risk_level.as_deref())?;
    let note = note_text(r.note.as_deref(), 2000);
    let checklist: serde_json::Map<String, Value> = keys.iter().map(|(k, _)| (k.to_string(), Value::Bool(true))).collect();

    let mut tx = st.pool.begin().await?;
    let n = sqlx::query(
        "UPDATE kyc_cases SET status = 'approved', level = 2, decided_at = now(), reviewer_id = $2, review_started_at = COALESCE(review_started_at, now()),
                checklist = $3, risk_level = COALESCE($4, risk_level), decision_code = NULL, decision_message = NULL, updated_at = now()
         WHERE id = $1 AND status IN ('submitted','in_review')",
    )
    .bind(c.id)
    .bind(me.id)
    .bind(sqlx::types::Json(Value::Object(checklist.clone())))
    .bind(risk_level.as_deref())
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(conflict("This case was decided in the meantime. Reload it."));
    }
    sqlx::query("UPDATE kyc_documents SET status = 'accepted' WHERE case_id = $1 AND status = 'uploaded'").bind(c.id).execute(&mut *tx).await?;
    // D92: name and date of birth are locked from now on (enforced by the users_identity_locked trigger)
    sqlx::query("UPDATE users SET kyc_status = 'verified', identity_locked_at = COALESCE(identity_locked_at, now()), updated_at = now() WHERE id = $1")
        .bind(c.user_id)
        .execute(&mut *tx)
        .await?;
    if let Some(n) = &note {
        sqlx::query("INSERT INTO kyc_notes (case_id, staff_id, body) VALUES ($1,$2,$3)").bind(c.id).bind(me.id).bind(n).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    event(&st, c.id, "approved", ("staff", Some(me.id)), json!({ "level": 2 })).await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "kyc.approved",
        target: Some(("user", c.user_id)),
        meta: json!({ "case_id": c.id, "kind": c.kind, "checklist": checklist, "risk_level": risk_level, "identity_locked": true }),
    })
    .await;
    notify(&st, c.user_id, KycMail::Approved { reference: reference(c.id) }).await;
    Ok(Json(json!({ "status": "ok", "kyc_status": "verified" })))
}

// ---------- POST reject ----------

#[derive(Deserialize, Default)]
pub struct RejectReq {
    #[serde(default)]
    pub reason_code: String,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default = "yes")]
    pub allow_resubmit: bool,
}

fn yes() -> bool {
    true
}

pub async fn reject(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<RejectReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require(&st, &ctx, Perm::KycReview).await?;
    let code = r.reason_code.trim();
    let label = reason_label(code).ok_or(ApiError::Validation { field: "reason_code", message: "Choose a reason." })?;
    let message = note_text(r.message.as_deref(), 1000);
    if code == "other" && message.as_deref().is_none_or(|m| m.chars().count() < 5) {
        return Err(ApiError::Validation { field: "message", message: "Explain the reason to the client." });
    }
    let c = load(&st, &me, id).await?;
    if !matches!(c.status.as_str(), "submitted" | "in_review" | "more_info") {
        return Err(conflict("Only open cases can be rejected."));
    }
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query(
        "UPDATE kyc_cases SET status = 'rejected', decided_at = now(), reviewer_id = $2, decision_code = $3, decision_message = $4, allow_resubmit = $5,
                requested = '[]'::jsonb, updated_at = now()
         WHERE id = $1 AND status IN ('submitted','in_review','more_info')",
    )
    .bind(c.id)
    .bind(me.id)
    .bind(code)
    .bind(message.as_deref())
    .bind(r.allow_resubmit)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(conflict("This case was decided in the meantime. Reload it."));
    }
    sqlx::query("UPDATE kyc_documents SET status = 'rejected' WHERE case_id = $1 AND status = 'uploaded'").bind(c.id).execute(&mut *tx).await?;
    sqlx::query("UPDATE users SET kyc_status = 'rejected', updated_at = now() WHERE id = $1 AND kyc_status <> 'verified'").bind(c.user_id).execute(&mut *tx).await?;
    tx.commit().await?;
    event(&st, c.id, "rejected", ("staff", Some(me.id)), json!({ "reason_code": code, "reason": label, "message": message, "allow_resubmit": r.allow_resubmit })).await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "kyc.rejected",
        target: Some(("user", c.user_id)),
        meta: json!({ "case_id": c.id, "reason_code": code, "message": message, "allow_resubmit": r.allow_resubmit }),
    })
    .await;
    notify(&st, c.user_id, KycMail::Rejected { reference: reference(c.id), reason: label.to_string(), message, can_resubmit: r.allow_resubmit }).await;
    Ok(Json(json!({ "status": "ok", "kyc_status": "rejected" })))
}

// ---------- POST request-info ----------

#[derive(Deserialize, Default)]
pub struct RequestInfoReq {
    #[serde(default)]
    pub items: Vec<Slot>,
    #[serde(default)]
    pub message: Option<String>,
}

pub async fn request_info(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<RequestInfoReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require(&st, &ctx, Perm::KycReview).await?;
    let c = load(&st, &me, id).await?;
    if !matches!(c.status.as_str(), "submitted" | "in_review") {
        return Err(conflict("Only submitted cases can be sent back to the client."));
    }
    let required = required_slots(&c.kind, c.id_doc_type.as_deref(), &c.details);
    let mut items: Vec<Slot> = Vec::new();
    for it in r.items {
        let s = Slot { kind: it.kind.trim().to_string(), side: if it.side.trim().is_empty() { "single".into() } else { it.side.trim().to_string() }, party: it.party.map(|p| p.trim().to_string()).filter(|p| !p.is_empty()) };
        if !required.contains(&s) {
            return Err(ApiError::Validation { field: "items", message: "Pick documents that belong to this case." });
        }
        if !items.contains(&s) {
            items.push(s);
        }
    }
    if items.is_empty() {
        return Err(ApiError::Validation { field: "items", message: "Choose at least one document the client must upload again." });
    }
    let message = note_text(r.message.as_deref(), 1000);
    let labels: Vec<String> = items.iter().map(|s| slot_label(s, c.id_doc_type.as_deref(), &c.details)).collect();

    let mut tx = st.pool.begin().await?;
    let n = sqlx::query(
        "UPDATE kyc_cases SET status = 'more_info', requested = $2, request_message = $3, reviewer_id = $4,
                review_started_at = COALESCE(review_started_at, now()), updated_at = now()
         WHERE id = $1 AND status IN ('submitted','in_review')",
    )
    .bind(c.id)
    .bind(sqlx::types::Json(serde_json::to_value(&items)?))
    .bind(message.as_deref())
    .bind(me.id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(conflict("This case was decided in the meantime. Reload it."));
    }
    // the requested documents no longer count: the client must upload new ones
    for s in &items {
        sqlx::query("UPDATE kyc_documents SET status = 'rejected' WHERE case_id = $1 AND kind = $2 AND side = $3 AND party IS NOT DISTINCT FROM $4 AND status IN ('uploaded','accepted')")
            .bind(c.id)
            .bind(&s.kind)
            .bind(&s.side)
            .bind(s.party.as_deref())
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    event(&st, c.id, "more_info_requested", ("staff", Some(me.id)), json!({ "items": items, "labels": labels, "message": message })).await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "kyc.more_info_requested",
        target: Some(("user", c.user_id)),
        meta: json!({ "case_id": c.id, "items": items, "message": message }),
    })
    .await;
    notify(&st, c.user_id, KycMail::MoreInfo { reference: reference(c.id), items: labels, message }).await;
    Ok(Json(json!({ "status": "ok", "kyc_status": "pending" })))
}

// ---------- POST notes ----------

#[derive(Deserialize, Default)]
pub struct NoteReq {
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub risk_level: Option<String>,
    #[serde(default)]
    pub risk_notes: Option<String>,
}

pub async fn note(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<NoteReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require(&st, &ctx, Perm::KycReview).await?;
    let c = load(&st, &me, id).await?;
    let text = note_text(r.body.as_deref(), 2000);
    let risk_level = risk(r.risk_level.as_deref())?;
    let risk_notes = r.risk_notes.as_deref().map(|s| s.trim().chars().take(2000).collect::<String>());
    if text.is_none() && risk_level.is_none() && risk_notes.is_none() {
        return Err(ApiError::Validation { field: "body", message: "Write a note." });
    }
    if let Some(t) = &text {
        sqlx::query("INSERT INTO kyc_notes (case_id, staff_id, body) VALUES ($1,$2,$3)").bind(c.id).bind(me.id).bind(t).execute(&st.pool).await?;
    }
    if risk_level.is_some() || risk_notes.is_some() {
        sqlx::query("UPDATE kyc_cases SET risk_level = COALESCE($2, risk_level), risk_notes = COALESCE($3, risk_notes), updated_at = now() WHERE id = $1")
            .bind(c.id)
            .bind(risk_level.as_deref())
            .bind(risk_notes.as_deref().filter(|s| !s.is_empty()))
            .execute(&st.pool)
            .await?;
    }
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "kyc.note_added",
        target: Some(("user", c.user_id)),
        meta: json!({ "case_id": c.id, "note": text, "risk_level": risk_level, "risk_notes": risk_notes }),
    })
    .await;
    Ok(Json(json!({ "status": "ok" })))
}

// ---------- GET document file ----------

/// Streams a decrypted document to an authorised staff member. The response is private and uncacheable, the
/// type comes from content sniffing at upload time, and every view is audited.
pub async fn file(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Response> {
    let me = require(&st, &ctx, Perm::KycRead).await?;
    crate::identity::limit(&st, format!("kyc-file:staff:{}", me.id), 900, 3600)?;
    let r = sqlx::query("SELECT d.case_id, d.user_id, d.file_ref, d.sha256, d.mime, d.kind, d.side FROM kyc_documents d WHERE d.id = $1 AND d.tenant_id = $2")
        .bind(id)
        .bind(me.tenant_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    let (file_ref, sha, mime): (String, String, String) = (r.get("file_ref"), r.get("sha256"), r.get("mime"));
    let s = settings();
    let key = s.key.clone().ok_or(ApiError::Coded { status: StatusCode::SERVICE_UNAVAILABLE, code: "kyc_unavailable", message: "Document storage is not configured." })?;
    let (dir, fref, tenant) = (s.dir.clone(), file_ref.clone(), me.tenant_id);
    let plain = tokio::task::spawn_blocking(move || store::read(&dir, &key, tenant, &fref)).await.map_err(anyhow::Error::from)?;
    let plain = match plain {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(document_id = id, error = %e, "kyc document could not be read");
            return Err(ApiError::Coded { status: StatusCode::GONE, code: "file_unavailable", message: "The file could not be read from storage." });
        }
    };
    if store::sha256_hex(&plain) != sha {
        tracing::error!(document_id = id, "kyc document hash mismatch");
        return Err(ApiError::Coded { status: StatusCode::GONE, code: "file_unavailable", message: "The stored file failed its integrity check." });
    }
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "kyc.document_viewed",
        target: Some(("user", r.get::<i64, _>("user_id"))),
        meta: json!({ "case_id": r.get::<i64, _>("case_id"), "document_id": id, "kind": r.get::<String, _>("kind"), "side": r.get::<String, _>("side") }),
    })
    .await;
    let mut res = Response::new(Body::from(plain));
    let h = res.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_str(&mime).unwrap_or(HeaderValue::from_static("application/octet-stream")));
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("private, no-store, max-age=0"));
    h.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    h.insert("x-kalks-sha256", HeaderValue::from_str(&sha).unwrap_or(HeaderValue::from_static("")));
    if let Ok(v) = HeaderValue::from_str(&format!("inline; filename=\"kyc-{id}.{}\"", sniff::extension(&mime))) {
        h.insert(header::CONTENT_DISPOSITION, v);
    }
    Ok((StatusCode::OK, res).into_response())
}
