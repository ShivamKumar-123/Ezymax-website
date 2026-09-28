use std::env;
use std::fmt;

/// Runtime configuration (env vars; the repo-root `.env.local` is loaded in development).
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret callers send in `X-Kalks-Internal`. Empty = check disabled (development only).
    pub internal_token: String,
    pub production: bool,
    pub gateway_url: String,
    pub gateway_token: String,
    pub trading_url: String,
    pub trading_token: String,
    pub wallet_url: String,
    pub wallet_token: String,
    pub instruments_file: String,
    /// Background loops (sync, deals, deposits, batches, payouts, levels). Tests turn them off.
    pub workers: bool,
    pub sync_secs: u64,
    pub deals_secs: u64,
    pub log_json: bool,
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

fn redact(v: &str) -> &'static str {
    if v.is_empty() { "<empty>" } else { "<redacted>" }
}

fn redact_url(url: &str) -> String {
    match (url.find("://"), url.rfind('@')) {
        (Some(s), Some(at)) if at > s + 3 => {
            let creds = &url[s + 3..at];
            match creds.find(':') {
                Some(c) => format!("{}{}:***{}", &url[..s + 3], &creds[..c], &url[at..]),
                None => url.to_string(),
            }
        }
        _ => url.to_string(),
    }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("bind", &self.bind)
            .field("database_url", &redact_url(&self.database_url))
            .field("internal_token", &redact(&self.internal_token))
            .field("production", &self.production)
            .field("gateway_url", &self.gateway_url)
            .field("gateway_token", &redact(&self.gateway_token))
            .field("trading_url", &self.trading_url)
            .field("trading_token", &redact(&self.trading_token))
            .field("wallet_url", &self.wallet_url)
            .field("wallet_token", &redact(&self.wallet_token))
            .field("instruments_file", &self.instruments_file)
            .field("workers", &self.workers)
            .field("sync_secs", &self.sync_secs)
            .field("deals_secs", &self.deals_secs)
            .finish()
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let production = var("IB_ENV", "development") == "production";
        let internal_token = var("IB_INTERNAL_TOKEN", "");
        if production && internal_token.is_empty() {
            anyhow::bail!("IB_INTERNAL_TOKEN is required when IB_ENV=production");
        }
        Ok(Self {
            bind: var("IB_BIND", "127.0.0.1:8096"),
            database_url: var("IB_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_ib"),
            internal_token,
            production,
            gateway_url: var("GATEWAY_URL", "http://127.0.0.1:8080").trim_end_matches('/').to_string(),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095").trim_end_matches('/').to_string(),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            instruments_file: var("INSTRUMENTS_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")),
            workers: var("IB_WORKERS", "true") != "false",
            sync_secs: var("IB_SYNC_SECS", "10").parse().unwrap_or(10).max(1),
            deals_secs: var("IB_DEALS_SECS", "5").parse().unwrap_or(5).max(1),
            log_json: var("IB_LOG_FORMAT", "json") == "json",
        })
    }

    /// Configuration for tests: no workers, no upstream services.
    pub fn for_tests(database_url: &str) -> Self {
        Self {
            bind: String::new(),
            database_url: database_url.to_string(),
            internal_token: String::new(),
            production: false,
            gateway_url: "http://127.0.0.1:9".into(),
            gateway_token: String::new(),
            trading_url: "http://127.0.0.1:9".into(),
            trading_token: String::new(),
            wallet_url: "http://127.0.0.1:9".into(),
            wallet_token: String::new(),
            instruments_file: concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json").into(),
            workers: false,
            sync_secs: 10,
            deals_secs: 5,
            log_json: false,
        }
    }
}
