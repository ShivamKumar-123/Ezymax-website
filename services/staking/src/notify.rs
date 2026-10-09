//! Client notifications through the support service (`POST $NOTIFY_URL/v1/notify`, category `staking`). Best
//! effort: a notification never fails or delays the money flow that triggered it. The dedupe key makes a retried
//! worker pass send each notice once.

use crate::state::AppState;
use serde_json::json;

pub fn send(st: &AppState, tenant: &str, user_id: i64, kind: &str, title: String, body: String, dedupe: String) {
    let st = st.clone();
    let payload = json!({"userId": user_id, "type": kind, "title": title, "body": body, "link": "/staking/portfolio", "dedupeKey": dedupe, "severity": "success"});
    let tenant = tenant.to_string();
    tokio::spawn(async move {
        let r = st
            .http
            .post(format!("{}/v1/notify", st.cfg.notify_url))
            .header("x-ezymex-internal", &st.cfg.notify_token)
            .header("x-ezymex-tenant", tenant)
            .header("x-ezymex-service", "staking")
            .timeout(std::time::Duration::from_secs(5))
            .json(&payload)
            .send()
            .await;
        if let Err(e) = r {
            tracing::debug!(error = %e.without_url(), "notify skipped");
        }
    });
}
