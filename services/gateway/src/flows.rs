//! Password check with lockout + audit, shared by client and staff sign-in.

use chrono::Utc;
use serde_json::json;

use crate::audit::{self, Entry};
use crate::crypto;
use crate::error::{ApiError, ApiResult};
use crate::identity::{self, Kind, Principal};
use crate::state::{AppState, Ctx};

pub async fn check_password(st: &AppState, ctx: &Ctx, kind: Kind, tenant_id: i64, email: &str, password: &str) -> ApiResult<Principal> {
    let k = kind.as_str();
    let Some(p) = identity::find_principal(&st.pool, kind, tenant_id, email).await? else {
        // equalise timing with the real path
        identity::verify_password_blocking(password.to_string(), crypto::dummy_hash().to_string()).await;
        audit::record(&st.pool, ctx, Entry {
            tenant_id,
            actor_kind: "anonymous",
            actor_id: None,
            action: if kind == Kind::User { "user.login_failed" } else { "staff.login_failed" },
            target: None,
            meta: json!({"email": email, "reason": "unknown_email"}),
        })
        .await;
        return Err(ApiError::InvalidCredentials);
    };
    let now = Utc::now();
    if let Some(until) = p.locked_until
        && until > now
    {
        return Err(ApiError::Locked { retry_after: (until - now).num_seconds() });
    }
    if !identity::verify_password_blocking(password.to_string(), p.password_hash.clone()).await {
        let pol = identity::policy(kind);
        let (n, lock) = identity::after_failure(p.failed_logins, now, &pol);
        identity::set_failures(&st.pool, kind, p.id, n, lock).await?;
        let action = match (kind, lock.is_some()) {
            (Kind::User, false) => "user.login_failed",
            (Kind::User, true) => "user.locked",
            (Kind::Staff, false) => "staff.login_failed",
            (Kind::Staff, true) => "staff.locked",
        };
        audit::record(&st.pool, ctx, Entry {
            tenant_id,
            actor_kind: k,
            actor_id: Some(p.id),
            action,
            target: Some((k, p.id)),
            meta: json!({"reason": "wrong_password", "failures": if lock.is_some() { pol.max_failures } else { n }}),
        })
        .await;
        if let Some(until) = lock {
            tracing::warn!(kind = k, id = p.id, "account locked after repeated failures");
            return Err(ApiError::Locked { retry_after: (until - now).num_seconds() });
        }
        return Err(ApiError::InvalidCredentials);
    }
    if !p.active {
        if kind == Kind::User && p.status == "blocked" {
            audit::record(&st.pool, ctx, Entry { tenant_id, actor_kind: k, actor_id: Some(p.id), action: "user.login_failed", target: Some((k, p.id)), meta: json!({"reason": "suspended"}) }).await;
            return Err(crate::client_controls::account_suspended());
        }
        return Err(ApiError::AccountDisabled);
    }
    Ok(p)
}
