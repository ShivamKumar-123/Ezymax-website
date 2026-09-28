//! Connection + migrations, and the per-tenant programme configuration (seeded with defaults on first use).

use crate::model::{Level, Settings, default_levels};
use crate::money::D;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool, Row};
use std::collections::BTreeMap;
use std::str::FromStr;

/// Connects, creating the database on first run, and applies migrations.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("kalks_ib").to_string();
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

pub async fn settings(pool: &PgPool, tenant: &str) -> anyhow::Result<Settings> {
    let row: Option<sqlx::types::Json<serde_json::Value>> = sqlx::query_scalar("SELECT data FROM settings WHERE tenant = $1").bind(tenant).fetch_optional(pool).await?;
    match row {
        Some(v) => {
            // fields added later fall back to their defaults
            let mut base = serde_json::to_value(Settings::default())?;
            if let (Some(b), Some(o)) = (base.as_object_mut(), v.0.as_object()) {
                for (k, val) in o {
                    b.insert(k.clone(), val.clone());
                }
            }
            Ok(serde_json::from_value(base)?)
        }
        None => {
            let s = Settings::default();
            sqlx::query("INSERT INTO settings (tenant, data, updated_by) VALUES ($1, $2, 'system') ON CONFLICT (tenant) DO NOTHING")
                .bind(tenant)
                .bind(sqlx::types::Json(&s))
                .execute(pool)
                .await?;
            Ok(s)
        }
    }
}

fn level_row(r: &sqlx::postgres::PgRow) -> Level {
    let rates: sqlx::types::Json<BTreeMap<String, D>> = r.get("rates");
    let perks: sqlx::types::Json<Vec<String>> = r.get("perks");
    Level {
        key: r.get("key"),
        name: r.get("name"),
        rank: r.get("rank"),
        rates: rates.0,
        cpa_amount: r.get("cpa_amount"),
        min_active_clients: r.get("min_active_clients"),
        min_monthly_lots: r.get("min_monthly_lots"),
        perks: perks.0,
        icon: r.get("icon"),
    }
}

/// Levels by rank (seeded with Bronze → Diamond on first use).
pub async fn levels(pool: &PgPool, tenant: &str) -> anyhow::Result<Vec<Level>> {
    let rows = sqlx::query("SELECT * FROM levels WHERE tenant = $1 ORDER BY rank").bind(tenant).fetch_all(pool).await?;
    if !rows.is_empty() {
        return Ok(rows.iter().map(level_row).collect());
    }
    let mut tx = pool.begin().await?;
    for l in default_levels() {
        insert_level(&mut tx, tenant, &l).await?;
    }
    tx.commit().await?;
    Ok(default_levels())
}

pub async fn insert_level(tx: &mut sqlx::PgConnection, tenant: &str, l: &Level) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO levels (tenant, key, name, rank, rates, cpa_amount, min_active_clients, min_monthly_lots, perks, icon)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant, key) DO NOTHING",
    )
    .bind(tenant)
    .bind(&l.key)
    .bind(&l.name)
    .bind(l.rank)
    .bind(sqlx::types::Json(&l.rates))
    .bind(l.cpa_amount)
    .bind(l.min_active_clients)
    .bind(l.min_monthly_lots)
    .bind(sqlx::types::Json(&l.perks))
    .bind(&l.icon)
    .execute(tx)
    .await?;
    Ok(())
}

pub async fn entry_level(pool: &PgPool, tenant: &str) -> anyhow::Result<String> {
    let lv = levels(pool, tenant).await?;
    Ok(lv.iter().min_by_key(|l| l.rank).map(|l| l.key.clone()).unwrap_or_else(|| "bronze".into()))
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

/// Tenants the workers serve: every tenant with members, plus the default.
pub async fn tenants(pool: &PgPool) -> anyhow::Result<Vec<String>> {
    let mut t: Vec<String> = sqlx::query_scalar("SELECT DISTINCT tenant FROM members").fetch_all(pool).await?;
    if !t.iter().any(|x| x == "kalks") {
        t.push("kalks".into());
    }
    Ok(t)
}
