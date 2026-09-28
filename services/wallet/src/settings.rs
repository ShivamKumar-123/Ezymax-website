//! Per-tenant wallet settings: limits / fees / cooldown (D36) and per-chain receiving addresses,
//! confirmations (D10) and switches. Seeded from the environment on first start; afterwards only the audited
//! admin endpoint changes them.

use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Row, Transaction};

use crate::chain::ChainId;
use crate::config::Config;
use crate::money::{D, s};

#[derive(Clone, Debug)]
pub struct Limits {
    pub withdraw_min: D,
    pub withdraw_max: D,
    pub withdraw_daily_max: D,
    pub withdraw_fee_flat: D,
    pub withdraw_fee_pct: D,
    pub deposit_cooldown_hours: i32,
    pub intent_ttl_minutes: i32,
}

impl Limits {
    pub fn json(&self) -> Value {
        json!({
            "withdraw_min": s(self.withdraw_min),
            "withdraw_max": s(self.withdraw_max),
            "withdraw_daily_max": s(self.withdraw_daily_max),
            "withdraw_fee_flat": s(self.withdraw_fee_flat),
            "withdraw_fee_pct": s(self.withdraw_fee_pct),
            "deposit_cooldown_hours": self.deposit_cooldown_hours,
            "intent_ttl_minutes": self.intent_ttl_minutes,
        })
    }
}

#[derive(Clone, Debug)]
pub struct ChainCfg {
    pub chain: ChainId,
    pub receiving_address: String,
    pub payout_address: Option<String>,
    pub confirmations: i32,
    pub deposits_enabled: bool,
    pub withdrawals_enabled: bool,
    pub min_deposit: D,
    pub withdraw_fee: D,
}

impl ChainCfg {
    /// Admin view (addresses included).
    pub fn json(&self) -> Value {
        json!({
            "chain": self.chain.as_str(),
            "network": self.chain.network(),
            "token": "USDT",
            "token_contract": self.chain.usdt_contract_display(),
            "decimals": self.chain.usdt_decimals(),
            "evm_chain_id": self.chain.evm_chain_id(),
            "receiving_address": self.receiving_address,
            "payout_address": self.payout_address,
            "confirmations": self.confirmations,
            "deposits_enabled": self.deposits_enabled,
            "withdrawals_enabled": self.withdrawals_enabled,
            "min_deposit": s(self.min_deposit),
            "withdraw_fee": s(self.withdraw_fee),
        })
    }
    /// Client view: no addresses (the address comes with a deposit intent).
    pub fn public_json(&self) -> Value {
        let mut v = self.json();
        if let Some(o) = v.as_object_mut() {
            o.remove("receiving_address");
            o.remove("payout_address");
        }
        v
    }
}

pub async fn limits(pool: &PgPool, tenant_id: i64) -> sqlx::Result<Limits> {
    let r = sqlx::query("SELECT * FROM tenant_settings WHERE tenant_id = $1").bind(tenant_id).fetch_optional(pool).await?;
    Ok(match r {
        Some(r) => Limits {
            withdraw_min: r.get("withdraw_min"),
            withdraw_max: r.get("withdraw_max"),
            withdraw_daily_max: r.get("withdraw_daily_max"),
            withdraw_fee_flat: r.get("withdraw_fee_flat"),
            withdraw_fee_pct: r.get("withdraw_fee_pct"),
            deposit_cooldown_hours: r.get("deposit_cooldown_hours"),
            intent_ttl_minutes: r.get("intent_ttl_minutes"),
        },
        None => Limits {
            withdraw_min: D::from(10),
            withdraw_max: D::from(50_000),
            withdraw_daily_max: D::from(100_000),
            withdraw_fee_flat: D::ONE,
            withdraw_fee_pct: D::ZERO,
            deposit_cooldown_hours: 24,
            intent_ttl_minutes: 60,
        },
    })
}

fn chain_row(r: &sqlx::postgres::PgRow) -> Option<ChainCfg> {
    Some(ChainCfg {
        chain: ChainId::parse(r.get::<String, _>("chain").as_str())?,
        receiving_address: r.get("receiving_address"),
        payout_address: r.get("payout_address"),
        confirmations: r.get("confirmations"),
        deposits_enabled: r.get("deposits_enabled"),
        withdrawals_enabled: r.get("withdrawals_enabled"),
        min_deposit: r.get("min_deposit"),
        withdraw_fee: r.get("withdraw_fee"),
    })
}

pub async fn chains(pool: &PgPool, tenant_id: i64) -> sqlx::Result<Vec<ChainCfg>> {
    let rows = sqlx::query("SELECT * FROM chain_settings WHERE tenant_id = $1 ORDER BY chain").bind(tenant_id).fetch_all(pool).await?;
    Ok(rows.iter().filter_map(chain_row).collect())
}

pub async fn chain(pool: &PgPool, tenant_id: i64, chain: ChainId) -> sqlx::Result<Option<ChainCfg>> {
    let r = sqlx::query("SELECT * FROM chain_settings WHERE tenant_id = $1 AND chain = $2").bind(tenant_id).bind(chain.as_str()).fetch_optional(pool).await?;
    Ok(r.as_ref().and_then(chain_row))
}

/// Every address the tenant ever received on for `chain` (old receiving addresses stay recognised).
pub async fn receiving_addresses(pool: &PgPool, tenant_id: i64, chain: ChainId) -> sqlx::Result<Vec<String>> {
    sqlx::query_scalar("SELECT address FROM company_addresses WHERE tenant_id = $1 AND chain = $2 AND role = 'receiving'")
        .bind(tenant_id)
        .bind(chain.as_str())
        .fetch_all(pool)
        .await
}

/// Every company address of `chain` (receiving and payout): a payout must come from one of these.
pub async fn company_addresses(pool: &PgPool, tenant_id: i64, chain: ChainId) -> sqlx::Result<Vec<String>> {
    sqlx::query_scalar("SELECT DISTINCT address FROM company_addresses WHERE tenant_id = $1 AND chain = $2").bind(tenant_id).bind(chain.as_str()).fetch_all(pool).await
}

/// Records an address in the address book (idempotent); `active` marks the current one for its role.
pub async fn remember_address(tx: &mut Transaction<'_, Postgres>, tenant_id: i64, chain: ChainId, address: &str, role: &str) -> sqlx::Result<()> {
    sqlx::query("UPDATE company_addresses SET active = false WHERE tenant_id = $1 AND chain = $2 AND role = $3 AND address <> $4")
        .bind(tenant_id)
        .bind(chain.as_str())
        .bind(role)
        .bind(address)
        .execute(&mut **tx)
        .await?;
    sqlx::query("INSERT INTO company_addresses (tenant_id, chain, address, role) VALUES ($1, $2, $3, $4) ON CONFLICT (tenant_id, chain, address, role) DO UPDATE SET active = true")
        .bind(tenant_id)
        .bind(chain.as_str())
        .bind(address)
        .bind(role)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// First start: creates chain_settings rows from WALLET_BSC_ADDRESS / WALLET_TRON_ADDRESS for every tenant that
/// has none (audited as a system action). Existing rows are never overwritten.
pub async fn seed(pool: &PgPool, cfg: &Config) -> anyhow::Result<()> {
    let tenants: Vec<i64> = sqlx::query_scalar("SELECT id FROM tenants").fetch_all(pool).await?;
    for t in tenants {
        sqlx::query("INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING").bind(t).execute(pool).await?;
        for (chain, raw, conf) in [(ChainId::Bsc, &cfg.bsc_address, cfg.bsc_confirmations), (ChainId::Tron, &cfg.tron_address, cfg.tron_confirmations)] {
            if raw.is_empty() {
                continue;
            }
            let Some(addr) = chain.normalize_address(raw) else {
                tracing::error!(%chain, "seed receiving address is invalid; not seeded");
                continue;
            };
            let mut tx = pool.begin().await?;
            let done = sqlx::query("INSERT INTO chain_settings (tenant_id, chain, receiving_address, confirmations, updated_by) VALUES ($1, $2, $3, $4, 'seed') ON CONFLICT DO NOTHING")
                .bind(t)
                .bind(chain.as_str())
                .bind(&addr)
                .bind(conf)
                .execute(&mut *tx)
                .await?;
            if done.rows_affected() == 1 {
                remember_address(&mut tx, t, chain, &addr, "receiving").await?;
                crate::audit::system(&mut tx, t, "wallet.settings.seeded", "chain", chain.as_str().into(), Some(json!({"receiving_address": addr, "confirmations": conf}))).await?;
                tracing::info!(tenant = t, %chain, address = %addr, confirmations = conf, "receiving address seeded");
            }
            tx.commit().await?;
        }
    }
    Ok(())
}
