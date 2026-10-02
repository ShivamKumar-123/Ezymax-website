//! Public share cards (read by the Client Area server) and the voucher API for other services.

use super::Tenant;
use crate::error::{ApiError, ApiResult};
use crate::loyalty;
use crate::money::num;
use crate::shares;
use crate::state::AppState;
use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

#[derive(Deserialize)]
pub struct ViewQ {
    view: Option<String>,
}

pub async fn share(State(st): State<AppState>, Tenant(tenant): Tenant, Path(code): Path<String>, Query(q): Query<ViewQ>) -> ApiResult<Json<Value>> {
    if code.len() > 16 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(ApiError::NotFound);
    }
    let count = q.view.as_deref() != Some("0");
    let r = if count {
        sqlx::query("UPDATE shares SET views = views + 1 WHERE code = $1 AND tenant = $2 RETURNING *").bind(code.to_uppercase()).bind(&tenant).fetch_optional(&st.pool).await?
    } else {
        sqlx::query("SELECT * FROM shares WHERE code = $1 AND tenant = $2").bind(code.to_uppercase()).bind(&tenant).fetch_optional(&st.pool).await?
    };
    let r = r.ok_or(ApiError::NotFound)?;
    Ok(Json(shares::share_json(&r, true)))
}

#[derive(Deserialize)]
pub struct UserQ {
    user_id: i64,
}

pub async fn vouchers(State(st): State<AppState>, Tenant(tenant): Tenant, Query(q): Query<UserQ>) -> ApiResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM vouchers WHERE tenant = $1 AND user_id = $2 AND status = 'active' AND expires_at > now() ORDER BY id").bind(&tenant).bind(q.user_id).fetch_all(&st.pool).await?;
    Ok(Json(json!({"items": rows.iter().map(loyalty::voucher_json).collect::<Vec<_>>()})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemVoucher {
    user_id: i64,
    code: String,
    applies_to: String,
    #[serde(rename = "ref")]
    reference: String,
}

/// Marks a fee-discount voucher used by another service (prop checkout …). Idempotent on (code, ref).
pub async fn redeem_voucher(State(st): State<AppState>, Tenant(tenant): Tenant, Json(b): Json<RedeemVoucher>) -> ApiResult<Json<Value>> {
    if b.reference.is_empty() || b.reference.len() > 128 {
        return Err(crate::error::invalid("ref", "ref is required (≤ 128 chars)."));
    }
    let mut tx = st.pool.begin().await?;
    let v = sqlx::query("SELECT * FROM vouchers WHERE tenant = $1 AND code = $2 AND user_id = $3 FOR UPDATE").bind(&tenant).bind(b.code.trim().to_uppercase()).bind(b.user_id).fetch_optional(&mut *tx).await?.ok_or(ApiError::NotFound)?;
    let status: String = v.get("status");
    if status == "used" {
        if v.get::<Option<String>, _>("used_ref").as_deref() == Some(b.reference.as_str()) {
            return Ok(Json(json!({"pct": num(v.get("pct")), "voucher": loyalty::voucher_json(&v), "replayed": true})));
        }
        return Err(ApiError::Conflict { code: "used", message: "This voucher was already used.".into() });
    }
    let scope: String = v.get("applies_to");
    if status != "active" || v.get::<chrono::DateTime<chrono::Utc>, _>("expires_at") <= chrono::Utc::now() || (scope != "any" && scope != b.applies_to) {
        return Err(ApiError::Conflict { code: "not_eligible", message: "This voucher can't be used here.".into() });
    }
    let v = sqlx::query("UPDATE vouchers SET status = 'used', used_at = now(), used_ref = $2 WHERE id = $1 RETURNING *").bind(v.get::<i64, _>("id")).bind(&b.reference).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"pct": num(v.get("pct")), "voucher": loyalty::voucher_json(&v), "replayed": false})))
}

#[derive(Deserialize, Default)]
pub struct Retired {
    /// archived | closed
    #[serde(default)]
    reason: String,
}

/// `POST /v1/growth/internal/accounts/{login}/retired {reason}`: the trading engine archived or closed the account
/// (B7). Its open bonus grants end as `forfeited`. No `remove` leg is queued: the engine already booked the bonus
/// left on the account back to the house when it retired the account. Idempotent.
pub async fn account_retired(State(st): State<AppState>, Tenant(tenant): Tenant, Path(login): Path<i64>, Json(b): Json<Retired>) -> ApiResult<Json<Value>> {
    let reason = match b.reason.as_str() {
        "closed" => "account_closed",
        _ => "account_archived",
    };
    let ended = sqlx::query(
        "UPDATE bonus_grants SET status = 'forfeited', ended_at = now(), end_reason = $3 WHERE tenant = $1 AND login = $2 AND status IN ('awaiting_deposit', 'pending', 'active')",
    )
    .bind(&tenant)
    .bind(login)
    .bind(reason)
    .execute(&st.pool)
    .await?
    .rows_affected();
    if ended > 0 {
        tracing::info!(%tenant, login, ended, reason, "bonus grants forfeited: trading account retired");
    }
    Ok(Json(json!({"login": login, "ended": ended})))
}
