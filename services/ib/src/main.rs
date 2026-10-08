//! Ezymex IB service (127.0.0.1:8096). See README.md.

use ib::{api, config, db, state::AppState, workers};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let env_file = dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/../../.env.local"));
    let cfg = config::Config::from_env()?;
    let filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn".into());
    if cfg.log_json {
        tracing_subscriber::fmt().json().with_env_filter(filter).init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }
    if let Err(e) = env_file
        && !e.not_found()
    {
        tracing::warn!(error = %e, ".env.local could not be fully parsed");
    }
    tracing::info!(?cfg, "ib service starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("IB_INTERNAL_TOKEN is empty: any local process can call the IB service (dev only)");
    }
    let pool = db::connect(&cfg.database_url).await?;
    db::settings(&pool, "ezymex").await?;
    db::levels(&pool, "ezymex").await?;
    let st = AppState::new(pool, cfg);
    if st.cfg.workers {
        workers::spawn(&st);
    }
    let listener = tokio::net::TcpListener::bind(&st.cfg.bind).await?;
    tracing::info!(bind = %st.cfg.bind, "http listening");
    axum::serve(listener, api::router(st))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
