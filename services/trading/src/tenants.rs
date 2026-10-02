//! Brokers (tenants) the Platform Owner creates in the Owner panel (D110) live in the gateway. The engine keeps its
//! own `tenants` row per broker (the id mirrors the gateway's) and provisions a new broker on its first request:
//! the tenant row, the default dealing policy and a copy of the platform broker's account groups (tenant 1) as
//! its starting groups, which the broker's Back Office then edits. Unknown slugs are remembered for 30 s so a
//! wrong header can't make every request ask the gateway.
//!
//! Spread markups (market-data) are keyed by spread group across all brokers, so a broker's groups price from
//! its own spread groups, `<slug>-standard` and so on: its Back Office sets their markups (raw prices until
//! then) and can never read or change another broker's client prices.

use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use sqlx::PgPool;

use crate::api::AppState;
use crate::rules::TenantConfig;

/// The broker whose account groups a new broker starts with.
pub const TEMPLATE_TENANT: i64 = 1;

/// Whether `spread_group` belongs to the broker `slug` (`<slug>-…`).
pub fn owns_spread_group(slug: &str, spread_group: &str) -> bool {
    spread_group.len() > slug.len() + 1 && spread_group.starts_with(slug) && spread_group.as_bytes()[slug.len()] == b'-'
}
const MISS_TTL: Duration = Duration::from_secs(30);

static MISSES: LazyLock<Mutex<HashMap<String, Instant>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn valid_slug(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn missed_recently(slug: &str) -> bool {
    let mut m = MISSES.lock().unwrap();
    m.retain(|_, at| at.elapsed() < MISS_TTL);
    m.contains_key(slug)
}

fn remember_miss(slug: &str) {
    let mut m = MISSES.lock().unwrap();
    if m.len() > 1000 {
        m.clear();
    }
    m.insert(slug.to_string(), Instant::now());
}

/// The broker `slug`, provisioned from the gateway if the engine doesn't know it yet. None: no such broker.
pub async fn provision(st: &AppState, slug: &str) -> Option<Arc<TenantConfig>> {
    if !valid_slug(slug) || !st.gateway.configured() || missed_recently(slug) {
        return None;
    }
    let v = match st.gateway.call("GET", &format!("/v1/internal/tenants/{slug}"), None).await {
        Ok((200, v)) => v,
        Ok((404, _)) => {
            remember_miss(slug);
            return None;
        }
        Ok((status, _)) => {
            tracing::warn!(slug, status, "tenant lookup: gateway refused");
            return None;
        }
        Err(e) => {
            tracing::warn!(slug, error = %e, "tenant lookup: gateway unreachable");
            return None;
        }
    };
    let id = v["id"].as_i64().filter(|id| *id > 0)?;
    let name = v["name"].as_str().unwrap_or(slug).to_string();
    match ensure(&st.pool, id, slug, &name).await {
        Ok(true) => tracing::info!(tenant = id, slug, "broker provisioned in the trading engine (groups copied from the platform broker)"),
        Ok(false) => {}
        Err(e) => {
            tracing::error!(tenant = id, slug, error = %e, "broker could not be provisioned");
            return None;
        }
    }
    let cfg = crate::persist::load_tenant(&st.pool, id).await.ok()?;
    if cfg.slug != slug {
        return None; // the id belongs to another slug here: never serve one broker's config for another
    }
    st.hub.shared.registry.put(cfg);
    st.hub.shared.registry.get(id)
}

/// Creates the broker's engine rows once (idempotent). True when it was created now.
pub async fn ensure(pool: &PgPool, id: i64, slug: &str, name: &str) -> anyhow::Result<bool> {
    let mut tx = pool.begin().await?;
    let created = sqlx::query("INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
        .bind(id)
        .bind(slug)
        .bind(name)
        .execute(&mut *tx)
        .await?
        .rows_affected()
        == 1;
    if created {
        sqlx::query("INSERT INTO tenant_policies (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING").bind(id).execute(&mut *tx).await?;
        // every column of the template's groups, with this broker's id, its own spread groups and fresh timestamps
        sqlx::query(
            "INSERT INTO groups
             SELECT (jsonb_populate_record(NULL::groups, to_jsonb(g) || jsonb_build_object(
                        'tenant_id', $1::bigint, 'spread_group', $3 || '-' || g.spread_group, 'created_at', now(), 'updated_at', now()))).*
             FROM groups g WHERE g.tenant_id = $2
             ON CONFLICT DO NOTHING",
        )
        .bind(id)
        .bind(TEMPLATE_TENANT)
        .bind(slug)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(created)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_are_checked_before_any_lookup() {
        assert!(valid_slug("northwind") && valid_slug("acme-mum6uw8s"));
        assert!(!valid_slug("") && !valid_slug("Northwind") && !valid_slug("../x") && !valid_slug(&"a".repeat(65)));
    }

    #[test]
    fn spread_groups_belong_to_their_broker() {
        assert!(owns_spread_group("northwind", "northwind-standard"));
        assert!(!owns_spread_group("northwind", "standard") && !owns_spread_group("northwind", "northwind-") && !owns_spread_group("north", "northwind-pro"));
    }

    #[test]
    fn unknown_slugs_are_remembered() {
        assert!(!missed_recently("qa-unknown-broker"));
        remember_miss("qa-unknown-broker");
        assert!(missed_recently("qa-unknown-broker"));
    }
}
