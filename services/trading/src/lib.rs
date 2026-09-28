//! Kalks trading engine (see README.md): accounts, orders, positions, margin, swaps, double-entry ledger,
//! dealing desk. Single writer per account shard, event-sourced to PostgreSQL.

pub mod engine;
pub mod model;
pub mod money;
pub mod rules;
pub mod specs;
pub mod state;
