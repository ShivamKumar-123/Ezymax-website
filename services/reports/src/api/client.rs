//! Client Area routes (`X-Kalks-User-Id`): analytics, monthly statement list, statement downloads.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use serde_json::Value;

use super::{RangeQ, UserCtx, file, flag, range};
use crate::client;
use crate::db::{self, Actor};
use crate::error::{ApiError, ApiResult};
use crate::export::{self, Sections};
use crate::state::App;
use crate::statement::{self, Statement};
use crate::time;

fn login_param(v: &Option<String>) -> ApiResult<Option<i64>> {
    match v.as_deref() {
        None | Some("") | Some("all") => Ok(None),
        Some(s) => s.parse::<i64>().map(Some).map_err(|_| ApiError::BadRequest("Invalid account.".into())),
    }
}

pub async fn analytics(State(app): State<App>, u: UserCtx, Query(q): Query<RangeQ>) -> ApiResult<Json<Value>> {
    let (from, to) = range(&q, 90)?;
    Ok(Json(client::analytics(&app, &u.tenant, u.user_id, login_param(&q.login)?, from, to).await?))
}

async fn owned(app: &App, tenant: &str, user_id: i64, login: i64) -> ApiResult<()> {
    let owner: Option<i64> = sqlx::query_scalar("SELECT user_id FROM accounts WHERE tenant = $1 AND login = $2").bind(tenant).bind(login).fetch_optional(&app.pool).await?;
    if owner == Some(user_id) { Ok(()) } else { Err(ApiError::NotFound("Account not found.".into())) }
}

pub async fn months(State(app): State<App>, u: UserCtx, Path(login): Path<i64>) -> ApiResult<Json<Value>> {
    client::refresh(&app, &u.tenant, u.user_id).await;
    owned(&app, &u.tenant, u.user_id, login).await?;
    Ok(Json(client::months(&app, &u.tenant, login).await?))
}

pub fn sections(q: &RangeQ) -> Sections {
    Sections { open: flag(&q.open), charges: flag(&q.charges), deals: flag(&q.deals) }
}

pub fn render(app: &App, s: &Statement, format: &str, sec: &Sections) -> ApiResult<Response> {
    let day = |t| time::server_day(t);
    let base = format!("kalks-statement-{}-{}-{}", s.account.login, day(s.from), day(s.to - chrono::Duration::seconds(1)));
    Ok(match format {
        "pdf" => file(export::statement_pdf(s, &app.cfg.company_name, &app.cfg.company_site, &app.cfg.support_email, sec), "application/pdf", &format!("{base}.pdf")),
        "csv" => file(export::csv(&export::statement_tables(s, sec)), "text/csv; charset=utf-8", &format!("{base}.csv")),
        "xlsx" => file(
            export::xlsx(&export::statement_tables(s, sec)).map_err(ApiError::Internal)?,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            &format!("{base}.xlsx"),
        ),
        "json" => Json(s).into_response(),
        _ => return Err(ApiError::Validation { field: "format", message: "Format must be pdf, csv, xlsx or json.".into() }),
    })
}

pub async fn statement(State(app): State<App>, u: UserCtx, Path(login): Path<i64>, Query(q): Query<RangeQ>) -> ApiResult<Response> {
    let (from, to) = range(&q, 30)?;
    client::refresh(&app, &u.tenant, u.user_id).await;
    owned(&app, &u.tenant, u.user_id, login).await?;
    let s = statement::generate(&app, &u.tenant, login, from, to).await?;
    let format = q.format.clone().unwrap_or_else(|| "pdf".into());
    if format != "json" {
        db::audit(&app.pool, &u.tenant, &Actor::user(u.user_id), "statement.download", Some(&login.to_string()), Some(serde_json::json!({"from": from, "to": to, "format": format}))).await;
    }
    render(&app, &s, &format, &sections(&q))
}
