//! Back Office routes (staff headers + `X-Kalks-Staff-Perms`). `reports.read` opens every report; downloads
//! (exports, client statements) and scheduled-report changes need `reports.export`.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::{Value, json};
use sqlx::Row;

use super::{RangeQ, StaffCtx, file, range};
use crate::broker;
use crate::client;
use crate::db;
use crate::error::{ApiError, ApiResult};
use crate::export;
use crate::schedules::{self, ScheduleIn};
use crate::state::App;
use crate::statement;
use crate::sync;
use crate::time;

pub async fn status(State(app): State<App>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    Ok(Json(broker::status(&app, &s.tenant).await?))
}

pub async fn pnl(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let (from, to) = range(&q, 30)?;
    Ok(Json(broker::pnl(&app, &s.tenant, from, to).await?.0))
}

pub async fn deposits(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let (from, to) = range(&q, 30)?;
    Ok(Json(broker::deposits(&app, &s.tenant, from, to).await?.0))
}

pub async fn funnel(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let (from, to) = range(&q, 30)?;
    Ok(Json(broker::funnel(&app, &s.tenant, from, to).await?.0))
}

pub async fn cohorts(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    Ok(Json(broker::cohorts(&app, &s.tenant, q.months.unwrap_or(12)).await?.0))
}

pub async fn activity(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let (from, to) = range(&q, 30)?;
    Ok(Json(broker::activity(&app, &s.tenant, from, to).await?.0))
}

pub async fn partners(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let (from, to) = range(&q, 30)?;
    Ok(Json(broker::partners(&app, &s.tenant, from, to).await?.0))
}

/// Any report (or regulatory export) as CSV / XLSX. Audited.
pub async fn export(State(app): State<App>, s: StaffCtx, Path(report): Path<String>, Query(q): Query<RangeQ>) -> ApiResult<Response> {
    s.require("reports.export")?;
    let (from, to) = range(&q, 30)?;
    let (tables, _) = if report == "aml" {
        (broker::aml(&app, &s.tenant, from, to, q.large.unwrap_or(10_000.0).max(0.0)).await?, None)
    } else {
        schedules::report_tables(&app, &s.tenant, &report, from, to).await?
    };
    let format = q.format.clone().unwrap_or_else(|| "csv".into());
    db::audit(&app.pool, &s.tenant, &s.actor, "report.export", Some(&report), Some(json!({"from": from, "to": to, "format": format, "rows": tables.iter().map(|t| t.rows.len()).sum::<usize>()}))).await;
    let name = format!("kalks-{report}-{}-{}", time::server_day(from), time::server_day(to - chrono::Duration::seconds(1)));
    Ok(match format.as_str() {
        "xlsx" => file(export::xlsx(&tables).map_err(ApiError::Internal)?, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", &format!("{name}.xlsx")),
        "csv" => file(export::csv(&tables), "text/csv; charset=utf-8", &format!("{name}.csv")),
        _ => return Err(ApiError::Validation { field: "format", message: "Format must be csv or xlsx.".into() }),
    })
}

async fn owner_of(app: &App, tenant: &str, login: i64) -> ApiResult<i64> {
    sqlx::query_scalar("SELECT user_id FROM accounts WHERE tenant = $1 AND login = $2").bind(tenant).bind(login).fetch_optional(&app.pool).await?.ok_or_else(|| ApiError::NotFound("Account not found.".into()))
}

pub async fn statement(State(app): State<App>, s: StaffCtx, Path(login): Path<i64>, Query(q): Query<RangeQ>) -> ApiResult<Response> {
    s.require("reports.export")?;
    let (from, to) = range(&q, 30)?;
    let user = owner_of(&app, &s.tenant, login).await?;
    client::refresh(&app, &s.tenant, user).await;
    let st = statement::generate(&app, &s.tenant, login, from, to).await?;
    let format = q.format.clone().unwrap_or_else(|| "pdf".into());
    db::audit(&app.pool, &s.tenant, &s.actor, "statement.download", Some(&login.to_string()), Some(json!({"from": from, "to": to, "format": format, "userId": user}))).await;
    super::client::render(&app, &st, &format, &super::client::sections(&q))
}

pub async fn account_analytics(State(app): State<App>, s: StaffCtx, Path(login): Path<i64>, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let (from, to) = range(&q, 90)?;
    let user = owner_of(&app, &s.tenant, login).await?;
    Ok(Json(client::analytics(&app, &s.tenant, user, Some(login), from, to).await?))
}

pub async fn schedules(State(app): State<App>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    Ok(Json(schedules::list(&app, &s.tenant).await?))
}

pub async fn create_schedule(State(app): State<App>, s: StaffCtx, Json(body): Json<ScheduleIn>) -> ApiResult<Json<Value>> {
    s.require("reports.export")?;
    Ok(Json(json!({"schedule": schedules::create(&app, &s.tenant, &s.actor, body).await?})))
}

pub async fn update_schedule(State(app): State<App>, s: StaffCtx, Path(id): Path<i64>, Json(body): Json<ScheduleIn>) -> ApiResult<Json<Value>> {
    s.require("reports.export")?;
    Ok(Json(json!({"schedule": schedules::update(&app, &s.tenant, &s.actor, id, body).await?})))
}

pub async fn delete_schedule(State(app): State<App>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("reports.export")?;
    Ok(Json(schedules::delete(&app, &s.tenant, &s.actor, id).await?))
}

pub async fn run_schedule(State(app): State<App>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require("reports.export")?;
    let t: Option<String> = sqlx::query_scalar("SELECT tenant FROM schedules WHERE id = $1").bind(id).fetch_optional(&app.pool).await?;
    if t.as_deref() != Some(s.tenant.as_str()) {
        return Err(ApiError::NotFound("Schedule not found.".into()));
    }
    Ok(Json(json!({"run": schedules::run_one(&app, id, "manual", &s.actor).await?})))
}

/// Runs one mirror pass now (accounts, wallet, IB).
pub async fn sync_now(State(app): State<App>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let mut errors = vec![];
    if let Err(e) = sync::sync_specs(&app, &s.tenant).await {
        errors.push(format!("specs: {e}"));
    }
    if let Err(e) = sync::sync_clients(&app).await {
        errors.push(format!("clients: {e}"));
    }
    if let Err(e) = sync::sync_accounts(&app, &s.tenant).await {
        errors.push(format!("accounts: {e}"));
    }
    if let Err(e) = sync::sync_wallet(&app, &s.tenant).await {
        errors.push(format!("wallet: {e}"));
    }
    if let Err(e) = sync::sync_ib(&app, &s.tenant).await {
        errors.push(format!("ib: {e}"));
    }
    Ok(Json(json!({"status": broker::status(&app, &s.tenant).await?, "errors": errors})))
}

pub async fn audit(State(app): State<App>, s: StaffCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    s.require("reports.read")?;
    let rows = sqlx::query("SELECT * FROM audit_log WHERE tenant = $1 ORDER BY id DESC LIMIT $2").bind(&s.tenant).bind(q.limit.unwrap_or(100).clamp(1, 500)).fetch_all(&app.pool).await?;
    Ok(Json(json!({"items": rows.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "at": r.get::<chrono::DateTime<chrono::Utc>, _>("at"), "actor": r.get::<String, _>("actor"), "actorName": r.get::<String, _>("actor_name"), "actorRole": r.get::<String, _>("actor_role"), "action": r.get::<String, _>("action"), "target": r.get::<Option<String>, _>("target"), "detail": r.get::<Option<sqlx::types::Json<Value>>, _>("detail").map(|j| j.0)})).collect::<Vec<_>>()})))
}
