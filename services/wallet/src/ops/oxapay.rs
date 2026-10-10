//! OxaPay crypto checkout.
//!
//! The third way money comes in, next to the automatic BEP20 / TRC20 deposits (`ops::deposits`, our own
//! addresses watched on chain) and the manual requests staff approve (`ops::manual`). Here OxaPay hosts the
//! checkout: the client asks for an invoice in USD, pays whichever coin they like on OxaPay's page, and
//! OxaPay calls our webhook. A paid invoice credits the wallet on its own — no staff step.
//!
//! The credit is an ordinary `crypto_deposit` ledger transaction, exactly like an approved manual crypto
//! payment, so wallet history, the funding rules (`ops::deposits::FUNDING_KINDS`) and the Back Office labels
//! need no new ledger kind. `oxapay_invoices` holds the provenance.
//!
//! **Trusting the callback.** The `HMAC` header proves the body came from OxaPay, but it is only ever used as
//! a trigger: before booking anything we ask OxaPay what the payment actually is
//! (`GET /v1/payment/{track_id}`) and credit from that answer. A replayed or malformed callback therefore
//! cannot move money, and the five delivery attempts OxaPay makes are all idempotent.
//!
//! **One merchant account.** The API key is platform-wide (`WALLET_OXAPAY_API_KEY`), so every tenant's
//! OxaPay deposits settle into the same OxaPay merchant account. A per-broker key belongs with the other
//! per-tenant payment settings and is a later step; until then a white-label broker should keep the module
//! off and use the manual methods.

use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::time::Duration;

use crate::api::paging;
use crate::error::{ApiError, ApiResult};
use crate::ledger::{self, Leg, NewTxn, PostError};
use crate::money::{D, WALLET_DP, check_amount, s, s_opt};
use crate::ops::notify;
use crate::state::{AppState, Ctx, StaffCtx};

/// Ledger kind of the credit. Deliberately the same kind as a staff-approved crypto payment.
const LEDGER_KIND: &str = "crypto_deposit";

/// How long we wait on OxaPay. Their create call sits in the client's request path.
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);

// ── OxaPay wire types ────────────────────────────────────────────────────────

/// Everything OxaPay returns is wrapped in this envelope.
#[derive(Deserialize)]
struct Envelope<T> {
    data: Option<T>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    error: Option<Value>,
}

#[derive(Deserialize)]
struct Invoice {
    track_id: Value,
    payment_url: Option<String>,
    #[serde(default)]
    expired_at: Option<i64>,
}

/// The authoritative payment, read back before crediting. Only the fields we act on are named.
#[derive(Deserialize)]
struct Payment {
    #[serde(default)]
    track_id: Value,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    order_id: Option<String>,
    #[serde(default)]
    txs: Vec<Tx>,
}

#[derive(Deserialize)]
struct Tx {
    #[serde(default)]
    tx_hash: Option<String>,
    #[serde(default)]
    currency: Option<String>,
    #[serde(default)]
    network: Option<String>,
    #[serde(default)]
    amount: Value,
}

/// OxaPay sends `track_id` as a number in some payloads and a string in others.
fn id_text(v: &Value) -> Option<String> {
    match v {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn num_text(v: &Value) -> Option<String> {
    match v {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

/// OxaPay's timestamps are Unix epochs; the docs do not say which unit, so accept either.
fn epoch(v: i64) -> Option<chrono::DateTime<chrono::Utc>> {
    if v.abs() > 100_000_000_000 { chrono::DateTime::from_timestamp_millis(v) } else { chrono::DateTime::from_timestamp(v, 0) }
}

/// Statuses that mean the money is OxaPay's to keep and ours to credit.
fn is_paid(status: &str) -> bool {
    matches!(status.trim().to_ascii_lowercase().as_str(), "paid" | "completed" | "complete")
}

/// Statuses that end the invoice without payment.
fn is_dead(status: &str) -> bool {
    matches!(status.trim().to_ascii_lowercase().as_str(), "expired" | "failed" | "cancelled" | "canceled")
}

// ── HTTP to OxaPay ───────────────────────────────────────────────────────────

fn http() -> Result<reqwest::Client, ApiError> {
    reqwest::Client::builder().timeout(HTTP_TIMEOUT).build().map_err(|e| ApiError::Internal(e.into()))
}

fn gateway_down(detail: &str) -> ApiError {
    tracing::warn!(detail, "oxapay call failed");
    ApiError::Coded {
        status: axum::http::StatusCode::SERVICE_UNAVAILABLE,
        code: "gateway_unavailable",
        message: "The crypto checkout is unavailable right now. Please try again shortly.".into(),
    }
}

async fn envelope<T: serde::de::DeserializeOwned>(res: reqwest::Response) -> Result<T, ApiError> {
    let status = res.status();
    let body = res.text().await.map_err(|e| gateway_down(&format!("body: {e}")))?;
    let env: Envelope<T> = serde_json::from_str(&body).map_err(|e| {
        // the body may carry an API key in an echo, so log the shape, never the text
        gateway_down(&format!("http {status}, undecodable response ({e})"))
    })?;
    match env.data {
        Some(d) if status.is_success() => Ok(d),
        _ => {
            let why = env.message.filter(|m| !m.is_empty()).or_else(|| env.error.as_ref().map(|e| e.to_string())).unwrap_or_else(|| format!("http {status}"));
            Err(gateway_down(&why))
        }
    }
}

// ── Webhook signature ────────────────────────────────────────────────────────

/// Hex HMAC-SHA512 of `body` under `key`, the scheme OxaPay signs callbacks with.
pub fn sign(key: &str, body: &[u8]) -> String {
    use hmac::{Hmac, KeyInit, Mac};
    use sha2::Sha512;
    let mut m = <Hmac<Sha512> as KeyInit>::new_from_slice(key.as_bytes()).expect("hmac takes any key length");
    m.update(body);
    m.finalize().into_bytes().iter().map(|b| format!("{b:02x}")).collect()
}

/// Constant-time, case-insensitive compare of the `HMAC` header against the expected signature.
pub fn signature_ok(key: &str, body: &[u8], header: &str) -> bool {
    use subtle::ConstantTimeEq;
    let expected = sign(key, body);
    let got = header.trim().to_ascii_lowercase();
    got.len() == expected.len() && bool::from(got.as_bytes().ct_eq(expected.as_bytes()))
}

// ── Client: open a checkout ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct NewInvoice {
    pub user_id: i64,
    #[serde(deserialize_with = "crate::money::de_dec")]
    pub amount: D,
    /// The public origin of the app the client is on, e.g. `https://app.ezymex.com`. The BFF forwards it so
    /// the callback and return links come back to that broker's own host.
    pub origin: String,
}

/// `https://host` with nothing else: the only shape we will hand OxaPay.
fn clean_origin(raw: &str) -> Result<String, ApiError> {
    let o = raw.trim().trim_end_matches('/');
    let bad = !o.starts_with("https://") || o.len() < 12 || o.len() > 200 || o[8..].contains('/') || o.contains([' ', '"', '\'', '\\', '?', '#']);
    if bad {
        return Err(ApiError::validation("origin", "origin must be an https:// host"));
    }
    Ok(o.to_string())
}

/// Creates an OxaPay invoice and returns the hosted checkout to send the client to.
pub async fn create(st: &AppState, ctx: &Ctx, n: NewInvoice) -> ApiResult<Value> {
    let cfg = &st.cfg;
    if !cfg.oxapay_enabled() {
        return Err(ApiError::unprocessable("method_unavailable", "Crypto checkout is not available."));
    }
    let t = ctx.tenant.id;
    let origin = clean_origin(&n.origin)?;
    let amount = check_amount(n.amount, 2).map_err(|m| ApiError::validation("amount", m))?;
    if amount < cfg.oxapay_min_usd {
        return Err(ApiError::unprocessable("below_minimum", format!("The minimum is {} USD", s(cfg.oxapay_min_usd))));
    }
    if amount > cfg.oxapay_max_usd {
        return Err(ApiError::unprocessable("above_maximum", format!("The maximum is {} USD", s(cfg.oxapay_max_usd))));
    }

    // deposits disabled for this client (Back Office restriction), as for every other deposit path; fail closed
    let user = st.users.get(&ctx.tenant.slug, n.user_id).await.map_err(|e| {
        tracing::warn!(error = %e, "gateway unavailable for the restriction check");
        ApiError::Coded { status: axum::http::StatusCode::SERVICE_UNAVAILABLE, code: "unavailable", message: "Your account status is unavailable. Please try again shortly.".into() }
    })?;
    if user.as_ref().is_some_and(|u| u.restrictions.iter().any(|k| k == "deposits")) {
        return Err(crate::users::restricted("deposits"));
    }

    // one open checkout at a time: an abandoned invoice is cheap, but a client with ten open ones cannot tell
    // which page to pay, and every one of them would credit on payment
    let open: i64 = sqlx::query_scalar("SELECT count(*) FROM oxapay_invoices WHERE tenant_id = $1 AND user_id = $2 AND status IN ('new', 'waiting', 'paying') AND (expires_at IS NULL OR expires_at > now())")
        .bind(t)
        .bind(n.user_id)
        .fetch_one(&st.pool)
        .await?;
    if open >= cfg.oxapay_max_open {
        return Err(ApiError::Coded {
            status: axum::http::StatusCode::TOO_MANY_REQUESTS,
            code: "too_many_open",
            message: "You already have a crypto checkout open. Finish or cancel it first.".into(),
        });
    }

    let order_id = crate::ops::random_id("ezx-");
    let row = sqlx::query(
        "INSERT INTO oxapay_invoices (tenant_id, user_id, order_id, amount, currency, status, ip, user_agent)
         VALUES ($1, $2, $3, $4, 'USD', 'new', $5, $6) RETURNING *",
    )
    .bind(t)
    .bind(n.user_id)
    .bind(&order_id)
    .bind(amount)
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .fetch_one(&st.pool)
    .await?;
    let id: i64 = row.get("id");

    let body = json!({
        "amount": s(amount),
        "currency": "USD",
        "lifetime": cfg.oxapay_lifetime_minutes,
        // no partial payments: `Paid` then means the full amount arrived, and we can credit what we asked for
        "under_paid_coverage": 0,
        "fee_paid_by_payer": if cfg.oxapay_fee_paid_by_payer { 1 } else { 0 },
        "to_currency": "USDT",
        "callback_url": format!("{origin}/api/wallet/oxapay/callback"),
        "return_url": format!("{origin}/wallet/deposit?checkout={order_id}"),
        "order_id": order_id,
        "description": format!("Ezymex wallet deposit · {order_id}"),
        "sandbox": cfg.oxapay_sandbox,
    });
    let res = http()?
        .post(format!("{}/v1/payment/invoice", cfg.oxapay_api_url))
        .header("merchant_api_key", &cfg.oxapay_api_key)
        .json(&body)
        .send()
        .await;
    let inv: Invoice = match res {
        Ok(r) => match envelope(r).await {
            Ok(v) => v,
            Err(e) => {
                let _ = sqlx::query("UPDATE oxapay_invoices SET status = 'failed', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await;
                return Err(e);
            }
        },
        Err(e) => {
            let _ = sqlx::query("UPDATE oxapay_invoices SET status = 'failed', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await;
            return Err(gateway_down(&format!("send: {e}")));
        }
    };
    let (track, url) = match (id_text(&inv.track_id), inv.payment_url.filter(|u| u.starts_with("https://"))) {
        (Some(t), Some(u)) => (t, u),
        _ => {
            let _ = sqlx::query("UPDATE oxapay_invoices SET status = 'failed', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await;
            return Err(gateway_down("no track_id or payment_url in the invoice"));
        }
    };
    let expires = inv.expired_at.and_then(epoch);
    let r = sqlx::query("UPDATE oxapay_invoices SET track_id = $2, payment_url = $3, expires_at = $4, status = 'waiting', updated_at = now() WHERE id = $1 RETURNING *")
        .bind(id)
        .bind(&track)
        .bind(&url)
        .bind(expires)
        .fetch_one(&st.pool)
        .await?;
    tracing::info!(tenant = t, user = n.user_id, invoice = id, track = %track, amount = %amount, "oxapay checkout opened");
    Ok(client_json(&r))
}

/// The client gives up on a checkout they never paid.
pub async fn cancel(st: &AppState, ctx: &Ctx, user_id: i64, id: i64) -> ApiResult<Value> {
    let t = ctx.tenant.id;
    let r = sqlx::query(
        "UPDATE oxapay_invoices SET status = 'cancelled', updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND user_id = $3 AND status IN ('new', 'waiting') RETURNING *",
    )
    .bind(t)
    .bind(id)
    .bind(user_id)
    .fetch_optional(&st.pool)
    .await?;
    match r {
        Some(r) => Ok(client_json(&r)),
        None => {
            let cur = sqlx::query("SELECT * FROM oxapay_invoices WHERE tenant_id = $1 AND id = $2 AND user_id = $3").bind(t).bind(id).bind(user_id).fetch_optional(&st.pool).await?;
            match cur {
                // paying: the money may already be on its way, so the invoice has to run its course
                Some(c) => Err(ApiError::conflict("invalid_state", format!("This checkout is {} and can't be cancelled", c.get::<String, _>("status")))),
                None => Err(ApiError::not_found("Checkout")),
            }
        }
    }
}

// ── Webhook ──────────────────────────────────────────────────────────────────

/// What the callback body has to tell us. Everything that decides money is read back from OxaPay instead.
#[derive(Deserialize)]
struct Callback {
    #[serde(default)]
    track_id: Value,
    #[serde(default)]
    status: Option<String>,
    #[serde(default, rename = "type")]
    kind: Option<String>,
    #[serde(default)]
    order_id: Option<String>,
}

/// Handles one callback delivery. Returns `Ok(())` whenever OxaPay should stop retrying, which includes
/// payloads we deliberately ignore (a payout callback, an invoice we do not know).
pub async fn callback(st: &AppState, raw: &[u8], header: Option<&str>) -> ApiResult<()> {
    let cfg = &st.cfg;
    if !cfg.oxapay_enabled() {
        return Err(ApiError::NotFound("Crypto checkout is not enabled".into()));
    }
    let Some(h) = header else {
        return Err(ApiError::Forbidden("Missing signature.".into()));
    };
    if !signature_ok(&cfg.oxapay_api_key, raw, h) {
        tracing::warn!(bytes = raw.len(), "oxapay callback with a bad signature");
        return Err(ApiError::Forbidden("Bad signature.".into()));
    }
    let cb: Callback = serde_json::from_slice(raw).map_err(|e| ApiError::BadRequest(format!("callback is not the expected JSON: {e}")))?;
    // payout callbacks are signed with the payout key and are not ours to act on
    if cb.kind.as_deref().is_some_and(|k| k.eq_ignore_ascii_case("payout")) {
        return Ok(());
    }
    let Some(track) = id_text(&cb.track_id) else {
        return Err(ApiError::BadRequest("callback has no track_id".into()));
    };
    // find our invoice, by track id or (for a callback that beat our own update) the order reference
    let row = match sqlx::query("SELECT * FROM oxapay_invoices WHERE track_id = $1").bind(&track).fetch_optional(&st.pool).await? {
        Some(r) => Some(r),
        None => match cb.order_id.as_deref().map(str::trim).filter(|o| !o.is_empty()) {
            Some(o) => sqlx::query("SELECT * FROM oxapay_invoices WHERE order_id = $1").bind(o).fetch_optional(&st.pool).await?,
            None => None,
        },
    };
    let Some(row) = row else {
        // not an invoice of ours: nothing to do, and no reason for OxaPay to keep retrying
        tracing::warn!(track = %track, "oxapay callback for an unknown invoice");
        return Ok(());
    };
    let id: i64 = row.get("id");
    if row.get::<String, _>("status") == "credited" {
        return Ok(());
    }
    // the callback said something happened; OxaPay itself says what
    let payment = fetch(st, &track).await?;
    settle(st, id, &track, payment, cb.status.as_deref()).await
}

/// Reads the authoritative payment. This, not the callback body, decides whether we credit.
async fn fetch(st: &AppState, track: &str) -> Result<Payment, ApiError> {
    let res = http()?
        .get(format!("{}/v1/payment/{}", st.cfg.oxapay_api_url, urlish(track)))
        .header("merchant_api_key", &st.cfg.oxapay_api_key)
        .send()
        .await
        .map_err(|e| gateway_down(&format!("send: {e}")))?;
    envelope(res).await
}

/// Track ids are OxaPay's own, but never interpolate something unchecked into a URL.
fn urlish(v: &str) -> String {
    v.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').take(80).collect()
}

/// Applies an authoritative payment to our invoice: credits it once, or records the end state.
async fn settle(st: &AppState, id: i64, track: &str, p: Payment, callback_status: Option<&str>) -> ApiResult<()> {
    let status = p.status.clone().or_else(|| callback_status.map(str::to_string)).unwrap_or_default();
    let raw = serde_json::to_value(json!({
        "track_id": id_text(&p.track_id),
        "status": p.status,
        "order_id": p.order_id,
        "txs": p.txs.iter().map(|t| json!({"tx_hash": t.tx_hash, "currency": t.currency, "network": t.network, "amount": num_text(&t.amount)})).collect::<Vec<_>>(),
        "seen_at": chrono::Utc::now(),
    }))
    .unwrap_or(Value::Null);

    if !is_paid(&status) {
        let next = if is_dead(&status) { "expired" } else { "paying" };
        sqlx::query("UPDATE oxapay_invoices SET status = $2, last_payment = $3, updated_at = now() WHERE id = $1 AND status NOT IN ('credited', 'cancelled')")
            .bind(id)
            .bind(next)
            .bind(sqlx::types::Json(&raw))
            .execute(&st.pool)
            .await?;
        tracing::info!(invoice = id, track, status = %status, "oxapay invoice not payable yet");
        return Ok(());
    }

    let tx0 = p.txs.first();
    let mut tx = st.pool.begin().await?;
    let cur = sqlx::query("SELECT * FROM oxapay_invoices WHERE id = $1 FOR UPDATE").bind(id).fetch_one(&mut *tx).await?;
    if cur.get::<String, _>("status") == "credited" {
        return Ok(());
    }
    let (t, user_id) = (cur.get::<i64, _>("tenant_id"), cur.get::<i64, _>("user_id"));
    let amount: D = cur.get("amount");
    let order_id: String = cur.get("order_id");
    // credited 1:1 against the USD we asked OxaPay for. `under_paid_coverage: 0` on the invoice means a paid
    // invoice is a fully paid one, so there is no second amount to reconcile against.
    let credit = crate::money::floor_dp(amount, WALLET_DP);
    let key = format!("oxapay:deposit:{t}:{track}");
    let posted = ledger::post(
        &mut tx,
        NewTxn {
            tenant_id: t,
            key: key.clone(),
            kind: LEDGER_KIND.into(),
            user_id: Some(user_id),
            currency: "USDT".into(),
            reference: Some(tx0.and_then(|x| x.tx_hash.clone()).unwrap_or_else(|| order_id.clone()).chars().take(128).collect()),
            note: Some(format!("OxaPay checkout · {} USD", s(amount))),
            actor: "service:oxapay".into(),
            request: Some(json!({"oxapay_invoice_id": id, "track_id": track})),
            legs: vec![Leg::available(user_id, "USDT", credit), Leg::sys("USDT", LEDGER_KIND, -credit)],
        },
    )
    .await;
    let txn = match posted {
        Ok(txn) => txn,
        Err(PostError::Duplicate) => {
            // an earlier delivery booked it and lost the row update: link that booking, never post again
            drop(tx);
            let txn: i64 = sqlx::query_scalar("SELECT id FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(t).bind(&key).fetch_one(&st.pool).await?;
            sqlx::query("UPDATE oxapay_invoices SET status = 'credited', credited = $2, ledger_txn_id = $3, credited_at = COALESCE(credited_at, now()), updated_at = now() WHERE id = $1 AND status <> 'credited'")
                .bind(id)
                .bind(credit)
                .bind(txn)
                .execute(&st.pool)
                .await?;
            return Ok(());
        }
        Err(e) => return Err(e.into()),
    };
    sqlx::query(
        "UPDATE oxapay_invoices SET status = 'credited', credited = $2, ledger_txn_id = $3, credited_at = now(),
                paid_currency = $4, paid_amount = $5, tx_hash = $6, network = $7, last_payment = $8, updated_at = now()
         WHERE id = $1",
    )
    .bind(id)
    .bind(credit)
    .bind(txn)
    .bind(tx0.and_then(|x| x.currency.clone()))
    .bind(tx0.and_then(|x| num_text(&x.amount)).and_then(|a| crate::money::parse(&a)))
    .bind(tx0.and_then(|x| x.tx_hash.clone()))
    .bind(tx0.and_then(|x| x.network.clone()))
    .bind(sqlx::types::Json(&raw))
    .execute(&mut *tx)
    .await?;
    crate::audit::system(&mut tx, t, "wallet.oxapay.credited", "oxapay_invoice", id.to_string(), Some(json!({"user_id": user_id, "credited": s(credit), "track_id": track, "ledger_txn_id": txn}))).await?;
    notify(
        &mut tx,
        t,
        user_id,
        "deposit.credited",
        "Crypto deposit credited",
        &format!("{} USDT was credited to your wallet from your crypto checkout.", s(credit)),
        json!({"oxapay_invoice_id": id, "kind": LEDGER_KIND, "amount": s(credit), "reference": order_id}),
    )
    .await?;
    tx.commit().await?;
    tracing::info!(tenant = t, user = user_id, invoice = id, track, credit = %credit, "oxapay deposit credited");
    Ok(())
}

/// Re-reads an invoice from OxaPay and applies whatever it says. Used by the client's "I have paid" poll and
/// by staff, so a lost callback never leaves money unbooked.
pub async fn refresh(st: &AppState, id: i64) -> ApiResult<()> {
    if !st.cfg.oxapay_enabled() {
        return Ok(());
    }
    let row = sqlx::query("SELECT track_id, status FROM oxapay_invoices WHERE id = $1").bind(id).fetch_optional(&st.pool).await?;
    let Some(row) = row else { return Ok(()) };
    if matches!(row.get::<String, _>("status").as_str(), "credited" | "cancelled") {
        return Ok(());
    }
    let Some(track) = row.get::<Option<String>, _>("track_id") else { return Ok(()) };
    match fetch(st, &track).await {
        Ok(p) => settle(st, id, &track, p, None).await,
        // a poll is best effort: the callback (5 attempts) is the reliable path
        Err(e) => {
            tracing::warn!(invoice = id, error = ?e, "oxapay refresh failed");
            Ok(())
        }
    }
}

// ── Reads ────────────────────────────────────────────────────────────────────

fn client_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "order_id": r.get::<String, _>("order_id"),
        "amount": s(r.get::<D, _>("amount")),
        "currency": r.get::<String, _>("currency"),
        "status": r.get::<String, _>("status"),
        "payment_url": r.get::<Option<String>, _>("payment_url"),
        "credited": s_opt(r.get::<Option<D>, _>("credited")),
        "tx_hash": r.get::<Option<String>, _>("tx_hash"),
        "network": r.get::<Option<String>, _>("network"),
        "paid_currency": r.get::<Option<String>, _>("paid_currency"),
        "expires_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("expires_at"),
        "credited_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("credited_at"),
        "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
    })
}

fn admin_json(r: &sqlx::postgres::PgRow) -> Value {
    let mut v = client_json(r);
    v["user_id"] = json!(r.get::<i64, _>("user_id"));
    v["track_id"] = json!(r.get::<Option<String>, _>("track_id"));
    v["paid_amount"] = s_opt(r.get::<Option<D>, _>("paid_amount"));
    v["ledger_txn_id"] = json!(r.get::<Option<i64>, _>("ledger_txn_id"));
    v["last_payment"] = r.get::<Option<sqlx::types::Json<Value>>, _>("last_payment").map(|j| j.0).unwrap_or(Value::Null);
    v["ip"] = json!(r.get::<Option<String>, _>("ip"));
    v
}

/// Marks invoices nobody paid before their lifetime ran out. Lazy: called from the client's own reads, so no
/// extra worker and no clock to keep.
async fn sweep(st: &AppState, t: i64, user_id: Option<i64>) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE oxapay_invoices SET status = 'expired', updated_at = now()
         WHERE tenant_id = $1 AND ($2::bigint IS NULL OR user_id = $2) AND status IN ('new', 'waiting')
           AND expires_at IS NOT NULL AND expires_at < now() - interval '10 minutes'",
    )
    .bind(t)
    .bind(user_id)
    .execute(&st.pool)
    .await?;
    Ok(())
}

pub async fn list(st: &AppState, ctx: &Ctx, user_id: i64, page: Option<i64>, limit: Option<i64>) -> ApiResult<Value> {
    let t = ctx.tenant.id;
    sweep(st, t, Some(user_id)).await?;
    let (page, limit, offset) = paging(page, limit, 20, 100);
    let rows = sqlx::query("SELECT * FROM oxapay_invoices WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT $3 OFFSET $4")
        .bind(t)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&st.pool)
        .await?;
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM oxapay_invoices WHERE tenant_id = $1 AND user_id = $2").bind(t).bind(user_id).fetch_one(&st.pool).await?;
    Ok(json!({"items": rows.iter().map(client_json).collect::<Vec<_>>(), "page": page, "limit": limit, "total": total,
              "enabled": st.cfg.oxapay_enabled(), "min_amount": s(st.cfg.oxapay_min_usd), "max_amount": s(st.cfg.oxapay_max_usd)}))
}

/// One checkout. `poll=true` asks OxaPay first, for the page the client lands on after paying.
pub async fn get(st: &AppState, ctx: &Ctx, user_id: i64, id: i64, poll: bool) -> ApiResult<Value> {
    let t = ctx.tenant.id;
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM oxapay_invoices WHERE tenant_id = $1 AND id = $2 AND user_id = $3").bind(t).bind(id).bind(user_id).fetch_optional(&st.pool).await?;
    let Some(id) = exists else { return Err(ApiError::not_found("Checkout")) };
    if poll {
        refresh(st, id).await?;
    }
    let r = sqlx::query("SELECT * FROM oxapay_invoices WHERE id = $1").bind(id).fetch_one(&st.pool).await?;
    Ok(client_json(&r))
}

#[derive(Deserialize)]
pub struct AdminQuery {
    pub status: Option<String>,
    pub user_id: Option<i64>,
    pub q: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn admin_list(st: &AppState, s_ctx: &StaffCtx, q: AdminQuery) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    sweep(st, t, None).await?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 200);
    let status = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty() && *s != "all").map(str::to_string);
    let search = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(|s| format!("%{}%", s.to_lowercase()));
    let where_sql = "WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) AND ($3::bigint IS NULL OR user_id = $3)
                       AND ($4::text IS NULL OR lower(order_id) LIKE $4 OR lower(COALESCE(track_id, '')) LIKE $4 OR lower(COALESCE(tx_hash, '')) LIKE $4)";
    let rows = sqlx::query(&format!("SELECT * FROM oxapay_invoices {where_sql} ORDER BY id DESC LIMIT $5 OFFSET $6"))
        .bind(t)
        .bind(&status)
        .bind(q.user_id)
        .bind(&search)
        .bind(limit)
        .bind(offset)
        .fetch_all(&st.pool)
        .await?;
    let total: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM oxapay_invoices {where_sql}")).bind(t).bind(&status).bind(q.user_id).bind(&search).fetch_one(&st.pool).await?;
    let counts = sqlx::query("SELECT status, count(*) AS n, COALESCE(sum(credited), 0) AS credited FROM oxapay_invoices WHERE tenant_id = $1 GROUP BY status").bind(t).fetch_all(&st.pool).await?;
    let mut by_status = serde_json::Map::new();
    let mut credited_total = D::ZERO;
    for c in &counts {
        by_status.insert(c.get::<String, _>("status"), json!(c.get::<i64, _>("n")));
        credited_total += c.get::<D, _>("credited");
    }
    Ok(json!({"items": rows.iter().map(admin_json).collect::<Vec<_>>(), "page": page, "limit": limit, "total": total,
              "counts": by_status, "credited_total": s(credited_total), "enabled": st.cfg.oxapay_enabled()}))
}

/// Staff ask OxaPay again for one checkout (a callback that never arrived).
pub async fn admin_recheck(st: &AppState, s_ctx: &StaffCtx, id: i64) -> ApiResult<Value> {
    let t = s_ctx.ctx.tenant.id;
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM oxapay_invoices WHERE tenant_id = $1 AND id = $2").bind(t).bind(id).fetch_optional(&st.pool).await?;
    let Some(id) = exists else { return Err(ApiError::not_found("Checkout")) };
    refresh(st, id).await?;
    let r = sqlx::query("SELECT * FROM oxapay_invoices WHERE id = $1").bind(id).fetch_one(&st.pool).await?;
    Ok(admin_json(&r))
}

#[cfg(test)]
mod tests {
    use super::*;

    // RFC 4231 test case 1 for HMAC-SHA512: the key and data are the standard ones, so a wrong digest or a
    // wrong key handling shows up here rather than on a live callback.
    #[test]
    fn hmac_matches_rfc_4231() {
        let got = sign(&"\x0b".repeat(20), b"Hi There");
        assert_eq!(
            got,
            "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854"
        );
    }

    #[test]
    fn signature_is_checked() {
        let key = "SEVAMW-TEST-KEY";
        let body = br#"{"track_id":"123","status":"Paid"}"#;
        let good = sign(key, body);
        assert!(signature_ok(key, body, &good));
        assert!(signature_ok(key, body, &good.to_uppercase()), "OxaPay's hex case must not matter");
        assert!(!signature_ok(key, body, &good[..good.len() - 1]), "a truncated signature is not a match");
        assert!(!signature_ok("other-key", body, &good));
        assert!(!signature_ok(key, br#"{"track_id":"123","status":"Paid "}"#, &good), "the body is covered");
        assert!(!signature_ok(key, body, ""));
    }

    #[test]
    fn statuses_are_read_case_insensitively() {
        for p in ["Paid", "paid", "COMPLETED"] {
            assert!(is_paid(p), "{p} means paid");
        }
        for p in ["Paying", "Waiting", "New", ""] {
            assert!(!is_paid(p), "{p} does not mean paid");
        }
        for d in ["Expired", "failed", "Cancelled"] {
            assert!(is_dead(d), "{d} ends the invoice");
        }
        assert!(!is_dead("Paying"));
    }

    #[test]
    fn track_ids_arrive_as_text_or_number() {
        assert_eq!(id_text(&json!("abc")), Some("abc".into()));
        assert_eq!(id_text(&json!(12345)), Some("12345".into()));
        assert_eq!(id_text(&json!("  x  ")), Some("x".into()));
        assert_eq!(id_text(&json!("")), None);
        assert_eq!(id_text(&Value::Null), None);
    }

    #[test]
    fn only_https_origins_are_accepted() {
        assert_eq!(clean_origin("https://app.ezymex.com/").unwrap(), "https://app.ezymex.com");
        assert_eq!(clean_origin(" https://my.broker.io ").unwrap(), "https://my.broker.io");
        for bad in ["http://app.ezymex.com", "https://a.com/path", "https://a.com?x=1", "ftp://a.com", "", "https://a.com\n"] {
            assert!(clean_origin(bad).is_err(), "{bad} must be refused");
        }
    }

    #[test]
    fn epochs_in_either_unit() {
        let secs = epoch(1_800_000_000).unwrap();
        let millis = epoch(1_800_000_000_000).unwrap();
        assert_eq!(secs, millis, "the same instant, written either way");
        assert!(epoch(0).is_some());
    }

    #[test]
    fn track_ids_cannot_escape_the_url() {
        assert_eq!(urlish("abc-123_X"), "abc-123_X");
        assert_eq!(urlish("../../v1/payout"), "v1payout");
        assert_eq!(urlish("a b/c?d=e"), "abcde");
    }
}
