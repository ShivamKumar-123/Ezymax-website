use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;
use crate::mailer::Mailer;
use crate::specs::Specs;
use crate::upstream::Upstream;

pub struct Svc {
    pub cfg: Config,
    pub pool: PgPool,
    pub up: Upstream,
    pub specs: Specs,
    pub mailer: Option<Mailer>,
    /// Per-login lock so an on-demand sync and the poller never mirror the same account at once.
    pub sync_locks: tokio::sync::Mutex<std::collections::HashMap<(String, i64), Arc<tokio::sync::Mutex<()>>>>,
}

pub type App = Arc<Svc>;

impl Svc {
    pub fn new(cfg: Config, pool: PgPool) -> Self {
        let specs = Specs::load(&cfg.instruments_file, &cfg.specs_file).unwrap_or_else(|e| {
            tracing::warn!(error = %e, "instrument specs not loaded; spread cost estimates will be 0");
            Specs::default()
        });
        let mailer = if cfg.smtp_host.is_empty() {
            None
        } else {
            match Mailer::new(&cfg) {
                Ok(m) => Some(m),
                Err(e) => {
                    tracing::warn!(error = %e, "SMTP not usable; scheduled reports are logged only");
                    None
                }
            }
        };
        Self { up: Upstream::new(&cfg), cfg, pool, specs, mailer, sync_locks: Default::default() }
    }

    pub async fn lock_for(&self, tenant: &str, login: i64) -> Arc<tokio::sync::Mutex<()>> {
        let mut m = self.sync_locks.lock().await;
        m.entry((tenant.to_string(), login)).or_default().clone()
    }
}
