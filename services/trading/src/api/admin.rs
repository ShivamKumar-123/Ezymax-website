//! Back Office account operations: account list/search/detail, balance / credit / bonus adjustments with a
//! reason (ledger postings, D118), status, group, leverage, and group configuration CRUD (D123).

use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::Arc;

use super::dealing::{Reason, audit_now, check_reason};
use super::{ApiError, ApiResult, AppState, Body, ROLES_CONFIG, ROLES_DEALING, ROLES_FINANCE, StaffCtx};
use crate::engine::AuditDraft;
use crate::engine::funds::{self, AdjustKind};
use crate::model::{Book, Mode, Status};
use crate::money::{D, de_dec, num};
use crate::persist::{self, AuditRow};
use crate::rules::Group;
use crate::shard::{ExecError, Op};
use crate::views;

#[derive(Deserialize)]
pub struct ListQ {
    q: Option<String>,
    group: Option<String>,
    #[serde(rename = "type")]
    kind: Option<String>,
    status: Option<String>,
    user_id: Option<i64>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn accounts(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let page = q.page.unwrap_or(1).max(1);
    let search = q.q.as_deref().map(str::trim).filter(|x| !x.is_empty()).map(|x| format!("%{}%", x.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")));
    let rows = sqlx::query(
        "SELECT login, count(*) OVER () AS total FROM accounts WHERE tenant_id = $1
           AND ($2::text IS NULL OR login::text LIKE $2 OR name ILIKE $2 OR user_id::text LIKE $2)
           AND ($3::text IS NULL OR group_code = $3) AND ($4::text IS NULL OR kind = $4) AND ($5::text IS NULL OR status = $5)
           AND ($6::bigint IS NULL OR user_id = $6)
         ORDER BY login DESC OFFSET $7 LIMIT $8",
    )
    .bind(s.ctx.tenant.tenant_id)
    .bind(&search)
    .bind(&q.group)
    .bind(&q.kind)
    .bind(&q.status)
    .bind(q.user_id)
    .bind((page - 1) * limit)
    .bind(limit)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let mut items = Vec::new();
    for r in rows {
        let v = super::terminal::account_view(&st, r.get("login")).await;
        if !v.is_null() {
            items.push(v);
        }
    }
    Ok(Json(json!({"items": items, "page": page, "limit": limit, "total": total})))
}

pub async fn account(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>) -> ApiResult<Json<Value>> {
    let m = st.hub.meta(login).filter(|m| m.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    let _ = m;
    let v = st
        .hub
        .read(
            login,
            Box::new(|x| match x {
                Some((a, env)) => json!({
                    "account": views::account_json(env, a),
                    "positions": a.positions.values().map(|p| views::desk_position_json(env, a, p)).collect::<Vec<_>>(),
                    "orders": a.orders.values().map(|o| views::desk_order_json(a, o)).collect::<Vec<_>>(),
                }),
                None => Value::Null,
            }),
        )
        .await;
    let last: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar("SELECT last_activity_at FROM accounts WHERE login = $1").bind(login).fetch_optional(&st.pool).await?;
    let mut v = v;
    v["lastActivityAt"] = json!(last);
    Ok(Json(v))
}

async fn staff_exec(st: &AppState, s: &StaffCtx, login: i64, r: &Reason, attempted: &str, op: Op) -> ApiResult<Json<Value>> {
    st.hub.meta(login).filter(|m| m.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    match st.hub.exec(login, &format!("staff:{}", s.staff.id), Some(s.staff.clone()), &r.reason_code, r.note.trim(), None, op).await {
        Ok(d) => Ok(Json(json!({"data": d.value, "audit": d.audit}))),
        Err(ExecError::Reject(rej)) => {
            let a = AuditRow {
                tenant_id: s.ctx.tenant.tenant_id,
                at: chrono::Utc::now(),
                staff_id: s.staff.id.clone(),
                staff_name: s.staff.name.clone(),
                staff_role: s.staff.role.clone(),
                action: "account.rejected".into(),
                tickets: vec![],
                login: Some(login),
                symbol: None,
                before: None,
                after: Some(json!({"attempted": attempted, "error": rej.message})),
                reason_code: r.reason_code.clone(),
                note: r.note.clone(),
                flags: vec!["rejected".into()],
            };
            let entry = audit_now(st, a).await?;
            Err(ApiError::Reject { reject: rej, audit: vec![entry] })
        }
        Err(e) => Err(e.into()),
    }
}

fn draft(action: &'static str, before: Value, after: Value, flags: Vec<&str>) -> AuditDraft {
    AuditDraft { action, tickets: vec![], login: None, symbol: None, before: Some(before), after: Some(after), flags: flags.into_iter().map(String::from).collect() }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BalanceBody {
    /// deposit | withdrawal | adjustment | credit | bonus
    #[serde(rename = "type")]
    kind: String,
    /// Signed, in the account currency (USC for cent accounts). deposit/withdrawal use the absolute value.
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    #[serde(default)]
    idempotency_key: Option<String>,
    #[serde(flatten)]
    reason: Reason,
}

pub async fn balance(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>, Body(b): Body<BalanceBody>) -> ApiResult<Json<Value>> {
    s.require(ROLES_FINANCE)?;
    check_reason(&b.reason)?;
    if b.reason.note.trim().is_empty() {
        return Err(ApiError::Validation { field: "note", message: "Balance and credit adjustments need a note".into() });
    }
    let kind = AdjustKind::parse(&b.kind).ok_or(ApiError::Validation { field: "type", message: "type must be deposit, withdrawal, adjustment, credit or bonus".into() })?;
    let key = format!("staff:{}", b.idempotency_key.clone().unwrap_or_else(|| crate::auth::random_token(12)));
    let (code, note, kind_s) = (b.reason.reason_code.clone(), b.reason.note.trim().to_string(), b.kind.clone());
    let op: Op = Box::new(move |tx, env| {
        let before = json!({"balance": num(tx.st.balance), "credit": num(tx.st.credit), "bonus": num(tx.st.bonus)});
        let txn = funds::adjust(tx, env, kind, b.amount, &key, &code, &note)?;
        let after = json!({"balance": num(tx.st.balance), "credit": num(tx.st.credit), "bonus": num(tx.st.bonus), "txn": txn, "type": kind_s, "amount": num(b.amount)});
        tx.audit.push(draft(if matches!(kind, AdjustKind::Credit | AdjustKind::Bonus) { "account.credit" } else { "account.balance" }, before, after.clone(), vec!["ledger"]));
        Ok(after)
    });
    match staff_exec(&st, &s, login, &b.reason, "balance adjustment", op).await {
        Err(ApiError::Conflict { code: "duplicate_idempotency_key", .. }) => Err(ApiError::Conflict { code: "duplicate_idempotency_key", message: "This adjustment was already booked".into() }),
        r => r,
    }
}

#[derive(Deserialize)]
pub struct StatusBody {
    status: String,
    #[serde(flatten)]
    reason: Reason,
}

pub async fn status(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>, Body(b): Body<StatusBody>) -> ApiResult<Json<Value>> {
    s.require(ROLES_DEALING)?;
    check_reason(&b.reason)?;
    let status = Status::parse(&b.status).ok_or(ApiError::Validation { field: "status", message: "status must be active, disabled, close_only, read_only or expired".into() })?;
    let op: Op = Box::new(move |tx, _| {
        let before = tx.st.account.status;
        funds::set_status(tx, status)?;
        tx.audit.push(draft("account.status", json!({"status": before.as_str()}), json!({"status": status.as_str()}), vec![]));
        Ok(json!({"status": status.as_str()}))
    });
    staff_exec(&st, &s, login, &b.reason, "status", op).await
}

#[derive(Deserialize)]
pub struct GroupBody {
    group: String,
    #[serde(flatten)]
    reason: Reason,
}

pub async fn group(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>, Body(b): Body<GroupBody>) -> ApiResult<Json<Value>> {
    s.require(ROLES_DEALING)?;
    check_reason(&b.reason)?;
    let g = s.ctx.tenant.groups.get(&b.group).cloned().ok_or(ApiError::Validation { field: "group", message: "Unknown group".into() })?;
    let op: Op = Box::new(move |tx, _| {
        let (from, to) = funds::change_group(tx, &g)?;
        tx.audit.push(draft("account.group", json!({"group": from}), json!({"group": to, "leverage": tx.st.account.leverage}), vec![]));
        Ok(json!({"group": to}))
    });
    let r = staff_exec(&st, &s, login, &b.reason, "change group", op).await?;
    // the account may now listen to another spread group's feed
    Ok(r)
}

#[derive(Deserialize)]
pub struct LeverageBody {
    leverage: u32,
    #[serde(flatten)]
    reason: Reason,
}

/// Staff may change leverage with open positions (margin is recomputed at once).
pub async fn leverage(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>, Body(b): Body<LeverageBody>) -> ApiResult<Json<Value>> {
    s.require(ROLES_DEALING)?;
    check_reason(&b.reason)?;
    let op: Op = Box::new(move |tx, env| {
        let (from, to) = funds::change_leverage(tx, env, b.leverage, true)?;
        crate::engine::risk::check_margin(tx, env);
        tx.audit.push(draft("account.leverage", json!({"leverage": from}), json!({"leverage": to}), vec![]));
        Ok(json!({"leverage": to}))
    });
    staff_exec(&st, &s, login, &b.reason, "change leverage", op).await
}

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

pub async fn groups(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    let counts: Vec<(String, i64)> = sqlx::query_as("SELECT group_code, count(*) FROM accounts WHERE tenant_id = $1 GROUP BY group_code").bind(s.ctx.tenant.tenant_id).fetch_all(&st.pool).await?;
    let mut v: Vec<Value> = s
        .ctx
        .tenant
        .groups
        .values()
        .map(|g| {
            let mut j = json!(g);
            j["accounts"] = json!(counts.iter().find(|(c, _)| *c == g.code).map(|(_, n)| *n).unwrap_or(0));
            j
        })
        .collect();
    v.sort_by(|a, b| a["code"].as_str().cmp(&b["code"].as_str()));
    Ok(Json(json!({"groups": v})))
}

#[derive(Deserialize)]
pub struct GroupWrite {
    #[serde(flatten)]
    group: Group,
    #[serde(flatten)]
    reason: Reason,
}

fn validate_group(g: &Group) -> ApiResult<()> {
    let bad = |field: &'static str, m: &str| Err(ApiError::Validation { field, message: m.into() });
    if !g.code.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') || g.code.is_empty() || g.code.len() > 40 {
        return bad("code", "code must be lowercase letters, digits or dashes");
    }
    if g.leverages.is_empty() || g.leverages.iter().any(|l| *l == 0 || *l > 3000) || !g.leverages.contains(&g.default_leverage) {
        return bad("leverages", "leverages must be 1–3000 and include the default leverage");
    }
    if g.stop_out_pct >= g.margin_call_pct || g.stop_out_pct < D::ZERO {
        return bad("stopOutPct", "stop-out must be below the margin call level");
    }
    if g.hedged_margin_pct < D::ZERO || g.hedged_margin_pct > D::ONE_HUNDRED {
        return bad("hedgedMarginPct", "hedged margin must be 0–100 %");
    }
    if !["live", "demo", "both"].contains(&g.account_types.as_str()) {
        return bad("accountTypes", "accountTypes must be live, demo or both");
    }
    if g.commission_per_lot < D::ZERO || g.min_deposit < D::ZERO || g.demo_initial_balance <= D::ZERO {
        return bad("commissionPerLot", "amounts must not be negative");
    }
    if g.spread_group.trim().is_empty() {
        return bad("spreadGroup", "spreadGroup is required (market-data spread group)");
    }
    Ok(())
}

async fn save_group(st: &AppState, s: &StaffCtx, g: &Group, r: &Reason, insert: bool) -> ApiResult<Json<Value>> {
    let t = s.ctx.tenant.tenant_id;
    let before = s.ctx.tenant.groups.get(&g.code).map(|x| json!(x));
    let mut tx = st.pool.begin().await?;
    let q = if insert {
        "INSERT INTO groups (tenant_id, code, name, mode, cent, account_types, leverages, default_leverage, margin_call_pct, stop_out_pct, hedged_margin_pct, min_deposit,
                             swap_free, commission_per_lot, route, spread_group, max_accounts_per_user, demo_initial_balance, demo_refills_per_day, demo_expiry_days, enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT DO NOTHING"
    } else {
        "UPDATE groups SET name=$3, mode=$4, cent=$5, account_types=$6, leverages=$7, default_leverage=$8, margin_call_pct=$9, stop_out_pct=$10, hedged_margin_pct=$11,
            min_deposit=$12, swap_free=$13, commission_per_lot=$14, route=$15, spread_group=$16, max_accounts_per_user=$17, demo_initial_balance=$18,
            demo_refills_per_day=$19, demo_expiry_days=$20, enabled=$21, updated_at=now() WHERE tenant_id=$1 AND code=$2"
    };
    let n = sqlx::query(q)
        .bind(t)
        .bind(&g.code)
        .bind(&g.name)
        .bind(if g.mode == Mode::Netting { "netting" } else { "hedging" })
        .bind(g.cent)
        .bind(&g.account_types)
        .bind(g.leverages.iter().map(|x| *x as i32).collect::<Vec<i32>>())
        .bind(g.default_leverage as i32)
        .bind(g.margin_call_pct)
        .bind(g.stop_out_pct)
        .bind(g.hedged_margin_pct)
        .bind(g.min_deposit)
        .bind(g.swap_free)
        .bind(g.commission_per_lot)
        .bind(if g.route == Book::A { "A" } else { "B" })
        .bind(&g.spread_group)
        .bind(g.max_accounts_per_user as i32)
        .bind(g.demo_initial_balance)
        .bind(g.demo_refills_per_day as i32)
        .bind(g.demo_expiry_days as i32)
        .bind(g.enabled)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(if insert { ApiError::Conflict { code: "exists", message: format!("Group {} already exists", g.code) } } else { ApiError::NotFound(format!("Group {} not found", g.code)) });
    }
    let a = AuditRow {
        tenant_id: t,
        at: chrono::Utc::now(),
        staff_id: s.staff.id.clone(),
        staff_name: s.staff.name.clone(),
        staff_role: s.staff.role.clone(),
        action: if insert { "group.create".into() } else { "group.update".into() },
        tickets: vec![],
        login: None,
        symbol: None,
        before,
        after: Some(json!(g)),
        reason_code: r.reason_code.clone(),
        note: r.note.clone(),
        flags: vec![],
    };
    let id = persist::insert_audit(&mut *tx, &a).await?;
    tx.commit().await?;
    let mut g = g.clone();
    g.tenant_id = t;
    st.hub.shared.registry.update(t, |cfg| {
        cfg.groups.insert(g.code.clone(), g.clone());
    });
    Ok(Json(json!({"data": g, "audit": [persist::audit_json(id, &a)]})))
}

pub async fn create_group(State(st): State<AppState>, s: StaffCtx, Body(b): Body<GroupWrite>) -> ApiResult<Json<Value>> {
    s.require(ROLES_CONFIG)?;
    check_reason(&b.reason)?;
    validate_group(&b.group)?;
    save_group(&st, &s, &b.group, &b.reason, true).await
}

/// Updates a group. Mode and cent flag are fixed once the group has accounts (they are copied into each
/// account's ledger currency / position model); other settings apply to the group's accounts at once.
pub async fn update_group(State(st): State<AppState>, s: StaffCtx, Path(code): Path<String>, Body(mut b): Body<GroupWrite>) -> ApiResult<Json<Value>> {
    s.require(ROLES_CONFIG)?;
    check_reason(&b.reason)?;
    b.group.code = code.clone();
    validate_group(&b.group)?;
    let cur = s.ctx.tenant.groups.get(&code).ok_or_else(|| ApiError::NotFound(format!("Group {code} not found")))?;
    let used: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE tenant_id = $1 AND group_code = $2").bind(s.ctx.tenant.tenant_id).bind(&code).fetch_one(&st.pool).await?;
    if used > 0 && (cur.mode != b.group.mode || cur.cent != b.group.cent) {
        return Err(ApiError::Validation { field: "mode", message: "Mode and cent cannot change while the group has accounts".into() });
    }
    let _ = Arc::strong_count(&s.ctx.tenant);
    save_group(&st, &s, &b.group, &b.reason, false).await
}

/// House and client ledger balances (reconciliation, D141).
pub async fn ledger_accounts(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    let rows = sqlx::query("SELECT code, currency, balance FROM ledger_accounts WHERE tenant_id = $1 AND code LIKE 'house:%' ORDER BY code").bind(s.ctx.tenant.tenant_id).fetch_all(&st.pool).await?;
    let house: Vec<Value> = rows.iter().map(|r| json!({"code": r.get::<String, _>("code"), "currency": r.get::<String, _>("currency"), "balance": num(r.get("balance"))})).collect();
    let totals: Vec<(String, D)> = sqlx::query_as("SELECT currency, COALESCE(sum(balance),0) FROM ledger_accounts WHERE tenant_id = $1 GROUP BY currency").bind(s.ctx.tenant.tenant_id).fetch_all(&st.pool).await?;
    Ok(Json(json!({"house": house, "netByCurrency": totals.iter().map(|(c, v)| json!({"currency": c, "net": num(*v)})).collect::<Vec<_>>()})))
}
