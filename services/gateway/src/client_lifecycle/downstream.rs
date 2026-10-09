//! The wallet and the trading engine as the delete check sees them. In production `Http` calls the services'
//! internal APIs (`WALLET_URL` / `WALLET_INTERNAL_TOKEN`, `TRADING_URL` / `TRADING_INTERNAL_TOKEN`, the variables the
//! other services read from the same .env.local); tests pass their own `Finance`.
//!
//! * wallet `GET /v1/wallets/{id}/overview` (balances, pending deposits, open withdrawals) and
//!   `GET /v1/wallets/{id}/ledger?limit=1` (`total` = wallet ledger entries ever booked);
//! * engine `GET /v1/accounts?user_id=` (account views), per account `GET /v1/accounts/{login}/archive-check`
//!   (copy / master / PAMM fund / MAM / prop blockers) and, for live accounts, `/history?limit=1` and
//!   `/ledger?limit=1` (`total` = deals and ledger entries ever booked); `GET /v1/social/investments` (PAMM);
//! * engine `POST /v1/admin/accounts/{login}/archive` (staff archive, reason-coded, audited by the engine).

use serde_json::{Value, json};
use std::sync::OnceLock;
use std::time::Duration;

#[derive(Clone, Debug, Default)]
pub struct Balance {
    pub currency: String,
    /// Decimal strings as the wallet sends them.
    pub available: String,
    pub locked: String,
}

#[derive(Clone, Debug, Default)]
pub struct WalletFacts {
    pub balances: Vec<Balance>,
    /// Deposits still pending, confirming or in review.
    pub pending_deposits: usize,
    /// Withdrawals requested, approved or paid (not yet completed).
    pub open_withdrawals: usize,
    /// Wallet ledger transactions ever booked (deposits, transfers, IB commissions, prop fees…).
    pub ledger_entries: i64,
}

#[derive(Clone, Debug, Default)]
pub struct Account {
    pub login: i64,
    pub live: bool,
    pub status: String,
    pub group: String,
    pub currency: String,
    pub balance: f64,
    pub equity: f64,
    pub credit: f64,
    pub bonus: f64,
    pub positions: i64,
    pub orders: i64,
    /// Deals ever booked (live accounts only; 0 for demo).
    pub deals: i64,
    /// Ledger entries ever booked (live accounts only; 0 for demo).
    pub ledger_entries: i64,
    /// What keeps the engine from archiving it: (code, message), e.g. a copy subscription or a PAMM fund.
    pub engine_blockers: Vec<(String, String)>,
}

impl Account {
    pub fn retired(&self) -> bool {
        matches!(self.status.as_str(), "archived" | "closed")
    }
    pub fn prop(&self) -> bool {
        self.group.to_ascii_lowercase().starts_with("prop")
    }
    pub fn holds_money(&self) -> bool {
        [self.balance, self.equity, self.credit, self.bonus].iter().any(|v| v.abs() >= 0.005)
    }
}

#[derive(Clone, Debug, Default)]
pub struct Investment {
    pub fund: String,
    pub value: f64,
    pub pending_requests: usize,
}

#[derive(Clone, Debug, Default)]
pub struct TradingFacts {
    pub accounts: Vec<Account>,
    pub investments: Vec<Investment>,
}

/// The staff member the engine records for the archive (its audit shows them, not "system").
pub struct EngineStaff {
    pub id: i64,
    pub name: String,
    pub role: String,
}

/// Errors are a short reason the Back Office shows after "Couldn't check the wallet: …".
#[allow(async_fn_in_trait)]
pub trait Finance {
    async fn wallet(&self, tenant: &str, user_id: i64) -> Result<WalletFacts, String>;
    async fn trading(&self, tenant: &str, user_id: i64) -> Result<TradingFacts, String>;
    /// Archives one account (demo accounts are emptied first: orders cancelled, positions closed).
    async fn archive(&self, tenant: &str, staff: &EngineStaff, account: &Account, note: &str) -> Result<(), String>;
}

pub struct Http {
    http: reqwest::Client,
    wallet_url: String,
    wallet_token: String,
    trading_url: String,
    trading_token: String,
}

/// The process-wide client, configured from the environment on first use.
pub fn http() -> &'static Http {
    static H: OnceLock<Http> = OnceLock::new();
    H.get_or_init(|| {
        let var = |k: &str, d: &str| std::env::var(k).ok().map(|v| v.trim().trim_end_matches('/').to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| d.to_string());
        Http {
            http: reqwest::Client::builder().timeout(Duration::from_secs(10)).build().expect("http client"),
            wallet_url: var("WALLET_URL", "http://127.0.0.1:8095"),
            wallet_token: var("WALLET_INTERNAL_TOKEN", ""),
            trading_url: var("TRADING_URL", "http://127.0.0.1:8090"),
            trading_token: var("TRADING_INTERNAL_TOKEN", ""),
        }
    })
}

fn message(v: &Value, fallback: &str) -> String {
    v.pointer("/error/message").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| fallback.to_string())
}

// An answer missing a field the verdict depends on is an error, never a zero: the check fails closed.
fn odd(key: &str) -> String {
    format!("unexpected answer ({key} missing)")
}

fn num(v: &Value, key: &str) -> Result<f64, String> {
    let x = &v[key];
    x.as_f64().or_else(|| x.as_str().and_then(|s| s.parse().ok())).ok_or_else(|| odd(key))
}

fn int(v: &Value, key: &str) -> Result<i64, String> {
    v[key].as_i64().ok_or_else(|| odd(key))
}

fn list<'a>(v: &'a Value, key: &str) -> Result<&'a Vec<Value>, String> {
    v[key].as_array().ok_or_else(|| odd(key))
}

impl Http {
    /// GET on the wallet (`wallet = true`) or the engine. Errors: "not reachable" or "<message> (HTTP <status>)".
    async fn get(&self, wallet: bool, tenant: &str, path: &str, user: Option<i64>) -> Result<Value, String> {
        let (base, token) = if wallet { (&self.wallet_url, &self.wallet_token) } else { (&self.trading_url, &self.trading_token) };
        let mut rb = self.http.get(format!("{base}{path}")).header("x-ezymex-internal", token).header("x-ezymex-tenant", tenant).header("user-agent", "ezymex-gateway");
        if let Some(u) = user {
            rb = rb.header("x-ezymex-user-id", u.to_string());
        }
        let r = rb.send().await.map_err(|_| "not reachable".to_string())?;
        let status = r.status().as_u16();
        let v: Value = r.json().await.unwrap_or(Value::Null);
        if status != 200 {
            return Err(format!("{} (HTTP {status})", message(&v, "error").trim_end_matches('.')));
        }
        Ok(v)
    }
}

impl Finance for Http {
    async fn wallet(&self, tenant: &str, user_id: i64) -> Result<WalletFacts, String> {
        let o = self.get(true, tenant, &format!("/v1/wallets/{user_id}/overview"), None).await?;
        let l = self.get(true, tenant, &format!("/v1/wallets/{user_id}/ledger?limit=1"), None).await?;
        // amounts stay the wallet's decimal strings; anything else reads as money (decide: nonzero)
        let s = |v: &Value| v.as_str().map(str::to_string).unwrap_or_else(|| v.to_string());
        Ok(WalletFacts {
            balances: list(&o, "balances")?.iter().map(|b| Balance { currency: s(&b["currency"]), available: s(&b["available"]), locked: s(&b["locked"]) }).collect(),
            pending_deposits: list(&o, "pending_deposits")?.len(),
            open_withdrawals: list(&o, "open_withdrawals")?.len(),
            ledger_entries: int(&l, "total")?,
        })
    }

    async fn trading(&self, tenant: &str, user_id: i64) -> Result<TradingFacts, String> {
        let v = self.get(false, tenant, &format!("/v1/accounts?user_id={user_id}"), Some(user_id)).await?;
        let mut accounts = Vec::new();
        for a in list(&v, "accounts")? {
            let login = int(a, "login")?;
            let mut acc = Account {
                login,
                live: a["type"].as_str().ok_or_else(|| odd("type"))? == "live",
                status: a["status"].as_str().ok_or_else(|| odd("status"))?.to_string(),
                group: a["group"].as_str().unwrap_or("").to_string(),
                currency: a["currency"].as_str().unwrap_or("USD").to_string(),
                balance: num(a, "balance")?,
                equity: num(a, "equity")?,
                credit: num(a, "credit")?,
                bonus: num(a, "bonus")?,
                positions: int(a, "positions")?,
                orders: int(a, "orders")?,
                ..Default::default()
            };
            if !acc.retired() {
                let c = self.get(false, tenant, &format!("/v1/accounts/{login}/archive-check?user_id={user_id}"), Some(user_id)).await?;
                acc.engine_blockers = list(&c, "blockers")?.iter().map(|x| (x["code"].as_str().unwrap_or("").to_string(), x["message"].as_str().unwrap_or("").to_string())).collect();
            }
            if acc.live {
                let h = self.get(false, tenant, &format!("/v1/accounts/{login}/history?user_id={user_id}&limit=1"), Some(user_id)).await?;
                let l = self.get(false, tenant, &format!("/v1/accounts/{login}/ledger?user_id={user_id}&limit=1"), Some(user_id)).await?;
                acc.deals = int(&h, "total")?;
                acc.ledger_entries = int(&l, "total")?;
            }
            accounts.push(acc);
        }
        let inv = self.get(false, tenant, "/v1/social/investments", Some(user_id)).await?;
        let investments = list(&inv, "items")?
            .iter()
            .map(|i| {
                Ok(Investment {
                    fund: i["fund"]["name"].as_str().unwrap_or("a PAMM fund").to_string(),
                    value: num(i, "value")?,
                    pending_requests: i["pending"].as_array().map_or(0, Vec::len),
                })
            })
            .collect::<Result<Vec<_>, String>>()?;
        Ok(TradingFacts { accounts, investments })
    }

    async fn archive(&self, tenant: &str, staff: &EngineStaff, account: &Account, note: &str) -> Result<(), String> {
        let name: String = staff.name.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect();
        let body = json!({ "reasonCode": "ARC-06 · Client deleted", "note": note, "clientRestorable": false, "empty": !account.live });
        let r = self
            .http
            .post(format!("{}/v1/admin/accounts/{}/archive", self.trading_url, account.login))
            .header("x-ezymex-internal", &self.trading_token)
            .header("x-ezymex-tenant", tenant)
            .header("x-ezymex-staff-id", staff.id.to_string())
            .header("x-ezymex-staff-name", name)
            .header("x-ezymex-staff-role", &staff.role)
            .header("user-agent", "ezymex-gateway")
            .json(&body)
            .send()
            .await
            .map_err(|_| "the trading engine is not reachable".to_string())?;
        let status = r.status().as_u16();
        let v: Value = r.json().await.unwrap_or(Value::Null);
        if status == 200 { Ok(()) } else { Err(format!("{} (HTTP {status})", message(&v, "refused").trim_end_matches('.'))) }
    }
}

#[cfg(test)]
mod tests {
    //! The HTTP client against a local stand-in that answers with the wallet's and the engine's shapes.
    use super::*;
    use axum::extract::{Path, Query};
    use axum::http::{HeaderMap, StatusCode};
    use axum::routing::{get, post};
    use axum::{Json, Router};
    use std::collections::HashMap;

    async fn serve(app: Router) -> String {
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = l.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
        format!("http://{addr}")
    }

    fn client(base: &str) -> Http {
        Http { http: reqwest::Client::new(), wallet_url: base.into(), wallet_token: "w".into(), trading_url: base.into(), trading_token: "t".into() }
    }

    fn stand_in() -> Router {
        Router::new()
            .route("/v1/wallets/{id}/overview", get(|| async { Json(json!({ "balances": [{ "currency": "USDT", "available": "0", "locked": "12.500000" }], "pending_deposits": [], "open_withdrawals": [{ "id": 9 }] })) }))
            .route("/v1/wallets/{id}/ledger", get(|| async { Json(json!({ "items": [], "page": 1, "limit": 1, "total": 4 })) }))
            .route(
                "/v1/accounts",
                get(|h: HeaderMap, Query(q): Query<HashMap<String, String>>| async move {
                    assert_eq!((h["x-ezymex-internal"].to_str().unwrap(), h["x-ezymex-tenant"].to_str().unwrap()), ("t", "ezymex"));
                    assert_eq!(q["user_id"], "42");
                    Json(json!({ "accounts": [
                        { "login": 10000042, "type": "live", "status": "active", "group": "standard", "currency": "USD", "balance": 0, "equity": 0, "credit": 0, "bonus": 0, "positions": 0, "orders": 0 },
                        { "login": 50000042, "type": "demo", "status": "archived", "group": "standard", "currency": "USD", "balance": 10000, "equity": 10000, "credit": 0, "bonus": 0, "positions": 0, "orders": 0 },
                    ] }))
                }),
            )
            .route("/v1/accounts/{login}/archive-check", get(|| async { Json(json!({ "canArchive": false, "blockers": [{ "code": "copy_subscription", "message": "Stop copying first." }] })) }))
            .route("/v1/accounts/{login}/history", get(|| async { Json(json!({ "deals": [], "orders": [], "total": 3 })) }))
            .route("/v1/accounts/{login}/ledger", get(|| async { Json(json!({ "items": [], "total": 2 })) }))
            .route("/v1/social/investments", get(|| async { Json(json!({ "items": [{ "fundId": 2, "fund": { "name": "Gold Swing" }, "value": 997.9, "pending": [] }], "requests": [] })) }))
            .route(
                "/v1/admin/accounts/{login}/archive",
                post(|Path(login): Path<i64>, h: HeaderMap, Json(b): Json<Value>| async move {
                    assert_eq!((h["x-ezymex-staff-role"].to_str().unwrap(), h["x-ezymex-staff-name"].to_str().unwrap()), ("admin", "Jos%C3%A9%20Ruiz"));
                    assert_eq!((b["reasonCode"].as_str().unwrap().starts_with("ARC-06"), b["empty"].as_bool()), (true, Some(false)));
                    if login == 1 {
                        return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({ "error": { "code": "not_empty", "message": "Close all positions first." } })));
                    }
                    (StatusCode::OK, Json(json!({ "data": { "status": "archived" } })))
                }),
            )
    }

    #[tokio::test]
    async fn reads_the_wallet_and_the_engine() {
        let f = client(&serve(stand_in()).await);
        let w = f.wallet("ezymex", 42).await.unwrap();
        assert_eq!((w.balances[0].locked.as_str(), w.open_withdrawals, w.pending_deposits, w.ledger_entries), ("12.500000", 1, 0, 4));
        let t = f.trading("ezymex", 42).await.unwrap();
        let (live, demo) = (&t.accounts[0], &t.accounts[1]);
        assert_eq!((live.login, live.live, live.deals, live.ledger_entries), (10_000_042, true, 3, 2));
        assert_eq!(live.engine_blockers, vec![("copy_subscription".to_string(), "Stop copying first.".to_string())]);
        // an archived account is not asked again; demo history doesn't matter
        assert!(demo.retired() && demo.engine_blockers.is_empty() && demo.deals == 0);
        assert_eq!((t.investments[0].fund.as_str(), t.investments[0].value), ("Gold Swing", 997.9));

        let staff = EngineStaff { id: 7, name: "José Ruiz".into(), role: "admin".into() };
        f.archive("ezymex", &staff, live, "Client #42 deleted").await.unwrap();
        let refused = f.archive("ezymex", &staff, &Account { login: 1, live: true, ..Default::default() }, "x").await.unwrap_err();
        assert_eq!(refused, "Close all positions first (HTTP 422)");
    }

    #[tokio::test]
    async fn odd_or_missing_answers_fail_closed() {
        let odd = Router::new()
            .route("/v1/wallets/{id}/overview", get(|| async { Json(json!({ "balances": [] })) }))
            .route("/v1/wallets/{id}/ledger", get(|| async { Json(json!({ "items": [] })) }))
            .route("/v1/accounts", get(|| async { (StatusCode::FORBIDDEN, Json(json!({ "error": { "code": "forbidden", "message": "Missing internal token." } }))) }));
        let f = client(&serve(odd).await);
        assert_eq!(f.wallet("ezymex", 1).await.unwrap_err(), "unexpected answer (pending_deposits missing)");
        assert_eq!(f.trading("ezymex", 1).await.unwrap_err(), "Missing internal token (HTTP 403)");
        assert_eq!(client("http://127.0.0.1:9").wallet("ezymex", 1).await.unwrap_err(), "not reachable");
    }
}
