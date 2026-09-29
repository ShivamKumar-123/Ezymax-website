//! Kalks reports service (:8102). See services/reports/README.md.

use std::sync::Arc;

use reports::config::Config;
use reports::state::Svc;
use reports::{api, db, schedules, sync};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // repo-root .env.local in development; real env vars win in production
    let env_file = dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/../../.env.local"));
    let cfg = Config::from_env()?;
    let filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn".into());
    if cfg.json_logs {
        tracing_subscriber::fmt().json().with_current_span(false).with_env_filter(filter).init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }
    if let Err(e) = env_file
        && !e.not_found()
    {
        tracing::warn!(error = %e, ".env.local could not be fully parsed");
    }
    tracing::info!(?cfg, "reports service starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("REPORTS_INTERNAL_TOKEN is empty: any local process can call the reports service (dev only)");
    }
    let pool = db::connect(&cfg.database_url).await?;
    let app = Arc::new(Svc::new(cfg.clone(), pool));
    if cfg.workers {
        tokio::spawn(sync::run(app.clone()));
        tokio::spawn(schedules::runner(app.clone()));
        tracing::info!(sync_secs = cfg.sync_secs, "mirror and scheduler running");
    }
    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    tracing::info!(bind = %cfg.bind, "http listening");
    axum::serve(listener, api::router(app))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
