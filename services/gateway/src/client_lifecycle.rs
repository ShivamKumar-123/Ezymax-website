//! Back Office client management: hide / unhide a client (test and spam accounts) and delete a client.
//!
//! **Hide** (`clients.write`, a reason) is an admin-view setting only: a hidden client is left out of the client
//! list, the Online now list and the client counts unless staff ask for hidden clients
//! (`GET /v1/admin/users?hidden=include|only`). The client can still sign in, trade and move money. Unhide (a
//! reason as well) clears it. Both are audited (`client.hidden`, `client.unhidden`).
//!
//! **Delete** (`clients.delete`: Platform Owner, Super Admin and Administrator by default) needs a reason and the
//! client's email typed as a confirmation. The preflight check (`GET .../delete-check`, run again by the delete
//! itself) asks the wallet and the trading engine (downstream.rs) and answers one of:
//! * `blocked` while the client holds money or risk: a wallet balance (available or locked), a pending deposit or
//!   an open withdrawal, a live account with balance / equity / credit / bonus, open positions or pending orders, a
//!   PAMM investment, a copy subscription, master followers or a MAM link, or a service that can't be reached
//!   (fail closed). Demo money never blocks.
//! * `purge` when the client never had financial activity: no wallet ledger entry, no deal and no ledger entry on
//!   a live account, nobody referred. The users row and every gateway row of the client (sessions, codes, trusted
//!   devices, step-up tokens, KYC, view-only logins, requests, restrictions, presence, suitability, marketing
//!   attribution, the referral link, trade-share links) are deleted in one transaction. A tombstone without
//!   personal data (`deleted_users`: id, referral code, sign-up time) makes `/v1/internal/referrals/users` tell the
//!   IB / reports / growth / support mirrors to scrub their copy.
//! * `anonymize` otherwise: the row and its id stay (the engine, wallet, IB and reports records reference it), the
//!   status becomes `closed`, the personal data is scrubbed (name "Deleted Client", email
//!   `deleted-<id>@deleted.invalid` so the address can register again, phone, date of birth, Google link, free-form
//!   attribution, marketing consent), the password can never match, sessions and view-only logins end, KYC files
//!   and rows are erased. The country, referral code and links stay for record-keeping.
//!
//! In both modes the client's trading accounts are archived first, as this staff member (engine staff archive,
//! reason `ARC-06`; demo accounts are emptied first; flat prop accounts are left to the prop service), so the
//! terminal refuses them too; if one can't be archived nothing is deleted. Financial history (engine, wallet,
//! IB, reports) and the gateway audit log are kept as AML record-keeping requires; the wallet keeps its zero-balance
//! rows.
//!
//! Routes:
//! * `POST /v1/admin/users/{id}/hide`           `{reason}`
//! * `POST /v1/admin/users/{id}/unhide`         `{reason}`
//! * `GET  /v1/admin/users/{id}/delete-check`   → `{client, mode, blockers[], history[], activity, archive[]}`
//! * `POST /v1/admin/users/{id}/delete`         `{reason, confirm_email, mode}` → `{mode, summary}`; 409
//!   `delete_blocked` / `mode_changed` (with the fresh `check`), 502 `archive_failed`

use axum::Json;
use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use crate::admin::{Staff, require_key};
use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::client_controls::clean_reason;
use crate::error::{ApiError, ApiResult};
use crate::state::{AppState, Ctx};

mod downstream;
pub use downstream::{Account, EngineStaff, Finance, TradingFacts, WalletFacts};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Purge,
    Anonymize,
    Blocked,
}

impl Mode {
    pub fn as_str(self) -> &'static str {
        match self {
            Mode::Purge => "purge",
            Mode::Anonymize => "anonymize",
            Mode::Blocked => "blocked",
        }
    }
    pub fn parse(raw: &str) -> Option<Mode> {
        [Mode::Purge, Mode::Anonymize, Mode::Blocked].into_iter().find(|m| m.as_str() == raw.trim())
    }
}

fn already_deleted() -> ApiError {
    ApiError::Coded { status: StatusCode::CONFLICT, code: "already_deleted", message: "This client was already deleted." }
}

/// `{error: {code, message, ...extra}}` with a status, for answers that carry more than a message.
fn refusal(status: StatusCode, code: &str, message: String, extra: Value) -> (StatusCode, Json<Value>) {
    let mut e = json!({ "code": code, "message": message });
    if let (Value::Object(o), Value::Object(x)) = (&mut e, extra) {
        o.extend(x);
    }
    (status, Json(json!({ "error": e })))
}

// ---------- hide / unhide ----------

#[derive(Deserialize)]
pub struct ReasonReq {
    #[serde(default)]
    reason: String,
}

pub async fn hide(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<ReasonReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "clients.write").await?;
    set_hidden(&st, &ctx, &me, id, true, &clean_reason(&r.reason)?).await
}

pub async fn unhide(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<ReasonReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "clients.write").await?;
    set_hidden(&st, &ctx, &me, id, false, &clean_reason(&r.reason)?).await
}

async fn set_hidden(st: &AppState, ctx: &Ctx, me: &Staff, id: i64, hide: bool, reason: &str) -> ApiResult<Json<Value>> {
    let mut tx = crate::domains::tenant_tx(&st.pool, me.tenant_id).await?;
    let cur = sqlx::query("SELECT hidden_at IS NOT NULL AS hidden, deleted_at IS NOT NULL AS deleted FROM users WHERE id = $1 AND tenant_id = $2 AND NOT is_house FOR UPDATE")
        .bind(id)
        .bind(me.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(ApiError::NotFound)?;
    if cur.get::<bool, _>("deleted") {
        return Err(already_deleted());
    }
    let before: bool = cur.get("hidden");
    if before == hide {
        return Ok(Json(json!({ "status": "ok", "hidden": hide, "changed": false })));
    }
    // updated_at moves so the internal user feed sends the new flag to the mirrors
    sqlx::query(
        "UPDATE users SET hidden_at = CASE WHEN $3 THEN now() END, hidden_by = CASE WHEN $3 THEN $4 END,
                hidden_reason = CASE WHEN $3 THEN $5 END, updated_at = now()
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(me.tenant_id)
    .bind(hide)
    .bind(me.id)
    .bind(reason)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    audit::record(&st.pool, ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: if hide { "client.hidden" } else { "client.unhidden" },
        target: Some(("user", id)),
        meta: json!({ "reason": reason, "before": { "hidden": before }, "after": { "hidden": hide } }),
    })
    .await;
    Ok(Json(json!({ "status": "ok", "hidden": hide, "changed": true })))
}

// ---------- delete check ----------

/// What the gateway itself knows about the client.
pub struct Target {
    pub id: i64,
    pub tenant_slug: String,
    pub email: String,
    pub name: String,
    pub status: String,
    pub kyc_status: String,
    pub hidden: bool,
    pub deleted: bool,
    pub referrals: i64,
    pub kyc_documents: i64,
    pub active_sessions: i64,
    pub viewers: i64,
}

async fn target(st: &AppState, tenant_id: i64, id: i64) -> ApiResult<Target> {
    let mut tx = crate::domains::tenant_tx(&st.pool, tenant_id).await?;
    let r = sqlx::query(
        "SELECT u.id, t.slug, u.email, u.first_name || ' ' || u.last_name AS name, u.status, u.kyc_status,
                u.hidden_at IS NOT NULL AS hidden, u.deleted_at IS NOT NULL AS deleted,
                (SELECT count(*) FROM users r WHERE r.referred_by = u.id) AS referrals,
                (SELECT count(*) FROM kyc_documents d WHERE d.user_id = u.id) AS kyc_documents,
                (SELECT count(*) FROM sessions se WHERE se.subject_kind = 'user' AND se.subject_id = u.id AND se.revoked_at IS NULL AND se.expires_at > now()) AS sessions,
                (SELECT count(*) FROM client_viewers v WHERE v.user_id = u.id AND v.revoked_at IS NULL) AS viewers
         FROM users u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.id = $1 AND u.tenant_id = $2 AND NOT u.is_house",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    tx.commit().await?;
    Ok(Target {
        id,
        tenant_slug: r.get("slug"),
        email: r.get("email"),
        name: r.get("name"),
        status: r.get("status"),
        kyc_status: r.get("kyc_status"),
        hidden: r.get("hidden"),
        deleted: r.get("deleted"),
        referrals: r.get("referrals"),
        kyc_documents: r.get("kyc_documents"),
        active_sessions: r.get("sessions"),
        viewers: r.get("viewers"),
    })
}

/// A decimal string other than zero ("0", "0.000000"); anything unreadable counts as money (fail closed).
fn nonzero(s: &str) -> bool {
    s.trim().parse::<f64>().map(|v| v != 0.0).unwrap_or(true)
}

fn plural(n: impl Into<i64>, one: &str, many: &str) -> String {
    let n = n.into();
    format!("{n} {}", if n == 1 { one } else { many })
}

fn amount(v: f64) -> String {
    format!("{v:.2}")
}

/// Engine archive blockers that don't stop a deletion: the account is already retired, or a prop account
/// (flat ones are left to the prop service; one with money is blocked by its balance).
const IGNORED_ENGINE_BLOCKERS: &[&str] = &["already_archived", "closed", "prop_account"];

/// The verdict of a delete check.
pub struct Check {
    pub mode: Mode,
    /// (code, message)
    pub blockers: Vec<(&'static str, String)>,
    /// Why the client can't be purged (empty for `purge`).
    pub history: Vec<String>,
    /// Accounts the delete archives first.
    pub archive: Vec<Account>,
    /// Flat prop accounts left as they are.
    pub skipped: Vec<i64>,
    /// Every trading account of the client (their trade-share links go with the client).
    pub logins: Vec<i64>,
    pub activity: Value,
}

impl Check {
    pub fn json(&self, t: &Target) -> Value {
        json!({
            "client": { "id": t.id, "email": t.email, "name": t.name, "status": t.status, "hidden": t.hidden },
            "mode": self.mode.as_str(),
            "blockers": self.blockers.iter().map(|(c, m)| json!({ "code": c, "message": m })).collect::<Vec<_>>(),
            "history": self.history,
            "archive": self.archive.iter().map(|a| a.login).collect::<Vec<_>>(),
            "skipped": self.skipped,
            "activity": self.activity,
            "checked_at": Utc::now(),
        })
    }
}

/// Pure rules: the gateway's facts plus what the wallet and the engine answered (or why they couldn't).
pub fn decide(t: &Target, wallet: &Result<WalletFacts, String>, trading: &Result<TradingFacts, String>) -> Check {
    let mut blockers: Vec<(&'static str, String)> = Vec::new();
    let mut history: Vec<String> = Vec::new();
    match wallet {
        Ok(w) => {
            for b in w.balances.iter().filter(|b| nonzero(&b.available) || nonzero(&b.locked)) {
                blockers.push(("wallet_balance", format!("The wallet holds {} (available {}, locked {}). Bring it to zero first.", b.currency, b.available, b.locked)));
            }
            if w.pending_deposits > 0 {
                let it = if w.pending_deposits == 1 { "it" } else { "them" };
                blockers.push(("pending_deposit", format!("{} still being processed. Credit or reject {it} first.", plural(w.pending_deposits as i64, "deposit is", "deposits are"))));
            }
            if w.open_withdrawals > 0 {
                let it = if w.open_withdrawals == 1 { "it" } else { "them" };
                blockers.push(("open_withdrawal", format!("{} still open. Complete, reject or cancel {it} first.", plural(w.open_withdrawals as i64, "withdrawal is", "withdrawals are"))));
            }
            if w.ledger_entries > 0 {
                history.push(format!("Wallet: {}", plural(w.ledger_entries, "transaction", "transactions")));
            }
        }
        Err(e) => blockers.push(("wallet_unavailable", format!("Couldn't check the wallet: {e}. Try again shortly."))),
    }
    let (mut archive, mut skipped) = (Vec::new(), Vec::new());
    match trading {
        Ok(tf) => {
            for a in &tf.accounts {
                if a.live && a.holds_money() {
                    let mut parts = vec![format!("balance {}", amount(a.balance)), format!("equity {}", amount(a.equity)), format!("credit {}", amount(a.credit))];
                    if a.bonus != 0.0 {
                        parts.push(format!("bonus {}", amount(a.bonus)));
                    }
                    blockers.push(("account_balance", format!("Live account #{} holds money ({} {}). Bring it to zero first.", a.login, parts.join(", "), a.currency)));
                }
                if a.live && a.positions > 0 {
                    blockers.push(("open_positions", format!("Live account #{} has {}.", a.login, plural(a.positions, "open position", "open positions"))));
                }
                if a.live && a.orders > 0 {
                    blockers.push(("pending_orders", format!("Live account #{} has {}.", a.login, plural(a.orders, "pending order", "pending orders"))));
                }
                for (code, msg) in a.engine_blockers.iter().filter(|(c, _)| !IGNORED_ENGINE_BLOCKERS.contains(&c.as_str())) {
                    let code = match code.as_str() {
                        "copy_subscription" => "copy_subscription",
                        "master_followers" => "master_followers",
                        "pamm_fund" => "pamm_fund",
                        "mam_link" => "mam_link",
                        _ => "account_blocked",
                    };
                    blockers.push((code, format!("Account #{}: {msg}", a.login)));
                }
                if a.live && (a.deals > 0 || a.ledger_entries > 0) {
                    history.push(format!("Live account #{}: {}, {}", a.login, plural(a.deals, "deal", "deals"), plural(a.ledger_entries, "ledger entry", "ledger entries")));
                }
                if a.retired() {
                    continue;
                }
                if a.prop() && !a.holds_money() && a.positions == 0 && a.orders == 0 {
                    skipped.push(a.login);
                } else {
                    archive.push(a.clone());
                }
            }
            for i in tf.investments.iter().filter(|i| i.value != 0.0 || i.pending_requests > 0) {
                let pending = if i.pending_requests > 0 { format!(", {}", plural(i.pending_requests as i64, "pending request", "pending requests")) } else { String::new() };
                blockers.push(("pamm_investment", format!("PAMM investment in {}: {} USD{pending}. Redeem it first.", i.fund, amount(i.value))));
            }
        }
        Err(e) => blockers.push(("engine_unavailable", format!("Couldn't check the trading accounts: {e}. Try again shortly."))),
    }
    if t.referrals > 0 {
        history.push(format!("Referred {}", plural(t.referrals, "client", "clients")));
    }
    let mode = if !blockers.is_empty() {
        Mode::Blocked
    } else if !history.is_empty() {
        Mode::Anonymize
    } else {
        Mode::Purge
    };
    let activity = json!({
        "wallet": wallet.as_ref().ok().map(|w| json!({
            "balances": w.balances.iter().map(|b| json!({ "currency": b.currency, "available": b.available, "locked": b.locked })).collect::<Vec<_>>(),
            "ledger_entries": w.ledger_entries,
            "pending_deposits": w.pending_deposits,
            "open_withdrawals": w.open_withdrawals,
        })),
        "trading": trading.as_ref().ok().map(|tf| json!({
            "accounts": tf.accounts.iter().map(|a| json!({
                "login": a.login, "type": if a.live { "live" } else { "demo" }, "status": a.status, "group": a.group, "currency": a.currency,
                "balance": a.balance, "equity": a.equity, "credit": a.credit, "positions": a.positions, "orders": a.orders,
                "deals": a.deals, "ledger_entries": a.ledger_entries,
            })).collect::<Vec<_>>(),
            "pamm_investments": tf.investments.len(),
        })),
        "referrals": t.referrals,
        "kyc_documents": t.kyc_documents,
        "active_sessions": t.active_sessions,
        "viewers": t.viewers,
    });
    let logins = trading.as_ref().map(|tf| tf.accounts.iter().map(|a| a.login).collect()).unwrap_or_default();
    Check { mode, blockers, history, archive, skipped, logins, activity }
}

pub async fn check_with<F: Finance>(t: &Target, f: &F) -> Check {
    let (wallet, trading) = tokio::join!(f.wallet(&t.tenant_slug, t.id), f.trading(&t.tenant_slug, t.id));
    decide(t, &wallet, &trading)
}

pub async fn delete_check(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let me = require_key(&st, &ctx, "clients.delete").await?;
    check_route(&st, &me, id, downstream::http()).await
}

pub async fn check_route<F: Finance>(st: &AppState, me: &Staff, id: i64, f: &F) -> ApiResult<Json<Value>> {
    let t = target(st, me.tenant_id, id).await?;
    if t.deleted {
        return Err(already_deleted());
    }
    Ok(Json(check_with(&t, f).await.json(&t)))
}

// ---------- delete ----------

#[derive(Deserialize, Default)]
pub struct DeleteReq {
    #[serde(default)]
    pub reason: String,
    /// The client's email, typed by the staff member.
    #[serde(default)]
    pub confirm_email: String,
    /// The mode the staff member saw in the check (`purge` / `anonymize`); a different verdict now is refused.
    #[serde(default)]
    pub mode: String,
}

pub async fn delete(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<DeleteReq>, JsonRejection>) -> ApiResult<(StatusCode, Json<Value>)> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "clients.delete").await?;
    delete_with(&st, &ctx, &me, id, r, downstream::http()).await
}

/// The role the engine sees for the archive. The gateway already checked `clients.delete`, which includes
/// archiving the client's accounts; a role the engine doesn't know as a dealing role is sent as `admin`.
fn engine_role(me: &Staff) -> String {
    let r = crate::rbac::service_role(&me.role, &me.perms);
    if ["platform_owner", "super_admin", "admin", "dealer", "risk_manager"].contains(&r) { r.to_string() } else { "admin".to_string() }
}

pub async fn delete_with<F: Finance>(st: &AppState, ctx: &Ctx, me: &Staff, id: i64, r: DeleteReq, f: &F) -> ApiResult<(StatusCode, Json<Value>)> {
    let reason = clean_reason(&r.reason)?;
    let expected = Mode::parse(&r.mode).filter(|m| *m != Mode::Blocked).ok_or(ApiError::Validation { field: "mode", message: "Run the delete check first." })?;
    let t = target(st, me.tenant_id, id).await?;
    if t.deleted {
        return Err(already_deleted());
    }
    if r.confirm_email.trim().to_lowercase() != t.email {
        return Err(ApiError::Validation { field: "confirm_email", message: "Type the client's email address exactly to confirm." });
    }
    let c = check_with(&t, f).await;
    if c.mode == Mode::Blocked {
        return Ok(refusal(StatusCode::CONFLICT, "delete_blocked", "This client can't be deleted yet.".into(), json!({ "check": c.json(&t) })));
    }
    if c.mode != expected {
        let msg = format!("The client's activity changed since the check: the delete would now {}. Review it and confirm again.", if c.mode == Mode::Purge { "be permanent" } else { "keep the financial records" });
        return Ok(refusal(StatusCode::CONFLICT, "mode_changed", msg, json!({ "check": c.json(&t) })));
    }

    // 1. trading accounts: archived first, so a refusal leaves the client untouched
    let name: String = sqlx::query_scalar("SELECT name FROM staff WHERE id = $1").bind(me.id).fetch_optional(&st.pool).await?.unwrap_or_else(|| format!("Staff {}", me.id));
    let staff = EngineStaff { id: me.id, name, role: engine_role(me) };
    let note = format!("Client #{id} deleted in the Back Office ({}).", c.mode.as_str());
    let mut archived = Vec::new();
    for a in &c.archive {
        if let Err(e) = f.archive(&t.tenant_slug, &staff, a, &note).await {
            let msg = format!("Couldn't archive trading account #{}: {e}. Nothing was deleted.", a.login);
            return Ok(refusal(StatusCode::BAD_GATEWAY, "archive_failed", msg, json!({ "archived": archived })));
        }
        archived.push(a.login);
    }

    // 2. the gateway rows, in one tenant-scoped transaction; KYC files go once it committed
    let files = crate::kyc::user_files(&st.pool, id).await?;
    let logins: Vec<String> = c.logins.iter().map(i64::to_string).collect();
    let mut tx = crate::domains::tenant_tx(&st.pool, me.tenant_id).await?;
    let locked: Option<bool> = sqlx::query_scalar("SELECT deleted_at IS NOT NULL FROM users WHERE id = $1 AND tenant_id = $2 AND NOT is_house FOR UPDATE")
        .bind(id)
        .bind(me.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
    match locked {
        None => return Err(ApiError::NotFound),
        Some(true) => return Err(already_deleted()),
        Some(false) => {}
    }
    let k = sqlx::query(
        "SELECT (SELECT count(*) FROM kyc_cases WHERE user_id = $1) AS kyc_cases, (SELECT count(*) FROM kyc_documents WHERE user_id = $1) AS kyc_documents",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    let exec = |sql: &'static str| sqlx::query(sql).bind(id);
    let mut removed = json!({ "kyc_cases": k.get::<i64, _>("kyc_cases"), "kyc_documents": k.get::<i64, _>("kyc_documents") });
    removed["trade_shares"] = json!(sqlx::query("DELETE FROM trade_shares WHERE tenant_id = $1 AND login = ANY($2)").bind(me.tenant_id).bind(&logins).execute(&mut *tx).await?.rows_affected());
    removed["trusted_devices"] = json!(exec("DELETE FROM trusted_devices WHERE subject_kind = 'user' AND subject_id = $1").execute(&mut *tx).await?.rows_affected());
    exec("DELETE FROM email_otps WHERE subject_kind = 'user' AND subject_id = $1").execute(&mut *tx).await?;
    exec("DELETE FROM stepup_tokens WHERE user_id = $1").execute(&mut *tx).await?;
    if c.mode == Mode::Purge {
        removed["sessions"] = json!(exec("DELETE FROM sessions WHERE subject_kind = 'user' AND subject_id = $1").execute(&mut *tx).await?.rows_affected());
        removed["viewers"] = json!(sqlx::query_scalar::<_, i64>("SELECT count(*) FROM client_viewers WHERE user_id = $1").bind(id).fetch_one(&mut *tx).await?);
        // a referee loses the link with the delete (ON DELETE SET NULL); the feed sends them again
        exec("UPDATE users SET updated_at = now() WHERE referred_by = $1").execute(&mut *tx).await?;
        sqlx::query("INSERT INTO deleted_users (id, tenant_id, referral_code, created_at, deleted_by) SELECT id, tenant_id, referral_code, created_at, $2 FROM users WHERE id = $1")
            .bind(id)
            .bind(me.id)
            .execute(&mut *tx)
            .await?;
        // cascades: KYC cases (documents, events, notes), view-only logins, requests, restrictions, presence,
        // staff-session tickets, suitability
        exec("DELETE FROM users WHERE id = $1").execute(&mut *tx).await?;
    } else {
        // D92 locks name and date of birth once identity is verified; erasure is the deliberate exception
        sqlx::query("SELECT set_config('ezymex.identity_unlock', 'on', true)").execute(&mut *tx).await?;
        sqlx::query(
            "UPDATE users SET email = 'deleted-' || id || '@deleted.invalid', first_name = 'Deleted', last_name = 'Client', phone_dial = '', phone = '',
                    date_of_birth = DATE '1900-01-01', password_hash = '!deleted-no-login', google_sub = NULL, google_linked_at = NULL, avatar_url = NULL,
                    utm_term = NULL, utm_content = NULL, landing_page = NULL, first_referrer = NULL, marketing_consent = false,
                    marketing_unsubscribed_at = COALESCE(marketing_unsubscribed_at, now()), status = 'closed', failed_logins = 0, locked_until = NULL, last_active_at = NULL,
                    deleted_at = now(), deleted_by = $2, deleted_reason = $3, updated_at = now()
             WHERE id = $1",
        )
        .bind(id)
        .bind(me.id)
        .bind(&reason)
        .execute(&mut *tx)
        .await?;
        removed["sessions"] = json!(exec("UPDATE sessions SET revoked_at = now() WHERE subject_kind = 'user' AND subject_id = $1 AND revoked_at IS NULL").execute(&mut *tx).await?.rows_affected());
        removed["viewers"] = json!(exec("UPDATE client_viewers SET revoked_at = now(), updated_at = now() WHERE user_id = $1 AND revoked_at IS NULL").execute(&mut *tx).await?.rows_affected());
        exec("DELETE FROM kyc_cases WHERE user_id = $1").execute(&mut *tx).await?;
        exec("DELETE FROM client_presence WHERE user_id = $1").execute(&mut *tx).await?;
        exec("DELETE FROM impersonation_tickets WHERE user_id = $1").execute(&mut *tx).await?;
        sqlx::query(
            "UPDATE client_requests SET status = CASE kind WHEN 'closure' THEN 'completed' ELSE 'cancelled' END,
                    staff_note = COALESCE(staff_note, 'Client deleted in the Back Office.'), handled_by = $2, closed_at = now(), updated_at = now()
             WHERE user_id = $1 AND status IN ('open', 'in_progress')",
        )
        .bind(id)
        .bind(me.id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    let kyc_files = match crate::kyc::remove_files(&files) {
        Ok(n) => json!(n),
        Err(e) => {
            tracing::error!(user = id, error = %e, "KYC files of a deleted client could not all be removed");
            json!({ "error": "Some KYC files could not be removed from disk; see the gateway log." })
        }
    };
    removed["kyc_files"] = kyc_files;

    let summary = json!({
        "removed": removed,
        "accounts_archived": archived,
        "accounts_skipped": c.skipped,
        "history": c.history,
    });
    audit::record(&st.pool, ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "client.deleted",
        target: Some(("user", id)),
        meta: json!({
            "mode": c.mode.as_str(),
            "reason": reason,
            "before": { "status": t.status, "kyc_status": t.kyc_status, "hidden": t.hidden },
            "after": { "status": if c.mode == Mode::Purge { "purged" } else { "closed" } },
            "summary": summary,
        }),
    })
    .await;
    Ok((StatusCode::OK, Json(json!({ "status": "ok", "mode": c.mode.as_str(), "user_id": id, "summary": summary }))))
}

#[cfg(test)]
mod tests;
