//! Strategy versions: building a runnable program from a visual spec or DSL source, and loading them.

use serde_json::{Value, json};
use sqlx::{PgPool, Row};

use crate::dsl::{self, Program};
use crate::spec::{self, StrategySpec};
use crate::specs::Specs;

pub struct Built {
    pub kind: &'static str,
    pub spec: StrategySpec,
    pub source: Option<String>,
    pub program: Program,
    /// `[{line?, col?, message}]`
    pub errors: Vec<Value>,
    pub warnings: Vec<String>,
}

impl Built {
    pub fn valid(&self) -> bool {
        self.errors.is_empty()
    }
    pub fn view(&self) -> Value {
        json!({
            "kind": self.kind,
            "valid": self.valid(),
            "errors": self.errors,
            "warnings": self.warnings,
            "spec": self.spec,
            "code": self.program.to_dsl(),
            "source": self.source,
            "timeframes": self.program.timeframes,
            "lookback": self.program.lookback,
            "summary": summary(&self.program),
        })
    }
}

/// One line per signal, for cards and logs.
pub fn summary(p: &Program) -> Value {
    let mut o = serde_json::Map::new();
    for (k, n) in p.signals() {
        if let Some(n) = n {
            o.insert(k.to_string(), Value::String(n.code()));
        }
    }
    Value::Object(o)
}

/// Builds a version from the editor payload: `kind` "visual" with `spec`, or "code" with `source`
/// (`symbol` / `timeframe` are defaults a program can override).
pub fn build(kind: &str, spec_json: Option<&Value>, source: Option<&str>, symbol: &str, timeframe: &str, specs: &Specs) -> Result<Built, String> {
    match kind {
        "visual" => {
            let raw = spec_json.ok_or("spec is required for a visual strategy")?;
            let v = spec::validate(raw, specs);
            let program = dsl::from_spec(&v.spec);
            Ok(Built { kind: "visual", spec: v.spec, source: None, program, errors: v.errors.into_iter().map(|m| json!({"message": m})).collect(), warnings: v.warnings })
        }
        "code" => {
            let src = source.ok_or("source is required for a code strategy")?;
            let c = dsl::compile(src, symbol, timeframe, specs);
            Ok(Built {
                kind: "code",
                spec: c.program.spec.clone(),
                source: Some(src.to_string()),
                program: c.program,
                errors: c.errors.into_iter().map(|e| json!({"line": e.line, "col": e.col, "message": e.message})).collect(),
                warnings: c.warnings,
            })
        }
        _ => Err("kind must be visual or code".into()),
    }
}

#[derive(Clone, Debug)]
pub struct Version {
    pub id: i64,
    pub strategy_id: i64,
    pub user_id: i64,
    pub version: i32,
    pub kind: String,
    pub spec: Value,
    pub source: Option<String>,
    pub valid: bool,
    pub name: String,
}

impl Version {
    pub fn program(&self, specs: &Specs) -> Result<Program, String> {
        let spec = self.spec.get("symbol").and_then(Value::as_str).unwrap_or("EURUSD").to_string();
        let tf = self.spec.get("timeframe").and_then(Value::as_str).unwrap_or("H1").to_string();
        let b = build(&self.kind, Some(&self.spec), self.source.as_deref(), &spec, &tf, specs)?;
        if !b.valid() {
            return Err(format!("strategy version is not valid: {}", b.errors.iter().filter_map(|e| e.get("message").and_then(Value::as_str)).collect::<Vec<_>>().join("; ")));
        }
        Ok(b.program)
    }
}

pub async fn load_version(pool: &PgPool, tenant: &str, version_id: i64) -> anyhow::Result<Option<Version>> {
    let r = sqlx::query(
        "SELECT v.id, v.strategy_id, s.user_id, v.version, v.kind, v.spec, v.source, v.valid, s.name FROM strategy_versions v JOIN strategies s ON s.id = v.strategy_id WHERE v.id = $1 AND v.tenant_id = $2",
    )
    .bind(version_id)
    .bind(tenant)
    .fetch_optional(pool)
    .await?;
    Ok(r.map(|r| Version {
        id: r.get("id"),
        strategy_id: r.get("strategy_id"),
        user_id: r.get("user_id"),
        version: r.get("version"),
        kind: r.get("kind"),
        spec: r.get("spec"),
        source: r.get("source"),
        valid: r.get("valid"),
        name: r.get("name"),
    }))
}

/// Latest (or given) version of a strategy the user owns.
pub async fn own_version(pool: &PgPool, tenant: &str, user: i64, strategy_id: i64, version_id: Option<i64>) -> anyhow::Result<Option<Version>> {
    let vid: Option<i64> = match version_id {
        Some(v) => sqlx::query_scalar("SELECT v.id FROM strategy_versions v JOIN strategies s ON s.id = v.strategy_id WHERE v.id = $1 AND s.id = $2 AND s.user_id = $3 AND s.tenant_id = $4")
            .bind(v)
            .bind(strategy_id)
            .bind(user)
            .bind(tenant)
            .fetch_optional(pool)
            .await?,
        None => sqlx::query_scalar("SELECT v.id FROM strategy_versions v JOIN strategies s ON s.id = v.strategy_id WHERE s.id = $1 AND s.user_id = $2 AND s.tenant_id = $3 AND v.version = s.latest_version")
            .bind(strategy_id)
            .bind(user)
            .bind(tenant)
            .fetch_optional(pool)
            .await?,
    };
    match vid {
        Some(v) => load_version(pool, tenant, v).await,
        None => Ok(None),
    }
}

/// Inserts a strategy with its first version (returns the strategy id and version id).
pub async fn insert(pool: &PgPool, tenant: &str, user: i64, name: &str, origin: &str, listing: Option<i64>, b: &Built, note: Option<&str>, prompt: Option<&str>) -> anyhow::Result<(i64, i64)> {
    let mut tx = pool.begin().await?;
    let sid: i64 = sqlx::query_scalar("INSERT INTO strategies (tenant_id, user_id, name, symbol, timeframe, kind, origin, source_listing_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id")
        .bind(tenant)
        .bind(user)
        .bind(name)
        .bind(&b.spec.symbol)
        .bind(&b.spec.timeframe)
        .bind(b.kind)
        .bind(origin)
        .bind(listing)
        .fetch_one(&mut *tx)
        .await?;
    let vid = insert_version(&mut tx, tenant, sid, 1, b, note, prompt).await?;
    tx.commit().await?;
    Ok((sid, vid))
}

pub async fn insert_version(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, tenant: &str, sid: i64, version: i32, b: &Built, note: Option<&str>, prompt: Option<&str>) -> anyhow::Result<i64> {
    Ok(sqlx::query_scalar(
        "INSERT INTO strategy_versions (tenant_id, strategy_id, version, kind, spec, source, valid, errors, warnings, note, prompt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    )
    .bind(tenant)
    .bind(sid)
    .bind(version)
    .bind(b.kind)
    .bind(serde_json::to_value(&b.spec)?)
    .bind(&b.source)
    .bind(b.valid())
    .bind(Value::Array(b.errors.clone()))
    .bind(json!(b.warnings))
    .bind(note)
    .bind(prompt.map(|p| p.chars().take(4000).collect::<String>()))
    .fetch_one(&mut **tx)
    .await?)
}
