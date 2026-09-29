//! House accounts (Back Office, staff headers): platform-owned masters that run a real automated strategy
//! (services/algo "House accounts" drives these routes). The engine side is deliberately small:
//!
//! - `POST /v1/social/admin/house` opens a live account for the house user in a normal live group, books the
//!   starting capital as ledger kind `house_capital` (never a client deposit) and registers the account as an
//!   approved master flagged `is_house` (shown as "House strategy" everywhere a master is shown).
//! - `POST /v1/social/admin/house/{masterId}/capital` tops up (or, negative, withdraws) house capital.
//! - `POST /v1/social/admin/house/{masterId}/retire` stops every follower, hides the master and closes the
//!   profile (status `rejected` with a "retired" note); optionally withdraws the remaining capital and disables
//!   the account.
//!
//! Visibility on the leaderboard uses the existing `status` route (hide / unhide) and the emergency stop the
//! existing `emergency` route. Every write needs a note and is audited as `social.house.*`.

use axum::Json;
use axum::extract::{Path, State};
use chrono::Utc;
use serde_json::{Map, Value, json};

use super::social::dec;
use super::social_admin::ROLES_SOCIAL_WRITE;
use super::{ApiError, ApiResult, AppState, Body, StaffCtx};
use crate::engine::funds::{self, AdjustKind};
use crate::money::{D, ZERO, num, r2};
use crate::shard::Op;
use crate::social::Master;

fn note(b: &Map<String, Value>) -> ApiResult<String> {
    let n = b.get("note").and_then(Value::as_str).map(str::trim).unwrap_or("");
    if n.is_empty() {
        return Err(ApiError::Validation { field: "note", message: "A note (reason) is required".into() });
    }
    Ok(n.chars().take(500).collect())
}

fn house_master(st: &AppState, s: &StaffCtx, id: i64) -> ApiResult<Master> {
    st.social.reg.read().unwrap().masters.get(&id).cloned().filter(|m| m.tenant_id == s.ctx.tenant.tenant_id && m.is_house).ok_or_else(|| ApiError::NotFound("House account not found".into()))
}

fn idem(b: &Map<String, Value>) -> Option<String> {
    b.get("key").and_then(Value::as_str).map(str::trim).filter(|k| !k.is_empty() && k.len() <= 80 && k.chars().all(|c| c.is_ascii_alphanumeric() || "-_:.".contains(c))).map(str::to_string)
}

/// Books house capital (signed) on `login`. Returns (txn id, balance after).
async fn book_capital(st: &AppState, s: &StaffCtx, login: i64, amount: D, key: String, n: &str) -> ApiResult<(i64, D)> {
    let note = n.to_string();
    let op: Op = Box::new(move |tx, env| {
        let txn = funds::adjust(tx, env, AdjustKind::HouseCapital, amount, &key, "HOUSE", &note)?;
        Ok(json!({"txn": txn, "balance": num(tx.st.balance)}))
    });
    let d = st.hub.exec(login, &format!("staff:{}", s.staff.id), Some(s.staff.clone()), "HOUSE", n, None, op).await.map_err(|e| match e {
        crate::shard::ExecError::Duplicate(_) => ApiError::Conflict { code: "duplicate_idempotency_key", message: "This capital movement was already booked".into() },
        e => e.into(),
    })?;
    let bal = d.value["balance"].as_f64().and_then(crate::money::from_f64).unwrap_or(ZERO);
    Ok((d.value["txn"].as_i64().unwrap_or(0), bal))
}

/// `POST /v1/social/admin/house` — idempotent per house user: a second call for the same `userId` returns the
/// existing house master.
pub async fn provision(State(st): State<AppState>, s: StaffCtx, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let tenant = s.ctx.tenant.tenant_id;
    let user = b.get("userId").and_then(Value::as_i64).filter(|u| *u > 0).ok_or(ApiError::Validation { field: "userId", message: "userId (the house user) is required".into() })?;
    let existing = st.social.reg.read().unwrap().masters.values().find(|m| m.tenant_id == tenant && m.user_id == user && m.is_house && m.status != "rejected").cloned();
    if let Some(m) = existing {
        return Ok(Json(json!({"master": st.social.master_view(&m, None, true).await, "login": m.login, "created": false})));
    }
    let nickname = b.get("nickname").and_then(Value::as_str).map(str::trim).unwrap_or("");
    if nickname.chars().count() < 3 || nickname.chars().count() > 32 || !nickname.chars().all(|c| c.is_alphanumeric() || " ._-".contains(c)) {
        return Err(ApiError::Validation { field: "nickname", message: "Nickname: 3–32 letters, digits, spaces, dots, dashes".into() });
    }
    if st.social.reg.read().unwrap().masters.values().any(|m| m.tenant_id == tenant && m.status != "rejected" && m.nickname.eq_ignore_ascii_case(nickname)) {
        return Err(ApiError::Conflict { code: "exists", message: "This nickname is taken".into() });
    }
    let group = b.get("group").and_then(Value::as_str).unwrap_or("standard").to_string();
    {
        let t = st.hub.shared.registry.get(tenant).ok_or_else(|| ApiError::NotFound("Tenant not found".into()))?;
        let g = t.groups.get(&group).ok_or(ApiError::Validation { field: "group", message: format!("Group {group} does not exist") })?;
        if g.account_types == "demo" || matches!(g.code.as_str(), "copy" | "copy-netting" | "pamm" | "prop") || g.cent {
            return Err(ApiError::Validation { field: "group", message: "House accounts use a normal live USD group".into() });
        }
    }
    let capital = dec(b.get("capital"), "capital")?.map(r2).unwrap_or(ZERO);
    if capital < D::from(100) || capital > D::from(10_000_000) {
        return Err(ApiError::Validation { field: "capital", message: "Capital must be between 100 and 10,000,000 USD".into() });
    }
    let settings = st.social.settings(tenant);
    let fee = dec(b.get("perfFeePct"), "perfFeePct")?.unwrap_or(ZERO);
    if fee < settings.fee_min_pct || fee > settings.fee_max_pct {
        return Err(ApiError::Status { status: 422, code: "fee_out_of_range", message: format!("The performance fee must be between {}% and {}%", settings.fee_min_pct.normalize(), settings.fee_max_pct.normalize()) });
    }
    let period = b.get("feePeriod").and_then(Value::as_str).unwrap_or("monthly").to_string();
    if !crate::social::valid_period(&period) {
        return Err(ApiError::Validation { field: "feePeriod", message: "feePeriod must be daily, weekly or monthly".into() });
    }
    let min_alloc = dec(b.get("minAllocation"), "minAllocation")?.unwrap_or(ZERO).max(ZERO);
    let strategy: String = b.get("strategy").and_then(Value::as_str).unwrap_or("").trim().chars().take(80).collect();
    let description: String = b.get("description").and_then(Value::as_str).unwrap_or("").trim().chars().take(2000).collect();
    let key = idem(&b).unwrap_or_else(|| format!("u{user}"));

    // 1. the trading account (a normal live account of the house user)
    let (login, _, _) = st.social.open_account(tenant, user, &group, &format!("{nickname} (house)")).await?;
    // 2. house capital
    let (txn, _) = book_capital(&st, &s, login, capital, format!("house:{key}:capital:initial"), &n).await?;
    // 3. the approved house master
    let checks = json!([{"key": "house", "ok": true, "label": "House account", "detail": "Operated by the broker: a platform-owned account running an automated strategy"}]);
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO social_masters (tenant_id, user_id, login, nickname, strategy, description, program, perf_fee_pct, fee_period, min_allocation, status, kyc_verified, checks,
                                     review_note, reviewed_by, approved_at, is_house)
         VALUES ($1,$2,$3,$4,$5,$6,'copy',$7,$8,$9,'approved',false,$10,$11,$12,now(),true) RETURNING id",
    )
    .bind(tenant)
    .bind(user)
    .bind(login)
    .bind(nickname)
    .bind(&strategy)
    .bind(&description)
    .bind(fee)
    .bind(&period)
    .bind(min_alloc)
    .bind(sqlx::types::Json(checks))
    .bind(format!("House account: {n}"))
    .bind(&s.staff.name)
    .fetch_one(&st.pool)
    .await?;
    let reloaded = crate::social::load(&st.pool).await?;
    let m = reloaded.masters.get(&id).cloned().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("house master vanished")))?;
    st.social.save_master(&m).await?;
    st.social.snapshot_all().await;
    let a = st
        .social
        .audit(tenant, &s.staff, "social.house.provision", Some(login), &format!("master:{id}"), None, Some(json!({"masterId": id, "nickname": m.nickname, "userId": user, "login": login, "group": group, "capital": num(capital), "txn": txn})), &n)
        .await;
    tracing::info!(master = id, login, user, "house account provisioned");
    Ok(Json(json!({"master": st.social.master_view(&m, None, true).await, "login": login, "created": true, "audit": [a]})))
}

/// `POST /v1/social/admin/house/{id}/capital {amount, key?, note}` — signed: a top-up or a withdrawal of house capital.
pub async fn capital(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let m = house_master(&st, &s, id)?;
    if m.status == "rejected" {
        return Err(ApiError::Conflict { code: "master_status", message: "This house account was retired".into() });
    }
    let amount = dec(b.get("amount"), "amount")?.map(r2).unwrap_or(ZERO);
    if amount.is_zero() || amount.abs() > D::from(10_000_000) {
        return Err(ApiError::Validation { field: "amount", message: "Amount must be non-zero and at most 10,000,000 USD".into() });
    }
    let key = idem(&b).unwrap_or_else(|| crate::auth::random_token(12));
    let before = st.social.account_brief(m.login).await.map(|x| num(r2(x.balance)));
    let (txn, bal) = book_capital(&st, &s, m.login, amount, format!("house:{id}:capital:{key}"), &n).await?;
    st.social.snapshot_all().await;
    let a = st
        .social
        .audit(m.tenant_id, &s.staff, if amount > ZERO { "social.house.capital_topup" } else { "social.house.capital_withdraw" }, Some(m.login), &format!("master:{id}"), Some(json!({"balance": before})), Some(json!({"balance": num(bal), "amount": num(amount), "txn": txn})), &n)
        .await;
    Ok(Json(json!({"masterId": id, "login": m.login, "amount": num(amount), "balance": num(bal), "txn": txn, "audit": [a]})))
}

/// `POST /v1/social/admin/house/{id}/retire {note, withdrawCapital?}` — the house account stops being a master.
/// Followers are stopped (their copied positions closed). The caller (algo) stops the strategy and closes the
/// house account's own positions first; with `withdrawCapital` the remaining free balance goes back to
/// `house:house_capital` and the account is disabled.
pub async fn retire(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let mut m = house_master(&st, &s, id)?;
    if m.status == "rejected" {
        return Ok(Json(json!({"masterId": id, "retired": true, "already": true})));
    }
    let before = json!({"status": m.status, "hidden": m.hidden});
    let subs: Vec<i64> = st.social.reg.read().unwrap().subs_of(id).into_iter().filter(|x| x.status != "stopped").map(|x| x.id).collect();
    let mut stopped = 0;
    for sid in subs {
        match st.social.stop_sub(sid, "admin", true, false).await {
            Ok(_) => stopped += 1,
            Err(e) => tracing::warn!(sub = sid, error = %e, "house retire: stopping a follower failed"),
        }
    }
    m.status = "rejected".into();
    m.hidden = true;
    m.review_note = Some(format!("Retired house account: {n}"));
    m.reviewed_by = Some(s.staff.name.clone());
    st.social.save_master(&m).await?;
    let mut withdrawn = Value::Null;
    if b.get("withdrawCapital").and_then(Value::as_bool).unwrap_or(false)
        && let Some(br) = st.social.account_brief(m.login).await
    {
        if br.positions > 0 {
            return Err(ApiError::Conflict { code: "open_positions", message: "Close the house account's positions before withdrawing its capital".into() });
        }
        let amt = r2(br.balance);
        if amt > ZERO {
            let (txn, _) = book_capital(&st, &s, m.login, -amt, format!("house:{id}:capital:retire"), &n).await?;
            withdrawn = json!({"amount": num(amt), "txn": txn});
        }
        let op: Op = Box::new(|tx, _| {
            let _ = funds::set_status(tx, crate::model::Status::Disabled);
            Ok(json!({}))
        });
        let _ = st.hub.exec(m.login, &format!("staff:{}", s.staff.id), Some(s.staff.clone()), "HOUSE", &n, None, op).await;
    }
    let a = st
        .social
        .audit(m.tenant_id, &s.staff, "social.house.retire", Some(m.login), &format!("master:{id}"), Some(before), Some(json!({"status": "retired", "followersStopped": stopped, "withdrawn": withdrawn, "at": Utc::now()})), &n)
        .await;
    Ok(Json(json!({"masterId": id, "retired": true, "followersStopped": stopped, "withdrawn": withdrawn, "audit": [a]})))
}
