//! Options order book in the Back Office (docs/OPTIONS-EXCHANGE.md §11, §12 "Admin"; staff headers). Permissions
//! follow the options keys: `options.read` to look, `options.dealing` for kill switches, the MM pause and the depth
//! WITH OWNERS (an audited view), `options.settle` for the four-eyes actions (bust a fill, enable the book).
//!
//! * `GET  /v1/admin/options/books?kind=` — monitor per underlying; `GET …/books/{series}?kind=` — depth with owners.
//! * `POST /v1/admin/options/books/halt {kind, scope, target, mode, reason}`, `DELETE …/books/halt/{id}`.
//! * `GET  /v1/admin/options/mm?kind=`, `POST …/mm/pause|resume {kind, scope, target, reason}`.
//! * `GET  /v1/admin/options/liquidations?kind&from&to&login&limit`, `GET …/clearing?kind&expiry&u`.
//! * `GET  /v1/admin/options/rfqs?kind=` — combo RFQs (open and recent) with the market maker's quotes.
//! * `POST /v1/admin/options/fills/{fillId}/bust {reason, approvalId?}` (four-eyes; keys `bust:{fillId}:{login}:*`).
//! * `GET  /v1/admin/options/approvals?status=&kind=`.
//! * `GET  /v1/admin/options/book/enable/plan?kind=`, `POST …/book/enable {kind, reason, approvalId?}` (four-eyes).

use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::BTreeMap;

use super::{ApiError, ApiResult, AppState, Body, ROLES_CONFIG, ROLES_DEALING, StaffCtx};
use crate::book::types::*;
use crate::book::{BookKey, entry};
use crate::model::AccountKind;
use crate::money::{D, ZERO, num, num_opt};

const ROLES_SETTLE: &[&str] = &["platform_owner", "super_admin", "admin", "options_risk"];

fn validation(field: &'static str, message: impl Into<String>) -> ApiError {
    ApiError::Validation { field, message: message.into() }
}

fn kind_of(k: Option<&str>) -> ApiResult<AccountKind> {
    match k.unwrap_or("live") {
        "live" => Ok(AccountKind::Live),
        "demo" => Ok(AccountKind::Demo),
        _ => Err(validation("kind", "kind must be live or demo")),
    }
}

#[derive(Deserialize, Default)]
pub struct KindQ {
    pub kind: Option<String>,
}

/* ------------------------------------------------------------------ */
/* Monitor                                                             */
/* ------------------------------------------------------------------ */

/// `GET /v1/admin/options/books?kind=live|demo`
pub async fn books(State(st): State<AppState>, s: StaffCtx, Query(q): Query<KindQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = kind_of(q.kind.as_deref())?;
    let hub = &st.hub;
    let books = &hub.shared.books;
    let enabled_at: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT enabled_at FROM option_book_venues WHERE tenant_id = $1 AND kind = $2").bind(tenant).bind(kind.as_str()).fetch_optional(&st.pool).await?;
    let outbox = sqlx::query("SELECT underlying, count(*) FILTER (WHERE status = 'pending') AS pending, count(*) FILTER (WHERE status = 'failed') AS failed, min(created_at) AS oldest FROM book_outbox WHERE tenant_id = $1 AND kind = $2 AND status <> 'applied' GROUP BY 1")
        .bind(tenant)
        .bind(kind.as_str())
        .fetch_all(&st.pool)
        .await?;
    let now = Utc::now();
    let mut ob: BTreeMap<String, Value> = BTreeMap::new();
    for r in outbox {
        let oldest: Option<DateTime<Utc>> = r.get("oldest");
        ob.insert(r.get("underlying"), json!({"pending": r.get::<i64, _>("pending"), "failed": r.get::<i64, _>("failed"), "oldestMs": oldest.map(|t| (now - t).num_milliseconds())}));
    }
    let clearing = sqlx::query(
        "SELECT split_part(p.account_code, '.', 2) AS u, sum(p.amount) AS bal FROM ledger_postings p JOIN ledger_txns t ON t.id = p.txn_id JOIN accounts a ON a.login = t.login
          WHERE p.tenant_id = $1 AND p.account_code LIKE 'house:options_clearing.%' AND a.kind = $2 GROUP BY 1",
    )
    .bind(tenant)
    .bind(kind.as_str())
    .fetch_all(&st.pool)
    .await?;
    let clr: BTreeMap<String, D> = clearing.iter().map(|r| (r.get::<String, _>("u"), r.get::<Option<D>, _>("bal").unwrap_or(ZERO))).collect();
    let trades = sqlx::query("SELECT underlying, max(at) AS last, sum(premium_usd) FILTER (WHERE at > now() - interval '1 day') AS usd FROM book_fills WHERE tenant_id = $1 AND kind = $2 AND busted_at IS NULL GROUP BY 1")
        .bind(tenant)
        .bind(kind.as_str())
        .fetch_all(&st.pool)
        .await?;
    let tr: BTreeMap<String, (Option<DateTime<Utc>>, Option<D>)> = trades.iter().map(|r| (r.get::<String, _>("underlying"), (r.get("last"), r.get("usd")))).collect();
    let mm_login = books.mm.login(tenant, kind);
    let mm = books.mm.run(tenant, kind);
    let mut rows = Vec::new();
    for h in books.handles().into_iter().filter(|h| h.key.tenant_id == tenant && h.key.kind == kind) {
        let v = h
            .read(Box::new(move |b| {
                let mut states: BTreeMap<&str, usize> = BTreeMap::new();
                let (mut resting, mut contracts, mut client, mut spread_sum, mut spread_n, mut oi, mut vol) = (0usize, ZERO, 0usize, 0i64, 0i64, ZERO, ZERO);
                let mut series_total = 0usize;
                for sb in b.series.values() {
                    *states.entry(sb.state.as_str()).or_default() += 1;
                    if sb.state != SeriesState::Closed {
                        series_total += 1;
                    }
                    for o in sb.orders.values() {
                        resting += 1;
                        contracts += sb.spec.contracts(o.left);
                        if o.flags & EPHEMERAL == 0 {
                            client += 1;
                        }
                    }
                    if let (Some(bb), Some(aa)) = (sb.best_bid(), sb.best_ask()) {
                        spread_sum += aa - bb;
                        spread_n += 1;
                    }
                    oi += sb.spec.contracts(sb.oi());
                    vol += sb.spec.contracts(sb.vol_day.1);
                }
                json!({"seq": b.seq, "states": states, "resting": resting, "contracts": contracts.to_string(), "client": client, "spread": if spread_n > 0 { Some(spread_sum as f64 / spread_n as f64) } else { None }, "oi": oi.to_string(), "vol": vol.to_string(), "series": series_total, "rfqs": b.rfqs.len()})
            }))
            .await
            .unwrap_or(Value::Null);
        let u = h.key.underlying.clone();
        let st_counts = v["states"].as_object().cloned().unwrap_or_default();
        let n = |k: &str| st_counts.get(k).and_then(Value::as_u64).unwrap_or(0);
        let state = if n("open") > 0 { "open" } else if n("cancel_only") > 0 { "cancel_only" } else if n("closed") > 0 { "closed" } else { "open" };
        let mu = mm.under.get(&u);
        let d = |k: &str| v[k].as_str().and_then(|x| x.parse::<D>().ok()).unwrap_or(ZERO);
        let (last, usd) = tr.get(&u).cloned().unwrap_or((None, None));
        rows.push(json!({
            "underlying": u, "state": state, "seq": v["seq"], "restingOrders": v["resting"], "restingContracts": num(d("contracts")), "clientOrders": v["client"],
            "mmCoveragePct": mu.map(|m| if m.series_total > 0 { 100.0 * m.series_quoted as f64 / m.series_total as f64 } else { 0.0 }).unwrap_or(0.0),
            "seriesQuoted": mu.map(|m| m.series_quoted).unwrap_or(0), "seriesTotal": mu.map(|m| m.series_total).unwrap_or(v["series"].as_u64().unwrap_or(0) as usize),
            "avgSpreadTicks": v["spread"], "oi": num(d("oi")), "volume": num(d("vol")), "volumeUsd": num_opt(usd),
            "outbox": ob.get(&h.key.underlying).cloned().unwrap_or(json!({"pending": 0, "failed": 0, "oldestMs": null})),
            "clearingUsd": num(clr.get(&h.key.underlying).copied().unwrap_or(ZERO)), "lastTradeAt": last, "openRfqQuotes": v["rfqs"],
        }));
    }
    let halts = sqlx::query("SELECT id, underlying, scope, target, mode, reason, staff, created_at FROM book_halts WHERE tenant_id = $1 AND kind = $2 AND lifted_at IS NULL ORDER BY id DESC")
        .bind(tenant)
        .bind(kind.as_str())
        .fetch_all(&st.pool)
        .await?;
    let halts: Vec<Value> = halts
        .iter()
        .map(|r| json!({"id": r.get::<i64, _>("id"), "scope": r.get::<String, _>("scope"), "target": r.get::<String, _>("target"), "mode": r.get::<String, _>("mode"), "reason": r.get::<String, _>("reason"), "by": r.get::<String, _>("staff"), "at": r.get::<DateTime<Utc>, _>("created_at"), "kind": kind.as_str()}))
        .collect();
    let audit = books.last_audit.lock().unwrap().clone();
    Ok(Json(json!({
        "kind": kind.as_str(), "enabled": books.venue_enabled(tenant, kind), "enabledAt": enabled_at,
        "replay": audit.map(|(at, bad)| json!({"ok": bad == 0, "at": at, "mismatches": bad})),
        "books": rows, "halts": halts, "mmLogin": mm_login,
    })))
}

/// `GET /v1/admin/options/books/{series}?kind=` — depth WITH OWNERS and the recent fills (the view is audited).
pub async fn depth(State(st): State<AppState>, s: StaffCtx, Path(series): Path<String>, Query(q): Query<KindQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.dealing", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = kind_of(q.kind.as_deref())?;
    let hub = &st.hub;
    let underlying = series.split('-').next().unwrap_or("").to_string();
    let key = BookKey::new(tenant, kind, &underlying);
    let s2 = series.clone();
    let v = match hub.shared.books.handle(&key) {
        Some(h) => h
            .read(Box::new(move |b| {
                let Some(sb) = b.book(&s2) else { return json!({"seq": b.seq, "state": "none"}) };
                let level = |ids: &std::collections::VecDeque<i64>| -> Vec<Value> {
                    ids.iter()
                        .filter_map(|id| sb.orders.get(id))
                        .map(|o| json!({"id": o.id, "login": o.login, "userId": o.stp, "qty": sb.spec.contracts(o.qty).to_string(), "left": sb.spec.contracts(o.left).to_string(), "at": DateTime::from_timestamp_millis(o.ext.created_ms), "flags": flag_names(o.flags), "prio": o.prio}))
                        .collect()
                };
                let bids: Vec<Value> = sb.bids.iter().take(20).map(|(p, ids)| json!({"price": sb.spec.price(p.0).to_string(), "orders": level(ids)})).collect();
                let asks: Vec<Value> = sb.asks.iter().take(20).map(|(p, ids)| json!({"price": sb.spec.price(*p).to_string(), "orders": level(ids)})).collect();
                json!({"seq": b.seq, "state": sb.state.as_str(), "tick": sb.spec.tick.to_string(), "size": sb.spec.terms.contract_size.to_string(), "bids": bids, "asks": asks})
            }))
            .await
            .unwrap_or(Value::Null),
        None => json!({"seq": 0, "state": "none"}),
    };
    let mm_login = hub.shared.books.mm.login(tenant, kind);
    let fix = |side: &Value| -> Value {
        json!(side.as_array().cloned().unwrap_or_default().iter().map(|l| {
            let orders: Vec<Value> = l["orders"].as_array().cloned().unwrap_or_default().into_iter().map(|mut o| {
                let mm = o["login"].as_i64() == mm_login;
                for k in ["qty", "left"] { o[k] = json!(o[k].as_str().and_then(|x| x.parse::<f64>().ok()).unwrap_or(0.0)); }
                o["mm"] = json!(mm);
                o
            }).collect();
            let qty: f64 = orders.iter().filter_map(|o| o["left"].as_f64()).sum();
            json!({"price": l["price"].as_str().and_then(|x| x.parse::<f64>().ok()), "qty": qty, "orders": orders})
        }).collect::<Vec<_>>())
    };
    let trades = sqlx::query("SELECT fill_id, price, contracts, aggressor, fill_kind, at, maker_login, taker_login, busted_at FROM book_fills WHERE tenant_id = $1 AND kind = $2 AND series = $3 ORDER BY at DESC, seq DESC LIMIT 100")
        .bind(tenant)
        .bind(kind.as_str())
        .bind(&series)
        .fetch_all(&st.pool)
        .await?;
    let trades: Vec<Value> = trades
        .iter()
        .map(|r| {
            let (m, t): (i64, i64) = (r.get("maker_login"), r.get("taker_login"));
            json!({
                "fillId": r.get::<String, _>("fill_id"), "price": num(r.get::<D, _>("price")), "qty": num(r.get::<D, _>("contracts")), "takerSide": r.get::<String, _>("aggressor"),
                "kind": r.get::<String, _>("fill_kind"), "at": r.get::<DateTime<Utc>, _>("at"), "maker": {"login": m, "mm": Some(m) == mm_login}, "taker": {"login": t, "mm": Some(t) == mm_login},
                "busted": r.get::<Option<DateTime<Utc>>, _>("busted_at").is_some(), "series": series,
            })
        })
        .collect();
    let slug = s.ctx.tenant.slug.clone();
    let now = hub.shared.clock.now();
    let mark = crate::engine::options_book::series_mark(hub, &slug, kind, &series, now);
    let theo = crate::options::OptionPricing::snapshot(hub.shared.options.as_ref())
        .and_then(|sn| crate::engine::options_book::terms_of(&sn, &series).ok())
        .and_then(|(t, _)| crate::options::OptionPricing::mark(hub.shared.options.as_ref(), &slug, "*", &t, now).map(|q| (q.mark, q.usd_per_quote * t.contract_size)));
    let audit = st.social.audit(tenant, &s.staff, "options.book_depth_view", None, &series, None, Some(json!({"kind": kind.as_str(), "seq": v["seq"]})), "viewed the depth with owners").await;
    Ok(Json(json!({
        "series": series, "kind": kind.as_str(), "seq": v["seq"], "state": v["state"], "mark": num_opt(mark), "theo": num_opt(theo.map(|t| t.0)),
        "premiumTick": v["tick"].as_str().and_then(|x| x.parse::<f64>().ok()), "usdPerUnit": num_opt(theo.map(|t| t.1)),
        "bids": fix(&v["bids"]), "asks": fix(&v["asks"]), "trades": trades, "audited": !audit.is_null(),
    })))
}

/* ------------------------------------------------------------------ */
/* Halts                                                               */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HaltBody {
    pub kind: String,
    pub scope: String,
    #[serde(default)]
    pub target: Option<String>,
    pub mode: String,
    pub reason: String,
}

/// Book keys and the command scope of a halt target (`*`, `EURUSD`, `EURUSD:2026-10-09`, a series code).
async fn halt_targets(st: &AppState, tenant: i64, kind: AccountKind, scope: &str, target: &str) -> ApiResult<Vec<(BookKey, HaltScope)>> {
    let hub = &st.hub;
    let unders: Vec<String> = match crate::options::OptionPricing::snapshot(hub.shared.options.as_ref()) {
        Some(s) => s.underlyings.keys().cloned().collect(),
        None => vec![],
    };
    Ok(match scope {
        "all" => {
            let mut keys: Vec<String> = hub.shared.books.handles().into_iter().filter(|h| h.key.tenant_id == tenant && h.key.kind == kind).map(|h| h.key.underlying).collect();
            keys.extend(unders);
            keys.sort();
            keys.dedup();
            keys.into_iter().map(|u| (BookKey::new(tenant, kind, &u), HaltScope::All)).collect()
        }
        "underlying" => vec![(BookKey::new(tenant, kind, target), HaltScope::All)],
        "expiry" => {
            let (u, d) = target.split_once(':').ok_or_else(|| validation("target", "expiry target is SYMBOL:YYYY-MM-DD"))?;
            let date = chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").map_err(|_| validation("target", "expiry target is SYMBOL:YYYY-MM-DD"))?;
            vec![(BookKey::new(tenant, kind, u), HaltScope::Expiry(date))]
        }
        "series" => {
            let u = target.split('-').next().unwrap_or("");
            vec![(BookKey::new(tenant, kind, u), HaltScope::Series(target.to_string()))]
        }
        _ => return Err(validation("scope", "scope must be all, underlying, expiry or series")),
    })
}

/// `POST /v1/admin/options/books/halt {kind, scope, target, mode: halt|cancel_only, reason}` — halt cancels every
/// resting order in scope (reservations released) and accepts cancels only; cancel-only keeps resting orders.
pub async fn halt(State(st): State<AppState>, s: StaffCtx, Body(b): Body<HaltBody>) -> ApiResult<Json<Value>> {
    s.require_perm("options.dealing", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = kind_of(Some(&b.kind))?;
    if b.reason.trim().len() < 3 {
        return Err(validation("reason", "Add a reason for the audit log"));
    }
    let mode = match b.mode.as_str() {
        "halt" => HaltMode::Halt,
        "cancel_only" => HaltMode::CancelOnly,
        _ => return Err(validation("mode", "mode must be halt or cancel_only")),
    };
    let target = b.target.clone().unwrap_or_else(|| "*".into());
    let targets = halt_targets(&st, tenant, kind, &b.scope, &target).await?;
    let at = st.hub.shared.clock.now().timestamp_millis();
    let mut done = Vec::new();
    for (key, scope) in targets {
        let h = st.hub.shared.books.actor(&st.hub, &key).await.map_err(|e| ApiError::Status { status: 503, code: "book_unavailable", message: e.to_string() })?;
        match h.call(Cmd::Halt { scope, mode, reason: format!("halt: {}", b.reason.trim()), at }).await {
            Ok(r) => done.push(json!({"underlying": key.underlying, "seq": r.out.seq, "cancelled": r.out.done.len()})),
            Err(e) => return Err(ApiError::Status { status: 503, code: "book_unavailable", message: format!("{e:?}") }),
        }
    }
    let staff = format!("{} ({})", s.staff.name, s.staff.id);
    let id: i64 = sqlx::query_scalar("INSERT INTO book_halts (tenant_id, kind, underlying, scope, target, mode, reason, staff) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id")
        .bind(tenant)
        .bind(kind.as_str())
        .bind(if b.scope == "all" { None } else { Some(target.split([':', '-']).next().unwrap_or("").to_string()) })
        .bind(&b.scope)
        .bind(&target)
        .bind(&b.mode)
        .bind(b.reason.trim())
        .bind(&staff)
        .fetch_one(&st.pool)
        .await?;
    let audit = st.social.audit(tenant, &s.staff, "options.book_halt", None, &target, None, Some(json!({"kind": kind.as_str(), "scope": b.scope, "mode": b.mode, "books": done})), b.reason.trim()).await;
    Ok(Json(json!({"halt": {"id": id, "scope": b.scope, "target": target, "mode": b.mode, "reason": b.reason.trim(), "by": staff, "at": Utc::now(), "kind": kind.as_str()}, "books": done, "audit": audit})))
}

#[derive(Deserialize, Default)]
pub struct ReasonQ {
    pub reason: Option<String>,
}

/// `DELETE /v1/admin/options/books/halt/{id}?reason=` — lifts a halt / cancel-only (the books in scope reopen).
pub async fn unhalt(State(st): State<AppState>, s: StaffCtx, Path(id): Path<i64>, Query(q): Query<ReasonQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.dealing", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let reason = q.reason.unwrap_or_default();
    if reason.trim().len() < 3 {
        return Err(validation("reason", "Add a reason for the audit log"));
    }
    let r = sqlx::query("SELECT kind, scope, target FROM book_halts WHERE id = $1 AND tenant_id = $2 AND lifted_at IS NULL").bind(id).bind(tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::NotFound("Halt not found".into()))?;
    let kind = kind_of(Some(&r.get::<String, _>("kind")))?;
    let (scope, target): (String, String) = (r.get("scope"), r.get("target"));
    // a system halt (outbox failure, reconcile mismatch) is scoped to its underlying
    let scope = if scope == "underlying" && !target.contains(':') && !target.contains('-') { "underlying".to_string() } else { scope };
    let at = st.hub.shared.clock.now().timestamp_millis();
    for (key, sc) in halt_targets(&st, tenant, kind, &scope, &target).await? {
        if let Ok(h) = st.hub.shared.books.actor(&st.hub, &key).await {
            let _ = h.call(Cmd::Halt { scope: sc, mode: HaltMode::Resume, reason: format!("resume: {}", reason.trim()), at }).await;
        }
    }
    let staff = format!("{} ({})", s.staff.name, s.staff.id);
    sqlx::query("UPDATE book_halts SET lifted_at = now(), lifted_by = $2 WHERE id = $1").bind(id).bind(&staff).execute(&st.pool).await?;
    st.social.audit(tenant, &s.staff, "options.book_resume", None, &target, None, Some(json!({"kind": kind.as_str(), "scope": scope, "halt": id})), reason.trim()).await;
    Ok(Json(json!({"ok": true, "id": id})))
}

/* ------------------------------------------------------------------ */
/* Market maker                                                        */
/* ------------------------------------------------------------------ */

/// `GET /v1/admin/options/mm?kind=`
pub async fn mm(State(st): State<AppState>, s: StaffCtx, Query(q): Query<KindQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING)?;
    let kind = kind_of(q.kind.as_deref())?;
    Ok(Json(crate::book::mm::status_json(&st.hub, s.ctx.tenant.tenant_id, kind)))
}

#[derive(Deserialize)]
pub struct MmPauseBody {
    pub kind: String,
    pub scope: String,
    #[serde(default)]
    pub target: Option<String>,
    pub reason: String,
}

/// `POST /v1/admin/options/mm/pause|resume {kind, scope: all|underlying|expiry, target, reason}` — a pause pulls the
/// MM's quotes in scope within one quoting pass; resuming `all` lifts every pause of the kind.
pub async fn mm_pause(State(st): State<AppState>, s: StaffCtx, Path(action): Path<String>, Body(b): Body<MmPauseBody>) -> ApiResult<Json<Value>> {
    s.require_perm("options.dealing", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = kind_of(Some(&b.kind))?;
    if b.reason.trim().len() < 3 {
        return Err(validation("reason", "Add a reason for the audit log"));
    }
    if !matches!(b.scope.as_str(), "all" | "underlying" | "expiry") {
        return Err(validation("scope", "scope must be all, underlying or expiry"));
    }
    let target = if b.scope == "all" { "*".to_string() } else { b.target.clone().filter(|t| !t.trim().is_empty()).ok_or_else(|| validation("target", "target is required for this scope"))? };
    let staff = format!("{} ({})", s.staff.name, s.staff.id);
    let n = match action.as_str() {
        "pause" => {
            sqlx::query("INSERT INTO option_mm_pauses (tenant_id, kind, scope, target, reason, staff) VALUES ($1,$2,$3,$4,$5,$6)").bind(tenant).bind(kind.as_str()).bind(&b.scope).bind(&target).bind(b.reason.trim()).bind(&staff).execute(&st.pool).await?.rows_affected()
        }
        "resume" => {
            let q = if b.scope == "all" {
                sqlx::query("UPDATE option_mm_pauses SET lifted_at = now(), lifted_by = $3 WHERE tenant_id = $1 AND kind = $2 AND lifted_at IS NULL").bind(tenant).bind(kind.as_str()).bind(&staff)
            } else {
                sqlx::query("UPDATE option_mm_pauses SET lifted_at = now(), lifted_by = $3 WHERE tenant_id = $1 AND kind = $2 AND lifted_at IS NULL AND scope = $4 AND target = $5").bind(tenant).bind(kind.as_str()).bind(&staff).bind(&b.scope).bind(&target)
            };
            q.execute(&st.pool).await?.rows_affected()
        }
        _ => return Err(ApiError::NotFound("Not found".into())),
    };
    crate::book::mm::reload_pauses(&st).await.map_err(ApiError::Internal)?;
    st.social.audit(tenant, &s.staff, &format!("options.mm_{action}"), None, &target, None, Some(json!({"kind": kind.as_str(), "scope": b.scope, "rows": n})), b.reason.trim()).await;
    Ok(Json(json!({"ok": true, "changed": n, "pauses": st.hub.shared.books.mm.pauses_of(tenant, kind).iter().map(crate::book::mm::Pause::json).collect::<Vec<_>>()})))
}

/* ------------------------------------------------------------------ */
/* Liquidations, clearing, RFQs                                        */
/* ------------------------------------------------------------------ */

#[derive(Deserialize, Default)]
pub struct LiqQ {
    pub kind: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub login: Option<i64>,
    pub limit: Option<i64>,
}

/// `GET /v1/admin/options/liquidations?kind=&from=&to=&login=&limit=` — every step of the liquidation runs.
pub async fn liquidations(State(st): State<AppState>, s: StaffCtx, Query(q): Query<LiqQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let from = super::terminal::parse_time(&q.from)?;
    let to = super::terminal::parse_time(&q.to)?;
    let rows = sqlx::query(
        "SELECT id, created_at, login, run_id, step, action, unit, result, level_before, level_after, kind FROM option_liquidations
          WHERE tenant_id = $1 AND ($2::text IS NULL OR kind = $2) AND ($3::timestamptz IS NULL OR created_at >= $3) AND ($4::timestamptz IS NULL OR created_at < $4 + interval '1 day')
            AND ($5::bigint IS NULL OR login = $5) ORDER BY id DESC LIMIT $6",
    )
    .bind(tenant)
    .bind(q.kind.as_deref().filter(|k| *k != "all"))
    .bind(from)
    .bind(to)
    .bind(q.login)
    .bind(q.limit.unwrap_or(200).clamp(1, 1000))
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let unit: sqlx::types::Json<Value> = r.get("unit");
            let res: sqlx::types::Json<Value> = r.get("result");
            let (u, x) = (unit.0, res.0);
            let qty: f64 = x["qty"].as_str().and_then(|s| s.parse().ok()).or_else(|| x["qty"].as_f64()).unwrap_or(0.0);
            json!({
                "id": r.get::<i64, _>("id"), "at": r.get::<DateTime<Utc>, _>("created_at"), "login": r.get::<i64, _>("login"), "userId": u["userId"], "step": r.get::<i32, _>("step"),
                "unit": u["type"].as_str().unwrap_or("option"), "series": u["series"].as_str().map(str::to_string).or_else(|| u["series"].as_array().map(|a| a.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(" / "))),
                "qty": qty, "price": x["price"], "route": r.get::<String, _>("action"), "marginLevelBefore": num_opt(r.get::<Option<D>, _>("level_before")), "marginLevelAfter": num_opt(r.get::<Option<D>, _>("level_after")),
                "freedMarginUsd": x["freedMarginUsd"].as_f64().unwrap_or(0.0), "status": x["status"].as_str().unwrap_or("done"), "note": x["note"], "kind": r.get::<Option<String>, _>("kind"), "runId": r.get::<String, _>("run_id"),
            })
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

#[derive(Deserialize, Default)]
pub struct ClearQ {
    pub kind: Option<String>,
    pub expiry: Option<String>,
    pub u: Option<String>,
}

/// `GET /v1/admin/options/clearing?kind=&expiry=&u=` — the clearing accounts (must be 0 once the outbox is empty).
pub async fn clearing(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ClearQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = q.kind.clone().filter(|k| k != "all");
    let pat = format!("house:options_clearing.{}.{}:USD", q.u.as_deref().unwrap_or("%"), q.expiry.as_deref().map(|e| e.replace('-', "")).unwrap_or_else(|| "%".into()));
    let rows = sqlx::query(
        "SELECT p.account_code, sum(p.amount) AS bal, count(DISTINCT t.reference) AS fills, max(t.created_at) AS last FROM ledger_postings p JOIN ledger_txns t ON t.id = p.txn_id
           JOIN accounts a ON a.login = t.login
          WHERE p.tenant_id = $1 AND p.account_code LIKE $2 AND ($3::text IS NULL OR a.kind = $3) GROUP BY 1 ORDER BY 1",
    )
    .bind(tenant)
    .bind(&pat)
    .bind(&kind)
    .fetch_all(&st.pool)
    .await?;
    let pending = sqlx::query("SELECT underlying, count(*) AS n FROM book_outbox WHERE tenant_id = $1 AND ($2::text IS NULL OR kind = $2) AND status <> 'applied' AND item_kind IN ('fill','fills','bust') GROUP BY 1")
        .bind(tenant)
        .bind(&kind)
        .fetch_all(&st.pool)
        .await?;
    let pend: BTreeMap<String, i64> = pending.iter().map(|r| (r.get::<String, _>("underlying"), r.get::<i64, _>("n"))).collect();
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let code: String = r.get("account_code");
            let body = code.trim_start_matches("house:options_clearing.").trim_end_matches(":USD").to_string();
            let (u, d) = body.split_once('.').map(|(a, b)| (a.to_string(), b.to_string())).unwrap_or((body.clone(), String::new()));
            let expiry = if d.len() == 8 { format!("{}-{}-{}", &d[0..4], &d[4..6], &d[6..8]) } else { d };
            json!({"account": code, "underlying": u, "expiry": expiry, "balanceUsd": num(r.get::<Option<D>, _>("bal").unwrap_or(ZERO)), "pendingOutbox": pend.get(&u).copied().unwrap_or(0), "fills": r.get::<i64, _>("fills"), "lastFillAt": r.get::<Option<DateTime<Utc>>, _>("last"), "swept": Value::Null})
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

/// `GET /v1/admin/options/rfqs?kind=` — combo RFQs: the open ones (with the market maker's live quote) and the
/// last 200 of the database.
pub async fn rfqs(State(st): State<AppState>, s: StaffCtx, Query(q): Query<KindQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = q.kind.as_deref().filter(|k| *k != "all").map(|k| kind_of(Some(k))).transpose()?;
    let now_ms = st.hub.shared.clock.now().timestamp_millis();
    let live: Vec<Value> = st
        .hub
        .shared
        .books
        .rfqs
        .list(tenant, kind)
        .iter()
        .map(|r| {
            let mut v = r.json();
            v["login"] = json!(r.login);
            v["kind"] = json!(r.kind.as_str());
            v["quotes"] = r.quotes_json(now_ms);
            v["createdAt"] = json!(DateTime::from_timestamp_millis(r.created_ms));
            v["note"] = json!(r.note);
            v
        })
        .collect();
    let rows = sqlx::query("SELECT id, kind, underlying, login, legs, qty, status, expires_at, data, created_at, updated_at FROM book_rfqs WHERE tenant_id = $1 AND ($2::text IS NULL OR kind = $2) ORDER BY id DESC LIMIT 200")
        .bind(tenant)
        .bind(kind.map(|k| k.as_str()))
        .fetch_all(&st.pool)
        .await?;
    let recent: Vec<Value> = rows
        .iter()
        .map(|r| {
            let legs: sqlx::types::Json<Value> = r.get("legs");
            let data: Option<sqlx::types::Json<Value>> = r.get("data");
            json!({"id": r.get::<i64, _>("id").to_string(), "kind": r.get::<String, _>("kind"), "underlying": r.get::<String, _>("underlying"), "login": r.get::<i64, _>("login"), "legs": legs.0, "qty": num(r.get::<D, _>("qty")),
                   "status": r.get::<String, _>("status"), "expiresAt": r.get::<DateTime<Utc>, _>("expires_at"), "createdAt": r.get::<DateTime<Utc>, _>("created_at"), "updatedAt": r.get::<DateTime<Utc>, _>("updated_at"), "data": data.map(|d| d.0)})
        })
        .collect();
    let filled = recent.iter().filter(|r| r["status"] == "filled").count();
    Ok(Json(json!({"open": live, "recent": recent, "stats": {"recent": recent.len(), "filled": filled}})))
}

/* ------------------------------------------------------------------ */
/* Four-eyes: bust, enable                                             */
/* ------------------------------------------------------------------ */

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalBody {
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub approval_id: Option<Value>,
    #[serde(default)]
    pub kind: Option<String>,
}

fn approval_id(v: &Option<Value>) -> Option<i64> {
    match v {
        Some(Value::Number(n)) => n.as_i64(),
        Some(Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

/// The first call of a four-eyes action: an approval request.
async fn request(st: &AppState, s: &StaffCtx, action: &str, target: &str, kind: Option<&str>, reason: &str) -> ApiResult<Value> {
    let r = sqlx::query("INSERT INTO option_approvals (tenant_id, action, target, kind, reason, requested_by, requested_by_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, requested_at")
        .bind(s.ctx.tenant.tenant_id)
        .bind(action)
        .bind(target)
        .bind(kind)
        .bind(reason)
        .bind(&s.staff.name)
        .bind(&s.staff.id)
        .fetch_one(&st.pool)
        .await?;
    let id: i64 = r.get("id");
    st.social.audit(s.ctx.tenant.tenant_id, &s.staff, &format!("options.{action}_requested"), None, target, None, Some(json!({"approval": id, "kind": kind})), reason).await;
    Ok(json!({"status": "pending_approval", "approval": {"id": id, "requestedBy": s.staff.name, "requestedAt": r.get::<DateTime<Utc>, _>("requested_at")}}))
}

/// The second call: the pending approval of `action` on `target`, confirmed by a different staff member.
/// Returns (requested reason, requested by, approved by).
async fn confirm(st: &AppState, s: &StaffCtx, id: i64, action: &str, target: &str) -> ApiResult<(String, String, String)> {
    let r = sqlx::query("SELECT target, requested_by, requested_by_id, status, reason FROM option_approvals WHERE id = $1 AND tenant_id = $2 AND action = $3").bind(id).bind(s.ctx.tenant.tenant_id).bind(action).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::NotFound("Approval not found".into()))?;
    if r.get::<String, _>("status") != "pending" {
        return Err(ApiError::Status { status: 409, code: "approval_closed", message: "This request was already handled".into() });
    }
    if r.get::<String, _>("target") != target {
        return Err(ApiError::Status { status: 422, code: "approval_mismatch", message: "The approval is for another target".into() });
    }
    if r.get::<String, _>("requested_by_id") == s.staff.id {
        return Err(ApiError::Status { status: 409, code: "four_eyes", message: "A second staff member must confirm this (four-eyes)".into() });
    }
    // claim it (one confirmer wins)
    let n = sqlx::query("UPDATE option_approvals SET status = 'executed', approved_by = $2, approved_at = now() WHERE id = $1 AND status = 'pending'").bind(id).bind(&s.staff.name).execute(&st.pool).await?.rows_affected();
    if n == 0 {
        return Err(ApiError::Status { status: 409, code: "approval_closed", message: "This request was already handled".into() });
    }
    Ok((r.get("reason"), r.get("requested_by"), s.staff.name.clone()))
}

async fn close_approval(st: &AppState, id: i64, status: &str, result: Value) {
    let _ = sqlx::query("UPDATE option_approvals SET status = $2, result = $3 WHERE id = $1").bind(id).bind(status).bind(sqlx::types::Json(result)).execute(&st.pool).await;
}

/// `POST /v1/admin/options/fills/{fillId}/bust {reason, approvalId?}` — four-eyes. Confirmed, the fill is reversed on
/// both sides (premium, fee / rebate, positions) with keys `bust:{fillId}:{login}:*`, shown to both clients as a
/// correction; the book's positions move back (`Cmd::Bust`).
pub async fn bust(State(st): State<AppState>, s: StaffCtx, Path(fill_id): Path<String>, Body(b): Body<ApprovalBody>) -> ApiResult<Json<Value>> {
    s.require_perm("options.settle", ROLES_SETTLE)?;
    let tenant = s.ctx.tenant.tenant_id;
    if b.reason.trim().len() < 3 {
        return Err(validation("reason", "Add a reason for the audit log"));
    }
    let row = sqlx::query("SELECT kind, underlying, data, busted_at FROM book_fills WHERE tenant_id = $1 AND fill_id = $2").bind(tenant).bind(&fill_id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::NotFound(format!("Fill {fill_id} not found")))?;
    if row.get::<Option<DateTime<Utc>>, _>("busted_at").is_some() {
        return Err(ApiError::Status { status: 409, code: "already_busted", message: format!("Fill {fill_id} is already busted") });
    }
    let kind = kind_of(Some(&row.get::<String, _>("kind")))?;
    let Some(aid) = approval_id(&b.approval_id) else {
        return Ok(Json(request(&st, &s, "fill_bust", &fill_id, Some(kind.as_str()), b.reason.trim()).await?));
    };
    let (req_reason, _, approver) = confirm(&st, &s, aid, "fill_bust", &fill_id).await?;
    let fill: sqlx::types::Json<Fill> = row.get("data");
    let fill = fill.0;
    let claimed = sqlx::query("UPDATE book_fills SET busted_at = now(), bust = $3 WHERE tenant_id = $1 AND fill_id = $2 AND busted_at IS NULL")
        .bind(tenant)
        .bind(&fill_id)
        .bind(sqlx::types::Json(json!({"approval": aid, "requestedReason": req_reason, "reason": b.reason.trim(), "approvedBy": approver})))
        .execute(&st.pool)
        .await?
        .rows_affected();
    if claimed == 0 {
        close_approval(&st, aid, "failed", json!({"error": "already busted"})).await;
        return Err(ApiError::Status { status: 409, code: "already_busted", message: format!("Fill {fill_id} is already busted") });
    }
    let key = BookKey::new(tenant, kind, &row.get::<String, _>("underlying"));
    let at = st.hub.shared.clock.now().timestamp_millis();
    let res = entry::call(&st.hub, fill.taker.login, &key, Cmd::Bust { fill: fill.clone(), reason: b.reason.trim().to_string(), at }).await;
    let ok = matches!(&res, Ok((o, _, _)) if o.ok);
    if !ok {
        let why = match res {
            Ok((o, _, _)) => o.message.unwrap_or_default(),
            Err(e) => format!("{e:?}"),
        };
        let _ = sqlx::query("UPDATE book_fills SET busted_at = NULL, bust = NULL WHERE tenant_id = $1 AND fill_id = $2").bind(tenant).bind(&fill_id).execute(&st.pool).await;
        close_approval(&st, aid, "failed", json!({"error": why})).await;
        return Err(ApiError::Status { status: 422, code: "bust_refused", message: why });
    }
    let buyer = if fill.taker.side == crate::model::Side::Buy { fill.taker.login } else { fill.maker.login };
    let seller = if buyer == fill.taker.login { fill.maker.login } else { fill.taker.login };
    let reversed = json!([{"login": buyer, "amountUsd": num(fill.premium_usd)}, {"login": seller, "amountUsd": num(-fill.premium_usd)}]);
    close_approval(&st, aid, "executed", json!({"reversed": reversed})).await;
    st.social.audit(tenant, &s.staff, "options.fill_bust", Some(fill.taker.login), &fill_id, Some(json!({"fill": fill_id, "price": num(fill.spec.price(fill.px)), "qty": num(fill.spec.contracts(fill.qty))})), Some(json!({"reversed": reversed, "approval": aid})), b.reason.trim()).await;
    Ok(Json(json!({
        "status": "busted", "approvedBy": approver, "reversed": reversed,
        "fill": {"fillId": fill.id, "series": fill.series, "price": num(fill.spec.price(fill.px)), "qty": num(fill.spec.contracts(fill.qty)), "takerSide": fill.taker.side.as_str(), "kind": fill.kind.as_str(), "busted": true},
    })))
}

#[derive(Deserialize, Default)]
pub struct ApprovalsQ {
    pub status: Option<String>,
    pub kind: Option<String>,
}

/// `GET /v1/admin/options/approvals?status=pending&kind=`
pub async fn approvals(State(st): State<AppState>, s: StaffCtx, Query(q): Query<ApprovalsQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING)?;
    let status = q.status.filter(|x| x != "all");
    let rows = sqlx::query("SELECT id, action, target, kind, reason, requested_by, requested_at, status, approved_by, approved_at, result FROM option_approvals WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR kind = $3) ORDER BY id DESC LIMIT 200")
        .bind(s.ctx.tenant.tenant_id)
        .bind(status)
        .bind(q.kind.filter(|k| k != "all"))
        .fetch_all(&st.pool)
        .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"id": r.get::<i64, _>("id"), "action": r.get::<String, _>("action"), "target": r.get::<String, _>("target"), "kind": r.get::<Option<String>, _>("kind"), "reason": r.get::<String, _>("reason"),
                   "requestedBy": r.get::<String, _>("requested_by"), "requestedAt": r.get::<DateTime<Utc>, _>("requested_at"), "status": r.get::<String, _>("status"),
                   "approvedBy": r.get::<Option<String>, _>("approved_by"), "approvedAt": r.get::<Option<DateTime<Utc>>, _>("approved_at")})
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

/// `GET /v1/admin/options/book/enable/plan?kind=` — the dry run of §11.
pub async fn enable_plan(State(st): State<AppState>, s: StaffCtx, Query(q): Query<KindQ>) -> ApiResult<Json<Value>> {
    s.require_perm("options.read", ROLES_DEALING.iter().chain(ROLES_CONFIG).copied().collect::<Vec<_>>().as_slice())?;
    let kind = kind_of(q.kind.as_deref())?;
    Ok(Json(crate::book::enable::plan(&st, s.ctx.tenant.tenant_id, kind).await))
}

/// `POST /v1/admin/options/book/enable {kind, reason, approvalId?}` — four-eyes, forward-only.
pub async fn enable(State(st): State<AppState>, s: StaffCtx, Body(b): Body<ApprovalBody>) -> ApiResult<Json<Value>> {
    s.require_perm("options.settle", ROLES_SETTLE)?;
    let tenant = s.ctx.tenant.tenant_id;
    let kind = kind_of(b.kind.as_deref())?;
    if b.reason.trim().len() < 3 {
        return Err(validation("reason", "Add a reason for the audit log"));
    }
    let target = format!("{}:{}", s.ctx.tenant.slug, kind.as_str());
    let Some(aid) = approval_id(&b.approval_id) else {
        let plan = crate::book::enable::plan(&st, tenant, kind).await;
        if let Some(bl) = plan["blockers"].as_array().filter(|a| !a.is_empty()) {
            return Err(ApiError::Status { status: 422, code: "blocked", message: bl.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(" ") });
        }
        return Ok(Json(request(&st, &s, "book_enable", &target, Some(kind.as_str()), b.reason.trim()).await?));
    };
    let (_, requester, approver) = confirm(&st, &s, aid, "book_enable", &target).await?;
    let by = format!("{requester} + {approver} (four-eyes)");
    match crate::book::enable::enable(&st, tenant, kind, &by, b.reason.trim()).await {
        Ok(report) => {
            close_approval(&st, aid, "executed", report.clone()).await;
            st.social.audit(tenant, &s.staff, "options.book_enable", None, &target, None, Some(report.clone()), b.reason.trim()).await;
            Ok(Json(json!({"status": "enabled", "enabledAt": Utc::now(), "report": report})))
        }
        Err(e) => {
            close_approval(&st, aid, "failed", json!({"error": e.to_string()})).await;
            Err(ApiError::Status { status: 422, code: "enable_failed", message: format!("{e} (run the enable again to complete it: every step is idempotent)") })
        }
    }
}
