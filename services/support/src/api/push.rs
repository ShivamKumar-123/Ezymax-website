//! The mobile app's phones (Expo push tokens), through the Client Area BFF (`/api/mobile/push/*`):
//!
//! - `POST /v1/push/tokens`         client: `{token, deviceId, platform: ios|android, locale?, appVersion?}` registers
//!   or refreshes this phone for the signed-in client (the BFF refuses view-only and staff sessions).
//! - `POST /v1/push/tokens/delete`  client: `{token}` removes the client's own row (sign-out on the phone).
//! - `POST /v1/push/tokens/forget`  service: `{token, deviceId}` removes the row when the session already ended; the
//!   phone proves it registered the row by sending both its push token and its installation id.

use super::Body;
use crate::chat::Client;
use crate::error::{ApiError, ApiResult, invalid};
use crate::push::{self, Device};
use crate::state::AppState;
use axum::Json;
use axum::extract::State;
use serde_json::{Value, json};
use std::time::Duration;

fn token(b: &Value) -> ApiResult<&str> {
    let t = b["token"].as_str().unwrap_or("").trim();
    if push::valid_token(t) { Ok(t) } else { Err(invalid("token", "Not an Expo push token.")) }
}

fn device(b: &Value) -> ApiResult<&str> {
    let d = b["deviceId"].as_str().unwrap_or("").trim();
    if push::valid_device(d) { Ok(d) } else { Err(invalid("deviceId", "Missing or invalid device id.")) }
}

/// `en`, `pt-BR`, `zh-Hans` … (anything else becomes `en`).
fn locale(v: &Value) -> String {
    let l = v.as_str().unwrap_or("").trim();
    let ok = (2..=10).contains(&l.len()) && l.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') && l.chars().next().is_some_and(|c| c.is_ascii_alphabetic());
    if ok { l.to_string() } else { "en".into() }
}

fn app_version(v: &Value) -> String {
    v.as_str().unwrap_or("").chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '+')).take(32).collect()
}

pub async fn register(State(st): State<AppState>, c: Client, Body(b): Body) -> ApiResult<Json<Value>> {
    let token = token(&b)?;
    let device_id = device(&b)?;
    let platform = match b["platform"].as_str() {
        Some(p @ ("ios" | "android")) => p,
        _ => return Err(invalid("platform", "Push notifications are for the iOS and Android app.")),
    };
    if !st.limiter.hit(&format!("push:{}:{}", c.tenant, c.id), 30, Duration::from_secs(3600)) {
        return Err(ApiError::RateLimited("Too many requests. Please try again later.".into()));
    }
    let locale = locale(&b["locale"]);
    let version = app_version(&b["appVersion"]);
    push::register(&st, &c.tenant, c.id, &Device { token, device_id, platform, locale: &locale, app_version: &version }).await?;
    Ok(Json(json!({"status": "ok", "enabled": st.cfg.push_enabled})))
}

pub async fn unregister(State(st): State<AppState>, c: Client, Body(b): Body) -> ApiResult<Json<Value>> {
    let n = push::unregister(&st, &c.tenant, c.id, token(&b)?).await?;
    Ok(Json(json!({"removed": n})))
}

pub async fn forget(State(st): State<AppState>, Body(b): Body) -> ApiResult<Json<Value>> {
    let n = push::forget(&st, token(&b)?, device(&b)?).await?;
    Ok(Json(json!({"removed": n})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_locale_and_version() {
        assert_eq!(locale(&json!("pt-BR")), "pt-BR");
        assert_eq!(locale(&json!("zh-Hans")), "zh-Hans");
        assert_eq!(locale(&json!("<script>")), "en");
        assert_eq!(locale(&json!(null)), "en");
        assert_eq!(locale(&json!("1x")), "en");
        assert_eq!(app_version(&json!("1.0.3 (42)<b>")), "1.0.342b");
        assert_eq!(app_version(&json!(null)), "");
    }
}
