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
    /// Tenants whose data is mirrored (gateway slugs).
    pub tenants: Vec<String>,
    pub trading_url: String,
    pub trading_token: String,
    pub wallet_url: String,
    pub wallet_token: String,
    pub gateway_url: String,
    pub gateway_token: String,
    pub ib_url: String,
    pub ib_token: String,
    pub prop_url: String,
    pub prop_token: String,
    pub market_data_url: String,
    pub market_data_admin_token: String,
    pub instruments_file: String,
    pub specs_file: String,
    /// Run the pollers and the scheduler (exactly one instance).
    pub workers: bool,
    pub sync_secs: u64,
    /// SMTP for scheduled reports (same variables as the gateway). Empty host = runs are logged, not emailed.
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub smtp_from: String,
    /// Legal name printed on statements.
    pub company_name: String,
    pub company_site: String,
    pub support_email: String,
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
            .field("tenants", &self.tenants)
            .field("trading_url", &self.trading_url)
            .field("trading_token", &redact(&self.trading_token))
            .field("wallet_url", &self.wallet_url)
            .field("wallet_token", &redact(&self.wallet_token))
            .field("gateway_url", &self.gateway_url)
            .field("gateway_token", &redact(&self.gateway_token))
            .field("ib_url", &self.ib_url)
            .field("ib_token", &redact(&self.ib_token))
            .field("prop_url", &self.prop_url)
            .field("prop_token", &redact(&self.prop_token))
            .field("market_data_url", &self.market_data_url)
            .field("market_data_admin_token", &redact(&self.market_data_admin_token))
            .field("workers", &self.workers)
            .field("sync_secs", &self.sync_secs)
            .field("smtp_host", &self.smtp_host)
            .field("smtp_port", &self.smtp_port)
            .field("smtp_user", &self.smtp_user)
            .field("smtp_password", &redact(&self.smtp_password))
            .field("smtp_from", &self.smtp_from)
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

fn url(key: &str, default: &str) -> String {
    var(key, default).trim_end_matches('/').to_string()
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("REPORTS_ENV", "development") != "production";
        let internal_token = var("REPORTS_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("REPORTS_INTERNAL_TOKEN is required in production");
        }
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        Ok(Self {
            bind: var("REPORTS_BIND", "127.0.0.1:8102"),
            database_url: var("REPORTS_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_reports"),
            internal_token,
            dev_mode,
            json_logs: var("REPORTS_LOG_FORMAT", "json") == "json",
            tenants: var("REPORTS_TENANTS", "kalks").split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            trading_url: url("TRADING_URL", "http://127.0.0.1:8090"),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            wallet_url: url("WALLET_URL", "http://127.0.0.1:8095"),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            gateway_url: url("GATEWAY_URL", "http://127.0.0.1:8080"),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            ib_url: url("IB_URL", "http://127.0.0.1:8096"),
            ib_token: var("IB_INTERNAL_TOKEN", ""),
            prop_url: url("PROP_URL", "http://127.0.0.1:8097"),
            prop_token: var("PROP_INTERNAL_TOKEN", ""),
            market_data_url: url("MARKET_DATA_URL", "http://127.0.0.1:8081"),
            market_data_admin_token: var("MARKET_DATA_ADMIN_TOKEN", ""),
            instruments_file: var("INSTRUMENTS_FILE", &format!("{root}/config/instruments.json")),
            specs_file: var("TRADING_SPECS_FILE", &format!("{root}/config/trading-specs.json")),
            workers: var("REPORTS_WORKERS", "true") != "false",
            sync_secs: var("REPORTS_SYNC_SECS", "30").parse::<u64>().unwrap_or(30).clamp(5, 3600),
            smtp_host: var("SMTP_HOST", ""),
            smtp_port: var("SMTP_PORT", "587").parse().unwrap_or(587),
            smtp_user: var("SMTP_USER", ""),
            smtp_password: var("SMTP_PASSWORD", ""),
            smtp_from: var("REPORTS_SMTP_FROM", &var("SMTP_FROM", "Kalks Reports <no-reply@kalkstrade.com>")),
            company_name: var("REPORTS_COMPANY_NAME", "Kalks"),
            company_site: var("REPORTS_COMPANY_SITE", "kalkstrade.com"),
            support_email: var("REPORTS_SUPPORT_EMAIL", "support@kalkstrade.com"),
        })
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn masks_database_password() {
        assert_eq!(super::redact_url("postgres://kalks:s3cret@127.0.0.1:5432/kalks_reports"), "postgres://kalks:***@127.0.0.1:5432/kalks_reports");
    }
}
