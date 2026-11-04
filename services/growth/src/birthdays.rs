//! Birthday greetings: once a year, at the platform's morning hour, every client whose date of birth is today gets
//! a greeting - the bell, and an email when their "Birthday wishes" preference allows it (support `PREF_KEYS`).
//!
//! The date of birth comes from the client profile (`profiles.birthday`, "MM-DD", mirrored from the gateway); only
//! month and day are ever used, and the email says neither. A client born on 29 February is greeted on 28 February
//! in a year without one. The tick runs every few minutes all day: before the platform's greeting hour it does
//! nothing, after it each greeting is claimed in `birthday_emails` (unique per client and year) before it is
//! sent, so a repeated tick or a second replica never sends twice. A greeting is a greeting: no bonus, no credit,
//! no condition.

use chrono::{Datelike, FixedOffset, Timelike, Utc};
use serde_json::{Value, json};
use sqlx::Row;

use crate::state::AppState;

pub const KIND: &str = "birthday.wish";
pub const COMPANY: &str = "Ezymex";
const MAX_ATTEMPTS: i32 = 6;

/// The greeting's subject, title and body, from the client's first name (their preferred name in the profile).
pub fn greeting(first_name: &str) -> (String, String, String) {
    let name = first_name.trim();
    let name = if name.is_empty() { "there" } else { name };
    (
        format!("Happy Birthday, {name}! \u{1F389}"),
        format!("Happy Birthday, {name}!"),
        format!(
            "Dear {name},\n\nHappy Birthday!\n\nThe entire {COMPANY} team wishes you a wonderful birthday filled with happiness, success, and new opportunities.\n\nThank you for being a valued member of our trading community.\n\nWe wish you continued success in your trading journey!\n\nBest wishes,\nTeam {COMPANY}"
        ),
    )
}

fn leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Whether a birthday "MM-DD" is greeted on `today` (month, day, year): the day itself, or 28 February for a
/// 29 February birthday in a year that has none.
pub fn is_today(birthday: &str, month: u32, day: u32, year: i32) -> bool {
    let today = format!("{month:02}-{day:02}");
    birthday == today || (birthday == "02-29" && month == 2 && day == 28 && !leap(year))
}

/// One pass: the greetings due now. Returns how many were sent (or skipped by preference).
pub async fn tick(st: &AppState) -> anyhow::Result<usize> {
    let offset = FixedOffset::east_opt(st.cfg.platform_tz_offset_min * 60).unwrap_or(FixedOffset::east_opt(0).unwrap());
    let local = Utc::now().with_timezone(&offset);
    if local.hour() < st.cfg.birthday_hour {
        return Ok(0);
    }
    let (year, month, day) = (local.year(), local.month(), local.day());
    let mmdd = format!("{month:02}-{day:02}");
    let feb28_short_year = month == 2 && day == 28 && !leap(year);
    let tenants: Vec<String> = sqlx::query_scalar("SELECT DISTINCT tenant FROM profiles").fetch_all(&st.pool).await?;
    let mut done = 0;
    for tenant in tenants {
        let rows = sqlx::query(
            "SELECT p.user_id, p.first_name FROM profiles p
             WHERE p.tenant = $1 AND p.status = 'active' AND p.email <> '' AND p.birthday IS NOT NULL
               AND (p.birthday = $2 OR ($3 AND p.birthday = '02-29'))
               AND NOT EXISTS (SELECT 1 FROM birthday_emails b WHERE b.tenant = p.tenant AND b.user_id = p.user_id AND b.year = $4
                               AND (b.status <> 'failed' OR b.attempts >= $5))
             ORDER BY p.user_id LIMIT 500",
        )
        .bind(&tenant)
        .bind(&mmdd)
        .bind(feb28_short_year)
        .bind(year)
        .bind(MAX_ATTEMPTS)
        .fetch_all(&st.pool)
        .await?;
        for r in &rows {
            let user_id: i64 = r.get("user_id");
            let first: String = r.get("first_name");
            // the claim: a new row, or a failed one with attempts left; anything else is someone else's send
            let claimed: Option<i64> = sqlx::query_scalar(
                "INSERT INTO birthday_emails (tenant, user_id, year, status) VALUES ($1, $2, $3, 'pending')
                 ON CONFLICT (tenant, user_id, year) DO UPDATE SET status = 'pending', attempts = birthday_emails.attempts + 1
                 WHERE birthday_emails.status = 'failed' AND birthday_emails.attempts < $4
                 RETURNING id",
            )
            .bind(&tenant)
            .bind(user_id)
            .bind(year)
            .bind(MAX_ATTEMPTS)
            .fetch_optional(&st.pool)
            .await?;
            let Some(claim) = claimed else { continue };
            match send(st, &tenant, user_id, &first, year).await {
                Ok(emailed) => {
                    sqlx::query("UPDATE birthday_emails SET status = $2, sent_at = now(), failure_reason = $3 WHERE id = $1")
                        .bind(claim)
                        .bind(if emailed { "sent" } else { "skipped" })
                        .bind(if emailed { None } else { Some("birthday emails switched off by the client; greeted in-app") })
                        .execute(&st.pool)
                        .await?;
                    done += 1;
                }
                Err(e) => {
                    let reason = e.to_string().chars().take(300).collect::<String>();
                    sqlx::query("UPDATE birthday_emails SET status = 'failed', failure_reason = $2 WHERE id = $1").bind(claim).bind(&reason).execute(&st.pool).await?;
                    tracing::warn!(tenant, user_id, error = %reason, "birthday greeting not sent (will retry)");
                }
            }
        }
    }
    Ok(done)
}

/// Posts the greeting to the support service and says whether it went out by email as well as in-app.
async fn send(st: &AppState, tenant: &str, user_id: i64, first_name: &str, year: i32) -> anyhow::Result<bool> {
    let (subject, title, body) = greeting(first_name);
    let payload = json!({
        "userId": user_id, "type": KIND, "title": title, "body": body, "link": "/dashboard", "severity": "success",
        "emailSubject": subject, "dedupeKey": format!("birthday:{user_id}:{year}"),
        "data": {"year": year, "note": format!("From all of us at {COMPANY} - have a wonderful day.")},
    });
    let r = st
        .http
        .post(format!("{}/v1/notify", st.cfg.notify_url))
        .header("x-ezymex-internal", &st.cfg.notify_token)
        .header("x-ezymex-tenant", tenant)
        .header("x-ezymex-service", "growth")
        .timeout(std::time::Duration::from_secs(8))
        .json(&payload)
        .send()
        .await?;
    if !r.status().is_success() {
        anyhow::bail!("support answered HTTP {}", r.status());
    }
    let v: Value = r.json().await?;
    let first = &v["results"][0];
    Ok(first["emailed"].as_bool().unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::{greeting, is_today};

    #[test]
    fn the_day_itself_and_the_leap_day_rule() {
        assert!(is_today("11-04", 11, 4, 2026));
        assert!(!is_today("11-05", 11, 4, 2026));
        // 29 February: greeted on the 28th in a year without one, on the 29th in a leap year
        assert!(is_today("02-29", 2, 28, 2026));
        assert!(!is_today("02-29", 2, 28, 2028));
        assert!(is_today("02-29", 2, 29, 2028));
        assert!(!is_today("02-28", 2, 29, 2028) || is_today("02-28", 2, 28, 2028));
    }

    #[test]
    fn the_greeting_uses_the_first_name_and_never_the_date() {
        let (subject, title, body) = greeting("Jugnu");
        assert_eq!(subject, "Happy Birthday, Jugnu! \u{1F389}");
        assert_eq!(title, "Happy Birthday, Jugnu!");
        assert!(body.starts_with("Dear Jugnu,"));
        assert!(body.contains("Team Ezymex"));
        assert!(!body.contains("1990"));
        let (_, _, anon) = greeting("  ");
        assert!(anon.starts_with("Dear there,"));
    }
}
