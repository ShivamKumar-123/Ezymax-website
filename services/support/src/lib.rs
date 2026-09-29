//! Kalks support + notifications service (127.0.0.1:8100): live chat with a Claude-powered help bot that
//! hands over to human agents (D95, D124), and the notification centre with email + real-time bell (D37, D41).
//! See README.md.

pub mod adapters;
pub mod api;
pub mod audit;
pub mod bot;
pub mod chat;
pub mod config;
pub mod db;
pub mod error;
pub mod kb;
pub mod mailer;
pub mod notify;
pub mod push;
pub mod state;
pub mod stats;
pub mod upstream;
pub mod util;
pub mod workers;
