use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// API error, serialised as `{"error": {"code", "message", "field"?}}`.
#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Validation { field: &'static str, message: String },
    Unauthorized,
    Forbidden(String),
    NotFound,
    Conflict { code: &'static str, message: String },
    TooLarge(String),
    Unsupported(String),
    RateLimited(String),
    Unavailable(String),
    Internal(anyhow::Error),
}

impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError::Internal(e.into())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

pub fn invalid(field: &'static str, message: impl Into<String>) -> ApiError {
    ApiError::Validation { field, message: message.into() }
}

pub fn conflict(code: &'static str, message: impl Into<String>) -> ApiError {
    ApiError::Conflict { code, message: message.into() }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, body) = match self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, json!({"code": "bad_request", "message": m})),
            ApiError::Validation { field, message } => (StatusCode::UNPROCESSABLE_ENTITY, json!({"code": "validation", "field": field, "message": message})),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, json!({"code": "unauthorized", "message": "Missing caller identity."})),
            ApiError::Forbidden(m) => (StatusCode::FORBIDDEN, json!({"code": "forbidden", "message": m})),
            ApiError::NotFound => (StatusCode::NOT_FOUND, json!({"code": "not_found", "message": "Not found."})),
            ApiError::Conflict { code, message } => (StatusCode::CONFLICT, json!({"code": code, "message": message})),
            ApiError::TooLarge(m) => (StatusCode::PAYLOAD_TOO_LARGE, json!({"code": "too_large", "message": m})),
            ApiError::Unsupported(m) => (StatusCode::UNSUPPORTED_MEDIA_TYPE, json!({"code": "unsupported_type", "message": m})),
            ApiError::RateLimited(m) => (StatusCode::TOO_MANY_REQUESTS, json!({"code": "rate_limited", "message": m})),
            ApiError::Unavailable(m) => (StatusCode::SERVICE_UNAVAILABLE, json!({"code": "unavailable", "message": m})),
            ApiError::Internal(e) => {
                tracing::error!(error = ?e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"code": "internal", "message": "Something went wrong. Please try again."}))
            }
        };
        (status, Json(json!({ "error": body }))).into_response()
    }
}
