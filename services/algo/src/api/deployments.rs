//! Deployments (strategy version × trading account), their logs and the kill switches (D84).

use std::collections::HashSet;
use std::sync::Arc;

use axum::Json;
use axum::extract::{Path, Query, State};
use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Res, b, f, i};
use crate::error::ApiError;
use crate::runtime::{self, Dep, close_tracked};
use crate::state::{AppState, User, audit, halted, settings};
use crate::strategy::{load_version, own_version};

/// The user's trading accounts (for pickers), from the engine.
pub async fn accounts(State(st): State<AppState>, u: User) -> Res {
    let list = st.engine.accounts(&u.tenant, u.id).await.map_err(|_| ApiError::unavailable("Trading service is unavailable."))?;
    let items: Vec<Value> = list
        .iter()
        .map(|a| {
            json!({"login": a["login"], "type": a["type"], "group": a["group"], "groupName": a["groupName"], "mode": a["mode"], "currency": a["currency"],
                   "balance": a["balance"], "equity": a["equity"], "status": a["status"], "name": a["name"], "leverage": a["leverage"]})
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

pub async fn rows_for(st: &AppState, tenant: &str, cond: &str, user: i64, strategy: Option<i64>) -> Result<Vec<Value>, ApiError> {
    let sql = format!(
        "SELECT d.*, s.name AS strategy_name, s.symbol, s.timeframe, v.version,
                (SELECT count(*) FROM deployment_positions p WHERE p.deployment_id = d.id AND p.closed_at IS NULL) AS open_positions
         FROM deployments d JOIN strategies s ON s.id = d.strategy_id JOIN strategy_versions v ON v.id = d.version_id
         WHERE d.tenant_id = $1 AND {cond} ORDER BY d.id DESC LIMIT 200"
    );
    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql)).bind(tenant).bind(user);
    if let Some(s) = strategy {
        q = q.bind(s);
    }
    let rows = q.fetch_all(&st.pool).await?;
    Ok(rows.iter().map(view).collect())
}

pub fn view(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "userId": r.get::<i64, _>("user_id"),
        "strategyId": r.get::<i64, _>("strategy_id"),
        "strategyName": r.get::<String, _>("strategy_name"),
        "symbol": r.get::<String, _>("symbol"),
        "timeframe": r.get::<String, _>("timeframe"),
        "versionId": r.get::<i64, _>("version_id"),
        "version": r.get::<i32, _>("version"),
        "login": r.get::<i64, _>("login"),
        "accountType": r.get::<String, _>("account_type"),
        "status": r.get::<String, _>("status"),
        "risk": r.get::<Value, _>("risk"),
        "stats": r.get::<Value, _>("stats"),
        "subscriptionId": r.get::<Option<i64>, _>("subscription_id"),
        "openPositions": r.try_get::<i64, _>("open_positions").unwrap_or(0),
        "lastBarT": r.get::<Option<i64>, _>("last_bar_t"),
        "lastEvalAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_eval_at"),
        "error": r.get::<Option<String>, _>("error"),
        "stopReason": r.get::<Option<String>, _>("stop_reason"),
        "startBalance": r.get::<Option<rust_decimal::Decimal>, _>("start_balance"),
        "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        "stoppedAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("stopped_at"),
    })
}

pub async fn list(State(st): State<AppState>, u: User) -> Res {
    Ok(Json(json!({"items": rows_for(&st, &u.tenant, "d.user_id = $2", u.id, None).await?})))
}

pub fn clean_risk(v: &Value) -> Value {
    let r = v.get("risk").cloned().unwrap_or(json!({}));
    let mut out = json!({});
    if let Some(x) = f(&r, "lotMultiplier").filter(|x| *x > 0.0) {
        out["lotMultiplier"] = json!(x.min(100.0));
    }
    if let Some(x) = f(&r, "maxLots").filter(|x| *x > 0.0) {
        out["maxLots"] = json!(x);
    }
    if let Some(x) = i(&r, "maxOpenPositions").filter(|x| *x > 0) {
        out["maxOpenPositions"] = json!(x.min(50));
    }
    if let Some(x) = f(&r, "maxDailyLoss").filter(|x| *x > 0.0) {
        out["maxDailyLoss"] = json!(x);
    }
    out
}

/// Starts a version on one of the user's accounts. Used by the API and by marketplace copy subscriptions.
pub async fn start(st: &AppState, u: &User, version_id: i64, login: i64, risk: Value, subscription: Option<i64>) -> Result<i64, ApiError> {
    let (halt, why) = halted(&st.pool, &u.tenant, u.id).await;
    if halt {
        return Err(ApiError::conflict("halted", format!("Trading is halted: {why}.")));
    }
    let acct = st.engine.account(&u.tenant, u.id, login).await.map_err(|_| ApiError::unavailable("Trading service is unavailable."))?.ok_or_else(|| ApiError::not_found("Trading account"))?;
    let a = acct.get("account").cloned().unwrap_or(json!({}));
    if a.get("status").and_then(Value::as_str) != Some("active") {
        return Err(ApiError::unprocessable("account_status", "This account can't trade right now."));
    }
    let kind = a.get("type").and_then(Value::as_str).unwrap_or("demo").to_string();
    let max = settings(&st.pool, &u.tenant).await.get("maxDeploymentsPerUser").and_then(Value::as_i64).unwrap_or(10);
    let running: i64 = sqlx::query_scalar("SELECT count(*) FROM deployments WHERE tenant_id = $1 AND user_id = $2 AND status IN ('running','paused')").bind(&u.tenant).bind(u.id).fetch_one(&st.pool).await?;
    if running >= max {
        return Err(ApiError::conflict("limit", format!("You can run up to {max} strategies at a time.")));
    }
    let ver = load_version(&st.pool, &u.tenant, version_id).await?.ok_or_else(|| ApiError::not_found("Strategy version"))?;
    ver.program(&st.specs).map_err(|m| ApiError::unprocessable("invalid_strategy", m))?;
    let dup: i64 = sqlx::query_scalar("SELECT count(*) FROM deployments WHERE version_id = $1 AND login = $2 AND status IN ('running','paused')").bind(version_id).bind(login).fetch_one(&st.pool).await?;
    if dup > 0 {
        return Err(ApiError::conflict("exists", "This strategy version is already running on that account."));
    }
    let bal = a.get("balance").and_then(Value::as_f64).unwrap_or(0.0);
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO deployments (tenant_id, user_id, strategy_id, version_id, login, account_type, risk, subscription_id, start_balance, stats) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'{\"trades\":0,\"wins\":0,\"realized\":0,\"open\":0,\"orders\":0}') RETURNING id",
    )
    .bind(&u.tenant)
    .bind(u.id)
    .bind(ver.strategy_id)
    .bind(ver.id)
    .bind(login)
    .bind(&kind)
    .bind(&risk)
    .bind(subscription)
    .bind(rust_decimal::Decimal::from_f64_retain(bal).map(|d| d.round_dp(2)))
    .fetch_one(&st.pool)
    .await?;
    runtime::log(st, id, "info", "info", &format!("Deployed v{} of \"{}\" on {kind} account {login}{}", ver.version, ver.name, if risk.as_object().is_some_and(|o| !o.is_empty()) { format!(" with limits {risk}") } else { String::new() })).await;
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "deployment.start", &format!("deployment:{id}"), json!({"login": login, "version": version_id})).await;
    st.runtime_wake.notify_waiters();
    Ok(id)
}

pub async fn create(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    let sid = i(&v, "strategyId").ok_or_else(|| ApiError::validation("strategyId", "Choose a strategy."))?;
    let login = i(&v, "login").ok_or_else(|| ApiError::validation("login", "Choose a trading account."))?;
    let ver = own_version(&st.pool, &u.tenant, u.id, sid, i(&v, "versionId")).await?.ok_or_else(|| ApiError::not_found("Strategy"))?;
    if !ver.valid {
        return Err(ApiError::unprocessable("invalid_strategy", "Fix the strategy's errors before deploying it."));
    }
    let id = start(&st, &u, ver.id, login, clean_risk(&v), None).await?;
    Ok(Json(json!({"id": id, "status": "running"})))
}

async fn own(st: &AppState, u: &User, id: i64) -> Result<sqlx::postgres::PgRow, ApiError> {
    sqlx::query(
        "SELECT d.*, s.name AS strategy_name, s.symbol, s.timeframe, v.version, 0::bigint AS open_positions FROM deployments d JOIN strategies s ON s.id = d.strategy_id JOIN strategy_versions v ON v.id = d.version_id WHERE d.id = $1 AND d.tenant_id = $2 AND d.user_id = $3",
    )
    .bind(id)
    .bind(&u.tenant)
    .bind(u.id)
    .fetch_optional(&st.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Deployment"))
}

#[derive(Deserialize)]
pub struct LogQ {
    before: Option<i64>,
    limit: Option<i64>,
}

pub async fn detail(State(st): State<AppState>, u: User, Path(id): Path<i64>, Query(q): Query<LogQ>) -> Res {
    let r = own(&st, &u, id).await?;
    let mut v = view(&r);
    let logs = sqlx::query("SELECT id, at, level, kind, message FROM deployment_logs WHERE deployment_id = $1 AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT $3")
        .bind(id)
        .bind(q.before)
        .bind(q.limit.unwrap_or(200).clamp(1, 1000))
        .fetch_all(&st.pool)
        .await?;
    let positions = sqlx::query("SELECT ticket, symbol, side, volume::float8 AS volume, open_price, opened_at, closed_at, close_price, profit::float8 AS profit, reason FROM deployment_positions WHERE deployment_id = $1 ORDER BY opened_at DESC LIMIT 200")
        .bind(id)
        .fetch_all(&st.pool)
        .await?;
    let daily = sqlx::query("SELECT day, realized::float8 AS realized, trades, wins FROM deployment_daily WHERE deployment_id = $1 ORDER BY day").bind(id).fetch_all(&st.pool).await?;
    v["logs"] = json!(logs.iter().map(|l| json!({"id": l.get::<i64, _>("id"), "at": l.get::<chrono::DateTime<chrono::Utc>, _>("at"), "level": l.get::<String, _>("level"), "kind": l.get::<String, _>("kind"), "message": l.get::<String, _>("message")})).collect::<Vec<_>>());
    v["positions"] = json!(positions
        .iter()
        .map(|p| json!({"ticket": p.get::<i64, _>("ticket"), "symbol": p.get::<String, _>("symbol"), "side": p.get::<String, _>("side"), "volume": p.get::<f64, _>("volume"), "openPrice": p.get::<Option<f64>, _>("open_price"),
            "openedAt": p.get::<chrono::DateTime<chrono::Utc>, _>("opened_at"), "closedAt": p.get::<Option<chrono::DateTime<chrono::Utc>>, _>("closed_at"), "closePrice": p.get::<Option<f64>, _>("close_price"),
            "profit": p.get::<Option<f64>, _>("profit"), "reason": p.get::<Option<String>, _>("reason")}))
        .collect::<Vec<_>>());
    v["daily"] = json!(daily.iter().map(|d| json!({"day": d.get::<chrono::NaiveDate, _>("day"), "realized": d.get::<f64, _>("realized"), "trades": d.get::<i32, _>("trades"), "wins": d.get::<i32, _>("wins")})).collect::<Vec<_>>());
    // a copied marketplace strategy shows its rules only when the author allows cloning
    let hidden = match r.get::<Option<i64>, _>("subscription_id") {
        Some(sub) => !sqlx::query_scalar::<_, bool>("SELECT l.allow_clone FROM subscriptions s JOIN listings l ON l.id = s.listing_id WHERE s.id = $1").bind(sub).fetch_optional(&st.pool).await?.unwrap_or(false),
        None => false,
    };
    let ver = load_version(&st.pool, &u.tenant, r.get("version_id")).await?;
    if let Some(ver) = ver
        && let Ok(p) = ver.program(&st.specs)
    {
        if !hidden {
            v["summary"] = crate::strategy::summary(&p);
        }
        let sp = &p.spec;
        v["spec"] = json!({"symbol": sp.symbol, "timeframe": sp.timeframe, "sizing": sp.sizing, "maxLots": sp.max_lots, "sl": sp.sl, "tp": sp.tp, "trailing": sp.trailing, "sessions": sp.sessions, "days": sp.days, "maxTradesPerDay": sp.max_trades_per_day, "maxDailyLoss": sp.max_daily_loss, "oneAtATime": sp.one_at_a_time, "closeOutsideSession": sp.close_outside_session});
    }
    v["rulesHidden"] = json!(hidden);
    Ok(Json(v))
}

pub async fn dep_of(st: &AppState, id: i64) -> Result<Option<Dep>, ApiError> {
    let Some(r) = sqlx::query("SELECT d.id, d.tenant_id, d.user_id, d.login, d.status, d.version_id, d.risk, d.last_bar_t, s.name FROM deployments d JOIN strategies s ON s.id = d.strategy_id WHERE d.id = $1").bind(id).fetch_optional(&st.pool).await? else {
        return Ok(None);
    };
    let tenant: String = r.get("tenant_id");
    let ver = load_version(&st.pool, &tenant, r.get("version_id")).await?.ok_or_else(|| ApiError::not_found("Strategy version"))?;
    let prog = ver.program(&st.specs).unwrap_or_else(|_| crate::dsl::from_spec(&crate::spec::default_spec("EURUSD", "H1")));
    Ok(Some(Dep { id, tenant, user_id: r.get("user_id"), login: r.get("login"), status: r.get("status"), name: r.get("name"), program: Arc::new(prog), risk: r.get("risk"), last_bar_t: r.get("last_bar_t") }))
}

/// Stops (or kills) a deployment and optionally closes its positions. Returns (closed, failed).
pub async fn stop(st: &AppState, id: i64, status: &str, reason: &str, close: bool) -> Result<(usize, usize), ApiError> {
    sqlx::query("UPDATE deployments SET status = $2, stop_reason = $3, stopped_at = now() WHERE id = $1").bind(id).bind(status).bind(reason).execute(&st.pool).await?;
    st.runtime_wake.notify_waiters();
    runtime::log(st, id, "warn", "info", &format!("{}: {reason}", if status == "killed" { "Killed" } else { "Stopped" })).await;
    let mut res = (0, 0);
    if close && let Some(d) = dep_of(st, id).await? {
        res = close_tracked(st, &d, None, if status == "killed" { "Kill switch" } else { "Stop" }).await;
    }
    Ok(res)
}

pub async fn action(State(st): State<AppState>, u: User, Path((id, action)): Path<(i64, String)>, Body(v): Body<Value>) -> Res {
    let r = own(&st, &u, id).await?;
    let status: String = r.get("status");
    let actor = format!("user:{}", u.id);
    let live = status == "running" || status == "paused";
    match action.as_str() {
        "pause" if status == "running" => {
            sqlx::query("UPDATE deployments SET status = 'paused' WHERE id = $1").bind(id).execute(&st.pool).await?;
            runtime::log(&st, id, "info", "info", "Paused: no new entries; open positions keep their SL/TP and breakeven").await;
        }
        "resume" if status == "paused" => {
            let (halt, why) = halted(&st.pool, &u.tenant, u.id).await;
            if halt {
                return Err(ApiError::conflict("halted", format!("Trading is halted: {why}.")));
            }
            sqlx::query("UPDATE deployments SET status = 'running' WHERE id = $1").bind(id).execute(&st.pool).await?;
            runtime::log(&st, id, "info", "info", "Resumed").await;
        }
        "stop" if live => {
            let (c, fl) = stop(&st, id, "stopped", "stopped by the owner", b(&v, "closePositions").unwrap_or(false)).await?;
            audit(&st.pool, &u.tenant, &actor, "deployment.stop", &format!("deployment:{id}"), json!({"closed": c, "failed": fl})).await;
            return Ok(Json(json!({"status": "stopped", "closed": c, "failed": fl})));
        }
        "kill" => {
            let (c, fl) = stop(&st, id, "killed", "kill switch (owner)", b(&v, "closePositions").unwrap_or(true)).await?;
            audit(&st.pool, &u.tenant, &actor, "deployment.kill", &format!("deployment:{id}"), json!({"closed": c, "failed": fl})).await;
            return Ok(Json(json!({"status": "killed", "closed": c, "failed": fl})));
        }
        "close-positions" => {
            let d = dep_of(&st, id).await?.ok_or_else(|| ApiError::not_found("Deployment"))?;
            let (c, fl) = close_tracked(&st, &d, None, "Closed by the owner").await;
            return Ok(Json(json!({"closed": c, "failed": fl})));
        }
        "pause" | "resume" | "stop" => return Err(ApiError::conflict("state", format!("The deployment is {status}."))),
        _ => return Err(ApiError::not_found("Action")),
    }
    st.runtime_wake.notify_waiters();
    audit(&st.pool, &u.tenant, &actor, &format!("deployment.{action}"), &format!("deployment:{id}"), json!({})).await;
    Ok(Json(json!({"status": if action == "pause" { "paused" } else { "running" }})))
}

pub async fn controls(State(st): State<AppState>, u: User) -> Res {
    let r = sqlx::query("SELECT killed, killed_at, killed_by, reason FROM user_controls WHERE tenant_id = $1 AND user_id = $2").bind(&u.tenant).bind(u.id).fetch_optional(&st.pool).await?;
    let s = settings(&st.pool, &u.tenant).await;
    Ok(Json(json!({
        "killed": r.as_ref().map(|r| r.get::<bool, _>("killed")).unwrap_or(false),
        "killedAt": r.as_ref().and_then(|r| r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("killed_at")),
        "killedBy": r.as_ref().and_then(|r| r.get::<Option<String>, _>("killed_by")),
        "reason": r.as_ref().and_then(|r| r.get::<Option<String>, _>("reason")),
        "globalKill": s.get("globalKill").and_then(Value::as_bool).unwrap_or(false),
    })))
}

/// Closes positions opened by automation (strategy / webhook / api) on every account of the user.
pub async fn close_automation_positions(st: &AppState, tenant: &str, user: i64) -> (usize, usize) {
    let (mut ok, mut failed) = (0, 0);
    let Ok(accounts) = st.engine.accounts(tenant, user).await else { return (0, 0) };
    for a in accounts {
        let Some(login) = a.get("login").and_then(Value::as_i64) else { continue };
        let Ok(stt) = st.engine.terminal(tenant, user, login, Method::GET, "/v1/terminal/state?historyLimit=1", None).await else { continue };
        let positions = stt.body.get("positions").and_then(Value::as_array).cloned().unwrap_or_default();
        for p in positions.iter().filter(|p| matches!(p.get("source").and_then(Value::as_str), Some("strategy" | "webhook" | "api"))) {
            let Some(t) = p.get("ticket").and_then(Value::as_i64) else { continue };
            match st.engine.terminal(tenant, user, login, Method::POST, &format!("/v1/terminal/positions/{t}/close"), Some(&json!({}))).await {
                Ok(r) if r.ok() => ok += 1,
                _ => failed += 1,
            }
        }
    }
    (ok, failed)
}

/// Per-user kill switch: `{killed: bool, closePositions?: bool}`.
pub async fn kill_all(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    let killed = b(&v, "killed").ok_or_else(|| ApiError::validation("killed", "killed must be true or false"))?;
    Ok(Json(set_user_kill(&st, &u.tenant, u.id, killed, b(&v, "closePositions").unwrap_or(false), &format!("user:{}", u.id), "owner").await?))
}

pub async fn set_user_kill(st: &AppState, tenant: &str, user: i64, killed: bool, close: bool, actor: &str, reason: &str) -> Result<Value, ApiError> {
    sqlx::query(
        "INSERT INTO user_controls (tenant_id, user_id, killed, killed_at, killed_by, reason) VALUES ($1,$2,$3, CASE WHEN $3 THEN now() END, $4, $5)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET killed = $3, killed_at = CASE WHEN $3 THEN now() END, killed_by = $4, reason = $5",
    )
    .bind(tenant)
    .bind(user)
    .bind(killed)
    .bind(actor)
    .bind(reason)
    .execute(&st.pool)
    .await?;
    let mut stopped = 0;
    let (mut closed, mut failed) = (0, 0);
    if killed {
        let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM deployments WHERE tenant_id = $1 AND user_id = $2 AND status IN ('running','paused')").bind(tenant).bind(user).fetch_all(&st.pool).await?;
        let mut seen = HashSet::new();
        for id in ids {
            let (c, f) = stop(st, id, "killed", &format!("kill switch ({reason})"), close).await?;
            closed += c;
            failed += f;
            stopped += 1;
            seen.insert(id);
        }
        if close {
            let (c, f) = close_automation_positions(st, tenant, user).await;
            closed += c;
            failed += f;
        }
    }
    audit(&st.pool, tenant, actor, if killed { "controls.kill" } else { "controls.release" }, &format!("user:{user}"), json!({"stopped": stopped, "closed": closed, "failed": failed})).await;
    Ok(json!({"killed": killed, "stopped": stopped, "closed": closed, "failed": failed}))
}
