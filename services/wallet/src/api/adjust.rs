//! Back Office "Balance & credit" routes (manual adjustments of wallets and trading accounts, four-eyes).
//! Permissions come from `X-Ezymex-Staff-Perms` (forwarded by the admin BFF); without it the role is checked.
//! See `ops::adjustments` for the rules.

use axum::Json;
use axum::extract::{Path, State};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Q, ok, paging};
use crate::audit::{self, Entry};
use crate::error::{ApiError, ApiResult};
use crate::ledger;
use crate::money::{D, de_dec, s, s_opt};
use crate::ops::adjustments::{self, NewAdjustment};
use crate::state::{AppState, ROLES_READ, ROLES_SETTINGS, ROLES_WRITE, StaffCtx};

#[derive(Deserialize)]
pub struct AdjustReq {
    #[serde(default)]
    idempotency_key: String,
    user_id: i64,
    #[serde(default = "wallet")]
    target: String,
    #[serde(default)]
    login: Option<i64>,
    #[serde(default)]
    currency: Option<String>,
    op: String,
    category: String,
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    #[serde(default)]
    comment: String,
    #[serde(default)]
    client_note: Option<String>,
    #[serde(default)]
    notify: bool,
    #[serde(default)]
    force: bool,
}

fn wallet() -> String {
    "wallet".into()
}

impl From<AdjustReq> for NewAdjustment {
    fn from(b: AdjustReq) -> Self {
        NewAdjustment {
            idempotency_key: b.idempotency_key,
            user_id: b.user_id,
            target: b.target.trim().to_lowercase(),
            login: b.login,
            currency: b.currency,
            op: b.op.trim().to_lowercase(),
            category: b.category.trim().to_lowercase(),
            amount: b.amount,
            comment: b.comment,
            client_note: b.client_note,
            notify: b.notify,
            force: b.force,
        }
    }
}

/// Anyone who may open the Adjustments page: finance readers or staff holding an adjustment permission.
fn can_read(s_ctx: &StaffCtx) -> ApiResult<()> {
    let ok = ["finance.read", "finance.adjust", "finance.credit", "finance.adjust_approve"].iter().any(|p| s_ctx.has_perm(p, ROLES_READ));
    if ok { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this".into())) }
}

/// `POST /v1/admin/adjustments/preview`: before → after, limits and whether a second approval is needed.
pub async fn preview(State(st): State<AppState>, s_ctx: StaffCtx, Body(b): Body<AdjustReq>) -> ApiResult<Json<Value>> {
    let n: NewAdjustment = b.into();
    Ok(ok(json!({"preview": adjustments::preview(&st, &s_ctx, &n).await?})))
}

/// `POST /v1/admin/adjustments`: applies it, or records it `pending` above the four-eyes threshold. The
/// legacy body `{idempotency_key, user_id, currency, amount, direction: credit|debit, reason}` (wallet only) is
/// still accepted and maps to add / deduct with reason "correction".
pub async fn create(State(st): State<AppState>, s_ctx: StaffCtx, Body(v): Body<Value>) -> ApiResult<Json<Value>> {
    let v = legacy(v);
    let b: AdjustReq = serde_json::from_value(v).map_err(|e| ApiError::BadRequest(e.to_string()))?;
    let n: NewAdjustment = b.into();
    let a = adjustments::create(&st, &s_ctx, n).await?;
    Ok(ok(json!({"adjustment": a})))
}

/// `{direction, reason}` (the first wallet adjustment form) → `{op, category, comment}`.
fn legacy(mut v: Value) -> Value {
    if v.get("op").is_none()
        && let Some(dir) = v.get("direction").and_then(Value::as_str).map(str::to_string)
    {
        v["op"] = json!(if dir == "debit" { "deduct" } else { "add" });
        v["category"] = json!("correction");
        let reason = v.get("reason").cloned().unwrap_or(Value::Null);
        v["comment"] = reason.clone();
        v["client_note"] = reason;
        v["notify"] = json!(dir != "debit");
    }
    v
}

#[derive(Deserialize, Default)]
pub struct DecideReq {
    #[serde(default)]
    note: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

pub async fn approve(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<DecideReq>) -> ApiResult<Json<Value>> {
    Ok(ok(json!({"adjustment": adjustments::approve(&st, &s_ctx, id, b.note.or(b.reason)).await?})))
}

pub async fn reject(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<DecideReq>) -> ApiResult<Json<Value>> {
    Ok(ok(json!({"adjustment": adjustments::decline(&st, &s_ctx, id, b.reason.or(b.note), false).await?})))
}

pub async fn cancel(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<DecideReq>) -> ApiResult<Json<Value>> {
    Ok(ok(json!({"adjustment": adjustments::decline(&st, &s_ctx, id, b.reason.or(b.note), true).await?})))
}

pub async fn get(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    let r = sqlx::query("SELECT * FROM adjustments WHERE tenant_id = $1 AND id = $2").bind(s_ctx.ctx.tenant.id).bind(id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Adjustment"))?;
    Ok(ok(json!({"adjustment": adjustments::row_json(&r)})))
}

#[derive(Deserialize, Default)]
pub struct ListQ {
    user_id: Option<i64>,
    login: Option<i64>,
    staff: Option<String>,
    category: Option<String>,
    op: Option<String>,
    target: Option<String>,
    status: Option<String>,
    from: Option<String>,
    to: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

fn opt(v: &Option<String>) -> Option<&str> {
    v.as_deref().map(str::trim).filter(|s| !s.is_empty() && *s != "all")
}

fn day(v: &Option<String>, field: &'static str) -> ApiResult<Option<DateTime<Utc>>> {
    match opt(v) {
        None => Ok(None),
        Some(x) => {
            if let Ok(t) = DateTime::parse_from_rfc3339(x) {
                return Ok(Some(t.with_timezone(&Utc)));
            }
            NaiveDate::parse_from_str(x, "%Y-%m-%d").map(|d| Some(d.and_hms_opt(0, 0, 0).unwrap().and_utc())).map_err(|_| ApiError::validation(field, "Use YYYY-MM-DD"))
        }
    }
}

/// `GET /v1/admin/adjustments`: filters (client, account, staff, reason, operation, target, status, date range
/// `from` inclusive / `to` exclusive), newest first, with totals of the applied rows in USD.
pub async fn list(State(st): State<AppState>, s_ctx: StaffCtx, Q(q): Q<ListQ>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    let (page, limit, offset) = paging(q.page, q.limit, 50, 2000);
    let t = s_ctx.ctx.tenant.id;
    let (from, to) = (day(&q.from, "from")?, day(&q.to, "to")?);
    const WHERE: &str = "tenant_id = $1 AND ($2::bigint IS NULL OR user_id = $2) AND ($3::bigint IS NULL OR login = $3)
          AND ($4::text IS NULL OR requested_by_id = $4 OR decided_by_id = $4) AND ($5::text IS NULL OR category = $5) AND ($6::text IS NULL OR op = $6)
          AND ($7::text IS NULL OR target = $7) AND ($8::text IS NULL OR status = $8) AND ($9::timestamptz IS NULL OR created_at >= $9) AND ($10::timestamptz IS NULL OR created_at < $10)";
    let bind = |sql: String| {
        sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(t)
            .bind(q.user_id)
            .bind(q.login)
            .bind(opt(&q.staff))
            .bind(opt(&q.category))
            .bind(opt(&q.op))
            .bind(opt(&q.target))
            .bind(opt(&q.status))
            .bind(from)
            .bind(to)
    };
    let rows = bind(format!("SELECT *, count(*) OVER () AS total FROM adjustments WHERE {WHERE} ORDER BY id DESC LIMIT {limit} OFFSET {offset}")).fetch_all(&st.pool).await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let tr = bind(format!(
        "SELECT
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'applied' AND op = 'add'), 0) AS added,
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'applied' AND op = 'deduct'), 0) AS deducted,
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'applied' AND op = 'credit_in'), 0) AS credit_in,
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'applied' AND op = 'credit_out'), 0) AS credit_out,
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'applied' AND op = 'add' AND category = 'deposit'), 0) AS ext_in,
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'applied' AND op = 'deduct' AND category = 'withdrawal'), 0) AS ext_out,
            count(*) FILTER (WHERE status = 'applied') AS applied,
            count(*) FILTER (WHERE status = 'pending') AS pending,
            COALESCE(sum(amount_usd) FILTER (WHERE status = 'pending'), 0) AS pending_usd,
            count(*) FILTER (WHERE status IN ('rejected', 'cancelled')) AS declined,
            count(*) FILTER (WHERE status IN ('failed', 'processing')) AS failed
         FROM adjustments WHERE {WHERE}"
    ))
    .fetch_one(&st.pool)
    .await?;
    let d = |c: &str| s(tr.get::<D, _>(c));
    let n = |c: &str| tr.get::<i64, _>(c);
    let totals = json!({
        "added_usd": d("added"), "deducted_usd": d("deducted"), "credit_in_usd": d("credit_in"), "credit_out_usd": d("credit_out"),
        "net_balance_usd": s(tr.get::<D, _>("added") - tr.get::<D, _>("deducted")), "net_credit_usd": s(tr.get::<D, _>("credit_in") - tr.get::<D, _>("credit_out")),
        "external_deposits_usd": d("ext_in"), "external_withdrawals_usd": d("ext_out"),
        "applied": n("applied"), "pending": n("pending"), "pending_usd": d("pending_usd"), "declined": n("declined"), "failed": n("failed"),
    });
    let staff: Vec<Value> = sqlx::query("SELECT DISTINCT requested_by_id, requested_by_name FROM adjustments WHERE tenant_id = $1 ORDER BY requested_by_name LIMIT 200")
        .bind(t)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| json!({"id": r.get::<String, _>("requested_by_id"), "name": r.get::<String, _>("requested_by_name")}))
        .collect();
    Ok(ok(json!({
        "items": rows.iter().map(adjustments::row_json).collect::<Vec<_>>(),
        "page": page, "limit": limit, "total": total, "totals": totals, "staff": staff,
        "threshold_usd": s_opt(adjustments::threshold(&st, t).await?),
        "categories": adjustments::CATEGORIES.iter().map(|c| json!({"value": c, "label": adjustments::category_label(c)})).collect::<Vec<_>>(),
    })))
}

/// `GET /v1/admin/adjustments/targets/{user_id}`: the client's wallet balances and trading accounts (live and demo,
/// with balance / credit / free margin), open requests and recent adjustments, for the dialog and client 360.
pub async fn targets(State(st): State<AppState>, s_ctx: StaffCtx, Path(user_id): Path<i64>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    let t = s_ctx.ctx.tenant.id;
    let balances = ledger::balances(&st.pool, t, user_id).await?;
    let (accounts, engine_error) = match st.engine.account_views(&s_ctx.ctx.tenant.slug, user_id).await {
        Ok(v) => (v, None),
        Err(e) => (vec![], Some(format!("{e:?}"))),
    };
    let open: Vec<Value> = sqlx::query("SELECT * FROM adjustments WHERE tenant_id = $1 AND user_id = $2 AND status IN ('pending', 'processing') ORDER BY id DESC LIMIT 50")
        .bind(t)
        .bind(user_id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(adjustments::row_json)
        .collect();
    let recent: Vec<Value> = sqlx::query("SELECT * FROM adjustments WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT 20").bind(t).bind(user_id).fetch_all(&st.pool).await?.iter().map(adjustments::row_json).collect();
    Ok(ok(json!({
        "user_id": user_id,
        "wallet": ledger::balances_json(&balances),
        "accounts": accounts,
        "engine_available": engine_error.is_none(),
        "open": open,
        "recent": recent,
        "threshold_usd": s_opt(adjustments::threshold(&st, t).await?),
        "can": {
            "adjust": s_ctx.has_perm("finance.adjust", ROLES_WRITE),
            "credit": s_ctx.has_perm("finance.credit", ROLES_WRITE),
            "approve": s_ctx.has_perm("finance.adjust_approve", crate::state::ROLES_APPROVE),
            "force": s_ctx.has_perm("finance.adjust_force", crate::state::ROLES_FORCE),
        },
    })))
}

#[derive(Deserialize)]
pub struct SettingsReq {
    /// USD; null (or absent) turns four-eyes off.
    #[serde(default, deserialize_with = "crate::money::de_opt_dec")]
    approval_threshold_usd: Option<D>,
}

pub async fn get_settings(State(st): State<AppState>, s_ctx: StaffCtx) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    Ok(ok(json!({"approval_threshold_usd": s_opt(adjustments::threshold(&st, s_ctx.ctx.tenant.id).await?)})))
}

/// `PUT /v1/admin/adjustments/settings` (finance.settings): the four-eyes threshold, audited.
pub async fn put_settings(State(st): State<AppState>, s_ctx: StaffCtx, Body(b): Body<SettingsReq>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.settings", ROLES_SETTINGS)?;
    if let Some(v) = b.approval_threshold_usd
        && (v < D::ZERO || v > crate::money::max_amount())
    {
        return Err(ApiError::validation("approval_threshold_usd", "Enter an amount of 0 or more, or leave it empty to turn four-eyes off"));
    }
    let t = s_ctx.ctx.tenant.id;
    let before = adjustments::threshold(&st, t).await?;
    let mut tx = st.pool.begin().await?;
    sqlx::query("INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING").bind(t).execute(&mut *tx).await?;
    sqlx::query("UPDATE tenant_settings SET adjust_approval_usd = $2, updated_at = now(), updated_by = $3 WHERE tenant_id = $1")
        .bind(t)
        .bind(b.approval_threshold_usd.map(|v| v.normalize()))
        .bind(s_ctx.staff.tag())
        .execute(&mut *tx)
        .await?;
    audit::staff(
        &mut tx,
        &s_ctx,
        Entry {
            action: "wallet.settings.adjust_threshold",
            target_kind: "settings",
            target_id: "adjust_approval_usd".into(),
            reason: None,
            before: Some(json!({"approval_threshold_usd": s_opt(before)})),
            after: Some(json!({"approval_threshold_usd": s_opt(b.approval_threshold_usd)})),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(ok(json!({"approval_threshold_usd": s_opt(b.approval_threshold_usd.map(|v| v.normalize()))})))
}
