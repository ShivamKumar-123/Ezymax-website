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
    NotFound(String),
    /// A client-facing failure with its own machine code and HTTP status.
    Coded { status: StatusCode, code: &'static str, message: String },
    Internal(anyhow::Error),
}

impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError::Internal(e.into())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn validation(field: &'static str, message: impl Into<String>) -> Self {
        ApiError::Validation { field, message: message.into() }
    }
    pub fn conflict(code: &'static str, message: impl Into<String>) -> Self {
        ApiError::Coded { status: StatusCode::CONFLICT, code, message: message.into() }
    }
    pub fn unprocessable(code: &'static str, message: impl Into<String>) -> Self {
        ApiError::Coded { status: StatusCode::UNPROCESSABLE_ENTITY, code, message: message.into() }
    }
    pub fn not_found(what: &str) -> Self {
        ApiError::NotFound(format!("{what} not found"))
    }
    pub fn insufficient() -> Self {
        Self::unprocessable("insufficient_funds", "Insufficient available balance")
    }
    pub fn code(&self) -> &str {
        match self {
            ApiError::BadRequest(_) => "bad_request",
            ApiError::Validation { .. } => "validation",
            ApiError::Unauthorized => "unauthorized",
            ApiError::Forbidden(_) => "forbidden",
            ApiError::NotFound(_) => "not_found",
            ApiError::Coded { code, .. } => code,
            ApiError::Internal(_) => "internal",
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, body) = match self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, json!({"code": "bad_request", "message": m})),
            ApiError::Validation { field, message } => (StatusCode::UNPROCESSABLE_ENTITY, json!({"code": "validation", "field": field, "message": message})),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, json!({"code": "unauthorized", "message": "Staff identity required."})),
            ApiError::Forbidden(m) => (StatusCode::FORBIDDEN, json!({"code": "forbidden", "message": m})),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, json!({"code": "not_found", "message": m})),
            ApiError::Coded { status, code, message } => (status, json!({"code": code, "message": message})),
            ApiError::Internal(e) => {
                tracing::error!(error = ?e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"code": "internal", "message": "Something went wrong. Please try again."}))
            }
        };
        (status, Json(json!({"error": body}))).into_response()
    }
}
