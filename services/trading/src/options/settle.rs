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

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use super::OptionPricing;
use crate::api::AppState;
use crate::money::{D, ZERO, num, r2};
use crate::shard::SettleReport;

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

/// Records one pass per tenant (accumulates when the same run is passed again after a crash).
#[allow(clippy::too_many_arguments)]
pub async fn record(st: &AppState, rep: &SettleReport, key: &str, symbol: &str, date: NaiveDate, run: i32, fixing: D, source: Option<&str>, kind: &str, reason: &str, by: &str) {
    let mut per: BTreeMap<i64, (i32, i32, D)> = BTreeMap::new();
    for (tenant, _, n, cash) in rep.accounts.iter().filter(|a| a.2 > 0) {
        let e = per.entry(*tenant).or_insert((0, 0, ZERO));
        e.0 += *n as i32;
        e.1 += 1;
        e.2 += *cash;
    }
    for (tenant, (positions, accounts, payout)) in per {
        let r = sqlx::query(
            "INSERT INTO option_settlement_runs (tenant_id, expiry_key, symbol, expiry_date, run, fixing, source, status, kind, positions, accounts, payout_usd, failures, reason, created_by, started_at, finished_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
             ON CONFLICT (tenant_id, expiry_key, run) DO UPDATE SET positions = option_settlement_runs.positions + EXCLUDED.positions,
                accounts = option_settlement_runs.accounts + EXCLUDED.accounts, payout_usd = option_settlement_runs.payout_usd + EXCLUDED.payout_usd,
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

/// Settles one expiry everywhere and records it.
pub async fn settle_expiry(st: &AppState, key: &str, symbol: &str, date: NaiveDate, fixing: D, run: i32, source: Option<&str>) -> SettleReport {
    let rep = st.hub.settle(key, fixing, run, None).await;
    let n: usize = rep.accounts.iter().map(|a| a.2).sum();
    if rep.failures == 0 {
        // the order books drop the expired series and their positions (settled above)
        crate::book::purge_expiry(&st.hub, symbol, date).await;
    }
    if n > 0 || rep.failures > 0 {
        record(st, &rep, key, symbol, date, run, fixing, source, "settle", "", "system").await;
        notify(st, &rep, key, run, fixing, false).await;
        tracing::info!(%key, run, fixing = %fixing, positions = n, accounts = rep.accounts.len(), failures = rep.failures, "options settled");
    }
    rep
}

/// One scheduler pass: settles every due expiry. `done` remembers (expiry, run) passes that left nothing behind.
pub async fn run_due(st: &AppState, done: &mut HashSet<(String, i32)>) -> usize {
    let now = st.hub.shared.clock.now();
    let mut settled = 0;
    for (k, (symbol, date, cut)) in open_expiries(st).await {
        if now < cut {
            continue;
        }
        let Some((fixing, run, source)) = fixing_for(st, &symbol, date).await else { continue };
        if done.contains(&(k.clone(), run)) {
            continue;
        }
        let rep = settle_expiry(st, &k, &symbol, date, fixing, run, source.as_deref()).await;
        settled += rep.accounts.iter().map(|a| a.2).sum::<usize>();
        if rep.failures == 0 {
            done.insert((k, run));
        }
    }
    settled
}

/// Runs forever (single engine instance: started with the rollover job).
pub async fn scheduler(st: AppState) {
    // let the snapshot and the raw feed arrive first
    tokio::time::sleep(Duration::from_secs(10)).await;
    let mut done: HashSet<(String, i32)> = HashSet::new();
    loop {
        run_due(&st, &mut done).await;
        if done.len() > 10_000 {
            done.clear();
        }
        tokio::time::sleep(Duration::from_secs(15)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
