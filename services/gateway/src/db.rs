use serde_json::json;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool};
use std::str::FromStr;

use crate::config::Config;
use crate::validate;

/// Connects, creating the database on first run, and applies migrations.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("kalks_core").to_string();
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
    crate::rbac::ensure_roles(&pool).await?;
    Ok(pool)
}

/// Creates the Platform Owner staff account for tenant `kalks` from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.
/// Idempotent: an existing account (and its password) is never modified.
pub async fn seed_super_admin(pool: &PgPool, cfg: &Config) -> anyhow::Result<()> {
    if cfg.super_admin_email.is_empty() || cfg.super_admin_password.is_empty() {
        tracing::warn!("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set; skipping super-admin seed");
        return Ok(());
    }
    let email = validate::email(&cfg.super_admin_email).map_err(|m| anyhow::anyhow!("SUPER_ADMIN_EMAIL: {m}"))?;
    let tenant_id: i64 = sqlx::query_scalar("SELECT id FROM tenants WHERE slug = 'kalks'").fetch_one(pool).await?;
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM staff WHERE tenant_id = $1 AND email = $2").bind(tenant_id).bind(&email).fetch_optional(pool).await?;
    if exists.is_some() {
        tracing::info!(%email, "super admin present");
        return Ok(());
    }
    validate::password(&cfg.super_admin_password).map_err(|m| anyhow::anyhow!("SUPER_ADMIN_PASSWORD: {m}"))?;
    let pw = cfg.super_admin_password.clone();
    let hash = tokio::task::spawn_blocking(move || crate::crypto::hash_password(&pw)).await??;
    let id: Option<i64> = sqlx::query_scalar(
        "INSERT INTO staff (tenant_id, email, password_hash, name, role) VALUES ($1,$2,$3,$4,'platform_owner')
         ON CONFLICT (tenant_id, email) DO NOTHING RETURNING id",
    )
    .bind(tenant_id)
    .bind(&email)
    .bind(hash)
    .bind(&cfg.super_admin_name)
    .fetch_optional(pool)
    .await?;
    if let Some(id) = id {
        sqlx::query("UPDATE staff s SET role_id = r.id FROM roles r WHERE s.id = $1 AND r.tenant_id = s.tenant_id AND r.key = 'platform_owner'").bind(id).execute(pool).await?;
        sqlx::query("INSERT INTO audit_log (tenant_id, actor_kind, action, target_kind, target_id, meta) VALUES ($1,'system','staff.seeded','staff',$2,$3)")
            .bind(tenant_id)
            .bind(id)
            .bind(sqlx::types::Json(json!({"role": "platform_owner", "email": email})))
            .execute(pool)
            .await?;
        tracing::info!(%email, id, "super admin created (platform_owner)");
    }
    Ok(())
}
