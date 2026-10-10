use rust_decimal::Decimal;
use std::env;
use std::fmt;
use std::str::FromStr;

/// Runtime configuration (env vars; the repo-root `.env.local` and `.env.tron` are loaded in development).
/// `Debug` is implemented by hand so secrets never reach logs.
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret the BFFs / internal services send in `X-Ezymex-Internal`. Empty = check disabled (dev only).
    pub internal_token: String,
    pub dev_mode: bool,
    pub json_logs: bool,
    /// Run the watcher / scanner / recovery loops (exactly one instance in production).
    pub workers: bool,
    pub poll_secs: u64,
    pub scan_secs: u64,
    pub bsc_rpc_urls: Vec<String>,
    pub trongrid_url: String,
    pub trongrid_api_key: String,
    /// Seed values for chain_settings (first start only; afterwards the audited admin setting wins).
    pub bsc_address: String,
    pub tron_address: String,
    pub bsc_confirmations: i32,
    pub tron_confirmations: i32,
    pub trading_url: String,
    pub trading_token: String,
    pub gateway_url: String,
    pub gateway_token: String,
    /// Support / notifications service (`POST /v1/notify`). Empty = notifications stay in-app only.
    pub support_url: String,
    pub support_token: String,
    /// Private storage of manual-payment images: QR codes staff upload and payment screenshots clients attach
    /// (WALLET_STORAGE_DIR, directory 0700, files 0600). Back it up with the database.
    pub storage_dir: String,
    /// Upload limit of those images (5 MB).
    pub max_media_bytes: usize,
    /// OxaPay crypto checkout (hosted payment gateway, `ops::oxapay`). An empty key switches the module off:
    /// the routes answer `method_unavailable` and the Client Area hides the option. Platform-wide, so every
    /// tenant's checkouts settle into the same OxaPay merchant account.
    pub oxapay_api_key: String,
    pub oxapay_api_url: String,
    /// What a client may ask for in one checkout, in USD.
    pub oxapay_min_usd: Decimal,
    pub oxapay_max_usd: Decimal,
    /// How long OxaPay keeps the payment page open (their range is 15–2880 minutes).
    pub oxapay_lifetime_minutes: u32,
    /// Whether the payer covers OxaPay's fee. True keeps the credited amount equal to the amount asked for.
    pub oxapay_fee_paid_by_payer: bool,
    pub oxapay_sandbox: bool,
    /// Open checkouts one client may hold at once.
    pub oxapay_max_open: i64,
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

/// Hides API keys that some RPC providers put into the URL path or query.
fn redact_rpc(url: &str) -> String {
    let base = redact_url(url);
    match base.find('?') {
        Some(q) => format!("{}?***", &base[..q]),
        None => {
            // https://host/<long key> → https://host/***
            let parts: Vec<&str> = base.splitn(4, '/').collect();
            if parts.len() == 4 && parts[3].len() >= 20 { format!("{}//{}/***", parts[0], parts[2]) } else { base }
        }
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
            .field("json_logs", &self.json_logs)
            .field("workers", &self.workers)
            .field("poll_secs", &self.poll_secs)
            .field("scan_secs", &self.scan_secs)
            .field("bsc_rpc_urls", &self.bsc_rpc_urls.iter().map(|u| redact_rpc(u)).collect::<Vec<_>>())
            .field("trongrid_url", &redact_rpc(&self.trongrid_url))
            .field("trongrid_api_key", &redact(&self.trongrid_api_key))
            .field("bsc_address", &self.bsc_address)
            .field("tron_address", &self.tron_address)
            .field("bsc_confirmations", &self.bsc_confirmations)
            .field("tron_confirmations", &self.tron_confirmations)
            .field("trading_url", &self.trading_url)
            .field("trading_token", &redact(&self.trading_token))
            .field("gateway_url", &self.gateway_url)
            .field("gateway_token", &redact(&self.gateway_token))
            .field("support_url", &self.support_url)
            .field("support_token", &redact(&self.support_token))
            .field("storage_dir", &self.storage_dir)
            .field("max_media_bytes", &self.max_media_bytes)
            .field("oxapay_api_key", &redact(&self.oxapay_api_key))
            .field("oxapay_api_url", &self.oxapay_api_url)
            .field("oxapay_min_usd", &self.oxapay_min_usd)
            .field("oxapay_max_usd", &self.oxapay_max_usd)
            .field("oxapay_lifetime_minutes", &self.oxapay_lifetime_minutes)
            .field("oxapay_fee_paid_by_payer", &self.oxapay_fee_paid_by_payer)
            .field("oxapay_sandbox", &self.oxapay_sandbox)
            .field("oxapay_max_open", &self.oxapay_max_open)
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).map(|v| v.trim().to_string()).unwrap_or_else(|| default.to_string())
}

/// A decimal setting, falling back to `default` when unset or unparsable.
fn dec(key: &str, default: i64) -> Decimal {
    let raw = var(key, "");
    if raw.is_empty() { Decimal::from(default) } else { Decimal::from_str(&raw).unwrap_or_else(|_| Decimal::from(default)) }
}

fn home() -> String {
    env::var("HOME").ok().filter(|h| !h.is_empty()).unwrap_or_else(|| ".".into())
}

pub const DEFAULT_BSC_RPCS: &str = "https://bsc-rpc.publicnode.com,https://bsc-dataseed.binance.org,https://bsc-dataseed1.defibit.io";

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("WALLET_ENV", "development") != "production";
        let internal_token = var("WALLET_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("WALLET_INTERNAL_TOKEN is required in production");
        }
        Ok(Self {
            bind: var("WALLET_BIND", "127.0.0.1:8095"),
            database_url: var("WALLET_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/ezymex_wallet"),
            internal_token,
            dev_mode,
            json_logs: var("WALLET_LOG_FORMAT", "json") == "json",
            workers: var("WALLET_WORKERS", "true") != "false",
            poll_secs: var("WALLET_POLL_SECS", "10").parse().unwrap_or(10u64).clamp(2, 600),
            scan_secs: var("WALLET_SCAN_SECS", "60").parse().unwrap_or(60u64).clamp(10, 3600),
            bsc_rpc_urls: var("WALLET_BSC_RPC_URLS", DEFAULT_BSC_RPCS).split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            trongrid_url: var("WALLET_TRONGRID_URL", "https://api.trongrid.io").trim_end_matches('/').to_string(),
            trongrid_api_key: var("TRONGRID_API_KEY", ""),
            bsc_address: var("WALLET_BSC_ADDRESS", ""),
            tron_address: var("WALLET_TRON_ADDRESS", ""),
            bsc_confirmations: var("WALLET_BSC_CONFIRMATIONS", "15").parse().unwrap_or(15).clamp(1, 500),
            tron_confirmations: var("WALLET_TRON_CONFIRMATIONS", "20").parse().unwrap_or(20).clamp(1, 500),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            gateway_url: var("GATEWAY_URL", "http://127.0.0.1:8080").trim_end_matches('/').to_string(),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            support_url: var("SUPPORT_URL", "http://127.0.0.1:8100").trim_end_matches('/').to_string(),
            support_token: var("SUPPORT_INTERNAL_TOKEN", ""),
            storage_dir: var("WALLET_STORAGE_DIR", &format!("{}/.ezymex-data/wallet", home())),
            max_media_bytes: 5 * 1024 * 1024,
            oxapay_api_key: var("WALLET_OXAPAY_API_KEY", ""),
            oxapay_api_url: var("WALLET_OXAPAY_API_URL", "https://api.oxapay.com").trim_end_matches('/').to_string(),
            oxapay_min_usd: dec("WALLET_OXAPAY_MIN_USD", 10),
            oxapay_max_usd: dec("WALLET_OXAPAY_MAX_USD", 50_000),
            oxapay_lifetime_minutes: var("WALLET_OXAPAY_LIFETIME_MINUTES", "60").parse().unwrap_or(60).clamp(15, 2880),
            oxapay_fee_paid_by_payer: var("WALLET_OXAPAY_FEE_PAID_BY_PAYER", "true") != "false",
            oxapay_sandbox: var("WALLET_OXAPAY_SANDBOX", "false") == "true",
            oxapay_max_open: var("WALLET_OXAPAY_MAX_OPEN", "3").parse().unwrap_or(3).clamp(1, 20),
        })
    }

    /// Whether the crypto checkout is configured. Everything OxaPay refuses to do without a key is gated here.
    pub fn oxapay_enabled(&self) -> bool {
        !self.oxapay_api_key.is_empty()
    }

    /// A config for tests (no network, no secrets).
    pub fn for_tests(database_url: &str) -> Self {
        Self {
            bind: "127.0.0.1:0".into(),
            database_url: database_url.into(),
            internal_token: "test-internal-token".into(),
            dev_mode: true,
            json_logs: false,
            workers: false,
            poll_secs: 2,
            scan_secs: 10,
            bsc_rpc_urls: vec![],
            trongrid_url: String::new(),
            trongrid_api_key: String::new(),
            bsc_address: "0x11e9373d598703F83582e34378E086EbEEC5da11".into(),
            tron_address: "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ".into(),
            bsc_confirmations: 15,
            tron_confirmations: 20,
            trading_url: String::new(),
            trading_token: String::new(),
            gateway_url: String::new(),
            gateway_token: String::new(),
            support_url: String::new(),
            support_token: String::new(),
            storage_dir: std::env::temp_dir().join(format!("ezymex-wallet-test-{}", std::process::id())).to_string_lossy().into_owned(),
            max_media_bytes: 5 * 1024 * 1024,
            oxapay_api_key: String::new(),
            oxapay_api_url: String::new(),
            oxapay_min_usd: Decimal::from(10),
            oxapay_max_usd: Decimal::from(50_000),
            oxapay_lifetime_minutes: 60,
            oxapay_fee_paid_by_payer: true,
            oxapay_sandbox: false,
            oxapay_max_open: 3,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_secrets() {
        assert_eq!(redact_url("postgres://ezymex:s3cret@127.0.0.1:5432/ezymex_wallet"), "postgres://ezymex:***@127.0.0.1:5432/ezymex_wallet");
        assert_eq!(redact_url("postgres://postgres@127.0.0.1:5433/ezymex_wallet"), "postgres://postgres@127.0.0.1:5433/ezymex_wallet");
        assert_eq!(redact_rpc("https://bsc.example.com/v1/?apikey=abc"), "https://bsc.example.com/v1/?***");
        assert_eq!(redact_rpc("https://rpc.example.com/0123456789abcdef0123456789"), "https://rpc.example.com/***");
        assert_eq!(redact_rpc("https://bsc-dataseed.binance.org"), "https://bsc-dataseed.binance.org");
        let mut c = Config::for_tests("postgres://u:pw@h/db");
        c.trongrid_api_key = "secret-key".into();
        let dbg = format!("{c:?}");
        assert!(!dbg.contains("pw@") && !dbg.contains("secret-key") && !dbg.contains("test-internal-token"));
    }
}
