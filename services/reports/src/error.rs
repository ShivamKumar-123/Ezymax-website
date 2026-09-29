//! API errors: `{"error": {"code", "message", "field"?}}`, same envelope as the trading engine.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Validation { field: &'static str, message: String },
    Unauthorized,
    Forbidden(String),
    NotFound(String),
    Conflict { code: &'static str, message: String },
    /// A business rule refused the request (422 with a specific code).
    Rule { code: &'static str, message: String },
    /// An upstream service (engine, wallet) is unavailable or answered unexpectedly.
    Upstream { code: String, message: String },
    Internal(anyhow::Error),
}

impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError::Internal(e.into())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn rule(code: &'static str, message: impl Into<String>) -> Self {
        ApiError::Rule { code, message: message.into() }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, body) = match self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, json!({"code": "bad_request", "message": m})),
            ApiError::Validation { field, message } => (StatusCode::UNPROCESSABLE_ENTITY, json!({"code": "validation", "field": field, "message": message})),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, json!({"code": "unauthorized", "message": "Missing or invalid credentials."})),
            ApiError::Forbidden(m) => (StatusCode::FORBIDDEN, json!({"code": "forbidden", "message": m})),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, json!({"code": "not_found", "message": m})),
            ApiError::Conflict { code, message } => (StatusCode::CONFLICT, json!({"code": code, "message": message})),
            ApiError::Rule { code, message } => (StatusCode::UNPROCESSABLE_ENTITY, json!({"code": code, "message": message})),
            ApiError::Upstream { code, message } => (StatusCode::BAD_GATEWAY, json!({"code": code, "message": message})),
            ApiError::Internal(e) => {
                tracing::error!(error = ?e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"code": "internal", "message": "Something went wrong. Please try again."}))
            }
        };
        (status, [("cache-control", "no-store")], axum::Json(json!({"error": body}))).into_response()
    }
}
