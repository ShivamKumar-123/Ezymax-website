//! Client controls routes (see controls.rs and the gateway's client_controls.rs):
//!
//! * `GET  /v1/terminal/controls`                    the session's restrictions and staff banner (Kalks Trader)
//! * `POST /v1/admin/accounts/{login}/staff-sso`     `{userId, readOnly, minutes?, reason?}` (staff headers): a
//!   one-time SSO token for a Kalks Trader session a staff member opens as the client. The Back Office BFF has
//!   checked `clients.impersonate` (and `clients.impersonate_full` for full access) and audited it with the
//!   gateway first; the engine checks the account belongs to that client.
//! * `POST /v1/internal/restrictions/refresh`        `{userId}`: reload one client's restrictions from the gateway now

use axum::Json;
use axum::extract::{Path, State};
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{ApiError, ApiResult, AppState, Body, StaffCtx};
use crate::auth;
use crate::model::Status;

pub fn suspended() -> ApiError {
    ApiError::Status { status: 403, code: "account_suspended", message: crate::controls::SUSPENDED_MESSAGE.into() }
}

/// Refuses Kalks Trader access for a client whose sign-in is blocked.
pub fn login_gate(st: &AppState, login: i64) -> ApiResult<()> {
    match st.hub.meta(login) {
        Some(m) if st.hub.shared.restrictions.login_blocked(m.user_id, Utc::now()) => Err(suspended()),
        _ => Ok(()),
    }
}

/// Refuses new copy / PAMM / MAM participation for a client with the `social` restriction.
pub fn social_gate(st: &AppState, user_id: i64) -> ApiResult<()> {
    if st.hub.shared.restrictions.has(user_id, "social", Utc::now()) {
        return Err(ApiError::Status { status: 422, code: "restricted", message: crate::controls::SOCIAL_MESSAGE.into() });
    }
    Ok(())
}

pub async fn terminal_controls(State(st): State<AppState>, ctx: super::Ctx) -> ApiResult<Json<Value>> {
    let s = super::terminal::session(&st, &ctx).await?;
    Ok(Json(json!({
        "login": s.login,
        // the BFFs use it server-side (audit of a staff session's end); never sent to the browser
        "userId": s.user_id,
        "accountName": st.hub.meta(s.login).map(|m| m.name),
        "readOnly": s.read_only,
        "restrictions": st.hub.shared.restrictions.kinds(s.user_id, Utc::now()),
        "staff": s.staff.as_ref().map(|(id, name)| json!({"id": id, "name": name})),
        "expiresAt": s.expires_at,
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffSsoReq {
    #[serde(alias = "user_id")]
    user_id: i64,
    #[serde(default = "yes")]
    read_only: bool,
    minutes: Option<i64>,
}

fn yes() -> bool {
    true
}

pub async fn staff_sso(State(st): State<AppState>, sc: StaffCtx, Path(login): Path<i64>, Body(r): Body<StaffSsoReq>) -> ApiResult<Json<Value>> {
    let m = super::accounts::owned(&st, &sc.ctx, login, r.user_id)?;
    if m.status == Status::Expired {
        return Err(ApiError::Forbidden("This demo account has expired.".into()));
    }
    login_gate(&st, login)?;
    let staff_id: i64 = sc.staff.id.parse().map_err(|_| ApiError::BadRequest("Invalid staff id".into()))?;
    let minutes = r.minutes.unwrap_or(30).clamp(1, 60);
    let token = auth::random_token(32);
    let expires = Utc::now() + Duration::seconds(60);
    sqlx::query("INSERT INTO sso_tokens (token_hash, tenant_id, login, user_id, expires_at, staff_id, staff_name, read_only, minutes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)")
        .bind(st.keys.hash("sso", &token))
        .bind(sc.ctx.tenant.tenant_id)
        .bind(login)
        .bind(r.user_id)
        .bind(expires)
        .bind(staff_id)
        .bind(&sc.staff.name)
        .bind(r.read_only)
        .bind(minutes as i32)
        .execute(&st.pool)
        .await?;
    tracing::info!(login, staff = staff_id, read_only = r.read_only, minutes, "staff session link issued for Kalks Trader");
    Ok(Json(json!({"token": token, "expiresAt": expires, "login": login, "readOnly": r.read_only, "minutes": minutes})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshReq {
    #[serde(alias = "user_id")]
    user_id: i64,
}

pub async fn refresh(State(st): State<AppState>, Body(r): Body<RefreshReq>) -> ApiResult<Json<Value>> {
    let kinds = crate::controls::refresh_user(&st.gateway, &st.pool, &st.hub, r.user_id).await.map_err(|e| ApiError::Status { status: 503, code: "gateway_unavailable", message: e.to_string() })?;
    Ok(Json(json!({"userId": r.user_id, "restrictions": kinds})))
}
