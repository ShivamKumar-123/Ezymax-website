//! Back Office social trading API (D125): master applications, suspension / hiding, emergency stop,
//! subscriptions, PAMM funds (freeze, rollover), fee caps and platform cut, fee payout approval, audit.
//! Reads: any staff role. Writes: `ROLES_SOCIAL_WRITE`. Approvals: `ROLES_SOCIAL_APPROVE`. Every write
//! needs a note and is audited as `social.*`.

use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::Row;

use super::social::{dec, fee_json, fee_rows};
use super::{ApiError, ApiResult, AppState, Body, StaffCtx};
use crate::money::{D, ZERO, num, r2};
use crate::shard::Op;
use crate::social::{Master, sub_json};

pub const ROLES_SOCIAL_WRITE: &[&str] = &["platform_owner", "super_admin", "admin", "risk_manager"];
pub const ROLES_SOCIAL_APPROVE: &[&str] = &["platform_owner", "super_admin", "admin", "compliance"];

fn note(b: &Map<String, Value>) -> ApiResult<String> {
    let n = b.get("note").and_then(Value::as_str).map(str::trim).unwrap_or("");
    if n.is_empty() {
        return Err(ApiError::Validation { field: "note", message: "A note (reason) is required".into() });
    }
    Ok(n.chars().take(500).collect())
}

fn master(st: &AppState, s: &StaffCtx, id: i64) -> ApiResult<Master> {
    st.social.reg.read().unwrap().masters.get(&id).cloned().filter(|m| m.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Master not found".into()))
}

fn brief(m: &Master) -> Value {
    json!({"masterId": m.id, "nickname": m.nickname, "status": m.status, "hidden": m.hidden, "frozen": m.frozen, "perfFeePct": num(m.perf_fee_pct)})
}

pub async fn overview(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    let tenant = s.ctx.tenant.tenant_id;
    let (masters, subs, funds, aum) = {
        let reg = st.social.reg.read().unwrap();
        let ms: Vec<&Master> = reg.masters.values().filter(|m| m.tenant_id == tenant).collect();
        let count = |st: &str| ms.iter().filter(|m| m.status == st).count();
        let masters = json!({"pending": count("pending"), "approved": count("approved"), "suspended": count("suspended"), "rejected": count("rejected"), "hidden": ms.iter().filter(|m| m.hidden).count(), "frozen": ms.iter().filter(|m| m.frozen).count()});
        let ss: Vec<_> = reg.subs.values().filter(|x| x.tenant_id == tenant).collect();
        let subs = json!({"active": ss.iter().filter(|x| x.status == "active").count(), "paused": ss.iter().filter(|x| x.status == "paused").count(), "stopped": ss.iter().filter(|x| x.status == "stopped").count()});
        let fs: Vec<_> = reg.funds.values().filter(|x| x.tenant_id == tenant).collect();
        let funds = json!({"active": fs.iter().filter(|x| x.status == "active").count(), "frozen": fs.iter().filter(|x| x.status == "frozen").count()});
        let aum: D = ss.iter().filter(|x| x.copying()).map(|x| x.last_equity.unwrap_or(x.net_deposits).max(ZERO)).sum::<D>() + fs.iter().filter(|x| x.status != "closed").map(|x| x.last_equity.unwrap_or(ZERO)).sum::<D>();
        (masters, subs, funds, aum)
    };
    let r = sqlx::query("SELECT count(*) AS n, COALESCE(sum(amount), 0) AS a FROM social_fees WHERE tenant_id = $1 AND status = 'pending'").bind(tenant).fetch_one(&st.pool).await?;
    Ok(Json(json!({
        "masters": masters, "subscriptions": subs, "funds": funds, "aum": num(r2(aum)),
        "feesPending": {"count": r.get::<i64, _>("n"), "amount": num(r.get::<D, _>("a"))},
        "settings": st.social.settings(tenant).json(),
    })))
}

#[derive(Deserialize)]
pub struct StatusQ {
    status: Option<String>,
}

pub async fn masters(State(st): State<AppState>, s: StaffCtx, Query(q): Query<StatusQ>) -> ApiResult<Json<Value>> {
    let so = &st.social;
    let list: Vec<Master> = so.reg.read().unwrap().masters.values().filter(|m| m.tenant_id == s.ctx.tenant.tenant_id && q.status.as_deref().is_none_or(|x| x == "all" || m.status == x)).rev().cloned().collect();
    let logins: Vec<i64> = list.iter().map(|m| m.login).collect();
    let mut pts = so.points(&logins).await;
    let mut items = Vec::new();
    for m in &list {
        let st_ = so.stats_for(m.login, pts.remove(&m.login).unwrap_or_default()).await;
        items.push(so.master_view(m, Some(&st_), true).await);
    }
    Ok(Json(json!({"items": items})))
}

pub async fn review(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_APPROVE)?;
    let n = note(&b)?;
    let mut m = master(&st, &s, id)?;
    if m.status != "pending" {
        return Err(ApiError::Conflict { code: "master_status", message: format!("This application is already {}", m.status) });
    }
    let before = brief(&m);
    match b.get("decision").and_then(Value::as_str) {
        Some("approve") => {
            m.status = "approved".into();
            m.approved_at = Some(Utc::now());
        }
        Some("reject") => m.status = "rejected".into(),
        _ => return Err(ApiError::Validation { field: "decision", message: "decision must be approve or reject".into() }),
    }
    m.review_note = Some(n.clone());
    m.reviewed_by = Some(s.staff.name.clone());
    st.social.save_master(&m).await?;
    if m.status == "approved" {
        match st.social.backfill(m.login, m.tenant_id).await {
            Ok(k) => tracing::info!(master = id, days = k, "track record backfilled"),
            Err(e) => tracing::warn!(master = id, error = %e, "backfill failed"),
        }
        st.social.snapshot_all().await;
    }
    let action = if m.status == "approved" { "social.master.approve" } else { "social.master.reject" };
    let a = st.social.audit(m.tenant_id, &s.staff, action, Some(m.login), &format!("master:{id}"), Some(before), Some(brief(&m)), &n).await;
    Ok(Json(json!({"master": st.social.master_view(&m, None, true).await, "audit": [a]})))
}

pub async fn master_status(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let mut m = master(&st, &s, id)?;
    let before = brief(&m);
    let action = b.get("action").and_then(Value::as_str).unwrap_or("");
    match action {
        "suspend" if m.status == "approved" => m.status = "suspended".into(),
        "reinstate" if m.status == "suspended" => m.status = "approved".into(),
        "hide" => m.hidden = true,
        "unhide" => m.hidden = false,
        "suspend" | "reinstate" => return Err(ApiError::Conflict { code: "master_status", message: format!("The master is {}", m.status) }),
        _ => return Err(ApiError::Validation { field: "action", message: "action must be suspend, reinstate, hide or unhide".into() }),
    }
    st.social.save_master(&m).await?;
    let a = st.social.audit(m.tenant_id, &s.staff, &format!("social.master.{action}"), Some(m.login), &format!("master:{id}"), Some(before), Some(brief(&m)), &n).await;
    Ok(Json(json!({"master": st.social.master_view(&m, None, true).await, "audit": [a]})))
}

/// D125 emergency stop: freezes the signal (nothing is mirrored any more) and optionally closes every
/// follower's copied positions. `freeze:false` lifts it.
pub async fn emergency(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let mut m = master(&st, &s, id)?;
    let before = brief(&m);
    let freeze = b.get("freeze").and_then(Value::as_bool).unwrap_or(true);
    let close = b.get("closePositions").and_then(Value::as_bool).unwrap_or(false);
    m.frozen = freeze;
    st.social.save_master(&m).await?;
    let mut closed = Vec::new();
    let mut failed = Vec::new();
    if freeze && close {
        let subs: Vec<crate::social::Sub> = st.social.reg.read().unwrap().subs_of(id).into_iter().cloned().collect();
        for x in subs {
            let sid = x.id;
            let op: Op = Box::new(move |tx, env| {
                let (d, f) = crate::social::mirror::close_all(tx, env, sid, "emergency stop");
                Ok(json!({"closed": d, "failed": f.iter().map(|(t, e)| json!({"ticket": t, "error": e})).collect::<Vec<_>>()}))
            });
            match st.hub.exec(x.login, &format!("staff:{}", s.staff.id), Some(s.staff.clone()), "SOC", &n, None, op).await {
                Ok(d) => {
                    closed.extend(d.value["closed"].as_array().cloned().unwrap_or_default());
                    failed.extend(d.value["failed"].as_array().cloned().unwrap_or_default());
                }
                Err(e) => failed.push(json!({"login": x.login, "error": format!("{e:?}")})),
            }
        }
    }
    let action = if freeze { "social.master.emergency_stop" } else { "social.master.unfreeze" };
    let mut after = brief(&m);
    after["closed"] = json!(closed.len());
    let a = st.social.audit(m.tenant_id, &s.staff, action, Some(m.login), &format!("master:{id}"), Some(before), Some(after), &n).await;
    Ok(Json(json!({"master": st.social.master_view(&m, None, true).await, "closed": closed, "failed": failed, "audit": [a]})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsQ {
    master_id: Option<i64>,
    status: Option<String>,
}

pub async fn subscriptions(State(st): State<AppState>, s: StaffCtx, Query(q): Query<SubsQ>) -> ApiResult<Json<Value>> {
    let (subs, masters): (Vec<crate::social::Sub>, std::collections::BTreeMap<i64, Master>) = {
        let reg = st.social.reg.read().unwrap();
        (
            reg.subs.values().filter(|x| x.tenant_id == s.ctx.tenant.tenant_id && q.master_id.is_none_or(|m| x.master_id == m) && q.status.as_deref().is_none_or(|v| v == "all" || x.status == v)).rev().cloned().collect(),
            reg.masters.clone(),
        )
    };
    let mut items = Vec::new();
    for x in subs {
        let pending: D = sqlx::query_scalar::<_, Option<D>>("SELECT sum(amount) FROM social_fees WHERE sub_id = $1 AND status IN ('pending','approved')").bind(x.id).fetch_one(&st.pool).await.ok().flatten().unwrap_or(ZERO);
        let mut y = x.clone();
        if let Some(b) = st.social.account_brief(x.login).await {
            y.last_equity = Some(b.equity);
            y.last_balance = Some(b.balance);
            y.positions = b.positions;
            y.orders = b.orders;
        }
        let mut v = sub_json(&y, masters.get(&x.master_id), None, pending);
        v["userId"] = json!(x.user_id);
        items.push(v);
    }
    Ok(Json(json!({"items": items})))
}

pub async fn stop_subscription(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let x = st.social.reg.read().unwrap().subs.get(&id).cloned().filter(|x| x.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Subscription not found".into()))?;
    let out = st.social.stop_sub(id, "admin", true, false).await?;
    let a = st.social.audit(x.tenant_id, &s.staff, "social.subscription.stop", Some(x.login), &format!("subscription:{id}"), Some(json!({"subscriptionId": id, "status": x.status})), Some(json!({"subscriptionId": id, "status": "stopped", "closed": out["closed"].as_array().map(|a| a.len())})), &n).await;
    let y = st.social.reg.read().unwrap().subs.get(&id).cloned().unwrap_or(x);
    let m = st.social.reg.read().unwrap().masters.get(&y.master_id).cloned();
    Ok(Json(json!({"subscription": sub_json(&y, m.as_ref(), None, ZERO), "result": out, "audit": [a]})))
}

pub async fn funds(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    let list: Vec<crate::social::Fund> = st.social.reg.read().unwrap().funds.values().filter(|f| f.tenant_id == s.ctx.tenant.tenant_id).rev().cloned().collect();
    let mut items = Vec::new();
    for f in &list {
        let mut f = f.clone();
        if let Some(b) = st.social.account_brief(f.login).await {
            f.last_equity = Some(b.equity);
        }
        items.push(st.social.fund_view(&f, true).await);
    }
    Ok(Json(json!({"items": items})))
}

fn fund_brief(f: &crate::social::Fund) -> Value {
    json!({"fundId": f.id, "name": f.name, "status": f.status, "units": num(f.units), "nav": num(crate::money::rdp(f.nav_now(), 6))})
}

pub async fn freeze_fund(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let f = st.social.fund(id).filter(|f| f.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Fund not found".into()))?;
    let freeze = b.get("freeze").and_then(Value::as_bool).unwrap_or(true);
    let close = b.get("closePositions").and_then(Value::as_bool).unwrap_or(false);
    let out = st.social.freeze_fund(id, freeze, close, &format!("admin: {n}")).await?;
    let nf = st.social.fund(id).unwrap_or(f.clone());
    let a = st.social.audit(f.tenant_id, &s.staff, if freeze { "social.fund.freeze" } else { "social.fund.unfreeze" }, Some(f.login), &format!("fund:{id}"), Some(fund_brief(&f)), Some(fund_brief(&nf)), &n).await;
    Ok(Json(json!({"fund": st.social.fund_view(&nf, true).await, "result": out, "audit": [a]})))
}

pub async fn fund_rollover(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let f = st.social.fund(id).filter(|f| f.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Fund not found".into()))?;
    let r = st.social.rollover(id, "manual").await.map_err(|e| ApiError::Status { status: 422, code: "rollover_failed", message: e.to_string() })?;
    let a = st.social.audit(f.tenant_id, &s.staff, "social.fund.rollover", Some(f.login), &format!("fund:{id}"), Some(fund_brief(&f)), Some({
        let mut a = fund_brief(&st.social.fund(id).unwrap_or(f.clone()));
        a["fees"] = r["feesTotal"].clone();
        a["invested"] = r["invested"].clone();
        a["redeemed"] = r["redeemed"].clone();
        a
    }), &n).await;
    Ok(Json(json!({"rollover": r, "audit": [a]})))
}

pub async fn rollover_all(State(st): State<AppState>, s: StaffCtx, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let force = b.get("force").and_then(Value::as_bool).unwrap_or(false);
    let (funds, subs, fees) = st.social.run_due(Utc::now(), force).await;
    let a = st.social.audit(s.ctx.tenant.tenant_id, &s.staff, "social.rollover", None, "all", None, Some(json!({"funds": funds, "subscriptions": subs, "fees": fees, "force": force})), &n).await;
    Ok(Json(json!({"funds": funds, "subscriptions": subs, "fees": fees, "audit": [a]})))
}

pub async fn snapshots(State(st): State<AppState>, s: StaffCtx, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let w = st.social.snapshot_all().await;
    let a = st.social.audit(s.ctx.tenant.tenant_id, &s.staff, "social.snapshots", None, "all", None, Some(json!({"written": w})), &n).await;
    Ok(Json(json!({"written": w, "audit": [a]})))
}

pub async fn settings(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    Ok(Json(json!({"settings": st.social.settings(s.ctx.tenant.tenant_id).json()})))
}

pub async fn save_settings(State(st): State<AppState>, s: StaffCtx, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_WRITE)?;
    let n = note(&b)?;
    let tenant = s.ctx.tenant.tenant_id;
    let old = st.social.settings(tenant);
    let mut x = old.clone();
    let pct = |k: &'static str, cur: D| -> ApiResult<D> {
        match dec(b.get(k), k)? {
            None => Ok(cur),
            Some(v) if v >= ZERO && v <= D::ONE_HUNDRED => Ok(v),
            Some(_) => Err(ApiError::Validation { field: k, message: format!("{k} must be between 0 and 100") }),
        }
    };
    x.fee_min_pct = pct("feeMinPct", x.fee_min_pct)?;
    x.fee_max_pct = pct("feeMaxPct", x.fee_max_pct)?;
    x.platform_cut_pct = pct("platformCutPct", x.platform_cut_pct)?;
    x.min_own_capital_pct = pct("minOwnCapitalPct", x.min_own_capital_pct)?;
    if x.fee_max_pct > D::from(90) {
        return Err(ApiError::Validation { field: "feeMaxPct", message: "The maximum fee is 90 %".into() });
    }
    if x.fee_min_pct > x.fee_max_pct {
        return Err(ApiError::Validation { field: "feeMinPct", message: "The minimum fee must not exceed the maximum".into() });
    }
    if let Some(v) = dec(b.get("minMasterEquity"), "minMasterEquity")? {
        x.min_master_equity = v.max(ZERO);
    }
    if let Some(v) = dec(b.get("minAllocation"), "minAllocation")? {
        x.min_allocation = v.max(ZERO);
    }
    if let Some(v) = b.get("minTrackDays").and_then(Value::as_i64) {
        x.min_track_days = v.clamp(0, 3650);
    }
    if let Some(v) = b.get("tradeDelayMinutes").and_then(Value::as_i64) {
        x.trade_delay_minutes = v.clamp(0, 10080);
    }
    sqlx::query(
        "INSERT INTO social_settings (tenant_id, fee_min_pct, fee_max_pct, platform_cut_pct, min_track_days, min_own_capital_pct, min_master_equity, min_allocation, trade_delay_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (tenant_id) DO UPDATE SET fee_min_pct=$2, fee_max_pct=$3, platform_cut_pct=$4, min_track_days=$5, min_own_capital_pct=$6,
            min_master_equity=$7, min_allocation=$8, trade_delay_minutes=$9, updated_at=now()",
    )
    .bind(tenant)
    .bind(x.fee_min_pct)
    .bind(x.fee_max_pct)
    .bind(x.platform_cut_pct)
    .bind(x.min_track_days as i32)
    .bind(x.min_own_capital_pct)
    .bind(x.min_master_equity)
    .bind(x.min_allocation)
    .bind(x.trade_delay_minutes as i32)
    .execute(&st.pool)
    .await?;
    st.social.reg.write().unwrap().settings.insert(tenant, x.clone());
    let a = st.social.audit(tenant, &s.staff, "social.settings", None, "settings", Some(old.json()), Some(x.json()), &n).await;
    Ok(Json(json!({"settings": x.json(), "audit": [a]})))
}

pub async fn fees(State(st): State<AppState>, s: StaffCtx, Query(q): Query<StatusQ>) -> ApiResult<Json<Value>> {
    let tenant = s.ctx.tenant.tenant_id;
    let mut items = fee_rows(&st, "f.tenant_id = $1", tenant).await?;
    if let Some(v) = q.status.as_deref().filter(|v| *v != "all") {
        items.retain(|f| f["status"] == v);
    }
    let rows = sqlx::query("SELECT status, count(*) AS n, COALESCE(sum(amount), 0) AS a FROM social_fees WHERE tenant_id = $1 GROUP BY status").bind(tenant).fetch_all(&st.pool).await?;
    let mut totals = json!({});
    for k in ["pending", "approved", "paid", "rejected", "failed"] {
        totals[k] = json!({"count": 0, "amount": 0});
    }
    for r in rows {
        totals[r.get::<String, _>("status")] = json!({"count": r.get::<i64, _>("n"), "amount": num(r.get::<D, _>("a"))});
    }
    Ok(Json(json!({"items": items, "totals": totals})))
}

/// D76: approve (pay the master's wallet: fee − platform cut) or reject (refund the payer's wallet).
pub async fn review_fee(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<Map<String, Value>>) -> ApiResult<Json<Value>> {
    s.require(ROLES_SOCIAL_APPROVE)?;
    let n = note(&b)?;
    let tenant = s.ctx.tenant.tenant_id;
    let approve = match b.get("decision").and_then(Value::as_str) {
        Some("approve") => true,
        Some("reject") => false,
        _ => return Err(ApiError::Validation { field: "decision", message: "decision must be approve or reject".into() }),
    };
    let mut t = st.pool.begin().await?;
    let r = sqlx::query("UPDATE social_fees SET status = $3, reviewed_by = $4, note = $5, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND status = 'pending' RETURNING *")
        .bind(id)
        .bind(tenant)
        .bind(if approve { "approved" } else { "rejected" })
        .bind(&s.staff.name)
        .bind(&n)
        .fetch_optional(&mut *t)
        .await?
        .ok_or_else(|| ApiError::Conflict { code: "fee_status", message: "This fee is not pending".into() })?;
    let master_id: i64 = r.get("master_id");
    let master_user = st.social.reg.read().unwrap().masters.get(&master_id).map(|m| m.user_id).unwrap_or(0);
    if approve {
        let amt: D = r.get("master_amount");
        if amt > ZERO {
            crate::social::wallet::enqueue(&mut *t, tenant, &format!("fee:{id}"), master_user, amt, crate::social::wallet::CREDIT, "copy_fee", &format!("fee:{id}"), "Performance fee payout").await?;
        } else {
            sqlx::query("UPDATE social_fees SET status = 'paid', paid_at = now() WHERE id = $1").bind(id).execute(&mut *t).await?;
        }
    } else {
        let amt: D = r.get("amount");
        crate::social::wallet::enqueue(&mut *t, tenant, &format!("fee-refund:{id}"), r.get("payer_user_id"), amt, crate::social::wallet::CREDIT, "refund", &format!("fee-refund:{id}"), "Performance fee refunded").await?;
    }
    t.commit().await?;
    let row = sqlx::query("SELECT f.*, m.nickname FROM social_fees f JOIN social_masters m ON m.id = f.master_id WHERE f.id = $1").bind(id).fetch_one(&st.pool).await?;
    let fee = fee_json(&row);
    let a = st.social.audit(tenant, &s.staff, if approve { "social.fee.approve" } else { "social.fee.reject" }, Some(row.get("login")), &format!("fee:{id}"), Some(json!({"feeId": id, "status": "pending"})), Some(json!({"feeId": id, "status": fee["status"], "amount": fee["amount"], "masterAmount": fee["masterAmount"]})), &n).await;
    // deliver the payout right away when the wallet is up (the outbox retries otherwise)
    let slugs = st.hub.shared.registry.clone();
    crate::social::wallet::flush(&st.pool, &st.social.wallet, |t| slugs.get(t).map(|x| x.slug.clone()).unwrap_or_else(|| "kalks".into())).await;
    let row = sqlx::query("SELECT f.*, m.nickname FROM social_fees f JOIN social_masters m ON m.id = f.master_id WHERE f.id = $1").bind(id).fetch_one(&st.pool).await?;
    Ok(Json(json!({"fee": fee_json(&row), "audit": [a]})))
}

#[derive(Deserialize)]
pub struct AuditQ {
    limit: Option<i64>,
    before: Option<String>,
}

pub async fn audit(State(st): State<AppState>, s: StaffCtx, Query(q): Query<AuditQ>) -> ApiResult<Json<Value>> {
    let before: Option<i64> = q.before.as_deref().map(|b| b.trim_start_matches("AUD-").trim_start_matches('0')).and_then(|b| b.parse().ok());
    let rows = sqlx::query("SELECT * FROM audit_log WHERE tenant_id = $1 AND action LIKE 'social.%' AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT $3")
        .bind(s.ctx.tenant.tenant_id)
        .bind(before)
        .bind(q.limit.unwrap_or(200).clamp(1, 1000))
        .fetch_all(&st.pool)
        .await?;
    let out: Vec<Value> = rows
        .iter()
        .map(|r| {
            let a = crate::persist::AuditRow {
                tenant_id: r.get("tenant_id"),
                at: r.get("at"),
                staff_id: r.get("staff_id"),
                staff_name: r.get("staff_name"),
                staff_role: r.get("staff_role"),
                action: r.get("action"),
                tickets: r.get("tickets"),
                login: r.get("login"),
                symbol: r.get("symbol"),
                before: r.get::<Option<sqlx::types::Json<Value>>, _>("before").map(|j| j.0),
                after: r.get::<Option<sqlx::types::Json<Value>>, _>("after").map(|j| j.0),
                reason_code: r.get("reason_code"),
                note: r.get("note"),
                flags: r.get("flags"),
            };
            crate::persist::audit_json(r.get("id"), &a)
        })
        .collect();
    Ok(Json(json!(out)))
}
