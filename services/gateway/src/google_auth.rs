//! "Continue with Google" for the Client Area: /v1/auth/google*
//!
//! The Client Area BFF runs the OAuth 2.0 / OIDC flow (state, PKCE, nonce), exchanges the code with Google
//! and verifies the ID token (JWKS signature, iss, aud, exp, nonce, email_verified). Only then does it call
//! these endpoints with the verified identity, behind `X-Ezymex-Internal`. The gateway never sees Google tokens.
//!
//! - Known Google account (`google_sub`)            → signed in.
//! - Same email, no Google link yet                  → linked (`user.google_linked`) and signed in.
//! - New person                                      → `profile_required` + a short-lived signed ticket; the client
//!   completes country / phone / date of birth / terms on /register/complete, then `/google/complete` creates the
//!   account with the email already verified.
//!
//! Google already authenticated the person, so no email code is asked for on a new device; the device is
//! still recorded as trusted and the sign-in is audited (`user.login`, via `google`).

use axum::Json;
use axum::extract::State;
use axum::extract::rejection::JsonRejection;
use axum::http::StatusCode;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;

use crate::audit::{self, Entry};
use crate::client_auth::{self, NewUser, body};
use crate::crypto::{self, Keys};
use crate::error::{ApiError, ApiResult, field};
use crate::identity::{self, Kind};
use crate::state::{AppState, Ctx};
use crate::validate;

const K: Kind = Kind::User;
/// How long the person has to finish the profile step after consenting on Google.
pub const TICKET_TTL_SECS: i64 = 30 * 60;

const UNVERIFIED: ApiError = ApiError::Coded {
    status: StatusCode::FORBIDDEN,
    code: "google_unverified",
    message: "Your Google account's email address isn't verified. Verify it with Google, or sign up with email instead.",
};
const CONFLICT: ApiError = ApiError::Coded {
    status: StatusCode::CONFLICT,
    code: "google_conflict",
    message: "This email is already linked to a different Google account. Use that Google account, or sign in with your password.",
};
const EXPIRED: ApiError = ApiError::Coded {
    status: StatusCode::GONE,
    code: "google_expired",
    message: "Your Google sign-up has expired. Continue with Google again.",
};
const ALREADY_SET_UP: ApiError = ApiError::Coded {
    status: StatusCode::CONFLICT,
    code: "google_account_exists",
    message: "Your account is already set up. Continue with Google to sign in.",
};

// ---------- profile ticket ----------

/// Verified Google identity carried between `/google` and `/google/complete`.
/// Signed (HMAC-SHA256 with the server secret), not encrypted: it only holds what the person just gave Google consent for.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Ticket {
    pub v: u8,
    /// tenant id
    pub t: i64,
    pub sub: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub picture: Option<String>,
    pub referral: Option<String>,
    /// unix seconds
    pub exp: i64,
}

pub fn seal(keys: &Keys, t: &Ticket) -> String {
    let payload = URL_SAFE_NO_PAD.encode(serde_json::to_vec(t).expect("ticket serialises"));
    let mac = URL_SAFE_NO_PAD.encode(keys.hash("google_ticket", &payload));
    format!("{payload}.{mac}")
}

/// Checks signature, version, expiry and tenant. Any failure reads as "expired" to the client.
pub fn open(keys: &Keys, token: &str, tenant_id: i64, now_unix: i64) -> Option<Ticket> {
    if token.len() > 4096 {
        return None;
    }
    let (payload, mac) = token.split_once('.')?;
    let mac = URL_SAFE_NO_PAD.decode(mac).ok()?;
    if !crypto::ct_eq(&mac, &keys.hash("google_ticket", payload)) {
        return None;
    }
    let t: Ticket = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(payload).ok()?).ok()?;
    (t.v == 1 && t.t == tenant_id && t.exp > now_unix).then_some(t)
}

// ---------- input clean-up ----------

/// Google `sub`: stable account id, at most 255 ASCII characters (digits in practice).
fn clean_sub(raw: &str) -> Option<String> {
    let s = raw.trim();
    (!s.is_empty() && s.len() <= 255 && s.chars().all(|c| c.is_ascii_graphic())).then(|| s.to_string())
}

/// Google names can be missing or contain characters our name rule rejects; those become empty
/// and the person types them on the profile step.
fn clean_name(raw: Option<&str>) -> String {
    raw.and_then(|n| validate::name(n, "").ok()).unwrap_or_default()
}

fn clean_picture(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim).filter(|p| p.starts_with("https://") && p.len() <= 1024 && !p.chars().any(char::is_whitespace)).map(str::to_string)
}

// ---------- POST /v1/auth/google ----------

#[derive(Deserialize)]
pub struct GoogleReq {
    #[serde(default)]
    sub: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    email_verified: bool,
    given_name: Option<String>,
    family_name: Option<String>,
    picture: Option<String>,
    #[serde(rename = "ref")]
    referral: Option<String>,
}

async fn google_sign_in(st: &AppState, ctx: &Ctx, tenant_id: i64, user_id: i64) -> ApiResult<Value> {
    identity::trust_device(st, ctx, K, tenant_id, user_id, None).await?;
    client_auth::signed_in(st, ctx, tenant_id, user_id, "google").await
}

pub async fn google(State(st): State<AppState>, ctx: Ctx, req: Result<Json<GoogleReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    identity::limit(&st, format!("google:ip:{}", ctx.ip), 30, 5 * 60)?;
    let sub = clean_sub(&r.sub).ok_or(ApiError::BadRequest("Invalid Google account."))?;
    let email = validate::email(&r.email).map_err(|_| ApiError::BadRequest("Your Google account has no usable email address."))?;
    if !r.email_verified {
        return Err(UNVERIFIED);
    }
    let picture = clean_picture(r.picture.as_deref());
    let tenant_id = identity::tenant_id(&st.pool, &ctx.tenant_slug).await?;
    crate::tenancy::client_gate(&st, tenant_id).await?;
    crate::tenancy::require_feature(&st, tenant_id, "google_login").await?;

    // 1. Google account already linked.
    let linked = sqlx::query("SELECT id, status = 'active' AS active, status FROM users WHERE tenant_id = $1 AND google_sub = $2")
        .bind(tenant_id)
        .bind(&sub)
        .fetch_optional(&st.pool)
        .await?;
    if let Some(row) = linked {
        if !row.get::<bool, _>("active") {
            return Err(crate::client_controls::inactive_error(row.get("status")));
        }
        return Ok(Json(google_sign_in(&st, &ctx, tenant_id, row.get("id")).await?));
    }

    // 2. Existing account with the same (Google-verified) email: link it.
    let existing = sqlx::query(
        "SELECT id, google_sub, status = 'active' AS active, status, email_verified_at IS NULL AS unverified, first_name
         FROM users WHERE tenant_id = $1 AND email = $2",
    )
    .bind(tenant_id)
    .bind(&email)
    .fetch_optional(&st.pool)
    .await?;
    if let Some(row) = existing {
        let id: i64 = row.get("id");
        if row.get::<Option<String>, _>("google_sub").is_some() {
            return Err(CONFLICT);
        }
        if !row.get::<bool, _>("active") {
            return Err(crate::client_controls::inactive_error(row.get("status")));
        }
        // An unverified account may have been opened by someone else with this address. Google has just
        // proven who owns the mailbox, so that password and any sessions/devices are dropped
        // (the owner can set a password later with "Forgot password").
        let unverified: bool = row.get("unverified");
        let fresh_hash = if unverified { Some(identity::hash_password_blocking(crypto::random_token(32)).await?) } else { None };
        let linked = sqlx::query(
            "UPDATE users SET google_sub = $2, google_linked_at = now(), avatar_url = COALESCE(avatar_url, $3),
                    email_verified_at = COALESCE(email_verified_at, now()),
                    password_hash = COALESCE($4, password_hash), updated_at = now()
             WHERE id = $1 AND google_sub IS NULL",
        )
        .bind(id)
        .bind(&sub)
        .bind(&picture)
        .bind(&fresh_hash)
        .execute(&st.pool)
        .await?
        .rows_affected();
        if linked == 0 {
            return Err(CONFLICT);
        }
        if unverified {
            identity::revoke_all(&st.pool, K, id).await?;
            sqlx::query("DELETE FROM trusted_devices WHERE subject_kind = 'user' AND subject_id = $1").bind(id).execute(&st.pool).await?;
            sqlx::query("UPDATE email_otps SET consumed_at = now() WHERE subject_kind = 'user' AND subject_id = $1 AND consumed_at IS NULL")
                .bind(id)
                .execute(&st.pool)
                .await?;
            client_auth::send_welcome(&st, email.clone(), row.get("first_name"));
        }
        audit::record(&st.pool, &ctx, Entry {
            tenant_id,
            actor_kind: "user",
            actor_id: Some(id),
            action: "user.google_linked",
            target: Some(("user", id)),
            meta: json!({"email_was_unverified": unverified, "password_cleared": unverified}),
        })
        .await;
        tracing::info!(user_id = id, "google account linked");
        return Ok(Json(google_sign_in(&st, &ctx, tenant_id, id).await?));
    }

    // 3. New person: finish the profile first.
    let ticket = Ticket {
        v: 1,
        t: tenant_id,
        sub,
        email,
        first_name: clean_name(r.given_name.as_deref()),
        last_name: clean_name(r.family_name.as_deref()),
        picture,
        referral: validate::referral(r.referral.as_deref()).ok().flatten(),
        exp: Utc::now().timestamp() + TICKET_TTL_SECS,
    };
    Ok(Json(json!({
        "status": "profile_required",
        "ticket": seal(&st.keys, &ticket),
        "expires_in": TICKET_TTL_SECS,
        "profile": profile_json(&ticket),
    })))
}

fn profile_json(t: &Ticket) -> Value {
    json!({ "email": t.email, "first_name": t.first_name, "last_name": t.last_name, "referral_code": t.referral, "picture": t.picture })
}

// ---------- POST /v1/auth/google/ticket (profile step prefill) ----------

#[derive(Deserialize)]
pub struct TicketReq {
    #[serde(default)]
    ticket: String,
}

pub async fn ticket(State(st): State<AppState>, ctx: Ctx, req: Result<Json<TicketReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    identity::limit(&st, format!("google_ticket:ip:{}", ctx.ip), 60, 5 * 60)?;
    let tenant_id = identity::tenant_id(&st.pool, &ctx.tenant_slug).await?;
    let t = open(&st.keys, &r.ticket, tenant_id, Utc::now().timestamp()).ok_or(EXPIRED)?;
    Ok(Json(json!({ "status": "profile_required", "expires_in": (t.exp - Utc::now().timestamp()).max(0), "profile": profile_json(&t) })))
}

// ---------- POST /v1/auth/google/complete ----------

#[derive(Deserialize)]
pub struct CompleteReq {
    #[serde(default)]
    ticket: String,
    first_name: Option<String>,
    last_name: Option<String>,
    #[serde(default)]
    phone_dial: String,
    #[serde(default)]
    phone: String,
    #[serde(default)]
    country: String,
    #[serde(default)]
    date_of_birth: String,
    referral_code: Option<String>,
    /// Partner campaign slug (IB programme), kept only when the referral code resolves to a client.
    referral_campaign: Option<String>,
    /// First-touch campaign attribution (utm_*, landing page, referrer) captured by the Client Area.
    #[serde(default)]
    attribution: Option<crate::marketing::AttributionReq>,
    /// "Email me news and offers" (journeys, campaigns). Transactional emails are sent regardless.
    marketing_consent: Option<bool>,
    #[serde(default)]
    accept_terms: bool,
}

pub async fn complete(State(st): State<AppState>, ctx: Ctx, req: Result<Json<CompleteReq>, JsonRejection>) -> ApiResult<(StatusCode, Json<Value>)> {
    let r = body(req)?;
    identity::limit(&st, format!("google_complete:ip:{}", ctx.ip), 10, 15 * 60)?;
    let tenant_id = identity::tenant_id(&st.pool, &ctx.tenant_slug).await?;
    crate::tenancy::client_gate(&st, tenant_id).await?;
    crate::tenancy::require_feature(&st, tenant_id, "client_registration").await?;
    let t = open(&st.keys, &r.ticket, tenant_id, Utc::now().timestamp()).ok_or(EXPIRED)?;

    let first = validate::name(r.first_name.as_deref().unwrap_or(&t.first_name), "Enter your first name.").map_err(field("first_name"))?;
    let last = validate::name(r.last_name.as_deref().unwrap_or(&t.last_name), "Enter your last name.").map_err(field("last_name"))?;
    let country = validate::country(&r.country).map_err(field("country"))?;
    let dial = validate::dial(&r.phone_dial).map_err(field("phone"))?;
    let phone = validate::phone(&r.phone).map_err(field("phone"))?;
    let dob = validate::date_of_birth(&r.date_of_birth, Utc::now().date_naive()).map_err(field("date_of_birth"))?;
    let referral = validate::referral(r.referral_code.as_deref()).map_err(field("referral_code"))?;
    let campaign = validate::campaign(r.referral_campaign.as_deref());
    if !r.accept_terms {
        return Err(ApiError::Validation { field: "accept_terms", message: "Please confirm you are over 18 and accept the terms." });
    }

    let referred_by = client_auth::referrer(&st, tenant_id, referral.as_deref()).await?;
    // Password sign-in stays closed until the client sets one ("Forgot password").
    let hash = identity::hash_password_blocking(crypto::random_token(32)).await?;
    let Some(user_id) = client_auth::insert_user(&st, NewUser {
        tenant_id,
        email: &t.email,
        password_hash: &hash,
        first_name: &first,
        last_name: &last,
        phone_dial: &dial,
        phone: &phone,
        country: &country,
        date_of_birth: dob,
        referred_by,
        referral_raw: referral.as_deref(),
        referral_campaign: campaign.as_deref(),
        google: Some((&t.sub, t.picture.as_deref())),
    })
    .await?
    else {
        let same_google: Option<i64> = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 AND google_sub = $2")
            .bind(tenant_id)
            .bind(&t.sub)
            .fetch_optional(&st.pool)
            .await?;
        return Err(if same_google.is_some() { ALREADY_SET_UP } else { ApiError::EmailTaken });
    };
    let attribution = crate::marketing::clean_attribution(&r.attribution.unwrap_or_default());
    crate::marketing::store_signup(&st.pool, user_id, &attribution, r.marketing_consent.unwrap_or(true)).await?;

    audit::record(&st.pool, &ctx, Entry {
        tenant_id,
        actor_kind: "user",
        actor_id: Some(user_id),
        action: "user.register",
        target: Some(("user", user_id)),
        meta: json!({"method": "google", "country": country, "referral_code": referral, "referred_by": referred_by, "referral_campaign": campaign,
                     "utm_source": attribution.source, "utm_medium": attribution.medium, "utm_campaign": attribution.campaign}),
    })
    .await;
    tracing::info!(user_id, "client registered with google");
    client_auth::send_welcome(&st, t.email.clone(), first.clone());
    Ok((StatusCode::CREATED, Json(google_sign_in(&st, &ctx, tenant_id, user_id).await?)))
}

#[cfg(test)]
mod tests;
