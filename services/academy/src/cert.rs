//! Phase certificates: public verification codes and the branded certificate image (SVG, A4 landscape).

pub fn new_code() -> String {
    // 10 symbols from an unambiguous alphabet (no 0/O/1/I), shown as KA-XXXXX-XXXXX
    const A: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut b = [0u8; 10];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    let s: String = b.iter().map(|x| A[*x as usize % A.len()] as char).collect();
    format!("KA-{}-{}", &s[..5], &s[5..])
}

pub fn valid_code(c: &str) -> bool {
    c.len() == 14 && c.starts_with("KA-") && c.as_bytes()[8] == b'-' && c.chars().enumerate().all(|(i, ch)| i == 2 || i == 8 || ch.is_ascii_uppercase() || ch.is_ascii_digit())
}

pub fn esc(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => o.push_str("&amp;"),
            '<' => o.push_str("&lt;"),
            '>' => o.push_str("&gt;"),
            '"' => o.push_str("&quot;"),
            '\'' => o.push_str("&#39;"),
            c if (c as u32) < 0x20 => o.push(' '),
            c => o.push(c),
        }
    }
    o
}

pub struct CertView<'a> {
    pub code: &'a str,
    pub tenant_name: &'a str,
    pub learner: &'a str,
    pub phase_order: i32,
    pub phase_title: &'a str,
    pub level: &'a str,
    pub score_pct: i32,
    pub issued: &'a str,
    pub verify_url: &'a str,
    pub revoked: bool,
}

/// Static, self-contained SVG (no scripts, no external references) so it can be served as an image and printed.
pub fn svg(v: &CertView) -> String {
    let learner = esc(&truncate(v.learner, 48));
    let brand = esc(&truncate(v.tenant_name, 40));
    let title = esc(&truncate(v.phase_title, 60));
    let verify = esc(v.verify_url);
    let revoked = if v.revoked {
        r##"<text x="800" y="600" text-anchor="middle" font-size="120" font-weight="700" fill="#ef4444" opacity="0.35" transform="rotate(-18 800 600)">REVOKED</text>"##
    } else {
        ""
    };
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1131" width="1600" height="1131" font-family="Inter, 'Helvetica Neue', Arial, sans-serif">
  <rect width="1600" height="1131" fill="#0b0b0e"/>
  <rect x="36" y="36" width="1528" height="1059" rx="28" fill="#111115" stroke="#2a2a33" stroke-width="2"/>
  <rect x="36" y="36" width="1528" height="10" rx="5" fill="#ff5a1f"/>
  <g fill="none" stroke="#1d1d24" stroke-width="1">
    <path d="M1180 1095 L1564 711"/><path d="M1260 1095 L1564 791"/><path d="M1340 1095 L1564 871"/><path d="M1420 1095 L1564 951"/>
  </g>
  <text x="120" y="170" font-size="30" font-weight="700" fill="#f4f4f6" letter-spacing="1">{brand}</text>
  <text x="120" y="206" font-size="20" fill="#ff5a1f" letter-spacing="6">ACADEMY</text>
  <text x="1480" y="170" text-anchor="end" font-size="18" fill="#8b8b96" letter-spacing="3">CERTIFICATE OF COMPLETION</text>
  <text x="1480" y="200" text-anchor="end" font-size="16" fill="#8b8b96">{level} level</text>
  <text x="120" y="360" font-size="22" fill="#8b8b96">This certifies that</text>
  <text x="120" y="450" font-size="72" font-weight="600" fill="#f4f4f6">{learner}</text>
  <rect x="120" y="486" width="220" height="3" fill="#ff5a1f"/>
  <text x="120" y="560" font-size="22" fill="#8b8b96">has completed every chapter and passed the final exam of</text>
  <text x="120" y="630" font-size="44" font-weight="600" fill="#f4f4f6">Phase {phase_order} · {title}</text>
  <text x="120" y="680" font-size="22" fill="#c9c9d1">Fundamental and technical analysis tracks · final exam score {score}%</text>
  <line x1="120" y1="850" x2="1480" y2="850" stroke="#2a2a33" stroke-width="2"/>
  <text x="120" y="900" font-size="16" fill="#8b8b96" letter-spacing="2">ISSUED</text>
  <text x="120" y="935" font-size="24" fill="#f4f4f6">{issued}</text>
  <text x="520" y="900" font-size="16" fill="#8b8b96" letter-spacing="2">CERTIFICATE ID</text>
  <text x="520" y="935" font-size="24" fill="#f4f4f6" font-family="'JetBrains Mono', Menlo, monospace">{code}</text>
  <text x="1480" y="900" text-anchor="end" font-size="16" fill="#8b8b96" letter-spacing="2">VERIFY</text>
  <text x="1480" y="935" text-anchor="end" font-size="20" fill="#ff5a1f">{verify}</text>
  <text x="120" y="1030" font-size="15" fill="#6b6b76">Educational certificate. It is not a financial qualification or licence. Trading CFDs on margin carries a high risk of losing money.</text>
  {revoked}
</svg>"##,
        phase_order = v.phase_order,
        level = esc(v.level),
        score = v.score_pct,
        issued = esc(v.issued),
        code = esc(v.code),
    )
}

fn truncate(s: &str, n: usize) -> String {
    let s = s.trim();
    if s.chars().count() <= n { s.to_string() } else { format!("{}…", s.chars().take(n - 1).collect::<String>()) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes() {
        for _ in 0..50 {
            let c = new_code();
            assert!(valid_code(&c), "{c}");
        }
        assert!(!valid_code("KA-abcde-12345"));
        assert!(!valid_code("../etc/passwd"));
    }

    #[test]
    fn svg_escapes_names() {
        let s = svg(&CertView {
            code: "KA-ABCDE-FGHJK",
            tenant_name: "Kalks <Markets>",
            learner: "A \"B\" & <script>",
            phase_order: 1,
            phase_title: "Markets",
            level: "Beginner",
            score_pct: 87,
            issued: "28 Sep 2026",
            verify_url: "https://x/certificate/KA-ABCDE-FGHJK",
            revoked: false,
        });
        assert!(!s.contains("<script>"));
        assert!(s.contains("&lt;script&gt;"));
        assert!(s.contains("87%"));
    }
}
