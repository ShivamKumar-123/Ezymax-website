use std::env;
use std::fmt;

/// Runtime configuration (env vars; the repo-root `.env.local` is loaded in development).
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret callers send in `X-Ezymex-Internal`. Empty = check disabled (development only).
    pub internal_token: String,
    pub production: bool,
    /// Gateway: the client's KYC status and restrictions (`GET /v1/internal/users/{id}`).
    pub gateway_url: String,
    pub gateway_token: String,
    pub wallet_url: String,
    pub wallet_token: String,
    pub notify_url: String,
    /// Support service token for `POST /v1/notify` (SUPPORT_INTERNAL_TOKEN).
    pub notify_token: String,
    /// Currencies the wallet holds; a plan can only be offered in one of them.
    pub currencies: Vec<String>,
    /// Background loops (subscription reconciler, settlement transfers, maturities). Tests turn them off.
    pub workers: bool,
    pub tick_secs: u64,
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
            .field("wallet_url", &self.wallet_url)
            .field("wallet_token", &redact(&self.wallet_token))
            .field("notify_url", &self.notify_url)
            .field("notify_token", &redact(&self.notify_token))
            .field("currencies", &self.currencies)
            .field("workers", &self.workers)
            .field("tick_secs", &self.tick_secs)
            .finish()
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let production = var("STAKING_ENV", "development") == "production";
        let internal_token = var("STAKING_INTERNAL_TOKEN", "");
        if production && internal_token.is_empty() {
            anyhow::bail!("STAKING_INTERNAL_TOKEN is required when STAKING_ENV=production");
        }
        let currencies = var("STAKING_CURRENCIES", "USDT").split(',').map(|c| c.trim().to_uppercase()).filter(|c| !c.is_empty()).collect();
        Ok(Self {
            bind: var("STAKING_BIND", "127.0.0.1:8105"),
            database_url: var("STAKING_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/ezymex_staking"),
            internal_token,
            production,
            gateway_url: var("GATEWAY_URL", "http://127.0.0.1:8080").trim_end_matches('/').to_string(),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095").trim_end_matches('/').to_string(),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            notify_url: var("NOTIFY_URL", "http://127.0.0.1:8100").trim_end_matches('/').to_string(),
            notify_token: var("SUPPORT_INTERNAL_TOKEN", &var("NOTIFY_INTERNAL_TOKEN", "")),
            currencies,
            workers: var("STAKING_WORKERS", "true") != "false",
            tick_secs: var("STAKING_TICK_SECS", "20").parse().unwrap_or(20).max(2),
            log_json: var("STAKING_LOG_FORMAT", "json") == "json",
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
            wallet_url: "http://127.0.0.1:9".into(),
            wallet_token: String::new(),
            notify_url: "http://127.0.0.1:9".into(),
            notify_token: String::new(),
            currencies: vec!["USDT".into()],
            workers: false,
            tick_secs: 20,
            log_json: false,
        }
    }
}
