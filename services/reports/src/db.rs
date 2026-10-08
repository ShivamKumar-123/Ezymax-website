//! Connection + migrations, cursors and the audit log.

use serde_json::Value;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool};
use std::str::FromStr;

pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("ezymex_reports").to_string();
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
        Actor { id: "system".into(), name: "Report scheduler".into(), role: "system".into() }
    }
    pub fn user(id: i64) -> Self {
        Actor { id: format!("user:{id}"), name: String::new(), role: "client".into() }
    }
}

pub async fn audit(pool: &PgPool, tenant: &str, actor: &Actor, action: &str, target: Option<&str>, detail: Option<Value>) {
    let r = sqlx::query("INSERT INTO audit_log (tenant, actor, actor_name, actor_role, action, target, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(tenant)
        .bind(&actor.id)
        .bind(&actor.name)
        .bind(&actor.role)
        .bind(action)
        .bind(target)
        .bind(detail.map(sqlx::types::Json))
        .execute(pool)
        .await;
    if let Err(e) = r {
        tracing::error!(error = %e, action, "audit write failed");
    }
}

pub async fn get_cursor(pool: &PgPool, tenant: &str, name: &str) -> Option<Value> {
    sqlx::query_scalar::<_, sqlx::types::Json<Value>>("SELECT value FROM cursors WHERE tenant = $1 AND name = $2")
        .bind(tenant)
        .bind(name)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .map(|j| j.0)
}

pub async fn set_cursor(pool: &PgPool, tenant: &str, name: &str, value: &Value) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO cursors (tenant, name, value) VALUES ($1,$2,$3) ON CONFLICT (tenant, name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()")
        .bind(tenant)
        .bind(name)
        .bind(sqlx::types::Json(value))
        .execute(pool)
        .await?;
    Ok(())
}
