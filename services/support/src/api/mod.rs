//! HTTP API on 127.0.0.1:8100. Every route except `GET /health` and `GET /v1/stream` needs
//! `X-Ezymex-Internal: $SUPPORT_INTERNAL_TOKEN`. Client routes take the signed-in gateway user in
//! `X-Ezymex-User-Id` (+ `X-Ezymex-User-Name` percent-encoded, `X-Ezymex-User-Email`), resolved by the CRM BFF
//! from the session cookie; staff routes take the staff identity headers the admin BFF verified with the gateway.
//! The WebSocket stream authenticates with a one-time ticket from `POST /v1/stream/ticket`.

pub mod admin;
pub mod client;
pub mod notifications;
pub mod stream;

use crate::chat::{Agent, Client};
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;
use crate::util::percent_decode;
use axum::extract::{DefaultBodyLimit, FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde_json::json;
use subtle::ConstantTimeEq;

pub fn router(st: AppState) -> Router {
    let upload_limit = DefaultBodyLimit::max(st.cfg.max_attachment_bytes + 64 * 1024);
    let v1 = Router::new()
        // other services
        .route("/v1/notify", post(notifications::ingest))
        .route("/v1/stream/ticket", post(stream::ticket))
        // Client Area
        .route("/v1/support/me", get(client::home))
        .route("/v1/support/me/conversations", get(client::conversations))
        .route("/v1/support/me/conversations/{id}", get(client::conversation))
        .route("/v1/support/me/conversations/{id}/resolve", post(client::resolve))
        .route("/v1/support/me/conversations/{id}/rate", post(client::rate))
        .route("/v1/support/me/messages", post(client::send))
        .route("/v1/support/me/handover", post(client::handover))
        .route("/v1/support/me/read", post(client::read))
        .route("/v1/support/me/typing", post(client::typing))
        .route("/v1/support/me/attachments", post(client::upload).layer(upload_limit.clone()))
        .route("/v1/support/me/attachments/{id}", get(client::attachment))
        .route("/v1/notifications/me", get(notifications::my_list))
        .route("/v1/notifications/me/read", post(notifications::my_read))
        .route("/v1/notifications/me/clear", post(notifications::my_clear))
        .route("/v1/notifications/me/prefs", get(notifications::my_prefs).put(notifications::my_prefs_put))
        // Back Office
        .route("/v1/support/admin/conversations", get(admin::conversations))
        .route("/v1/support/admin/conversations/{id}", get(admin::conversation))
        .route("/v1/support/admin/conversations/{id}/messages", post(admin::send))
        .route("/v1/support/admin/conversations/{id}/assign", post(admin::assign))
        .route("/v1/support/admin/conversations/{id}/takeover", post(admin::takeover))
        .route("/v1/support/admin/conversations/{id}/resolve", post(admin::resolve))
        .route("/v1/support/admin/conversations/{id}/reopen", post(admin::reopen))
        .route("/v1/support/admin/conversations/{id}/tags", put(admin::tags))
        .route("/v1/support/admin/conversations/{id}/read", post(admin::read))
        .route("/v1/support/admin/conversations/{id}/typing", post(admin::typing))
        .route("/v1/support/admin/conversations/{id}/context", get(admin::context))
        .route("/v1/support/admin/conversations/{id}/attachments", post(admin::upload).layer(upload_limit))
        .route("/v1/support/admin/attachments/{id}", get(admin::attachment))
        .route("/v1/support/admin/agents", get(admin::agents))
        .route("/v1/support/admin/me/status", put(admin::my_status))
        .route("/v1/support/admin/canned", get(admin::canned).post(admin::canned_create))
        .route("/v1/support/admin/canned/{id}", put(admin::canned_update).delete(admin::canned_delete))
        .route("/v1/support/admin/canned/{id}/use", post(admin::canned_use))
        .route("/v1/support/admin/kb", get(admin::kb_list).post(admin::kb_create))
        .route("/v1/support/admin/kb/test", post(admin::kb_test))
        .route("/v1/support/admin/kb/{id}", get(admin::kb_get).put(admin::kb_update).delete(admin::kb_delete))
        .route("/v1/support/admin/stats", get(admin::stats))
        .route("/v1/support/admin/settings", get(admin::settings).put(admin::settings_put))
        .route("/v1/support/admin/audit", get(admin::audit))
        .route("/v1/notifications/staff/me", get(notifications::staff_list))
        .route("/v1/notifications/staff/me/read", post(notifications::staff_read))
        .route("/v1/notifications/staff/me/clear", post(notifications::staff_clear))
        .route("/v1/notifications/admin/broadcasts", get(notifications::broadcasts).post(notifications::broadcast))
        .route("/v1/notifications/admin/broadcasts/preview", post(notifications::broadcast_preview))
        .route("/v1/notifications/admin/types", get(notifications::types))
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(middleware::from_fn_with_state(st.clone(), internal_only));
    Router::new()
        .route("/health", get(health))
        .route("/v1/stream", get(stream::stream))
        .merge(v1)
        .fallback(|| async { (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": {"code": "not_found", "message": "Not found."}}))) })
        .with_state(st)
}

async fn health(State(st): State<AppState>) -> impl IntoResponse {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&st.pool).await.is_ok();
    Json(json!({"status": if db { "ok" } else { "degraded" }, "db": db, "service": "support", "ai": !st.cfg.anthropic_key.is_empty(), "smtp": st.mailer.is_some()}))
}

async fn internal_only(State(st): State<AppState>, req: Request, next: Next) -> Response {
    let expected = st.cfg.internal_token.as_bytes();
    if !expected.is_empty() {
        let got = req.headers().get("x-ezymex-internal").map(|v| v.as_bytes()).unwrap_or_default();
        if got.len() != expected.len() || !bool::from(got.ct_eq(expected)) {
            return ApiError::Forbidden("Missing or wrong internal token.".into()).into_response();
        }
    }
    next.run(req).await
}

fn header(parts: &Parts, name: &str) -> Option<String> {
    parts.headers.get(name).and_then(|v| v.to_str().ok()).map(str::trim).filter(|v| !v.is_empty()).map(str::to_string)
}

pub fn tenant_of(parts: &Parts) -> ApiResult<String> {
    let t = header(parts, "x-ezymex-tenant").unwrap_or_else(|| "ezymex".into()).to_lowercase();
    if t.len() > 40 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(ApiError::BadRequest("Invalid tenant.".into()));
    }
    Ok(t)
}

/// Tenant only (service-to-service routes).
pub struct Tenant(pub String);

impl<S: Send + Sync> FromRequestParts<S> for Tenant {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        Ok(Tenant(tenant_of(parts)?))
    }
}

/// Calling service name (`X-Ezymex-Service`), for the notification `source`.
pub struct Service(pub String);

impl<S: Send + Sync> FromRequestParts<S> for Service {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let s = header(parts, "x-ezymex-service").unwrap_or_else(|| "service".into());
        Ok(Service(s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').take(32).collect()))
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Client {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let id = header(parts, "x-ezymex-user-id").and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0).ok_or(ApiError::Unauthorized)?;
        let name = header(parts, "x-ezymex-user-name").map(|n| percent_decode(&n)).unwrap_or_default();
        let email = header(parts, "x-ezymex-user-email").map(|n| percent_decode(&n)).unwrap_or_default();
        Ok(Client { tenant: tenant_of(parts)?, id, name: name.chars().take(120).collect(), email: email.chars().take(200).collect() })
    }
}

/// Back Office staff, as verified by the admin BFF, plus the permissions it resolved (`X-Ezymex-Staff-Perms`).
pub struct Staff {
    pub agent: Agent,
    perms: Option<Vec<String>>,
}

/// Roles per permission, used when the BFF sends no `X-Ezymex-Staff-Perms`.
pub const SUPPORT_READ: &[&str] = &["platform_owner", "super_admin", "admin", "support", "compliance", "finance", "risk_manager", "viewer"];
pub const SUPPORT_WRITE: &[&str] = &["platform_owner", "super_admin", "admin", "support"];
pub const NOTIFICATIONS_WRITE: &[&str] = &["platform_owner", "super_admin", "admin", "marketing"];

impl Staff {
    /// `perm` = `support.read`, `support.write` or `notifications.write`.
    pub fn require(&self, perm: &str) -> ApiResult<()> {
        let ok = match &self.perms {
            Some(p) => p.iter().any(|x| x == perm),
            None => match perm {
                "support.read" => SUPPORT_READ.contains(&self.agent.role.as_str()),
                "support.write" => SUPPORT_WRITE.contains(&self.agent.role.as_str()),
                "notifications.write" => NOTIFICATIONS_WRITE.contains(&self.agent.role.as_str()),
                _ => false,
            },
        };
        if ok { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this.".into())) }
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Staff {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let id = header(parts, "x-ezymex-staff-id").ok_or(ApiError::Unauthorized)?;
        let role = header(parts, "x-ezymex-staff-role").ok_or(ApiError::Unauthorized)?;
        if id.len() > 64 || role.len() > 32 {
            return Err(ApiError::BadRequest("Invalid staff headers.".into()));
        }
        let name = header(parts, "x-ezymex-staff-name").map(|n| percent_decode(&n)).unwrap_or_else(|| format!("Staff {id}"));
        let perms = header(parts, "x-ezymex-staff-perms").map(|p| p.split(',').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect());
        Ok(Staff { agent: Agent { tenant: tenant_of(parts)?, id, name: name.chars().take(80).collect(), role }, perms })
    }
}

/// `limit` clamped.
pub fn clamp_limit(v: Option<i64>, default: i64, max: i64) -> i64 {
    v.unwrap_or(default).clamp(1, max)
}

/// JSON body as a `Value` with a JSON error on malformed input.
pub struct Body(pub serde_json::Value);

impl<S: Send + Sync> axum::extract::FromRequest<S> for Body {
    type Rejection = ApiError;
    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let bytes = axum::body::Bytes::from_request(req, state).await.map_err(|_| ApiError::BadRequest("Request body too large or unreadable.".into()))?;
        if bytes.is_empty() {
            return Ok(Body(json!({})));
        }
        let v: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| ApiError::BadRequest("Invalid JSON.".into()))?;
        if !v.is_object() {
            return Err(ApiError::BadRequest("Expected a JSON object.".into()));
        }
        Ok(Body(v))
    }
}

/// Uploaded file: raw bytes, name from `X-File-Name` (percent-encoded).
pub struct Upload {
    pub name: String,
    pub bytes: axum::body::Bytes,
}

impl<S: Send + Sync> axum::extract::FromRequest<S> for Upload {
    type Rejection = ApiError;
    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let name = req.headers().get("x-file-name").and_then(|v| v.to_str().ok()).map(percent_decode).unwrap_or_else(|| "file".into());
        let bytes = axum::body::Bytes::from_request(req, state).await.map_err(|_| ApiError::TooLarge("The file is too large.".into()))?;
        Ok(Upload { name, bytes })
    }
}

/// A stored file served back with safe headers (never rendered inline as HTML).
pub fn file_response(bytes: Vec<u8>, mime: &str, name: &str) -> Response {
    let disposition = if mime.starts_with("image/") { "inline" } else { "attachment" };
    let safe: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')).collect();
    (
        [
            (axum::http::header::CONTENT_TYPE, mime.to_string()),
            (axum::http::header::CONTENT_DISPOSITION, format!("{disposition}; filename=\"{safe}\"")),
            (axum::http::header::CACHE_CONTROL, "private, max-age=300".to_string()),
            (axum::http::header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
            (axum::http::header::CONTENT_SECURITY_POLICY, "default-src 'none'".to_string()),
        ],
        bytes,
    )
        .into_response()
}
