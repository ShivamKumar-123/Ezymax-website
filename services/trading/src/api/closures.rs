//! Close permanently and the closure queue (B12, C2, C3, C5, C8, C11, C12), plus the per-broker account policy and
//! the Back Office bulk actions on accounts (C4).
//!
//! **Requests** (`account_closures`): a client asks to close a live account from the Client Area (exit survey,
//! `api/lifecycle.rs`), or staff with `accounts.close` open one from Trading › Accounts. Compliance approves or
//! rejects it in Trading › Closures (`accounts.close.approve`):
//! - the C3 checks are evaluated live and approve stays refused until every one passes: flat, zero balance, no
//!   pending wallet operation (wallet `GET /v1/internal/trading/{login}/pending`), no copy / master / PAMM / MAM /
//!   prop link, no compliance hold (the gateway's client restrictions `freeze`, `login`, `withdrawals`, `transfers`
//!   stand in for an AML case);
//! - four-eyes (C2): when the balance (+ credit + bonus) at request time was above the broker's
//!   `close_four_eyes_usd`, two different approvers are needed, neither of them the staff requester;
//! - the client gets a bell + email with a client-facing reason template (C5); the internal note stays private.
//!
//! **Reopen** (C12): a Super Admin requests it with a reason; another Super Admin approves it (always four-eyes).
//!
//! Routes (staff identity headers; the Back Office BFF forwards `X-Kalks-Staff-Perms`):
//! * `GET  /v1/admin/closures?status&kind&q&page&limit`   queue (pending first) with templates and survey reasons
//! * `GET  /v1/admin/closures/{id}`                       one request with its live checks
//! * `POST /v1/admin/closures/{id}/approve`               `{note?}`                       accounts.close.approve
//! * `POST /v1/admin/closures/{id}/reject`                `{clientReason, clientMessage?, note?}`
//! * `GET  /v1/admin/closures/report?days`                exit reasons report (C11)
//! * `GET  /v1/admin/accounts/{login}/closure-check`      live checks for an account
//! * `POST /v1/admin/accounts/{login}/closure`            `{reasonCode, note, empty?}`    accounts.close
//! * `POST /v1/admin/accounts/{login}/reopen`             `{reasonCode, note}`            Super Admin
//! * `GET|PUT /v1/admin/account-policy`                   demo archive days, dormancy, four-eyes, retention
//! * `POST /v1/admin/accounts/bulk`                       `{action: archive, target: expired_demos|empty_dormant|logins, logins?, dryRun, reasonCode, note}`

use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::dealing::{Reason, audit_now, check_reason};
use super::lifecycle::{self, Check};
use super::{ApiError, ApiResult, AppState, Body, Ctx, ROLES_CONFIG, ROLES_DEALING, StaffCtx};
use crate::engine::{AuditDraft, funds};
use crate::model::{AccountKind, Status};
use crate::money::{D, ZERO, num, r2};
use crate::persist::AuditRow;
use crate::shard::{ExecError, Op};

/// Role fallbacks when the caller forwarded no permission list (C8: admins and Compliance).
pub const ROLES_CLOSE: &[&str] = &["platform_owner", "super_admin", "admin", "compliance"];
pub const ROLES_SUPER: &[&str] = &["platform_owner", "super_admin"];
const ROLES_READ: &[&str] = &["platform_owner", "super_admin", "admin", "dealer", "risk_manager", "compliance", "finance", "support", "viewer"];

/// Exit survey reasons (C11), in display order.
pub const SURVEY_REASONS: &[&str] = &["costs", "platform", "performance", "other_broker", "stop_trading", "too_many_accounts", "service", "other"];

/// Client-facing reason templates (C5): key, used on approve or reject, English text (`{login}`, `{message}`).
pub const TEMPLATES: &[(&str, &str, &str)] = &[
    ("closed_as_requested", "approve", "Your trading account #{login} has been closed as you asked. Your statements stay available in the Client Area."),
    ("closed_by_broker", "approve", "Your trading account #{login} has been closed. Your statements stay available in the Client Area. {message}"),
    ("open_positions", "reject", "We couldn't close account #{login} yet: it still has open trades or orders. Close them and ask again."),
    ("balance_remaining", "reject", "We couldn't close account #{login} yet: it still holds a balance. Move it to your wallet and ask again."),
    ("pending_operations", "reject", "We couldn't close account #{login} yet: a transfer or adjustment on it is still being processed. Please ask again once it has completed."),
    ("linked_services", "reject", "We couldn't close account #{login}: it is linked to copy trading, PAMM, MAM or a prop challenge. End that first, then ask again."),
    ("compliance_review", "reject", "We can't close account #{login} right now because a review of your profile is in progress. Our team will contact you."),
    ("other", "reject", "We couldn't close account #{login}. {message}"),
];

pub fn template_text(key: &str, login: i64, message: &str) -> Option<String> {
    TEMPLATES.iter().find(|t| t.0 == key).map(|t| t.2.replace("{login}", &login.to_string()).replace("{message}", message.trim()).trim().to_string())
}

fn templates_json() -> Value {
    json!(TEMPLATES.iter().map(|(k, on, text)| json!({"key": k, "on": on, "text": text})).collect::<Vec<_>>())
}

/* ------------------------------------------------------------------ */
/* Policy                                                              */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug)]
pub struct Policy {
    pub demo_archive_days: i32,
    pub dormant_days: i32,
    pub dormant_auto_archive: bool,
    pub close_four_eyes_usd: D,
    pub retention_years: i32,
}

impl Default for Policy {
    fn default() -> Self {
        Self { demo_archive_days: 30, dormant_days: 180, dormant_auto_archive: true, close_four_eyes_usd: D::from(1000), retention_years: 7 }
    }
}

impl Policy {
    pub fn json(&self) -> Value {
        json!({"demoArchiveDays": self.demo_archive_days, "dormantDays": self.dormant_days, "dormantAutoArchive": self.dormant_auto_archive,
               "closeFourEyesUsd": num(self.close_four_eyes_usd), "retentionYears": self.retention_years})
    }
}

/// The broker's account policy (defaults until it saves one).
pub async fn policy(pool: &sqlx::PgPool, tenant_id: i64) -> anyhow::Result<Policy> {
    let r = sqlx::query("SELECT * FROM account_policies WHERE tenant_id = $1").bind(tenant_id).fetch_optional(pool).await?;
    Ok(match r {
        Some(r) => Policy {
            demo_archive_days: r.get("demo_archive_days"),
            dormant_days: r.get("dormant_days"),
            dormant_auto_archive: r.get("dormant_auto_archive"),
            close_four_eyes_usd: r.get("close_four_eyes_usd"),
            retention_years: r.get("retention_years"),
        },
        None => Policy::default(),
    })
}

pub async fn get_policy(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    s.require_perm("accounts.read", ROLES_READ)?;
    Ok(Json(json!({"data": policy(&st.pool, s.ctx.tenant.tenant_id).await?.json()})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyBody {
    demo_archive_days: i32,
    dormant_days: i32,
    dormant_auto_archive: bool,
    #[serde(deserialize_with = "crate::money::de_dec")]
    close_four_eyes_usd: D,
    retention_years: i32,
    #[serde(flatten)]
    reason: Reason,
}

pub async fn put_policy(State(st): State<AppState>, s: StaffCtx, Body(b): Body<PolicyBody>) -> ApiResult<Json<Value>> {
    s.require(ROLES_CONFIG)?;
    check_reason(&b.reason)?;
    let bad = |field: &'static str, m: &str| Err(ApiError::Validation { field, message: m.into() });
    if !(0..=3650).contains(&b.demo_archive_days) {
        return bad("demoArchiveDays", "0 – 3650 days (0 = never)");
    }
    if !(0..=3650).contains(&b.dormant_days) {
        return bad("dormantDays", "0 – 3650 days (0 = never)");
    }
    if b.close_four_eyes_usd < ZERO {
        return bad("closeFourEyesUsd", "Must be 0 or more");
    }
    if !(1..=50).contains(&b.retention_years) {
        return bad("retentionYears", "1 – 50 years");
    }
    let tenant = s.ctx.tenant.tenant_id;
    let before = policy(&st.pool, tenant).await?;
    sqlx::query(
        "INSERT INTO account_policies (tenant_id, demo_archive_days, dormant_days, dormant_auto_archive, close_four_eyes_usd, retention_years, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (tenant_id) DO UPDATE SET demo_archive_days = EXCLUDED.demo_archive_days, dormant_days = EXCLUDED.dormant_days,
            dormant_auto_archive = EXCLUDED.dormant_auto_archive, close_four_eyes_usd = EXCLUDED.close_four_eyes_usd,
            retention_years = EXCLUDED.retention_years, updated_by = EXCLUDED.updated_by, updated_at = now()",
    )
    .bind(tenant)
    .bind(b.demo_archive_days)
    .bind(b.dormant_days)
    .bind(b.dormant_auto_archive)
    .bind(r2(b.close_four_eyes_usd))
    .bind(b.retention_years)
    .bind(format!("staff:{}", s.staff.id))
    .execute(&st.pool)
    .await?;
    let after = policy(&st.pool, tenant).await?;
    let entry = audit_now(&st, row(&s, &b.reason, "account.policy", None, Some(before.json()), Some(after.json()), vec![])).await?;
    Ok(Json(json!({"data": after.json(), "audit": [entry]})))
}

/* ------------------------------------------------------------------ */
/* Checks (C3)                                                         */
/* ------------------------------------------------------------------ */

fn item(key: &str, ok: bool, label: &str, detail: impl Into<String>) -> Value {
    json!({"key": key, "ok": ok, "label": label, "detail": detail.into()})
}

/// Restriction kinds that count as a compliance hold.
const HOLD_KINDS: &[&str] = &["freeze", "login", "withdrawals", "transfers"];

/// The C3 checks of one account, evaluated now. `(account check, items, all passed)`.
pub async fn closure_checks(st: &AppState, ctx: &Ctx, login: i64) -> ApiResult<(Check, Vec<Value>, bool)> {
    let c = lifecycle::check(st, login).await?;
    let mut items = Vec::new();
    items.push(item("status", c.status != Status::Closed, "Not closed yet", if c.status == Status::Closed { "The account is already closed".to_string() } else { format!("Status {}", c.status.as_str()) }));
    let flat = c.positions == 0 && c.orders == 0;
    items.push(item("flat", flat, "No open trades or orders", if flat { "Flat".to_string() } else { format!("{} position(s), {} order(s) open", c.positions, c.orders) }));
    let bal = r2(c.balance);
    let ccy = if c.usd_factor == D::ONE { "USD" } else { "USC" };
    let extra = if c.credit > ZERO || c.bonus > ZERO { format!(" · credit {} and bonus {} are forfeited on closure", r2(c.credit).normalize(), r2(c.bonus).normalize()) } else { String::new() };
    items.push(item("zero_balance", bal == ZERO, "Zero balance", format!("Balance {} {ccy}{extra}", bal.normalize())));
    // wallet operations still open on this login
    let (wallet_ok, wallet_detail) = if st.cfg.wallet_url.trim().is_empty() {
        (true, "Wallet service not configured (development): skipped".to_string())
    } else {
        match st.social.wallet.post(&st.social.slug(ctx.tenant.tenant_id), &format!("/v1/internal/trading/{login}/pending?user_id={}", c.user_id), &json!({})).await {
            Ok(v) => {
                let blocking = v["blocking"].as_u64().unwrap_or(0);
                let wd = v["withdrawals"].as_i64().unwrap_or(0);
                let mut d = if blocking == 0 { "No pending transfers or adjustments".to_string() } else { format!("{} transfer(s), {} adjustment(s) pending", v["transfers"], v["adjustments"]) };
                if wd > 0 {
                    d.push_str(&format!(" · the client has {wd} wallet withdrawal(s) in progress"));
                }
                (blocking == 0, d)
            }
            Err(e) => (false, format!("Wallet check unavailable: {}", e.message)),
        }
    };
    items.push(item("wallet_pending", wallet_ok, "No pending wallet operations", wallet_detail));
    let links: Vec<&String> = c.blockers.iter().filter(|(code, _)| matches!(*code, "copy_subscription" | "master_followers" | "pamm_fund" | "mam_link" | "prop_account")).map(|(_, m)| m).collect();
    items.push(item(
        "no_services",
        links.is_empty(),
        "No copy / master / PAMM / MAM / prop link",
        if links.is_empty() { "None".to_string() } else { links.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(" · ") },
    ));
    let holds: Vec<String> = st.hub.shared.restrictions.kinds(c.user_id, Utc::now()).into_iter().filter(|k| HOLD_KINDS.contains(&k.as_str())).collect();
    items.push(item("compliance_hold", holds.is_empty(), "No compliance hold", if holds.is_empty() { "No active hold".to_string() } else { format!("Active client restriction: {}", holds.join(", ")) }));
    let ok = items.iter().all(|i| i["ok"] == true);
    Ok((c, items, ok))
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

pub fn closure_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "login": r.get::<i64, _>("login"), "userId": r.get::<i64, _>("user_id"),
        "kind": r.get::<String, _>("kind"), "source": r.get::<String, _>("source"), "status": r.get::<String, _>("status"),
        "reasonCode": r.get::<String, _>("reason_code"), "survey": r.get::<sqlx::types::Json<Value>, _>("survey").0, "note": r.get::<String, _>("note"),
        "balanceUsd": num(r.get::<D, _>("balance_usd")), "fourEyes": r.get::<bool, _>("four_eyes"),
        "requestedBy": r.get::<String, _>("requested_by"), "requestedByName": r.get::<String, _>("requested_by_name"),
        "firstApprovalBy": r.get::<Option<String>, _>("first_approval_by"), "firstApprovalName": r.get::<Option<String>, _>("first_approval_name"),
        "firstApprovalAt": r.get::<Option<chrono::DateTime<Utc>>, _>("first_approval_at"),
        "decidedBy": r.get::<Option<String>, _>("decided_by"), "decidedByName": r.get::<Option<String>, _>("decided_by_name"),
        "decidedAt": r.get::<Option<chrono::DateTime<Utc>>, _>("decided_at"),
        "clientReason": r.get::<Option<String>, _>("client_reason"), "clientMessage": r.get::<Option<String>, _>("client_message"),
        "decisionNote": r.get::<Option<String>, _>("decision_note"), "checks": r.get::<Option<sqlx::types::Json<Value>>, _>("checks").map(|j| j.0),
        "createdAt": r.get::<chrono::DateTime<Utc>, _>("created_at"), "updatedAt": r.get::<chrono::DateTime<Utc>, _>("updated_at"),
    })
}

/// What the client may see of a request (no internal notes, no staff names).
pub fn client_view(r: &sqlx::postgres::PgRow) -> Value {
    let login: i64 = r.get("login");
    let reason: Option<String> = r.get("client_reason");
    let msg: Option<String> = r.get("client_message");
    let text = reason.as_deref().and_then(|k| template_text(k, login, msg.as_deref().unwrap_or("")));
    json!({
        "id": r.get::<i64, _>("id"), "status": r.get::<String, _>("status"), "kind": r.get::<String, _>("kind"),
        "reasonCode": r.get::<String, _>("reason_code"), "createdAt": r.get::<chrono::DateTime<Utc>, _>("created_at"),
        "decidedAt": r.get::<Option<chrono::DateTime<Utc>>, _>("decided_at"), "clientReason": reason, "message": text,
        "source": r.get::<String, _>("source"),
    })
}

pub struct NewRequest<'a> {
    pub tenant_id: i64,
    pub login: i64,
    pub user_id: i64,
    pub kind: &'a str,
    pub source: &'a str,
    pub reason_code: &'a str,
    pub survey: Value,
    pub note: &'a str,
    pub balance_usd: D,
    pub four_eyes: bool,
    pub by: String,
    pub by_name: &'a str,
}

/// Inserts a pending request; 409 when one is already open for the account.
pub async fn insert_request(st: &AppState, n: NewRequest<'_>) -> ApiResult<sqlx::postgres::PgRow> {
    let r = sqlx::query(
        "INSERT INTO account_closures (tenant_id, login, user_id, kind, source, status, reason_code, survey, note, balance_usd, four_eyes, requested_by, requested_by_name)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING RETURNING *",
    )
    .bind(n.tenant_id)
    .bind(n.login)
    .bind(n.user_id)
    .bind(n.kind)
    .bind(n.source)
    .bind(n.reason_code)
    .bind(sqlx::types::Json(&n.survey))
    .bind(n.note)
    .bind(r2(n.balance_usd))
    .bind(n.four_eyes)
    .bind(&n.by)
    .bind(n.by_name)
    .fetch_optional(&st.pool)
    .await?;
    r.ok_or(ApiError::Conflict { code: "request_pending", message: format!("A {} request for #{} is already waiting for review", n.kind, n.login) })
}

/// The latest request of an account (any status).
pub async fn latest(st: &AppState, tenant_id: i64, login: i64, kind: &str) -> ApiResult<Option<sqlx::postgres::PgRow>> {
    Ok(sqlx::query("SELECT * FROM account_closures WHERE tenant_id = $1 AND login = $2 AND kind = $3 ORDER BY id DESC LIMIT 1").bind(tenant_id).bind(login).bind(kind).fetch_optional(&st.pool).await?)
}

/// Balance + credit + bonus in USD.
pub fn total_usd(c: &Check) -> D {
    r2((c.balance.max(ZERO) + c.credit.max(ZERO) + c.bonus.max(ZERO)) / c.usd_factor)
}

fn row(s: &StaffCtx, r: &Reason, action: &str, login: Option<i64>, before: Option<Value>, after: Option<Value>, flags: Vec<String>) -> AuditRow {
    AuditRow {
        tenant_id: s.ctx.tenant.tenant_id,
        at: Utc::now(),
        staff_id: s.staff.id.clone(),
        staff_name: s.staff.name.clone(),
        staff_role: s.staff.role.clone(),
        action: action.into(),
        tickets: vec![],
        login,
        symbol: None,
        before,
        after,
        reason_code: r.reason_code.clone(),
        note: r.note.trim().to_string(),
        flags,
    }
}

fn is_super(s: &StaffCtx) -> bool {
    ROLES_SUPER.contains(&s.staff.role.as_str())
}

fn me(s: &StaffCtx) -> String {
    format!("staff:{}", s.staff.id)
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

#[derive(Deserialize, Default)]
pub struct ListQ {
    status: Option<String>,
    kind: Option<String>,
    q: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn list(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    s.require_perm("accounts.close.approve", ROLES_CLOSE).or_else(|_| s.require_perm("accounts.close", ROLES_CLOSE))?;
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let page = q.page.unwrap_or(1).max(1);
    let status = q.status.as_deref().filter(|x| *x != "all" && !x.is_empty());
    let kind = q.kind.as_deref().filter(|x| *x != "all" && !x.is_empty());
    let search = q.q.as_deref().map(str::trim).filter(|x| !x.is_empty()).map(|x| format!("%{}%", x.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")));
    let rows = sqlx::query(
        "SELECT *, count(*) OVER () AS total FROM account_closures WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR kind = $3)
           AND ($4::text IS NULL OR login::text LIKE $4 OR user_id::text LIKE $4)
         ORDER BY (status = 'pending') DESC, id DESC OFFSET $5 LIMIT $6",
    )
    .bind(s.ctx.tenant.tenant_id)
    .bind(status)
    .bind(kind)
    .bind(&search)
    .bind((page - 1) * limit)
    .bind(limit)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let counts: Vec<(String, i64)> = sqlx::query_as("SELECT status, count(*) FROM account_closures WHERE tenant_id = $1 GROUP BY status").bind(s.ctx.tenant.tenant_id).fetch_all(&st.pool).await?;
    let mut items = Vec::new();
    for r in &rows {
        let mut v = closure_json(r);
        v["account"] = super::terminal::account_view(&st, r.get("login")).await;
        items.push(v);
    }
    let pol = policy(&st.pool, s.ctx.tenant.tenant_id).await?;
    Ok(Json(json!({
        "items": items, "page": page, "limit": limit, "total": total,
        "counts": counts.into_iter().map(|(k, v)| (k, json!(v))).collect::<serde_json::Map<String, Value>>(),
        "templates": templates_json(), "surveyReasons": SURVEY_REASONS, "policy": pol.json(),
        "me": {"id": me(&s), "role": s.staff.role, "superAdmin": is_super(&s)},
    })))
}

async fn load(st: &AppState, tenant: i64, id: i64) -> ApiResult<sqlx::postgres::PgRow> {
    sqlx::query("SELECT * FROM account_closures WHERE id = $1 AND tenant_id = $2").bind(id).bind(tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::NotFound("Request not found".into()))
}

pub async fn detail(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    s.require_perm("accounts.close.approve", ROLES_CLOSE).or_else(|_| s.require_perm("accounts.close", ROLES_CLOSE))?;
    let r = load(&st, s.ctx.tenant.tenant_id, id).await?;
    let mut v = closure_json(&r);
    let login: i64 = r.get("login");
    v["account"] = super::terminal::account_view(&st, login).await;
    if r.get::<String, _>("kind") == "close" && r.get::<String, _>("status") == "pending" {
        let (_, items, ok) = closure_checks(&st, &s.ctx, login).await?;
        v["liveChecks"] = json!(items);
        v["checksPassed"] = json!(ok);
    }
    let history = sqlx::query("SELECT * FROM account_closures WHERE tenant_id = $1 AND login = $2 AND id <> $3 ORDER BY id DESC LIMIT 20").bind(s.ctx.tenant.tenant_id).bind(login).bind(id).fetch_all(&st.pool).await?;
    v["history"] = json!(history.iter().map(closure_json).collect::<Vec<_>>());
    Ok(Json(json!({"data": v, "templates": templates_json()})))
}

pub async fn account_check(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>) -> ApiResult<Json<Value>> {
    s.require_perm("accounts.close", ROLES_CLOSE).or_else(|_| s.require_perm("accounts.close.approve", ROLES_CLOSE))?;
    st.hub.meta(login).filter(|m| m.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    let (c, items, ok) = closure_checks(&st, &s.ctx, login).await?;
    let pol = policy(&st.pool, s.ctx.tenant.tenant_id).await?;
    let pending = sqlx::query("SELECT * FROM account_closures WHERE tenant_id = $1 AND login = $2 AND status = 'pending' ORDER BY id DESC LIMIT 1").bind(s.ctx.tenant.tenant_id).bind(login).fetch_optional(&st.pool).await?;
    Ok(Json(json!({"data": {
        "login": login, "kind": c.kind.as_str(), "status": c.status.as_str(), "checks": items, "checksPassed": ok,
        "balanceUsd": num(total_usd(&c)), "fourEyes": total_usd(&c) > pol.close_four_eyes_usd, "fourEyesUsd": num(pol.close_four_eyes_usd),
        "pending": pending.as_ref().map(closure_json),
    }})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffCloseBody {
    #[serde(default)]
    empty: bool,
    #[serde(flatten)]
    reason: Reason,
}

/// Staff opens a closure request (C1, `accounts.close`). With `empty`, open trades are closed as a dealer close
/// first (the balance is never moved by staff: it must be withdrawn or adjusted through Balance & credit).
pub async fn staff_request(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>, Body(b): Body<StaffCloseBody>) -> ApiResult<Json<Value>> {
    s.require_perm("accounts.close", ROLES_CLOSE)?;
    check_reason(&b.reason)?;
    if b.reason.note.trim().chars().count() < 3 {
        return Err(ApiError::Validation { field: "note", message: "Add an internal note (kept in the audit, never shown to the client)".into() });
    }
    let m = st.hub.meta(login).filter(|m| m.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    let c = lifecycle::check(&st, login).await?;
    if c.status == Status::Closed {
        return Err(ApiError::Conflict { code: "closed", message: "This account is already closed".into() });
    }
    let pol = policy(&st.pool, s.ctx.tenant.tenant_id).await?;
    let bal = total_usd(&c);
    let mut closed = 0;
    if b.empty && (c.positions > 0 || c.orders > 0) {
        let dealer = crate::engine::trade::DealerCtx { staff: s.staff.name.clone(), reason_code: b.reason.reason_code.clone(), force: false };
        let op: Op = Box::new(move |tx, env| {
            let orders: Vec<i64> = tx.st.orders.keys().copied().collect();
            for t in orders {
                crate::engine::trade::cancel_order(tx, env, t, "account closure")?;
            }
            let tickets: Vec<i64> = tx.st.positions.keys().copied().collect();
            let n = tickets.len();
            for t in tickets {
                crate::engine::trade::close_position(tx, env, t, crate::engine::trade::CloseReq { dealer: Some(dealer.clone()), ..Default::default() })?;
            }
            tx.audit.push(AuditDraft { action: "account.close_empty", tickets: vec![], login: None, symbol: None, before: None, after: Some(json!({"closed": n})), flags: vec![] });
            Ok(json!({"closed": n}))
        });
        let d = st.hub.exec(login, &me(&s), Some(s.staff.clone()), &b.reason.reason_code, b.reason.note.trim(), None, op).await?;
        closed = d.value["closed"].as_u64().unwrap_or(0);
    }
    let r = insert_request(
        &st,
        NewRequest {
            tenant_id: s.ctx.tenant.tenant_id,
            login,
            user_id: m.user_id,
            kind: "close",
            source: "staff",
            reason_code: &b.reason.reason_code,
            survey: json!({}),
            note: b.reason.note.trim(),
            balance_usd: bal,
            four_eyes: c.kind == AccountKind::Live && bal > pol.close_four_eyes_usd,
            by: me(&s),
            by_name: &s.staff.name,
        },
    )
    .await?;
    let v = closure_json(&r);
    let entry = audit_now(&st, row(&s, &b.reason, "account.close_request", Some(login), Some(json!({"status": c.status.as_str()})), Some(json!({"request": v["id"], "fourEyes": v["fourEyes"], "balanceUsd": v["balanceUsd"], "closedTrades": closed})), vec![])).await?;
    Ok(Json(json!({"data": v, "audit": [entry]})))
}

/// Super Admin asks to reopen a closed account (C12); another Super Admin must approve it.
pub async fn reopen_request(State(st): State<AppState>, s: StaffCtx, Path(login): Path<i64>, Body(r): Body<Reason>) -> ApiResult<Json<Value>> {
    if !is_super(&s) {
        return Err(ApiError::Forbidden("Only a Super Admin can reopen a closed account".into()));
    }
    check_reason(&r)?;
    if r.note.trim().chars().count() < 3 {
        return Err(ApiError::Validation { field: "note", message: "Explain why the account is reopened".into() });
    }
    let m = st.hub.meta(login).filter(|m| m.tenant_id == s.ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    let c = lifecycle::check(&st, login).await?;
    if c.status != Status::Closed {
        return Err(ApiError::Conflict { code: "not_closed", message: format!("Only closed accounts can be reopened (this one is {})", c.status.as_str()) });
    }
    let row_ = insert_request(
        &st,
        NewRequest { tenant_id: s.ctx.tenant.tenant_id, login, user_id: m.user_id, kind: "reopen", source: "staff", reason_code: &r.reason_code, survey: json!({}), note: r.note.trim(), balance_usd: ZERO, four_eyes: true, by: me(&s), by_name: &s.staff.name },
    )
    .await?;
    let v = closure_json(&row_);
    let entry = audit_now(&st, row(&s, &r, "account.reopen_request", Some(login), None, Some(json!({"request": v["id"]})), vec!["four_eyes".into()])).await?;
    Ok(Json(json!({"data": v, "audit": [entry]})))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DecideBody {
    #[serde(default)]
    note: String,
    #[serde(default)]
    client_reason: Option<String>,
    #[serde(default)]
    client_message: Option<String>,
}

fn clean(s: &str, max: usize) -> String {
    s.trim().chars().filter(|c| !c.is_control() || *c == '\n').take(max).collect()
}

/// Approve (C2, C3, C12). Four-eyes requests take two approvals by different staff members, neither of them the
/// staff requester; the second one closes (or reopens) the account. Close stays refused until every check passes.
pub async fn approve(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<DecideBody>) -> ApiResult<Json<Value>> {
    let r = load(&st, s.ctx.tenant.tenant_id, id).await?;
    let kind: String = r.get("kind");
    if kind == "reopen" {
        if !is_super(&s) {
            return Err(ApiError::Forbidden("Only a Super Admin can approve reopening an account".into()));
        }
    } else {
        s.require_perm("accounts.close.approve", ROLES_CLOSE)?;
    }
    if r.get::<String, _>("status") != "pending" {
        return Err(ApiError::Conflict { code: "already_decided", message: format!("This request is already {}", r.get::<String, _>("status")) });
    }
    let login: i64 = r.get("login");
    let user_id: i64 = r.get("user_id");
    let tenant = s.ctx.tenant.tenant_id;
    let requester: String = r.get("requested_by");
    let four_eyes: bool = r.get("four_eyes");
    let first: Option<String> = r.get("first_approval_by");
    let note = clean(&b.note, 1000);
    if four_eyes && requester == me(&s) {
        return Err(ApiError::Forbidden("Four-eyes: someone other than the requester must approve".into()));
    }
    let reason = Reason { reason_code: r.get("reason_code"), note: note.clone() };

    // the C3 checks (close only), evaluated before every approval
    let checks = if kind == "close" {
        let (_, items, ok) = closure_checks(&st, &s.ctx, login).await?;
        if !ok {
            return Err(ApiError::StatusData { status: 409, code: "checks_failed", message: "Not every closure check passes yet".into(), data: json!({"checks": items}) });
        }
        json!(items)
    } else {
        Value::Null
    };

    if four_eyes && first.is_none() {
        let done = sqlx::query("UPDATE account_closures SET first_approval_by = $2, first_approval_name = $3, first_approval_at = now(), updated_at = now() WHERE id = $1 AND status = 'pending' AND first_approval_by IS NULL")
            .bind(id)
            .bind(me(&s))
            .bind(&s.staff.name)
            .execute(&st.pool)
            .await?;
        if done.rows_affected() == 0 {
            return Err(ApiError::Conflict { code: "already_decided", message: "Someone else acted on this request; reload it".into() });
        }
        let entry = audit_now(&st, row(&s, &reason, if kind == "close" { "account.close_approve_1" } else { "account.reopen_approve_1" }, Some(login), None, Some(json!({"request": id, "stage": "first_approval"})), vec!["four_eyes".into()])).await?;
        let r = load(&st, tenant, id).await?;
        return Ok(Json(json!({"data": closure_json(&r), "stage": "first_approval", "audit": [entry]})));
    }
    if four_eyes && first.as_deref() == Some(me(&s).as_str()) {
        return Err(ApiError::Forbidden("Four-eyes: a second, different approver is needed".into()));
    }

    let by = me(&s);
    let code: String = r.get("reason_code");
    let flags: Vec<String> = if four_eyes { vec!["four_eyes".into()] } else { vec![] };
    let (action, op): (&'static str, Op) = if kind == "close" {
        let (by2, code2, fl) = (by.clone(), code.clone(), flags.clone());
        ("account.close", Box::new(move |tx, env| {
            let before = json!({"status": tx.st.account.status.as_str(), "credit": num(tx.st.credit), "bonus": num(tx.st.bonus)});
            let changed = funds::close_account(tx, env, &by2, &code2)?;
            if changed {
                tx.audit.push(AuditDraft { action: "account.close", tickets: vec![], login: None, symbol: None, before: Some(before), after: Some(json!({"status": "closed", "request": id})), flags: fl.clone() });
            }
            Ok(json!({"status": "closed", "changed": changed}))
        }))
    } else {
        let fl = flags.clone();
        ("account.reopen", Box::new(move |tx, _| {
            let to = funds::reopen(tx)?;
            tx.audit.push(AuditDraft { action: "account.reopen", tickets: vec![], login: None, symbol: None, before: Some(json!({"status": "closed"})), after: Some(json!({"status": to.as_str(), "request": id})), flags: fl.clone() });
            Ok(json!({"status": to.as_str()}))
        }))
    };
    let d = match st.hub.exec(login, &by, Some(s.staff.clone()), &code, &note, None, op).await {
        Ok(d) => d,
        Err(ExecError::Reject(rej)) => {
            let entry = audit_now(&st, row(&s, &reason, "account.rejected", Some(login), None, Some(json!({"attempted": action, "error": rej.message})), vec!["rejected".into()])).await?;
            return Err(ApiError::Reject { reject: rej, audit: vec![entry] });
        }
        Err(e) => return Err(e.into()),
    };
    let client_reason = if kind == "close" { Some(b.client_reason.clone().filter(|k| TEMPLATES.iter().any(|t| t.0 == k && t.1 == "approve")).unwrap_or_else(|| if r.get::<String, _>("source") == "client" { "closed_as_requested".into() } else { "closed_by_broker".into() })) } else { None };
    let client_message = b.client_message.as_deref().map(|m| clean(m, 500)).filter(|m| !m.is_empty());
    sqlx::query(
        "UPDATE account_closures SET status = 'approved', decided_by = $2, decided_by_name = $3, decided_at = now(), decision_note = $4, checks = $5,
            client_reason = $6, client_message = $7, updated_at = now() WHERE id = $1 AND status = 'pending'",
    )
    .bind(id)
    .bind(&by)
    .bind(&s.staff.name)
    .bind(&note)
    .bind(sqlx::types::Json(&checks))
    .bind(&client_reason)
    .bind(&client_message)
    .execute(&st.pool)
    .await?;
    if kind == "close" {
        lifecycle::revoke_sessions(&st, login).await;
        lifecycle::retired_hooks(&st, tenant, login, user_id, "closed").await;
        let text = template_text(client_reason.as_deref().unwrap_or("closed_as_requested"), login, client_message.as_deref().unwrap_or("")).unwrap_or_default();
        crate::notify::enqueue_or_log(&st.pool, tenant, user_id, "account.closed", json!({"title": format!("Account #{login} closed"), "body": text, "link": "/accounts?tab=archived", "severity": "info", "data": {"login": login, "request": id}}), &format!("closure:{id}:approved")).await;
    } else {
        let _ = sqlx::query("UPDATE accounts SET last_activity_at = now(), dormant_since = NULL WHERE login = $1").bind(login).execute(&st.pool).await;
        crate::notify::enqueue_or_log(&st.pool, tenant, user_id, "account.reopened", json!({"title": format!("Account #{login} reopened"), "body": format!("Your trading account #{login} has been reopened and can be used again."), "link": format!("/accounts/{login}"), "severity": "success", "data": {"login": login, "request": id}}), &format!("closure:{id}:reopened")).await;
    }
    let r = load(&st, tenant, id).await?;
    Ok(Json(json!({"data": closure_json(&r), "stage": "done", "result": d.value, "audit": d.audit})))
}

pub async fn reject(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<DecideBody>) -> ApiResult<Json<Value>> {
    let r = load(&st, s.ctx.tenant.tenant_id, id).await?;
    let kind: String = r.get("kind");
    if kind == "reopen" {
        if !is_super(&s) {
            return Err(ApiError::Forbidden("Only a Super Admin can decide a reopen request".into()));
        }
    } else {
        s.require_perm("accounts.close.approve", ROLES_CLOSE)?;
    }
    if r.get::<String, _>("status") != "pending" {
        return Err(ApiError::Conflict { code: "already_decided", message: format!("This request is already {}", r.get::<String, _>("status")) });
    }
    let login: i64 = r.get("login");
    let user_id: i64 = r.get("user_id");
    let note = clean(&b.note, 1000);
    let client_reason = if kind == "close" {
        let k = b.client_reason.clone().unwrap_or_default();
        if !TEMPLATES.iter().any(|t| t.0 == k && t.1 == "reject") {
            return Err(ApiError::Validation { field: "clientReason", message: "Choose the reason the client will see".into() });
        }
        Some(k)
    } else {
        None
    };
    let client_message = b.client_message.as_deref().map(|m| clean(m, 500)).filter(|m| !m.is_empty());
    if client_reason.as_deref() == Some("other") && client_message.is_none() {
        return Err(ApiError::Validation { field: "clientMessage", message: "Write the message the client will see".into() });
    }
    let done = sqlx::query(
        "UPDATE account_closures SET status = 'rejected', decided_by = $2, decided_by_name = $3, decided_at = now(), decision_note = $4, client_reason = $5, client_message = $6, updated_at = now()
         WHERE id = $1 AND status = 'pending'",
    )
    .bind(id)
    .bind(me(&s))
    .bind(&s.staff.name)
    .bind(&note)
    .bind(&client_reason)
    .bind(&client_message)
    .execute(&st.pool)
    .await?;
    if done.rows_affected() == 0 {
        return Err(ApiError::Conflict { code: "already_decided", message: "Someone else acted on this request; reload it".into() });
    }
    let reason = Reason { reason_code: r.get("reason_code"), note };
    let entry = audit_now(&st, row(&s, &reason, if kind == "close" { "account.close_reject" } else { "account.reopen_reject" }, Some(login), None, Some(json!({"request": id, "clientReason": client_reason})), vec![])).await?;
    if kind == "close" && r.get::<String, _>("source") == "client" {
        let text = template_text(client_reason.as_deref().unwrap_or("other"), login, client_message.as_deref().unwrap_or("")).unwrap_or_default();
        crate::notify::enqueue_or_log(&st.pool, s.ctx.tenant.tenant_id, user_id, "account.closure_rejected", json!({"title": format!("Account #{login} not closed"), "body": text, "link": format!("/accounts/{login}"), "severity": "warning", "data": {"login": login, "request": id}}), &format!("closure:{id}:rejected")).await;
    }
    let r = load(&st, s.ctx.tenant.tenant_id, id).await?;
    Ok(Json(json!({"data": closure_json(&r), "audit": [entry]})))
}

/* ------------------------------------------------------------------ */
/* Report (C11)                                                        */
/* ------------------------------------------------------------------ */

#[derive(Deserialize, Default)]
pub struct ReportQ {
    days: Option<i32>,
}

pub async fn report(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ReportQ>) -> ApiResult<Json<Value>> {
    s.require_perm("accounts.close.approve", ROLES_CLOSE).or_else(|_| s.require_perm("accounts.close", ROLES_CLOSE))?;
    let days = q.days.unwrap_or(90).clamp(1, 3650);
    let t = s.ctx.tenant.tenant_id;
    let base = "FROM account_closures WHERE tenant_id = $1 AND kind = 'close' AND created_at >= now() - make_interval(days => $2)";
    let by_status: Vec<(String, i64)> = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT status, count(*) {base} GROUP BY status"))).bind(t).bind(days).fetch_all(&st.pool).await?;
    let by_reason: Vec<(String, i64, D)> = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT reason_code, count(*), COALESCE(sum(balance_usd), 0) {base} GROUP BY reason_code ORDER BY count(*) DESC"))).bind(t).bind(days).fetch_all(&st.pool).await?;
    let by_source: Vec<(String, i64)> = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT source, count(*) {base} GROUP BY source"))).bind(t).bind(days).fetch_all(&st.pool).await?;
    let survey: Vec<(String, i64)> = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT r, count(*) FROM (SELECT jsonb_array_elements_text(COALESCE(survey->'reasons', '[]'::jsonb)) AS r {base}) x GROUP BY r ORDER BY count(*) DESC")))
        .bind(t)
        .bind(days)
        .fetch_all(&st.pool)
        .await?;
    let by_month: Vec<(String, i64, i64)> = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT to_char(date_trunc('month', created_at), 'YYYY-MM'), count(*), count(*) FILTER (WHERE status = 'approved') {base} GROUP BY 1 ORDER BY 1"))).bind(t).bind(days).fetch_all(&st.pool).await?;
    let comments = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT id, login, reason_code, survey->>'comment' AS comment, created_at {base} AND COALESCE(survey->>'comment', '') <> '' ORDER BY id DESC LIMIT 25"))).bind(t).bind(days).fetch_all(&st.pool).await?;
    let avg: Option<D> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT avg(EXTRACT(EPOCH FROM (decided_at - created_at)) / 3600)::numeric {base} AND decided_at IS NOT NULL"))).bind(t).bind(days).fetch_one(&st.pool).await?;
    let total: i64 = by_status.iter().map(|x| x.1).sum();
    let pct = |n: i64| if total > 0 { (n as f64 * 1000.0 / total as f64).round() / 10.0 } else { 0.0 };
    Ok(Json(json!({"data": {
        "days": days, "total": total,
        "byStatus": by_status.into_iter().map(|(k, v)| (k, json!(v))).collect::<serde_json::Map<String, Value>>(),
        "bySource": by_source.into_iter().map(|(k, v)| (k, json!(v))).collect::<serde_json::Map<String, Value>>(),
        "byReason": by_reason.iter().map(|(r, n, b)| json!({"reason": r, "count": n, "pct": pct(*n), "balanceUsd": num(*b)})).collect::<Vec<_>>(),
        "surveyReasons": survey.iter().map(|(r, n)| json!({"reason": r, "count": n})).collect::<Vec<_>>(),
        "byMonth": by_month.iter().map(|(m, n, a)| json!({"month": m, "requested": n, "approved": a})).collect::<Vec<_>>(),
        "avgDecisionHours": avg.map(|h| num(r2(h))),
        "comments": comments.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "login": r.get::<i64, _>("login"), "reason": r.get::<String, _>("reason_code"), "comment": r.get::<Option<String>, _>("comment"), "at": r.get::<chrono::DateTime<Utc>, _>("created_at")})).collect::<Vec<_>>(),
    }})))
}

/* ------------------------------------------------------------------ */
/* Bulk actions (C4)                                                   */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkBody {
    /// archive
    action: String,
    /// expired_demos | empty_dormant | logins
    target: String,
    #[serde(default)]
    logins: Vec<i64>,
    #[serde(default)]
    dry_run: bool,
    #[serde(flatten)]
    reason: Reason,
}

/// Candidates of a bulk target for one tenant.
pub async fn bulk_candidates(st: &AppState, tenant: i64, target: &str, logins: &[i64]) -> ApiResult<Vec<i64>> {
    let pol = policy(&st.pool, tenant).await?;
    Ok(match target {
        "expired_demos" => sqlx::query_scalar("SELECT login FROM accounts WHERE tenant_id = $1 AND kind = 'demo' AND status = 'expired' AND updated_at < now() - make_interval(days => $2) ORDER BY login LIMIT 5000")
            .bind(tenant)
            .bind(pol.demo_archive_days.max(0))
            .fetch_all(&st.pool)
            .await?,
        "empty_dormant" => sqlx::query_scalar(
            "SELECT a.login FROM accounts a WHERE a.tenant_id = $1 AND a.kind = 'live' AND a.dormant_since IS NOT NULL AND a.status NOT IN ('archived', 'closed')
               AND a.balance = 0 AND a.credit = 0 AND a.bonus = 0 AND a.group_code NOT ILIKE 'prop%'
               AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.login = a.login) AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.login = a.login)
             ORDER BY a.login LIMIT 5000",
        )
        .bind(tenant)
        .fetch_all(&st.pool)
        .await?,
        "logins" => {
            let mut v: Vec<i64> = logins.iter().copied().filter(|l| st.hub.meta(*l).is_some_and(|m| m.tenant_id == tenant)).collect();
            v.sort();
            v.dedup();
            v.truncate(1000);
            v
        }
        _ => return Err(ApiError::Validation { field: "target", message: "target must be expired_demos, empty_dormant or logins".into() }),
    })
}

pub async fn bulk(State(st): State<AppState>, s: StaffCtx, Body(b): Body<BulkBody>) -> ApiResult<Json<Value>> {
    s.require(ROLES_DEALING)?;
    if b.action != "archive" {
        return Err(ApiError::Validation { field: "action", message: "action must be archive".into() });
    }
    if !b.dry_run {
        check_reason(&b.reason)?;
    }
    let tenant = s.ctx.tenant.tenant_id;
    let list = bulk_candidates(&st, tenant, &b.target, &b.logins).await?;
    if b.dry_run {
        return Ok(Json(json!({"data": {"target": b.target, "candidates": list, "count": list.len()}})));
    }
    let mut done = Vec::new();
    let mut failed = Vec::new();
    for login in &list {
        // copy / master / PAMM / MAM / prop accounts are never archived in bulk
        match lifecycle::check(&st, *login).await {
            Ok(c) if c.status.is_retired() => continue,
            Ok(c) => {
                if let Some((code, m)) = c.blockers.iter().find(|(code, _)| *code != "already_archived") {
                    failed.push(json!({"login": login, "code": code, "error": m}));
                    continue;
                }
                if c.kind == AccountKind::Live && (c.positions > 0 || c.orders > 0 || r2(c.balance) != ZERO) {
                    failed.push(json!({"login": login, "code": "not_empty", "error": "Live account is not empty"}));
                    continue;
                }
            }
            Err(_) => continue,
        }
        let (by, code) = (me(&s), b.reason.reason_code.clone());
        let op: Op = Box::new(move |tx, env| {
            let before = json!({"status": tx.st.account.status.as_str()});
            if tx.st.account.kind == AccountKind::Demo && (!tx.st.positions.is_empty() || !tx.st.orders.is_empty()) {
                lifecycle::close_everything(tx, env)?;
            }
            let changed = funds::archive(tx, env, &by, &code, true)?;
            if changed {
                tx.audit.push(AuditDraft { action: "account.archive", tickets: vec![], login: None, symbol: None, before: Some(before), after: Some(json!({"status": "archived", "bulk": true})), flags: vec!["bulk".into()] });
            }
            Ok(json!({"changed": changed}))
        });
        match st.hub.exec(*login, &me(&s), Some(s.staff.clone()), &b.reason.reason_code, b.reason.note.trim(), None, op).await {
            Ok(_) => {
                lifecycle::revoke_sessions(&st, *login).await;
                done.push(*login);
            }
            Err(ExecError::Reject(r)) => failed.push(json!({"login": login, "code": r.code, "error": r.message})),
            Err(e) => failed.push(json!({"login": login, "code": "error", "error": format!("{e:?}")})),
        }
    }
    tracing::info!(tenant, target = %b.target, done = done.len(), failed = failed.len(), staff = %s.staff.id, "bulk archive");
    Ok(Json(json!({"data": {"target": b.target, "archived": done, "failed": failed, "count": done.len()}})))
}
