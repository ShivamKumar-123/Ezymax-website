//! Step-up confirmation for sensitive changes by a signed-in client (D20): /v1/auth/stepup*, /v1/auth/password.
//!
//! 1. `POST /v1/auth/stepup {action, target?}` (session) emails a 6-digit code naming the change.
//! 2. `POST /v1/auth/stepup/verify {challenge, code, action, target?}` (session) turns a correct code into a
//!    step-up token: random, single-use, valid for `TOKEN_TTL`, bound to user + action + target. Only its keyed
//!    hash is stored.
//! 3. The app's server hands the token back right before performing the change:
//!    `POST /v1/auth/stepup/consume {token, user_id, action, target?}` succeeds once. Like every /v1 route it
//!    requires `X-Kalks-Internal`, so browsers can't reach it.
//!
//! `POST /v1/auth/password {current, new, stepup_token, sign_out_others}` changes the Client Area password
//! itself and consumes an `account_password` token internally.

use axum::Json;
use axum::extract::State;
use axum::extract::rejection::JsonRejection;
use axum::http::StatusCode;
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::crypto;
use crate::error::{ApiError, ApiResult, field};
use crate::identity::{self, Kind, Purpose};
use crate::state::{AppState, Ctx};
use crate::validate;

const K: Kind = Kind::User;

/// How long a verified step-up token can be redeemed.
pub const TOKEN_TTL_SECS: i64 = 300;

/// Actions that need a step-up code. Unknown actions are rejected so the email always names a real change.
pub const ACTIONS: &[&str] = &["trading_password", "investor_password", "leverage", "withdrawal", "account_password", "profile_email", "profile_phone", "viewer_access", "account_archive", "account_close", "internal_transfer"];

pub fn parse_action(raw: &str) -> Option<&'static str> {
    ACTIONS.iter().copied().find(|a| *a == raw.trim())
}

/// Optional target of the change (a trading account login, a wallet id). Short and plain, because it goes
/// into the email and is part of the token binding.
pub fn clean_target(raw: Option<&str>) -> Option<String> {
    let t = raw.unwrap_or("").trim();
    if t.len() > 40 || !t.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':')) {
        return None;
    }
    Some(t.to_string())
}

/// Human wording of the change, used in the email: "You asked to <describe> in the Kalks Client Area."
pub fn describe(action: &str, target: &str) -> String {
    let acct = |what: &str| if target.is_empty() { format!("change the {what} of a trading account") } else { format!("change the {what} of trading account #{target}") };
    match action {
        "trading_password" => acct("trading password"),
        "investor_password" => acct("investor password"),
        "leverage" => acct("leverage"),
        "withdrawal" => "withdraw funds from your Kalks wallet".into(),
        "account_password" => "change your Client Area password".into(),
        "profile_email" => "change the email address of your Kalks account".into(),
        "profile_phone" => "change the phone number of your Kalks account".into(),
        "viewer_access" => "create a view-only login or set a new password for one".into(),
        "account_archive" => if target.is_empty() { "delete (archive) a live trading account".into() } else { format!("delete (archive) live trading account #{target}") },
        "account_close" => if target.is_empty() { "close a live trading account permanently".into() } else { format!("close live trading account #{target} permanently") },
        "internal_transfer" => if target.is_empty() { "move money between your trading accounts".into() } else { format!("move money out of trading account #{target} to another of your accounts") },
        _ => "make a change to your Kalks account".into(),
    }
}

fn stepup_required() -> ApiError {
    ApiError::Coded { status: StatusCode::FORBIDDEN, code: "stepup_required", message: "Confirm this change with the code we email you." }
}

fn stepup_invalid() -> ApiError {
    ApiError::Coded {
        status: StatusCode::FORBIDDEN,
        code: "stepup_invalid",
        message: "This confirmation has expired or was already used. Confirm the change again.",
    }
}

fn action_error() -> ApiError {
    ApiError::Validation { field: "action", message: "Unknown action." }
}

fn target_error() -> ApiError {
    ApiError::Validation { field: "target", message: "Invalid target." }
}

// ---------- request ----------

#[derive(Deserialize)]
pub struct StepupReq {
    #[serde(default)]
    pub(crate) action: String,
    #[serde(default)]
    pub(crate) target: Option<String>,
}

pub async fn request(State(st): State<AppState>, ctx: Ctx, req: Result<Json<StepupReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let action = parse_action(&r.action).ok_or_else(action_error)?;
    let target = clean_target(r.target.as_deref()).ok_or_else(target_error)?;
    let s = identity::resolve_session(&st, &ctx, K).await?;
    identity::limit(&st, format!("stepup:ip:{}", ctx.ip), 30, 15 * 60)?;
    identity::limit(&st, format!("stepup:user:{}", s.subject_id), 10, 15 * 60)?;

    let row = sqlx::query("SELECT email, status = 'active' AS active FROM users WHERE id = $1")
        .bind(s.subject_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::Unauthorized)?;
    if !row.get::<bool, _>("active") {
        return Err(ApiError::AccountDisabled);
    }
    let email: String = row.get("email");
    let (challenge, code) = identity::send_otp_scoped(&st, &ctx, K, s.tenant_id, s.subject_id, &email, Purpose::Confirm, Some((action, &target))).await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: s.tenant_id,
        actor_kind: "user",
        actor_id: Some(s.subject_id),
        action: "user.stepup_requested",
        target: Some(("user", s.subject_id)),
        meta: json!({"action": action, "target": target}),
    })
    .await;
    let mut v = identity::challenge_json(&st, &challenge, &email, Purpose::Confirm, K, Some(&code));
    v["action"] = json!(action);
    v["target"] = json!(target);
    Ok(Json(v))
}

// ---------- resend ----------

#[derive(Deserialize)]
pub struct ResendReq {
    #[serde(default)]
    pub(crate) challenge: String,
}

/// Resends a step-up code. Only the signed-in owner of the challenge can do this.
pub async fn resend(State(st): State<AppState>, ctx: Ctx, req: Result<Json<ResendReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let s = identity::resolve_session(&st, &ctx, K).await?;
    identity::limit(&st, format!("resend:ip:{}", ctx.ip), 10, 10 * 60)?;
    let owned: Option<i64> = sqlx::query_scalar("SELECT subject_id FROM email_otps WHERE id = $1 AND subject_kind = 'user' AND purpose = 'confirm'")
        .bind(&r.challenge)
        .fetch_optional(&st.pool)
        .await?;
    if owned != Some(s.subject_id) {
        return Err(ApiError::CodeExpired);
    }
    Ok(Json(identity::resend_otp(&st, K, &r.challenge).await?))
}

// ---------- verify ----------

#[derive(Deserialize)]
pub struct VerifyReq {
    #[serde(default)]
    pub(crate) challenge: String,
    #[serde(default)]
    pub(crate) code: String,
    #[serde(default)]
    pub(crate) action: String,
    #[serde(default)]
    pub(crate) target: Option<String>,
}

pub async fn verify(State(st): State<AppState>, ctx: Ctx, req: Result<Json<VerifyReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let action = parse_action(&r.action).ok_or_else(action_error)?;
    let target = clean_target(r.target.as_deref()).ok_or_else(target_error)?;
    let s = identity::resolve_session(&st, &ctx, K).await?;
    identity::limit(&st, format!("otp:ip:{}", ctx.ip), 30, 10 * 60)?;
    identity::limit(&st, format!("stepup-verify:user:{}", s.subject_id), 20, 10 * 60)?;

    // The challenge must be this client's confirmation code for exactly this change.
    let row = sqlx::query("SELECT action, target FROM email_otps WHERE id = $1 AND subject_kind = 'user' AND subject_id = $2 AND purpose = 'confirm'")
        .bind(&r.challenge)
        .bind(s.subject_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::CodeExpired)?;
    let (a, t): (Option<String>, Option<String>) = (row.get("action"), row.get("target"));
    if a.as_deref() != Some(action) || t.as_deref().unwrap_or("") != target {
        return Err(ApiError::BadRequest("This code was sent for a different change. Request a new code."));
    }

    let v = match identity::verify_otp(&st, K, &r.challenge, &r.code).await {
        Ok(v) => v,
        Err(e) => {
            if let ApiError::InvalidCode { attempts_left } = &e {
                audit::record(&st.pool, &ctx, Entry {
                    tenant_id: s.tenant_id,
                    actor_kind: "user",
                    actor_id: Some(s.subject_id),
                    action: "user.stepup_failed",
                    target: Some(("user", s.subject_id)),
                    meta: json!({"action": action, "target": target, "attempts_left": attempts_left}),
                })
                .await;
            }
            return Err(e);
        }
    };
    if v.purpose != Purpose::Confirm || v.subject_id != s.subject_id {
        return Err(ApiError::CodeExpired);
    }

    let token = crypto::random_token(32);
    let expires_at = Utc::now() + Duration::seconds(TOKEN_TTL_SECS);
    sqlx::query("INSERT INTO stepup_tokens (token_hash, tenant_id, user_id, action, target, expires_at) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(st.keys.hash("stepup", &token))
        .bind(s.tenant_id)
        .bind(s.subject_id)
        .bind(action)
        .bind(&target)
        .bind(expires_at)
        .execute(&st.pool)
        .await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: s.tenant_id,
        actor_kind: "user",
        actor_id: Some(s.subject_id),
        action: "user.stepup_verified",
        target: Some(("user", s.subject_id)),
        meta: json!({"action": action, "target": target}),
    })
    .await;
    Ok(Json(json!({ "status": "ok", "stepup_token": token, "action": action, "target": target, "expires_in": TOKEN_TTL_SECS })))
}

// ---------- consume (internal) ----------

/// Redeems a step-up token once. Returns the tenant id on success.
pub async fn consume_token(st: &AppState, user_id: i64, action: &str, target: &str, token: &str) -> ApiResult<i64> {
    let token = token.trim();
    if token.is_empty() {
        return Err(stepup_required());
    }
    if token.len() > 128 {
        return Err(stepup_invalid());
    }
    let tenant: Option<i64> = sqlx::query_scalar(
        "UPDATE stepup_tokens SET consumed_at = now()
         WHERE token_hash = $1 AND user_id = $2 AND action = $3 AND target = $4 AND consumed_at IS NULL AND expires_at > now()
         RETURNING tenant_id",
    )
    .bind(st.keys.hash("stepup", token))
    .bind(user_id)
    .bind(action)
    .bind(target)
    .fetch_optional(&st.pool)
    .await?;
    tenant.ok_or_else(stepup_invalid)
}

#[derive(Deserialize)]
pub struct ConsumeReq {
    #[serde(default)]
    pub(crate) token: String,
    #[serde(default)]
    pub(crate) user_id: i64,
    #[serde(default)]
    pub(crate) action: String,
    #[serde(default)]
    pub(crate) target: Option<String>,
}

/// Server-to-server only (the /v1 router requires `X-Kalks-Internal`): the app calls this right before it
/// performs the change, with the user id it resolved from the session cookie.
pub async fn consume(State(st): State<AppState>, ctx: Ctx, req: Result<Json<ConsumeReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let action = parse_action(&r.action).ok_or_else(action_error)?;
    let target = clean_target(r.target.as_deref()).ok_or_else(target_error)?;
    if r.user_id <= 0 {
        return Err(ApiError::Validation { field: "user_id", message: "Invalid user." });
    }
    identity::limit(&st, format!("stepup-consume:user:{}", r.user_id), 30, 10 * 60)?;
    let tenant_id = consume_token(&st, r.user_id, action, &target, &r.token).await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id,
        actor_kind: "user",
        actor_id: Some(r.user_id),
        action: "user.stepup_consumed",
        target: Some(("user", r.user_id)),
        meta: json!({"action": action, "target": target}),
    })
    .await;
    Ok(Json(json!({ "status": "ok", "action": action, "target": target })))
}

// ---------- Client Area password change ----------

#[derive(Deserialize)]
pub struct PasswordReq {
    #[serde(default)]
    pub(crate) current: String,
    #[serde(default, rename = "new")]
    pub(crate) new_password: String,
    #[serde(default)]
    pub(crate) stepup_token: String,
    #[serde(default)]
    pub(crate) sign_out_others: bool,
}

pub async fn change_password(State(st): State<AppState>, ctx: Ctx, req: Result<Json<PasswordReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    if r.current.is_empty() || r.current.len() > 256 {
        return Err(ApiError::Validation { field: "current", message: "Enter your current password." });
    }
    validate::password(&r.new_password).map_err(field("new"))?;
    if r.new_password == r.current {
        return Err(ApiError::Validation { field: "new", message: "Choose a password different from your current one." });
    }
    let s = identity::resolve_session(&st, &ctx, K).await?;
    identity::limit(&st, format!("password:user:{}", s.subject_id), 10, 15 * 60)?;

    let row = sqlx::query("SELECT password_hash, failed_logins, locked_until, status = 'active' AS active FROM users WHERE id = $1")
        .bind(s.subject_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::Unauthorized)?;
    if !row.get::<bool, _>("active") {
        return Err(ApiError::AccountDisabled);
    }
    let now = Utc::now();
    if let Some(until) = row.get::<Option<DateTime<Utc>>, _>("locked_until")
        && until > now
    {
        return Err(ApiError::Locked { retry_after: (until - now).num_seconds() });
    }
    if !identity::verify_password_blocking(r.current.clone(), row.get("password_hash")).await {
        // wrong current passwords count towards the same lockout as sign-in
        let pol = identity::policy(K);
        let (n, lock) = identity::after_failure(row.get("failed_logins"), now, &pol);
        identity::set_failures(&st.pool, K, s.subject_id, n, lock).await?;
        audit::record(&st.pool, &ctx, Entry {
            tenant_id: s.tenant_id,
            actor_kind: "user",
            actor_id: Some(s.subject_id),
            action: if lock.is_some() { "user.locked" } else { "user.password_change_failed" },
            target: Some(("user", s.subject_id)),
            meta: json!({"reason": "wrong_current_password"}),
        })
        .await;
        if let Some(until) = lock {
            return Err(ApiError::Locked { retry_after: (until - now).num_seconds() });
        }
        return Err(ApiError::Validation { field: "current", message: "Your current password is incorrect." });
    }

    consume_token(&st, s.subject_id, "account_password", "", &r.stepup_token).await?;

    let hash = identity::hash_password_blocking(r.new_password).await?;
    sqlx::query("UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1")
        .bind(s.subject_id)
        .bind(hash)
        .execute(&st.pool)
        .await?;
    let revoked = if r.sign_out_others {
        sqlx::query("UPDATE sessions SET revoked_at = now() WHERE subject_kind = 'user' AND subject_id = $1 AND id <> $2 AND revoked_at IS NULL")
            .bind(s.subject_id)
            .bind(s.session_id)
            .execute(&st.pool)
            .await?
            .rows_affected()
    } else {
        0
    };
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: s.tenant_id,
        actor_kind: "user",
        actor_id: Some(s.subject_id),
        action: "user.password_changed",
        target: Some(("user", s.subject_id)),
        meta: json!({"sign_out_others": r.sign_out_others, "sessions_revoked": revoked}),
    })
    .await;
    Ok(Json(json!({ "status": "ok", "sessions_revoked": revoked })))
}

#[cfg(test)]
mod tests;
