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

/// `GET /v1/me/accounts/{login}/history.zip` (B10): the account's full history (up to 10 years) in one download:
/// the PDF statement plus the same data as CSV and Excel.
pub async fn history_zip(State(app): State<App>, u: UserCtx, Path(login): Path<i64>) -> ApiResult<Response> {
    client::refresh(&app, &u.tenant, u.user_id).await;
    owned(&app, &u.tenant, u.user_id, login).await?;
    let to = chrono::Utc::now();
    let s = statement::generate(&app, &u.tenant, login, to - chrono::Duration::days(3650), to).await?;
    let sec = Sections { open: true, charges: true, deals: true };
    let pdf = export::statement_pdf(&s, &app.cfg.company_name, &app.cfg.company_site, &app.cfg.support_email, &sec);
    let tables = export::statement_tables(&s, &sec);
    let csv = export::csv(&tables);
    let xlsx = export::xlsx(&tables).map_err(ApiError::Internal)?;
    let base = format!("kalks-{login}-history");
    let names = [format!("{base}/statement.pdf"), format!("{base}/statement.csv"), format!("{base}/statement.xlsx")];
    let zip = crate::zip::store(&[(&names[0], &pdf), (&names[1], &csv), (&names[2], &xlsx)], to);
    db::audit(&app.pool, &u.tenant, &Actor::user(u.user_id), "statement.history_zip", Some(&login.to_string()), None).await;
    Ok(super::file(zip, "application/zip", &format!("{base}-{}.zip", time::server_day(to))))
}

#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FinalStatementReq {
    #[serde(default, alias = "user_id")]
    pub user_id: i64,
    /// archived | closed
    #[serde(default)]
    pub reason: String,
}

/// `POST /v1/internal/accounts/{login}/final-statement {userId, reason}` (B10): the trading engine archived or
/// closed the account; the client gets its final statement (PDF, full history) by email. Without SMTP the email is
/// logged (development). `{status: sent | logged | no_email}`.
pub async fn final_statement(State(app): State<App>, super::Tenant(tenant): super::Tenant, Path(login): Path<i64>, axum::Json(b): axum::Json<FinalStatementReq>) -> ApiResult<Json<Value>> {
    if b.user_id <= 0 {
        return Err(ApiError::Validation { field: "userId", message: "userId is required.".into() });
    }
    client::refresh(&app, &tenant, b.user_id).await;
    owned(&app, &tenant, b.user_id, login).await?;
    let email: Option<String> = sqlx::query_scalar("SELECT email FROM clients WHERE tenant = $1 AND user_id = $2").bind(&tenant).bind(b.user_id).fetch_optional(&app.pool).await?;
    let Some(email) = email.filter(|e| e.contains('@')) else {
        return Ok(Json(serde_json::json!({"status": "no_email"})));
    };
    let to = chrono::Utc::now();
    let s = statement::generate(&app, &tenant, login, to - chrono::Duration::days(3650), to).await?;
    let sec = Sections { open: true, charges: true, deals: true };
    let pdf = export::statement_pdf(&s, &app.cfg.company_name, &app.cfg.company_site, &app.cfg.support_email, &sec);
    let what = if b.reason == "closed" { "closed" } else { "archived" };
    let subject = format!("{}: final statement for account #{login}", app.cfg.company_name);
    let text = format!(
        "Your trading account #{login} was {what}. Attached is its final statement with the full history.\n\nThe statement and history also stay available in the Client Area under Accounts > Archived.\n\n{}",
        app.cfg.company_name
    );
    let html = format!(
        "<p>Your trading account <b>#{login}</b> was {what}. Attached is its final statement with the full history.</p><p>The statement and history also stay available in the Client Area under Accounts &rsaquo; Archived.</p><p>{}</p>",
        app.cfg.company_name
    );
    let file = format!("kalks-{login}-final-statement.pdf");
    let size = pdf.len();
    let status = match &app.mailer {
        Some(m) => {
            m.send(crate::mailer::Mail { to: std::slice::from_ref(&email), subject: &subject, text: &text, html: &html, attachment: Some((&file, "application/pdf", pdf)) }).await.map_err(ApiError::Internal)?;
            "sent"
        }
        None => {
            tracing::info!(login, %email, file, size, "DEV final statement email (SMTP not configured)");
            "logged"
        }
    };
    db::audit(&app.pool, &tenant, &Actor::user(b.user_id), "statement.final", Some(&login.to_string()), Some(serde_json::json!({"reason": what, "status": status}))).await;
    Ok(Json(serde_json::json!({"status": status})))
}
