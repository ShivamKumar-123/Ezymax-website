//! Rule-based tagging: countries, currencies, Ezymex instruments, asset class, headline tone and importance.
//!
//! Deterministic keyword / entity rules (no model call per headline), so tagging is instant, free, testable
//! and explainable. Staff can override tags per tenant in the Back Office.

use std::collections::BTreeSet;

/// The Ezymex instrument list (packages/mock/src/symbols.ts) with asset classes.
pub const INSTRUMENTS: &[(&str, &str)] = &[
    ("EURUSD", "forex"), ("GBPUSD", "forex"), ("USDJPY", "forex"), ("AUDUSD", "forex"), ("USDCAD", "forex"),
    ("USDCHF", "forex"), ("GBPJPY", "forex"), ("EURJPY", "forex"), ("USDINR", "forex"),
    ("XAUUSD", "metals"), ("XAGUSD", "metals"),
    ("US30", "indices"), ("NAS100", "indices"), ("SPX500", "indices"), ("GER40", "indices"), ("UK100", "indices"), ("JP225", "indices"),
    ("USOIL", "energies"), ("UKOIL", "energies"),
    ("BTCUSD", "crypto"), ("ETHUSD", "crypto"), ("SOLUSD", "crypto"), ("XRPUSD", "crypto"),
    ("AAPL", "stocks"), ("TSLA", "stocks"), ("NVDA", "stocks"), ("META", "stocks"), ("NFLX", "stocks"),
];

pub fn is_symbol(s: &str) -> bool {
    INSTRUMENTS.iter().any(|(x, _)| *x == s)
}

pub fn asset_class(symbol: &str) -> Option<&'static str> {
    INSTRUMENTS.iter().find(|(x, _)| *x == symbol).map(|(_, c)| *c)
}

/// Country code (ISO 3166 alpha-2, lower case; "eu" = euro area) → currency.
pub const COUNTRIES: &[(&str, &str, &str)] = &[
    ("us", "USD", "United States"), ("eu", "EUR", "Euro area"), ("de", "EUR", "Germany"), ("fr", "EUR", "France"), ("it", "EUR", "Italy"),
    ("es", "EUR", "Spain"), ("gb", "GBP", "United Kingdom"), ("jp", "JPY", "Japan"), ("au", "AUD", "Australia"), ("ca", "CAD", "Canada"),
    ("ch", "CHF", "Switzerland"), ("nz", "NZD", "New Zealand"), ("cn", "CNY", "China"), ("in", "INR", "India"), ("sa", "SAR", "Saudi Arabia"),
    ("ru", "RUB", "Russia"), ("ir", "IRR", "Iran"), ("br", "BRL", "Brazil"), ("mx", "MXN", "Mexico"), ("kr", "KRW", "South Korea"), ("sg", "SGD", "Singapore"),
];

pub fn is_country(c: &str) -> bool {
    COUNTRIES.iter().any(|(x, _, _)| *x == c)
}

pub fn currency_of(country: &str) -> Option<&'static str> {
    COUNTRIES.iter().find(|(c, _, _)| *c == country).map(|(_, cur, _)| *cur)
}

/// Calendar currency (Forex Factory `country` field) → flag country.
pub fn country_of_currency(ccy: &str) -> &'static str {
    match ccy {
        "USD" => "us",
        "EUR" => "eu",
        "GBP" => "gb",
        "JPY" => "jp",
        "AUD" => "au",
        "CAD" => "ca",
        "CHF" => "ch",
        "NZD" => "nz",
        "CNY" => "cn",
        "INR" => "in",
        _ => "",
    }
}

/// Instruments a currency's macro news moves most (used for calendar events and for macro headlines without
/// a direct instrument mention).
pub fn currency_symbols(ccy: &str) -> &'static [&'static str] {
    match ccy {
        "USD" => &["EURUSD", "USDJPY", "XAUUSD", "US30"],
        "EUR" => &["EURUSD", "EURJPY", "GER40"],
        "GBP" => &["GBPUSD", "GBPJPY", "UK100"],
        "JPY" => &["USDJPY", "EURJPY", "GBPJPY", "JP225"],
        "AUD" => &["AUDUSD"],
        "CAD" => &["USDCAD"],
        "CHF" => &["USDCHF"],
        "CNY" => &["AUDUSD", "XAUUSD"],
        "INR" => &["USDINR"],
        _ => &[],
    }
}

/// Keyword → countries. Matched on word boundaries against the lower-cased headline + summary.
const COUNTRY_RULES: &[(&str, &[&str])] = &[
    ("us", &["federal reserve", "fed", "fomc", "powell", "u.s.", "us", "united states", "america", "american", "wall street", "white house", "treasury", "treasuries", "nonfarm", "payrolls", "jobless claims", "nasdaq", "s&p 500", "dow", "dow jones", "washington", "trump", "dollar", "greenback", "usd"]),
    ("eu", &["ecb", "european central bank", "euro area", "eurozone", "euro zone", "lagarde", "eu", "european union", "brussels", "euro"]),
    ("de", &["germany", "german", "bundesbank", "dax", "ifo", "zew", "berlin"]),
    ("fr", &["france", "french", "paris"]),
    ("it", &["italy", "italian", "btp"]),
    ("gb", &["bank of england", "boe", "uk", "u.k.", "britain", "british", "england", "ftse", "sterling", "gilt", "gilts", "bailey", "reeves"]),
    ("jp", &["bank of japan", "boj", "japan", "japanese", "yen", "nikkei", "tokyo", "ueda", "jgb", "jgbs"]),
    ("au", &["reserve bank of australia", "rba", "australia", "australian", "aussie", "bullock"]),
    ("ca", &["bank of canada", "boc", "canada", "canadian", "loonie", "macklem"]),
    ("ch", &["swiss national bank", "snb", "swiss", "switzerland", "franc"]),
    ("nz", &["reserve bank of new zealand", "rbnz", "new zealand", "kiwi"]),
    ("cn", &["china", "chinese", "pboc", "beijing", "yuan", "renminbi", "hong kong"]),
    ("in", &["india", "indian", "rbi", "reserve bank of india", "rupee", "nifty", "sensex"]),
    ("sa", &["saudi", "riyadh", "opec", "opec+"]),
    ("ru", &["russia", "russian", "moscow", "kremlin"]),
    ("ir", &["iran", "iranian", "tehran"]),
    ("br", &["brazil", "brazilian"]),
    ("mx", &["mexico", "mexican", "banxico"]),
    ("kr", &["south korea", "korean", "kospi"]),
    ("sg", &["singapore"]),
];

/// Keyword → instruments.
const SYMBOL_RULES: &[(&str, &[&str])] = &[
    ("XAUUSD", &["gold", "bullion", "xau", "xauusd", "xau/usd"]),
    ("XAGUSD", &["silver", "xag", "xagusd", "xag/usd"]),
    ("USOIL", &["oil", "crude", "wti", "usoil", "opec", "opec+", "petroleum", "gasoline", "crude inventories"]),
    ("UKOIL", &["brent", "ukoil", "opec", "opec+"]),
    ("BTCUSD", &["bitcoin", "btc", "btcusd", "btc/usd", "crypto", "cryptocurrency", "cryptocurrencies", "spot bitcoin etf"]),
    ("ETHUSD", &["ethereum", "ether", "eth", "ethusd"]),
    ("SOLUSD", &["solana", "sol", "solusd"]),
    ("XRPUSD", &["xrp", "ripple", "xrpusd"]),
    ("AAPL", &["apple", "aapl", "iphone", "tim cook"]),
    ("TSLA", &["tesla", "tsla", "elon musk", "musk"]),
    ("NVDA", &["nvidia", "nvda", "jensen huang"]),
    ("META", &["meta platforms", "meta", "facebook", "instagram", "zuckerberg"]),
    ("NFLX", &["netflix", "nflx"]),
    ("US30", &["dow", "dow jones", "djia", "us30"]),
    ("NAS100", &["nasdaq", "nasdaq 100", "nas100", "tech stocks"]),
    ("SPX500", &["s&p 500", "s&p", "spx", "spx500", "wall street"]),
    ("GER40", &["dax", "ger40", "german stocks"]),
    ("UK100", &["ftse", "ftse 100", "uk100"]),
    ("JP225", &["nikkei", "nikkei 225", "jp225", "topix"]),
    ("EURUSD", &["eurusd", "eur/usd", "euro"]),
    ("GBPUSD", &["gbpusd", "gbp/usd", "sterling", "pound", "cable"]),
    ("USDJPY", &["usdjpy", "usd/jpy", "yen"]),
    ("AUDUSD", &["audusd", "aud/usd", "aussie", "australian dollar"]),
    ("USDCAD", &["usdcad", "usd/cad", "loonie", "canadian dollar"]),
    ("USDCHF", &["usdchf", "usd/chf", "swiss franc"]),
    ("GBPJPY", &["gbpjpy", "gbp/jpy"]),
    ("EURJPY", &["eurjpy", "eur/jpy"]),
    ("USDINR", &["usdinr", "usd/inr", "rupee"]),
];

const UP: &[&str] = &["rise", "rises", "rose", "rising", "gain", "gains", "gained", "jump", "jumps", "jumped", "surge", "surges", "surged", "soar", "soars", "soared", "rally", "rallies", "rallied", "climb", "climbs", "climbed", "beat", "beats", "record high", "all-time high", "strong", "stronger", "strengthens", "upbeat", "boost", "boosts", "higher", "rebound", "rebounds", "recovers", "advance", "advances", "optimism", "bullish", "upgrade", "tops", "outperform", "expands", "accelerates"];
const DOWN: &[&str] = &["fall", "falls", "fell", "falling", "drop", "drops", "dropped", "slump", "slumps", "plunge", "plunges", "plunged", "tumble", "tumbles", "tumbled", "slide", "slides", "slid", "sink", "sinks", "sank", "miss", "misses", "weak", "weaker", "weakens", "lower", "decline", "declines", "declined", "recession", "fears", "concern", "concerns", "contraction", "contracts", "loss", "losses", "crash", "selloff", "sell-off", "slowdown", "downgrade", "bearish", "retreat", "retreats", "slips", "slipped", "eases", "warning", "turmoil"];

const MACRO_HIGH: &[&str] = &["rate decision", "interest rate", "interest rates", "monetary policy", "policy rate", "fomc", "rate cut", "rate cuts", "rate hike", "rate hikes", "raises rates", "cuts rates", "holds rates", "keeps rates", "cash rate", "bank rate", "official cash rate", "federal funds"];
const MACRO_MID: &[&str] = &["inflation", "cpi", "pce", "payrolls", "nonfarm", "employment", "unemployment", "jobless", "gdp", "retail sales", "pmi", "consumer price", "producer price", "ppi", "trade balance", "wages", "earnings", "guidance", "tariff", "tariffs", "sanctions", "opec"];
const MACRO_LOW: &[&str] = &["press conference", "statement", "minutes", "testimony", "speech", "speaks", "remarks", "outlook", "forecast", "projections", "financial stability"];
const NOISE: &[&str] = &["working paper", "research paper", "approval of application", "applications by", "application by", "enforcement action", "enforcement actions", "vacancy", "vacancies", "consultation", "careers", "internship", "annual report on", "conference call for", "call for papers", "podcast", "seminar", "museum", "banknote design", "statistical release calendar", "termination of enforcement"];

/// Lower-cased text with punctuation spaced out so word-boundary search is a plain `contains` on " w ".
pub fn prepare(text: &str) -> String {
    let mut s = String::with_capacity(text.len() + 2);
    s.push(' ');
    for c in text.to_lowercase().chars() {
        if c.is_alphanumeric() || matches!(c, '&' | '/' | '+' | '.' | '-') {
            s.push(c);
        } else {
            s.push(' ');
        }
    }
    s.push(' ');
    // "u.s." survives; trailing sentence dots on other words are dropped
    s.replace(". ", " . ").replace(" u.s . ", " u.s. ").replace(" u.k . ", " u.k. ")
}

fn has(prepared: &str, kw: &str) -> bool {
    prepared.contains(&format!(" {kw} "))
}

fn count(prepared: &str, words: &[&str]) -> i32 {
    words.iter().filter(|w| has(prepared, w)).count() as i32
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Tags {
    pub countries: Vec<String>,
    pub currencies: Vec<String>,
    pub symbols: Vec<String>,
    pub category: String,
    pub sentiment: String,
    pub importance: i32,
}

/// Source hints: a default country (central bank / statistics office) and a base importance.
#[derive(Debug, Clone, Copy)]
pub struct SourceHint<'a> {
    pub country: &'a str,
    pub base: i32,
    pub macro_source: bool,
}

pub fn tag(title: &str, summary: &str, hint: SourceHint, provider_symbols: &[String]) -> Tags {
    let t = prepare(title);
    let all = prepare(&format!("{title} . {summary}"));

    // countries: headline mentions; the teaser only when neither the headline nor the source names one
    // (teasers carry boilerplate like "not for distribution in the United States, Canada, Australia…")
    let mut countries: Vec<String> = vec![];
    let find = |scope: &str, out: &mut Vec<String>| {
        for (c, kws) in COUNTRY_RULES {
            if !out.iter().any(|x| x == c) && kws.iter().any(|k| has(scope, k)) {
                out.push((*c).to_string());
            }
        }
    };
    find(&t, &mut countries);
    if countries.is_empty() && hint.country.is_empty() {
        find(&all, &mut countries);
        countries.truncate(2);
    }
    if !hint.country.is_empty() && !countries.iter().any(|c| c == hint.country) {
        countries.insert(0, hint.country.to_string());
    }
    countries.truncate(4);

    // instruments: provider tags, then direct mentions (headline first)
    let mut symbols: Vec<String> = provider_symbols.iter().map(|s| map_provider_symbol(s)).filter(|s| is_symbol(s)).collect();
    for scope in [&t, &all] {
        for (s, kws) in SYMBOL_RULES {
            if !symbols.iter().any(|x| x == s) && kws.iter().any(|k| has(scope, k)) {
                symbols.push((*s).to_string());
            }
        }
    }
    let macro_story = hint.macro_source || count(&all, MACRO_HIGH) + count(&all, MACRO_MID) > 0;
    if symbols.is_empty() && macro_story {
        for c in &countries {
            if let Some(ccy) = currency_of(c) {
                for s in currency_symbols(ccy) {
                    if !symbols.iter().any(|x| x == s) {
                        symbols.push((*s).to_string());
                    }
                }
            }
            if symbols.len() >= 3 {
                break;
            }
        }
    }
    symbols.truncate(4);

    let mut currencies: BTreeSet<String> = countries.iter().filter_map(|c| currency_of(c)).filter(|c| ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY", "INR"].contains(c)).map(str::to_string).collect();
    for s in &symbols {
        if asset_class(s) == Some("forex") && s.len() == 6 {
            currencies.insert(s[..3].to_string());
            currencies.insert(s[3..].to_string());
        }
    }

    let category = symbols.first().and_then(|s| asset_class(s)).map(str::to_string).filter(|_| !(macro_story && hint.macro_source)).unwrap_or_else(|| if macro_story { "macro".into() } else { "markets".into() });

    let tone = count(&t, UP) * 2 + count(&all, UP) - count(&t, DOWN) * 2 - count(&all, DOWN);
    let sentiment = if tone > 0 { "bullish" } else if tone < 0 { "bearish" } else { "neutral" }.to_string();

    let mut importance = hint.base;
    if count(&all, MACRO_HIGH) > 0 {
        importance += 30;
    } else if count(&all, MACRO_MID) > 0 {
        importance += 18;
    } else if count(&all, MACRO_LOW) > 0 {
        importance += 8;
    }
    if !symbols.is_empty() {
        importance += 5;
    }
    if has(&t, "breaking") || has(&t, "urgent") {
        importance += 10;
    }
    if count(&all, NOISE) > 0 {
        importance -= 35;
    }
    Tags { countries, currencies: currencies.into_iter().collect(), symbols, category, sentiment, importance: importance.clamp(0, 100) }
}

/// Provider tickers (Infoway / wire services) → Ezymex names.
pub fn map_provider_symbol(s: &str) -> String {
    let u = s.trim().to_ascii_uppercase();
    let u = u.strip_suffix(".US").unwrap_or(&u).to_string();
    match u.as_str() {
        "US500" | "SPX" | "SPY" => "SPX500".into(),
        "JPN225" | "NIKKEI" => "JP225".into(),
        "BTCUSDT" => "BTCUSD".into(),
        "ETHUSDT" => "ETHUSD".into(),
        "SOLUSDT" => "SOLUSD".into(),
        "XRPUSDT" => "XRPUSD".into(),
        "EUR/USD" => "EURUSD".into(),
        _ => u.replace('/', ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NONE: SourceHint = SourceHint { country: "", base: 30, macro_source: false };

    #[test]
    fn gold_and_dollar() {
        let t = tag("Gold climbs to record high as dollar slides after soft US payrolls", "", NONE, &[]);
        assert_eq!(t.symbols[0], "XAUUSD");
        assert!(t.countries.contains(&"us".to_string()));
        assert!(t.currencies.contains(&"USD".to_string()));
        assert_eq!(t.category, "metals");
        assert!(t.importance >= 48, "payrolls is a macro keyword: {}", t.importance);
    }

    #[test]
    fn central_bank_defaults() {
        let hint = SourceHint { country: "jp", base: 45, macro_source: true };
        let t = tag("Statement on Monetary Policy", "The Bank decided to keep the policy rate unchanged.", hint, &[]);
        assert_eq!(t.countries[0], "jp");
        assert_eq!(t.symbols, vec!["USDJPY", "EURJPY", "GBPJPY", "JP225"]);
        assert_eq!(t.currencies, vec!["EUR", "GBP", "JPY", "USD"]);
        assert_eq!(t.category, "macro");
        assert!(t.importance >= 75);
    }

    #[test]
    fn administrative_noise_is_low() {
        let hint = SourceHint { country: "us", base: 45, macro_source: true };
        let t = tag("Federal Reserve Board announces approval of application by Peoples Bancorp Inc.", "", hint, &[]);
        assert!(t.importance < 20, "{}", t.importance);
    }

    #[test]
    fn word_boundaries() {
        // "Metallica" is not "meta", "solar" is not "sol", "fedex" is not "fed", "golden" is not "gold"
        let t = tag("FedEx boosts solar business; Metallica tour a golden ticket", "", NONE, &[]);
        assert!(t.symbols.is_empty(), "{:?}", t.symbols);
        assert!(!t.countries.contains(&"us".to_string()));
        assert_eq!(t.category, "markets");
    }

    #[test]
    fn crypto_and_stocks() {
        let t = tag("Bitcoin tumbles below $60,000 as Nvidia earnings miss weighs on tech stocks", "", NONE, &[]);
        assert_eq!(t.symbols[..3], ["BTCUSD", "NVDA", "NAS100"]);
        assert_eq!(t.sentiment, "bearish");
    }

    #[test]
    fn sentiment_tone() {
        assert_eq!(tag("Stocks rally as inflation cools", "", NONE, &[]).sentiment, "bullish");
        assert_eq!(tag("Oil prices", "", NONE, &[]).sentiment, "neutral");
        assert_eq!(tag("Sterling slumps on recession fears", "", NONE, &[]).sentiment, "bearish");
    }

    #[test]
    fn provider_symbols() {
        let t = tag("Apple raises full-year revenue forecast", "", NONE, &["AAPL.US".into(), "US500".into(), "ZZZZ".into()]);
        assert_eq!(&t.symbols[..2], &["AAPL".to_string(), "SPX500".to_string()]);
        assert_eq!(t.category, "stocks");
    }

    #[test]
    fn us_abbreviation() {
        let t = tag("U.S. retail sales beat forecasts.", "", NONE, &[]);
        assert!(t.countries.contains(&"us".to_string()), "{:?}", t.countries);
        assert_eq!(t.sentiment, "bullish");
    }
}
