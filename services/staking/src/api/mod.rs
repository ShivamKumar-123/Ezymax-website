//! HTTP API on 127.0.0.1:8105. Every route except `GET /health` needs `X-Ezymex-Internal: $STAKING_INTERNAL_TOKEN`.
//! Client routes take the signed-in gateway user in `X-Ezymex-User-Id` (plus the display name) from the Client Area
//! BFF; admin routes take the staff identity headers the admin BFF verified with the gateway, and the `staking.*`
//! permissions it resolved in `X-Ezymex-Staff-Perms`.

pub mod admin;
pub mod client;

use crate::audit::Actor;
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;
use axum::extract::{FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use serde_json::json;
use subtle::ConstantTimeEq;

pub fn router(st: AppState) -> Router {
    let v1 = Router::new()
        // Client Area
        .route("/v1/staking/me/plans", get(client::plans))
        .route("/v1/staking/me/portfolio", get(client::portfolio))
        .route("/v1/staking/me/history", get(client::history))
        .route("/v1/staking/me/positions", get(client::positions).post(client::subscribe))
        .route("/v1/staking/me/positions/{id}", get(client::position))
        // Back Office
        .route("/v1/staking/admin/overview", get(admin::overview))
        .route("/v1/staking/admin/plans", get(admin::plans).post(admin::create_plan))
        .route("/v1/staking/admin/plans/{id}", patch(admin::patch_plan))
        .route("/v1/staking/admin/rates", get(admin::rates).post(admin::set_rate))
        .route("/v1/staking/admin/settlements/preview", get(admin::preview))
        .route("/v1/staking/admin/settlements", get(admin::settlements).post(admin::create_settlement))
        .route("/v1/staking/admin/settlements/{id}", get(admin::settlement))
        .route("/v1/staking/admin/settlements/{id}/{action}", post(admin::decide))
        .route("/v1/staking/admin/positions", get(admin::positions))
        .route("/v1/staking/admin/positions/export", get(admin::export_positions))
        .route("/v1/staking/admin/positions/{id}", get(admin::position))
        .route("/v1/staking/admin/audit", get(admin::audit))
        .layer(axum::extract::DefaultBodyLimit::max(64 * 1024))
        .layer(middleware::from_fn_with_state(st.clone(), internal_only));
    Router::new()
        .route("/health", get(health))
        .merge(v1)
        .fallback(|| async { (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": {"code": "not_found", "message": "Not found."}}))) })
        .with_state(st)
}

async fn health(State(st): State<AppState>) -> impl IntoResponse {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&st.pool).await.is_ok();
    Json(json!({"status": if db { "ok" } else { "degraded" }, "db": db, "service": "staking"}))
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

fn tenant_of(parts: &Parts) -> ApiResult<String> {
    let t = header(parts, "x-ezymex-tenant").unwrap_or_else(|| "ezymex".into()).to_lowercase();
    if t.len() > 40 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(ApiError::BadRequest("Invalid tenant.".into()));
    }
    Ok(t)
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%'
            && i + 2 < b.len()
            && let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16)
        {
            out.push(v);
            i += 3;
            continue;
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// The signed-in client (Client Area BFF).
pub struct UserCtx {
    pub tenant: String,
    pub user_id: i64,
    pub name: String,
}

impl<S: Send + Sync> FromRequestParts<S> for UserCtx {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let user_id = header(parts, "x-ezymex-user-id").and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0).ok_or(ApiError::Unauthorized)?;
        let name = header(parts, "x-ezymex-name").map(|n| percent_decode(&n).trim().chars().take(120).collect()).unwrap_or_default();
        Ok(UserCtx { tenant: tenant_of(parts)?, user_id, name })
    }
}

/// Back Office staff, as verified by the admin BFF.
pub struct StaffCtx {
    pub tenant: String,
    pub id: String,
    pub name: String,
    pub role: String,
    /// `staking.*` permissions the admin BFF resolved from the gateway RBAC (`X-Ezymex-Staff-Perms`). When present
    /// they decide; the role lists below are the fallback.
    pub perms: Option<Vec<String>>,
}

pub const READ: &str = "staking.read";
pub const WRITE: &str = "staking.write";
pub const APPROVE: &str = "staking.approve";
pub const EXPORT: &str = "staking.export";

/// Fallback role map (the gateway presets: Finance reads and approves; administrators do everything).
fn role_allows(role: &str, perm: &str) -> bool {
    let all = ["platform_owner", "super_admin", "admin"].contains(&role);
    match perm {
        READ => all || ["finance", "risk_manager", "compliance"].contains(&role),
        APPROVE => all || role == "finance",
        _ => all,
    }
}

impl StaffCtx {
    pub fn require(&self, perm: &str) -> ApiResult<()> {
        let ok = match &self.perms {
            Some(p) => p.iter().any(|x| x == perm),
            None => role_allows(&self.role, perm),
        };
        if ok { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this.".into())) }
    }
    pub fn actor(&self) -> Actor {
        Actor { id: format!("staff:{}", self.id), name: Some(self.name.clone()) }
    }
}

impl<S: Send + Sync> FromRequestParts<S> for StaffCtx {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let id = header(parts, "x-ezymex-staff-id").ok_or(ApiError::Unauthorized)?;
        let role = header(parts, "x-ezymex-staff-role").ok_or(ApiError::Unauthorized)?;
        if id.len() > 64 || role.len() > 32 {
            return Err(ApiError::BadRequest("Invalid staff headers.".into()));
        }
        let name = header(parts, "x-ezymex-staff-name").map(|n| percent_decode(&n)).unwrap_or_else(|| format!("Staff {id}"));
        let perms = header(parts, "x-ezymex-staff-perms").map(|p| p.split(',').map(|x| x.trim().to_string()).filter(|x| x.starts_with("staking.")).collect());
        Ok(StaffCtx { tenant: tenant_of(parts)?, id, name: name.chars().take(80).collect(), role, perms })
    }
}

/// `page` / `limit` from a query, clamped.
pub fn paging(page: Option<i64>, limit: Option<i64>, default: i64, max: i64) -> (i64, i64, i64) {
    let limit = limit.unwrap_or(default).clamp(1, max);
    let page = page.unwrap_or(1).max(1);
    (page, limit, (page - 1) * limit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_staff_names() {
        assert_eq!(percent_decode("Julia%20Novak"), "Julia Novak");
        assert_eq!(percent_decode("A%C3%AFda"), "Aïda");
        assert_eq!(percent_decode("50%"), "50%");
    }

    #[test]
    fn role_fallback() {
        assert!(role_allows("finance", APPROVE) && role_allows("finance", READ) && !role_allows("finance", WRITE));
        assert!(role_allows("admin", WRITE) && role_allows("super_admin", EXPORT));
        assert!(!role_allows("support", READ) && !role_allows("marketing", APPROVE));
        let s = StaffCtx { tenant: "ezymex".into(), id: "7".into(), name: "A".into(), role: "admin".into(), perms: Some(vec![READ.into()]) };
        // the resolved permissions decide over the role
        assert!(s.require(READ).is_ok() && s.require(WRITE).is_err());
    }
}
