//! Tenant domains, host resolution, Caddy's domain check and row-level security against a throwaway
//! PostgreSQL database (see `testdb`); DB tests are skipped with a note when no server is reachable.

use super::*;
use crate::admin::{self, UsersQuery};
use crate::identity::{self, Kind};
use crate::owner;
use crate::testdb::TestDb;
use axum::body::Body;
use axum::extract::FromRequestParts;

fn ctx(tok: Option<&str>) -> Ctx {
    Ctx { ip: "203.0.113.9".into(), user_agent: "test-agent".into(), device: Some("device-0123456789abcdef".into()), tenant_slug: "ezymex".into(), bearer: tok.map(str::to_string) }
}

#[test]
fn hosts_and_kinds() {
    assert_eq!(normalize_host("App.Broker.com:3000").as_deref(), Some("app.broker.com"));
    assert_eq!(normalize_host("broker.com.").as_deref(), Some("broker.com"));
    assert_eq!(normalize_host("localhost").as_deref(), Some("localhost"));
    assert_eq!(normalize_host("[::1]:3000"), None);
    assert_eq!(normalize_host("bad host.com"), None);
    assert_eq!(normalize_host(""), None);
    assert_eq!(infer_kind("app.broker.com"), "app");
    assert_eq!(infer_kind("trade.broker.com"), "trade");
    assert_eq!(infer_kind("admin.broker.com"), "admin");
    assert_eq!(infer_kind("broker.com"), "website");
    assert_eq!(infer_kind("www.broker.com"), "website");
    assert!(clean_kind("trade").is_ok() && clean_kind("api").is_err());
    assert_eq!(explicit_slug(Some(" Ezymex ")).as_deref(), Some("ezymex"));
    assert_eq!(explicit_slug(Some("x'; drop")), None);
}

async fn ezymex(st: &AppState) -> i64 {
    sqlx::query_scalar("SELECT id FROM tenants WHERE slug = 'ezymex'").fetch_one(&st.pool).await.unwrap()
}

async fn staff(st: &AppState, tenant: i64, email: &str, role: &str) -> (i64, String) {
    let rid: i64 = sqlx::query_scalar("SELECT id FROM roles WHERE tenant_id = $1 AND key = $2").bind(tenant).bind(role).fetch_one(&st.pool).await.unwrap();
    let id: i64 = sqlx::query_scalar("INSERT INTO staff (tenant_id, email, password_hash, name, role, role_id) VALUES ($1,$2,'x',$3,$4,$5) RETURNING id")
        .bind(tenant)
        .bind(email)
        .bind(format!("Staff {role}"))
        .bind(role)
        .bind(rid)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    let tok = identity::create_session(st, &ctx(None), Kind::Staff, tenant, id).await.unwrap().token;
    (id, tok)
}

async fn client(pool: &PgPool, tenant: i64, email: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, terms_accepted_at)
         VALUES ($1,$2,'h','Test','Client','+91','9876543210','IN','1990-01-01',$3, now()) RETURNING id",
    )
    .bind(tenant)
    .bind(email)
    .bind(format!("R{}", crate::crypto::random_token(6)))
    .fetch_one(pool)
    .await
    .unwrap()
}

/// Tenant 2 created through the Platform Owner API with its own domains.
async fn broker2(st: &AppState, owner_tok: &str) -> i64 {
    let req: owner::CreateTenantReq = serde_json::from_value(json!({
        "slug": "broker-two", "name": "Broker Two", "contact_email": "support@broker2.test",
        "domains": ["broker2.test", "app.broker2.test", "trade.broker2.test", "admin.broker2.test"],
        "brand": {"primary": "#2563eb", "accent": "#14b8a6", "logo_url": "https://cdn.broker2.test/logo.svg"},
    }))
    .unwrap();
    let (code, Json(v)) = owner::create_tenant(State(st.clone()), ctx(Some(owner_tok)), Ok(Json(req))).await.unwrap();
    assert_eq!(code, StatusCode::CREATED);
    v["tenant"]["id"].as_i64().unwrap()
}

async fn ctx_for(st: &AppState, headers: &[(&str, &str)]) -> Ctx {
    let mut b = axum::http::Request::builder().uri("/v1/auth/me");
    for (k, v) in headers {
        b = b.header(*k, *v);
    }
    let (mut parts, _) = b.body(()).unwrap().into_parts();
    Ctx::from_request_parts(&mut parts, st).await.unwrap()
}

fn check_req(domain: &str, peer: Option<&str>, forwarded: bool) -> Request {
    let mut b = axum::http::Request::builder().uri(format!("/v1/public/domain-check?domain={domain}"));
    if forwarded {
        b = b.header("x-forwarded-for", "198.51.100.7");
    }
    let mut req = b.body(Body::empty()).unwrap();
    if let Some(p) = peer {
        req.extensions_mut().insert(ConnectInfo(p.parse::<SocketAddr>().unwrap()));
    }
    req
}

async fn check(st: &AppState, domain: &str, peer: Option<&str>, forwarded: bool) -> StatusCode {
    domain_check(State(st.clone()), Query(DomainQuery { domain: Some(domain.into()) }), check_req(domain, peer, forwarded)).await.status()
}

#[tokio::test]
async fn domains_resolution_and_domain_check() {
    let Some(db) = TestDb::new("domains").await else { return };
    let st = db.st.clone();
    let k = ezymex(&st).await;

    // migrated from tenants.domains with kinds
    let kinds: Vec<(String, String)> = sqlx::query_as("SELECT domain, kind FROM tenant_domains WHERE tenant_id = $1 ORDER BY domain").bind(k).fetch_all(&st.pool).await.unwrap();
    assert_eq!(
        kinds,
        vec![
            ("admin.ezymex.com".to_string(), "admin".to_string()),
            ("app.ezymex.com".into(), "app".into()),
            ("ezymex.com".into(), "website".into()),
            ("trade.ezymex.com".into(), "trade".into()),
        ]
    );

    let (_, owner_tok) = staff(&st, k, "owner@example.com", "platform_owner").await;
    let t2 = broker2(&st, &owner_tok).await;
    let kinds: Vec<(String, String)> = sqlx::query_as("SELECT domain, kind FROM tenant_domains WHERE tenant_id = $1 ORDER BY domain").bind(t2).fetch_all(&st.pool).await.unwrap();
    assert_eq!(kinds.iter().map(|(_, k)| k.as_str()).collect::<Vec<_>>(), vec!["admin", "app", "website", "trade"]);

    // precedence: known host > explicit header > default
    assert_eq!(ctx_for(&st, &[("x-ezymex-host", "App.Broker2.test:443"), ("x-ezymex-tenant", "ezymex")]).await.tenant_slug, "broker-two");
    assert_eq!(ctx_for(&st, &[("x-ezymex-host", "localhost:3000"), ("x-ezymex-tenant", "broker-two")]).await.tenant_slug, "broker-two");
    assert_eq!(ctx_for(&st, &[("x-ezymex-host", "localhost:3000")]).await.tenant_slug, "ezymex");
    assert_eq!(ctx_for(&st, &[]).await.tenant_slug, "ezymex");
    assert_eq!(resolve(&st, Some("app.ezymex.com"), Some("broker-two")).await, ("ezymex".to_string(), Source::Host));

    // public branding by host
    let Json(v) = tenant_by_host(State(st.clone()), Ok(Query(HostQuery { host: Some("trade.broker2.test".into()) }))).await.unwrap();
    assert_eq!(v["kind"], "trade");
    assert_eq!(v["tenant"]["name"], "Broker Two");
    assert_eq!(v["tenant"]["primary"], "#2563eb");
    assert_eq!(v["tenant"]["logo_url"], "https://cdn.broker2.test/logo.svg");
    assert_eq!(v["tenant"]["support_email"], "support@broker2.test");
    assert_eq!(v["tenant"]["urls"]["app"], "https://app.broker2.test");
    assert_eq!(v["tenant"]["domains"]["admin"], json!(["admin.broker2.test"]));
    assert!(tenant_by_host(State(st.clone()), Ok(Query(HostQuery { host: Some("nope.test".into()) }))).await.is_err());

    // Caddy ask: loopback only, no proxy headers, active domain of an active tenant
    assert_eq!(check(&st, "app.broker2.test", Some("127.0.0.1:50000"), false).await, StatusCode::OK);
    assert_eq!(check(&st, "unknown.test", Some("127.0.0.1:50000"), false).await, StatusCode::NOT_FOUND);
    assert_eq!(check(&st, "app.broker2.test", Some("203.0.113.5:50000"), false).await, StatusCode::FORBIDDEN);
    assert_eq!(check(&st, "app.broker2.test", Some("127.0.0.1:50000"), true).await, StatusCode::FORBIDDEN);
    assert_eq!(check(&st, "app.broker2.test", None, false).await, StatusCode::FORBIDDEN);

    // owner: add / conflict / disable / remove, mirror kept in sync
    let add = |d: &str, kind: &str| AddReq { domain: d.into(), kind: kind.into() };
    let (code, Json(v)) = owner_add(State(st.clone()), ctx(Some(&owner_tok)), Path(t2), Ok(Json(add("portal.broker2.test", "app")))).await.unwrap();
    assert_eq!(code, StatusCode::CREATED);
    let did = v["domain"]["id"].as_i64().unwrap();
    assert!(matches!(owner_add(State(st.clone()), ctx(Some(&owner_tok)), Path(t2), Ok(Json(add("app.ezymex.com", "app")))).await, Err(ApiError::Coded { code: "domain_taken", .. })));
    assert!(matches!(owner_add(State(st.clone()), ctx(Some(&owner_tok)), Path(t2), Ok(Json(add("x.broker2.test", "api")))).await, Err(ApiError::Validation { .. })));
    let mirror = |pool: PgPool| async move { sqlx::query_scalar::<_, Vec<String>>("SELECT domains FROM tenants WHERE id = $1").bind(t2).fetch_one(&pool).await.unwrap() };
    assert!(mirror(st.pool.clone()).await.contains(&"portal.broker2.test".to_string()));
    assert_eq!(ctx_for(&st, &[("x-ezymex-host", "portal.broker2.test")]).await.tenant_slug, "broker-two");
    owner_update(State(st.clone()), ctx(Some(&owner_tok)), Path((t2, did)), Ok(Json(UpdateReq { kind: None, status: Some("disabled".into()) }))).await.unwrap();
    assert!(!mirror(st.pool.clone()).await.contains(&"portal.broker2.test".to_string()));
    assert_eq!(ctx_for(&st, &[("x-ezymex-host", "portal.broker2.test")]).await.tenant_slug, "ezymex");
    assert_eq!(check(&st, "portal.broker2.test", Some("127.0.0.1:1"), false).await, StatusCode::NOT_FOUND);
    // wrong tenant in the path can't touch the row
    assert!(matches!(owner_delete(State(st.clone()), ctx(Some(&owner_tok)), Path((k, did))).await, Err(ApiError::NotFound)));
    owner_delete(State(st.clone()), ctx(Some(&owner_tok)), Path((t2, did))).await.unwrap();
    let Json(v) = owner_list(State(st.clone()), ctx(Some(&owner_tok)), Path(t2)).await.unwrap();
    assert_eq!(v["items"].as_array().unwrap().len(), 4);

    // a suspended broker's domains stop getting certificates
    sqlx::query("UPDATE tenants SET status = 'suspended' WHERE id = $1").bind(t2).execute(&st.pool).await.unwrap();
    assert_eq!(check(&st, "app.broker2.test", Some("127.0.0.1:1"), false).await, StatusCode::NOT_FOUND);
    sqlx::query("UPDATE tenants SET status = 'active' WHERE id = $1").bind(t2).execute(&st.pool).await.unwrap();

    // tenant staff can't manage domains
    let (_, t2_admin) = staff(&st, t2, "admin@broker2.test", "super_admin").await;
    assert!(owner_list(State(st.clone()), ctx(Some(&t2_admin)), Path(t2)).await.is_err());

    // legacy plain list on tenant edit: kinds inferred, removed ones dropped
    let req: owner::UpdateTenantReq = serde_json::from_value(json!({"domains": ["broker2.test", "app.broker2.test", "my.broker2.test"]})).unwrap();
    owner::update_tenant(State(st.clone()), ctx(Some(&owner_tok)), Path(t2), Ok(Json(req))).await.unwrap();
    let kinds: Vec<(String, String)> = sqlx::query_as("SELECT domain, kind FROM tenant_domains WHERE tenant_id = $1 ORDER BY domain").bind(t2).fetch_all(&st.pool).await.unwrap();
    assert_eq!(kinds, vec![("app.broker2.test".to_string(), "app".to_string()), ("broker2.test".into(), "website".into()), ("my.broker2.test".into(), "app".into())]);
    assert_eq!(mirror(st.pool.clone()).await.len(), 3);
    db.drop_db().await;
}

#[tokio::test]
async fn row_level_security_isolates_tenants() {
    let Some(db) = TestDb::new("rls").await else { return };
    let st = db.st.clone();
    let t1 = ezymex(&st).await;
    let (_, owner_tok) = staff(&st, t1, "owner@example.com", "platform_owner").await;
    let t2 = broker2(&st, &owner_tok).await;
    let a1 = client(&st.pool, t1, "alice@ezymex.test").await;
    let _b1 = client(&st.pool, t1, "bob@ezymex.test").await;
    let c2 = client(&st.pool, t2, "carol@broker2.test").await;

    // the pool's own login (no scope) still sees everything: existing queries are unaffected
    let all: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(&st.pool).await.unwrap();
    assert_eq!(all, 3);

    // scoped to tenant 2: tenant 1's rows are invisible, even when asked for by id / tenant
    let mut tx = tenant_tx(&st.pool, t2).await.unwrap();
    let role: String = sqlx::query_scalar("SELECT current_user::text").fetch_one(&mut *tx).await.unwrap();
    assert_eq!(role, "ezymex_tenant");
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM users ORDER BY id").fetch_all(&mut *tx).await.unwrap();
    assert_eq!(ids, vec![c2]);
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE tenant_id = $1 OR id = $2").bind(t1).bind(a1).fetch_one(&mut *tx).await.unwrap();
    assert_eq!(n, 0);
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM staff WHERE tenant_id = $1").bind(t1).fetch_one(&mut *tx).await.unwrap();
    assert_eq!(n, 0);
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions").fetch_one(&mut *tx).await.unwrap();
    assert_eq!(n, 0, "tenant 1 staff session invisible");
    // updates and deletes can't reach tenant 1
    let r = sqlx::query("UPDATE users SET first_name = 'Mallory' WHERE id = $1").bind(a1).execute(&mut *tx).await.unwrap();
    assert_eq!(r.rows_affected(), 0);
    let r = sqlx::query("DELETE FROM trusted_devices WHERE tenant_id = $1").bind(t1).execute(&mut *tx).await.unwrap();
    assert_eq!(r.rows_affected(), 0);
    tx.rollback().await.unwrap();

    // inserting a row for tenant 1 from tenant 2's scope is rejected (WITH CHECK)
    let mut tx = tenant_tx(&st.pool, t2).await.unwrap();
    let bad = sqlx::query(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, terms_accepted_at)
         VALUES ($1,'eve@ezymex.test','h','Eve','X','+91','9876543210','IN','1990-01-01','REVE1', now())",
    )
    .bind(t1)
    .execute(&mut *tx)
    .await;
    let msg = bad.expect_err("cross-tenant insert must fail").to_string();
    assert!(msg.contains("row-level security"), "{msg}");
    tx.rollback().await.unwrap();
    // ...while its own tenant works
    let mut tx = tenant_tx(&st.pool, t2).await.unwrap();
    sqlx::query(
        "INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, terms_accepted_at)
         VALUES ($1,'dave@broker2.test','h','Dave','X','+91','9876543210','IN','1990-01-01','RDAVE1', now())",
    )
    .bind(t2)
    .execute(&mut *tx)
    .await
    .unwrap();
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(&mut *tx).await.unwrap();
    assert_eq!(n, 2);
    tx.commit().await.unwrap();

    // ezymex_tenant without a tenant set sees nothing (fail closed)
    let mut tx = st.pool.begin().await.unwrap();
    sqlx::query("SET LOCAL ROLE ezymex_tenant").execute(&mut *tx).await.unwrap();
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(&mut *tx).await.unwrap();
    assert_eq!(n, 0);
    tx.rollback().await.unwrap();
    // the scope ends with the transaction: the pooled connection is back to its own login
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(&st.pool).await.unwrap();
    assert_eq!(n, 4);

    // Back Office client list / detail of tenant 2 never include tenant 1 clients
    let (_, t2_support) = staff(&st, t2, "support@broker2.test", "support").await;
    let Json(v) = admin::users(State(st.clone()), ctx(Some(&t2_support)), Ok(Query(UsersQuery { per_page: Some(200), ..Default::default() }))).await.unwrap();
    assert_eq!(v["total"], 2);
    let text = v.to_string();
    assert!(!text.contains("@ezymex.test"), "{text}");
    let Json(v) = admin::users(State(st.clone()), ctx(Some(&t2_support)), Ok(Query(UsersQuery { q: Some("alice".into()), ..Default::default() }))).await.unwrap();
    assert_eq!(v["total"], 0);
    assert!(matches!(admin::user_detail(State(st.clone()), ctx(Some(&t2_support)), Path(a1)).await, Err(ApiError::NotFound)));
    let Json(v) = admin::user_detail(State(st.clone()), ctx(Some(&t2_support)), Path(c2)).await.unwrap();
    assert_eq!(v["user"]["email"], "carol@broker2.test");
    // and tenant 1's list has only its own
    let (_, t1_support) = staff(&st, t1, "support@example.com", "support").await;
    let Json(v) = admin::users(State(st.clone()), ctx(Some(&t1_support)), Ok(Query(UsersQuery::default()))).await.unwrap();
    assert_eq!(v["total"], 2);
    assert!(!v.to_string().contains("@broker2.test"));
    db.drop_db().await;
}
