//! Certificates (D149, shareable D136): issued on every phase pass, on the funded account and on every paid
//! payout. Each has a short public code; `/verify/<code>` in the Client Area shows it, and the service renders
//! a branded SVG image (`GET /v1/public/certificates/{code}/image.svg`). The Client Area also renders a PNG
//! of the same layout for downloads and social cards.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::{PgPool, Row};

use crate::money::{D, num, num_opt};
use crate::store::random_code;

#[derive(Clone, Debug)]
pub struct Certificate {
    pub code: String,
    pub tenant: String,
    pub user_id: i64,
    pub challenge_id: i64,
    pub kind: String,
    pub title: String,
    pub trader_name: String,
    pub plan_name: String,
    pub size: D,
    pub amount: Option<D>,
    pub phase_name: Option<String>,
    pub issued_at: DateTime<Utc>,
    pub revoked: bool,
}

const COLS: &str = "code, tenant, user_id, challenge_id, kind, title, trader_name, plan_name, size, amount, phase_name, issued_at, revoked";

fn from_row(r: &sqlx::postgres::PgRow) -> Certificate {
    Certificate {
        code: r.get("code"),
        tenant: r.get("tenant"),
        user_id: r.get("user_id"),
        challenge_id: r.get("challenge_id"),
        kind: r.get("kind"),
        title: r.get("title"),
        trader_name: r.get("trader_name"),
        plan_name: r.get("plan_name"),
        size: r.get("size"),
        amount: r.get("amount"),
        phase_name: r.get("phase_name"),
        issued_at: r.get("issued_at"),
        revoked: r.get("revoked"),
    }
}

/// Public display name: first name + last initial ("Shivam S.").
pub fn public_name(full: &str) -> String {
    let mut parts = full.split_whitespace();
    match (parts.next(), parts.last()) {
        (Some(f), Some(l)) => format!("{f} {}.", l.chars().next().unwrap_or(' ')),
        (Some(f), None) => f.to_string(),
        _ => "Kalks trader".into(),
    }
}

/// Issues a certificate once per `reference` (idempotent). Returns its code.
#[allow(clippy::too_many_arguments)]
pub async fn issue(pool: &PgPool, tenant: &str, user_id: i64, challenge_id: i64, kind: &str, title: &str, trader_name: &str, plan_name: &str, size: D, amount: Option<D>, phase_name: Option<&str>, reference: &str) -> sqlx::Result<String> {
    if let Some(code) = sqlx::query_scalar::<_, String>("SELECT code FROM certificates WHERE tenant = $1 AND ref = $2").bind(tenant).bind(reference).fetch_optional(pool).await? {
        return Ok(code);
    }
    let code = random_code(10);
    sqlx::query(
        "INSERT INTO certificates (code, tenant, user_id, challenge_id, kind, title, trader_name, plan_name, size, amount, phase_name, ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (tenant, ref) DO NOTHING",
    )
    .bind(&code)
    .bind(tenant)
    .bind(user_id)
    .bind(challenge_id)
    .bind(kind)
    .bind(title)
    .bind(public_name(trader_name))
    .bind(plan_name)
    .bind(size)
    .bind(amount)
    .bind(phase_name)
    .bind(reference)
    .execute(pool)
    .await?;
    let code: String = sqlx::query_scalar("SELECT code FROM certificates WHERE tenant = $1 AND ref = $2").bind(tenant).bind(reference).fetch_one(pool).await?;
    Ok(code)
}

pub async fn get(pool: &PgPool, code: &str) -> sqlx::Result<Option<Certificate>> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {COLS} FROM certificates WHERE code = $1"))).bind(code).fetch_optional(pool).await?;
    Ok(r.as_ref().map(from_row))
}

pub async fn list(pool: &PgPool, tenant: &str, user_id: Option<i64>, limit: i64) -> sqlx::Result<Vec<Certificate>> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {COLS} FROM certificates WHERE tenant = $1 AND ($2::bigint IS NULL OR user_id = $2) ORDER BY issued_at DESC LIMIT $3"
    )))
    .bind(tenant)
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(from_row).collect())
}

pub fn json(c: &Certificate, verify_base: &str) -> Value {
    json!({
        "code": c.code, "kind": c.kind, "title": c.title, "traderName": c.trader_name, "planName": c.plan_name,
        "size": num(c.size), "amount": num_opt(c.amount), "phase": c.phase_name, "issuedAt": c.issued_at, "revoked": c.revoked,
        "challengeId": c.challenge_id, "userId": c.user_id,
        "verifyUrl": format!("{verify_base}/{}", c.code),
    })
}

/// Public view (no user or challenge ids).
pub fn public_json(c: &Certificate, verify_base: &str) -> Value {
    json!({
        "code": c.code, "kind": c.kind, "title": c.title, "traderName": c.trader_name, "planName": c.plan_name,
        "size": num(c.size), "amount": num_opt(c.amount), "phase": c.phase_name, "issuedAt": c.issued_at,
        "valid": !c.revoked, "verifyUrl": format!("{verify_base}/{}", c.code),
    })
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// "$100,000" / "$1,234.56"
pub fn money_text(d: D) -> String {
    let d = d.round_dp(2);
    let neg = d.is_sign_negative();
    let s = d.abs().to_string();
    let (int, frac) = s.split_once('.').map(|(i, f)| (i.to_string(), Some(f.to_string()))).unwrap_or((s.clone(), None));
    let mut out = String::new();
    for (i, ch) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    let frac = frac.map(|f| format!(".{:0<2}", f)).filter(|f| f != ".00").unwrap_or_default();
    format!("{}${out}{frac}", if neg { "-" } else { "" })
}

/// Branded certificate image (1200 × 675 SVG, dark theme, ember accent).
pub fn svg(c: &Certificate, verify_base: &str) -> String {
    let headline = match c.kind.as_str() {
        "payout" => "Certificate of Payout",
        "funded" => "Funded Trader",
        _ => "Certificate of Achievement",
    };
    let big = match (c.kind.as_str(), c.amount) {
        ("payout", Some(a)) => money_text(a),
        _ => money_text(c.size),
    };
    let sub = match c.kind.as_str() {
        "payout" => format!("paid out on a {} {} account", money_text(c.size), esc(&c.plan_name)),
        "funded" => format!("{} funded account · {}", money_text(c.size), esc(&c.plan_name)),
        _ => format!("passed {} · {} account · {}", esc(c.phase_name.as_deref().unwrap_or("evaluation")), money_text(c.size), esc(&c.plan_name)),
    };
    let date = c.issued_at.format("%d %b %Y").to_string();
    let revoked = if c.revoked { r##"<text x="600" y="640" text-anchor="middle" font-size="20" fill="#f04438" font-weight="600">REVOKED</text>"## } else { "" };
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" font-family="Inter, Helvetica, Arial, sans-serif">
<rect width="1200" height="675" fill="#0b0b0d"/>
<rect x="24" y="24" width="1152" height="627" rx="28" fill="#121215" stroke="#2a2a30"/>
<rect x="24" y="24" width="1152" height="6" rx="3" fill="#ff5a1f"/>
<text x="80" y="110" font-size="28" font-weight="700" fill="#f5f5f6" letter-spacing="1">KALKS</text>
<text x="176" y="110" font-size="18" fill="#9a9aa3">PROP</text>
<text x="1120" y="110" text-anchor="end" font-size="16" fill="#9a9aa3">No. {code}</text>
<text x="80" y="200" font-size="22" fill="#ff8a3d" letter-spacing="3">{headline_upper}</text>
<text x="80" y="275" font-size="56" font-weight="600" fill="#f5f5f6">{name}</text>
<text x="80" y="395" font-size="92" font-weight="700" fill="#f5f5f6">{big}</text>
<text x="80" y="450" font-size="24" fill="#c4c4cc">{sub}</text>
<line x1="80" y1="530" x2="1120" y2="530" stroke="#2a2a30"/>
<text x="80" y="580" font-size="16" fill="#9a9aa3">Issued</text>
<text x="80" y="610" font-size="22" fill="#f5f5f6">{date}</text>
<text x="1120" y="580" text-anchor="end" font-size="16" fill="#9a9aa3">Verify</text>
<text x="1120" y="610" text-anchor="end" font-size="20" fill="#f5f5f6">{verify}</text>
{revoked}
</svg>"##,
        code = esc(&c.code),
        headline_upper = headline.to_uppercase(),
        name = esc(&c.trader_name),
        big = esc(&big),
        sub = sub,
        date = date,
        verify = esc(&format!("{}/{}", verify_base.trim_start_matches("https://").trim_start_matches("http://"), c.code)),
        revoked = revoked,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn names_and_money() {
        assert_eq!(public_name("Shivam Kumar Singh"), "Shivam S.");
        assert_eq!(public_name("Madonna"), "Madonna");
        assert_eq!(public_name("  "), "Kalks trader");
        assert_eq!(money_text(D::from(100000)), "$100,000");
        assert_eq!(money_text(D::from_str("1234.5").unwrap()), "$1,234.50");
        assert_eq!(money_text(D::from_str("999.999").unwrap()), "$1,000");
    }

    #[test]
    fn svg_escapes_text() {
        let c = Certificate {
            code: "ABCD234567".into(),
            tenant: "kalks".into(),
            user_id: 1,
            challenge_id: 1,
            kind: "pass".into(),
            title: "t".into(),
            trader_name: "<script>".into(),
            plan_name: "A & B".into(),
            size: D::from(50000),
            amount: None,
            phase_name: Some("Phase 1".into()),
            issued_at: Utc::now(),
            revoked: false,
        };
        let s = svg(&c, "https://app.kalkstrade.com/verify");
        assert!(s.contains("&lt;script&gt;"));
        assert!(s.contains("A &amp; B"));
        assert!(s.contains("app.kalkstrade.com/verify/ABCD234567"));
    }
}
