use std::env;
use std::fmt;

/// Runtime configuration from env vars (the repo-root `.env.local` and `.env.claude` are loaded in
/// development). `Debug` is written by hand so secrets never reach logs.
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret the BFFs send in `X-Kalks-Internal`. Empty = check disabled (development only).
    pub internal_token: String,
    /// HMAC master key for API key secrets and webhook tokens.
    pub key_secret: String,
    pub dev_mode: bool,
    pub json_logs: bool,
    /// Run the runtime, backtest workers and renewals (exactly one instance in production).
    pub workers: bool,
    pub backtest_workers: usize,
    pub backtest_secs: u64,
    pub trading_url: String,
    pub trading_token: String,
    pub market_data_url: String,
    pub wallet_url: String,
    pub wallet_token: String,
    pub anthropic_key: String,
    pub ai_model: String,
    pub instruments_file: String,
    pub specs_file: String,
    /// Public base URL shown for webhook endpoints and the REST API (e.g. https://api.kalkstrade.com/algo).
    pub public_url: String,
}

pub fn redact_url(url: &str) -> String {
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

fn redact(v: &str) -> &'static str {
    if v.is_empty() { "<empty>" } else { "<redacted>" }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("bind", &self.bind)
            .field("database_url", &redact_url(&self.database_url))
            .field("internal_token", &redact(&self.internal_token))
            .field("key_secret", &redact(&self.key_secret))
            .field("dev_mode", &self.dev_mode)
            .field("workers", &self.workers)
            .field("backtest_workers", &self.backtest_workers)
            .field("backtest_secs", &self.backtest_secs)
            .field("trading_url", &self.trading_url)
            .field("trading_token", &redact(&self.trading_token))
            .field("market_data_url", &self.market_data_url)
            .field("wallet_url", &self.wallet_url)
            .field("wallet_token", &redact(&self.wallet_token))
            .field("anthropic_key", &redact(&self.anthropic_key))
            .field("ai_model", &self.ai_model)
            .field("public_url", &self.public_url)
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).map(|v| v.trim().to_string()).unwrap_or_else(|| default.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("ALGO_ENV", "development") != "production";
        let internal_token = var("ALGO_INTERNAL_TOKEN", "");
        let key_secret = var("ALGO_KEY_SECRET", "");
        if !dev_mode && internal_token.is_empty() {
            anyhow::bail!("ALGO_INTERNAL_TOKEN is required in production");
        }
        if !dev_mode && key_secret.len() < 32 {
            anyhow::bail!("ALGO_KEY_SECRET (at least 32 characters) is required in production");
        }
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        Ok(Self {
            bind: var("ALGO_BIND", "127.0.0.1:8099"),
            database_url: var("ALGO_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_algo"),
            internal_token,
            key_secret: if key_secret.is_empty() { "kalks-algo-development-key-secret-not-for-production".into() } else { key_secret },
            dev_mode,
            json_logs: var("ALGO_LOG_FORMAT", "json") == "json",
            workers: var("ALGO_WORKERS", "true") != "false",
            backtest_workers: var("ALGO_BACKTEST_WORKERS", "2").parse().unwrap_or(2usize).clamp(1, 16),
            backtest_secs: var("ALGO_BACKTEST_SECS", "120").parse().unwrap_or(120u64).clamp(10, 1800),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            market_data_url: var("MARKET_DATA_URL", "http://127.0.0.1:8081").trim_end_matches('/').to_string(),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095").trim_end_matches('/').to_string(),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            anthropic_key: var("ANTHROPIC_API_KEY", ""),
            ai_model: var("ALGO_AI_MODEL", "claude-opus-5-5"),
            instruments_file: var("INSTRUMENTS_FILE", &format!("{root}/config/instruments.json")),
            specs_file: var("TRADING_SPECS_FILE", &format!("{root}/config/trading-specs.json")),
            public_url: var("ALGO_PUBLIC_URL", "http://127.0.0.1:8099").trim_end_matches('/').to_string(),
        })
    }
}
