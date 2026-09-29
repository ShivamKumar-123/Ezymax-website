//! SLA and CSAT statistics for the Back Office (Support -> CSAT, inbox header).

use crate::db;
use crate::error::ApiResult;
use crate::state::AppState;
use serde_json::{Value, json};
use sqlx::Row;

pub async fn stats(st: &AppState, tenant: &str, days: i64) -> ApiResult<Value> {
    let days = days.clamp(1, 365);
    let s = db::settings(&st.pool, tenant).await?;
    let now = sqlx::query(
        "SELECT count(*) FILTER (WHERE status = 'bot') AS bot, count(*) FILTER (WHERE status = 'waiting') AS waiting,
                count(*) FILTER (WHERE status = 'assigned') AS assigned,
                count(*) FILTER (WHERE status IN ('waiting', 'assigned') AND (sla_breached OR sla_due_at < now())) AS breached,
                COALESCE(max(EXTRACT(EPOCH FROM now() - handed_over_at)) FILTER (WHERE status = 'waiting'), 0)::float8 AS longest_wait
         FROM conversations WHERE tenant = $1 AND status <> 'resolved'",
    )
    .bind(tenant)
    .fetch_one(&st.pool)
    .await?;
    let p = sqlx::query(
        "SELECT count(*) AS total,
                count(*) FILTER (WHERE handed_over_at IS NULL) AS bot_only,
                count(*) FILTER (WHERE status = 'resolved' AND handed_over_at IS NULL) AS bot_resolved,
                count(*) FILTER (WHERE handed_over_at IS NOT NULL) AS handed_over,
                avg(EXTRACT(EPOCH FROM first_response_at - handed_over_at)) FILTER (WHERE first_response_at IS NOT NULL AND handed_over_at IS NOT NULL)::float8 AS avg_first,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM first_response_at - handed_over_at)) FILTER (WHERE first_response_at IS NOT NULL AND handed_over_at IS NOT NULL)::float8 AS median_first,
                count(*) FILTER (WHERE first_response_at IS NOT NULL AND handed_over_at IS NOT NULL AND first_response_at - handed_over_at <= make_interval(secs => $3)) AS within_sla,
                count(*) FILTER (WHERE first_response_at IS NOT NULL AND handed_over_at IS NOT NULL) AS responded,
                count(*) FILTER (WHERE sla_breached) AS breached,
                avg(csat_rating)::float8 AS csat_avg, count(csat_rating) AS csat_count,
                count(*) FILTER (WHERE csat_rating >= 4) AS csat_good,
                avg(EXTRACT(EPOCH FROM resolved_at - created_at)) FILTER (WHERE resolved_at IS NOT NULL)::float8 AS avg_resolution
         FROM conversations WHERE tenant = $1 AND created_at > now() - make_interval(days => $2)",
    )
    .bind(tenant)
    .bind(days as i32)
    .bind(s.sla_first_secs as f64)
    .fetch_one(&st.pool)
    .await?;
    let dist: Vec<i64> = {
        let rows = sqlx::query("SELECT csat_rating, count(*) AS n FROM conversations WHERE tenant = $1 AND csat_rating IS NOT NULL AND created_at > now() - make_interval(days => $2) GROUP BY 1")
            .bind(tenant)
            .bind(days as i32)
            .fetch_all(&st.pool)
            .await?;
        let mut d = vec![0i64; 5];
        for r in rows {
            let k: i16 = r.get("csat_rating");
            d[(k as usize).clamp(1, 5) - 1] = r.get("n");
        }
        d
    };
    let series: Vec<Value> = sqlx::query(
        "SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Etc/GMT-3'), 'YYYY-MM-DD') AS day, count(*) AS created,
                count(*) FILTER (WHERE handed_over_at IS NOT NULL) AS handed_over, count(*) FILTER (WHERE status = 'resolved') AS resolved,
                avg(csat_rating)::float8 AS csat
         FROM conversations WHERE tenant = $1 AND created_at > now() - make_interval(days => $2) GROUP BY 1 ORDER BY 1",
    )
    .bind(tenant)
    .bind(days as i32)
    .fetch_all(&st.pool)
    .await?
    .iter()
    .map(|r| json!({"day": r.get::<String, _>("day"), "created": r.get::<i64, _>("created"), "handedOver": r.get::<i64, _>("handed_over"), "resolved": r.get::<i64, _>("resolved"), "csat": r.get::<Option<f64>, _>("csat")}))
    .collect();
    let agents: Vec<Value> = sqlx::query(
        "SELECT assignee_id, max(assignee_name) AS name, count(*) AS conversations, count(*) FILTER (WHERE status = 'resolved') AS resolved,
                avg(csat_rating)::float8 AS csat, count(csat_rating) AS ratings,
                avg(EXTRACT(EPOCH FROM first_response_at - handed_over_at)) FILTER (WHERE first_response_at IS NOT NULL AND handed_over_at IS NOT NULL)::float8 AS avg_first
         FROM conversations WHERE tenant = $1 AND assignee_id IS NOT NULL AND created_at > now() - make_interval(days => $2)
         GROUP BY assignee_id ORDER BY conversations DESC LIMIT 50",
    )
    .bind(tenant)
    .bind(days as i32)
    .fetch_all(&st.pool)
    .await?
    .iter()
    .map(|r| json!({"id": r.get::<String, _>("assignee_id"), "name": r.get::<Option<String>, _>("name"), "conversations": r.get::<i64, _>("conversations"), "resolved": r.get::<i64, _>("resolved"), "csat": r.get::<Option<f64>, _>("csat"), "ratings": r.get::<i64, _>("ratings"), "avgFirstResponseSecs": r.get::<Option<f64>, _>("avg_first")}))
    .collect();
    let recent: Vec<Value> = sqlx::query(
        "SELECT id, user_name, csat_rating, csat_comment, csat_at, assignee_name, handed_over_at IS NULL AS bot_only FROM conversations
         WHERE tenant = $1 AND csat_rating IS NOT NULL ORDER BY csat_at DESC LIMIT 20",
    )
    .bind(tenant)
    .fetch_all(&st.pool)
    .await?
    .iter()
    .map(|r| json!({"conversationId": r.get::<i64, _>("id"), "client": r.get::<String, _>("user_name"), "rating": r.get::<i16, _>("csat_rating"), "comment": r.get::<Option<String>, _>("csat_comment"), "at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("csat_at"), "agent": r.get::<Option<String>, _>("assignee_name"), "botOnly": r.get::<bool, _>("bot_only")}))
    .collect();
    let total: i64 = p.get("total");
    let responded: i64 = p.get("responded");
    let csat_count: i64 = p.get("csat_count");
    let pct = |a: i64, b: i64| if b > 0 { Some(((a as f64) * 1000.0 / b as f64).round() / 10.0) } else { None };
    Ok(json!({
        "days": days,
        "slaFirstSecs": s.sla_first_secs,
        "slaReplySecs": s.sla_reply_secs,
        "now": {"bot": now.get::<i64, _>("bot"), "waiting": now.get::<i64, _>("waiting"), "assigned": now.get::<i64, _>("assigned"), "breached": now.get::<i64, _>("breached"), "longestWaitSecs": now.get::<f64, _>("longest_wait"), "agentsOnline": st.hub.staff_online_ids(tenant).len()},
        "period": {
            "conversations": total,
            "botOnly": p.get::<i64, _>("bot_only"),
            "botResolved": p.get::<i64, _>("bot_resolved"),
            "handedOver": p.get::<i64, _>("handed_over"),
            "botContainmentPct": pct(p.get::<i64, _>("bot_only"), total),
            "avgFirstResponseSecs": p.get::<Option<f64>, _>("avg_first"),
            "medianFirstResponseSecs": p.get::<Option<f64>, _>("median_first"),
            "slaMetPct": pct(p.get::<i64, _>("within_sla"), responded),
            "breached": p.get::<i64, _>("breached"),
            "avgResolutionSecs": p.get::<Option<f64>, _>("avg_resolution"),
            "csatAvg": p.get::<Option<f64>, _>("csat_avg").map(|x| (x * 100.0).round() / 100.0),
            "csatCount": csat_count,
            "csatPct": pct(p.get::<i64, _>("csat_good"), csat_count),
            "csatDistribution": dist,
        },
        "series": series,
        "agents": agents,
        "recentRatings": recent,
    }))
}
