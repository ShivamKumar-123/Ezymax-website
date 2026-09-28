//! Kalks ALGO service (:8099). See services/algo/README.md.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use algo::clients::{Engine, MarketData, Wallet, http};
use algo::config::Config;
use algo::security::Limiter;
use algo::specs::Specs;
use algo::state::AppState;
use tokio::sync::Notify;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // repo-root .env.local (+ .env.claude for the AI key) in development; real env vars win in production
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
    let env_file = dotenvy::from_path(format!("{root}/.env.local"));
    let _ = dotenvy::from_path(format!("{root}/.env.claude"));
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
    tracing::info!(?cfg, "algo service starting");
    if cfg.internal_token.is_empty() {
        tracing::warn!("ALGO_INTERNAL_TOKEN is empty: any local process can call the service (dev only)");
    }
    let specs = Arc::new(Specs::load(&cfg.instruments_file, &cfg.specs_file)?);
    let pool = algo::db::connect(&cfg.database_url).await?;
    let client = http();
    let st = AppState {
        md: MarketData { base: cfg.market_data_url.clone(), http: client.clone() },
        engine: Arc::new(Engine::new(cfg.trading_url.clone(), cfg.trading_token.clone(), client.clone())),
        wallet: Wallet { base: cfg.wallet_url.clone(), token: cfg.wallet_token.clone(), http: client.clone() },
        http: client,
        cfg: Arc::new(cfg.clone()),
        pool: pool.clone(),
        specs,
        limiter: Arc::new(Limiter::default()),
        cancels: Arc::new(Mutex::new(HashMap::new())),
        runtime_wake: Arc::new(Notify::new()),
        jobs_wake: Arc::new(Notify::new()),
    };
    if cfg.workers {
        algo::backtest::jobs::spawn(st.clone());
        algo::runtime::spawn(st.clone());
        algo::api::market::spawn_renewals(st.clone());
        // housekeeping: keep logs and request history bounded
        let pool2 = pool.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
                let _ = sqlx::query("DELETE FROM api_requests WHERE at < now() - interval '30 days'").execute(&pool2).await;
                let _ = sqlx::query("DELETE FROM deployment_logs WHERE at < now() - interval '90 days'").execute(&pool2).await;
                let _ = sqlx::query("DELETE FROM webhook_events WHERE received_at < now() - interval '90 days'").execute(&pool2).await;
                let _ = sqlx::query("DELETE FROM backtests WHERE finished_at < now() - interval '180 days'").execute(&pool2).await;
            }
        });
    }
    let app = algo::api::router(st);
    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    tracing::info!(bind = %cfg.bind, "listening");
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).with_graceful_shutdown(async {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await?;
    Ok(())
}
