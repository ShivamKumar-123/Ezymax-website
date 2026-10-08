use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sqlx::PgPool;
use std::sync::Arc;

use crate::config::Config;
use crate::crypto::Keys;
use crate::error::ApiError;
use crate::ratelimit::Limiter;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
    pub keys: Keys,
    pub limiter: Limiter,
    /// Present when SMTP is configured.
    pub mailer: Option<crate::mailer::Mailer>,
}

/// Request context forwarded by the Next.js BFF route handlers.
/// The gateway only listens on loopback and (with `GATEWAY_INTERNAL_TOKEN`) only trusts the BFF,
/// so `X-Forwarded-For` / `X-Ezymex-Device` come from our own code, not the browser.
pub struct Ctx {
    pub ip: String,
    pub user_agent: String,
    /// Raw device id from the app's HttpOnly device cookie (hashed before storage).
    pub device: Option<String>,
    pub tenant_slug: String,
    pub bearer: Option<String>,
}

fn header(parts: &Parts, name: &str) -> Option<String> {
    parts.headers.get(name).and_then(|v| v.to_str().ok()).map(str::trim).filter(|v| !v.is_empty()).map(str::to_string)
}

/// Tenant: the browser host the BFF forwards in `X-Ezymex-Host` (an active `tenant_domains` row) wins, then an
/// explicit `X-Ezymex-Tenant`, then the default tenant `ezymex` (precedence documented in domains.rs).
impl FromRequestParts<AppState> for Ctx {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, st: &AppState) -> Result<Self, Self::Rejection> {
        let ip = header(parts, "x-forwarded-for")
            .and_then(|v| v.split(',').next().map(|s| s.trim().to_string()))
            .filter(|v| v.len() <= 64)
            .unwrap_or_else(|| "unknown".into());
        let user_agent: String = header(parts, "user-agent").unwrap_or_default().chars().take(400).collect();
        let device = header(parts, "x-ezymex-device").filter(|v| (16..=128).contains(&v.len()));
        let (tenant_slug, _) = crate::domains::resolve_headers(st, &parts.headers).await;
        let bearer = header(parts, "authorization").and_then(|v| v.strip_prefix("Bearer ").map(|t| t.trim().to_string())).filter(|t| !t.is_empty() && t.len() <= 128);
        Ok(Ctx { ip, user_agent, device, tenant_slug, bearer })
    }
}
