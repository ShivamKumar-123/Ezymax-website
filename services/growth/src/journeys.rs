//! Marketing automation journeys (D144).
//!
//! A journey is a trigger plus an ordered list of steps. The worker (every 15 s):
//!
//! 1. **facts**: pulls lifecycle facts per client from the reports service (first deposit, first live account,
//!    first live trade) into `profiles` (sign-up, email verified, KYC approved, last login, birthday and consent
//!    come with the gateway users feed, `profiles.rs`);
//! 2. **enrol**: for each live journey, clients whose trigger fired at or after the journey went live are
//!    enrolled once per occurrence (`UNIQUE (journey_id, user_id, occurrence)`);
//! 3. **run**: due enrolments are leased (next_run_at + 5 min) and walked step by step: `wait` parks the
//!    enrolment, `email` goes through the gateway's branded marketing mailer (consent and unsubscribe are enforced
//!    there, a suppressed email is logged and the journey carries on), `inapp` goes through the support service's
//!    `POST /v1/notify` (idempotent key `journey:<enrolment>:<step>`), `condition` exits the enrolment when the
//!    client doesn't match. Every outcome lands in `journey_events`, which is also the per-step stats source.
//!
//! Paused journeys keep their enrolments where they are; resuming carries on (and enrols triggers that fired
//! during the pause). Archiving exits every active enrolment.

use crate::audit::Actor;
use crate::error::{ApiError, ApiResult, invalid};
use crate::state::AppState;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;

/// Trigger kinds: (key, label, takes a day count).
pub const TRIGGERS: &[(&str, &str, bool)] = &[
    ("signed_up", "Signed up", false),
    ("email_verified", "Email verified", false),
    ("kyc_approved", "KYC approved", false),
    ("first_deposit", "First deposit", false),
    ("no_deposit", "No deposit after N days", true),
    ("inactive", "Inactive for N days", true),
    ("account_opened", "Live account opened", false),
    ("first_trade", "First trade", false),
    ("birthday", "Birthday", false),
];

/// Condition checks: (key, label).
pub const CHECKS: &[(&str, &str)] = &[
    ("email_verified", "Email verified"),
    ("kyc_approved", "KYC approved"),
    ("has_deposit", "Has deposited"),
    ("has_live_account", "Has a live account"),
    ("has_traded", "Has traded"),
    ("marketing_consent", "Allows marketing emails"),
];

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Trigger {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum Step {
    Wait {
        #[serde(default)]
        id: String,
        amount: i64,
        unit: String,
    },
    Email {
        #[serde(default)]
        id: String,
        subject: String,
        #[serde(default)]
        preheader: String,
        heading: String,
        body: String,
        #[serde(default)]
        button_label: String,
        #[serde(default)]
        button_url: String,
    },
    Inapp {
        #[serde(default)]
        id: String,
        title: String,
        #[serde(default)]
        body: String,
        #[serde(default)]
        link: String,
    },
    Condition {
        #[serde(default)]
        id: String,
        check: String,
        #[serde(default = "yes")]
        expect: bool,
    },
}

fn yes() -> bool {
    true
}

impl Step {
    pub fn id(&self) -> &str {
        match self {
            Step::Wait { id, .. } | Step::Email { id, .. } | Step::Inapp { id, .. } | Step::Condition { id, .. } => id,
        }
    }
    fn id_mut(&mut self) -> &mut String {
        match self {
            Step::Wait { id, .. } | Step::Email { id, .. } | Step::Inapp { id, .. } | Step::Condition { id, .. } => id,
        }
    }
    pub fn kind(&self) -> &'static str {
        match self {
            Step::Wait { .. } => "wait",
            Step::Email { .. } => "email",
            Step::Inapp { .. } => "inapp",
            Step::Condition { .. } => "condition",
        }
    }
}

pub fn wait_duration(amount: i64, unit: &str) -> Duration {
    match unit {
        "minutes" => Duration::minutes(amount),
        "hours" => Duration::hours(amount),
        _ => Duration::days(amount),
    }
}

fn link_ok(l: &str) -> bool {
    (l.starts_with('/') && !l.starts_with("//")) || l.starts_with("https://")
}

fn text(v: &str, field: &'static str, what: &str, min: usize, max: usize) -> ApiResult<()> {
    let n = v.trim().chars().count();
    if n < min || n > max {
        return Err(invalid(field, if min > 0 { format!("{what}: {min}–{max} characters.") } else { format!("{what}: at most {max} characters.") }));
    }
    Ok(())
}

/// Validates a trigger.
pub fn check_trigger(t: &Trigger) -> ApiResult<Trigger> {
    let Some((_, _, days)) = TRIGGERS.iter().find(|x| x.0 == t.kind) else { return Err(invalid("trigger", "Pick a trigger.")) };
    if *days {
        let d = t.days.unwrap_or(0);
        if !(1..=365).contains(&d) {
            return Err(invalid("trigger.days", "Enter 1–365 days."));
        }
        Ok(Trigger { kind: t.kind.clone(), days: Some(d) })
    } else {
        Ok(Trigger { kind: t.kind.clone(), days: None })
    }
}

/// Validates steps and gives each one a stable id (kept when the editor sends one back).
pub fn check_steps(steps: Vec<Step>) -> ApiResult<Vec<Step>> {
    if steps.is_empty() || steps.len() > 20 {
        return Err(invalid("steps", "A journey has 1–20 steps."));
    }
    if !steps.iter().any(|s| matches!(s, Step::Email { .. } | Step::Inapp { .. })) {
        return Err(invalid("steps", "Add at least one email or in-app message."));
    }
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(steps.len());
    for mut s in steps {
        match &s {
            Step::Wait { amount, unit, .. } => {
                if !matches!(unit.as_str(), "minutes" | "hours" | "days") {
                    return Err(invalid("steps", "Wait units are minutes, hours or days."));
                }
                if *amount < 1 || wait_duration(*amount, unit) > Duration::days(365) {
                    return Err(invalid("steps", "A wait is between 1 minute and 365 days."));
                }
            }
            Step::Email { subject, preheader, heading, body, button_label, button_url, .. } => {
                text(subject, "steps", "Email subject", 1, 200)?;
                text(preheader, "steps", "Preview text", 0, 200)?;
                text(heading, "steps", "Email heading", 1, 200)?;
                text(body, "steps", "Email message", 1, 5000)?;
                text(button_label, "steps", "Button label", 0, 60)?;
                if button_label.trim().is_empty() != button_url.trim().is_empty() {
                    return Err(invalid("steps", "Give the email button both a label and a link, or neither."));
                }
                if !button_url.trim().is_empty() && !link_ok(button_url.trim()) {
                    return Err(invalid("steps", "Button links are app paths such as /wallet/deposit or https:// URLs."));
                }
            }
            Step::Inapp { title, body, link, .. } => {
                text(title, "steps", "Notification title", 1, 200)?;
                text(body, "steps", "Notification text", 0, 1000)?;
                if !link.trim().is_empty() && !link_ok(link.trim()) {
                    return Err(invalid("steps", "Notification links are app paths such as /wallet or https:// URLs."));
                }
            }
            Step::Condition { check, .. } => {
                if !CHECKS.iter().any(|c| c.0 == check) {
                    return Err(invalid("steps", "Pick what the condition checks."));
                }
            }
        }
        let id = s.id().trim().to_string();
        let ok = !id.is_empty() && id.len() <= 24 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') && !seen.contains(&id);
        let id = if ok { id } else { format!("s{}", crate::db::random_code(8).to_lowercase()) };
        seen.insert(id.clone());
        *s.id_mut() = id;
        out.push(s);
    }
    Ok(out)
}

/// `{{first_name}}`, `{{last_name}}`, `{{name}}`, `{{country}}`, `{{referral_code}}`.
pub fn fill(template: &str, p: &Facts) -> String {
    let first = if p.first_name.is_empty() { "there" } else { p.first_name.as_str() };
    template
        .replace("{{first_name}}", first)
        .replace("{{last_name}}", &p.last_name)
        .replace("{{name}}", format!("{} {}", p.first_name, p.last_name).trim())
        .replace("{{country}}", &p.country)
        .replace("{{referral_code}}", &p.referral_code)
}

#[derive(Default, Clone, Debug)]
pub struct Facts {
    pub first_name: String,
    pub last_name: String,
    pub country: String,
    pub referral_code: String,
    pub email_verified: bool,
    pub kyc_approved: bool,
    pub has_deposit: bool,
    pub has_live_account: bool,
    pub has_traded: bool,
    pub marketing_consent: bool,
}

impl Facts {
    pub fn check(&self, key: &str) -> bool {
        match key {
            "email_verified" => self.email_verified,
            "kyc_approved" => self.kyc_approved,
            "has_deposit" => self.has_deposit,
            "has_live_account" => self.has_live_account,
            "has_traded" => self.has_traded,
            "marketing_consent" => self.marketing_consent,
            _ => false,
        }
    }
}

async fn facts(st: &AppState, tenant: &str, user_id: i64) -> anyhow::Result<Facts> {
    let r = sqlx::query("SELECT * FROM profiles WHERE tenant = $1 AND user_id = $2").bind(tenant).bind(user_id).fetch_optional(&st.pool).await?;
    Ok(r.map(|r| Facts {
        first_name: r.get("first_name"),
        last_name: r.get("last_name"),
        country: r.get("country"),
        referral_code: r.get("referral_code"),
        email_verified: r.get::<Option<DateTime<Utc>>, _>("email_verified_at").is_some(),
        kyc_approved: r.get::<String, _>("kyc_status") == "verified",
        has_deposit: r.get::<Option<DateTime<Utc>>, _>("first_deposit_at").is_some(),
        has_live_account: r.get::<Option<DateTime<Utc>>, _>("first_live_account_at").is_some(),
        has_traded: r.get::<Option<DateTime<Utc>>, _>("first_trade_at").is_some(),
        marketing_consent: r.get("marketing_consent"),
    })
    .unwrap_or_default())
}

// ---------------------------------------------------------------- JSON views

pub fn journey_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "name": r.get::<String, _>("name"),
        "description": r.get::<String, _>("description"),
        "trigger": r.get::<sqlx::types::Json<Value>, _>("trigger").0,
        "steps": r.get::<sqlx::types::Json<Value>, _>("steps").0,
        "status": r.get::<String, _>("status"),
        "liveSince": r.get::<Option<DateTime<Utc>>, _>("live_since"),
        "createdBy": r.get::<String, _>("created_by"),
        "updatedBy": r.get::<Option<String>, _>("updated_by"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "updatedAt": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

/// Enrolment counts per journey: {journeyId: {enrolled, active, completed, exited, failed}}.
pub async fn enrollment_counts(st: &AppState, tenant: &str, journey: Option<i64>) -> anyhow::Result<std::collections::HashMap<i64, Value>> {
    let rows = sqlx::query(
        "SELECT journey_id, count(*) AS n, count(*) FILTER (WHERE status = 'active') AS active, count(*) FILTER (WHERE status = 'completed') AS completed,
                count(*) FILTER (WHERE status = 'exited') AS exited, count(*) FILTER (WHERE status = 'failed') AS failed, max(enrolled_at) AS last
         FROM journey_enrollments WHERE tenant = $1 AND ($2::bigint IS NULL OR journey_id = $2) GROUP BY journey_id",
    )
    .bind(tenant)
    .bind(journey)
    .fetch_all(&st.pool)
    .await?;
    let sent = sqlx::query(
        "SELECT journey_id, count(*) FILTER (WHERE kind IN ('email_sent', 'email_logged')) AS emails, count(*) FILTER (WHERE kind = 'inapp_sent') AS inapp,
                count(*) FILTER (WHERE kind = 'email_suppressed') AS suppressed
         FROM journey_events WHERE tenant = $1 AND ($2::bigint IS NULL OR journey_id = $2) GROUP BY journey_id",
    )
    .bind(tenant)
    .bind(journey)
    .fetch_all(&st.pool)
    .await?;
    let mut m: std::collections::HashMap<i64, Value> = rows
        .iter()
        .map(|r| {
            (
                r.get::<i64, _>("journey_id"),
                json!({"enrolled": r.get::<i64, _>("n"), "active": r.get::<i64, _>("active"), "completed": r.get::<i64, _>("completed"), "exited": r.get::<i64, _>("exited"),
                       "failed": r.get::<i64, _>("failed"), "lastEnrolledAt": r.get::<Option<DateTime<Utc>>, _>("last"), "emails": 0, "inapp": 0, "suppressed": 0}),
            )
        })
        .collect();
    for r in &sent {
        let e = m.entry(r.get("journey_id")).or_insert_with(|| json!({"enrolled": 0, "active": 0, "completed": 0, "exited": 0, "failed": 0, "lastEnrolledAt": null}));
        e["emails"] = json!(r.get::<i64, _>("emails"));
        e["inapp"] = json!(r.get::<i64, _>("inapp"));
        e["suppressed"] = json!(r.get::<i64, _>("suppressed"));
    }
    Ok(m)
}

/// Per-step outcome counts: {stepId: {kind: count}} plus how many enrolments sit on each step now.
pub async fn step_stats(st: &AppState, journey: i64, steps: &[Step]) -> anyhow::Result<Vec<Value>> {
    let rows = sqlx::query("SELECT step_id, kind, count(*) AS n FROM journey_events WHERE journey_id = $1 AND step_id IS NOT NULL GROUP BY 1, 2").bind(journey).fetch_all(&st.pool).await?;
    let waiting = sqlx::query("SELECT step_index, count(*) AS n FROM journey_enrollments WHERE journey_id = $1 AND status = 'active' GROUP BY 1").bind(journey).fetch_all(&st.pool).await?;
    Ok(steps
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let mut counts = serde_json::Map::new();
            for r in rows.iter().filter(|r| r.get::<Option<String>, _>("step_id").as_deref() == Some(s.id())) {
                counts.insert(r.get::<String, _>("kind"), json!(r.get::<i64, _>("n")));
            }
            // a parked enrolment has already passed its wait step (step_index points at the next one)
            let here: i64 = waiting.iter().filter(|r| r.get::<i32, _>("step_index") as usize == i).map(|r| r.get::<i64, _>("n")).sum();
            json!({"stepId": s.id(), "kind": s.kind(), "counts": counts, "pending": here})
        })
        .collect())
}

// ---------------------------------------------------------------- facts from reports

/// Pulls first deposit / first live account / first trade per client from the reports service.
pub async fn sync_facts(st: &AppState, tenant: &str) -> anyhow::Result<usize> {
    let res = st
        .http
        .get(format!("{}/v1/internal/client-facts", st.cfg.reports_url))
        .header("x-kalks-internal", &st.cfg.reports_token)
        .header("x-kalks-tenant", tenant)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await?;
    if !res.status().is_success() {
        anyhow::bail!("reports client facts returned {}", res.status());
    }
    let v: Value = res.json().await?;
    let items = v["items"].as_array().cloned().unwrap_or_default();
    let t = |x: &Value| x.as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|d| d.with_timezone(&Utc));
    let (mut ids, mut dep, mut acc, mut trd) = (vec![], vec![], vec![], vec![]);
    for it in &items {
        let Some(id) = it["userId"].as_i64() else { continue };
        ids.push(id);
        dep.push(t(&it["firstDepositAt"]));
        acc.push(t(&it["firstLiveAccountAt"]));
        trd.push(t(&it["firstTradeAt"]));
    }
    if ids.is_empty() {
        return Ok(0);
    }
    let n = sqlx::query(
        "UPDATE profiles p SET first_deposit_at = x.dep, first_live_account_at = x.acc, first_trade_at = x.trd
         FROM unnest($2::bigint[], $3::timestamptz[], $4::timestamptz[], $5::timestamptz[]) AS x(id, dep, acc, trd)
         WHERE p.tenant = $1 AND p.user_id = x.id
           AND (p.first_deposit_at IS DISTINCT FROM x.dep OR p.first_live_account_at IS DISTINCT FROM x.acc OR p.first_trade_at IS DISTINCT FROM x.trd)",
    )
    .bind(tenant)
    .bind(&ids)
    .bind(&dep)
    .bind(&acc)
    .bind(&trd)
    .execute(&st.pool)
    .await?
    .rows_affected();
    Ok(n as usize)
}

// ---------------------------------------------------------------- enrolment

/// SQL selecting (user_id, trigger_at, occurrence) for a trigger. $1 tenant, $2 live_since, $3 days.
fn trigger_sql(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "signed_up" => "SELECT user_id, signed_up_at AS at, '' AS occ FROM profiles WHERE tenant = $1 AND signed_up_at >= $2",
        "email_verified" => "SELECT user_id, email_verified_at AS at, '' AS occ FROM profiles WHERE tenant = $1 AND email_verified_at >= $2",
        "kyc_approved" => "SELECT user_id, kyc_verified_at AS at, '' AS occ FROM profiles WHERE tenant = $1 AND kyc_verified_at >= $2",
        "first_deposit" => "SELECT user_id, first_deposit_at AS at, '' AS occ FROM profiles WHERE tenant = $1 AND first_deposit_at >= $2",
        "account_opened" => "SELECT user_id, first_live_account_at AS at, '' AS occ FROM profiles WHERE tenant = $1 AND first_live_account_at >= $2",
        "first_trade" => "SELECT user_id, first_trade_at AS at, '' AS occ FROM profiles WHERE tenant = $1 AND first_trade_at >= $2",
        "no_deposit" => {
            "SELECT user_id, signed_up_at + make_interval(days => $3::int) AS at, '' AS occ FROM profiles
             WHERE tenant = $1 AND first_deposit_at IS NULL AND signed_up_at + make_interval(days => $3::int) <= now()
               AND signed_up_at + make_interval(days => $3::int) >= $2"
        }
        "inactive" => {
            "SELECT user_id, COALESCE(last_login_at, signed_up_at) + make_interval(days => $3::int) AS at,
                    to_char(COALESCE(last_login_at, signed_up_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS occ FROM profiles
             WHERE tenant = $1 AND COALESCE(last_login_at, signed_up_at) + make_interval(days => $3::int) <= now()
               AND COALESCE(last_login_at, signed_up_at) + make_interval(days => $3::int) >= $2"
        }
        "birthday" => {
            "SELECT user_id, date_trunc('day', now()) AS at, to_char(now() AT TIME ZONE 'UTC', 'YYYY') AS occ FROM profiles
             WHERE tenant = $1 AND birthday = to_char(now() AT TIME ZONE 'UTC', 'MM-DD') AND $2 <= now()"
        }
        _ => return None,
    })
}

/// Enrols clients whose trigger fired since each live journey went live. Returns new enrolments.
pub async fn enrol_tick(st: &AppState) -> anyhow::Result<usize> {
    let journeys = sqlx::query("SELECT id, tenant, trigger, live_since FROM journeys WHERE status = 'live' AND live_since IS NOT NULL").fetch_all(&st.pool).await?;
    let mut total = 0;
    for j in &journeys {
        let id: i64 = j.get("id");
        let tenant: String = j.get("tenant");
        let trig: Trigger = match serde_json::from_value(j.get::<sqlx::types::Json<Value>, _>("trigger").0) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let Some(sql) = trigger_sql(&trig.kind) else { continue };
        let q = format!(
            "WITH c AS ({sql})
             INSERT INTO journey_enrollments (journey_id, tenant, user_id, occurrence, trigger_at)
             SELECT $4, $1, c.user_id, c.occ, c.at FROM c
             JOIN profiles p ON p.tenant = $1 AND p.user_id = c.user_id AND p.status = 'active'
             ORDER BY c.at LIMIT 1000
             ON CONFLICT (journey_id, user_id, occurrence) DO NOTHING
             RETURNING id, user_id"
        );
        let rows = sqlx::query(sqlx::AssertSqlSafe(q))
            .bind(&tenant)
            .bind(j.get::<DateTime<Utc>, _>("live_since"))
            .bind(trig.days.unwrap_or(0) as i32)
            .bind(id)
            .fetch_all(&st.pool)
            .await?;
        for r in &rows {
            event(st, id, r.get("id"), &tenant, r.get("user_id"), None, "enrolled", &TRIGGERS.iter().find(|x| x.0 == trig.kind).map(|x| x.1).unwrap_or("")).await?;
        }
        total += rows.len();
    }
    Ok(total)
}

async fn event(st: &AppState, journey: i64, enrollment: i64, tenant: &str, user_id: i64, step: Option<&str>, kind: &str, detail: &str) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO journey_events (journey_id, enrollment_id, tenant, user_id, step_id, kind, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(journey)
        .bind(enrollment)
        .bind(tenant)
        .bind(user_id)
        .bind(step)
        .bind(kind)
        .bind(detail.chars().take(500).collect::<String>())
        .execute(&st.pool)
        .await?;
    Ok(())
}

// ---------------------------------------------------------------- delivery

pub enum Sent {
    /// "sent" | "logged" | "suppressed", with the reason / masked address
    Done(String, String),
}

/// One marketing email through the gateway (branded, consent + unsubscribe enforced there).
pub async fn send_email(st: &AppState, tenant: &str, user_id: Option<i64>, to: Option<&str>, step: &Step, f: &Facts) -> anyhow::Result<Sent> {
    let Step::Email { subject, preheader, heading, body, button_label, button_url, .. } = step else { anyhow::bail!("not an email step") };
    let payload = json!({
        "tenant": tenant, "user_id": user_id, "to": to, "test": to.is_some(),
        "subject": fill(subject, f), "preheader": fill(preheader, f), "heading": fill(heading, f), "body": fill(body, f),
        "button_label": (!button_label.trim().is_empty()).then(|| fill(button_label, f)),
        "button_url": (!button_url.trim().is_empty()).then(|| button_url.trim().to_string()),
    });
    let res = st
        .http
        .post(format!("{}/v1/internal/mail/marketing", st.cfg.gateway_url))
        .header("x-kalks-internal", &st.cfg.gateway_token)
        .header("x-kalks-tenant", tenant)
        .timeout(std::time::Duration::from_secs(30))
        .json(&payload)
        .send()
        .await?;
    let status = res.status();
    let v: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        anyhow::bail!("gateway mail returned {status}: {}", v["error"]["message"].as_str().unwrap_or(""));
    }
    let s = v["status"].as_str().unwrap_or("sent").to_string();
    let detail = v["reason"].as_str().or(v["to"].as_str()).unwrap_or("").to_string();
    Ok(Sent::Done(s, detail))
}

/// One in-app notification through the support service. `staff` = test send to a staff member's bell.
pub async fn send_inapp(st: &AppState, tenant: &str, user_id: Option<i64>, staff: Option<&str>, step: &Step, f: &Facts, dedupe: Option<String>) -> anyhow::Result<()> {
    let Step::Inapp { title, body, link, .. } = step else { anyhow::bail!("not an in-app step") };
    let mut payload = json!({
        "type": "marketing.journey", "severity": "info", "title": fill(title, f), "body": fill(body, f), "email": false,
        "link": (!link.trim().is_empty()).then(|| link.trim().to_string()), "dedupeKey": dedupe,
    });
    match (user_id, staff) {
        (Some(u), _) => payload["userId"] = json!(u),
        (None, Some(s)) => payload["staffId"] = json!(s),
        _ => anyhow::bail!("no recipient"),
    }
    let res = st
        .http
        .post(format!("{}/v1/notify", st.cfg.notify_url))
        .header("x-kalks-internal", &st.cfg.notify_token)
        .header("x-kalks-tenant", tenant)
        .header("x-kalks-service", "growth")
        .timeout(std::time::Duration::from_secs(10))
        .json(&payload)
        .send()
        .await?;
    if !res.status().is_success() {
        anyhow::bail!("support notify returned {}", res.status());
    }
    Ok(())
}

// ---------------------------------------------------------------- runner

const MAX_ATTEMPTS: i32 = 6;

/// Walks due enrolments of live journeys. Returns how many enrolments were processed.
pub async fn run_tick(st: &AppState) -> anyhow::Result<usize> {
    // lease: a crashed worker's enrolments come back after 5 minutes
    let rows = sqlx::query(
        "UPDATE journey_enrollments e SET next_run_at = now() + interval '5 minutes', attempts = e.attempts + 1
         WHERE e.id IN (SELECT e2.id FROM journey_enrollments e2 JOIN journeys j ON j.id = e2.journey_id
                        WHERE e2.status = 'active' AND e2.next_run_at <= now() AND j.status = 'live'
                        ORDER BY e2.next_run_at LIMIT 100 FOR UPDATE OF e2 SKIP LOCKED)
         RETURNING e.id, e.journey_id, e.tenant, e.user_id, e.step_index, e.attempts",
    )
    .fetch_all(&st.pool)
    .await?;
    for r in &rows {
        let id: i64 = r.get("id");
        if let Err(e) = run_one(st, id, r.get("journey_id"), &r.get::<String, _>("tenant"), r.get("user_id"), r.get::<i32, _>("step_index") as usize, r.get("attempts")).await {
            tracing::warn!(enrollment = id, error = %e, "journey step failed");
        }
    }
    Ok(rows.len())
}

async fn run_one(st: &AppState, id: i64, journey: i64, tenant: &str, user_id: i64, mut idx: usize, attempts: i32) -> anyhow::Result<()> {
    let steps_v: sqlx::types::Json<Value> = sqlx::query_scalar("SELECT steps FROM journeys WHERE id = $1").bind(journey).fetch_one(&st.pool).await?;
    let steps: Vec<Step> = serde_json::from_value(steps_v.0)?;
    let f = facts(st, tenant, user_id).await?;
    let save = |idx: usize, next: Option<DateTime<Utc>>| {
        let pool = st.pool.clone();
        async move {
            sqlx::query("UPDATE journey_enrollments SET step_index = $2, next_run_at = COALESCE($3, now()), attempts = 0, last_error = NULL WHERE id = $1")
                .bind(id)
                .bind(idx as i32)
                .bind(next)
                .execute(&pool)
                .await
        }
    };
    while idx < steps.len() {
        let step = &steps[idx];
        let sid = Some(step.id());
        match step {
            Step::Wait { amount, unit, .. } => {
                let until = Utc::now() + wait_duration(*amount, unit);
                save(idx + 1, Some(until)).await?;
                event(st, journey, id, tenant, user_id, sid, "waiting", &format!("until {}", until.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))).await?;
                return Ok(());
            }
            Step::Condition { check, expect, .. } => {
                let met = f.check(check) == *expect;
                if !met {
                    event(st, journey, id, tenant, user_id, sid, "condition_not_met", check).await?;
                    finish(st, journey, id, tenant, user_id, "exited", "Condition not met").await?;
                    return Ok(());
                }
                event(st, journey, id, tenant, user_id, sid, "condition_met", check).await?;
            }
            Step::Email { .. } => match send_email(st, tenant, Some(user_id), None, step, &f).await {
                Ok(Sent::Done(status, detail)) => {
                    let kind = match status.as_str() {
                        "suppressed" => "email_suppressed",
                        "logged" => "email_logged",
                        _ => "email_sent",
                    };
                    event(st, journey, id, tenant, user_id, sid, kind, &detail).await?;
                }
                Err(e) => return retry(st, journey, id, tenant, user_id, step.id(), attempts, &e.to_string()).await,
            },
            Step::Inapp { .. } => {
                if let Err(e) = send_inapp(st, tenant, Some(user_id), None, step, &f, Some(format!("journey:{id}:{}", step.id()))).await {
                    return retry(st, journey, id, tenant, user_id, step.id(), attempts, &e.to_string()).await;
                }
                event(st, journey, id, tenant, user_id, sid, "inapp_sent", "").await?;
            }
        }
        idx += 1;
        save(idx, None).await?;
    }
    finish(st, journey, id, tenant, user_id, "completed", "").await
}

async fn retry(st: &AppState, journey: i64, id: i64, tenant: &str, user_id: i64, step: &str, attempts: i32, err: &str) -> anyhow::Result<()> {
    event(st, journey, id, tenant, user_id, Some(step), "error", err).await?;
    if attempts >= MAX_ATTEMPTS {
        sqlx::query("UPDATE journey_enrollments SET last_error = $2 WHERE id = $1").bind(id).bind(err).execute(&st.pool).await?;
        return finish(st, journey, id, tenant, user_id, "failed", err).await;
    }
    // back off 1, 2, 4, 8, 16 minutes
    let wait = Duration::minutes(1 << (attempts.clamp(1, 5) - 1));
    sqlx::query("UPDATE journey_enrollments SET next_run_at = now() + $2, last_error = $3 WHERE id = $1").bind(id).bind(wait).bind(err).execute(&st.pool).await?;
    Ok(())
}

async fn finish(st: &AppState, journey: i64, id: i64, tenant: &str, user_id: i64, status: &str, detail: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE journey_enrollments SET status = $2, finished_at = now() WHERE id = $1 AND status = 'active'").bind(id).bind(status).execute(&st.pool).await?;
    event(st, journey, id, tenant, user_id, None, status, detail).await
}

/// Archiving a journey exits whoever is still in it.
pub async fn exit_all(st: &AppState, journey: i64, actor: &Actor) -> anyhow::Result<u64> {
    let rows = sqlx::query("UPDATE journey_enrollments SET status = 'exited', finished_at = now() WHERE journey_id = $1 AND status = 'active' RETURNING id, tenant, user_id")
        .bind(journey)
        .fetch_all(&st.pool)
        .await?;
    for r in &rows {
        event(st, journey, r.get("id"), &r.get::<String, _>("tenant"), r.get("user_id"), None, "exited", &format!("Journey archived by {}", actor.label())).await?;
    }
    Ok(rows.len() as u64)
}

/// Test send: every email step to `to`, every in-app step to the staff member's bell, with sample data.
pub async fn test_send(st: &AppState, tenant: &str, steps: &[Step], to: &str, staff_id: &str, staff_name: &str) -> ApiResult<Vec<Value>> {
    let (first, last) = staff_name.split_once(' ').map(|(a, b)| (a.to_string(), b.to_string())).unwrap_or((staff_name.to_string(), String::new()));
    let f = Facts { first_name: first, last_name: last, country: "GB".into(), referral_code: "SAMPLE1234".into(), ..Default::default() };
    let mut out = vec![];
    for s in steps {
        match s {
            Step::Email { .. } => {
                let r = send_email(st, tenant, None, Some(to), s, &f).await.map_err(|e| ApiError::Unavailable(format!("The email service didn't accept the test: {e}")))?;
                let Sent::Done(status, detail) = r;
                out.push(json!({"stepId": s.id(), "kind": "email", "status": status, "to": detail}));
            }
            Step::Inapp { .. } => {
                let status = match send_inapp(st, tenant, None, Some(staff_id), s, &f, None).await {
                    Ok(()) => "sent".to_string(),
                    Err(e) => format!("failed: {e}"),
                };
                out.push(json!({"stepId": s.id(), "kind": "inapp", "status": status}));
            }
            _ => {}
        }
    }
    if out.is_empty() {
        return Err(invalid("steps", "This journey has no email or in-app step to test."));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn email(id: &str) -> Step {
        Step::Email { id: id.into(), subject: "Welcome {{first_name}}".into(), preheader: String::new(), heading: "Hi".into(), body: "Body".into(), button_label: String::new(), button_url: String::new() }
    }

    #[test]
    fn validates_triggers_and_steps() {
        assert!(check_trigger(&Trigger { kind: "nope".into(), days: None }).is_err());
        assert!(check_trigger(&Trigger { kind: "no_deposit".into(), days: None }).is_err());
        assert_eq!(check_trigger(&Trigger { kind: "no_deposit".into(), days: Some(3) }).unwrap().days, Some(3));
        assert_eq!(check_trigger(&Trigger { kind: "signed_up".into(), days: Some(3) }).unwrap().days, None);
        assert!(check_steps(vec![]).is_err());
        assert!(check_steps(vec![Step::Wait { id: String::new(), amount: 1, unit: "days".into() }]).is_err());
        assert!(check_steps(vec![Step::Wait { id: String::new(), amount: 400, unit: "days".into() }, email("")]).is_err());
        let bad_link = Step::Inapp { id: String::new(), title: "t".into(), body: String::new(), link: "javascript:x".into() };
        assert!(check_steps(vec![bad_link]).is_err());
        let s = check_steps(vec![email("a"), email("a"), Step::Condition { id: String::new(), check: "has_deposit".into(), expect: false }]).unwrap();
        assert_eq!(s[0].id(), "a");
        assert_ne!(s[1].id(), "a");
        assert!(!s[2].id().is_empty());
    }

    #[test]
    fn step_json_round_trip() {
        let v = json!([{"kind": "wait", "amount": 2, "unit": "hours"}, {"kind": "email", "subject": "S", "heading": "H", "body": "B", "buttonLabel": "Deposit", "buttonUrl": "/wallet/deposit"},
                       {"kind": "inapp", "title": "T"}, {"kind": "condition", "check": "has_deposit", "expect": false}]);
        let steps: Vec<Step> = serde_json::from_value(v).unwrap();
        assert!(matches!(&steps[1], Step::Email { button_url, .. } if button_url == "/wallet/deposit"));
        let back = serde_json::to_value(&steps).unwrap();
        assert_eq!(back[1]["buttonLabel"], "Deposit");
        assert_eq!(back[3]["expect"], false);
        assert_eq!(wait_duration(2, "hours"), Duration::hours(2));
    }

    #[test]
    fn fills_placeholders() {
        let f = Facts { first_name: "Ann".into(), last_name: "Lee".into(), ..Default::default() };
        assert_eq!(fill("Hi {{first_name}} ({{name}})", &f), "Hi Ann (Ann Lee)");
        assert_eq!(fill("Hi {{first_name}}", &Facts::default()), "Hi there");
        assert!(Facts { has_deposit: true, ..Default::default() }.check("has_deposit"));
        assert!(!Facts::default().check("unknown"));
    }
}
