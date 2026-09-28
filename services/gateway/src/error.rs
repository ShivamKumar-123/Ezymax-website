use axum::Json;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// API error. Serialised as `{ "error": { "code", "message", "field"? , ... } }`.
#[derive(Debug)]
pub enum ApiError {
    Validation { field: &'static str, message: &'static str },
    BadRequest(&'static str),
    InvalidCredentials,
    Locked { retry_after: i64 },
    AccountDisabled,
    EmailTaken,
    InvalidCode { attempts_left: i32 },
    CodeExpired,
    RateLimited { retry_after: u64 },
    Unauthorized,
    Forbidden,
    NotFound,
    /// A specific, client-facing failure with its own machine code (e.g. Google sign-in outcomes).
    Coded { status: StatusCode, code: &'static str, message: &'static str },
    Internal(anyhow::Error),
}

impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError::Internal(e.into())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, body, retry) = match self {
            ApiError::Validation { field, message } => {
                (StatusCode::UNPROCESSABLE_ENTITY, json!({"code": "validation", "message": message, "field": field}), None)
            }
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, json!({"code": "bad_request", "message": m}), None),
            ApiError::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, json!({"code": "invalid_credentials", "message": "Incorrect email or password."}), None)
            }
            ApiError::Locked { retry_after } => {
                let mins = (retry_after + 59) / 60;
                (
                    StatusCode::LOCKED,
                    json!({"code": "locked", "message": format!("Too many failed attempts. Your account is locked for {mins} min, or reset your password."), "retry_after": retry_after}),
                    Some(retry_after.max(1) as u64),
                )
            }
            ApiError::AccountDisabled => {
                (StatusCode::FORBIDDEN, json!({"code": "account_disabled", "message": "This account is disabled. Please contact support."}), None)
            }
            ApiError::EmailTaken => (
                StatusCode::CONFLICT,
                json!({"code": "email_taken", "field": "email", "message": "An account with this email already exists. Sign in instead."}),
                None,
            ),
            ApiError::InvalidCode { attempts_left } => (
                StatusCode::BAD_REQUEST,
                json!({"code": "invalid_code", "message": if attempts_left > 0 { format!("That code is incorrect. {attempts_left} attempt(s) left.") } else { "Too many incorrect codes. Request a new one.".to_string() }, "attempts_left": attempts_left}),
                None,
            ),
            ApiError::CodeExpired => {
                (StatusCode::GONE, json!({"code": "code_expired", "message": "This code has expired. Request a new one."}), None)
            }
            ApiError::RateLimited { retry_after } => (
                StatusCode::TOO_MANY_REQUESTS,
                json!({"code": "rate_limited", "message": format!("Too many requests. Try again in {retry_after}s."), "retry_after": retry_after}),
                Some(retry_after),
            ),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, json!({"code": "unauthorized", "message": "Please sign in."}), None),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, json!({"code": "forbidden", "message": "Not allowed."}), None),
            ApiError::NotFound => (StatusCode::NOT_FOUND, json!({"code": "not_found", "message": "Not found."}), None),
            ApiError::Coded { status, code, message } => (status, json!({"code": code, "message": message}), None),
            ApiError::Internal(e) => {
                tracing::error!(error = ?e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"code": "internal", "message": "Something went wrong. Please try again."}), None)
            }
        };
        let mut res = (status, Json(json!({ "error": body }))).into_response();
        if let Some(s) = retry
            && let Ok(v) = HeaderValue::from_str(&s.to_string())
        {
            res.headers_mut().insert(header::RETRY_AFTER, v);
        }
        res
    }
}

pub fn field(field: &'static str) -> impl Fn(&'static str) -> ApiError {
    move |message| ApiError::Validation { field, message }
}
