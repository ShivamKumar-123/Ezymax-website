//! Social trading API for the Client Area BFF (copy trading and PAMM, D65–D76). The BFF sends the signed-in
//! gateway user in `X-Kalks-User-Id` and the user's KYC status in `X-Kalks-Kyc`. Public reads (leaderboard,
//! master profile, funds) work without a user. See README "Social API".

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::Row;

use super::{ApiError, ApiResult, AppState, Body, Ctx};
use crate::money::{D, ZERO, de_opt_dec, num, r2};
use crate::social::math::{Sizing, SizingMode};
use crate::social::pamm::SocErr;
use crate::social::{Master, Social, sub_json, valid_period};

pub fn soc(e: SocErr) -> ApiError {
    ApiError::Status { status: e.status, code: e.code, message: e.message }
}

fn bad(code: &'static str, message: impl Into<String>) -> ApiError {
    soc(SocErr::new(code, message))
}

pub fn user(h: &HeaderMap) -> ApiResult<i64> {
    h.get("x-kalks-user-id").and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse::<i64>().ok()).filter(|v| *v > 0).ok_or(ApiError::Validation { field: "user_id", message: "X-Kalks-User-Id is required".into() })
}

fn kyc(h: &HeaderMap) -> String {
    h.get("x-kalks-kyc").and_then(|v| v.to_str().ok()).unwrap_or("unverified").trim().to_lowercase()
}

fn social(st: &AppState) -> &Social {
    &st.social
}

/// D from a JSON value (number or numeric string); Ok(None) for absent / null.
pub fn dec(v: Option<&Value>, field: &'static str) -> ApiResult<Option<D>> {
    match v {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(n)) => crate::money::from_f64(n.as_f64().unwrap_or(f64::NAN)).map(Some).ok_or(ApiError::Validation { field, message: format!("{field} is not a number") }),
        Some(Value::String(s)) => s.trim().parse::<D>().map(Some).map_err(|_| ApiError::Validation { field, message: format!("{field} is not a number") }),
        _ => Err(ApiError::Validation { field, message: format!("{field} is not a number") }),
    }
}

fn master_of_user(st: &AppState, tenant: i64, user: i64) -> Option<Master> {
    let reg = st.social.reg.read().unwrap();
    reg.masters.values().filter(|m| m.tenant_id == tenant && m.user_id == user).max_by_key(|m| (m.status != "rejected", m.id)).cloned()
}

/* ------------------------------------------------------------------ */
/* Leaderboard and master profiles (public)                            */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardQ {
    period: Option<String>,
    program: Option<String>,
    sort: Option<String>,
    risk: Option<String>,
    min_days: Option<i64>,
}

pub async fn leaderboard(State(st): State<AppState>, ctx: Ctx, Query(q): Query<BoardQ>) -> ApiResult<Json<Value>> {
    let so = social(&st);
    let masters: Vec<Master> = so.reg.read().unwrap().masters.values().filter(|m| m.tenant_id == ctx.tenant.tenant_id && m.status == "approved" && !m.hidden).cloned().collect();
    let logins: Vec<i64> = masters.iter().map(|m| m.login).collect();
    let mut points = so.points(&logins).await;
    let mut items: Vec<Value> = Vec::new();
    for m in &masters {
        let s = so.stats_for(m.login, points.remove(&m.login).unwrap_or_default()).await;
        items.push(so.master_view(m, Some(&s), false).await);
    }
    let program = q.program.as_deref().unwrap_or("all");
    let risk = q.risk.as_deref().unwrap_or("all");
    let min_days = q.min_days.unwrap_or(0);
    items.retain(|v| {
        let p = v["program"].as_str().unwrap_or("");
        let has_fund = !v["fund"].is_null();
        let r = v["stats"]["riskScore"].as_u64().unwrap_or(1);
        (match program {
            "copy" => p == "copy" || p == "both",
            "pamm" => (p == "pamm" || p == "both") && has_fund,
            _ => true,
        }) && (match risk {
            "low" => r <= 3,
            "med" => (4..=6).contains(&r),
            "high" => r >= 7,
            _ => true,
        }) && v["ageDays"].as_i64().unwrap_or(0) >= min_days
    });
    let period_key = match q.period.as_deref().unwrap_or("1y") {
        "1m" => "return1m",
        "3m" => "return3m",
        "all" => "returnAll",
        _ => "return1y",
    };
    let f = |v: &Value, k: &str| v["stats"][k].as_f64().unwrap_or(0.0);
    match q.sort.as_deref().unwrap_or("return") {
        "dd" => items.sort_by(|a, b| f(a, "maxDd").total_cmp(&f(b, "maxDd"))),
        "aum" => items.sort_by(|a, b| f(b, "aum").total_cmp(&f(a, "aum"))),
        "followers" => items.sort_by(|a, b| f(b, "followers").total_cmp(&f(a, "followers"))),
        "age" => items.sort_by_key(|v| -v["ageDays"].as_i64().unwrap_or(0)),
        _ => items.sort_by(|a, b| f(b, period_key).total_cmp(&f(a, period_key))),
    }
    let totals = json!({
        "masters": items.len(),
        "aum": items.iter().map(|v| f(v, "aum")).fold(0.0, |a, b| a + b),
        "followers": items.iter().map(|v| f(v, "followers")).sum::<f64>() as i64,
        "investors": items.iter().map(|v| f(v, "investors")).sum::<f64>() as i64,
    });
    Ok(Json(json!({"items": items, "totals": totals})))
}

pub async fn master_profile(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let so = social(&st);
    let m = so.reg.read().unwrap().masters.get(&id).cloned().filter(|m| m.tenant_id == ctx.tenant.tenant_id && m.live()).ok_or_else(|| ApiError::NotFound("Master not found".into()))?;
    let pts = so.points(&[m.login]).await.remove(&m.login).unwrap_or_default();
    let s = so.stats_for(m.login, pts).await;
    let settings = so.settings(m.tenant_id);
    let equity: Vec<Value> = s.points.iter().zip(s.series.iter()).map(|(p, (_, idx))| json!({"day": p.day, "equity": (p.equity * 100.0).round() / 100.0, "index": (idx * 10000.0).round() / 10000.0})).collect();
    let monthly: Vec<Value> = crate::social::math::monthly_returns(&s.series).into_iter().map(|(m, r)| json!({"month": m, "returnPct": (r * 100.0).round() / 100.0})).collect();
    Ok(Json(json!({
        "master": so.master_view(&m, Some(&s), false).await,
        "equity": equity,
        "monthly": monthly,
        "trades": so.delayed_trades(m.login, settings.trade_delay_minutes, 100).await,
        "symbols": so.symbol_mix(m.login).await,
        "tradeDelayMinutes": settings.trade_delay_minutes,
        "terms": {"perfFeePct": num(m.perf_fee_pct), "feePeriod": m.fee_period, "hwm": true, "minAllocation": num(m.min_allocation.max(settings.min_allocation)), "platformCutPct": num(settings.platform_cut_pct)},
    })))
}

/* ------------------------------------------------------------------ */
/* Becoming a master (D68)                                             */
/* ------------------------------------------------------------------ */

async fn candidates(st: &AppState, tenant: i64, user: i64, kyc_ok: bool) -> Vec<Value> {
    let so = social(st);
    let settings = so.settings(tenant);
    let logins: Vec<i64> = {
        let idx = st.hub.shared.index.read().unwrap();
        let mut v: Vec<i64> = idx.accounts.iter().filter(|(_, m)| m.tenant_id == tenant && m.user_id == user && m.kind == crate::model::AccountKind::Live && !matches!(m.group.as_str(), "copy" | "copy-netting" | "pamm")).map(|(l, _)| *l).collect();
        v.sort();
        v
    };
    let taken: Vec<i64> = so.reg.read().unwrap().masters.values().filter(|m| m.live() || m.status == "pending").map(|m| m.login).collect();
    let mut out = Vec::new();
    for login in logins {
        let Some(b) = so.account_brief(login).await else { continue };
        let age = (Utc::now() - b.created_at).num_days();
        let checks = vec![
            json!({"key": "kyc", "ok": kyc_ok, "label": "Identity verified (KYC)", "detail": if kyc_ok { "Verified".to_string() } else { "Complete identity verification in your profile first".to_string() }}),
            json!({"key": "live", "ok": b.live, "label": "Live account", "detail": "Masters trade real money"}),
            json!({"key": "track", "ok": age >= settings.min_track_days, "label": format!("Track record of at least {} days", settings.min_track_days), "detail": format!("Account age {age} days")}),
            json!({"key": "equity", "ok": b.equity >= settings.min_master_equity, "label": format!("Equity of at least {} USD", settings.min_master_equity.normalize()), "detail": format!("Equity {} USD", r2(b.equity).normalize())}),
            json!({"key": "free", "ok": !taken.contains(&login) && b.status == "active", "label": "Account not already a master", "detail": if taken.contains(&login) { "Already applied or approved".to_string() } else { format!("Status {}", b.status) }}),
        ];
        let eligible = checks.iter().all(|c| c["ok"].as_bool() == Some(true));
        out.push(json!({"login": login, "group": b.group, "equity": num(r2(b.equity)), "ageDays": age, "eligible": eligible, "checks": checks}));
    }
    out
}

pub async fn master_me(State(st): State<AppState>, ctx: Ctx, h: HeaderMap) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let so = social(&st);
    let tenant = ctx.tenant.tenant_id;
    let m = master_of_user(&st, tenant, u);
    let master = match &m {
        Some(m) if m.live() => {
            let pts = so.points(&[m.login]).await.remove(&m.login).unwrap_or_default();
            let s = so.stats_for(m.login, pts).await;
            Some(so.master_view(m, Some(&s), true).await)
        }
        Some(m) => Some(so.master_view(m, None, true).await),
        None => None,
    };
    Ok(Json(json!({"master": master, "settings": so.settings(tenant).json(), "candidates": candidates(&st, tenant, u, kyc(&h) == "verified").await})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReq {
    login: i64,
    nickname: String,
    #[serde(default)]
    strategy: String,
    #[serde(default)]
    description: String,
    program: String,
    #[serde(deserialize_with = "crate::money::de_dec")]
    perf_fee_pct: D,
    fee_period: String,
    #[serde(default, deserialize_with = "de_opt_dec")]
    min_allocation: Option<D>,
}

fn check_nickname(n: &str) -> ApiResult<String> {
    let n = n.trim();
    if n.chars().count() < 3 || n.chars().count() > 32 || !n.chars().all(|c| c.is_alphanumeric() || " ._-".contains(c)) {
        return Err(ApiError::Validation { field: "nickname", message: "Nickname: 3–32 letters, digits, spaces, dots, dashes".into() });
    }
    Ok(n.to_string())
}

pub async fn master_apply(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Body(r): Body<ApplyReq>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    super::controls::social_gate(&st, u)?;
    let so = social(&st);
    let tenant = ctx.tenant.tenant_id;
    if let Some(m) = master_of_user(&st, tenant, u)
        && m.status != "rejected"
    {
        return Err(ApiError::Conflict { code: "exists", message: format!("You already have a master profile ({})", m.status) });
    }
    let nickname = check_nickname(&r.nickname)?;
    if !matches!(r.program.as_str(), "copy" | "pamm" | "both") {
        return Err(ApiError::Validation { field: "program", message: "program must be copy, pamm or both".into() });
    }
    if !valid_period(&r.fee_period) {
        return Err(ApiError::Validation { field: "feePeriod", message: "feePeriod must be daily, weekly or monthly".into() });
    }
    let s = so.settings(tenant);
    if r.perf_fee_pct < s.fee_min_pct || r.perf_fee_pct > s.fee_max_pct {
        return Err(bad("fee_out_of_range", format!("The performance fee must be between {}% and {}%", s.fee_min_pct.normalize(), s.fee_max_pct.normalize())));
    }
    let cands = candidates(&st, tenant, u, kyc(&h) == "verified").await;
    let c = cands.iter().find(|c| c["login"].as_i64() == Some(r.login)).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    if c["eligible"].as_bool() != Some(true) {
        return Err(ApiError::Status { status: 422, code: "requirements", message: "This account does not meet the master requirements yet".into() }).map_err(|e| with_checks(e, c["checks"].clone()));
    }
    let taken: bool = so.reg.read().unwrap().masters.values().any(|m| m.tenant_id == tenant && m.status != "rejected" && m.nickname.eq_ignore_ascii_case(&nickname));
    if taken {
        return Err(ApiError::Conflict { code: "exists", message: "This nickname is taken".into() });
    }
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO social_masters (tenant_id, user_id, login, nickname, strategy, description, program, perf_fee_pct, fee_period, min_allocation, status, kyc_verified, checks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12) RETURNING id",
    )
    .bind(tenant)
    .bind(u)
    .bind(r.login)
    .bind(&nickname)
    .bind(r.strategy.trim().chars().take(80).collect::<String>())
    .bind(r.description.trim().chars().take(2000).collect::<String>())
    .bind(&r.program)
    .bind(r.perf_fee_pct)
    .bind(&r.fee_period)
    .bind(r.min_allocation.unwrap_or(ZERO).max(ZERO))
    .bind(kyc(&h) == "verified")
    .bind(sqlx::types::Json(c["checks"].clone()))
    .fetch_one(&st.pool)
    .await?;
    let reloaded = crate::social::load(&st.pool).await?;
    let m = reloaded.masters.get(&id).cloned().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("master vanished")))?;
    so.reg.write().unwrap().masters.insert(id, m.clone());
    tracing::info!(master = id, user = u, login = r.login, "master application received");
    Ok(Json(json!({"master": so.master_view(&m, None, true).await})))
}

fn with_checks(e: ApiError, checks: Value) -> ApiError {
    match e {
        ApiError::Status { status, code, message } => ApiError::StatusData { status, code, message, data: json!({"checks": checks}) },
        other => other,
    }
}

pub async fn master_update(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let so = social(&st);
    let mut m = master_of_user(&st, ctx.tenant.tenant_id, u).filter(|m| m.status != "rejected").ok_or_else(|| bad("not_master", "You are not a master"))?;
    let s = so.settings(m.tenant_id);
    if let Some(v) = b.get("nickname").and_then(Value::as_str) {
        let n = check_nickname(v)?;
        if so.reg.read().unwrap().masters.values().any(|x| x.id != m.id && x.tenant_id == m.tenant_id && x.status != "rejected" && x.nickname.eq_ignore_ascii_case(&n)) {
            return Err(ApiError::Conflict { code: "exists", message: "This nickname is taken".into() });
        }
        m.nickname = n;
    }
    if let Some(v) = b.get("strategy").and_then(Value::as_str) {
        m.strategy = v.trim().chars().take(80).collect();
    }
    if let Some(v) = b.get("description").and_then(Value::as_str) {
        m.description = v.trim().chars().take(2000).collect();
    }
    if let Some(p) = dec(b.get("perfFeePct"), "perfFeePct")? {
        if p < s.fee_min_pct || p > s.fee_max_pct {
            return Err(bad("fee_out_of_range", format!("The performance fee must be between {}% and {}%", s.fee_min_pct.normalize(), s.fee_max_pct.normalize())));
        }
        m.perf_fee_pct = p;
    }
    if let Some(p) = b.get("feePeriod").and_then(Value::as_str) {
        if !valid_period(p) {
            return Err(ApiError::Validation { field: "feePeriod", message: "feePeriod must be daily, weekly or monthly".into() });
        }
        m.fee_period = p.into();
    }
    if let Some(a) = dec(b.get("minAllocation"), "minAllocation")? {
        m.min_allocation = a.max(ZERO);
    }
    so.save_master(&m).await?;
    Ok(Json(json!({"master": so.master_view(&m, None, true).await})))
}

pub async fn master_dashboard(State(st): State<AppState>, ctx: Ctx, h: HeaderMap) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let so = social(&st);
    let m = master_of_user(&st, ctx.tenant.tenant_id, u).filter(|m| m.live()).ok_or_else(|| bad("not_master", "Your master profile is not approved yet"))?;
    let pts = so.points(&[m.login]).await.remove(&m.login).unwrap_or_default();
    let s = so.stats_for(m.login, pts).await;
    let subs: Vec<crate::social::Sub> = so.reg.read().unwrap().subs.values().filter(|x| x.master_id == m.id).cloned().collect();
    let followers: Vec<Value> = subs
        .iter()
        .map(|x| json!({"subscriptionId": x.id, "since": x.created_at, "status": x.status, "sizing": crate::social::sizing_json(&x.sizing), "equity": num(r2(x.last_equity.unwrap_or(ZERO))), "profit": num(r2(x.last_equity.unwrap_or(ZERO) - x.net_deposits))}))
        .collect();
    let funds_list: Vec<crate::social::Fund> = so.reg.read().unwrap().funds.values().filter(|f| f.master_id == m.id).cloned().collect();
    let mut funds = Vec::new();
    for f in &funds_list {
        let mut v = so.fund_view(f, true).await;
        let inv = sqlx::query("SELECT id, units, first_at, is_master FROM pamm_investors WHERE fund_id = $1 AND units > 0 ORDER BY id").bind(f.id).fetch_all(&st.pool).await?;
        let nav = f.nav_now();
        v["investors"] = json!(inv.iter().filter(|r| !r.get::<bool, _>("is_master")).count());
        v["investorList"] = json!(inv.iter().map(|r| json!({"investorId": r.get::<i64, _>("id"), "units": num(crate::money::rdp(r.get::<D, _>("units"), 4)), "value": num(r2(r.get::<D, _>("units") * nav)), "since": r.get::<Option<chrono::DateTime<Utc>>, _>("first_at"), "master": r.get::<bool, _>("is_master")})).collect::<Vec<_>>());
        funds.push(v);
    }
    let fees = fee_rows(&st, "f.master_id = $1", m.id).await?;
    let pending: f64 = fees.iter().filter(|f| f["status"] == "pending" || f["status"] == "approved").map(|f| f["masterAmount"].as_f64().unwrap_or(0.0)).sum();
    let paid: f64 = fees.iter().filter(|f| f["status"] == "paid").map(|f| f["masterAmount"].as_f64().unwrap_or(0.0)).sum();
    let (nf, aum) = so.master_audience(m.id);
    Ok(Json(json!({
        "master": so.master_view(&m, Some(&s), true).await,
        "followers": followers, "funds": funds, "fees": fees,
        "totals": {"followers": nf, "aum": num(r2(aum)), "feesPending": (pending * 100.0).round() / 100.0, "feesPaid": (paid * 100.0).round() / 100.0},
    })))
}

/// FeeView rows (`where` uses $1).
pub async fn fee_rows(st: &AppState, where_: &str, arg: i64) -> ApiResult<Vec<Value>> {
    let q = format!("SELECT f.*, m.nickname FROM social_fees f JOIN social_masters m ON m.id = f.master_id WHERE {where_} ORDER BY f.id DESC LIMIT 500");
    let rows = sqlx::query(sqlx::AssertSqlSafe(q)).bind(arg).fetch_all(&st.pool).await?;
    Ok(rows.iter().map(fee_json).collect())
}

pub fn fee_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "source": r.get::<String, _>("source"), "masterId": r.get::<i64, _>("master_id"), "master": r.get::<String, _>("nickname"),
        "subscriptionId": r.get::<Option<i64>, _>("sub_id"), "fundId": r.get::<Option<i64>, _>("fund_id"), "linkId": r.try_get::<Option<i64>, _>("link_id").ok().flatten(),
        "perfAmount": crate::money::num_opt(r.try_get::<Option<D>, _>("perf_amount").ok().flatten()), "mgmtAmount": crate::money::num_opt(r.try_get::<Option<D>, _>("mgmt_amount").ok().flatten()), "payerUserId": r.get::<i64, _>("payer_user_id"), "login": r.get::<i64, _>("login"),
        "amount": num(r.get::<D, _>("amount")), "platformCut": num(r.get::<D, _>("platform_cut")), "masterAmount": num(r.get::<D, _>("master_amount")),
        "periodStart": r.get::<Option<chrono::DateTime<Utc>>, _>("period_start"), "periodEnd": r.get::<chrono::DateTime<Utc>, _>("period_end"),
        "hwmBefore": num(r.get::<D, _>("hwm_before")), "hwmAfter": num(r.get::<D, _>("hwm_after")), "equity": num(r.get::<D, _>("equity")),
        "status": r.get::<String, _>("status"), "reviewedBy": r.get::<Option<String>, _>("reviewed_by"), "note": r.get::<Option<String>, _>("note"),
        "createdAt": r.get::<chrono::DateTime<Utc>, _>("created_at"), "paidAt": r.get::<Option<chrono::DateTime<Utc>>, _>("paid_at"),
    })
}

/* ------------------------------------------------------------------ */
/* Copy subscriptions (D69–D71)                                        */
/* ------------------------------------------------------------------ */

fn parse_sizing(v: Option<&Value>, allocation: D) -> ApiResult<Sizing> {
    let v = v.ok_or(ApiError::Validation { field: "sizing", message: "Choose how trades are sized".into() })?;
    let mode = v.get("mode").and_then(Value::as_str).and_then(SizingMode::parse).ok_or(ApiError::Validation { field: "sizing.mode", message: "mode must be equity, allocation, multiplier or fixed_lot".into() })?;
    let value = dec(v.get("value"), "sizing.value")?;
    let value = match mode {
        SizingMode::Equity => D::ONE,
        SizingMode::Allocation => value.filter(|v| *v > ZERO).unwrap_or(allocation),
        SizingMode::Multiplier => value.filter(|v| *v >= D::new(1, 2) && *v <= D::from(100)).ok_or(ApiError::Validation { field: "sizing.value", message: "Multiplier must be between 0.01 and 100".into() })?,
        SizingMode::FixedLot => value.filter(|v| *v > ZERO && *v <= D::from(100)).ok_or(ApiError::Validation { field: "sizing.value", message: "Fixed lot must be above 0 and at most 100".into() })?,
    };
    if mode == SizingMode::Allocation && value <= ZERO {
        return Err(ApiError::Validation { field: "sizing.value", message: "Enter the allocation used for sizing".into() });
    }
    Ok(Sizing { mode, value })
}

fn limits(b: &Map<String, Value>) -> ApiResult<(Option<Option<D>>, Option<Option<D>>, Option<Option<D>>, Option<Vec<String>>)> {
    let opt = |k: &'static str| -> ApiResult<Option<Option<D>>> { if b.contains_key(k) { Ok(Some(dec(b.get(k), k)?)) } else { Ok(None) } };
    let max_lot = opt("maxLot")?;
    let equity_stop = opt("equityStop")?;
    let max_dd = opt("maxDdPct")?;
    if let Some(Some(v)) = max_lot
        && (v <= ZERO || v > D::from(100))
    {
        return Err(ApiError::Validation { field: "maxLot", message: "Max lot must be above 0 and at most 100".into() });
    }
    if let Some(Some(v)) = equity_stop
        && v <= ZERO
    {
        return Err(ApiError::Validation { field: "equityStop", message: "Equity stop must be above 0".into() });
    }
    if let Some(Some(v)) = max_dd
        && (v < D::ONE || v > D::from(99))
    {
        return Err(ApiError::Validation { field: "maxDdPct", message: "Max drawdown must be between 1 and 99 %".into() });
    }
    let excluded = match b.get("excludedSymbols") {
        None | Some(Value::Null) => None,
        Some(Value::Array(a)) => {
            let v: Vec<String> = a.iter().filter_map(Value::as_str).map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty() && s.len() <= 20).take(100).collect();
            Some(v)
        }
        _ => return Err(ApiError::Validation { field: "excludedSymbols", message: "excludedSymbols must be a list".into() }),
    };
    Ok((max_lot, equity_stop, max_dd, excluded))
}

async fn fees_pending(st: &AppState, sub: i64) -> D {
    sqlx::query_scalar::<_, Option<D>>("SELECT sum(amount) FROM social_fees WHERE sub_id = $1 AND status IN ('pending','approved')").bind(sub).fetch_one(&st.pool).await.ok().flatten().unwrap_or(ZERO)
}

async fn sub_view(st: &AppState, s: &crate::social::Sub) -> Value {
    let so = social(st);
    let mut s = s.clone();
    if let Some(b) = so.account_brief(s.login).await {
        s.last_equity = Some(b.equity);
        s.last_balance = Some(b.balance);
        s.positions = b.positions;
        s.orders = b.orders;
    }
    let m = so.reg.read().unwrap().masters.get(&s.master_id).cloned();
    let risk = match &m {
        Some(m) => {
            let pts = so.points(&[m.login]).await.remove(&m.login).unwrap_or_default();
            Some(crate::social::math::risk_score_from(&pts))
        }
        None => None,
    };
    sub_json(&s, m.as_ref(), risk, fees_pending(st, s.id).await)
}

pub async fn subscribe(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    super::controls::social_gate(&st, u)?;
    let so = social(&st);
    let tenant = ctx.tenant.tenant_id;
    let master_id = b.get("masterId").and_then(Value::as_i64).ok_or(ApiError::Validation { field: "masterId", message: "masterId is required".into() })?;
    let m = so.reg.read().unwrap().masters.get(&master_id).cloned().filter(|m| m.tenant_id == tenant).ok_or_else(|| ApiError::NotFound("Master not found".into()))?;
    // a house account that is switched off or hidden (House accounts) takes no new followers
    if m.status != "approved" || m.frozen || !m.offers_copy() || (m.is_house && m.hidden) {
        return Err(bad("master_status", format!("{} is not open for copying right now", m.nickname)));
    }
    if m.user_id == u {
        return Err(bad("own_subscription", "You cannot copy yourself"));
    }
    let allocation = dec(b.get("allocation"), "allocation")?.ok_or(ApiError::Validation { field: "allocation", message: "Enter the amount to allocate from your wallet".into() })?;
    if allocation <= ZERO || r2(allocation) != allocation {
        return Err(ApiError::Validation { field: "allocation", message: "Enter an amount above 0 (up to 2 decimals)".into() });
    }
    let settings = so.settings(tenant);
    let min = settings.min_allocation.max(m.min_allocation);
    if allocation < min {
        return Err(bad("min_allocation", format!("The minimum allocation for {} is {} USD", m.nickname, min.normalize())));
    }
    let sizing = parse_sizing(b.get("sizing"), allocation)?;
    let (max_lot, equity_stop, max_dd, excluded) = limits(&b)?;
    if let Some(Some(es)) = equity_stop
        && es >= allocation
    {
        return Err(ApiError::Validation { field: "equityStop", message: "The equity stop must be below the allocation".into() });
    }
    let excluded = excluded.unwrap_or_default();
    for s in &excluded {
        if st.hub.shared.specs.get(s).is_none() {
            return Err(ApiError::Validation { field: "excludedSymbols", message: format!("Unknown symbol {s}") });
        }
    }
    let sub = so.create_sub(tenant, u, master_id, sizing, allocation, max_lot.flatten(), equity_stop.flatten(), max_dd.flatten(), excluded).await?;
    let key = format!("copy:alloc:{}", sub.id);
    let funding = match so.wallet.to_trading(&ctx.tenant.slug, &key, u, sub.login, allocation).await {
        Ok(_) => json!({"status": "done", "amount": num(allocation)}),
        Err(e) => {
            tracing::warn!(sub = sub.id, error = %e, "copy allocation from the wallet failed");
            json!({"status": "failed", "code": if e.status == 0 { "wallet_unavailable" } else { "wallet_rejected" }, "message": format!("Your copy account #{} was created, but the transfer from your wallet did not go through: {}. Fund the copy account from your wallet to start copying.", sub.login, e.message)})
        }
    };
    // give the tap a moment to record the deposit before the first view
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    let s = so.reg.read().unwrap().subs.get(&sub.id).cloned().unwrap_or(sub);
    Ok(Json(json!({"subscription": sub_view(&st, &s).await, "account": {"login": s.login}, "funding": funding})))
}

pub async fn subscriptions(State(st): State<AppState>, ctx: Ctx, h: HeaderMap) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let subs: Vec<crate::social::Sub> = st.social.reg.read().unwrap().subs.values().filter(|s| s.tenant_id == ctx.tenant.tenant_id && s.user_id == u).rev().cloned().collect();
    let mut items = Vec::new();
    for s in &subs {
        items.push(sub_view(&st, s).await);
    }
    Ok(Json(json!({"items": items})))
}

fn own_sub(st: &AppState, ctx: &Ctx, u: i64, id: i64) -> ApiResult<crate::social::Sub> {
    st.social.reg.read().unwrap().subs.get(&id).cloned().filter(|s| s.tenant_id == ctx.tenant.tenant_id && s.user_id == u).ok_or_else(|| ApiError::NotFound("Subscription not found".into()))
}

pub async fn subscription(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let s = own_sub(&st, &ctx, u, id)?;
    let detail = st
        .hub
        .read(
            s.login,
            Box::new(|x| match x {
                Some((a, env)) => json!({
                    "positions": a.positions.values().map(|p| crate::views::position_json(env, a, p)).collect::<Vec<_>>(),
                    "orders": a.orders.values().map(crate::views::order_json).collect::<Vec<_>>(),
                }),
                None => json!({"positions": [], "orders": []}),
            }),
        )
        .await;
    Ok(Json(json!({
        "subscription": sub_view(&st, &s).await,
        "positions": detail["positions"], "orders": detail["orders"],
        "log": st.social.copy_log(id, 100).await,
        "fees": fee_rows(&st, "f.sub_id = $1", id).await?,
    })))
}

pub async fn update_subscription(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let mut s = own_sub(&st, &ctx, u, id)?;
    if s.status == "stopped" {
        return Err(bad("stopped", "This subscription has stopped"));
    }
    if b.contains_key("sizing") {
        s.sizing = parse_sizing(b.get("sizing"), s.allocation.max(s.net_deposits))?;
    }
    let (max_lot, equity_stop, max_dd, excluded) = limits(&b)?;
    if let Some(v) = max_lot {
        s.max_lot = v;
    }
    if let Some(v) = equity_stop {
        s.equity_stop = v;
    }
    if let Some(v) = max_dd {
        s.max_dd_pct = v;
    }
    if let Some(v) = excluded {
        for sym in &v {
            if st.hub.shared.specs.get(sym).is_none() {
                return Err(ApiError::Validation { field: "excludedSymbols", message: format!("Unknown symbol {sym}") });
            }
        }
        s.excluded = v;
    }
    if let Some(p) = b.get("paused").and_then(Value::as_bool) {
        s.status = if p { "paused".into() } else { "active".into() };
    }
    st.social.save_sub(&s).await?;
    Ok(Json(json!({"subscription": sub_view(&st, &s).await})))
}

/// Options of a client stop: `closePositions` (default true) closes every copied position and order at market;
/// false stops the mirroring and leaves them on the copy account as ordinary trades the client manages (the
/// terminal guard only applies while copying). `returnFunds` (default true) moves the withdrawable balance back
/// to the wallet, which is only the free margin while positions stay open.
pub fn stop_options(body: Option<&Map<String, Value>>) -> (bool, bool) {
    let flag = |k: &str| body.and_then(|b| b.get(k)).and_then(Value::as_bool).unwrap_or(true);
    (flag("closePositions"), flag("returnFunds"))
}

pub async fn stop_subscription(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>, body: Option<Json<Map<String, Value>>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let s = own_sub(&st, &ctx, u, id)?;
    let (close, ret) = stop_options(body.as_ref().map(|b| &b.0));
    let out = st.social.stop_sub(s.id, "client", close, ret).await?;
    let s = own_sub(&st, &ctx, u, id)?;
    let mut v = out;
    v["subscription"] = sub_view(&st, &s).await;
    Ok(Json(v))
}

/* ------------------------------------------------------------------ */
/* PAMM (D65–D67, D74)                                                 */
/* ------------------------------------------------------------------ */

pub async fn funds(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let list: Vec<crate::social::Fund> = st.social.reg.read().unwrap().funds.values().filter(|f| f.tenant_id == ctx.tenant.tenant_id && f.status != "closed").cloned().collect();
    let visible: Vec<crate::social::Fund> = {
        let reg = st.social.reg.read().unwrap();
        list.into_iter().filter(|f| reg.masters.get(&f.master_id).is_some_and(|m| m.status == "approved" && !m.hidden)).collect()
    };
    let mut items = Vec::new();
    for f in &visible {
        items.push(st.social.fund_view(f, false).await);
    }
    Ok(Json(json!({"items": items})))
}

pub async fn fund(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let f = st.social.fund(id).filter(|f| f.tenant_id == ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Fund not found".into()))?;
    let owner = user(&h).ok() == Some(f.user_id);
    let m = st.social.reg.read().unwrap().masters.get(&f.master_id).cloned();
    let rows = sqlx::query("SELECT id, at, kind, nav, equity_after, fees, invested, redeemed FROM pamm_rollovers WHERE fund_id = $1 ORDER BY at").bind(id).fetch_all(&st.pool).await?;
    let mut nav_history = vec![json!({"at": f.created_at, "nav": 1.0})];
    for r in &rows {
        nav_history.push(json!({"at": r.get::<chrono::DateTime<Utc>, _>("at"), "nav": num(crate::money::rdp(r.get::<D, _>("nav"), 6))}));
    }
    nav_history.push(json!({"at": Utc::now(), "nav": num(crate::money::rdp(f.nav_now(), 6))}));
    let rollovers: Vec<Value> = rows
        .iter()
        .rev()
        .take(100)
        .map(|r| json!({"id": r.get::<i64, _>("id"), "at": r.get::<chrono::DateTime<Utc>, _>("at"), "kind": r.get::<String, _>("kind"), "nav": num(crate::money::rdp(r.get::<D, _>("nav"), 6)), "equity": num(r.get::<D, _>("equity_after")), "fees": num(r.get::<D, _>("fees")), "invested": num(r.get::<D, _>("invested")), "redeemed": num(r.get::<D, _>("redeemed"))}))
        .collect();
    let master = match &m {
        Some(m) => Some(st.social.master_view(m, None, false).await),
        None => None,
    };
    Ok(Json(json!({"fund": st.social.fund_view(&f, owner).await, "master": master, "navHistory": nav_history, "rollovers": rollovers})))
}

pub async fn create_fund(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    super::controls::social_gate(&st, u)?;
    let m = master_of_user(&st, ctx.tenant.tenant_id, u).filter(|m| m.status == "approved").ok_or_else(|| bad("not_master", "Only approved masters can open a PAMM fund"))?;
    if m.program == "copy" {
        return Err(bad("master_status", "Your master profile offers copy trading only. Change the program to PAMM or both first."));
    }
    if st.social.reg.read().unwrap().funds.values().any(|f| f.master_id == m.id && f.status != "closed") {
        return Err(ApiError::Conflict { code: "exists", message: "You already manage a PAMM fund".into() });
    }
    let name: String = b.get("name").and_then(Value::as_str).map(|s| s.trim().to_string()).unwrap_or_default();
    if name.chars().count() < 3 || name.chars().count() > 60 {
        return Err(ApiError::Validation { field: "name", message: "Fund name: 3–60 characters".into() });
    }
    let period = b.get("period").and_then(Value::as_str).unwrap_or(&m.fee_period).to_string();
    if !valid_period(&period) {
        return Err(ApiError::Validation { field: "period", message: "period must be daily, weekly or monthly".into() });
    }
    let fee = dec(b.get("perfFeePct"), "perfFeePct")?.unwrap_or(m.perf_fee_pct);
    let lock = b.get("lockInDays").and_then(Value::as_i64).unwrap_or(0);
    if !(0..=365).contains(&lock) {
        return Err(ApiError::Validation { field: "lockInDays", message: "Lock-in must be 0–365 days".into() });
    }
    let min_inv = dec(b.get("minInvestment"), "minInvestment")?.unwrap_or(ZERO).max(ZERO);
    let max_dd = dec(b.get("maxDdPct"), "maxDdPct")?;
    if let Some(d) = max_dd
        && (d < D::ONE || d > D::from(95))
    {
        return Err(ApiError::Validation { field: "maxDdPct", message: "Max drawdown must be between 1 and 95 %".into() });
    }
    let seed = dec(b.get("seed"), "seed")?.ok_or(ApiError::Validation { field: "seed", message: "Enter your seed capital".into() })?;
    let (f, creds) = st.social.create_fund(&m, &name, &period, fee, lock, min_inv, max_dd, seed).await.map_err(soc)?;
    Ok(Json(json!({"fund": st.social.fund_view(&f, true).await, "credentials": creds})))
}

pub async fn update_fund(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let mut f = st.social.fund(id).filter(|f| f.tenant_id == ctx.tenant.tenant_id && f.user_id == u).ok_or_else(|| ApiError::NotFound("Fund not found".into()))?;
    let s = st.social.settings(f.tenant_id);
    if let Some(n) = b.get("name").and_then(Value::as_str) {
        let n = n.trim();
        if n.chars().count() < 3 || n.chars().count() > 60 {
            return Err(ApiError::Validation { field: "name", message: "Fund name: 3–60 characters".into() });
        }
        f.name = n.into();
    }
    if let Some(p) = b.get("period").and_then(Value::as_str) {
        if !valid_period(p) {
            return Err(ApiError::Validation { field: "period", message: "period must be daily, weekly or monthly".into() });
        }
        if p != f.period {
            f.period = p.into();
            f.next_rollover_at = crate::social::next_period_end(p, Utc::now());
        }
    }
    if let Some(p) = dec(b.get("perfFeePct"), "perfFeePct")? {
        if p < s.fee_min_pct || p > s.fee_max_pct {
            return Err(bad("fee_out_of_range", format!("The performance fee must be between {}% and {}%", s.fee_min_pct.normalize(), s.fee_max_pct.normalize())));
        }
        f.perf_fee_pct = p;
    }
    if let Some(l) = b.get("lockInDays").and_then(Value::as_i64) {
        f.lock_in_days = l.clamp(0, 365);
    }
    if let Some(v) = dec(b.get("minInvestment"), "minInvestment")? {
        f.min_investment = v.max(ZERO);
    }
    if b.contains_key("maxDdPct") {
        f.max_dd_pct = dec(b.get("maxDdPct"), "maxDdPct")?;
    }
    st.social.save_fund(&f).await?;
    Ok(Json(json!({"fund": st.social.fund_view(&f, true).await})))
}

pub async fn invest(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    super::controls::social_gate(&st, u)?;
    st.social.fund(id).filter(|f| f.tenant_id == ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Fund not found".into()))?;
    let amount = dec(b.get("amount"), "amount")?.ok_or(ApiError::Validation { field: "amount", message: "Enter the amount".into() })?;
    let sl = dec(b.get("stopLossPct"), "stopLossPct")?;
    let r = st.social.invest_request(id, u, amount, sl).await.map_err(soc)?;
    Ok(Json(json!({"request": r})))
}

pub async fn redeem(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    st.social.fund(id).filter(|f| f.tenant_id == ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Fund not found".into()))?;
    let all = b.get("all").and_then(Value::as_bool).unwrap_or(false);
    let r = st.social.redeem_request(id, u, dec(b.get("units"), "units")?, dec(b.get("amount"), "amount")?, all).await.map_err(soc)?;
    Ok(Json(json!({"request": r})))
}

pub async fn cancel_request(State(st): State<AppState>, h: HeaderMap, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    let r = st.social.cancel_request(id, u).await.map_err(soc)?;
    Ok(Json(json!({"request": r})))
}

pub async fn investments(State(st): State<AppState>, ctx: Ctx, h: HeaderMap) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    Ok(Json(st.social.investments(ctx.tenant.tenant_id, u).await?))
}

pub async fn update_investment(State(st): State<AppState>, ctx: Ctx, h: HeaderMap, Path(fund_id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    st.social.set_stop_loss(fund_id, u, dec(b.get("stopLossPct"), "stopLossPct")?).await.map_err(soc)?;
    let all = st.social.investments(ctx.tenant.tenant_id, u).await?;
    let inv = all["items"].as_array().and_then(|a| a.iter().find(|i| i["fundId"].as_i64() == Some(fund_id)).cloned()).unwrap_or(Value::Null);
    Ok(Json(json!({"investment": inv})))
}

pub async fn statement(State(st): State<AppState>, h: HeaderMap, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let u = user(&h)?;
    Ok(Json(st.social.statement(id, u).await?))
}

#[cfg(test)]
mod tests {
    use super::stop_options;
    use serde_json::{Map, Value, json};

    fn body(v: Value) -> Map<String, Value> {
        v.as_object().cloned().unwrap()
    }

    #[test]
    fn stop_defaults_close_everything_and_return_funds() {
        assert_eq!(stop_options(None), (true, true));
        assert_eq!(stop_options(Some(&body(json!({})))), (true, true));
        // unknown values never turn a default off
        assert_eq!(stop_options(Some(&body(json!({"closePositions": "no", "returnFunds": 0})))), (true, true));
    }

    #[test]
    fn stop_keeps_positions_or_the_balance_when_asked() {
        assert_eq!(stop_options(Some(&body(json!({"closePositions": false})))), (false, true));
        assert_eq!(stop_options(Some(&body(json!({"returnFunds": false})))), (true, false));
        assert_eq!(stop_options(Some(&body(json!({"closePositions": false, "returnFunds": false})))), (false, false));
    }
}
