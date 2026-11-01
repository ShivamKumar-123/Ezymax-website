//! Deposit turnover requirements: a confirmed deposit asks for a matching amount of traded volume before the
//! money it funded can be withdrawn.
//!
//! The shape is two feeds and a ledger between them. Deposits come from the wallet's own `ledger_txns`, which
//! is the only place every rail - on-chain USDT, OxaPay, a manual bank transfer - already agrees on what
//! arrived and when; reading it rather than hooking each rail's credit path means a retried webhook, a
//! re-scanned block or a replayed invoice cannot raise a second requirement, because the ledger deduplicated
//! them before this module ever saw them. Volume comes from the engine's `/v1/internal/volume`, which values
//! each closed deal in USD. Between them sits an allocation row per (requirement, deal): every movement of a
//! client's progress has a line explaining it, so the percentage they are shown can always be taken apart.
//!
//! Three rules decide the arithmetic, and all three are about not lying to a client:
//!
//! - **The multiplier is frozen per deposit.** It is copied onto the requirement when the deposit lands, so a
//!   broker raising the policy tomorrow cannot move the goalposts under money already paid in.
//! - **Nothing is credited on a guess.** A deal the engine could not value in USD comes back with no number,
//!   and the cursor stays where it is until it can be valued. Crediting zero would quietly cost the client a
//!   trade they really made, and the mistake would be invisible to everyone.
//! - **Remaining is never stored.** It is `required - completed`, computed where it is read. A third copy of
//!   the same fact is a disagreement waiting to happen, and this one would be visible on the withdrawal gate.
//!
//! Off by default (`turnover_enabled`). Whether a broker may hold a client's money against a trading target at
//! all depends on what it has disclosed and what its agreements allow, so the switch is theirs to throw, the
//! multiplier ships at zero, and turning it on only affects deposits taken from that moment.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Row, Transaction};

use crate::error::{ApiError, ApiResult};
use crate::money::{D, ENGINE_DP, floor_dp, s};
use crate::state::AppState;

/// The ledger kinds that are a client paying money in.
///
/// Staff adjustments (`manual_deposit`, `adjustment_in`) are deliberately absent. They are the tool the desk
/// uses to correct its own mistakes, and a correction that silently locked the client out of their balance
/// would turn a small fix into a complaint.
pub const QUALIFYING_KINDS: &[&str] = &["deposit", "crypto_deposit", "bank_deposit"];

/// How many deals one pass of the volume feed takes.
const FEED_PAGE: i64 = 500;

/* ------------------------------------------------------------------ */
/* policy                                                             */
/* ------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Policy {
    pub enabled: bool,
    pub multiplier: D,
    pub min_deposit: D,
}

impl Policy {
    /// What a deposit of `amount` has to be traded before it can leave, or `None` when this deposit raises no
    /// requirement at all.
    pub fn required_for(&self, amount: D) -> Option<D> {
        if !self.enabled || self.multiplier <= D::ZERO || amount < self.min_deposit || amount <= D::ZERO {
            return None;
        }
        Some(floor_dp(amount * self.multiplier, ENGINE_DP))
    }

    pub fn json(&self) -> Value {
        json!({ "enabled": self.enabled, "multiplier": s(self.multiplier), "min_deposit": s(self.min_deposit) })
    }
}

pub async fn policy(pool: &PgPool, tenant_id: i64) -> sqlx::Result<Policy> {
    let r = sqlx::query("SELECT turnover_enabled, turnover_multiplier, turnover_min_deposit FROM tenant_settings WHERE tenant_id = $1").bind(tenant_id).fetch_optional(pool).await?;
    Ok(match r {
        Some(r) => Policy { enabled: r.get("turnover_enabled"), multiplier: r.get("turnover_multiplier"), min_deposit: r.get("turnover_min_deposit") },
        None => Policy { enabled: false, multiplier: D::ZERO, min_deposit: D::ZERO },
    })
}

/* ------------------------------------------------------------------ */
/* what a client is shown                                             */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, PartialEq)]
pub struct Summary {
    pub deposits: D,
    pub required: D,
    pub completed: D,
    pub open: i64,
    /// Whether the broker's switch is currently on. Off, the outstanding requirements are kept but hold
    /// nobody: see `met`.
    pub enforced: bool,
}

impl Default for Summary {
    fn default() -> Self {
        Summary { deposits: D::ZERO, required: D::ZERO, completed: D::ZERO, open: 0, enforced: true }
    }
}

impl Summary {
    pub fn remaining(&self) -> D {
        (self.required - self.completed).max(D::ZERO)
    }

    /// Whole percent, and never a rounded-up 100: a client one dollar short must not read "100% complete" next
    /// to a withdrawal the gate is about to refuse. Over-trading is capped at 100 rather than overflowing.
    pub fn percent(&self) -> i64 {
        if self.required <= D::ZERO {
            return 100;
        }
        if !self.enforced || self.remaining() <= D::ZERO {
            return 100;
        }
        let pct = (self.completed * D::ONE_HUNDRED / self.required).floor();
        pct.try_into().unwrap_or(0_i64).clamp(0, 99)
    }

    /// Whether this client may withdraw.
    ///
    /// Switching the policy off releases everyone at once, outstanding requirements included. A broker who
    /// turns a restriction off means "stop holding my clients' money", and a switch that left them held
    /// would be a trap with no way out but waiving one requirement at a time. The rows are kept rather than
    /// deleted, so turning it back on resumes exactly where it left off.
    pub fn met(&self) -> bool {
        !self.enforced || self.remaining() <= D::ZERO
    }

    pub fn json(&self) -> Value {
        json!({
            "total_deposits": s(self.deposits),
            "required_volume": s(self.required),
            "completed_volume": s(self.completed),
            "remaining_volume": s(self.remaining()),
            "completion_percentage": self.percent(),
            "open_requirements": self.open,
            "enforced": self.enforced,
            "eligible": self.met(),
            "status": if self.met() { "completed" } else { "pending" },
        })
    }
}

/// The client's requirements, added up: the combined figure the withdrawal modal shows.
///
/// Completed ones stay in the total and only waived ones drop out. Counting the open ones alone looks tidier
/// until a client watches it happen: finish the first of two deposits and the bar falls from 83% back to 50%,
/// because the work that earned the first 83% has quietly left the sum. Progress a client has made does not
/// stop being progress. A waiver is different - the obligation was lifted, so it is gone rather than met.
pub async fn summary(pool: &PgPool, tenant_id: i64, user_id: i64) -> sqlx::Result<Summary> {
    let r = sqlx::query(
        "SELECT COALESCE(sum(deposit_amount), 0) AS deposits, COALESCE(sum(required), 0) AS required,
                COALESCE(sum(completed), 0) AS completed, count(*) FILTER (WHERE status = 'pending') AS open
         FROM turnover_requirements WHERE tenant_id = $1 AND user_id = $2 AND status <> 'waived'",
    )
    .bind(tenant_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(Summary {
        deposits: r.get("deposits"),
        required: r.get("required"),
        completed: r.get("completed"),
        open: r.get("open"),
        enforced: policy(pool, tenant_id).await?.enabled,
    })
}

/// Requirement by requirement, newest first: what the withdrawal modal expands into when a client has funded
/// more than once and wants to know which deposit is holding things up.
pub async fn breakdown(pool: &PgPool, tenant_id: i64, user_id: i64, limit: i64) -> sqlx::Result<Vec<Value>> {
    let rows = sqlx::query(
        "SELECT id, ledger_txn_id, currency, deposit_amount, multiplier, required, completed, status, waived_reason, created_at, completed_at
         FROM turnover_requirements WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT $3",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let required: D = r.get("required");
            let completed: D = r.get("completed");
            let one = Summary { deposits: r.get("deposit_amount"), required, completed, open: 1, enforced: true };
            json!({
                "id": r.get::<i64, _>("id"),
                "deposit_txn": r.get::<i64, _>("ledger_txn_id"),
                "currency": r.get::<String, _>("currency"),
                "deposit_amount": s(r.get("deposit_amount")),
                "multiplier": s(r.get("multiplier")),
                "required_volume": s(required),
                "completed_volume": s(completed),
                "remaining_volume": s(one.remaining()),
                "completion_percentage": one.percent(),
                "status": r.get::<String, _>("status"),
                "waived_reason": r.get::<Option<String>, _>("waived_reason"),
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
                "completed_at": r.get::<Option<DateTime<Utc>>, _>("completed_at"),
            })
        })
        .collect())
}

/// Where a client's volume came from: the deals that paid their requirements down, newest first.
pub async fn history(pool: &PgPool, tenant_id: i64, user_id: i64, limit: i64) -> sqlx::Result<Vec<Value>> {
    let rows = sqlx::query(
        "SELECT a.id, a.requirement_id, a.deal_id, a.kind, a.amount, a.created_at, v.symbol, v.lots, v.notional, v.closed_at
         FROM turnover_allocations a JOIN turnover_volume v ON v.deal_id = a.deal_id
         WHERE a.tenant_id = $1 AND v.user_id = $2 ORDER BY a.id DESC LIMIT $3",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<i64, _>("id"),
                "requirement_id": r.get::<i64, _>("requirement_id"),
                "deal_id": r.get::<i64, _>("deal_id"),
                "kind": r.get::<String, _>("kind"),
                "amount": s(r.get("amount")),
                "symbol": r.get::<String, _>("symbol"),
                "lots": s(r.get("lots")),
                "deal_notional": s(r.get("notional")),
                "closed_at": r.get::<DateTime<Utc>, _>("closed_at"),
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect())
}

/* ------------------------------------------------------------------ */
/* the gate                                                           */
/* ------------------------------------------------------------------ */

/// Refuses a withdrawal while the client still owes traded volume.
///
/// This is the restriction itself, and it lives beside the KYC gate and the post-deposit cooldown in the one
/// path every withdrawal takes - request and quote alike - so the modal the client sees and the answer the API
/// gives can never disagree, and calling the API directly gets the same refusal as pressing the button.
///
/// It reads the client's own open requirements and nothing about the withdrawal, which is why two withdrawals
/// racing each other is not a hazard here: a withdrawal does not consume turnover, so there is no budget for
/// a second request to spend twice. The amount, the daily limit and the balance are still settled under the
/// existing lock further down.
pub async fn gate(pool: &PgPool, tenant_id: i64, user_id: i64) -> ApiResult<Summary> {
    let sum = summary(pool, tenant_id, user_id).await?;
    if sum.met() {
        return Ok(sum);
    }
    Err(ApiError::unprocessable(
        "turnover_pending",
        format!("Trade {} USD more before withdrawing: your deposits require {} USD of volume and {} is done.", s(sum.remaining()), s(sum.required), s(sum.completed)),
    ))
}

/* ------------------------------------------------------------------ */
/* deposits in                                                        */
/* ------------------------------------------------------------------ */

/// Turns newly credited deposits into requirements, oldest first.
///
/// The cursor moves one deposit at a time and only past deposits that have been dealt with, so a crash
/// between two of them repeats at most the one in hand - which the unique key on `ledger_txn_id` makes
/// harmless anyway.
pub async fn deposit_tick(st: &AppState, tenant_id: i64) -> anyhow::Result<usize> {
    let pol = policy(&st.pool, tenant_id).await?;
    let after = cursor(&st.pool, tenant_id, "deposits").await?;
    let rows = sqlx::query(
        "SELECT t.id, t.user_id, t.currency, sum(p.amount) AS amount
         FROM ledger_txns t JOIN ledger_postings p ON p.txn_id = t.id
         WHERE t.tenant_id = $1 AND t.id > $2 AND t.kind = ANY($3) AND t.user_id IS NOT NULL
           AND p.account_code = 'user:' || t.user_id || ':' || t.currency || ':available' AND p.amount > 0
         GROUP BY t.id, t.user_id, t.currency ORDER BY t.id LIMIT 500",
    )
    .bind(tenant_id)
    .bind(after)
    .bind(QUALIFYING_KINDS)
    .fetch_all(&st.pool)
    .await?;
    let mut made = 0;
    let mut seen = after;
    for r in &rows {
        let txn: i64 = r.get("id");
        let amount: D = r.get("amount");
        // A deposit taken while the policy was off raises no requirement, and the cursor still moves past it:
        // turning the switch on applies to what comes next, never to money already in.
        if let Some(required) = pol.required_for(amount) {
            let n = sqlx::query(
                "INSERT INTO turnover_requirements (tenant_id, user_id, ledger_txn_id, currency, deposit_amount, multiplier, required)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (ledger_txn_id) DO NOTHING",
            )
            .bind(tenant_id)
            .bind(r.get::<i64, _>("user_id"))
            .bind(txn)
            .bind(r.get::<String, _>("currency"))
            .bind(amount)
            .bind(pol.multiplier)
            .bind(required)
            .execute(&st.pool)
            .await?
            .rows_affected();
            made += n as usize;
        }
        seen = txn;
    }
    if seen > after {
        set_cursor(&st.pool, tenant_id, "deposits", seen).await?;
    }
    Ok(made)
}

/* ------------------------------------------------------------------ */
/* volume in                                                          */
/* ------------------------------------------------------------------ */

/// One closed deal as the engine reported it.
#[derive(Clone, Debug)]
pub struct DealIn {
    pub deal: i64,
    pub user_id: i64,
    pub login: i64,
    pub symbol: String,
    pub lots: D,
    /// `None` when the engine could not value it in USD.
    pub notional: Option<D>,
    pub rate: Option<D>,
    pub closed_at: DateTime<Utc>,
    pub reversed: bool,
    pub option: bool,
}

/// Credits the client's open requirements with one deal, oldest requirement first.
///
/// FIFO is what makes the deposit-wise breakdown mean anything: the first deposit is worked off first, so a
/// client reading "deposit 1: $500 to go" is reading the deposit their next trade will actually pay down.
/// Volume beyond every open requirement is kept on the deal but allocated nowhere - a later deposit starts its
/// own requirement from zero, because trading done before money arrives cannot have been done to free it.
pub async fn allocate(tx: &mut Transaction<'_, Postgres>, tenant_id: i64, d: &DealIn, notional: D) -> sqlx::Result<D> {
    let open = sqlx::query("SELECT id, required, completed FROM turnover_requirements WHERE tenant_id = $1 AND user_id = $2 AND status = 'pending' ORDER BY id FOR UPDATE")
        .bind(tenant_id)
        .bind(d.user_id)
        .fetch_all(&mut **tx)
        .await?;
    let mut left = notional;
    let mut used = D::ZERO;
    for r in &open {
        if left <= D::ZERO {
            break;
        }
        let id: i64 = r.get("id");
        let required: D = r.get("required");
        let completed: D = r.get("completed");
        let take = left.min((required - completed).max(D::ZERO));
        if take <= D::ZERO {
            continue;
        }
        sqlx::query(
            "UPDATE turnover_requirements SET completed = completed + $2, updated_at = now(),
                status = CASE WHEN completed + $2 >= required THEN 'completed' ELSE status END,
                completed_at = CASE WHEN completed + $2 >= required THEN now() ELSE completed_at END
             WHERE id = $1",
        )
        .bind(id)
        .bind(take)
        .execute(&mut **tx)
        .await?;
        sqlx::query("INSERT INTO turnover_allocations (tenant_id, requirement_id, deal_id, kind, amount) VALUES ($1,$2,$3,'credit',$4) ON CONFLICT DO NOTHING")
            .bind(tenant_id)
            .bind(id)
            .bind(d.deal)
            .bind(take)
            .execute(&mut **tx)
            .await?;
        left -= take;
        used += take;
    }
    Ok(used)
}

/// Records one deal and credits it. Returns None when the deal was already counted.
pub async fn ingest(pool: &PgPool, tenant_id: i64, d: &DealIn) -> sqlx::Result<Option<D>> {
    let notional = d.notional.unwrap_or(D::ZERO).max(D::ZERO);
    let mut tx = pool.begin().await?;
    let inserted = sqlx::query(
        "INSERT INTO turnover_volume (deal_id, tenant_id, user_id, login, symbol, lots, notional, rate, closed_at, reversed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (deal_id) DO NOTHING",
    )
    .bind(d.deal)
    .bind(tenant_id)
    .bind(d.user_id)
    .bind(d.login)
    .bind(&d.symbol)
    .bind(d.lots)
    .bind(notional)
    .bind(d.rate.unwrap_or(D::ONE))
    .bind(d.closed_at)
    .bind(d.reversed)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if inserted == 0 {
        tx.rollback().await?;
        return Ok(None);
    }
    // a reopened deal is recorded so the feed stops offering it, but it never counts
    let used = if d.reversed || notional <= D::ZERO { D::ZERO } else { allocate(&mut tx, tenant_id, d, notional).await? };
    tx.commit().await?;
    Ok(Some(used))
}

/// Reads the engine's volume feed and credits what it finds.
///
/// A deal the engine could not value holds the cursor: it is left unread and tried again next pass, when the
/// missing conversion pair may be streaming. The alternative - stepping over it - would silently cost the
/// client a trade they really made, and nothing afterwards would show that it had happened.
pub async fn volume_tick(st: &AppState, tenant_id: i64, tenant: &str) -> anyhow::Result<usize> {
    let after = cursor(&st.pool, tenant_id, "volume").await?;
    let feed = st.engine.volume(tenant, after, FEED_PAGE).await.map_err(|e| anyhow::anyhow!("engine volume feed: {e:?}"))?;
    let mut counted = 0;
    let mut seen = after;
    let mut held = false;
    for d in &feed {
        if d.notional.is_none() && !d.option && !d.reversed {
            tracing::warn!(deal = d.deal, symbol = %d.symbol, "no USD value for a closed deal yet; turnover cursor held");
            held = true;
        }
        if !held {
            if ingest(&st.pool, tenant_id, d).await?.is_some() {
                counted += 1;
            }
            seen = d.deal;
        }
    }
    if seen > after {
        set_cursor(&st.pool, tenant_id, "volume", seen).await?;
    }
    Ok(counted)
}

/// Deals the desk reopened after they were credited: the credit comes off every requirement it paid, and a
/// requirement that was only completed by it opens again.
pub async fn reversal_tick(st: &AppState, tenant_id: i64, tenant: &str) -> anyhow::Result<usize> {
    let since = Utc::now() - chrono::Duration::days(14);
    let feed = st.engine.reversed_volume(tenant, since).await.map_err(|e| anyhow::anyhow!("engine reversal feed: {e:?}"))?;
    let mut n = 0;
    for d in &feed {
        let fresh: Option<i64> = sqlx::query_scalar("SELECT deal_id FROM turnover_volume WHERE deal_id = $1 AND NOT reversed").bind(d.deal).fetch_optional(&st.pool).await?;
        if fresh.is_none() {
            continue;
        }
        let mut tx = st.pool.begin().await?;
        sqlx::query("UPDATE turnover_volume SET reversed = true WHERE deal_id = $1").bind(d.deal).execute(&mut *tx).await?;
        let credits = sqlx::query("SELECT requirement_id, amount FROM turnover_allocations WHERE deal_id = $1 AND kind = 'credit'").bind(d.deal).fetch_all(&mut *tx).await?;
        for c in &credits {
            let req: i64 = c.get("requirement_id");
            let amount: D = c.get("amount");
            sqlx::query(
                "UPDATE turnover_requirements SET completed = GREATEST(completed - $2, 0), updated_at = now(),
                    status = CASE WHEN status = 'completed' AND GREATEST(completed - $2, 0) < required THEN 'pending' ELSE status END,
                    completed_at = CASE WHEN status = 'completed' AND GREATEST(completed - $2, 0) < required THEN NULL ELSE completed_at END
                 WHERE id = $1 AND status <> 'waived'",
            )
            .bind(req)
            .bind(amount)
            .execute(&mut *tx)
            .await?;
            sqlx::query("INSERT INTO turnover_allocations (tenant_id, requirement_id, deal_id, kind, amount) VALUES ($1,$2,$3,'reversal',$4) ON CONFLICT DO NOTHING")
                .bind(tenant_id)
                .bind(req)
                .bind(d.deal)
                .bind(-amount)
                .execute(&mut *tx)
                .await?;
        }
        crate::audit::system(&mut tx, tenant_id, "turnover.reversed", "deal", d.deal.to_string(), Some(json!({"credits": credits.len()}))).await?;
        tx.commit().await?;
        n += 1;
    }
    Ok(n)
}

/* ------------------------------------------------------------------ */
/* staff                                                              */
/* ------------------------------------------------------------------ */

/// Lifts one requirement, with a reason, for the compliant exception path: a client the restriction must not
/// apply to, or one a review has cleared. It never touches a balance - it only stops this requirement holding
/// the gate shut - and the reason and the member of staff are on the row and in the audit trail.
pub async fn waive(st: &AppState, s_ctx: &crate::state::StaffCtx, tenant_id: i64, id: i64, reason: &str) -> ApiResult<Value> {
    let reason = reason.trim();
    if reason.len() < 3 {
        return Err(ApiError::validation("reason", "Give a reason of at least 3 characters"));
    }
    let mut tx = st.pool.begin().await?;
    let before = sqlx::query("SELECT user_id, required, completed, status FROM turnover_requirements WHERE tenant_id = $1 AND id = $2 FOR UPDATE")
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| ApiError::not_found("Requirement"))?;
    if before.get::<String, _>("status") == "waived" {
        return Err(ApiError::conflict("already_waived", "This requirement has already been waived"));
    }
    sqlx::query("UPDATE turnover_requirements SET status = 'waived', waived_by = $2, waived_reason = $3, updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(format!("staff:{}", s_ctx.staff.id))
        .bind(reason)
        .execute(&mut *tx)
        .await?;
    crate::audit::staff(
        &mut tx,
        s_ctx,
        crate::audit::Entry {
            action: "turnover.waived",
            target_kind: "turnover_requirement",
            target_id: id.to_string(),
            reason: Some(reason),
            before: Some(json!({"status": before.get::<String, _>("status"), "required": s(before.get("required")), "completed": s(before.get("completed"))})),
            after: Some(json!({"status": "waived"})),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(json!({"id": id, "status": "waived", "user_id": before.get::<i64, _>("user_id")}))
}

/* ------------------------------------------------------------------ */
/* cursors                                                            */
/* ------------------------------------------------------------------ */

async fn cursor(pool: &PgPool, tenant_id: i64, name: &str) -> sqlx::Result<i64> {
    let v: Option<i64> = sqlx::query_scalar("SELECT at FROM turnover_cursors WHERE tenant_id = $1 AND name = $2").bind(tenant_id).bind(name).fetch_optional(pool).await?;
    Ok(v.unwrap_or(0))
}

async fn set_cursor(pool: &PgPool, tenant_id: i64, name: &str, at: i64) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO turnover_cursors (tenant_id, name, at) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, name) DO UPDATE SET at = GREATEST(turnover_cursors.at, $3), updated_at = now()")
        .bind(tenant_id)
        .bind(name)
        .bind(at)
        .execute(pool)
        .await?;
    Ok(())
}

/// One pass for every tenant, from the watcher.
pub async fn tick(st: &AppState) -> anyhow::Result<usize> {
    let mut n = 0;
    for (tenant_id, slug) in st.tenants.all() {
        // Deposits are read whatever the policy says, so the cursor keeps up and switching the policy on does
        // not sweep up months of old deposits as new requirements.
        n += deposit_tick(st, tenant_id).await?;
        if !policy(&st.pool, tenant_id).await?.enabled {
            continue;
        }
        n += volume_tick(st, tenant_id, &slug).await?;
        if let Err(e) = reversal_tick(st, tenant_id, &slug).await {
            tracing::warn!(tenant_id, error = %e, "turnover reversal sweep failed");
        }
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn d(v: &str) -> D {
        D::from_str(v).unwrap()
    }

    fn pol(enabled: bool, mult: &str, min: &str) -> Policy {
        Policy { enabled, multiplier: d(mult), min_deposit: d(min) }
    }

    #[test]
    fn a_deposit_asks_for_its_own_multiple() {
        // the spec's own example: $2,000 at 1.0x
        assert_eq!(pol(true, "1.0", "0").required_for(d("2000")), Some(d("2000")));
        assert_eq!(pol(true, "1.5", "0").required_for(d("2000")), Some(d("3000")));
        // and the fraction of a cent a multiplier can produce is never rounded up against the client
        assert_eq!(pol(true, "1.005", "0").required_for(d("33.33")), Some(d("33.49")));
    }

    #[test]
    fn nothing_is_required_until_a_broker_asks_for_it() {
        assert_eq!(pol(false, "1.0", "0").required_for(d("2000")), None, "off is off");
        assert_eq!(pol(true, "0", "0").required_for(d("2000")), None, "a zero multiplier asks for nothing");
        assert_eq!(pol(true, "1.0", "100").required_for(d("50")), None, "below the floor");
        assert_eq!(pol(true, "1.0", "100").required_for(d("100")), Some(d("100")), "the floor itself qualifies");
    }

    #[test]
    fn progress_never_reads_complete_while_a_dollar_is_owed() {
        let nearly = Summary { deposits: d("2000"), required: d("2000"), completed: d("1999.99"), open: 1, enforced: true };
        assert_eq!(nearly.percent(), 99);
        assert!(!nearly.met());
        let done = Summary { deposits: d("2000"), required: d("2000"), completed: d("2000"), open: 1, enforced: true };
        assert_eq!((done.percent(), done.met()), (100, true));
        // over-trading does not overflow the bar
        let over = Summary { deposits: d("2000"), required: d("2000"), completed: d("5000"), open: 1, enforced: true };
        assert_eq!((over.percent(), over.remaining()), (100, D::ZERO));
    }

    #[test]
    fn turning_the_policy_off_releases_everyone_at_once() {
        let owed = Summary { deposits: d("2000"), required: d("2000"), completed: d("100"), open: 1, enforced: true };
        assert!(!owed.met(), "while it is on, the volume is owed");
        let released = Summary { enforced: false, ..owed.clone() };
        assert!(released.met(), "switching it off must let them withdraw, not leave them held");
        assert_eq!(released.percent(), 100);
        // the obligation is kept, not erased, so turning it back on resumes where it left off
        assert_eq!(released.remaining(), d("1900"));
        assert!(Summary { enforced: true, ..released }.met() == false);
    }

    #[test]
    fn a_client_with_no_requirement_can_withdraw() {
        let none = Summary::default();
        assert_eq!((none.percent(), none.met(), none.remaining()), (100, true, D::ZERO));
    }

    #[test]
    fn the_spec_worked_example() {
        // deposit 1 of $2,000 and deposit 2 of $1,000, $2,500 traded
        let s = Summary { deposits: d("3000"), required: d("3000"), completed: d("2500"), open: 2, enforced: true };
        assert_eq!(s.remaining(), d("500"));
        assert_eq!(s.percent(), 83);
        assert!(!s.met());
    }
}
