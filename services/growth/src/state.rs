use crate::config::Config;
use crate::model::Instruments;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Notify;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
    pub http: reqwest::Client,
    pub instruments: Arc<Instruments>,
    /// Wakes the engine / wallet posting loops after a grant, release or payout is queued.
    pub wake: Arc<Notify>,
}

impl AppState {
    pub fn new(pool: PgPool, cfg: Config) -> Self {
        let instruments = Arc::new(Instruments::load(&cfg.instruments_file));
        let http = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().expect("http client");
        Self { pool, cfg: Arc::new(cfg), http, instruments, wake: Arc::new(Notify::new()) }
    }
}
