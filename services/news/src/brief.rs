//! D138 daily AI market brief: once per server-time day (after 06:00), Claude summarises the last 24 hours of
//! stored headlines and the day's medium / high impact calendar into a short structured brief. The model only
//! sees our own headline + teaser rows and calendar figures; the reply is schema-constrained JSON, validated
//! again here (instrument names are checked against the Kalks list) before it is stored.

use chrono::{Duration, NaiveDate, Timelike, Utc};
use serde_json::{Value, json};
use sqlx::Row;

use crate::calendar::to_server;
use crate::tagging::{INSTRUMENTS, is_symbol};
use crate::AppState;

const API: &str = "https://api.anthropic.com/v1/messages";

const SYSTEM: &str = "You write the daily market brief for the clients of a multi-asset CFD broker (forex, metals, indices, energies, crypto, US stocks).
Use only the headlines and calendar entries you are given; never invent figures, quotes or events. Be neutral and factual: describe what happened and what is scheduled, do not recommend trades or predict prices.
Write in plain English for retail traders: short sentences, no hype, no emoji.";

pub fn today() -> NaiveDate {
    to_server(Utc::now()).date_naive()
}

fn schema() -> Value {
    let symbols: Vec<&str> = INSTRUMENTS.iter().map(|(s, _)| *s).collect();
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["mood", "headline", "points", "watch", "calendar_note"],
        "properties": {
            "mood": {"type": "string", "enum": ["risk-on", "risk-off", "mixed", "cautious"], "description": "Overall tone of today's news flow"},
            "headline": {"type": "string", "description": "One sentence, at most 140 characters, summarising the day"},
            "points": {
                "type": "array",
                "description": "3 to 5 key points, each one or two sentences",
                "items": {"type": "object", "additionalProperties": false, "required": ["text", "tone"],
                          "properties": {"text": {"type": "string"}, "tone": {"type": "string", "enum": ["up", "down", "neutral"]}}}
            },
            "watch": {"type": "array", "description": "2 to 4 instruments most affected by today's news and calendar", "items": {"type": "string", "enum": symbols}},
            "calendar_note": {"type": "string", "description": "One sentence on the most important scheduled releases today (server time), or an empty string"}
        }
    })
}

/// Generate today's brief when it doesn't exist yet and it's past 06:00 server time.
pub async fn ensure_today(st: &AppState) -> anyhow::Result<Option<NaiveDate>> {
    let now = to_server(Utc::now());
    if now.hour() < 6 {
        return Ok(None);
    }
    let day = now.date_naive();
    let exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM briefs WHERE day = $1").bind(day).fetch_optional(&st.pool).await?;
    if exists.is_some() {
        return Ok(None);
    }
    generate(st, day, "scheduler").await?;
    Ok(Some(day))
}

pub async fn generate(st: &AppState, day: NaiveDate, by: &str) -> anyhow::Result<Value> {
    if st.cfg.anthropic_key.is_empty() {
        anyhow::bail!("ANTHROPIC_API_KEY is not configured");
    }
    let since = Utc::now() - Duration::hours(24);
    let news = sqlx::query(
        "SELECT i.title, i.summary, s.name AS source, i.symbols, i.published_at FROM items i JOIN sources s ON s.id = i.source_id
          WHERE i.published_at > $1 AND i.importance >= 20
            AND NOT EXISTS (SELECT 1 FROM item_overrides o WHERE o.item_id = i.id AND o.tenant = 'kalks' AND o.hidden)
          ORDER BY i.importance DESC, i.published_at DESC LIMIT 30",
    )
    .bind(since)
    .fetch_all(&st.pool)
    .await?;
    let start = crate::calendar::server_week_start(Utc::now()); // bound only; the day filter below is exact
    let events = sqlx::query(
        "SELECT title, currency, starts_at, COALESCE(impact_override, impact) AS impact, forecast, previous, actual FROM calendar_events
          WHERE starts_at >= $1 AND starts_at < $1 + interval '9 days' AND COALESCE(impact_override, impact) >= 2 ORDER BY starts_at",
    )
    .bind(start)
    .fetch_all(&st.pool)
    .await?;
    let mut lines = vec![format!("Date (server time GMT{:+}): {day}", crate::calendar::server_offset_hours(Utc::now())), String::new(), "Headlines (last 24 hours):".into()];
    for r in &news {
        let syms: Vec<String> = r.get("symbols");
        let summary: String = r.get("summary");
        lines.push(format!("- [{}] {}{}{}", r.get::<String, _>("source"), r.get::<String, _>("title"), if summary.is_empty() { String::new() } else { format!(" — {summary}") }, if syms.is_empty() { String::new() } else { format!(" ({})", syms.join(", ")) }));
    }
    lines.push(String::new());
    lines.push("Economic calendar today (medium and high impact, server time):".into());
    let mut n_events = 0;
    for e in &events {
        let at = to_server(e.get("starts_at"));
        if at.date_naive() != day {
            continue;
        }
        n_events += 1;
        let (f, p, a): (String, String, String) = (e.get("forecast"), e.get("previous"), e.get("actual"));
        lines.push(format!("- {} {} {} ({}){}{}{}", at.format("%H:%M"), e.get::<String, _>("currency"), e.get::<String, _>("title"), if e.get::<i16, _>("impact") == 3 { "high" } else { "medium" },
            if a.is_empty() { String::new() } else { format!(" actual {a}") }, if f.is_empty() { String::new() } else { format!(" forecast {f}") }, if p.is_empty() { String::new() } else { format!(" previous {p}") }));
    }
    if news.is_empty() && n_events == 0 {
        anyhow::bail!("nothing to summarise yet");
    }
    let body = json!({
        "model": st.cfg.ai_model,
        "max_tokens": 16000,
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": "medium", "format": {"type": "json_schema", "schema": schema()}},
        "fallbacks": "default",
        "system": SYSTEM,
        "messages": [{"role": "user", "content": lines.join("\n")}],
    });
    let res = st
        .http
        .post(API)
        .timeout(std::time::Duration::from_secs(240))
        .header("x-api-key", &st.cfg.anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "server-side-fallback-2026-07-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Claude API unreachable: {}", e.without_url()))?;
    let status = res.status();
    let v: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        anyhow::bail!("Claude API error {status}: {}", v.pointer("/error/message").and_then(Value::as_str).unwrap_or("error"));
    }
    match v.get("stop_reason").and_then(Value::as_str) {
        Some("refusal") => anyhow::bail!("the model declined to write the brief"),
        Some("max_tokens") => anyhow::bail!("the brief was cut off"),
        _ => {}
    }
    let text: String = v.get("content").and_then(Value::as_array).into_iter().flatten().filter(|b| b.get("type").and_then(Value::as_str) == Some("text")).filter_map(|b| b.get("text").and_then(Value::as_str)).collect();
    let raw: Value = serde_json::from_str(text.trim()).map_err(|_| anyhow::anyhow!("the model returned invalid JSON"))?;
    let brief = sanitize(&raw).ok_or_else(|| anyhow::anyhow!("the model returned an incomplete brief"))?;
    let model = v.get("model").and_then(Value::as_str).unwrap_or(&st.cfg.ai_model).to_string();
    sqlx::query("INSERT INTO briefs (day, model, body, inputs, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (day) DO UPDATE SET model = EXCLUDED.model, body = EXCLUDED.body, inputs = EXCLUDED.inputs, created_at = now(), created_by = EXCLUDED.created_by")
        .bind(day)
        .bind(&model)
        .bind(&brief)
        .bind(json!({"headlines": news.len(), "events": n_events}))
        .bind(by)
        .execute(&st.pool)
        .await?;
    Ok(brief)
}

/// Validate and clamp the model's JSON: known mood, 1–5 points, known instruments only.
pub fn sanitize(v: &Value) -> Option<Value> {
    let clip = |s: &str, n: usize| crate::feed::truncate_words(s.trim(), n);
    let mood = v.get("mood").and_then(Value::as_str).filter(|m| ["risk-on", "risk-off", "mixed", "cautious"].contains(m))?;
    let headline = clip(v.get("headline").and_then(Value::as_str)?, 200);
    let points: Vec<Value> = v
        .get("points")?
        .as_array()?
        .iter()
        .filter_map(|p| {
            let text = clip(p.get("text")?.as_str()?, 400);
            let tone = p.get("tone").and_then(Value::as_str).filter(|t| ["up", "down", "neutral"].contains(t)).unwrap_or("neutral");
            (!text.is_empty()).then(|| json!({"text": text, "tone": tone}))
        })
        .take(5)
        .collect();
    if headline.is_empty() || points.is_empty() {
        return None;
    }
    let mut watch: Vec<String> = vec![];
    for s in v.get("watch").and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str) {
        if is_symbol(s) && !watch.iter().any(|w| w == s) && watch.len() < 4 {
            watch.push(s.to_string());
        }
    }
    let note = clip(v.get("calendar_note").and_then(Value::as_str).unwrap_or(""), 300);
    Some(json!({"mood": mood, "headline": headline, "points": points, "watch": watch, "calendarNote": note}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_brief() {
        let raw = json!({"mood": "risk-off", "headline": "Stocks slip as yields climb.", "points": [{"text": "Yields rose.", "tone": "down"}, {"text": "", "tone": "up"}, {"text": "Gold steady.", "tone": "sideways"}],
                         "watch": ["XAUUSD", "DOGEUSD", "XAUUSD", "EURUSD", "NAS100", "US30", "USDJPY"], "calendar_note": "US CPI at 15:30."});
        let b = sanitize(&raw).unwrap();
        assert_eq!(b["points"].as_array().unwrap().len(), 2);
        assert_eq!(b["points"][1]["tone"], "neutral");
        assert_eq!(b["watch"], json!(["XAUUSD", "EURUSD", "NAS100", "US30"]));
        assert_eq!(b["calendarNote"], "US CPI at 15:30.");
        assert!(sanitize(&json!({"mood": "euphoric", "headline": "x", "points": [{"text": "a", "tone": "up"}]})).is_none());
        assert!(sanitize(&json!({"mood": "mixed", "headline": "x", "points": []})).is_none());
    }

    #[test]
    fn schema_is_strict() {
        let s = schema();
        assert_eq!(s["additionalProperties"], false);
        assert_eq!(s["properties"]["watch"]["items"]["enum"].as_array().unwrap().len(), INSTRUMENTS.len());
    }
}
