//! Database: connect (creating the database on first start) + migrate, the config version and the audit log.

use serde_json::Value;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool, Postgres, Transaction};
use std::str::FromStr;

pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("ezymex_options").to_string();
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

/// Bumps the snapshot version inside a write transaction; returns the new version.
pub async fn bump(tx: &mut Transaction<'_, Postgres>) -> anyhow::Result<i64> {
    Ok(sqlx::query_scalar("UPDATE meta SET value = value + 1 WHERE key = 'version' RETURNING value").fetch_one(&mut **tx).await?)
}

pub async fn version(pool: &PgPool) -> anyhow::Result<i64> {
    Ok(sqlx::query_scalar("SELECT value FROM meta WHERE key = 'version'").fetch_one(pool).await?)
}

/// Appends to the audit log.
#[allow(clippy::too_many_arguments)]
pub async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    tenant: &str,
    actor: &str,
    action: &str,
    target: &str,
    before: Option<Value>,
    after: Option<Value>,
    reason: &str,
) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO audit_log (tenant, actor, action, target, before, after, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(tenant)
        .bind(actor)
        .bind(action)
        .bind(target)
        .bind(before)
        .bind(after)
        .bind(reason)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
