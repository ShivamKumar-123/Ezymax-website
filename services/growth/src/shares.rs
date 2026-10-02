//! Share P&L cards (D136): a snapshot of one closed trade or a period on one account, with the client's
//! referral code. Money amounts are stored only when the client opts in; otherwise the card shows % figures.
//!
//! Options share card (O36): a closed Kalks FX Options trade (a close, an expiry settlement or a knock-out) also
//! carries `option` = the underlying, strike, call / put, expiry, the entry → exit premium in USD per contract, the
//! P&L % on the premium, why it closed, and the breakeven / settlement the card's payoff sketch is drawn from. The
//! account balance is never part of a card.

use crate::calc;
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

/// Why an option exit closed, as the card shows it (engine deal reason).
pub fn option_close_reason(reason: &str) -> &'static str {
    match reason {
        "expiry" => "expired",
        "knock_out" => "knocked_out",
        "stop_out" | "force" => "stop_out",
        "sl" => "sl",
        "tp" => "tp",
        _ => "closed",
    }
}

/// The `option` block of an options share card from an exit deal of the client history (engine `deal_json`):
/// `profit` = price P&L (exit cash + the premium booked at open), `option.cash` = cash booked by the exit, both in
/// the account currency (`usd` converts). Premiums are USD per contract; `pnlPct` is the premium P&L over the
/// opening premium (gross, before commission). Terms fall back to the series code (`EURUSD-20261009-1.1650-C`).
pub fn option_card(d: &Value, usd: impl Fn(D) -> D) -> Value {
    let o = &d["option"];
    let symbol = d["symbol"].as_str().unwrap_or("");
    let parts: Vec<&str> = symbol.split('-').collect();
    let series = o["series"].as_str().filter(|s| !s.is_empty()).unwrap_or(symbol);
    let underlying = o["underlying"].as_str().filter(|s| !s.is_empty()).map(str::to_string).or_else(|| (parts.len() == 4).then(|| parts[0].to_uppercase())).unwrap_or_default();
    let right = match o["right"].as_str().map(str::to_ascii_lowercase).as_deref() {
        Some("call" | "c") => "call",
        Some("put" | "p") => "put",
        _ if parts.len() == 4 && parts[3].eq_ignore_ascii_case("p") => "put",
        _ => "call",
    };
    let strike = value_dec(&o["strike"]).or_else(|| (parts.len() == 4).then(|| parts[2].parse::<D>().ok()).flatten());
    let expiry = o["expiry"].as_str().map(|e| e.chars().take(10).collect::<String>()).filter(|e| e.len() == 10).or_else(|| {
        (parts.len() == 4 && parts[1].len() == 8).then(|| format!("{}-{}-{}", &parts[1][..4], &parts[1][4..6], &parts[1][6..]))
    });
    let contracts = f(d, "volume").abs();
    let side = d["positionSide"].as_str().or(d["side"].as_str()).unwrap_or("buy").to_lowercase();
    let price_profit = usd(f(d, "profit"));
    let cash = value_dec(&o["cash"]).map(&usd);
    let open_premium = cash.map(|c| calc::option_premium(price_profit, c));
    let per = |v: D| if contracts > ZERO { num(r2(v / contracts)) } else { Value::Null };
    let pnl_pct = open_premium.filter(|p| *p > ZERO).map(|p| r2(price_profit / p * HUNDRED));
    // premium per unit of the underlying at open: the breakeven at expiry is strike ± it
    let open_unit = value_dec(&d["openPrice"]).filter(|p| *p >= ZERO);
    let breakeven = strike.zip(open_unit).map(|(k, p)| if right == "call" { k + p } else { k - p });
    let settle = value_dec(&o["fixing"]).or_else(|| value_dec(&o["spot"]));
    json!({
        "series": series,
        "underlying": underlying,
        "right": right,
        "strike": strike.map(num),
        "expiry": expiry,
        "style": o["style"].as_str().unwrap_or("vanilla"),
        "side": side,
        "contracts": num(r4(contracts)),
        "entryPremium": open_premium.map(per).unwrap_or(Value::Null),
        "exitPremium": cash.map(|c| per(c.abs())).unwrap_or(Value::Null),
        "pnlPct": pnl_pct.map(num),
        "reason": option_close_reason(d["reason"].as_str().unwrap_or("")),
        "openPremiumUnit": open_unit.map(num),
        "closePremiumUnit": value_dec(&d["price"]).map(num),
        "breakeven": breakeven.map(num),
        "settle": settle.map(num),
    })
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
            if crate::calc::is_option_deal(d) {
                // an option trade: volume is contracts (never lots), prices are premiums per unit
                let card = option_card(d, usd);
                v["instrument"] = json!("option");
                v["contracts"] = card["contracts"].clone();
                v["lots"] = Value::Null;
                // the headline % of an option card is the P&L on the premium, not the premium's price move
                if !card["pnlPct"].is_null() {
                    v["movePct"] = card["pnlPct"].clone();
                }
                v["option"] = card;
            } else {
                v["lots"] = num(r4(if acc.cent { f(d, "volume") / HUNDRED } else { f(d, "volume") }));
            }
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
            // option contracts are not lots
            let lots: D = closes.iter().filter(|d| !crate::calc::is_option_deal(d)).map(|d| f(d, "volume")).sum();
            let contracts: D = closes.iter().filter(|d| crate::calc::is_option_deal(d)).map(|d| f(d, "volume")).sum();
            let start_balance = acc.balance - total;
            let ret = (start_balance > ZERO).then(|| r2(total / start_balance * HUNDRED));
            let mut v = base.clone();
            v["from"] = json!(from);
            // `to` is exclusive (next midnight for a date): show the last included instant
            v["to"] = json!(to - chrono::Duration::seconds(1));
            v["trades"] = json!(closes.len());
            v["winRate"] = num(r2(D::from(wins as i64) / D::from(closes.len() as i64) * HUNDRED));
            v["lots"] = num(r4(if acc.cent { lots / HUNDRED } else { lots }));
            if contracts > ZERO {
                v["optionContracts"] = num(r4(contracts));
            }
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
