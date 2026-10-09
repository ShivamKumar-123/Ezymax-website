//! Connection + migrations and the worker cursors.

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool};
use std::str::FromStr;

/// Connects, creating the database on first run, and applies migrations.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("ezymex_staking").to_string();
    let mut admin = opts.clone().database("postgres").connect().await?;
    let exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM pg_database WHERE datname = $1").bind(&db).fetch_optional(&mut admin).await?;
    if exists.is_none() {
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE \"{}\"", db.replace('"', "")))).execute(&mut admin).await?;
        tracing::info!(%db, "created database");
    }
    drop(admin);
    let pool = PgPoolOptions::new().max_connections(20).connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

pub async fn cursor(pool: &PgPool, name: &str) -> anyhow::Result<Option<(String, chrono::DateTime<chrono::Utc>)>> {
    Ok(sqlx::query_as("SELECT value, updated_at FROM cursors WHERE name = $1").bind(name).fetch_optional(pool).await?)
}

pub async fn set_cursor(pool: &PgPool, name: &str, value: &str) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO cursors (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()")
        .bind(name)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}
