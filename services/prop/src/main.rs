//! Kalks prop firm service (:8097). See services/prop/README.md.

use std::sync::Arc;

use prop::config::Config;
use prop::ops::Svc;
use prop::{api, evaluator, notifier, store};

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
    tracing::info!(?cfg, "prop service starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("PROP_INTERNAL_TOKEN is empty: any local process can call the prop service (dev only)");
    }
    if cfg.trading_token.is_empty() {
        tracing::warn!("TRADING_INTERNAL_TOKEN is empty: engine calls will be refused unless the engine runs without a token");
    }

    let pool = store::connect(&cfg.database_url).await?;
    let gateway = if cfg.gateway_database_url.is_empty() {
        None
    } else {
        match sqlx::postgres::PgPoolOptions::new().max_connections(2).connect_lazy(&cfg.gateway_database_url) {
            Ok(p) => Some(p),
            Err(e) => {
                tracing::warn!(error = %e, "gateway DB (kyc_status) not usable; trusting the KYC status forwarded by the BFFs");
                None
            }
        }
    };
    let app = Arc::new(Svc::new(cfg.clone(), pool, gateway));
    if cfg.evaluator_enabled {
        tokio::spawn(evaluator::run(app.clone()));
        notifier::spawn(app.clone());
        tracing::info!(poll_ms = cfg.poll_ms, "rule evaluator running");
    }

    let router = api::router(app);
    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    tracing::info!(bind = %cfg.bind, "http listening");
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
