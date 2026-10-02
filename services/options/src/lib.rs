//! Kalks FX Options service (:8104): reference data and the market side of the options segment.
//!
//! - Reference data: underlyings (contract, strikes, expiry cycles, cut, SPAN scan), per-currency holiday
//!   calendars, rates, versioned vol surfaces, realized vol from market-data candles.
//! - Listings: expiry dates per calendar (daily / weekly / monthly, rolled to business days of both
//!   currencies + New York), strike ladders from the live mid with automatic extension.
//! - Fixings: 1-second raw mids in the 30 minutes before each cut, TWAP at the cut with gap accounting and
//!   an M1-candle fallback.
//! - Chain REST + WebSocket for Kalks Trader and the public chain page.
//! - Premium candles: an option series' model mid premium per underlying bar, for the Kalks Trader chart.
//! - The versioned **snapshot** the trading engine prices with (`GET /v1/internal/options/snapshot`).
//! - Back Office CRUD with audit: underlyings, rates, holidays, surfaces, tenant / group settings, dealer
//!   controls, client limits, the Kalks market maker's quoting parameters.
//! - Order book (docs/OPTIONS-EXCHANGE.md): per-underlying tick / bands / mark rules and group maker / taker fees in
//!   the snapshot, the engine's book feed merged into chains (best bid / offer, sizes, last, OI, volume, the clamped
//!   mark, theo and implied vols), depth / tape on the stream and public depth / trades / stats routes.
//!
//! SAFETY: the module is OFF per tenant unless `tenant_settings` turns it on; demo and live are separate
//! switches (tenant `kalks` is seeded demo ON, live OFF). The engine enforces the switch on every order.

pub mod api;
pub mod book_feed;
pub mod candles;
pub mod config;
pub mod feed;
pub mod jobs;
pub mod limiter;
pub mod model;
pub mod pricing;
pub mod seed;
pub mod store;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use tokio::sync::RwLock;

use crate::model::RefData;

/// What a stream ticket grants.
#[derive(Clone, Debug)]
pub struct StreamGrant {
    pub tenant: String,
    pub group: String,
    /// Account kind of the order book this connection sees (guests: live).
    pub kind: book_feed::Kind,
}

/// Cached public order-book answers: (status, body), 1 s.
pub type PublicBookCache = HashMap<String, (Instant, axum::http::StatusCode, Arc<serde_json::Value>)>;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub cfg: Arc<config::Config>,
    pub http: reqwest::Client,
    pub spots: Arc<feed::Spots>,
    rd: Arc<RwLock<Arc<RefData>>>,
    /// One-time WebSocket tickets issued to the BFFs (30 s).
    pub tickets: Arc<Mutex<HashMap<String, (StreamGrant, Instant)>>>,
    /// Public chain responses, cached 1 s per underlying.
    pub public_cache: Arc<Mutex<HashMap<String, (Instant, Arc<serde_json::Value>)>>>,
    /// Serialized engine snapshot per version.
    pub snapshot_cache: Arc<Mutex<Option<(i64, Arc<Vec<u8>>)>>>,
    /// Premium candles: underlying bars and computed series history, 30 s.
    pub candles: Arc<candles::Cache>,
    /// Serialises the listing job with admin-triggered regeneration.
    pub listing: Arc<tokio::sync::Mutex<()>>,
    pub jobs: Arc<Mutex<HashMap<&'static str, chrono::DateTime<chrono::Utc>>>>,
    /// The engine's order book feed (docs/OPTIONS-EXCHANGE.md §10).
    pub books: Arc<book_feed::BookFeed>,
    /// Public order-book routes, cached 1 s per path.
    pub public_book_cache: Arc<Mutex<PublicBookCache>>,
    /// Public order-book routes: 10 requests / s per client IP.
    pub public_limiter: Arc<Mutex<limiter::Limiter<std::net::IpAddr>>>,
}

impl AppState {
    pub async fn new(pool: sqlx::PgPool, cfg: config::Config) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent("kalks-options/1.0")
            .timeout(std::time::Duration::from_secs(20))
            .connect_timeout(std::time::Duration::from_secs(5))
            .build()?;
        let rd = model::load(&pool).await?;
        Ok(Self {
            pool,
            cfg: Arc::new(cfg),
            http,
            spots: Arc::new(feed::Spots::default()),
            rd: Arc::new(RwLock::new(Arc::new(rd))),
            tickets: Default::default(),
            public_cache: Default::default(),
            snapshot_cache: Default::default(),
            candles: Default::default(),
            listing: Default::default(),
            jobs: Default::default(),
            books: Default::default(),
            public_book_cache: Default::default(),
            public_limiter: Arc::new(Mutex::new(limiter::Limiter::new(10.0, 10.0))),
        })
    }

    pub async fn refdata(&self) -> Arc<RefData> {
        self.rd.read().await.clone()
    }

    /// Reloads reference data when the stored version moved (or always with `force`).
    pub async fn reload(&self, force: bool) -> anyhow::Result<bool> {
        let current = self.rd.read().await.version;
        if !force && store::version(&self.pool).await? == current {
            return Ok(false);
        }
        let fresh = model::load(&self.pool).await?;
        tracing::debug!(from = current, to = fresh.version, "reference data reloaded");
        *self.rd.write().await = Arc::new(fresh);
        self.public_cache.lock().unwrap().clear();
        self.public_book_cache.lock().unwrap().clear();
        Ok(true)
    }

    pub fn job_ran(&self, name: &'static str) {
        self.jobs.lock().unwrap().insert(name, chrono::Utc::now());
    }

    pub fn issue_ticket(&self, grant: StreamGrant) -> String {
        let mut b = [0u8; 24];
        getrandom::fill(&mut b).expect("OS randomness unavailable");
        let t: String = b.iter().map(|x| format!("{x:02x}")).collect();
        let mut m = self.tickets.lock().unwrap();
        let now = Instant::now();
        m.retain(|_, (_, at)| now.duration_since(*at).as_secs() < 30);
        m.insert(t.clone(), (grant, now));
        t
    }

    pub fn redeem_ticket(&self, t: &str) -> Option<StreamGrant> {
        let (g, at) = self.tickets.lock().unwrap().remove(t)?;
        (at.elapsed().as_secs() < 30).then_some(g)
    }
}
