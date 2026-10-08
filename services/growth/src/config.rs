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
    pub gateway_url: String,
    pub gateway_token: String,
    pub trading_url: String,
    pub trading_token: String,
    pub wallet_url: String,
    pub wallet_token: String,
    pub notify_url: String,
    /// Support service token for `POST /v1/notify` (SUPPORT_INTERNAL_TOKEN).
    pub notify_token: String,
    /// Reports service (client lifecycle facts for journeys).
    pub reports_url: String,
    pub reports_token: String,
    pub instruments_file: String,
    /// Background loops. Tests turn them off.
    pub workers: bool,
    pub sync_secs: u64,
    pub deals_secs: u64,
    pub leaderboard_secs: u64,
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
            .field("notify_url", &self.notify_url)
            .field("notify_token", &redact(&self.notify_token))
            .field("reports_url", &self.reports_url)
            .field("reports_token", &redact(&self.reports_token))
            .field("instruments_file", &self.instruments_file)
            .field("workers", &self.workers)
            .field("sync_secs", &self.sync_secs)
            .field("deals_secs", &self.deals_secs)
            .field("leaderboard_secs", &self.leaderboard_secs)
            .finish()
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let production = var("GROWTH_ENV", "development") == "production";
        let internal_token = var("GROWTH_INTERNAL_TOKEN", "");
        if production && internal_token.is_empty() {
            anyhow::bail!("GROWTH_INTERNAL_TOKEN is required when GROWTH_ENV=production");
        }
        Ok(Self {
            bind: var("GROWTH_BIND", "127.0.0.1:8101"),
            database_url: var("GROWTH_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/ezymex_growth"),
            internal_token,
            production,
            gateway_url: var("GATEWAY_URL", "http://127.0.0.1:8080").trim_end_matches('/').to_string(),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095").trim_end_matches('/').to_string(),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            notify_url: var("NOTIFY_URL", "http://127.0.0.1:8100").trim_end_matches('/').to_string(),
            notify_token: var("SUPPORT_INTERNAL_TOKEN", &var("NOTIFY_INTERNAL_TOKEN", "")),
            reports_url: var("REPORTS_URL", "http://127.0.0.1:8102").trim_end_matches('/').to_string(),
            reports_token: var("REPORTS_INTERNAL_TOKEN", ""),
            instruments_file: var("INSTRUMENTS_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")),
            workers: var("GROWTH_WORKERS", "true") != "false",
            sync_secs: var("GROWTH_SYNC_SECS", "30").parse().unwrap_or(30).max(1),
            deals_secs: var("GROWTH_DEALS_SECS", "5").parse().unwrap_or(5).max(1),
            leaderboard_secs: var("GROWTH_LEADERBOARD_SECS", "15").parse().unwrap_or(15).max(2),
            log_json: var("GROWTH_LOG_FORMAT", "json") == "json",
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
            notify_url: "http://127.0.0.1:9".into(),
            notify_token: String::new(),
            reports_url: "http://127.0.0.1:9".into(),
            reports_token: String::new(),
            instruments_file: concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json").into(),
            workers: false,
            sync_secs: 30,
            deals_secs: 5,
            leaderboard_secs: 15,
            log_json: false,
        }
    }
}
