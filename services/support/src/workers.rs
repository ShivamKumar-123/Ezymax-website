//! Background loops: the email outbox, mobile pushes (when enabled), SLA breach sweeps and the polling adapters.

use crate::{adapters, chat, notify, push};
use crate::state::AppState;
use std::time::Duration;

pub fn spawn(st: &AppState) {
    let s = st.clone();
    tokio::spawn(async move {
        loop {
            match notify::flush_outbox(&s).await {
                Ok(n) if n > 0 => continue,
                Ok(_) => {}
                Err(e) => tracing::warn!(error = %e, "email outbox"),
            }
            tokio::select! {
                _ = s.wake_mail.notified() => {}
                _ = tokio::time::sleep(Duration::from_secs(30)) => {}
            }
        }
    });
    if st.cfg.push_enabled {
        spawn_push(st);
    }
    let s = st.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            if let Err(e) = chat::sla_sweep(&s).await {
                tracing::warn!(error = %e, "sla sweep");
            }
        }
    });
    if st.cfg.adapters {
        let s = st.clone();
        tokio::spawn(async move {
            let mut warned = std::collections::HashSet::new();
            loop {
                tokio::time::sleep(Duration::from_secs(s.cfg.adapter_secs)).await;
                for tenant in adapters::tenants(&s).await {
                    report(&mut warned, "trading", adapters::trading(&s, &tenant).await);
                    report(&mut warned, "margin", adapters::margin(&s, &tenant).await);
                }
                report(&mut warned, "kyc", adapters::kyc(&s).await);
                report(&mut warned, "wallet", adapters::wallet(&s).await);
            }
        });
    }
}

/// Mobile push (push.rs): the sender (woken when a push is queued, else every 5 s for retries that fell due),
/// the receipt check every minute and the clean-up every 10 minutes.
fn spawn_push(st: &AppState) {
    let s = st.clone();
    tokio::spawn(async move {
        loop {
            match push::flush(&s).await {
                Ok(n) if n > 0 => continue,
                Ok(_) => {}
                Err(e) => tracing::warn!(error = %e, "push sender"),
            }
            tokio::select! {
                _ = s.wake_push.notified() => {}
                _ = tokio::time::sleep(Duration::from_secs(5)) => {}
            }
        }
    });
    let s = st.clone();
    tokio::spawn(async move {
        let mut tick: u64 = 0;
        let mut failing = false;
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            // a full page means more may be waiting: a few more pages, then the next minute
            for _ in 0..5 {
                match push::receipts(&s).await {
                    Ok(n) => {
                        if failing {
                            tracing::info!("push receipts recovered");
                            failing = false;
                        }
                        if n < push::RECEIPT_BATCH {
                            break;
                        }
                    }
                    Err(e) => {
                        if !failing {
                            tracing::warn!(error = %e, "push receipts (will retry)");
                            failing = true;
                        }
                        break;
                    }
                }
            }
            tick += 1;
            if tick % 10 == 0
                && let Err(e) = push::sweep(&s).await
            {
                tracing::warn!(error = %e, "push clean-up");
            }
        }
    });
}

/// Logs an adapter failure once until it recovers (upstream services may simply not be running locally).
fn report(warned: &mut std::collections::HashSet<&'static str>, name: &'static str, r: anyhow::Result<usize>) {
    match r {
        Ok(n) => {
            if warned.remove(name) {
                tracing::info!(adapter = name, "notification adapter recovered");
            }
            if n > 0 {
                tracing::info!(adapter = name, created = n, "notifications from adapter");
            }
        }
        Err(e) => {
            if warned.insert(name) {
                tracing::warn!(adapter = name, error = %e, "notification adapter failed (will retry)");
            }
        }
    }
}
