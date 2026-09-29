//! Trading contests (D135): join (dedicated demo account or a chosen live account), live scores from engine
//! deals + floating P&L, ranks, anti-cheat flags, finalize and prize payout (wallet or trading credit).

use crate::audit::{self, Actor};
use crate::bonus::REASON_PRIZE;
use crate::calc::{self, RankInput};
use crate::clients::{self, EngineOutcome};
use crate::error::{ApiError, ApiResult};
use crate::loyalty;
use crate::model::{AntiCheat, Prize, contest_status, display_name, opt_num, prize_pool};
use crate::money::{D, ZERO, num};
use crate::profiles::Profile;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;

pub fn prizes_of(r: &sqlx::postgres::PgRow) -> Vec<Prize> {
    r.get::<sqlx::types::Json<Vec<Prize>>, _>("prizes").0
}

pub fn anti_of(r: &sqlx::postgres::PgRow) -> AntiCheat {
    serde_json::from_value(r.get::<sqlx::types::Json<Value>, _>("anti_cheat").0).unwrap_or_default()
}

pub fn status_of(r: &sqlx::postgres::PgRow) -> String {
    contest_status(r.get::<&str, _>("status"), r.get("starts_at"), r.get("ends_at"), Utc::now())
}

/// Contest row (+ `entrants` column) → JSON.
pub fn contest_json(r: &sqlx::postgres::PgRow) -> Value {
    let prizes = prizes_of(r);
    json!({
        "id": r.get::<i64, _>("id"),
        "slug": r.get::<String, _>("slug"),
        "name": r.get::<String, _>("name"),
        "description": r.get::<String, _>("description"),
        "kind": r.get::<String, _>("kind"),
        "status": status_of(r),
        "startsAt": r.get::<DateTime<Utc>, _>("starts_at"),
        "endsAt": r.get::<DateTime<Utc>, _>("ends_at"),
        "scoring": r.get::<String, _>("scoring"),
        "minTrades": r.get::<i32, _>("min_trades"),
        "maxEntrants": r.get::<Option<i32>, _>("max_entrants"),
        "entrants": r.try_get::<i64, _>("entrants").unwrap_or(0),
        "startingBalance": opt_num(r.get("starting_balance")),
        "demoGroup": r.get::<Option<String>, _>("demo_group"),
        "accountGroups": r.get::<Vec<String>, _>("account_groups"),
        "kycRequired": r.get::<bool, _>("kyc_required"),
        "minEquity": opt_num(r.get("min_equity")),
        "prizes": prizes,
        "prizePool": num(prize_pool(&prizes)),
        "rules": r.get::<String, _>("rules"),
        "antiCheat": anti_of(r),
        "refreshedAt": r.get::<Option<DateTime<Utc>>, _>("refreshed_at"),
        "finalizedAt": r.get::<Option<DateTime<Utc>>, _>("finalized_at"),
        "paidAt": r.get::<Option<DateTime<Utc>>, _>("paid_at"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "updatedAt": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

pub const CONTEST_SELECT: &str = "SELECT c.*, (SELECT count(*) FROM contest_entries e WHERE e.contest_id = c.id) AS entrants FROM contests c";

/// Entry row → Standing. `me` = the viewing client (their own login and id are shown), `staff` shows all.
pub fn standing_json(r: &sqlx::postgres::PgRow, me: Option<i64>, staff: bool, min_trades: i32) -> Value {
    let uid: i64 = r.get("user_id");
    let mine = me == Some(uid);
    let show = mine || staff;
    let trades: i32 = r.get("trades");
    json!({
        "entryId": r.get::<i64, _>("id"),
        "userId": if show { json!(uid) } else { Value::Null },
        "login": if show { json!(r.get::<i64, _>("login")) } else { Value::Null },
        "name": r.get::<String, _>("display_name"),
        "country": r.get::<String, _>("country"),
        "rank": r.get::<Option<i32>, _>("rank"),
        "score": num(r.get("score")),
        "returnPct": num(r.get("return_pct")),
        "profit": num(r.get::<D, _>("realised") + r.get::<D, _>("floating")),
        "lots": num(r.get("lots")),
        "trades": trades,
        "qualified": trades >= min_trades,
        "status": r.get::<String, _>("status"),
        "disqualifyReason": if show { json!(r.get::<Option<String>, _>("disqualify_reason")) } else { Value::Null },
        "startEquity": if show { opt_num(r.get("start_equity")) } else { Value::Null },
        "prize": opt_num(r.get("prize_amount")),
        "prizePayout": r.get::<Option<String>, _>("prize_payout"),
        "prizeStatus": r.get::<String, _>("prize_status"),
        "me": mine,
        "joinedAt": r.get::<DateTime<Utc>, _>("joined_at"),
        "updatedAt": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

pub const ORDER: &str = "ORDER BY (rank IS NULL), rank, joined_at, id";

pub async fn leaderboard(st: &AppState, contest_id: i64, me: Option<i64>, staff: bool, limit: i64) -> anyhow::Result<(Vec<Value>, Option<Value>)> {
    let min: i32 = sqlx::query_scalar("SELECT min_trades FROM contests WHERE id = $1").bind(contest_id).fetch_one(&st.pool).await?;
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * FROM contest_entries WHERE contest_id = $1 {ORDER} LIMIT $2"))).bind(contest_id).bind(limit).fetch_all(&st.pool).await?;
    let list = rows.iter().map(|r| standing_json(r, me, staff, min)).collect();
    let mine = match me {
        Some(u) => sqlx::query("SELECT * FROM contest_entries WHERE contest_id = $1 AND user_id = $2").bind(contest_id).bind(u).fetch_optional(&st.pool).await?.map(|r| standing_json(&r, me, staff, min)),
        None => None,
    };
    Ok((list, mine))
}

/// Joins a contest. Demo: opens a dedicated demo account (credentials returned once). Live: the chosen account.
pub async fn join(st: &AppState, tenant: &str, user_id: i64, contest_id: i64, login: Option<i64>, profile: &Profile) -> ApiResult<Value> {
    let c = sqlx::query(sqlx::AssertSqlSafe(format!("{CONTEST_SELECT} WHERE c.id = $1 AND c.tenant = $2"))).bind(contest_id).bind(tenant).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let status = status_of(&c);
    if status != "scheduled" && status != "running" {
        return Err(ApiError::Conflict { code: "contest_closed", message: "Registration for this contest is closed.".into() });
    }
    if c.get::<Option<i32>, _>("max_entrants").is_some_and(|m| c.get::<i64, _>("entrants") >= m as i64) {
        return Err(ApiError::Conflict { code: "contest_closed", message: "This contest is full.".into() });
    }
    if c.get::<bool, _>("kyc_required") && profile.kyc != "verified" {
        return Err(ApiError::Conflict { code: "not_eligible", message: "Verify your identity to join this contest.".into() });
    }
    let joined: Option<i64> = sqlx::query_scalar("SELECT id FROM contest_entries WHERE contest_id = $1 AND user_id = $2").bind(contest_id).bind(user_id).fetch_optional(&st.pool).await?;
    if joined.is_some() {
        return Err(ApiError::Conflict { code: "already_joined", message: "You have already joined this contest.".into() });
    }
    let kind: String = c.get("kind");
    let name: String = c.get("name");
    let running = status == "running";
    let (acc_login, start_equity, credentials) = if kind == "demo" {
        let balance: D = c.get::<Option<D>, _>("starting_balance").unwrap_or(D::from(10_000));
        let group = c.get::<Option<String>, _>("demo_group").unwrap_or_else(|| "standard".into());
        let (acc, creds) = clients::open_demo(st, tenant, user_id, &group, balance, &format!("Contest · {name}").chars().take(60).collect::<String>())
            .await
            .map_err(|m| ApiError::Conflict { code: "not_eligible", message: m })?;
        crate::deals::cache_account(st, tenant, &acc).await?;
        let mut creds = creds;
        creds["login"] = json!(acc.login);
        (acc.login, Some(acc.usd(acc.equity.max(acc.balance))), Some(creds))
    } else {
        let l = login.ok_or_else(|| crate::error::invalid("login", "Choose the live account to compete with."))?;
        let acc = clients::account(st, tenant, l).await.map_err(|e| ApiError::Unavailable(e.to_string()))?.ok_or_else(|| crate::error::invalid("login", "Account not found."))?;
        if acc.user_id != user_id || acc.kind != "live" {
            return Err(crate::error::invalid("login", "Choose one of your live accounts."));
        }
        let groups: Vec<String> = c.get("account_groups");
        if !groups.is_empty() && !groups.iter().any(|g| g.eq_ignore_ascii_case(&acc.group)) {
            return Err(crate::error::invalid("login", "This contest isn't open to that account type."));
        }
        let eq = acc.usd(acc.equity);
        if c.get::<Option<D>, _>("min_equity").is_some_and(|m| eq < m) {
            return Err(crate::error::invalid("login", format!("The account needs at least ${} equity.", c.get::<D, _>("min_equity").normalize())));
        }
        crate::deals::cache_account(st, tenant, &acc).await?;
        (acc.login, running.then_some(eq), None)
    };
    let mut tx = st.pool.begin().await?;
    let c2 = sqlx::query("SELECT max_entrants FROM contests WHERE id = $1 FOR UPDATE").bind(contest_id).fetch_one(&mut *tx).await?;
    if let Some(m) = c2.get::<Option<i32>, _>("max_entrants") {
        let n: i64 = sqlx::query_scalar("SELECT count(*) FROM contest_entries WHERE contest_id = $1").bind(contest_id).fetch_one(&mut *tx).await?;
        if n >= m as i64 {
            return Err(ApiError::Conflict { code: "contest_closed", message: "This contest is full.".into() });
        }
    }
    let r = sqlx::query(
        "INSERT INTO contest_entries (contest_id, tenant, user_id, login, display_name, country, start_equity) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING RETURNING *",
    )
    .bind(contest_id)
    .bind(tenant)
    .bind(user_id)
    .bind(acc_login)
    .bind(display_name(&profile.first_name, &profile.last_name))
    .bind(&profile.country)
    .bind(start_equity)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::Conflict { code: "already_joined", message: "You have already joined this contest (or that account is entered).".into() })?;
    audit::record(&mut *tx, tenant, &Actor { id: format!("user:{user_id}"), name: None }, "contest.join", Some(format!("contest:{contest_id}")), None, Some(json!({"login": acc_login})), None).await?;
    tx.commit().await?;
    let mut out = json!({"entry": standing_json(&r, Some(user_id), false, c.get("min_trades"))});
    if let Some(cr) = credentials {
        out["credentials"] = cr;
    }
    Ok(out)
}

/// Recomputes one contest: start snapshots, realised / floating P&L, scores, flags and ranks.
pub async fn refresh(st: &AppState, contest_id: i64) -> anyhow::Result<()> {
    let c = sqlx::query("SELECT * FROM contests WHERE id = $1").bind(contest_id).fetch_one(&st.pool).await?;
    let status = status_of(&c);
    if !matches!(status.as_str(), "running" | "ended") {
        return Ok(());
    }
    let tenant: String = c.get("tenant");
    let starts: DateTime<Utc> = c.get("starts_at");
    let ends: DateTime<Utc> = c.get("ends_at");
    let scoring: String = c.get("scoring");
    let min_trades: i32 = c.get("min_trades");
    let ac = anti_of(&c);
    let live_now = Utc::now() < ends;
    let entries = sqlx::query("SELECT * FROM contest_entries WHERE contest_id = $1").bind(contest_id).fetch_all(&st.pool).await?;
    let mut rank_in = Vec::with_capacity(entries.len());
    for e in &entries {
        let id: i64 = e.get("id");
        let login: i64 = e.get("login");
        let user: i64 = e.get("user_id");
        let mut start_eq: Option<D> = e.get("start_equity");
        let mut floating: D = e.get("floating");
        if live_now {
            match clients::account(st, &tenant, login).await {
                Ok(Some(acc)) => {
                    floating = acc.floating_usd();
                    if start_eq.is_none() {
                        start_eq = Some(acc.usd(acc.equity));
                    }
                }
                Ok(None) => {}
                Err(e) => tracing::debug!(error = %e, login, "contest account read failed"),
            }
        }
        let trades = sqlx::query("SELECT profit, lots, hold_seconds FROM contest_trades WHERE entry_id = $1").bind(id).fetch_all(&st.pool).await?;
        let realised: D = trades.iter().map(|t| t.get::<D, _>("profit")).sum();
        let lots: D = trades.iter().map(|t| t.get::<D, _>("lots")).sum();
        let (score, ret) = calc::contest_score(&scoring, realised, floating, lots, start_eq);
        sqlx::query("UPDATE contest_entries SET start_equity = $2, realised = $3, floating = $4, lots = $5, trades = $6, score = $7, return_pct = $8, updated_at = now() WHERE id = $1")
            .bind(id)
            .bind(start_eq)
            .bind(realised)
            .bind(floating)
            .bind(lots)
            .bind(trades.len() as i32)
            .bind(score)
            .bind(ret)
            .execute(&st.pool)
            .await?;
        // anti-cheat
        let facts: Vec<(D, i64)> = trades.iter().map(|t| (t.get::<D, _>("profit"), t.get::<i64, _>("hold_seconds"))).collect();
        for (kind, details) in calc::trade_flags(&facts, &ac) {
            add_flag(st, contest_id, id, kind, "medium", details).await?;
        }
        let mut disqualified = e.get::<String, _>("status") == "disqualified";
        if live_now && !disqualified {
            if let Ok(ledger) = clients::ledger(st, &tenant, login, user, starts).await {
                let changes: Vec<&clients::LedgerItem> = ledger
                    .iter()
                    .filter(|l| l.at >= starts && l.at < ends && l.sub_ledger == "balance" && calc::is_balance_change(&l.kind) && !l.reason_code.as_deref().is_some_and(|r| r.starts_with("GRW-")))
                    .collect();
                if let Some(first) = changes.first() {
                    let fresh = add_flag(st, contest_id, id, "balance_change", "high", json!({"kind": first.kind, "amount": num(first.amount), "at": first.at, "count": changes.len()})).await?;
                    if fresh && ac.disqualify_on_balance_change {
                        sqlx::query("UPDATE contest_entries SET status = 'disqualified', disqualify_reason = 'Balance changed during the contest (deposit, withdrawal or refill)' WHERE id = $1").bind(id).execute(&st.pool).await?;
                        sqlx::query("UPDATE contest_flags SET status = 'disqualified', resolved_by = 'system', resolved_at = now() WHERE entry_id = $1 AND kind = 'balance_change'").bind(id).execute(&st.pool).await?;
                        disqualified = true;
                    }
                }
            }
        }
        rank_in.push(RankInput { entry_id: id, score, trades: trades.len() as i64, disqualified, joined_at: e.get("joined_at") });
    }
    for (id, rank, _) in calc::rank(&rank_in, min_trades as i64) {
        sqlx::query("UPDATE contest_entries SET rank = $2 WHERE id = $1").bind(id).bind(rank).execute(&st.pool).await?;
    }
    sqlx::query("UPDATE contests SET refreshed_at = now(), status = CASE WHEN status IN ('scheduled','running') THEN $2 ELSE status END WHERE id = $1").bind(contest_id).bind(&status).execute(&st.pool).await?;
    Ok(())
}

/// Returns true when the flag is new.
async fn add_flag(st: &AppState, contest_id: i64, entry_id: i64, kind: &str, severity: &str, details: Value) -> anyhow::Result<bool> {
    let n = sqlx::query("INSERT INTO contest_flags (contest_id, entry_id, kind, severity, details) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (entry_id, kind) DO UPDATE SET details = EXCLUDED.details WHERE contest_flags.status = 'open' RETURNING (xmax = 0) AS inserted")
        .bind(contest_id)
        .bind(entry_id)
        .bind(kind)
        .bind(severity)
        .bind(sqlx::types::Json(details))
        .fetch_optional(&st.pool)
        .await?;
    Ok(n.is_some_and(|r| r.get::<bool, _>("inserted")))
}

/// Refreshes every running contest, and ended ones once more after their end.
pub async fn tick(st: &AppState) -> anyhow::Result<usize> {
    let ids: Vec<i64> = sqlx::query_scalar(
        "SELECT id FROM contests WHERE status IN ('scheduled','running','ended') AND starts_at <= now()
           AND (ends_at > now() OR refreshed_at IS NULL OR refreshed_at < ends_at + interval '2 minutes')",
    )
    .fetch_all(&st.pool)
    .await?;
    for id in &ids {
        if let Err(e) = refresh(st, *id).await {
            tracing::warn!(contest = id, error = %e, "contest refresh failed");
        }
    }
    Ok(ids.len())
}

/// Freezes ranks and prizes after the end.
pub async fn finalize(st: &AppState, contest_id: i64, actor: &Actor) -> ApiResult<()> {
    let c = sqlx::query("SELECT * FROM contests WHERE id = $1").bind(contest_id).fetch_one(&st.pool).await?;
    if status_of(&c) != "ended" {
        return Err(ApiError::Conflict { code: "state", message: "A contest can be finalized only after it ends.".into() });
    }
    refresh(st, contest_id).await?;
    let min_trades: i32 = c.get("min_trades");
    let entries = sqlx::query("SELECT id, score, trades, status, joined_at FROM contest_entries WHERE contest_id = $1").bind(contest_id).fetch_all(&st.pool).await?;
    let input: Vec<RankInput> = entries
        .iter()
        .map(|e| RankInput { entry_id: e.get("id"), score: e.get("score"), trades: e.get::<i32, _>("trades") as i64, disqualified: e.get::<String, _>("status") == "disqualified", joined_at: e.get("joined_at") })
        .collect();
    let ranks = calc::rank(&input, min_trades as i64);
    let prizes = calc::allocate_prizes(&prizes_of(&c), &ranks);
    let mut tx = st.pool.begin().await?;
    for (id, rank, _) in &ranks {
        sqlx::query("UPDATE contest_entries SET rank = $2, prize_amount = NULL, prize_payout = NULL, prize_status = 'none' WHERE id = $1").bind(id).bind(rank).execute(&mut *tx).await?;
    }
    for (id, amount, payout) in &prizes {
        sqlx::query("UPDATE contest_entries SET prize_amount = $2, prize_payout = $3, prize_status = 'pending' WHERE id = $1").bind(id).bind(amount).bind(payout).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE contests SET status = 'finalized', finalized_at = now(), finalized_by = $2, updated_at = now() WHERE id = $1").bind(contest_id).bind(actor.label()).execute(&mut *tx).await?;
    let total: D = prizes.iter().map(|p| p.1).sum();
    audit::record(&mut *tx, c.get::<&str, _>("tenant"), actor, "contest.finalize", Some(format!("contest:{contest_id}")), None, Some(json!({"winners": prizes.len(), "prizes": num(total)})), None).await?;
    tx.commit().await?;
    Ok(())
}

/// Pays pending (or failed) prizes: wallet credits, or trading credit on a live account.
pub async fn pay(st: &AppState, contest_id: i64, actor: &Actor) -> ApiResult<Value> {
    let c = sqlx::query("SELECT * FROM contests WHERE id = $1").bind(contest_id).fetch_one(&st.pool).await?;
    let stored: String = c.get("status");
    if stored != "finalized" && stored != "paid" {
        return Err(ApiError::Conflict { code: "state", message: "Finalize the contest before paying prizes.".into() });
    }
    let tenant: String = c.get("tenant");
    let name: String = c.get("name");
    let kind: String = c.get("kind");
    let winners = sqlx::query("SELECT * FROM contest_entries WHERE contest_id = $1 AND prize_status IN ('pending','failed') AND prize_amount > 0 ORDER BY rank").bind(contest_id).fetch_all(&st.pool).await?;
    let (mut paid, mut failed, mut amount) = (0, 0, ZERO);
    for w in winners {
        let id: i64 = w.get("id");
        let user: i64 = w.get("user_id");
        let prize: D = w.get("prize_amount");
        let rank: i32 = w.get::<Option<i32>, _>("rank").unwrap_or(0);
        let note = format!("{name}: prize for rank #{rank}");
        if w.get::<Option<String>, _>("prize_payout").as_deref() == Some("credit") {
            let login = if kind == "live" {
                Some(w.get::<i64, _>("login"))
            } else {
                clients::accounts_of(st, &tenant, user, Some("live")).await.ok().and_then(|v| v.first().map(|a| a.login))
            };
            let Some(login) = login else {
                sqlx::query("UPDATE contest_entries SET prize_status = 'failed', prize_error = 'The client has no live account for a credit prize' WHERE id = $1").bind(id).execute(&st.pool).await?;
                failed += 1;
                continue;
            };
            let cent = clients::account(st, &tenant, login).await.ok().flatten().is_some_and(|a| a.cent);
            match clients::post_balance(st, &tenant, login, cent, "credit", prize, &format!("growth:prize:{id}:c"), REASON_PRIZE, &note).await {
                EngineOutcome::Booked => {
                    sqlx::query("UPDATE contest_entries SET prize_status = 'paid', prize_ref = $2, prize_error = NULL WHERE id = $1").bind(id).bind(format!("credit:{login}")).execute(&st.pool).await?;
                    clients::notify(st, &tenant, user, "contest.prize", format!("{name}: prize credited"), format!("${} trading credit on account {login}.", prize.normalize()), "/rewards");
                    paid += 1;
                    amount += prize;
                }
                EngineOutcome::Retry(m) | EngineOutcome::Fail(m) => {
                    sqlx::query("UPDATE contest_entries SET prize_status = 'failed', prize_error = $2 WHERE id = $1").bind(id).bind(&m).execute(&st.pool).await?;
                    failed += 1;
                }
            }
        } else {
            let mut tx = st.pool.begin().await?;
            loyalty::queue_wallet_credit(&mut tx, &tenant, user, &format!("growth:prize:{id}"), "adjustment", prize, &format!("prize:{id}"), &note).await?;
            sqlx::query("UPDATE wallet_credits SET status = 'pending', next_try_at = now() WHERE idem_key = $1 AND status = 'failed'").bind(format!("growth:prize:{id}")).execute(&mut *tx).await?;
            sqlx::query("UPDATE contest_entries SET prize_status = 'pending', prize_error = NULL WHERE id = $1").bind(id).execute(&mut *tx).await?;
            tx.commit().await?;
            paid += 1;
            amount += prize;
        }
    }
    let mut tx = st.pool.begin().await?;
    sqlx::query("UPDATE contests SET status = 'paid', paid_at = COALESCE(paid_at, now()), updated_at = now() WHERE id = $1").bind(contest_id).execute(&mut *tx).await?;
    audit::record(&mut *tx, &tenant, actor, "contest.pay", Some(format!("contest:{contest_id}")), None, Some(json!({"paid": paid, "failed": failed, "amount": num(amount)})), None).await?;
    tx.commit().await?;
    st.wake.notify_one();
    // wallet prizes are paid by the payout loop; run it now so the response reflects them
    let _ = crate::payouts::wallet_tick(st).await;
    Ok(json!({"paid": paid, "failed": failed, "amount": num(amount)}))
}

pub fn flag_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "entryId": r.get::<i64, _>("entry_id"),
        "kind": r.get::<String, _>("kind"),
        "severity": r.get::<String, _>("severity"),
        "details": r.get::<sqlx::types::Json<Value>, _>("details").0,
        "status": r.get::<String, _>("status"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "resolvedBy": r.get::<Option<String>, _>("resolved_by"),
        "resolvedAt": r.get::<Option<DateTime<Utc>>, _>("resolved_at"),
        "note": r.get::<Option<String>, _>("note"),
        "name": r.try_get::<String, _>("display_name").ok(),
        "login": r.try_get::<i64, _>("login").ok(),
        "userId": r.try_get::<i64, _>("user_id").ok(),
    })
}
