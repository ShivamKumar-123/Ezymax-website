//! Back Office journeys (`/v1/growth/admin/journeys*`), see `journeys.rs`. Reads need `marketing.read`,
//! editing, switching and test sends `marketing.write`. Every change is audited with before / after.

use super::{ROLES_READ, ROLES_WRITE, StaffCtx, paging};
use crate::audit;
use crate::error::{ApiError, ApiResult, invalid};
use crate::journeys::{self, CHECKS, Step, TRIGGERS, Trigger};
use crate::state::AppState;
use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyIn {
    name: String,
    #[serde(default)]
    description: String,
    trigger: Trigger,
    steps: Vec<Step>,
}

fn parse(v: Value) -> ApiResult<JourneyIn> {
    serde_json::from_value(v).map_err(|e| ApiError::BadRequest(format!("Invalid journey: {e}")))
}

fn check(j: JourneyIn) -> ApiResult<JourneyIn> {
    let name = j.name.trim().to_string();
    if !(2..=80).contains(&name.chars().count()) {
        return Err(invalid("name", "Name: 2–80 characters."));
    }
    let description = j.description.trim().chars().take(300).collect();
    Ok(JourneyIn { name, description, trigger: journeys::check_trigger(&j.trigger)?, steps: journeys::check_steps(j.steps)? })
}

async fn load(st: &AppState, tenant: &str, id: i64) -> ApiResult<sqlx::postgres::PgRow> {
    sqlx::query("SELECT * FROM journeys WHERE id = $1 AND tenant = $2").bind(id).bind(tenant).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)
}

/// `GET journeys/meta`: trigger and condition catalogues for the editor.
pub async fn meta(s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require(ROLES_READ)?;
    Ok(Json(json!({
        "triggers": TRIGGERS.iter().map(|(k, l, d)| json!({"key": k, "label": l, "days": d})).collect::<Vec<_>>(),
        "checks": CHECKS.iter().map(|(k, l)| json!({"key": k, "label": l})).collect::<Vec<_>>(),
        "placeholders": ["{{first_name}}", "{{last_name}}", "{{name}}", "{{country}}", "{{referral_code}}"],
    })))
}

pub async fn list(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require(ROLES_READ)?;
    let rows = sqlx::query("SELECT * FROM journeys WHERE tenant = $1 AND status <> 'archived' ORDER BY (status = 'live') DESC, updated_at DESC").bind(&s.tenant).fetch_all(&st.pool).await?;
    let counts = journeys::enrollment_counts(&st, &s.tenant, None).await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let mut v = journeys::journey_json(r);
            v["stats"] = counts.get(&r.get::<i64, _>("id")).cloned().unwrap_or_else(|| json!({"enrolled": 0, "active": 0, "completed": 0, "exited": 0, "failed": 0, "emails": 0, "inapp": 0, "suppressed": 0}));
            v
        })
        .collect();
    let archived: i64 = sqlx::query_scalar("SELECT count(*) FROM journeys WHERE tenant = $1 AND status = 'archived'").bind(&s.tenant).fetch_one(&st.pool).await?;
    Ok(Json(json!({"items": items, "archived": archived})))
}

pub async fn get(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require(ROLES_READ)?;
    let r = load(&st, &s.tenant, id).await?;
    let mut v = journeys::journey_json(&r);
    let steps: Vec<Step> = serde_json::from_value(v["steps"].clone()).unwrap_or_default();
    v["stats"] = journeys::enrollment_counts(&st, &s.tenant, Some(id)).await?.remove(&id).unwrap_or_else(|| json!({"enrolled": 0, "active": 0, "completed": 0, "exited": 0, "failed": 0, "emails": 0, "inapp": 0, "suppressed": 0}));
    v["stepStats"] = json!(journeys::step_stats(&st, id, &steps).await?);
    Ok(Json(json!({"journey": v})))
}

pub async fn create(State(st): State<AppState>, s: StaffCtx, Json(body): Json<Value>) -> ApiResult<Json<Value>> {
    s.require(ROLES_WRITE)?;
    let j = check(parse(body)?)?;
    let actor = s.actor();
    let mut tx = st.pool.begin().await?;
    let r = sqlx::query("INSERT INTO journeys (tenant, name, description, trigger, steps, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *")
        .bind(&s.tenant)
        .bind(&j.name)
        .bind(&j.description)
        .bind(sqlx::types::Json(&j.trigger))
        .bind(sqlx::types::Json(&j.steps))
        .bind(actor.label())
        .fetch_one(&mut *tx)
        .await?;
    let v = journeys::journey_json(&r);
    audit::record(&mut *tx, &s.tenant, &actor, "journey.created", Some(format!("journey:{}", v["id"])), None, Some(v.clone()), None).await?;
    tx.commit().await?;
    Ok(Json(json!({"journey": v})))
}

pub async fn patch(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Json(body): Json<Value>) -> ApiResult<Json<Value>> {
    s.require(ROLES_WRITE)?;
    let cur = load(&st, &s.tenant, id).await?;
    let before = journeys::journey_json(&cur);
    if before["status"] == "archived" {
        return Err(ApiError::Conflict { code: "state", message: "Archived journeys can't be edited.".into() });
    }
    let mut merged = before.clone();
    if let (Some(m), Some(b)) = (merged.as_object_mut(), body.as_object()) {
        for k in ["name", "description", "trigger", "steps"] {
            if let Some(v) = b.get(k) {
                m.insert(k.into(), v.clone());
            }
        }
    }
    let j = check(parse(merged)?)?;
    let actor = s.actor();
    let mut tx = st.pool.begin().await?;
    let r = sqlx::query("UPDATE journeys SET name = $3, description = $4, trigger = $5, steps = $6, updated_by = $7, updated_at = now() WHERE id = $1 AND tenant = $2 RETURNING *")
        .bind(id)
        .bind(&s.tenant)
        .bind(&j.name)
        .bind(&j.description)
        .bind(sqlx::types::Json(&j.trigger))
        .bind(sqlx::types::Json(&j.steps))
        .bind(actor.label())
        .fetch_one(&mut *tx)
        .await?;
    let v = journeys::journey_json(&r);
    audit::record(&mut *tx, &s.tenant, &actor, "journey.updated", Some(format!("journey:{id}")), Some(before), Some(v.clone()), None).await?;
    tx.commit().await?;
    Ok(Json(json!({"journey": v})))
}

#[derive(Deserialize)]
pub struct StatusIn {
    status: String,
}

/// `POST journeys/{id}/status {status: live|paused|archived}`. Going live the first time sets `live_since`.
pub async fn set_status(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Json(b): Json<StatusIn>) -> ApiResult<Json<Value>> {
    s.require(ROLES_WRITE)?;
    let cur = load(&st, &s.tenant, id).await?;
    let from: String = cur.get("status");
    let to = b.status.as_str();
    let ok = matches!((from.as_str(), to), ("draft" | "paused", "live") | ("live", "paused") | ("draft" | "paused" | "live", "archived"));
    if !ok {
        return Err(ApiError::Conflict { code: "state", message: format!("A {from} journey can't be switched to {to}.") });
    }
    let actor = s.actor();
    let r = sqlx::query("UPDATE journeys SET status = $3, live_since = CASE WHEN $3 = 'live' THEN COALESCE(live_since, now()) ELSE live_since END, updated_by = $4, updated_at = now() WHERE id = $1 AND tenant = $2 RETURNING *")
        .bind(id)
        .bind(&s.tenant)
        .bind(to)
        .bind(actor.label())
        .fetch_one(&st.pool)
        .await?;
    let exited = if to == "archived" { journeys::exit_all(&st, id, &actor).await? } else { 0 };
    let action = match to {
        "live" if from == "paused" => "journey.resumed",
        "live" => "journey.launched",
        "paused" => "journey.paused",
        _ => "journey.archived",
    };
    audit::record(&st.pool, &s.tenant, &actor, action, Some(format!("journey:{id}")), Some(json!({"status": from})), Some(json!({"status": to, "exited": exited})), None).await?;
    if to == "live" {
        // enrol and run straight away rather than on the next tick
        let st2 = st.clone();
        tokio::spawn(async move {
            let _ = journeys::enrol_tick(&st2).await;
            let _ = journeys::run_tick(&st2).await;
        });
    }
    Ok(Json(json!({"journey": journeys::journey_json(&r)})))
}

#[derive(Deserialize)]
pub struct EnrolQ {
    status: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
    user: Option<i64>,
}

pub async fn enrollments(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Query(q): Query<EnrolQ>) -> ApiResult<Json<Value>> {
    s.require(ROLES_READ)?;
    let j = load(&st, &s.tenant, id).await?;
    let steps: Vec<Step> = serde_json::from_value(j.get::<sqlx::types::Json<Value>, _>("steps").0).unwrap_or_default();
    let (page, limit, off) = paging(q.page, q.limit, 50, 200);
    let status = q.status.as_deref().filter(|s| matches!(*s, "active" | "completed" | "exited" | "failed"));
    let rows = sqlx::query(
        "SELECT e.*, pr.first_name, pr.last_name, pr.email, count(*) OVER () AS total,
                (SELECT row_to_json(x) FROM (SELECT ev.kind, ev.detail, ev.step_id, ev.at FROM journey_events ev WHERE ev.enrollment_id = e.id ORDER BY ev.id DESC LIMIT 1) x) AS last_event
         FROM journey_enrollments e LEFT JOIN profiles pr ON pr.tenant = e.tenant AND pr.user_id = e.user_id
         WHERE e.journey_id = $1 AND e.tenant = $2 AND ($3::text IS NULL OR e.status = $3) AND ($4::bigint IS NULL OR e.user_id = $4)
         ORDER BY e.id DESC OFFSET $5 LIMIT $6",
    )
    .bind(id)
    .bind(&s.tenant)
    .bind(status)
    .bind(q.user)
    .bind(off)
    .bind(limit)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let idx = r.get::<i32, _>("step_index") as usize;
            let name = format!("{} {}", r.get::<Option<String>, _>("first_name").unwrap_or_default(), r.get::<Option<String>, _>("last_name").unwrap_or_default()).trim().to_string();
            let uid: i64 = r.get("user_id");
            json!({
                "id": r.get::<i64, _>("id"),
                "userId": uid,
                "name": if name.is_empty() { format!("Client #{uid}") } else { name },
                "email": r.get::<Option<String>, _>("email").unwrap_or_default(),
                "status": r.get::<String, _>("status"),
                "stepIndex": idx,
                "stepCount": steps.len(),
                "currentStep": steps.get(idx).map(|s| json!({"id": s.id(), "kind": s.kind()})),
                "nextRunAt": r.get::<DateTime<Utc>, _>("next_run_at"),
                "triggerAt": r.get::<DateTime<Utc>, _>("trigger_at"),
                "enrolledAt": r.get::<DateTime<Utc>, _>("enrolled_at"),
                "finishedAt": r.get::<Option<DateTime<Utc>>, _>("finished_at"),
                "lastError": r.get::<Option<String>, _>("last_error"),
                "lastEvent": r.get::<Option<sqlx::types::Json<Value>>, _>("last_event").map(|j| j.0),
            })
        })
        .collect();
    Ok(Json(json!({"items": items, "total": total, "page": page, "limit": limit})))
}

#[derive(Deserialize)]
pub struct EventsQ {
    enrollment: Option<i64>,
    page: Option<i64>,
    limit: Option<i64>,
}

/// Event log of a journey (newest first), optionally for one enrolment.
pub async fn events(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Query(q): Query<EventsQ>) -> ApiResult<Json<Value>> {
    s.require(ROLES_READ)?;
    load(&st, &s.tenant, id).await?;
    let (page, limit, off) = paging(q.page, q.limit, 100, 500);
    let rows = sqlx::query(
        "SELECT ev.*, pr.first_name, pr.last_name, count(*) OVER () AS total FROM journey_events ev
         LEFT JOIN profiles pr ON pr.tenant = ev.tenant AND pr.user_id = ev.user_id
         WHERE ev.journey_id = $1 AND ev.tenant = $2 AND ($3::bigint IS NULL OR ev.enrollment_id = $3) ORDER BY ev.id DESC OFFSET $4 LIMIT $5",
    )
    .bind(id)
    .bind(&s.tenant)
    .bind(q.enrollment)
    .bind(off)
    .bind(limit)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let uid: i64 = r.get("user_id");
            let name = format!("{} {}", r.get::<Option<String>, _>("first_name").unwrap_or_default(), r.get::<Option<String>, _>("last_name").unwrap_or_default()).trim().to_string();
            json!({"id": r.get::<i64, _>("id"), "enrollmentId": r.get::<i64, _>("enrollment_id"), "userId": uid, "name": if name.is_empty() { format!("Client #{uid}") } else { name },
                   "stepId": r.get::<Option<String>, _>("step_id"), "kind": r.get::<String, _>("kind"), "detail": r.get::<String, _>("detail"), "at": r.get::<DateTime<Utc>, _>("at")})
        })
        .collect();
    Ok(Json(json!({"items": items, "total": total, "page": page, "limit": limit})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestIn {
    /// The staff member's own address (the admin BFF fills it from the session, never from the browser).
    to: String,
    /// Unsaved steps from the editor; default = the saved journey.
    steps: Option<Vec<Step>>,
}

pub async fn test(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Json(b): Json<TestIn>) -> ApiResult<Json<Value>> {
    s.require(ROLES_WRITE)?;
    let j = load(&st, &s.tenant, id).await?;
    let steps = match b.steps {
        Some(steps) => journeys::check_steps(steps)?,
        None => serde_json::from_value(j.get::<sqlx::types::Json<Value>, _>("steps").0).map_err(|e| ApiError::BadRequest(e.to_string()))?,
    };
    let results = journeys::test_send(&st, &s.tenant, &steps, &b.to, &s.id, &s.name).await?;
    audit::record(&st.pool, &s.tenant, &s.actor(), "journey.test_sent", Some(format!("journey:{id}")), None, Some(json!({"results": results})), None).await?;
    Ok(Json(json!({"results": results})))
}
