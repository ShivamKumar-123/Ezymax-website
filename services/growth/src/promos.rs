//! Promo codes (D144): bonus / points / discount codes with global and per-client limits and segment rules.
//! A redemption locks the code row, so `maxUses` and `perUserLimit` hold under concurrency. Refused attempts
//! are logged as `blocked` with the reason (Back Office abuse review).

use crate::bonus::{self, ClaimOpts};
use crate::calc::{self, Limits, Segment};
use crate::error::{ApiError, ApiResult};
use crate::loyalty;
use crate::model::opt_num;
use crate::money::num;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;

pub fn promo_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "code": r.get::<String, _>("code"),
        "description": r.get::<String, _>("description"),
        "kind": r.get::<String, _>("kind"),
        "campaignId": r.get::<Option<i64>, _>("campaign_id"),
        "points": r.get::<Option<i64>, _>("points"),
        "discountPct": opt_num(r.get("discount_pct")),
        "discountAppliesTo": r.get::<String, _>("discount_applies_to"),
        "maxUses": r.get::<Option<i32>, _>("max_uses"),
        "perUserLimit": r.get::<i32, _>("per_user_limit"),
        "uses": r.get::<i32, _>("uses"),
        "newUsersDays": r.get::<Option<i32>, _>("new_users_days"),
        "countries": r.get::<Vec<String>, _>("countries"),
        "kycRequired": r.get::<bool, _>("kyc_required"),
        "active": r.get::<bool, _>("active"),
        "startsAt": r.get::<DateTime<Utc>, _>("starts_at"),
        "endsAt": r.get::<Option<DateTime<Utc>>, _>("ends_at"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
    })
}

pub fn use_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "promoId": r.get::<Option<i64>, _>("promo_id"),
        "code": r.get::<String, _>("code"),
        "kind": r.get::<Option<String>, _>("kind"),
        "status": r.get::<String, _>("status"),
        "reason": r.get::<Option<String>, _>("reason"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
    })
}

async fn log_blocked(st: &AppState, tenant: &str, promo: Option<i64>, code: &str, user_id: i64, reason: &str) {
    let r = sqlx::query("INSERT INTO promo_redemptions (tenant, promo_id, code, user_id, status, reason) VALUES ($1,$2,$3,$4,'blocked',$5)")
        .bind(tenant)
        .bind(promo)
        .bind(code)
        .bind(user_id)
        .bind(reason)
        .execute(&st.pool)
        .await;
    if let Err(e) = r {
        tracing::warn!(error = %e, "could not log blocked promo attempt");
    }
}

/// Normalised code: trimmed, upper-case, 3–32 of A–Z 0–9 - _.
pub fn clean_code(code: &str) -> Option<String> {
    let c = code.trim().to_uppercase();
    (c.len() >= 3 && c.len() <= 32 && c.chars().all(|x| x.is_ascii_alphanumeric() || x == '-' || x == '_')).then_some(c)
}

pub async fn redeem(st: &AppState, tenant: &str, user_id: i64, raw: &str, login: Option<i64>, seg: &Segment) -> ApiResult<Value> {
    let Some(code) = clean_code(raw) else { return Err(crate::error::invalid("code", "Enter a valid promo code.")) };
    // a burst of wrong codes from one client is refused before touching the codes table
    let recent: i64 = sqlx::query_scalar("SELECT count(*) FROM promo_redemptions WHERE tenant = $1 AND user_id = $2 AND status = 'blocked' AND created_at > now() - interval '10 minutes'")
        .bind(tenant)
        .bind(user_id)
        .fetch_one(&st.pool)
        .await?;
    if recent >= 10 {
        return Err(ApiError::Conflict { code: "limit_reached", message: "Too many attempts. Please try again in a few minutes.".into() });
    }
    let Some(p) = sqlx::query("SELECT p.*, c.kind AS campaign_kind, c.account_groups FROM promo_codes p LEFT JOIN bonus_campaigns c ON c.id = p.campaign_id WHERE p.tenant = $1 AND upper(p.code) = $2")
        .bind(tenant)
        .bind(&code)
        .fetch_optional(&st.pool)
        .await?
    else {
        log_blocked(st, tenant, None, &code, user_id, "unknown code").await;
        return Err(crate::error::invalid("code", "This code isn't valid."));
    };
    let pid: i64 = p.get("id");
    let kind: String = p.get("kind");
    // a fixed bonus needs the client's live account (engine check before the transaction)
    let account = match (kind.as_str(), p.get::<Option<String>, _>("campaign_kind").as_deref(), login) {
        ("bonus", Some("fixed"), None) => return Err(crate::error::invalid("login", "Choose the live account for the bonus.")),
        ("bonus", Some(_), Some(l)) => Some(bonus::check_account(st, tenant, user_id, l, &p.get::<Option<Vec<String>>, _>("account_groups").unwrap_or_default()).await?),
        _ => None,
    };

    let mut tx = st.pool.begin().await?;
    let p = sqlx::query("SELECT * FROM promo_codes WHERE id = $1 FOR UPDATE").bind(pid).fetch_one(&mut *tx).await?;
    let user_uses: i64 = sqlx::query_scalar("SELECT count(*) FROM promo_redemptions WHERE promo_id = $1 AND user_id = $2 AND status = 'applied'").bind(pid).bind(user_id).fetch_one(&mut *tx).await?;
    let limits = Limits {
        active: p.get("active"),
        starts_at: Some(p.get("starts_at")),
        ends_at: p.get("ends_at"),
        max_uses: p.get::<Option<i32>, _>("max_uses").map(i64::from),
        uses: p.get::<i32, _>("uses") as i64,
        per_user_limit: p.get::<i32, _>("per_user_limit") as i64,
        user_uses,
        new_users_days: p.get::<Option<i32>, _>("new_users_days").map(i64::from),
        countries: p.get("countries"),
        kyc_required: p.get("kyc_required"),
    };
    if let Err((c, msg)) = calc::check_limits(&limits, seg, Utc::now()) {
        drop(tx);
        log_blocked(st, tenant, Some(pid), &code, user_id, &msg).await;
        return Err(ApiError::Conflict { code: c, message: msg });
    }
    let rid: i64 = sqlx::query_scalar("INSERT INTO promo_redemptions (tenant, promo_id, code, user_id, status) VALUES ($1,$2,$3,$4,'applied') RETURNING id")
        .bind(tenant)
        .bind(pid)
        .bind(&code)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;
    let result = match kind.as_str() {
        "bonus" => {
            let cid: i64 = p.get::<Option<i64>, _>("campaign_id").ok_or(ApiError::Conflict { code: "not_eligible", message: "This code has no bonus attached.".into() })?;
            let opts = ClaimOpts { source: "promo", require_public: false, amount_override: None, note: Some(format!("promo:{code}")), skip_limits: false };
            match bonus::claim_in(&mut tx, tenant, user_id, cid, account.as_ref(), seg, &opts).await {
                Ok(gid) => json!({"kind": "bonus", "grantId": gid}),
                Err(e) => {
                    drop(tx);
                    let msg = match &e {
                        ApiError::Conflict { message, .. } => message.clone(),
                        ApiError::Validation { message, .. } => message.clone(),
                        _ => "bonus claim failed".into(),
                    };
                    log_blocked(st, tenant, Some(pid), &code, user_id, &msg).await;
                    return Err(e);
                }
            }
        }
        "points" => {
            let pts: i64 = p.get::<Option<i64>, _>("points").unwrap_or(0);
            loyalty::lock_user(&mut tx, tenant, user_id).await?;
            sqlx::query("INSERT INTO points_ledger (tenant, user_id, kind, points, ref, description) VALUES ($1,$2,'promo',$3,$4,$5)")
                .bind(tenant)
                .bind(user_id)
                .bind(pts)
                .bind(format!("promo:{rid}"))
                .bind(format!("Promo code {code}"))
                .execute(&mut *tx)
                .await?;
            json!({"kind": "points", "points": pts})
        }
        _ => {
            let vcode = loyalty::voucher_code();
            sqlx::query("INSERT INTO vouchers (tenant, user_id, code, pct, applies_to, source, expires_at) VALUES ($1,$2,$3,$4,$5,'promo', COALESCE($6, now() + interval '90 days'))")
                .bind(tenant)
                .bind(user_id)
                .bind(&vcode)
                .bind(p.get::<Option<crate::money::D>, _>("discount_pct").unwrap_or_default())
                .bind(p.get::<String, _>("discount_applies_to"))
                .bind(p.get::<Option<DateTime<Utc>>, _>("ends_at"))
                .execute(&mut *tx)
                .await?;
            json!({"kind": "discount", "voucherCode": vcode})
        }
    };
    sqlx::query("UPDATE promo_codes SET uses = uses + 1, updated_at = now() WHERE id = $1").bind(pid).execute(&mut *tx).await?;
    sqlx::query("UPDATE promo_redemptions SET result = $2 WHERE id = $1").bind(rid).bind(sqlx::types::Json(&result)).execute(&mut *tx).await?;
    tx.commit().await?;
    st.wake.notify_one();

    // response in the client shape
    let mut out = json!({"kind": kind});
    match kind.as_str() {
        "bonus" => {
            let gid = result["grantId"].as_i64().unwrap_or(0);
            let g = bonus::grant_by_id(st, gid).await?;
            out["message"] = json!(if g["status"] == "awaiting_deposit" {
                format!("{} unlocked. Your bonus is credited on your next qualifying deposit.", g["campaign"].as_str().unwrap_or("Bonus"))
            } else {
                format!("{} bonus is being credited to account {}.", g["amount"], g["login"])
            });
            out["grant"] = g;
        }
        "points" => {
            out["points"] = result["points"].clone();
            out["message"] = json!(format!("{} points added to your balance.", result["points"]));
        }
        _ => {
            let v = sqlx::query("SELECT * FROM vouchers WHERE code = $1").bind(result["voucherCode"].as_str().unwrap_or("")).fetch_one(&st.pool).await?;
            out["message"] = json!(format!("Voucher {} for {}% off is ready.", v.get::<String, _>("code"), num(v.get("pct"))));
            out["voucher"] = loyalty::voucher_json(&v);
        }
    }
    Ok(json!({"result": out}))
}
