//! Ezymex news + economic calendar service (:8103).
//!
//! - News (D44): RSS / Atom aggregator over official and (licence permitting) commercial feeds plus the
//!   optional Infoway news stream; every item is de-duplicated, tagged with countries, currencies and Ezymex
//!   instruments, scored for importance and given a headline tone. Staff pin / hide / retag per tenant.
//! - World map (D45): per-country counts and tone ("sentiment heat") over the same feed.
//! - Economic calendar (D102): the weekly Forex Factory export (ETag-polled), server-time (NY close)
//!   conversion, actual values from the feed, an optional licensed provider or staff, and "starts in 15
//!   minutes" reminders through the notifications service.
//! - Daily AI market brief (D138): Claude summarises the day's headlines and calendar once per server day.
//!
//! Internal only: the Client Area, Back Office and Ezymex Trader BFFs call it with `X-Ezymex-Internal`.
//! API contract in `api.rs`.

pub mod api;
pub mod brief;
pub mod calendar;
pub mod config;
pub mod feed;
pub mod infoway;
pub mod sources;
pub mod store;
pub mod tagging;
pub mod workers;

use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub cfg: Arc<config::Config>,
    pub http: reqwest::Client,
    /// Serialises manual refreshes (feeds ask for polite polling; the calendar export allows 2 requests / 5 min).
    pub refresh: Arc<tokio::sync::Mutex<()>>,
}

impl AppState {
    pub fn new(pool: sqlx::PgPool, cfg: config::Config) -> Self {
        let http = reqwest::Client::builder()
            .user_agent(cfg.user_agent.clone())
            .timeout(std::time::Duration::from_secs(25))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("http client");
        Self { pool, cfg: Arc::new(cfg), http, refresh: Arc::new(tokio::sync::Mutex::new(())) }
    }
}
