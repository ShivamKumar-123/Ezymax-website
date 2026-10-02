use std::env;
use std::fmt;

/// Runtime configuration (env vars; `.env.local` at the repo root is loaded in development).
/// `Debug` is implemented by hand so secrets never reach logs.
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret the BFFs / internal services send in `X-Kalks-Internal`. Empty = check disabled (dev only).
    pub internal_token: String,
    /// HMAC key for terminal session / SSO / stream-ticket hashes (>= 32 chars).
    pub session_secret: String,
    pub dev_mode: bool,
    /// market-data WebSocket, e.g. ws://127.0.0.1:8081/v1/stream (`?group=` is appended per spread group).
    pub market_data_ws: String,
    pub instruments_file: String,
    pub specs_file: String,
    /// Number of account shards (one single-writer task each).
    pub shards: usize,
    /// Quotes older than this are not tradable (0 = no check).
    pub max_quote_age_ms: i64,
    pub session_ttl_hours: i64,
    pub json_logs: bool,
    /// Run swap rollovers (only one engine instance may do this).
    pub rollover_enabled: bool,
    /// Wallet service base URL (copy allocations, PAMM invest / redeem, fee payouts).
    pub wallet_url: String,
    pub wallet_token: String,
    /// IB service (PAMM lots allocated to investors, D64).
    pub ib_url: String,
    pub ib_token: String,
    /// Gateway (client restrictions, Kalks Trader presence; controls.rs).
    pub gateway_url: String,
    pub gateway_token: String,
    /// Kalks FX Options service (snapshot, fixings; src/options). Empty = options off in the engine.
    pub options_url: String,
    pub options_token: String,
    /// House delta hedger (src/options/hedger.rs): on unless `OPTIONS_HEDGER=false`.
    pub options_hedger: bool,
    /// The house user that owns the per-tenant hedge accounts.
    pub options_hedge_user: i64,
    /// Group of the hedge accounts (a normal live USD group).
    pub options_hedge_group: String,
    /// House capital booked on a new hedge account (USD).
    pub options_hedge_capital: i64,
    /// Net delta (USD notional) the house carries per underlying before it hedges.
    pub options_hedge_limit_usd: i64,
}

/// Masks the password in a connection URL (`postgres://user:secret@host` → `postgres://user:***@host`).
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
            .field("session_secret", &redact(&self.session_secret))
            .field("dev_mode", &self.dev_mode)
            .field("market_data_ws", &redact_url(&self.market_data_ws))
            .field("instruments_file", &self.instruments_file)
            .field("specs_file", &self.specs_file)
            .field("shards", &self.shards)
            .field("max_quote_age_ms", &self.max_quote_age_ms)
            .field("session_ttl_hours", &self.session_ttl_hours)
            .field("json_logs", &self.json_logs)
            .field("rollover_enabled", &self.rollover_enabled)
            .field("wallet_url", &redact_url(&self.wallet_url))
            .field("wallet_token", &redact(&self.wallet_token))
            .field("ib_url", &redact_url(&self.ib_url))
            .field("ib_token", &redact(&self.ib_token))
            .field("gateway_url", &redact_url(&self.gateway_url))
            .field("gateway_token", &redact(&self.gateway_token))
            .field("options_url", &redact_url(&self.options_url))
            .field("options_token", &redact(&self.options_token))
            .field("options_hedger", &self.options_hedger)
            .field("options_hedge_user", &self.options_hedge_user)
            .field("options_hedge_group", &self.options_hedge_group)
            .field("options_hedge_capital", &self.options_hedge_capital)
            .field("options_hedge_limit_usd", &self.options_hedge_limit_usd)
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

impl Config {
    /// A configuration for tests and tools: development defaults, nothing external configured.
    pub fn for_tests(database_url: &str) -> Self {
        Self {
            bind: String::new(),
            database_url: database_url.to_string(),
            internal_token: String::new(),
            session_secret: "s".repeat(40),
            dev_mode: true,
            market_data_ws: String::new(),
            instruments_file: String::new(),
            specs_file: String::new(),
            shards: 1,
            max_quote_age_ms: 0,
            session_ttl_hours: 12,
            json_logs: false,
            rollover_enabled: false,
            wallet_url: String::new(),
            wallet_token: String::new(),
            ib_url: String::new(),
            ib_token: String::new(),
            gateway_url: String::new(),
            gateway_token: String::new(),
            options_url: String::new(),
            options_token: String::new(),
            options_hedger: false,
            options_hedge_user: 0,
            options_hedge_group: "standard".into(),
            options_hedge_capital: 1_000_000,
            options_hedge_limit_usd: 250_000,
        }
    }

    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("TRADING_ENV", "development") != "production";
        let session_secret = var("TRADING_SESSION_SECRET", "");
        if session_secret.len() < 32 {
            anyhow::bail!("TRADING_SESSION_SECRET must be set to at least 32 characters");
        }
        let internal_token = var("TRADING_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("TRADING_INTERNAL_TOKEN is required in production");
        }
        Ok(Self {
            bind: var("TRADING_BIND", "127.0.0.1:8090"),
            database_url: var("TRADING_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_trading"),
            internal_token,
            session_secret,
            dev_mode,
            market_data_ws: var("MARKET_DATA_WS_URL", "ws://127.0.0.1:8081/v1/stream"),
            instruments_file: var("INSTRUMENTS_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")),
            specs_file: var("TRADING_SPECS_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/trading-specs.json")),
            shards: var("TRADING_SHARDS", "8").parse::<usize>().unwrap_or(8).clamp(1, 256),
            max_quote_age_ms: var("TRADING_MAX_QUOTE_AGE_SECS", "300").parse::<i64>().unwrap_or(300).max(0) * 1000,
            session_ttl_hours: var("TRADING_SESSION_TTL_HOURS", "12").parse().unwrap_or(12),
            json_logs: var("TRADING_LOG_FORMAT", "json") == "json",
            rollover_enabled: var("TRADING_ROLLOVER", "true") != "false",
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095"),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            ib_url: var("IB_URL", "http://127.0.0.1:8096"),
            ib_token: var("IB_INTERNAL_TOKEN", ""),
            gateway_url: var("GATEWAY_URL", "http://127.0.0.1:8080"),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            options_url: var("OPTIONS_URL", ""),
            options_token: var("OPTIONS_INTERNAL_TOKEN", ""),
            options_hedger: var("OPTIONS_HEDGER", "true") != "false",
            options_hedge_user: var("OPTIONS_HEDGE_USER_ID", "0").parse().unwrap_or(0),
            options_hedge_group: var("OPTIONS_HEDGE_GROUP", "standard"),
            options_hedge_capital: var("OPTIONS_HEDGE_CAPITAL", "1000000").parse().unwrap_or(1_000_000),
            options_hedge_limit_usd: var("OPTIONS_HEDGE_LIMIT_USD", "250000").parse().unwrap_or(250_000),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::redact_url;

    #[test]
    fn masks_database_password() {
        assert_eq!(redact_url("postgres://kalks:s3cret@127.0.0.1:5432/kalks_trading"), "postgres://kalks:***@127.0.0.1:5432/kalks_trading");
        assert_eq!(redact_url("postgres://postgres@127.0.0.1:5433/kalks_trading"), "postgres://postgres@127.0.0.1:5433/kalks_trading");
    }
}
