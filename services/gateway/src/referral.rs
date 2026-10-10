//! Referral codes and when a referral link counts (owner decisions, 2026-10-10).
//!
//! * Codes carry no name: `EZ` + 6 characters of [`ALPHABET`] (no 0 / O / 1 / I / L), unique per broker. The codes
//!   from before (first name + 4 digits) moved to `users.referral_code_legacy` (migration 20261010120000) and keep
//!   resolving ([`resolve`]), so links already shared still attribute.
//! * A client's link is active once they have deposited: the wallet's first credited client deposit (on-chain
//!   USDT, bank / UPI or crypto approved by staff; never a bonus, adjustment, transfer or staking return), asked
//!   at `GET /v1/internal/users/{id}/funded` and cached in `users.referral_active_at` (deposits are final).
//! * A sign-up through a link that isn't active yet registers normally, without `referred_by`: `referral_held`
//!   says why (`not_funded`) and `referral_held_for` names the referrer, who gets a notification (support
//!   `POST /v1/notify`, type `ib.referral_inactive`, no name of the new client). If the wallet can't be asked, the
//!   sign-up is not attributed either (`unverified`, a warning in the log, no notification); staff can attribute
//!   it by hand (Back Office: Partners → partner → Reassign upline). A sign-up never fails over its referral.
//! * There is no partner exemption: every client is an IB from sign-up (services/ib, D53) and the platform has no
//!   separate approval of partners, so the same rule applies to everyone.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::sync::OnceLock;
use std::time::Duration;

use crate::crypto;
use crate::error::ApiResult;
use crate::state::AppState;

/// Characters of a referral code after the `EZ` prefix: no 0 / O / 1 / I / L.
pub const ALPHABET: &[u8] = b"23456789ABCDEFGHJKMNPQRSTUVWXYZ";
pub const PREFIX: &str = "EZ";
const LEN: usize = 6;

/// A fresh code, e.g. `EZ7KQ4MX` (uniqueness is checked by the insert, client_auth::insert_user).
pub fn new_code() -> String {
    let mut s = String::from(PREFIX);
    for _ in 0..LEN {
        let n = u32::from_le_bytes(crypto::random_bytes::<4>()) as usize;
        s.push(ALPHABET[n % ALPHABET.len()] as char);
    }
    s
}

/// True for a code in the current format.
pub fn is_new_code(code: &str) -> bool {
    code.len() == PREFIX.len() + LEN && code.starts_with(PREFIX) && code.bytes().skip(PREFIX.len()).all(|b| ALPHABET.contains(&b))
}

/// The client a referral code belongs to: the current code, or an old one (links shared before the change).
pub async fn resolve(pool: &PgPool, tenant_id: i64, code: &str) -> sqlx::Result<Option<i64>> {
    sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND (referral_code = $2 OR referral_code_legacy = $2)
         ORDER BY (referral_code = $2) DESC, id LIMIT 1",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(pool)
    .await
}

/// What the referral link check needs from the other services. Production: [`Http`]; tests pass their own.
#[allow(async_fn_in_trait)]
pub trait Upstream {
    /// When the client's first credited deposit was booked; `Ok(None)` = no deposit yet. `Err` = the wallet
    /// couldn't tell (a short reason for the log).
    async fn first_deposit(&self, tenant: &str, user_id: i64) -> Result<Option<DateTime<Utc>>, String>;
    /// Tells the referrer that someone signed up through their link while it isn't active yet. Best effort: it
    /// never fails or delays the caller.
    async fn notify_inactive(&self, tenant: &str, referrer: i64);
}

/// Whether a client's referral link counts right now.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Link {
    Active,
    /// No deposit yet.
    NoDeposit,
    /// The wallet couldn't be asked (treated as not active).
    Unknown,
}

impl Link {
    /// `referral_inactive_reason` of the client's own record (`/v1/auth/me`).
    pub fn reason(self) -> Option<&'static str> {
        match self {
            Link::Active => None,
            Link::NoDeposit => Some("no_deposit"),
            Link::Unknown => Some("unavailable"),
        }
    }
}

/// The link state of `user_id`, from the cached first deposit or the wallet (cached once it says funded).
pub async fn link<U: Upstream>(st: &AppState, up: &U, tenant: &str, user_id: i64) -> ApiResult<Link> {
    let cached: Option<Option<DateTime<Utc>>> = sqlx::query_scalar("SELECT referral_active_at FROM users WHERE id = $1").bind(user_id).fetch_optional(&st.pool).await?;
    if matches!(cached, Some(Some(_))) {
        return Ok(Link::Active);
    }
    Ok(match up.first_deposit(tenant, user_id).await {
        Ok(Some(at)) => {
            sqlx::query("UPDATE users SET referral_active_at = $2 WHERE id = $1 AND referral_active_at IS NULL").bind(user_id).bind(at).execute(&st.pool).await?;
            Link::Active
        }
        Ok(None) => Link::NoDeposit,
        Err(e) => {
            tracing::warn!(user_id, error = %e, "referral link check: the wallet could not be asked");
            Link::Unknown
        }
    })
}

/// How a sign-up's referral code is handled.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Decision {
    /// The client the sign-up is attributed to (`users.referred_by`).
    pub referred_by: Option<i64>,
    /// The code belongs to a client whose link isn't active: (`not_funded` | `unverified`, that client).
    pub held: Option<(&'static str, i64)>,
}

impl Decision {
    /// The referrer to tell that their link isn't active yet.
    pub fn notify(&self) -> Option<i64> {
        match self.held {
            Some(("not_funded", r)) => Some(r),
            _ => None,
        }
    }
}

/// Resolves a sign-up's referral code (unknown codes are kept raw by the caller, never rejected) and decides whether
/// it counts. Never an error over the referrer's state: only a database failure fails it.
pub async fn decide<U: Upstream>(st: &AppState, up: &U, tenant_id: i64, tenant: &str, code: Option<&str>) -> ApiResult<Decision> {
    let Some(code) = code else { return Ok(Decision::default()) };
    let Some(referrer) = resolve(&st.pool, tenant_id, code).await? else { return Ok(Decision::default()) };
    Ok(match link(st, up, tenant, referrer).await? {
        Link::Active => Decision { referred_by: Some(referrer), held: None },
        Link::NoDeposit => Decision { referred_by: None, held: Some(("not_funded", referrer)) },
        Link::Unknown => Decision { referred_by: None, held: Some(("unverified", referrer)) },
    })
}

/// The notification a referrer gets when someone joins through the inactive link (no name of the new client).
pub fn inactive_notice(referrer: i64, day: &str) -> Value {
    json!({
        "type": "ib.referral_inactive",
        "userId": referrer,
        "title": "Deposit to activate your referral link",
        "body": "Someone signed up with your referral link, but it isn't active yet. Make your first deposit to activate it \u{2014} sign-ups after that count as your referrals.",
        "severity": "warning",
        "link": "/wallet/deposit",
        "data": {"reason": "not_funded"},
        // at most one a day per referrer, however many people use the link
        "dedupeKey": format!("referral:inactive:{referrer}:{day}"),
    })
}

/// The wallet and the support service over HTTP: `WALLET_URL` / `WALLET_INTERNAL_TOKEN` and `SUPPORT_URL` /
/// `SUPPORT_INTERNAL_TOKEN` (the variables the other services read from the same .env.local).
pub struct Http {
    http: reqwest::Client,
    wallet_url: String,
    wallet_token: String,
    support_url: String,
    support_token: String,
}

/// The process-wide client, configured from the environment on first use.
pub fn http() -> &'static Http {
    static H: OnceLock<Http> = OnceLock::new();
    H.get_or_init(|| {
        let var = |k: &str, d: &str| std::env::var(k).ok().map(|v| v.trim().trim_end_matches('/').to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| d.to_string());
        Http::new(var("WALLET_URL", "http://127.0.0.1:8095"), var("WALLET_INTERNAL_TOKEN", ""), var("SUPPORT_URL", "http://127.0.0.1:8100"), var("SUPPORT_INTERNAL_TOKEN", ""))
    })
}

impl Http {
    pub fn new(wallet_url: String, wallet_token: String, support_url: String, support_token: String) -> Self {
        // a sign-up or a page load never waits long for the wallet
        let http = reqwest::Client::builder().timeout(Duration::from_secs(3)).build().expect("http client");
        Http { http, wallet_url, wallet_token, support_url, support_token }
    }
}

impl Upstream for Http {
    async fn first_deposit(&self, tenant: &str, user_id: i64) -> Result<Option<DateTime<Utc>>, String> {
        let r = self
            .http
            .get(format!("{}/v1/internal/users/{user_id}/funded", self.wallet_url))
            .header("x-ezymex-internal", &self.wallet_token)
            .header("x-ezymex-tenant", tenant)
            .header("user-agent", "ezymex-gateway")
            .send()
            .await
            .map_err(|_| "not reachable".to_string())?;
        let status = r.status().as_u16();
        let v: Value = r.json().await.unwrap_or(Value::Null);
        if status != 200 {
            return Err(format!("HTTP {status}"));
        }
        match v["funded"].as_bool() {
            Some(true) => Ok(Some(v["first_deposit_at"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|d| d.with_timezone(&Utc)).unwrap_or_else(Utc::now))),
            Some(false) => Ok(None),
            None => Err("unexpected answer (funded missing)".into()),
        }
    }

    async fn notify_inactive(&self, tenant: &str, referrer: i64) {
        if self.support_url.is_empty() {
            return;
        }
        let (http, url, token, tenant) = (self.http.clone(), format!("{}/v1/notify", self.support_url), self.support_token.clone(), tenant.to_string());
        let body = inactive_notice(referrer, &Utc::now().format("%Y-%m-%d").to_string());
        tokio::spawn(async move {
            let r = http.post(url).header("x-ezymex-internal", token).header("x-ezymex-tenant", tenant).header("x-ezymex-service", "gateway").json(&body).send().await;
            match r {
                Ok(r) if r.status().is_success() => {}
                Ok(r) => tracing::warn!(referrer, status = %r.status(), "referral notice refused by the support service"),
                Err(e) => tracing::warn!(referrer, error = %e.without_url(), "referral notice not sent"),
            }
        });
    }
}

#[cfg(test)]
pub(crate) mod tests;
