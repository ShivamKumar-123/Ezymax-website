//! Client report emails: the weekly trading summary (Monday, for clients who traded last week) and the monthly
//! statement notice (the 1st, for clients with any activity last month). Both go through the support hub
//! (`POST /v1/notify`, kind `reports.*`), so the client's preference for the "reports" category (off by default,
//! opt-in), the Back Office switches, an admin's template and the email log all apply. The figures come from
//! the mirrored ledger and deals (the same source as the Client Area's analytics and statements).
//!
//! A `client_report_sends` row is claimed per client and period before anything is built, so a restart or a
//! second instance never sends a period twice. Env: `CLIENT_REPORTS` (`false` = off), `CLIENT_REPORTS_HOUR`
//! (server time, default 8), `SUPPORT_URL` (`off` = off), `SUPPORT_INTERNAL_TOKEN`.

use chrono::{DateTime, Datelike, Duration, Timelike, Utc, Weekday};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use sqlx::Row;

use crate::client::{self, flow_key};
use crate::metrics;
use crate::state::App;
use crate::time;

const WEEKLY: &str = "reports.weekly_summary";
const MONTHLY: &str = "reports.monthly_statement";

/// A period that is due: which report, its label for the dedupe key, and its [from, to) in UTC.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Due {
    pub kind: &'static str,
    pub period: String,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
}

/// What is due at `now`: on a Monday at or after `hour` (server time) the previous week; on the 1st the
/// previous month. Both on a Monday the 1st.
pub fn due_at(now: DateTime<Utc>, hour: u32) -> Vec<Due> {
    let today = time::server_day(now);
    if time::server_naive(now).hour() < hour {
        return Vec::new();
    }
    let mut v = Vec::new();
    if today.weekday() == Weekday::Mon {
        let from = today - Duration::days(7);
        let iso = from.iso_week();
        v.push(Due { kind: "weekly", period: format!("{}-W{:02}", iso.year(), iso.week()), from: time::day_start(from), to: time::day_start(today) });
    }
    if today.day() == 1 {
        let from = time::add_months(today, -1);
        v.push(Due { kind: "monthly", period: format!("{}-{:02}", from.year(), from.month()), from: time::day_start(from), to: time::day_start(today) });
    }
    v
}

/// The figures of one client for a period (live accounts, USD).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Figures {
    pub accounts: usize,
    pub trades: usize,
    pub wins: usize,
    pub win_rate: f64,
    pub net: f64,
    pub lots: f64,
    pub best: Option<(String, f64)>,
    pub worst: Option<(String, f64)>,
    pub deposits: f64,
    pub withdrawals: f64,
    pub closing_balance: f64,
    /// Any deal or ledger posting in the period.
    pub active: bool,
}

pub async fn figures(app: &App, tenant: &str, user_id: i64, from: DateTime<Utc>, to: DateTime<Utc>) -> anyhow::Result<Figures> {
    let accts = client::user_accounts(app, tenant, user_id).await.map_err(|e| anyhow::anyhow!("{e:?}"))?;
    let live = client::scope(&accts, None).map_err(|e| anyhow::anyhow!("{e:?}"))?;
    if live.is_empty() {
        return Ok(Figures::default());
    }
    let logins: Vec<i64> = live.iter().map(|a| a.login).collect();
    let trades = client::trades_for(app, tenant, &live, Some(from), Some(to)).await.map_err(|e| anyhow::anyhow!("{e:?}"))?;
    let s = metrics::trade_stats(&trades);
    let mut f = Figures {
        accounts: live.len(),
        trades: s.trades,
        wins: s.wins,
        win_rate: s.win_rate,
        net: s.net,
        lots: s.lots,
        best: s.best.as_ref().map(|t| (t.symbol.clone(), t.net)),
        worst: s.worst.as_ref().map(|t| (t.symbol.clone(), t.net)),
        closing_balance: live.iter().map(|a| a.balance * a.usd()).sum(),
        active: s.trades > 0,
        ..Default::default()
    };
    let rows = sqlx::query("SELECT login, kind, sum(amount) AS amt, count(*) AS n FROM ledger WHERE tenant = $1 AND login = ANY($2) AND sub_ledger = 'balance' AND at >= $3 AND at < $4 GROUP BY 1, 2")
        .bind(tenant)
        .bind(&logins)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?;
    for r in rows {
        let login: i64 = r.get("login");
        let k = live.iter().find(|a| a.login == login).map(|a| a.usd()).unwrap_or(1.0);
        let amt = r.get::<Decimal, _>("amt").to_f64().unwrap_or(0.0) * k;
        let kind: String = r.get("kind");
        if r.get::<i64, _>("n") > 0 {
            f.active = true;
        }
        match flow_key(&kind) {
            "deposits" => f.deposits += amt,
            "withdrawals" => f.withdrawals += amt.abs(),
            _ => {}
        }
    }
    Ok(f)
}

fn money(v: f64) -> String {
    let sign = if v < 0.0 { "-" } else { "" };
    let a = v.abs();
    let mut whole = a.trunc() as i64;
    let mut cents = ((a - a.trunc()) * 100.0).round() as i64;
    if cents == 100 {
        whole += 1;
        cents = 0;
    }
    let mut w = whole.to_string();
    let mut out = String::new();
    while w.len() > 3 {
        let tail = w.split_off(w.len() - 3);
        out = format!(",{tail}{out}");
    }
    format!("{sign}${w}{out}.{cents:02}")
}

fn signed(v: f64) -> String {
    if v > 0.0 { format!("+{}", money(v)) } else { money(v) }
}

/// The notice body (support `/v1/notify`) for a period: title, body, subject, facts and a note.
pub fn notice(kind: &str, period_label: &str, f: &Figures, user_id: i64, period: &str) -> Value {
    let weekly = kind == "weekly";
    let (title, subject, link) = if weekly {
        ("Your week in trading".to_string(), format!("Your trading summary for {period_label}"), "/overview")
    } else {
        (format!("Your {period_label} statement is ready"), format!("Your account statement for {period_label}"), "/statements")
    };
    let result = if f.net >= 0.0 { "finished ahead" } else { "finished behind" };
    let plural = |n: usize| if n == 1 { "" } else { "s" };
    let body = if weekly {
        format!(
            "Here is how your trading went in {period_label}. You closed {} trade{} across {} live account{} and {result} by {}.",
            f.trades,
            plural(f.trades),
            f.accounts,
            plural(f.accounts),
            money(f.net.abs())
        )
    } else if f.trades > 0 {
        format!(
            "Your statement for {period_label} is ready in the Client Area. You closed {} trade{} and {result} by {}; the full statement lists every deal, deposit, withdrawal and charge, and can be downloaded as a PDF.",
            f.trades,
            plural(f.trades),
            money(f.net.abs())
        )
    } else {
        format!("Your statement for {period_label} is ready in the Client Area. There were no closed trades this month; the statement lists your deposits, withdrawals and balance, and can be downloaded as a PDF.")
    };
    let mut facts = vec![json!({"label": "Closed trades", "value": f.trades.to_string()})];
    if f.trades > 0 {
        facts.push(json!({"label": "Win rate", "value": format!("{:.0}%", f.win_rate * 100.0)}));
        facts.push(json!({"label": "Net result", "value": signed(f.net)}));
        facts.push(json!({"label": "Volume", "value": format!("{:.2} lots", f.lots)}));
    }
    if let Some((s, n)) = &f.best {
        facts.push(json!({"label": "Best trade", "value": format!("{s} {}", signed(*n))}));
    }
    if let Some((s, n)) = &f.worst
        && *n < 0.0
    {
        facts.push(json!({"label": "Worst trade", "value": format!("{s} {}", signed(*n))}));
    }
    if !weekly {
        facts.push(json!({"label": "Deposits", "value": money(f.deposits)}));
        facts.push(json!({"label": "Withdrawals", "value": money(f.withdrawals)}));
        facts.push(json!({"label": "Balance now", "value": money(f.closing_balance)}));
    }
    let note = if weekly { "Figures are for your live accounts, in USD, closed trades only. Open positions are not included." } else { "Statements are kept for every month in Portfolio -> Statements." };
    json!({
        "userId": user_id, "type": if weekly { WEEKLY } else { MONTHLY }, "title": title, "body": body, "link": link,
        "severity": "info", "emailSubject": subject, "dedupeKey": format!("report:{kind}:{user_id}:{period}"),
        "data": {"period": period, "facts": facts, "note": note},
    })
}

fn period_label(d: &Due) -> String {
    let from = time::server_day(d.from);
    let last = time::server_day(d.to) - Duration::days(1);
    if d.kind == "weekly" {
        if from.month() == last.month() {
            format!("{}-{} {}", from.day(), last.day(), last.format("%B %Y"))
        } else {
            format!("{} {} - {} {} {}", from.day(), from.format("%B"), last.day(), last.format("%B"), last.year())
        }
    } else {
        from.format("%B %Y").to_string()
    }
}

async fn post(app: &App, tenant: &str, payload: &Value) -> anyhow::Result<()> {
    let r = app
        .http
        .post(format!("{}/v1/notify", app.cfg.support_url))
        .header("x-ezymex-internal", &app.cfg.support_token)
        .header("x-ezymex-tenant", tenant)
        .header("x-ezymex-service", "reports")
        .timeout(std::time::Duration::from_secs(8))
        .json(payload)
        .send()
        .await?;
    if !r.status().is_success() {
        anyhow::bail!("support answered HTTP {}", r.status());
    }
    Ok(())
}

/// One pass: for every due period and every client with a live account, claim, build and send.
pub async fn tick(app: &App, now: DateTime<Utc>) -> anyhow::Result<usize> {
    let mut sent = 0;
    for d in due_at(now, app.cfg.client_reports_hour) {
        for tenant in &app.cfg.tenants {
            let users: Vec<i64> = sqlx::query_scalar("SELECT DISTINCT user_id FROM accounts WHERE tenant = $1 AND kind = 'live' AND status <> 'archived' ORDER BY user_id").bind(tenant).fetch_all(&app.pool).await?;
            for user_id in users {
                let claimed = sqlx::query("INSERT INTO client_report_sends (tenant, kind, user_id, period) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING")
                    .bind(tenant)
                    .bind(d.kind)
                    .bind(user_id)
                    .bind(&d.period)
                    .execute(&app.pool)
                    .await?
                    .rows_affected();
                if claimed == 0 {
                    continue;
                }
                let outcome: anyhow::Result<&str> = async {
                    let f = figures(app, tenant, user_id, d.from, d.to).await?;
                    let send = if d.kind == "weekly" { f.trades > 0 } else { f.active };
                    if !send {
                        return Ok("skipped");
                    }
                    post(app, tenant, &notice(d.kind, &period_label(&d), &f, user_id, &d.period)).await?;
                    Ok("sent")
                }
                .await;
                let (status, err) = match &outcome {
                    Ok(s) => (*s, None),
                    Err(e) => ("failed", Some(e.to_string())),
                };
                if status == "sent" {
                    sent += 1;
                }
                if status == "failed" {
                    tracing::warn!(tenant, user_id, kind = d.kind, period = %d.period, error = ?err, "client report not sent");
                }
                sqlx::query("UPDATE client_report_sends SET status = $5, error = $6 WHERE tenant = $1 AND kind = $2 AND user_id = $3 AND period = $4")
                    .bind(tenant)
                    .bind(d.kind)
                    .bind(user_id)
                    .bind(&d.period)
                    .bind(status)
                    .bind(err)
                    .execute(&app.pool)
                    .await?;
            }
        }
    }
    Ok(sent)
}

/// Every 5 minutes. A failed claim stays `failed` and is not retried (visible in `client_report_sends`).
pub async fn runner(app: App) {
    if !app.cfg.client_reports || app.cfg.support_url.is_empty() {
        tracing::info!("client report emails are off (CLIENT_REPORTS=false or SUPPORT_URL=off)");
        return;
    }
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(300)).await;
        match tick(&app, Utc::now()).await {
            Ok(n) if n > 0 => tracing::info!(sent = n, "client report emails sent"),
            Ok(_) => {}
            Err(e) => tracing::warn!(error = %e, "client reports tick failed"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{NaiveDate, TimeZone};

    #[test]
    fn due_on_monday_and_first() {
        // 2026-11-02 is a Monday; server time GMT+2 in November (US DST ended 1 Nov)
        let mon = Utc.with_ymd_and_hms(2026, 11, 2, 7, 0, 0).unwrap(); // 09:00 server
        let d = due_at(mon, 8);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].kind, "weekly");
        assert_eq!(d[0].period, "2026-W44");
        assert_eq!(time::server_day(d[0].from), NaiveDate::from_ymd_opt(2026, 10, 26).unwrap());
        assert_eq!(time::server_day(d[0].to), NaiveDate::from_ymd_opt(2026, 11, 2).unwrap());
        // too early in the day
        assert!(due_at(Utc.with_ymd_and_hms(2026, 11, 2, 4, 0, 0).unwrap(), 8).is_empty());
        // a Tuesday: nothing
        assert!(due_at(Utc.with_ymd_and_hms(2026, 11, 3, 10, 0, 0).unwrap(), 8).is_empty());
        // the 1st (a Sunday): the month only
        let first = Utc.with_ymd_and_hms(2026, 11, 1, 10, 0, 0).unwrap();
        let d = due_at(first, 8);
        assert_eq!(d.len(), 1);
        assert_eq!((d[0].kind, d[0].period.as_str()), ("monthly", "2026-10"));
        assert_eq!(time::server_day(d[0].from), NaiveDate::from_ymd_opt(2026, 10, 1).unwrap());
        // Monday 1 June 2026: both
        let both = due_at(Utc.with_ymd_and_hms(2026, 6, 1, 10, 0, 0).unwrap(), 8);
        assert_eq!(both.iter().map(|d| d.kind).collect::<Vec<_>>(), vec!["weekly", "monthly"]);
    }

    #[test]
    fn notice_wording_and_facts() {
        let f = Figures { accounts: 1, trades: 12, wins: 7, win_rate: 7.0 / 12.0, net: 184.5, lots: 3.4, best: Some(("XAUUSD".into(), 96.2)), worst: Some(("EURUSD".into(), -40.0)), deposits: 500.0, withdrawals: 0.0, closing_balance: 1684.5, active: true };
        let n = notice("weekly", "26 October - 1 November 2026", &f, 613, "2026-W44");
        assert_eq!(n["type"], "reports.weekly_summary");
        assert_eq!(n["dedupeKey"], "report:weekly:613:2026-W44");
        assert_eq!(n["link"], "/portfolio");
        assert!(n["body"].as_str().unwrap().contains("12 trades"));
        assert!(n["body"].as_str().unwrap().contains("finished ahead by $184.50"));
        let facts = n["data"]["facts"].as_array().unwrap();
        assert_eq!(facts[1]["value"], "58%");
        assert_eq!(facts[2]["value"], "+$184.50");
        assert!(facts.iter().all(|x| x["label"] != "Deposits"));
        let m = notice("monthly", "October 2026", &f, 613, "2026-10");
        assert_eq!(m["link"], "/statements");
        assert_eq!(m["emailSubject"], "Your account statement for October 2026");
        let facts = m["data"]["facts"].as_array().unwrap();
        assert!(facts.iter().any(|x| x["label"] == "Deposits" && x["value"] == "$500.00"));
        assert!(facts.iter().any(|x| x["label"] == "Balance now" && x["value"] == "$1,684.50"));
        // no trades: the quiet-month wording, and no win rate
        let q = Figures { accounts: 1, active: true, ..Default::default() };
        let m = notice("monthly", "October 2026", &q, 613, "2026-10");
        assert!(m["body"].as_str().unwrap().contains("no closed trades"));
        assert_eq!(m["data"]["facts"].as_array().unwrap().len(), 4);
    }

    #[test]
    fn period_labels() {
        let d = Due { kind: "weekly", period: "2026-W44".into(), from: time::day_start(NaiveDate::from_ymd_opt(2026, 10, 26).unwrap()), to: time::day_start(NaiveDate::from_ymd_opt(2026, 11, 2).unwrap()) };
        assert_eq!(period_label(&d), "26 October - 1 November 2026");
        let d = Due { kind: "weekly", period: "2026-W45".into(), from: time::day_start(NaiveDate::from_ymd_opt(2026, 11, 2).unwrap()), to: time::day_start(NaiveDate::from_ymd_opt(2026, 11, 9).unwrap()) };
        assert_eq!(period_label(&d), "2-8 November 2026");
        let d = Due { kind: "monthly", period: "2026-10".into(), from: time::day_start(NaiveDate::from_ymd_opt(2026, 10, 1).unwrap()), to: time::day_start(NaiveDate::from_ymd_opt(2026, 11, 1).unwrap()) };
        assert_eq!(period_label(&d), "October 2026");
    }

    #[test]
    fn money_format() {
        assert_eq!(money(1234567.891), "$1,234,567.89");
        assert_eq!(money(-5.5), "-$5.50");
        assert_eq!(signed(0.0), "$0.00");
        assert_eq!(signed(12.0), "+$12.00");
    }
}
