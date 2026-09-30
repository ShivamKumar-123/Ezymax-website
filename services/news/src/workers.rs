//! Background jobs: feed polling (ETag / Last-Modified, per-source interval), the weekly calendar export,
//! actual values from a licensed provider (optional), calendar reminders, the daily brief and housekeeping.

use chrono::{DateTime, Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};
use sqlx::Row;
use std::time::Duration as StdDuration;

use crate::calendar::{self, to_server};
use crate::{AppState, brief, feed, store};

const MAX_BODY: usize = 4 * 1024 * 1024;
pub const CALENDAR_ID: &str = "forexfactory";
/// Manual calendar refreshes are refused inside this window (the export allows 2 requests per 5 minutes).
pub const CALENDAR_MIN_GAP_SECS: i64 = 300;

pub fn spawn_all(st: AppState) {
    let s = st.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = poll_due_sources(&s).await {
                tracing::warn!(error = %e, "feed poll failed");
            }
            tokio::time::sleep(StdDuration::from_secs(30)).await;
        }
    });
    let s = st.clone();
    tokio::spawn(async move {
        loop {
            let due = calendar_due(&s).await.unwrap_or(true);
            if due {
                match refresh_calendar(&s).await {
                    Ok(r) => tracing::info!(result = %r, "calendar refreshed"),
                    Err(e) => tracing::warn!(error = %e, "calendar refresh failed"),
                }
            }
            tokio::time::sleep(StdDuration::from_secs(60)).await;
        }
    });
    if !st.cfg.te_key.is_empty() {
        let s = st.clone();
        tokio::spawn(async move {
            loop {
                if let Err(e) = te_actuals(&s).await {
                    tracing::warn!(error = %e, "licensed calendar actuals failed");
                }
                tokio::time::sleep(StdDuration::from_secs(300)).await;
            }
        });
    }
    let s = st.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = send_reminders(&s).await {
                tracing::warn!(error = %e, "calendar reminders failed");
            }
            tokio::time::sleep(StdDuration::from_secs(30)).await;
        }
    });
    if st.cfg.brief && !st.cfg.anthropic_key.is_empty() {
        let s = st.clone();
        tokio::spawn(async move {
            tokio::time::sleep(StdDuration::from_secs(90)).await; // let the first fetches land
            loop {
                match brief::ensure_today(&s).await {
                    Ok(Some(day)) => tracing::info!(%day, "daily brief generated"),
                    Ok(None) => {}
                    Err(e) => {
                        tracing::warn!(error = %e, "daily brief failed; retrying in 30 minutes");
                        tokio::time::sleep(StdDuration::from_secs(1500)).await;
                    }
                }
                tokio::time::sleep(StdDuration::from_secs(300)).await;
            }
        });
    }
    if st.cfg.infoway && !st.cfg.infoway_key.is_empty() {
        let s = st.clone();
        tokio::spawn(async move { crate::infoway::run(s).await });
    }
    let s = st;
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(StdDuration::from_secs(6 * 3600)).await;
            if let Err(e) = store::prune(&s.pool).await {
                tracing::warn!(error = %e, "prune failed");
            }
        }
    });
}

async fn read_limited(res: reqwest::Response) -> anyhow::Result<String> {
    if res.content_length().is_some_and(|l| l as usize > MAX_BODY) {
        anyhow::bail!("feed too large");
    }
    let bytes = res.bytes().await?;
    if bytes.len() > MAX_BODY {
        anyhow::bail!("feed too large");
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

async fn poll_due_sources(st: &AppState) -> anyhow::Result<()> {
    let due: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM sources WHERE enabled AND kind <> 'provider'
           AND (last_fetch_at IS NULL OR last_fetch_at + make_interval(secs => interval_secs) <= now())
         ORDER BY last_fetch_at NULLS FIRST",
    )
    .fetch_all(&st.pool)
    .await?;
    for id in due {
        match fetch_source(st, &id).await {
            Ok(r) => tracing::debug!(source = %id, result = %r, "feed polled"),
            Err(e) => tracing::warn!(source = %id, error = %e, "feed poll failed"),
        }
        tokio::time::sleep(StdDuration::from_millis(500)).await;
    }
    Ok(())
}

/// Fetch one feed now (conditional GET). Returns a short result string; errors are also stored on the source.
pub async fn fetch_source(st: &AppState, id: &str) -> anyhow::Result<String> {
    let row = sqlx::query("SELECT url, etag, last_modified FROM sources WHERE id = $1 AND kind <> 'provider'").bind(id).fetch_optional(&st.pool).await?;
    let Some(row) = row else { anyhow::bail!("unknown source") };
    let url: String = row.get("url");
    let mut req = st.http.get(&url).header("accept", "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5");
    if let Some(e) = row.get::<Option<String>, _>("etag") {
        req = req.header("if-none-match", e);
    }
    if let Some(m) = row.get::<Option<String>, _>("last_modified") {
        req = req.header("if-modified-since", m);
    }
    let result: anyhow::Result<(String, Option<String>, Option<String>)> = async {
        let res = req.send().await?;
        let status = res.status();
        let etag = res.headers().get("etag").and_then(|v| v.to_str().ok()).map(str::to_string);
        let lm = res.headers().get("last-modified").and_then(|v| v.to_str().ok()).map(str::to_string);
        if status == StatusCode::NOT_MODIFIED {
            return Ok(("not modified".into(), etag, lm));
        }
        if !status.is_success() {
            anyhow::bail!("HTTP {status}");
        }
        let body = read_limited(res).await?;
        let items = feed::parse(&body);
        if items.is_empty() && !body.contains("<rss") && !body.contains("<feed") && !body.contains("<rdf") {
            anyhow::bail!("not an RSS / Atom document");
        }
        let r = store::ingest(&st.pool, id, &items, &[], &[]).await?;
        Ok((format!("{} new, {} duplicates, {} older than {} days", r.inserted, r.duplicates, r.stale, store::MAX_AGE_DAYS), etag, lm))
    }
    .await;
    match result {
        Ok((msg, etag, lm)) => {
            sqlx::query("UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), last_error = NULL, etag = COALESCE($2, etag), last_modified = COALESCE($3, last_modified) WHERE id = $1")
                .bind(id)
                .bind(etag)
                .bind(lm)
                .execute(&st.pool)
                .await?;
            Ok(msg)
        }
        Err(e) => {
            sqlx::query("UPDATE sources SET last_fetch_at = now(), last_error = $2 WHERE id = $1").bind(id).bind(e.to_string().chars().take(300).collect::<String>()).execute(&st.pool).await?;
            Err(e)
        }
    }
}

async fn calendar_due(st: &AppState) -> anyhow::Result<bool> {
    let last: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT last_fetch_at FROM calendar_fetches WHERE id = $1").bind(CALENDAR_ID).fetch_optional(&st.pool).await?.flatten();
    Ok(last.is_none_or(|t| Utc::now() - t >= Duration::seconds(st.cfg.calendar_secs as i64)))
}

/// Seconds until a manual calendar refresh is allowed (0 = now).
pub async fn calendar_cooldown(st: &AppState) -> anyhow::Result<i64> {
    let last: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT last_fetch_at FROM calendar_fetches WHERE id = $1").bind(CALENDAR_ID).fetch_optional(&st.pool).await?.flatten();
    Ok(last.map(|t| (CALENDAR_MIN_GAP_SECS - (Utc::now() - t).num_seconds()).max(0)).unwrap_or(0))
}

/// Fetch the weekly export (conditional GET) and upsert its events.
pub async fn refresh_calendar(st: &AppState) -> anyhow::Result<String> {
    if st.cfg.calendar_url.is_empty() {
        anyhow::bail!("NEWS_CALENDAR_URL is empty");
    }
    let prev = sqlx::query("SELECT etag, last_modified FROM calendar_fetches WHERE id = $1").bind(CALENDAR_ID).fetch_optional(&st.pool).await?;
    sqlx::query("INSERT INTO calendar_fetches (id, url, last_fetch_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, last_fetch_at = now()")
        .bind(CALENDAR_ID)
        .bind(&st.cfg.calendar_url)
        .execute(&st.pool)
        .await?;
    let mut req = st.http.get(&st.cfg.calendar_url).header("accept", "application/json");
    if let Some(p) = &prev {
        if let Some(e) = p.get::<Option<String>, _>("etag") {
            req = req.header("if-none-match", e);
        }
        if let Some(m) = p.get::<Option<String>, _>("last_modified") {
            req = req.header("if-modified-since", m);
        }
    }
    let result: anyhow::Result<(String, Option<String>, Option<String>, i32)> = async {
        let res = req.send().await?;
        let status = res.status();
        let etag = res.headers().get("etag").and_then(|v| v.to_str().ok()).map(str::to_string);
        let lm = res.headers().get("last-modified").and_then(|v| v.to_str().ok()).map(str::to_string);
        if status == StatusCode::NOT_MODIFIED {
            return Ok(("not modified".into(), etag, lm, -1));
        }
        if !status.is_success() {
            anyhow::bail!("HTTP {status}");
        }
        let body = read_limited(res).await?;
        if body.trim_start().starts_with('<') {
            anyhow::bail!("the export answered with an HTML page (request limit reached?)");
        }
        let events = calendar::parse_ff(&body)?;
        let r = store::upsert_calendar(&st.pool, CALENDAR_ID, &events).await?;
        Ok((format!("{} events: {} new, {} updated, {} actuals", events.len(), r.inserted, r.updated, r.actuals.len()), etag, lm, events.len() as i32))
    }
    .await;
    match result {
        Ok((msg, etag, lm, n)) => {
            sqlx::query("UPDATE calendar_fetches SET last_ok_at = now(), last_error = NULL, etag = COALESCE($2, etag), last_modified = COALESCE($3, last_modified), events = CASE WHEN $4 >= 0 THEN $4 ELSE events END WHERE id = $1")
                .bind(CALENDAR_ID)
                .bind(etag)
                .bind(lm)
                .bind(n)
                .execute(&st.pool)
                .await?;
            Ok(msg)
        }
        Err(e) => {
            sqlx::query("UPDATE calendar_fetches SET last_error = $2 WHERE id = $1").bind(CALENDAR_ID).bind(e.to_string().chars().take(300).collect::<String>()).execute(&st.pool).await?;
            Err(e)
        }
    }
}

/* ------------------------------------------------------------------ */
/* Licensed provider actuals (Trading Economics, optional)             */
/* ------------------------------------------------------------------ */

fn te_currency(country: &str) -> &'static str {
    match country.to_ascii_lowercase().as_str() {
        "united states" => "USD",
        "euro area" | "germany" | "france" | "italy" | "spain" => "EUR",
        "united kingdom" => "GBP",
        "japan" => "JPY",
        "australia" => "AUD",
        "canada" => "CAD",
        "switzerland" => "CHF",
        "new zealand" => "NZD",
        "china" => "CNY",
        "india" => "INR",
        _ => "",
    }
}

/// Word overlap between two event titles (0..1), ignoring period suffixes like m/m, y/y, q/q.
pub fn title_overlap(a: &str, b: &str) -> f64 {
    let words = |s: &str| -> std::collections::BTreeSet<String> {
        feed::normalize_title(s).split(' ').filter(|w| w.len() > 1 && !["mm", "yy", "qq", "mom", "yoy", "qoq", "prel", "final", "flash"].contains(w)).map(str::to_string).collect()
    };
    let (x, y) = (words(a), words(b));
    if x.is_empty() || y.is_empty() {
        return 0.0;
    }
    x.intersection(&y).count() as f64 / x.len().min(y.len()) as f64
}

async fn te_actuals(st: &AppState) -> anyhow::Result<()> {
    let now = Utc::now();
    let url = format!(
        "https://api.tradingeconomics.com/calendar/country/All/{}/{}?c={}&f=json",
        (now - Duration::days(1)).format("%Y-%m-%d"),
        (now + Duration::days(1)).format("%Y-%m-%d"),
        st.cfg.te_key
    );
    let res = st.http.get(&url).send().await.map_err(|e| anyhow::anyhow!(e.without_url()))?;
    if !res.status().is_success() {
        anyhow::bail!("Trading Economics HTTP {}", res.status());
    }
    let rows: Vec<Value> = res.json().await.map_err(|e| anyhow::anyhow!(e.without_url()))?;
    let ours = sqlx::query("SELECT id, title, currency, starts_at FROM calendar_events WHERE actual = '' AND starts_at BETWEEN now() - interval '1 day' AND now() + interval '5 minutes'").fetch_all(&st.pool).await?;
    for r in rows {
        let actual = r.get("Actual").and_then(Value::as_str).unwrap_or("").trim().to_string();
        if actual.is_empty() {
            continue;
        }
        let ccy = r.get("Currency").and_then(Value::as_str).filter(|c| c.len() == 3).map(str::to_string).unwrap_or_else(|| te_currency(r.get("Country").and_then(Value::as_str).unwrap_or("")).to_string());
        let Some(at) = r.get("Date").and_then(Value::as_str).and_then(|d| chrono::NaiveDateTime::parse_from_str(d, "%Y-%m-%dT%H:%M:%S").ok()).map(|n| n.and_utc()) else { continue };
        let title = r.get("Event").and_then(Value::as_str).unwrap_or("");
        let best = ours
            .iter()
            .filter(|o| o.get::<String, _>("currency") == ccy && (o.get::<DateTime<Utc>, _>("starts_at") - at).num_minutes().abs() <= 5)
            .map(|o| (o.get::<i64, _>("id"), title_overlap(&o.get::<String, _>("title"), title)))
            .filter(|(_, s)| *s >= 0.6)
            .max_by(|a, b| a.1.total_cmp(&b.1));
        if let Some((id, _)) = best {
            store::set_actual(&st.pool, id, &actual.chars().take(40).collect::<String>(), "tradingeconomics").await?;
        }
    }
    Ok(())
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

fn impact_word(i: i16) -> &'static str {
    match i {
        3 => "High impact",
        2 => "Medium impact",
        1 => "Low impact",
        _ => "Holiday",
    }
}

fn reminder_text(title: &str, currency: &str, impact: i16, starts: DateTime<Utc>, forecast: &str, previous: &str, minutes: i64) -> (String, String) {
    let head = format!("{currency} {title} in {minutes} min");
    let mut parts = vec![impact_word(impact).to_string(), format!("{} server time", to_server(starts).format("%H:%M"))];
    if !forecast.is_empty() {
        parts.push(format!("forecast {forecast}"));
    }
    if !previous.is_empty() {
        parts.push(format!("previous {previous}"));
    }
    (head, parts.join(" · "))
}

/// Where a reminder opens: the calendar, with the event named in the link (`?event=<id>`) as well as in `data`. The
/// Client Area's calendar ignores the parameter.
fn reminder_link(event_id: i64) -> String {
    format!("/calendar?event={event_id}")
}

async fn notify(st: &AppState, tenant: &str, users: &[i64], title: &str, body: &str, severity: &str, dedupe: &str, event_id: i64) -> anyhow::Result<()> {
    if st.cfg.support_url.is_empty() {
        anyhow::bail!("notifications service not configured");
    }
    let res = st
        .http
        .post(format!("{}/v1/notify", st.cfg.support_url))
        .header("x-kalks-internal", &st.cfg.support_token)
        .header("x-kalks-tenant", tenant)
        .header("x-kalks-service", "news")
        .json(&json!({"type": "calendar.reminder", "title": title, "body": body, "link": reminder_link(event_id), "severity": severity,
                       "userIds": users, "dedupeKey": dedupe, "email": false, "data": {"eventId": event_id}}))
        .send()
        .await?;
    if !res.status().is_success() {
        anyhow::bail!("notify HTTP {}", res.status());
    }
    Ok(())
}

/// Per-event "remind me" and "alert me before every high-impact event" subscriptions. Rows are marked sent
/// only after the notifications service accepted them; reminders for events that started more than 10
/// minutes ago are dropped.
pub async fn send_reminders(st: &AppState) -> anyhow::Result<usize> {
    let mut sent = 0;
    sqlx::query("UPDATE calendar_reminders r SET sent_at = now() FROM calendar_events e WHERE r.event_id = e.id AND r.sent_at IS NULL AND e.starts_at < now() - interval '10 minutes'").execute(&st.pool).await?;
    let due = sqlx::query(
        "SELECT r.tenant, r.minutes, e.id, e.title, e.currency, COALESCE(e.impact_override, e.impact) AS impact, e.starts_at, e.forecast, e.previous,
                array_agg(r.user_id ORDER BY r.user_id) AS users
           FROM calendar_reminders r JOIN calendar_events e ON e.id = r.event_id
          WHERE r.sent_at IS NULL AND e.starts_at - make_interval(mins => r.minutes) <= now()
          GROUP BY r.tenant, r.minutes, e.id",
    )
    .fetch_all(&st.pool)
    .await?;
    for d in due {
        let (tenant, minutes, id): (String, i32, i64) = (d.get("tenant"), d.get("minutes"), d.get("id"));
        let starts: DateTime<Utc> = d.get("starts_at");
        let impact: i16 = d.get("impact");
        let users: Vec<i64> = d.get("users");
        let left = ((starts - Utc::now()).num_seconds() as f64 / 60.0).round().max(0.0) as i64;
        let (title, body) = reminder_text(&d.get::<String, _>("title"), &d.get::<String, _>("currency"), impact, starts, &d.get::<String, _>("forecast"), &d.get::<String, _>("previous"), left);
        match notify(st, &tenant, &users, &title, &body, if impact >= 3 { "warning" } else { "info" }, &format!("cal:{id}:{minutes}"), id).await {
            Ok(()) => {
                sqlx::query("UPDATE calendar_reminders SET sent_at = now() WHERE tenant = $1 AND event_id = $2 AND minutes = $3 AND sent_at IS NULL AND user_id = ANY($4)").bind(&tenant).bind(id).bind(minutes).bind(&users).execute(&st.pool).await?;
                sent += users.len();
            }
            Err(e) => tracing::warn!(error = %e, event = id, "reminder not delivered; will retry"),
        }
    }
    // subscriptions
    let subs = sqlx::query(
        "SELECT a.tenant, a.minutes, e.id, e.title, e.currency, COALESCE(e.impact_override, e.impact) AS impact, e.starts_at, e.forecast, e.previous,
                array_agg(a.user_id ORDER BY a.user_id) AS users
           FROM calendar_alerts a JOIN calendar_events e
             ON e.starts_at > now() AND e.starts_at - make_interval(mins => a.minutes) <= now() AND NOT e.all_day
            AND ((a.high_impact AND COALESCE(e.impact_override, e.impact) = 3) OR e.currency = ANY(a.currencies))
          WHERE NOT EXISTS (SELECT 1 FROM calendar_alerts_sent s WHERE s.tenant = a.tenant AND s.user_id = a.user_id AND s.event_id = e.id)
          GROUP BY a.tenant, a.minutes, e.id",
    )
    .fetch_all(&st.pool)
    .await?;
    for d in subs {
        let (tenant, id): (String, i64) = (d.get("tenant"), d.get("id"));
        let starts: DateTime<Utc> = d.get("starts_at");
        let impact: i16 = d.get("impact");
        let users: Vec<i64> = d.get("users");
        let left = ((starts - Utc::now()).num_seconds() as f64 / 60.0).round().max(0.0) as i64;
        let (title, body) = reminder_text(&d.get::<String, _>("title"), &d.get::<String, _>("currency"), impact, starts, &d.get::<String, _>("forecast"), &d.get::<String, _>("previous"), left);
        match notify(st, &tenant, &users, &title, &body, if impact >= 3 { "warning" } else { "info" }, &format!("calsub:{id}"), id).await {
            Ok(()) => {
                sqlx::query("INSERT INTO calendar_alerts_sent (tenant, user_id, event_id) SELECT $1, u, $2 FROM unnest($3::bigint[]) u ON CONFLICT DO NOTHING").bind(&tenant).bind(id).bind(&users).execute(&st.pool).await?;
                sent += users.len();
            }
            Err(e) => tracing::warn!(error = %e, event = id, "alert not delivered; will retry"),
        }
    }
    Ok(sent)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reminder_opens_the_event() {
        assert_eq!(reminder_link(4812), "/calendar?event=4812");
    }

    #[test]
    fn overlap() {
        assert!(title_overlap("CPI m/m", "Inflation Rate MoM") < 0.6);
        assert!(title_overlap("Non-Farm Employment Change", "Non Farm Payrolls") >= 0.6);
        assert!(title_overlap("Unemployment Rate", "Unemployment Rate") > 0.99);
        assert!(title_overlap("Retail Sales m/m", "Retail Sales MoM") > 0.99);
    }

    #[test]
    fn reminder_copy() {
        let at = DateTime::parse_from_rfc3339("2026-10-02T12:30:00Z").unwrap().with_timezone(&Utc);
        let (t, b) = reminder_text("Non-Farm Employment Change", "USD", 3, at, "150K", "142K", 15);
        assert_eq!(t, "USD Non-Farm Employment Change in 15 min");
        assert_eq!(b, "High impact · 15:30 server time · forecast 150K · previous 142K");
    }
}
