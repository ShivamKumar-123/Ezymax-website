//! EODHD import of upcoming stock dividends and splits (the founder's chosen source; All-in-One plan).
//!
//! * Splits: the upcoming-splits calendar, one request for the next 120 days (`/calendar/splits`), filtered to our
//!   stocks.
//! * Dividends: per stock, the dividends from today on (`/div/{TICKER}`; declared dividends appear with their
//!   ex-date, record date, pay date, amount and currency).
//!
//! Everything becomes a **proposed** action: nothing applies without an approval in the Back Office (four-eyes for
//! splits and large dividends). A change upstream to an action not yet applied updates it and, when it was approved,
//! sends it back for approval. Requests are spaced 250 ms apart (EODHD allows 1,000 a minute); a 429 waits a
//! minute and retries once; a rejected key stops the run.
//!
//! The key comes from `EODHD_API_KEY` (repo-root .env.local on the server). It is never logged: request errors are
//! reported without their URL. Without a key the import stays idle and the Back Office says so.

use chrono::{Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;

use super::{audit, needs_four_eyes};
use crate::config::Config;
use crate::money::{D, from_f64};
use crate::shard::Hub;
use crate::specs::Spec;

/// Our symbol → EODHD ticker: `AAPL` / `A.US` → `AAPL.US` / `A.US` (share classes `BRK.B` → `BRK-B.US`),
/// `00700.HK` → `0700.HK` (EODHD pads Hong Kong codes to four digits), `7203.JP` → `7203.TSE`. None for non-stocks.
pub fn ticker(spec: &Spec) -> Option<String> {
    if spec.asset_class != "stocks" {
        return None;
    }
    let s = spec.symbol.as_str();
    if let Some(code) = s.strip_suffix(".HK") {
        let digits = code.trim_start_matches('0');
        return Some(format!("{:0>4}.HK", if digits.is_empty() { "0" } else { digits }));
    }
    if let Some(code) = s.strip_suffix(".JP") {
        return Some(format!("{code}.TSE"));
    }
    let base = s.strip_suffix(".US").unwrap_or(s);
    match spec.session.key() {
        "us_equity" => Some(format!("{}.US", base.replace('.', "-"))),
        _ => None,
    }
}

/// One upcoming action as EODHD reports it.
#[derive(Clone, Debug, PartialEq)]
pub struct Proposal {
    pub symbol: String,
    pub ticker: String,
    pub kind: &'static str,
    pub ex_date: NaiveDate,
    pub ratio_from: Option<D>,
    pub ratio_to: Option<D>,
    pub amount: Option<D>,
    pub currency: Option<String>,
    pub record_date: Option<NaiveDate>,
    pub pay_date: Option<NaiveDate>,
}

#[derive(Deserialize)]
struct DivRow {
    date: Option<String>,
    #[serde(rename = "recordDate")]
    record_date: Option<String>,
    #[serde(rename = "paymentDate")]
    payment_date: Option<String>,
    value: Option<f64>,
    #[serde(rename = "unadjustedValue")]
    unadjusted_value: Option<f64>,
    currency: Option<String>,
}

fn day(s: &Option<String>) -> Option<NaiveDate> {
    s.as_deref().and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
}

/// `/div/{TICKER}` → dividends with an ex-date on or after `from` (the unadjusted per-share cash, as paid).
pub fn parse_dividends(symbol: &str, ticker: &str, body: &str, from: NaiveDate) -> Result<Vec<Proposal>, String> {
    let rows: Vec<DivRow> = serde_json::from_str(body).map_err(|e| format!("dividends of {ticker}: {e}"))?;
    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let ex = day(&r.date)?;
            let amount = r.unadjusted_value.or(r.value).filter(|v| *v > 0.0).and_then(from_f64)?;
            (ex >= from).then(|| Proposal {
                symbol: symbol.into(),
                ticker: ticker.into(),
                kind: "dividend",
                ex_date: ex,
                ratio_from: None,
                ratio_to: None,
                amount: Some(amount),
                currency: r.currency.filter(|c| c.len() == 3).map(|c| c.to_uppercase()),
                record_date: day(&r.record_date),
                pay_date: day(&r.payment_date),
            })
        })
        .collect())
}

#[derive(Deserialize)]
struct SplitCalendar {
    #[serde(default)]
    splits: Vec<SplitRow>,
}

#[derive(Deserialize)]
struct SplitRow {
    code: Option<String>,
    split_date: Option<String>,
    old_shares: Option<f64>,
    new_shares: Option<f64>,
}

/// `/calendar/splits` → splits of the given tickers (ticker → our symbol) on or after `from`.
pub fn parse_splits(body: &str, ours: &std::collections::HashMap<String, String>, from: NaiveDate) -> Result<Vec<Proposal>, String> {
    let cal: SplitCalendar = serde_json::from_str(body).map_err(|e| format!("splits calendar: {e}"))?;
    Ok(cal
        .splits
        .into_iter()
        .filter_map(|r| {
            let code = r.code?;
            let symbol = ours.get(&code)?.clone();
            let ex = day(&r.split_date)?;
            let (old, new) = (from_f64(r.old_shares?)?, from_f64(r.new_shares?)?);
            (ex >= from && old > D::ZERO && new > D::ZERO && old != new).then(|| Proposal {
                symbol,
                ticker: code,
                kind: "split",
                ex_date: ex,
                ratio_from: Some(old),
                ratio_to: Some(new),
                amount: None,
                currency: None,
                record_date: None,
                pay_date: None,
            })
        })
        .collect())
}

/// Stores a proposal: new → proposed; changed (not yet applied) → updated, back to proposed if it was approved.
/// Returns "new" | "updated" | "unchanged" | "locked" (applying / applied: never changed).
pub async fn upsert(hub: &Hub, pool: &PgPool, p: &Proposal, actor: &str) -> anyhow::Result<&'static str> {
    let specs = hub.shared.specs.load();
    let Some(spec) = specs.get(&p.symbol) else { anyhow::bail!("unknown symbol {}", p.symbol) };
    let existing = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {} FROM corporate_actions WHERE symbol = $1 AND kind = $2 AND ex_date = $3 AND status NOT IN ('rejected', 'cancelled')",
        super::COLUMNS
    )))
    .bind(&p.symbol)
    .bind(p.kind)
    .bind(p.ex_date)
    .fetch_optional(pool)
    .await?
    .map(|r| super::from_row(&r));
    let currency = p.currency.clone().or_else(|| (p.kind == "dividend").then(|| spec.quote_ccy.clone()));
    match existing {
        None => {
            let ref_price = super::last_price(hub, &p.symbol);
            let four = needs_four_eyes(p.kind, p.amount, ref_price);
            let wh = if p.kind == "dividend" { super::default_withholding(spec, &p.ticker) } else { D::ZERO };
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO corporate_actions (symbol, kind, ex_date, apply_at, ratio_from, ratio_to, amount, currency, withholding_pct, record_date, pay_date, ref_price, four_eyes, status, source, source_ref, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'proposed','eodhd',$14,$15) RETURNING id",
            )
            .bind(&p.symbol)
            .bind(p.kind)
            .bind(p.ex_date)
            .bind(super::apply_at(spec, p.ex_date))
            .bind(p.ratio_from)
            .bind(p.ratio_to)
            .bind(p.amount)
            .bind(&currency)
            .bind(wh)
            .bind(p.record_date)
            .bind(p.pay_date)
            .bind(ref_price)
            .bind(four)
            .bind(&p.ticker)
            .bind(actor)
            .fetch_one(pool)
            .await?;
            audit(pool, Some(id), actor, "proposed", json!({"source": "eodhd", "ticker": p.ticker}), None).await;
            Ok("new")
        }
        Some(r) if r.status == "applying" || r.status == "applied" => Ok("locked"),
        Some(r) => {
            let same = r.ratio_from == p.ratio_from && r.ratio_to == p.ratio_to && r.amount == p.amount && (p.kind == "split" || r.currency == currency);
            if same {
                return Ok("unchanged");
            }
            let back = r.status == "approved";
            sqlx::query(
                "UPDATE corporate_actions SET ratio_from = $2, ratio_to = $3, amount = $4, currency = $5, record_date = COALESCE($6, record_date), pay_date = COALESCE($7, pay_date),
                   status = 'proposed', approved_by = NULL, approved_at = NULL, updated_at = now(),
                   note = concat_ws(' · ', note, $8::text)
                 WHERE id = $1",
            )
            .bind(r.id)
            .bind(p.ratio_from)
            .bind(p.ratio_to)
            .bind(p.amount)
            .bind(&currency)
            .bind(p.record_date)
            .bind(p.pay_date)
            .bind(format!("EODHD changed it on {}{}", Utc::now().date_naive(), if back { "; approve again" } else { "" }))
            .execute(pool)
            .await?;
            audit(pool, Some(r.id), actor, "import_update", json!({"before": {"ratioFrom": r.ratio_from, "ratioTo": r.ratio_to, "amount": r.amount, "currency": r.currency}, "after": {"ratioFrom": p.ratio_from, "ratioTo": p.ratio_to, "amount": p.amount, "currency": currency}, "approvalReset": back}), None).await;
            Ok("updated")
        }
    }
}

/// GET with the key as a query parameter; errors never carry the URL (it holds the key).
async fn get(client: &reqwest::Client, url: &str, key: &str, query: &[(&str, String)]) -> Result<(u16, String), String> {
    let mut q: Vec<(&str, String)> = query.to_vec();
    q.push(("fmt", "json".into()));
    q.push(("api_token", key.into()));
    let url = reqwest::Url::parse_with_params(url, &q).map_err(|_| "bad EODHD URL".to_string())?;
    let res = client.get(url).send().await.map_err(|e| e.without_url().to_string())?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.without_url().to_string())?;
    Ok((status, body))
}

/// Requests spaced for EODHD's rate limit; one retry after a 429.
async fn fetch(client: &reqwest::Client, url: &str, key: &str, query: &[(&str, String)]) -> Result<String, String> {
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    for attempt in 0..2 {
        match get(client, url, key, query).await? {
            (200, body) => return Ok(body),
            (429, _) if attempt == 0 => tokio::time::sleep(std::time::Duration::from_secs(60)).await,
            (401 | 403, _) => return Err("key rejected".into()),
            (404, _) => return Ok("[]".into()),
            (s, _) => return Err(format!("HTTP {s}")),
        }
    }
    Err("rate limited".into())
}

/// Runs the import (schedule or the Back Office "Refresh"); returns the report.
pub async fn import(hub: &Hub, pool: &PgPool, cfg: &Config, trigger: &str) -> Value {
    if cfg.eodhd_key.is_empty() {
        return json!({"status": "not_configured", "message": "EODHD not configured: add EODHD_API_KEY"});
    }
    let run: i64 = match sqlx::query_scalar("INSERT INTO corporate_action_imports (source) VALUES ('eodhd') RETURNING id").fetch_one(pool).await {
        Ok(id) => id,
        Err(e) => return json!({"status": "error", "message": e.to_string()}),
    };
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build() {
        Ok(c) => c,
        Err(e) => return json!({"status": "error", "message": e.without_url().to_string()}),
    };
    let today = Utc::now().date_naive();
    let specs = hub.shared.specs.load();
    let stocks: Vec<(String, String)> = specs.all().filter_map(|s| ticker(s).map(|t| (s.symbol.clone(), t))).collect();
    let ours: std::collections::HashMap<String, String> = stocks.iter().map(|(s, t)| (t.clone(), s.clone())).collect();
    let mut proposals = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let base = cfg.eodhd_url.clone();
    // splits: one calendar request
    match fetch(&client, &format!("{base}/calendar/splits"), &cfg.eodhd_key, &[("from", today.to_string()), ("to", (today + Duration::days(120)).to_string())]).await {
        Ok(body) => match parse_splits(&body, &ours, today) {
            Ok(v) => proposals.extend(v),
            Err(e) => errors.push(e),
        },
        Err(e) => errors.push(format!("splits calendar: {e}")),
    }
    // dividends: per stock
    let mut aborted = false;
    for (sym, t) in &stocks {
        match fetch(&client, &format!("{base}/div/{t}"), &cfg.eodhd_key, &[("from", today.to_string())]).await {
            Ok(body) => match parse_dividends(sym, t, &body, today) {
                Ok(v) => proposals.extend(v),
                Err(e) => errors.push(e),
            },
            Err(e) if e == "key rejected" => {
                errors.push("EODHD rejected the key (EODHD_API_KEY)".into());
                aborted = true;
                break;
            }
            Err(e) => errors.push(format!("{t}: {e}")),
        }
    }
    let mut counts: std::collections::BTreeMap<&str, u64> = Default::default();
    for p in &proposals {
        match upsert(hub, pool, p, "EODHD import").await {
            Ok(k) => *counts.entry(k).or_default() += 1,
            Err(e) => errors.push(format!("{} {} {}: {e}", p.symbol, p.kind, p.ex_date)),
        }
    }
    let report = json!({
        "status": if aborted { "aborted" } else if errors.is_empty() { "ok" } else { "partial" },
        "trigger": trigger, "stocks": stocks.len(), "found": proposals.len(), "counts": counts,
        "errors": errors.iter().take(50).collect::<Vec<_>>(), "errorCount": errors.len(),
    });
    let _ = sqlx::query("UPDATE corporate_action_imports SET finished_at = now(), report = $2 WHERE id = $1").bind(run).bind(sqlx::types::Json(&report)).execute(pool).await;
    audit(pool, None, "EODHD import", "import", report.clone(), None).await;
    report
}

/// The last import run (Back Office header).
pub async fn last_run(pool: &PgPool) -> Option<Value> {
    let r: Option<(chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>, Option<sqlx::types::Json<Value>>)> =
        sqlx::query_as("SELECT started_at, finished_at, report FROM corporate_action_imports ORDER BY id DESC LIMIT 1").fetch_optional(pool).await.ok().flatten();
    r.map(|(s, f, rep)| json!({"startedAt": s, "finishedAt": f, "report": rep.map(|j| j.0)}))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Recorded in EODHD's documented formats (https://eodhd.com/financial-apis/api-splits-dividends,
    /// https://eodhd.com/financial-apis/calendar-upcoming-earnings-ipos-and-splits).
    const DIV_AAPL: &str = include_str!("../../tests/fixtures/eodhd/div_AAPL.US.json");
    const DIV_0700: &str = include_str!("../../tests/fixtures/eodhd/div_0700.HK.json");
    const SPLITS: &str = include_str!("../../tests/fixtures/eodhd/calendar_splits.json");

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn tickers_map_to_eodhd() {
        let s = crate::specs::test_specs();
        let t = |sym: &str| ticker(s.get(sym).unwrap());
        assert_eq!(t("AAPL").as_deref(), Some("AAPL.US"), "core stock");
        assert_eq!(t("MSFT").as_deref(), Some("MSFT.US"));
        assert_eq!(t("A.US").as_deref(), Some("A.US"), "one-letter ticker keeps its suffix");
        assert_eq!(t("00700.HK").as_deref(), Some("0700.HK"), "Hong Kong: four digits");
        assert_eq!(t("09988.HK").as_deref(), Some("9988.HK"));
        assert_eq!(t("7203.JP").as_deref(), Some("7203.TSE"));
        assert_eq!(t("EURUSD"), None);
        // every stock of the catalogue maps, uniquely
        let all: Vec<String> = s.all().filter_map(ticker).collect();
        assert_eq!(all.len(), s.all().filter(|x| x.asset_class == "stocks").count());
        let set: std::collections::BTreeSet<&String> = all.iter().collect();
        assert_eq!(set.len(), all.len());
    }

    #[test]
    fn dividends_parse_from_today_with_dates_and_currency() {
        let v = parse_dividends("AAPL", "AAPL.US", DIV_AAPL, d("2026-10-07")).unwrap();
        assert_eq!(v.len(), 1, "past ex-dates are not proposed");
        let p = &v[0];
        assert_eq!((p.kind, p.ex_date, p.amount, p.currency.as_deref()), ("dividend", d("2026-11-09"), Some("0.27".parse().unwrap()), Some("USD")));
        assert_eq!((p.record_date, p.pay_date), (Some(d("2026-11-10")), Some(d("2026-11-13"))));
        let hk = parse_dividends("00700.HK", "0700.HK", DIV_0700, d("2026-10-07")).unwrap();
        assert_eq!(hk.len(), 1);
        assert_eq!(hk[0].currency.as_deref(), Some("HKD"));
        assert_eq!(hk[0].amount, Some("2.10".parse().unwrap()), "the unadjusted value is the cash paid");
        assert!(parse_dividends("X", "X.US", "{not json", d("2026-10-07")).is_err());
        assert!(parse_dividends("X", "X.US", "[]", d("2026-10-07")).unwrap().is_empty());
    }

    #[test]
    fn splits_calendar_keeps_our_stocks_only() {
        let ours: std::collections::HashMap<String, String> = [("NVDA.US", "NVDA"), ("7203.TSE", "7203.JP")].iter().map(|(a, b)| (a.to_string(), b.to_string())).collect();
        let v = parse_splits(SPLITS, &ours, d("2026-10-07")).unwrap();
        assert_eq!(v.len(), 2, "{v:?}");
        let nv = v.iter().find(|p| p.symbol == "NVDA").unwrap();
        assert_eq!((nv.ex_date, nv.ratio_from, nv.ratio_to), (d("2026-11-20"), Some(D::ONE), Some(D::from(10))));
        let tm = v.iter().find(|p| p.symbol == "7203.JP").unwrap();
        assert_eq!((tm.ratio_from, tm.ratio_to), (Some(D::from(5)), Some(D::ONE)), "a 1-for-5 reverse split");
    }

    #[test]
    fn four_eyes_rule() {
        assert!(needs_four_eyes("split", None, Some(D::from(100))));
        assert!(!needs_four_eyes("dividend", Some("0.27".parse().unwrap()), Some(D::from(250))));
        assert!(needs_four_eyes("dividend", Some(D::from(6)), Some(D::from(250))), "2.4 % of the price");
        assert!(needs_four_eyes("dividend", Some(D::ONE), None), "unknown price: four-eyes");
    }
}
