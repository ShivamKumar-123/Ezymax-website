//! Backtest jobs: create (validated and limited), list, poll, cancel.

use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::atomic::Ordering;

use super::{Body, Res, f, i, s};
use crate::backtest::jobs::{MAX_BARS, max_days};
use crate::error::ApiError;
use crate::specs::tf_secs;
use crate::state::{AppState, User, settings};
use crate::strategy::own_version;

fn parse_time(v: &Value, k: &str) -> Option<i64> {
    match v.get(k) {
        Some(Value::Number(n)) => n.as_i64().map(|x| if x > 10_000_000_000 { x / 1000 } else { x }),
        Some(Value::String(t)) => {
            let t = t.trim();
            chrono::DateTime::parse_from_rfc3339(t)
                .map(|d| d.timestamp())
                .ok()
                .or_else(|| chrono::NaiveDate::parse_from_str(t, "%Y-%m-%d").ok().map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp()))
        }
        _ => None,
    }
}

pub fn row_view(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "versionId": r.get::<i64, _>("version_id"),
        "params": r.get::<Value, _>("params"),
        "status": r.get::<String, _>("status"),
        "progress": r.get::<f32, _>("progress"),
        "summary": r.get::<Option<Value>, _>("summary"),
        "error": r.get::<Option<String>, _>("error"),
        "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        "finishedAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
    })
}

pub async fn create(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    let sid = i(&v, "strategyId").ok_or_else(|| ApiError::validation("strategyId", "Choose a strategy."))?;
    let ver = own_version(&st.pool, &u.tenant, u.id, sid, i(&v, "versionId")).await?.ok_or_else(|| ApiError::not_found("Strategy"))?;
    if !ver.valid {
        return Err(ApiError::unprocessable("invalid_strategy", "Fix the strategy's errors before backtesting it."));
    }
    let prog = ver.program(&st.specs).map_err(|m| ApiError::unprocessable("invalid_strategy", m))?;
    let now = chrono::Utc::now().timestamp();
    let to = parse_time(&v, "to").unwrap_or(now).min(now);
    let from = parse_time(&v, "from").unwrap_or(to - 365 * 86400);
    if from >= to {
        return Err(ApiError::validation("from", "The start date must be before the end date."));
    }
    let tf = prog.spec.timeframe.as_str();
    let days = (to - from) / 86400;
    if days > max_days(tf) {
        return Err(ApiError::validation("from", format!("{tf} backtests can cover at most {} days.", max_days(tf))));
    }
    let bars = (to - from) / tf_secs(tf).unwrap_or(3600);
    if bars as usize > MAX_BARS {
        return Err(ApiError::validation("from", format!("That range is {bars} bars; the limit is {MAX_BARS}.")));
    }
    let balance = f(&v, "initialBalance").unwrap_or(10_000.0);
    if !(100.0..=10_000_000.0).contains(&balance) {
        return Err(ApiError::validation("initialBalance", "Initial balance must be between 100 and 10,000,000."));
    }
    let active: i64 = sqlx::query_scalar("SELECT count(*) FROM backtests WHERE tenant_id = $1 AND user_id = $2 AND status IN ('queued','running')").bind(&u.tenant).bind(u.id).fetch_one(&st.pool).await?;
    if active >= 3 {
        return Err(ApiError::conflict("queue_full", "You already have 3 backtests queued or running. Wait for one to finish."));
    }
    let per_day = settings(&st.pool, &u.tenant).await.get("backtestsPerDay").and_then(Value::as_i64).unwrap_or(200);
    let today: i64 = sqlx::query_scalar("SELECT count(*) FROM backtests WHERE tenant_id = $1 AND user_id = $2 AND created_at > now() - interval '1 day'").bind(&u.tenant).bind(u.id).fetch_one(&st.pool).await?;
    if today >= per_day {
        return Err(ApiError::conflict("daily_limit", format!("Daily backtest limit ({per_day}) reached.")));
    }
    let mut params = json!({"from": from, "to": to, "initialBalance": balance, "symbol": prog.spec.symbol, "timeframe": tf});
    if let Some(g) = s(&v, "group") {
        params["group"] = json!(g);
    }
    if let Some(l) = i(&v, "login") {
        params["login"] = json!(l);
    }
    if let Some(p) = f(&v, "spreadPoints") {
        params["spreadPoints"] = json!(p.clamp(0.0, 100_000.0));
    }
    if let Some(c) = f(&v, "commissionPerLot") {
        params["commissionPerLot"] = json!(c.clamp(0.0, 1000.0));
    }
    if let Some(b) = v.get("swaps").and_then(Value::as_bool) {
        params["swaps"] = json!(b);
    }
    let id: i64 = sqlx::query_scalar("INSERT INTO backtests (tenant_id, user_id, strategy_id, version_id, params) VALUES ($1,$2,$3,$4,$5) RETURNING id")
        .bind(&u.tenant)
        .bind(u.id)
        .bind(sid)
        .bind(ver.id)
        .bind(&params)
        .fetch_one(&st.pool)
        .await?;
    st.jobs_wake.notify_waiters();
    Ok(Json(json!({"id": id, "status": "queued", "params": params})))
}

#[derive(Deserialize)]
pub struct ListQ {
    strategy_id: Option<i64>,
    limit: Option<i64>,
}

pub async fn list(State(st): State<AppState>, u: User, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query(
        "SELECT b.id, b.strategy_id, b.version_id, b.params, b.status, b.progress, b.summary, b.error, b.created_at, b.finished_at, s.name, v.version
         FROM backtests b JOIN strategies s ON s.id = b.strategy_id JOIN strategy_versions v ON v.id = b.version_id
         WHERE b.tenant_id = $1 AND b.user_id = $2 AND ($3::bigint IS NULL OR b.strategy_id = $3) ORDER BY b.id DESC LIMIT $4",
    )
    .bind(&u.tenant)
    .bind(u.id)
    .bind(q.strategy_id)
    .bind(q.limit.unwrap_or(50).clamp(1, 200))
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let mut v = row_view(r);
            v["strategyId"] = json!(r.get::<i64, _>("strategy_id"));
            v["strategyName"] = json!(r.get::<String, _>("name"));
            v["version"] = json!(r.get::<i32, _>("version"));
            v
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

pub async fn detail(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    let r = sqlx::query(
        "SELECT b.*, s.name, v.version, v.kind FROM backtests b JOIN strategies s ON s.id = b.strategy_id JOIN strategy_versions v ON v.id = b.version_id WHERE b.id = $1 AND b.tenant_id = $2 AND b.user_id = $3",
    )
    .bind(id)
    .bind(&u.tenant)
    .bind(u.id)
    .fetch_optional(&st.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Backtest"))?;
    let mut v = row_view(&r);
    v["strategyId"] = json!(r.get::<i64, _>("strategy_id"));
    v["strategyName"] = json!(r.get::<String, _>("name"));
    v["version"] = json!(r.get::<i32, _>("version"));
    v["stage"] = json!(r.get::<Option<String>, _>("stage"));
    v["cpuMs"] = json!(r.get::<Option<i64>, _>("cpu_ms"));
    v["report"] = r.get::<Option<Value>, _>("report").unwrap_or(Value::Null);
    Ok(Json(v))
}

pub async fn cancel(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    let status: Option<String> = sqlx::query_scalar("SELECT status FROM backtests WHERE id = $1 AND tenant_id = $2 AND user_id = $3").bind(id).bind(&u.tenant).bind(u.id).fetch_optional(&st.pool).await?;
    match status.as_deref() {
        None => Err(ApiError::not_found("Backtest")),
        Some("queued") => {
            sqlx::query("UPDATE backtests SET status = 'cancelled', finished_at = now(), stage = 'cancelled' WHERE id = $1 AND status = 'queued'").bind(id).execute(&st.pool).await?;
            Ok(Json(json!({"status": "cancelled"})))
        }
        Some("running") => {
            if let Some(c) = st.cancels.lock().unwrap().get(&id) {
                c.store(true, Ordering::Relaxed);
            }
            Ok(Json(json!({"status": "cancelling"})))
        }
        Some(s) => Err(ApiError::conflict("finished", format!("This backtest is already {s}."))),
    }
}
