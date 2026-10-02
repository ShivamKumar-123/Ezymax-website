use std::env;
use std::fmt;

/// Runtime configuration (env vars; the repo-root `.env.local` is loaded in development).
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret the BFFs and the trading engine send in `X-Kalks-Internal`. Empty = check disabled
    /// (development only; required in production).
    pub internal_token: String,
    pub dev_mode: bool,
    pub json_logs: bool,
    /// Background jobs (feed, series, TWAP, fixings, realized vol, EOD marks). Off in tests.
    pub workers: bool,
    /// market-data REST base (candles, quote fallback).
    pub market_data_url: String,
    /// market-data WebSocket (`?group=raw` is appended): raw mids, no client spread.
    pub market_data_ws: String,
    /// Directory with `{CALENDAR}.json` holiday seeds (config/holidays).
    pub holidays_dir: String,
    /// TWAP fixings below this sample coverage fall back to M1 candles.
    pub min_twap_coverage: f64,
    /// The engine treats a snapshot older than this as stale (options go close-only); published in the snapshot.
    pub snapshot_stale_secs: u64,
    /// Trading engine REST base (order book feed: `/v1/internal/options/book/*`, docs/OPTIONS-EXCHANGE.md §10).
    pub trading_url: String,
    /// The engine's `TRADING_INTERNAL_TOKEN`, sent as `X-Kalks-Internal` to the book feed.
    pub trading_token: String,
    /// Consume the engine's order book feed (with `workers`). Off = house model quotes only.
    pub book_feed: bool,
    /// LOCAL TESTING ONLY (`OPTIONS_TEST_EXPIRIES=1`, ignored when `OPTIONS_ENV=production`): exposes
    /// `POST /v1/admin/options/test/expiries`, which lists an ad-hoc expiry whose cut is minutes ahead so a real
    /// TWAP fixing can run on live prices outside the 14:00 UTC cut (services/trading/tests/expiry_e2e.rs).
    pub test_expiries: bool,
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
            .field("internal_token", &if self.internal_token.is_empty() { "<empty>" } else { "<redacted>" })
            .field("dev_mode", &self.dev_mode)
            .field("workers", &self.workers)
            .field("market_data_url", &self.market_data_url)
            .field("market_data_ws", &redact_url(&self.market_data_ws))
            .field("holidays_dir", &self.holidays_dir)
            .field("min_twap_coverage", &self.min_twap_coverage)
            .field("snapshot_stale_secs", &self.snapshot_stale_secs)
            .field("trading_url", &redact_url(&self.trading_url))
            .field("trading_token", &if self.trading_token.is_empty() { "<empty>" } else { "<redacted>" })
            .field("book_feed", &self.book_feed)
            .field("test_expiries", &self.test_expiries)
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

fn flag(key: &str, default: bool) -> bool {
    matches!(var(key, if default { "true" } else { "false" }).to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on")
}

/// `postgres://.../kalks_core?x` -> `postgres://.../<db>?x`.
pub fn sibling_database(url: &str, db: &str) -> Option<String> {
    let i = url.rfind('/')?;
    if i <= url.find("://").map(|x| x + 2).unwrap_or(0) {
        return None;
    }
    let (base, tail) = url.split_at(i);
    let q = tail.find('?').map(|j| &tail[j..]).unwrap_or("");
    Some(format!("{base}/{db}{q}"))
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("OPTIONS_ENV", "development") != "production";
        let internal_token = var("OPTIONS_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("OPTIONS_INTERNAL_TOKEN is required in production");
        }
        // default: same server/credentials as the gateway, database kalks_options
        let database_url = match env::var("OPTIONS_DATABASE_URL").ok().filter(|v| !v.trim().is_empty()) {
            Some(u) => u,
            None => sibling_database(&var("GATEWAY_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_core"), "kalks_options")
                .unwrap_or_else(|| "postgres://postgres@127.0.0.1:5433/kalks_options".into()),
        };
        let default_holidays = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/holidays");
        let test_expiries = flag("OPTIONS_TEST_EXPIRIES", false);
        if test_expiries && !dev_mode {
            eprintln!("OPTIONS_TEST_EXPIRIES is ignored in production");
        }
        Ok(Self {
            bind: var("OPTIONS_BIND", "127.0.0.1:8104"),
            database_url,
            internal_token,
            dev_mode,
            json_logs: var("OPTIONS_LOG_FORMAT", if dev_mode { "text" } else { "json" }) == "json",
            workers: flag("OPTIONS_WORKERS", true),
            market_data_url: var("MARKET_DATA_URL", "http://127.0.0.1:8081").trim_end_matches('/').to_string(),
            market_data_ws: var("MARKET_DATA_WS_URL", "ws://127.0.0.1:8081/v1/stream"),
            holidays_dir: var("OPTIONS_HOLIDAYS_DIR", default_holidays),
            min_twap_coverage: var("OPTIONS_MIN_TWAP_COVERAGE", "0.5").parse().unwrap_or(0.5f64).clamp(0.0, 1.0),
            snapshot_stale_secs: var("OPTIONS_SNAPSHOT_STALE_SECS", "300").parse().unwrap_or(300).max(30),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            book_feed: flag("OPTIONS_BOOK_FEED", true),
            test_expiries: test_expiries && dev_mode,
        })
    }

    /// Minimal config for tests (no workers, no external services).
    pub fn for_tests(database_url: &str) -> Self {
        Self {
            bind: "127.0.0.1:0".into(),
            database_url: database_url.into(),
            internal_token: "test-token".into(),
            dev_mode: true,
            json_logs: false,
            workers: false,
            market_data_url: "http://127.0.0.1:9".into(),
            market_data_ws: "ws://127.0.0.1:9/v1/stream".into(),
            holidays_dir: concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/holidays").into(),
            min_twap_coverage: 0.5,
            snapshot_stale_secs: 300,
            trading_url: "http://127.0.0.1:9".into(),
            trading_token: String::new(),
            book_feed: false,
            test_expiries: false,
        }
    }
}
