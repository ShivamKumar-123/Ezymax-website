//! Append-only audit log (the table rejects UPDATE/DELETE via trigger).

use serde_json::Value;
use sqlx::PgPool;

use crate::state::Ctx;

pub struct Entry<'a> {
    pub tenant_id: i64,
    pub actor_kind: &'a str,
    pub actor_id: Option<i64>,
    pub action: &'a str,
    pub target: Option<(&'a str, i64)>,
    pub meta: Value,
}

/// Writes an audit row. Failures are logged, never surfaced: auditing must not block sign-in,
/// but a failed audit write is loud in the service log.
pub async fn record(pool: &PgPool, ctx: &Ctx, e: Entry<'_>) {
    let res = sqlx::query(
        "INSERT INTO audit_log (tenant_id, actor_kind, actor_id, action, target_kind, target_id, ip, user_agent, meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    )
    .bind(e.tenant_id)
    .bind(e.actor_kind)
    .bind(e.actor_id)
    .bind(e.action)
    .bind(e.target.map(|t| t.0))
    .bind(e.target.map(|t| t.1))
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .bind(sqlx::types::Json(e.meta))
    .execute(pool)
    .await;
    if let Err(err) = res {
        tracing::error!(error = %err, action = e.action, "audit write failed");
    }
}
