//! Kalks support service (127.0.0.1:8100). See README.md.

use support::{api, config, db, kb, state::AppState, workers};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // repo-root .env.local (+ .env.claude for the AI key) in development; real env vars win in production
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
    let env_file = dotenvy::from_path(format!("{root}/.env.local"));
    let _ = dotenvy::from_path(format!("{root}/.env.claude"));
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
    tracing::info!(?cfg, "support service starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("SUPPORT_INTERNAL_TOKEN is empty: any local process can call the support service (dev only)");
    }
    if cfg.anthropic_key.is_empty() {
        tracing::warn!("ANTHROPIC_API_KEY is empty: the bot answers from the knowledge base only and hands over when unsure");
    }
    tokio::fs::create_dir_all(&cfg.storage_dir).await?;
    let pool = db::connect(&cfg.database_url).await?;
    kb::seed(&pool, "kalks", &cfg.academy_glossary).await?;
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
