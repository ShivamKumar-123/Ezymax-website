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
    /// Shared secret the Next.js BFF route handlers send in `X-Ezymex-Internal`. Empty = check disabled (dev only).
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
    /// A second relay to fall back on when the first refuses a message (`SMTP_FALLBACK_HOST`, empty = none).
    /// Hostinger suspended our mailbox twice in November 2026 and every sign-in code sent in those hours was
    /// lost; with a fallback configured, codes keep going out.
    pub smtp_fallback_host: String,
    pub smtp_fallback_port: u16,
    pub smtp_fallback_user: String,
    pub smtp_fallback_password: String,
    /// Public URLs and support address used in emails.
    pub site_url: String,
    pub app_url: String,
    pub trade_url: String,
    pub support_email: String,
    /// Staff must enter an emailed code on every sign-in (default), not only on new devices.
    pub staff_otp_every_login: bool,
    /// Sign-in and registration take the password alone (no emailed code). LOGIN_EMAIL_CODES=auto (default) turns
    /// this on only while codes can't be delivered (production without SMTP_HOST); `on` / `off` force it.
    /// Step-up codes (withdrawals, password changes) and password resets still need email.
    pub password_only: bool,
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
            .field("staff_otp_every_login", &self.staff_otp_every_login)
            .field("password_only", &self.password_only)
            .field("smtp_configured", &self.smtp_configured)
            .field("smtp_host", &self.smtp_host)
            .field("smtp_port", &self.smtp_port)
            .field("smtp_user", &self.smtp_user)
            .field("smtp_password", &redact(&self.smtp_password))
            .field("smtp_from", &self.smtp_from)
            .field("smtp_fallback_host", &self.smtp_fallback_host)
            .field("smtp_fallback_port", &self.smtp_fallback_port)
            .field("smtp_fallback_user", &self.smtp_fallback_user)
            .field("smtp_fallback_password", &redact(&self.smtp_fallback_password))
            .field("site_url", &self.site_url)
            .field("app_url", &self.app_url)
            .field("trade_url", &self.trade_url)
            .field("super_admin_email", &self.super_admin_email)
            .field("super_admin_password", &redact(&self.super_admin_password))
            .finish()
    }
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

/// The gateway's own relay setting when one is given, else the platform-wide one.
///
/// Sign-in codes are the mail that cannot wait, and the shared mailbox is the one that gets blocked when the
/// support service sends a broadcast through it. `GATEWAY_SMTP_*` lets the codes travel by a relay of their own
/// (Brevo since 21 Nov 2026) while notifications, statements and announcements keep the shared `SMTP_*` one.
fn relay_var(key: &str, default: &str) -> String {
    let own = var(&format!("GATEWAY_{key}"), "");
    if own.is_empty() { var(key, default) } else { own }
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
        let smtp_configured = !relay_var("SMTP_HOST", "").is_empty();
        let password_only = match var("LOGIN_EMAIL_CODES", "auto").as_str() {
            "off" => true,
            "on" => false,
            _ => !dev_mode && !smtp_configured,
        };
        Ok(Self {
            bind: var("GATEWAY_BIND", "127.0.0.1:8080"),
            database_url: var("GATEWAY_DATABASE_URL", "postgres://postgres@127.0.0.1:5433/ezymex_core"),
            session_secret,
            internal_token,
            dev_mode,
            smtp_configured,
            smtp_host: relay_var("SMTP_HOST", ""),
            smtp_port: relay_var("SMTP_PORT", "465").parse().unwrap_or(465),
            smtp_user: relay_var("SMTP_USER", ""),
            smtp_password: relay_var("SMTP_PASSWORD", ""),
            smtp_from: relay_var("SMTP_FROM", "Ezymex <no-reply@ezymex.com>"),
            smtp_fallback_host: var("SMTP_FALLBACK_HOST", ""),
            smtp_fallback_port: var("SMTP_FALLBACK_PORT", "587").parse().unwrap_or(587),
            smtp_fallback_user: var("SMTP_FALLBACK_USER", ""),
            smtp_fallback_password: var("SMTP_FALLBACK_PASSWORD", ""),
            site_url: var("PUBLIC_SITE_URL", "https://ezymex.com"),
            app_url: var("PUBLIC_APP_URL", "https://app.ezymex.com"),
            trade_url: var("PUBLIC_TRADE_URL", "https://trade.ezymex.com"),
            support_email: var("SUPPORT_EMAIL", "support@ezymex.com"),
            staff_otp_every_login: var("STAFF_OTP_EVERY_LOGIN", "true") != "false",
            password_only,
            super_admin_email: var("SUPER_ADMIN_EMAIL", "").to_lowercase(),
            super_admin_password: var("SUPER_ADMIN_PASSWORD", ""),
            super_admin_name: var("SUPER_ADMIN_NAME", "Ezymex Admin"),
        })
    }
}

#[cfg(test)]
mod redact_tests {
    use super::redact_url;

    #[test]
    fn masks_database_password() {
        assert_eq!(redact_url("postgres://ezymex:s3cret@127.0.0.1:5432/ezymex_core"), "postgres://ezymex:***@127.0.0.1:5432/ezymex_core");
        assert_eq!(redact_url("postgres://postgres@127.0.0.1:5433/ezymex"), "postgres://postgres@127.0.0.1:5433/ezymex");
    }
}
