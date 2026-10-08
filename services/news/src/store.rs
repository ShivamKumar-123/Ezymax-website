//! Database access: connect + migrate, source seeding, news ingestion (dedupe + tagging) and calendar upserts.

use chrono::{Duration, Utc};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool, Row};
use std::str::FromStr;

use crate::calendar::CalEvent;
use crate::feed::{self, FeedItem};
use crate::sources::{self, SOURCES};
use crate::tagging::{self, SourceHint};

/// Items older than this are not ingested (a first fetch of an archive feed must not flood the timeline).
pub const MAX_AGE_DAYS: i64 = 14;
/// Same headline from another source within this window is a duplicate.
pub const DUP_WINDOW_HOURS: i64 = 48;

pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let opts = PgConnectOptions::from_str(url)?;
    let db = opts.get_database().unwrap_or("ezymex_news").to_string();
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

/// Insert catalogue sources that don't exist yet; refresh name / url / terms of existing ones but keep the
/// staff's `enabled` choice.
pub async fn seed_sources(pool: &PgPool) -> anyhow::Result<()> {
    for s in SOURCES {
        sqlx::query(
            "INSERT INTO sources (id, name, url, homepage, country, kind, interval_secs, enabled, terms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, homepage = EXCLUDED.homepage, country = EXCLUDED.country,
               kind = EXCLUDED.kind, interval_secs = EXCLUDED.interval_secs, terms = EXCLUDED.terms",
        )
        .bind(s.id)
        .bind(s.name)
        .bind(s.url)
        .bind(s.homepage)
        .bind(s.country)
        .bind(s.kind)
        .bind(s.interval_secs)
        .bind(s.enabled)
        .bind(s.terms)
        .execute(pool)
        .await?;
    }
    // the provider stream is a source like the others (rows need a source), off unless configured
    sqlx::query(
        "INSERT INTO sources (id, name, url, homepage, country, kind, interval_secs, enabled, terms)
         VALUES ('infoway', 'Infoway news', 'wss://data.infoway.io/news', 'https://infoway.io', '', 'provider', 0, true,
                 'Market-data provider contract (Infoway real-time news). Headline, teaser and publisher link only.')
         ON CONFLICT (id) DO NOTHING",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub struct Ingest {
    pub inserted: usize,
    pub duplicates: usize,
    pub stale: usize,
}

/// Tag and store new items of one source. Idempotent: the same link (canonicalised) or the same headline
/// from any source within 48 hours is stored once.
pub async fn ingest(pool: &PgPool, source_id: &str, items: &[FeedItem], provider_symbols: &[Vec<String>], provider_country: &[String]) -> anyhow::Result<Ingest> {
    let row = sqlx::query("SELECT country, kind FROM sources WHERE id = $1").bind(source_id).fetch_one(pool).await?;
    let (src_country, kind): (String, String) = (row.get("country"), row.get("kind"));
    let (base, macro_source) = sources::hint(&kind);
    let now = Utc::now();
    let mut out = Ingest { inserted: 0, duplicates: 0, stale: 0 };
    for (i, it) in items.iter().enumerate() {
        let published = it.published.map(|p| if p > now + Duration::hours(1) { now } else { p }).unwrap_or(now);
        if published < now - Duration::days(MAX_AGE_DAYS) {
            out.stale += 1;
            continue;
        }
        let key = feed::dedupe_key(source_id, it);
        let fp = feed::sha(&feed::normalize_title(&it.title));
        let dup: Option<i64> = sqlx::query_scalar("SELECT id FROM items WHERE dedupe_key = $1 OR (title_fp = $2 AND published_at > $3 - make_interval(hours => $4) AND published_at < $3 + make_interval(hours => $4)) LIMIT 1")
            .bind(&key)
            .bind(&fp)
            .bind(published)
            .bind(DUP_WINDOW_HOURS as i32)
            .fetch_optional(pool)
            .await?;
        if dup.is_some() {
            out.duplicates += 1;
            continue;
        }
        let country = provider_country.get(i).filter(|c| !c.is_empty()).cloned().unwrap_or_else(|| src_country.clone());
        let psyms = provider_symbols.get(i).cloned().unwrap_or_default();
        let tags = tagging::tag(&it.title, &it.summary, SourceHint { country: &country, base, macro_source }, &psyms);
        let r = sqlx::query(
            "INSERT INTO items (dedupe_key, title_fp, source_id, title, summary, link, published_at, countries, currencies, symbols, category, sentiment, importance)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (dedupe_key) DO NOTHING",
        )
        .bind(&key)
        .bind(&fp)
        .bind(source_id)
        .bind(&it.title)
        .bind(&it.summary)
        .bind(&it.link)
        .bind(published)
        .bind(&tags.countries)
        .bind(&tags.currencies)
        .bind(&tags.symbols)
        .bind(&tags.category)
        .bind(&tags.sentiment)
        .bind(tags.importance)
        .execute(pool)
        .await?;
        if r.rows_affected() == 1 {
            out.inserted += 1;
        } else {
            out.duplicates += 1;
        }
    }
    if out.inserted > 0 {
        sqlx::query("UPDATE sources SET items_total = (SELECT count(*) FROM items WHERE source_id = $1) WHERE id = $1").bind(source_id).execute(pool).await?;
    }
    Ok(out)
}

#[derive(Debug, Default, PartialEq)]
pub struct CalUpsert {
    pub inserted: usize,
    pub updated: usize,
    /// events whose actual value arrived in this batch
    pub actuals: Vec<i64>,
}

/// Upsert a calendar batch. Feed values win for time / impact / forecast / previous; an actual already set
/// (feed, licensed provider or staff) is only replaced by a non-empty feed actual.
pub async fn upsert_calendar(pool: &PgPool, source: &str, events: &[CalEvent]) -> anyhow::Result<CalUpsert> {
    let mut out = CalUpsert::default();
    for e in events {
        let before: Option<String> = sqlx::query_scalar("SELECT actual FROM calendar_events WHERE ext_key = $1").bind(&e.ext_key).fetch_optional(pool).await?;
        let row = sqlx::query(
            "INSERT INTO calendar_events (ext_key, source, title, currency, country, starts_at, all_day, impact, forecast, previous, actual, actual_at, actual_source, symbols)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $11 <> '' THEN now() END, CASE WHEN $11 <> '' THEN 'feed' END, $12)
             ON CONFLICT (ext_key) DO UPDATE SET
               starts_at = EXCLUDED.starts_at, all_day = EXCLUDED.all_day, impact = EXCLUDED.impact, forecast = EXCLUDED.forecast,
               previous = EXCLUDED.previous, symbols = EXCLUDED.symbols, seen_at = now(),
               actual = CASE WHEN EXCLUDED.actual <> '' THEN EXCLUDED.actual ELSE calendar_events.actual END,
               actual_at = CASE WHEN EXCLUDED.actual <> '' AND EXCLUDED.actual <> calendar_events.actual THEN now() ELSE calendar_events.actual_at END,
               actual_source = CASE WHEN EXCLUDED.actual <> '' AND EXCLUDED.actual <> calendar_events.actual THEN 'feed' ELSE calendar_events.actual_source END,
               updated_at = CASE WHEN (calendar_events.starts_at, calendar_events.impact, calendar_events.forecast, calendar_events.previous) IS DISTINCT FROM
                                      (EXCLUDED.starts_at, EXCLUDED.impact, EXCLUDED.forecast, EXCLUDED.previous)
                                   OR (EXCLUDED.actual <> '' AND EXCLUDED.actual <> calendar_events.actual) THEN now() ELSE calendar_events.updated_at END
             RETURNING id, (xmax = 0) AS inserted",
        )
        .bind(&e.ext_key)
        .bind(source)
        .bind(&e.title)
        .bind(&e.currency)
        .bind(&e.country)
        .bind(e.starts_at)
        .bind(e.all_day)
        .bind(e.impact)
        .bind(&e.forecast)
        .bind(&e.previous)
        .bind(&e.actual)
        .bind(&e.symbols)
        .fetch_one(pool)
        .await?;
        let inserted: bool = row.get("inserted");
        if inserted {
            out.inserted += 1;
        } else {
            out.updated += 1;
        }
        if !e.actual.is_empty() && before.as_deref() != Some(e.actual.as_str()) {
            out.actuals.push(row.get("id"));
        }
    }
    Ok(out)
}

/// Set an actual value from a secondary source (licensed provider or staff).
pub async fn set_actual(pool: &PgPool, id: i64, actual: &str, source: &str) -> anyhow::Result<bool> {
    let r = sqlx::query("UPDATE calendar_events SET actual = $2, actual_at = CASE WHEN $2 = '' THEN NULL ELSE now() END, actual_source = CASE WHEN $2 = '' THEN NULL ELSE $3 END, updated_at = now() WHERE id = $1 AND actual IS DISTINCT FROM $2")
        .bind(id)
        .bind(actual)
        .bind(source)
        .execute(pool)
        .await?;
    Ok(r.rows_affected() == 1)
}

/// Housekeeping: news older than 180 days without a staff decision, calendar older than 3 years.
pub async fn prune(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM items i WHERE published_at < now() - interval '180 days' AND NOT EXISTS (SELECT 1 FROM item_overrides o WHERE o.item_id = i.id AND o.pinned)").execute(pool).await?;
    sqlx::query("DELETE FROM calendar_events WHERE starts_at < now() - interval '3 years'").execute(pool).await?;
    Ok(())
}

pub async fn audit(pool: &PgPool, tenant: &str, staff: &str, action: &str, target: &str, detail: serde_json::Value) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO audit (tenant, staff, action, target, detail) VALUES ($1,$2,$3,$4,$5)").bind(tenant).bind(staff).bind(action).bind(target).bind(detail).execute(pool).await?;
    Ok(())
}

/// Re-run the tagging rules over recent items (called on start, so rule changes apply to the live feed).
/// Staff overrides live in `item_overrides` and are untouched.
pub async fn retag_recent(pool: &PgPool) -> anyhow::Result<usize> {
    let rows = sqlx::query("SELECT i.id, i.title, i.summary, s.country, s.kind FROM items i JOIN sources s ON s.id = i.source_id WHERE i.published_at > now() - interval '30 days' AND i.source_id <> 'infoway'").fetch_all(pool).await?;
    let mut changed = 0;
    for r in &rows {
        let (base, macro_source) = sources::hint(&r.get::<String, _>("kind"));
        let country: String = r.get("country");
        let t = tagging::tag(&r.get::<String, _>("title"), &r.get::<String, _>("summary"), SourceHint { country: &country, base, macro_source }, &[]);
        let res = sqlx::query(
            "UPDATE items SET countries = $2, currencies = $3, symbols = $4, category = $5, sentiment = $6, importance = $7
              WHERE id = $1 AND (countries, currencies, symbols, category, sentiment, importance) IS DISTINCT FROM ($2, $3, $4, $5, $6, $7)",
        )
        .bind(r.get::<i64, _>("id"))
        .bind(&t.countries)
        .bind(&t.currencies)
        .bind(&t.symbols)
        .bind(&t.category)
        .bind(&t.sentiment)
        .bind(t.importance)
        .execute(pool)
        .await?;
        changed += res.rows_affected() as usize;
    }
    Ok(changed)
}
