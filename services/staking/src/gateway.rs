//! Gateway client: a client's KYC status, account status and Back Office restrictions
//! (`GET /v1/internal/users/{id}`, internal token, scoped to the tenant header).

use crate::state::AppState;
use serde_json::Value;

#[derive(Clone, Debug)]
pub struct GwUser {
    pub kyc_status: String,
    pub status: String,
    /// Effective restriction kinds (freeze expanded): deposits, withdrawals, transfers, …
    pub restrictions: Vec<String>,
    pub name: String,
}

/// Wallet restrictions that also stop a subscription (moving funds out of the wallet).
pub const BLOCKING: &[&str] = &["deposits", "withdrawals", "transfers"];

impl GwUser {
    pub fn blocked_by(&self) -> Option<&str> {
        self.restrictions.iter().map(String::as_str).find(|r| BLOCKING.contains(r))
    }
}

/// Ok(None) = the gateway doesn't know the client; Err = gateway unreachable (callers fail closed).
pub async fn user(st: &AppState, tenant: &str, user_id: i64) -> Result<Option<GwUser>, String> {
    let r = st
        .http
        .get(format!("{}/v1/internal/users/{user_id}", st.cfg.gateway_url))
        .header("x-ezymex-internal", &st.cfg.gateway_token)
        .header("x-ezymex-tenant", tenant)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| format!("gateway: {}", e.without_url()))?;
    match r.status().as_u16() {
        404 => return Ok(None),
        200 => {}
        s => return Err(format!("gateway: http {s}")),
    }
    let v: Value = r.json().await.map_err(|e| format!("gateway: {e}"))?;
    let u = v.get("user").unwrap_or(&v);
    let s = |k: &str| u.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    Ok(Some(GwUser {
        kyc_status: s("kyc_status"),
        status: s("status"),
        name: s("name").trim().to_string(),
        restrictions: u.get("restrictions").and_then(Value::as_array).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(),
    }))
}
