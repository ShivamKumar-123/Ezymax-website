//! Ezymex reports service (:8102): statements (D48, D50), client analytics (D91), broker reports (D120) and
//! cohorts / LTV / funnel / scheduled reports (D145), trader analytics and broker risk / scenarios. See
//! services/reports/README.md.

pub mod api;
pub mod broker;
pub mod client;
pub mod config;
pub mod db;
pub mod error;
pub mod export;
pub mod logo;
pub mod mailer;
pub mod metrics;
pub mod pdf;
pub mod risk;
pub mod schedules;
pub mod specs;
pub mod state;
pub mod statement;
pub mod sync;
pub mod time;
pub mod traders;
pub mod upstream;
pub mod zip;
