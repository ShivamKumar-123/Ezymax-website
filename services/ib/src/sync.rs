//! Referral tree mirror: clients from the gateway (`/v1/internal/referrals/users`), polled by keyset cursor.
//! Attribution is permanent (D63): the upline and campaign are set when a client is first seen and are only
//! changed by an admin reassignment. Self-referral signals (D59) are compared with the upline on every change.

use crate::audit::{self, Actor};
use crate::clients::{self, GwUser};
use crate::db;
use crate::model::Settings;
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;

const CURSOR: &str = "gateway_users";

/// Pulls every changed client since the stored cursor. Returns the number of rows applied.
pub async fn sync_once(st: &AppState) -> anyhow::Result<usize> {
    let mut n = 0;
    loop {
        let cur = db::cursor(&st.pool, CURSOR).await?;
        let (since, after) = match cur.as_deref().and_then(|c| c.split_once('|')) {
            Some((s, a)) => (Some(s.to_string()), a.parse().unwrap_or(0)),
            None => (None, 0),
        };
        let page = clients::gateway_users(st, since.as_deref(), after, 500).await?;
        if page.is_empty() {
            return Ok(n);
        }
        for u in &page {
            upsert_member(st, u).await?;
        }
        n += page.len();
        let last = page.last().unwrap();
        db::set_cursor(&st.pool, CURSOR, &format!("{}|{}", last.changed_at.to_rfc3339_opts(chrono::SecondsFormat::Micros, true), last.id)).await?;
        if page.len() < 500 {
            return Ok(n);
        }
    }
}

pub async fn upsert_member(st: &AppState, u: &GwUser) -> anyhow::Result<()> {
    let tenant = u.tenant.as_str();
    let entry = db::entry_level(&st.pool, tenant).await?;
    let parent = u.referred_by.filter(|p| *p != u.id);
    let campaign_id: Option<i64> = match (parent, u.referral_campaign.as_deref()) {
        (Some(p), Some(slug)) => sqlx::query_scalar("SELECT id FROM campaigns WHERE tenant = $1 AND user_id = $2 AND slug = $3").bind(tenant).bind(p).bind(slug).fetch_optional(&st.pool).await?,
        _ => None,
    };
    let row = sqlx::query(
        "INSERT INTO members (user_id, tenant, email, first_name, last_name, country, referral_code, parent_id, signup_parent_id,
                              campaign_id, campaign_raw, level_key, kyc_status, gateway_status, email_verified, identity, ips, devices,
                              joined_at, changed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (user_id) DO UPDATE SET
            email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, country = EXCLUDED.country,
            referral_code = EXCLUDED.referral_code, kyc_status = EXCLUDED.kyc_status, gateway_status = EXCLUDED.gateway_status,
            email_verified = EXCLUDED.email_verified, identity = EXCLUDED.identity, ips = EXCLUDED.ips, devices = EXCLUDED.devices,
            changed_at = EXCLUDED.changed_at, synced_at = now()
         RETURNING (xmax = 0) AS inserted",
    )
    .bind(u.id)
    .bind(tenant)
    .bind(&u.email)
    .bind(&u.first_name)
    .bind(&u.last_name)
    .bind(&u.country)
    .bind(&u.referral_code)
    .bind(parent)
    .bind(campaign_id)
    .bind(&u.referral_campaign)
    .bind(&entry)
    .bind(&u.kyc_status)
    .bind(if u.status.is_empty() { "active" } else { u.status.as_str() })
    .bind(u.email_verified)
    .bind(&u.identity)
    .bind(&u.ips)
    .bind(&u.devices)
    .bind(u.created_at)
    .bind(u.changed_at)
    .fetch_one(&st.pool)
    .await?;
    let inserted: bool = row.get("inserted");
    if inserted {
        sqlx::query("INSERT INTO level_history (tenant, user_id, from_key, to_key, reason) VALUES ($1,$2,NULL,$3,'joined')").bind(tenant).bind(u.id).bind(&entry).execute(&st.pool).await?;
        // deals that arrived before the client was mirrored are re-evaluated now
        crate::deals::reprocess_unknown(st, u.id).await?;
    }
    let settings = db::settings(&st.pool, tenant).await?;
    check_self_referral(st, tenant, u.id, &settings).await?;
    let children: Vec<i64> = sqlx::query_scalar("SELECT user_id FROM members WHERE tenant = $1 AND parent_id = $2").bind(tenant).bind(u.id).fetch_all(&st.pool).await?;
    for c in children {
        check_self_referral(st, tenant, c, &settings).await?;
    }
    Ok(())
}

fn meaningful_ip(ip: &str) -> bool {
    let ip = ip.trim();
    !(ip.is_empty() || ip == "unknown" || ip == "::1" || ip.starts_with("127.") || ip.starts_with("::ffff:127."))
}

fn overlap(a: &[String], b: &[String], f: impl Fn(&str) -> bool) -> Option<String> {
    a.iter().find(|x| f(x) && b.contains(x)).cloned()
}

/// Compares a client's identity / device / IP signals with its upline's. Every match (with the signal not
/// `off`) raises a fraud flag; a match on a `block` signal stops commissions from that client until an admin
/// dismisses the flag.
pub async fn check_self_referral(st: &AppState, tenant: &str, client: i64, s: &Settings) -> anyhow::Result<()> {
    let Some(c) = sqlx::query("SELECT parent_id, identity, ips, devices, self_referral, abuse_cleared FROM members WHERE user_id = $1 AND tenant = $2")
        .bind(client)
        .bind(tenant)
        .fetch_optional(&st.pool)
        .await?
    else {
        return Ok(());
    };
    let Some(parent) = c.get::<Option<i64>, _>("parent_id") else {
        if c.get::<Option<String>, _>("self_referral").is_some() {
            sqlx::query("UPDATE members SET self_referral = NULL WHERE user_id = $1").bind(client).execute(&st.pool).await?;
        }
        return Ok(());
    };
    let Some(p) = sqlx::query("SELECT identity, ips, devices FROM members WHERE user_id = $1").bind(parent).fetch_optional(&st.pool).await? else {
        return Ok(());
    };
    let get = |r: &sqlx::postgres::PgRow, k: &str| r.get::<Vec<String>, _>(k);
    let matches = [
        ("identity", s.self_referral.identity.as_str(), overlap(&get(&c, "identity"), &get(&p, "identity"), |x| !x.is_empty()), "high"),
        ("device", s.self_referral.device.as_str(), overlap(&get(&c, "devices"), &get(&p, "devices"), |x| !x.is_empty()), "high"),
        ("ip", s.self_referral.ip.as_str(), overlap(&get(&c, "ips"), &get(&p, "ips"), meaningful_ip), "medium"),
    ];
    let mut block: Option<&str> = None;
    for (signal, action, hit, severity) in &matches {
        let Some(value) = hit else { continue };
        if *action == "off" {
            continue;
        }
        let detail = if *signal == "ip" { json!({"signal": signal, "ip": value}) } else { json!({"signal": signal}) };
        let inserted = sqlx::query(
            "INSERT INTO fraud_flags (tenant, kind, severity, client_id, ib_id, dedup, details) VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (tenant, dedup) DO NOTHING",
        )
        .bind(tenant)
        .bind(format!("self_referral_{signal}"))
        .bind(*severity)
        .bind(client)
        .bind(parent)
        .bind(format!("self_referral:{signal}:{client}:{parent}"))
        .bind(sqlx::types::Json(detail))
        .execute(&st.pool)
        .await?
        .rows_affected();
        if inserted > 0 {
            tracing::warn!(client, parent, signal, "self-referral signal matched");
        }
        if *action == "block" && block.is_none() {
            block = Some(signal);
        }
    }
    let cleared: bool = c.get("abuse_cleared");
    let now_block = if cleared { None } else { block };
    let was: Option<String> = c.get("self_referral");
    if was.as_deref() != now_block {
        sqlx::query("UPDATE members SET self_referral = $2 WHERE user_id = $1").bind(client).bind(now_block).execute(&st.pool).await?;
        audit::record(&st.pool, tenant, &Actor::system(), "member.self_referral", Some(format!("user:{client}")), Some(json!({"selfReferral": was})), Some(json!({"selfReferral": now_block, "upline": parent})), None).await?;
    }
    Ok(())
}
