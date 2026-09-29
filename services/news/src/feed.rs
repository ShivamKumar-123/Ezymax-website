//! Tolerant RSS 2.0 / RSS 1.0 (RDF) / Atom parsing, without an XML dependency.
//!
//! Only what the aggregator is allowed to keep is extracted: headline, a short plain-text summary, link,
//! guid and published time. Article bodies (`content:encoded`), images and anything else are ignored, so
//! nothing beyond headline + teaser + link is ever stored or republished.

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use sha2::{Digest, Sha256};

pub const SUMMARY_MAX: usize = 280;
pub const TITLE_MAX: usize = 300;

#[derive(Debug, Clone, PartialEq)]
pub struct FeedItem {
    pub title: String,
    pub summary: String,
    pub link: String,
    pub guid: String,
    pub published: Option<DateTime<Utc>>,
    pub categories: Vec<String>,
}

/// Every `<item>` / `<entry>` in the document, in document order. Items without a title are skipped.
pub fn parse(doc: &str) -> Vec<FeedItem> {
    let mut out = vec![];
    for tag in ["item", "entry"] {
        for block in elements(doc, tag) {
            let title = clean_text(&first(block.inner, "title").unwrap_or_default(), TITLE_MAX);
            if title.is_empty() {
                continue;
            }
            let link = item_link(block.inner);
            let guid = first(block.inner, "guid").or_else(|| first(block.inner, "id")).map(|g| decode_entities(&strip_cdata(&g)).trim().to_string()).unwrap_or_default();
            let raw_summary = first(block.inner, "description").or_else(|| first(block.inner, "summary")).unwrap_or_default();
            let mut summary = clean_text(&raw_summary, SUMMARY_MAX);
            // many feeds repeat the headline as the description
            if normalize_title(&summary) == normalize_title(&title) {
                summary.clear();
            }
            let date = ["pubDate", "dc:date", "published", "updated", "a10:updated"].iter().find_map(|t| first(block.inner, t)).map(|d| strip_cdata(&d).trim().to_string());
            let categories = elements(block.inner, "category").into_iter().map(|c| clean_text(c.inner, 60)).filter(|c| !c.is_empty()).take(5).collect();
            out.push(FeedItem { title, summary, link, guid, published: date.as_deref().and_then(parse_date), categories });
        }
        if !out.is_empty() {
            break;
        }
    }
    out
}

pub struct Element<'a> {
    pub attrs: &'a str,
    pub inner: &'a str,
}

/// Non-nested elements named `name` (exact tag name, prefix included).
pub fn elements<'a>(doc: &'a str, name: &str) -> Vec<Element<'a>> {
    let open = format!("<{name}");
    let close = format!("</{name}>");
    let mut out = vec![];
    let mut pos = 0;
    while let Some(i) = doc[pos..].find(&open) {
        let start = pos + i;
        let after = start + open.len();
        let Some(next) = doc[after..].chars().next() else { break };
        if !(next == '>' || next == '/' || next.is_whitespace()) {
            pos = after;
            continue;
        }
        let Some(gt) = doc[after..].find('>') else { break };
        let tag_end = after + gt;
        let attrs = &doc[after..tag_end];
        if attrs.trim_end().ends_with('/') {
            out.push(Element { attrs: attrs.trim_end().trim_end_matches('/'), inner: "" });
            pos = tag_end + 1;
            continue;
        }
        match doc[tag_end + 1..].find(&close) {
            Some(c) => {
                out.push(Element { attrs, inner: &doc[tag_end + 1..tag_end + 1 + c] });
                pos = tag_end + 1 + c + close.len();
            }
            None => break,
        }
    }
    out
}

fn first(doc: &str, name: &str) -> Option<String> {
    elements(doc, name).into_iter().next().map(|e| e.inner.to_string())
}

pub fn attr(attrs: &str, name: &str) -> Option<String> {
    for q in ['"', '\''] {
        let pat = format!("{name}={q}");
        let mut from = 0;
        while let Some(i) = attrs[from..].find(&pat) {
            let s = from + i;
            // must be a whole attribute name
            if s == 0 || attrs[..s].ends_with(|c: char| c.is_whitespace()) {
                let v = s + pat.len();
                if let Some(e) = attrs[v..].find(q) {
                    return Some(decode_entities(&attrs[v..v + e]));
                }
            }
            from = s + pat.len();
        }
    }
    None
}

fn item_link(inner: &str) -> String {
    let links = elements(inner, "link");
    // Atom: <link rel="alternate" href="…"/> (or the first href without rel)
    let atom = links.iter().filter(|l| attr(l.attrs, "href").is_some()).find(|l| matches!(attr(l.attrs, "rel").as_deref(), None | Some("alternate"))).and_then(|l| attr(l.attrs, "href"));
    let raw = atom.or_else(|| links.iter().map(|l| decode_entities(&strip_cdata(l.inner)).trim().to_string()).find(|l| !l.is_empty())).unwrap_or_default();
    if raw.starts_with("http://") || raw.starts_with("https://") { raw.chars().take(1000).collect() } else { String::new() }
}

pub fn strip_cdata(s: &str) -> String {
    let t = s.trim();
    let mut out = String::with_capacity(t.len());
    let mut rest = t;
    while let Some(i) = rest.find("<![CDATA[") {
        out.push_str(&rest[..i]);
        let body = &rest[i + 9..];
        match body.find("]]>") {
            Some(e) => {
                out.push_str(&body[..e]);
                rest = &body[e + 3..];
            }
            None => {
                out.push_str(body);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

/// XML/HTML entity decoding (numeric + the named entities that show up in news feeds).
pub fn decode_entities(s: &str) -> String {
    if !s.contains('&') {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let end = tail[1..].find(';').map(|e| e + 1).filter(|e| *e <= 10);
        match end {
            Some(e) => {
                let name = &tail[1..e];
                let ch: Option<String> = if let Some(n) = name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
                    u32::from_str_radix(n, 16).ok().and_then(char::from_u32).map(String::from)
                } else if let Some(n) = name.strip_prefix('#') {
                    n.parse::<u32>().ok().and_then(char::from_u32).map(String::from)
                } else {
                    match name {
                        "amp" => Some("&"),
                        "lt" => Some("<"),
                        "gt" => Some(">"),
                        "quot" => Some("\""),
                        "apos" => Some("'"),
                        "nbsp" => Some(" "),
                        "rsquo" | "lsquo" => Some("'"),
                        "rdquo" | "ldquo" => Some("\""),
                        "ndash" => Some("–"),
                        "mdash" => Some("—"),
                        "hellip" => Some("…"),
                        "euro" => Some("€"),
                        "pound" => Some("£"),
                        "yen" => Some("¥"),
                        _ => None,
                    }
                    .map(String::from)
                };
                match ch {
                    Some(c) => {
                        out.push_str(&c);
                        rest = &tail[e + 1..];
                    }
                    None => {
                        out.push('&');
                        rest = &tail[1..];
                    }
                }
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut depth = 0usize;
    for c in s.chars() {
        match c {
            '<' => depth += 1,
            '>' if depth > 0 => {
                depth -= 1;
                out.push(' ');
            }
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
}

/// CDATA → entities → strip markup (descriptions are often escaped HTML) → collapse whitespace → cut at a
/// word boundary with an ellipsis.
pub fn clean_text(raw: &str, max: usize) -> String {
    let once = decode_entities(&strip_cdata(raw));
    let text = decode_entities(&strip_tags(&once));
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    truncate_words(&collapsed, max)
}

pub fn truncate_words(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let cut: String = s.chars().take(max.saturating_sub(1)).collect();
    let at = cut.rfind(' ').filter(|i| *i > max / 2).unwrap_or(cut.len());
    format!("{}…", cut[..at].trim_end_matches([',', ';', ':', '.', ' ']))
}

/// RFC 2822 (RSS), RFC 3339 (Atom / dc:date) and a few common variants.
pub fn parse_date(s: &str) -> Option<DateTime<Utc>> {
    let s = s.trim();
    if let Ok(d) = DateTime::parse_from_rfc2822(s) {
        return Some(d.with_timezone(&Utc));
    }
    // RFC 2822 with a wrong day name (chrono rejects "Wed, 17 Sep 2026" when the 17th is a Thursday)
    if let Some((_, rest)) = s.split_once(", ").filter(|(d, _)| d.len() <= 9 && d.chars().all(|c| c.is_ascii_alphabetic())) {
        if let Some(d) = parse_date(rest) {
            return Some(d);
        }
    }
    if let Ok(d) = DateTime::parse_from_str(s, "%d %b %Y %H:%M:%S %z").or_else(|_| DateTime::parse_from_str(s, "%d %b %Y %H:%M %z")) {
        return Some(d.with_timezone(&Utc));
    }
    if let Ok(d) = DateTime::parse_from_rfc3339(s) {
        return Some(d.with_timezone(&Utc));
    }
    // "Mon, 28 Sep 2026 15:30:00 EST" style zones chrono doesn't know, and "UTC"
    let zones = [("UTC", "+0000"), ("GMT", "+0000"), ("EST", "-0500"), ("EDT", "-0400"), ("CST", "-0600"), ("CDT", "-0500"), ("PST", "-0800"), ("PDT", "-0700"), ("CET", "+0100"), ("CEST", "+0200"), ("BST", "+0100"), ("JST", "+0900"), ("AEST", "+1000"), ("AEDT", "+1100")];
    for (z, off) in zones {
        if let Some(base) = s.strip_suffix(z) {
            if let Some(d) = parse_date(&format!("{base}{off}")) {
                return Some(d);
            }
        }
    }
    for f in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M"] {
        if let Ok(n) = NaiveDateTime::parse_from_str(s, f) {
            return Some(Utc.from_utc_datetime(&n));
        }
    }
    None
}

/// Canonical link for de-duplication: no scheme, no `www.`, lower-case host, no fragment, no tracking
/// parameters, no duplicate or trailing slashes.
pub fn canonical_link(link: &str) -> String {
    let l = link.trim();
    let l = l.split('#').next().unwrap_or("");
    let l = l.strip_prefix("https://").or_else(|| l.strip_prefix("http://")).unwrap_or(l);
    let (hostpath, query) = match l.split_once('?') {
        Some((a, b)) => (a, Some(b)),
        None => (l, None),
    };
    let (host, path) = hostpath.split_once('/').unwrap_or((hostpath, ""));
    let host = host.to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host);
    let path: Vec<&str> = path.split('/').filter(|p| !p.is_empty()).collect();
    let mut out = format!("{host}/{}", path.join("/"));
    if let Some(q) = query {
        let mut keep: Vec<&str> = q.split('&').filter(|p| !p.is_empty()).filter(|p| {
            let k = p.split('=').next().unwrap_or("").to_ascii_lowercase();
            !(k.starts_with("utm_") || matches!(k.as_str(), "cmpid" | "ref" | "src" | "mod" | "ncid" | "__source" | "yptr" | "guccounter"))
        }).collect();
        keep.sort_unstable();
        if !keep.is_empty() {
            out.push('?');
            out.push_str(&keep.join("&"));
        }
    }
    out.trim_end_matches('/').to_string()
}

const STOP: &[&str] = &["a", "an", "the", "of", "to", "in", "on", "for", "and", "as", "at", "by", "with", "is", "are", "its", "it", "from"];

/// Headline fingerprint: lower-case words without punctuation and stop words. Two sources carrying the same
/// wire headline map to the same fingerprint.
pub fn normalize_title(t: &str) -> String {
    t.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty() && !STOP.contains(w))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn sha(s: &str) -> String {
    let d = Sha256::digest(s.as_bytes());
    d.iter().take(16).map(|b| format!("{b:02x}")).collect()
}

/// Stable de-duplication key: the canonical link, else the guid, else source + headline.
pub fn dedupe_key(source: &str, item: &FeedItem) -> String {
    if !item.link.is_empty() {
        sha(&format!("l:{}", canonical_link(&item.link)))
    } else if !item.guid.is_empty() {
        sha(&format!("g:{source}:{}", item.guid))
    } else {
        sha(&format!("t:{source}:{}", normalize_title(&item.title)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RSS: &str = r#"<?xml version="1.0"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
      <title>Feed</title><link>https://example.com/</link><atom:link href="https://example.com/rss" rel="self"/>
      <item><title><![CDATA[Fed holds rates &amp; signals patience]]></title>
        <link><![CDATA[https://www.federalreserve.gov/newsevents/pressreleases/monetary20260917a.htm]]></link>
        <guid>abc</guid><description>&lt;p&gt;The Committee decided to &lt;b&gt;maintain&lt;/b&gt; the target range.&lt;/p&gt;</description>
        <category>Monetary Policy</category><pubDate>Wed, 17 Sep 2026 18:00:00 GMT</pubDate>
        <content:encoded><![CDATA[<p>FULL ARTICLE BODY MUST NOT BE KEPT</p>]]></content:encoded></item>
      <item><title>Same as description</title><description>Same as description</description><link>https://x.test/a?utm_source=rss&amp;id=2</link><pubDate>Mon, 28 Sep 2026 08:50:00 +0900</pubDate></item>
      <item><title></title><link>https://x.test/empty</link></item>
    </channel></rss>"#;

    #[test]
    fn rss_items() {
        let items = parse(RSS);
        assert_eq!(items.len(), 2);
        let a = &items[0];
        assert_eq!(a.title, "Fed holds rates & signals patience");
        assert_eq!(a.summary, "The Committee decided to maintain the target range.");
        assert_eq!(a.link, "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260917a.htm");
        assert_eq!(a.categories, vec!["Monetary Policy".to_string()]);
        assert_eq!(a.published.unwrap().to_rfc3339(), "2026-09-17T18:00:00+00:00");
        assert!(!format!("{a:?}").contains("FULL ARTICLE"));
        assert_eq!(items[1].summary, "", "a description that repeats the headline is dropped");
        assert_eq!(items[1].published.unwrap().to_rfc3339(), "2026-09-27T23:50:00+00:00");
    }

    #[test]
    fn atom_entries() {
        let doc = r#"<feed xmlns="http://www.w3.org/2005/Atom"><link href="https://site/" rel="self"/>
          <entry><title type="html">Gold &lt;em&gt;climbs&lt;/em&gt;</title><link rel="enclosure" href="https://img/x.jpg"/><link rel="alternate" href="https://site/gold"/>
          <id>tag:1</id><updated>2026-09-28T10:00:00+02:00</updated><summary>Short.</summary></entry></feed>"#;
        let items = parse(doc);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Gold climbs");
        assert_eq!(items[0].link, "https://site/gold");
        assert_eq!(items[0].guid, "tag:1");
        assert_eq!(items[0].published.unwrap().to_rfc3339(), "2026-09-28T08:00:00+00:00");
    }

    #[test]
    fn dates() {
        assert!(parse_date("Mon, 28 Sep 2026 15:30:00 +0200").is_some());
        assert_eq!(parse_date("Mon, 28 Sep 2026 15:30:00 EDT").unwrap().to_rfc3339(), "2026-09-28T19:30:00+00:00");
        assert_eq!(parse_date("2026-09-28T18:03:01Z").unwrap().to_rfc3339(), "2026-09-28T18:03:01+00:00");
        assert!(parse_date("yesterday").is_none());
        assert_eq!(parse_date("Wed, 17 Sep 2026 14:00:00 EDT").unwrap().to_rfc3339(), "2026-09-17T18:00:00+00:00");
    }

    #[test]
    fn dedupe_links_and_titles() {
        assert_eq!(canonical_link("https://www.ecb.europa.eu//press/pr/x.en.html#top"), "ecb.europa.eu/press/pr/x.en.html");
        assert_eq!(canonical_link("http://Site.com/a/?utm_source=rss&b=2&a=1"), canonical_link("https://site.com/a?a=1&b=2&utm_medium=x"));
        assert_ne!(canonical_link("https://site.com/a?id=1"), canonical_link("https://site.com/a?id=2"));
        assert_eq!(normalize_title("Gold hits a record — as the dollar slides!"), normalize_title("GOLD HITS RECORD AS DOLLAR SLIDES"));
        let a = FeedItem { title: "T".into(), summary: String::new(), link: "https://www.x.com/a/".into(), guid: "1".into(), published: None, categories: vec![] };
        let b = FeedItem { link: "http://x.com/a?utm_campaign=z".into(), guid: "2".into(), ..a.clone() };
        assert_eq!(dedupe_key("s1", &a), dedupe_key("s2", &b));
    }

    #[test]
    fn truncation_and_entities() {
        let long = "word ".repeat(100);
        let t = clean_text(&long, 50);
        assert!(t.chars().count() <= 50 && t.ends_with('…'));
        assert_eq!(decode_entities("A &#8217;B&#x2019; &unknown; & C"), "A ’B’ &unknown; & C");
    }
}
