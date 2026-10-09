//! Back Office routes (`/v1/staking/admin/*`). Reads need `staking.read`; plans, rates and creating a settlement
//! `staking.write`; approving, rejecting and retrying a settlement `staking.approve`; full exports `staking.export`.
//! Every write carries a reason and lands in the audit log.

use super::{APPROVE, EXPORT, READ, StaffCtx, WRITE, paging};
use crate::error::{ApiError, ApiResult};
use crate::money::{D, num};
use crate::period::Period;
use crate::plans::{self, reason};
use crate::state::AppState;
use crate::{db, positions, rates, settlements};
use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

type Body = Result<Json<Value>, axum::extract::rejection::JsonRejection>;

fn body(b: Body) -> ApiResult<Value> {
    let Json(v) = b.map_err(|e| ApiError::BadRequest(e.body_text()))?;
    if !v.is_object() {
        return Err(ApiError::BadRequest("Expected a JSON object.".into()));
    }
    Ok(v)
}

/// `GET overview`: liability (outstanding principal), investors, returns, maturities, the last closed month.
pub async fn overview(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let t = &s.tenant;
    let r = sqlx::query(
        "SELECT COALESCE(sum(principal) FILTER (WHERE status = 'active'), 0) AS liability,
                COALESCE(sum(principal) FILTER (WHERE status = 'pending_payment'), 0) AS pending,
                count(*) FILTER (WHERE status = 'active') AS active,
                count(*) FILTER (WHERE status = 'matured') AS matured,
                count(DISTINCT user_id) FILTER (WHERE status = 'active') AS investors,
                COALESCE(sum(returns_paid), 0) AS returns_paid,
                count(*) FILTER (WHERE status = 'active' AND matures_at <= now()) AS overdue,
                count(*) FILTER (WHERE status = 'active' AND redeem_attempts > 0) AS redeem_waiting
         FROM positions WHERE tenant = $1",
    )
    .bind(t)
    .fetch_one(&st.pool)
    .await?;
    let (m30, m30_sum) = positions::maturing_within(&st, t, 30).await?;
    let list = plans::list(&st, t).await?;
    let stats = plans::stats(&st, t).await?;
    let now = Utc::now();
    let last = Period::of(now).prev();
    let preview = settlements::preview(&st, t, last).await?;
    let monthly = sqlx::query("SELECT period, status, total FROM settlements WHERE tenant = $1 AND status IN ('approved', 'paid', 'partially_paid') ORDER BY period DESC LIMIT 12")
        .bind(t)
        .fetch_all(&st.pool)
        .await?;
    let mut monthly: Vec<Value> = monthly.iter().map(|m| json!({"period": m.get::<String, _>("period"), "status": m.get::<String, _>("status"), "amount": num(m.get("total"))})).collect();
    monthly.reverse();
    let counts = sqlx::query(
        "SELECT (SELECT count(*) FROM settlements WHERE tenant = $1 AND status = 'pending_approval') AS pending_approval,
                (SELECT count(*) FROM settlement_lines WHERE tenant = $1 AND status = 'failed') AS failed_lines,
                (SELECT count(*) FROM settlement_lines WHERE tenant = $1 AND status = 'transfer_pending') AS pending_lines",
    )
    .bind(t)
    .fetch_one(&st.pool)
    .await?;
    let worker = db::cursor(&st.pool, "workers:last_run").await?.map(|(_, at)| at);
    Ok(Json(json!({
        "liability": num(r.get("liability")), "pendingPayment": num(r.get("pending")),
        "activePositions": r.get::<i64, _>("active"), "maturedPositions": r.get::<i64, _>("matured"), "investors": r.get::<i64, _>("investors"),
        "returnsPaid": num(r.get("returns_paid")),
        "maturing30d": {"count": m30, "principal": num(m30_sum)},
        "attention": {
            "pendingApproval": counts.get::<i64, _>("pending_approval"), "failedLines": counts.get::<i64, _>("failed_lines"),
            "pendingLines": counts.get::<i64, _>("pending_lines"), "overdueMaturities": r.get::<i64, _>("overdue"), "redeemWaiting": r.get::<i64, _>("redeem_waiting"),
        },
        "plans": list.iter().map(|p| plans::admin_json(p, stats.get(&p.id).copied().unwrap_or_default())).collect::<Vec<_>>(),
        "lastPeriod": {"period": last.to_string(), "existing": preview["existing"], "ratesMissing": preview["ratesMissing"], "totals": preview["totals"], "canCreate": preview["canCreate"]},
        "currentPeriod": Period::of(now).to_string(),
        "monthly": monthly,
        "currencies": st.cfg.currencies,
        "workers": {"enabled": st.cfg.workers, "lastRun": worker},
        "serverTime": now,
    })))
}

pub async fn plans(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let list = plans::list(&st, &s.tenant).await?;
    let stats = plans::stats(&st, &s.tenant).await?;
    Ok(Json(json!({"plans": list.iter().map(|p| plans::admin_json(p, stats.get(&p.id).copied().unwrap_or_default())).collect::<Vec<_>>(), "currencies": st.cfg.currencies})))
}

pub async fn create_plan(State(st): State<AppState>, s: StaffCtx, b: Body) -> ApiResult<Json<Value>> {
    s.require(WRITE)?;
    let p = plans::create(&st, &s.tenant, &s.actor(), &body(b)?).await?;
    Ok(Json(json!({"plan": plans::admin_json(&p, Default::default())})))
}

pub async fn patch_plan(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, b: Body) -> ApiResult<Json<Value>> {
    s.require(WRITE)?;
    let p = plans::update(&st, &s.tenant, id, &s.actor(), &body(b)?).await?;
    let stats = plans::stats(&st, &s.tenant).await?;
    Ok(Json(json!({"plan": plans::admin_json(&p, stats.get(&p.id).copied().unwrap_or_default())})))
}

#[derive(Deserialize)]
pub struct PeriodQ {
    period: Option<String>,
}

fn period_or(q: &PeriodQ, default: Period) -> ApiResult<Period> {
    match q.period.as_deref().filter(|s| !s.is_empty()) {
        Some(p) => settlements::parse_period(p),
        None => Ok(default),
    }
}

/// `GET rates?period=YYYY-MM` (default: the last closed month).
pub async fn rates(State(st): State<AppState>, s: StaffCtx, Query(q): Query<PeriodQ>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let p = period_or(&q, Period::of(Utc::now()).prev())?;
    Ok(Json(rates::month(&st, &s.tenant, p).await?))
}

/// `POST rates` `{planId, period, ratePct, note?, reason}`.
pub async fn set_rate(State(st): State<AppState>, s: StaffCtx, b: Body) -> ApiResult<Json<Value>> {
    s.require(WRITE)?;
    let v = body(b)?;
    let saved = rates::set(&st, &s.tenant, &s.actor(), &v).await?;
    let p = settlements::parse_period(saved["period"].as_str().unwrap_or(""))?;
    Ok(Json(json!({"saved": saved, "month": rates::month(&st, &s.tenant, p).await?})))
}

pub async fn preview(State(st): State<AppState>, s: StaffCtx, Query(q): Query<PeriodQ>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let p = period_or(&q, Period::of(Utc::now()).prev())?;
    Ok(Json(settlements::preview(&st, &s.tenant, p).await?))
}

#[derive(Deserialize)]
pub struct ListQ {
    status: Option<String>,
    plan: Option<i64>,
    user: Option<i64>,
    q: Option<String>,
    action: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn settlements(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 100);
    let status = q.status.as_deref().filter(|x| ["pending_approval", "approved", "paid", "partially_paid", "rejected"].contains(x));
    let mut v = settlements::list(&st, &s.tenant, status, offset, limit).await?;
    v["page"] = json!(page);
    v["limit"] = json!(limit);
    Ok(Json(v))
}

/// `POST settlements` `{period, reason}`: creates the month's settlement for approval by someone else.
pub async fn create_settlement(State(st): State<AppState>, s: StaffCtx, b: Body) -> ApiResult<Json<Value>> {
    s.require(WRITE)?;
    let v = body(b)?;
    let why = reason(&v)?;
    let p = settlements::parse_period(v["period"].as_str().unwrap_or(""))?;
    let id = settlements::create(&st, &s.tenant, &s.actor(), p, &why).await?;
    Ok(Json(settlements::detail(&st, &s.tenant, id).await?))
}

pub async fn settlement(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    Ok(Json(settlements::detail(&st, &s.tenant, id).await?))
}

/// `POST settlements/{id}/approve|reject|retry` `{reason}`.
pub async fn decide(State(st): State<AppState>, s: StaffCtx, Path((id, action)): Path<(i64, String)>, b: Body) -> ApiResult<Json<Value>> {
    s.require(APPROVE)?;
    let why = reason(&body(b)?)?;
    let actor = s.actor();
    match action.as_str() {
        "approve" => settlements::approve(&st, &s.tenant, id, &actor, &why).await?,
        "reject" => settlements::reject(&st, &s.tenant, id, &actor, &why).await?,
        "retry" => {
            settlements::retry(&st, &s.tenant, id, &actor, &why).await?;
        }
        _ => return Err(ApiError::NotFound),
    }
    Ok(Json(settlements::detail(&st, &s.tenant, id).await?))
}

const POSITIONS_SQL: &str = "FROM positions WHERE tenant = $1 AND ($2::text IS NULL OR status = $2) AND ($3::bigint IS NULL OR plan_id = $3)
      AND ($4::bigint IS NULL OR user_id = $4) AND ($5::text IS NULL OR user_name ILIKE '%' || $5 || '%' OR id::text = $5 OR user_id::text = $5)";

fn position_filters(q: &ListQ) -> (Option<String>, Option<String>) {
    let status = q.status.clone().filter(|x| ["pending_payment", "payment_failed", "active", "matured"].contains(&x.as_str()));
    let search = q.q.as_deref().map(|x| x.trim().replace(['%', '_', '\\'], "")).filter(|x| !x.is_empty()).map(|x| x.chars().take(60).collect());
    (status, search)
}

pub async fn positions(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 200);
    let (status, search) = position_filters(&q);
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * {POSITIONS_SQL} ORDER BY id DESC OFFSET $6 LIMIT $7")))
        .bind(&s.tenant)
        .bind(&status)
        .bind(q.plan)
        .bind(q.user)
        .bind(&search)
        .bind(offset)
        .bind(limit)
        .fetch_all(&st.pool)
        .await?;
    let (total, principal): (i64, D) = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT count(*), COALESCE(sum(principal), 0) {POSITIONS_SQL}")))
        .bind(&s.tenant)
        .bind(&status)
        .bind(q.plan)
        .bind(q.user)
        .bind(&search)
        .fetch_one(&st.pool)
        .await?;
    let list: Vec<positions::Position> = rows.iter().map(positions::from_row).collect();
    let ids: Vec<i64> = list.iter().map(|p| p.id).collect();
    let last = positions::last_returns(&st, &ids).await?;
    let now = Utc::now();
    Ok(Json(json!({
        "items": list.iter().map(|p| positions::json(p, last.get(&p.id).cloned(), now)).collect::<Vec<_>>(),
        "total": total, "principal": num(principal), "page": page, "limit": limit,
    })))
}

/// `GET positions/export`: every matching position (at most 10,000) for a CSV, audited.
pub async fn export_positions(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    s.require(EXPORT)?;
    let (status, search) = position_filters(&q);
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * {POSITIONS_SQL} ORDER BY id DESC LIMIT 10000")))
        .bind(&s.tenant)
        .bind(&status)
        .bind(q.plan)
        .bind(q.user)
        .bind(&search)
        .fetch_all(&st.pool)
        .await?;
    let now = Utc::now();
    let items: Vec<Value> = rows.iter().map(|r| positions::json(&positions::from_row(r), None, now)).collect();
    crate::audit::record(&st.pool, &s.tenant, &s.actor(), "positions.export", None, None, Some(json!({"rows": items.len(), "status": status, "plan": q.plan, "user": q.user})), None).await?;
    Ok(Json(json!({"items": items})))
}

pub async fn position(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let p = positions::get(&st, id).await?.filter(|p| p.tenant == s.tenant).ok_or(ApiError::NotFound)?;
    Ok(Json(positions::detail(&st, &p).await?))
}

pub async fn audit(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    s.require(READ)?;
    let (page, limit, offset) = paging(q.page, q.limit, 50, 200);
    let action = q.action.as_deref().map(|a| a.trim().chars().filter(|c| c.is_ascii_lowercase() || *c == '.' || *c == '_').take(40).collect::<String>()).filter(|a| !a.is_empty());
    let rows = sqlx::query("SELECT * FROM audit_log WHERE tenant = $1 AND ($2::text IS NULL OR action LIKE $2 || '%') ORDER BY id DESC OFFSET $3 LIMIT $4")
        .bind(&s.tenant)
        .bind(&action)
        .bind(offset)
        .bind(limit)
        .fetch_all(&st.pool)
        .await?;
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE tenant = $1 AND ($2::text IS NULL OR action LIKE $2 || '%')").bind(&s.tenant).bind(&action).fetch_one(&st.pool).await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<i64, _>("id"), "at": r.get::<DateTime<Utc>, _>("at"), "actor": r.get::<String, _>("actor"), "actorName": r.get::<Option<String>, _>("actor_name"),
                "action": r.get::<String, _>("action"), "target": r.get::<Option<String>, _>("target"),
                "before": r.get::<Option<sqlx::types::Json<Value>>, _>("before").map(|j| j.0), "after": r.get::<Option<sqlx::types::Json<Value>>, _>("after").map(|j| j.0),
                "reason": r.get::<Option<String>, _>("reason"),
            })
        })
        .collect();
    Ok(Json(json!({"items": items, "total": total, "page": page, "limit": limit})))
}

