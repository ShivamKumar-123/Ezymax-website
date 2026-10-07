//! Cross-check of applied corporate actions against the price provider (Infoway adjustment factors, fetched through
//! market-data's admin API, which holds the provider key). The forward adjustment factor jumps on the ex-date: by the
//! split factor for a split (NVDA 10-for-1: 0.0997 → 0.9972), by 1 / (1 − dividend / previous close) for a
//! dividend. A mismatch is logged as an error, audited and shown in the Back Office; it changes nothing by itself.

use chrono::{Duration, NaiveDate, Utc};
use serde_json::{Value, json};
use sqlx::PgPool;

use super::{ActionRow, COLUMNS, audit, from_row};
use crate::config::Config;
use crate::money::{D, num};

/// Split ratios must match within this.
const SPLIT_TOLERANCE: &str = "0.02";

/// (status, detail) for `row` given the factors `(trading day, factor)` around its ex-date.
pub fn evaluate(row: &ActionRow, factors: &[(NaiveDate, D)]) -> (&'static str, Value) {
    let before = factors.iter().filter(|(d, _)| *d < row.ex_date).max_by_key(|(d, _)| *d);
    let on = factors.iter().filter(|(d, _)| *d >= row.ex_date).min_by_key(|(d, _)| *d);
    let (Some((d0, f0)), Some((d1, f1))) = (before, on) else {
        return ("no_data", json!({"message": "no provider factors around the ex-date yet"}));
    };
    if *f0 <= D::ZERO || *f1 <= D::ZERO {
        return ("no_data", json!({"message": "invalid provider factors"}));
    }
    let observed = *f1 / *f0;
    match row.kind.as_str() {
        "split" => {
            let (Some(from), Some(to)) = (row.ratio_from, row.ratio_to) else { return ("no_data", json!({})) };
            let k = to / from;
            let off = (observed / k - D::ONE).abs();
            let ok = off <= SPLIT_TOLERANCE.parse::<D>().unwrap();
            (if ok { "ok" } else { "mismatch" }, json!({"expectedFactor": num(k), "observedFactor": num(observed.round_dp(6)), "factorDates": [d0, d1]}))
        }
        _ => {
            // implied dividend as a share of the previous close
            let implied = D::ONE - *f0 / *f1;
            let expected = match (row.amount, row.ref_price) {
                (Some(a), Some(p)) if p > D::ZERO => Some(a / p),
                _ => None,
            };
            let ok = match expected {
                Some(e) => implied > D::ZERO && (implied - e).abs() <= (e * "0.3".parse::<D>().unwrap()).max("0.0005".parse().unwrap()),
                None => implied > D::ZERO,
            };
            (if ok { "ok" } else { "mismatch" }, json!({"impliedPct": num((implied * D::from(100)).round_dp(4)), "expectedPct": expected.map(|e| num((e * D::from(100)).round_dp(4))), "factorDates": [d0, d1]}))
        }
    }
}

/// Factors from market-data (`/v1/admin/adjustment-factors`), `None` when market-data cannot provide them.
async fn factors(cfg: &Config, row: &ActionRow) -> Result<Vec<(NaiveDate, D)>, String> {
    if cfg.market_data_admin_token.is_empty() {
        return Err("MARKET_DATA_ADMIN_TOKEN not set".into());
    }
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build().map_err(|e| e.without_url().to_string())?;
    let from = (row.ex_date - Duration::days(10)).format("%Y%m%d").to_string();
    let to = (row.ex_date + Duration::days(3)).format("%Y%m%d").to_string();
    let url = reqwest::Url::parse_with_params(&format!("{}/v1/admin/adjustment-factors", cfg.market_data_url), &[("symbol", row.symbol.as_str()), ("from", from.as_str()), ("to", to.as_str())]).map_err(|_| "bad MARKET_DATA_URL".to_string())?;
    let res = client
        .get(url)
        .bearer_auth(&cfg.market_data_admin_token)
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if !res.status().is_success() {
        return Err(format!("market-data HTTP {}", res.status().as_u16()));
    }
    let v: Value = res.json().await.map_err(|e| e.without_url().to_string())?;
    Ok(v["factors"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|f| Some((NaiveDate::parse_from_str(f["date"].as_str()?, "%Y%m%d").ok()?, f["factor"].as_f64().and_then(crate::money::from_f64)?)))
        .collect())
}

/// Checks one action now and stores the result.
pub async fn check_one(pool: &PgPool, cfg: &Config, row: &ActionRow) -> Value {
    let (status, detail) = match factors(cfg, row).await {
        Ok(f) => evaluate(row, &f),
        Err(e) => ("no_data", json!({"message": e})),
    };
    let _ = sqlx::query("UPDATE corporate_actions SET check_status = $2, check_detail = $3, updated_at = now() WHERE id = $1").bind(row.id).bind(status).bind(sqlx::types::Json(&detail)).execute(pool).await;
    if status == "mismatch" {
        tracing::error!(action = row.id, symbol = %row.symbol, kind = %row.kind, ex_date = %row.ex_date, detail = %detail, "corporate action does not match the provider's adjustment factors");
        audit(pool, Some(row.id), "system", "check_mismatch", detail.clone(), None).await;
    }
    json!({"status": status, "detail": detail})
}

/// Hourly: applied actions of the last 10 days without a definite result.
pub async fn run(pool: &PgPool, cfg: &Config) {
    let since = Utc::now().date_naive() - Duration::days(10);
    let q = format!("SELECT {COLUMNS} FROM corporate_actions WHERE status IN ('applying', 'applied') AND ex_date >= $1 AND ex_date <= CURRENT_DATE AND (check_status IS NULL OR check_status = 'no_data')");
    let Ok(rows) = sqlx::query(sqlx::AssertSqlSafe(q)).bind(since).fetch_all(pool).await else { return };
    for r in rows.iter().map(from_row) {
        check_one(pool, cfg, &r).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(kind: &str) -> ActionRow {
        let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        ActionRow {
            id: 1,
            symbol: "X".into(),
            kind: kind.into(),
            ex_date: d("2024-06-10"),
            apply_at: Utc::now(),
            ratio_from: Some(D::ONE),
            ratio_to: Some(D::from(10)),
            amount: Some("0.26".parse().unwrap()),
            currency: Some("USD".into()),
            withholding_pct: D::ZERO,
            record_date: None,
            pay_date: None,
            ref_price: Some("229.35".parse().unwrap()),
            four_eyes: true,
            status: "applied".into(),
            source: "manual".into(),
            source_ref: None,
            note: None,
            created_by: "t".into(),
            created_by_id: "1".into(),
            created_at: Utc::now(),
            approved_by: None,
            approved_at: None,
            applied_at: None,
            report: None,
            check_status: None,
            check_detail: None,
        }
    }

    fn f(v: &[(&str, &str)]) -> Vec<(NaiveDate, D)> {
        v.iter().map(|(d, x)| (NaiveDate::parse_from_str(d, "%Y-%m-%d").unwrap(), x.parse().unwrap())).collect()
    }

    #[test]
    fn split_and_dividend_against_real_provider_factors() {
        // NVDA 10-for-1 on 2024-06-10 (Infoway factors)
        let nv = f(&[("2024-06-06", "0.0997156715"), ("2024-06-07", "0.0997156715"), ("2024-06-10", "0.9971567150")]);
        assert_eq!(evaluate(&row("split"), &nv).0, "ok");
        let mut wrong = row("split");
        wrong.ratio_to = Some(D::from(4));
        assert_eq!(evaluate(&wrong, &nv).0, "mismatch");
        // AAPL 0.26 USD ex 2025-08-11 (Infoway factors; close ~229)
        let mut aapl = row("dividend");
        aapl.ex_date = NaiveDate::from_ymd_opt(2025, 8, 11).unwrap();
        let af = f(&[("2025-08-07", "0.9951901144"), ("2025-08-08", "0.9951901144"), ("2025-08-11", "0.9963195807")]);
        assert_eq!(evaluate(&aapl, &af).0, "ok", "{:?}", evaluate(&aapl, &af).1);
        aapl.amount = Some(D::ONE);
        assert_eq!(evaluate(&aapl, &af).0, "mismatch");
        assert_eq!(evaluate(&aapl, &[]).0, "no_data");
    }
}
