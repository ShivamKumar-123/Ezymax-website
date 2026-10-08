//! Back Office corporate actions (Trading › Corporate actions; src/corporate):
//!
//! * `GET  /v1/admin/corporate-actions?status=upcoming|past|all&symbol=`   list, EODHD status, open interest
//! * `GET  /v1/admin/corporate-actions/{id}`                                detail: affected positions / orders
//!                                                                          (preview or what was applied), audit
//! * `POST /v1/admin/corporate-actions`                                     propose (manual entry)
//! * `PATCH /v1/admin/corporate-actions/{id}`                               edit before it applies (re-approval)
//! * `POST /v1/admin/corporate-actions/{id}/approve` · `/reject`            four-eyes for splits and large dividends
//! * `POST /v1/admin/corporate-actions/import`                              EODHD import now ("Refresh")
//! * `POST /v1/admin/corporate-actions/{id}/check`                          Infoway factor cross-check now
//! * `GET  /v1/accounts/{login}/corporate-actions`                          a client's own (Client Area history)
//!
//! Instruments are the platform's, so changes are made by platform staff (tenant `ezymex`): dealing roles propose and
//! edit, admins approve and reject. Every change is audited with its reason.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::Arc;

use super::{ApiError, ApiResult, AppState, Body, Ctx, ROLES_CONFIG, ROLES_DEALING, StaffCtx};
use crate::corporate::{self, ActionRow, COLUMNS, audit, from_row, needs_four_eyes};
use crate::money::D;

const PLATFORM_TENANT: &str = "ezymex";
const ROLES_APPROVE: &[&str] = &["platform_owner", "super_admin", "admin"];

fn require_read(s: &StaffCtx) -> ApiResult<()> {
    if ROLES_DEALING.contains(&s.staff.role.as_str()) || ROLES_CONFIG.contains(&s.staff.role.as_str()) { Ok(()) } else { s.require(ROLES_DEALING) }
}

fn require_platform(s: &StaffCtx, roles: &[&str]) -> ApiResult<()> {
    if s.ctx.tenant.slug != PLATFORM_TENANT {
        return Err(ApiError::Forbidden("Corporate actions are managed by the platform".into()));
    }
    s.require(roles)
}

fn reason_ok(r: &str) -> ApiResult<String> {
    let r = r.trim();
    if r.len() < 3 || r.len() > 300 {
        return Err(ApiError::Validation { field: "reason", message: "Give a reason (3–300 characters)".into() });
    }
    Ok(r.to_string())
}

fn staff_label(s: &StaffCtx) -> String {
    format!("{} ({})", s.staff.name, s.staff.role)
}

async fn get_row(st: &AppState, id: i64) -> ApiResult<ActionRow> {
    corporate::load(&st.pool, id).await?.ok_or_else(|| ApiError::NotFound(format!("Corporate action {id} not found")))
}

#[derive(Deserialize)]
pub struct ListQ {
    status: Option<String>,
    symbol: Option<String>,
}

pub async fn list(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    require_read(&s)?;
    let statuses: &[&str] = match q.status.as_deref() {
        Some("past") => &["applied", "rejected", "cancelled"],
        Some("all") => &["proposed", "approved", "applying", "applied", "rejected", "cancelled"],
        _ => &["proposed", "approved", "applying"],
    };
    let sql = format!("SELECT {COLUMNS} FROM corporate_actions WHERE status = ANY($1) AND ($2::text IS NULL OR symbol = $2) ORDER BY ex_date, id LIMIT 1000");
    let rows: Vec<ActionRow> = sqlx::query(sqlx::AssertSqlSafe(sql)).bind(statuses.iter().map(|x| x.to_string()).collect::<Vec<_>>()).bind(q.symbol.as_deref().map(str::to_uppercase)).fetch_all(&st.pool).await?.iter().map(from_row).collect();
    // open positions and orders per symbol (all brokers) for the upcoming ones
    let symbols: std::collections::BTreeSet<String> = rows.iter().filter(|r| r.status != "applied").map(|r| r.symbol.clone()).collect();
    let oi = crate::catalogue::open_interest(&st.hub, &symbols).await;
    let actions: Vec<Value> = rows
        .iter()
        .map(|r| {
            let mut v = r.json();
            v["openInterest"] = oi.get(&r.symbol).cloned().unwrap_or(json!(0));
            v
        })
        .collect();
    Ok(Json(json!({
        "actions": actions,
        "canPropose": s.ctx.tenant.slug == PLATFORM_TENANT && ROLES_DEALING.contains(&s.staff.role.as_str()),
        "canApprove": s.ctx.tenant.slug == PLATFORM_TENANT && ROLES_APPROVE.contains(&s.staff.role.as_str()),
        "staffId": s.staff.id,
        "eodhd": {"configured": !st.cfg.eodhd_key.is_empty(), "message": if st.cfg.eodhd_key.is_empty() { Some("EODHD not configured: add EODHD_API_KEY") } else { None }, "lastRun": crate::corporate::eodhd::last_run(&st.pool).await},
        "fourEyesDividendPct": corporate::FOUR_EYES_DIVIDEND_PCT,
    })))
}

pub async fn detail(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    require_read(&s)?;
    let row = get_row(&st, id).await?;
    let a = row.action().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("incomplete action")))?;
    // affected accounts: what would change (preview), or the stored results once applied
    let mut accounts: Vec<Value> = Vec::new();
    for t in st.hub.shared.registry.all() {
        let act = a.clone();
        let rows = st
            .hub
            .scan(
                t.tenant_id,
                Arc::new(move |acct, env| {
                    let holds = acct.positions.values().any(|p| p.symbol == act.symbol && p.option.is_none()) || acct.orders.values().any(|o| o.symbol == act.symbol && o.option.is_none());
                    if holds { vec![crate::engine::corporate::preview(env, acct, &act)] } else { vec![] }
                }),
            )
            .await;
        accounts.extend(rows.into_iter().map(|mut v| {
            v["tenant"] = json!(t.slug);
            v
        }));
        if accounts.len() > 500 {
            break;
        }
    }
    let runs: Vec<Value> = sqlx::query("SELECT login, tenant_id, applied_at, result FROM corporate_action_runs WHERE action_id = $1 ORDER BY login LIMIT 1000")
        .bind(id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| json!({"login": r.get::<i64, _>("login"), "tenantId": r.get::<i64, _>("tenant_id"), "appliedAt": r.get::<chrono::DateTime<Utc>, _>("applied_at"), "result": r.get::<sqlx::types::Json<Value>, _>("result").0}))
        .collect();
    let audit_rows: Vec<Value> = sqlx::query("SELECT at, actor, event, detail, reason FROM corporate_action_audit WHERE action_id = $1 ORDER BY id DESC LIMIT 100")
        .bind(id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| json!({"at": r.get::<chrono::DateTime<Utc>, _>("at"), "actor": r.get::<String, _>("actor"), "event": r.get::<String, _>("event"), "detail": r.get::<Option<sqlx::types::Json<Value>>, _>("detail").map(|j| j.0), "reason": r.get::<Option<String>, _>("reason")}))
        .collect();
    Ok(Json(json!({"action": row.json(), "accounts": accounts, "runs": runs, "audit": audit_rows})))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActionBody {
    symbol: Option<String>,
    kind: Option<String>,
    ex_date: Option<NaiveDate>,
    ratio_from: Option<D>,
    ratio_to: Option<D>,
    amount: Option<D>,
    currency: Option<String>,
    withholding_pct: Option<D>,
    record_date: Option<NaiveDate>,
    pay_date: Option<NaiveDate>,
    note: Option<String>,
    #[serde(default)]
    reason: String,
}

/// Validated values of a new or edited action.
struct Valid {
    symbol: String,
    kind: &'static str,
    ex_date: NaiveDate,
    apply_at: chrono::DateTime<Utc>,
    ratio_from: Option<D>,
    ratio_to: Option<D>,
    amount: Option<D>,
    currency: Option<String>,
    withholding_pct: D,
    four_eyes: bool,
    ref_price: Option<D>,
}

fn validate(st: &AppState, b: &ActionBody, base: Option<&ActionRow>) -> ApiResult<Valid> {
    let specs = st.hub.shared.specs.load();
    let symbol = b.symbol.clone().map(|x| x.trim().to_uppercase()).or(base.map(|r| r.symbol.clone())).ok_or(ApiError::Validation { field: "symbol", message: "Choose a stock".into() })?;
    let spec = specs.get(&symbol).ok_or(ApiError::Validation { field: "symbol", message: format!("Unknown symbol {symbol}") })?;
    if spec.asset_class != "stocks" {
        return Err(ApiError::Validation { field: "symbol", message: format!("{symbol} is not a stock") });
    }
    let kind: &'static str = match b.kind.as_deref().or(base.map(|r| r.kind.as_str())) {
        Some("split") => "split",
        Some("dividend") => "dividend",
        _ => return Err(ApiError::Validation { field: "kind", message: "kind must be split or dividend".into() }),
    };
    let ex_date = b.ex_date.or(base.map(|r| r.ex_date)).ok_or(ApiError::Validation { field: "exDate", message: "Enter the ex-date".into() })?;
    let apply_at = corporate::apply_at(spec, ex_date);
    if apply_at <= st.hub.shared.clock.now() + chrono::Duration::minutes(5) {
        return Err(ApiError::Validation { field: "exDate", message: "The ex-date must be in the future (the action applies at 00:00 exchange time that day)".into() });
    }
    let (mut ratio_from, mut ratio_to, mut amount, mut currency) = (None, None, None, None);
    // default withholding by listing (US 30 %, Tokyo 15.315 %, Hong Kong none) unless given
    let mut withholding = b.withholding_pct.or(base.map(|r| r.withholding_pct)).unwrap_or_else(|| corporate::default_withholding(spec, &spec.symbol));
    match kind {
        "split" => {
            ratio_from = b.ratio_from.or(base.and_then(|r| r.ratio_from));
            ratio_to = b.ratio_to.or(base.and_then(|r| r.ratio_to));
            match (ratio_from, ratio_to) {
                (Some(f), Some(t)) if f > D::ZERO && t > D::ZERO && f != t && f <= D::from(1000) && t <= D::from(1000) => {}
                _ => return Err(ApiError::Validation { field: "ratioTo", message: "Enter the split as old shares → new shares (both 1–1000, different)".into() }),
            }
            withholding = D::ZERO;
        }
        _ => {
            amount = b.amount.or(base.and_then(|r| r.amount));
            if !amount.is_some_and(|a| a > D::ZERO && a < D::from(1_000_000)) {
                return Err(ApiError::Validation { field: "amount", message: "Enter the gross dividend per share".into() });
            }
            let ccy = b.currency.clone().or(base.and_then(|r| r.currency.clone())).unwrap_or_else(|| spec.quote_ccy.clone()).trim().to_uppercase();
            if ccy.len() != 3 || (ccy != "USD" && specs.usd_pair(&ccy).is_none()) {
                return Err(ApiError::Validation { field: "currency", message: format!("{ccy} has no USD price to book the dividend") });
            }
            currency = Some(ccy);
            if withholding < D::ZERO || withholding > D::from(100) {
                return Err(ApiError::Validation { field: "withholdingPct", message: "Withholding is 0–100 %".into() });
            }
        }
    }
    let ref_price = corporate::last_price(&st.hub, &symbol).or(base.and_then(|r| r.ref_price));
    Ok(Valid { four_eyes: needs_four_eyes(kind, amount, ref_price), symbol, kind, ex_date, apply_at, ratio_from, ratio_to, amount, currency, withholding_pct: withholding, ref_price })
}

fn conflict(e: sqlx::Error) -> ApiError {
    match &e {
        sqlx::Error::Database(d) if d.constraint() == Some("corporate_actions_one_per_day") => ApiError::Conflict { code: "duplicate", message: "This symbol already has an action of that kind on that ex-date".into() },
        _ => ApiError::Internal(e.into()),
    }
}

pub async fn create(State(st): State<AppState>, s: StaffCtx, Body(b): Body<ActionBody>) -> ApiResult<Json<Value>> {
    require_platform(&s, ROLES_DEALING)?;
    let reason = reason_ok(&b.reason)?;
    let v = validate(&st, &b, None)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO corporate_actions (symbol, kind, ex_date, apply_at, ratio_from, ratio_to, amount, currency, withholding_pct, record_date, pay_date, ref_price, four_eyes, status, source, note, created_by, created_by_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'proposed','manual',$14,$15,$16) RETURNING id",
    )
    .bind(&v.symbol)
    .bind(v.kind)
    .bind(v.ex_date)
    .bind(v.apply_at)
    .bind(v.ratio_from)
    .bind(v.ratio_to)
    .bind(v.amount)
    .bind(&v.currency)
    .bind(v.withholding_pct)
    .bind(b.record_date)
    .bind(b.pay_date)
    .bind(v.ref_price)
    .bind(v.four_eyes)
    .bind(b.note.as_deref().map(str::trim).filter(|n| !n.is_empty()))
    .bind(staff_label(&s))
    .bind(&s.staff.id)
    .fetch_one(&st.pool)
    .await
    .map_err(conflict)?;
    audit(&st.pool, Some(id), &staff_label(&s), "proposed", json!({"source": "manual"}), Some(&reason)).await;
    Ok(Json(get_row(&st, id).await?.json()))
}

pub async fn edit(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<ActionBody>) -> ApiResult<Json<Value>> {
    require_platform(&s, ROLES_DEALING)?;
    let reason = reason_ok(&b.reason)?;
    let row = get_row(&st, id).await?;
    if row.status != "proposed" && row.status != "approved" {
        return Err(ApiError::Conflict { code: "locked", message: format!("A {} action can't be edited", row.status) });
    }
    let v = validate(&st, &b, Some(&row))?;
    sqlx::query(
        "UPDATE corporate_actions SET symbol = $2, kind = $3, ex_date = $4, apply_at = $5, ratio_from = $6, ratio_to = $7, amount = $8, currency = $9, withholding_pct = $10,
           record_date = COALESCE($11, record_date), pay_date = COALESCE($12, pay_date), ref_price = $13, four_eyes = $14, note = COALESCE($15, note),
           status = 'proposed', approved_by = NULL, approved_by_id = NULL, approved_at = NULL, created_by = $16, created_by_id = $17, updated_at = now()
         WHERE id = $1",
    )
    .bind(id)
    .bind(&v.symbol)
    .bind(v.kind)
    .bind(v.ex_date)
    .bind(v.apply_at)
    .bind(v.ratio_from)
    .bind(v.ratio_to)
    .bind(v.amount)
    .bind(&v.currency)
    .bind(v.withholding_pct)
    .bind(b.record_date)
    .bind(b.pay_date)
    .bind(v.ref_price)
    .bind(v.four_eyes)
    .bind(b.note.as_deref().map(str::trim).filter(|n| !n.is_empty()))
    .bind(staff_label(&s))
    .bind(&s.staff.id)
    .execute(&st.pool)
    .await
    .map_err(conflict)?;
    audit(&st.pool, Some(id), &staff_label(&s), "edited", json!({"before": row.json(), "approvalReset": row.status == "approved"}), Some(&reason)).await;
    corporate::refresh_due(&st.hub, &st.pool).await?;
    Ok(Json(get_row(&st, id).await?.json()))
}

#[derive(Deserialize)]
pub struct ReasonBody {
    #[serde(default)]
    reason: String,
}

pub async fn approve(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<ReasonBody>) -> ApiResult<Json<Value>> {
    require_platform(&s, ROLES_APPROVE)?;
    let reason = reason_ok(&b.reason)?;
    let row = get_row(&st, id).await?;
    if row.status != "proposed" {
        return Err(ApiError::Conflict { code: "not_proposed", message: format!("Only a proposed action can be approved (this one is {})", row.status) });
    }
    if row.apply_at <= st.hub.shared.clock.now() {
        return Err(ApiError::Conflict { code: "too_late", message: "Its ex-date has started: reject it and handle the accounts manually".into() });
    }
    if row.four_eyes && row.created_by_id == s.staff.id {
        return Err(ApiError::Conflict { code: "four_eyes", message: "A second person must approve this action (split or large dividend)".into() });
    }
    sqlx::query("UPDATE corporate_actions SET status = 'approved', approved_by = $2, approved_by_id = $3, approved_at = now(), updated_at = now() WHERE id = $1 AND status = 'proposed'")
        .bind(id)
        .bind(staff_label(&s))
        .bind(&s.staff.id)
        .execute(&st.pool)
        .await?;
    audit(&st.pool, Some(id), &staff_label(&s), "approved", json!({"fourEyes": row.four_eyes}), Some(&reason)).await;
    corporate::refresh_due(&st.hub, &st.pool).await?;
    Ok(Json(get_row(&st, id).await?.json()))
}

pub async fn reject(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Body(b): Body<ReasonBody>) -> ApiResult<Json<Value>> {
    require_platform(&s, ROLES_APPROVE)?;
    let reason = reason_ok(&b.reason)?;
    let row = get_row(&st, id).await?;
    if row.status != "proposed" && row.status != "approved" {
        return Err(ApiError::Conflict { code: "locked", message: format!("A {} action can't be rejected", row.status) });
    }
    sqlx::query("UPDATE corporate_actions SET status = 'rejected', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
    audit(&st.pool, Some(id), &staff_label(&s), "rejected", json!({"was": row.status}), Some(&reason)).await;
    corporate::refresh_due(&st.hub, &st.pool).await?;
    Ok(Json(get_row(&st, id).await?.json()))
}

pub async fn import(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    require_platform(&s, ROLES_DEALING)?;
    if st.cfg.eodhd_key.is_empty() {
        return Err(ApiError::Status { status: 409, code: "not_configured", message: "EODHD not configured: add EODHD_API_KEY".into() });
    }
    let report = crate::corporate::eodhd::import(&st.hub, &st.pool, &st.cfg, &format!("Back Office ({})", s.staff.name)).await;
    Ok(Json(report))
}

pub async fn check(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    require_read(&s)?;
    let row = get_row(&st, id).await?;
    Ok(Json(crate::corporate::check::check_one(&st.pool, &st.cfg, &row).await))
}

#[derive(Deserialize)]
pub struct UserQ {
    user_id: Option<i64>,
}

/// A client's corporate actions (Client Area / Ezymex Trader history): splits and dividends applied to the account.
pub async fn account(State(st): State<AppState>, ctx: Ctx, headers: HeaderMap, Path(login): Path<i64>, Query(q): Query<UserQ>) -> ApiResult<Json<Value>> {
    let user = super::accounts::user_of(&headers, q.user_id)?;
    super::accounts::owned(&st, &ctx, login, user)?;
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT r.applied_at AS run_at, r.result, {} FROM corporate_action_runs r JOIN corporate_actions a ON a.id = r.action_id WHERE r.login = $1 ORDER BY r.applied_at DESC LIMIT 200",
        COLUMNS.split(", ").map(|c| format!("a.{c}")).collect::<Vec<_>>().join(", ")
    )))
    .bind(login)
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let a = from_row(r);
            json!({"symbol": a.symbol, "kind": a.kind, "label": if a.kind == "dividend" { "Dividend adjustment".to_string() } else { a.action().map(|x| x.label()).unwrap_or_default() }, "exDate": a.ex_date, "appliedAt": r.get::<chrono::DateTime<Utc>, _>("run_at"), "result": r.get::<sqlx::types::Json<Value>, _>("result").0})
        })
        .collect();
    Ok(Json(json!({"items": items})))
}
