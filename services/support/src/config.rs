use std::env;
use std::fmt;

/// Runtime configuration (env vars; the repo-root `.env.local` and `.env.claude` are loaded in development).
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret callers send in `X-Kalks-Internal`. Empty = check disabled (development only).
    pub internal_token: String,
    pub production: bool,
    /// Where chat attachments are stored (private, outside any web root).
    pub storage_dir: String,
    pub max_attachment_bytes: usize,
    pub anthropic_key: String,
    pub ai_model: String,
    pub anthropic_url: String,
    pub gateway_url: String,
    pub gateway_token: String,
    pub trading_url: String,
    pub trading_token: String,
    pub wallet_url: String,
    pub wallet_token: String,
    /// Public Client Area / Back Office origins used in email links.
    pub app_url: String,
    pub admin_url: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub smtp_from: String,
    pub academy_glossary: String,
    /// Background loops (email outbox, SLA, polling adapters). Tests turn them off.
    pub workers: bool,
    /// Polling adapters (KYC decisions, trading stop-outs / margin calls / SL-TP fills, wallet) on top of POST /v1/notify.
    pub adapters: bool,
    pub adapter_secs: u64,
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
            .field("storage_dir", &self.storage_dir)
            .field("anthropic_key", &redact(&self.anthropic_key))
            .field("ai_model", &self.ai_model)
            .field("gateway_url", &self.gateway_url)
            .field("trading_url", &self.trading_url)
            .field("wallet_url", &self.wallet_url)
            .field("app_url", &self.app_url)
            .field("smtp_host", &self.smtp_host)
            .field("smtp_port", &self.smtp_port)
            .field("smtp_user", &redact(&self.smtp_user))
            .field("workers", &self.workers)
            .field("adapters", &self.adapters)
            .finish()
    }
}

fn home() -> String {
    env::var("HOME").unwrap_or_else(|_| ".".into())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let production = var("SUPPORT_ENV", "development") == "production";
        let internal_token = var("SUPPORT_INTERNAL_TOKEN", "");
        if production && internal_token.is_empty() {
            anyhow::bail!("SUPPORT_INTERNAL_TOKEN is required when SUPPORT_ENV=production");
        }
        Ok(Self {
            bind: var("SUPPORT_BIND", "127.0.0.1:8100"),
            database_url: var("SUPPORT_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_support"),
            internal_token,
            production,
            storage_dir: var("SUPPORT_STORAGE_DIR", &format!("{}/.kalks-data/support", home())),
            max_attachment_bytes: var("SUPPORT_MAX_ATTACHMENT_MB", "10").parse::<usize>().unwrap_or(10).clamp(1, 25) * 1024 * 1024,
            anthropic_key: var("ANTHROPIC_API_KEY", ""),
            ai_model: var("SUPPORT_AI_MODEL", "claude-opus-5-5"),
            anthropic_url: var("ANTHROPIC_API_URL", "https://api.anthropic.com").trim_end_matches('/').to_string(),
            gateway_url: var("GATEWAY_URL", "http://127.0.0.1:8080").trim_end_matches('/').to_string(),
            gateway_token: var("GATEWAY_INTERNAL_TOKEN", ""),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090").trim_end_matches('/').to_string(),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095").trim_end_matches('/').to_string(),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            app_url: var("SUPPORT_APP_URL", "http://localhost:3000").trim_end_matches('/').to_string(),
            admin_url: var("SUPPORT_ADMIN_URL", "http://localhost:3001").trim_end_matches('/').to_string(),
            smtp_host: var("SMTP_HOST", ""),
            smtp_port: var("SMTP_PORT", "587").parse().unwrap_or(587),
            smtp_user: var("SMTP_USER", ""),
            smtp_password: var("SMTP_PASSWORD", ""),
            smtp_from: var("SMTP_FROM", "Kalks <no-reply@kalkstrade.com>"),
            academy_glossary: var("SUPPORT_GLOSSARY_FILE", concat!(env!("CARGO_MANIFEST_DIR"), "/../../content/academy/en/glossary.yaml")),
            workers: var("SUPPORT_WORKERS", "true") != "false",
            adapters: var("SUPPORT_ADAPTERS", "true") != "false",
            adapter_secs: var("SUPPORT_ADAPTER_SECS", "15").parse().unwrap_or(15).max(3),
            log_json: var("SUPPORT_LOG_FORMAT", "json") == "json",
        })
    }

    /// Configuration for tests: no workers, no upstream services, no AI key (the bot uses its retrieval fallback).
    pub fn for_tests(database_url: &str, storage_dir: &str) -> Self {
        Self {
            bind: String::new(),
            database_url: database_url.to_string(),
            internal_token: String::new(),
            production: false,
            storage_dir: storage_dir.to_string(),
            max_attachment_bytes: 2 * 1024 * 1024,
            anthropic_key: String::new(),
            ai_model: "claude-opus-5-5".into(),
            anthropic_url: "http://127.0.0.1:9".into(),
            gateway_url: "http://127.0.0.1:9".into(),
            gateway_token: String::new(),
            trading_url: "http://127.0.0.1:9".into(),
            trading_token: String::new(),
            wallet_url: "http://127.0.0.1:9".into(),
            wallet_token: String::new(),
            app_url: "http://localhost:3000".into(),
            admin_url: "http://localhost:3001".into(),
            smtp_host: String::new(),
            smtp_port: 587,
            smtp_user: String::new(),
            smtp_password: String::new(),
            smtp_from: "Kalks <no-reply@kalkstrade.com>".into(),
            academy_glossary: concat!(env!("CARGO_MANIFEST_DIR"), "/../../content/academy/en/glossary.yaml").into(),
            workers: false,
            adapters: false,
            adapter_secs: 15,
            log_json: false,
        }
    }
}
