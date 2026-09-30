use axum::Json;
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{Value, json};

/// API error, serialised as `{"error": {"code", "message", "field"?}}` (same shape as the other services).
#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Validation { field: &'static str, message: String },
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    RateLimited(u64),
    /// A client-facing failure with its own machine code and HTTP status (and optional details).
    Coded { status: StatusCode, code: &'static str, message: String, details: Option<Value> },
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
    pub fn coded(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        ApiError::Coded { status, code, message: message.into(), details: None }
    }
    pub fn conflict(code: &'static str, message: impl Into<String>) -> Self {
        Self::coded(StatusCode::CONFLICT, code, message)
    }
    pub fn unprocessable(code: &'static str, message: impl Into<String>) -> Self {
        Self::coded(StatusCode::UNPROCESSABLE_ENTITY, code, message)
    }
    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::coded(StatusCode::SERVICE_UNAVAILABLE, "unavailable", message)
    }
    pub fn not_found(what: &str) -> Self {
        ApiError::NotFound(format!("{what} not found"))
    }
    pub fn with_details(self, d: Value) -> Self {
        match self {
            ApiError::Coded { status, code, message, .. } => ApiError::Coded { status, code, message, details: Some(d) },
            other => other,
        }
    }
    /// The client-facing message (what the response body says).
    pub fn message(&self) -> String {
        match self {
            ApiError::BadRequest(m) | ApiError::Unauthorized(m) | ApiError::Forbidden(m) | ApiError::NotFound(m) => m.clone(),
            ApiError::Validation { message, .. } | ApiError::Coded { message, .. } => message.clone(),
            ApiError::RateLimited(_) => "Too many requests. Slow down and retry shortly.".into(),
            ApiError::Internal(_) => "Something went wrong. Please try again.".into(),
        }
    }
    /// The machine code of a `Coded` error.
    pub fn code(&self) -> Option<&'static str> {
        match self {
            ApiError::Coded { code, .. } => Some(code),
            _ => None,
        }
    }
    pub fn status(&self) -> StatusCode {
        match self {
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::Validation { .. } => StatusCode::UNPROCESSABLE_ENTITY,
            ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::Forbidden(_) => StatusCode::FORBIDDEN,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::RateLimited(_) => StatusCode::TOO_MANY_REQUESTS,
            ApiError::Coded { status, .. } => *status,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let mut retry = None;
        let body = match self {
            ApiError::BadRequest(m) => json!({"code": "bad_request", "message": m}),
            ApiError::Validation { field, message } => json!({"code": "validation", "field": field, "message": message}),
            ApiError::Unauthorized(m) => json!({"code": "unauthorized", "message": m}),
            ApiError::Forbidden(m) => json!({"code": "forbidden", "message": m}),
            ApiError::NotFound(m) => json!({"code": "not_found", "message": m}),
            ApiError::RateLimited(s) => {
                retry = Some(s);
                json!({"code": "rate_limited", "message": "Too many requests. Slow down and retry shortly.", "retryAfter": s})
            }
            ApiError::Coded { code, message, details, .. } => {
                let mut v = json!({"code": code, "message": message});
                if let Some(Value::Object(d)) = details {
                    for (k, x) in d {
                        v[k] = x;
                    }
                }
                v
            }
            ApiError::Internal(e) => {
                tracing::error!(error = ?e, "internal error");
                json!({"code": "internal", "message": "Something went wrong. Please try again."})
            }
        };
        let mut r = (status, Json(json!({"error": body}))).into_response();
        if let Some(s) = retry
            && let Ok(v) = HeaderValue::from_str(&s.to_string())
        {
            r.headers_mut().insert("retry-after", v);
        }
        r
    }
}
