//! Identity verification (KYC): manual review by compliance staff that feels automated to the client.
//!
//! Client (session bearer, via the Client Area BFF `/api/kyc/*`):
//!   GET  /v1/kyc                          status, open case, documents, requirements, timeline, typical review time
//!   POST /v1/kyc/start      {kind}        opens a draft case (individual | corporate); returns the open one if any
//!   POST /v1/kyc/details    {...}         identity correction (before lock), address, ID type; corporate company + parties
//!   POST /v1/kyc/documents?kind&side&party&doc_type&issue_date
//!        body = raw file bytes (the BFF turns the browser's multipart upload into this), headers
//!        `x-ezymex-filename` (percent-encoded) and `x-ezymex-kyc-checks` (JSON of the browser's pre-checks)
//!   POST /v1/kyc/submit     {confirm}     draft | more_info -> submitted
//!
//! Staff (Back Office BFF `/api/admin/kyc/*`, permissions `kyc.read` / `kyc.review`): see `kyc::staff`.
//!
//! Other services read only `users.kyc_status`: withdrawals need `verified`. See the migration for the mapping.

mod sniff;
pub mod staff;
mod store;
#[cfg(test)]
mod tests;

use axum::Json;
use axum::body::Bytes;
use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;
use sqlx::postgres::PgRow;
use std::path::PathBuf;
use std::sync::OnceLock;

use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::error::{ApiError, ApiResult};
use crate::identity::{self, Kind};
use crate::mailer::KycMail;
use crate::state::{AppState, Ctx};
use crate::validate;

pub use store::DataKey;

/// Largest accepted file (images and PDFs).
pub const MAX_FILE_BYTES: usize = 10 * 1024 * 1024;
/// Smallest accepted file: anything below this is not a usable document photo or scan.
pub const MIN_FILE_BYTES: usize = 8 * 1024;
/// Request body limit of the upload route (file + a little slack).
pub const UPLOAD_BODY_LIMIT: usize = MAX_FILE_BYTES + 64 * 1024;
/// Proof of address must be issued within this many days (D89: less than 3 months).
pub const POA_MAX_AGE_DAYS: i64 = 92;

// ---------- settings ----------

/// KYC settings from the environment (read once).
///   KYC_STORAGE_DIR       encrypted document store, outside any web root (default ~/.ezymex-data/kyc)
///   KYC_ENCRYPTION_KEY    AES-256-GCM data key: 64 hex chars or base64 of 32 bytes (openssl rand -hex 32).
///                         Development without it derives a key from SESSION_SECRET; production refuses uploads.
///   KYC_SLA_HOURS         review target shown to staff (queue SLA) and, as an upper bound, to clients (default 24)
pub struct Settings {
    pub dir: PathBuf,
    pub key: Option<DataKey>,
    pub key_source: &'static str,
    pub sla_hours: i64,
}

impl std::fmt::Debug for Settings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KycSettings").field("dir", &self.dir).field("key", &self.key_source).field("sla_hours", &self.sla_hours).finish()
    }
}

#[cfg_attr(test, allow(dead_code))]
fn env(key: &str) -> String {
    std::env::var(key).ok().map(|v| v.trim().to_string()).unwrap_or_default()
}

impl Settings {
    #[cfg_attr(test, allow(dead_code))]
    fn from_env() -> Self {
        let dir = match env("KYC_STORAGE_DIR") {
            d if !d.is_empty() => PathBuf::from(d),
            _ => PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".into())).join(".ezymex-data").join("kyc"),
        };
        let dev = env("GATEWAY_ENV") != "production";
        let raw = env("KYC_ENCRYPTION_KEY");
        let (key, key_source) = if !raw.is_empty() {
            match DataKey::parse(&raw) {
                Some(k) => (Some(k), "KYC_ENCRYPTION_KEY"),
                None => (None, "invalid KYC_ENCRYPTION_KEY"),
            }
        } else if dev {
            let secret = env("SESSION_SECRET");
            let k: [u8; 32] = crate::crypto::Keys::new(&secret).hash("kyc-dev-data-key", "v1").try_into().unwrap_or([7u8; 32]);
            (Some(DataKey::from_bytes(k)), "development key derived from SESSION_SECRET")
        } else {
            (None, "missing")
        };
        let sla_hours = env("KYC_SLA_HOURS").parse::<i64>().ok().filter(|h| (1..=720).contains(h)).unwrap_or(24);
        Self { dir, key, key_source, sla_hours }
    }

    #[cfg(test)]
    fn for_tests() -> Self {
        let dir = std::env::temp_dir().join(format!("ezymex-kyc-test-{}", std::process::id()));
        Self { dir, key: Some(DataKey::from_bytes([42u8; 32])), key_source: "test", sla_hours: 24 }
    }
}

pub fn settings() -> &'static Settings {
    static S: OnceLock<Settings> = OnceLock::new();
    #[cfg(test)]
    return S.get_or_init(Settings::for_tests);
    #[cfg(not(test))]
    S.get_or_init(Settings::from_env)
}

/// Called once at startup: logs the settings and warns loudly when documents can't be stored.
pub fn init() {
    let s = settings();
    if s.key.is_none() {
        tracing::error!(key = s.key_source, "KYC_ENCRYPTION_KEY missing or invalid: KYC uploads are disabled until it is set");
    } else if s.key_source != "KYC_ENCRYPTION_KEY" {
        tracing::warn!("KYC_ENCRYPTION_KEY not set: using a development key (never in production)");
    }
    tracing::info!(settings = ?s, "kyc ready");
}

fn unavailable() -> ApiError {
    ApiError::Coded { status: StatusCode::SERVICE_UNAVAILABLE, code: "kyc_unavailable", message: "Verification is temporarily unavailable. Please try again later." }
}

// ---------- vocabulary ----------

pub const STATUSES: &[&str] = &["draft", "submitted", "in_review", "more_info", "approved", "rejected"];
pub const OPEN: &[&str] = &["draft", "submitted", "in_review", "more_info"];
pub const ID_TYPES: &[&str] = &["passport", "national_id", "driving_licence"];
pub const KINDS: &[&str] = &["id_document", "proof_of_address", "selfie", "incorporation", "company_address", "party_id"];

/// Rejection reasons (code, wording shown to the client and in the email).
pub const REASONS: &[(&str, &str)] = &[
    ("document_expired", "The identity document has expired"),
    ("document_unreadable", "The document is blurred, cropped or unreadable"),
    ("details_mismatch", "The name or date of birth doesn't match your profile"),
    ("poa_invalid", "The proof of address is older than 3 months or doesn't show your name and address"),
    ("selfie_mismatch", "The selfie doesn't match the photo on the identity document"),
    ("document_not_accepted", "This type of document isn't accepted"),
    ("underage", "You must be at least 18 years old"),
    ("restricted_country", "We can't accept clients resident in this country"),
    ("duplicate_account", "An account with this identity already exists"),
    ("suspected_fraud", "The documents could not be verified"),
    ("corporate_incomplete", "The company documents are incomplete"),
    ("other", "The documents could not be approved"),
];

pub fn reason_label(code: &str) -> Option<&'static str> {
    REASONS.iter().find(|(c, _)| *c == code).map(|(_, l)| *l)
}

pub fn reference(id: i64) -> String {
    format!("KYC-{id:06}")
}

pub fn id_type_label(t: &str) -> &'static str {
    match t {
        "passport" => "Passport",
        "national_id" => "National ID card",
        "driving_licence" => "Driving licence",
        _ => "Identity document",
    }
}

/// One required document position: (kind, side, party).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Slot {
    pub kind: String,
    #[serde(default = "single")]
    pub side: String,
    #[serde(default)]
    pub party: Option<String>,
}

fn single() -> String {
    "single".into()
}

impl Slot {
    fn new(kind: &str, side: &str, party: Option<&str>) -> Self {
        Self { kind: kind.into(), side: side.into(), party: party.map(str::to_string) }
    }
}

// ---------- case details ----------

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Address {
    #[serde(default)]
    pub line1: String,
    #[serde(default)]
    pub line2: String,
    #[serde(default)]
    pub city: String,
    #[serde(default)]
    pub postcode: String,
    #[serde(default)]
    pub country: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Company {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub reg_number: String,
    #[serde(default)]
    pub country: String,
    #[serde(default)]
    pub incorporated_on: String,
    #[serde(default)]
    pub business: String,
    #[serde(default)]
    pub address: Address,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Party {
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    #[serde(default)]
    pub date_of_birth: String,
    #[serde(default)]
    pub nationality: String,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub ownership: Option<f64>,
    #[serde(default)]
    pub id_type: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Details {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<Company>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parties: Vec<Party>,
}

fn verr(field: &'static str, message: &'static str) -> ApiError {
    ApiError::Validation { field, message }
}

fn text(v: &str, max: usize) -> String {
    v.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(max + 1).collect()
}

fn clean_address(a: &Address, prefix: &'static str) -> ApiResult<Address> {
    let f = |name: &'static str| -> &'static str {
        match (prefix, name) {
            ("company", "line1") => "company.address.line1",
            ("company", "city") => "company.address.city",
            ("company", "country") => "company.address.country",
            ("company", _) => "company.address",
            (_, "line1") => "address.line1",
            (_, "city") => "address.city",
            (_, "country") => "address.country",
            _ => "address",
        }
    };
    let out = Address { line1: text(&a.line1, 120), line2: text(&a.line2, 120), city: text(&a.city, 80), postcode: text(&a.postcode, 20), country: a.country.trim().to_lowercase() };
    if out.line1.chars().count() < 3 || out.line1.chars().count() > 120 {
        return Err(verr(f("line1"), "Enter the street address."));
    }
    if out.line2.chars().count() > 120 || out.postcode.chars().count() > 20 {
        return Err(verr(f("line2"), "Address is too long."));
    }
    if out.city.is_empty() || out.city.chars().count() > 80 {
        return Err(verr(f("city"), "Enter the city."));
    }
    validate::country(&out.country).map_err(|m| verr(f("country"), m))?;
    Ok(out)
}

fn parse_date(raw: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d").ok()
}

fn clean_company(c: &Company, today: NaiveDate) -> ApiResult<Company> {
    let name = text(&c.name, 160);
    if name.chars().count() < 2 || name.chars().count() > 160 {
        return Err(verr("company.name", "Enter the registered company name."));
    }
    let reg = text(&c.reg_number, 60);
    if reg.is_empty() || reg.chars().count() > 60 {
        return Err(verr("company.reg_number", "Enter the registration number."));
    }
    let country = c.country.trim().to_lowercase();
    validate::country(&country).map_err(|m| verr("company.country", m))?;
    let inc = parse_date(&c.incorporated_on).filter(|d| *d <= today && *d > NaiveDate::from_ymd_opt(1800, 1, 1).unwrap()).ok_or(verr("company.incorporated_on", "Enter the date of incorporation."))?;
    let business = text(&c.business, 200);
    if business.chars().count() > 200 {
        return Err(verr("company.business", "Keep the description under 200 characters."));
    }
    Ok(Company { name, reg_number: reg, country, incorporated_on: inc.to_string(), business, address: clean_address(&c.address, "company")? })
}

fn clean_parties(ps: &[Party], today: NaiveDate) -> ApiResult<Vec<Party>> {
    if ps.is_empty() {
        return Err(verr("parties", "Add at least one director."));
    }
    if ps.len() > 10 {
        return Err(verr("parties", "Add at most 10 directors and owners."));
    }
    let mut out = Vec::with_capacity(ps.len());
    for (i, p) in ps.iter().enumerate() {
        let key = format!("p{}", i + 1);
        let first = validate::name(&p.first_name, "Enter the first name.").map_err(|m| verr("parties", m))?;
        let last = validate::name(&p.last_name, "Enter the last name.").map_err(|m| verr("parties", m))?;
        let dob = validate::date_of_birth(&p.date_of_birth, today).map_err(|m| verr("parties", m))?;
        let nat = p.nationality.trim().to_lowercase();
        validate::country(&nat).map_err(|m| verr("parties", m))?;
        let mut roles: Vec<String> = p.roles.iter().map(|r| r.trim().to_lowercase()).filter(|r| r == "director" || r == "ubo").collect();
        roles.sort();
        roles.dedup();
        if roles.is_empty() {
            return Err(verr("parties", "Choose director and/or beneficial owner for each person."));
        }
        let ownership = match p.ownership {
            Some(o) if (0.0..=100.0).contains(&o) => Some((o * 100.0).round() / 100.0),
            Some(_) => return Err(verr("parties", "Ownership must be between 0 and 100%.")),
            None => None,
        };
        if roles.iter().any(|r| r == "ubo") && ownership.is_none_or(|o| o < 25.0) {
            return Err(verr("parties", "Beneficial owners hold 25% or more; enter their ownership."));
        }
        let id_type = p.id_type.trim().to_string();
        if !ID_TYPES.contains(&id_type.as_str()) {
            return Err(verr("parties", "Choose the identity document type for each person."));
        }
        out.push(Party { key, first_name: first, last_name: last, date_of_birth: dob.to_string(), nationality: nat, roles, ownership, id_type });
    }
    if !out.iter().any(|p| p.roles.iter().any(|r| r == "director")) {
        return Err(verr("parties", "Add at least one director."));
    }
    let total: f64 = out.iter().filter_map(|p| p.ownership).sum();
    if total > 100.0001 {
        return Err(verr("parties", "Ownership adds up to more than 100%."));
    }
    Ok(out)
}

// ---------- requirements ----------

/// Documents a case needs, in display order.
pub fn required_slots(kind: &str, id_doc_type: Option<&str>, details: &Details) -> Vec<Slot> {
    let mut v = Vec::new();
    if kind == "corporate" {
        v.push(Slot::new("incorporation", "single", None));
        v.push(Slot::new("company_address", "single", None));
        for p in &details.parties {
            v.push(Slot::new("party_id", "front", Some(&p.key)));
            if p.id_type != "passport" {
                v.push(Slot::new("party_id", "back", Some(&p.key)));
            }
        }
        v.push(Slot::new("selfie", "single", None));
    } else {
        v.push(Slot::new("id_document", "front", None));
        if id_doc_type != Some("passport") {
            v.push(Slot::new("id_document", "back", None));
        }
        v.push(Slot::new("proof_of_address", "single", None));
        v.push(Slot::new("selfie", "single", None));
    }
    v
}

pub fn slot_label(s: &Slot, id_doc_type: Option<&str>, details: &Details) -> String {
    let side = |t: &str| {
        if t == "passport" {
            "Passport photo page".to_string()
        } else {
            format!("{} ({})", id_type_label(t), if s.side == "back" { "back" } else { "front" })
        }
    };
    match s.kind.as_str() {
        "id_document" => side(id_doc_type.unwrap_or("")),
        "proof_of_address" => "Proof of address".into(),
        "selfie" => "Selfie".into(),
        "incorporation" => "Certificate of incorporation".into(),
        "company_address" => "Company proof of address".into(),
        "party_id" => {
            let p = details.parties.iter().find(|p| Some(&p.key) == s.party.as_ref());
            match p {
                Some(p) => format!("{} {}: {}", p.first_name, p.last_name, side(&p.id_type)),
                None => "Director / owner ID".into(),
            }
        }
        _ => s.kind.clone(),
    }
}

/// Which formats each kind accepts.
fn mime_allowed(kind: &str, mime: &str) -> bool {
    match kind {
        "selfie" => sniff::is_image(mime),
        _ => true,
    }
}

// ---------- loading ----------

pub struct CaseRow {
    pub id: i64,
    pub user_id: i64,
    pub kind: String,
    pub status: String,
    pub level: i32,
    pub id_doc_type: Option<String>,
    pub details: Details,
    pub details_raw: Value,
    pub requested: Vec<Slot>,
    pub request_message: Option<String>,
    pub decision_code: Option<String>,
    pub decision_message: Option<String>,
    pub allow_resubmit: bool,
    pub risk_level: Option<String>,
    pub risk_notes: Option<String>,
    pub checklist: Value,
    pub reviewer_id: Option<i64>,
    pub submissions: i32,
    pub first_submitted_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub review_started_at: Option<DateTime<Utc>>,
    pub decided_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub const CASE_COLS: &str = "c.id, c.tenant_id, c.user_id, c.kind, c.status, c.level, c.id_doc_type, c.details, c.requested, c.request_message,
    c.decision_code, c.decision_message, c.allow_resubmit, c.risk_level, c.risk_notes, c.checklist, c.reviewer_id, c.submissions,
    c.first_submitted_at, c.submitted_at, c.review_started_at, c.decided_at, c.created_at, c.updated_at";

pub fn case_row(r: &PgRow) -> CaseRow {
    let details_raw: Value = r.get::<sqlx::types::Json<Value>, _>("details").0;
    let requested: Value = r.get::<sqlx::types::Json<Value>, _>("requested").0;
    CaseRow {
        id: r.get("id"),
        user_id: r.get("user_id"),
        kind: r.get("kind"),
        status: r.get("status"),
        level: r.get("level"),
        id_doc_type: r.get("id_doc_type"),
        details: serde_json::from_value(details_raw.clone()).unwrap_or_default(),
        details_raw,
        requested: serde_json::from_value(requested).unwrap_or_default(),
        request_message: r.get("request_message"),
        decision_code: r.get("decision_code"),
        decision_message: r.get("decision_message"),
        allow_resubmit: r.get("allow_resubmit"),
        risk_level: r.get("risk_level"),
        risk_notes: r.get("risk_notes"),
        checklist: r.get::<sqlx::types::Json<Value>, _>("checklist").0,
        reviewer_id: r.get("reviewer_id"),
        submissions: r.get("submissions"),
        first_submitted_at: r.get("first_submitted_at"),
        submitted_at: r.get("submitted_at"),
        review_started_at: r.get("review_started_at"),
        decided_at: r.get("decided_at"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

async fn open_case(st: &AppState, user_id: i64) -> ApiResult<Option<CaseRow>> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {CASE_COLS} FROM kyc_cases c WHERE c.user_id = $1 AND c.status IN ('draft','submitted','in_review','more_info')"
    )))
    .bind(user_id)
    .fetch_optional(&st.pool)
    .await?;
    Ok(r.as_ref().map(case_row))
}

async fn latest_case(st: &AppState, user_id: i64) -> ApiResult<Option<CaseRow>> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {CASE_COLS} FROM kyc_cases c WHERE c.user_id = $1 ORDER BY c.id DESC LIMIT 1")))
        .bind(user_id)
        .fetch_optional(&st.pool)
        .await?;
    Ok(r.as_ref().map(case_row))
}

pub struct DocRow {
    pub id: i64,
    pub kind: String,
    pub side: String,
    pub party: Option<String>,
    pub doc_type: Option<String>,
    pub sha256: String,
    pub mime: String,
    pub size_bytes: i32,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub original_name: Option<String>,
    pub issue_date: Option<NaiveDate>,
    pub checks: Value,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

impl DocRow {
    pub fn slot(&self) -> Slot {
        Slot { kind: self.kind.clone(), side: self.side.clone(), party: self.party.clone() }
    }
    pub fn current(&self) -> bool {
        self.status == "uploaded" || self.status == "accepted"
    }
}

pub async fn documents(st: &AppState, case_id: i64) -> ApiResult<Vec<DocRow>> {
    let rows = sqlx::query(
        "SELECT id, kind, side, party, doc_type, sha256, mime, size_bytes, width, height, original_name, issue_date, checks, status, created_at
         FROM kyc_documents WHERE case_id = $1 ORDER BY id",
    )
    .bind(case_id)
    .fetch_all(&st.pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| DocRow {
            id: r.get("id"),
            kind: r.get("kind"),
            side: r.get("side"),
            party: r.get("party"),
            doc_type: r.get("doc_type"),
            sha256: r.get("sha256"),
            mime: r.get("mime"),
            size_bytes: r.get("size_bytes"),
            width: r.get("width"),
            height: r.get("height"),
            original_name: r.get("original_name"),
            issue_date: r.get("issue_date"),
            checks: r.get::<sqlx::types::Json<Value>, _>("checks").0,
            status: r.get("status"),
            created_at: r.get("created_at"),
        })
        .collect())
}

/// Client-safe view of a document: no file ref, no hash, no duplicate / fraud signals.
fn client_doc(d: &DocRow) -> Value {
    let server = d.checks.get("server").cloned().unwrap_or(json!({}));
    json!({
        "id": d.id,
        "kind": d.kind,
        "side": d.side,
        "party": d.party,
        "doc_type": d.doc_type,
        "mime": d.mime,
        "size_bytes": d.size_bytes,
        "width": d.width,
        "height": d.height,
        "issue_date": d.issue_date,
        "status": d.status,
        "created_at": d.created_at,
        "checks": {
            "format": server.get("format").cloned().unwrap_or(Value::Null),
            "resolution": server.get("resolution").cloned().unwrap_or(Value::Null),
            "size": server.get("size").cloned().unwrap_or(Value::Null),
            "issue_date": server.get("issue_date").cloned().unwrap_or(Value::Null),
            "client": d.checks.get("client").cloned().unwrap_or(Value::Null),
        },
    })
}

pub async fn events(st: &AppState, case_id: i64) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query("SELECT id, kind, actor_kind, actor_id, meta, created_at FROM kyc_events WHERE case_id = $1 ORDER BY id")
        .bind(case_id)
        .fetch_all(&st.pool)
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<i64, _>("id"),
                "kind": r.get::<String, _>("kind"),
                "actor_kind": r.get::<String, _>("actor_kind"),
                "actor_id": r.get::<Option<i64>, _>("actor_id"),
                "meta": r.get::<sqlx::types::Json<Value>, _>("meta").0,
                "at": r.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect())
}

pub async fn event(st: &AppState, case_id: i64, kind: &str, actor: (&str, Option<i64>), meta: Value) -> ApiResult<()> {
    sqlx::query("INSERT INTO kyc_events (case_id, kind, actor_kind, actor_id, meta) VALUES ($1,$2,$3,$4,$5)")
        .bind(case_id)
        .bind(kind)
        .bind(actor.0)
        .bind(actor.1)
        .bind(sqlx::types::Json(meta))
        .execute(&st.pool)
        .await?;
    Ok(())
}

/// Median hours from submission to decision over the last 50 decisions (rounded up, at least 1), capped at the SLA.
pub async fn typical_hours(st: &AppState, tenant_id: i64) -> ApiResult<i64> {
    let sla = settings().sla_hours;
    let secs: Option<f64> = sqlx::query_scalar(
        "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM decided_at - submitted_at))::float8
         FROM (SELECT decided_at, submitted_at FROM kyc_cases
               WHERE tenant_id = $1 AND status IN ('approved','rejected') AND decided_at IS NOT NULL AND submitted_at IS NOT NULL
               ORDER BY decided_at DESC LIMIT 50) x",
    )
    .bind(tenant_id)
    .fetch_one(&st.pool)
    .await?;
    Ok(match secs {
        Some(s) if s > 0.0 => ((s / 3600.0).ceil() as i64).clamp(1, sla),
        _ => sla,
    })
}

/// Required documents with their state for a case.
pub fn requirements(c: &CaseRow, docs: &[DocRow]) -> Vec<Value> {
    required_slots(&c.kind, c.id_doc_type.as_deref(), &c.details)
        .into_iter()
        .map(|s| {
            let cur = docs.iter().rev().find(|d| d.slot() == s && d.current());
            let last = docs.iter().rev().find(|d| d.slot() == s);
            json!({
                "kind": s.kind,
                "side": s.side,
                "party": s.party,
                "label": slot_label(&s, c.id_doc_type.as_deref(), &c.details),
                "uploaded": cur.is_some(),
                "document_id": cur.map(|d| d.id),
                "requested": c.requested.contains(&s),
                "last_status": last.map(|d| d.status.clone()),
            })
        })
        .collect()
}

fn case_json_client(c: &CaseRow) -> Value {
    json!({
        "id": c.id,
        "reference": reference(c.id),
        "kind": c.kind,
        "status": c.status,
        "level": c.level,
        "id_doc_type": c.id_doc_type,
        "details": c.details_raw,
        "requested": c.requested,
        "requested_labels": c.requested.iter().map(|s| slot_label(s, c.id_doc_type.as_deref(), &c.details)).collect::<Vec<_>>(),
        "request_message": c.request_message,
        "decision": c.decision_code.as_deref().map(|code| json!({ "code": code, "label": reason_label(code), "message": c.decision_message })),
        "allow_resubmit": c.allow_resubmit,
        "submissions": c.submissions,
        "submitted_at": c.submitted_at,
        "review_started_at": c.review_started_at,
        "decided_at": c.decided_at,
        "created_at": c.created_at,
    })
}

// ---------- client: GET /v1/kyc ----------

struct Me {
    tenant_id: i64,
    id: i64,
}

async fn me(st: &AppState, ctx: &Ctx) -> ApiResult<Me> {
    let s = identity::resolve_session(st, ctx, Kind::User).await?;
    Ok(Me { tenant_id: s.tenant_id, id: s.subject_id })
}

pub async fn state(st: &AppState, user_id: i64, tenant_id: i64) -> ApiResult<Value> {
    let u = sqlx::query("SELECT first_name, last_name, date_of_birth, country, kyc_status, identity_locked_at, email FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::Unauthorized)?;
    let open = open_case(st, user_id).await?;
    let latest = match open {
        Some(c) => Some(c),
        None => latest_case(st, user_id).await?,
    };
    let (case, docs, required, timeline) = match &latest {
        Some(c) => {
            let docs = documents(st, c.id).await?;
            let req = requirements(c, &docs);
            let visible: Vec<Value> = docs.iter().filter(|d| d.status != "superseded").map(client_doc).collect();
            (case_json_client(c), visible, req, events(st, c.id).await?)
        }
        None => (Value::Null, vec![], vec![], vec![]),
    };
    let history = sqlx::query("SELECT id, kind, status, decision_code, decided_at, created_at FROM kyc_cases WHERE user_id = $1 ORDER BY id DESC LIMIT 10")
        .bind(user_id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|r| {
            let code: Option<String> = r.get("decision_code");
            json!({
                "reference": reference(r.get("id")),
                "kind": r.get::<String, _>("kind"),
                "status": r.get::<String, _>("status"),
                "decision_label": code.as_deref().and_then(reason_label),
                "decided_at": r.get::<Option<DateTime<Utc>>, _>("decided_at"),
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect::<Vec<_>>();
    let kyc_status: String = u.get("kyc_status");
    let latest_status = latest.as_ref().map(|c| c.status.as_str());
    let can_start = match latest.as_ref() {
        None => true,
        Some(c) => c.status == "rejected" && c.allow_resubmit,
    } && kyc_status != "verified";
    Ok(json!({
        "kyc_status": kyc_status,
        "identity_locked": u.get::<Option<DateTime<Utc>>, _>("identity_locked_at").is_some(),
        "profile": {
            "first_name": u.get::<String, _>("first_name"),
            "last_name": u.get::<String, _>("last_name"),
            "date_of_birth": u.get::<NaiveDate, _>("date_of_birth"),
            "country": u.get::<String, _>("country").trim().to_lowercase(),
            "email": u.get::<String, _>("email"),
        },
        "case": case,
        "editable": matches!(latest_status, Some("draft" | "more_info")),
        "can_start": can_start,
        "documents": docs,
        "required": required,
        "timeline": timeline,
        "history": history,
        "review": { "sla_hours": settings().sla_hours, "typical_hours": typical_hours(st, tenant_id).await? },
        "limits": { "max_bytes": MAX_FILE_BYTES, "min_bytes": MIN_FILE_BYTES, "poa_max_age_days": POA_MAX_AGE_DAYS },
        "reasons": REASONS.iter().map(|(c, l)| json!({"code": c, "label": l})).collect::<Vec<_>>(),
    }))
}

pub async fn get(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let m = me(&st, &ctx).await?;
    Ok(Json(state(&st, m.id, m.tenant_id).await?))
}

// ---------- client: POST /v1/kyc/start ----------

#[derive(Deserialize)]
pub struct StartReq {
    #[serde(default)]
    pub kind: String,
}

pub async fn start(State(st): State<AppState>, ctx: Ctx, req: Result<Json<StartReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let m = me(&st, &ctx).await?;
    let kind = match r.kind.trim() {
        "individual" => "individual",
        "corporate" => "corporate",
        _ => return Err(verr("kind", "Choose individual or corporate verification.")),
    };
    identity::limit(&st, format!("kyc-start:user:{}", m.id), 20, 3600)?;
    let status: String = sqlx::query_scalar("SELECT kyc_status FROM users WHERE id = $1").bind(m.id).fetch_one(&st.pool).await?;
    if status == "verified" {
        return Err(ApiError::Coded { status: StatusCode::CONFLICT, code: "already_verified", message: "Your identity is already verified." });
    }
    if let Some(c) = open_case(&st, m.id).await? {
        // switching individual <-> corporate is allowed while nothing has been submitted
        if c.kind != kind && c.status == "draft" {
            let n: i64 = sqlx::query_scalar("SELECT count(*) FROM kyc_documents WHERE case_id = $1").bind(c.id).fetch_one(&st.pool).await?;
            if n == 0 {
                sqlx::query("UPDATE kyc_cases SET kind = $2, details = '{}'::jsonb, id_doc_type = NULL, updated_at = now() WHERE id = $1").bind(c.id).bind(kind).execute(&st.pool).await?;
            }
        }
        return Ok(Json(state(&st, m.id, m.tenant_id).await?));
    }
    if let Some(c) = latest_case(&st, m.id).await?
        && c.status == "rejected"
        && !c.allow_resubmit
    {
        return Err(ApiError::Coded { status: StatusCode::FORBIDDEN, code: "resubmit_blocked", message: "Please contact support about your verification." });
    }
    let id: Option<i64> = sqlx::query_scalar("INSERT INTO kyc_cases (tenant_id, user_id, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id")
        .bind(m.tenant_id)
        .bind(m.id)
        .bind(kind)
        .fetch_optional(&st.pool)
        .await?;
    if let Some(id) = id {
        event(&st, id, "started", ("user", Some(m.id)), json!({ "kind": kind })).await?;
        audit::record(&st.pool, &ctx, Entry { tenant_id: m.tenant_id, actor_kind: "user", actor_id: Some(m.id), action: "kyc.started", target: Some(("user", m.id)), meta: json!({ "case_id": id, "kind": kind }) }).await;
    }
    Ok(Json(state(&st, m.id, m.tenant_id).await?))
}

// ---------- client: POST /v1/kyc/details ----------

#[derive(Deserialize, Default)]
pub struct Identity {
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    #[serde(default)]
    pub date_of_birth: String,
}

#[derive(Deserialize, Default)]
pub struct DetailsReq {
    #[serde(default)]
    pub identity: Option<Identity>,
    #[serde(default)]
    pub id_doc_type: Option<String>,
    #[serde(default)]
    pub address: Option<Address>,
    #[serde(default)]
    pub company: Option<Company>,
    #[serde(default)]
    pub parties: Option<Vec<Party>>,
}

async fn editable_case(st: &AppState, user_id: i64) -> ApiResult<CaseRow> {
    let c = open_case(st, user_id).await?.ok_or(ApiError::Coded { status: StatusCode::CONFLICT, code: "no_case", message: "Start verification first." })?;
    if c.status != "draft" && c.status != "more_info" {
        return Err(ApiError::Coded { status: StatusCode::CONFLICT, code: "not_editable", message: "Your documents are with our team. You'll be able to make changes if they ask for more information." });
    }
    Ok(c)
}

pub async fn details(State(st): State<AppState>, ctx: Ctx, req: Result<Json<DetailsReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let m = me(&st, &ctx).await?;
    identity::limit(&st, format!("kyc-details:user:{}", m.id), 60, 3600)?;
    let c = editable_case(&st, m.id).await?;
    let today = Utc::now().date_naive();

    // D92: before verification the client may correct their legal name / date of birth to match the document.
    if let Some(i) = &r.identity {
        let first = validate::name(&i.first_name, "Enter your first name.").map_err(|m| verr("first_name", m))?;
        let last = validate::name(&i.last_name, "Enter your last name.").map_err(|m| verr("last_name", m))?;
        let dob = validate::date_of_birth(&i.date_of_birth, today).map_err(|m| verr("date_of_birth", m))?;
        let row = sqlx::query("SELECT first_name, last_name, date_of_birth, identity_locked_at FROM users WHERE id = $1").bind(m.id).fetch_one(&st.pool).await?;
        let (of, ol, od): (String, String, NaiveDate) = (row.get("first_name"), row.get("last_name"), row.get("date_of_birth"));
        if (of.as_str(), ol.as_str(), od) != (first.as_str(), last.as_str(), dob) {
            if row.get::<Option<DateTime<Utc>>, _>("identity_locked_at").is_some() {
                return Err(ApiError::Coded { status: StatusCode::CONFLICT, code: "identity_locked", message: "Your name and date of birth are locked after verification. Contact support to change them." });
            }
            sqlx::query("UPDATE users SET first_name = $2, last_name = $3, date_of_birth = $4, updated_at = now() WHERE id = $1")
                .bind(m.id)
                .bind(&first)
                .bind(&last)
                .bind(dob)
                .execute(&st.pool)
                .await?;
            audit::record(&st.pool, &ctx, Entry {
                tenant_id: m.tenant_id,
                actor_kind: "user",
                actor_id: Some(m.id),
                action: "user.identity_corrected",
                target: Some(("user", m.id)),
                meta: json!({ "case_id": c.id, "before": {"first_name": of, "last_name": ol, "date_of_birth": od}, "after": {"first_name": first, "last_name": last, "date_of_birth": dob} }),
            })
            .await;
        }
    }

    let mut d = c.details.clone();
    let mut id_doc_type = c.id_doc_type.clone();
    if let Some(t) = &r.id_doc_type {
        let t = t.trim();
        if !ID_TYPES.contains(&t) {
            return Err(verr("id_doc_type", "Choose passport, national ID card or driving licence."));
        }
        if c.kind == "corporate" {
            return Err(verr("id_doc_type", "Corporate verification collects an ID for each director and owner."));
        }
        // changing the document type after uploading asks for new ID images
        if id_doc_type.as_deref() != Some(t) && id_doc_type.is_some() {
            sqlx::query("UPDATE kyc_documents SET status = 'superseded' WHERE case_id = $1 AND kind = 'id_document' AND status IN ('uploaded','rejected')").bind(c.id).execute(&st.pool).await?;
        }
        id_doc_type = Some(t.to_string());
    }
    if let Some(a) = &r.address {
        d.address = Some(clean_address(a, "address")?);
    }
    if c.kind == "corporate" {
        if let Some(co) = &r.company {
            d.company = Some(clean_company(co, today)?);
        }
        if let Some(ps) = &r.parties {
            let cleaned = clean_parties(ps, today)?;
            // documents of people who were removed or whose ID type changed no longer count
            for old in &d.parties {
                let still = cleaned.iter().find(|p| p.key == old.key);
                if still.is_none_or(|p| p.id_type != old.id_type || p.first_name != old.first_name || p.last_name != old.last_name) {
                    sqlx::query("UPDATE kyc_documents SET status = 'superseded' WHERE case_id = $1 AND kind = 'party_id' AND party = $2 AND status IN ('uploaded','rejected')")
                        .bind(c.id)
                        .bind(&old.key)
                        .execute(&st.pool)
                        .await?;
                }
            }
            d.parties = cleaned;
        }
    } else if r.company.is_some() || r.parties.is_some() {
        return Err(ApiError::BadRequest("Company details are for corporate verification."));
    }
    sqlx::query("UPDATE kyc_cases SET details = $2, id_doc_type = $3, updated_at = now() WHERE id = $1")
        .bind(c.id)
        .bind(sqlx::types::Json(serde_json::to_value(&d)?))
        .bind(id_doc_type)
        .execute(&st.pool)
        .await?;
    Ok(Json(state(&st, m.id, m.tenant_id).await?))
}

// ---------- client: POST /v1/kyc/documents ----------

#[derive(Deserialize, Default)]
pub struct UploadQuery {
    pub kind: Option<String>,
    pub side: Option<String>,
    pub party: Option<String>,
    pub doc_type: Option<String>,
    pub issue_date: Option<String>,
}

fn upload_err(code: &'static str, message: &'static str) -> ApiError {
    ApiError::Coded { status: StatusCode::UNPROCESSABLE_ENTITY, code, message }
}

/// Percent-decoded, printable, at most 120 characters.
fn clean_filename(raw: Option<&str>) -> Option<String> {
    let raw = raw?;
    let mut bytes = Vec::with_capacity(raw.len());
    let b = raw.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(std::str::from_utf8(&b[i + 1..i + 3]).unwrap_or("zz"), 16) {
                bytes.push(v);
                i += 3;
                continue;
            }
        }
        bytes.push(b[i]);
        i += 1;
    }
    let s: String = String::from_utf8_lossy(&bytes).chars().filter(|c| !c.is_control() && !matches!(c, '/' | '\\' | '<' | '>' | '"')).take(120).collect();
    let s = s.trim().to_string();
    (!s.is_empty()).then_some(s)
}

/// The browser's pre-checks (blur, glare, framing, face, MRZ...): a small JSON object, stored as reported.
fn client_checks(h: &HeaderMap) -> Value {
    let Some(raw) = h.get("x-ezymex-kyc-checks").and_then(|v| v.to_str().ok()) else { return Value::Null };
    if raw.len() > 4096 {
        return Value::Null;
    }
    match serde_json::from_str::<Value>(raw) {
        Ok(v) if v.is_object() => v,
        _ => Value::Null,
    }
}

pub async fn upload(State(st): State<AppState>, ctx: Ctx, q: Result<Query<UploadQuery>, QueryRejection>, headers: HeaderMap, bytes: Bytes) -> ApiResult<Json<Value>> {
    let Query(q) = q.map_err(|_| ApiError::BadRequest("Invalid upload parameters."))?;
    let m = me(&st, &ctx).await?;
    let s = settings();
    let key = s.key.clone().ok_or_else(unavailable)?;
    identity::limit(&st, format!("kyc-upload:user:{}", m.id), 60, 3600)?;
    identity::limit(&st, format!("kyc-upload:ip:{}", ctx.ip), 120, 3600)?;
    let c = editable_case(&st, m.id).await?;

    let kind = q.kind.as_deref().map(str::trim).filter(|k| KINDS.contains(k)).ok_or(verr("kind", "Unknown document."))?;
    let side = q.side.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or("single");
    if !matches!(side, "front" | "back" | "single") {
        return Err(verr("side", "Unknown document side."));
    }
    let party = q.party.as_deref().map(str::trim).filter(|p| !p.is_empty()).map(str::to_string);
    let slot = Slot { kind: kind.into(), side: side.into(), party: party.clone() };
    if c.kind == "individual" && c.id_doc_type.is_none() && kind == "id_document" {
        return Err(verr("doc_type", "Choose the type of identity document first."));
    }
    let required = required_slots(&c.kind, c.id_doc_type.as_deref(), &c.details);
    if !required.contains(&slot) {
        return Err(verr("kind", "This document isn't part of your verification."));
    }
    // "more information needed": only the requested documents can be replaced
    if c.status == "more_info" && !c.requested.contains(&slot) {
        return Err(ApiError::Coded { status: StatusCode::CONFLICT, code: "not_requested", message: "Only the documents our team asked for can be uploaded now." });
    }

    if bytes.len() > MAX_FILE_BYTES {
        return Err(upload_err("too_large", "The file is larger than 10 MB."));
    }
    if bytes.len() < MIN_FILE_BYTES {
        return Err(upload_err("too_small", "The file is too small to be a readable document. Use a clear photo or scan."));
    }
    let mime = sniff::sniff(&bytes).ok_or(upload_err("unsupported_type", "Upload a JPG, PNG, HEIC or PDF file."))?;
    if !mime_allowed(kind, mime) {
        return Err(upload_err("unsupported_type", "The selfie must be a photo (JPG, PNG or HEIC)."));
    }
    let declared = headers.get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("").split(';').next().unwrap_or("").trim().to_lowercase();
    if mime == sniff::PDF && sniff::pdf_active_content(&bytes) {
        return Err(upload_err("unsafe_pdf", "This PDF contains scripts or attachments. Upload a plain scan or a photo instead."));
    }
    let dims = sniff::dimensions(mime, &bytes);
    let min_side = if kind == "selfie" { 480 } else { 600 };
    let resolution_ok = dims.map(|(w, h)| w.min(h) >= min_side);
    if resolution_ok == Some(false) {
        return Err(upload_err("low_resolution", "The image resolution is too low. Use your camera's full resolution."));
    }
    let today = Utc::now().date_naive();
    let issue_date = match q.issue_date.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        Some(v) => Some(parse_date(v).ok_or(verr("issue_date", "Enter the date on the document."))?),
        None => None,
    };
    let issue_ok = if matches!(kind, "proof_of_address" | "company_address") {
        let d = issue_date.ok_or(verr("issue_date", "Enter the date the document was issued."))?;
        if d > today {
            return Err(verr("issue_date", "The issue date can't be in the future."));
        }
        if (today - d).num_days() > POA_MAX_AGE_DAYS {
            return Err(upload_err("poa_too_old", "The document must be issued within the last 3 months. Upload a more recent one."));
        }
        Some(true)
    } else {
        None
    };
    let doc_type = match kind {
        "id_document" => c.id_doc_type.clone(),
        "party_id" => c.details.parties.iter().find(|p| Some(&p.key) == party.as_ref()).map(|p| p.id_type.clone()),
        _ => q.doc_type.as_deref().map(|t| text(t, 40)).filter(|t| !t.is_empty() && t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == ' ')),
    };

    let sha = store::sha256_hex(&bytes);
    let dup_other: i64 = sqlx::query_scalar("SELECT count(DISTINCT user_id) FROM kyc_documents WHERE tenant_id = $1 AND sha256 = $2 AND user_id <> $3")
        .bind(m.tenant_id)
        .bind(&sha)
        .bind(m.id)
        .fetch_one(&st.pool)
        .await?;
    let dup_same: i64 = sqlx::query_scalar("SELECT count(*) FROM kyc_documents WHERE case_id = $1 AND sha256 = $2 AND status <> 'superseded' AND NOT (kind = $3 AND side = $4 AND party IS NOT DISTINCT FROM $5)")
        .bind(c.id)
        .bind(&sha)
        .bind(kind)
        .bind(side)
        .bind(party.as_deref())
        .fetch_one(&st.pool)
        .await?;
    if dup_same > 0 {
        return Err(upload_err("same_file", "You already uploaded this exact file for another document. Upload the right one here."));
    }

    let file_ref = store::new_ref();
    {
        let (dir, fref, data, tenant) = (s.dir.clone(), file_ref.clone(), bytes.clone(), m.tenant_id);
        tokio::task::spawn_blocking(move || store::write(&dir, &key, tenant, &fref, &data)).await.map_err(anyhow::Error::from)??;
    }
    let server = json!({
        "format": { "ok": true, "detected": mime, "declared": declared, "matches_declared": declared.is_empty() || declared == mime || (declared == "image/jpg" && mime == sniff::JPEG) || (declared == "image/heif" && mime == sniff::HEIC) },
        "size": { "ok": true, "bytes": bytes.len() },
        "resolution": { "ok": resolution_ok, "width": dims.map(|d| d.0), "height": dims.map(|d| d.1), "min_side": min_side },
        "issue_date": { "ok": issue_ok, "date": issue_date, "max_age_days": POA_MAX_AGE_DAYS },
        "duplicate_other_clients": dup_other,
        "encrypted": "AES-256-GCM",
    });
    let checks = json!({ "server": server, "client": client_checks(&headers) });
    let filename = clean_filename(headers.get("x-ezymex-filename").and_then(|v| v.to_str().ok()));

    let mut tx = st.pool.begin().await?;
    sqlx::query("UPDATE kyc_documents SET status = 'superseded' WHERE case_id = $1 AND kind = $2 AND side = $3 AND party IS NOT DISTINCT FROM $4 AND status IN ('uploaded','rejected')")
        .bind(c.id)
        .bind(kind)
        .bind(side)
        .bind(party.as_deref())
        .execute(&mut *tx)
        .await?;
    let doc_id: i64 = sqlx::query_scalar(
        "INSERT INTO kyc_documents (tenant_id, case_id, user_id, kind, side, party, doc_type, file_ref, sha256, mime, size_bytes, width, height, original_name, issue_date, checks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id",
    )
    .bind(m.tenant_id)
    .bind(c.id)
    .bind(m.id)
    .bind(kind)
    .bind(side)
    .bind(party.as_deref())
    .bind(doc_type.as_deref())
    .bind(&file_ref)
    .bind(&sha)
    .bind(mime)
    .bind(bytes.len() as i32)
    .bind(dims.map(|d| d.0 as i32))
    .bind(dims.map(|d| d.1 as i32))
    .bind(filename.as_deref())
    .bind(issue_date)
    .bind(sqlx::types::Json(&checks))
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE kyc_cases SET updated_at = now() WHERE id = $1").bind(c.id).execute(&mut *tx).await?;
    tx.commit().await?;

    audit::record(&st.pool, &ctx, Entry {
        tenant_id: m.tenant_id,
        actor_kind: "user",
        actor_id: Some(m.id),
        action: "kyc.document_uploaded",
        target: Some(("user", m.id)),
        meta: json!({ "case_id": c.id, "document_id": doc_id, "kind": kind, "side": side, "party": party, "mime": mime, "bytes": bytes.len(), "sha256": sha, "duplicate_other_clients": dup_other }),
    })
    .await;
    let doc = documents(&st, c.id).await?.into_iter().find(|d| d.id == doc_id).ok_or(ApiError::NotFound)?;
    Ok(Json(json!({ "status": "ok", "document": client_doc(&doc), "state": state(&st, m.id, m.tenant_id).await? })))
}

// ---------- client: POST /v1/kyc/submit ----------

#[derive(Deserialize, Default)]
pub struct SubmitReq {
    #[serde(default)]
    pub confirm: bool,
}

/// What is still missing before a case can be submitted (field, message).
pub fn missing(c: &CaseRow, docs: &[DocRow]) -> Option<(&'static str, String)> {
    if c.kind == "individual" {
        if c.id_doc_type.is_none() {
            return Some(("id_doc_type", "Choose your identity document.".into()));
        }
        if c.details.address.is_none() {
            return Some(("address", "Enter your residential address.".into()));
        }
    } else {
        if c.details.company.is_none() {
            return Some(("company", "Enter the company details.".into()));
        }
        if c.details.parties.is_empty() {
            return Some(("parties", "Add the directors and beneficial owners.".into()));
        }
    }
    for s in required_slots(&c.kind, c.id_doc_type.as_deref(), &c.details) {
        if !docs.iter().any(|d| d.slot() == s && d.current()) {
            return Some(("documents", format!("Upload: {}.", slot_label(&s, c.id_doc_type.as_deref(), &c.details))));
        }
    }
    None
}

pub async fn submit(State(st): State<AppState>, ctx: Ctx, req: Result<Json<SubmitReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let m = me(&st, &ctx).await?;
    if !r.confirm {
        return Err(verr("confirm", "Confirm that the documents are genuine and belong to you."));
    }
    identity::limit(&st, format!("kyc-submit:user:{}", m.id), 20, 3600)?;
    let c = editable_case(&st, m.id).await?;
    let docs = documents(&st, c.id).await?;
    if let Some((field, _)) = missing(&c, &docs) {
        let message = match field {
            "id_doc_type" => "Choose your identity document.",
            "address" => "Enter your residential address.",
            "company" => "Enter the company details.",
            "parties" => "Add the directors and beneficial owners.",
            _ => "Upload all the required documents first.",
        };
        return Err(ApiError::Coded { status: StatusCode::UNPROCESSABLE_ENTITY, code: "incomplete", message });
    }
    let resubmission = c.status == "more_info";
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query(
        "UPDATE kyc_cases SET status = 'submitted', submissions = submissions + 1, submitted_at = now(),
                first_submitted_at = COALESCE(first_submitted_at, now()), requested = '[]'::jsonb, updated_at = now()
         WHERE id = $1 AND status IN ('draft','more_info')",
    )
    .bind(c.id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(ApiError::Coded { status: StatusCode::CONFLICT, code: "not_editable", message: "This verification was already submitted." });
    }
    sqlx::query("UPDATE users SET kyc_status = 'pending', updated_at = now() WHERE id = $1 AND kyc_status <> 'verified'").bind(m.id).execute(&mut *tx).await?;
    tx.commit().await?;
    let hours = typical_hours(&st, m.tenant_id).await?;
    event(&st, c.id, if resubmission { "resubmitted" } else { "submitted" }, ("user", Some(m.id)), json!({ "documents": docs.iter().filter(|d| d.current()).count(), "typical_hours": hours })).await?;
    audit::record(&st.pool, &ctx, Entry {
        tenant_id: m.tenant_id,
        actor_kind: "user",
        actor_id: Some(m.id),
        action: if resubmission { "kyc.resubmitted" } else { "kyc.submitted" },
        target: Some(("user", m.id)),
        meta: json!({ "case_id": c.id, "kind": c.kind }),
    })
    .await;
    notify(&st, m.id, KycMail::Submitted { reference: reference(c.id), hours }).await;
    Ok(Json(state(&st, m.id, m.tenant_id).await?))
}

// ---------- email ----------

/// Emails the client about a KYC change. With SMTP it is sent in the background; in development without SMTP
/// the email is written to the service log (subject + key lines), so flows can be checked end to end.
pub async fn notify(st: &AppState, user_id: i64, mail: KycMail) {
    let row = match sqlx::query("SELECT email, first_name FROM users WHERE id = $1").bind(user_id).fetch_optional(&st.pool).await {
        Ok(Some(r)) => r,
        _ => return,
    };
    let (to, first): (String, String) = (row.get("email"), row.get("first_name"));
    if let Some(mailer) = st.mailer.clone() {
        tokio::spawn(async move {
            match mailer.send_kyc(&to, &first, &mail).await {
                Ok(()) => tracing::info!(to = %validate::mask_email(&to), kind = kyc_mail_kind(&mail), "kyc email sent"),
                Err(e) => tracing::error!(to = %validate::mask_email(&to), kind = kyc_mail_kind(&mail), error = %e, "kyc email could not be sent"),
            }
        });
    } else if st.cfg.dev_mode {
        let c = crate::mailer::kyc_content(&mail, &first, &st.cfg.app_url);
        tracing::info!(
            target: "email",
            to = %to,
            kind = kyc_mail_kind(&mail),
            subject = %c.subject,
            reference = %c.reference,
            items = %c.items.join(" | "),
            note = %c.note.clone().unwrap_or_default(),
            lead = %c.paragraphs.first().cloned().unwrap_or_default(),
            "DEV email (SMTP not configured)"
        );
    } else {
        tracing::error!(to = %validate::mask_email(&to), kind = kyc_mail_kind(&mail), "cannot send kyc email: SMTP not configured");
    }
}

fn kyc_mail_kind(m: &KycMail) -> &'static str {
    match m {
        KycMail::Submitted { .. } => "kyc_submitted",
        KycMail::Approved { .. } => "kyc_approved",
        KycMail::Rejected { .. } => "kyc_rejected",
        KycMail::MoreInfo { .. } => "kyc_more_info",
    }
}

/// Age of an open case against the SLA, for the queue.
pub fn sla(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Value {
    let hours = settings().sla_hours;
    match submitted_at {
        Some(t) => {
            let due = t + Duration::hours(hours);
            json!({ "hours": hours, "age_seconds": (now - t).num_seconds().max(0), "due_at": due, "remaining_seconds": (due - now).num_seconds(), "breached": now > due })
        }
        None => json!({ "hours": hours, "age_seconds": null, "due_at": null, "remaining_seconds": null, "breached": false }),
    }
}

/// `gateway kyc-erase-user <user_id>`: deletes a client's KYC files from disk and their KYC rows (account
/// erasure, test clean-up). The audit log is append-only and keeps its entries.
pub async fn erase_user(pool: &sqlx::PgPool, user_id: i64) -> anyhow::Result<usize> {
    let n = remove_files(&user_files(pool, user_id).await?)?;
    sqlx::query("DELETE FROM kyc_cases WHERE user_id = $1").bind(user_id).execute(pool).await?;
    Ok(n)
}

/// The client's stored KYC files as (tenant id, file ref). Client deletion (client_lifecycle.rs) reads them before
/// its transaction removes the rows, and removes the files once it committed.
pub async fn user_files(pool: &sqlx::PgPool, user_id: i64) -> anyhow::Result<Vec<(i64, String)>> {
    Ok(sqlx::query_as("SELECT tenant_id, file_ref FROM kyc_documents WHERE user_id = $1").bind(user_id).fetch_all(pool).await?)
}

/// Deletes stored KYC files from disk (a file already gone counts as removed). Returns how many were removed.
pub fn remove_files(files: &[(i64, String)]) -> anyhow::Result<usize> {
    let s = settings();
    for (tenant, fref) in files {
        store::remove(&s.dir, *tenant, fref)?;
    }
    Ok(files.len())
}
