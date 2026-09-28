//! Spread markups per account group (set from the Back Office), applied only to outgoing client quotes.

use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::instruments::Instrument;
use crate::state::Quote;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Markup {
    pub group_code: String,
    /// symbol or "*" for the group default
    pub symbol: String,
    pub markup_points: i32,
    pub min_spread_points: i32,
}

#[derive(Clone, Default)]
pub struct Spreads(Arc<RwLock<HashMap<(String, String), Markup>>>);

impl Spreads {
    pub async fn load(pool: &PgPool) -> anyhow::Result<Self> {
        let s = Spreads::default();
        s.reload(pool).await?;
        Ok(s)
    }

    pub async fn reload(&self, pool: &PgPool) -> anyhow::Result<()> {
        let rows = sqlx::query("SELECT group_code, symbol, markup_points, min_spread_points FROM spread_markups").fetch_all(pool).await?;
        let map = rows
            .into_iter()
            .map(|r| {
                let m = Markup { group_code: r.get("group_code"), symbol: r.get("symbol"), markup_points: r.get("markup_points"), min_spread_points: r.get("min_spread_points") };
                ((m.group_code.clone(), m.symbol.clone()), m)
            })
            .collect();
        *self.0.write().unwrap() = map;
        Ok(())
    }

    pub fn all(&self) -> Vec<Markup> {
        let mut v: Vec<Markup> = self.0.read().unwrap().values().cloned().collect();
        v.sort_by(|a, b| (&a.group_code, &a.symbol).cmp(&(&b.group_code, &b.symbol)));
        v
    }

    pub async fn upsert(&self, pool: &PgPool, m: &Markup) -> anyhow::Result<()> {
        sqlx::query(
            "INSERT INTO spread_markups (group_code, symbol, markup_points, min_spread_points, updated_at) VALUES ($1,$2,$3,$4, now())
             ON CONFLICT (group_code, symbol) DO UPDATE SET markup_points = EXCLUDED.markup_points, min_spread_points = EXCLUDED.min_spread_points, updated_at = now()",
        )
        .bind(&m.group_code)
        .bind(&m.symbol)
        .bind(m.markup_points)
        .bind(m.min_spread_points)
        .execute(pool)
        .await?;
        self.reload(pool).await
    }

    /// Client quote for a group: widen the raw spread symmetrically around mid by the markup,
    /// never below the group's minimum spread. `group = "raw"` (or unknown) returns the raw book.
    pub fn apply(&self, group: &str, inst: &Instrument, q: Quote) -> Quote {
        let map = self.0.read().unwrap();
        let m = map.get(&(group.to_string(), inst.symbol.clone())).or_else(|| map.get(&(group.to_string(), "*".to_string())));
        let Some(m) = m else { return q };
        let pt = inst.point();
        let raw = (q.ask - q.bid).max(0.0);
        let spread = (raw + m.markup_points as f64 * pt).max(m.min_spread_points as f64 * pt);
        let mid = (q.ask + q.bid) / 2.0;
        Quote { bid: inst.round(mid - spread / 2.0), ask: inst.round(mid + spread / 2.0), ..q }
    }
}
