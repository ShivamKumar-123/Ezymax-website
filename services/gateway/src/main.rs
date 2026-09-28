//! Kalks gateway: identity and sessions for the Client Area (clients) and Back Office (staff).
//!
//! Browsers never talk to this service directly. Each Next.js app proxies `/api/auth/*` through its own
//! route handlers, which keep the opaque session token in a first-party HttpOnly cookie and forward it here
//! as a bearer token together with `X-Kalks-Internal`.

mod admin;
mod audit;
mod client_auth;
mod config;
mod crypto;
mod db;
mod error;
mod flows;
mod google_auth;
mod identity;
mod internal;
mod mailer;
mod ratelimit;
mod shares;
mod staff_auth;
mod state;
mod stepup;
#[cfg(test)]
mod testdb;
mod validate;

use axum::extract::{Request, State};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::extract::DefaultBodyLimit;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use std::sync::Arc;
use std::time::Duration;

use crate::error::ApiError;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // repo-root .env.local in development; real env vars win in production
    let env_file = dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/../../.env.local"));
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn".into()))
        .with_ansi(std::io::IsTerminal::is_terminal(&std::io::stdout()))
        .init();
    if let Err(e) = env_file
        && !e.not_found()
    {
        tracing::warn!(error = %e, ".env.local could not be fully parsed");
    }

    let cfg = config::Config::from_env()?;
    tracing::info!(?cfg, "gateway starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("GATEWAY_INTERNAL_TOKEN is empty: any local process can call the gateway (dev only)");
    }
    let pool = db::connect(&cfg.database_url).await?;
    db::seed_super_admin(&pool, &cfg).await?;
    let _ = crypto::dummy_hash();

    let mailer = if cfg.smtp_configured {
        let m = mailer::Mailer::new(mailer::SmtpSettings {
            host: &cfg.smtp_host,
            port: cfg.smtp_port,
            user: &cfg.smtp_user,
            password: &cfg.smtp_password,
            from: &cfg.smtp_from,
        }, mailer::Links {
            site: cfg.site_url.clone(),
            app: cfg.app_url.clone(),
            trade: cfg.trade_url.clone(),
            support_email: cfg.support_email.clone(),
        })?;
        match m.test_connection().await {
            Ok(true) => tracing::info!(host = %cfg.smtp_host, "SMTP login ok"),
            Ok(false) => tracing::error!(host = %cfg.smtp_host, "SMTP server did not accept the connection"),
            Err(e) => tracing::error!(host = %cfg.smtp_host, error = %e, "SMTP connection failed"),
        }
        Some(m)
    } else {
        None
    };
    // `gateway send-test-emails <address>`: sends one of every email template, then exits.
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("send-test-emails") {
        let to = args.get(2).ok_or_else(|| anyhow::anyhow!("usage: gateway send-test-emails <address>"))?;
        let m = mailer.as_ref().ok_or_else(|| anyhow::anyhow!("SMTP is not configured"))?;
        m.send_welcome(to, "Shivam").await?;
        for p in [identity::Purpose::VerifyEmail, identity::Purpose::Login, identity::Purpose::ResetPassword] {
            m.send_code(to, p, "482915", 10, None).await?;
        }
        m.send_code(to, identity::Purpose::Confirm, "482915", 10, Some(&stepup::describe("trading_password", "10000123"))).await?;
        println!("sent 5 test emails to {to}");
        return Ok(());
    }
    let st = AppState { pool, keys: crypto::Keys::new(&cfg.session_secret), cfg: Arc::new(cfg), limiter: Default::default(), mailer };

    // keep the limiter bounded; purge long-dead sessions and codes
    {
        let st = st.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(300));
            loop {
                tick.tick().await;
                st.limiter.sweep(Duration::from_secs(3600));
                let _ = sqlx::query("DELETE FROM email_otps WHERE expires_at < now() - interval '1 day'").execute(&st.pool).await;
                let _ = sqlx::query("DELETE FROM stepup_tokens WHERE expires_at < now() - interval '1 day'").execute(&st.pool).await;
                let _ = sqlx::query("DELETE FROM sessions WHERE expires_at < now() - interval '30 days'").execute(&st.pool).await;
            }
        });
    }

    let bind = st.cfg.bind.clone();
    let app = router(st);
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!(%bind, "http listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}

fn router(st: AppState) -> Router {
    let v1 = Router::new()
        .route("/v1/auth/register", post(client_auth::register))
        .route("/v1/auth/login", post(client_auth::login))
        .route("/v1/auth/logout", post(client_auth::logout))
        .route("/v1/auth/me", get(client_auth::me))
        .route("/v1/auth/forgot", post(client_auth::forgot))
        .route("/v1/auth/reset", post(client_auth::reset))
        .route("/v1/auth/verify-email", post(client_auth::verify_email))
        .route("/v1/auth/resend", post(client_auth::resend))
        .route("/v1/auth/password", post(stepup::change_password))
        .route("/v1/auth/stepup", post(stepup::request))
        .route("/v1/auth/stepup/resend", post(stepup::resend))
        .route("/v1/auth/stepup/verify", post(stepup::verify))
        .route("/v1/auth/stepup/consume", post(stepup::consume))
        .route("/v1/auth/google", post(google_auth::google))
        .route("/v1/auth/google/ticket", post(google_auth::ticket))
        .route("/v1/auth/google/complete", post(google_auth::complete))
        .route("/v1/admin/auth/login", post(staff_auth::login))
        .route("/v1/admin/auth/verify-otp", post(staff_auth::verify_otp))
        .route("/v1/admin/auth/resend", post(staff_auth::resend))
        .route("/v1/admin/auth/logout", post(staff_auth::logout))
        .route("/v1/admin/auth/me", get(staff_auth::me))
        .route("/v1/admin/stats", get(admin::stats))
        .route("/v1/admin/users", get(admin::users))
        .route("/v1/admin/users/{id}", get(admin::user_detail))
        .route("/v1/admin/audit", get(admin::audit_log))
        .route("/v1/admin/audit/record", post(admin::record))
        .route("/v1/admin/staff", get(admin::staff_list))
        .route("/v1/admin/sessions", get(admin::sessions))
        .route("/v1/admin/sessions/{id}/revoke", post(admin::revoke_session))
        .route("/v1/shares", post(shares::create))
        .route("/v1/shares/lookup", post(shares::lookup))
        .route("/v1/shares/{code}/trades", patch(shares::update_trades))
        .route("/v1/shares/{code}/revoke", post(shares::revoke))
        .route("/v1/public/shares/{code}", get(shares::public))
        .route("/v1/internal/referrals/users", get(internal::referral_users))
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(middleware::from_fn_with_state(st.clone(), internal_only));
    Router::new()
        .route("/health", get(health))
        .merge(v1)
        .fallback(|| async { (axum::http::StatusCode::NOT_FOUND, Json(serde_json::json!({"error": {"code": "not_found", "message": "Not found."}}))) })
        .with_state(st)
}

async fn health(State(st): State<AppState>) -> impl IntoResponse {
    let db = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&st.pool).await.is_ok();
    Json(serde_json::json!({ "status": if db { "ok" } else { "degraded" }, "db": db, "service": "gateway" }))
}

/// Only the apps' server-side route handlers may call /v1 (shared secret in `X-Kalks-Internal`).
async fn internal_only(State(st): State<AppState>, req: Request, next: Next) -> Response {
    let expected = st.cfg.internal_token.as_bytes();
    if !expected.is_empty() {
        let got = req.headers().get("x-kalks-internal").map(|v| v.as_bytes()).unwrap_or_default();
        if !crypto::ct_eq(got, expected) {
            return ApiError::Forbidden.into_response();
        }
    }
    next.run(req).await
}
