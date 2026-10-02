//! Persistence of the book actors (PostgreSQL, migrations/20261012000000_options_book.sql).
//!
//! * `commit`: ONE transaction per batch: `book_journal` (seq, cmd, out), buffered `book_quote_journal` rows,
//!   `book_orders` (non-ephemeral orders the batch touched: resting = `open`, finished = their final status),
//!   `book_positions`, `book_series`, `book_fills` and the persisted `book_outbox` rows.
//! * `load`: the actor's state at start: `book_series` + open `book_orders` (by priority) + `book_positions`, the
//!   last seq (journal and quote journal) and the outbox items not applied yet.
//! * `replay`: re-runs `matching::apply` over journal entries and compares every output byte for byte (the
//!   nightly audit; tests run it after every scenario).

use serde_json::Value;
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use super::outbox::{Item, Row as OutRow};
use super::types::*;
use crate::model::Side;

/// One journaled command.
#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
    pub seq: u64,
    pub cmd: Cmd,
    pub out: Out,
}

fn kind_str(k: &BookKey) -> &'static str {
    k.kind.as_str()
}

fn ts(ms: i64) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp_millis(ms).unwrap_or_default()
}

async fn insert_entries(tx: &mut Transaction<'_, Postgres>, key: &BookKey, entries: &[Entry], quote: bool) -> anyhow::Result<()> {
    for e in entries {
        let (login, order_id, cid) = e.cmd.order_ref();
        if quote {
            sqlx::query("INSERT INTO book_quote_journal (tenant_id, kind, underlying, seq, cmd_kind, cmd, out, login, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING")
                .bind(key.tenant_id)
                .bind(kind_str(key))
                .bind(&key.underlying)
                .bind(e.seq as i64)
                .bind(e.cmd.kind())
                .bind(sqlx::types::Json(&e.cmd))
                .bind(sqlx::types::Json(&e.out))
                .bind(login)
                .bind(ts(e.cmd.at()))
                .execute(&mut **tx)
                .await?;
        } else {
            sqlx::query("INSERT INTO book_journal (tenant_id, kind, underlying, seq, cmd_kind, cmd, out, login, order_id, client_order_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)")
                .bind(key.tenant_id)
                .bind(kind_str(key))
                .bind(&key.underlying)
                .bind(e.seq as i64)
                .bind(e.cmd.kind())
                .bind(sqlx::types::Json(&e.cmd))
                .bind(sqlx::types::Json(&e.out))
                .bind(login)
                .bind(order_id)
                .bind(cid)
                .bind(ts(e.cmd.at()))
                .execute(&mut **tx)
                .await?;
        }
    }
    Ok(())
}

/// Writes buffered market-maker commands (asynchronous path, every second).
pub async fn flush_quotes(pool: &PgPool, key: &BookKey, quotes: &[Entry]) -> anyhow::Result<()> {
    if quotes.is_empty() {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    insert_entries(&mut tx, key, quotes, true).await?;
    tx.commit().await?;
    Ok(())
}

async fn upsert_order(tx: &mut Transaction<'_, Postgres>, key: &BookKey, series: &str, spec: &SeriesSpec, o: &Resting, status: &str, reason: Option<&str>, at_ms: i64) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO book_orders (id, tenant_id, kind, underlying, series, login, stp, side, px, price, qty, left_qty, filled, notional, prio, tif, flags, expire_at,
                                  reserve_per_step, status, reason, client_order_id, data, created_at, updated_at, done_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, now(), $25)
         ON CONFLICT (id) DO UPDATE SET px = EXCLUDED.px, price = EXCLUDED.price, qty = EXCLUDED.qty, left_qty = EXCLUDED.left_qty, filled = EXCLUDED.filled,
            notional = EXCLUDED.notional, prio = EXCLUDED.prio, reserve_per_step = EXCLUDED.reserve_per_step, status = EXCLUDED.status, reason = EXCLUDED.reason,
            data = EXCLUDED.data, updated_at = now(), done_at = EXCLUDED.done_at",
    )
    .bind(o.id)
    .bind(key.tenant_id)
    .bind(kind_str(key))
    .bind(&key.underlying)
    .bind(series)
    .bind(o.login)
    .bind(o.stp)
    .bind(o.side.as_str())
    .bind(o.px)
    .bind(spec.price(o.px))
    .bind(o.qty)
    .bind(o.left)
    .bind(o.filled)
    .bind(o.notional)
    .bind(o.prio as i64)
    .bind(o.tif.as_str())
    .bind(o.flags as i32)
    .bind(o.expire_ms.map(ts))
    .bind(o.reserve_per_step)
    .bind(status)
    .bind(reason)
    .bind(&o.ext.client_order_id)
    .bind(sqlx::types::Json(o))
    .bind(ts(if o.ext.created_ms > 0 { o.ext.created_ms } else { at_ms }))
    .bind((status != "open").then(|| ts(at_ms)))
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// What a batch changed, collected from its outputs.
#[derive(Default)]
struct Touched {
    /// order id → (series, last final state from a Done, reason)
    done: BTreeMap<i64, (String, Resting, DoneStatus, String)>,
    /// order ids that may be resting now: series
    orders: BTreeMap<i64, String>,
    positions: BTreeSet<(String, i64)>,
    series: BTreeSet<String>,
}

fn touched(entries: &[Entry]) -> Touched {
    let mut t = Touched::default();
    for e in entries {
        for f in &e.out.fills {
            t.positions.insert((f.series.clone(), f.maker.login));
            t.positions.insert((f.series.clone(), f.taker.login));
            for p in [&f.maker, &f.taker] {
                if let Some(o) = &p.order {
                    t.orders.insert(o.id, f.series.clone());
                }
            }
        }
        for d in &e.out.done {
            t.done.insert(d.id, (d.series.clone(), d.order.clone(), d.status, d.reason.clone()));
        }
        for a in &e.out.amended {
            t.orders.insert(a.id, a.series.clone());
        }
        match &e.cmd {
            Cmd::New { series, order, .. } => {
                t.orders.insert(order.id, series.clone());
            }
            Cmd::Seed { series, entries, .. } if e.out.ok => {
                for (l, _) in entries {
                    t.positions.insert((series.clone(), *l));
                }
            }
            _ => {}
        }
        for r in &e.out.rested {
            if let Cmd::New { series, .. } = &e.cmd {
                t.orders.insert(*r, series.clone());
            }
        }
        t.series.extend(e.out.touched.iter().cloned());
    }
    t
}

/// The group commit of one batch.
pub async fn commit(pool: &PgPool, key: &BookKey, entries: &[Entry], quotes: &[Entry], prev: &UnderlyingBooks, books: &UnderlyingBooks, rows: &[OutRow]) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    insert_entries(&mut tx, key, quotes, true).await?;
    insert_entries(&mut tx, key, entries, false).await?;
    let t = touched(entries);
    let at = entries.last().map(|e| e.cmd.at()).unwrap_or_default();
    // orders: still resting → open with the current state; else its final state
    let mut seen = BTreeSet::new();
    for (id, series) in &t.orders {
        if let Some(sb) = books.book(series)
            && let Some(o) = sb.orders.get(id)
        {
            seen.insert(*id);
            if !o.ephemeral() {
                upsert_order(&mut tx, key, series, &sb.spec, o, "open", None, at).await?;
            }
        }
    }
    for (id, (series, o, status, reason)) in &t.done {
        if seen.contains(id) || o.ephemeral() {
            continue;
        }
        // a resting order elsewhere with this id (duplicate rejection) is not touched
        if books.series.values().any(|sb| sb.orders.contains_key(id)) {
            continue;
        }
        let spec = entries.iter().find_map(|e| match &e.cmd {
            Cmd::New { series: s, spec, .. } if s == series => Some(spec.clone()),
            _ => None,
        });
        let spec = spec.or_else(|| books.book(series).map(|b| b.spec.clone())).or_else(|| prev.book(series).map(|b| b.spec.clone()));
        let Some(spec) = spec else { continue };
        upsert_order(&mut tx, key, series, &spec, o, status.as_str(), Some(reason), at).await?;
    }
    for (series, login) in &t.positions {
        let steps = books.book(series).map(|b| b.position(*login)).unwrap_or(0);
        if steps == 0 {
            sqlx::query("DELETE FROM book_positions WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND series = $4 AND login = $5")
                .bind(key.tenant_id)
                .bind(kind_str(key))
                .bind(&key.underlying)
                .bind(series)
                .bind(login)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query(
                "INSERT INTO book_positions (tenant_id, kind, underlying, series, login, steps, updated_seq) VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (tenant_id, kind, underlying, series, login) DO UPDATE SET steps = EXCLUDED.steps, updated_seq = EXCLUDED.updated_seq, updated_at = now()",
            )
            .bind(key.tenant_id)
            .bind(kind_str(key))
            .bind(&key.underlying)
            .bind(series)
            .bind(login)
            .bind(steps)
            .bind(books.seq as i64)
            .execute(&mut *tx)
            .await?;
        }
    }
    for series in &t.series {
        match books.book(series) {
            Some(sb) => {
                sqlx::query(
                    "INSERT INTO book_series (tenant_id, kind, underlying, series, state, spec, last_px, last_qty, vol_day, vol, updated_seq) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (tenant_id, kind, underlying, series) DO UPDATE SET state = EXCLUDED.state, spec = EXCLUDED.spec, last_px = EXCLUDED.last_px,
                        last_qty = EXCLUDED.last_qty, vol_day = EXCLUDED.vol_day, vol = EXCLUDED.vol, updated_seq = EXCLUDED.updated_seq, updated_at = now()",
                )
                .bind(key.tenant_id)
                .bind(kind_str(key))
                .bind(&key.underlying)
                .bind(series)
                .bind(sb.state.as_str())
                .bind(sqlx::types::Json(&sb.spec))
                .bind(sb.last.map(|l| l.0))
                .bind(sb.last.map(|l| l.1))
                .bind(sb.vol_day.0)
                .bind(sb.vol_day.1)
                .bind(books.seq as i64)
                .execute(&mut *tx)
                .await?;
            }
            None => {
                // purged after settlement: the series and its positions are gone
                for table in ["book_series", "book_positions"] {
                    sqlx::query(sqlx::AssertSqlSafe(format!("DELETE FROM {table} WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND series = $4")))
                        .bind(key.tenant_id)
                        .bind(kind_str(key))
                        .bind(&key.underlying)
                        .bind(series)
                        .execute(&mut *tx)
                        .await?;
                }
            }
        }
    }
    for e in entries {
        for f in &e.out.fills {
            sqlx::query(
                "INSERT INTO book_fills (tenant_id, fill_id, kind, underlying, seq, series, px, price, qty, contracts, maker_login, taker_login, maker_order, taker_order,
                                         aggressor, fill_kind, combo, usd_per_quote, premium_usd, at, data)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)",
            )
            .bind(key.tenant_id)
            .bind(&f.id)
            .bind(kind_str(key))
            .bind(&key.underlying)
            .bind(f.seq as i64)
            .bind(&f.series)
            .bind(f.px)
            .bind(f.spec.price(f.px))
            .bind(f.qty)
            .bind(f.spec.contracts(f.qty))
            .bind(f.maker.login)
            .bind(f.taker.login)
            .bind(f.maker.order.as_ref().map(|o| o.id))
            .bind(f.taker.order.as_ref().map(|o| o.id))
            .bind(f.aggressor().as_str())
            .bind(f.kind.as_str())
            .bind(f.combo)
            .bind(f.usd_per_quote)
            .bind(f.premium_usd)
            .bind(ts(f.at))
            .bind(sqlx::types::Json(f))
            .execute(&mut *tx)
            .await?;
        }
    }
    for r in rows.iter().filter(|r| r.persist) {
        let kind = match &r.item {
            Item::Fill { .. } => "fill",
            Item::Done { .. } => "done",
            Item::Amended { .. } => "amended",
            Item::Release { .. } => "release",
        };
        sqlx::query("INSERT INTO book_outbox (tenant_id, kind, underlying, seq, book_seq, login, item_kind, item) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(key.tenant_id)
            .bind(kind_str(key))
            .bind(&key.underlying)
            .bind(r.seq as i64)
            .bind(r.book_seq as i64)
            .bind(r.login)
            .bind(kind)
            .bind(sqlx::types::Json(&r.item))
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Highest journaled seq of an actor (durable journal and quote journal).
pub async fn last_seq(pool: &PgPool, key: &BookKey) -> anyhow::Result<u64> {
    let a: Option<i64> = sqlx::query_scalar("SELECT max(seq) FROM book_journal WHERE tenant_id = $1 AND kind = $2 AND underlying = $3").bind(key.tenant_id).bind(kind_str(key)).bind(&key.underlying).fetch_one(pool).await?;
    let b: Option<i64> = sqlx::query_scalar("SELECT max(seq) FROM book_quote_journal WHERE tenant_id = $1 AND kind = $2 AND underlying = $3").bind(key.tenant_id).bind(kind_str(key)).bind(&key.underlying).fetch_one(pool).await?;
    Ok(a.unwrap_or(0).max(b.unwrap_or(0)).max(0) as u64)
}

/// Highest durable journal seq (commit verification).
pub async fn last_durable_seq(pool: &PgPool, key: &BookKey) -> anyhow::Result<u64> {
    let a: Option<i64> = sqlx::query_scalar("SELECT max(seq) FROM book_journal WHERE tenant_id = $1 AND kind = $2 AND underlying = $3").bind(key.tenant_id).bind(kind_str(key)).bind(&key.underlying).fetch_one(pool).await?;
    Ok(a.unwrap_or(0).max(0) as u64)
}

pub struct Loaded {
    pub books: UnderlyingBooks,
    pub outbox_seq: u64,
    pub pending: Vec<OutRow>,
}

/// The actor's state from the projections (ephemeral orders are gone: the caller journals a `RestartCancel`).
pub async fn load(pool: &PgPool, key: &BookKey) -> anyhow::Result<Loaded> {
    let k = kind_str(key);
    let mut books = UnderlyingBooks::new(key.clone());
    books.seq = last_seq(pool, key).await?;
    let mut orders: BTreeMap<String, Vec<Resting>> = BTreeMap::new();
    for r in sqlx::query("SELECT series, data FROM book_orders WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND status = 'open' ORDER BY prio, id")
        .bind(key.tenant_id)
        .bind(k)
        .bind(&key.underlying)
        .fetch_all(pool)
        .await?
    {
        let o: sqlx::types::Json<Resting> = r.get("data");
        orders.entry(r.get("series")).or_default().push(o.0);
    }
    let mut pos: BTreeMap<String, BTreeMap<i64, Steps>> = BTreeMap::new();
    for r in sqlx::query("SELECT series, login, steps FROM book_positions WHERE tenant_id = $1 AND kind = $2 AND underlying = $3").bind(key.tenant_id).bind(k).bind(&key.underlying).fetch_all(pool).await? {
        let steps: i64 = r.get("steps");
        if steps != 0 {
            pos.entry(r.get("series")).or_default().insert(r.get("login"), steps);
        }
    }
    for r in sqlx::query("SELECT series, state, spec, last_px, last_qty, vol_day, vol FROM book_series WHERE tenant_id = $1 AND kind = $2 AND underlying = $3").bind(key.tenant_id).bind(k).bind(&key.underlying).fetch_all(pool).await? {
        let series: String = r.get("series");
        let spec: sqlx::types::Json<SeriesSpec> = r.get("spec");
        let state = match r.get::<String, _>("state").as_str() {
            "open" => SeriesState::Open,
            "cancel_only" => SeriesState::CancelOnly,
            _ => SeriesState::Closed,
        };
        let last = match (r.get::<Option<i64>, _>("last_px"), r.get::<Option<i64>, _>("last_qty")) {
            (Some(p), Some(q)) => Some((p, q)),
            _ => None,
        };
        let sb = SeriesBook::from_parts(&series, spec.0, state, orders.remove(&series).unwrap_or_default(), pos.remove(&series).unwrap_or_default(), last, (r.get("vol_day"), r.get("vol")));
        books.series.insert(series, Arc::new(sb));
    }
    if !orders.is_empty() || !pos.is_empty() {
        anyhow::bail!("{}: book orders / positions without a book_series row ({:?} {:?})", key.label(), orders.keys().collect::<Vec<_>>(), pos.keys().collect::<Vec<_>>());
    }
    let outbox_seq: Option<i64> = sqlx::query_scalar("SELECT max(seq) FROM book_outbox WHERE tenant_id = $1 AND kind = $2 AND underlying = $3").bind(key.tenant_id).bind(k).bind(&key.underlying).fetch_one(pool).await?;
    let mut pending = Vec::new();
    for r in sqlx::query("SELECT seq, book_seq, login, item FROM book_outbox WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND status <> 'applied' ORDER BY seq").bind(key.tenant_id).bind(k).bind(&key.underlying).fetch_all(pool).await? {
        let item: sqlx::types::Json<Item> = r.get("item");
        pending.push(OutRow { seq: r.get::<i64, _>("seq") as u64, book_seq: r.get::<i64, _>("book_seq") as u64, login: r.get("login"), item: item.0, persist: true });
    }
    Ok(Loaded { books, outbox_seq: outbox_seq.unwrap_or(0).max(0) as u64, pending })
}

pub async fn mark_applied(pool: &PgPool, key: &BookKey, seq: u64, attempts: u32) -> anyhow::Result<()> {
    sqlx::query("UPDATE book_outbox SET status = 'applied', applied_at = now(), attempts = $5 WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND seq = $4")
        .bind(key.tenant_id)
        .bind(kind_str(key))
        .bind(&key.underlying)
        .bind(seq as i64)
        .bind(attempts as i32)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_failure(pool: &PgPool, key: &BookKey, seq: u64, attempts: u32, error: &str, failed: bool) -> anyhow::Result<()> {
    sqlx::query("UPDATE book_outbox SET attempts = $5, last_error = $6, status = CASE WHEN $7 THEN 'failed' ELSE status END WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND seq = $4")
        .bind(key.tenant_id)
        .bind(kind_str(key))
        .bind(&key.underlying)
        .bind(seq as i64)
        .bind(attempts as i32)
        .bind(error.chars().take(500).collect::<String>())
        .bind(failed)
        .execute(pool)
        .await?;
    Ok(())
}

/// Every book that has anything stored (crash recovery starts these actors).
pub async fn stored_keys(pool: &PgPool) -> anyhow::Result<Vec<BookKey>> {
    let rows = sqlx::query(
        "SELECT tenant_id, kind, underlying FROM book_series UNION SELECT tenant_id, kind, underlying FROM book_orders WHERE status = 'open'
         UNION SELECT tenant_id, kind, underlying FROM book_positions UNION SELECT tenant_id, kind, underlying FROM book_outbox WHERE status <> 'applied'",
    )
    .fetch_all(pool)
    .await?;
    let mut out: Vec<BookKey> = rows
        .iter()
        .filter_map(|r| {
            let kind = crate::model::AccountKind::parse(&r.get::<String, _>("kind"))?;
            Some(BookKey { tenant_id: r.get("tenant_id"), kind, underlying: r.get("underlying") })
        })
        .collect();
    out.sort();
    out.dedup();
    Ok(out)
}

/// Journal entries of an actor in seq order (durable and quote journal merged), from `from` (inclusive).
pub async fn entries(pool: &PgPool, key: &BookKey, from: u64) -> anyhow::Result<Vec<Entry>> {
    let mut out: BTreeMap<u64, Entry> = BTreeMap::new();
    for table in ["book_journal", "book_quote_journal"] {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT seq, cmd, out FROM {table} WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND seq >= $4 ORDER BY seq")))
            .bind(key.tenant_id)
            .bind(kind_str(key))
            .bind(&key.underlying)
            .bind(from as i64)
            .fetch_all(pool)
            .await?;
        for r in rows {
            let seq = r.get::<i64, _>("seq") as u64;
            let cmd: sqlx::types::Json<Cmd> = r.get("cmd");
            let o: sqlx::types::Json<Out> = r.get("out");
            out.insert(seq, Entry { seq, cmd: cmd.0, out: o.0 });
        }
    }
    Ok(out.into_values().collect())
}

/// A replay mismatch.
#[derive(Clone, Debug, PartialEq)]
pub struct Mismatch {
    pub seq: u64,
    pub what: String,
}

/// Re-runs every entry from `start` and compares outputs byte for byte (`RestartCancel` only re-applies: its
/// output depends on quotes a crash lost). Returns the replayed state.
pub fn replay(start: UnderlyingBooks, entries: &[Entry]) -> Result<UnderlyingBooks, Mismatch> {
    let mut b = start;
    for e in entries {
        if e.seq != b.seq + 1 {
            // a lost quote batch (crash before its async flush) leaves a gap only right before a RestartCancel
            if matches!(e.cmd, Cmd::RestartCancel { .. }) && e.seq > b.seq {
                b.seq = e.seq - 1;
            } else {
                return Err(Mismatch { seq: e.seq, what: format!("sequence gap: expected {}", b.seq + 1) });
            }
        }
        let out = super::matching::apply(&mut b, &e.cmd);
        if matches!(e.cmd, Cmd::RestartCancel { .. }) {
            continue;
        }
        let a = serde_json::to_string(&out).unwrap_or_default();
        let j = serde_json::to_string(&e.out).unwrap_or_default();
        if a != j {
            return Err(Mismatch { seq: e.seq, what: format!("output differs:\n replay {a}\n journal {j}") });
        }
    }
    Ok(b)
}

/// The comparable content of a book state (levels are derived from the orders): for replay-vs-live checks.
pub fn fingerprint(b: &UnderlyingBooks) -> Value {
    let series: BTreeMap<&String, Value> = b
        .series
        .iter()
        .map(|(s, sb)| {
            let orders: Vec<&Resting> = sb.orders.values().collect();
            let bids: Vec<(i64, Vec<i64>)> = sb.bids.iter().map(|(p, q)| (p.0, q.iter().copied().collect())).collect();
            let asks: Vec<(i64, Vec<i64>)> = sb.asks.iter().map(|(p, q)| (*p, q.iter().copied().collect())).collect();
            (s, serde_json::json!({"state": sb.state, "orders": orders, "bids": bids, "asks": asks, "pos": sb.pos, "last": sb.last, "vol": sb.vol_day}))
        })
        .collect();
    serde_json::json!({"seq": b.seq, "series": series})
}

/// `fingerprint` as an actor read function.
pub fn fingerprint_value(b: &UnderlyingBooks) -> Value {
    fingerprint(b)
}

/// Σ positions per series (must be 0) and Σ longs.
pub fn position_sums(b: &UnderlyingBooks) -> BTreeMap<String, (Steps, Steps)> {
    b.series.iter().map(|(s, sb)| (s.clone(), (sb.pos.values().sum(), sb.oi()))).collect()
}

/// Direction of a position change for a login in a fill (buyer +qty, seller −qty).
pub fn fill_delta(f: &Fill, login: i64) -> Steps {
    let mut d = 0;
    if f.maker.login == login {
        d += if f.maker.side == Side::Buy { f.qty } else { -f.qty };
    }
    if f.taker.login == login {
        d += if f.taker.side == Side::Buy { f.qty } else { -f.qty };
    }
    d
}
