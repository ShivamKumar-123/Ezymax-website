//! Kalks FX Options service (:8104). See src/lib.rs and README.md.

use options::config::Config;
use options::{AppState, api, jobs, seed, store};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    // repo-root .env.local in development; real env vars win
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
    let env_file = dotenvy::from_path(format!("{root}/.env.local"));
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
    tracing::info!(?cfg, "options starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("OPTIONS_INTERNAL_TOKEN is empty: any local process can call the options service (dev only)");
    }
    let pool = store::connect(&cfg.database_url).await?;
    let seeded = seed::run(&pool, &cfg.holidays_dir).await?;
    if seeded > 0 {
        tracing::info!(rows = seeded, "seed data inserted");
    }
    let bind = cfg.bind.clone();
    let st = AppState::new(pool, cfg).await?;
    {
        let rd = st.refdata().await;
        let tenants: Vec<String> = rd.tenants.values().map(|t| format!("{}(demo={},live={})", t.tenant, t.enabled_demo, t.enabled_live)).collect();
        tracing::info!(version = rd.version, underlyings = rd.underlyings.len(), ?tenants, "reference data loaded");
    }
    if st.cfg.workers {
        jobs::spawn_all(st.clone());
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
