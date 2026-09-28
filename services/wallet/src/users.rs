//! Gateway client: the client's KYC / account status (`GET /v1/internal/users/{id}`, internal token only).

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
}

#[async_trait]
pub trait Users: Send + Sync {
    /// Ok(None) = no such user; Err = gateway unreachable.
    async fn get(&self, tenant: &str, user_id: i64) -> anyhow::Result<Option<UserInfo>>;
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
            .header("x-kalks-internal", &self.token)
            .header("x-kalks-tenant", tenant)
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
        }))
    }
}

/// Test double: users and their KYC status set by the test.
#[derive(Default)]
pub struct MockUsers(pub Mutex<HashMap<i64, UserInfo>>);

impl MockUsers {
    pub fn set(&self, id: i64, kyc: &str) {
        self.0.lock().unwrap().insert(id, UserInfo { id, tenant_id: 1, email: format!("u{id}@example.com"), name: format!("User {id}"), kyc_status: kyc.into(), status: "active".into() });
    }
}

#[async_trait]
impl Users for MockUsers {
    async fn get(&self, _tenant: &str, user_id: i64) -> anyhow::Result<Option<UserInfo>> {
        Ok(self.0.lock().unwrap().get(&user_id).cloned())
    }
}
