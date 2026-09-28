//! Back Office staff auth: /v1/admin/auth/*  (separate identities, sessions and cookies from clients)

use axum::Json;
use axum::extract::State;
use axum::extract::rejection::JsonRejection;
use serde_json::{Value, json};
use sqlx::Row;

use crate::audit::{self, Entry};
use crate::client_auth::{LoginReq, ResendReq, VerifyReq, body};
use crate::error::{ApiError, ApiResult, field};
use crate::flows;
use crate::identity::{self, Kind, Purpose};
use crate::state::{AppState, Ctx};
use crate::validate;

const K: Kind = Kind::Staff;

pub fn role_label(role: &str) -> &'static str {
    match role {
        "platform_owner" => "Platform Owner",
        "super_admin" => "Super Admin",
        "admin" => "Administrator",
        "dealer" => "Dealer",
        "risk_manager" => "Risk Manager",
        "compliance" => "Compliance Officer",
        "finance" => "Finance",
        "support" => "Support Agent",
        "marketing" => "Marketing",
        "partner_manager" => "Partner Manager",
        _ => "Viewer",
    }
}

async fn staff_json(st: &AppState, id: i64) -> ApiResult<Value> {
    let r = sqlx::query(
        "SELECT s.id, s.email, s.name, s.role, s.last_login_at, t.slug, t.name AS tenant_name
         FROM staff s JOIN tenants t ON t.id = s.tenant_id WHERE s.id = $1 AND s.status = 'active'",
    )
    .bind(id)
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::Unauthorized)?;
    let role: String = r.get("role");
    Ok(json!({
        "id": r.get::<i64, _>("id"),
        "email": r.get::<String, _>("email"),
        "name": r.get::<String, _>("name"),
        "role": role,
        "role_label": role_label(&role),
        "tenant": { "slug": r.get::<String, _>("slug"), "name": r.get::<String, _>("tenant_name") },
    }))
}

async fn signed_in(st: &AppState, ctx: &Ctx, tenant_id: i64, staff_id: i64, via: &str) -> ApiResult<Value> {
    identity::mark_login(&st.pool, K, staff_id).await?;
    let s = identity::create_session(st, ctx, K, tenant_id, staff_id).await?;
    audit::record(&st.pool, ctx, Entry { tenant_id, actor_kind: "staff", actor_id: Some(staff_id), action: "staff.login", target: None, meta: json!({"via": via}) }).await;
    Ok(json!({ "status": "ok", "session": { "token": s.token, "expires_at": s.expires_at }, "staff": staff_json(st, staff_id).await? }))
}

pub async fn login(State(st): State<AppState>, ctx: Ctx, req: Result<Json<LoginReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let email = validate::email(&r.email).map_err(field("email"))?;
    if r.password.is_empty() || r.password.len() > 256 {
        return Err(ApiError::Validation { field: "password", message: "Enter your password." });
    }
    identity::limit(&st, format!("staff-login:ip:{}", ctx.ip), 20, 5 * 60)?;
    identity::limit(&st, format!("staff-login:email:{email}"), 10, 15 * 60)?;
    let tenant_id = identity::tenant_id(&st.pool, &ctx.tenant_slug).await?;
    let p = flows::check_password(&st, &ctx, K, tenant_id, &email, &r.password).await?;
    // Back Office: an emailed code on every sign-in (STAFF_OTP_EVERY_LOGIN=false falls back to new devices only).
    if st.cfg.staff_otp_every_login || !identity::device_trusted(&st, &ctx, K, p.id).await? {
        let (challenge, code) = identity::send_otp(&st, &ctx, K, tenant_id, p.id, &p.email, Purpose::Login).await?;
        return Ok(Json(identity::challenge_json(&st, &challenge, &p.email, Purpose::Login, K, Some(&code))));
    }
    st.limiter.clear(&format!("staff-login:email:{email}"));
    Ok(Json(signed_in(&st, &ctx, tenant_id, p.id, "password").await?))
}

pub async fn verify_otp(State(st): State<AppState>, ctx: Ctx, req: Result<Json<VerifyReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    identity::limit(&st, format!("staff-otp:ip:{}", ctx.ip), 20, 10 * 60)?;
    let v = identity::verify_otp(&st, K, &r.challenge, &r.code).await?;
    if v.purpose != Purpose::Login {
        return Err(ApiError::CodeExpired);
    }
    identity::trust_device(&st, &ctx, K, v.tenant_id, v.subject_id, v.device_hash).await?;
    Ok(Json(signed_in(&st, &ctx, v.tenant_id, v.subject_id, "email_otp").await?))
}

pub async fn resend(State(st): State<AppState>, ctx: Ctx, req: Result<Json<ResendReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    identity::limit(&st, format!("staff-resend:ip:{}", ctx.ip), 10, 10 * 60)?;
    Ok(Json(identity::resend_otp(&st, K, &r.challenge).await?))
}

pub async fn logout(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    if let Some(token) = ctx.bearer.as_deref()
        && let Some((tenant_id, staff_id)) = identity::revoke_token(&st, token, K).await?
    {
        audit::record(&st.pool, &ctx, Entry { tenant_id, actor_kind: "staff", actor_id: Some(staff_id), action: "staff.logout", target: None, meta: json!({}) }).await;
    }
    Ok(Json(json!({ "status": "ok" })))
}

pub async fn me(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let s = identity::resolve_session(&st, &ctx, K).await?;
    Ok(Json(json!({ "staff": staff_json(&st, s.subject_id).await?, "session": { "expires_at": s.expires_at } })))
}
