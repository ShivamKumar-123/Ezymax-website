//! HTTP + WebSocket API. Full contract in services/options/README.md.
//!
//! * `/health`: no auth.
//! * `/v1/public/options/chain/{u}`: no auth, exposed on api.* by Caddy; only when tenant `kalks` has
//!   `public_chain` on; cached 1 s.
//! * `WS /v1/options/stream`: browsers via trade.* `/options/stream`; `?ticket=` from
//!   `POST /v1/options/stream/ticket` (BFF) for a tenant + group, else the guest view (needs `public_chain`).
//! * Everything else needs `X-Kalks-Internal`. `X-Kalks-Tenant` picks the broker (default `kalks`).
//!   Client routes answer 404 `options_disabled` when the tenant has the module off (`X-Kalks-Account-Kind:
//!   demo|live` checks that specific switch). Admin routes also need `X-Kalks-Staff`; platform-wide data
//!   (underlyings, rates, holidays, surfaces, fixings, module switches) only from tenant `kalks`.

pub mod admin;
pub mod internal;
pub mod public;
pub mod stream;

use axum::extract::{Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde_json::{Value, json};
use subtle::ConstantTimeEq;

use crate::AppState;
use crate::model::{PLATFORM_TENANT, RefData, TenantSettings};

pub struct ApiError(pub StatusCode, pub &'static str, pub String);

impl ApiError {
    pub fn new(s: StatusCode, code: &'static str, msg: impl Into<String>) -> Self {
        Self(s, code, msg.into())
    }
    pub fn not_found(what: &str) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", format!("{what} not found."))
    }
    pub fn bad(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::UNPROCESSABLE_ENTITY, "validation", msg)
    }
    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "forbidden", msg)
    }
    pub fn disabled() -> Self {
        Self::new(StatusCode::NOT_FOUND, "options_disabled", "Options are not available for this broker.")
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        tracing::error!(error = %e, "options internal error");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal", "Something went wrong. Please try again.")
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        anyhow::Error::from(e).into()
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": {"code": self.1, "message": self.2}}))).into_response()
    }
}

pub type R<T = Json<Value>> = Result<T, ApiError>;

pub fn is_slug(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

pub fn tenant(h: &HeaderMap) -> String {
    let t = h.get("x-kalks-tenant").and_then(|v| v.to_str().ok()).unwrap_or(PLATFORM_TENANT).trim().to_ascii_lowercase();
    if is_slug(&t) { t } else { PLATFORM_TENANT.into() }
}

pub fn staff(h: &HeaderMap) -> R<String> {
    h.get("x-kalks-staff")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().chars().take(120).collect::<String>())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "unauthorized", "Missing staff member."))
}

/// The tenant's settings, or 404 when the module is off (for the given account kind, if any).
pub fn enabled_tenant(rd: &RefData, h: &HeaderMap) -> R<TenantSettings> {
    let t = rd.tenant(&tenant(h));
    let kind = h.get("x-kalks-account-kind").and_then(|v| v.to_str().ok()).map(|s| s.trim().to_ascii_lowercase());
    let on = match kind.as_deref() {
        Some("demo") => t.enabled_demo,
        Some("live") => t.enabled_live,
        _ => t.any_enabled(),
    };
    if on { Ok(t) } else { Err(ApiError::disabled()) }
}

async fn require_internal(State(st): State<AppState>, req: Request, next: Next) -> Response {
    if !st.cfg.internal_token.is_empty() {
        let got = req.headers().get("x-kalks-internal").map(|v| v.as_bytes()).unwrap_or(b"");
        if !bool::from(got.ct_eq(st.cfg.internal_token.as_bytes())) {
            return ApiError::new(StatusCode::UNAUTHORIZED, "unauthorized", "Internal token required.").into_response();
        }
    }
    next.run(req).await
}

pub fn router(st: AppState) -> Router {
    let internal = Router::new()
        // client (BFF) reads
        .route("/v1/options/underlyings", get(public::underlyings))
        .route("/v1/options/expiries", get(public::expiries))
        .route("/v1/options/chain", get(public::chain))
        .route("/v1/options/series/{code}", get(public::series))
        .route("/v1/options/smile", get(public::smile))
        .route("/v1/options/stream/ticket", post(stream::ticket))
        // engine
        .route("/v1/internal/options/snapshot", get(internal::snapshot))
        .route("/v1/internal/options/fixings", get(internal::fixings))
        .route("/v1/internal/options/status", get(internal::status))
        // Back Office
        .route("/v1/admin/options/overview", get(admin::overview))
        .route("/v1/admin/options/underlyings", get(admin::underlyings))
        .route("/v1/admin/options/underlyings/{symbol}", put(admin::underlying_put))
        .route("/v1/admin/options/rates", get(admin::rates))
        .route("/v1/admin/options/rates/{ccy}", put(admin::rate_put))
        .route("/v1/admin/options/rates/{ccy}/history", get(admin::rate_history))
        .route("/v1/admin/options/holidays", get(admin::holidays))
        .route("/v1/admin/options/holidays/{calendar}/{day}", put(admin::holiday_put).delete(admin::holiday_delete))
        .route("/v1/admin/options/surfaces/{symbol}", get(admin::surface_get).post(admin::surface_publish))
        .route("/v1/admin/options/surfaces/{symbol}/{version}", get(admin::surface_version))
        .route("/v1/admin/options/tenants", get(admin::tenants))
        .route("/v1/admin/options/tenants/{tenant}", put(admin::tenant_put))
        .route("/v1/admin/options/groups", get(admin::groups))
        .route("/v1/admin/options/groups/{group}/{symbol}", put(admin::group_put).delete(admin::group_delete))
        .route("/v1/admin/options/controls", get(admin::controls).post(admin::control_add))
        .route("/v1/admin/options/controls/{id}", delete(admin::control_clear))
        .route("/v1/admin/options/limits", get(admin::limits))
        .route("/v1/admin/options/limits/{user}", put(admin::limit_put).delete(admin::limit_delete))
        .route("/v1/admin/options/expiries", get(admin::expiries))
        .route("/v1/admin/options/expiries/{id}/refix", post(admin::refix))
        .route("/v1/admin/options/listing/run", post(admin::listing_run))
        .route("/v1/admin/options/audit", get(admin::audit))
        .layer(middleware::from_fn_with_state(st.clone(), require_internal));
    Router::new()
        .route("/health", get(health))
        .route("/v1/public/options/chain/{u}", get(public::public_chain))
        .route("/v1/options/stream", get(stream::ws))
        .merge(internal)
        .with_state(st)
}

async fn health(State(st): State<AppState>) -> Json<Value> {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&st.pool).await.is_ok();
    let rd = st.refdata().await;
    Json(json!({
        "service": "options",
        "status": if db { "ok" } else { "degraded" },
        "db": db,
        "version": rd.version,
        "feed": st.spots.connected(),
        "workers": st.cfg.workers,
    }))
}
