//! Marketing (D144): first-touch campaign attribution, marketing-email consent, the unsubscribe link and the
//! tenant-branded marketing mailer the growth service's journeys send through.
//!
//! * Attribution (`utm_*`, landing page, external referrer) comes from the Client Area register call and is
//!   stored once on the new user. The users feed (`internal.rs`) passes it on to growth / reports / IB.
//! * `POST /v1/internal/mail/marketing` renders the journey email in the transactional design with the
//!   tenant's brand, checks consent (tests skip it) and sends it (SMTP) or logs it (no SMTP in development).
//! * `POST /v1/public/unsubscribe` takes the signed link from the email footer (the Client Area
//!   `/unsubscribe` page posts it); `GET|PUT /v1/auth/marketing` is the client's own switch.
//!   Transactional emails never look at `marketing_consent`.

use axum::Json;
use axum::extract::State;
use axum::extract::rejection::JsonRejection;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgPool, Row};

use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::crypto;
use crate::error::{ApiError, ApiResult};
use crate::identity::{self, Kind};
use crate::mailer::{MailBrand, MarketingMail, render_marketing};
use crate::state::{AppState, Ctx};
use crate::validate;

// ---------- attribution ----------

/// Attribution fields as the Client Area sends them (all optional, untrusted).
#[derive(Deserialize, Default, Debug, Clone)]
pub struct AttributionReq {
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_term: Option<String>,
    pub utm_content: Option<String>,
    pub landing_page: Option<String>,
    pub referrer: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq)]
pub struct Attribution {
    pub source: Option<String>,
    pub medium: Option<String>,
    pub campaign: Option<String>,
    pub term: Option<String>,
    pub content: Option<String>,
    pub landing_page: Option<String>,
    pub referrer: Option<String>,
}

impl Attribution {
    pub fn is_empty(&self) -> bool {
        *self == Attribution::default()
    }
}

/// Trims, drops control characters and anything outside a conservative set, caps the length.
fn token(v: Option<&str>, max: usize, lower: bool) -> Option<String> {
    let v: String = v?
        .trim()
        .chars()
        .filter(|c| c.is_alphanumeric() || " -_.+/:%|~!@,()".contains(*c))
        .take(max)
        .collect();
    let v = v.trim().to_string();
    if v.is_empty() {
        return None;
    }
    Some(if lower { v.to_lowercase() } else { v })
}

/// Normalises what the browser sent. Source / medium / campaign are lower-cased so reports group them.
pub fn clean_attribution(r: &AttributionReq) -> Attribution {
    let landing_page = r.landing_page.as_deref().map(str::trim).filter(|p| p.starts_with('/') && !p.starts_with("//")).map(|p| {
        p.chars().filter(|c| !c.is_control()).take(300).collect::<String>()
    });
    // only the host of an external referrer (never full URLs with personal data in the query)
    let referrer = r.referrer.as_deref().map(str::trim).and_then(|u| {
        let rest = u.strip_prefix("https://").or_else(|| u.strip_prefix("http://"))?;
        let host = rest.split(['/', '?', '#']).next()?.to_lowercase();
        (!host.is_empty() && host.len() <= 200 && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':')).then_some(host)
    });
    Attribution {
        source: token(r.utm_source.as_deref(), 100, true),
        medium: token(r.utm_medium.as_deref(), 100, true),
        campaign: token(r.utm_campaign.as_deref(), 100, true),
        term: token(r.utm_term.as_deref(), 100, false),
        content: token(r.utm_content.as_deref(), 100, false),
        landing_page,
        referrer,
    }
}

/// Stores first-touch attribution and the sign-up consent on a new user (never overwrites earlier values).
pub async fn store_signup(pool: &PgPool, user_id: i64, a: &Attribution, consent: bool) -> ApiResult<()> {
    sqlx::query(
        "UPDATE users SET utm_source = COALESCE(utm_source, $2), utm_medium = COALESCE(utm_medium, $3), utm_campaign = COALESCE(utm_campaign, $4),
                utm_term = COALESCE(utm_term, $5), utm_content = COALESCE(utm_content, $6), landing_page = COALESCE(landing_page, $7),
                first_referrer = COALESCE(first_referrer, $8), marketing_consent = $9, marketing_consent_at = now(),
                marketing_unsubscribed_at = CASE WHEN $9 THEN NULL ELSE now() END
         WHERE id = $1",
    )
    .bind(user_id)
    .bind(&a.source)
    .bind(&a.medium)
    .bind(&a.campaign)
    .bind(&a.term)
    .bind(&a.content)
    .bind(&a.landing_page)
    .bind(&a.referrer)
    .bind(consent)
    .execute(pool)
    .await?;
    Ok(())
}

/// `attribution` block for the Back Office client 360.
pub async fn attribution_json(pool: &PgPool, tenant_id: i64, user_id: i64) -> ApiResult<Value> {
    let r = sqlx::query(
        "SELECT utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, first_referrer, referral_campaign,
                marketing_consent, marketing_consent_at, marketing_unsubscribed_at
         FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    Ok(json!({
        "utm_source": r.get::<Option<String>, _>("utm_source"),
        "utm_medium": r.get::<Option<String>, _>("utm_medium"),
        "utm_campaign": r.get::<Option<String>, _>("utm_campaign"),
        "utm_term": r.get::<Option<String>, _>("utm_term"),
        "utm_content": r.get::<Option<String>, _>("utm_content"),
        "landing_page": r.get::<Option<String>, _>("landing_page"),
        "referrer": r.get::<Option<String>, _>("first_referrer"),
        "partner_campaign": r.get::<Option<String>, _>("referral_campaign"),
        "marketing_consent": r.get::<bool, _>("marketing_consent"),
        "marketing_consent_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("marketing_consent_at"),
        "marketing_unsubscribed_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("marketing_unsubscribed_at"),
    }))
}

// ---------- unsubscribe links ----------

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// Signature of an unsubscribe link (first 128 bits of HMAC(secret, "unsubscribe" || tenant:user)).
pub fn unsubscribe_sig(st: &AppState, tenant_id: i64, user_id: i64) -> String {
    hex(&st.keys.hash("unsubscribe", &format!("{tenant_id}:{user_id}"))[..16])
}

// ---------- tenant brand ----------

pub struct TenantBrand {
    pub id: i64,
    pub slug: String,
    pub brand: MailBrand,
    /// Client Area base URL (no trailing slash).
    pub app_url: String,
}

fn https(d: &str) -> String {
    format!("https://{d}")
}

pub async fn tenant_brand(st: &AppState, slug: &str) -> ApiResult<TenantBrand> {
    let r = sqlx::query("SELECT id, slug, name, brand, domains, contact_email, status FROM tenants WHERE slug = $1")
        .bind(slug)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    let slug: String = r.get("slug");
    let brand: Value = r.get::<sqlx::types::Json<Value>, _>("brand").0;
    let domains: Vec<String> = r.get("domains");
    let is_ezymex = slug == "ezymex";
    let pick = |prefix: &str| domains.iter().find(|d| d.starts_with(prefix)).map(|d| https(d));
    let site = if is_ezymex && !st.cfg.site_url.is_empty() {
        st.cfg.site_url.clone()
    } else {
        domains.iter().find(|d| !d.starts_with("app.") && !d.starts_with("admin.") && !d.starts_with("trade.")).map(|d| https(d)).unwrap_or_else(|| st.cfg.site_url.clone())
    };
    let app_url = if is_ezymex && !st.cfg.app_url.is_empty() { st.cfg.app_url.clone() } else { pick("app.").unwrap_or_else(|| st.cfg.app_url.clone()) };
    let support_email = brand["support_email"]
        .as_str()
        .map(str::to_string)
        .or_else(|| if is_ezymex { None } else { r.get::<Option<String>, _>("contact_email") })
        .filter(|e| e.contains('@'))
        .unwrap_or_else(|| st.cfg.support_email.clone());
    Ok(TenantBrand {
        id: r.get("id"),
        brand: MailBrand {
            name: r.get("name"),
            primary: brand["primary"].as_str().unwrap_or("#ff5a1f").to_string(),
            accent: brand["accent"].as_str().unwrap_or("#e9b949").to_string(),
            logo_url: brand["logo_url"].as_str().filter(|u| u.starts_with("https://")).map(str::to_string),
            ezymex_logo: is_ezymex,
            site_url: site.trim_end_matches('/').to_string(),
            support_email,
        },
        app_url: app_url.trim_end_matches('/').to_string(),
        slug,
    })
}

// ---------- POST /v1/internal/mail/marketing ----------

#[derive(Deserialize)]
pub struct MailReq {
    tenant: Option<String>,
    user_id: Option<i64>,
    /// Test sends only: the staff member's own address.
    to: Option<String>,
    #[serde(default)]
    test: bool,
    #[serde(default)]
    subject: String,
    preheader: Option<String>,
    #[serde(default)]
    heading: String,
    #[serde(default)]
    body: String,
    button_label: Option<String>,
    button_url: Option<String>,
}

fn clip(s: &str, n: usize) -> String {
    s.trim().chars().filter(|c| !c.is_control() || *c == '\n').take(n).collect()
}

pub async fn send_marketing(State(st): State<AppState>, ctx: Ctx, req: Result<Json<MailReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let tenant_slug = r.tenant.as_deref().map(str::to_lowercase).unwrap_or_else(|| ctx.tenant_slug.clone());
    let t = tenant_brand(&st, &tenant_slug).await?;
    let subject = clip(&r.subject, 200);
    let heading = clip(&r.heading, 200);
    let text = clip(&r.body, 5000);
    if subject.is_empty() {
        return Err(ApiError::Validation { field: "subject", message: "Enter a subject." });
    }
    if heading.is_empty() || text.is_empty() {
        return Err(ApiError::Validation { field: "body", message: "Enter a heading and a message." });
    }
    let button = match (r.button_label.as_deref().map(|l| clip(l, 60)).filter(|l| !l.is_empty()), r.button_url.as_deref().map(str::trim).filter(|u| !u.is_empty())) {
        (Some(label), Some(url)) => {
            let url = if url.starts_with('/') && !url.starts_with("//") {
                format!("{}{}", t.app_url, url)
            } else if url.starts_with("https://") || (st.cfg.dev_mode && url.starts_with("http://")) {
                url.to_string()
            } else {
                return Err(ApiError::Validation { field: "button_url", message: "Use an app path such as /wallet/deposit or an https:// link." });
            };
            Some((label, url.chars().take(500).collect::<String>()))
        }
        _ => None,
    };
    let (to, user_id, unsubscribe_url) = if r.test {
        let to = validate::email(r.to.as_deref().unwrap_or("")).map_err(|_| ApiError::Validation { field: "to", message: "A test send needs your email address." })?;
        (to, None, format!("{}/unsubscribe", t.app_url))
    } else {
        let uid = r.user_id.filter(|u| *u > 0).ok_or(ApiError::Validation { field: "user_id", message: "user_id is required." })?;
        let u = sqlx::query("SELECT email, status, marketing_consent FROM users WHERE id = $1 AND tenant_id = $2")
            .bind(uid)
            .bind(t.id)
            .fetch_optional(&st.pool)
            .await?
            .ok_or(ApiError::NotFound)?;
        if !u.get::<bool, _>("marketing_consent") {
            return Ok(Json(json!({ "status": "suppressed", "reason": "unsubscribed" })));
        }
        if u.get::<String, _>("status") != "active" {
            return Ok(Json(json!({ "status": "suppressed", "reason": "inactive" })));
        }
        let sig = unsubscribe_sig(&st, t.id, uid);
        (u.get::<String, _>("email"), Some(uid), format!("{}/unsubscribe?u={uid}&s={sig}", t.app_url))
    };
    let mail = MarketingMail {
        subject: if r.test { format!("[Test] {subject}") } else { subject },
        preheader: r.preheader.as_deref().map(|p| clip(p, 200)).unwrap_or_default(),
        heading,
        body: text,
        button,
        unsubscribe_url,
    };
    let masked = validate::mask_email(&to);
    let status = match &st.mailer {
        Some(m) => {
            m.send_marketing(&to, &t.brand, &mail).await.map_err(|e| {
                tracing::warn!(error = %e, tenant = %t.slug, "marketing email failed");
                ApiError::Coded { status: axum::http::StatusCode::BAD_GATEWAY, code: "smtp_failed", message: "The email could not be sent." }
            })?;
            "sent"
        }
        None => {
            let (plain, _) = render_marketing(&t.brand, &mail);
            tracing::info!(target: "email", to = %masked, subject = %mail.subject, tenant = %t.slug, user_id, text = %plain, "DEV marketing email (SMTP not configured)");
            "logged"
        }
    };
    Ok(Json(json!({ "status": status, "to": masked })))
}

// ---------- POST /v1/public/unsubscribe ----------

#[derive(Deserialize)]
pub struct UnsubscribeReq {
    #[serde(default)]
    u: i64,
    #[serde(default)]
    s: String,
}

pub async fn unsubscribe(State(st): State<AppState>, ctx: Ctx, req: Result<Json<UnsubscribeReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    identity::limit(&st, format!("unsubscribe:ip:{}", ctx.ip), 30, 15 * 60)?;
    let row = sqlx::query("SELECT tenant_id, email, marketing_consent FROM users WHERE id = $1").bind(r.u).fetch_optional(&st.pool).await?;
    let Some(row) = row else { return Err(ApiError::Coded { status: axum::http::StatusCode::BAD_REQUEST, code: "invalid_link", message: "This unsubscribe link isn't valid." }) };
    let tenant_id: i64 = row.get("tenant_id");
    if r.s.len() != 32 || !crypto::ct_eq(r.s.as_bytes(), unsubscribe_sig(&st, tenant_id, r.u).as_bytes()) {
        return Err(ApiError::Coded { status: axum::http::StatusCode::BAD_REQUEST, code: "invalid_link", message: "This unsubscribe link isn't valid." });
    }
    if row.get::<bool, _>("marketing_consent") {
        sqlx::query("UPDATE users SET marketing_consent = false, marketing_unsubscribed_at = now(), marketing_consent_at = now(), updated_at = now() WHERE id = $1")
            .bind(r.u)
            .execute(&st.pool)
            .await?;
        audit::record(&st.pool, &ctx, Entry { tenant_id, actor_kind: "user", actor_id: Some(r.u), action: "user.marketing_unsubscribed", target: Some(("user", r.u)), meta: json!({"via": "email_link"}) }).await;
    }
    Ok(Json(json!({ "ok": true, "email": validate::mask_email(&row.get::<String, _>("email")) })))
}

// ---------- GET | PUT /v1/auth/marketing ----------

pub async fn get_consent(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let s = identity::resolve_session(&st, &ctx, Kind::User).await?;
    let r = sqlx::query("SELECT marketing_consent, marketing_consent_at FROM users WHERE id = $1").bind(s.subject_id).fetch_one(&st.pool).await?;
    Ok(Json(json!({ "marketing_consent": r.get::<bool, _>("marketing_consent"), "updated_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("marketing_consent_at") })))
}

#[derive(Deserialize)]
pub struct ConsentReq {
    consent: bool,
}

pub async fn put_consent(State(st): State<AppState>, ctx: Ctx, req: Result<Json<ConsentReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let s = identity::resolve_session(&st, &ctx, Kind::User).await?;
    sqlx::query(
        "UPDATE users SET marketing_consent = $2, marketing_consent_at = now(),
                marketing_unsubscribed_at = CASE WHEN $2 THEN NULL ELSE now() END, updated_at = now()
         WHERE id = $1",
    )
    .bind(s.subject_id)
    .bind(r.consent)
    .execute(&st.pool)
    .await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: s.tenant_id,
        actor_kind: "user",
        actor_id: Some(s.subject_id),
        action: if r.consent { "user.marketing_subscribed" } else { "user.marketing_unsubscribed" },
        target: Some(("user", s.subject_id)),
        meta: json!({"via": "client_area"}),
    })
    .await;
    Ok(Json(json!({ "marketing_consent": r.consent })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testdb::TestDb;

    #[test]
    fn cleans_attribution() {
        let a = clean_attribution(&AttributionReq {
            utm_source: Some("  Google ".into()),
            utm_medium: Some("CPC".into()),
            utm_campaign: Some("Spring_FX<script>".into()),
            utm_term: Some("forex broker".into()),
            utm_content: Some("\u{0007}ad-1".into()),
            landing_page: Some("/register?ref=AB12".into()),
            referrer: Some("https://www.Google.com/search?q=secret".into()),
        });
        assert_eq!(a.source.as_deref(), Some("google"));
        assert_eq!(a.medium.as_deref(), Some("cpc"));
        assert_eq!(a.campaign.as_deref(), Some("spring_fxscript"));
        assert_eq!(a.term.as_deref(), Some("forex broker"));
        assert_eq!(a.content.as_deref(), Some("ad-1"));
        assert_eq!(a.landing_page.as_deref(), Some("/register?ref=AB12"));
        assert_eq!(a.referrer.as_deref(), Some("www.google.com"));
        let b = clean_attribution(&AttributionReq { landing_page: Some("//evil.com".into()), referrer: Some("javascript:alert(1)".into()), ..Default::default() });
        assert!(b.is_empty());
    }

    #[test]
    fn marketing_email_has_brand_and_unsubscribe() {
        let b = MailBrand { name: "Broker Two".into(), primary: "#2255ff".into(), accent: "bad".into(), logo_url: None, ezymex_logo: false, site_url: "https://b2.test".into(), support_email: "help@b2.test".into() };
        let m = MarketingMail { subject: "Hi".into(), preheader: String::new(), heading: "Welcome <b>".into(), body: "One\n\nTwo".into(), button: Some(("Deposit".into(), "https://app.b2.test/wallet".into())), unsubscribe_url: "https://app.b2.test/unsubscribe?u=1&s=x".into() };
        let (text, html) = render_marketing(&b, &m);
        assert!(text.contains("Unsubscribe: https://app.b2.test/unsubscribe?u=1&s=x"));
        assert!(html.contains("Broker Two") && html.contains("#2255ff") && html.contains("#e9b949"));
        assert!(html.contains("Welcome &lt;b&gt;") && html.contains("unsubscribe?u=1&amp;s=x"));
        assert!(!html.contains("cid:"));
    }

    #[tokio::test]
    async fn consent_suppresses_and_unsubscribe_link_works() {
        let Some(db) = TestDb::new("marketing").await else { return };
        let st = db.st.clone();
        let tid: i64 = sqlx::query_scalar("SELECT id FROM tenants WHERE slug = 'ezymex'").fetch_one(&st.pool).await.unwrap();
        let uid: i64 = sqlx::query_scalar(
            "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, terms_accepted_at)
             VALUES ($1, 'm@example.com', 'x', 'Ann', 'Lee', '+91', '9000000000', 'IN', '1990-01-01', 'ANN1234', now()) RETURNING id",
        )
        .bind(tid)
        .fetch_one(&st.pool)
        .await
        .unwrap();
        let a = clean_attribution(&AttributionReq { utm_source: Some("google".into()), utm_campaign: Some("launch".into()), ..Default::default() });
        store_signup(&st.pool, uid, &a, true).await.unwrap();
        let attr = attribution_json(&st.pool, tid, uid).await.unwrap();
        assert_eq!(attr["utm_campaign"], "launch");
        assert_eq!(attr["marketing_consent"], true);

        let ctx = || Ctx { ip: "127.0.0.1".into(), user_agent: String::new(), device: None, tenant_slug: "ezymex".into(), bearer: None };
        let mail = |test: bool| MailReq { tenant: Some("ezymex".into()), user_id: Some(uid), to: Some("staff@example.com".into()), test, subject: "S".into(), preheader: None, heading: "H".into(), body: "B".into(), button_label: Some("Go".into()), button_url: Some("/wallet".into()) };
        let v = send_marketing(State(st.clone()), ctx(), Ok(Json(mail(false)))).await.unwrap().0;
        assert_eq!(v["status"], "logged");

        // a wrong signature is rejected, the right one unsubscribes
        assert!(unsubscribe(State(st.clone()), ctx(), Ok(Json(UnsubscribeReq { u: uid, s: "0".repeat(32) }))).await.is_err());
        let sig = unsubscribe_sig(&st, tid, uid);
        unsubscribe(State(st.clone()), ctx(), Ok(Json(UnsubscribeReq { u: uid, s: sig }))).await.unwrap();
        let v = send_marketing(State(st.clone()), ctx(), Ok(Json(mail(false)))).await.unwrap().0;
        assert_eq!(v["status"], "suppressed");
        // a test send to staff ignores consent
        let v = send_marketing(State(st.clone()), ctx(), Ok(Json(mail(true)))).await.unwrap().0;
        assert_eq!(v["status"], "logged");
        db.drop_db().await;
    }
}
