//! HTTP API. Internal routes (`/v1/*`) need `X-Ezymex-Internal` and are called by the CRM / Back Office
//! BFFs; public routes (`/hooks/*`, `/public/v1/*`) authenticate with a webhook token or an API key.

pub mod admin;
pub mod backtests;
pub mod deployments;
pub mod house;
pub mod keys;
pub mod market;
pub mod public;
pub mod strategies;
pub mod webhooks;

use axum::body::Bytes;
use axum::extract::{FromRequest, Request, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post, put};
use axum::{Json, Router};
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use crate::error::ApiError;
use crate::security::ct_eq;
use crate::state::AppState;

/// JSON body with our error shape on malformed input (max 256 KB).
pub struct Body<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for Body<T> {
    type Rejection = ApiError;
    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let bytes = Bytes::from_request(req, state).await.map_err(|_| ApiError::BadRequest("Could not read the request body.".into()))?;
        if bytes.len() > 256 * 1024 {
            return Err(ApiError::coded(StatusCode::PAYLOAD_TOO_LARGE, "too_large", "Request body is too large."));
        }
        let b: &[u8] = if bytes.is_empty() { b"{}" } else { &bytes };
        serde_json::from_slice(b).map(Body).map_err(|e| ApiError::BadRequest(format!("Invalid JSON: {e}")))
    }
}

pub fn s<'a>(v: &'a Value, k: &str) -> Option<&'a str> {
    v.get(k).and_then(Value::as_str).map(str::trim).filter(|x| !x.is_empty())
}
pub fn f(v: &Value, k: &str) -> Option<f64> {
    match v.get(k) {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(t)) => t.trim().parse().ok(),
        _ => None,
    }
    .filter(|x: &f64| x.is_finite())
}
pub fn i(v: &Value, k: &str) -> Option<i64> {
    match v.get(k) {
        Some(Value::Number(n)) => n.as_i64().or_else(|| n.as_f64().filter(|x| x.fract() == 0.0).map(|x| x as i64)),
        Some(Value::String(t)) => t.trim().parse().ok(),
        _ => None,
    }
}
pub fn b(v: &Value, k: &str) -> Option<bool> {
    v.get(k).and_then(Value::as_bool)
}

pub type Res = Result<Json<Value>, ApiError>;

/// The TCP peer address when the server runs with connect info (absent in unit tests).
pub struct Peer(pub Option<std::net::SocketAddr>);

impl<S: Send + Sync> axum::extract::FromRequestParts<S> for Peer {
    type Rejection = std::convert::Infallible;
    async fn from_request_parts(parts: &mut axum::http::request::Parts, _: &S) -> Result<Self, Self::Rejection> {
        Ok(Peer(parts.extensions.get::<axum::extract::ConnectInfo<std::net::SocketAddr>>().map(|c| c.0)))
    }
}

async fn internal_only(State(st): State<AppState>, req: Request, next: Next) -> Response {
    let token = &st.cfg.internal_token;
    if !token.is_empty() {
        let got = req.headers().get("x-ezymex-internal").and_then(|v| v.to_str().ok()).unwrap_or("");
        if !ct_eq(got, token) {
            return ApiError::Forbidden("Internal token required.".into()).into_response();
        }
    }
    next.run(req).await
}

async fn health(State(st): State<AppState>) -> Json<Value> {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&st.pool).await.is_ok();
    let running: i64 = sqlx::query_scalar("SELECT count(*) FROM deployments WHERE status = 'running'").fetch_one(&st.pool).await.unwrap_or(0);
    let queued: i64 = sqlx::query_scalar("SELECT count(*) FROM backtests WHERE status IN ('queued','running')").fetch_one(&st.pool).await.unwrap_or(0);
    Json(json!({"service": "algo", "status": if db { "ok" } else { "degraded" }, "db": db, "deploymentsRunning": running, "backtestsQueued": queued, "ai": !st.cfg.anthropic_key.is_empty()}))
}

pub fn router(st: AppState) -> Router {
    let internal = Router::new()
        .route("/v1/meta", get(strategies::meta))
        .route("/v1/validate", post(strategies::validate))
        .route("/v1/ai/strategy", post(strategies::ai))
        .route("/v1/strategies", get(strategies::list).post(strategies::create))
        .route("/v1/strategies/{id}", get(strategies::detail).patch(strategies::update))
        .route("/v1/strategies/{id}/versions", post(strategies::new_version))
        .route("/v1/strategies/{id}/versions/{vid}", get(strategies::version))
        .route("/v1/backtests", get(backtests::list).post(backtests::create))
        .route("/v1/backtests/{id}", get(backtests::detail))
        .route("/v1/backtests/{id}/cancel", post(backtests::cancel))
        .route("/v1/accounts", get(deployments::accounts))
        .route("/v1/deployments", get(deployments::list).post(deployments::create))
        .route("/v1/deployments/{id}", get(deployments::detail))
        .route("/v1/deployments/{id}/{action}", post(deployments::action))
        .route("/v1/controls", get(deployments::controls))
        .route("/v1/controls/kill", post(deployments::kill_all))
        .route("/v1/webhooks", get(webhooks::list).post(webhooks::create))
        .route("/v1/webhooks/{id}", get(webhooks::detail).patch(webhooks::update).delete(webhooks::remove))
        .route("/v1/webhooks/{id}/rotate", post(webhooks::rotate))
        .route("/v1/webhooks/{id}/routes", put(webhooks::set_routes))
        .route("/v1/webhooks/{id}/test", post(webhooks::test))
        .route("/v1/keys", get(keys::list).post(keys::create))
        .route("/v1/keys/{id}", patch(keys::update))
        .route("/v1/keys/{id}/revoke", post(keys::revoke))
        .route("/v1/keys/{id}/activity", get(keys::activity))
        .route("/v1/market/listings", get(market::browse).post(market::publish))
        .route("/v1/market/listings/{id}", get(market::listing).patch(market::edit))
        .route("/v1/market/listings/{id}/subscribe", post(market::subscribe))
        .route("/v1/market/listings/{id}/reviews", post(market::review))
        .route("/v1/market/mine", get(market::mine))
        .route("/v1/market/subscriptions", get(market::subscriptions))
        .route("/v1/market/subscriptions/{id}/cancel", post(market::cancel))
        .route("/v1/admin/overview", get(admin::overview))
        .route("/v1/admin/strategies", get(admin::strategies))
        .route("/v1/admin/deployments", get(admin::deployments))
        .route("/v1/admin/deployments/{id}/kill", post(admin::kill_deployment))
        .route("/v1/admin/users/{id}/kill", post(admin::kill_user))
        .route("/v1/admin/settings", get(admin::get_settings).put(admin::put_settings))
        .route("/v1/admin/listings", get(admin::listings))
        .route("/v1/admin/listings/{id}/moderate", post(admin::moderate))
        .route("/v1/admin/keys", get(admin::keys))
        .route("/v1/admin/keys/{id}/revoke", post(admin::revoke_key))
        .route("/v1/admin/webhooks", get(admin::webhook_events))
        .route("/v1/admin/subscriptions", get(admin::subscriptions))
        .route("/v1/admin/audit", get(admin::audit))
        .route("/v1/admin/house", get(house::list).post(house::provision))
        .route("/v1/admin/house/seed", post(house::seed))
        .route("/v1/admin/house/settings", put(house::put_settings))
        .route("/v1/admin/house/{id}", get(house::detail))
        .route("/v1/admin/house/{id}/retry", post(house::retry))
        .route("/v1/admin/house/{id}/switch", post(house::switch))
        .route("/v1/admin/house/{id}/visibility", post(house::visibility))
        .route("/v1/admin/house/{id}/capital", post(house::top_up))
        .route("/v1/admin/house/{id}/delete", post(house::remove))
        .layer(middleware::from_fn_with_state(st.clone(), internal_only));
    let public = Router::new()
        .route("/hooks/{token}", post(webhooks::receive))
        .route("/public/v1/account", get(public::account))
        .route("/public/v1/positions", get(public::positions))
        .route("/public/v1/orders", get(public::orders).post(public::place))
        .route("/public/v1/orders/{ticket}", axum::routing::delete(public::cancel_order))
        .route("/public/v1/positions/{ticket}", patch(public::modify_position))
        .route("/public/v1/positions/{ticket}/close", post(public::close_position))
        .route("/public/v1/history", get(public::history))
        .route("/public/v1/quotes", get(public::quotes))
        .route("/public/v1/openapi.json", get(public::openapi));
    Router::new().route("/health", get(health)).merge(internal).merge(public).with_state(st)
}
