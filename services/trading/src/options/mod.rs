//! Kalks FX Options inside the trading engine: the link to the options service (:8104) and the pricer the engine
//! core reads through `Env::options`.
//!
//! * **Snapshot.** `OptionsCtx` polls `GET /v1/internal/options/snapshot` every 2 s with `If-None-Match` (ETag
//!   `"opt-<version>"`), keeps the last good snapshot in memory and in `option_snapshot` (so a restart while the
//!   options service is down still has it). When the last successful poll is older than the snapshot's
//!   `staleAfterSecs`, options go close-only (`stale_prices`).
//! * **Spot.** Raw mids (no client spread) from market-data `group=raw`, kept in the shared `QuoteBook` under the
//!   group `raw` (see `feed::spawn_raw`).
//! * **Prices.** `price` is always computed fresh (fills, triggers: no latency arbitrage); `mark` is cached for at
//!   most 250 ms (valuation, equity, margin). The cache key includes the spot, the USD rate and the snapshot
//!   version, so a cached mark never outlives its inputs.
//! * **Scenario margin.** `scenario` runs optmath's 16-scenario grid on the option legs of one underlying, with
//!   and without the account's linear CFD exposure on it (cached the same way).
//! * **Suitability.** `GET {GATEWAY_URL}/v1/internal/suitability/{user}?product=options`, cached 60 s per user.

pub mod hedger;
pub mod pricing;
pub mod settle;
pub mod snapshot;

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::engine::Quotes;
use crate::feed::QuoteBook;
use crate::model::OptionTerms;
use crate::money::{D, ZERO, from_f64, rdp};
pub use pricing::PriceError;
pub use snapshot::{OptSnapshot, TradeState};

/// Decimal → f64 for the maths (prices and sizes, never money totals).
pub fn f(d: D) -> f64 {
    d.to_f64().unwrap_or(0.0)
}

/// f64 → Decimal through its shortest text (0 for non-finite input).
pub fn dec(x: f64) -> D {
    from_f64(x).unwrap_or(ZERO)
}

/// The QuoteBook group holding raw mids.
pub const RAW: &str = "raw";

/// One priced option (per unit of the underlying, quote currency) for one tenant and group.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct OptPrice {
    pub bid: D,
    pub ask: D,
    pub mark: D,
    /// Quote currency → USD.
    pub usd_per_quote: D,
    /// Underlying mid used (a frozen spot when a freeze control is active).
    pub spot: D,
    /// Provider time of the raw spot (ms); 0 = frozen.
    pub spot_ms: i64,
    pub iv: f64,
    /// Per unit.
    pub delta: f64,
    /// Per unit, per 1 % spot move.
    pub gamma: f64,
    /// USD per contract per vol point.
    pub vega: f64,
    /// USD per contract per calendar day.
    pub theta: f64,
    pub state: TradeState,
}

impl OptPrice {
    /// Where a position of `side` closes (a long sells at the bid).
    pub fn close_price(&self, side: crate::model::Side) -> D {
        if side == crate::model::Side::Buy { self.bid } else { self.ask }
    }
    pub fn open_price(&self, side: crate::model::Side) -> D {
        if side == crate::model::Side::Buy { self.ask } else { self.bid }
    }
}

/// One option leg in a scenario run: signed contracts (+ long).
#[derive(Clone, Debug)]
pub struct ScenLeg {
    pub terms: OptionTerms,
    pub contracts: D,
}

/// Scenario worst losses in the quote currency.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ScenOut {
    /// Worst loss of the option legs alone.
    pub options_only: f64,
    /// What the legs add to the loss of the CFD exposure (`clamp(combined - cfd alone, 0, options_only)`):
    /// CFD offsets can only reduce option margin.
    pub incremental: f64,
    pub usd_per_quote: f64,
}

/// What the engine core needs from the options side. `OptionsCtx` is the real one; tests use a fixed pricer.
pub trait OptionPricing: Send + Sync {
    fn snapshot(&self) -> Option<Arc<OptSnapshot>>;
    /// The snapshot is missing or older than `staleAfterSecs`: options are close-only.
    fn stale(&self, now: DateTime<Utc>) -> bool;
    /// Raw mid of a symbol and its provider time (ms).
    fn spot(&self, symbol: &str) -> Option<(f64, i64)>;
    /// Value of one unit of `ccy` in USD from the raw mids (USD = 1, XXXUSD = mid, USDXXX = 1 / mid).
    fn usd_per(&self, ccy: &str) -> Option<f64> {
        if ccy == "USD" {
            return Some(1.0);
        }
        if let Some((m, _)) = self.spot(&format!("{ccy}USD")) {
            return Some(m);
        }
        self.spot(&format!("USD{ccy}")).map(|(m, _)| 1.0 / m)
    }
    /// A fresh price (fills, triggers).
    fn price(&self, tenant: &str, group: &str, terms: &OptionTerms, now: DateTime<Utc>) -> Result<OptPrice, PriceError>;
    /// A price at most 250 ms old (valuation, equity, margin).
    fn mark(&self, tenant: &str, group: &str, terms: &OptionTerms, now: DateTime<Utc>) -> Option<OptPrice> {
        self.price(tenant, group, terms, now).ok()
    }
    /// Scenario losses of `legs` (one underlying) with a linear CFD exposure of `cfd_units` units.
    fn scenario(&self, tenant: &str, underlying: &str, legs: &[ScenLeg], cfd_units: f64, now: DateTime<Utc>) -> Option<ScenOut>;
    /// Top of the options order book of a series for a tenant and account kind (None = no book / empty book):
    /// the mark is clamped inside it (`engine::options::mark_of`).
    fn book_top(&self, _tenant: &str, _kind: crate::model::AccountKind, _series: &str) -> Option<crate::book::md::TopQuote> {
        None
    }
}

/* ------------------------------------------------------------------ */
/* Computations shared by every pricer                                 */
/* ------------------------------------------------------------------ */

/// Prices `terms` from `snap` with spots from `spot`.
pub fn compute_price(snap: &OptSnapshot, spot: &dyn Fn(&str) -> Option<(f64, i64)>, usd_per: &dyn Fn(&str) -> Option<f64>, tenant: &str, group: &str, terms: &OptionTerms, now: DateTime<Utc>) -> Result<OptPrice, PriceError> {
    let u = snap.underlying(&terms.underlying).ok_or_else(|| PriceError::UnknownUnderlying(terms.underlying.clone()))?;
    let live = spot(&u.symbol);
    let usdq = usd_per(&u.quote_ccy);
    let key = terms.expiry_key();
    let ctx = pricing::context(snap, u, &key, terms.expiry_at.timestamp_millis(), live.map(|s| s.0), usdq, now.timestamp_millis(), tenant)?;
    let g = snap.group(tenant, group, &u.symbol);
    let k = f(terms.strike);
    let q = match terms.alive_barrier() {
        Some(b) => pricing::barrier(&ctx, u, terms.right, k, b, &g),
        None => pricing::vanilla(&ctx, u, terms.right, k, &g),
    };
    let pd = (u.digits + 2).clamp(0, 12) as u32;
    let state = snap.trade_state(tenant, u, terms.expiry, terms.expiry_at, Some(&terms.series), now);
    Ok(OptPrice {
        bid: rdp(dec(q.bid), pd),
        ask: rdp(dec(q.ask), pd),
        mark: rdp(dec(q.mark), pd),
        usd_per_quote: dec(ctx.usd_per_quote),
        spot: dec(ctx.spot),
        spot_ms: if ctx.frozen { 0 } else { live.map(|s| s.1).unwrap_or(0) },
        iv: q.iv,
        delta: q.delta,
        gamma: q.gamma,
        vega: q.vega,
        theta: q.theta,
        state,
    })
}

/// Is `now` a Friday (or the weekend) in New York: sellers pay the weekend margin add-on.
pub fn weekend_margin(now: DateTime<Utc>) -> bool {
    let d = optmath::Zone::NewYork.local_date(now.timestamp_millis());
    matches!(d.weekday(), optmath::Weekday::Fri | optmath::Weekday::Sat | optmath::Weekday::Sun)
}

/// The scenario grid of `legs` on `underlying` (optmath::scenario), alone and with the CFD exposure.
pub fn compute_scenario(snap: &OptSnapshot, spot: &dyn Fn(&str) -> Option<(f64, i64)>, usd_per: &dyn Fn(&str) -> Option<f64>, tenant: &str, underlying: &str, legs: &[ScenLeg], cfd_units: f64, now: DateTime<Utc>) -> Option<ScenOut> {
    use optmath::scenario::{Instrument, Market, RiskPosition, ScanParams, scenario_grid};
    let u = snap.underlying(underlying)?;
    let live = spot(&u.symbol).map(|s| s.0);
    let usdq = usd_per(&u.quote_ccy)?;
    let now_ms = now.timestamp_millis();
    let mut ctxs: HashMap<String, pricing::Ctx> = HashMap::new();
    let mut pos = Vec::with_capacity(legs.len() + 1);
    let mut s0 = live;
    for l in legs {
        let t = &l.terms;
        let key = t.expiry_key();
        if !ctxs.contains_key(&key) {
            let c = pricing::context(snap, u, &key, t.expiry_at.timestamp_millis(), live, Some(usdq), now_ms, tenant).ok()?;
            ctxs.insert(key.clone(), c);
        }
        let c = &ctxs[&key];
        s0 = s0.or(Some(c.spot));
        let k = f(t.strike);
        let kind = pricing::kind_of(t.right);
        let instrument = match t.alive_barrier() {
            Some(b) => Instrument::Barrier { kind, strike: k, barrier: f(b.level), barrier_type: pricing::barrier_type(b.kind), rebate: f(b.rebate).max(0.0) },
            None => Instrument::Vanilla { kind, strike: k },
        };
        pos.push(RiskPosition { instrument, qty: f(l.contracts) * f(t.contract_size), t_cal: c.t_cal, t_vol: c.t_vol, vol: pricing::vol_at(c, k) });
    }
    let s = s0?;
    let (r, b) = pricing::model_rates(snap, u);
    let m = Market { spot: s, r, b };
    let or = |x: f64, d: f64| if x > 0.0 && x.is_finite() { x } else { d };
    let p = ScanParams {
        price_range: or(u.price_scan, 0.03),
        vol_range: or(u.vol_scan, 0.03),
        extreme_multiple: or(u.extreme_multiple, 3.0),
        extreme_cover: or(u.extreme_cover, 0.35),
        dt_cal: 1.0 / 365.0,
        dt_vol: 1.0 / u.clock().year_basis(),
        min_vol: 0.005,
    };
    let options_only = scenario_grid(&pos, m, &p).worst_loss;
    let incremental = if cfd_units != 0.0 && cfd_units.is_finite() {
        let lin = RiskPosition { instrument: Instrument::Linear, qty: cfd_units, t_cal: 0.0, t_vol: 0.0, vol: 0.0 };
        let alone = scenario_grid(&[lin], m, &p).worst_loss;
        let mut all = pos.clone();
        all.push(lin);
        let combined = scenario_grid(&all, m, &p).worst_loss;
        (combined - alone).clamp(0.0, options_only)
    } else {
        options_only
    };
    Some(ScenOut { options_only, incremental, usd_per_quote: usdq })
}

/* ------------------------------------------------------------------ */
/* OptionsCtx                                                          */
/* ------------------------------------------------------------------ */

/// Eligibility for Kalks FX Options from the gateway (KYC, risk disclosure, knowledge quiz).
#[derive(Clone, Debug, PartialEq)]
pub struct Suitability {
    pub eligible: bool,
    pub kyc_verified: bool,
    pub disclosure_accepted: bool,
    pub quiz_passed: bool,
    /// `gateway` (answered), `not_deployed` (404), `unavailable` (error).
    pub source: &'static str,
}

impl Suitability {
    pub fn unknown(source: &'static str) -> Self {
        Suitability { eligible: false, kyc_verified: false, disclosure_accepted: false, quiz_passed: false, source }
    }
    pub fn json(&self) -> Value {
        json!({"eligible": self.eligible, "kycVerified": self.kyc_verified, "disclosureAccepted": self.disclosure_accepted, "quizPassed": self.quiz_passed, "source": self.source})
    }
}

/// A fixing of one expiry from the options service.
#[derive(Clone, Debug, PartialEq)]
pub struct Fixing {
    pub symbol: String,
    pub date: NaiveDate,
    pub cut_at: DateTime<Utc>,
    pub status: String,
    pub price: Option<D>,
    pub run: i32,
    pub source: Option<String>,
}

type Memo<V> = Mutex<HashMap<String, (i64, V)>>;

pub struct OptionsCtx {
    /// host:port of the options service ("" = not configured: options stay off).
    host: String,
    token: String,
    raw: Arc<QuoteBook>,
    snap: RwLock<Option<Arc<OptSnapshot>>>,
    etag: Mutex<Option<String>>,
    /// Last successful poll (200 or 304), Unix ms.
    last_ok_ms: AtomicI64,
    failing: AtomicBool,
    marks: Memo<OptPrice>,
    scen: Memo<ScenOut>,
    suit: Mutex<HashMap<i64, (i64, Suitability)>>,
    /// Options order book top of book (published by the book actors after every commit; the mark clamp reads it).
    pub top: Arc<crate::book::md::Top>,
}

const BUCKET_MS: i64 = 250;

impl OptionsCtx {
    pub fn new(url: &str, token: &str, raw: Arc<QuoteBook>) -> Self {
        let host = url.trim().trim_end_matches('/').trim_start_matches("http://").to_string();
        OptionsCtx {
            host,
            token: token.to_string(),
            raw,
            snap: RwLock::new(None),
            etag: Mutex::new(None),
            last_ok_ms: AtomicI64::new(0),
            failing: AtomicBool::new(false),
            marks: Mutex::new(HashMap::new()),
            scen: Mutex::new(HashMap::new()),
            suit: Mutex::new(HashMap::new()),
            top: Arc::new(crate::book::md::Top::default()),
        }
    }

    /// Not connected to an options service (development, tests).
    pub fn disabled(raw: Arc<QuoteBook>) -> Self {
        Self::new("", "", raw)
    }

    pub fn configured(&self) -> bool {
        !self.host.is_empty()
    }

    /// Installs a snapshot (poller, start-up from the database, tests). `fetched_ms` = when it was confirmed.
    pub fn set_snapshot(&self, s: OptSnapshot, fetched_ms: i64) {
        *self.snap.write().unwrap() = Some(Arc::new(s));
        self.last_ok_ms.store(fetched_ms, Ordering::SeqCst);
    }

    pub fn last_ok_ms(&self) -> i64 {
        self.last_ok_ms.load(Ordering::SeqCst)
    }

    pub fn version(&self) -> Option<i64> {
        self.snapshot().map(|s| s.version)
    }

    fn raw_spot(&self, symbol: &str) -> Option<(f64, i64)> {
        let q = self.raw.get(RAW, symbol)?;
        let mid = f(q.mid());
        (mid > 0.0).then_some((mid, q.t_ms))
    }

    /// Caches a suitability answer (tests; the gateway call fills it too).
    pub fn set_suitability(&self, user_id: i64, s: Suitability, ttl_ms: i64) {
        self.suit.lock().unwrap().insert(user_id, (Utc::now().timestamp_millis() + ttl_ms, s));
    }

    /// Kalks FX Options eligibility of a client (cached 60 s). A gateway without the endpoint (404) means the
    /// suitability flow is not deployed yet: not eligible (live accounts need it; demo accounts never do).
    pub async fn suitability(&self, gw: &crate::controls::Gateway, user_id: i64) -> Suitability {
        let now = Utc::now().timestamp_millis();
        if let Some((exp, s)) = self.suit.lock().unwrap().get(&user_id).cloned()
            && exp > now
        {
            return s;
        }
        let (s, ttl) = match gw.call("GET", &format!("/v1/internal/suitability/{user_id}?product=options"), None).await {
            Ok((200, v)) => {
                let b = |k: &str| v.get(k).and_then(Value::as_bool).unwrap_or(false);
                (Suitability { eligible: b("eligible"), kyc_verified: b("kycVerified"), disclosure_accepted: b("disclosureAccepted"), quiz_passed: b("quizPassed"), source: "gateway" }, 60_000)
            }
            Ok((404, _)) => (Suitability::unknown("not_deployed"), 60_000),
            Ok((status, _)) => {
                tracing::warn!(user_id, status, "options suitability: unexpected gateway answer");
                (Suitability::unknown("unavailable"), 5_000)
            }
            Err(e) => {
                tracing::warn!(user_id, error = %e, "options suitability: gateway unavailable");
                (Suitability::unknown("unavailable"), 5_000)
            }
        };
        self.suit.lock().unwrap().insert(user_id, (now + ttl, s.clone()));
        s
    }

    fn purge(&self, now_ms: i64) {
        let cut = now_ms / BUCKET_MS - 8;
        self.marks.lock().unwrap().retain(|_, (b, _)| *b >= cut);
        self.scen.lock().unwrap().retain(|_, (b, _)| *b >= cut);
    }

    /* ---------------- options service HTTP ---------------- */

    async fn get(&self, path: &str, extra: &[(&str, String)]) -> anyhow::Result<(u16, HashMap<String, String>, Vec<u8>)> {
        anyhow::ensure!(self.configured(), "OPTIONS_URL is not set");
        let mut head = format!("GET {path} HTTP/1.1\r\nHost: {}\r\nX-Kalks-Internal: {}\r\nX-Kalks-Service: trading\r\nAccept: application/json\r\nConnection: close\r\n", self.host, self.token);
        for (k, v) in extra {
            head.push_str(&format!("{k}: {v}\r\n"));
        }
        head.push_str("\r\n");
        let io = async {
            let mut s = tokio::net::TcpStream::connect(&self.host).await?;
            s.write_all(head.as_bytes()).await?;
            let mut buf = Vec::new();
            s.read_to_end(&mut buf).await?;
            Ok::<_, std::io::Error>(buf)
        };
        let buf = tokio::time::timeout(Duration::from_secs(10), io).await.map_err(|_| anyhow::anyhow!("options service timeout"))??;
        parse_http(&buf).ok_or_else(|| anyhow::anyhow!("unreadable options service response"))
    }

    /// One snapshot poll. Ok(true) = a new snapshot was installed.
    pub async fn poll(&self, pool: Option<&PgPool>) -> anyhow::Result<bool> {
        let etag = self.etag.lock().unwrap().clone();
        let extra: Vec<(&str, String)> = match (&etag, self.snapshot()) {
            (Some(e), Some(_)) => vec![("If-None-Match", e.clone())],
            _ => vec![],
        };
        let (status, headers, body) = self.get("/v1/internal/options/snapshot", &extra).await?;
        let now = Utc::now().timestamp_millis();
        match status {
            304 => {
                self.last_ok_ms.store(now, Ordering::SeqCst);
                Ok(false)
            }
            200 => {
                let v: Value = serde_json::from_slice(&body)?;
                let snap = OptSnapshot::from_json(v.clone())?;
                let version = snap.version;
                let tag = headers.get("etag").cloned().unwrap_or_else(|| format!("\"opt-{version}\""));
                let changed = self.version() != Some(version);
                self.set_snapshot(snap, now);
                *self.etag.lock().unwrap() = Some(tag.clone());
                if changed {
                    tracing::info!(version, "options snapshot loaded");
                    if let Some(pool) = pool
                        && let Err(e) = sqlx::query(
                            "INSERT INTO option_snapshot (id, version, etag, body, fetched_at) VALUES (1, $1, $2, $3, now())
                             ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, etag = EXCLUDED.etag, body = EXCLUDED.body, fetched_at = EXCLUDED.fetched_at",
                        )
                        .bind(version)
                        .bind(&tag)
                        .bind(sqlx::types::Json(&v))
                        .execute(pool)
                        .await
                    {
                        tracing::warn!(error = %e, "options snapshot could not be stored");
                    }
                }
                Ok(changed)
            }
            s => anyhow::bail!("options service answered {s}"),
        }
    }

    /// Loads the last stored snapshot (start-up); it counts as confirmed when it was fetched.
    pub async fn load_stored(&self, pool: &PgPool) -> anyhow::Result<bool> {
        let Some(r) = sqlx::query("SELECT etag, body, fetched_at FROM option_snapshot WHERE id = 1").fetch_optional(pool).await? else { return Ok(false) };
        let body: sqlx::types::Json<Value> = r.get("body");
        let at: DateTime<Utc> = r.get("fetched_at");
        let s = OptSnapshot::from_json(body.0)?;
        tracing::info!(version = s.version, fetched = %at, "options snapshot restored from the database");
        self.set_snapshot(s, at.timestamp_millis());
        *self.etag.lock().unwrap() = r.get("etag");
        Ok(true)
    }

    /// Polls every 2 s forever (keeps the last snapshot on errors).
    pub fn spawn_poller(self: &Arc<Self>, pool: PgPool) {
        if !self.configured() {
            tracing::warn!("OPTIONS_URL not set: Kalks FX Options are off in the engine");
            return;
        }
        let me = self.clone();
        tokio::spawn(async move {
            if let Err(e) = me.load_stored(&pool).await {
                tracing::warn!(error = %e, "stored options snapshot unreadable");
            }
            let mut tick = tokio::time::interval(Duration::from_secs(2));
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            loop {
                tick.tick().await;
                match me.poll(Some(&pool)).await {
                    Ok(_) => {
                        if me.failing.swap(false, Ordering::Relaxed) {
                            tracing::info!("options service reachable again");
                        }
                    }
                    Err(e) => {
                        if !me.failing.swap(true, Ordering::Relaxed) {
                            tracing::warn!(error = %e, "options snapshot poll failed; keeping the last snapshot");
                        }
                    }
                }
                me.purge(Utc::now().timestamp_millis());
            }
        });
    }

    /// The current fixing of one expiry (`/v1/internal/options/fixings`).
    pub async fn fixing(&self, symbol: &str, date: NaiveDate) -> anyhow::Result<Option<Fixing>> {
        let (status, _, body) = self.get(&format!("/v1/internal/options/fixings?expiry={date}&u={symbol}"), &[]).await?;
        anyhow::ensure!(status == 200, "options service answered {status}");
        let v: Value = serde_json::from_slice(&body)?;
        let Some(fx) = v["fixings"].as_array().and_then(|a| a.iter().find(|x| x["symbol"].as_str() == Some(symbol))) else { return Ok(None) };
        Ok(Some(Fixing {
            symbol: symbol.to_string(),
            date,
            cut_at: fx["cutAt"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&Utc)).unwrap_or_default(),
            status: fx["status"].as_str().unwrap_or("").to_string(),
            price: fx["fixing"].as_f64().and_then(from_f64),
            run: fx["run"].as_i64().unwrap_or(0) as i32,
            source: fx["source"].as_str().map(str::to_string),
        }))
    }
}

impl OptionPricing for OptionsCtx {
    fn snapshot(&self) -> Option<Arc<OptSnapshot>> {
        self.snap.read().unwrap().clone()
    }

    fn stale(&self, now: DateTime<Utc>) -> bool {
        match self.snapshot() {
            None => true,
            Some(s) => now.timestamp_millis() - self.last_ok_ms() > s.stale_after_secs as i64 * 1000,
        }
    }

    fn spot(&self, symbol: &str) -> Option<(f64, i64)> {
        self.raw_spot(symbol)
    }

    fn price(&self, tenant: &str, group: &str, terms: &OptionTerms, now: DateTime<Utc>) -> Result<OptPrice, PriceError> {
        let snap = self.snapshot().ok_or(PriceError::NoVol)?;
        compute_price(&snap, &|s| self.spot(s), &|c| self.usd_per(c), tenant, group, terms, now)
    }

    fn mark(&self, tenant: &str, group: &str, terms: &OptionTerms, now: DateTime<Utc>) -> Option<OptPrice> {
        let snap = self.snapshot()?;
        let sp = self.spot(&terms.underlying).map(|s| s.0.to_bits()).unwrap_or(0);
        let uq = self.usd_per(&terms.quote_ccy).map(f64::to_bits).unwrap_or(0);
        let bucket = now.timestamp_millis() / BUCKET_MS;
        let key = format!("{tenant}|{group}|{}|{:?}|{sp}|{uq}|{}", terms.series, terms.barrier, snap.version);
        if let Some((b, p)) = self.marks.lock().unwrap().get(&key)
            && *b == bucket
        {
            return Some(*p);
        }
        let p = compute_price(&snap, &|s| self.spot(s), &|c| self.usd_per(c), tenant, group, terms, now).ok()?;
        let mut m = self.marks.lock().unwrap();
        if m.len() > 50_000 {
            m.clear();
        }
        m.insert(key, (bucket, p));
        Some(p)
    }

    fn scenario(&self, tenant: &str, underlying: &str, legs: &[ScenLeg], cfd_units: f64, now: DateTime<Utc>) -> Option<ScenOut> {
        let snap = self.snapshot()?;
        let sp = self.spot(underlying).map(|s| s.0.to_bits()).unwrap_or(0);
        let bucket = now.timestamp_millis() / BUCKET_MS;
        let mut key = format!("{tenant}|{underlying}|{}|{sp}|{}", cfd_units.to_bits(), snap.version);
        for l in legs {
            key.push_str(&format!("|{}:{:?}:{}", l.terms.series, l.terms.barrier, l.contracts));
        }
        if let Some((b, s)) = self.scen.lock().unwrap().get(&key)
            && *b == bucket
        {
            return Some(*s);
        }
        let out = compute_scenario(&snap, &|s| self.spot(s), &|c| self.usd_per(c), tenant, underlying, legs, cfd_units, now)?;
        let mut m = self.scen.lock().unwrap();
        if m.len() > 20_000 {
            m.clear();
        }
        m.insert(key, (bucket, out));
        Some(out)
    }

    fn book_top(&self, tenant: &str, kind: crate::model::AccountKind, series: &str) -> Option<crate::book::md::TopQuote> {
        self.top.get(tenant, kind, series)
    }
}

/// Status, headers (lower-case names) and body of a raw HTTP/1.1 response (chunked or not).
pub fn parse_http(buf: &[u8]) -> Option<(u16, HashMap<String, String>, Vec<u8>)> {
    let split = buf.windows(4).position(|w| w == b"\r\n\r\n")?;
    let head = std::str::from_utf8(&buf[..split]).ok()?;
    let mut lines = head.lines();
    let status: u16 = lines.next()?.split_whitespace().nth(1)?.parse().ok()?;
    let headers: HashMap<String, String> = lines.filter_map(|l| l.split_once(':').map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_string()))).collect();
    let (_, body) = crate::social::wallet::parse_response(buf)?;
    Some((status, headers, body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_headers_and_body() {
        let (s, h, b) = parse_http(b"HTTP/1.1 304 Not Modified\r\nETag: \"opt-7\"\r\n\r\n").unwrap();
        assert_eq!((s, h.get("etag").map(String::as_str), b.len()), (304, Some("\"opt-7\""), 0));
        let (s, _, b) = parse_http(b"HTTP/1.1 200 OK\r\ntransfer-encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n").unwrap();
        assert_eq!((s, b.as_slice()), (200, &b"{}"[..]));
    }

    #[test]
    fn weekend_add_on_days() {
        let t = |s: &str| DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc);
        assert!(!weekend_margin(t("2026-10-01T15:00:00Z"))); // Thursday
        assert!(weekend_margin(t("2026-10-02T15:00:00Z"))); // Friday
        assert!(weekend_margin(t("2026-10-04T20:00:00Z"))); // Sunday 16:00 NY
        assert!(!weekend_margin(t("2026-10-05T05:00:00Z"))); // Monday 01:00 NY
    }
}
