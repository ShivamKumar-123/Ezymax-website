//! Stock corporate actions: storage, the apply scheduler, the EODHD import and the Infoway cross-check.
//!
//! An action is proposed (Back Office entry, or the EODHD import), approved (four-eyes for splits and dividends of
//! 2 % of the price or more), then applied by the scheduler at `apply_at` (00:00 of the ex-date in the exchange's
//! time zone, when the market is closed) to every account (all brokers, live and demo) holding a position or a
//! pending order on the symbol: engine/corporate.rs does the per-account work as ordinary events. A crash part-way
//! is resumed on the next pass: accounts already done skip themselves (their event stream marks the action).
//! After the ex-date the Infoway adjustment factors (through market-data) confirm the split ratio / dividend size.

pub mod check;
pub mod eodhd;

use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::collections::BTreeMap;
use std::sync::Arc;

use crate::engine::corporate::{CorpAction, CorpKind};
use crate::money::{D, ZERO};
use crate::shard::{Hub, Op};
use crate::specs::{Session, Spec};

/// Dividends of at least this share of the price need a second approver.
pub const FOUR_EYES_DIVIDEND_PCT: &str = "2";

/// A stored action.
#[derive(Clone, Debug)]
pub struct ActionRow {
    pub id: i64,
    pub symbol: String,
    pub kind: String,
    pub ex_date: NaiveDate,
    pub apply_at: DateTime<Utc>,
    pub ratio_from: Option<D>,
    pub ratio_to: Option<D>,
    pub amount: Option<D>,
    pub currency: Option<String>,
    pub withholding_pct: D,
    pub record_date: Option<NaiveDate>,
    pub pay_date: Option<NaiveDate>,
    pub ref_price: Option<D>,
    pub four_eyes: bool,
    pub status: String,
    pub source: String,
    pub source_ref: Option<String>,
    pub note: Option<String>,
    pub created_by: String,
    pub created_by_id: String,
    pub created_at: DateTime<Utc>,
    pub approved_by: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub applied_at: Option<DateTime<Utc>>,
    pub report: Option<Value>,
    pub check_status: Option<String>,
    pub check_detail: Option<Value>,
}

pub const COLUMNS: &str = "id, symbol, kind, ex_date, apply_at, ratio_from, ratio_to, amount, currency, withholding_pct, record_date, pay_date, ref_price, four_eyes, status, source, source_ref, note, created_by, created_by_id, created_at, approved_by, approved_at, applied_at, report, check_status, check_detail";

pub fn from_row(r: &sqlx::postgres::PgRow) -> ActionRow {
    ActionRow {
        id: r.get("id"),
        symbol: r.get("symbol"),
        kind: r.get("kind"),
        ex_date: r.get("ex_date"),
        apply_at: r.get("apply_at"),
        ratio_from: r.get("ratio_from"),
        ratio_to: r.get("ratio_to"),
        amount: r.get("amount"),
        currency: r.get("currency"),
        withholding_pct: r.get("withholding_pct"),
        record_date: r.get("record_date"),
        pay_date: r.get("pay_date"),
        ref_price: r.get("ref_price"),
        four_eyes: r.get("four_eyes"),
        status: r.get("status"),
        source: r.get("source"),
        source_ref: r.get("source_ref"),
        note: r.get("note"),
        created_by: r.get("created_by"),
        created_by_id: r.get("created_by_id"),
        created_at: r.get("created_at"),
        approved_by: r.get("approved_by"),
        approved_at: r.get("approved_at"),
        applied_at: r.get("applied_at"),
        report: r.get::<Option<sqlx::types::Json<Value>>, _>("report").map(|j| j.0),
        check_status: r.get("check_status"),
        check_detail: r.get::<Option<sqlx::types::Json<Value>>, _>("check_detail").map(|j| j.0),
    }
}

impl ActionRow {
    /// The engine's view of the action.
    pub fn action(&self) -> Option<CorpAction> {
        let kind = match self.kind.as_str() {
            "split" => CorpKind::Split { from: self.ratio_from?, to: self.ratio_to? },
            "dividend" => CorpKind::Dividend { amount: self.amount?, currency: self.currency.clone()?, withholding_pct: self.withholding_pct },
            _ => return None,
        };
        Some(CorpAction { id: self.id, symbol: self.symbol.clone(), ex_date: self.ex_date, apply_at: self.apply_at, kind })
    }

    pub fn json(&self) -> Value {
        json!({
            "id": self.id, "symbol": self.symbol, "kind": self.kind, "exDate": self.ex_date, "applyAt": self.apply_at,
            "ratioFrom": self.ratio_from.map(crate::money::num), "ratioTo": self.ratio_to.map(crate::money::num),
            "amount": self.amount.map(crate::money::num), "currency": self.currency, "withholdingPct": crate::money::num(self.withholding_pct),
            "recordDate": self.record_date, "payDate": self.pay_date, "refPrice": self.ref_price.map(crate::money::num), "fourEyes": self.four_eyes,
            "status": self.status, "source": self.source, "sourceRef": self.source_ref, "note": self.note,
            "createdBy": self.created_by, "createdAt": self.created_at, "approvedBy": self.approved_by, "approvedAt": self.approved_at,
            "appliedAt": self.applied_at, "report": self.report, "check": {"status": self.check_status, "detail": self.check_detail},
            "label": self.action().map(|a| a.label()),
        })
    }
}

/// 00:00 of `day` in the time zone of the instrument's exchange (server midnight for other sessions), as UTC.
pub fn apply_at(spec: &Spec, day: NaiveDate) -> DateTime<Utc> {
    match spec.session {
        Session::Exchange(h) => {
            let local = day.and_hms_opt(0, 0, 0).unwrap().and_utc();
            // the offset at the instant itself: DST switches happen at 02:00 local, never at midnight
            let guess = local - Duration::seconds(h.zone.offset_secs(local));
            local - Duration::seconds(h.zone.offset_secs(guess))
        }
        _ => crate::specs::server_midnight(day),
    }
}

/// Default withholding on long dividends by listing: US 30 % (non-resident rate), Japan 15.315 %, Hong Kong none.
pub fn default_withholding(spec: &Spec, provider_code: &str) -> D {
    let _ = spec;
    if provider_code.ends_with(".US") || spec.session.key() == "us_equity" {
        D::from(30)
    } else if provider_code.ends_with(".JP") {
        "15.315".parse().unwrap()
    } else {
        ZERO
    }
}

/// Four-eyes rule: every split; dividends of FOUR_EYES_DIVIDEND_PCT % of the price or more (or of unknown size).
pub fn needs_four_eyes(kind: &str, amount: Option<D>, ref_price: Option<D>) -> bool {
    match (kind, amount, ref_price) {
        ("split", _, _) => true,
        ("dividend", Some(a), Some(p)) if p > ZERO => a / p * D::from(100) >= FOUR_EYES_DIVIDEND_PCT.parse::<D>().unwrap(),
        _ => true,
    }
}

/// A mid price for `symbol` from the engine's quote book (any spread group), if it streams.
pub fn last_price(hub: &Hub, symbol: &str) -> Option<D> {
    use crate::engine::Quotes;
    for g in std::iter::once(crate::options::RAW.to_string()).chain(hub.shared.registry.spread_groups()) {
        if let Some(q) = hub.shared.quotes.get(&g, symbol) {
            return Some(q.mid());
        }
    }
    None
}

pub async fn audit(pool: &PgPool, id: Option<i64>, actor: &str, event: &str, detail: Value, reason: Option<&str>) {
    if let Err(e) = sqlx::query("INSERT INTO corporate_action_audit (action_id, actor, event, detail, reason) VALUES ($1,$2,$3,$4,$5)")
        .bind(id)
        .bind(actor)
        .bind(event)
        .bind(sqlx::types::Json(detail))
        .bind(reason)
        .execute(pool)
        .await
    {
        tracing::error!(error = %e, action = ?id, event, "corporate-action audit write failed");
    }
}

pub async fn load(pool: &PgPool, id: i64) -> anyhow::Result<Option<ActionRow>> {
    let q = format!("SELECT {COLUMNS} FROM corporate_actions WHERE id = $1");
    Ok(sqlx::query(sqlx::AssertSqlSafe(q)).bind(id).fetch_optional(pool).await?.map(|r| from_row(&r)))
}

/// Approved / applying actions per symbol for the engine's guard (trading pauses once one is due until applied).
pub async fn refresh_due(hub: &Hub, pool: &PgPool) -> anyhow::Result<Vec<ActionRow>> {
    let q = format!("SELECT {COLUMNS} FROM corporate_actions WHERE status IN ('approved', 'applying') ORDER BY apply_at, id");
    let rows: Vec<ActionRow> = sqlx::query(sqlx::AssertSqlSafe(q)).fetch_all(pool).await?.iter().map(from_row).collect();
    let mut due: BTreeMap<String, Vec<(i64, DateTime<Utc>)>> = BTreeMap::new();
    for r in &rows {
        due.entry(r.symbol.clone()).or_default().push((r.id, r.apply_at));
    }
    hub.shared.corp.set(due);
    Ok(rows)
}

/// Accounts (all brokers) holding a position or order on the symbol from before `apply_at`: those still to do and
/// those done by an interrupted pass (the engine skips them; their run row is written now).
async fn targets(hub: &Hub, a: &CorpAction) -> Vec<i64> {
    let mut out = Vec::new();
    for t in hub.shared.registry.all() {
        let (sym, at) = (a.symbol.clone(), a.apply_at);
        let rows = hub
            .scan(
                t.tenant_id,
                Arc::new(move |st, _| {
                    let holds = st.positions.values().any(|p| p.symbol == sym && p.option.is_none() && p.open_time < at) || st.orders.values().any(|o| o.symbol == sym && o.option.is_none() && o.placed_at < at);
                    if holds { vec![json!(st.account.login)] } else { vec![] }
                }),
            )
            .await;
        out.extend(rows.iter().filter_map(Value::as_i64));
    }
    out.sort();
    out
}

/// Applies one due action to every account that needs it; marks it applied when none is left.
pub async fn run_action(hub: &Hub, pool: &PgPool, row: &ActionRow) -> anyhow::Result<Value> {
    let Some(a) = row.action() else { anyhow::bail!("action {} is incomplete", row.id) };
    if row.status == "approved" {
        sqlx::query("UPDATE corporate_actions SET status = 'applying', updated_at = now() WHERE id = $1 AND status = 'approved'").bind(a.id).execute(pool).await?;
        audit(pool, Some(a.id), "system", "applying", json!({"label": a.label()}), None).await;
    }
    let logins = targets(hub, &a).await;
    let (mut done, mut failed) = (0usize, Vec::new());
    for login in logins {
        let act = a.clone();
        let op: Op = Box::new(move |tx, env| crate::engine::corporate::apply(tx, env, &act));
        match hub.exec(login, "system", None, "CORP", &format!("corporate action #{}", a.id), None, op).await {
            Ok(d) => {
                let tenant = hub.meta(login).map(|m| m.tenant_id).unwrap_or(0);
                sqlx::query("INSERT INTO corporate_action_runs (action_id, login, tenant_id, result) VALUES ($1,$2,$3,$4) ON CONFLICT (action_id, login) DO NOTHING")
                    .bind(a.id)
                    .bind(login)
                    .bind(tenant)
                    .bind(sqlx::types::Json(&d.value))
                    .execute(pool)
                    .await?;
                done += 1;
            }
            Err(e) => {
                tracing::error!(action = a.id, login, error = ?e, "corporate action failed for an account; retried on the next pass");
                failed.push(json!({"login": login, "error": format!("{e:?}")}));
            }
        }
    }
    // accounts finished by an earlier (interrupted) pass are in the runs table already
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM corporate_action_runs WHERE action_id = $1").bind(a.id).fetch_one(pool).await?;
    // cash booked to clients (account currencies: USD and USC), from the ledger itself
    let cash: Vec<(String, D)> = sqlx::query_as(
        "SELECT p.currency, sum(p.amount) FROM ledger_txns t JOIN ledger_postings p ON p.txn_id = t.id
         WHERE t.idempotency_key LIKE $1 AND p.account_code LIKE 'acct:%' GROUP BY p.currency ORDER BY 1",
    )
    .bind(format!("corp:{}:%", a.id))
    .fetch_all(pool)
    .await?;
    let report = json!({"accounts": n, "thisPass": done, "cashBooked": cash.iter().map(|(c, v)| (c.clone(), crate::money::num(*v))).collect::<serde_json::Map<String, Value>>(), "failed": failed});
    if failed.is_empty() {
        sqlx::query("UPDATE corporate_actions SET status = 'applied', applied_at = now(), report = $2, updated_at = now() WHERE id = $1").bind(a.id).bind(sqlx::types::Json(&report)).execute(pool).await?;
        audit(pool, Some(a.id), "system", "applied", report.clone(), None).await;
        tracing::info!(action = a.id, symbol = %a.symbol, label = %a.label(), accounts = report["accounts"].as_i64(), "corporate action applied");
    } else {
        sqlx::query("UPDATE corporate_actions SET report = $2, updated_at = now() WHERE id = $1").bind(a.id).bind(sqlx::types::Json(&report)).execute(pool).await?;
    }
    Ok(report)
}

/// One scheduler pass: refresh the engine's guard, apply every due action.
pub async fn pass(hub: &Hub, pool: &PgPool) -> anyhow::Result<usize> {
    let rows = refresh_due(hub, pool).await?;
    let now = hub.shared.clock.now();
    let mut n = 0;
    for r in rows.iter().filter(|r| r.apply_at <= now) {
        match run_action(hub, pool, r).await {
            Ok(_) => n += 1,
            Err(e) => tracing::error!(action = r.id, error = %e, "corporate action pass failed"),
        }
    }
    if n > 0 {
        refresh_due(hub, pool).await?;
    }
    Ok(n)
}

/// The scheduler (single engine instance, like the rollover): every 20 s apply what is due; the EODHD import daily
/// at 06:00 UTC; the Infoway cross-check of recently applied actions every hour.
pub fn spawn(hub: Hub, pool: PgPool, cfg: Arc<crate::config::Config>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(20));
        let mut last_import: Option<NaiveDate> = None;
        let mut last_check = std::time::Instant::now() - std::time::Duration::from_secs(3600);
        loop {
            tick.tick().await;
            if let Err(e) = pass(&hub, &pool).await {
                tracing::error!(error = %e, "corporate-action scheduler");
            }
            let now = Utc::now();
            if !cfg.eodhd_key.is_empty() && now.format("%H").to_string().as_str() >= "06" && last_import != Some(now.date_naive()) {
                last_import = Some(now.date_naive());
                let r = eodhd::import(&hub, &pool, &cfg, "schedule").await;
                tracing::info!(report = %r, "EODHD corporate-action import");
            }
            if last_check.elapsed() >= std::time::Duration::from_secs(3600) {
                last_check = std::time::Instant::now();
                check::run(&pool, &cfg).await;
            }
        }
    });
}
