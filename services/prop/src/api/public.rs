//! Public certificate verification (served to anyone through the Client Area BFF).

use axum::Json;
use axum::extract::{Path, State};
use axum::response::{IntoResponse, Response};
use serde_json::Value;

use crate::certs;
use crate::error::{ApiError, ApiResult};
use crate::ops::App;

fn valid_code(code: &str) -> bool {
    code.len() == 10 && code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
}

pub async fn certificate(State(app): State<App>, Path(code): Path<String>) -> ApiResult<Json<Value>> {
    let code = code.to_ascii_uppercase();
    if !valid_code(&code) {
        return Err(ApiError::NotFound("Certificate not found".into()));
    }
    let c = certs::get(&app.pool, &code).await?.ok_or_else(|| ApiError::NotFound("Certificate not found".into()))?;
    Ok(Json(certs::public_json(&c, &app.cfg.verify_base_url)))
}

pub async fn certificate_svg(State(app): State<App>, Path(code): Path<String>) -> ApiResult<Response> {
    let code = code.to_ascii_uppercase();
    if !valid_code(&code) {
        return Err(ApiError::NotFound("Certificate not found".into()));
    }
    let c = certs::get(&app.pool, &code).await?.ok_or_else(|| ApiError::NotFound("Certificate not found".into()))?;
    Ok(([("content-type", "image/svg+xml; charset=utf-8"), ("cache-control", "public, max-age=300"), ("x-content-type-options", "nosniff")], certs::svg(&c, &app.cfg.verify_base_url)).into_response())
}
