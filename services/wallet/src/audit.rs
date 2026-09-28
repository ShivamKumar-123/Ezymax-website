//! Append-only audit log of staff and system actions (before / after values, reason, ip, user agent).

use serde_json::Value;
use sqlx::{Postgres, Transaction};

use crate::state::StaffCtx;

pub struct Entry<'a> {
    pub action: &'a str,
    pub target_kind: &'a str,
    pub target_id: String,
    pub reason: Option<&'a str>,
    pub before: Option<Value>,
    pub after: Option<Value>,
}

pub async fn staff(tx: &mut Transaction<'_, Postgres>, s: &StaffCtx, e: Entry<'_>) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO audit_log (tenant_id, actor_kind, actor_id, actor_name, actor_role, action, target_kind, target_id, reason, before, after, ip, user_agent)
         VALUES ($1, 'staff', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    )
    .bind(s.ctx.tenant.id)
    .bind(&s.staff.id)
    .bind(&s.staff.name)
    .bind(&s.staff.role)
    .bind(e.action)
    .bind(e.target_kind)
    .bind(&e.target_id)
    .bind(e.reason)
    .bind(e.before.map(sqlx::types::Json))
    .bind(e.after.map(sqlx::types::Json))
    .bind(&s.ctx.ip)
    .bind(&s.ctx.user_agent)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn system(tx: &mut Transaction<'_, Postgres>, tenant_id: i64, action: &str, target_kind: &str, target_id: String, after: Option<Value>) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO audit_log (tenant_id, actor_kind, actor_id, action, target_kind, target_id, after) VALUES ($1, 'system', 'wallet', $2, $3, $4, $5)")
        .bind(tenant_id)
        .bind(action)
        .bind(target_kind)
        .bind(target_id)
        .bind(after.map(sqlx::types::Json))
        .execute(&mut **tx)
        .await?;
    Ok(())
}
