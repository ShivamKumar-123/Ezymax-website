//! Client notices through the support service (`POST $SUPPORT_URL/v1/notify`): the bell in the Client Area and
//! the app, the realtime stream, and an email per the client's notification preference - `security.*` cannot be
//! switched off there (support `PREF_KEYS`), `account.*` falls under platform notices.
//!
//! Everything here is best effort and off the request path: the notice is posted from a spawned task after the
//! change has been committed and audited, so a support outage never fails a sign-in, a password change or a
//! restriction. Nothing is sent without `SUPPORT_URL`. The dedupe key makes a retried request, or two
//! replicas, announce a change once. `SUPPORT_URL=off` switches the notices off.
//!
//! No secret ever goes in a notice: no password, token or code - a device, an address, a time and what changed.

use chrono::Utc;
use serde_json::{Value, json};

use crate::state::{AppState, Ctx};

#[derive(Debug, Clone)]
pub struct Notice {
    /// `category.event`, lower case (support's `pref_key` picks the preference category from it).
    pub kind: &'static str,
    pub title: String,
    pub body: String,
    /// Client Area path the bell entry opens.
    pub link: Option<&'static str>,
    /// info | success | warning | critical
    pub severity: &'static str,
    pub data: Value,
    pub dedupe: String,
}

/// Where the support service is: `SUPPORT_URL` (the loopback default every service uses; `off` = no notices) and
/// the internal token it checks.
struct Support {
    http: reqwest::Client,
    url: String,
    token: String,
}

fn support() -> &'static Support {
    static S: std::sync::OnceLock<Support> = std::sync::OnceLock::new();
    S.get_or_init(|| {
        let var = |k: &str| std::env::var(k).ok().map(|v| v.trim().trim_end_matches('/').to_string()).filter(|v| !v.is_empty());
        Support {
            http: reqwest::Client::builder().timeout(std::time::Duration::from_secs(8)).build().expect("reqwest client"),
            url: match var("SUPPORT_URL") {
                Some(u) if u.eq_ignore_ascii_case("off") => String::new(),
                Some(u) => u,
                None => "http://127.0.0.1:8100".into(),
            },
            token: var("SUPPORT_INTERNAL_TOKEN").unwrap_or_default(),
        }
    })
}

/// Posts the notice in the background. `tenant_id` is the gateway's id; support wants the slug, read here.
pub fn send(st: &AppState, tenant_id: i64, user_id: i64, n: Notice) {
    let s = support();
    if s.url.is_empty() {
        return;
    }
    let pool = st.pool.clone();
    tokio::spawn(async move {
        let slug: Option<String> = sqlx::query_scalar("SELECT slug FROM tenants WHERE id = $1").bind(tenant_id).fetch_optional(&pool).await.ok().flatten();
        let Some(slug) = slug else {
            tracing::warn!(tenant_id, kind = n.kind, "notice not sent: tenant has no slug");
            return;
        };
        let body = json!({
            "type": n.kind, "userId": user_id, "title": n.title, "body": n.body, "link": n.link,
            "severity": n.severity, "data": n.data, "dedupeKey": n.dedupe,
        });
        let s = support();
        let r = s.http.post(format!("{}/v1/notify", s.url)).header("x-ezymex-internal", &s.token).header("x-ezymex-tenant", slug).header("x-ezymex-service", "gateway").json(&body).send().await;
        match r {
            Ok(r) if r.status().is_success() => {}
            Ok(r) => tracing::warn!(user_id, kind = n.kind, status = %r.status(), "notice refused by the support service"),
            Err(e) => tracing::warn!(user_id, kind = n.kind, error = %e.without_url(), "notice not sent"),
        }
    });
}

/* ---------- the device, in words ---------- */

/// "Chrome on Windows", "Safari on iPhone", "Ezymex app on Android" - from the user agent, for a notice.
pub fn describe_device(ua: &str) -> String {
    let u = ua.to_ascii_lowercase();
    let app = u.contains("ezymex") || u.contains("dart/") || u.contains("okhttp");
    let browser = if app {
        "Ezymex app"
    } else if u.contains("edg/") {
        "Edge"
    } else if u.contains("opr/") || u.contains("opera") {
        "Opera"
    } else if u.contains("firefox/") {
        "Firefox"
    } else if u.contains("chrome/") || u.contains("crios/") {
        "Chrome"
    } else if u.contains("safari/") {
        "Safari"
    } else {
        "a browser"
    };
    let os = if u.contains("android") {
        "Android"
    } else if u.contains("iphone") {
        "iPhone"
    } else if u.contains("ipad") {
        "iPad"
    } else if u.contains("windows") {
        "Windows"
    } else if u.contains("mac os") || u.contains("macintosh") {
        "Mac"
    } else if u.contains("linux") {
        "Linux"
    } else {
        ""
    };
    if os.is_empty() { browser.to_string() } else { format!("{browser} on {os}") }
}

/// "04 Nov 2026, 09:41 UTC"
pub fn stamp() -> String {
    Utc::now().format("%d %b %Y, %H:%M UTC").to_string()
}

const WASNT_YOU: &str = "If this wasn't you, change your password now and sign out of other devices from Profile › Security.";

/* ---------- the notices ---------- */

/// A sign-in from a device this account had not used before (`security.new_device`).
pub fn new_device(st: &AppState, ctx: &Ctx, tenant_id: i64, user_id: i64, via: &str, device_key: &str) {
    let device = describe_device(&ctx.user_agent);
    let country = crate::identity::COUNTRY.try_with(|c| c.clone()).ok().flatten();
    let place = match &country {
        Some(c) if !c.is_empty() => format!("{} ({c})", ctx.ip),
        _ => ctx.ip.clone(),
    };
    send(st, tenant_id, user_id, Notice {
        kind: "security.new_device",
        title: "New sign-in to your account".into(),
        body: format!("Your Ezymex account was signed in to on {device} from {place} on {}.\n\n{WASNT_YOU}", stamp()),
        link: Some("/profile/security"),
        severity: "warning",
        data: json!({"device": device, "ip": ctx.ip, "country": country, "via": via}),
        dedupe: format!("security:new_device:{user_id}:{device_key}:{}", Utc::now().format("%Y-%m-%d")),
    });
}

/// The Client Area password was changed by the client (`security.password_changed`).
pub fn password_changed(st: &AppState, ctx: &Ctx, tenant_id: i64, user_id: i64, sessions_revoked: u64) {
    let others = if sessions_revoked > 0 { format!(" Other devices ({sessions_revoked}) were signed out.") } else { String::new() };
    send(st, tenant_id, user_id, Notice {
        kind: "security.password_changed",
        title: "Your password was changed".into(),
        body: format!("The password of your Ezymex account was changed on {} from {} ({}).{others}\n\n{WASNT_YOU}", stamp(), describe_device(&ctx.user_agent), ctx.ip),
        link: Some("/profile/security"),
        severity: "info",
        data: json!({"sessions_revoked": sessions_revoked}),
        dedupe: format!("security:password_changed:{user_id}:{}", Utc::now().timestamp()),
    });
}

/// A password reset completed from the reset link (`security.password_reset`).
pub fn password_reset(st: &AppState, ctx: &Ctx, tenant_id: i64, user_id: i64) {
    send(st, tenant_id, user_id, Notice {
        kind: "security.password_reset",
        title: "Your password was reset".into(),
        body: format!("A new password was set for your Ezymex account on {} from {} ({}).\n\n{WASNT_YOU}", stamp(), describe_device(&ctx.user_agent), ctx.ip),
        link: Some("/profile/security"),
        severity: "info",
        data: json!({}),
        dedupe: format!("security:password_reset:{user_id}:{}", Utc::now().timestamp()),
    });
}

/// Sign-in locked after repeated wrong passwords (`security.locked`).
pub fn locked(st: &AppState, ctx: &Ctx, tenant_id: i64, user_id: i64, failures: u32, minutes: i64) {
    send(st, tenant_id, user_id, Notice {
        kind: "security.locked",
        title: "Sign-in temporarily locked".into(),
        body: format!(
            "There were {failures} failed sign-in attempts on your Ezymex account, the last from {} on {}. Sign-in is locked for {minutes} minutes.\n\nIf this wasn't you, reset your password once the lock has passed.",
            ctx.ip,
            stamp()
        ),
        link: Some("/profile/security"),
        severity: "warning",
        data: json!({"failures": failures, "minutes": minutes, "ip": ctx.ip}),
        dedupe: format!("security:locked:{user_id}:{}", Utc::now().format("%Y-%m-%dT%H")),
    });
}

/// A restriction placed by staff (`account.restricted`): a sign-in block reads as a suspension.
pub fn restricted(st: &AppState, tenant_id: i64, user_id: i64, kind: &str, label: &str, reason: &str, expires_at: Option<chrono::DateTime<Utc>>) {
    let until = expires_at.map(|t| format!(" until {}", t.format("%d %b %Y, %H:%M UTC"))).unwrap_or_default();
    let why = if reason.trim().is_empty() { String::new() } else { format!("\n\nReason: {}", reason.trim()) };
    let (title, lead) = match kind {
        "login" => ("Your account has been suspended".to_string(), format!("Sign-in to your Ezymex account is blocked{until}.")),
        "freeze" => ("Your account has been frozen".to_string(), format!("Trading, deposits, withdrawals and transfers are paused on your Ezymex account{until}.")),
        _ => (format!("{label} on your account"), format!("{label}{until} on your Ezymex account.")),
    };
    send(st, tenant_id, user_id, Notice {
        kind: "account.restricted",
        title,
        body: format!("{lead}{why}\n\nIf you have questions, reply to this email or write to support from the Client Area."),
        link: Some("/support"),
        severity: "critical",
        data: json!({"kind": kind, "reason": reason, "expires_at": expires_at}),
        dedupe: format!("account:restricted:{user_id}:{kind}:{}", Utc::now().timestamp()),
    });
}

/// A restriction lifted by staff (`account.restriction_lifted`): a lifted sign-in block reads as reactivation.
pub fn restriction_lifted(st: &AppState, tenant_id: i64, user_id: i64, kind: &str, label: &str) {
    let (title, body) = match kind {
        "login" => ("Your account is active again".to_string(), "Sign-in to your Ezymex account has been restored. Welcome back.".to_string()),
        "freeze" => ("Your account is no longer frozen".to_string(), "Trading, deposits, withdrawals and transfers are available again on your Ezymex account.".to_string()),
        _ => (format!("{label} lifted"), format!("The restriction \"{label}\" has been lifted from your Ezymex account.")),
    };
    send(st, tenant_id, user_id, Notice {
        kind: "account.restriction_lifted",
        title,
        body,
        link: Some("/dashboard"),
        severity: "success",
        data: json!({"kind": kind}),
        dedupe: format!("account:restriction_lifted:{user_id}:{kind}:{}", Utc::now().timestamp()),
    });
}

/// The client asked to close their account (`account.closure_requested`): what happens next, in writing.
pub fn closure_requested(st: &AppState, tenant_id: i64, user_id: i64) {
    send(st, tenant_id, user_id, Notice {
        kind: "account.closure_requested",
        title: "We received your account closure request".into(),
        body: format!(
            "You asked us to close your Ezymex account on {}. Our team will review it: open positions must be closed and any balance withdrawn first, and we will write to you when it is done. You can cancel the request from Profile › Security while it is open.\n\nIf you did not make this request, change your password now.",
            stamp()
        ),
        link: Some("/profile/security"),
        severity: "info",
        data: json!({}),
        dedupe: format!("account:closure_requested:{user_id}:{}", Utc::now().format("%Y-%m-%d")),
    });
}

/// Whether this sign-in comes from a device the account has not used before. The device row is created by
/// `identity::trust_device`, which the code-verified and Google paths run just before signing in - so a row
/// younger than a couple of minutes is this very sign-in. No device cookie at all (an API client) tells nothing,
/// and nothing is said rather than something every time.
pub async fn is_new_device(st: &AppState, ctx: &Ctx, user_id: i64) -> Option<(bool, String)> {
    let h = crate::identity::device_hash(st, ctx)?;
    let key: String = h.iter().take(6).map(|b| format!("{b:02x}")).collect();
    let created: Option<chrono::DateTime<Utc>> = sqlx::query_scalar("SELECT created_at FROM trusted_devices WHERE subject_kind = 'user' AND subject_id = $1 AND device_hash = $2")
        .bind(user_id)
        .bind(&h)
        .fetch_optional(&st.pool)
        .await
        .ok()
        .flatten();
    let new = match created {
        None => true,
        Some(t) => Utc::now() - t < chrono::Duration::minutes(2),
    };
    Some((new, key))
}

#[cfg(test)]
mod tests {
    use super::describe_device;

    #[test]
    fn devices_read_as_people_say_them() {
        assert_eq!(describe_device("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0 Safari/537.36"), "Chrome on Windows");
        assert_eq!(describe_device("Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1"), "Safari on iPhone");
        assert_eq!(describe_device("Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 CriOS/154.0 Mobile/15E148 Safari/604.1"), "Chrome on iPhone");
        assert_eq!(describe_device("Ezymex/1.0.27 (Android 15; Pixel 8) Dart/3.9"), "Ezymex app on Android");
        assert_eq!(describe_device(""), "a browser");
    }
}
