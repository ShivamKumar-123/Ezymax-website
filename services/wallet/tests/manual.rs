//! Manual payments (bank / UPI and any-network crypto, approved by staff) against PostgreSQL through the real HTTP
//! router. Throw-away database per test (skipped when PostgreSQL is not reachable), images in a temp directory.
//! Covers: payment methods (validation, permissions, optimistic concurrency, hide / delete, audit), QR and screenshot
//! uploads (type sniffing, size limit, who may read), deposit requests (min / max, hidden method, duplicate UTR /
//! hash, on-chain hash, idempotent submit, the pending cap, the deposits restriction, cancel only own pending) and the
//! review (approve credits once and is retry-safe, a changed amount needs a note, reject needs a reason), the history,
//! the CSV export and the ledger invariants.

use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use wallet::chain::mock::MockChain;
use wallet::chain::{Chain, ChainId};
use wallet::config::Config;
use wallet::engine::MockEngine;
use wallet::state::{AppState, Tenants};
use wallet::users::MockUsers;
use wallet::{db, ledger};

/// The Finance preset: reads, approves, exports; no wallet settings.
const FINANCE: &str = "finance.read,finance.write,finance.approve,finance.export,finance.adjust";
/// Admin: also edits payment methods (finance.settings).
const ADMIN: &str = "finance.read,finance.write,finance.approve,finance.export,finance.settings";
const READER: &str = "finance.read";
const BSC_ADDR: &str = "0x11e9373d598703F83582e34378E086EbEEC5da11";
const TRON_ADDR: &str = "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ";

struct T {
    st: AppState,
    base: String,
    http: reqwest::Client,
    users: Arc<MockUsers>,
    admin: PgConnectOptions,
    name: String,
}

fn png(len: usize) -> Vec<u8> {
    let mut b = b"\x89PNG\r\n\x1a\n".to_vec();
    b.resize(len.max(16), 7);
    b
}

impl T {
    async fn new(what: &str) -> Option<Self> {
        let base = std::env::var("WALLET_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
        let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
        if admin.connect().await.is_err() {
            eprintln!("skipping {what}: no PostgreSQL at {base}");
            return None;
        }
        let mut b = [0u8; 5];
        getrandom::fill(&mut b).unwrap();
        let suffix: String = b.iter().map(|x| format!("{x:02x}")).collect();
        let name = format!("ezymex_wallet_test_{suffix}");
        let url = admin.clone().database(&name).to_url_lossy().to_string();
        let pool = db::connect(&url).await.expect("create + migrate test db");
        let mut cfg = Config::for_tests(&url);
        cfg.storage_dir = std::env::temp_dir().join(format!("ezymex-wallet-media-{suffix}")).to_string_lossy().into_owned();
        wallet::media::ensure_dir(&cfg.storage_dir).await.unwrap();
        wallet::settings::seed(&pool, &cfg).await.unwrap();
        let mut chains: HashMap<ChainId, Arc<dyn Chain>> = HashMap::new();
        chains.insert(ChainId::Tron, Arc::new(MockChain::new(ChainId::Tron)));
        let users = Arc::new(MockUsers::default());
        for u in [7, 8, 9] {
            users.set(u, "verified");
        }
        let st = AppState {
            tenants: Tenants::load(&pool).await.unwrap(),
            pool,
            cfg: Arc::new(cfg),
            chains: Arc::new(chains),
            engine: Arc::new(MockEngine::default()),
            users: users.clone(),
            transfer_lock: Default::default(),
        };
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let app = wallet::api::router(st.clone());
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Some(T { st, base: base_url, http: reqwest::Client::new(), users, admin, name })
    }

    fn req(&self, method: &str, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{path}", self.base);
        let rb = match method {
            "GET" => self.http.get(url),
            "PUT" => self.http.put(url),
            _ => self.http.post(url),
        };
        rb.header("x-ezymex-internal", "test-internal-token").header("x-forwarded-for", "203.0.113.9")
    }

    async fn send(rb: reqwest::RequestBuilder) -> (u16, Value) {
        let r = rb.send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }

    /// Staff call with a forwarded permission list.
    async fn staff(&self, id: &str, perms: &str, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
        let mut rb = self.req(method, path).header("x-ezymex-staff-id", id).header("x-ezymex-staff-name", format!("Staff%20{id}")).header("x-ezymex-staff-role", "finance").header("x-ezymex-staff-perms", perms);
        if let Some(b) = body {
            rb = rb.json(&b);
        }
        Self::send(rb).await
    }
    async fn admin_(&self, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
        self.staff("1", ADMIN, method, path, body).await
    }
    async fn fin(&self, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
        self.staff("5", FINANCE, method, path, body).await
    }
    async fn client(&self, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
        let mut rb = self.req(method, path);
        if let Some(b) = body {
            rb = rb.json(&b);
        }
        Self::send(rb).await
    }
    async fn upload(&self, path: &str, bytes: Vec<u8>, staff: bool) -> (u16, Value) {
        let mut rb = self.req("POST", path).header("content-type", "application/octet-stream").body(bytes);
        if staff {
            rb = rb.header("x-ezymex-staff-id", "1").header("x-ezymex-staff-role", "admin").header("x-ezymex-staff-perms", ADMIN);
        }
        Self::send(rb).await
    }
    async fn get_raw(&self, path: &str, staff: bool) -> (u16, Option<String>, Vec<u8>) {
        let mut rb = self.req("GET", path);
        if staff {
            rb = rb.header("x-ezymex-staff-id", "1").header("x-ezymex-staff-role", "admin").header("x-ezymex-staff-perms", ADMIN);
        }
        let r = rb.send().await.unwrap();
        let status = r.status().as_u16();
        let ct = r.headers().get("content-type").and_then(|v| v.to_str().ok()).map(str::to_string);
        (status, ct, r.bytes().await.unwrap().to_vec())
    }
    async fn available(&self, user: i64) -> String {
        let (_, v) = self.client("GET", &format!("/v1/wallets/{user}"), None).await;
        v["balances"][0]["available"].as_str().unwrap().to_string()
    }
    async fn count(&self, sql: &str) -> i64 {
        sqlx::query_scalar(sqlx::AssertSqlSafe(sql.to_string())).fetch_one(&self.st.pool).await.unwrap()
    }
    async fn invariants(&self) {
        let p = ledger::verify(&self.st.pool).await.unwrap();
        assert!(p.is_empty(), "ledger invariants: {p:?}");
    }
    async fn drop_db(self) {
        let _ = tokio::fs::remove_dir_all(&self.st.cfg.storage_dir).await;
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    /// A bank method in INR (88 INR = 1 USDT, 500–200,000 INR) and a BEP20 USDT method with MetaMask.
    async fn methods(&self) -> (i64, i64) {
        let (s, bank) = self
            .admin_(
                "POST",
                "/v1/admin/manual/methods",
                Some(json!({
                    "kind": "bank", "name": "HDFC Bank · UPI", "currency": "inr", "rate": "88", "min_amount": "500", "max_amount": "200000",
                    "details": {"account_name": "Ezymex Markets Ltd", "bank_name": "HDFC Bank", "account_number": "50200012345678", "ifsc": "hdfc0001234", "upi_id": "ezymex@hdfcbank"},
                    "instructions": "Pay from an account in your own name."
                })),
            )
            .await;
        assert_eq!(s, 200, "{bank}");
        let (s, crypto) = self
            .admin_(
                "POST",
                "/v1/admin/manual/methods",
                Some(json!({
                    "kind": "crypto", "name": "USDT · BEP20", "currency": "USDT", "rate": 1, "min_amount": 10, "sort_order": 1,
                    "details": {"network": "bsc", "token": "usdt", "address": BSC_ADDR},
                    "evm": {"chain_id": 56, "token_contract": "0x55d398326f99059fF775485246999027B3197955", "token_decimals": 18}
                })),
            )
            .await;
        assert_eq!(s, 200, "{crypto}");
        (bank["method"]["id"].as_i64().unwrap(), crypto["method"]["id"].as_i64().unwrap())
    }
}

fn request(method: i64, user: i64, amount: &str, reference: &str, key: &str) -> Value {
    json!({"user_id": user, "method_id": method, "amount": amount, "reference": reference, "idempotency_key": key})
}

#[tokio::test]
async fn payment_methods_are_validated_permissioned_and_audited() {
    let Some(t) = T::new("payment methods").await else { return };
    let (bank, crypto) = t.methods().await;

    // stored normalised; the client list shows both in order, with the MetaMask config
    let (s, v) = t.client("GET", "/v1/manual/methods", None).await;
    assert_eq!(s, 200, "{v}");
    let list = v["methods"].as_array().unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0]["id"].as_i64(), Some(bank));
    assert_eq!(list[0]["currency"], "INR");
    assert_eq!(list[0]["details"]["ifsc"], "HDFC0001234");
    assert_eq!(list[1]["details"]["network"], "BEP20");
    assert_eq!(list[1]["details"]["token"], "USDT");
    assert_eq!(list[1]["evm"]["chain_id"], 56);
    assert!(list[0].get("created_by").is_none(), "no staff fields for clients");

    // validation
    for (bad, field) in [
        (json!({"kind": "bank", "name": "X Bank", "currency": "INR", "rate": "88", "details": {}}), "account_name"),
        (json!({"kind": "bank", "name": "X Bank", "currency": "INR", "rate": "0", "details": {"upi_id": "a@b"}}), "rate"),
        (json!({"kind": "bank", "name": "X Bank", "currency": "INR", "rate": "88", "min_amount": "100", "max_amount": "50", "details": {"upi_id": "pay@ybl"}}), "max_amount"),
        (json!({"kind": "crypto", "name": "USDT TRC20", "currency": "USDT", "rate": "1.02", "details": {"network": "TRC20", "address": TRON_ADDR}}), "rate"),
        (json!({"kind": "crypto", "name": "USDT TRC20", "currency": "USDT", "rate": "1", "details": {"network": "TRC20", "address": BSC_ADDR}}), "address"),
        (json!({"kind": "crypto", "name": "USDT TRC20", "currency": "USDT", "rate": "1", "details": {"network": "TRC20", "address": TRON_ADDR}, "evm": {"chain_id": 56}}), "evm"),
        (json!({"kind": "cash", "name": "Cash", "currency": "USD", "rate": "1", "details": {}}), "kind"),
    ] {
        let (s, v) = t.admin_("POST", "/v1/admin/manual/methods", Some(bad)).await;
        assert_eq!((s, v["error"]["field"].as_str()), (422, Some(field)), "{v}");
    }

    // Finance (no finance.settings) and read-only staff can't edit; readers can list
    let (s, _) = t.fin("POST", "/v1/admin/manual/methods", Some(json!({"kind": "bank", "name": "Y", "currency": "INR", "rate": "1", "details": {"upi_id": "y@ybl"}}))).await;
    assert_eq!(s, 403);
    let (s, v) = t.staff("9", READER, "GET", "/v1/admin/manual/methods", None).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["methods"].as_array().unwrap().len(), 2);
    assert_eq!(v["methods"][0]["version"], 1);
    let (s, _) = t.staff("9", "-", "GET", "/v1/admin/manual/methods", None).await;
    assert_eq!(s, 403);

    // full update with the loaded version; a stale version is refused
    let (_, v) = t.admin_("GET", "/v1/admin/manual/methods", None).await;
    let mut m = v["methods"][0].clone();
    m["rate"] = json!("90");
    m["status"] = json!("hidden");
    let (s, u) = t.admin_("PUT", &format!("/v1/admin/manual/methods/{bank}"), Some(m.clone())).await;
    assert_eq!(s, 200, "{u}");
    assert_eq!((u["method"]["rate"].as_str(), u["method"]["version"].as_i64(), u["method"]["status"].as_str()), (Some("90"), Some(2), Some("hidden")));
    let (s, v) = t.admin_("PUT", &format!("/v1/admin/manual/methods/{bank}"), Some(m)).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("stale")));
    // hidden methods are not offered
    let (_, v) = t.client("GET", "/v1/manual/methods", None).await;
    assert_eq!(v["methods"].as_array().unwrap().len(), 1);

    // delete: gone for clients and staff
    let (s, _) = t.admin_("POST", &format!("/v1/admin/manual/methods/{crypto}/delete"), Some(json!({"reason": "Address rotated"}))).await;
    assert_eq!(s, 200);
    let (_, v) = t.client("GET", "/v1/manual/methods", None).await;
    assert_eq!(v["methods"].as_array().unwrap().len(), 0);
    let (_, v) = t.admin_("GET", "/v1/admin/manual/methods", None).await;
    assert_eq!(v["methods"].as_array().unwrap().len(), 1);

    let actions = t.count("SELECT count(*) FROM audit_log WHERE action LIKE 'wallet.manual.method.%' AND actor_kind = 'staff' AND after IS NOT NULL").await;
    assert_eq!(actions, 4, "created ×2, hidden, deleted");
    let hidden = t.count("SELECT count(*) FROM audit_log WHERE action = 'wallet.manual.method.hidden' AND before->>'rate' = '88' AND after->>'rate' = '90'").await;
    assert_eq!(hidden, 1, "before / after in the audit log");
    t.drop_db().await;
}

#[tokio::test]
async fn images_are_sniffed_limited_and_private() {
    let Some(t) = T::new("manual payment images").await else { return };
    // QR (staff): PNG ok, GIF / HTML refused, too large refused (by the store and by the body limit)
    let (s, v) = t.upload("/v1/admin/manual/media", png(2048), true).await;
    assert_eq!(s, 200, "{v}");
    let qr = v["media"]["id"].as_str().unwrap().to_string();
    assert_eq!(v["media"]["mime"], "image/png");
    assert_eq!(v["media"]["url"], format!("/api/wallet/manual/media/{qr}"));
    for (body, code, status) in [(b"GIF89a......".to_vec(), "unsupported_type", 415), (b"<html><script>x</script>".to_vec(), "unsupported_type", 415), (vec![], "validation", 422)] {
        let (s, v) = t.upload("/v1/admin/manual/media", body, true).await;
        assert_eq!((s, v["error"]["code"].as_str()), (status, Some(code)), "{v}");
    }
    let (s, v) = t.upload("/v1/admin/manual/media", png(5 * 1024 * 1024 + 1), true).await;
    assert_eq!((s, v["error"]["code"].as_str()), (413, Some("too_large")), "{v}");
    let (s, v) = t.upload("/v1/admin/manual/media", png(6 * 1024 * 1024), true).await;
    assert_eq!((s, v["error"]["code"].as_str()), (413, Some("too_large")), "{v}");
    // a client can't upload a QR; staff without finance.settings neither
    let (s, _) = t.upload("/v1/admin/manual/media", png(100), false).await;
    assert_eq!(s, 401);

    // files are private (0600) under the storage dir
    let path: String = sqlx::query_scalar("SELECT path FROM payment_media WHERE id = $1").bind(&qr).fetch_one(&t.st.pool).await.unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let meta = std::fs::metadata(std::path::Path::new(&t.st.cfg.storage_dir).join(&path)).unwrap();
        assert_eq!(meta.permissions().mode() & 0o777, 0o600);
    }

    // proofs (clients): stored for the uploader
    let (s, v) = t.upload("/v1/manual/proofs?user_id=7", png(4096), false).await;
    assert_eq!(s, 200, "{v}");
    let proof = v["media"]["id"].as_str().unwrap().to_string();
    let (s, v) = t.upload("/v1/manual/proofs?user_id=7", b"%PDF-1.7".to_vec(), false).await;
    assert_eq!((s, v["error"]["code"].as_str()), (415, Some("unsupported_type")));
    let (s, _) = t.upload("/v1/manual/proofs", png(100), false).await;
    assert_eq!(s, 422, "user_id required");

    // reading: any client the QR, only the uploader the proof, staff both; unknown ids 404
    let (s, ct, bytes) = t.get_raw(&format!("/v1/manual/media/{qr}?user_id=8"), false).await;
    assert_eq!((s, ct.as_deref(), bytes.len()), (200, Some("image/png"), 2048));
    let (s, _, _) = t.get_raw(&format!("/v1/manual/media/{proof}?user_id=7"), false).await;
    assert_eq!(s, 200);
    let (s, _, _) = t.get_raw(&format!("/v1/manual/media/{proof}?user_id=8"), false).await;
    assert_eq!(s, 404);
    let (s, _, _) = t.get_raw(&format!("/v1/admin/manual/media/{proof}"), true).await;
    assert_eq!(s, 200);
    let (s, _, _) = t.get_raw("/v1/manual/media/000000000000000000000000?user_id=7", false).await;
    assert_eq!(s, 404);
    let (s, _, _) = t.get_raw("/v1/manual/media/..%2F..%2Fetc%2Fpasswd?user_id=7", false).await;
    assert_eq!(s, 404);

    // a method takes the QR; a proof id is not a QR
    let base = json!({"kind": "bank", "name": "UPI", "currency": "INR", "rate": "88", "details": {"upi_id": "ezymex@ybl", "account_name": "Ezymex"}});
    let mut with_proof = base.clone();
    with_proof["qr_media_id"] = json!(proof);
    let (s, v) = t.admin_("POST", "/v1/admin/manual/methods", Some(with_proof)).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("qr_media_id")));
    let mut with_qr = base;
    with_qr["qr_media_id"] = json!(qr);
    let (s, v) = t.admin_("POST", "/v1/admin/manual/methods", Some(with_qr)).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["method"]["qr_url"], format!("/api/wallet/manual/media/{qr}"));
    // a proof of another client can't be attached
    let method = v["method"]["id"].as_i64().unwrap();
    let mut r = request(method, 8, "1000", "UTR123456789", "k-proof-1");
    r["proof_media_id"] = json!(proof);
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(r)).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("proof_media_id")));
    let mut r = request(method, 7, "1000", "UTR123456789", "k-proof-2");
    r["proof_media_id"] = json!(proof);
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(r)).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["deposit"]["proof_url"], format!("/api/wallet/manual/media/{proof}"));
    let uploads = t.count("SELECT count(*) FROM audit_log WHERE action = 'wallet.manual.qr.uploaded'").await;
    assert_eq!(uploads, 1);
    t.drop_db().await;
}

#[tokio::test]
async fn deposit_requests_follow_the_rules() {
    let Some(t) = T::new("manual deposit requests").await else { return };
    let (bank, crypto) = t.methods().await;

    // min / max in the method currency, decimals, unknown method
    for (amount, code) in [("499.99", "below_minimum"), ("200000.01", "above_maximum")] {
        let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, amount, "UTR000000001", &format!("k-{amount}")))).await;
        assert_eq!((s, v["error"]["code"].as_str()), (422, Some(code)), "{v}");
    }
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "0", "UTR000000001", "k-zero"))).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("amount")));
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(999, 7, "1000", "UTR000000001", "k-unknown"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("method_unavailable")));
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "1000", "12", "k-shortref"))).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("reference")));

    // a valid request: expected credit = amount / rate, floored to 6 decimals; snapshot of the method
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "10000", " 4123 4567 8901 ", "k-first"))).await;
    assert_eq!(s, 200, "{v}");
    let d = &v["deposit"];
    assert_eq!((d["status"].as_str(), d["expected_credit"].as_str(), d["reference"].as_str()), (Some("pending"), Some("113.636363"), Some("412345678901")));
    assert_eq!((d["method"]["name"].as_str(), d["method"]["destination"].as_str(), d["currency"].as_str()), (Some("HDFC Bank · UPI"), Some("50200012345678"), Some("INR")));
    assert_eq!(v["deposit"]["replayed"], false);
    let first = d["id"].as_i64().unwrap();
    // the same submission again (double click): the same request
    let (s, again) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "10000", "412345678901", "k-first"))).await;
    assert_eq!((s, again["deposit"]["id"].as_i64(), again["deposit"]["replayed"].as_bool()), (200, Some(first), Some(true)));
    // same key, different request
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "10001", "412345678901", "k-first"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("idempotency_conflict")));
    // the same UTR again (any client, any case / spacing) is refused while pending or approved
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 8, "10000", "4123 4567 8901", "k-dup"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("reference_used")), "{v}");

    // crypto: a hash is lower-cased (0x on EVM networks) and keyed without 0x; a hash the automatic deposits know is refused
    let h = "AB".repeat(32);
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(crypto, 7, "50", &h, "k-c1"))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["deposit"]["reference"], format!("0x{}", "ab".repeat(32)));
    assert_eq!(v["deposit"]["expected_credit"], "50");
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(crypto, 8, "50", &format!("0x{}", "ab".repeat(32)), "k-c2"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("reference_used")));
    let onchain = "cd".repeat(32);
    sqlx::query("INSERT INTO deposits (tenant_id, user_id, chain, tx_hash, required_confirmations, status, source) VALUES (1, 9, 'bsc', $1, 15, 'credited', 'client')").bind(format!("0x{onchain}")).execute(&t.st.pool).await.unwrap();
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(crypto, 7, "50", &onchain, "k-c3"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("reference_used")), "{v}");

    // the pending cap: 5 per client (2 pending now)
    for i in 0..3 {
        let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "1000", &format!("UTR77700000{i}"), &format!("k-cap-{i}")))).await;
        assert_eq!(s, 200, "{v}");
    }
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "1000", "UTR777000009", "k-cap-9"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (429, Some("too_many_pending")));

    // cancel: only the owner, only while pending; it frees a slot and the reference
    let (s, _) = t.client("POST", &format!("/v1/manual/deposits/{first}/cancel"), Some(json!({"user_id": 8}))).await;
    assert_eq!(s, 404);
    let (s, v) = t.client("POST", &format!("/v1/manual/deposits/{first}/cancel"), Some(json!({"user_id": 7}))).await;
    assert_eq!((s, v["deposit"]["status"].as_str()), (200, Some("cancelled")));
    let (s, v) = t.client("POST", &format!("/v1/manual/deposits/{first}/cancel"), Some(json!({"user_id": 7}))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("invalid_state")));
    assert_eq!(t.count("SELECT count(*) FROM audit_log WHERE action = 'wallet.manual.deposit.cancelled' AND actor_kind = 'user' AND actor_id = '7'").await, 1);
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 8, "10000", "412345678901", "k-reuse"))).await;
    assert_eq!(s, 200, "a cancelled request's reference can be used again: {v}");

    // hidden method refused; the deposits restriction applies
    let (_, ms) = t.admin_("GET", "/v1/admin/manual/methods", None).await;
    let mut m = ms["methods"].as_array().unwrap().iter().find(|x| x["id"].as_i64() == Some(crypto)).unwrap().clone();
    m["status"] = json!("hidden");
    let (s, _) = t.admin_("PUT", &format!("/v1/admin/manual/methods/{crypto}"), Some(m)).await;
    assert_eq!(s, 200);
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(crypto, 9, "50", &"ef".repeat(32), "k-hidden"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (422, Some("method_unavailable")));
    t.users.restrict(9, &["deposits"]);
    let (s, v) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 9, "1000", "UTR999000001", "k-restricted"))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (403, Some("restricted")));

    // the client's own list, newest first, with the pending count
    let (s, v) = t.client("GET", "/v1/manual/deposits?user_id=7&limit=3", None).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["total"].as_i64(), v["items"].as_array().unwrap().len(), v["pending"].as_i64()), (Some(5), 3, Some(4)));
    let (s, _) = t.client("GET", &format!("/v1/manual/deposits/{first}?user_id=8"), None).await;
    assert_eq!(s, 404, "another client's request");
    t.drop_db().await;
}

#[tokio::test]
async fn review_credits_once_and_needs_reasons() {
    let Some(t) = T::new("manual deposit review").await else { return };
    let (bank, crypto) = t.methods().await;
    let (_, a) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "8800", "UTR100000001", "k-a"))).await;
    let a = a["deposit"]["id"].as_i64().unwrap();
    let (_, b) = t.client("POST", "/v1/manual/deposits", Some(request(crypto, 8, "250.5", &"12".repeat(32), "k-b"))).await;
    let b = b["deposit"]["id"].as_i64().unwrap();
    let (_, c) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "1000", "UTR100000003", "k-c"))).await;
    let c = c["deposit"]["id"].as_i64().unwrap();

    // the queue: counts, filters, detail with the explorer link
    let (s, v) = t.fin("GET", "/v1/admin/manual/deposits?status=pending", None).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["counts"]["pending"].as_i64(), v["counts"]["pending_bank"].as_i64(), v["counts"]["pending_crypto"].as_i64()), (Some(3), Some(2), Some(1)));
    assert_eq!(v["items"][0]["id"].as_i64(), Some(a), "oldest pending first");
    assert_eq!(v["items"][0]["user_email"], "u7@example.com");
    let (_, v) = t.fin("GET", "/v1/admin/manual/deposits?kind=crypto", None).await;
    assert_eq!(v["total"], 1);
    let (_, v) = t.fin("GET", "/v1/admin/manual/deposits?q=utr100000003", None).await;
    assert_eq!(v["items"][0]["id"].as_i64(), Some(c));
    let (s, v) = t.fin("GET", &format!("/v1/admin/manual/deposits/{b}"), None).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["deposit"]["explorer_url"], format!("https://bscscan.com/tx/0x{}", "12".repeat(32)));
    let (_, v) = t.fin("GET", "/v1/admin/summary", None).await;
    assert_eq!(v["manual_deposits"]["pending"], 3);

    // a read-only staff member can't decide
    let (s, _) = t.staff("9", READER, "POST", &format!("/v1/admin/manual/deposits/{a}/approve"), Some(json!({}))).await;
    assert_eq!(s, 403);

    // approve at the expected amount (8800 INR / 88 = 100 USDT): one credit, retry-safe
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{a}/approve"), Some(json!({}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["deposit"]["status"].as_str(), v["deposit"]["credit_amount"].as_str(), v["deposit"]["replayed"].as_bool()), (Some("approved"), Some("100"), Some(false)));
    assert_eq!(v["deposit"]["decided_by"]["id"], "5");
    assert_eq!(t.available(7).await, "100");
    let mut hs = vec![];
    for _ in 0..6 {
        let http = t.http.clone();
        let url = format!("{}/v1/admin/manual/deposits/{a}/approve", t.base);
        hs.push(tokio::spawn(async move {
            http.post(url)
                .header("x-ezymex-internal", "test-internal-token")
                .header("x-ezymex-staff-id", "5")
                .header("x-ezymex-staff-role", "finance")
                .header("x-ezymex-staff-perms", FINANCE)
                .json(&json!({}))
                .send()
                .await
                .unwrap()
                .json::<Value>()
                .await
                .unwrap()
        }));
    }
    for h in hs {
        let v = h.await.unwrap();
        assert_eq!((v["deposit"]["status"].as_str(), v["deposit"]["replayed"].as_bool()), (Some("approved"), Some(true)), "{v}");
    }
    assert_eq!(t.available(7).await, "100", "credited once");
    assert_eq!(t.count(&format!("SELECT count(*) FROM ledger_txns WHERE idempotency_key = 'manual:deposit:1:{a}' AND kind = 'bank_deposit'")).await, 1);
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{a}/approve"), Some(json!({"credit_amount": "99"}))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("invalid_state")));
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{a}/reject"), Some(json!({"reason": "Duplicate"}))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("invalid_state")));

    // a different amount needs a note
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{b}/approve"), Some(json!({"credit_amount": "250"}))).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("note")));
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{b}/approve"), Some(json!({"credit_amount": "250", "note": "0.5 USDT network fee kept"}))).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!((v["deposit"]["credit_amount"].as_str(), v["deposit"]["decision_note"].as_str()), (Some("250"), Some("0.5 USDT network fee kept")));
    assert_eq!(t.available(8).await, "250");
    assert_eq!(t.count(&format!("SELECT count(*) FROM ledger_txns WHERE idempotency_key = 'manual:deposit:1:{b}' AND kind = 'crypto_deposit'")).await, 1);

    // reject needs a reason; the client sees it
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{c}/reject"), Some(json!({"reason": " "}))).await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("reason")));
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{c}/reject"), Some(json!({"reason": "No payment received with this UTR"}))).await;
    assert_eq!((s, v["deposit"]["status"].as_str()), (200, Some("rejected")));
    let (_, v) = t.client("GET", &format!("/v1/manual/deposits/{c}?user_id=7"), None).await;
    assert_eq!(v["deposit"]["reason"], "No payment received with this UTR");
    let (s, v) = t.fin("POST", &format!("/v1/admin/manual/deposits/{c}/approve"), Some(json!({}))).await;
    assert_eq!((s, v["error"]["code"].as_str()), (409, Some("invalid_state")));
    // a rejected UTR may be sent again (the first try may have had a typo in the amount)
    let (s, _) = t.client("POST", "/v1/manual/deposits", Some(request(bank, 7, "1000", "UTR100000003", "k-c-again"))).await;
    assert_eq!(s, 200);

    // notifications, audit, history (Deposits tab includes the bank credit) and the ledger
    assert_eq!(t.count("SELECT count(*) FROM notifications WHERE user_id = 7 AND kind = 'deposit.credited' AND data ? 'manual_deposit_id'").await, 1);
    assert_eq!(t.count("SELECT count(*) FROM notifications WHERE user_id = 7 AND kind = 'deposit.rejected'").await, 1);
    assert_eq!(t.count("SELECT count(*) FROM audit_log WHERE action IN ('wallet.manual.deposit.approved', 'wallet.manual.deposit.rejected') AND before IS NOT NULL AND after IS NOT NULL").await, 3);
    let (_, v) = t.client("GET", "/v1/wallets/7/activity?type=deposit", None).await;
    let items = v["items"].as_array().unwrap();
    assert!(items.iter().any(|i| i["kind"] == "bank_deposit" && i["amount"] == "100" && i["direction"] == "in"), "{v}");
    let (_, v) = t.fin("GET", &format!("/v1/admin/manual/deposits/{a}"), None).await;
    assert_eq!(v["deposit"]["history"].as_array().unwrap().len(), 1);
    assert_eq!(v["deposit"]["client_history"]["rejected"], 1);

    // CSV export (finance.export), audited
    let r = t
        .req("GET", "/v1/admin/manual/deposits/export?status=approved")
        .header("x-ezymex-staff-id", "5")
        .header("x-ezymex-staff-role", "finance")
        .header("x-ezymex-staff-perms", FINANCE)
        .send()
        .await
        .unwrap();
    assert_eq!(r.status().as_u16(), 200);
    assert!(r.headers()["content-type"].to_str().unwrap().starts_with("text/csv"));
    let csv = r.text().await.unwrap();
    assert_eq!(csv.lines().count(), 3, "{csv}");
    assert!(csv.lines().next().unwrap().starts_with("id,created_at,client_id"));
    assert!(csv.contains("UTR100000001") && csv.contains("0.5 USDT network fee kept"));
    let (s, _) = t.staff("9", READER, "GET", "/v1/admin/manual/deposits/export", None).await;
    assert_eq!(s, 403);
    assert_eq!(t.count("SELECT count(*) FROM audit_log WHERE action = 'wallet.manual.export'").await, 1);
    t.invariants().await;
    t.drop_db().await;
}
