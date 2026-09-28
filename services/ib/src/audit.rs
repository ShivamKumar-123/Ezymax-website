//! Append-only audit log (UPDATE / DELETE rejected by trigger).

use serde_json::Value;

pub struct Actor {
    /// `staff:<id>`, `user:<id>` or `system`
    pub id: String,
    pub name: Option<String>,
}

impl Actor {
    pub fn system() -> Self {
        Actor { id: "system".into(), name: Some("IB service".into()) }
    }
}

pub async fn record<'e, E: sqlx::PgExecutor<'e>>(ex: E, tenant: &str, actor: &Actor, action: &str, target: Option<String>, before: Option<Value>, after: Option<Value>, note: Option<&str>) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO audit_log (tenant, actor, actor_name, action, target, before, after, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(tenant)
        .bind(&actor.id)
        .bind(&actor.name)
        .bind(action)
        .bind(target)
        .bind(before.map(sqlx::types::Json))
        .bind(after.map(sqlx::types::Json))
        .bind(note)
        .execute(ex)
        .await?;
    Ok(())
}
