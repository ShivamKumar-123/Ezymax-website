//! Back Office symbol settings for the instrument catalogue (config/symbols in the Back Office):
//!
//! * `GET  /v1/admin/symbols/catalogue`              every instrument with its effective specs, the live switch and
//!                                                    the templates (file values, Back Office override, effective)
//! * `PUT  /v1/admin/symbols/live`                    `{scope: "class"|"symbol", key, enabled: true|false|null, reason}`
//! * `PUT  /v1/admin/symbols/templates/{key}`         `{fields: {...} | null, reason}` (null = back to the file template)
//! * `GET  /v1/admin/symbols/catalogue/audit`         the last changes
//!
//! Reading is open to the dealing and configuration roles of any broker. Changing the live switch or a template is
//! a platform decision: only the platform owner / super admin of the Kalks platform tenant may do it (the
//! founder's switch for risky money features). Core instruments are not affected by either.

use axum::Json;
use axum::extract::{Path, State};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::Row;
use std::collections::{BTreeMap, BTreeSet};

use super::{ApiError, ApiResult, AppState, Body, ROLES_CONFIG, ROLES_DEALING, StaffCtx};
use crate::money::num;
use crate::specs::{RawSpec, Spec, raw_json};

/// Roles that may change the live switch and templates (platform tenant only).
const ROLES_PLATFORM: &[&str] = &["platform_owner", "super_admin"];
const PLATFORM_TENANT: &str = "kalks";

fn can_change(s: &StaffCtx) -> bool {
    s.ctx.tenant.slug == PLATFORM_TENANT && ROLES_PLATFORM.contains(&s.staff.role.as_str())
}

fn require_platform(s: &StaffCtx) -> ApiResult<()> {
    if can_change(s) { Ok(()) } else { Err(ApiError::Forbidden("Only the platform owner can change live trading or symbol templates".into())) }
}

fn require_read(s: &StaffCtx) -> ApiResult<()> {
    if ROLES_DEALING.contains(&s.staff.role.as_str()) || ROLES_CONFIG.contains(&s.staff.role.as_str()) { Ok(()) } else { s.require(ROLES_DEALING) }
}

fn spec_json(s: &Spec) -> Value {
    json!({
        "symbol": s.symbol, "name": s.name, "assetClass": s.asset_class, "core": s.core, "template": s.template,
        "liveTrading": s.live, "session": s.session.key(), "holidayCalendar": s.holidays.as_ref().map(|h| h.calendar.clone()),
        "digits": s.digits, "contractSize": num(s.contract_size), "lotMin": num(s.lot_min), "lotMax": num(s.lot_max),
        "lotStep": num(s.lot_step), "marginPct": num(s.margin_pct), "maxLeverage": s.max_leverage, "swapLong": num(s.swap_long),
        "swapShort": num(s.swap_short), "stopsLevelPoints": s.stops_level_points, "quoteCcy": s.quote_ccy, "baseCcy": s.base_ccy,
    })
}

pub async fn catalogue(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    require_read(&s)?;
    let specs = st.hub.shared.specs.load();
    let ov = specs.overrides().clone();
    let src = specs.source().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("specs have no source")))?;
    // per class: instruments, core, catalogue, live catalogue
    let mut counts: BTreeMap<String, [u64; 4]> = BTreeMap::new();
    for x in specs.all() {
        let c = counts.entry(x.asset_class.clone()).or_default();
        c[0] += 1;
        if x.core {
            c[1] += 1;
        } else {
            c[2] += 1;
            if x.live {
                c[3] += 1;
            }
        }
    }
    let meta: BTreeMap<String, (String, String, Option<chrono::DateTime<Utc>>)> = sqlx::query("SELECT key, updated_by, reason, updated_at FROM symbol_templates")
        .fetch_all(&st.pool)
        .await?
        .into_iter()
        .map(|r| (r.get::<String, _>("key"), (r.get("updated_by"), r.get("reason"), r.get("updated_at"))))
        .collect();
    let templates: Vec<Value> = src
        .template_keys()
        .into_iter()
        .map(|k| {
            let file = src.template(&k).cloned().unwrap_or_default();
            let over = ov.templates.get(&k).cloned();
            let eff = file.merged(over.as_ref().unwrap_or(&RawSpec::default()));
            let m = meta.get(&k);
            json!({
                "key": k, "comment": file.comment, "symbols": src.template_symbols(&k).len(),
                "file": raw_json(&RawSpec { comment: None, ..file }), "override": over.map(|o| raw_json(&o)), "effective": raw_json(&RawSpec { comment: None, ..eff }),
                "updatedBy": m.map(|x| x.0.clone()), "updatedReason": m.map(|x| x.1.clone()), "updatedAt": m.and_then(|x| x.2),
            })
        })
        .collect();
    let live_rows: Vec<Value> = sqlx::query("SELECT scope, key, enabled, updated_by, reason, updated_at FROM symbol_live ORDER BY scope, key")
        .fetch_all(&st.pool)
        .await?
        .into_iter()
        .map(|r| json!({"scope": r.get::<String, _>("scope"), "key": r.get::<String, _>("key"), "enabled": r.get::<bool, _>("enabled"), "updatedBy": r.get::<String, _>("updated_by"), "reason": r.get::<String, _>("reason"), "updatedAt": r.get::<chrono::DateTime<Utc>, _>("updated_at")}))
        .collect();
    Ok(Json(json!({
        "canChange": can_change(&s),
        "counts": counts.into_iter().map(|(k, c)| (k, json!({"total": c[0], "core": c[1], "catalogue": c[2], "catalogueLive": c[3]}))).collect::<Map<String, Value>>(),
        "liveClasses": ov.live_classes,
        "liveSymbols": ov.live_symbols,
        "liveChanges": live_rows,
        "templates": templates,
        "symbols": specs.all().map(spec_json).collect::<Vec<_>>(),
    })))
}

#[derive(Deserialize)]
pub struct LiveBody {
    scope: String,
    key: String,
    /// symbol scope: null = follow the asset class again
    enabled: Option<bool>,
    #[serde(default)]
    reason: String,
}

fn reason_ok(r: &str) -> ApiResult<String> {
    let r = r.trim();
    if r.len() < 3 || r.len() > 300 {
        return Err(ApiError::Validation { field: "reason", message: "Give a reason (3–300 characters)".into() });
    }
    Ok(r.to_string())
}

async fn audit(st: &AppState, s: &StaffCtx, action: &str, target: &str, before: Value, after: Value, reason: &str, tx: &mut sqlx::Transaction<'_, sqlx::Postgres>) -> ApiResult<()> {
    sqlx::query("INSERT INTO symbol_catalogue_audit (staff_id, staff_name, staff_role, action, target, before, after, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(&s.staff.id)
        .bind(&s.staff.name)
        .bind(&s.staff.role)
        .bind(action)
        .bind(target)
        .bind(sqlx::types::Json(before))
        .bind(sqlx::types::Json(after))
        .bind(reason)
        .execute(&mut **tx)
        .await?;
    let _ = st;
    Ok(())
}

pub async fn set_live(State(st): State<AppState>, s: StaffCtx, Body(b): Body<LiveBody>) -> ApiResult<Json<Value>> {
    require_platform(&s)?;
    let reason = reason_ok(&b.reason)?;
    let specs = st.hub.shared.specs.load();
    let key = b.key.trim().to_string();
    let before;
    let mut tx = st.pool.begin().await?;
    match b.scope.as_str() {
        "class" => {
            if !specs.all().any(|x| !x.core && x.asset_class == key) {
                return Err(ApiError::Validation { field: "key", message: format!("No catalogue instruments in asset class {key}") });
            }
            let on = b.enabled.ok_or(ApiError::Validation { field: "enabled", message: "enabled must be true or false for an asset class".into() })?;
            before = json!({"enabled": specs.overrides().live_classes.contains(&key)});
            sqlx::query(
                "INSERT INTO symbol_live (scope, key, enabled, updated_by, reason, updated_at) VALUES ('class', $1, $2, $3, $4, now())
                 ON CONFLICT (scope, key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, reason = EXCLUDED.reason, updated_at = now()",
            )
            .bind(&key)
            .bind(on)
            .bind(&s.staff.name)
            .bind(&reason)
            .execute(&mut *tx)
            .await?;
        }
        "symbol" => {
            let key = key.to_uppercase();
            let Some(x) = specs.get(&key) else { return Err(ApiError::NotFound(format!("Unknown symbol {key}"))) };
            if x.core {
                return Err(ApiError::Validation { field: "key", message: format!("{key} is a core instrument: it always trades on live accounts") });
            }
            before = json!({"enabled": specs.overrides().live_symbols.get(&key)});
            match b.enabled {
                Some(on) => {
                    sqlx::query(
                        "INSERT INTO symbol_live (scope, key, enabled, updated_by, reason, updated_at) VALUES ('symbol', $1, $2, $3, $4, now())
                         ON CONFLICT (scope, key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, reason = EXCLUDED.reason, updated_at = now()",
                    )
                    .bind(&key)
                    .bind(on)
                    .bind(&s.staff.name)
                    .bind(&reason)
                    .execute(&mut *tx)
                    .await?;
                }
                None => {
                    sqlx::query("DELETE FROM symbol_live WHERE scope = 'symbol' AND key = $1").bind(&key).execute(&mut *tx).await?;
                }
            }
        }
        _ => return Err(ApiError::Validation { field: "scope", message: "scope must be class or symbol".into() }),
    }
    let target = format!("{}:{}", b.scope, if b.scope == "symbol" { key.to_uppercase() } else { key.clone() });
    audit(&st, &s, "symbols.live", &target, before, json!({"enabled": b.enabled}), &reason, &mut tx).await?;
    tx.commit().await?;
    let specs = crate::catalogue::reload(&st.hub, &st.pool).await?;
    let live = specs.all().filter(|x| !x.core && x.live).count();
    tracing::info!(staff = %s.staff.name, %target, enabled = ?b.enabled, catalogue_live = live, "live trading switch changed");
    Ok(Json(json!({"ok": true, "catalogueLive": live, "liveClasses": specs.overrides().live_classes, "liveSymbols": specs.overrides().live_symbols})))
}

#[derive(Deserialize)]
pub struct TemplateBody {
    /// fields replacing the file template's; null = remove the override
    fields: Option<Value>,
    #[serde(default)]
    reason: String,
}

/// Template fields the Back Office may set.
const TEMPLATE_FIELDS: &[&str] = &[
    "contract_size", "lot_min", "lot_max", "lot_step", "margin_pct", "max_leverage", "swap_long", "swap_short", "triple_swap_day", "swap_days", "session", "stops_level_points", "commission_per_lot",
];

pub async fn set_template(State(st): State<AppState>, s: StaffCtx, Path(key): Path<String>, Body(b): Body<TemplateBody>) -> ApiResult<Json<Value>> {
    require_platform(&s)?;
    let reason = reason_ok(&b.reason)?;
    let specs = st.hub.shared.specs.load();
    let src = specs.source().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("specs have no source")))?;
    let Some(file) = src.template(&key).cloned() else { return Err(ApiError::NotFound(format!("Unknown template {key}"))) };
    let over: Option<RawSpec> = match &b.fields {
        None | Some(Value::Null) => None,
        Some(Value::Object(m)) => {
            if let Some(bad) = m.keys().find(|k| !TEMPLATE_FIELDS.contains(&k.as_str())) {
                return Err(ApiError::Validation { field: "fields", message: format!("{bad} cannot be set on a template") });
            }
            Some(serde_json::from_value(Value::Object(m.clone())).map_err(|e| ApiError::Validation { field: "fields", message: format!("Invalid template fields: {e}") })?)
        }
        Some(_) => return Err(ApiError::Validation { field: "fields", message: "fields must be an object or null".into() }),
    };
    let next = file.merged(over.as_ref().unwrap_or(&RawSpec::default()));
    if let Err((field, message)) = next.validate_template() {
        return Err(ApiError::StatusData { status: 422, code: "validation", message, data: json!({"field": field}) });
    }
    let prev_over = specs.overrides().templates.get(&key).cloned();
    let prev = file.merged(prev_over.as_ref().unwrap_or(&RawSpec::default()));
    // P&L of an open position is volume × contract size × price move: a contract size change would revalue every
    // open position on the template's instruments, so it waits until none is open (demo or live)
    if prev.contract_size != next.contract_size {
        let syms: BTreeSet<String> = src.template_symbols(&key).into_iter().collect();
        let open = crate::catalogue::open_interest(&st.hub, &syms).await;
        if !open.is_empty() {
            return Err(ApiError::StatusData {
                status: 409,
                code: "open_interest",
                message: format!("Contract size can't change while {} instrument(s) on this template have open positions or orders", open.len()),
                data: json!({"symbols": open}),
            });
        }
    }
    let mut tx = st.pool.begin().await?;
    match &over {
        Some(o) => {
            sqlx::query(
                "INSERT INTO symbol_templates (key, spec, updated_by, reason, updated_at) VALUES ($1, $2, $3, $4, now())
                 ON CONFLICT (key) DO UPDATE SET spec = EXCLUDED.spec, updated_by = EXCLUDED.updated_by, reason = EXCLUDED.reason, updated_at = now()",
            )
            .bind(&key)
            .bind(sqlx::types::Json(raw_json(o)))
            .bind(&s.staff.name)
            .bind(&reason)
            .execute(&mut *tx)
            .await?;
        }
        None => {
            sqlx::query("DELETE FROM symbol_templates WHERE key = $1").bind(&key).execute(&mut *tx).await?;
        }
    }
    audit(&st, &s, "symbols.template", &format!("template:{key}"), json!({"override": prev_over.as_ref().map(raw_json), "effective": raw_json(&prev)}), json!({"override": over.as_ref().map(raw_json), "effective": raw_json(&next)}), &reason, &mut tx).await?;
    tx.commit().await?;
    match crate::catalogue::reload(&st.hub, &st.pool).await {
        Ok(_) => {}
        Err(e) => {
            // the stored override does not build (should be impossible after validation): say so loudly
            tracing::error!(template = %key, error = %e, "template saved but the specs could not be rebuilt");
            return Err(ApiError::Internal(e));
        }
    }
    tracing::info!(staff = %s.staff.name, template = %key, "symbol template changed");
    Ok(Json(json!({"ok": true, "key": key, "effective": raw_json(&RawSpec { comment: None, ..next }), "symbols": src.template_symbols(&key).len()})))
}

pub async fn audit_log(State(st): State<AppState>, s: StaffCtx) -> ApiResult<Json<Value>> {
    require_read(&s)?;
    let rows: Vec<Value> = sqlx::query("SELECT id, at, staff_name, staff_role, action, target, before, after, reason FROM symbol_catalogue_audit ORDER BY id DESC LIMIT 200")
        .fetch_all(&st.pool)
        .await?
        .into_iter()
        .map(|r| {
            json!({
                "id": r.get::<i64, _>("id"), "at": r.get::<chrono::DateTime<Utc>, _>("at"), "staff": r.get::<String, _>("staff_name"),
                "role": r.get::<String, _>("staff_role"), "action": r.get::<String, _>("action"), "target": r.get::<String, _>("target"),
                "before": r.get::<Option<sqlx::types::Json<Value>>, _>("before").map(|j| j.0), "after": r.get::<Option<sqlx::types::Json<Value>>, _>("after").map(|j| j.0),
                "reason": r.get::<String, _>("reason"),
            })
        })
        .collect();
    Ok(Json(json!({"changes": rows})))
}
