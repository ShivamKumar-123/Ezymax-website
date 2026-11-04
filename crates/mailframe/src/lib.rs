//! The one HTML frame every Ezymex email is sent in: a dark card on the brand's volcanic ground, the logo and a
//! category tag at the top, a big title with its last words in the brand red, the hero coin beside the words, an
//! optional strip of facts, an optional green note, the orange button, and the reason the email was sent.
//!
//! Shared by the gateway (codes, welcome, KYC, invites) and the support service (every notification), so a client
//! sees one design whichever service wrote to them. Everything is tables and inline styles, the only CSS that
//! survives Gmail, Outlook and the phone apps; every colour is explicit so a dark-mode client cannot invert it
//! into grey-on-grey. Images are plain https (or a `cid:` the caller attaches), never data URIs, which Gmail drops.

/// What goes in the frame. Text fields are escaped here; `body_html` and `footer_html` are the caller's HTML.
#[derive(Debug, Clone, Default)]
pub struct Frame<'a> {
    pub lang: &'a str,
    pub rtl: bool,
    pub preheader: &'a str,
    /// `cid:…` (attached inline) or an https URL.
    pub logo_src: &'a str,
    /// The small tag at the top right: "Platform notice", "Security", "Verification"…
    pub tag: &'a str,
    pub title: &'a str,
    /// The coin beside the words; None for a narrow email (a code) that has no room for it.
    pub hero_src: Option<&'a str>,
    pub body_html: &'a str,
    /// Label / value pairs in the strip under the words (a date, a time, an amount, a reference).
    pub facts: &'a [(String, String)],
    /// One reassuring line in a green bar ("Open positions and pending orders are not affected.").
    pub note: Option<&'a str>,
    pub button: Option<(&'a str, &'a str)>,
    /// Why the client got this email and where to change it; the caller's HTML.
    pub footer_html: &'a str,
    pub site_url: &'a str,
    pub brand: &'a str,
    pub year: i32,
    /// The ground behind the card (an https image; the colour stands in where images are off).
    pub bg_src: Option<&'a str>,
}

pub const BG: &str = "#070708";
pub const CARD: &str = "#0e0e11";
pub const CARD_LINE: &str = "#3a1616";
pub const PANEL: &str = "#141418";
pub const LINE: &str = "#26262e";
pub const FG: &str = "#f5f5f7";
pub const FG2: &str = "#c7c7cf";
pub const FG3: &str = "#8e8e98";
pub const RED: &str = "#ff3b3b";
pub const EMBER: &str = "#ff5a1f";
pub const GREEN: &str = "#22c55e";
pub const GREEN_BG: &str = "#0f2a1b";
pub const GREEN_LINE: &str = "#1f5a35";

pub fn escape(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '&' => o.push_str("&amp;"),
            '<' => o.push_str("&lt;"),
            '>' => o.push_str("&gt;"),
            '"' => o.push_str("&quot;"),
            '\'' => o.push_str("&#39;"),
            _ => o.push(c),
        }
    }
    o
}

/// The title with its last words in red, the way the brand sets its headlines: the last two words of a title of
/// four or more, the last word of a shorter one, nothing of a single word.
pub fn title_html(title: &str) -> String {
    let words: Vec<&str> = title.split_whitespace().collect();
    let n = words.len();
    let red_from = match n {
        0 | 1 => n,
        2 | 3 => n - 1,
        _ => n - 2,
    };
    let white = escape(&words[..red_from].join(" "));
    let red = escape(&words[red_from..].join(" "));
    match (white.is_empty(), red.is_empty()) {
        (false, false) => format!(r#"{white} <span style="color:{RED}">{red}</span>"#),
        (true, false) => format!(r#"<span style="color:{RED}">{red}</span>"#),
        _ => white,
    }
}

/// The paragraphs of a plain-text body as HTML (blank lines separate paragraphs, single newlines break).
pub fn paragraphs_html(body: &str) -> String {
    body.split("\n\n")
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .map(|p| format!(r#"<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:{FG2}">{}</p>"#, escape(p).replace('\n', "<br>")))
        .collect()
}

pub fn html(f: &Frame) -> String {
    let dir = if f.rtl { r#" dir="rtl""# } else { "" };
    let lang = if f.lang.is_empty() { "en" } else { f.lang };
    let preheader = escape(f.preheader);
    let brand = escape(f.brand);
    let tag = escape(f.tag);
    let site = escape(f.site_url);
    let site_host = f.site_url.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
    let title = title_html(f.title);
    let ground = match f.bg_src {
        Some(u) => format!(r#"background:{BG} url('{}') center top / cover no-repeat"#, escape(u)),
        None => format!("background:{BG}"),
    };
    // The text and the hero are two inline-blocks (not table cells): side by side where the card is wide enough
    // (348 + 18 + 190 = 556 = the card's inner width), and the hero wraps under the text on a phone, so the text
    // column is never squeezed to half the screen (a one-time code must stay on one line). Outlook gets a table.
    let (text_max, hero) = match f.hero_src {
        Some(u) => (
            "348px",
            format!(
                r#"<!--[if mso]></td><td width="190" valign="top"><![endif]--><div style="display:inline-block;vertical-align:top;width:190px;max-width:100%;padding:0 0 0 18px"><img src="{}" width="190" alt="" style="display:block;border:0;outline:none;width:190px;max-width:100%;height:auto"></div>"#,
                escape(u)
            ),
        ),
        None => ("100%", String::new()),
    };
    let facts = if f.facts.is_empty() {
        String::new()
    } else {
        let cells: String = f
            .facts
            .iter()
            .enumerate()
            .map(|(i, (k, v))| {
                let border = if i == 0 { String::new() } else { format!("border-left:1px solid {LINE};") };
                format!(
                    r#"<td valign="top" style="padding:14px 16px;{border}"><div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:{FG3};margin-bottom:4px">{}</div><div style="font-size:15px;font-weight:600;color:{FG}">{}</div></td>"#,
                    escape(k),
                    escape(v)
                )
            })
            .collect();
        format!(
            r#"<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;background:{PANEL};border:1px solid {LINE};border-radius:12px;border-collapse:separate"><tr>{cells}</tr></table>"#
        )
    };
    let note = match f.note {
        Some(n) if !n.trim().is_empty() => format!(
            r#"<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:{GREEN_BG};border:1px solid {GREEN_LINE};border-radius:10px;border-collapse:separate"><tr><td align="center" style="padding:13px 16px;font-size:14.5px;color:{FG}"><span style="color:{GREEN};font-weight:700">&#10004;</span>&nbsp;&nbsp;{}</td></tr></table>"#,
            escape(n)
        ),
        _ => String::new(),
    };
    let button = match f.button {
        Some((label, url)) => format!(
            r#"<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 22px"><tr><td align="center" style="background:{EMBER};border-radius:999px"><a href="{}" style="display:inline-block;padding:15px 38px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">{} &rarr;</a></td></tr></table>"#,
            escape(url),
            escape(label)
        ),
        None => String::new(),
    };
    format!(
        r#"<!doctype html><html lang="{lang}"{dir}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>{brand}</title></head>
<body style="margin:0;padding:0;background:{BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{FG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG}">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="{ground}"><tr><td align="center" style="padding:36px 14px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px">
<tr><td style="background:{CARD};border:1px solid {CARD_LINE};border-radius:18px;padding:30px 32px 26px;border-collapse:separate">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><img src="{logo}" height="30" alt="{brand}" style="display:block;border:0;outline:none;height:30px;width:auto"></td>
<td valign="middle" align="right" style="font-size:13px;color:{FG2};white-space:nowrap"><span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:{RED};vertical-align:middle;margin-right:7px"></span>{tag}</td>
</tr></table>
<div style="width:56px;height:3px;background:{RED};margin:22px 0 22px"></div>
<div style="font-size:0;line-height:0;text-align:left">
<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top"><![endif]-->
<div{dir} style="display:inline-block;vertical-align:top;width:100%;max-width:{text_max};font-size:15px;line-height:1.6">
<h1 style="margin:0 0 16px;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;color:{FG}">{title}</h1>
{body}
</div>
{hero}
<!--[if mso]></td></tr></table><![endif]-->
</div>
{facts}{note}{button}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid {LINE}"><tr><td{dir} style="padding:16px 0 0;font-size:12.5px;line-height:1.6;color:{FG3}">
<span style="display:inline-block;width:16px;height:16px;line-height:16px;border:1px solid {FG3};border-radius:999px;text-align:center;font-size:10px;font-weight:700;vertical-align:middle;margin-right:8px">i</span>{footer}
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 6px 0;font-size:12.5px;line-height:1.8;color:{FG3}">
<a href="{site}" style="color:{FG2};text-decoration:none">{site_host}</a><br>
&copy; {year} {brand}. All rights reserved.
</td></tr>
</table></td></tr></table></body></html>"#,
        logo = escape(f.logo_src),
        body = f.body_html,
        footer = f.footer_html,
        year = f.year,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_last_words_go_red() {
        assert_eq!(title_html("Scheduled maintenance on Sunday"), r##"Scheduled maintenance <span style="color:#ff3b3b">on Sunday</span>"##);
        assert_eq!(title_html("Deposit credited"), r##"Deposit <span style="color:#ff3b3b">credited</span>"##);
        assert_eq!(title_html("Welcome"), "Welcome");
        assert_eq!(title_html("A <b> & c d"), r##"A &lt;b&gt; &amp; <span style="color:#ff3b3b">c d</span>"##);
    }

    #[test]
    fn the_frame_carries_every_part_and_escapes_what_it_is_given() {
        let facts = vec![("When".to_string(), "Sunday, 9 Nov".to_string()), ("Time".to_string(), "02:00 – 03:30 UTC".to_string())];
        let f = Frame {
            lang: "en",
            preheader: "pre <x>",
            logo_src: "cid:logo",
            tag: "Platform notice",
            title: "Scheduled maintenance on Sunday",
            hero_src: Some("https://app.example/hero.png"),
            body_html: "<p>body</p>",
            facts: &facts,
            note: Some("Open positions are not affected & safe"),
            button: Some(("Open Ezymex", "https://app.example/?a=1&b=2")),
            footer_html: "why",
            site_url: "https://ezymex.com",
            brand: "Ezymex",
            year: 2026,
            bg_src: Some("https://app.example/bg.jpg"),
            ..Default::default()
        };
        let h = html(&f);
        for part in ["pre &lt;x&gt;", "cid:logo", "Platform notice", r##"<span style="color:#ff3b3b">on Sunday</span>"##, "hero.png", "<p>body</p>", "Sunday, 9 Nov", "not affected &amp; safe", "?a=1&amp;b=2", "Open Ezymex &rarr;", "why", "ezymex.com", "&copy; 2026 Ezymex", "bg.jpg"] {
            assert!(h.contains(part), "missing {part}");
        }
        assert!(!h.contains("<x>"));
    }
}
