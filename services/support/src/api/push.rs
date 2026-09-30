//! The mobile app's phones (Expo push tokens), through the Client Area BFF (`/api/mobile/push/*`):
//!
//! - `POST /v1/push/tokens`         client: `{token, deviceId, platform: ios|android, locale?, appVersion?}` registers
//!   or refreshes this phone for the signed-in client (the BFF refuses view-only and staff sessions).
//! - `POST /v1/push/tokens/delete`  client: `{token}` removes the client's own row (sign-out on the phone).
//! - `POST /v1/push/tokens/forget`  service: `{token, deviceId}` removes the row when the session already ended; the
//!   phone proves it registered the row by sending both its push token and its installation id.
//! - `POST /v1/push/tokens/revoke`  service (the gateway, after it revoked sessions): `{tenant, userId?, devices?,
//!   all?, before}`. `userId` + `devices` (the `device_ref`s of phones whose sessions ended): those phones;
//!   `userId` + `all`: every phone of the client; `all` alone: every phone of the broker. `before` (RFC 3339) is when
//!   the sessions were revoked: a phone registered again since keeps its registration. Answers `{removed}`.

use super::Body;
use crate::chat::Client;
use crate::error::{ApiError, ApiResult, invalid};
use crate::push::{self, Device, Revoked};
use crate::state::AppState;
use axum::Json;
use axum::extract::State;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use std::time::Duration;

/// Device references one revocation may name (a client has at most `push::MAX_DEVICES` phones; sessions more).
const MAX_REFS: usize = 200;

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

/// The gateway revoked sessions: the phones that lost their session stop receiving pushes.
pub async fn revoked(State(st): State<AppState>, Body(b): Body) -> ApiResult<Json<Value>> {
    let tenant = b["tenant"].as_str().unwrap_or("").trim().to_lowercase();
    if tenant.is_empty() || tenant.len() > 40 || !tenant.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(invalid("tenant", "Missing or invalid tenant."));
    }
    let before = b["before"].as_str().and_then(|t| DateTime::parse_from_rfc3339(t).ok()).map(|t| t.with_timezone(&Utc)).ok_or_else(|| invalid("before", "When the sessions were revoked (RFC 3339)."))?;
    // never later than now: that would remove registrations made after the revocation
    let before = before.min(Utc::now());
    let user = match &b["userId"] {
        Value::Null => None,
        v => Some(v.as_i64().filter(|u| *u > 0).ok_or_else(|| invalid("userId", "Invalid client id."))?),
    };
    let refs: Vec<String> = match &b["devices"] {
        Value::Null => vec![],
        Value::Array(a) if a.len() <= MAX_REFS => a.iter().map(|v| v.as_str().filter(|r| push::valid_device_ref(r)).map(str::to_string)).collect::<Option<Vec<_>>>().ok_or_else(|| invalid("devices", "Device references are 64 hex digits."))?,
        _ => return Err(invalid("devices", "A list of at most 200 device references.")),
    };
    let who = match (user, b["all"].as_bool().unwrap_or(false)) {
        (None, true) => Revoked::Tenant,
        (Some(u), true) => Revoked::User(u),
        (Some(u), false) => Revoked::Devices(u, &refs),
        (None, false) => return Err(invalid("userId", "Name the client, or every phone of the broker with all.")),
    };
    let n = push::revoke(&st, &tenant, who, before).await?;
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
