//! Shared sign-in machinery for clients (`users`) and staff: lockout, sessions, email OTPs, trusted devices.

use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Row};

use crate::crypto;
use crate::error::{ApiError, ApiResult};
use crate::state::{AppState, Ctx};
use crate::validate::mask_email;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    User,
    Staff,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::User => "user",
            Kind::Staff => "staff",
        }
    }
}

/// Security policy per principal kind.
pub struct Policy {
    /// Absolute session lifetime.
    pub session_ttl: Duration,
    /// Session ends after this long without activity.
    pub session_idle: Duration,
    /// Consecutive wrong passwords before a lock.
    pub max_failures: i32,
    pub lock_for: Duration,
    pub otp_ttl: Duration,
}

pub const MAX_OTP_ATTEMPTS: i32 = 5;
pub const MAX_OTP_SENDS: i32 = 5;
pub const OTP_RESEND_AFTER_SECS: i64 = 30;

pub fn policy(kind: Kind) -> Policy {
    match kind {
        Kind::User => Policy {
            session_ttl: Duration::days(7),
            session_idle: Duration::hours(24),
            max_failures: 5,
            lock_for: Duration::minutes(15),
            otp_ttl: Duration::minutes(10),
        },
        Kind::Staff => Policy {
            session_ttl: Duration::hours(12),
            session_idle: Duration::hours(2),
            max_failures: 5,
            lock_for: Duration::minutes(30),
            otp_ttl: Duration::minutes(5),
        },
    }
}

/// Whether a stored session is still usable at `now`.
pub fn session_live(now: DateTime<Utc>, expires_at: DateTime<Utc>, last_seen_at: DateTime<Utc>, idle: Duration, revoked: bool) -> bool {
    !revoked && now < expires_at && now - last_seen_at < idle
}

/// After a wrong password: returns (new failure count, lock-until) for the given current count.
pub fn after_failure(current_failures: i32, now: DateTime<Utc>, p: &Policy) -> (i32, Option<DateTime<Utc>>) {
    let n = current_failures + 1;
    if n >= p.max_failures { (0, Some(now + p.lock_for)) } else { (n, None) }
}

pub async fn tenant_id(pool: &PgPool, slug: &str) -> ApiResult<i64> {
    let id: Option<i64> = sqlx::query_scalar("SELECT id FROM tenants WHERE slug = $1 AND status = 'active'").bind(slug).fetch_optional(pool).await?;
    id.ok_or(ApiError::BadRequest("Unknown broker."))
}

pub struct Principal {
    pub id: i64,
    pub email: String,
    pub password_hash: String,
    pub active: bool,
    /// `active` / `blocked` (suspended by staff, see client_controls) / `closed` (clients); staff: `active` / `disabled` / `invited`.
    pub status: String,
    pub failed_logins: i32,
    pub locked_until: Option<DateTime<Utc>>,
    pub email_verified: bool,
}

pub async fn find_principal(pool: &PgPool, kind: Kind, tenant_id: i64, email: &str) -> ApiResult<Option<Principal>> {
    let sql = match kind {
        Kind::User => {
            "SELECT id, email, password_hash, status = 'active' AS active, status, failed_logins, locked_until,
                    email_verified_at IS NOT NULL AS verified
             FROM users WHERE tenant_id = $1 AND email = $2 AND NOT is_house"
        }
        Kind::Staff => {
            "SELECT id, email, password_hash, status = 'active' AS active, status, failed_logins, locked_until, true AS verified
             FROM staff WHERE tenant_id = $1 AND email = $2"
        }
    };
    let row = sqlx::query(sql).bind(tenant_id).bind(email).fetch_optional(pool).await?;
    Ok(row.map(|r| Principal {
        id: r.get("id"),
        email: r.get("email"),
        password_hash: r.get("password_hash"),
        active: r.get("active"),
        status: r.get("status"),
        failed_logins: r.get("failed_logins"),
        locked_until: r.get("locked_until"),
        email_verified: r.get("verified"),
    }))
}

pub async fn set_failures(pool: &PgPool, kind: Kind, id: i64, failures: i32, locked_until: Option<DateTime<Utc>>) -> ApiResult<()> {
    let sql = match kind {
        Kind::User => "UPDATE users SET failed_logins = $2, locked_until = $3, updated_at = now() WHERE id = $1",
        Kind::Staff => "UPDATE staff SET failed_logins = $2, locked_until = $3, updated_at = now() WHERE id = $1",
    };
    sqlx::query(sql).bind(id).bind(failures).bind(locked_until).execute(pool).await?;
    Ok(())
}

pub async fn mark_login(pool: &PgPool, kind: Kind, id: i64) -> ApiResult<()> {
    let sql = match kind {
        // signing in counts as activity for the client's presence (client_controls.rs)
        Kind::User => "UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now(), last_active_at = now() WHERE id = $1",
        Kind::Staff => "UPDATE staff SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1",
    };
    sqlx::query(sql).bind(id).execute(pool).await?;
    Ok(())
}

/// Runs argon2 off the async runtime.
pub async fn verify_password_blocking(password: String, phc: String) -> bool {
    tokio::task::spawn_blocking(move || crypto::verify_password(&password, &phc)).await.unwrap_or(false)
}

pub async fn hash_password_blocking(password: String) -> ApiResult<String> {
    Ok(tokio::task::spawn_blocking(move || crypto::hash_password(&password)).await.map_err(anyhow::Error::from)??)
}

// ---------- rate limiting ----------

pub fn limit(st: &AppState, key: String, limit: u32, window_secs: u64) -> ApiResult<()> {
    st.limiter.hit(&key, limit, std::time::Duration::from_secs(window_secs)).map_err(|retry_after| ApiError::RateLimited { retry_after })
}

// ---------- sessions ----------

pub struct NewSession {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

pub async fn create_session(st: &AppState, ctx: &Ctx, kind: Kind, tenant_id: i64, subject_id: i64) -> ApiResult<NewSession> {
    create_session_as(st, ctx, kind, tenant_id, subject_id, None).await
}

/// Prefix of view-only session tokens (D90). base64url never contains '.', so the prefix can't collide with a
/// normal token; the Client Area proxy uses it to hold viewer sessions to read-only requests before any lookup.
/// The gateway itself never trusts the prefix: `sessions.viewer_id` decides.
pub const VIEWER_TOKEN_PREFIX: &str = "v.";

/// Viewer sessions end sooner than the owner's.
pub const VIEWER_SESSION_TTL_HOURS: i64 = 12;

tokio::task_local! {
    /// ISO country of the caller from the edge (`X-Ezymex-Country`, set by the apps from CF-IPCountry), for the
    /// approximate location of new sessions. Set per request by the router middleware.
    pub static COUNTRY: Option<String>;
}

/// Two lowercase letters or nothing ("XX" / "T1" from Cloudflare mean unknown / Tor).
pub fn clean_country(raw: Option<&str>) -> Option<String> {
    let c = raw?.trim().to_ascii_lowercase();
    (c.len() == 2 && c.chars().all(|x| x.is_ascii_lowercase()) && c != "xx").then_some(c)
}

fn request_country() -> Option<String> {
    COUNTRY.try_with(|c| c.clone()).ok().flatten()
}

/// Creates a session; `viewer` = the view-only login it was opened with (the subject is then the owning client).
pub async fn create_session_as(st: &AppState, ctx: &Ctx, kind: Kind, tenant_id: i64, subject_id: i64, viewer: Option<i64>) -> ApiResult<NewSession> {
    let token = match viewer {
        Some(_) => format!("{VIEWER_TOKEN_PREFIX}{}", crypto::random_token(32)),
        None => crypto::random_token(32),
    };
    let ttl = if viewer.is_some() { Duration::hours(VIEWER_SESSION_TTL_HOURS) } else { policy(kind).session_ttl };
    let expires_at = Utc::now() + ttl;
    sqlx::query(
        "INSERT INTO sessions (tenant_id, subject_kind, subject_id, token_hash, ip, user_agent, expires_at, viewer_id, country)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    )
    .bind(tenant_id)
    .bind(kind.as_str())
    .bind(subject_id)
    .bind(st.keys.hash("session", &token))
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .bind(expires_at)
    .bind(viewer)
    .bind(request_country())
    .execute(&st.pool)
    .await?;
    Ok(NewSession { token, expires_at })
}

pub struct SessionRef {
    pub session_id: i64,
    pub subject_id: i64,
    pub tenant_id: i64,
    pub expires_at: DateTime<Utc>,
    /// Set for a view-only session (D90): the subject is the owning client, but nothing may be changed.
    pub viewer_id: Option<i64>,
    /// Set for a staff session opened as the client from the Back Office (client_controls.rs).
    pub impersonation: Option<Impersonation>,
}

/// A staff member acting as the client ("log in as client").
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Impersonation {
    pub staff_id: i64,
    /// `read_only` (every change refused, like a view-only login) or `full` (Super Admin, confirmed).
    pub read_only: bool,
}

/// 403 for any change attempted with a view-only session.
pub fn viewer_read_only() -> ApiError {
    ApiError::Coded {
        status: axum::http::StatusCode::FORBIDDEN,
        code: "viewer_read_only",
        message: "This is a view-only login. Viewers can't make changes.",
    }
}

/// Resolves a bearer token to a live session of `kind` that may make changes: view-only sessions are refused
/// with 403 `viewer_read_only`. Every client write goes through here.
pub async fn resolve_session(st: &AppState, ctx: &Ctx, kind: Kind) -> ApiResult<SessionRef> {
    let s = resolve_session_any(st, ctx, kind).await?;
    if s.viewer_id.is_some() {
        return Err(viewer_read_only());
    }
    if let Some(imp) = &s.impersonation
        && imp.read_only
    {
        crate::client_controls::write_refused(st, ctx, &s, imp).await;
        return Err(crate::client_controls::staff_read_only());
    }
    Ok(s)
}

/// Idle window of a session: staff use the fixed policy; clients use the tenant's setting (Back Office).
pub fn idle_window(kind: Kind, client_idle_minutes: i32) -> Duration {
    match kind {
        Kind::Staff => policy(kind).session_idle,
        Kind::User => Duration::minutes(client_idle_minutes.clamp(5, 10080) as i64),
    }
}

/// Resolves a bearer token to a live session of `kind` (view-only sessions included), sliding `last_seen_at`
/// forward (at most every `PRESENCE_BUMP_SECS`). Only read paths (`/v1/auth/me`, lists) use this directly.
pub async fn resolve_session_any(st: &AppState, ctx: &Ctx, kind: Kind) -> ApiResult<SessionRef> {
    let token = ctx.bearer.as_deref().ok_or(ApiError::Unauthorized)?;
    let row = sqlx::query(
        "SELECT s.id, s.subject_id, s.tenant_id, s.expires_at, s.last_seen_at, s.revoked_at IS NOT NULL AS revoked, s.viewer_id,
                s.impersonator_id, s.impersonator_session_id, s.impersonation_mode, t.client_idle_minutes
         FROM sessions s JOIN tenants t ON t.id = s.tenant_id WHERE s.token_hash = $1 AND s.subject_kind = $2",
    )
    .bind(st.keys.hash("session", token))
    .bind(kind.as_str())
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::Unauthorized)?;
    let now = Utc::now();
    let expires_at: DateTime<Utc> = row.get("expires_at");
    let last_seen: DateTime<Utc> = row.get("last_seen_at");
    if !session_live(now, expires_at, last_seen, idle_window(kind, row.get("client_idle_minutes")), row.get("revoked")) {
        return Err(ApiError::Unauthorized);
    }
    let session_id: i64 = row.get("id");
    let subject_id: i64 = row.get("subject_id");
    let viewer_id: Option<i64> = row.get("viewer_id");
    if let Some(v) = viewer_id {
        // a revoked, expired or re-keyed viewer login ends its sessions at once
        let ok: Option<bool> = sqlx::query_scalar("SELECT revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) FROM client_viewers WHERE id = $1")
            .bind(v)
            .fetch_optional(&st.pool)
            .await?;
        if ok != Some(true) {
            return Err(ApiError::Unauthorized);
        }
    }
    let impersonation = match row.get::<Option<i64>, _>("impersonator_id") {
        Some(staff_id) => {
            // bound to the staff member: it ends with their own Back Office session (sign-out, disabled, expired)
            let staff_session: i64 = row.get::<Option<i64>, _>("impersonator_session_id").unwrap_or(0);
            if !crate::client_controls::staff_session_live(st, staff_id, staff_session).await? {
                return Err(ApiError::Unauthorized);
            }
            Some(Impersonation { staff_id, read_only: row.get::<Option<String>, _>("impersonation_mode").as_deref() != Some("full") })
        }
        None => None,
    };
    if now - last_seen > Duration::seconds(PRESENCE_BUMP_SECS) {
        // presence (client_controls): only the client's own sessions count, never view-only logins or staff
        sqlx::query(
            "WITH s AS (UPDATE sessions SET last_seen_at = now() WHERE id = $1
                        RETURNING subject_kind, subject_id, viewer_id, impersonator_id)
             UPDATE users u SET last_active_at = now() FROM s
              WHERE s.subject_kind = 'user' AND u.id = s.subject_id AND s.viewer_id IS NULL AND s.impersonator_id IS NULL",
        )
        .bind(session_id)
        .execute(&st.pool)
        .await?;
    }
    Ok(SessionRef { session_id, subject_id, tenant_id: row.get("tenant_id"), expires_at, viewer_id, impersonation })
}

/// A session's `last_seen_at` (and the client's presence) moves forward at most this often.
pub const PRESENCE_BUMP_SECS: i64 = 30;

pub async fn revoke_token(st: &AppState, token: &str, kind: Kind) -> ApiResult<Option<(i64, i64)>> {
    let row = sqlx::query(
        "UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND subject_kind = $2 AND revoked_at IS NULL
         RETURNING tenant_id, subject_id",
    )
    .bind(st.keys.hash("session", token))
    .bind(kind.as_str())
    .fetch_optional(&st.pool)
    .await?;
    Ok(row.map(|r| (r.get("tenant_id"), r.get("subject_id"))))
}

pub async fn revoke_all(pool: &PgPool, kind: Kind, subject_id: i64) -> ApiResult<()> {
    sqlx::query("UPDATE sessions SET revoked_at = now() WHERE subject_kind = $1 AND subject_id = $2 AND revoked_at IS NULL")
        .bind(kind.as_str())
        .bind(subject_id)
        .execute(pool)
        .await?;
    Ok(())
}

// ---------- trusted devices ----------

pub fn device_hash(st: &AppState, ctx: &Ctx) -> Option<Vec<u8>> {
    ctx.device.as_deref().map(|d| st.keys.hash("device", d))
}

pub async fn device_trusted(st: &AppState, ctx: &Ctx, kind: Kind, subject_id: i64) -> ApiResult<bool> {
    let Some(h) = device_hash(st, ctx) else { return Ok(false) };
    let n = sqlx::query(
        "UPDATE trusted_devices SET last_seen_at = now() WHERE subject_kind = $1 AND subject_id = $2 AND device_hash = $3",
    )
    .bind(kind.as_str())
    .bind(subject_id)
    .bind(h)
    .execute(&st.pool)
    .await?
    .rows_affected();
    Ok(n > 0)
}

pub async fn trust_device(st: &AppState, ctx: &Ctx, kind: Kind, tenant_id: i64, subject_id: i64, h: Option<Vec<u8>>) -> ApiResult<()> {
    let Some(h) = h.or_else(|| device_hash(st, ctx)) else { return Ok(()) };
    sqlx::query(
        "INSERT INTO trusted_devices (tenant_id, subject_kind, subject_id, device_hash, user_agent) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (subject_kind, subject_id, device_hash) DO UPDATE SET last_seen_at = now(), user_agent = EXCLUDED.user_agent",
    )
    .bind(tenant_id)
    .bind(kind.as_str())
    .bind(subject_id)
    .bind(h)
    .bind(&ctx.user_agent)
    .execute(&st.pool)
    .await?;
    Ok(())
}

// ---------- email OTP ----------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Purpose {
    VerifyEmail,
    Login,
    ResetPassword,
    /// Step-up confirmation of a sensitive change by a signed-in client (D20); see `stepup`.
    Confirm,
}

impl Purpose {
    pub fn as_str(self) -> &'static str {
        match self {
            Purpose::VerifyEmail => "verify_email",
            Purpose::Login => "login",
            Purpose::ResetPassword => "reset_password",
            Purpose::Confirm => "confirm",
        }
    }
    fn parse(s: &str) -> Option<Self> {
        match s {
            "verify_email" => Some(Purpose::VerifyEmail),
            "login" => Some(Purpose::Login),
            "reset_password" => Some(Purpose::ResetPassword),
            "confirm" => Some(Purpose::Confirm),
            _ => None,
        }
    }
}

/// JSON the apps receive when a code was sent.
pub fn challenge_json(st: &AppState, challenge: &str, email: &str, purpose: Purpose, kind: Kind, code: Option<&str>) -> serde_json::Value {
    let mut v = serde_json::json!({
        "status": "otp_required",
        "challenge": challenge,
        "purpose": purpose.as_str(),
        "email_masked": mask_email(email),
        "expires_in": policy(kind).otp_ttl.num_seconds(),
        "resend_in": OTP_RESEND_AFTER_SECS,
    });
    if st.cfg.dev_mode && !st.cfg.smtp_configured
        && let Some(c) = code
    {
        v["dev_code"] = serde_json::Value::String(c.to_string());
    }
    v
}

pub async fn send_otp(st: &AppState, ctx: &Ctx, kind: Kind, tenant_id: i64, subject_id: i64, email: &str, purpose: Purpose) -> ApiResult<(String, String)> {
    send_otp_scoped(st, ctx, kind, tenant_id, subject_id, email, purpose, None).await
}

/// `scope` = (action, target) for step-up codes: stored with the code, named in the email, and older pending
/// codes are only superseded within the same action.
#[allow(clippy::too_many_arguments)]
pub async fn send_otp_scoped(
    st: &AppState,
    ctx: &Ctx,
    kind: Kind,
    tenant_id: i64,
    subject_id: i64,
    email: &str,
    purpose: Purpose,
    scope: Option<(&str, &str)>,
) -> ApiResult<(String, String)> {
    let challenge = crypto::random_token(24);
    let code = crypto::otp_code();
    let (action, target) = match scope {
        Some((a, t)) => (Some(a), Some(t)),
        None => (None, None),
    };
    sqlx::query(
        "INSERT INTO email_otps (id, tenant_id, subject_kind, subject_id, purpose, code_hash, device_hash, expires_at, action, target)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    )
    .bind(&challenge)
    .bind(tenant_id)
    .bind(kind.as_str())
    .bind(subject_id)
    .bind(purpose.as_str())
    .bind(st.keys.hash("otp", &format!("{challenge}:{code}")))
    .bind(device_hash(st, ctx))
    .bind(Utc::now() + policy(kind).otp_ttl)
    .bind(action)
    .bind(target)
    .execute(&st.pool)
    .await?;
    // invalidate older unconsumed codes for the same purpose (and, for step-up codes, the same action)
    sqlx::query(
        "UPDATE email_otps SET consumed_at = now()
         WHERE subject_kind = $1 AND subject_id = $2 AND purpose = $3 AND id <> $4 AND consumed_at IS NULL
           AND action IS NOT DISTINCT FROM $5",
    )
    .bind(kind.as_str())
    .bind(subject_id)
    .bind(purpose.as_str())
    .bind(&challenge)
    .bind(action)
    .execute(&st.pool)
    .await?;
    let detail = scope.map(|(a, t)| crate::stepup::describe(a, t));
    deliver(st, email, purpose, &code, policy(kind).otp_ttl.num_minutes(), detail);
    Ok((challenge, code))
}

/// Email delivery. With SMTP configured the code is emailed in the background (never logged);
/// without it, development mode writes the code to the service log.
fn deliver(st: &AppState, email: &str, purpose: Purpose, code: &str, ttl_minutes: i64, detail: Option<String>) {
    if let Some(mailer) = st.mailer.clone() {
        let (to, code) = (email.to_string(), code.to_string());
        // read before spawning: the task-local does not cross into the new task
        let locale = crate::mail_i18n::current();
        tokio::spawn(async move {
            match mailer.send_code_in(&locale, &to, purpose, &code, ttl_minutes, detail.as_deref()).await {
                Ok(()) => tracing::info!(to = %mask_email(&to), purpose = purpose.as_str(), "email code sent"),
                Err(e) => tracing::error!(to = %mask_email(&to), purpose = purpose.as_str(), error = %e, "email code could not be sent"),
            }
        });
    } else if st.cfg.dev_mode {
        tracing::info!(target: "otp", to = %email, purpose = purpose.as_str(), %code, "DEV email OTP (SMTP not configured)");
    } else {
        tracing::error!(to = %mask_email(email), purpose = purpose.as_str(), "cannot deliver OTP: SMTP not configured");
    }
}

pub struct VerifiedOtp {
    pub tenant_id: i64,
    pub subject_id: i64,
    pub purpose: Purpose,
    pub device_hash: Option<Vec<u8>>,
}

/// Checks and consumes a code. Wrong codes count attempts; the row is consumed atomically on success.
pub async fn verify_otp(st: &AppState, kind: Kind, challenge: &str, code: &str) -> ApiResult<VerifiedOtp> {
    let code = code.trim();
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Err(ApiError::Validation { field: "code", message: "Enter the 6-digit code." });
    }
    let row = sqlx::query(
        "SELECT tenant_id, subject_id, purpose, code_hash, device_hash, attempts, expires_at, consumed_at IS NOT NULL AS consumed
         FROM email_otps WHERE id = $1 AND subject_kind = $2",
    )
    .bind(challenge)
    .bind(kind.as_str())
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::CodeExpired)?;
    let attempts: i32 = row.get("attempts");
    let expires_at: DateTime<Utc> = row.get("expires_at");
    if row.get::<bool, _>("consumed") || expires_at <= Utc::now() {
        return Err(ApiError::CodeExpired);
    }
    if attempts >= MAX_OTP_ATTEMPTS {
        return Err(ApiError::InvalidCode { attempts_left: 0 });
    }
    let stored: Vec<u8> = row.get("code_hash");
    if !crypto::ct_eq(&stored, &st.keys.hash("otp", &format!("{challenge}:{code}"))) {
        let n: i32 = sqlx::query_scalar("UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts").bind(challenge).fetch_one(&st.pool).await?;
        return Err(ApiError::InvalidCode { attempts_left: (MAX_OTP_ATTEMPTS - n).max(0) });
    }
    let consumed = sqlx::query("UPDATE email_otps SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL").bind(challenge).execute(&st.pool).await?.rows_affected();
    if consumed == 0 {
        return Err(ApiError::CodeExpired);
    }
    let purpose = Purpose::parse(row.get::<&str, _>("purpose")).ok_or(ApiError::CodeExpired)?;
    Ok(VerifiedOtp { tenant_id: row.get("tenant_id"), subject_id: row.get("subject_id"), purpose, device_hash: row.get("device_hash") })
}

/// Issues a fresh code for an existing challenge (same id), respecting the resend cooldown and send cap.
pub async fn resend_otp(st: &AppState, kind: Kind, challenge: &str) -> ApiResult<serde_json::Value> {
    let row = sqlx::query(
        "SELECT o.subject_id, o.purpose, o.sent_count, o.last_sent_at, o.consumed_at IS NOT NULL AS consumed,
                o.action, o.target, COALESCE(u.email, s.email) AS email
         FROM email_otps o
         LEFT JOIN users u ON o.subject_kind = 'user' AND u.id = o.subject_id
         LEFT JOIN staff s ON o.subject_kind = 'staff' AND s.id = o.subject_id
         WHERE o.id = $1 AND o.subject_kind = $2",
    )
    .bind(challenge)
    .bind(kind.as_str())
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::CodeExpired)?;
    if row.get::<bool, _>("consumed") {
        return Err(ApiError::CodeExpired);
    }
    let since = (Utc::now() - row.get::<DateTime<Utc>, _>("last_sent_at")).num_seconds();
    if since < OTP_RESEND_AFTER_SECS {
        return Err(ApiError::RateLimited { retry_after: (OTP_RESEND_AFTER_SECS - since).max(1) as u64 });
    }
    let purpose = Purpose::parse(row.get::<&str, _>("purpose")).ok_or(ApiError::CodeExpired)?;
    if row.get::<i32, _>("sent_count") >= MAX_OTP_SENDS {
        return Err(ApiError::BadRequest(if purpose == Purpose::Confirm {
            "Too many codes sent. Close this window and start again."
        } else {
            "Too many codes sent. Start again from the sign-in page."
        }));
    }
    let action: Option<String> = row.get("action");
    let target: Option<String> = row.get("target");
    let email: Option<String> = row.get("email");
    let email = email.ok_or(ApiError::CodeExpired)?;
    let code = crypto::otp_code();
    sqlx::query(
        "UPDATE email_otps SET code_hash = $2, attempts = 0, sent_count = sent_count + 1, last_sent_at = now(), expires_at = $3 WHERE id = $1",
    )
    .bind(challenge)
    .bind(st.keys.hash("otp", &format!("{challenge}:{code}")))
    .bind(Utc::now() + policy(kind).otp_ttl)
    .execute(&st.pool)
    .await?;
    let detail = action.as_deref().map(|a| crate::stepup::describe(a, target.as_deref().unwrap_or("")));
    deliver(st, &email, purpose, &code, policy(kind).otp_ttl.num_minutes(), detail);
    let mut v = challenge_json(st, challenge, &email, purpose, kind, Some(&code));
    if let Some(a) = action {
        v["action"] = serde_json::Value::String(a);
    }
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_expiry_rules() {
        let now = Utc::now();
        let idle = Duration::hours(2);
        assert!(session_live(now, now + Duration::hours(1), now - Duration::minutes(5), idle, false));
        // absolute expiry
        assert!(!session_live(now, now - Duration::seconds(1), now, idle, false));
        // idle timeout
        assert!(!session_live(now, now + Duration::hours(5), now - Duration::hours(3), idle, false));
        // revoked
        assert!(!session_live(now, now + Duration::hours(5), now, idle, true));
    }

    #[test]
    fn staff_sessions_are_shorter_than_client_sessions() {
        assert!(policy(Kind::Staff).session_ttl < policy(Kind::User).session_ttl);
        assert_eq!(policy(Kind::Staff).session_ttl, Duration::hours(12));
    }

    #[test]
    fn lockout_after_max_failures() {
        let p = policy(Kind::User);
        let now = Utc::now();
        assert_eq!(after_failure(0, now, &p), (1, None));
        assert_eq!(after_failure(3, now, &p), (4, None));
        let (n, until) = after_failure(4, now, &p);
        assert_eq!(n, 0);
        assert_eq!(until, Some(now + Duration::minutes(15)));
    }
}
