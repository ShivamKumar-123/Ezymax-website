//! Infoway real-time news (optional provider stream, D44 "news from provider").
//!
//! `wss://data.infoway.io/news?apikey=…`, subscribe with protocol 10020 `{lang}`, heartbeat 10010 every 30 s,
//! pushes arrive as 10022 `{dk, country, title, published, urgency, provider, symbols, link, content, sd}`.
//! The plan must include news (`newsFlag=1`) and each key allows ONE news connection, so this runs only in
//! the one environment that owns the key (NEWS_INFOWAY=true; off by default). Only headline, the short
//! description (or the first 280 characters of the text) and the link are stored — never the full `content`.

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use std::time::Duration;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::feed::{self, FeedItem, SUMMARY_MAX, TITLE_MAX};
use crate::{AppState, store};

pub struct Push {
    pub item: FeedItem,
    pub symbols: Vec<String>,
    pub country: String,
}

/// Parse one 10022 push. Returns None for other frames or pushes without a headline.
pub fn parse_push(frame: &str) -> Option<Push> {
    let v: Value = serde_json::from_str(frame).ok()?;
    if v.get("code").and_then(Value::as_i64) != Some(10022) {
        return None;
    }
    let d = v.get("data")?;
    let text = |k: &str| d.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let title = feed::clean_text(&text("title"), TITLE_MAX);
    if title.is_empty() {
        return None;
    }
    let sd = feed::clean_text(&text("sd"), SUMMARY_MAX);
    let summary = if sd.is_empty() { feed::clean_text(&text("content"), SUMMARY_MAX) } else { sd };
    let link = text("link");
    let link = if link.starts_with("https://") || link.starts_with("http://") { link } else { String::new() };
    let published = d.get("published").and_then(Value::as_i64).and_then(|s| chrono::DateTime::from_timestamp(s, 0));
    let provider = text("provider");
    Some(Push {
        item: FeedItem { title, summary, link, guid: format!("{}:{}", provider, text("dk")), published, categories: vec![] },
        symbols: d.get("symbols").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default(),
        country: text("country").to_ascii_lowercase(),
    })
}

pub async fn run(st: AppState) {
    let mut backoff = 30u64;
    loop {
        let enabled: bool = sqlx::query_scalar("SELECT enabled FROM sources WHERE id = 'infoway'").fetch_optional(&st.pool).await.ok().flatten().unwrap_or(false);
        if enabled {
            match session(&st).await {
                Ok(()) => {
                    tracing::warn!("infoway news stream closed; reconnecting");
                    backoff = 30;
                }
                Err(e) => {
                    tracing::warn!(error = %e, "infoway news stream error; retrying in {backoff}s");
                    let _ = sqlx::query("UPDATE sources SET last_error = $1, last_fetch_at = now() WHERE id = 'infoway'").bind(e.to_string().chars().take(300).collect::<String>()).execute(&st.pool).await;
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(3600);
    }
}

async fn session(st: &AppState) -> anyhow::Result<()> {
    let url = format!("wss://data.infoway.io/news?apikey={}", st.cfg.infoway_key);
    let (ws, _) = tokio::time::timeout(Duration::from_secs(15), connect_async(url.as_str())).await.map_err(|_| anyhow::anyhow!("connect timeout"))?.map_err(|e| anyhow::anyhow!("connect failed: {}", e.to_string().replace(&st.cfg.infoway_key, "***")))?;
    let (mut tx, mut rx) = ws.split();
    tx.send(Message::text(json!({"code": 10020, "trace": "ezymex-news", "data": {"lang": "en"}}).to_string())).await?;
    let mut heartbeat = tokio::time::interval(Duration::from_secs(30));
    heartbeat.tick().await;
    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                tx.send(Message::text(json!({"code": 10010, "trace": "ezymex-news-hb"}).to_string())).await?;
            }
            msg = tokio::time::timeout(Duration::from_secs(120), rx.next()) => {
                let Ok(msg) = msg else { anyhow::bail!("no frame for 120 s") };
                let Some(msg) = msg else { return Ok(()) };
                let text = match msg? {
                    Message::Text(t) => t.to_string(),
                    Message::Close(_) => return Ok(()),
                    _ => continue,
                };
                if let Ok(v) = serde_json::from_str::<Value>(&text) {
                    let code = v.get("code").and_then(Value::as_i64).unwrap_or(0);
                    if (507..=521).contains(&code) {
                        anyhow::bail!("provider refused the news stream (code {code}: {})", v.get("msg").and_then(Value::as_str).unwrap_or(""));
                    }
                    if code == 10021 {
                        tracing::info!("subscribed to infoway news");
                        let _ = sqlx::query("UPDATE sources SET last_ok_at = now(), last_fetch_at = now(), last_error = NULL WHERE id = 'infoway'").execute(&st.pool).await;
                    }
                }
                if let Some(p) = parse_push(&text) {
                    let r = store::ingest(&st.pool, "infoway", std::slice::from_ref(&p.item), &[p.symbols], &[p.country]).await?;
                    if r.inserted > 0 {
                        let _ = sqlx::query("UPDATE sources SET last_ok_at = now(), last_fetch_at = now() WHERE id = 'infoway'").execute(&st.pool).await;
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_frames() {
        let f = r#"{"code":10022,"data":{"dk":"a1","country":"US","lang":"en","route":"lang","title":"Apple raises full-year revenue forecast","published":1790000000,"urgency":2,"provider":"reuters","symbols":["AAPL"],"link":"https://www.example.com/article/123","content":"Apple Inc said on Monday it expects a very long body that must never be stored in full","sd":"Apple raises full-year outlook on strong iPhone demand"}}"#;
        let p = parse_push(f).unwrap();
        assert_eq!(p.item.title, "Apple raises full-year revenue forecast");
        assert_eq!(p.item.summary, "Apple raises full-year outlook on strong iPhone demand");
        assert_eq!(p.country, "us");
        assert_eq!(p.symbols, vec!["AAPL"]);
        assert_eq!(p.item.guid, "reuters:a1");
        assert!(p.item.published.is_some());
        assert!(parse_push(r#"{"code":10021,"msg":"ok","data":{"lang":"en"}}"#).is_none());
        assert!(parse_push(r#"{"code":10022,"data":{"title":""}}"#).is_none());
        // no short description: first 280 characters of the text, never the whole body
        let long = format!(r#"{{"code":10022,"data":{{"title":"T","content":"{}","link":"javascript:x"}}}}"#, "word ".repeat(200));
        let p = parse_push(&long).unwrap();
        assert!(p.item.summary.chars().count() <= SUMMARY_MAX);
        assert_eq!(p.item.link, "");
    }
}
