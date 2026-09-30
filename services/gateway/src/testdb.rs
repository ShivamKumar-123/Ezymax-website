//! Throwaway PostgreSQL database for handler tests (GATEWAY_TEST_DATABASE_URL, default the local dev server
//! on :5433). `TestDb::new` returns None, with a note, when no server is reachable, so `cargo test` still
//! passes on machines without PostgreSQL.

use crate::config::Config;
use crate::crypto::{self, Keys};
use crate::state::AppState;
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use std::sync::Arc;

pub struct TestDb {
    pub st: AppState,
    admin: PgConnectOptions,
    name: String,
}

impl TestDb {
    pub async fn new(what: &str) -> Option<Self> {
        let base = std::env::var("GATEWAY_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
        let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
        if admin.connect().await.is_err() {
            eprintln!("skipping {what} DB tests: no PostgreSQL at {base}");
            return None;
        }
        let name = format!("kalks_gw_test_{}", crypto::random_token(6).to_lowercase().replace(['-', '_'], "x"));
        let url = admin.clone().database(&name).to_url_lossy().to_string();
        let pool = crate::db::connect(&url).await.expect("create + migrate test database");
        let cfg = Config {
            bind: String::new(),
            database_url: url,
            session_secret: "s".repeat(40),
            internal_token: "t".repeat(40),
            dev_mode: true,
            smtp_configured: false,
            smtp_host: String::new(),
            smtp_port: 0,
            smtp_user: String::new(),
            smtp_password: String::new(),
            smtp_from: String::new(),
            site_url: String::new(),
            app_url: String::new(),
            trade_url: String::new(),
            support_email: String::new(),
            staff_otp_every_login: true,
            super_admin_email: String::new(),
            super_admin_password: String::new(),
            super_admin_name: String::new(),
        };
        let st = AppState { pool, keys: Keys::new(&cfg.session_secret), cfg: Arc::new(cfg), limiter: Default::default(), mailer: None };
        Some(Self { st, admin, name })
    }

    pub async fn drop_db(self) {
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    pub async fn count(&self, sql: &str, id: i64) -> i64 {
        sqlx::query_scalar(sqlx::AssertSqlSafe(sql.to_string())).bind(id).fetch_one(&self.st.pool).await.unwrap()
    }
}
