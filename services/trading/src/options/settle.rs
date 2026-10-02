//! Option expiry settlement (modelled on the swap rollover job, main.rs).
//!
//! Every 15 s the scheduler lists the expiries that still have open option positions (in memory, every tenant),
//! and for each one whose cut has passed and whose fixing the options service has published (snapshot
//! `expiries[].fixing`, or `/v1/internal/options/fixings` for expiries older than the snapshot keeps), it sends
//! `Cmd::Settle` to every shard. Each account settles in its own transaction (ledger key
//! `settle:{SYMBOL:DATE}:{run}:{ticket}`, unique in the database), so a crash in the middle is caught up on the next
//! pass exactly once: settled positions are gone, the rest settles. Each pass is recorded per tenant in
//! `option_settlement_runs` (the re-run window starts at its `finished_at`) and every settled client is notified.
//!
//! Re-run: `POST /v1/admin/options/settlements/{expiry}/rerun` (api/options.rs) after the options service re-fixed
//! the expiry (within 1 h): earlier settlement deals are reversed and settled again at the new fixing.
//!
//! Venues (docs/OPTIONS-EXCHANGE.md §9): a house-venue position settles against `house:options_settlement`, an
//! order book position against its expiry's clearing account in USD (`house:options_clearing.{U}.{YYYYMMDD}:USD`,
//! cent accounts through `house:fx`), where every long has a short. After a pass, what is left in the clearing
//! account per tenant and account kind is per-position rounding (≤ 0.005 USD per settled position): it is swept to
//! `house:options_rounding` (key `clrsweep:{tenant}:{kind}:{SYMBOL:DATE}:{run}`); anything larger is an alert and
//! stays put. Crosses (quote neither USD nor the account's) convert at one rate per expiry (`conversion`).

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use super::OptionPricing;
use crate::api::AppState;
use crate::model::AccountKind;
use crate::money::{D, ZERO, num, r2};
use crate::shard::SettleReport;
use sqlx::Row;

/// Settlement proceeds can be re-run (and are held from withdrawal) for this long after the first run.
pub const RERUN_WINDOW_SECS: i64 = crate::state::SETTLEMENT_HOLD_SECS;

/// `SYMBOL:YYYY-MM-DD` (also accepts `SYMBOL-YYYYMMDD` / `SYMBOL-YYYY-MM-DD`).
pub fn parse_key(s: &str) -> Option<(String, NaiveDate)> {
    let s = s.trim();
    let (sym, d) = s.split_once(':').or_else(|| s.split_once('-'))?;
    let date = NaiveDate::parse_from_str(d, "%Y-%m-%d").or_else(|_| NaiveDate::parse_from_str(d, "%Y%m%d")).ok()?;
    let sym = sym.trim().to_ascii_uppercase();
    (!sym.is_empty() && sym.chars().all(|c| c.is_ascii_alphanumeric())).then_some((sym, date))
}

pub fn key(symbol: &str, date: NaiveDate) -> String {
    format!("{symbol}:{date}")
}

/// Open expiries (key → (symbol, date, cut)) across every tenant.
pub async fn open_expiries(st: &AppState) -> BTreeMap<String, (String, NaiveDate, DateTime<Utc>)> {
    let mut out = BTreeMap::new();
    for t in st.hub.shared.registry.all() {
        let rows = st
            .hub
            .scan(
                t.tenant_id,
                Arc::new(|a, _| {
                    let mut v: Vec<Value> = a.positions.values().filter_map(|p| p.option.as_ref()).map(|t| json!({"key": t.expiry_key(), "symbol": t.underlying, "date": t.expiry, "cut": t.expiry_at})).collect();
                    v.dedup();
                    v
                }),
            )
            .await;
        for r in rows {
            let (Some(k), Some(s), Some(d), Some(c)) = (r["key"].as_str(), r["symbol"].as_str(), r["date"].as_str(), r["cut"].as_str()) else { continue };
            let (Ok(d), Ok(c)) = (NaiveDate::parse_from_str(d, "%Y-%m-%d"), DateTime::parse_from_rfc3339(c)) else { continue };
            out.insert(k.to_string(), (s.to_string(), d, c.with_timezone(&Utc)));
        }
    }
    out
}

/// The published fixing of an expiry: (price, run, source). The snapshot first, else the options service.
pub async fn fixing_for(st: &AppState, symbol: &str, date: NaiveDate) -> Option<(D, i32, Option<String>)> {
    let opts = &st.hub.shared.options;
    if let Some(snap) = opts.snapshot()
        && let Some(e) = snap.expiry(symbol, date)
    {
        return e.fixing.filter(|f| *f > 0.0 && matches!(e.status.as_str(), "fixed" | "settled")).map(|f| (super::dec(f), e.fixing_run.max(1), e.fixing_source.clone()));
    }
    match opts.fixing(symbol, date).await {
        Ok(Some(f)) if matches!(f.status.as_str(), "fixed" | "settled") => f.price.filter(|p| *p > ZERO).map(|p| (p, f.run.max(1), f.source)),
        Ok(_) => None,
        Err(e) => {
            tracing::debug!(%symbol, %date, error = %e, "fixing lookup failed");
            None
        }
    }
}

/// The quote → USD rate every account of a cross expiry settles at (None for USD-quoted and USDxxx underlyings,
/// which convert exactly at their own fixing): the conversion pair's fixing of the same expiry date (same cut,
/// same TWAP window), else the live raw mid when the pass starts.
pub async fn conversion(st: &AppState, symbol: &str, date: NaiveDate) -> Option<D> {
    let opts = &st.hub.shared.options;
    let ccy = opts.snapshot().and_then(|s| s.underlying(symbol).map(|u| u.quote_ccy.clone()))?;
    if ccy == "USD" || symbol == format!("USD{ccy}") {
        return None;
    }
    if let Some((f, _, _)) = fixing_for(st, &format!("{ccy}USD"), date).await {
        return Some(f);
    }
    if let Some((f, _, _)) = fixing_for(st, &format!("USD{ccy}"), date).await
        && f > ZERO
    {
        return Some(D::ONE / f);
    }
    opts.usd_per(&ccy).and_then(crate::money::from_f64).filter(|q| *q > ZERO)
}

/// Rounding a clearing account may keep per settled book position (each side is rounded to the cent once).
pub fn sweep_limit(settled: i64) -> D {
    D::new(5, 3) * D::from(settled.max(0))
}

/// What a clearing sweep does with the balance `net` left after `settled` book settlements: Some(amount to move
/// to `house:options_rounding`) when it is rounding, None when it is 0 or too large (an alert: it stays put).
pub fn sweep_amount(net: D, settled: i64) -> Option<D> {
    (!net.is_zero() && settled > 0 && net.abs() <= sweep_limit(settled)).then_some(net)
}

/// Sweeps the rounding left in an expiry's clearing account per (tenant, account kind) once its book positions
/// are all settled and its fills all applied. Idempotent (key `clrsweep:{tenant}:{kind}:{SYMBOL:DATE}:{run}`).
/// Returns one line per (tenant, kind) looked at.
pub async fn sweep_clearing(hub: &crate::shard::Hub, symbol: &str, date: NaiveDate, run: i32) -> Vec<Value> {
    let pool = &hub.shared.pool;
    let code = format!("house:options_clearing.{symbol}.{}:USD", date.format("%Y%m%d"));
    let k = key(symbol, date);
    let rows = match sqlx::query(
        "SELECT t.tenant_id, COALESCE(a.kind, split_part(t.idempotency_key, ':', 3)) AS kind, sum(p.amount) AS net,
                count(*) FILTER (WHERE t.idempotency_key LIKE 'settle:%') AS settled
           FROM ledger_postings p JOIN ledger_txns t ON t.id = p.txn_id LEFT JOIN accounts a ON a.login = t.login
          WHERE p.account_code = $1 GROUP BY 1, 2 ORDER BY 1, 2",
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, %code, "clearing sweep: balance query failed");
            return vec![];
        }
    };
    let mut out = Vec::new();
    for r in rows {
        let (tenant, kind, net, settled): (i64, String, D, i64) = (r.get("tenant_id"), r.get("kind"), r.get("net"), r.get("settled"));
        if net.is_zero() || settled == 0 {
            out.push(json!({"tenant": tenant, "kind": kind, "net": num(net), "settled": settled, "swept": false}));
            continue;
        }
        let Some(akind) = AccountKind::parse(&kind) else { continue };
        // final only when no fill of this book waits in the outbox and no position of the expiry is open
        let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM book_outbox WHERE tenant_id = $1 AND kind = $2 AND underlying = $3 AND status <> 'applied'")
            .bind(tenant)
            .bind(&kind)
            .bind(symbol)
            .fetch_one(pool)
            .await
            .unwrap_or(1);
        let kk = k.clone();
        let open: usize = hub
            .scan(tenant, Arc::new(move |a, _| if a.account.kind == akind && a.positions.values().any(|p| p.on_book() && p.option.as_ref().is_some_and(|t| t.expiry_key() == kk)) { vec![json!(1)] } else { vec![] }))
            .await
            .len();
        if pending > 0 || open > 0 {
            out.push(json!({"tenant": tenant, "kind": kind, "net": num(net), "settled": settled, "swept": false, "waiting": {"outbox": pending, "accounts": open}}));
            continue;
        }
        let Some(amount) = sweep_amount(net, settled) else {
            tracing::error!(tenant, %kind, %code, net = %net, settled, limit = %sweep_limit(settled), "ALERT: options clearing does not net to 0 after settlement (more than rounding); not swept");
            out.push(json!({"tenant": tenant, "kind": kind, "net": num(net), "settled": settled, "swept": false, "alert": true}));
            continue;
        };
        let idem = format!("clrsweep:{tenant}:{kind}:{k}:{run}");
        let id = hub.shared.ids.txn();
        let res: anyhow::Result<bool> = async {
            let mut tx = pool.begin().await?;
            let n = sqlx::query(
                "INSERT INTO ledger_txns (id, tenant_id, idempotency_key, kind, login, reference, reason_code, note, request, created_at)
                 VALUES ($1,$2,$3,$4,0,$5,NULL,$6,NULL,$7) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING",
            )
            .bind(id)
            .bind(tenant)
            .bind(&idem)
            .bind(crate::model::TxnKind::OptionSettlement.as_str())
            .bind(&code)
            .bind(format!("clearing rounding sweep after {k} run {run} ({kind})"))
            .bind(hub.shared.clock.now())
            .execute(&mut *tx)
            .await?
            .rows_affected();
            if n == 0 {
                return Ok(false);
            }
            for (acct, amt) in [(code.as_str(), -amount), ("house:options_rounding:USD", amount)] {
                sqlx::query("INSERT INTO ledger_postings (tenant_id, txn_id, account_code, currency, amount) VALUES ($1,$2,$3,'USD',$4)").bind(tenant).bind(id).bind(acct).bind(amt).execute(&mut *tx).await?;
                sqlx::query(
                    "INSERT INTO ledger_accounts (tenant_id, code, currency, balance) VALUES ($1,$2,'USD',$3)
                     ON CONFLICT (tenant_id, code) DO UPDATE SET balance = ledger_accounts.balance + EXCLUDED.balance, updated_at = now()",
                )
                .bind(tenant)
                .bind(acct)
                .bind(amt)
                .execute(&mut *tx)
                .await?;
            }
            tx.commit().await?;
            Ok(true)
        }
        .await;
        match res {
            Ok(swept) => {
                if swept {
                    tracing::info!(tenant, %kind, %code, amount = %amount, settled, "options clearing rounding swept");
                }
                out.push(json!({"tenant": tenant, "kind": kind, "net": num(net), "settled": settled, "swept": swept, "amount": num(amount)}));
            }
            Err(e) => {
                tracing::error!(error = %e, tenant, %kind, %code, "clearing sweep failed; retried on the next pass");
                out.push(json!({"tenant": tenant, "kind": kind, "net": num(net), "settled": settled, "swept": false, "error": e.to_string()}));
            }
        }
    }
    out
}

/// Records one pass per tenant. The totals are read back from the ledger (every `settle:{key}:{run}:` transaction
/// of the tenant), so a pass that catches up after a crash in the middle of an earlier one reports the whole run,
/// the accounts settled before the crash included, and an account settled over two passes counts once.
#[allow(clippy::too_many_arguments)]
pub async fn record(st: &AppState, rep: &SettleReport, key: &str, symbol: &str, date: NaiveDate, run: i32, fixing: D, source: Option<&str>, kind: &str, reason: &str, by: &str) {
    let mut per: BTreeMap<i64, (i32, i32, D)> = BTreeMap::new();
    for (tenant, _, n, cash) in rep.accounts.iter().filter(|a| a.2 > 0) {
        let e = per.entry(*tenant).or_insert((0, 0, ZERO));
        e.0 += *n as i32;
        e.1 += 1;
        e.2 += *cash;
    }
    for (tenant, v) in per.iter_mut() {
        let totals: Result<(i64, i64, Option<D>), _> = sqlx::query_as(
            "SELECT count(*), count(DISTINCT t.login), sum(p.amount / CASE WHEN a.cent THEN 100 ELSE 1 END)
               FROM ledger_txns t JOIN ledger_postings p ON p.txn_id = t.id AND p.account_code = 'acct:' || t.login || ':balance'
               JOIN accounts a ON a.login = t.login
              WHERE t.tenant_id = $1 AND t.idempotency_key LIKE $2",
        )
        .bind(*tenant)
        .bind(format!("settle:{key}:{run}:%"))
        .fetch_one(&st.pool)
        .await;
        if let Ok((n, accounts, payout)) = totals
            && n > 0
        {
            // a settlement that booked no cash (out of the money) has no transaction: never report fewer than this pass
            *v = ((n as i32).max(v.0), (accounts as i32).max(v.1), payout.unwrap_or(ZERO));
        }
    }
    for (tenant, (positions, accounts, payout)) in per {
        let r = sqlx::query(
            "INSERT INTO option_settlement_runs (tenant_id, expiry_key, symbol, expiry_date, run, fixing, source, status, kind, positions, accounts, payout_usd, failures, reason, created_by, started_at, finished_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
             ON CONFLICT (tenant_id, expiry_key, run) DO UPDATE SET positions = GREATEST(option_settlement_runs.positions, EXCLUDED.positions),
                accounts = GREATEST(option_settlement_runs.accounts, EXCLUDED.accounts), payout_usd = EXCLUDED.payout_usd,
                failures = EXCLUDED.failures, status = EXCLUDED.status, finished_at = EXCLUDED.finished_at",
        )
        .bind(tenant)
        .bind(key)
        .bind(symbol)
        .bind(date)
        .bind(run)
        .bind(fixing)
        .bind(source)
        .bind(if rep.failures > 0 { "failed" } else { "done" })
        .bind(kind)
        .bind(positions)
        .bind(accounts)
        .bind(r2(payout))
        .bind(rep.failures as i32)
        .bind(reason)
        .bind(by)
        .bind(st.hub.shared.clock.now())
        .execute(&st.pool)
        .await;
        if let Err(e) = r {
            tracing::error!(error = %e, %key, run, "recording the settlement run failed");
        }
    }
}

/// Bell + email for every settled account.
pub async fn notify(st: &AppState, rep: &SettleReport, key: &str, run: i32, fixing: D, rerun: bool) {
    for (tenant, login, n, cash) in &rep.accounts {
        if *n == 0 {
            continue;
        }
        let Some(m) = st.hub.meta(*login) else { continue };
        let (title, body) = if rerun {
            ("Options settlement corrected".to_string(), format!("The {key} expiry was re-fixed at {} (run {run}); your {n} option position(s) on account {login} were settled again: {} USD.", fixing.normalize(), r2(*cash).normalize()))
        } else {
            ("Options settled".to_string(), format!("{n} option position(s) on account {login} expired at the {key} fixing {}: {} USD.", fixing.normalize(), r2(*cash).normalize()))
        };
        crate::notify::enqueue_or_log(
            &st.pool,
            *tenant,
            m.user_id,
            if rerun { "options.settlement_rerun" } else { "options.settlement" },
            json!({"title": title, "body": body, "link": "/options", "severity": "info", "data": {"login": login, "expiry": key, "run": run, "fixing": num(fixing), "cash": num(r2(*cash))}}),
            &format!("options-settle:{key}:{run}:{login}"),
        )
        .await;
    }
}

/// Settles one expiry everywhere and records it. `usdq` = the cross conversion of the pass (`conversion`).
#[allow(clippy::too_many_arguments)]
pub async fn settle_expiry(st: &AppState, key: &str, symbol: &str, date: NaiveDate, fixing: D, run: i32, source: Option<&str>, usdq: Option<D>) -> SettleReport {
    let rep = st.hub.settle(key, fixing, run, usdq).await;
    let n: usize = rep.accounts.iter().map(|a| a.2).sum();
    if rep.failures == 0 {
        // the order books drop the expired series and their positions (settled above)
        crate::book::purge_expiry(&st.hub, symbol, date).await;
        // the rounding left in the expiry's clearing account (book positions)
        if n > 0 {
            sweep_clearing(&st.hub, symbol, date, run).await;
        }
    }
    if n > 0 || rep.failures > 0 {
        record(st, &rep, key, symbol, date, run, fixing, source, "settle", "", "system").await;
        notify(st, &rep, key, run, fixing, false).await;
        tracing::info!(%key, run, fixing = %fixing, positions = n, accounts = rep.accounts.len(), failures = rep.failures, "options settled");
    }
    rep
}

/// One scheduler pass: settles every due expiry. `done` remembers (expiry, run) passes that left nothing behind
/// (a position that could not settle yet, e.g. a cross without a conversion rate, keeps its expiry due).
pub async fn run_due(st: &AppState, done: &mut HashSet<(String, i32)>) -> usize {
    let now = st.hub.shared.clock.now();
    let mut settled = 0;
    let mut passed = Vec::new();
    for (k, (symbol, date, cut)) in open_expiries(st).await {
        if now < cut {
            continue;
        }
        let Some((fixing, run, source)) = fixing_for(st, &symbol, date).await else { continue };
        if done.contains(&(k.clone(), run)) {
            continue;
        }
        let usdq = conversion(st, &symbol, date).await;
        let rep = settle_expiry(st, &k, &symbol, date, fixing, run, source.as_deref(), usdq).await;
        settled += rep.accounts.iter().map(|a| a.2).sum::<usize>();
        if rep.failures == 0 {
            passed.push((k, run));
        }
    }
    if !passed.is_empty() {
        let left = open_expiries(st).await;
        for (k, run) in passed {
            if !left.contains_key(&k) {
                done.insert((k, run));
            }
        }
    }
    settled
}

/// Sweeps again the clearing accounts of the expiries settled in the last 2 hours whose clearing is not at 0: the
/// sweep right after a pass can wait (fills still in the outbox) or be lost (a crash between the settlement and the
/// sweep). `seen` keeps the (expiry, run) already reported, so a real imbalance alerts once per process.
pub async fn sweep_recent(hub: &crate::shard::Hub, seen: &mut HashSet<(String, i32)>) {
    let pool = &hub.shared.pool;
    let rows: Vec<(String, NaiveDate, i32)> = match sqlx::query_as(
        "SELECT symbol, expiry_date, max(run) FROM option_settlement_runs WHERE finished_at > now() - interval '2 hours' GROUP BY 1, 2",
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(_) => return,
    };
    for (symbol, date, run) in rows {
        let code = format!("house:options_clearing.{symbol}.{}:USD", date.format("%Y%m%d"));
        let open: Option<D> = sqlx::query_scalar("SELECT sum(amount) FROM ledger_postings WHERE account_code = $1").bind(&code).fetch_one(pool).await.ok().flatten();
        if open.is_none_or(|v| v.is_zero()) || seen.contains(&(key(&symbol, date), run)) {
            continue;
        }
        let out = sweep_clearing(hub, &symbol, date, run).await;
        if out.iter().any(|l| l["alert"] == true) {
            seen.insert((key(&symbol, date), run));
        }
    }
}

/// Runs forever (single engine instance: started with the rollover job).
pub async fn scheduler(st: AppState) {
    // let the snapshot and the raw feed arrive first
    tokio::time::sleep(Duration::from_secs(10)).await;
    let mut done: HashSet<(String, i32)> = HashSet::new();
    let mut alerted: HashSet<(String, i32)> = HashSet::new();
    let mut n: u64 = 0;
    loop {
        run_due(&st, &mut done).await;
        if done.len() > 10_000 {
            done.clear();
        }
        // every minute: clearing sweeps that had to wait or were lost in a crash
        if n % 4 == 0 {
            sweep_recent(&st.hub, &mut alerted).await;
        }
        n += 1;
        tokio::time::sleep(Duration::from_secs(15)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clearing_sweep_takes_rounding_only() {
        // 0.005 USD per settled position at most; 0 and anything larger are not swept (the latter alerts)
        assert_eq!(sweep_limit(4), D::new(2, 2));
        assert_eq!(sweep_amount(D::new(-1, 2), 4), Some(D::new(-1, 2)));
        assert_eq!(sweep_amount(D::new(2, 2), 4), Some(D::new(2, 2)));
        assert_eq!(sweep_amount(D::new(3, 2), 4), None);
        assert_eq!(sweep_amount(ZERO, 4), None);
        assert_eq!(sweep_amount(D::new(1, 2), 0), None);
    }

    #[test]
    fn expiry_keys() {
        let d = NaiveDate::from_ymd_opt(2026, 10, 9).unwrap();
        assert_eq!(parse_key("EURUSD:2026-10-09"), Some(("EURUSD".into(), d)));
        assert_eq!(parse_key("eurusd-20261009"), Some(("EURUSD".into(), d)));
        assert_eq!(parse_key("EURUSD-2026-10-09"), Some(("EURUSD".into(), d)));
        assert_eq!(parse_key("EUR/USD:2026-10-09"), None);
        assert_eq!(key("XAUUSD", d), "XAUUSD:2026-10-09");
    }
}
