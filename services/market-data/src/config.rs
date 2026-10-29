use std::env;
use std::fmt;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

/// The provider keys this broker may use, in order of preference, and the one last known to work.
///
/// A key stops answering in one of two ways: another platform is holding its one connection for that business
/// (429), or its owner revokes it (401). Either way the key will not come back by itself, so a stream that keeps
/// retrying the same one stays down until someone notices - which has meant 25 to 45 minutes of a frozen chart.
/// Each stream therefore walks the list instead.
///
/// `good` is the key a stream last connected with. The REST backfill has no handshake of its own to learn from,
/// so it reads `good` and follows whichever key the streams found, without being told.
pub struct Keys {
    all: Vec<String>,
    good: AtomicUsize,
}

impl Keys {
    /// The first entry is the primary; the rest are tried in order. Empty entries are dropped.
    pub fn new(all: Vec<String>) -> Self {
        let all: Vec<String> = all.into_iter().map(|k| k.trim().to_string()).filter(|k| !k.is_empty()).collect();
        Self { all, good: AtomicUsize::new(0) }
    }

    pub fn len(&self) -> usize {
        self.all.len()
    }

    /// The key at `i`, wrapping, so a caller can walk forward without bounds checks.
    pub fn at(&self, i: usize) -> &str {
        if self.all.is_empty() { "" } else { &self.all[i % self.all.len()] }
    }

    /// The key a stream last connected with; where a newcomer starts.
    pub fn good(&self) -> usize {
        self.good.load(Ordering::Relaxed)
    }

    pub fn mark_good(&self, i: usize) {
        if !self.all.is_empty() {
            self.good.store(i % self.all.len(), Ordering::Relaxed);
        }
    }

    /// What REST callers send. Not a reservation: a key can go bad between this call and the request.
    pub fn current(&self) -> &str {
        self.at(self.good())
    }
}

impl fmt::Debug for Keys {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Keys({} configured, using #{})", self.all.len(), self.good())
    }
}

/// Runtime configuration (env vars; `.env.local` at the repo root is loaded in development).
/// `Debug` is implemented by hand so secrets (the provider keys, `admin_token`) never reach logs.
#[derive(Clone)]
pub struct Config {
    /// Take crypto prices straight from Binance rather than through the provider (`binance.rs`).
    pub binance_enabled: bool,
    pub binance_ws: String,
    pub database_url: String,
    pub bind: String,
    /// The provider keys, primary first (INFOWAY_API_KEY, then INFOWAY_API_KEY_FALLBACKS).
    pub keys: Arc<Keys>,
    pub infoway_rest: String,
    pub infoway_ws: String,
    /// Relay mode (development): take quotes from another Ezymex market-data stream instead of the provider,
    /// e.g. wss://api.ezymex.com/v1/stream. The provider allows one connection per key, so only
    /// production connects to it. Backfill and reconciliation are off in relay mode.
    pub upstream: String,
    /// Max provider REST requests per second (keep under the plan limit).
    pub provider_rps: f64,
    pub instruments_file: String,
    /// Archive every tick into `ticks` (large table — can be turned off).
    pub store_ticks: bool,
    /// Hours of archived ticks kept (older ones are deleted hourly in small batches); 0 = keep forever.
    pub ticks_retention_hours: i64,
    /// Days of history to backfill per timeframe (M1, M5, M15, M30, H1).
    pub backfill_days: [(i32, i64); 5],
    /// Oldest date for provider daily history (used before our H1 coverage).
    pub backfill_daily_from: String,
    /// Bearer token for admin endpoints (spread markups). Empty = admin API disabled.
    pub admin_token: String,
    /// Holiday calendars (config/holidays; exchange calendars in its `exchanges` folder).
    pub holidays_dir: String,
    /// Symbols streamed whatever the demand (`MARKET_DATA_ALWAYS_ON`, comma-separated; empty = the core
    /// instruments, `none` = no always-on set).
    pub always_on: Option<Vec<String>>,
    /// Plan limits of the provider stream (demand.rs): symbols per market connection and in total (0 = none).
    pub max_symbols_per_market: usize,
    pub max_symbols_by_market: Vec<(String, usize)>,
    pub max_symbols_total: usize,
    /// How long a symbol nobody wants any more stays subscribed.
    pub idle_grace_secs: u64,
    /// Codes per batch REST request (klines of several symbols at once).
    pub batch_codes: usize,
    /// Delayed price snapshot of every catalogue symbol that is not streamed, every N seconds (0 = off).
    pub snapshot_every_secs: u64,
    /// Provider markets (WebSocket "business") this service may stream (`INFOWAY_MARKETS`). Instruments of other
    /// markets (e.g. `japan` until the plan is confirmed to stream it) get history and delayed prices over REST only.
    pub markets: Vec<String>,
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
            .field("keys", &self.keys)
            .field("infoway_rest", &self.infoway_rest)
            .field("infoway_ws", &self.infoway_ws)
            .field("upstream", &self.upstream)
            .field("provider_rps", &self.provider_rps)
            .field("instruments_file", &self.instruments_file)
            .field("store_ticks", &self.store_ticks)
            .field("backfill_days", &self.backfill_days)
            .field("backfill_daily_from", &self.backfill_daily_from)
            .field("admin_token", &redact(&self.admin_token))
            .field("holidays_dir", &self.holidays_dir)
            .field("always_on", &self.always_on.as_ref().map(|v| v.len()))
            .field("max_symbols_per_market", &self.max_symbols_per_market)
            .field("max_symbols_by_market", &self.max_symbols_by_market)
            .field("max_symbols_total", &self.max_symbols_total)
            .field("idle_grace_secs", &self.idle_grace_secs)
            .field("batch_codes", &self.batch_codes)
            .field("snapshot_every_secs", &self.snapshot_every_secs)
            .field("markets", &self.markets)
            .finish()
    }
}

/// Symbols per provider market connection on the current plan (see README "Plan limits").
/// Premium plan (2026-10): 600 symbols per connection, 800 over all connections (`/package/info` maxNum /
/// allWsNum). The total keeps a little headroom.
const DEFAULT_MAX_SYMBOLS: &str = "600";
const DEFAULT_MAX_SYMBOLS_TOTAL: &str = "780";

fn var(k: &str, d: &str) -> String {
    env::var(k).unwrap_or_else(|_| d.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let primary = env::var("INFOWAY_API_KEY").map_err(|_| anyhow::anyhow!("INFOWAY_API_KEY is not set (add it to .env.local)"))?;
        // Spares to fall back on when the primary is refused or revoked; one per comma.
        let mut all = vec![primary];
        all.extend(var("INFOWAY_API_KEY_FALLBACKS", "").split(',').map(str::to_string));
        let keys = Arc::new(Keys::new(all));
        Ok(Self {
            database_url: var("DATABASE_URL", "postgres://postgres@127.0.0.1:5433/ezymex"),
            bind: var("MARKET_DATA_BIND", "127.0.0.1:8081"),
            binance_enabled: var("MARKET_DATA_BINANCE", "true") != "false",
            binance_ws: var("BINANCE_WS", "wss://stream.binance.com:9443/stream"),
            keys,
            infoway_rest: var("INFOWAY_REST_URL", "https://data.infoway.io"),
            infoway_ws: var("INFOWAY_WS_URL", "wss://data.infoway.io/ws"),
            upstream: var("MARKET_DATA_UPSTREAM", ""),
            // Premium plan: 10 requests/s for the key; 3/s leaves room for the snapshot script and other tools
            provider_rps: var("INFOWAY_RPS", "3").parse().unwrap_or(3.0),
            instruments_file: var("INSTRUMENTS_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/instruments.json")),
            store_ticks: var("STORE_TICKS", "true") == "true",
            ticks_retention_hours: var("TICKS_RETENTION_HOURS", "72").parse().unwrap_or(72),
            backfill_days: [
                (1, var("BACKFILL_DAYS_M1", "14").parse().unwrap_or(14)),
                (5, var("BACKFILL_DAYS_M5", "60").parse().unwrap_or(60)),
                (15, var("BACKFILL_DAYS_M15", "180").parse().unwrap_or(180)),
                (30, var("BACKFILL_DAYS_M30", "365").parse().unwrap_or(365)),
                (60, var("BACKFILL_DAYS_H1", "1095").parse().unwrap_or(1095)),
            ],
            backfill_daily_from: var("BACKFILL_DAILY_FROM", "2012-01-01"),
            admin_token: var("MARKET_DATA_ADMIN_TOKEN", ""),
            holidays_dir: var("HOLIDAYS_DIR", concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/holidays")),
            always_on: match var("MARKET_DATA_ALWAYS_ON", "").trim() {
                "" => None,
                "none" => Some(Vec::new()),
                v => Some(v.split(',').map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty()).collect()),
            },
            max_symbols_per_market: var("INFOWAY_MAX_SYMBOLS", DEFAULT_MAX_SYMBOLS).parse().unwrap_or(0),
            // INFOWAY_MAX_SYMBOLS_COMMON=…, _CRYPTO, _STOCK: per-market limits when they differ
            max_symbols_by_market: env::vars()
                .filter_map(|(k, v)| Some((k.strip_prefix("INFOWAY_MAX_SYMBOLS_")?.to_lowercase(), v.parse().ok()?)))
                .filter(|(k, _): &(String, usize)| k != "total")
                .collect(),
            max_symbols_total: var("INFOWAY_MAX_SYMBOLS_TOTAL", DEFAULT_MAX_SYMBOLS_TOTAL).parse().unwrap_or(780),
            markets: var("INFOWAY_MARKETS", "common,crypto,stock").split(',').map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()).collect(),
            idle_grace_secs: var("MARKET_DATA_IDLE_GRACE_SECS", "300").parse().unwrap_or(300),
            // batch_kline takes at most 100 codes per request
            batch_codes: var("INFOWAY_BATCH_CODES", "100").parse().unwrap_or(100).clamp(1, 100),
            snapshot_every_secs: var("MARKET_DATA_SNAPSHOT_SECS", "900").parse().unwrap_or(900),
        })
    }
}
