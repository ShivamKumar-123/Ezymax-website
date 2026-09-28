use std::env;
use std::fmt;

/// Runtime configuration (env vars; `.env.local` at the repo root is loaded in development).
/// `Debug` is implemented by hand so secrets (`infoway_key`, `admin_token`) never reach logs.
#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub bind: String,
    pub infoway_key: String,
    pub infoway_rest: String,
    pub infoway_ws: String,
    /// Max provider REST requests per second (keep under the plan limit).
    pub provider_rps: f64,
    pub instruments_file: String,
    /// Archive every tick into `ticks` (large table — can be turned off).
    pub store_ticks: bool,
    /// Days of history to backfill per timeframe (M1, M5, M15, M30, H1).
    pub backfill_days: [(i32, i64); 5],
    /// Oldest date for provider daily history (used before our H1 coverage).
    pub backfill_daily_from: String,
    /// Bearer token for admin endpoints (spread markups). Empty = admin API disabled.
    pub admin_token: String,
}

/// Shows whether a secret is set without printing it.
/// Masks the password in a connection URL (`postgres://user:secret@host` → `postgres://user:***@host`).
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

fn redact(v: &str) -> &'static str {
    if v.is_empty() {
        "<empty>"
    } else {
        "<redacted>"
    }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("database_url", &redact_url(&self.database_url))
            .field("bind", &self.bind)
            .field("infoway_key", &redact(&self.infoway_key))
            .field("infoway_rest", &self.infoway_rest)
            .field("infoway_ws", &self.infoway_ws)
            .field("provider_rps", &self.provider_rps)
            .field("instruments_file", &self.instruments_file)
            .field("store_ticks", &self.store_ticks)
            .field("backfill_days", &self.backfill_days)
            .field("backfill_daily_from", &self.backfill_daily_from)
            .field("admin_token", &redact(&self.admin_token))
            .finish()
    }
}

fn var(k: &str, d: &str) -> String {
    env::var(k).unwrap_or_else(|_| d.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let infoway_key = env::var("INFOWAY_API_KEY").map_err(|_| anyhow::anyhow!("INFOWAY_API_KEY is not set (add it to .env.local)"))?;
        Ok(Self {
            database_url: var("DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks"),
            bind: var("MARKET_DATA_BIND", "127.0.0.1:8081"),
            infoway_key,
            infoway_rest: var("INFOWAY_REST_URL", "https://data.infoway.io"),
            infoway_ws: var("INFOWAY_WS_URL", "wss://data.infoway.io/ws"),
            provider_rps: var("INFOWAY_RPS", "1").parse().unwrap_or(1.0),
            instruments_file: var("INSTRUMENTS_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")),
            store_ticks: var("STORE_TICKS", "true") == "true",
            backfill_days: [
                (1, var("BACKFILL_DAYS_M1", "14").parse().unwrap_or(14)),
                (5, var("BACKFILL_DAYS_M5", "60").parse().unwrap_or(60)),
                (15, var("BACKFILL_DAYS_M15", "180").parse().unwrap_or(180)),
                (30, var("BACKFILL_DAYS_M30", "365").parse().unwrap_or(365)),
                (60, var("BACKFILL_DAYS_H1", "1095").parse().unwrap_or(1095)),
            ],
            backfill_daily_from: var("BACKFILL_DAILY_FROM", "2012-01-01"),
            admin_token: var("MARKET_DATA_ADMIN_TOKEN", ""),
        })
    }
}
