//! Gateway client: the client's KYC / account status and restrictions (`GET /v1/internal/users/{id}`, internal
//! token only).

use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct UserInfo {
    pub id: i64,
    pub tenant_id: i64,
    pub email: String,
    pub name: String,
    pub kyc_status: String,
    pub status: String,
    /// Effective restrictions set in the Back Office (gateway client_controls.rs, `freeze` expanded). The wallet
    /// enforces `deposits`, `withdrawals`, `transfers` (wallet <-> trading account) and `ib` (IB payouts).
    pub restrictions: Vec<String>,
}

#[async_trait]
pub trait Users: Send + Sync {
    /// Ok(None) = no such user; Err = gateway unreachable.
    async fn get(&self, tenant: &str, user_id: i64) -> anyhow::Result<Option<UserInfo>>;

    /// A broker by slug from the gateway (`GET /v1/internal/tenants/{slug}`): Ok(Some((id, name))), Ok(None) = no
    /// such broker, Err = gateway unreachable. Used to provision a broker the Platform Owner created (state.rs).
    async fn tenant(&self, _slug: &str) -> anyhow::Result<Option<(i64, String)>> {
        Ok(None)
    }
}

pub struct GatewayUsers {
    http: reqwest::Client,
    base: String,
    token: String,
}

impl GatewayUsers {
    pub fn new(base: String, token: String) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(8)).build().expect("http client");
        Self { http, base, token }
    }
}

#[async_trait]
impl Users for GatewayUsers {
    async fn get(&self, tenant: &str, user_id: i64) -> anyhow::Result<Option<UserInfo>> {
        let r = self
            .http
            .get(format!("{}/v1/internal/users/{user_id}", self.base))
            .header("x-ezymex-internal", &self.token)
            .header("x-ezymex-tenant", tenant)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("gateway: {}", e.without_url()))?;
        match r.status().as_u16() {
            404 => return Ok(None),
            200 => {}
            s => anyhow::bail!("gateway: http {s}"),
        }
        let v: Value = r.json().await?;
        let u = v.get("user").unwrap_or(&v);
        let s = |k: &str| u.get(k).and_then(Value::as_str).unwrap_or("").to_string();
        Ok(Some(UserInfo {
            id: u.get("id").and_then(Value::as_i64).unwrap_or(user_id),
            tenant_id: u.get("tenant_id").and_then(Value::as_i64).unwrap_or(0),
            email: s("email"),
            name: s("name"),
            kyc_status: s("kyc_status"),
            status: s("status"),
            restrictions: u.get("restrictions").and_then(Value::as_array).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(),
        }))
    }

    async fn tenant(&self, slug: &str) -> anyhow::Result<Option<(i64, String)>> {
        let r = self
            .http
            .get(format!("{}/v1/internal/tenants/{slug}", self.base))
            .header("x-ezymex-internal", &self.token)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("gateway: {}", e.without_url()))?;
        match r.status().as_u16() {
            404 => return Ok(None),
            200 => {}
            s => anyhow::bail!("gateway: http {s}"),
        }
        let v: Value = r.json().await?;
        let id = v.get("id").and_then(Value::as_i64).filter(|id| *id > 0).ok_or_else(|| anyhow::anyhow!("gateway: tenant without id"))?;
        Ok(Some((id, v.get("name").and_then(Value::as_str).unwrap_or(slug).to_string())))
    }
}

/// Test double: users and their KYC status set by the test; brokers the "gateway" knows in `tenants`.
#[derive(Default)]
pub struct MockUsers(pub Mutex<HashMap<i64, UserInfo>>, pub Mutex<HashMap<String, (i64, String)>>);

impl MockUsers {
    pub fn set(&self, id: i64, kyc: &str) {
        self.0.lock().unwrap().insert(id, UserInfo { id, tenant_id: 1, email: format!("u{id}@example.com"), name: format!("User {id}"), kyc_status: kyc.into(), status: "active".into(), restrictions: vec![] });
    }

    /// Restrictions of a known user (set it first with `set`).
    pub fn restrict(&self, id: i64, kinds: &[&str]) {
        if let Some(u) = self.0.lock().unwrap().get_mut(&id) {
            u.restrictions = kinds.iter().map(|k| k.to_string()).collect();
        }
    }
}

#[async_trait]
impl Users for MockUsers {
    async fn get(&self, _tenant: &str, user_id: i64) -> anyhow::Result<Option<UserInfo>> {
        Ok(self.0.lock().unwrap().get(&user_id).cloned())
    }

    async fn tenant(&self, slug: &str) -> anyhow::Result<Option<(i64, String)>> {
        Ok(self.1.lock().unwrap().get(slug).cloned())
    }
}

/// Refuses a wallet operation of `kind` (`deposits` | `withdrawals` | `transfers` | `ib`) for a client the Back
/// Office restricted. A client the gateway doesn't know is left to the other checks; an unreachable gateway
/// refuses (fail closed).
pub async fn gate(st: &crate::state::AppState, tenant_slug: &str, user_id: i64, kind: &str) -> Result<(), crate::error::ApiError> {
    let u = st.users.get(tenant_slug, user_id).await.map_err(|e| {
        tracing::warn!(error = %e, "gateway unavailable for the restriction check");
        crate::error::ApiError::Coded { status: axum::http::StatusCode::SERVICE_UNAVAILABLE, code: "unavailable", message: "Your account status is unavailable. Please try again shortly.".into() }
    })?;
    match u {
        Some(u) if u.restrictions.iter().any(|k| k == kind) => Err(restricted(kind)),
        _ => Ok(()),
    }
}

pub fn restricted(kind: &str) -> crate::error::ApiError {
    let message = match kind {
        "deposits" => "Deposits are disabled on your account. Contact support.",
        "withdrawals" => "Withdrawals are disabled on your account. Contact support.",
        "transfers" => "Transfers between your wallet and trading accounts are disabled on your account. Contact support.",
        "ib" => "Partner commissions and payouts are on hold for this account. Contact support.",
        _ => "This isn't available on your account. Contact support.",
    };
    crate::error::ApiError::Coded { status: axum::http::StatusCode::FORBIDDEN, code: "restricted", message: message.into() }
}
