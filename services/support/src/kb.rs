//! Knowledge base the AI bot answers from: platform help articles (`kb/help.md`) and the Academy glossary,
//! seeded once per tenant, edited by staff. Retrieval is Okapi BM25 over title (x3), tags (x2) and body,
//! with light stemming and a few support synonyms. No embeddings.

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::{HashMap, HashSet};

const HELP: &str = include_str!("../kb/help.md");

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub category: String,
    pub body: String,
    pub tags: Vec<String>,
    pub status: String,
    pub source: String,
    pub used_count: i32,
    pub updated_by: String,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub fn article_row(r: &sqlx::postgres::PgRow) -> Article {
    Article {
        id: r.get("id"),
        slug: r.get("slug"),
        title: r.get("title"),
        category: r.get("category"),
        body: r.get("body"),
        tags: r.get("tags"),
        status: r.get("status"),
        source: r.get("source"),
        used_count: r.get("used_count"),
        updated_by: r.get("updated_by"),
        updated_at: r.get("updated_at"),
    }
}

pub struct SeedArticle {
    pub slug: String,
    pub category: String,
    pub title: String,
    pub tags: Vec<String>,
    pub body: String,
}

/// Parses `kb/help.md`: `## slug | Category | Title`, optional `tags:` line, body.
pub fn help_articles() -> Vec<SeedArticle> {
    let mut out = Vec::new();
    for block in HELP.split("\n## ").skip(1) {
        let mut lines = block.lines();
        let head = lines.next().unwrap_or_default();
        let parts: Vec<&str> = head.split('|').map(str::trim).collect();
        if parts.len() != 3 {
            continue;
        }
        let rest: Vec<&str> = lines.collect();
        let (tags, body_lines) = match rest.first() {
            Some(l) if l.starts_with("tags:") => (l[5..].split(',').map(|t| t.trim().to_lowercase()).filter(|t| !t.is_empty()).collect(), &rest[1..]),
            _ => (Vec::new(), &rest[..]),
        };
        out.push(SeedArticle { slug: parts[0].into(), category: parts[1].into(), title: parts[2].into(), tags, body: body_lines.join("\n").trim().to_string() });
    }
    out
}

#[derive(Deserialize)]
struct Glossary {
    terms: Vec<Term>,
}
#[derive(Deserialize)]
struct Term {
    slug: String,
    term: String,
    category: String,
    definition: String,
}

fn glossary(path: &str) -> Vec<SeedArticle> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        tracing::warn!(%path, "academy glossary not found: the knowledge base starts without it");
        return Vec::new();
    };
    match serde_yaml::from_str::<Glossary>(&raw) {
        Ok(g) => g
            .terms
            .into_iter()
            .map(|t| SeedArticle {
                slug: format!("glossary-{}", t.slug),
                category: "Glossary".into(),
                title: t.term.clone(),
                tags: vec![t.term.to_lowercase(), t.category.to_lowercase()],
                body: t.definition,
            })
            .collect(),
        Err(e) => {
            tracing::warn!(error = %e, "academy glossary could not be parsed");
            Vec::new()
        }
    }
}

/// Seeds the help articles and the glossary for a tenant once (existing slugs are never overwritten).
pub async fn seed(pool: &PgPool, tenant: &str, glossary_path: &str) -> anyhow::Result<usize> {
    let seeded: Option<String> = crate::db::cursor(pool, &format!("kb-seed:{tenant}")).await?;
    if seeded.as_deref() == Some("v1") {
        return Ok(0);
    }
    let mut n = 0;
    let mut tx = pool.begin().await?;
    for (a, source) in help_articles().into_iter().map(|a| (a, "seed")).chain(glossary(glossary_path).into_iter().map(|a| (a, "glossary"))) {
        let r = sqlx::query(
            "INSERT INTO kb_articles (tenant, slug, title, category, body, tags, status, source) VALUES ($1,$2,$3,$4,$5,$6,'published',$7)
             ON CONFLICT (tenant, slug) DO NOTHING",
        )
        .bind(tenant)
        .bind(&a.slug)
        .bind(&a.title)
        .bind(&a.category)
        .bind(&a.body)
        .bind(&a.tags)
        .bind(source)
        .execute(&mut *tx)
        .await?;
        n += r.rows_affected() as usize;
    }
    tx.commit().await?;
    crate::db::set_cursor(pool, &format!("kb-seed:{tenant}"), "v1").await?;
    tracing::info!(tenant, articles = n, "knowledge base seeded");
    Ok(n)
}

const STOP: &[&str] = &[
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "be", "been", "am", "i", "me", "my", "we", "you", "your", "it", "its", "to", "of", "in", "on", "for",
    "with", "at", "by", "from", "as", "that", "this", "these", "those", "do", "does", "did", "can", "could", "would", "should", "will", "how", "what", "when", "where",
    "why", "which", "who", "there", "here", "have", "has", "had", "not", "no", "yes", "so", "if", "then", "than", "too", "very", "just", "about", "into", "out", "up",
    "please", "hi", "hello", "hey", "thanks", "thank", "get", "got", "want", "need", "still", "some", "any", "much", "many", "more", "also", "our", "us", "they",
];

fn stem(w: &str) -> String {
    let w = w.trim_matches('\'');
    for suf in ["ations", "ation", "ings", "ing", "als", "al", "ed", "es", "s"] {
        if w.len() > suf.len() + 3 && w.ends_with(suf) {
            return w[..w.len() - suf.len()].to_string();
        }
    }
    w.to_string()
}

/// Lower-cased, stemmed tokens without stop words.
pub fn tokens(s: &str) -> Vec<String> {
    s.to_lowercase()
        .split(|c: char| !(c.is_alphanumeric() || c == '\''))
        .filter(|w| !w.is_empty() && !STOP.contains(w))
        .map(stem)
        .filter(|w| !w.is_empty())
        .collect()
}

/// Query expansion for common support wording.
fn expand(q: &[String]) -> Vec<String> {
    let mut out: Vec<String> = q.to_vec();
    let syn: &[(&str, &[&str])] = &[
        ("kyc", &["verif", "identity", "document"]),
        ("verif", &["kyc"]),
        ("withdraw", &["payout"]),
        ("withdrawal", &["withdraw"]),
        ("cashout", &["withdraw"]),
        ("payout", &["withdraw", "payout"]),
        ("fund", &["deposit"]),
        ("password", &["sign", "login"]),
        ("login", &["password", "sign"]),
        ("stopout", &["stop", "margin"]),
        ("liquidat", &["stop", "margin"]),
        ("ib", &["partner", "referral"]),
        ("affiliate", &["partner", "ib"]),
        ("referral", &["partner", "ib"]),
        ("copy", &["master", "follow"]),
        ("fee", &["commission", "spread"]),
        ("hacked", &["security", "compromised"]),
    ];
    for t in q {
        if let Some((_, extra)) = syn.iter().find(|(k, _)| *k == t) {
            out.extend(extra.iter().map(|x| stem(x)));
        }
    }
    out
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub category: String,
    pub body: String,
    pub score: f64,
}

struct Doc<'a> {
    a: &'a Article,
    tf: HashMap<String, f64>,
    len: f64,
}

/// BM25 ranking of `articles` for `query` (k1 = 1.2, b = 0.75). Returns hits with score > 0, best first.
pub fn rank(articles: &[Article], query: &str, k: usize) -> Vec<Hit> {
    let q = expand(&tokens(query));
    if q.is_empty() || articles.is_empty() {
        return Vec::new();
    }
    let docs: Vec<Doc> = articles
        .iter()
        .map(|a| {
            let mut tf: HashMap<String, f64> = HashMap::new();
            let mut len = 0.0;
            for (text, w) in [(a.title.as_str(), 3.0), (&a.tags.join(" "), 2.0), (a.body.as_str(), 1.0)] {
                for t in tokens(text) {
                    *tf.entry(t).or_default() += w;
                    len += w;
                }
            }
            Doc { a, tf, len }
        })
        .collect();
    let n = docs.len() as f64;
    let avg = docs.iter().map(|d| d.len).sum::<f64>() / n;
    let uniq: HashSet<&String> = q.iter().collect();
    let mut hits: Vec<Hit> = docs
        .iter()
        .map(|d| {
            let mut score = 0.0;
            for t in &uniq {
                let f = *d.tf.get(*t).unwrap_or(&0.0);
                if f == 0.0 {
                    continue;
                }
                let df = docs.iter().filter(|x| x.tf.contains_key(*t)).count() as f64;
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();
                score += idf * (f * 2.2) / (f + 1.2 * (1.0 - 0.75 + 0.75 * d.len / avg));
            }
            // platform help beats glossary definitions on ties
            if d.a.source != "glossary" {
                score *= 1.15;
            }
            Hit { id: d.a.id, slug: d.a.slug.clone(), title: d.a.title.clone(), category: d.a.category.clone(), body: d.a.body.clone(), score: (score * 100.0).round() / 100.0 }
        })
        .filter(|h| h.score > 0.0)
        .collect();
    hits.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    hits.truncate(k);
    hits
}

pub async fn published(st: &AppState, tenant: &str) -> anyhow::Result<Vec<Article>> {
    let rows = sqlx::query("SELECT * FROM kb_articles WHERE tenant = $1 AND status = 'published'").bind(tenant).fetch_all(&st.pool).await?;
    Ok(rows.iter().map(article_row).collect())
}

pub async fn search(st: &AppState, tenant: &str, query: &str, k: usize) -> anyhow::Result<Vec<Hit>> {
    Ok(rank(&published(st, tenant).await?, query, k))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn art(id: i64, slug: &str, title: &str, tags: &[&str], body: &str, source: &str) -> Article {
        Article {
            id,
            slug: slug.into(),
            title: title.into(),
            category: "x".into(),
            body: body.into(),
            tags: tags.iter().map(|t| t.to_string()).collect(),
            status: "published".into(),
            source: source.into(),
            used_count: 0,
            updated_by: "t".into(),
            updated_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn parses_help_articles() {
        let a = help_articles();
        assert!(a.len() >= 25, "{}", a.len());
        let kyc = a.iter().find(|x| x.slug == "kyc-overview").unwrap();
        assert_eq!(kyc.category, "Verification (KYC)");
        assert!(kyc.tags.contains(&"kyc".to_string()));
        assert!(kyc.body.contains("proof of address"));
        let mut slugs: Vec<&str> = a.iter().map(|x| x.slug.as_str()).collect();
        slugs.sort();
        slugs.dedup();
        assert_eq!(slugs.len(), a.len(), "duplicate slugs");
    }

    #[test]
    fn ranks_the_relevant_article_first() {
        let arts: Vec<Article> = help_articles().iter().enumerate().map(|(i, s)| art(i as i64, &s.slug, &s.title, &s.tags.iter().map(String::as_str).collect::<Vec<_>>(), &s.body, "seed")).collect();
        let top = |q: &str| rank(&arts, q, 3).first().map(|h| h.slug.clone()).unwrap_or_default();
        assert!(top("How long does KYC verification take?").starts_with("kyc"), "{}", top("How long does KYC verification take?"));
        assert_eq!(top("my withdrawal is still pending"), "withdrawal-status");
        assert_eq!(top("deposit not credited yet"), "deposit-missing");
        assert_eq!(top("what happens at stop out"), "margin-call-stop-out");
        assert!(top("how do I become an IB partner").starts_with("ib"));
        assert!(rank(&arts, "the and of", 3).is_empty());
    }

    #[test]
    fn glossary_parses() {
        let g = glossary(concat!(env!("CARGO_MANIFEST_DIR"), "/../../content/academy/en/glossary.yaml"));
        assert!(g.len() > 100);
        assert!(g.iter().all(|a| a.slug.starts_with("glossary-")));
    }
}
