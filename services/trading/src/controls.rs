//! Client controls in the engine (the gateway owns them: services/gateway/src/client_controls.rs).
//!
//! **Restrictions.** The engine keeps every active client restriction in memory (`Restrictions`, in `Shared`):
//! reloaded from the gateway (`GET /v1/internal/restrictions`) every 10 s and refreshed for one client at once
//! when the Back Office changes it (`POST /v1/internal/restrictions/refresh`). Expiry is evaluated on every
//! check, so a timed restriction ends on time even between reloads. The engine enforces:
//! * `trading`: no client order, modification or close (dealers still can; SL / TP / stop-out still run);
//! * `close_only`: closes and reductions only, no new exposure;
//! * `login`: Ezymex Trader sign-in and SSO are refused, every terminal session of the client ends and open
//!   streams close;
//! * `social`: no new copy subscription, PAMM investment or fund, master application, MAM link or programme.
//!   (`freeze` arrives expanded by the gateway.)
//!
//! **Presence.** Every Ezymex Trader stream of a client's own session is registered in `Presence`; the engine
//! reports the live connections (and the ones that closed) to the gateway every 15 s and right after a change
//! (`POST /v1/internal/presence/trader`), which is where the Back Office reads Online / Away / Offline. Staff
//! sessions opened as the client are never reported.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Notify;

use crate::engine::Reject;
use crate::shard::Hub;

// ---------- restrictions ----------

type Kinds = Vec<(String, Option<DateTime<Utc>>)>;

/// Active client restrictions by gateway user id (kind, expiry).
#[derive(Default)]
pub struct Restrictions(RwLock<HashMap<i64, Kinds>>);

impl Restrictions {
    pub fn has(&self, user_id: i64, kind: &str, now: DateTime<Utc>) -> bool {
        self.0.read().unwrap().get(&user_id).is_some_and(|ks| ks.iter().any(|(k, e)| k == kind && e.is_none_or(|e| e > now)))
    }

    /// The client's active restriction kinds (sorted).
    pub fn kinds(&self, user_id: i64, now: DateTime<Utc>) -> Vec<String> {
        let mut v: Vec<String> = self.0.read().unwrap().get(&user_id).map(|ks| ks.iter().filter(|(_, e)| e.is_none_or(|e| e > now)).map(|(k, _)| k.clone()).collect()).unwrap_or_default();
        v.sort();
        v.dedup();
        v
    }

    pub fn login_blocked(&self, user_id: i64, now: DateTime<Utc>) -> bool {
        self.has(user_id, "login", now)
    }

    /// Replaces the whole cache; returns the clients whose sign-in is blocked now and wasn't before.
    pub fn replace(&self, all: HashMap<i64, Kinds>) -> Vec<i64> {
        let now = Utc::now();
        let mut newly: Vec<i64> = all.keys().copied().filter(|u| all[u].iter().any(|(k, e)| k == "login" && e.is_none_or(|e| e > now)) && !self.login_blocked(*u, now)).collect();
        newly.sort_unstable();
        *self.0.write().unwrap() = all;
        newly
    }

    /// Replaces one client's restrictions; true when their sign-in is blocked now and wasn't before.
    pub fn set_user(&self, user_id: i64, kinds: Kinds) -> bool {
        let now = Utc::now();
        let was = self.login_blocked(user_id, now);
        let is = kinds.iter().any(|(k, e)| k == "login" && e.is_none_or(|e| e > now));
        let mut m = self.0.write().unwrap();
        if kinds.is_empty() {
            m.remove(&user_id);
        } else {
            m.insert(user_id, kinds);
        }
        is && !was
    }

    /// `{items: [{user_id, kinds: [{kind, expires_at}]}]}` from the gateway.
    pub fn parse(v: &Value) -> HashMap<i64, Kinds> {
        let mut out: HashMap<i64, Kinds> = HashMap::new();
        for it in v["items"].as_array().map(Vec::as_slice).unwrap_or_default() {
            let Some(u) = it["user_id"].as_i64() else { continue };
            let ks: Kinds = it["kinds"]
                .as_array()
                .map(Vec::as_slice)
                .unwrap_or_default()
                .iter()
                .filter_map(|k| {
                    let kind = k["kind"].as_str()?.to_string();
                    let exp = k["expires_at"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&Utc));
                    Some((kind, exp))
                })
                .collect();
            out.insert(u, ks);
        }
        out
    }
}

/// Refusal of a client (not dealer) action on an account of `user_id` (`trade::gate`).
pub fn trading_reject(r: &Restrictions, user_id: i64, opening: bool, now: DateTime<Utc>) -> Option<Reject> {
    if r.has(user_id, "trading", now) {
        return Some(Reject::new("trading_disabled", "Trading is disabled on your account. Contact support."));
    }
    if opening && r.has(user_id, "close_only", now) {
        return Some(Reject::new("close_only", "Your account is in close-only mode: you can close positions but not open new ones."));
    }
    None
}

pub const SOCIAL_MESSAGE: &str = "Copy trading, PAMM and MAM are disabled on your account. Contact support.";
pub const SUSPENDED_MESSAGE: &str = "This account is suspended. Contact support.";

// ---------- presence ----------

/// One Ezymex Trader stream of a client's own session.
#[derive(Clone, Debug)]
pub struct Conn {
    pub user_id: i64,
    pub login: i64,
    pub ip: Option<String>,
    pub country: Option<String>,
    pub user_agent: Option<String>,
    pub since: DateTime<Utc>,
}

pub struct Presence {
    /// Per engine process, so connection keys never collide across restarts.
    instance: String,
    seq: AtomicU64,
    conns: Mutex<HashMap<u64, Conn>>,
    ended: Mutex<Vec<String>>,
    changed: Notify,
}

impl Default for Presence {
    fn default() -> Self {
        Self { instance: crate::auth::random_token(4).replace(['-', '_'], "x"), seq: AtomicU64::new(0), conns: Mutex::default(), ended: Mutex::default(), changed: Notify::new() }
    }
}

/// Unregisters the connection when the stream ends.
pub struct PresenceGuard {
    p: Arc<Presence>,
    id: u64,
}

impl Drop for PresenceGuard {
    fn drop(&mut self) {
        if self.p.conns.lock().unwrap().remove(&self.id).is_some() {
            self.p.ended.lock().unwrap().push(self.p.key(self.id));
            self.p.changed.notify_one();
        }
    }
}

impl Presence {
    fn key(&self, id: u64) -> String {
        format!("{}-{id}", self.instance)
    }

    pub fn register(self: &Arc<Self>, c: Conn) -> PresenceGuard {
        let id = self.seq.fetch_add(1, Ordering::Relaxed) + 1;
        self.conns.lock().unwrap().insert(id, c);
        self.changed.notify_one();
        PresenceGuard { p: self.clone(), id }
    }

    pub fn live(&self) -> usize {
        self.conns.lock().unwrap().len()
    }

    /// The report body for the gateway; the ended keys are taken (put back with `restore` on failure).
    pub fn report(&self) -> (Value, Vec<String>) {
        let items: Vec<Value> = self
            .conns
            .lock()
            .unwrap()
            .iter()
            .map(|(id, c)| json!({ "conn": self.key(*id), "user_id": c.user_id, "login": c.login, "ip": c.ip, "country": c.country, "user_agent": c.user_agent, "since": c.since }))
            .collect();
        let ended = std::mem::take(&mut *self.ended.lock().unwrap());
        (json!({ "items": items, "ended": ended }), ended)
    }

    pub fn restore(&self, ended: Vec<String>) {
        let mut e = self.ended.lock().unwrap();
        e.extend(ended);
        let n = e.len();
        if n > 10_000 {
            e.drain(..n - 10_000);
        }
    }
}

// ---------- gateway client ----------

/// Plain HTTP/1.1 calls to the gateway's internal API (`GATEWAY_URL`, `X-Ezymex-Internal: GATEWAY_INTERNAL_TOKEN`),
/// like the wallet client: the gateway is an internal service on the loopback / private network.
#[derive(Clone, Debug)]
pub struct Gateway {
    host: String,
    token: String,
}

impl Gateway {
    pub fn new(url: &str, token: &str) -> Self {
        Self { host: url.trim().trim_end_matches('/').trim_start_matches("http://").to_string(), token: token.to_string() }
    }

    pub fn configured(&self) -> bool {
        !self.host.is_empty()
    }

    pub async fn call(&self, method: &str, path: &str, body: Option<&Value>) -> anyhow::Result<(u16, Value)> {
        anyhow::ensure!(self.configured(), "GATEWAY_URL is not set");
        let payload = body.map(Value::to_string).unwrap_or_default();
        let req = format!(
            "{method} {path} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nX-Ezymex-Internal: {}\r\nX-Ezymex-Service: trading\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
            self.host,
            self.token,
            payload.len()
        );
        let io = async {
            let mut s = tokio::net::TcpStream::connect(&self.host).await?;
            s.write_all(req.as_bytes()).await?;
            let mut buf = Vec::new();
            s.read_to_end(&mut buf).await?;
            Ok::<_, std::io::Error>(buf)
        };
        let buf = tokio::time::timeout(Duration::from_secs(8), io).await.map_err(|_| anyhow::anyhow!("gateway timeout"))??;
        let (status, body) = crate::social::wallet::parse_response(&buf).ok_or_else(|| anyhow::anyhow!("unreadable gateway response"))?;
        Ok((status, serde_json::from_slice(&body).unwrap_or(Value::Null)))
    }
}

// ---------- enforcement side effects ----------

/// Ends every Ezymex Trader session of a client (sign-in blocked). Streams close on their next heartbeat.
pub async fn revoke_sessions(pool: &PgPool, hub: &Hub, user_id: i64) -> anyhow::Result<u64> {
    let logins: Vec<i64> = hub.shared.index.read().unwrap().accounts.iter().filter(|(_, m)| m.user_id == user_id).map(|(l, _)| *l).collect();
    if logins.is_empty() {
        return Ok(0);
    }
    let n = sqlx::query("UPDATE terminal_sessions SET revoked_at = now() WHERE login = ANY($1) AND revoked_at IS NULL").bind(&logins).execute(pool).await?.rows_affected();
    if n > 0 {
        tracing::info!(user_id, sessions = n, "terminal sessions ended: sign-in blocked");
    }
    Ok(n)
}

/// Reloads one client's restrictions from the gateway (Back Office change); ends their sessions when their
/// sign-in was just blocked. Returns the client's active kinds.
pub async fn refresh_user(gw: &Gateway, pool: &PgPool, hub: &Hub, user_id: i64) -> anyhow::Result<Vec<String>> {
    let (status, v) = gw.call("GET", &format!("/v1/internal/restrictions?user_id={user_id}"), None).await?;
    anyhow::ensure!(status == 200, "gateway answered {status}");
    let kinds = Restrictions::parse(&v).remove(&user_id).unwrap_or_default();
    let r = &hub.shared.restrictions;
    if r.set_user(user_id, kinds) {
        revoke_sessions(pool, hub, user_id).await?;
    }
    Ok(r.kinds(user_id, Utc::now()))
}

async fn reload(gw: &Gateway, pool: &PgPool, hub: &Hub) -> anyhow::Result<usize> {
    let (status, v) = gw.call("GET", "/v1/internal/restrictions", None).await?;
    anyhow::ensure!(status == 200, "gateway answered {status}");
    let all = Restrictions::parse(&v);
    let n = all.len();
    for u in hub.shared.restrictions.replace(all) {
        revoke_sessions(pool, hub, u).await?;
    }
    Ok(n)
}

/// Background tasks: the restriction cache (every 10 s) and presence reports (every 15 s, and ~1 s after a
/// connection opens or closes).
pub fn spawn(hub: Hub, pool: PgPool, gw: Arc<Gateway>, presence: Arc<Presence>) {
    if !gw.configured() {
        tracing::warn!("GATEWAY_URL not set: client restrictions and Ezymex Trader presence are off");
        return;
    }
    {
        let (hub, pool, gw) = (hub.clone(), pool.clone(), gw.clone());
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(10));
            let mut failing = false;
            loop {
                tick.tick().await;
                match reload(&gw, &pool, &hub).await {
                    Ok(n) => {
                        if failing {
                            tracing::info!(clients = n, "client restrictions reloaded");
                        }
                        failing = false;
                    }
                    Err(e) => {
                        // keep the last known restrictions
                        if !failing {
                            tracing::warn!(error = %e, "client restrictions could not be reloaded from the gateway");
                        }
                        failing = true;
                    }
                }
            }
        });
    }
    tokio::spawn(async move {
        loop {
            let _ = tokio::time::timeout(Duration::from_secs(15), presence.changed.notified()).await;
            // debounce bursts (a page opening several streams)
            tokio::time::sleep(Duration::from_millis(800)).await;
            let (body, ended) = presence.report();
            match gw.call("POST", "/v1/internal/presence/trader", Some(&body)).await {
                Ok((200, _)) => {}
                Ok((s, v)) => {
                    tracing::warn!(status = s, error = %v, "presence report refused");
                    presence.restore(ended);
                }
                Err(e) => {
                    tracing::debug!(error = %e, "presence report failed");
                    presence.restore(ended);
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restrictions_expire_and_replace() {
        let r = Restrictions::default();
        let now = Utc::now();
        let soon = now + chrono::Duration::minutes(5);
        assert!(!r.has(7, "trading", now));
        assert!(!r.set_user(7, vec![("trading".into(), None), ("close_only".into(), Some(soon))]));
        assert!(r.has(7, "trading", now) && r.has(7, "close_only", now));
        // expiry is checked on every call
        assert!(!r.has(7, "close_only", soon + chrono::Duration::seconds(1)));
        assert_eq!(r.kinds(7, now), vec!["close_only", "trading"]);
        // a new sign-in block is reported once
        assert!(r.set_user(7, vec![("login".into(), None)]));
        assert!(!r.set_user(7, vec![("login".into(), None)]));
        assert!(r.login_blocked(7, now) && !r.has(7, "trading", now));
        let v = json!({"items": [{"user_id": 7, "kinds": [{"kind": "login", "expires_at": null}]}, {"user_id": 9, "kinds": [{"kind": "login", "expires_at": soon.to_rfc3339()}, {"kind": "withdrawals", "expires_at": null}]}]});
        assert_eq!(r.replace(Restrictions::parse(&v)), vec![9]);
        assert!(r.has(9, "withdrawals", now));
        // lifted in the gateway = gone from the next reload
        assert!(r.replace(HashMap::new()).is_empty());
        assert!(!r.login_blocked(7, now) && r.kinds(9, now).is_empty());
        assert!(!r.set_user(9, vec![]));
    }

    #[test]
    fn trading_and_close_only_rejections() {
        let r = Restrictions::default();
        let now = Utc::now();
        assert!(trading_reject(&r, 1, true, now).is_none());
        r.set_user(1, vec![("close_only".into(), None)]);
        assert_eq!(trading_reject(&r, 1, true, now).unwrap().code, "close_only");
        assert!(trading_reject(&r, 1, false, now).is_none(), "closes stay allowed in close-only mode");
        r.set_user(1, vec![("trading".into(), None), ("close_only".into(), None)]);
        assert_eq!(trading_reject(&r, 1, false, now).unwrap().code, "trading_disabled");
        assert!(trading_reject(&r, 2, true, now).is_none(), "other clients are untouched");
    }

    /// The real engine core: the restriction is checked for client actions, never for the dealing desk.
    #[test]
    fn engine_enforces_client_restrictions_but_dealers_still_act() {
        use crate::engine::testkit::{Harness, Kit, d};
        use crate::engine::trade::{self, CloseReq, DealerCtx, OrderReq, PlaceResult, PositionPatch};
        use crate::model::Side;
        let kit = Kit::new();
        kit.quote("EURUSD", "1.10000", "1.10010");
        let mut h = Harness::live(&kit, "hedge", "100000");
        let user = h.st.account.user_id;
        let open = |h: &mut Harness, v: &str| h.run(&kit, |tx, env| trade::place_order(tx, env, OrderReq::market("EURUSD", Side::Buy, d(v))));
        let t1 = match open(&mut h, "1").unwrap() {
            PlaceResult::Filled { position_ticket: Some(t), .. } => t,
            other => panic!("{other:?}"),
        };
        let t2 = match open(&mut h, "0.5").unwrap() {
            PlaceResult::Filled { position_ticket: Some(t), .. } => t,
            other => panic!("{other:?}"),
        };

        // close-only: a new order is refused with a readable reason; closing is still allowed
        kit.restrictions.set_user(user, vec![("close_only".into(), None)]);
        let e = open(&mut h, "0.2").unwrap_err();
        assert_eq!(e.code, "close_only");
        assert!(e.message.contains("close positions"));
        assert!(h.run(&kit, |tx, env| trade::close_position(tx, env, t1, CloseReq::default())).is_ok());
        // SL / TP can still be changed in close-only mode
        assert!(h.run(&kit, |tx, env| trade::modify_position(tx, env, t2, PositionPatch { sl: Some(Some(d("1.05"))), ..Default::default() }, None)).is_ok());

        // trading disabled: no order, no close, no SL / TP change by the client; the dealing desk still closes
        kit.restrictions.set_user(user, vec![("trading".into(), None)]);
        assert_eq!(open(&mut h, "0.1").unwrap_err().code, "trading_disabled");
        assert_eq!(h.run(&kit, |tx, env| trade::close_position(tx, env, t2, CloseReq::default())).unwrap_err().code, "trading_disabled");
        assert_eq!(h.run(&kit, |tx, env| trade::modify_position(tx, env, t2, PositionPatch { tp: Some(Some(d("1.2"))), ..Default::default() }, None)).unwrap_err().code, "trading_disabled");
        let dealer = DealerCtx { staff: "Dealer".into(), reason_code: "DLR-03 · Risk management".into(), force: false };
        assert!(h.run(&kit, |tx, env| trade::close_position(tx, env, t2, CloseReq { dealer: Some(dealer), ..Default::default() })).is_ok());

        // an expired restriction no longer applies; a lifted one is gone
        kit.restrictions.set_user(user, vec![("trading".into(), Some(kit.now - chrono::Duration::seconds(1)))]);
        assert!(open(&mut h, "0.1").is_ok());
        kit.restrictions.set_user(user, vec![]);
        assert!(open(&mut h, "0.1").is_ok());
        h.assert_ledger();
        h.assert_replay();
    }

    #[test]
    fn presence_registers_and_reports_ended_connections() {
        let p = Arc::new(Presence::default());
        let c = Conn { user_id: 3, login: 10000001, ip: Some("198.51.100.1".into()), country: Some("in".into()), user_agent: None, since: Utc::now() };
        let g1 = p.register(c.clone());
        let g2 = p.register(c);
        assert_eq!(p.live(), 2);
        let (body, ended) = p.report();
        assert_eq!(body["items"].as_array().unwrap().len(), 2);
        assert!(ended.is_empty());
        drop(g1);
        let (body, ended) = p.report();
        assert_eq!((body["items"].as_array().unwrap().len(), ended.len()), (1, 1));
        // a failed report keeps the ended keys for the next one
        p.restore(ended);
        drop(g2);
        let (body, ended) = p.report();
        assert_eq!((body["items"].as_array().unwrap().len(), ended.len()), (0, 2));
        assert_ne!(ended[0], ended[1]);
    }
}
