//! Ezymex staking (Earn): clients lock wallet funds in a plan for its term; every month the admin sets that month's
//! return per plan, a settlement is created from the rates and approved by a second staff member, and the returns
//! are credited to the clients' wallets. Principal goes back to the wallet automatically at maturity; there is no
//! early withdrawal. Wallet debits and credits go through the wallet service with idempotency keys recorded first
//! (`wallet_ops`). See README.md.

pub mod api;
pub mod audit;
pub mod config;
pub mod db;
pub mod error;
pub mod gateway;
pub mod money;
pub mod notify;
pub mod period;
pub mod plans;
pub mod positions;
pub mod rates;
pub mod settlements;
pub mod state;
pub mod wallet;
pub mod workers;
