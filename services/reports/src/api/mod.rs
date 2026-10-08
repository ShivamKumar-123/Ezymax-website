//! HTTP API. Every route except `GET /health` needs `X-Ezymex-Internal: $REPORTS_INTERNAL_TOKEN`.
//! Client routes need `X-Ezymex-User-Id` (set by the Client Area BFF from the session); staff routes need the staff
//! identity headers plus `X-Ezymex-Staff-Perms` (the caller's `reports.*` permissions from the gateway session).

use axum::Router;
use axum::body::Body;
use axum::extract::{FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::http::{HeaderMap, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use subtle::ConstantTimeEq;

use crate::db::Actor;
use crate::error::{ApiError, ApiResult};
use crate::state::App;
use crate::time;

pub mod admin;
pub mod client;

pub fn router(app: App) -> Router {
    let v1 = Router::new()
        .route("/v1/me/analytics", get(client::analytics))
        .route("/v1/me/accounts/{login}/months", get(client::months))
        .route("/v1/me/accounts/{login}/statement", get(client::statement))
        .route("/v1/me/accounts/{login}/history.zip", get(client::history_zip))
        .route("/v1/internal/accounts/{login}/final-statement", post(client::final_statement))
        .route("/v1/admin/status", get(admin::status))
        .route("/v1/admin/pnl", get(admin::pnl))
        .route("/v1/admin/deposits", get(admin::deposits))
        .route("/v1/admin/funnel", get(admin::funnel))
        .route("/v1/admin/campaigns", get(admin::campaigns))
        .route("/v1/internal/client-facts", get(admin::client_facts))
        .route("/v1/admin/cohorts", get(admin::cohorts))
        .route("/v1/admin/activity", get(admin::activity))
        .route("/v1/admin/partners", get(admin::partners))
        .route("/v1/admin/export/{report}", get(admin::export))
        .route("/v1/admin/accounts/{login}/statement", get(admin::statement))
        .route("/v1/admin/accounts/{login}/analytics", get(admin::account_analytics))
        .route("/v1/admin/schedules", get(admin::schedules).post(admin::create_schedule))
        .route("/v1/admin/schedules/{id}", put(admin::update_schedule).delete(admin::delete_schedule))
        .route("/v1/admin/schedules/{id}/run", post(admin::run_schedule))
        .route("/v1/admin/sync", post(admin::sync_now))
        .route("/v1/admin/audit", get(admin::audit))
        .layer(middleware::from_fn_with_state(app.clone(), internal_only));
    Router::new()
        .route("/health", get(health))
        .merge(v1)
        .fallback(|| async { ApiError::NotFound("Not found.".into()) })
        .with_state(app)
}

async fn health(State(app): State<App>) -> impl IntoResponse {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&app.pool).await.is_ok();
    axum::Json(serde_json::json!({"status": if db { "ok" } else { "degraded" }, "db": db, "service": "reports"}))
}

async fn internal_only(State(app): State<App>, req: Request, next: Next) -> Response {
    let expected = app.cfg.internal_token.as_bytes();
    if !expected.is_empty() {
        let got = req.headers().get("x-ezymex-internal").map(|v| v.as_bytes()).unwrap_or_default();
        if got.len() != expected.len() || !bool::from(got.ct_eq(expected)) {
            return ApiError::Forbidden("Missing or invalid internal token.".into()).into_response();
        }
    }
    next.run(req).await
}

fn header(h: &HeaderMap, k: &str) -> Option<String> {
    h.get(k).and_then(|v| v.to_str().ok()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Tenant slug from `X-Ezymex-Tenant` (default ezymex); must be a mirrored tenant.
pub struct Tenant(pub String);

impl FromRequestParts<App> for Tenant {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, app: &App) -> Result<Self, ApiError> {
        let t = header(&parts.headers, "x-ezymex-tenant").unwrap_or_else(|| "ezymex".into());
        if !app.cfg.tenants.contains(&t) {
            return Err(ApiError::NotFound("Unknown tenant.".into()));
        }
        Ok(Tenant(t))
    }
}

pub struct UserCtx {
    pub tenant: String,
    pub user_id: i64,
}

impl FromRequestParts<App> for UserCtx {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, app: &App) -> Result<Self, ApiError> {
        let Tenant(tenant) = Tenant::from_request_parts(parts, app).await?;
        let user_id = header(&parts.headers, "x-ezymex-user-id").and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0).ok_or(ApiError::Unauthorized)?;
        Ok(UserCtx { tenant, user_id })
    }
}

pub struct StaffCtx {
    pub tenant: String,
    pub actor: Actor,
    pub perms: Vec<String>,
}

impl StaffCtx {
    pub fn require(&self, perm: &str) -> ApiResult<()> {
        if self.perms.iter().any(|p| p == perm) { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this.".into())) }
    }
}

impl FromRequestParts<App> for StaffCtx {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, app: &App) -> Result<Self, ApiError> {
        let Tenant(tenant) = Tenant::from_request_parts(parts, app).await?;
        let id = header(&parts.headers, "x-ezymex-staff-id").ok_or(ApiError::Unauthorized)?;
        let role = header(&parts.headers, "x-ezymex-staff-role").ok_or(ApiError::Unauthorized)?;
        if id.len() > 64 || role.len() > 32 {
            return Err(ApiError::BadRequest("Invalid staff headers.".into()));
        }
        let name = header(&parts.headers, "x-ezymex-staff-name").map(|n| percent_decode(&n)).unwrap_or_else(|| format!("Staff {id}"));
        let perms = header(&parts.headers, "x-ezymex-staff-perms").map(|p| p.split(',').map(|x| x.trim().to_string()).filter(|x| x.starts_with("reports.") || x == "marketing.read").collect()).unwrap_or_default();
        Ok(StaffCtx { tenant, actor: Actor { id: format!("staff:{id}"), name: name.chars().take(120).collect(), role }, perms })
    }
}

#[derive(Deserialize, Default)]
pub struct RangeQ {
    pub from: Option<String>,
    pub to: Option<String>,
    pub login: Option<String>,
    pub format: Option<String>,
    pub months: Option<i32>,
    pub open: Option<String>,
    pub charges: Option<String>,
    pub deals: Option<String>,
    pub large: Option<f64>,
    pub limit: Option<i64>,
}

/// `from` / `to` (YYYY-MM-DD = start of that server day, or RFC 3339); `to` is exclusive. Default: last 30 days.
pub fn range(q: &RangeQ, default_days: i64) -> ApiResult<(DateTime<Utc>, DateTime<Utc>)> {
    let parse = |v: &Option<String>, field: &'static str| -> ApiResult<Option<DateTime<Utc>>> {
        match v.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            None => Ok(None),
            Some(s) => time::parse_time(s).map(Some).ok_or(ApiError::Validation { field, message: format!("Invalid {field} date.") }),
        }
    };
    let to = parse(&q.to, "to")?.unwrap_or_else(Utc::now);
    let from = parse(&q.from, "from")?.unwrap_or(to - Duration::days(default_days));
    if from >= to {
        return Err(ApiError::Validation { field: "from", message: "The start must be before the end.".into() });
    }
    if to - from > Duration::days(3700) {
        return Err(ApiError::Validation { field: "from", message: "The period is limited to 10 years.".into() });
    }
    Ok((from, to))
}

pub fn file(bytes: Vec<u8>, content_type: &str, name: &str) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{name}\""))
        .header(header::CACHE_CONTROL, "no-store")
        .header("x-content-type-options", "nosniff")
        .body(Body::from(bytes))
        .unwrap()
}

pub fn flag(v: &Option<String>) -> bool {
    !matches!(v.as_deref(), Some("0") | Some("false") | Some("no"))
}
