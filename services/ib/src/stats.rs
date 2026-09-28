//! Network statistics (active clients, network lots) and the monthly level evaluation (D58).

use crate::audit::{self, Actor};
use crate::calc;
use crate::db;
use crate::money::{D, ZERO};
use crate::state::AppState;
use chrono::{DateTime, Duration, Utc};
use serde_json::json;
use sqlx::{PgPool, Row};

/// Direct (tier-1) clients with at least one qualifying closed deal in `[start, end)`.
pub async fn active_clients(pool: &PgPool, tenant: &str, ib: i64, start: DateTime<Utc>, end: DateTime<Utc>) -> anyhow::Result<i64> {
    Ok(sqlx::query_scalar(
        "SELECT count(DISTINCT d.user_id) FROM deals d JOIN members m ON m.user_id = d.user_id
         WHERE m.tenant = $1 AND m.parent_id = $2 AND d.qualified AND NOT d.reversed AND d.close_time >= $3 AND d.close_time < $4",
    )
    .bind(tenant)
    .bind(ib)
    .bind(start)
    .bind(end)
    .fetch_one(pool)
    .await?)
}

/// Qualifying lots traded by the IB's network (every client down to `depth` tiers) in `[start, end)`.
pub async fn network_lots(pool: &PgPool, tenant: &str, ib: i64, depth: i32, start: DateTime<Utc>, end: DateTime<Utc>) -> anyhow::Result<D> {
    let v: Option<D> = sqlx::query_scalar(
        "WITH RECURSIVE down(user_id, depth) AS (
            SELECT user_id, 1 FROM members WHERE tenant = $1 AND parent_id = $2
            UNION ALL
            SELECT m.user_id, d.depth + 1 FROM members m JOIN down d ON m.parent_id = d.user_id WHERE d.depth < $3
         )
         SELECT sum(x.lots) FROM deals x WHERE x.tenant = $1 AND x.qualified AND NOT x.reversed
           AND x.close_time >= $4 AND x.close_time < $5 AND x.user_id IN (SELECT user_id FROM down)",
    )
    .bind(tenant)
    .bind(ib)
    .bind(depth.max(1))
    .bind(start)
    .bind(end)
    .fetch_one(pool)
    .await?;
    Ok(v.unwrap_or(ZERO))
}

/// Evaluates every IB with a network against last month's activity. Runs once per month per tenant.
pub async fn monthly_tick(st: &AppState, tenant: &str) -> anyhow::Result<usize> {
    let (this_month, _) = calc::month_bounds(Utc::now());
    let (start, end) = calc::month_bounds(this_month - Duration::days(1));
    let month = start.format("%Y-%m").to_string();
    let marker = format!("levels:{tenant}:{month}");
    if db::cursor(&st.pool, &marker).await?.is_some() {
        return Ok(0);
    }
    let changed = evaluate(st, tenant, start, end, &month).await?;
    db::set_cursor(&st.pool, &marker, &changed.to_string()).await?;
    Ok(changed)
}

pub async fn evaluate(st: &AppState, tenant: &str, start: DateTime<Utc>, end: DateTime<Utc>, month: &str) -> anyhow::Result<usize> {
    let s = db::settings(&st.pool, tenant).await?;
    let levels = db::levels(&st.pool, tenant).await?;
    let entry = levels.iter().min_by_key(|l| l.rank).map(|l| l.key.clone()).unwrap_or_default();
    let ibs = sqlx::query(
        "SELECT m.user_id, m.level_key, m.level_locked FROM members m
         WHERE m.tenant = $1 AND (m.level_key <> $2 OR EXISTS (SELECT 1 FROM members c WHERE c.parent_id = m.user_id))",
    )
    .bind(tenant)
    .bind(&entry)
    .fetch_all(&st.pool)
    .await?;
    let mut changed = 0;
    for r in ibs {
        let ib: i64 = r.get("user_id");
        let cur: String = r.get("level_key");
        let clients = active_clients(&st.pool, tenant, ib, start, end).await?;
        let lots = network_lots(&st.pool, tenant, ib, s.tiers.len() as i32, start, end).await?;
        if let Some(to) = calc::evaluate_level(&levels, &cur, r.get("level_locked"), s.allow_demotion, clients, lots) {
            let mut tx = st.pool.begin().await?;
            sqlx::query("UPDATE members SET level_key = $2, level_since = now() WHERE user_id = $1").bind(ib).bind(&to).execute(&mut *tx).await?;
            sqlx::query("INSERT INTO level_history (tenant, user_id, from_key, to_key, reason, month, active_clients, lots) VALUES ($1,$2,$3,$4,'monthly',$5,$6,$7)")
                .bind(tenant)
                .bind(ib)
                .bind(&cur)
                .bind(&to)
                .bind(month)
                .bind(clients)
                .bind(lots)
                .execute(&mut *tx)
                .await?;
            audit::record(&mut *tx, tenant, &Actor::system(), "level.change", Some(format!("user:{ib}")), Some(json!({"level": cur})), Some(json!({"level": to, "month": month, "activeClients": clients, "lots": lots.to_string()})), None).await?;
            tx.commit().await?;
            changed += 1;
        }
    }
    tracing::info!(tenant, month, changed, "monthly level evaluation done");
    Ok(changed)
}
