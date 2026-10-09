//! HTTP API (axum, 127.0.0.1:8095). Every route except `/health` requires `X-Ezymex-Internal`.

pub mod adjust;
pub mod admin;
pub mod client;
pub mod manual;

use axum::Json;
use axum::Router;
use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use serde_json::{Value, json};
use subtle::ConstantTimeEq;

use crate::error::ApiError;
use crate::state::AppState;

pub fn router(st: AppState) -> Router {
    // QR codes and payment screenshots: 5 MB images (the store checks the exact limit and sniffs the type)
    let media_limit = DefaultBodyLimit::max(st.cfg.max_media_bytes + 64 * 1024);
    let internal = Router::new()
        // contract for other services + CRM
        .route("/v1/config", get(client::config))
        .route("/v1/wallets/transfers", post(client::transfer))
        .route("/v1/wallets/transfers/{key}", get(client::transfer_lookup))
        .route("/v1/wallets/{user_id}", get(client::wallet))
        .route("/v1/wallets/{user_id}/ledger", get(client::ledger))
        .route("/v1/wallets/{user_id}/overview", get(client::overview))
        .route("/v1/wallets/{user_id}/activity", get(client::activity))
        .route("/v1/wallets/{user_id}/notifications", get(client::notifications))
        .route("/v1/wallets/{user_id}/notifications/read", post(client::notifications_read))
        .route("/v1/wallets/{user_id}/to-trading", post(client::to_trading))
        .route("/v1/wallets/{user_id}/from-trading", post(client::from_trading))
        .route("/v1/wallets/{user_id}/trading-transfers", get(client::trading_transfers))
        .route("/v1/wallets/{user_id}/trading-to-trading", post(client::trading_to_trading))
        .route("/v1/internal/trading/{login}/pending", get(client::trading_pending).post(client::trading_pending))
        .route("/v1/deposits/intents", post(client::create_intent))
        .route("/v1/deposits/intents/{id}", get(client::get_intent))
        .route("/v1/deposits/submit", post(client::submit_deposit))
        .route("/v1/deposits", get(client::list_deposits))
        .route("/v1/deposits/{id}", get(client::get_deposit))
        .route("/v1/withdrawals", post(client::request_withdrawal).get(client::list_withdrawals))
        .route("/v1/withdrawals/quote", post(client::quote_withdrawal))
        .route("/v1/withdrawals/{id}", get(client::get_withdrawal))
        .route("/v1/withdrawals/{id}/cancel", post(client::cancel_withdrawal))
        // manual payments (bank / UPI / any-network crypto, approved by staff)
        .route("/v1/manual/methods", get(manual::methods))
        .route("/v1/manual/proofs", post(manual::upload_proof).layer(media_limit.clone()))
        .route("/v1/manual/deposits", post(manual::create_deposit).get(manual::list_deposits))
        .route("/v1/manual/deposits/{id}", get(manual::get_deposit))
        .route("/v1/manual/deposits/{id}/cancel", post(manual::cancel_deposit))
        .route("/v1/manual/media/{id}", get(manual::client_media))
        // Back Office
        .route("/v1/admin/summary", get(admin::summary))
        .route("/v1/admin/deposits", get(admin::deposits))
        .route("/v1/admin/deposits/{id}", get(admin::deposit))
        .route("/v1/admin/deposits/{id}/assign", post(admin::assign_deposit))
        .route("/v1/admin/deposits/{id}/reject", post(admin::reject_deposit))
        .route("/v1/admin/deposits/{id}/recheck", post(admin::recheck_deposit))
        .route("/v1/admin/withdrawals", get(admin::withdrawals))
        .route("/v1/admin/withdrawals/{id}", get(admin::withdrawal))
        .route("/v1/admin/withdrawals/{id}/approve", post(admin::approve_withdrawal))
        .route("/v1/admin/withdrawals/{id}/reject", post(admin::reject_withdrawal))
        .route("/v1/admin/withdrawals/{id}/paid", post(admin::paid_withdrawal))
        .route("/v1/admin/wallets", get(admin::wallets))
        .route("/v1/admin/wallets/{user_id}", get(admin::wallet))
        .route("/v1/admin/adjustments", post(adjust::create).get(adjust::list))
        .route("/v1/admin/adjustments/preview", post(adjust::preview))
        .route("/v1/admin/adjustments/settings", get(adjust::get_settings).put(adjust::put_settings))
        .route("/v1/admin/adjustments/targets/{user_id}", get(adjust::targets))
        .route("/v1/admin/adjustments/{id}", get(adjust::get))
        .route("/v1/admin/adjustments/{id}/approve", post(adjust::approve))
        .route("/v1/admin/adjustments/{id}/reject", post(adjust::reject))
        .route("/v1/admin/adjustments/{id}/cancel", post(adjust::cancel))
        .route("/v1/admin/settings", get(admin::settings).put(admin::update_settings))
        .route("/v1/admin/reconciliation", get(admin::reconciliation))
        .route("/v1/admin/audit", get(admin::audit))
        .route("/v1/admin/manual/methods", get(manual::admin_methods).post(manual::create_method))
        .route("/v1/admin/manual/methods/{id}", put(manual::update_method))
        .route("/v1/admin/manual/methods/{id}/delete", post(manual::delete_method))
        .route("/v1/admin/manual/media", post(manual::upload_qr).layer(media_limit))
        .route("/v1/admin/manual/media/{id}", get(manual::admin_media))
        .route("/v1/admin/manual/deposits", get(manual::admin_deposits))
        .route("/v1/admin/manual/deposits/export", get(manual::export))
        .route("/v1/admin/manual/deposits/{id}", get(manual::admin_deposit))
        .route("/v1/admin/manual/deposits/{id}/approve", post(manual::approve))
        .route("/v1/admin/manual/deposits/{id}/reject", post(manual::reject))
        .layer(DefaultBodyLimit::max(64 * 1024))
        .layer(middleware::from_fn_with_state(st.clone(), internal_only));
    Router::new()
        .route("/health", get(health))
        .merge(internal)
        .fallback(|| async { (StatusCode::NOT_FOUND, Json(json!({"error": {"code": "not_found", "message": "Not found."}}))) })
        .with_state(st)
}

async fn internal_only(State(st): State<AppState>, req: Request, next: Next) -> Response {
    let expected = st.cfg.internal_token.as_bytes();
    if !expected.is_empty() {
        let got = req.headers().get("x-ezymex-internal").map(|v| v.as_bytes()).unwrap_or_default();
        if !(got.len() == expected.len() && bool::from(got.ct_eq(expected))) {
            return ApiError::Forbidden("Not allowed.".into()).into_response();
        }
    }
    next.run(req).await
}

async fn health(State(st): State<AppState>) -> impl IntoResponse {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&st.pool).await.is_ok();
    let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM trading_transfers WHERE status = 'pending'").fetch_one(&st.pool).await.unwrap_or(-1);
    let chains: Vec<&str> = st.chains.keys().map(|c| c.as_str()).collect();
    Json(json!({"status": if db { "ok" } else { "degraded" }, "service": "wallet", "db": db, "chains": chains, "workers": st.cfg.workers, "pending_trading_transfers": pending}))
}

/// JSON body with our error format on parse failures.
pub struct Body<T>(pub T);

impl<S: Send + Sync, T: serde::de::DeserializeOwned> axum::extract::FromRequest<S> for Body<T> {
    type Rejection = ApiError;
    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(v)) => Ok(Body(v)),
            Err(e) => Err(ApiError::BadRequest(e.body_text())),
        }
    }
}

/// Query string with our error format.
pub struct Q<T>(pub T);

impl<S: Send + Sync, T: serde::de::DeserializeOwned> axum::extract::FromRequestParts<S> for Q<T> {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut axum::http::request::Parts, state: &S) -> Result<Self, Self::Rejection> {
        match axum::extract::Query::<T>::from_request_parts(parts, state).await {
            Ok(axum::extract::Query(v)) => Ok(Q(v)),
            Err(e) => Err(ApiError::BadRequest(e.body_text())),
        }
    }
}

/// (page, limit, offset), clamped.
pub fn paging(page: Option<i64>, limit: Option<i64>, default: i64, max: i64) -> (i64, i64, i64) {
    let limit = limit.unwrap_or(default).clamp(1, max);
    let page = page.unwrap_or(1).clamp(1, 100_000);
    (page, limit, (page - 1) * limit)
}

pub fn ok(v: Value) -> Json<Value> {
    Json(v)
}
