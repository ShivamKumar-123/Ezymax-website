//! Back Office: house accounts (README "House accounts"). The admin BFF checks social.read / social.write
//! first; the roles are checked again here and the engine checks them once more for its own writes. Every
//! write needs a note and is written to the audit log (`house.*` here, `social.house.*` / `social.master.*`
//! in the engine).

use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use sqlx::Row as _;

use super::{Body, Res, b, f, s};
use crate::api::deployments;
use crate::error::ApiError;
use crate::house::{self, DEFAULT_CAPITAL, PRESETS, Row, preset, preset_json};
use crate::runtime;
use crate::state::{AppState, Staff, User, audit};

/// Same roles as the Back Office `social.write` permission (services/trading ROLES_SOCIAL_WRITE).
pub const HOUSE_WRITE_ROLES: [&str; 4] = ["platform_owner", "super_admin", "admin", "risk_manager"];

fn note(v: &Value) -> Result<String, ApiError> {
    s(v, "note").map(|n| n.chars().take(500).collect()).ok_or_else(|| ApiError::validation("note", "Add a note for the audit log."))
}

fn capital(v: &Value) -> Result<f64, ApiError> {
    let c = f(v, "capital").unwrap_or(DEFAULT_CAPITAL);
    if !(100.0..=10_000_000.0).contains(&c) {
        return Err(ApiError::validation("capital", "Capital must be between 100 and 10,000,000 USD."));
    }
    Ok((c * 100.0).round() / 100.0)
}

fn ts(r: &sqlx::postgres::PgRow, k: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(k).ok().flatten()
}

/// One house account with the live state of everything it points at.
async fn view(st: &AppState, r: &Row, master: Option<&Value>) -> Result<Value, ApiError> {
    let p = preset(&r.preset);
    let mut v = json!({
        "id": r.id, "preset": r.preset, "nickname": r.nickname, "capital": r.capital, "userId": r.user_id, "login": r.login, "masterId": r.master_id,
        "strategyId": r.strategy_id, "versionId": r.version_id, "backtestId": r.backtest_id, "deploymentId": r.deployment_id, "listingId": r.listing_id,
        "enabled": r.enabled, "visible": r.visible, "status": r.status, "error": r.error, "createdBy": r.created_by, "createdAt": r.created_at,
        "symbol": p.map(|p| p.symbol), "timeframe": p.map(|p| p.timeframe), "strategy": p.map(|p| p.strategy),
    });
    if let Some(dep) = r.deployment_id
        && let Some(d) = sqlx::query(
            "SELECT status, last_eval_at, last_bar_t, stats, error, stop_reason, created_at,
                    (SELECT count(*) FROM deployment_positions p WHERE p.deployment_id = d.id AND p.closed_at IS NULL) AS open_positions,
                    (SELECT max(at) FROM deployment_logs l WHERE l.deployment_id = d.id AND l.kind = 'signal') AS last_signal_at,
                    (SELECT max(at) FROM deployment_logs l WHERE l.deployment_id = d.id AND l.kind = 'order') AS last_order_at
             FROM deployments d WHERE d.id = $1",
        )
        .bind(dep)
        .fetch_optional(&st.pool)
        .await?
    {
        v["deployment"] = json!({"id": dep, "status": d.get::<String, _>("status"), "lastEvalAt": ts(&d, "last_eval_at"), "lastBarT": d.get::<Option<i64>, _>("last_bar_t"),
            "stats": d.get::<Value, _>("stats"), "error": d.get::<Option<String>, _>("error"), "stopReason": d.get::<Option<String>, _>("stop_reason"),
            "openPositions": d.get::<i64, _>("open_positions"), "lastSignalAt": ts(&d, "last_signal_at"), "lastOrderAt": ts(&d, "last_order_at"), "since": ts(&d, "created_at")});
    }
    if let Some(bt) = r.backtest_id
        && let Some(x) = sqlx::query("SELECT status, progress, summary, error, params, finished_at FROM backtests WHERE id = $1").bind(bt).fetch_optional(&st.pool).await?
    {
        v["backtest"] = json!({"id": bt, "status": x.get::<String, _>("status"), "progress": x.get::<f32, _>("progress"), "summary": x.get::<Option<Value>, _>("summary"),
            "error": x.get::<Option<String>, _>("error"), "params": x.get::<Value, _>("params"), "finishedAt": ts(&x, "finished_at")});
    }
    if let Some(l) = r.listing_id
        && let Some(x) = sqlx::query("SELECT status, subscribers FROM listings WHERE id = $1").bind(l).fetch_optional(&st.pool).await?
    {
        v["listing"] = json!({"id": l, "status": x.get::<String, _>("status"), "subscribers": x.get::<i32, _>("subscribers")});
    }
    if let Some(m) = master {
        v["master"] = json!({"id": m["id"], "status": m["status"], "hidden": m["hidden"], "frozen": m["frozen"], "stats": m["stats"], "since": m["since"]});
    }
    Ok(v)
}

async fn masters(st: &AppState, sf: &Staff) -> std::collections::HashMap<i64, Value> {
    let mut out = std::collections::HashMap::new();
    if let Ok(r) = st.engine.staff_call(reqwest::Method::GET, "/v1/social/admin/masters?status=all", sf, None).await
        && r.ok()
    {
        for m in r.body.get("items").and_then(Value::as_array).cloned().unwrap_or_default() {
            if let Some(id) = m.get("id").and_then(Value::as_i64) {
                out.insert(id, m);
            }
        }
    }
    out
}

pub async fn list(State(st): State<AppState>, sf: Staff) -> Res {
    let rows = house::list(&st, &sf.tenant).await?;
    let ms = masters(&st, &sf).await;
    let mut items = vec![];
    for r in &rows {
        items.push(view(&st, r, r.master_id.and_then(|m| ms.get(&m))).await?);
    }
    let enabled = house::master_switch(&st, &sf.tenant).await;
    let upd = sqlx::query("SELECT updated_by, updated_at FROM house_settings WHERE tenant_id = $1").bind(&sf.tenant).fetch_optional(&st.pool).await?;
    let presets: Vec<Value> = PRESETS
        .iter()
        .map(|p| {
            let mut v = preset_json(p);
            v["houseId"] = json!(rows.iter().find(|r| r.preset == p.key).map(|r| r.id));
            v
        })
        .collect();
    let sum = |k: &str| items.iter().map(|i| i["master"]["stats"][k].as_f64().unwrap_or(0.0)).sum::<f64>();
    Ok(Json(json!({
        "settings": {"enabled": enabled, "updatedBy": upd.as_ref().and_then(|u| u.get::<Option<String>, _>("updated_by")), "updatedAt": upd.as_ref().map(|u| u.get::<chrono::DateTime<chrono::Utc>, _>("updated_at")),
                     "defaultCapital": DEFAULT_CAPITAL, "dailyLossPct": house::DAILY_LOSS_PCT, "group": house::GROUP},
        "items": items,
        "presets": presets,
        "totals": {"accounts": rows.len(), "on": rows.iter().filter(|r| enabled && r.enabled && r.status == "active").count(), "capital": rows.iter().map(|r| r.capital).sum::<f64>(),
                   "equity": sum("equity"), "followers": sum("followers"), "aum": sum("aum")},
    })))
}

pub async fn detail(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>) -> Res {
    let r = house::load(&st, &sf.tenant, id).await?;
    let ms = masters(&st, &sf).await;
    let mut v = view(&st, &r, r.master_id.and_then(|m| ms.get(&m))).await?;
    if let Some(bt) = r.backtest_id
        && let Some(x) = sqlx::query("SELECT report FROM backtests WHERE id = $1 AND status = 'done'").bind(bt).fetch_optional(&st.pool).await?
        && let Some(rep) = x.get::<Option<Value>, _>("report")
    {
        v["backtest"]["report"] = json!({"metrics": rep["metrics"], "equity": rep["equity"], "monthly": rep["monthly"], "notes": rep["notes"], "coverage": rep["coverage"], "model": rep["model"], "signals": rep["signals"], "firstBar": rep["firstBar"], "lastBar": rep["lastBar"]});
    }
    if let Some(dep) = r.deployment_id {
        let logs = sqlx::query("SELECT at, level, kind, message FROM deployment_logs WHERE deployment_id = $1 ORDER BY id DESC LIMIT 60").bind(dep).fetch_all(&st.pool).await?;
        v["logs"] = json!(logs.iter().map(|l| json!({"at": l.get::<chrono::DateTime<chrono::Utc>, _>("at"), "level": l.get::<String, _>("level"), "kind": l.get::<String, _>("kind"), "message": l.get::<String, _>("message")})).collect::<Vec<_>>());
        let pos = sqlx::query("SELECT ticket, symbol, side, volume::float8 AS volume, open_price, opened_at, closed_at, close_price, profit::float8 AS profit, reason FROM deployment_positions WHERE deployment_id = $1 ORDER BY opened_at DESC LIMIT 50").bind(dep).fetch_all(&st.pool).await?;
        v["positions"] = json!(pos
            .iter()
            .map(|p| json!({"ticket": p.get::<i64, _>("ticket"), "symbol": p.get::<String, _>("symbol"), "side": p.get::<String, _>("side"), "volume": p.get::<f64, _>("volume"), "openPrice": p.get::<Option<f64>, _>("open_price"),
                "openedAt": p.get::<chrono::DateTime<chrono::Utc>, _>("opened_at"), "closedAt": ts(p, "closed_at"), "closePrice": p.get::<Option<f64>, _>("close_price"), "profit": p.get::<Option<f64>, _>("profit"), "reason": p.get::<Option<String>, _>("reason")}))
            .collect::<Vec<_>>());
    }
    if let Some(vid) = r.version_id
        && let Some(x) = sqlx::query("SELECT source FROM strategy_versions WHERE id = $1").bind(vid).fetch_optional(&st.pool).await?
    {
        v["source"] = json!(x.get::<Option<String>, _>("source"));
    }
    v["description"] = json!(preset(&r.preset).map(|p| p.description));
    let a = sqlx::query("SELECT at, actor, action, data FROM audit_log WHERE tenant_id = $1 AND target = $2 ORDER BY id DESC LIMIT 40").bind(&sf.tenant).bind(format!("house:{id}")).fetch_all(&st.pool).await?;
    v["audit"] = json!(a.iter().map(|x| json!({"at": x.get::<chrono::DateTime<chrono::Utc>, _>("at"), "actor": x.get::<String, _>("actor"), "action": x.get::<String, _>("action"), "data": x.get::<Value, _>("data")})).collect::<Vec<_>>());
    Ok(Json(v))
}

pub async fn provision(State(st): State<AppState>, sf: Staff, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let p = s(&v, "preset").and_then(preset).ok_or_else(|| ApiError::validation("preset", "Choose one of the presets."))?;
    let id = house::create(&st, &sf, p, capital(&v)?).await?;
    let r = house::advance(&st, &sf, id, &n).await?;
    Ok(Json(json!({"item": view(&st, &r, None).await?})))
}

/// One click: provisions every preset that has no house account yet (the production seeding path).
pub async fn seed(State(st): State<AppState>, sf: Staff, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let cap = capital(&v)?;
    let existing: Vec<String> = house::list(&st, &sf.tenant).await?.into_iter().map(|r| r.preset).collect();
    let (mut created, mut failed) = (vec![], vec![]);
    for p in PRESETS.iter().filter(|p| !existing.iter().any(|e| e == p.key)) {
        match house::create(&st, &sf, p, cap).await {
            Ok(id) => match house::advance(&st, &sf, id, &n).await {
                Ok(_) => created.push(json!({"preset": p.key, "id": id})),
                Err(e) => failed.push(json!({"preset": p.key, "id": id, "error": format!("{e:?}")})),
            },
            Err(e) => failed.push(json!({"preset": p.key, "error": format!("{e:?}")})),
        }
    }
    audit(&st.pool, &sf.tenant, &sf.actor(), "house.seed", "house:all", json!({"note": n, "capital": cap, "created": created, "failed": failed})).await;
    Ok(Json(json!({"created": created, "failed": failed, "skipped": existing.len()})))
}

/// Resumes a failed provisioning, or redeploys an active account whose deployment was stopped or killed.
pub async fn retry(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let r = house::load(&st, &sf.tenant, id).await?;
    match r.status.as_str() {
        "failed" | "provisioning" => {
            let r = house::advance(&st, &sf, id, &n).await?;
            return Ok(Json(json!({"item": view(&st, &r, None).await?})));
        }
        "active" => {}
        other => return Err(ApiError::conflict("state", format!("The house account is {other}."))),
    }
    let (Some(dep), Some(user), Some(login), Some(vid)) = (r.deployment_id, r.user_id, r.login, r.version_id) else { return Err(ApiError::conflict("state", "Nothing to retry.")) };
    let status: String = sqlx::query_scalar("SELECT status FROM deployments WHERE id = $1").bind(dep).fetch_one(&st.pool).await?;
    if matches!(status.as_str(), "running" | "paused") {
        return Err(ApiError::conflict("state", "The strategy is already deployed."));
    }
    let u = User { tenant: r.tenant.clone(), id: user, name: r.nickname.clone() };
    let d = deployments::start(&st, &u, vid, login, json!({}), None).await?;
    runtime::log(&st, d, "info", "info", &format!("House account \"{}\" redeployed by {} (previous deployment #{dep} was {status})", r.nickname, sf.name)).await;
    sqlx::query("UPDATE house_accounts SET deployment_id = $2, updated_at = now() WHERE id = $1").bind(id).bind(d).execute(&st.pool).await?;
    if let Some(l) = r.listing_id {
        sqlx::query("UPDATE listings SET track_deployment_id = $2, updated_at = now() WHERE id = $1").bind(l).bind(d).execute(&st.pool).await?;
    }
    audit(&st.pool, &sf.tenant, &sf.actor(), "house.redeploy", &format!("house:{id}"), json!({"note": n, "from": dep, "to": d})).await;
    let applied = house::apply(&st, &sf, id, false, &n).await?;
    Ok(Json(json!({"item": view(&st, &house::load(&st, &sf.tenant, id).await?, None).await?, "applied": applied})))
}

pub async fn switch(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let enabled = b(&v, "enabled").ok_or_else(|| ApiError::validation("enabled", "enabled must be true or false"))?;
    let r = house::load(&st, &sf.tenant, id).await?;
    sqlx::query("UPDATE house_accounts SET enabled = $2, updated_at = now() WHERE id = $1").bind(id).bind(enabled).execute(&st.pool).await?;
    let applied = house::apply(&st, &sf, id, b(&v, "closePositions").unwrap_or(false), &n).await?;
    audit(&st.pool, &sf.tenant, &sf.actor(), if enabled { "house.on" } else { "house.off" }, &format!("house:{id}"), json!({"note": n, "before": r.enabled, "applied": applied})).await;
    Ok(Json(json!({"item": view(&st, &house::load(&st, &sf.tenant, id).await?, None).await?, "applied": applied})))
}

pub async fn visibility(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let visible = b(&v, "visible").ok_or_else(|| ApiError::validation("visible", "visible must be true or false"))?;
    let r = house::load(&st, &sf.tenant, id).await?;
    sqlx::query("UPDATE house_accounts SET visible = $2, updated_at = now() WHERE id = $1").bind(id).bind(visible).execute(&st.pool).await?;
    let applied = house::apply(&st, &sf, id, false, &n).await?;
    audit(&st.pool, &sf.tenant, &sf.actor(), if visible { "house.show" } else { "house.hide" }, &format!("house:{id}"), json!({"note": n, "before": r.visible, "applied": applied})).await;
    Ok(Json(json!({"item": view(&st, &house::load(&st, &sf.tenant, id).await?, None).await?, "applied": applied})))
}

pub async fn top_up(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let amount = f(&v, "amount").filter(|a| *a != 0.0 && a.abs() <= 10_000_000.0).ok_or_else(|| ApiError::validation("amount", "Enter a non-zero amount up to 10,000,000 USD (negative withdraws capital)."))?;
    let r = house::load(&st, &sf.tenant, id).await?;
    let m = r.master_id.filter(|_| r.status == "active").ok_or_else(|| ApiError::conflict("state", "The house account is not active."))?;
    let key = format!("h{id}-{}", chrono::Utc::now().timestamp_millis());
    let rep = st
        .engine
        .staff_call(reqwest::Method::POST, &format!("/v1/social/admin/house/{m}/capital"), &sf, Some(&json!({"amount": amount, "key": key, "note": n})))
        .await
        .map_err(|_| ApiError::unavailable("Trading service is unavailable."))?;
    if !rep.ok() {
        return Err(rep.into_error());
    }
    sqlx::query("UPDATE house_accounts SET capital = capital + $2, updated_at = now() WHERE id = $1").bind(id).bind(rust_decimal::Decimal::from_f64_retain(amount).map(|d| d.round_dp(2)).unwrap_or_default()).execute(&st.pool).await?;
    audit(&st.pool, &sf.tenant, &sf.actor(), if amount > 0.0 { "house.capital_topup" } else { "house.capital_withdraw" }, &format!("house:{id}"), json!({"note": n, "amount": amount, "txn": rep.body["txn"], "balance": rep.body["balance"]})).await;
    Ok(Json(json!({"item": view(&st, &house::load(&st, &sf.tenant, id).await?, None).await?, "balance": rep.body["balance"], "txn": rep.body["txn"]})))
}

/// Retires the house account: stops the strategy and closes its positions, unlists the listing, and in the
/// engine stops every follower, closes the master profile and (by default) withdraws the remaining capital.
/// The trading history stays on the account; nothing is deleted from the ledger.
pub async fn remove(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let r = house::load(&st, &sf.tenant, id).await?;
    if r.status == "retired" {
        return Err(ApiError::conflict("state", "Already deleted."));
    }
    let (mut closed, mut failed) = (0, 0);
    if let Some(dep) = r.deployment_id {
        let status: String = sqlx::query_scalar("SELECT status FROM deployments WHERE id = $1").bind(dep).fetch_one(&st.pool).await?;
        if matches!(status.as_str(), "running" | "paused") {
            let (c, fl) = deployments::stop(&st, dep, "stopped", &format!("house account deleted by {} ({n})", sf.name), true).await?;
            closed += c;
            failed += fl;
        } else if let Some(d) = deployments::dep_of(&st, dep).await? {
            let (c, fl) = runtime::close_tracked(&st, &d, None, "House account deleted").await;
            closed += c;
            failed += fl;
        }
    }
    if let Some(l) = r.listing_id {
        sqlx::query("UPDATE listings SET status = 'unlisted', moderation_note = 'House account deleted', updated_at = now() WHERE id = $1").bind(l).execute(&st.pool).await?;
    }
    let mut engine = Value::Null;
    if let Some(m) = r.master_id {
        let rep = st
            .engine
            .staff_call(reqwest::Method::POST, &format!("/v1/social/admin/house/{m}/retire"), &sf, Some(&json!({"note": n, "withdrawCapital": b(&v, "withdrawCapital").unwrap_or(true) && failed == 0})))
            .await
            .map_err(|_| ApiError::unavailable("Trading service is unavailable."))?;
        if !rep.ok() {
            return Err(rep.into_error());
        }
        engine = rep.body;
    }
    sqlx::query("UPDATE house_accounts SET status = 'retired', enabled = false, retired_at = now(), updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
    audit(&st.pool, &sf.tenant, &sf.actor(), "house.delete", &format!("house:{id}"), json!({"note": n, "closed": closed, "failedToClose": failed, "followersStopped": engine["followersStopped"], "withdrawn": engine["withdrawn"]})).await;
    Ok(Json(json!({"id": id, "status": "retired", "closed": closed, "failedToClose": failed, "engine": engine})))
}

/// Master switch: off pauses and hides every house account (their own switches are kept for when it is
/// turned back on).
pub async fn put_settings(State(st): State<AppState>, sf: Staff, Body(v): Body<Value>) -> Res {
    sf.require(&HOUSE_WRITE_ROLES)?;
    let n = note(&v)?;
    let enabled = b(&v, "enabled").ok_or_else(|| ApiError::validation("enabled", "enabled must be true or false"))?;
    let close = b(&v, "closePositions").unwrap_or(false);
    let before = house::master_switch(&st, &sf.tenant).await;
    sqlx::query("INSERT INTO house_settings (tenant_id, enabled, updated_by, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (tenant_id) DO UPDATE SET enabled = $2, updated_by = $3, updated_at = now()")
        .bind(&sf.tenant)
        .bind(enabled)
        .bind(format!("{} (staff:{})", sf.name, sf.id))
        .execute(&st.pool)
        .await?;
    let mut results = vec![];
    for r in house::list(&st, &sf.tenant).await? {
        match house::apply(&st, &sf, r.id, close, &n).await {
            Ok(x) => results.push(json!({"id": r.id, "applied": x})),
            Err(e) => results.push(json!({"id": r.id, "error": format!("{e:?}")})),
        }
    }
    audit(&st.pool, &sf.tenant, &sf.actor(), if enabled { "house.master_on" } else { "house.master_off" }, "house:all", json!({"note": n, "before": before, "closePositions": close, "results": results})).await;
    Ok(Json(json!({"enabled": enabled, "results": results})))
}
