//! Built-in feed catalogue. Seeded into `sources` on start (new rows only: staff decide `enabled` afterwards).
//!
//! What is stored from every feed: headline, a teaser of at most 280 characters, the publisher's link,
//! the published time and our own tags. Never article bodies or images; every card links to the publisher.
//!
//! Enabled by default: official publishers whose terms allow re-use of their releases with attribution (or
//! that are public domain). Commercial publishers' RSS is catalogued but OFF until the operator confirms a
//! licence for commercial display (their public feeds are offered for personal readers).

pub struct SourceDef {
    pub id: &'static str,
    pub name: &'static str,
    pub url: &'static str,
    pub homepage: &'static str,
    pub country: &'static str,
    /// central_bank | statistics | energy | news
    pub kind: &'static str,
    pub interval_secs: i32,
    pub enabled: bool,
    pub terms: &'static str,
}

pub const SOURCES: &[SourceDef] = &[
    SourceDef { id: "fed", name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", homepage: "https://www.federalreserve.gov", country: "us", kind: "central_bank", interval_secs: 600, enabled: true, terms: "US federal government work, public domain; credit the Board of Governors of the Federal Reserve System." },
    SourceDef { id: "ecb", name: "European Central Bank", url: "https://www.ecb.europa.eu/rss/press.html", homepage: "https://www.ecb.europa.eu", country: "eu", kind: "central_bank", interval_secs: 600, enabled: true, terms: "ECB copyright; reproduction permitted provided the source is acknowledged." },
    SourceDef { id: "boe", name: "Bank of England", url: "https://www.bankofengland.co.uk/rss/news", homepage: "https://www.bankofengland.co.uk", country: "gb", kind: "central_bank", interval_secs: 600, enabled: true, terms: "Bank of England content may be re-used with attribution (Open Government Licence style terms)." },
    SourceDef { id: "boj", name: "Bank of Japan", url: "https://www.boj.or.jp/en/rss/whatsnew.xml", homepage: "https://www.boj.or.jp/en", country: "jp", kind: "central_bank", interval_secs: 600, enabled: true, terms: "BoJ website content may be reproduced with the source cited." },
    SourceDef { id: "rba", name: "Reserve Bank of Australia", url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml", homepage: "https://www.rba.gov.au", country: "au", kind: "central_bank", interval_secs: 900, enabled: true, terms: "Creative Commons Attribution 4.0 (RBA copyright notice)." },
    SourceDef { id: "boc", name: "Bank of Canada", url: "https://www.bankofcanada.ca/content_type/press-releases/feed/", homepage: "https://www.bankofcanada.ca", country: "ca", kind: "central_bank", interval_secs: 900, enabled: true, terms: "Bank of Canada permits reproduction of its publications with attribution; headlines and links only." },
    SourceDef { id: "snb", name: "Swiss National Bank", url: "https://www.snb.ch/public/en/rss/news", homepage: "https://www.snb.ch", country: "ch", kind: "central_bank", interval_secs: 900, enabled: true, terms: "SNB copyright; reproduction permitted with source attribution (snb.ch/en/srv/disclaimer)." },
    SourceDef { id: "rbnz", name: "Reserve Bank of New Zealand", url: "https://www.rbnz.govt.nz/feeds/news", homepage: "https://www.rbnz.govt.nz", country: "nz", kind: "central_bank", interval_secs: 900, enabled: true, terms: "Creative Commons Attribution 4.0 International." },
    SourceDef { id: "bls", name: "US Bureau of Labor Statistics", url: "https://www.bls.gov/feed/bls_latest.rss", homepage: "https://www.bls.gov", country: "us", kind: "statistics", interval_secs: 900, enabled: true, terms: "US federal government work, public domain; cite BLS." },
    SourceDef { id: "bea", name: "US Bureau of Economic Analysis", url: "https://apps.bea.gov/rss/rss.xml", homepage: "https://www.bea.gov", country: "us", kind: "statistics", interval_secs: 1800, enabled: true, terms: "US federal government work, public domain; cite BEA." },
    SourceDef { id: "eia", name: "US Energy Information Administration", url: "https://www.eia.gov/rss/todayinenergy.xml", homepage: "https://www.eia.gov", country: "us", kind: "energy", interval_secs: 1800, enabled: true, terms: "US federal government work, public domain; cite EIA." },
    SourceDef { id: "fxstreet", name: "FXStreet", url: "https://www.fxstreet.com/rss/news", homepage: "https://www.fxstreet.com", country: "", kind: "news", interval_secs: 600, enabled: false, terms: "Commercial publisher. Public RSS for readers; enable only with an FXStreet licence for broker display (headline + link only)." },
    SourceDef { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", homepage: "https://www.coindesk.com", country: "", kind: "news", interval_secs: 600, enabled: false, terms: "Commercial publisher (© CoinDesk, Inc.). Enable only after confirming headline + link display is permitted." },
    SourceDef { id: "cnbc", name: "CNBC Markets", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", homepage: "https://www.cnbc.com", country: "", kind: "news", interval_secs: 600, enabled: false, terms: "Commercial publisher; RSS offered for personal, non-commercial use. Enable only with permission." },
    SourceDef { id: "marketwatch", name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", homepage: "https://www.marketwatch.com", country: "", kind: "news", interval_secs: 600, enabled: false, terms: "Dow Jones; RSS for personal, non-commercial use. Enable only with a licence." },
    SourceDef { id: "yahoo", name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", homepage: "https://finance.yahoo.com", country: "", kind: "news", interval_secs: 600, enabled: false, terms: "Yahoo terms: RSS for personal, non-commercial use. Enable only with permission." },
];

/// Base importance and whether the source publishes macro / policy material.
pub fn hint(kind: &str) -> (i32, bool) {
    match kind {
        "central_bank" => (45, true),
        "statistics" => (40, true),
        "energy" => (30, false),
        "provider" => (35, false),
        _ => (30, false),
    }
}
