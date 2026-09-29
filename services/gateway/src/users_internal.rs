//! `GET /v1/internal/users/{id}` (service-to-service, `X-Kalks-Internal` only, like every /v1 route):
//! a client's account and KYC status for the wallet service's withdrawal gate (D6) and risk checklist, and the
//! client's effective restrictions (client_controls.rs) the wallet enforces.
//! Scoped to the tenant in `X-Kalks-Tenant`; 404 for a client of another tenant.

use axum::Json;
use axum::extract::{Path, State};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;

use crate::error::{ApiError, ApiResult};
use crate::state::{AppState, Ctx};

pub async fn user(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let r = sqlx::query(
        "SELECT u.id, u.tenant_id, u.email, u.first_name, u.last_name, u.country, u.kyc_status, u.status, u.email_verified_at, u.created_at
         FROM users u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.id = $1 AND t.slug = $2",
    )
    .bind(id)
    .bind(&ctx.tenant_slug)
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    let first: String = r.get("first_name");
    let last: String = r.get("last_name");
    // effective restrictions (freeze expanded) the wallet enforces: deposits, withdrawals, transfers, ib
    let restrictions = crate::client_controls::effective_kinds(&st.pool, id).await?;
    Ok(Json(json!({
        "user": {
            "id": r.get::<i64, _>("id"),
            "tenant_id": r.get::<i64, _>("tenant_id"),
            "email": r.get::<String, _>("email"),
            "name": format!("{first} {last}"),
            "country": r.get::<String, _>("country").trim().to_lowercase(),
            "kyc_status": r.get::<String, _>("kyc_status"),
            "status": r.get::<String, _>("status"),
            "email_verified": r.get::<Option<DateTime<Utc>>, _>("email_verified_at").is_some(),
            "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            "restrictions": restrictions,
        }
    })))
}
