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

fn n(v: &Value) -> f64 {
    v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0)
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
        let s = |v: &Value| v.as_str().map(str::to_string).unwrap_or_else(|| v.to_string());
        Ok(WalletFacts {
            balances: o["balances"]
                .as_array()
                .map(|a| a.iter().map(|b| Balance { currency: s(&b["currency"]), available: s(&b["available"]), locked: s(&b["locked"]) }).collect())
                .unwrap_or_default(),
            pending_deposits: o["pending_deposits"].as_array().map_or(0, Vec::len),
            open_withdrawals: o["open_withdrawals"].as_array().map_or(0, Vec::len),
            ledger_entries: l["total"].as_i64().unwrap_or(0),
        })
    }

    async fn trading(&self, tenant: &str, user_id: i64) -> Result<TradingFacts, String> {
        let v = self.get(false, tenant, &format!("/v1/accounts?user_id={user_id}"), Some(user_id)).await?;
        let mut accounts = Vec::new();
        for a in v["accounts"].as_array().cloned().unwrap_or_default() {
            let login = a["login"].as_i64().unwrap_or(0);
            let mut acc = Account {
                login,
                live: a["type"] == "live",
                status: a["status"].as_str().unwrap_or("").to_string(),
                group: a["group"].as_str().unwrap_or("").to_string(),
                currency: a["currency"].as_str().unwrap_or("USD").to_string(),
                balance: n(&a["balance"]),
                equity: n(&a["equity"]),
                credit: n(&a["credit"]),
                bonus: n(&a["bonus"]),
                positions: a["positions"].as_i64().unwrap_or(0),
                orders: a["orders"].as_i64().unwrap_or(0),
                ..Default::default()
            };
            if !acc.retired() {
                let c = self.get(false, tenant, &format!("/v1/accounts/{login}/archive-check?user_id={user_id}"), Some(user_id)).await?;
                acc.engine_blockers = c["blockers"]
                    .as_array()
                    .map(|b| b.iter().map(|x| (x["code"].as_str().unwrap_or("").to_string(), x["message"].as_str().unwrap_or("").to_string())).collect())
                    .unwrap_or_default();
            }
            if acc.live {
                let h = self.get(false, tenant, &format!("/v1/accounts/{login}/history?user_id={user_id}&limit=1"), Some(user_id)).await?;
                let l = self.get(false, tenant, &format!("/v1/accounts/{login}/ledger?user_id={user_id}&limit=1"), Some(user_id)).await?;
                acc.deals = h["total"].as_i64().unwrap_or(0);
                acc.ledger_entries = l["total"].as_i64().unwrap_or(0);
            }
            accounts.push(acc);
        }
        let inv = self.get(false, tenant, "/v1/social/investments", Some(user_id)).await?;
        let investments = inv["items"]
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|i| Investment {
                        fund: i["fund"]["name"].as_str().unwrap_or("a PAMM fund").to_string(),
                        value: n(&i["value"]),
                        pending_requests: i["pending"].as_array().map_or(0, Vec::len),
                    })
                    .collect()
            })
            .unwrap_or_default();
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
