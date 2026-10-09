//! Background loop (only where `STAKING_WORKERS=true`): unconfirmed subscription debits, settlement transfers and
//! maturities, every `STAKING_TICK_SECS` or at once when an approval or retry wakes it. Every step is idempotent and
//! leases its rows, so two instances never pay the same line or principal twice.

use crate::state::AppState;
use crate::{db, positions, settlements};
use std::time::Duration;

pub fn spawn(st: &AppState) {
    let st = st.clone();
    tokio::spawn(async move {
        loop {
            tick(&st).await;
            let _ = tokio::time::timeout(Duration::from_secs(st.cfg.tick_secs), st.wake.notified()).await;
        }
    });
}

pub async fn tick(st: &AppState) {
    match positions::reconcile(st).await {
        Ok(n) if n > 0 => tracing::info!(positions = n, "subscription debits retried"),
        Ok(_) => {}
        Err(e) => tracing::warn!(error = ?e, "subscription reconciler failed"),
    }
    match settlements::transfer_tick(st).await {
        Ok((0, 0, 0)) => {}
        Ok((paid, pending, failed)) => tracing::info!(paid, pending, failed, "staking returns sent"),
        Err(e) => tracing::warn!(error = ?e, "settlement transfers failed"),
    }
    match positions::maturity_tick(st).await {
        Ok((0, 0)) => {}
        Ok((done, waiting)) => tracing::info!(done, waiting, "matured positions returned"),
        Err(e) => tracing::warn!(error = ?e, "maturity worker failed"),
    }
    let _ = db::set_cursor(&st.pool, "workers:last_run", &chrono::Utc::now().to_rfc3339()).await;
}
