//! `POST /v1/internal/house-users {key, nickname}` (service-to-service, `X-Kalks-Internal` only, like every
//! /v1 route; called by the ALGO service when it provisions a house account). Creates — or returns, for the
//! same `key` — the platform-owned "house user" that owns one house trading account.
//!
//! A house user is not a client: `is_house = true`, e-mail `house-<key>@<tenant>.house.invalid` (reserved
//! TLD, nothing is ever delivered), a password hash that is not a valid PHC string (no password can match),
//! no Google link. Sign-in is refused explicitly as well (identity::find_principal). House users are left out
//! of the Back Office client list and counts and of the referral / reports sync.

use axum::Json;
use axum::extract::State;
use serde_json::{Value, json};

use crate::error::{ApiError, ApiResult};
use crate::identity;
use crate::state::{AppState, Ctx};

pub async fn create(State(st): State<AppState>, ctx: Ctx, Json(v): Json<Value>) -> ApiResult<Json<Value>> {
    let key = v.get("key").and_then(Value::as_str).map(str::trim).unwrap_or("").to_lowercase();
    if key.is_empty() || key.len() > 40 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(ApiError::BadRequest("key: 1–40 letters, digits or dashes."));
    }
    let nickname: String = v.get("nickname").and_then(Value::as_str).map(str::trim).unwrap_or("").chars().take(40).collect();
    if nickname.chars().count() < 3 {
        return Err(ApiError::BadRequest("nickname is required."));
    }
    let tenant_id = identity::tenant_id(&st.pool, &ctx.tenant_slug).await?;
    let email = format!("house-{key}@{}.house.invalid", ctx.tenant_slug.to_lowercase());
    // referral codes are unique per tenant: a short digest of the (unique) e-mail
    let digest = st.keys.hash("house-referral", &email);
    let code = format!("HOUSE{}", digest.iter().take(5).map(|b| format!("{b:02X}")).collect::<String>());
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth,
                            referral_code, terms_accepted_at, is_house)
         VALUES ($1, $2, '!house-account-no-login', $3, 'House account', '', '', 'XX', DATE '1970-01-01', $4, now(), true)
         ON CONFLICT (tenant_id, email) DO UPDATE SET first_name = EXCLUDED.first_name, updated_at = now()
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&email)
    .bind(&nickname)
    .bind(&code)
    .fetch_one(&st.pool)
    .await?;
    tracing::info!(user = id, key, "house user ready");
    Ok(Json(json!({"user": {"id": id, "email": email, "name": nickname, "isHouse": true}})))
}
