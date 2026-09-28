use std::env;
use std::fmt;

/// Runtime configuration (env vars; `.env.local` at the repo root is loaded in development).
/// `Debug` is implemented by hand so secrets never reach logs.
#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    /// Server-side key for HMAC-hashing session tokens, OTP codes and device ids (>= 32 chars).
    pub session_secret: String,
    /// Shared secret the Next.js BFF route handlers send in `X-Kalks-Internal`. Empty = check disabled (dev only).
    pub internal_token: String,
    /// `development` exposes OTP codes in API responses (`dev_code`) and logs them; `production` never does.
    pub dev_mode: bool,
    /// True when SMTP_HOST is set: codes go out by email and are never shown in API responses.
    pub smtp_configured: bool,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub smtp_from: String,
    pub super_admin_email: String,
    pub super_admin_password: String,
    pub super_admin_name: String,
}

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
    if v.is_empty() { "<empty>" } else { "<redacted>" }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("bind", &self.bind)
            .field("database_url", &redact_url(&self.database_url))
            .field("session_secret", &redact(&self.session_secret))
            .field("internal_token", &redact(&self.internal_token))
            .field("dev_mode", &self.dev_mode)
            .field("smtp_configured", &self.smtp_configured)
            .field("smtp_host", &self.smtp_host)
            .field("smtp_port", &self.smtp_port)
            .field("smtp_user", &self.smtp_user)
            .field("smtp_password", &redact(&self.smtp_password))
            .field("smtp_from", &self.smtp_from)
            .field("super_admin_email", &self.super_admin_email)
            .field("super_admin_password", &redact(&self.super_admin_password))
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let session_secret = var("SESSION_SECRET", "");
        if session_secret.len() < 32 {
            anyhow::bail!("SESSION_SECRET must be set to at least 32 characters");
        }
        let dev_mode = var("GATEWAY_ENV", "development") != "production";
        let internal_token = var("GATEWAY_INTERNAL_TOKEN", "");
        if internal_token.is_empty() && !dev_mode {
            anyhow::bail!("GATEWAY_INTERNAL_TOKEN is required in production");
        }
        Ok(Self {
            bind: var("GATEWAY_BIND", "127.0.0.1:8080"),
            database_url: var("GATEWAY_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/kalks_core"),
            session_secret,
            internal_token,
            dev_mode,
            smtp_configured: !var("SMTP_HOST", "").is_empty(),
            smtp_host: var("SMTP_HOST", ""),
            smtp_port: var("SMTP_PORT", "465").parse().unwrap_or(465),
            smtp_user: var("SMTP_USER", ""),
            smtp_password: var("SMTP_PASSWORD", ""),
            smtp_from: var("SMTP_FROM", "Kalks <no-reply@kalkstrade.com>"),
            super_admin_email: var("SUPER_ADMIN_EMAIL", "").to_lowercase(),
            super_admin_password: var("SUPER_ADMIN_PASSWORD", ""),
            super_admin_name: var("SUPER_ADMIN_NAME", "Kalks Admin"),
        })
    }
}

#[cfg(test)]
mod redact_tests {
    use super::redact_url;

    #[test]
    fn masks_database_password() {
        assert_eq!(redact_url("postgres://kalks:s3cret@127.0.0.1:5432/kalks_core"), "postgres://kalks:***@127.0.0.1:5432/kalks_core");
        assert_eq!(redact_url("postgres://postgres@127.0.0.1:5433/kalks"), "postgres://postgres@127.0.0.1:5433/kalks");
    }
}
