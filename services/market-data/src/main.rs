//! Kalks market-data service.
//!
//! Ingests live prices from Infoway, builds broker-standard OHLC candles (M1…MN) from the raw feed,
//! backfills history, stores everything in PostgreSQL and serves candles + live quotes to the apps.
//! Account-group spread markups (Back Office) are applied only to outgoing quotes.

mod api;
mod backfill;
mod config;
mod db;
mod depth;
mod ingest;
mod instruments;
mod spreads;
mod state;
mod timeframes;

use std::time::Duration;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Several TLS backends are compiled into the workspace; pick one explicitly so TLS clients
    // (provider WebSocket, HTTPS history) never fail to find a crypto provider.
    let _ = rustls::crypto::ring::default_provider().install_default();
    // repo-root .env.local in development; real env vars win in production
    let _ = dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/../../.env.local"));
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn,tokio_tungstenite=warn".into()))
        .init();

    let cfg = config::Config::from_env()?;
    let cat = instruments::Catalogue::load(&cfg.instruments_file)?;
    let pool = db::connect(&cfg.database_url).await?;
    db::sync_instruments(&pool, &cat).await?;
    let spreads = spreads::Spreads::load(&pool).await?;
    let market = state::Market::new(cat, pool, spreads, cfg.store_ticks);
    market.restore().await?;
    tracing::info!(instruments = market.cat.list.len(), "market-data starting (last prices restored)");

    ingest::spawn_all(&cfg, market.clone());
    if cfg.upstream.is_empty() {
        backfill::spawn(&cfg, market.clone());
    } else {
        tracing::info!(upstream = %cfg.upstream, "relay mode: provider backfill and reconciliation are off");
    }

    // persist forming bars + ticks every second; log throughput every minute
    {
        let mk = market.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(1));
            let mut n = 0u64;
            loop {
                tick.tick().await;
                if let Err(e) = mk.flush().await {
                    tracing::warn!(error = %e, "flush failed");
                }
                n += 1;
                if n % 60 == 0 {
                    let per_min = mk.reset_minute_counter();
                    tracing::info!(ticks_per_min = per_min, streams = ?mk.stats().connected_markets, "feed");
                }
            }
        });
    }

    let app = api::router(api::AppState { market: market.clone(), admin_token: cfg.admin_token.clone() });
    // TCP_NODELAY: every quote frame is tiny — never let Nagle hold one back waiting for an ACK
    let listener = axum::serve::ListenerExt::tap_io(tokio::net::TcpListener::bind(&cfg.bind).await?, |tcp| {
        let _ = tcp.set_nodelay(true);
    });
    tracing::info!(bind = %cfg.bind, "http listening");
    axum::serve(listener, app).with_graceful_shutdown(async {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await?;
    Ok(())
}
