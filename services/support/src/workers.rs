//! Background loops: the email outbox, SLA breach sweeps and the polling adapters.

use crate::{adapters, chat, notify};
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
