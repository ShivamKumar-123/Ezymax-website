//! Manual payments: the broker's bank / UPI accounts and crypto addresses (any network), and the deposit requests
//! clients send after paying one of them outside the platform.
//!
//! Flow: staff set up payment methods (Back Office → Finance → Payment methods: details, currency and rate, limits,
//! QR code, optional "Pay with MetaMask" for EVM networks). A client pays, then sends a request with the amount in the
//! method currency, the UTR / transaction id / tx hash and optionally a screenshot. Staff check the payment and approve
//! it (one ledger credit of `amount / rate` USDT, or a different amount with a note) or reject it with a reason. The
//! client can cancel a pending request. Nothing touches the automatic BEP20 / TRC20 deposits.
//!
//! Rules: the method must be active; the amount within its min / max; at most `MAX_PENDING` pending requests per client;
//! the client's "deposits" restriction applies (as for on-chain deposits); a reference (UTR / hash) can't be pending or
//! credited twice in a tenant (unique index), and a crypto hash already seen as an on-chain deposit is refused.
//! Approval posts in the same database transaction as the status change, audit entry and notification, with the ledger
//! key `manual:deposit:<tenant>:<id>`, so a retried approval never credits twice. Ledger kinds: `bank_deposit` and
//! `crypto_deposit` (labels "Bank deposit" / "Crypto deposit").

use chrono::{DateTime, Utc};
use serde_json::{Map, Value, json};
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::{clean_text, notify};
use crate::audit::{self, Entry};
use crate::error::{ApiError, ApiResult};
use crate::ledger::{self, Leg, NewTxn, PostError};
use crate::money::{D, WALLET_DP, check_amount, floor_dp, s, s_opt};
use crate::state::{AppState, Ctx, StaffCtx};

/// Ledger kinds of an approved request, by method kind.
pub const LEDGER_KINDS: &[&str] = &["bank_deposit", "crypto_deposit"];
/// Pending requests a client may have at once.
pub const MAX_PENDING: i64 = 5;
/// Network presets of crypto methods (any other label is accepted as free text).
pub const NETWORKS: &[&str] = &["TRC20", "BEP20", "ERC20", "Polygon", "Solana", "BTC"];
const KINDS: &[&str] = &["bank", "crypto"];
const STATUSES: &[&str] = &["pending", "approved", "rejected", "cancelled"];

pub fn ledger_kind(kind: &str) -> &'static str {
    if kind == "crypto" { "crypto_deposit" } else { "bank_deposit" }
}

/// The preset a network label stands for ("trc20", "TRON" → TRC20; "bsc" → BEP20; "eth" → ERC20 …).
pub fn preset(network: &str) -> Option<&'static str> {
    let n: String = network.trim().to_ascii_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    Some(match n.as_str() {
        "trc20" | "tron" | "trx" | "trontrc20" => "TRC20",
        "bep20" | "bsc" | "bnb" | "bnbchain" | "bnbsmartchain" | "bscbep20" | "bnbsmartchainbep20" => "BEP20",
        "erc20" | "eth" | "ethereum" | "ethereumerc20" => "ERC20",
        "polygon" | "matic" | "pol" | "polygonpos" => "Polygon",
        "solana" | "sol" | "spl" => "Solana",
        "btc" | "bitcoin" => "BTC",
        _ => return None,
    })
}

/// Networks where a MetaMask payment (EIP-1193) is possible.
pub fn is_evm(network: &str) -> bool {
    matches!(preset(network), Some("BEP20" | "ERC20" | "Polygon"))
}

/// Block explorer link of a transaction on a preset network (None for free-text networks or a malformed hash).
pub fn explorer_tx(network: &str, hash: &str) -> Option<String> {
    let h = hash.trim();
    if h.is_empty() || h.len() > 128 || !h.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    let hex = h.strip_prefix("0x").or_else(|| h.strip_prefix("0X")).unwrap_or(h);
    let is_hex64 = hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit());
    match preset(network)? {
        "TRC20" if is_hex64 => Some(format!("https://tronscan.org/#/transaction/{}", hex.to_ascii_lowercase())),
        "BEP20" if is_hex64 => Some(format!("https://bscscan.com/tx/0x{}", hex.to_ascii_lowercase())),
        "ERC20" if is_hex64 => Some(format!("https://etherscan.io/tx/0x{}", hex.to_ascii_lowercase())),
        "Polygon" if is_hex64 => Some(format!("https://polygonscan.com/tx/0x{}", hex.to_ascii_lowercase())),
        "BTC" if is_hex64 => Some(format!("https://mempool.space/tx/{}", hex.to_ascii_lowercase())),
        "Solana" if is_base58(h) && (32..=100).contains(&h.len()) => Some(format!("https://solscan.io/tx/{h}")),
        _ => None,
    }
}

fn is_base58(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|c| c.is_ascii_alphanumeric() && !matches!(c, b'0' | b'O' | b'I' | b'l'))
}

fn is_hex_address(a: &str) -> bool {
    a.len() == 42 && (a.starts_with("0x") || a.starts_with("0X")) && a[2..].chars().all(|c| c.is_ascii_hexdigit())
}

/// The reference as shown and its duplicate key. Crypto: a 64-hex hash is lower-cased (with 0x on EVM networks) and
/// keyed without 0x; other ids (Solana signatures) are kept as typed. Bank: spaces removed.
pub fn normalize_reference(kind: &str, network: Option<&str>, raw: &str) -> ApiResult<(String, String)> {
    let t = raw.trim();
    if kind == "crypto" {
        let hex = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")).unwrap_or(t);
        if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
            let h = hex.to_ascii_lowercase();
            let shown = if network.is_some_and(is_evm) { format!("0x{h}") } else { h.clone() };
            return Ok((shown, h));
        }
        if t.len() < 16 || t.len() > 128 || !t.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | ':')) {
            return Err(ApiError::validation("reference", "Enter the transaction hash / ID of your payment"));
        }
        return Ok((t.to_string(), t.to_ascii_lowercase()));
    }
    let v: String = t.chars().filter(|c| !c.is_whitespace()).collect();
    if v.chars().count() < 6 || v.chars().count() > 64 || !v.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '/' | '.' | '#')) {
        return Err(ApiError::validation("reference", "Enter the UTR / transaction ID of your payment (6–64 letters and digits)"));
    }
    Ok((v.clone(), v.to_ascii_lowercase()))
}

/* ------------------------------------------------------------------ */
/* Payment methods                                                     */
/* ------------------------------------------------------------------ */

/// A method as submitted by the Back Office (create, or a full update).
#[derive(Clone, Debug, Default)]
pub struct MethodInput {
    pub kind: String,
    pub name: String,
    pub status: String,
    pub sort_order: i32,
    pub currency: String,
    pub rate: D,
    pub min_amount: D,
    pub max_amount: Option<D>,
    pub details: Value,
    pub evm: Option<Value>,
    pub qr_media_id: Option<String>,
    pub instructions: String,
}

fn text(details: &Value, k: &str, max: usize) -> ApiResult<Option<String>> {
    match details.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(v)) => {
            let v = v.trim();
            if v.chars().count() > max || v.chars().any(char::is_control) {
                return Err(ApiError::validation("details", format!("{k} is too long or contains invalid characters")));
            }
            Ok((!v.is_empty()).then(|| v.to_string()))
        }
        Some(_) => Err(ApiError::validation("details", format!("{k} must be text"))),
    }
}

fn bank_details(d: &Value) -> ApiResult<Value> {
    let mut out = Map::new();
    let mut put = |k: &str, v: Option<String>| {
        if let Some(v) = v {
            out.insert(k.to_string(), json!(v));
        }
    };
    let account_name = text(d, "account_name", 120)?;
    let upi = text(d, "upi_id", 120)?;
    if account_name.is_none() && upi.is_none() {
        return Err(ApiError::validation("account_name", "Enter the account holder's name or a UPI ID"));
    }
    if let Some(u) = &upi {
        let ok = match u.split_once('@') {
            Some((a, b)) => (2..=256).contains(&a.len()) && (2..=64).contains(&b.len()) && a.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-')) && b.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-')),
            None => false,
        };
        if !ok {
            return Err(ApiError::validation("upi_id", "Enter a UPI ID like name@bank"));
        }
    }
    let ifsc = text(d, "ifsc", 11)?.map(|v| v.to_ascii_uppercase());
    if let Some(v) = &ifsc {
        let b = v.as_bytes();
        if !(b.len() == 11 && b[..4].iter().all(u8::is_ascii_uppercase) && b[4] == b'0' && b[5..].iter().all(u8::is_ascii_alphanumeric)) {
            return Err(ApiError::validation("ifsc", "An IFSC code has 11 characters, like HDFC0001234"));
        }
    }
    let swift = text(d, "swift", 11)?.map(|v| v.to_ascii_uppercase());
    if let Some(v) = &swift
        && !(v.is_ascii() && (v.len() == 8 || v.len() == 11) && v[..6].chars().all(|c| c.is_ascii_uppercase()) && v[6..].chars().all(|c| c.is_ascii_alphanumeric()))
    {
        return Err(ApiError::validation("swift", "A SWIFT / BIC code has 8 or 11 characters"));
    }
    let iban = text(d, "iban", 50)?.map(|v| v.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_ascii_uppercase());
    if let Some(v) = &iban
        && !(v.is_ascii() && (15..=34).contains(&v.len()) && v[..2].chars().all(|c| c.is_ascii_uppercase()) && v[2..4].chars().all(|c| c.is_ascii_digit()) && v[4..].chars().all(|c| c.is_ascii_alphanumeric()))
    {
        return Err(ApiError::validation("iban", "Enter a valid IBAN"));
    }
    let account_number = text(d, "account_number", 40)?;
    if let Some(v) = &account_number
        && !v.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '-')
    {
        return Err(ApiError::validation("account_number", "The account number may only contain letters, digits, spaces and dashes"));
    }
    put("account_name", account_name);
    put("bank_name", text(d, "bank_name", 120)?);
    put("account_number", account_number);
    put("ifsc", ifsc);
    put("swift", swift);
    put("iban", iban);
    put("branch", text(d, "branch", 120)?);
    put("upi_id", upi);
    Ok(Value::Object(out))
}

fn crypto_details(d: &Value) -> ApiResult<Value> {
    let raw_network = text(d, "network", 30)?.ok_or_else(|| ApiError::validation("network", "Choose the network"))?;
    let network = match preset(&raw_network) {
        Some(p) => p.to_string(),
        None => {
            if raw_network.chars().count() < 2 || !raw_network.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.' | '(' | ')')) {
                return Err(ApiError::validation("network", "Enter the network name (letters and digits)"));
            }
            raw_network
        }
    };
    let token = text(d, "token", 12)?.unwrap_or_else(|| "USDT".into()).to_ascii_uppercase();
    if !token.chars().all(|c| c.is_ascii_alphanumeric() || c == '.') {
        return Err(ApiError::validation("token", "Enter the token symbol, like USDT"));
    }
    let address = text(d, "address", 128)?.ok_or_else(|| ApiError::validation("address", "Enter the receiving address"))?;
    if address.len() < 10 || address.chars().any(|c| c.is_whitespace() || !c.is_ascii_graphic()) {
        return Err(ApiError::validation("address", "Enter the receiving address without spaces"));
    }
    let ok = match preset(&network) {
        Some("TRC20") => crate::chain::ChainId::Tron.normalize_address(&address).is_some(),
        Some("BEP20" | "ERC20" | "Polygon") => is_hex_address(&address),
        Some("Solana") => is_base58(&address) && (32..=44).contains(&address.len()),
        Some("BTC") => {
            let a = address.to_ascii_lowercase();
            ((a.starts_with("bc1") || a.starts_with("tb1")) && (14..=74).contains(&a.len()) && a.chars().all(|c| c.is_ascii_alphanumeric()))
                || ((address.starts_with('1') || address.starts_with('3')) && (26..=35).contains(&address.len()) && is_base58(&address))
        }
        _ => true,
    };
    if !ok {
        return Err(ApiError::validation("address", format!("This isn't a valid {network} address")));
    }
    let mut out = Map::new();
    out.insert("network".into(), json!(network));
    out.insert("token".into(), json!(token));
    out.insert("address".into(), json!(address));
    if let Some(m) = text(d, "memo", 64)? {
        out.insert("memo".into(), json!(m));
    }
    Ok(Value::Object(out))
}

fn evm_config(evm: &Value, details: &Value) -> ApiResult<Option<Value>> {
    if evm.is_null() || evm.as_object().is_some_and(|o| o.is_empty()) {
        return Ok(None);
    }
    let address = details["address"].as_str().unwrap_or("");
    if !is_hex_address(address) {
        return Err(ApiError::validation("evm", "MetaMask payments need an EVM address (0x…)"));
    }
    let chain_id = evm.get("chain_id").and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.trim().parse().ok()))).filter(|c| (1..=9_007_199_254_740_991u64).contains(c));
    let Some(chain_id) = chain_id else {
        return Err(ApiError::validation("evm", "Enter the chain id (e.g. 56 for BNB Chain)"));
    };
    let contract = match evm.get("token_contract") {
        None | Some(Value::Null) => None,
        Some(Value::String(c)) if c.trim().is_empty() => None,
        Some(Value::String(c)) if is_hex_address(c.trim()) => Some(c.trim().to_string()),
        Some(_) => return Err(ApiError::validation("evm", "The token contract must be a 0x… address (empty = the native coin)")),
    };
    let decimals = match evm.get("token_decimals").filter(|v| !v.is_null() && v.as_str().is_none_or(|s| !s.trim().is_empty())) {
        None if contract.is_none() => 18,
        None => return Err(ApiError::validation("evm", "Enter the token decimals")),
        Some(v) => v.as_u64().or_else(|| v.as_str().and_then(|s| s.trim().parse().ok())).filter(|d| *d <= 36).ok_or_else(|| ApiError::validation("evm", "Token decimals must be 0–36"))?,
    };
    Ok(Some(json!({"chain_id": chain_id, "token_contract": contract, "token_decimals": decimals})))
}

/// A checked method, ready to store.
struct ValidMethod {
    name: String,
    status: String,
    sort_order: i32,
    currency: String,
    rate: D,
    min_amount: D,
    max_amount: Option<D>,
    details: Value,
    evm: Option<Value>,
    qr_media_id: Option<String>,
    instructions: String,
}

async fn validate_method(st: &AppState, tenant_id: i64, kind: &str, m: &MethodInput) -> ApiResult<ValidMethod> {
    let name = clean_text(Some(&m.name), 60).unwrap_or_default();
    if name.chars().count() < 2 {
        return Err(ApiError::validation("name", "Enter a name clients will recognise (2–60 characters)"));
    }
    let status = if m.status.trim().is_empty() { "active".to_string() } else { m.status.trim().to_lowercase() };
    if status != "active" && status != "hidden" {
        return Err(ApiError::validation("status", "status must be active or hidden"));
    }
    if !(-10_000..=10_000).contains(&m.sort_order) {
        return Err(ApiError::validation("sort_order", "Use a position between -10000 and 10000"));
    }
    let currency = m.currency.trim().to_ascii_uppercase();
    if !(2..=10).contains(&currency.len()) || !currency.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(ApiError::validation("currency", "Enter the currency code clients pay in (e.g. INR, USD, USDT)"));
    }
    let rate = m.rate.normalize();
    if rate <= D::ZERO || rate.scale() > 10 || rate > D::from(1_000_000_000i64) {
        return Err(ApiError::validation("rate", "Enter how many units of the currency make 1 USDT (above 0, at most 10 decimals)"));
    }
    if currency == "USDT" && rate != D::ONE {
        return Err(ApiError::validation("rate", "A USDT method has a rate of 1"));
    }
    let min_amount = m.min_amount.normalize();
    if min_amount < D::ZERO || min_amount.scale() > WALLET_DP || min_amount > crate::money::max_amount() {
        return Err(ApiError::validation("min_amount", "Enter a minimum of 0 or more (at most 6 decimals)"));
    }
    let max_amount = m.max_amount.map(|x| x.normalize());
    if let Some(x) = max_amount
        && (x <= D::ZERO || x.scale() > WALLET_DP || x > crate::money::max_amount() || x < min_amount)
    {
        return Err(ApiError::validation("max_amount", "The maximum must be above 0 and at least the minimum"));
    }
    let details = if kind == "bank" { bank_details(&m.details)? } else { crypto_details(&m.details)? };
    let evm = match (&m.evm, kind) {
        (Some(e), "crypto") => evm_config(e, &details)?,
        (Some(e), _) if !e.is_null() && !e.as_object().is_some_and(|o| o.is_empty()) => return Err(ApiError::validation("evm", "MetaMask payments are for crypto methods only")),
        _ => None,
    };
    let qr_media_id = m.qr_media_id.as_deref().map(str::trim).filter(|x| !x.is_empty()).map(str::to_string);
    if let Some(q) = &qr_media_id {
        let ok = crate::media::find(st, tenant_id, q).await?.is_some_and(|r| r.get::<String, _>("purpose") == "qr");
        if !ok {
            return Err(ApiError::validation("qr_media_id", "Upload the QR image again"));
        }
    }
    let instructions: String = m.instructions.trim().chars().filter(|c| !c.is_control() || *c == '\n').take(2000).collect();
    Ok(ValidMethod { name, status, sort_order: m.sort_order, currency, rate, min_amount, max_amount, details, evm, qr_media_id, instructions })
}

/// A method as clients see it (no staff fields).
pub fn method_json(r: &PgRow) -> Value {
    let qr: Option<String> = r.get("qr_media_id");
    json!({
        "id": r.get::<i64, _>("id"),
        "kind": r.get::<String, _>("kind"),
        "name": r.get::<String, _>("name"),
        "status": r.get::<String, _>("status"),
        "sort_order": r.get::<i32, _>("sort_order"),
        "currency": r.get::<String, _>("currency"),
        "rate": s(r.get::<D, _>("rate")),
        "min_amount": s(r.get::<D, _>("min_amount")),
        "max_amount": s_opt(r.get::<Option<D>, _>("max_amount")),
        "details": r.get::<sqlx::types::Json<Value>, _>("details").0,
        "evm": r.get::<Option<sqlx::types::Json<Value>>, _>("evm").map(|j| j.0),
        "qr_media_id": qr,
        "qr_url": qr.as_deref().map(crate::media::url),
        "instructions": r.get::<String, _>("instructions"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

/// The Back Office view of a method (+ who changed it, version, pending requests).
pub fn method_admin_json(r: &PgRow) -> Value {
    let mut v = method_json(r);
    v["created_by"] = json!(r.get::<String, _>("created_by"));
    v["updated_by"] = json!(r.get::<String, _>("updated_by"));
    v["created_at"] = json!(r.get::<DateTime<Utc>, _>("created_at"));
    v["version"] = json!(r.get::<i32, _>("version"));
    if let Ok(n) = r.try_get::<i64, _>("pending") {
        v["pending"] = json!(n);
    }
    v
}

/// Active methods of a tenant, in the broker's order (Client Area).
pub async fn active_methods(st: &AppState, tenant_id: i64) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query("SELECT * FROM payment_methods WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL ORDER BY sort_order, id").bind(tenant_id).fetch_all(&st.pool).await?;
    Ok(rows.iter().map(method_json).collect())
}

/// Every method that isn't deleted, with its pending requests (Back Office).
pub async fn all_methods(st: &AppState, tenant_id: i64) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query(
        "SELECT m.*, (SELECT count(*) FROM manual_deposits d WHERE d.tenant_id = m.tenant_id AND d.method_id = m.id AND d.status = 'pending') AS pending
         FROM payment_methods m WHERE m.tenant_id = $1 AND m.deleted_at IS NULL ORDER BY m.sort_order, m.id",
    )
    .bind(tenant_id)
    .fetch_all(&st.pool)
    .await?;
    Ok(rows.iter().map(method_admin_json).collect())
}

async fn load_method(st: &AppState, tenant_id: i64, id: i64) -> ApiResult<PgRow> {
    sqlx::query("SELECT * FROM payment_methods WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL").bind(tenant_id).bind(id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Payment method"))
}

pub async fn create_method(st: &AppState, s_ctx: &StaffCtx, m: MethodInput) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    let kind = m.kind.trim().to_lowercase();
    if !KINDS.contains(&kind.as_str()) {
        return Err(ApiError::validation("kind", "Choose bank / UPI or crypto"));
    }
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM payment_methods WHERE tenant_id = $1 AND deleted_at IS NULL").bind(t).fetch_one(&st.pool).await?;
    if n >= 100 {
        return Err(ApiError::unprocessable("too_many_methods", "A broker can have up to 100 payment methods"));
    }
    let v = validate_method(st, t, &kind, &m).await?;
    let mut tx = st.pool.begin().await?;
    let r = sqlx::query(
        "INSERT INTO payment_methods (tenant_id, kind, name, status, sort_order, currency, rate, min_amount, max_amount, details, evm, qr_media_id, instructions, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *",
    )
    .bind(t)
    .bind(&kind)
    .bind(&v.name)
    .bind(&v.status)
    .bind(v.sort_order)
    .bind(&v.currency)
    .bind(v.rate)
    .bind(v.min_amount)
    .bind(v.max_amount)
    .bind(sqlx::types::Json(&v.details))
    .bind(v.evm.as_ref().map(sqlx::types::Json))
    .bind(&v.qr_media_id)
    .bind(&v.instructions)
    .bind(s_ctx.staff.tag())
    .fetch_one(&mut *tx)
    .await?;
    let id: i64 = r.get("id");
    let after = method_admin_json(&r);
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.manual.method.created", target_kind: "payment_method", target_id: id.to_string(), reason: None, before: None, after: Some(after.clone()) }).await?;
    tx.commit().await?;
    tracing::info!(tenant = t, method = id, %kind, "payment method created");
    Ok(after)
}

/// Full update of a method. `version` must be the one the editor loaded (someone else's change in between → 409).
/// The kind never changes. A status-only change is audited as hidden / shown.
pub async fn update_method(st: &AppState, s_ctx: &StaffCtx, id: i64, version: i32, m: MethodInput) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    let cur = load_method(st, t, id).await?;
    let kind: String = cur.get("kind");
    if !m.kind.trim().is_empty() && m.kind.trim().to_lowercase() != kind {
        return Err(ApiError::validation("kind", "The kind of a method can't change; create a new method instead"));
    }
    let v = validate_method(st, t, &kind, &m).await?;
    let before = method_admin_json(&cur);
    let mut tx = st.pool.begin().await?;
    let r = sqlx::query(
        "UPDATE payment_methods SET name = $4, status = $5, sort_order = $6, currency = $7, rate = $8, min_amount = $9, max_amount = $10, details = $11, evm = $12,
                qr_media_id = $13, instructions = $14, updated_by = $15, updated_at = now(), version = version + 1
         WHERE tenant_id = $1 AND id = $2 AND version = $3 AND deleted_at IS NULL RETURNING *",
    )
    .bind(t)
    .bind(id)
    .bind(version)
    .bind(&v.name)
    .bind(&v.status)
    .bind(v.sort_order)
    .bind(&v.currency)
    .bind(v.rate)
    .bind(v.min_amount)
    .bind(v.max_amount)
    .bind(sqlx::types::Json(&v.details))
    .bind(v.evm.as_ref().map(sqlx::types::Json))
    .bind(&v.qr_media_id)
    .bind(&v.instructions)
    .bind(s_ctx.staff.tag())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::conflict("stale", "Someone else changed this payment method. Reload it and try again."))?;
    let after = method_admin_json(&r);
    let was: String = cur.get("status");
    let action = if was != v.status && v.status == "hidden" {
        "wallet.manual.method.hidden"
    } else if was != v.status {
        "wallet.manual.method.shown"
    } else {
        "wallet.manual.method.updated"
    };
    audit::staff(&mut tx, s_ctx, Entry { action, target_kind: "payment_method", target_id: id.to_string(), reason: None, before: Some(before), after: Some(after.clone()) }).await?;
    tx.commit().await?;
    Ok(after)
}

/// Deletes a method: clients no longer see it and staff no longer list it; requests keep their snapshot. Pending
/// requests against it stay in the queue (decide them first, or they are decided as usual).
pub async fn delete_method(st: &AppState, s_ctx: &StaffCtx, id: i64, reason: Option<&str>) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    let cur = load_method(st, t, id).await?;
    let mut tx = st.pool.begin().await?;
    let r = sqlx::query("UPDATE payment_methods SET deleted_at = now(), status = 'hidden', updated_by = $3, updated_at = now(), version = version + 1 WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING *")
        .bind(t)
        .bind(id)
        .bind(s_ctx.staff.tag())
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| ApiError::not_found("Payment method"))?;
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.manual.method.deleted", target_kind: "payment_method", target_id: id.to_string(), reason, before: Some(method_admin_json(&cur)), after: Some(method_admin_json(&r)) }).await?;
    tx.commit().await?;
    Ok(json!({"deleted": true, "id": id}))
}

/* ------------------------------------------------------------------ */
/* Deposit requests                                                    */
/* ------------------------------------------------------------------ */

fn snapshot(m: &PgRow) -> Value {
    let kind: String = m.get("kind");
    let d = m.get::<sqlx::types::Json<Value>, _>("details").0;
    let mut v = json!({
        "kind": kind,
        "name": m.get::<String, _>("name"),
        "currency": m.get::<String, _>("currency"),
        "rate": s(m.get::<D, _>("rate")),
    });
    if kind == "crypto" {
        v["network"] = d["network"].clone();
        v["token"] = d["token"].clone();
        v["destination"] = d["address"].clone();
        if d.get("memo").is_some() {
            v["memo"] = d["memo"].clone();
        }
    } else {
        for k in ["bank_name", "account_name", "account_number", "ifsc", "upi_id"] {
            if let Some(x) = d.get(k) {
                v[k] = x.clone();
            }
        }
        v["destination"] = d.get("account_number").or_else(|| d.get("upi_id")).or_else(|| d.get("iban")).cloned().unwrap_or(Value::Null);
    }
    v
}

/// A request as the client sees it.
pub fn client_json(r: &PgRow) -> Value {
    let status: String = r.get("status");
    let proof: Option<String> = r.get("proof_media_id");
    let reason: Option<String> = if status == "rejected" { r.get("decision_reason") } else { None };
    json!({
        "id": r.get::<i64, _>("id"),
        "method_id": r.get::<i64, _>("method_id"),
        "kind": r.get::<String, _>("kind"),
        "method": r.get::<sqlx::types::Json<Value>, _>("method").0,
        "currency": r.get::<String, _>("currency"),
        "amount": s(r.get::<D, _>("amount")),
        "rate": s(r.get::<D, _>("rate")),
        "expected_credit": s(r.get::<D, _>("expected_credit")),
        "credit_amount": s_opt(r.get::<Option<D>, _>("credit_amount")),
        "reference": r.get::<String, _>("reference"),
        "proof_url": proof.as_deref().map(crate::media::url),
        "client_note": r.get::<Option<String>, _>("client_note"),
        "status": status,
        "reason": reason,
        "decided_at": r.get::<Option<DateTime<Utc>>, _>("decided_at"),
        "created_at": r.get::<DateTime<Utc>, _>("created_at"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

/// The Back Office view (client, staff decision, ledger, explorer link).
pub fn admin_json(r: &PgRow) -> Value {
    let mut v = client_json(r);
    let method = &v["method"];
    let explorer = if r.get::<String, _>("kind") == "crypto" { method["network"].as_str().and_then(|n| explorer_tx(n, &r.get::<String, _>("reference"))) } else { None };
    v["user_id"] = json!(r.get::<i64, _>("user_id"));
    v["user_name"] = json!(r.get::<Option<String>, _>("user_name"));
    v["user_email"] = json!(r.get::<Option<String>, _>("user_email"));
    v["proof_media_id"] = json!(r.get::<Option<String>, _>("proof_media_id"));
    v["explorer_url"] = json!(explorer);
    v["decided_by"] = r.get::<Option<String>, _>("decided_by_id").map(|id| json!({"id": id, "name": r.get::<Option<String>, _>("decided_by_name")})).unwrap_or(Value::Null);
    v["reason"] = json!(r.get::<Option<String>, _>("decision_reason"));
    v["decision_note"] = json!(r.get::<Option<String>, _>("decision_note"));
    v["ledger_txn_id"] = json!(r.get::<Option<i64>, _>("ledger_txn_id"));
    v["ip"] = json!(r.get::<Option<String>, _>("ip"));
    v
}

/// A client's new request.
#[derive(Clone, Debug)]
pub struct NewRequest {
    pub user_id: i64,
    pub method_id: i64,
    pub amount: D,
    pub reference: String,
    pub proof_media_id: Option<String>,
    pub client_note: Option<String>,
    pub idempotency_key: String,
}

fn same_request(r: &PgRow, n: &NewRequest, amount: D, key: &str) -> bool {
    r.get::<i64, _>("method_id") == n.method_id && r.get::<D, _>("amount") == amount && r.get::<String, _>("reference_key") == key
}

fn is_unique_violation(e: &sqlx::Error, constraint: &str) -> bool {
    matches!(e, sqlx::Error::Database(d) if d.code().as_deref() == Some("23505") && d.constraint().is_some_and(|c| c.contains(constraint)))
}

pub async fn create(st: &AppState, ctx: &Ctx, n: NewRequest) -> ApiResult<Value> {
    let t = ctx.tenant.id;
    if n.user_id <= 0 {
        return Err(ApiError::validation("user_id", "user_id is required"));
    }
    let ikey = n.idempotency_key.trim().to_string();
    if ikey.is_empty() || ikey.len() > 160 {
        return Err(ApiError::validation("idempotency_key", "idempotency_key must be 1–160 characters"));
    }
    // deleted methods too: a retry of a request whose method was removed since still replays
    let method = sqlx::query("SELECT * FROM payment_methods WHERE tenant_id = $1 AND id = $2").bind(t).bind(n.method_id).fetch_optional(&st.pool).await?;
    let kind = method.as_ref().map(|m| m.get::<String, _>("kind")).unwrap_or_else(|| "bank".into());
    let network = method.as_ref().and_then(|m| m.get::<sqlx::types::Json<Value>, _>("details").0["network"].as_str().map(str::to_string));
    let amount = check_amount(n.amount, WALLET_DP).map_err(|m| ApiError::validation("amount", m))?;
    let (reference, ref_key) = normalize_reference(&kind, network.as_deref(), &n.reference)?;

    // the same submission again (double click, retry): the original request
    if let Some(r) = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND user_id = $2 AND idempotency_key = $3").bind(t).bind(n.user_id).bind(&ikey).fetch_optional(&st.pool).await? {
        if !same_request(&r, &n, amount, &ref_key) {
            return Err(ApiError::conflict("idempotency_conflict", "This request id was used for a different deposit request"));
        }
        let mut v = client_json(&r);
        v["replayed"] = json!(true);
        return Ok(v);
    }

    // deposits disabled for this client (Back Office restriction), as for on-chain deposits; fail closed
    let user = st.users.get(&ctx.tenant.slug, n.user_id).await.map_err(|e| {
        tracing::warn!(error = %e, "gateway unavailable for the restriction check");
        ApiError::Coded { status: axum::http::StatusCode::SERVICE_UNAVAILABLE, code: "unavailable", message: "Your account status is unavailable. Please try again shortly.".into() }
    })?;
    if user.as_ref().is_some_and(|u| u.restrictions.iter().any(|k| k == "deposits")) {
        return Err(crate::users::restricted("deposits"));
    }

    let Some(method) = method.filter(|m| m.get::<String, _>("status") == "active" && m.get::<Option<DateTime<Utc>>, _>("deleted_at").is_none()) else {
        return Err(ApiError::unprocessable("method_unavailable", "This payment method is no longer available. Choose another one."));
    };
    let currency: String = method.get("currency");
    let rate: D = method.get("rate");
    let min: D = method.get("min_amount");
    let max: Option<D> = method.get("max_amount");
    if amount < min {
        return Err(ApiError::unprocessable("below_minimum", format!("The minimum for this method is {} {currency}", s(min))));
    }
    if let Some(x) = max
        && amount > x
    {
        return Err(ApiError::unprocessable("above_maximum", format!("The maximum for this method is {} {currency}", s(x))));
    }
    let expected = floor_dp(amount / rate, WALLET_DP);
    if expected <= D::ZERO {
        return Err(ApiError::validation("amount", "The amount is too small"));
    }
    if kind == "crypto" {
        // a hash the automatic deposits already know (credited or not) is never credited again by hand
        // canonical forms: bsc 0x + 64 lower hex, tron 64 lower hex (both use the (chain, tx_hash) index)
        let onchain: Option<i64> = sqlx::query_scalar("SELECT id FROM deposits WHERE (chain = 'bsc' AND tx_hash = '0x' || $1) OR (chain = 'tron' AND tx_hash = $1) LIMIT 1").bind(&ref_key).fetch_optional(&st.pool).await?;
        if onchain.is_some() {
            return Err(ApiError::conflict("reference_used", "This transaction was already received as an automatic deposit"));
        }
    }
    let proof = n.proof_media_id.as_deref().map(str::trim).filter(|x| !x.is_empty()).map(str::to_string);
    if let Some(p) = &proof {
        let ok = crate::media::find(st, t, p).await?.is_some_and(|r| r.get::<String, _>("purpose") == "proof" && r.get::<Option<i64>, _>("user_id") == Some(n.user_id));
        if !ok {
            return Err(ApiError::validation("proof_media_id", "Upload the payment screenshot again"));
        }
    }
    let note = clean_text(n.client_note.as_deref(), 500);

    let mut tx = st.pool.begin().await?;
    // one request at a time per client: the pending cap and the duplicate check can't race
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('manual-deposit:' || $1::text || ':' || $2::text, 0))").bind(t).bind(n.user_id).execute(&mut *tx).await?;
    if let Some(r) = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND user_id = $2 AND idempotency_key = $3").bind(t).bind(n.user_id).bind(&ikey).fetch_optional(&mut *tx).await? {
        let mut v = client_json(&r);
        v["replayed"] = json!(true);
        return if same_request(&r, &n, amount, &ref_key) { Ok(v) } else { Err(ApiError::conflict("idempotency_conflict", "This request id was used for a different deposit request")) };
    }
    let used: Option<i64> = sqlx::query_scalar("SELECT id FROM manual_deposits WHERE tenant_id = $1 AND kind = $2 AND reference_key = $3 AND status IN ('pending', 'approved') LIMIT 1")
        .bind(t)
        .bind(&kind)
        .bind(&ref_key)
        .fetch_optional(&mut *tx)
        .await?;
    if used.is_some() {
        return Err(ApiError::conflict("reference_used", "A deposit request with this reference was already sent"));
    }
    let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM manual_deposits WHERE tenant_id = $1 AND user_id = $2 AND status = 'pending'").bind(t).bind(n.user_id).fetch_one(&mut *tx).await?;
    if pending >= MAX_PENDING {
        return Err(ApiError::Coded {
            status: axum::http::StatusCode::TOO_MANY_REQUESTS,
            code: "too_many_pending",
            message: format!("You already have {MAX_PENDING} deposit requests waiting for review. Please wait until they are checked."),
        });
    }
    let ins = sqlx::query(
        "INSERT INTO manual_deposits (tenant_id, user_id, user_name, user_email, method_id, kind, method, currency, amount, rate, expected_credit, reference, reference_key,
                                      proof_media_id, client_note, idempotency_key, ip, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *",
    )
    .bind(t)
    .bind(n.user_id)
    .bind(user.as_ref().map(|u| u.name.clone()).filter(|x| !x.is_empty()))
    .bind(user.as_ref().map(|u| u.email.clone()).filter(|x| !x.is_empty()))
    .bind(n.method_id)
    .bind(&kind)
    .bind(sqlx::types::Json(snapshot(&method)))
    .bind(&currency)
    .bind(amount)
    .bind(rate)
    .bind(expected)
    .bind(&reference)
    .bind(&ref_key)
    .bind(&proof)
    .bind(&note)
    .bind(&ikey)
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .fetch_one(&mut *tx)
    .await;
    let r = match ins {
        Ok(r) => r,
        Err(e) if is_unique_violation(&e, "reference") => return Err(ApiError::conflict("reference_used", "A deposit request with this reference was already sent")),
        Err(e) => return Err(e.into()),
    };
    tx.commit().await?;
    tracing::info!(tenant = t, user = n.user_id, request = r.get::<i64, _>("id"), %kind, %amount, %currency, "manual deposit requested");
    let mut v = client_json(&r);
    v["replayed"] = json!(false);
    Ok(v)
}

pub async fn get_for_client(st: &AppState, tenant_id: i64, user_id: i64, id: i64) -> ApiResult<Value> {
    let r = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND id = $2 AND user_id = $3").bind(tenant_id).bind(id).bind(user_id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Deposit request"))?;
    Ok(client_json(&r))
}

pub async fn list_for_client(st: &AppState, tenant_id: i64, user_id: i64, status: Option<&str>, limit: i64, offset: i64) -> ApiResult<(Vec<Value>, i64)> {
    if let Some(x) = status
        && !STATUSES.contains(&x)
    {
        return Err(ApiError::BadRequest("Unknown status".into()));
    }
    let rows = sqlx::query("SELECT *, count(*) OVER () AS total FROM manual_deposits WHERE tenant_id = $1 AND user_id = $2 AND ($3::text IS NULL OR status = $3) ORDER BY id DESC LIMIT $4 OFFSET $5")
        .bind(tenant_id)
        .bind(user_id)
        .bind(status)
        .bind(limit)
        .bind(offset)
        .fetch_all(&st.pool)
        .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    Ok((rows.iter().map(client_json).collect(), total))
}

/// The client cancels their own pending request.
pub async fn cancel(st: &AppState, ctx: &Ctx, user_id: i64, id: i64) -> ApiResult<Value> {
    let t = ctx.tenant.id;
    let mut tx = st.pool.begin().await?;
    let cur = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND id = $2 AND user_id = $3 FOR UPDATE").bind(t).bind(id).bind(user_id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Deposit request"))?;
    let status: String = cur.get("status");
    if status != "pending" {
        return Err(ApiError::conflict("invalid_state", format!("This request is {status} and can't be cancelled")));
    }
    let r = sqlx::query("UPDATE manual_deposits SET status = 'cancelled', decided_at = now(), updated_at = now() WHERE id = $1 RETURNING *").bind(id).fetch_one(&mut *tx).await?;
    audit::user(&mut tx, t, user_id, ctx, "wallet.manual.deposit.cancelled", "manual_deposit", id.to_string(), Some(json!({"status": status})), Some(json!({"status": "cancelled"}))).await?;
    tx.commit().await?;
    Ok(client_json(&r))
}

/* ------------------------------------------------------------------ */
/* Staff: review                                                       */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Default)]
pub struct AdminFilter {
    pub status: Option<String>,
    pub kind: Option<String>,
    pub method_id: Option<i64>,
    pub user_id: Option<i64>,
    pub q: Option<String>,
}

impl AdminFilter {
    fn check(&self) -> ApiResult<()> {
        if let Some(s) = &self.status
            && !STATUSES.contains(&s.as_str())
        {
            return Err(ApiError::BadRequest("status must be pending, approved, rejected or cancelled".into()));
        }
        if let Some(k) = &self.kind
            && !KINDS.contains(&k.as_str())
        {
            return Err(ApiError::BadRequest("kind must be bank or crypto".into()));
        }
        Ok(())
    }
}

const ADMIN_WHERE: &str = "tenant_id = $1
           AND ($2::text IS NULL OR status = $2)
           AND ($3::text IS NULL OR kind = $3)
           AND ($4::bigint IS NULL OR method_id = $4)
           AND ($5::bigint IS NULL OR user_id = $5)
           AND ($6::text IS NULL OR reference_key LIKE '%' || $6 || '%' OR lower(COALESCE(user_email, '')) LIKE '%' || $6 || '%'
                OR lower(COALESCE(user_name, '')) LIKE '%' || $6 || '%' OR id::text = $6 OR user_id::text = $6)";

/// A search term for LIKE (wildcards escaped; a 0x hash prefix dropped like in reference_key).
fn term(q: &Option<String>) -> Option<String> {
    let t = q.as_deref()?.trim().to_lowercase();
    let t = t.strip_prefix("0x").map(str::to_string).unwrap_or(t);
    (!t.is_empty() && t.len() <= 128).then(|| t.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"))
}

pub async fn admin_list(st: &AppState, tenant_id: i64, f: &AdminFilter, limit: i64, offset: i64) -> ApiResult<Value> {
    f.check()?;
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT *, count(*) OVER () AS total FROM manual_deposits WHERE {ADMIN_WHERE}
         ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, CASE WHEN status = 'pending' THEN id END ASC, id DESC LIMIT $7 OFFSET $8"
    )))
    .bind(tenant_id)
    .bind(&f.status)
    .bind(&f.kind)
    .bind(f.method_id)
    .bind(f.user_id)
    .bind(term(&f.q))
    .bind(limit)
    .bind(offset)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    Ok(json!({"items": rows.iter().map(admin_json).collect::<Vec<_>>(), "total": total, "counts": counts(st, tenant_id).await?}))
}

/// Requests per status (+ pending per kind and the pending total in USDT).
pub async fn counts(st: &AppState, tenant_id: i64) -> ApiResult<Value> {
    let r = sqlx::query(
        "SELECT count(*) FILTER (WHERE status = 'pending') AS pending,
                count(*) FILTER (WHERE status = 'pending' AND kind = 'bank') AS pending_bank,
                count(*) FILTER (WHERE status = 'pending' AND kind = 'crypto') AS pending_crypto,
                COALESCE(sum(expected_credit) FILTER (WHERE status = 'pending'), 0) AS pending_usdt,
                count(*) FILTER (WHERE status = 'approved') AS approved,
                count(*) FILTER (WHERE status = 'rejected') AS rejected,
                count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                count(*) AS total
         FROM manual_deposits WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(&st.pool)
    .await?;
    let n = |c: &str| r.get::<i64, _>(c);
    Ok(json!({
        "pending": n("pending"), "pending_bank": n("pending_bank"), "pending_crypto": n("pending_crypto"), "pending_usdt": s(r.get::<D, _>("pending_usdt")),
        "approved": n("approved"), "rejected": n("rejected"), "cancelled": n("cancelled"), "all": n("total"),
    }))
}

pub async fn admin_get(st: &AppState, tenant_id: i64, id: i64) -> ApiResult<Value> {
    let r = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND id = $2").bind(tenant_id).bind(id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Deposit request"))?;
    let mut v = admin_json(&r);
    let user_id: i64 = r.get("user_id");
    let stats = sqlx::query(
        "SELECT count(*) FILTER (WHERE status = 'approved') AS approved, COALESCE(sum(credit_amount) FILTER (WHERE status = 'approved'), 0) AS credited,
                count(*) FILTER (WHERE status = 'rejected') AS rejected, count(*) FILTER (WHERE status = 'pending') AS pending
         FROM manual_deposits WHERE tenant_id = $1 AND user_id = $2 AND id <> $3",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(id)
    .fetch_one(&st.pool)
    .await?;
    v["client_history"] = json!({
        "approved": stats.get::<i64, _>("approved"), "credited": s(stats.get::<D, _>("credited")),
        "rejected": stats.get::<i64, _>("rejected"), "pending": stats.get::<i64, _>("pending"),
    });
    // the same reference rejected or cancelled before (a duplicate that slipped past the unique index)
    let earlier: Vec<Value> = sqlx::query("SELECT id, user_id, status, created_at FROM manual_deposits WHERE tenant_id = $1 AND kind = $2 AND reference_key = $3 AND id <> $4 ORDER BY id DESC LIMIT 10")
        .bind(tenant_id)
        .bind(r.get::<String, _>("kind"))
        .bind(r.get::<String, _>("reference_key"))
        .bind(id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(|x| json!({"id": x.get::<i64, _>("id"), "user_id": x.get::<i64, _>("user_id"), "status": x.get::<String, _>("status"), "created_at": x.get::<DateTime<Utc>, _>("created_at")}))
        .collect();
    v["same_reference"] = json!(earlier);
    let history: Vec<Value> = sqlx::query("SELECT * FROM audit_log WHERE tenant_id = $1 AND target_kind = 'manual_deposit' AND target_id = $2 ORDER BY id")
        .bind(tenant_id)
        .bind(id.to_string())
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(crate::api::admin::audit_json)
        .collect();
    v["history"] = json!(history);
    Ok(v)
}

/// Approves a pending request: one ledger credit (the expected amount, or `credit` with a note), the status change,
/// the audit entry and the client notification in one database transaction. Approving an approved request again
/// with the same amount returns it unchanged (`replayed`).
pub async fn approve(st: &AppState, s_ctx: &StaffCtx, id: i64, credit: Option<D>, note: Option<String>) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    let note = clean_text(note.as_deref(), 500);
    let mut tx = st.pool.begin().await?;
    let cur = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND id = $2 FOR UPDATE").bind(t).bind(id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Deposit request"))?;
    let status: String = cur.get("status");
    let expected: D = cur.get("expected_credit");
    if status == "approved" {
        let booked: Option<D> = cur.get("credit_amount");
        if credit.is_none() || credit.map(|c| c.normalize()) == booked.map(|b| b.normalize()) {
            let mut v = admin_json(&cur);
            v["replayed"] = json!(true);
            return Ok(v);
        }
        return Err(ApiError::conflict("invalid_state", "This request was already approved with another amount"));
    }
    if status != "pending" {
        return Err(ApiError::conflict("invalid_state", format!("This request is {status} and can't be approved")));
    }
    let credit = check_amount(credit.unwrap_or(expected), WALLET_DP).map_err(|m| ApiError::validation("credit_amount", m))?;
    if credit != expected.normalize() && note.as_deref().is_none_or(|x| x.chars().count() < 3) {
        return Err(ApiError::validation("note", "You changed the amount to credit: add a note explaining why"));
    }
    let (user_id, kind) = (cur.get::<i64, _>("user_id"), cur.get::<String, _>("kind"));
    let method = cur.get::<sqlx::types::Json<Value>, _>("method").0;
    let (amount, currency, reference) = (cur.get::<D, _>("amount"), cur.get::<String, _>("currency"), cur.get::<String, _>("reference"));
    let lkind = ledger_kind(&kind);
    let key = format!("manual:deposit:{t}:{id}");
    let ccy = "USDT";
    let posted = ledger::post(
        &mut tx,
        NewTxn {
            tenant_id: t,
            key: key.clone(),
            kind: lkind.into(),
            user_id: Some(user_id),
            currency: ccy.into(),
            reference: Some(reference.chars().take(128).collect()),
            note: Some(format!("{} · {} {currency}", method["name"].as_str().unwrap_or(""), s(amount))),
            actor: s_ctx.staff.tag(),
            request: Some(json!({"manual_deposit_id": id})),
            legs: vec![Leg::available(user_id, ccy, credit), Leg::sys(ccy, lkind, -credit)],
        },
    )
    .await;
    let txn = match posted {
        Ok(txn) => txn,
        Err(PostError::Duplicate) => {
            // booked by an earlier attempt whose row update was lost: link that booking, never post again
            drop(tx);
            let mut tx2 = st.pool.begin().await?;
            let txn: i64 = sqlx::query_scalar("SELECT id FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(t).bind(&key).fetch_one(&mut *tx2).await?;
            let booked: D = sqlx::query_scalar("SELECT amount FROM ledger_postings WHERE txn_id = $1 AND user_id = $2").bind(txn).bind(user_id).fetch_one(&mut *tx2).await?;
            let r = sqlx::query(
                "UPDATE manual_deposits SET status = 'approved', credit_amount = $3, ledger_txn_id = $4, decided_by_id = $5, decided_by_name = $6, decided_at = now(), decision_note = $7, updated_at = now()
                 WHERE tenant_id = $1 AND id = $2 AND status = 'pending' RETURNING *",
            )
            .bind(t)
            .bind(id)
            .bind(booked)
            .bind(txn)
            .bind(&s_ctx.staff.id)
            .bind(&s_ctx.staff.name)
            .bind(&note)
            .fetch_optional(&mut *tx2)
            .await?;
            tx2.commit().await?;
            let r = match r {
                Some(r) => r,
                None => sqlx::query("SELECT * FROM manual_deposits WHERE id = $1").bind(id).fetch_one(&st.pool).await?,
            };
            let mut v = admin_json(&r);
            v["replayed"] = json!(true);
            return Ok(v);
        }
        Err(e) => return Err(e.into()),
    };
    let r = sqlx::query(
        "UPDATE manual_deposits SET status = 'approved', credit_amount = $3, ledger_txn_id = $4, decided_by_id = $5, decided_by_name = $6, decided_at = now(), decision_note = $7, updated_at = now()
         WHERE tenant_id = $1 AND id = $2 RETURNING *",
    )
    .bind(t)
    .bind(id)
    .bind(credit)
    .bind(txn)
    .bind(&s_ctx.staff.id)
    .bind(&s_ctx.staff.name)
    .bind(&note)
    .fetch_one(&mut *tx)
    .await?;
    audit::staff(
        &mut tx,
        s_ctx,
        Entry {
            action: "wallet.manual.deposit.approved",
            target_kind: "manual_deposit",
            target_id: id.to_string(),
            reason: note.as_deref(),
            before: Some(admin_json(&cur)),
            after: Some(json!({"status": "approved", "credit_amount": s(credit), "expected_credit": s(expected), "ledger_txn_id": txn, "ledger_kind": lkind, "user_id": user_id})),
        },
    )
    .await?;
    let label = if kind == "crypto" { "Crypto deposit" } else { "Bank deposit" };
    notify(
        &mut tx,
        t,
        user_id,
        "deposit.credited",
        &format!("{label} credited"),
        &format!("{} USDT was credited to your wallet for your {} payment of {} {currency}.", s(credit), method["name"].as_str().unwrap_or(""), s(amount)),
        json!({"manual_deposit_id": id, "kind": lkind, "amount": s(credit), "reference": reference}),
    )
    .await?;
    tx.commit().await?;
    tracing::info!(tenant = t, request = id, user = user_id, credit = %credit, staff = %s_ctx.staff.id, "manual deposit approved");
    let mut v = admin_json(&r);
    v["replayed"] = json!(false);
    Ok(v)
}

/// Rejects a pending request with a reason the client sees.
pub async fn reject(st: &AppState, s_ctx: &StaffCtx, id: i64, reason: &str) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    let reason = clean_text(Some(reason), 500).unwrap_or_default();
    if reason.chars().count() < 3 {
        return Err(ApiError::validation("reason", "Give a reason (the client sees it)"));
    }
    let mut tx = st.pool.begin().await?;
    let cur = sqlx::query("SELECT * FROM manual_deposits WHERE tenant_id = $1 AND id = $2 FOR UPDATE").bind(t).bind(id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Deposit request"))?;
    let status: String = cur.get("status");
    if status != "pending" {
        return Err(ApiError::conflict("invalid_state", format!("This request is {status} and can't be rejected")));
    }
    let r = sqlx::query("UPDATE manual_deposits SET status = 'rejected', decided_by_id = $2, decided_by_name = $3, decided_at = now(), decision_reason = $4, updated_at = now() WHERE id = $1 RETURNING *")
        .bind(id)
        .bind(&s_ctx.staff.id)
        .bind(&s_ctx.staff.name)
        .bind(&reason)
        .fetch_one(&mut *tx)
        .await?;
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.manual.deposit.rejected", target_kind: "manual_deposit", target_id: id.to_string(), reason: Some(&reason), before: Some(admin_json(&cur)), after: Some(json!({"status": "rejected", "reason": reason})) }).await?;
    let method = cur.get::<sqlx::types::Json<Value>, _>("method").0;
    notify(
        &mut tx,
        t,
        cur.get("user_id"),
        "deposit.rejected",
        "Deposit request not approved",
        &format!("Your {} deposit request of {} {} (ref {}) was not approved: {reason}", method["name"].as_str().unwrap_or(""), s(cur.get::<D, _>("amount")), cur.get::<String, _>("currency"), cur.get::<String, _>("reference")),
        json!({"manual_deposit_id": id}),
    )
    .await?;
    tx.commit().await?;
    Ok(admin_json(&r))
}

fn csv_cell(v: &str) -> String {
    // spreadsheet formula injection: a leading = + - @ is neutralised
    let v = if v.starts_with(['=', '+', '-', '@', '\t', '\r']) { format!("'{v}") } else { v.to_string() };
    if v.contains([',', '"', '\n', '\r']) { format!("\"{}\"", v.replace('"', "\"\"")) } else { v }
}

/// CSV of the requests matching `f` (newest first, at most 10,000 rows).
pub async fn export_csv(st: &AppState, s_ctx: &StaffCtx, f: &AdminFilter) -> ApiResult<String> {
    f.check()?;
    let t = s_ctx.ctx.tenant.id;
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * FROM manual_deposits WHERE {ADMIN_WHERE} ORDER BY id DESC LIMIT 10000")))
        .bind(t)
        .bind(&f.status)
        .bind(&f.kind)
        .bind(f.method_id)
        .bind(f.user_id)
        .bind(term(&f.q))
        .fetch_all(&st.pool)
        .await?;
    let mut out = String::from(
        "id,created_at,client_id,client_name,client_email,kind,method,network,currency,amount,rate,expected_credit_usdt,credited_usdt,reference,status,decided_by,decided_at,reason,note,ledger_txn\n",
    );
    for r in &rows {
        let m = r.get::<sqlx::types::Json<Value>, _>("method").0;
        let cells = [
            r.get::<i64, _>("id").to_string(),
            r.get::<DateTime<Utc>, _>("created_at").to_rfc3339(),
            r.get::<i64, _>("user_id").to_string(),
            r.get::<Option<String>, _>("user_name").unwrap_or_default(),
            r.get::<Option<String>, _>("user_email").unwrap_or_default(),
            r.get::<String, _>("kind"),
            m["name"].as_str().unwrap_or("").to_string(),
            m["network"].as_str().unwrap_or("").to_string(),
            r.get::<String, _>("currency"),
            s(r.get::<D, _>("amount")),
            s(r.get::<D, _>("rate")),
            s(r.get::<D, _>("expected_credit")),
            r.get::<Option<D>, _>("credit_amount").map(s).unwrap_or_default(),
            r.get::<String, _>("reference"),
            r.get::<String, _>("status"),
            r.get::<Option<String>, _>("decided_by_name").unwrap_or_default(),
            r.get::<Option<DateTime<Utc>>, _>("decided_at").map(|d| d.to_rfc3339()).unwrap_or_default(),
            r.get::<Option<String>, _>("decision_reason").unwrap_or_default(),
            r.get::<Option<String>, _>("decision_note").unwrap_or_default(),
            r.get::<Option<i64>, _>("ledger_txn_id").map(|x| x.to_string()).unwrap_or_default(),
        ];
        out.push_str(&cells.iter().map(|c| csv_cell(c)).collect::<Vec<_>>().join(","));
        out.push('\n');
    }
    let mut tx = st.pool.begin().await?;
    audit::staff(
        &mut tx,
        s_ctx,
        Entry { action: "wallet.manual.export", target_kind: "manual_deposit", target_id: "export".into(), reason: None, before: None, after: Some(json!({"rows": rows.len(), "status": f.status, "kind": f.kind, "method_id": f.method_id, "user_id": f.user_id, "q": f.q})) },
    )
    .await?;
    tx.commit().await?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_presets_and_explorers() {
        assert_eq!(preset("trc20"), Some("TRC20"));
        assert_eq!(preset("TRON (TRC20)"), Some("TRC20"));
        assert_eq!(preset("BSC"), Some("BEP20"));
        assert_eq!(preset("Ethereum"), Some("ERC20"));
        assert_eq!(preset("matic"), Some("Polygon"));
        assert_eq!(preset("SOL"), Some("Solana"));
        assert_eq!(preset("bitcoin"), Some("BTC"));
        assert_eq!(preset("Arbitrum One"), None);
        assert!(is_evm("BEP20") && is_evm("ERC20") && is_evm("Polygon") && !is_evm("TRC20") && !is_evm("Solana"));
        let h = "AB".repeat(32);
        assert_eq!(explorer_tx("TRC20", &h).unwrap(), format!("https://tronscan.org/#/transaction/{}", "ab".repeat(32)));
        assert_eq!(explorer_tx("BEP20", &h).unwrap(), format!("https://bscscan.com/tx/0x{}", "ab".repeat(32)));
        assert_eq!(explorer_tx("ERC20", &format!("0x{h}")).unwrap(), format!("https://etherscan.io/tx/0x{}", "ab".repeat(32)));
        assert_eq!(explorer_tx("Polygon", &h).unwrap(), format!("https://polygonscan.com/tx/0x{}", "ab".repeat(32)));
        assert_eq!(explorer_tx("BTC", &h).unwrap(), format!("https://mempool.space/tx/{}", "ab".repeat(32)));
        let sig = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
        assert_eq!(explorer_tx("Solana", sig).unwrap(), format!("https://solscan.io/tx/{sig}"));
        assert!(explorer_tx("Arbitrum", &h).is_none());
        assert!(explorer_tx("TRC20", "not a hash").is_none());
    }

    #[test]
    fn references_are_normalised() {
        let h = "AB".repeat(32);
        assert_eq!(normalize_reference("crypto", Some("BEP20"), &h).unwrap(), (format!("0x{}", "ab".repeat(32)), "ab".repeat(32)));
        assert_eq!(normalize_reference("crypto", Some("TRC20"), &format!(" 0x{h} ")).unwrap(), ("ab".repeat(32), "ab".repeat(32)));
        assert!(normalize_reference("crypto", Some("TRC20"), "short").is_err());
        assert_eq!(normalize_reference("bank", None, " 4123 5678 9012 ").unwrap(), ("412356789012".into(), "412356789012".into()));
        assert_eq!(normalize_reference("bank", None, "hdfcR52026100912345").unwrap().1, "hdfcr52026100912345");
        assert!(normalize_reference("bank", None, "12").is_err());
        assert!(normalize_reference("bank", None, "<script>alert(1)</script>").is_err());
    }

    #[test]
    fn bank_and_crypto_details() {
        assert!(bank_details(&json!({})).is_err());
        let b = bank_details(&json!({"account_name": " Ezymex Ltd ", "ifsc": "hdfc0001234", "upi_id": "ezymex@hdfcbank", "iban": "ae07 0331 2345 6789 0123 456"})).unwrap();
        assert_eq!(b["account_name"], "Ezymex Ltd");
        assert_eq!(b["ifsc"], "HDFC0001234");
        assert_eq!(b["iban"], "AE070331234567890123456");
        assert!(bank_details(&json!({"upi_id": "nobank"})).is_err());
        assert!(bank_details(&json!({"account_name": "X Ltd", "ifsc": "HDFC1234567"})).is_err());
        let c = crypto_details(&json!({"network": "trc20", "address": "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ"})).unwrap();
        assert_eq!((c["network"].as_str(), c["token"].as_str()), (Some("TRC20"), Some("USDT")));
        assert!(crypto_details(&json!({"network": "TRC20", "address": "0x11e9373d598703F83582e34378E086EbEEC5da11"})).is_err());
        assert!(crypto_details(&json!({"network": "BEP20", "address": "0x11e9373d598703F83582e34378E086EbEEC5da11"})).is_ok());
        assert!(crypto_details(&json!({"network": "Arbitrum One", "address": "0x11e9373d598703F83582e34378E086EbEEC5da11", "token": "usdc"})).is_ok());
        let evm = evm_config(&json!({"chain_id": 56, "token_contract": "0x55d398326f99059fF775485246999027B3197955", "token_decimals": 18}), &json!({"address": "0x11e9373d598703F83582e34378E086EbEEC5da11"})).unwrap().unwrap();
        assert_eq!(evm["chain_id"], 56);
        let native = evm_config(&json!({"chain_id": "1"}), &json!({"address": "0x11e9373d598703F83582e34378E086EbEEC5da11"})).unwrap().unwrap();
        assert_eq!((native["token_contract"].is_null(), native["token_decimals"].as_u64()), (true, Some(18)));
        assert!(evm_config(&json!({"chain_id": 56}), &json!({"address": "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ"})).is_err());
    }

    #[test]
    fn csv_cells_are_safe() {
        assert_eq!(csv_cell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
        assert_eq!(csv_cell("a,b"), "\"a,b\"");
        assert_eq!(csv_cell("say \"hi\""), "\"say \"\"hi\"\"\"");
        assert_eq!(csv_cell("plain"), "plain");
    }
}
