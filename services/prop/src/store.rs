//! Database access shared by the API and the evaluator: connection + migrations, row types, audit,
//! notifications and rule events.

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool, Row};
use std::str::FromStr;

use crate::money::{D, num, num_opt};
use crate::plans::Plan;
use crate::rules::Tracker;

pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("ezymex_prop").to_string();
    let admin = opts.clone().database("postgres");
    let mut conn = admin.connect().await?;
    let exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM pg_database WHERE datname = $1").bind(&db).fetch_optional(&mut conn).await?;
    if exists.is_none() {
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE \"{}\"", db.replace('"', "")))).execute(&mut conn).await?;
        tracing::info!(%db, "created database");
    }
    drop(conn);
    let pool = PgPoolOptions::new().max_connections(16).connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

/// Who did something: `system`, `staff:<id>` or `user:<id>`.
#[derive(Clone, Debug)]
pub struct Actor {
    pub id: String,
    pub name: String,
    pub role: String,
}

impl Actor {
    pub fn system() -> Self {
        Actor { id: "system".into(), name: "Prop risk engine".into(), role: "system".into() }
    }
    pub fn user(id: i64) -> Self {
        Actor { id: format!("user:{id}"), name: String::new(), role: "client".into() }
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn audit(pool: &PgPool, tenant: &str, actor: &Actor, action: &str, entity: &str, entity_id: &str, before: Option<Value>, after: Option<Value>, reason: Option<&str>, note: Option<&str>) {
    let r = sqlx::query(
        "INSERT INTO audit_log (tenant, actor, actor_name, actor_role, action, entity, entity_id, before, after, reason, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    )
    .bind(tenant)
    .bind(&actor.id)
    .bind(&actor.name)
    .bind(&actor.role)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(before.map(sqlx::types::Json))
    .bind(after.map(sqlx::types::Json))
    .bind(reason)
    .bind(note)
    .execute(pool)
    .await;
    if let Err(e) = r {
        tracing::error!(error = %e, action, "audit write failed");
    }
}

pub async fn notify(pool: &PgPool, tenant: &str, user_id: i64, challenge_id: Option<i64>, kind: &str, title: &str, body: &str) {
    let r = sqlx::query("INSERT INTO notifications (tenant, user_id, challenge_id, kind, title, body) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(tenant)
        .bind(user_id)
        .bind(challenge_id)
        .bind(kind)
        .bind(title)
        .bind(body)
        .execute(pool)
        .await;
    match r {
        Ok(_) => crate::notifier::WAKE.notify_one(),
        Err(e) => tracing::error!(error = %e, kind, "notification write failed"),
    }
}

/// Random code from an unambiguous alphabet (certificates, purchase keys).
pub fn random_code(n: usize) -> String {
    const A: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    b.iter().map(|x| A[(*x as usize) % A.len()] as char).collect()
}

/// A challenge (purchase) row.
#[derive(Clone, Debug)]
pub struct Challenge {
    pub id: i64,
    pub tenant: String,
    pub user_id: i64,
    pub trader_name: String,
    pub plan_id: String,
    pub plan_name: String,
    pub kind: String,
    pub size: D,
    pub fee: D,
    pub leverage: i32,
    pub engine_group: String,
    pub rules: Plan,
    pub status: String,
    pub phase_index: i32,
    pub fee_refunded: bool,
    pub split_pct: D,
    pub failure_reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub const CHALLENGE_COLS: &str =
    "id, tenant, user_id, trader_name, plan_id, plan_name, kind, size, fee, leverage, engine_group, rules, status, phase_index, fee_refunded, split_pct, failure_reason, created_at";

pub fn challenge_from_row(r: &sqlx::postgres::PgRow) -> Challenge {
    let rules: sqlx::types::Json<Plan> = r.get("rules");
    Challenge {
        id: r.get("id"),
        tenant: r.get("tenant"),
        user_id: r.get("user_id"),
        trader_name: r.get("trader_name"),
        plan_id: r.get("plan_id"),
        plan_name: r.get("plan_name"),
        kind: r.get("kind"),
        size: r.get("size"),
        fee: r.get("fee"),
        leverage: r.get("leverage"),
        engine_group: r.get("engine_group"),
        rules: rules.0,
        status: r.get("status"),
        phase_index: r.get("phase_index"),
        fee_refunded: r.get("fee_refunded"),
        split_pct: r.get("split_pct"),
        failure_reason: r.get("failure_reason"),
        created_at: r.get("created_at"),
    }
}

pub async fn challenge(pool: &PgPool, id: i64) -> sqlx::Result<Option<Challenge>> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {CHALLENGE_COLS} FROM challenges WHERE id = $1"))).bind(id).fetch_optional(pool).await?;
    Ok(r.as_ref().map(challenge_from_row))
}

/// A phase account row (one engine account), with its live rule state.
#[derive(Clone, Debug)]
pub struct PhaseAccount {
    pub id: i64,
    pub tenant: String,
    pub challenge_id: i64,
    pub user_id: i64,
    pub phase_index: i32,
    pub phase_name: String,
    pub funded: bool,
    pub login: Option<i64>,
    pub status: String,
    pub initial_balance: D,
    pub target_pct: Option<D>,
    pub min_days: i32,
    pub time_limit_days: i32,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub end_reason: Option<String>,
    pub day: Option<NaiveDate>,
    pub day_start_balance: Option<D>,
    pub day_start_equity: Option<D>,
    pub hwm: Option<D>,
    pub min_equity: Option<D>,
    pub balance: Option<D>,
    pub equity: Option<D>,
    pub open_positions: i32,
    pub trading_days: i32,
    pub engine_version: i64,
    pub warn_level: i32,
    pub stats: Value,
    pub last_eval_at: Option<DateTime<Utc>>,
    pub last_payout_at: Option<DateTime<Utc>>,
    pub scaled_at: Option<DateTime<Utc>>,
}

pub const PHASE_COLS: &str = "id, tenant, challenge_id, user_id, phase_index, phase_name, funded, login, status, initial_balance, target_pct, min_days,
    time_limit_days, started_at, ended_at, end_reason, day, day_start_balance, day_start_equity, hwm, min_equity, balance, equity, open_positions,
    trading_days, engine_version, warn_level, stats, last_eval_at, last_payout_at, scaled_at";

pub fn phase_from_row(r: &sqlx::postgres::PgRow) -> PhaseAccount {
    let stats: sqlx::types::Json<Value> = r.get("stats");
    PhaseAccount {
        id: r.get("id"),
        tenant: r.get("tenant"),
        challenge_id: r.get("challenge_id"),
        user_id: r.get("user_id"),
        phase_index: r.get("phase_index"),
        phase_name: r.get("phase_name"),
        funded: r.get("funded"),
        login: r.get("login"),
        status: r.get("status"),
        initial_balance: r.get("initial_balance"),
        target_pct: r.get("target_pct"),
        min_days: r.get("min_days"),
        time_limit_days: r.get("time_limit_days"),
        started_at: r.get("started_at"),
        ended_at: r.get("ended_at"),
        end_reason: r.get("end_reason"),
        day: r.get("day"),
        day_start_balance: r.get("day_start_balance"),
        day_start_equity: r.get("day_start_equity"),
        hwm: r.get("hwm"),
        min_equity: r.get("min_equity"),
        balance: r.get("balance"),
        equity: r.get("equity"),
        open_positions: r.get("open_positions"),
        trading_days: r.get("trading_days"),
        engine_version: r.get("engine_version"),
        warn_level: r.get("warn_level"),
        stats: stats.0,
        last_eval_at: r.get("last_eval_at"),
        last_payout_at: r.get("last_payout_at"),
        scaled_at: r.get("scaled_at"),
    }
}

impl PhaseAccount {
    pub fn tracker(&self) -> Tracker {
        let init = self.initial_balance;
        Tracker {
            day: self.day,
            day_start_balance: self.day_start_balance.unwrap_or(init),
            day_start_equity: self.day_start_equity.unwrap_or(init),
            hwm: self.hwm.unwrap_or(init),
            min_equity: self.min_equity.unwrap_or(init),
            warn_level: self.warn_level,
        }
    }
}

pub async fn phase(pool: &PgPool, id: i64) -> sqlx::Result<Option<PhaseAccount>> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {PHASE_COLS} FROM phase_accounts WHERE id = $1"))).bind(id).fetch_optional(pool).await?;
    Ok(r.as_ref().map(phase_from_row))
}

pub async fn phases_of(pool: &PgPool, challenge_id: i64) -> sqlx::Result<Vec<PhaseAccount>> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {PHASE_COLS} FROM phase_accounts WHERE challenge_id = $1 ORDER BY phase_index")))
        .bind(challenge_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.iter().map(phase_from_row).collect())
}

pub async fn active_phases(pool: &PgPool) -> sqlx::Result<Vec<PhaseAccount>> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {PHASE_COLS} FROM phase_accounts WHERE status = 'active' AND login IS NOT NULL ORDER BY id")))
        .fetch_all(pool)
        .await?;
    Ok(rows.iter().map(phase_from_row).collect())
}

pub async fn save_tracker(pool: &PgPool, id: i64, t: &Tracker) -> sqlx::Result<()> {
    sqlx::query("UPDATE phase_accounts SET day = $2, day_start_balance = $3, day_start_equity = $4, hwm = $5, min_equity = $6, warn_level = $7 WHERE id = $1")
        .bind(id)
        .bind(t.day)
        .bind(t.day_start_balance)
        .bind(t.day_start_equity)
        .bind(t.hwm)
        .bind(t.min_equity)
        .bind(t.warn_level)
        .execute(pool)
        .await?;
    Ok(())
}

/// Records a rule event once per `dedupe` key (None = always). Returns true when a new row was written.
#[allow(clippy::too_many_arguments)]
pub async fn rule_event(pool: &PgPool, a: &PhaseAccount, rule: &str, severity: &str, equity: Option<D>, balance: Option<D>, threshold: Option<D>, message: &str, details: Value, dedupe: Option<String>) -> bool {
    let r = sqlx::query(
        "INSERT INTO rule_events (tenant, account_id, challenge_id, user_id, login, rule, severity, equity, balance, threshold, message, details, dedupe_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (account_id, dedupe_key) DO NOTHING",
    )
    .bind(&a.tenant)
    .bind(a.id)
    .bind(a.challenge_id)
    .bind(a.user_id)
    .bind(a.login)
    .bind(rule)
    .bind(severity)
    .bind(equity)
    .bind(balance)
    .bind(threshold)
    .bind(message)
    .bind(sqlx::types::Json(details))
    .bind(dedupe)
    .execute(pool)
    .await;
    match r {
        Ok(x) => x.rows_affected() > 0,
        Err(e) => {
            tracing::error!(error = %e, rule, "rule event write failed");
            false
        }
    }
}

/// JSON view of a phase account (client + admin).
pub fn phase_json(a: &PhaseAccount) -> Value {
    json!({
        "id": a.id, "challengeId": a.challenge_id, "phaseIndex": a.phase_index, "phase": a.phase_name, "funded": a.funded,
        "login": a.login, "status": a.status, "initialBalance": num(a.initial_balance), "targetPct": num_opt(a.target_pct),
        "minDays": a.min_days, "timeLimitDays": a.time_limit_days, "startedAt": a.started_at, "endedAt": a.ended_at, "endReason": a.end_reason,
        "balance": num_opt(a.balance), "equity": num_opt(a.equity), "openPositions": a.open_positions, "tradingDays": a.trading_days,
        "lastEvalAt": a.last_eval_at, "lastPayoutAt": a.last_payout_at, "scaledAt": a.scaled_at,
        "rules": a.stats.get("rules").cloned().unwrap_or(Value::Null),
        "stats": a.stats.get("trading").cloned().unwrap_or(Value::Null),
    })
}

pub fn challenge_json(c: &Challenge, phases: &[PhaseAccount]) -> Value {
    json!({
        "id": c.id, "userId": c.user_id, "traderName": c.trader_name, "planId": c.plan_id, "planName": c.plan_name, "type": c.kind,
        "size": num(c.size), "fee": num(c.fee), "leverage": c.leverage, "group": c.engine_group, "status": c.status, "phaseIndex": c.phase_index,
        "feeRefunded": c.fee_refunded, "split": num(c.split_pct), "failureReason": c.failure_reason, "createdAt": c.created_at,
        "plan": c.rules,
        "phases": phases.iter().map(phase_json).collect::<Vec<_>>(),
        "current": phases.iter().rev().find(|p| p.status == "active").or(phases.last()).map(phase_json),
    })
}
