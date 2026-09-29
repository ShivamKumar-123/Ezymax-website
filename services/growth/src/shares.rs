//! Share P&L cards (D136): a snapshot of one closed trade or a period on one account, with the client's
//! referral code. Money amounts are stored only when the client opts in; otherwise the card shows % figures.

use crate::clients;
use crate::db;
use crate::error::{ApiError, ApiResult};
use crate::model::display_name;
use crate::money::{D, HUNDRED, ZERO, num, r2, r4, value_dec};
use crate::profiles::Profile;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareReq {
    pub kind: String,
    pub login: i64,
    pub deal_id: Option<i64>,
    pub from: Option<String>,
    pub to: Option<String>,
    #[serde(default)]
    pub show_amounts: bool,
}

pub fn share_json(r: &sqlx::postgres::PgRow, public: bool) -> Value {
    let code: String = r.get("code");
    json!({
        "code": code,
        "kind": r.get::<String, _>("kind"),
        "login": if public { Value::Null } else { json!(r.get::<i64, _>("login")) },
        "showAmounts": r.get::<bool, _>("show_amounts"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "views": r.get::<i64, _>("views"),
        "url": format!("/s/{code}"),
        "data": r.get::<sqlx::types::Json<Value>, _>("data").0,
    })
}

fn f(v: &Value, k: &str) -> D {
    value_dec(&v[k]).unwrap_or(ZERO)
}

/// Net result of a closing deal: price P&L + swap − commission.
fn net(d: &Value) -> D {
    f(d, "profit") + f(d, "swap") - f(d, "commission").abs()
}

pub async fn create(st: &AppState, tenant: &str, user_id: i64, req: &ShareReq, profile: &Profile) -> ApiResult<Value> {
    let acc = clients::account(st, tenant, req.login).await.map_err(|e| ApiError::Unavailable(e.to_string()))?.ok_or(ApiError::NotFound)?;
    if acc.user_id != user_id {
        return Err(ApiError::NotFound);
    }
    let usd = |v: D| if acc.cent { v / HUNDRED } else { v };
    let name = display_name(&profile.first_name, &profile.last_name);
    let referral = (!profile.referral_code.is_empty()).then(|| profile.referral_code.clone());
    let base = json!({"name": name, "referralCode": referral, "brand": "Kalks", "currency": "USD", "accountType": acc.kind});
    let (data, deal_id) = match req.kind.as_str() {
        "trade" => {
            let deal_id = req.deal_id.ok_or_else(|| crate::error::invalid("dealId", "Choose a closed trade."))?;
            let deals = clients::history(st, tenant, req.login, user_id, None, None).await.map_err(|e| ApiError::Unavailable(e.to_string()))?.ok_or(ApiError::NotFound)?;
            let d = deals.iter().find(|d| d["id"].as_i64() == Some(deal_id) || d["id"].as_str() == Some(&deal_id.to_string())).ok_or_else(|| crate::error::invalid("dealId", "Trade not found on this account."))?;
            if d["entry"].as_str() == Some("in") {
                return Err(crate::error::invalid("dealId", "Share a closing deal (the trade must be closed)."));
            }
            let open = f(d, "openPrice");
            let close = f(d, "price");
            let side = d["positionSide"].as_str().or(d["side"].as_str()).unwrap_or("buy").to_lowercase();
            let mv = if open > ZERO { r2((close - open) / open * HUNDRED * if side == "sell" { -D::ONE } else { D::ONE }) } else { ZERO };
            let mut v = base.clone();
            v["symbol"] = d["symbol"].clone();
            v["side"] = json!(side);
            v["openPrice"] = d["openPrice"].clone();
            v["closePrice"] = d["price"].clone();
            v["openTime"] = d["openTime"].clone();
            v["closeTime"] = d["time"].clone();
            v["movePct"] = num(mv);
            v["lots"] = num(r4(if acc.cent { f(d, "volume") / HUNDRED } else { f(d, "volume") }));
            v["profit"] = if req.show_amounts { num(r2(usd(net(d)))) } else { Value::Null };
            v["win"] = json!(net(d) > ZERO);
            (v, Some(deal_id))
        }
        "period" => {
            let from = crate::api::parse_time(&req.from)?.ok_or_else(|| crate::error::invalid("from", "Choose the start date."))?;
            let to = crate::api::parse_time(&req.to)?.unwrap_or_else(Utc::now);
            if to <= from {
                return Err(crate::error::invalid("to", "The end must be after the start."));
            }
            let deals = clients::history(st, tenant, req.login, user_id, Some(from), Some(to)).await.map_err(|e| ApiError::Unavailable(e.to_string()))?.ok_or(ApiError::NotFound)?;
            let closes: Vec<&Value> = deals.iter().filter(|d| d["entry"].as_str() != Some("in")).collect();
            if closes.is_empty() {
                return Err(crate::error::invalid("from", "No closed trades in that period."));
            }
            let total: D = closes.iter().map(|d| net(d)).sum();
            let wins = closes.iter().filter(|d| net(d) > ZERO).count();
            let lots: D = closes.iter().map(|d| f(d, "volume")).sum();
            let start_balance = acc.balance - total;
            let ret = (start_balance > ZERO).then(|| r2(total / start_balance * HUNDRED));
            let mut v = base.clone();
            v["from"] = json!(from);
            // `to` is exclusive (next midnight for a date): show the last included instant
            v["to"] = json!(to - chrono::Duration::seconds(1));
            v["trades"] = json!(closes.len());
            v["winRate"] = num(r2(D::from(wins as i64) / D::from(closes.len() as i64) * HUNDRED));
            v["lots"] = num(r4(if acc.cent { lots / HUNDRED } else { lots }));
            v["returnPct"] = ret.map(num).unwrap_or(Value::Null);
            v["profit"] = if req.show_amounts { num(r2(usd(total))) } else { Value::Null };
            v["win"] = json!(total > ZERO);
            (v, None)
        }
        _ => return Err(crate::error::invalid("kind", "kind must be trade or period.")),
    };
    let mut code = db::random_code(10);
    for _ in 0..3 {
        let taken: Option<i32> = sqlx::query_scalar("SELECT 1 FROM shares WHERE code = $1").bind(&code).fetch_optional(&st.pool).await?;
        if taken.is_none() {
            break;
        }
        code = db::random_code(10);
    }
    let r = sqlx::query("INSERT INTO shares (code, tenant, user_id, kind, login, deal_id, show_amounts, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *")
        .bind(&code)
        .bind(tenant)
        .bind(user_id)
        .bind(&req.kind)
        .bind(req.login)
        .bind(deal_id)
        .bind(req.show_amounts)
        .bind(sqlx::types::Json(&data))
        .fetch_one(&st.pool)
        .await?;
    Ok(json!({"share": share_json(&r, false)}))
}
