//! Client Area account lifecycle (B1–B8): archive check, archive (with the optional "empty first" steps:
//! close trades and cancel orders, move the withdrawable balance to the wallet), restore and rename. Called by
//! the CRM BFF with the signed-in gateway user id in `X-Kalks-User-Id` (or `?user_id=`), like the other
//! `/v1/accounts` routes; an account the user does not own is a 404.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use serde::Deserialize;
use serde_json::{Value, json};

use super::accounts::{UserQ, owned, user_of};
use super::{ApiError, ApiResult, AppState, Body, Ctx};
use crate::engine::trade::{self, BulkFilter};
use crate::engine::{Reject, funds, metrics};
use crate::model::{AccountKind, Status};
use crate::money::{D, ZERO, num};
use crate::shard::{ExecError, Op};

/// What the archive wizard needs to know about one account.
#[derive(Clone, Debug)]
pub struct Check {
    pub login: i64,
    pub kind: AccountKind,
    pub status: Status,
    pub group: String,
    pub positions: usize,
    pub orders: usize,
    pub balance: D,
    pub credit: D,
    pub bonus: D,
    /// Withdrawable, in USD (cent accounts divided by 100).
    pub withdrawable_usd: D,
    pub version: i64,
    pub blockers: Vec<(&'static str, String)>,
}

impl Check {
    /// Something must be closed or moved out before the account can be archived.
    pub fn needs_empty(&self) -> bool {
        self.positions > 0 || self.orders > 0 || (self.kind == AccountKind::Live && crate::social::copier::returnable(self.withdrawable_usd) > ZERO)
    }
    pub fn json(&self) -> Value {
        json!({
            "login": self.login,
            "kind": self.kind.as_str(),
            "status": self.status.as_str(),
            "positions": self.positions,
            "orders": self.orders,
            "balance": num(self.balance),
            "credit": num(self.credit),
            "bonus": num(self.bonus),
            "canArchive": self.blockers.is_empty(),
            "needsEmpty": self.needs_empty(),
            "blockers": self.blockers.iter().map(|(c, m)| json!({"code": c, "message": m})).collect::<Vec<_>>(),
        })
    }
}

/// Reads the account and lists what blocks archiving it (copy / master / PAMM / MAM / prop, already retired).
pub async fn check(st: &AppState, login: i64) -> ApiResult<Check> {
    let v = st
        .hub
        .read(
            login,
            Box::new(|x| match x {
                Some((a, env)) => {
                    let m = metrics(env, a);
                    let f = a.account.usd_factor();
                    json!({
                        "kind": a.account.kind.as_str(), "status": a.account.status.as_str(), "group": a.account.group,
                        "positions": a.positions.len(), "orders": a.orders.len(), "balance": a.balance.to_string(),
                        "credit": a.credit.to_string(), "bonus": a.bonus.to_string(),
                        "withdrawableUsd": (m.withdrawable() / f).to_string(), "version": a.version,
                    })
                }
                None => Value::Null,
            }),
        )
        .await;
    if v.is_null() {
        return Err(ApiError::NotFound("Account not found".into()));
    }
    let dec = |k: &str| v[k].as_str().and_then(|s| s.parse::<D>().ok()).unwrap_or(ZERO);
    let kind = if v["kind"] == "live" { AccountKind::Live } else { AccountKind::Demo };
    let status = v["status"].as_str().and_then(Status::parse).unwrap_or(Status::Active);
    let group = v["group"].as_str().unwrap_or("").to_string();
    let mut blockers: Vec<(&'static str, String)> = Vec::new();
    match status {
        Status::Archived => blockers.push(("already_archived", "This account is already archived".into())),
        Status::Closed => blockers.push(("closed", "This account is closed".into())),
        _ => {}
    }
    {
        let reg = st.social.reg.read().unwrap();
        if reg.sub_by_login(login).is_some_and(|s| s.copying()) {
            blockers.push(("copy_subscription", "This account is copying a master. Stop copying first (Social → My subscriptions).".into()));
        }
        if let Some(m) = reg.master_by_login(login) {
            let n = reg.subs_of(m.id).len();
            if n > 0 {
                blockers.push(("master_followers", format!("This is a master account with {n} follower(s). Stop offering copy trading first.")));
            }
        }
        if reg.fund_by_login(login).is_some() {
            blockers.push(("pamm_fund", "This is a PAMM fund account and cannot be archived here.".into()));
        }
        if reg.managers.values().any(|m| m.login == login) || reg.links.values().any(|l| l.login == login && l.status == "active") {
            blockers.push(("mam_link", "This account is part of a MAM. Leave the MAM first.".into()));
        }
    }
    if group.to_ascii_lowercase().starts_with("prop") {
        blockers.push(("prop_account", "Prop challenge accounts cannot be archived.".into()));
    }
    Ok(Check {
        login,
        kind,
        status,
        group,
        positions: v["positions"].as_u64().unwrap_or(0) as usize,
        orders: v["orders"].as_u64().unwrap_or(0) as usize,
        balance: dec("balance"),
        credit: dec("credit"),
        bonus: dec("bonus"),
        withdrawable_usd: dec("withdrawableUsd"),
        version: v["version"].as_i64().unwrap_or(0),
        blockers,
    })
}

pub async fn archive_check(State(st): State<AppState>, ctx: Ctx, headers: HeaderMap, Path(login): Path<i64>, Query(q): Query<UserQ>) -> ApiResult<Json<Value>> {
    let user = user_of(&headers, q.user_id)?;
    owned(&st, &ctx, login, user)?;
    Ok(Json(check(&st, login).await?.json()))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveReq {
    #[serde(default)]
    pub empty: bool,
    #[serde(default)]
    pub ack_forfeit: bool,
}

fn step(name: &str, ok: bool, detail: impl Into<String>) -> Value {
    json!({"step": name, "ok": ok, "detail": detail.into()})
}

fn exec_err(e: ExecError) -> String {
    match e {
        ExecError::Reject(r) => r.message,
        other => format!("{other:?}"),
    }
}

/// Cancels every pending order and closes every position as the client, all or nothing.
pub fn close_everything(tx: &mut crate::engine::Tx, env: &crate::engine::Env) -> Result<Value, Reject> {
    let orders: Vec<i64> = tx.st.orders.keys().copied().collect();
    for t in &orders {
        trade::cancel_order(tx, env, *t, "account archived")?;
    }
    let out = trade::bulk_close(tx, env, BulkFilter::All, None);
    if let Some((t, e)) = out.failed.first() {
        return Err(Reject::new("close_failed", format!("Position #{t} could not be closed: {e}")));
    }
    Ok(json!({"closed": out.done.len(), "cancelled": orders.len(), "profit": num(out.profit)}))
}

/// The archive stepper. Steps that ran are reported even when a later one fails (the account then stays as
/// it was, only emptied). Archiving an archived account is a no-op success.
pub async fn archive(State(st): State<AppState>, ctx: Ctx, headers: HeaderMap, Path(login): Path<i64>, Query(q): Query<UserQ>, Body(r): Body<ArchiveReq>) -> ApiResult<Json<Value>> {
    let user = user_of(&headers, q.user_id)?;
    owned(&st, &ctx, login, user)?;
    let c = check(&st, login).await?;
    if c.status == Status::Archived {
        return Ok(Json(json!({"ok": true, "status": "archived", "steps": []})));
    }
    if let Some((code, message)) = c.blockers.first() {
        return Err(ApiError::Conflict { code: *code, message: message.clone() });
    }
    if c.needs_empty() && !r.empty {
        return Err(ApiError::Conflict { code: "not_empty", message: "Close all trades and move the balance to your wallet first (or archive with empty = true)".into() });
    }
    if (c.credit > ZERO || c.bonus > ZERO) && !r.ack_forfeit {
        return Err(ApiError::Validation { field: "ackForfeit", message: "Credit and bonus on this account are forfeited when it is archived; confirm to continue".into() });
    }
    let actor = format!("user:{user}");
    let mut steps = Vec::new();
    let fail = |steps: Vec<Value>, status: Status| Ok(Json(json!({"ok": false, "status": status.as_str(), "steps": steps})));
    if c.positions > 0 || c.orders > 0 {
        let op: Op = Box::new(close_everything);
        match st.hub.exec(login, &actor, None, "", "", None, op).await {
            Ok(d) => steps.push(step("close_positions", true, format!("{} position(s) closed, {} order(s) cancelled", d.value["closed"], d.value["cancelled"]))),
            Err(e) => {
                steps.push(step("close_positions", false, exec_err(e)));
                return fail(steps, c.status);
            }
        }
    }
    if c.kind == AccountKind::Live {
        let now = check(&st, login).await?;
        let amt = crate::social::copier::returnable(now.withdrawable_usd);
        if amt > ZERO {
            let key = format!("archive:{login}:{}", now.version);
            match st.social.wallet.from_trading(&st.social.slug(ctx.tenant.tenant_id), &key, user, login, amt).await {
                Ok(_) => steps.push(step("return_balance", true, format!("{} USD moved to the wallet", amt.normalize()))),
                Err(e) => {
                    steps.push(step("return_balance", false, e.message));
                    return fail(steps, c.status);
                }
            }
        }
    }
    let by = actor.clone();
    let op: Op = Box::new(move |tx, env| funds::archive(tx, env, &by, "CLIENT", true).map(|changed| json!({"changed": changed})));
    match st.hub.exec(login, &actor, None, "", "", None, op).await {
        Ok(_) => steps.push(step("archive", true, "Account archived")),
        Err(e) => {
            steps.push(step("archive", false, exec_err(e)));
            return fail(steps, c.status);
        }
    }
    revoke_sessions(&st, login).await;
    tracing::info!(login, user, "account archived by the client");
    Ok(Json(json!({"ok": true, "status": "archived", "steps": steps})))
}

/// Ends the terminal sessions of a retired account.
pub async fn revoke_sessions(st: &AppState, login: i64) {
    if let Err(e) = sqlx::query("UPDATE terminal_sessions SET revoked_at = now() WHERE login = $1 AND revoked_at IS NULL").bind(login).execute(&st.pool).await {
        tracing::warn!(login, error = %e, "revoking sessions of an archived account failed");
    }
}

/// The account limit of its group still has room for one more (archived accounts do not count).
pub fn limit_allows(st: &AppState, ctx: &Ctx, login: i64) -> ApiResult<()> {
    let m = st.hub.meta(login).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    let Some(g) = ctx.tenant.groups.get(&m.group) else { return Ok(()) };
    let used = {
        let idx = st.hub.shared.index.read().unwrap();
        idx.accounts.iter().filter(|(l, x)| **l != login && x.tenant_id == m.tenant_id && x.user_id == m.user_id && x.kind == m.kind && x.group == m.group && !x.status.is_retired()).count()
    };
    if used as u32 >= g.max_accounts_per_user {
        return Err(ApiError::Conflict { code: "account_limit", message: format!("You can have at most {} {} account(s) in {}", g.max_accounts_per_user, m.kind.as_str(), g.name) });
    }
    Ok(())
}

pub async fn restore(State(st): State<AppState>, ctx: Ctx, headers: HeaderMap, Path(login): Path<i64>, Query(q): Query<UserQ>) -> ApiResult<Json<Value>> {
    let user = user_of(&headers, q.user_id)?;
    owned(&st, &ctx, login, user)?;
    let _guard = st.open_lock.lock().await;
    limit_allows(&st, &ctx, login)?;
    let op: Op = Box::new(|tx, _| funds::restore(tx, true).map(|s| json!({"status": s.as_str()})));
    let d = st.hub.exec(login, &format!("user:{user}"), None, "", "", None, op).await?;
    // a restored demo starts a fresh inactivity window (else the expiry job takes it straight back)
    let _ = sqlx::query("UPDATE accounts SET last_activity_at = now() WHERE login = $1").bind(login).execute(&st.pool).await;
    tracing::info!(login, user, "account restored by the client");
    Ok(Json(json!({"ok": true, "status": d.value["status"]})))
}

#[derive(Deserialize)]
pub struct RenameReq {
    name: String,
}

pub async fn rename(State(st): State<AppState>, ctx: Ctx, headers: HeaderMap, Path(login): Path<i64>, Query(q): Query<UserQ>, Body(r): Body<RenameReq>) -> ApiResult<Json<Value>> {
    let user = user_of(&headers, q.user_id)?;
    owned(&st, &ctx, login, user)?;
    if r.name.trim().chars().count() > 32 {
        return Err(ApiError::Validation { field: "name", message: "The name can be at most 32 characters".into() });
    }
    let op: Op = Box::new(move |tx, _| funds::rename(tx, &r.name).map(|_| Value::Null));
    st.hub.exec(login, &format!("user:{user}"), None, "", "", None, op).await?;
    Ok(Json(json!({"ok": true})))
}
