//! Connection + migrations, and the per-tenant support settings (defaults on first use).

use serde::{Deserialize, Serialize};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool};
use std::str::FromStr;

/// Connects, creating the database on first run, and applies migrations.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("ezymex_support").to_string();
    let mut admin = opts.clone().database("postgres").connect().await?;
    let exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM pg_database WHERE datname = $1").bind(&db).fetch_optional(&mut admin).await?;
    if exists.is_none() {
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE \"{}\"", db.replace('"', "")))).execute(&mut admin).await?;
        tracing::info!(%db, "created database");
    }
    drop(admin);
    let pool = PgPoolOptions::new().max_connections(16).connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

/// Support desk settings per tenant (Back Office -> Support -> settings).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// AI bot answers new conversations first (D124). Off = straight to the agent queue.
    pub autopilot: bool,
    pub bot_name: String,
    pub greeting: String,
    /// First response after a handover (seconds).
    pub sla_first_secs: i64,
    /// Next agent reply while the client is waiting (seconds).
    pub sla_reply_secs: i64,
    /// Bot answers per client per hour (Claude cost guard).
    pub bot_per_hour: i64,
    /// Email the client an agent's reply when they are not connected.
    pub email_replies: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            autopilot: true,
            bot_name: "Ezymex AI".into(),
            greeting: "Hi, I'm Ezymex AI. Ask me anything about your account, deposits, verification or trading. I can connect you with our support team at any time.".into(),
            sla_first_secs: 300,
            sla_reply_secs: 600,
            bot_per_hour: 40,
            email_replies: true,
        }
    }
}

pub async fn settings(pool: &PgPool, tenant: &str) -> anyhow::Result<Settings> {
    let row: Option<sqlx::types::Json<serde_json::Value>> = sqlx::query_scalar("SELECT data FROM settings WHERE tenant = $1").bind(tenant).fetch_optional(pool).await?;
    Ok(match row {
        Some(v) => serde_json::from_value(v.0).unwrap_or_default(),
        None => Settings::default(),
    })
}

pub async fn save_settings(pool: &PgPool, tenant: &str, s: &Settings, by: &str) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO settings (tenant, data, updated_by) VALUES ($1, $2, $3)
         ON CONFLICT (tenant) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()",
    )
    .bind(tenant)
    .bind(sqlx::types::Json(s))
    .bind(by)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn cursor(pool: &PgPool, name: &str) -> anyhow::Result<Option<String>> {
    Ok(sqlx::query_scalar("SELECT value FROM cursors WHERE name = $1").bind(name).fetch_optional(pool).await?)
}

pub async fn set_cursor(pool: &PgPool, name: &str, value: &str) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO cursors (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()")
        .bind(name)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}
