use crate::config::Config;
use crate::wallet::Wallet;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Notify;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
    pub http: reqwest::Client,
    pub wallet: Wallet,
    /// Wakes the worker after a settlement is approved or retried.
    pub wake: Arc<Notify>,
}

impl AppState {
    pub fn new(pool: PgPool, cfg: Config) -> Self {
        let http = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().expect("http client");
        let wallet = Wallet::new(http.clone(), &cfg.wallet_url, &cfg.wallet_token);
        Self { pool, cfg: Arc::new(cfg), http, wallet, wake: Arc::new(Notify::new()) }
    }
}
