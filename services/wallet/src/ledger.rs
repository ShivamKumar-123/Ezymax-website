//! Double-entry ledger. A transaction is one `ledger_txns` row (unique idempotency key per tenant) with
//! postings that sum to zero per currency (also enforced by a deferred database trigger). User accounts are
//! projected into `wallet_balances` in the same database transaction; available and locked never go negative.

use serde_json::Value;
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::collections::BTreeMap;

use crate::money::D;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bucket {
    Available,
    Locked,
}

pub fn user_account(user_id: i64, ccy: &str, b: Bucket) -> String {
    format!("user:{user_id}:{ccy}:{}", if b == Bucket::Available { "available" } else { "locked" })
}

pub fn sys_account(ccy: &str, name: &str) -> String {
    format!("sys:{ccy}:{name}")
}

#[derive(Clone, Debug)]
pub struct Leg {
    pub account: String,
    pub user: Option<(i64, Bucket)>,
    pub amount: D,
}

impl Leg {
    pub fn available(user_id: i64, ccy: &str, amount: D) -> Self {
        Leg { account: user_account(user_id, ccy, Bucket::Available), user: Some((user_id, Bucket::Available)), amount }
    }
    pub fn locked(user_id: i64, ccy: &str, amount: D) -> Self {
        Leg { account: user_account(user_id, ccy, Bucket::Locked), user: Some((user_id, Bucket::Locked)), amount }
    }
    pub fn sys(ccy: &str, name: &str, amount: D) -> Self {
        Leg { account: sys_account(ccy, name), user: None, amount }
    }
}

pub struct NewTxn {
    pub tenant_id: i64,
    pub key: String,
    pub kind: String,
    pub user_id: Option<i64>,
    pub currency: String,
    pub reference: Option<String>,
    pub note: Option<String>,
    pub actor: String,
    pub request: Option<Value>,
    pub legs: Vec<Leg>,
}

#[derive(Debug)]
pub enum PostError {
    /// The idempotency key already exists (the caller rolls back and replays).
    Duplicate,
    /// A user account would go negative.
    Insufficient,
    Db(anyhow::Error),
}

impl From<sqlx::Error> for PostError {
    fn from(e: sqlx::Error) -> Self {
        PostError::Db(e.into())
    }
}

impl From<PostError> for crate::error::ApiError {
    fn from(e: PostError) -> Self {
        match e {
            PostError::Duplicate => crate::error::ApiError::conflict("in_progress", "This request was already processed"),
            PostError::Insufficient => crate::error::ApiError::insufficient(),
            PostError::Db(e) => crate::error::ApiError::Internal(e),
        }
    }
}

/// Balances after the transaction, per user: (available, locked) in the transaction currency.
pub type After = BTreeMap<i64, (D, D)>;

/// Posts a transaction. `result` builds the JSON stored for idempotent replays from the new txn id and the
/// balances after posting. Returns the txn id and the balances after.
pub async fn post_with(tx: &mut Transaction<'_, Postgres>, t: NewTxn, result: impl FnOnce(i64, &After) -> Option<Value>) -> Result<(i64, After), PostError> {
    let legs: Vec<&Leg> = t.legs.iter().filter(|l| !l.amount.is_zero()).collect();
    let sum: D = legs.iter().map(|l| l.amount).sum();
    if !sum.is_zero() || legs.is_empty() {
        return Err(PostError::Db(anyhow::anyhow!("unbalanced ledger txn {} (sum {sum})", t.key)));
    }
    // fast duplicate check (the unique index is the real guard)
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(t.tenant_id).bind(&t.key).fetch_optional(&mut **tx).await?;
    if exists.is_some() {
        return Err(PostError::Duplicate);
    }

    // user balance projection first: it takes the row locks and yields the balances after
    let mut deltas: BTreeMap<i64, (D, D)> = BTreeMap::new();
    for l in &legs {
        if let Some((uid, b)) = l.user {
            let e = deltas.entry(uid).or_insert((D::ZERO, D::ZERO));
            if b == Bucket::Available { e.0 += l.amount } else { e.1 += l.amount }
        }
    }
    let mut after = After::new();
    for (uid, (da, dl)) in &deltas {
        sqlx::query("INSERT INTO wallet_balances (tenant_id, user_id, currency) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
            .bind(t.tenant_id)
            .bind(uid)
            .bind(&t.currency)
            .execute(&mut **tx)
            .await?;
        let row = sqlx::query(
            "UPDATE wallet_balances SET available = available + $4, locked = locked + $5, updated_at = now()
             WHERE tenant_id = $1 AND user_id = $2 AND currency = $3 AND available + $4 >= 0 AND locked + $5 >= 0
             RETURNING available, locked",
        )
        .bind(t.tenant_id)
        .bind(uid)
        .bind(&t.currency)
        .bind(da)
        .bind(dl)
        .fetch_optional(&mut **tx)
        .await?;
        match row {
            Some(r) => {
                after.insert(*uid, (r.get::<D, _>("available"), r.get::<D, _>("locked")));
            }
            None => return Err(PostError::Insufficient),
        }
    }

    let id: i64 = sqlx::query_scalar("SELECT nextval(pg_get_serial_sequence('ledger_txns', 'id'))").fetch_one(&mut **tx).await?;
    let res = result(id, &after);
    let inserted = sqlx::query(
        "INSERT INTO ledger_txns (id, tenant_id, idempotency_key, kind, user_id, currency, reference, note, actor, request, result)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING",
    )
    .bind(id)
    .bind(t.tenant_id)
    .bind(&t.key)
    .bind(&t.kind)
    .bind(t.user_id)
    .bind(&t.currency)
    .bind(&t.reference)
    .bind(&t.note)
    .bind(&t.actor)
    .bind(t.request.map(sqlx::types::Json))
    .bind(res.map(sqlx::types::Json))
    .execute(&mut **tx)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(PostError::Duplicate);
    }
    for l in legs {
        sqlx::query("INSERT INTO ledger_postings (tenant_id, txn_id, account_code, user_id, currency, amount) VALUES ($1, $2, $3, $4, $5, $6)")
            .bind(t.tenant_id)
            .bind(id)
            .bind(&l.account)
            .bind(l.user.map(|u| u.0))
            .bind(&t.currency)
            .bind(l.amount)
            .execute(&mut **tx)
            .await?;
    }
    Ok((id, after))
}

pub async fn post(tx: &mut Transaction<'_, Postgres>, t: NewTxn) -> Result<i64, PostError> {
    post_with(tx, t, |_, _| None).await.map(|(id, _)| id)
}

/// Ledger invariants: every transaction balances per currency, and every balance row equals the sum of the
/// postings on its accounts. Returns human-readable mismatches (empty = healthy).
pub async fn verify(pool: &PgPool) -> anyhow::Result<Vec<String>> {
    let mut out = vec![];
    for r in sqlx::query("SELECT txn_id, currency, sum(amount) AS s FROM ledger_postings GROUP BY txn_id, currency HAVING sum(amount) <> 0").fetch_all(pool).await? {
        out.push(format!("txn {} does not balance in {} ({})", r.get::<i64, _>("txn_id"), r.get::<String, _>("currency"), r.get::<D, _>("s")));
    }
    let rows = sqlx::query(
        "WITH p AS (
            SELECT tenant_id, user_id, currency,
                   COALESCE(sum(amount) FILTER (WHERE account_code LIKE '%:available'), 0) AS a,
                   COALESCE(sum(amount) FILTER (WHERE account_code LIKE '%:locked'), 0) AS l
            FROM ledger_postings WHERE user_id IS NOT NULL GROUP BY tenant_id, user_id, currency)
         SELECT COALESCE(p.tenant_id, b.tenant_id) AS tenant_id, COALESCE(p.user_id, b.user_id) AS user_id, COALESCE(p.currency, b.currency) AS currency,
                COALESCE(p.a, 0) AS pa, COALESCE(p.l, 0) AS pl, COALESCE(b.available, 0) AS ba, COALESCE(b.locked, 0) AS bl
         FROM p FULL OUTER JOIN wallet_balances b ON b.tenant_id = p.tenant_id AND b.user_id = p.user_id AND b.currency = p.currency
         WHERE COALESCE(p.a, 0) <> COALESCE(b.available, 0) OR COALESCE(p.l, 0) <> COALESCE(b.locked, 0)",
    )
    .fetch_all(pool)
    .await?;
    for r in rows {
        out.push(format!(
            "tenant {} user {} {}: postings available {} locked {} vs balance available {} locked {}",
            r.get::<i64, _>("tenant_id"),
            r.get::<i64, _>("user_id"),
            r.get::<String, _>("currency"),
            r.get::<D, _>("pa"),
            r.get::<D, _>("pl"),
            r.get::<D, _>("ba"),
            r.get::<D, _>("bl")
        ));
    }
    let total: Option<D> = sqlx::query_scalar("SELECT sum(amount) FROM ledger_postings").fetch_one(pool).await?;
    if let Some(t) = total
        && !t.is_zero()
    {
        out.push(format!("sum of all postings is {t}, expected 0"));
    }
    Ok(out)
}

/// Current balances of a user: [(currency, available, locked)], USDT always first.
pub async fn balances(pool: &PgPool, tenant_id: i64, user_id: i64) -> sqlx::Result<Vec<(String, D, D)>> {
    let mut rows: Vec<(String, D, D)> = sqlx::query_as("SELECT currency, available, locked FROM wallet_balances WHERE tenant_id = $1 AND user_id = $2 ORDER BY currency")
        .bind(tenant_id)
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    if !rows.iter().any(|r| r.0 == "USDT") {
        rows.insert(0, ("USDT".into(), D::ZERO, D::ZERO));
    }
    rows.sort_by_key(|r| (r.0 != "USDT", r.0.clone()));
    Ok(rows)
}

pub fn balances_json(rows: &[(String, D, D)]) -> Value {
    Value::Array(rows.iter().map(|(c, a, l)| serde_json::json!({"currency": c, "available": crate::money::s(*a), "locked": crate::money::s(*l)})).collect())
}
