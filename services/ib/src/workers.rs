//! Background loops. Each loop logs and carries on after an error; all work is idempotent.

use crate::state::AppState;
use crate::{db, deals, notifier, payouts, stats, sync};
use std::future::Future;
use std::time::Duration;

fn every<F, Fut>(st: &AppState, name: &'static str, period: Duration, f: F)
where
    F: Fn(AppState) -> Fut + Send + 'static,
    Fut: Future<Output = anyhow::Result<()>> + Send,
{
    let st = st.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(period);
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        let mut failing = false;
        loop {
            tick.tick().await;
            match f(st.clone()).await {
                Ok(()) => {
                    if failing {
                        tracing::info!(worker = name, "worker recovered");
                    }
                    failing = false;
                }
                Err(e) => {
                    // log the first failure loudly, then quietly until it recovers
                    if !failing {
                        tracing::warn!(worker = name, error = %e, "worker step failed");
                    } else {
                        tracing::debug!(worker = name, error = %e, "worker step failed");
                    }
                    failing = true;
                }
            }
        }
    });
}

pub fn spawn(st: &AppState) {
    let secs = Duration::from_secs;
    every(st, "gateway-sync", secs(st.cfg.sync_secs), |st| async move {
        sync::sync_once(&st).await?;
        Ok(())
    });
    every(st, "engine-deals", secs(st.cfg.deals_secs), |st| async move {
        for t in db::tenants(&st.pool).await? {
            deals::poll_engine(&st, &t).await?;
        }
        Ok(())
    });
    every(st, "reversals", secs(600), |st| async move {
        for t in db::tenants(&st.pool).await? {
            deals::sweep_reversals(&st, &t).await?;
        }
        Ok(())
    });
    every(st, "deposits", secs(60), |st| async move {
        for t in db::tenants(&st.pool).await? {
            deals::deposits_tick(&st, &t).await?;
        }
        Ok(())
    });
    every(st, "auto-batches", secs(300), |st| async move {
        for t in db::tenants(&st.pool).await? {
            payouts::auto_batch_tick(&st, &t).await?;
        }
        Ok(())
    });
    every(st, "levels", secs(3600), |st| async move {
        for t in db::tenants(&st.pool).await? {
            stats::monthly_tick(&st, &t).await?;
        }
        Ok(())
    });
    // payouts: every 30 s, or at once when a batch is approved
    let st2 = st.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = payouts::transfer_tick(&st2).await {
                tracing::warn!(error = %e, "payout transfer step failed");
            }
            // announce paid payouts to the partner (retries of earlier failures ride along)
            if let Err(e) = notifier::push_paid(&st2).await {
                tracing::warn!(error = %e, "payout notification step failed");
            }
            tokio::select! {
                _ = st2.wake_payouts.notified() => {}
                _ = tokio::time::sleep(Duration::from_secs(30)) => {}
            }
        }
    });
}
