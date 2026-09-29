use std::env;
use std::fmt;

/// Runtime configuration (env vars; the repo-root `.env.local` and `.env.claude` are loaded in development).
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Shared secret the BFFs send in `X-Kalks-Internal`. Empty = check disabled (dev only).
    pub internal_token: String,
    pub dev_mode: bool,
    pub json_logs: bool,
    /// Background fetchers (RSS, calendar, alerts, brief). Off in tests.
    pub workers: bool,
    /// User-Agent sent to every feed (identifies the aggregator and a contact URL, as feed owners ask).
    pub user_agent: String,
    /// Weekly economic calendar export (Forex Factory JSON). Polled at most every `calendar_secs`.
    pub calendar_url: String,
    pub calendar_secs: u64,
    /// Notifications service (services/support) for calendar reminders. Empty token = dev.
    pub support_url: String,
    pub support_token: String,
    /// Claude key for the daily market brief (D138). Empty = brief disabled.
    pub anthropic_key: String,
    pub ai_model: String,
    pub brief: bool,
    /// Infoway real-time news WebSocket (needs newsFlag on the plan). Off unless NEWS_INFOWAY=true.
    pub infoway: bool,
    pub infoway_key: String,
    /// Optional licensed calendar provider (Trading Economics) used only to fill actual values.
    pub te_key: String,
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

fn set(s: &str) -> &'static str {
    if s.is_empty() { "<empty>" } else { "<redacted>" }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("bind", &self.bind)
            .field("database_url", &redact_url(&self.database_url))
            .field("internal_token", &set(&self.internal_token))
            .field("dev_mode", &self.dev_mode)
            .field("workers", &self.workers)
            .field("calendar_url", &self.calendar_url)
            .field("calendar_secs", &self.calendar_secs)
            .field("support_url", &self.support_url)
            .field("support_token", &set(&self.support_token))
            .field("anthropic_key", &set(&self.anthropic_key))
            .field("ai_model", &self.ai_model)
            .field("brief", &self.brief)
            .field("infoway", &self.infoway)
            .field("infoway_key", &set(&self.infoway_key))
            .field("te_key", &set(&self.te_key))
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

fn flag(key: &str, default: bool) -> bool {
    match var(key, if default { "true" } else { "false" }).to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => true,
        _ => false,
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let dev_mode = var("NEWS_ENV", "development") != "production";
        let internal_token = var("NEWS_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("NEWS_INTERNAL_TOKEN is required in production");
        }
        // default: same server/credentials as the gateway, database kalks_news
        let database_url = match env::var("NEWS_DATABASE_URL").ok().filter(|v| !v.trim().is_empty()) {
            Some(u) => u,
            None => {
                let g = var("GATEWAY_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_core");
                match g.rfind('/') {
                    Some(i) if i > g.find("://").map(|x| x + 2).unwrap_or(0) => {
                        let (base, tail) = g.split_at(i);
                        let q = tail.find('?').map(|j| &tail[j..]).unwrap_or("");
                        format!("{base}/kalks_news{q}")
                    }
                    _ => "postgres://postgres@127.0.0.1:5433/kalks_news".into(),
                }
            }
        };
        Ok(Self {
            bind: var("NEWS_BIND", "127.0.0.1:8103"),
            database_url,
            internal_token,
            dev_mode,
            json_logs: var("NEWS_LOG_FORMAT", if dev_mode { "text" } else { "json" }) == "json",
            workers: flag("NEWS_WORKERS", true),
            user_agent: var("NEWS_USER_AGENT", "KalksNewsBot/1.0 (+https://kalkstrade.com; headlines and links only)"),
            calendar_url: var("NEWS_CALENDAR_URL", "https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
            calendar_secs: var("NEWS_CALENDAR_SECS", "1800").parse().unwrap_or(1800).max(600),
            support_url: var("NEWS_SUPPORT_URL", "http://127.0.0.1:8100").trim_end_matches('/').to_string(),
            support_token: var("SUPPORT_INTERNAL_TOKEN", ""),
            anthropic_key: var("ANTHROPIC_API_KEY", ""),
            ai_model: var("NEWS_AI_MODEL", "claude-opus-5-5"),
            brief: flag("NEWS_BRIEF", true),
            infoway: flag("NEWS_INFOWAY", false),
            infoway_key: var("INFOWAY_API_KEY", ""),
            te_key: var("NEWS_TE_API_KEY", ""),
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
            user_agent: "KalksNewsBot/test".into(),
            calendar_url: String::new(),
            calendar_secs: 1800,
            support_url: String::new(),
            support_token: String::new(),
            anthropic_key: String::new(),
            ai_model: "claude-opus-5-5".into(),
            brief: false,
            infoway: false,
            infoway_key: String::new(),
            te_key: String::new(),
        }
    }
}
