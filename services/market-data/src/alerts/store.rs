//! Rows of `price_alerts` / `price_alert_events` and the JSON the API returns for them.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::Live;
use super::rules::{Basis, Cond, Watch};

pub const ALERT_COLS: &str = "id, symbol, spread_group, condition, value, basis, reference, target, repeat, armed, status, note, expires_at, trigger_count, triggered_at, last_price, rev, created_at, updated_at";

#[derive(Clone, Debug)]
pub struct AlertRow {
    pub id: i64,
    pub symbol: String,
    pub group: String,
    pub cond: Cond,
    pub value: f64,
    pub basis: Basis,
    pub reference: Option<f64>,
    pub target: f64,
    pub repeat: bool,
    pub armed: bool,
    pub status: String,
    pub note: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub trigger_count: i32,
    pub triggered_at: Option<DateTime<Utc>>,
    pub last_price: Option<f64>,
    pub rev: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AlertRow {
    pub fn from_row(r: &PgRow) -> anyhow::Result<Self> {
        let cond: String = r.try_get("condition")?;
        let basis: String = r.try_get("basis")?;
        Ok(Self {
            id: r.try_get("id")?,
            symbol: r.try_get("symbol")?,
            group: r.try_get("spread_group")?,
            cond: Cond::parse(&cond).ok_or_else(|| anyhow::anyhow!("unknown alert condition {cond}"))?,
            value: r.try_get("value")?,
            basis: Basis::parse(&basis).ok_or_else(|| anyhow::anyhow!("unknown alert basis {basis}"))?,
            reference: r.try_get("reference")?,
            target: r.try_get("target")?,
            repeat: r.try_get("repeat")?,
            armed: r.try_get("armed")?,
            status: r.try_get("status")?,
            note: r.try_get("note")?,
            expires_at: r.try_get("expires_at")?,
            trigger_count: r.try_get("trigger_count")?,
            triggered_at: r.try_get("triggered_at")?,
            last_price: r.try_get("last_price")?,
            rev: r.try_get("rev")?,
            created_at: r.try_get("created_at")?,
            updated_at: r.try_get("updated_at")?,
        })
    }

    /// The evaluator's copy (None unless the alert is active).
    pub fn live(&self) -> Option<Live> {
        (self.status == "active").then(|| Live {
            id: self.id,
            rev: self.rev,
            group: self.group.clone(),
            basis: self.basis,
            value: self.value,
            reference: self.reference,
            w: Watch {
                cond: self.cond,
                target: self.target,
                armed: self.armed,
                repeat: self.repeat,
                expires_ms: self.expires_at.map(|t| t.timestamp_millis()),
                last_fire_ms: self.triggered_at.map(|t| t.timestamp_millis()).unwrap_or(0),
            },
        })
    }

    pub fn json(&self) -> Value {
        json!({
            "id": self.id,
            "symbol": self.symbol,
            "condition": self.cond.as_str(),
            "value": self.value,
            "basis": self.basis.as_str(),
            "group": self.group,
            "reference": self.reference,
            "target": self.target,
            "repeat": self.repeat,
            "status": self.status,
            "note": self.note,
            "expiresAt": self.expires_at,
            "triggerCount": self.trigger_count,
            "triggeredAt": self.triggered_at,
            "lastPrice": self.last_price,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        })
    }
}

pub const EVENT_COLS: &str = "id, alert_id, symbol, condition, value, basis, reference, target, price, repeat, note, triggered_at, delivered_at, failed";

pub fn event_json(r: &PgRow) -> anyhow::Result<Value> {
    let delivered: Option<DateTime<Utc>> = r.try_get("delivered_at")?;
    let failed: bool = r.try_get("failed")?;
    Ok(json!({
        "id": r.try_get::<i64, _>("id")?,
        "alertId": r.try_get::<Option<i64>, _>("alert_id")?,
        "symbol": r.try_get::<String, _>("symbol")?,
        "condition": r.try_get::<String, _>("condition")?,
        "value": r.try_get::<f64, _>("value")?,
        "basis": r.try_get::<String, _>("basis")?,
        "reference": r.try_get::<Option<f64>, _>("reference")?,
        "target": r.try_get::<f64, _>("target")?,
        "price": r.try_get::<f64, _>("price")?,
        "repeat": r.try_get::<bool, _>("repeat")?,
        "note": r.try_get::<String, _>("note")?,
        "triggeredAt": r.try_get::<DateTime<Utc>, _>("triggered_at")?,
        "delivery": if delivered.is_some() { "sent" } else if failed { "failed" } else { "pending" },
    }))
}
