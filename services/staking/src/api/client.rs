//! Client Area routes (`/v1/staking/me/*`). Rates are only ever shown for months already settled: a plan never
//! shows a rate for the current or a future month.

use super::{UserCtx, paging};
use crate::error::{ApiError, ApiResult};
use crate::money::{D, ZERO, de_opt_dec, num, opt_num};
use crate::period::Period;
use crate::positions::{self, Subscribe};
use crate::state::AppState;
use crate::{plans, rates};
use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;

/// `GET /v1/staking/me/plans`: plans on sale (active) or paused, with the client's own open principal.
pub async fn plans(State(st): State<AppState>, u: UserCtx) -> ApiResult<Json<Value>> {
    let list = plans::list(&st, &u.tenant).await?;
    let stats = plans::stats(&st, &u.tenant).await?;
    let history = rates::settled_history(&st, &u.tenant, 6).await?;
    let mine: Vec<(i64, D)> = sqlx::query_as("SELECT plan_id, COALESCE(sum(principal), 0) FROM positions WHERE tenant = $1 AND user_id = $2 AND status IN ('pending_payment', 'active') GROUP BY plan_id")
        .bind(&u.tenant)
        .bind(u.user_id)
        .fetch_all(&st.pool)
        .await?;
    let mine: HashMap<i64, D> = mine.into_iter().collect();
    let now = Utc::now();
    let items: Vec<Value> = list
        .iter()
        .filter(|p| matches!(p.status.as_str(), "active" | "paused"))
        .map(|p| {
            let s = stats.get(&p.id).copied().unwrap_or_default();
            let left = p.capacity.map(|c| (c - s.active_principal - s.pending_principal).max(ZERO));
            let invested = mine.get(&p.id).copied().unwrap_or(ZERO);
            let room = p.per_user_max.map(|m| (m - invested).max(ZERO));
            // the most this client can still put in (per subscription, per client and plan capacity)
            let max_now = [p.max_amount, left, room].into_iter().flatten().min();
            json!({
                "id": p.id, "name": p.name, "currency": p.currency, "status": p.status, "termMonths": p.term_months,
                "minAmount": num(p.min_amount), "maxAmount": opt_num(p.max_amount), "perUserMax": opt_num(p.per_user_max),
                "capacityLeft": opt_num(left), "full": left.is_some_and(|l| l < p.min_amount),
                "invested": num(invested), "maxNow": opt_num(max_now),
                "description": p.description, "riskText": p.risk_text, "version": p.version,
                "recentRates": history.get(&p.id).map(|v| v.iter().map(|(period, rate)| json!({"period": period, "ratePct": num(*rate)})).collect::<Vec<_>>()).unwrap_or_default(),
            })
        })
        .collect();
    let current = Period::of(now);
    Ok(Json(json!({"plans": items, "currencies": st.cfg.currencies, "currentPeriod": current.to_string(), "nextPayoutAfter": current.end(), "serverTime": now})))
}

pub async fn portfolio(State(st): State<AppState>, u: UserCtx) -> ApiResult<Json<Value>> {
    Ok(Json(positions::portfolio(&st, &u.tenant, u.user_id).await?))
}

#[derive(Deserialize)]
pub struct PageQ {
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn history(State(st): State<AppState>, u: UserCtx, Query(q): Query<PageQ>) -> ApiResult<Json<Value>> {
    let (page, limit, offset) = paging(q.page, q.limit, 25, 100);
    let mut v = positions::history(&st, &u.tenant, u.user_id, offset, limit).await?;
    v["page"] = json!(page);
    v["limit"] = json!(limit);
    Ok(Json(v))
}

pub async fn positions(State(st): State<AppState>, u: UserCtx) -> ApiResult<Json<Value>> {
    let list = positions::of_user(&st, &u.tenant, u.user_id).await?;
    let ids: Vec<i64> = list.iter().map(|p| p.id).collect();
    let last = positions::last_returns(&st, &ids).await?;
    let now = Utc::now();
    Ok(Json(json!({"items": list.iter().map(|p| positions::json(p, last.get(&p.id).cloned(), now)).collect::<Vec<_>>()})))
}

pub async fn position(State(st): State<AppState>, u: UserCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let p = positions::get(&st, id).await?.filter(|p| p.tenant == u.tenant && p.user_id == u.user_id).ok_or(ApiError::NotFound)?;
    Ok(Json(positions::detail(&st, &p).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeBody {
    plan_id: i64,
    #[serde(default, deserialize_with = "de_opt_dec")]
    amount: Option<D>,
    idempotency_key: String,
    #[serde(default)]
    accept_terms: bool,
    #[serde(default)]
    accept_risk: bool,
}

/// `POST /v1/staking/me/positions` `{planId, amount, idempotencyKey, acceptTerms, acceptRisk}`.
pub async fn subscribe(State(st): State<AppState>, u: UserCtx, body: Result<Json<SubscribeBody>, axum::extract::rejection::JsonRejection>) -> ApiResult<Json<Value>> {
    let Json(b) = body.map_err(|e| ApiError::BadRequest(e.body_text()))?;
    let p = positions::subscribe(&st, &u.tenant, u.user_id, &u.name, Subscribe { plan_id: b.plan_id, amount: b.amount, key: b.idempotency_key, accept_terms: b.accept_terms, accept_risk: b.accept_risk }).await?;
    Ok(Json(positions::detail(&st, &p).await?))
}
