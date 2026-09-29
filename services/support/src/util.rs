//! Small helpers: random tokens, text clean-up, time formatting.

/// URL-safe random token of `n` random bytes (hex).
pub fn token(n: usize) -> String {
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// Trims, drops control characters (keeps newlines / tabs) and caps the length in characters.
pub fn clean(s: &str, max: usize) -> String {
    let t: String = s.chars().filter(|c| !c.is_control() || *c == '\n' || *c == '\t').take(max).collect();
    t.trim().to_string()
}

/// One-line preview of a message.
pub fn preview(s: &str) -> String {
    let one: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if one.chars().count() > 140 { format!("{}…", one.chars().take(139).collect::<String>()) } else { one }
}

pub fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

pub fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_names() {
        assert_eq!(percent_decode("Julia%20Novak"), "Julia Novak");
        assert_eq!(percent_decode("A%C3%AFda"), "Aïda");
        assert_eq!(percent_decode("50%"), "50%");
        assert_eq!(percent_decode("5%2"), "5%2");
    }

    #[test]
    fn cleans_text() {
        assert_eq!(clean("  hi\u{0007} there\n ", 100), "hi there");
        assert_eq!(clean("abcdef", 3), "abc");
        assert_eq!(preview("a\n\nb   c"), "a b c");
    }
}
