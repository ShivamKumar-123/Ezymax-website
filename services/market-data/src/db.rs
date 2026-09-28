use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool, Row};
use std::str::FromStr;

use crate::instruments::Catalogue;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Bar {
    #[serde(serialize_with = "ser_secs")]
    pub t: DateTime<Utc>,
    pub o: f64,
    pub h: f64,
    pub l: f64,
    pub c: f64,
    pub v: f64,
}

fn ser_secs<S: serde::Serializer>(t: &DateTime<Utc>, s: S) -> Result<S::Ok, S::Error> {
    s.serialize_i64(t.timestamp())
}

/// Where a bar came from — decides how conflicts merge.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    Live = 0,
    Provider = 1,
    Aggregated = 2,
    /// Closed bar replaced by the provider's final OHLC — authoritative, never overwritten.
    Reconciled = 3,
}

/// Connects, creating the database on first run, and applies migrations.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("kalks").to_string();
    // create the database if it doesn't exist (connect to the maintenance DB first)
    let admin = opts.clone().database("postgres");
    let mut conn = admin.connect().await?;
    let exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM pg_database WHERE datname = $1").bind(&db).fetch_optional(&mut conn).await?;
    if exists.is_none() {
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE \"{}\"", db.replace('"', "")))).execute(&mut conn).await?;
        tracing::info!(%db, "created database");
    }
    drop(conn);
    let pool = PgPoolOptions::new().max_connections(12).connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

pub async fn sync_instruments(pool: &PgPool, cat: &Catalogue) -> anyhow::Result<()> {
    for x in &cat.list {
        sqlx::query(
            "INSERT INTO instruments (symbol, asset_class, digits, base_spread, provider_market, provider_code, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6, now())
             ON CONFLICT (symbol) DO UPDATE SET asset_class = EXCLUDED.asset_class, digits = EXCLUDED.digits,
               base_spread = EXCLUDED.base_spread, provider_market = EXCLUDED.provider_market,
               provider_code = EXCLUDED.provider_code, updated_at = now()",
        )
        .bind(&x.symbol)
        .bind(&x.asset_class)
        .bind(x.digits as i16)
        .bind(x.base_spread)
        .bind(&x.provider.market)
        .bind(&x.provider.code)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Batch upsert. Merge rules:
/// - Live bar vs existing: keep the existing open, widen high/low, take the live close.
/// - Provider / aggregated bar vs existing: provider OHLC wins, but high/low are widened with what we saw live.
/// - Reconciled bar: exact overwrite; nothing else may change a reconciled row afterwards.
pub async fn upsert_bars(pool: &PgPool, rows: &[(String, i32, Bar)], source: Source) -> anyhow::Result<()> {
    if rows.is_empty() {
        return Ok(());
    }
    for chunk in rows.chunks(5000) {
        let mut sym = Vec::with_capacity(chunk.len());
        let mut tf = Vec::with_capacity(chunk.len());
        let mut t = Vec::with_capacity(chunk.len());
        let (mut o, mut h, mut l, mut c, mut v) = (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
        for (s, f, b) in chunk {
            sym.push(s.clone());
            tf.push(*f);
            t.push(b.t);
            o.push(b.o);
            h.push(b.h);
            l.push(b.l);
            c.push(b.c);
            v.push(b.v);
        }
        let on_conflict = match source {
            Source::Reconciled => "o = EXCLUDED.o, h = EXCLUDED.h, l = EXCLUDED.l, c = EXCLUDED.c, v = EXCLUDED.v, source = EXCLUDED.source",
            Source::Live => {
                "o = candles.o, h = GREATEST(candles.h, EXCLUDED.h), l = LEAST(candles.l, EXCLUDED.l), c = EXCLUDED.c,
                 v = GREATEST(candles.v, EXCLUDED.v)"
            }
            _ => {
                "o = EXCLUDED.o, h = GREATEST(EXCLUDED.h, CASE WHEN candles.source = 0 THEN candles.h ELSE EXCLUDED.h END),
                 l = LEAST(EXCLUDED.l, CASE WHEN candles.source = 0 THEN candles.l ELSE EXCLUDED.l END),
                 c = CASE WHEN candles.source = 0 THEN candles.c ELSE EXCLUDED.c END, v = EXCLUDED.v, source = EXCLUDED.source"
            }
        };
        let sql = format!(
            "INSERT INTO candles (symbol, tf, t, o, h, l, c, v, source)
             SELECT s, f, ts, o, h, l, c, v, {src} FROM UNNEST($1::text[], $2::int4[], $3::timestamptz[], $4::float8[], $5::float8[], $6::float8[], $7::float8[], $8::float8[])
               AS x(s, f, ts, o, h, l, c, v)
             ON CONFLICT (symbol, tf, t) DO UPDATE SET {on_conflict}{guard}",
            src = source as i16,
            guard = if matches!(source, Source::Reconciled) { "" } else { " WHERE candles.source <> 3" }
        );
        sqlx::query(sqlx::AssertSqlSafe(sql)).bind(&sym).bind(&tf).bind(&t).bind(&o).bind(&h).bind(&l).bind(&c).bind(&v).execute(pool).await?;
    }
    Ok(())
}

pub async fn insert_ticks(pool: &PgPool, rows: &[(String, DateTime<Utc>, Option<f64>, Option<f64>, Option<f64>)]) -> anyhow::Result<()> {
    if rows.is_empty() {
        return Ok(());
    }
    let sym: Vec<String> = rows.iter().map(|r| r.0.clone()).collect();
    let t: Vec<DateTime<Utc>> = rows.iter().map(|r| r.1).collect();
    let bid: Vec<Option<f64>> = rows.iter().map(|r| r.2).collect();
    let ask: Vec<Option<f64>> = rows.iter().map(|r| r.3).collect();
    let last: Vec<Option<f64>> = rows.iter().map(|r| r.4).collect();
    sqlx::query("INSERT INTO ticks (symbol, t, bid, ask, last) SELECT * FROM UNNEST($1::text[], $2::timestamptz[], $3::float8[], $4::float8[], $5::float8[])")
        .bind(&sym)
        .bind(&t)
        .bind(&bid)
        .bind(&ask)
        .bind(&last)
        .execute(pool)
        .await?;
    Ok(())
}

/// Bars in ascending time order, ending at or before `to` (inclusive), newest `limit`.
pub async fn load_bars(pool: &PgPool, symbol: &str, tf: i32, to: Option<DateTime<Utc>>, from: Option<DateTime<Utc>>, limit: i64) -> anyhow::Result<Vec<Bar>> {
    let rows = sqlx::query(
        "SELECT t, o, h, l, c, v FROM candles
         WHERE symbol = $1 AND tf = $2 AND ($3::timestamptz IS NULL OR t <= $3) AND ($4::timestamptz IS NULL OR t >= $4)
         ORDER BY t DESC LIMIT $5",
    )
    .bind(symbol)
    .bind(tf)
    .bind(to)
    .bind(from)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    let mut out: Vec<Bar> = rows
        .into_iter()
        .map(|r| Bar { t: r.get("t"), o: r.get("o"), h: r.get("h"), l: r.get("l"), c: r.get("c"), v: r.get("v") })
        .collect();
    out.reverse();
    Ok(out)
}

pub async fn oldest_bar(pool: &PgPool, symbol: &str, tf: i32) -> anyhow::Result<Option<DateTime<Utc>>> {
    Ok(sqlx::query_scalar("SELECT min(t) FROM candles WHERE symbol = $1 AND tf = $2").bind(symbol).bind(tf).fetch_one(pool).await?)
}

pub async fn bar_counts(pool: &PgPool) -> anyhow::Result<Vec<(String, i32, i64, Option<DateTime<Utc>>, Option<DateTime<Utc>>)>> {
    let rows = sqlx::query("SELECT symbol, tf, count(*) AS n, min(t) AS first, max(t) AS last FROM candles GROUP BY symbol, tf ORDER BY symbol, tf")
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|r| (r.get("symbol"), r.get("tf"), r.get("n"), r.get("first"), r.get("last"))).collect())
}
