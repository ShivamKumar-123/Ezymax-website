//! Ezymex news + economic calendar service (:8103). See src/api.rs for the API contract.

use news::config::Config;
use news::{AppState, api, store, workers};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    // repo-root .env.local (+ .env.claude for the brief's Claude key) in development; real env vars win
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
    let env_file = dotenvy::from_path(format!("{root}/.env.local"));
    let _ = dotenvy::from_path(format!("{root}/.env.claude"));
    let cfg = Config::from_env()?;
    let filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn,tokio_tungstenite=warn".into());
    if cfg.json_logs {
        tracing_subscriber::fmt().json().with_current_span(false).with_env_filter(filter).init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).with_ansi(std::io::IsTerminal::is_terminal(&std::io::stdout())).init();
    }
    if let Err(e) = env_file
        && !e.not_found()
    {
        tracing::warn!(error = %e, ".env.local could not be fully parsed");
    }
    tracing::info!(?cfg, "news starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("NEWS_INTERNAL_TOKEN is empty: any local process can call the news service (dev only)");
    }
    let pool = store::connect(&cfg.database_url).await?;
    store::seed_sources(&pool).await?;
    let retagged = store::retag_recent(&pool).await?;
    if retagged > 0 {
        tracing::info!(retagged, "tagging rules re-applied to recent items");
    }
    let bind = cfg.bind.clone();
    let st = AppState::new(pool, cfg);
    if st.cfg.workers {
        workers::spawn_all(st.clone());
    }
    let app = api::router(st);
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!(%bind, "http listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
