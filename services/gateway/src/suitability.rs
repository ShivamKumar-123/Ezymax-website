//! Suitability for complex products (O41). Ezymex FX Options onboarding is light (founder decision 2026-10-02): a
//! client is **eligible** for options, demo and live, once they have accepted the options disclosure, any published
//! version (time, IP and user agent recorded). Verified identity and the knowledge quiz no longer affect eligibility:
//! the responses still carry `kycVerified` / `quizPassed` for information, and the quiz stays available as an
//! optional self-test ([`PASS_MARK`] of 10). Withdrawals still need verified identity (kyc.rs); nothing here changes
//! that. Every acceptance and every quiz attempt is also in the audit log.
//!
//! Storage (migrations `20261002150000_options_suitability.sql`, `20261002190000_options_onboarding_light.sql`;
//! row-level security like every tenant table): `disclosures` (append-only versions per tenant and product) and
//! `suitability` (one row per client and product). A broker without its own disclosure gets a copy of the platform's
//! current one (tenant `ezymex`) on first use. A newer version doesn't undo an earlier acceptance; accepting again
//! records the newer version.
//!
//! Client (session bearer, via the Client Area BFF `/api/suitability/*`):
//! * `GET  /v1/suitability/{product}`          status, current disclosure, quiz questions (never the answers)
//! * `POST /v1/suitability/{product}/accept`   `{version}` accepts the current disclosure (409 `disclosure_outdated`
//!   when a newer version was published meanwhile)
//! * `POST /v1/suitability/{product}/quiz`     optional self-test: `{answers: {id: index}}` → `{passed, score, total,
//!   passMark, wrong: [{id, explanation}]}`
//!
//! View-only logins and staff sessions opened as the client can read the status but never accept or take the quiz:
//! these are the client's own attestations.
//!
//! Internal (trading engine, before it opens an options position):
//! * `GET /v1/internal/suitability/{user_id}?product=options` → `{eligible, kycVerified, disclosureAccepted,
//!   quizPassed, missing[], ...}`; `missing` is `["disclosure"]` or empty. With `X-Ezymex-Tenant` / `X-Ezymex-Host` the
//!   client must belong to that broker (404 otherwise); without either the user id alone decides.

#[cfg(test)]
mod tests;

use axum::Json;
use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::collections::BTreeMap;

use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::domains::{self, Source};
use crate::error::{ApiError, ApiResult};
use crate::identity::{self, Kind, SessionRef};
use crate::state::{AppState, Ctx};

/// Products that need a suitability check.
pub const PRODUCTS: &[&str] = &["options"];

/// Correct answers needed to pass the optional quiz (of [`OPTIONS_QUIZ`]'s 10).
pub const PASS_MARK: usize = 8;

/// Tenant whose current disclosure is copied to a broker that has none yet.
const PLATFORM_TENANT: &str = "ezymex";

fn product(raw: &str) -> ApiResult<&'static str> {
    PRODUCTS.iter().copied().find(|p| *p == raw.trim()).ok_or(ApiError::NotFound)
}

// ---------- knowledge quiz ----------

/// One multiple-choice question. `answer` indexes `options`; it and `explanation` never leave the server
/// before the client has answered.
pub struct Question {
    pub id: &'static str,
    pub text: &'static str,
    pub options: [&'static str; 4],
    pub answer: usize,
    pub explanation: &'static str,
}

/// Ezymex FX Options knowledge check (an optional self-test; it doesn't affect eligibility): calls and puts, premium,
/// the buyer's and the seller's maximum loss, seller margin, breakeven, expiry and settlement, time decay, barriers
/// and delta. Changing a question's meaning needs a new id (attempts are audited by id).
pub const OPTIONS_QUIZ: &[Question] = &[
    Question {
        id: "call-right",
        text: "What does buying a call option give you?",
        options: [
            "The obligation to buy the underlying at the strike price at expiry",
            "The right, but not the obligation, to profit if the price at expiry is above the strike",
            "A guaranteed profit if the price rises",
            "The right to sell the underlying at the strike price",
        ],
        answer: 1,
        explanation: "A call gives the buyer a right, not an obligation. Ezymex FX Options are cash-settled: at expiry a call pays the amount by which the settlement price is above the strike, times the contract size. At or below the strike it expires worthless.",
    },
    Question {
        id: "put-payout",
        text: "You buy a EURUSD put with a strike of 1.1600. When does it pay out at expiry?",
        options: [
            "When the settlement price is above 1.1600",
            "Whenever EURUSD touches 1.1600 at any time before expiry",
            "When the settlement price is below 1.1600",
            "Always, because a put is a hedge",
        ],
        answer: 2,
        explanation: "A put gains when the price falls. At expiry it pays the difference between the strike and the settlement price if the settlement price is below the strike. Otherwise it expires worthless.",
    },
    Question {
        id: "buyer-max-loss",
        text: "You buy one call option and pay a premium of 120 USD. Which statement is true?",
        options: [
            "Apart from commission, 120 USD is the most you can lose on this trade",
            "The premium is refunded if the option expires out of the money",
            "You must also post margin and can lose more than 120 USD",
            "You pay the premium only if the option ends in the money",
        ],
        answer: 0,
        explanation: "The premium is the price of the option. A buyer pays it in full when opening the trade and has no further obligation, so the most a buyer can lose is the premium paid (plus commission). It is not refunded if the option expires worthless.",
    },
    Question {
        id: "seller-max-loss",
        text: "What is the main risk of selling (writing) a call option?",
        options: [
            "You can lose at most the premium you received",
            "There is no risk, because you keep the premium",
            "You only lose if volatility falls",
            "Your loss can be many times the premium, and keeps growing as the price rises",
        ],
        answer: 3,
        explanation: "A seller keeps the whole premium only if the option expires worthless. If the price rises strongly, a sold call loses more with every move, without a fixed limit, and the loss can be many times the premium received.",
    },
    Question {
        id: "seller-margin",
        text: "Why must you hold margin when you sell options?",
        options: [
            "Margin is a one-off fee for selling an option",
            "Because your possible loss is larger than the premium; if your equity falls below the margin needed, positions can be closed automatically",
            "Sellers need no margin because they receive the premium",
            "Only option buyers need margin",
        ],
        answer: 1,
        explanation: "Sellers can lose more than the premium, so the account must hold margin based on stress scenarios of price and volatility. Margin can rise when the market moves against you or before weekends. Below the requirement you get a margin call, and at the stop-out level positions are closed automatically. Bonus and credit cannot be used.",
    },
    Question {
        id: "breakeven",
        text: "You buy a gold (XAUUSD) call with a strike of 4,000 for a premium of 30 USD per ounce. Where do you break even at expiry?",
        options: ["3,970", "4,000", "4,030", "4,060"],
        answer: 2,
        explanation: "For a bought call, breakeven at expiry is the strike plus the premium per unit: 4,000 + 30 = 4,030. Below that, the payout does not cover the premium. For a bought put it is the strike minus the premium.",
    },
    Question {
        id: "settlement",
        text: "How are Ezymex FX Options settled at expiry?",
        options: [
            "You receive the currency, metal or oil",
            "In cash, at the last traded price of the day",
            "They must be closed by hand, or they are lost",
            "In cash, automatically, at the average mid price of the 30 minutes before the cut",
        ],
        answer: 3,
        explanation: "Options are European and cash-settled in USD, and exercised automatically. The settlement price is the time-weighted average of the mid price over the 30 minutes before the cut (10:00 New York by default). In-the-money options pay the difference; out-of-the-money options expire worthless.",
    },
    Question {
        id: "time-decay",
        text: "If nothing else changes, what happens to an option's value as expiry gets closer?",
        options: [
            "It rises steadily",
            "Its time value shrinks, and the decay speeds up close to expiry",
            "It stays the same until the last day",
            "It only changes when the underlying price moves",
        ],
        answer: 1,
        explanation: "This is time decay (theta). Every day the option has less time to move into profit, so its time value falls, fastest in the final days and hours. Buyers lose from time decay; sellers gain from it.",
    },
    Question {
        id: "knock-out",
        text: "You hold a knock-out call. What happens if the underlying price touches the barrier before expiry?",
        options: [
            "The option is cancelled and worthless, even if the price moves back later",
            "The strike moves to the barrier level",
            "Nothing until expiry; only the settlement price matters",
            "The premium is refunded",
        ],
        answer: 0,
        explanation: "A knock-out option ends as soon as the barrier is touched. It does not come back if the price returns, and the premium is not refunded. That risk is why barrier options cost less than standard options.",
    },
    Question {
        id: "delta",
        text: "An option has a delta of 0.40. What does that roughly mean?",
        options: [
            "It has a 40% chance of losing money",
            "It loses 40% of its value every day",
            "Its value moves about 0.40 times as much as the underlying price",
            "Its premium is 40% of the contract value",
        ],
        answer: 2,
        explanation: "Delta measures how much an option's value changes for a small move in the underlying: with a delta of 0.40 the option gains about 40% of the underlying's move. Delta changes as the price moves and as expiry nears (gamma).",
    },
];

fn quiz_for(product: &str) -> &'static [Question] {
    match product {
        "options" => OPTIONS_QUIZ,
        _ => &[],
    }
}

/// Questions as the client sees them: id, text and options only.
pub fn public_questions(qs: &[Question]) -> Vec<Value> {
    qs.iter().map(|q| json!({ "id": q.id, "text": q.text, "options": q.options })).collect()
}

/// A graded attempt.
#[derive(Debug)]
pub struct Graded {
    pub score: usize,
    pub total: usize,
    pub wrong: Vec<&'static str>,
}

impl Graded {
    pub fn passed(&self) -> bool {
        self.score >= PASS_MARK
    }
}

/// Grades an attempt. Every question must be answered with a valid option index; unknown ids are refused.
pub fn grade(qs: &'static [Question], answers: &BTreeMap<String, i64>) -> ApiResult<Graded> {
    if answers.keys().any(|k| !qs.iter().any(|q| q.id == k)) {
        return Err(ApiError::Validation { field: "answers", message: "The questions have changed. Reload the page and try again." });
    }
    let mut wrong = Vec::new();
    for q in qs {
        let Some(&a) = answers.get(q.id) else {
            return Err(ApiError::Validation { field: "answers", message: "Answer every question." });
        };
        if a < 0 || a as usize >= q.options.len() {
            return Err(ApiError::Validation { field: "answers", message: "Choose one of the options for every question." });
        }
        if a as usize != q.answer {
            wrong.push(q.id);
        }
    }
    Ok(Graded { score: qs.len() - wrong.len(), total: qs.len(), wrong })
}

// ---------- status ----------

#[derive(Debug, Clone)]
pub struct Disclosure {
    pub version: i32,
    pub title: String,
    pub body_md: String,
    pub published_at: DateTime<Utc>,
}

/// A client's suitability for one product.
#[derive(Debug, Clone)]
pub struct Status {
    pub product: &'static str,
    pub kyc_status: String,
    pub disclosure: Option<Disclosure>,
    pub accepted_version: Option<i32>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub quiz_passed_at: Option<DateTime<Utc>>,
    pub quiz_score: Option<i16>,
    pub quiz_attempts: i32,
}

impl Status {
    /// For information only: identity verification isn't needed for options.
    pub fn kyc_verified(&self) -> bool {
        self.kyc_status == "verified"
    }

    /// Any published version accepted (the accept handler only takes the version that is current at the time).
    pub fn disclosure_accepted(&self) -> bool {
        self.accepted_version.is_some_and(|v| v >= 1)
    }

    /// For information only: the quiz is an optional self-test.
    pub fn quiz_passed(&self) -> bool {
        self.quiz_passed_at.is_some()
    }

    /// The rule the trading engine enforces: the options disclosure accepted, nothing else.
    pub fn eligible(&self) -> bool {
        self.disclosure_accepted()
    }

    /// Steps still open: `disclosure`, or nothing.
    pub fn missing(&self) -> Vec<&'static str> {
        if self.disclosure_accepted() { Vec::new() } else { vec!["disclosure"] }
    }

    /// What the Client Area shows.
    fn client_json(&self) -> Value {
        let qs = quiz_for(self.product);
        json!({
            "product": self.product,
            "kycVerified": self.kyc_verified(),
            "kycStatus": self.kyc_status,
            "disclosure": self.disclosure.as_ref().map(|d| json!({ "version": d.version, "title": d.title, "bodyMd": d.body_md, "publishedAt": d.published_at })),
            "disclosureAccepted": self.disclosure_accepted(),
            "acceptedVersion": self.accepted_version,
            "acceptedAt": self.accepted_at,
            "quizPassed": self.quiz_passed(),
            "quizPassedAt": self.quiz_passed_at,
            "quizScore": self.quiz_score,
            "quizAttempts": self.quiz_attempts,
            "eligible": self.eligible(),
            "missing": self.missing(),
            "quiz": { "total": qs.len(), "passMark": PASS_MARK, "questions": public_questions(qs) },
        })
    }
}

/// Gives a broker without any disclosure for `product` a copy of the platform's current version (same version
/// number and text). Runs with the pool's own login: the platform's row belongs to another tenant.
async fn ensure_disclosure(pool: &PgPool, tenant_id: i64, product: &str) -> ApiResult<()> {
    let has: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM disclosures WHERE tenant_id = $1 AND product = $2)")
        .bind(tenant_id)
        .bind(product)
        .fetch_one(pool)
        .await?;
    if !has {
        sqlx::query(
            "INSERT INTO disclosures (tenant_id, product, version, title, body_md, published_at)
             SELECT $1, d.product, d.version, d.title, d.body_md, now()
               FROM disclosures d JOIN tenants t ON t.id = d.tenant_id
              WHERE t.slug = $3 AND d.product = $2 AND d.published_at <= now()
              ORDER BY d.version DESC LIMIT 1
             ON CONFLICT (tenant_id, product, version) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(product)
        .bind(PLATFORM_TENANT)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// A client's status, read inside the client's tenant scope (row-level security). `None` when the user is unknown.
pub async fn load(pool: &PgPool, tenant_id: i64, user_id: i64, product: &'static str) -> ApiResult<Option<Status>> {
    ensure_disclosure(pool, tenant_id, product).await?;
    let mut tx = domains::tenant_tx(pool, tenant_id).await?;
    let Some(kyc_status) = sqlx::query_scalar::<_, String>("SELECT kyc_status FROM users WHERE id = $1").bind(user_id).fetch_optional(&mut *tx).await? else {
        return Ok(None);
    };
    let disclosure = sqlx::query(
        "SELECT version, title, body_md, published_at FROM disclosures
          WHERE tenant_id = $1 AND product = $2 AND published_at <= now() ORDER BY version DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(product)
    .fetch_optional(&mut *tx)
    .await?
    .map(|r| Disclosure { version: r.get("version"), title: r.get("title"), body_md: r.get("body_md"), published_at: r.get("published_at") });
    let row = sqlx::query("SELECT disclosure_version, accepted_at, quiz_passed_at, quiz_score, quiz_attempts FROM suitability WHERE user_id = $1 AND product = $2")
        .bind(user_id)
        .bind(product)
        .fetch_optional(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Some(Status {
        product,
        kyc_status,
        disclosure,
        accepted_version: row.as_ref().and_then(|r| r.get("disclosure_version")),
        accepted_at: row.as_ref().and_then(|r| r.get("accepted_at")),
        quiz_passed_at: row.as_ref().and_then(|r| r.get("quiz_passed_at")),
        quiz_score: row.as_ref().and_then(|r| r.get("quiz_score")),
        quiz_attempts: row.as_ref().map(|r| r.get("quiz_attempts")).unwrap_or(0),
    }))
}

async fn load_session(st: &AppState, s: &SessionRef, product: &'static str) -> ApiResult<Status> {
    load(&st.pool, s.tenant_id, s.subject_id, product).await?.ok_or(ApiError::Unauthorized)
}

/// A live client session that may attest: no view-only login, no staff session opened as the client.
async fn attesting_session(st: &AppState, ctx: &Ctx) -> ApiResult<SessionRef> {
    let s = identity::resolve_session(st, ctx, Kind::User).await?;
    if s.impersonation.is_some() {
        return Err(ApiError::Coded {
            status: StatusCode::FORBIDDEN,
            code: "client_only",
            message: "Only the client can accept the options terms or take the quiz.",
        });
    }
    Ok(s)
}

fn entry<'a>(s: &SessionRef, action: &'a str, meta: Value) -> Entry<'a> {
    Entry { tenant_id: s.tenant_id, actor_kind: "user", actor_id: Some(s.subject_id), action, target: Some(("user", s.subject_id)), meta }
}

// ---------- client: GET /v1/suitability/{product} ----------

pub async fn get(State(st): State<AppState>, ctx: Ctx, Path(raw): Path<String>) -> ApiResult<Json<Value>> {
    let product = product(&raw)?;
    let s = identity::resolve_session_any(&st, &ctx, Kind::User).await?;
    Ok(Json(load_session(&st, &s, product).await?.client_json()))
}

// ---------- client: POST /v1/suitability/{product}/accept ----------

#[derive(Deserialize)]
pub struct AcceptReq {
    #[serde(default)]
    pub version: Option<i64>,
}

pub async fn accept(State(st): State<AppState>, ctx: Ctx, Path(raw): Path<String>, req: Result<Json<AcceptReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let product = product(&raw)?;
    let r = body(req)?;
    let s = attesting_session(&st, &ctx).await?;
    identity::limit(&st, format!("suitability-accept:user:{}", s.subject_id), 30, 3600)?;
    let version = r.version.filter(|v| (1..=i32::MAX as i64).contains(v)).ok_or(ApiError::Validation { field: "version", message: "Accept the options terms you have read." })? as i32;
    let status = load_session(&st, &s, product).await?;
    let current = status.disclosure.as_ref().ok_or(ApiError::Coded {
        status: StatusCode::CONFLICT,
        code: "no_disclosure",
        message: "The options terms aren't available right now. Please try again later.",
    })?;
    if version != current.version {
        return Err(ApiError::Coded {
            status: StatusCode::CONFLICT,
            code: "disclosure_outdated",
            message: "The options terms have just been updated. Please take a quick look at the new version.",
        });
    }
    let mut tx = domains::tenant_tx(&st.pool, s.tenant_id).await?;
    let changed = sqlx::query(
        "INSERT INTO suitability (tenant_id, user_id, product, disclosure_version, accepted_at, ip, user_agent)
         VALUES ($1, $2, $3, $4, now(), $5, $6)
         ON CONFLICT (user_id, product) DO UPDATE
            SET disclosure_version = EXCLUDED.disclosure_version, accepted_at = EXCLUDED.accepted_at,
                ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent, updated_at = now()
          WHERE suitability.disclosure_version IS DISTINCT FROM EXCLUDED.disclosure_version",
    )
    .bind(s.tenant_id)
    .bind(s.subject_id)
    .bind(product)
    .bind(version)
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .execute(&mut *tx)
    .await?
    .rows_affected()
        > 0;
    tx.commit().await?;
    if changed {
        audit::record(&st.pool, &ctx, entry(&s, "suitability.disclosure_accepted", json!({ "product": product, "version": version, "title": current.title }))).await;
    }
    Ok(Json(load_session(&st, &s, product).await?.client_json()))
}

// ---------- client: POST /v1/suitability/{product}/quiz (optional self-test) ----------

#[derive(Deserialize)]
pub struct QuizReq {
    #[serde(default)]
    pub answers: BTreeMap<String, i64>,
}

pub async fn quiz(State(st): State<AppState>, ctx: Ctx, Path(raw): Path<String>, req: Result<Json<QuizReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let product = product(&raw)?;
    let r = body(req)?;
    let s = attesting_session(&st, &ctx).await?;
    let qs = quiz_for(product);
    let graded = grade(qs, &r.answers)?;
    identity::limit(&st, format!("suitability-quiz:user:{}", s.subject_id), 20, 3600)?;
    let passed = graded.passed();
    let mut tx = domains::tenant_tx(&st.pool, s.tenant_id).await?;
    // a pass is kept for good: a later failed attempt (practice) never undoes it; the best passing score is kept
    sqlx::query(
        "INSERT INTO suitability (tenant_id, user_id, product, quiz_score, quiz_passed_at, quiz_attempts, last_attempt_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END, 1, now())
         ON CONFLICT (user_id, product) DO UPDATE
            SET quiz_attempts = suitability.quiz_attempts + 1,
                last_attempt_at = now(),
                quiz_score = CASE
                    WHEN suitability.quiz_passed_at IS NULL THEN EXCLUDED.quiz_score
                    WHEN $5 THEN GREATEST(suitability.quiz_score, EXCLUDED.quiz_score)
                    ELSE suitability.quiz_score END,
                quiz_passed_at = COALESCE(suitability.quiz_passed_at, EXCLUDED.quiz_passed_at),
                updated_at = now()",
    )
    .bind(s.tenant_id)
    .bind(s.subject_id)
    .bind(product)
    .bind(graded.score as i16)
    .bind(passed)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    audit::record(
        &st.pool,
        &ctx,
        entry(&s, if passed { "suitability.quiz_passed" } else { "suitability.quiz_failed" }, json!({ "product": product, "score": graded.score, "total": graded.total, "wrong": graded.wrong })),
    )
    .await;
    let after = load_session(&st, &s, product).await?;
    let wrong: Vec<Value> = graded
        .wrong
        .iter()
        .filter_map(|id| qs.iter().find(|q| q.id == *id))
        .map(|q| json!({ "id": q.id, "explanation": q.explanation }))
        .collect();
    Ok(Json(json!({
        "passed": passed,
        "score": graded.score,
        "total": graded.total,
        "passMark": PASS_MARK,
        "wrong": wrong,
        "quizPassed": after.quiz_passed(),
        "eligible": after.eligible(),
        "missing": after.missing(),
    })))
}

// ---------- internal: GET /v1/internal/suitability/{user_id}?product= ----------

#[derive(Deserialize)]
pub struct InternalQ {
    product: Option<String>,
}

pub async fn internal(State(st): State<AppState>, headers: HeaderMap, Path(user_id): Path<i64>, q: Result<Query<InternalQ>, QueryRejection>) -> ApiResult<Json<Value>> {
    let Query(q) = q.map_err(|_| ApiError::BadRequest("Invalid query."))?;
    let product = product(q.product.as_deref().unwrap_or("options"))?;
    let tenant: Option<(i64, String)> = sqlx::query_as("SELECT u.tenant_id, t.slug FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1")
        .bind(user_id)
        .fetch_optional(&st.pool)
        .await?;
    let (tenant_id, slug) = tenant.ok_or(ApiError::NotFound)?;
    // a caller that names the broker only learns about that broker's clients
    let (asked, source) = domains::resolve_headers(&st, &headers).await;
    if source != Source::Default && asked != slug {
        return Err(ApiError::NotFound);
    }
    let s = load(&st.pool, tenant_id, user_id, product).await?.ok_or(ApiError::NotFound)?;
    Ok(Json(json!({
        "userId": user_id,
        "tenantId": tenant_id,
        "product": product,
        "eligible": s.eligible(),
        "kycVerified": s.kyc_verified(),
        "disclosureAccepted": s.disclosure_accepted(),
        "quizPassed": s.quiz_passed(),
        "missing": s.missing(),
        "disclosureVersion": s.disclosure.as_ref().map(|d| d.version),
        "acceptedVersion": s.accepted_version,
        "checkedAt": Utc::now(),
    })))
}
