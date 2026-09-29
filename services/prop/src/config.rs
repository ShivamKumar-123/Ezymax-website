use std::env;
use std::fmt;

/// Runtime configuration (env vars; the repo-root `.env.local` is loaded in development).
/// `Debug` is written by hand so secrets never reach the logs.
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret the BFFs send in `X-Kalks-Internal`. Empty = check disabled (dev only).
    pub internal_token: String,
    pub dev_mode: bool,
    pub json_logs: bool,
    pub trading_url: String,
    pub trading_token: String,
    pub wallet_url: String,
    pub wallet_token: String,
    /// Optional read-only connection to the gateway database for `users.kyc_status` (payout gate).
    pub gateway_database_url: String,
    /// Rule evaluator polling interval (ms).
    pub poll_ms: u64,
    /// Parallel engine requests per evaluator pass.
    pub poll_concurrency: usize,
    /// Run the evaluator (only one prop instance may do this).
    pub evaluator_enabled: bool,
    /// Public base URL of the certificate verify page, e.g. https://app.kalkstrade.com/verify
    pub verify_base_url: String,
    /// Support / notifications service (`POST /v1/notify`). Empty = the prop inbox only.
    pub support_url: String,
    pub support_token: String,
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
            .field("dev_mode", &self.dev_mode)
            .field("trading_url", &self.trading_url)
            .field("trading_token", &redact(&self.trading_token))
            .field("wallet_url", &self.wallet_url)
            .field("wallet_token", &redact(&self.wallet_token))
            .field("gateway_database_url", &redact_url(&self.gateway_database_url))
            .field("poll_ms", &self.poll_ms)
            .field("poll_concurrency", &self.poll_concurrency)
            .field("evaluator_enabled", &self.evaluator_enabled)
            .field("verify_base_url", &self.verify_base_url)
            .field("support_url", &self.support_url)
            .field("support_token", &redact(&self.support_token))
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("PROP_ENV", "development") != "production";
        let internal_token = var("PROP_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("PROP_INTERNAL_TOKEN is required in production");
        }
        Ok(Self {
            bind: var("PROP_BIND", "127.0.0.1:8097"),
            database_url: var("PROP_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_prop"),
            internal_token,
            dev_mode,
            json_logs: var("PROP_LOG_FORMAT", "json") == "json",
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095").trim_end_matches('/').to_string(),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            gateway_database_url: var("PROP_GATEWAY_DATABASE_URL", &var("GATEWAY_DATABASE_URL", "")),
            poll_ms: var("PROP_POLL_MS", "1000").parse::<u64>().unwrap_or(1000).clamp(200, 60_000),
            poll_concurrency: var("PROP_POLL_CONCURRENCY", "16").parse::<usize>().unwrap_or(16).clamp(1, 128),
            evaluator_enabled: var("PROP_EVALUATOR", "true") != "false",
            verify_base_url: var("PROP_VERIFY_BASE_URL", "http://localhost:3000/verify").trim_end_matches('/').to_string(),
            support_url: var("SUPPORT_URL", "http://127.0.0.1:8100").trim().trim_end_matches('/').to_string(),
            support_token: var("SUPPORT_INTERNAL_TOKEN", "").trim().to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn masks_database_password() {
        assert_eq!(super::redact_url("postgres://kalks:s3cret@127.0.0.1:5432/kalks_prop"), "postgres://kalks:***@127.0.0.1:5432/kalks_prop");
    }
}
