//! Brand promotions over HTTP (the real router on a local port) against a throw-away database
//! `ezymex_growth_ptest_<pid>_<n>` (GROWTH_TEST_DATABASE_URL, default :5433; skipped without PostgreSQL): image
//! uploads (sniffed type, size limit, private 0600 files, dedupe, immutable public reads), banners / events / posts
//! written by staff (validation, partial updates, removal), and what a client sees (hero + card banners, the Events &
//! updates list in order, targeting, the detail page).

use chrono::{Duration, Utc};
use growth::config::Config;
use growth::state::AppState;
use growth::{api, db};
use serde_json::{Value, json};
use sqlx::ConnectOptions;
use sqlx::postgres::PgConnectOptions;
use std::str::FromStr;
use std::sync::atomic::{AtomicUsize, Ordering};

static N: AtomicUsize = AtomicUsize::new(0);

struct Env {
    base: String,
    http: reqwest::Client,
    st: AppState,
    admin: PgConnectOptions,
    name: String,
}

async fn env() -> Option<Env> {
    let base = std::env::var("GROWTH_TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres@127.0.0.1:5433/postgres".into());
    let admin = PgConnectOptions::from_str(&base).ok()?.database("postgres");
    if admin.connect().await.is_err() {
        eprintln!("skipping promotions DB tests: no PostgreSQL at {base}");
        return None;
    }
    let n = N.fetch_add(1, Ordering::SeqCst);
    let name = format!("ezymex_growth_ptest_{}_{n}", std::process::id());
    let url = admin.clone().database(&name).to_url_lossy().to_string();
    let pool = db::connect(&url).await.expect("create + migrate");
    db::seed(&pool, "ezymex").await.unwrap();
    let mut cfg = Config::for_tests(&url);
    cfg.storage_dir = std::env::temp_dir().join(format!("ezymex-growth-ptest-{}-{n}", std::process::id())).to_string_lossy().into_owned();
    growth::media::ensure_dir(&cfg.storage_dir).await.unwrap();
    let st = AppState::new(pool, cfg);
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = format!("http://{}", l.local_addr().unwrap());
    let app = api::router(st.clone());
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    Some(Env { base: addr, http: reqwest::Client::new(), st, admin, name })
}

impl Env {
    async fn drop(self) {
        let _ = tokio::fs::remove_dir_all(&self.st.cfg.storage_dir).await;
        self.st.pool.close().await;
        if let Ok(mut c) = self.admin.connect().await {
            let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name))).execute(&mut c).await;
        }
    }

    fn staff(&self, method: reqwest::Method, path: &str, role: &str) -> reqwest::RequestBuilder {
        self.http.request(method, format!("{}{path}", self.base)).header("x-ezymex-staff-id", "7").header("x-ezymex-staff-role", role).header("x-ezymex-staff-name", "Mira%20Shah")
    }

    async fn upload(&self, bytes: Vec<u8>, role: &str) -> (u16, Value) {
        let r = self.staff(reqwest::Method::POST, "/v1/growth/admin/media", role).header("content-type", "application/octet-stream").body(bytes).send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }

    async fn write(&self, method: reqwest::Method, path: &str, body: Value) -> (u16, Value) {
        let r = self.staff(method, path, "marketing").json(&body).send().await.unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }

    /// A client request: user id + country / KYC / sign-up segment headers (as the Client Area BFF sends them).
    async fn me(&self, path: &str, user: i64, country: &str) -> (u16, Value) {
        let r = self
            .http
            .get(format!("{}/v1/growth/me/{path}", self.base))
            .header("x-ezymex-user-id", user.to_string())
            .header("x-ezymex-country", country)
            .header("x-ezymex-kyc", "verified")
            .header("x-ezymex-created-at", (Utc::now() - Duration::days(40)).to_rfc3339())
            .send()
            .await
            .unwrap();
        (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
    }
}

/// A small but well-formed PNG signature + IHDR start (the service only sniffs the first bytes).
fn png(seed: u8) -> Vec<u8> {
    let mut b = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x06\x40\0\0\x01\x90\x08\x06\0\0\0".to_vec();
    b.extend(std::iter::repeat_n(seed, 2048));
    b
}

fn ids(v: &Value) -> Vec<i64> {
    v["items"].as_array().unwrap().iter().map(|i| i["id"].as_i64().unwrap()).collect()
}

#[tokio::test]
async fn image_uploads_are_sniffed_private_deduped_and_served_immutable() {
    let Some(e) = env().await else { return };

    let (s, v) = e.upload(png(1), "marketing").await;
    assert_eq!(s, 200, "{v}");
    let id = v["media"]["id"].as_str().unwrap().to_string();
    assert_eq!(id.len(), 24);
    assert_eq!(v["media"]["url"], format!("/api/growth/media/{id}"));
    assert_eq!(v["media"]["mime"], "image/png");

    // stored privately: 0600 file under GROWTH_STORAGE_DIR/<tenant>/<yyyymm>/
    let path: String = sqlx::query_scalar("SELECT path FROM growth_media WHERE id = $1").bind(&id).fetch_one(&e.st.pool).await.unwrap();
    assert!(path.starts_with("ezymex/") && path.ends_with(&format!("{id}.png")), "{path}");
    let file = std::path::Path::new(&e.st.cfg.storage_dir).join(&path);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(std::fs::metadata(&file).unwrap().permissions().mode() & 0o777, 0o600);
        assert_eq!(std::fs::metadata(&e.st.cfg.storage_dir).unwrap().permissions().mode() & 0o777, 0o700);
    }

    // the same file again: the same image, stored once
    let (s, again) = e.upload(png(1), "marketing").await;
    assert_eq!((s, again["media"]["id"].as_str()), (200, Some(id.as_str())));
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM growth_media").fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(count, 1);

    // the type comes from the bytes, never the name or the declared type: GIF, SVG and HTML are refused
    for bad in [b"GIF89a\x01\0\x01\0".to_vec(), b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>".to_vec(), b"<html><body>hi</body></html>".to_vec()] {
        let (s, v) = e.upload(bad, "marketing").await;
        assert_eq!((s, v["error"]["code"].as_str()), (415, Some("unsupported_type")));
    }
    let (s, v) = e.upload(vec![], "marketing").await;
    assert_eq!((s, v["error"]["field"].as_str()), (422, Some("file")));
    // over 5 MB
    let mut big = png(2);
    big.resize(5 * 1024 * 1024 + 1, 0);
    let (s, v) = e.upload(big, "marketing").await;
    assert_eq!((s, v["error"]["code"].as_str()), (413, Some("too_large")));
    // read-only roles can't upload
    let (s, _) = e.upload(png(3), "support").await;
    assert_eq!(s, 403);

    // public read: the bytes with immutable cache headers, 304 on a revalidation
    let r = e.http.get(format!("{}/v1/growth/public/media/{id}", e.base)).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 200);
    let h = r.headers().clone();
    assert_eq!(h["content-type"], "image/png");
    assert_eq!(h["cache-control"], "public, max-age=31536000, immutable");
    assert_eq!(h["x-content-type-options"], "nosniff");
    assert_eq!(h["content-security-policy"], "default-src 'none'");
    let etag = h["etag"].to_str().unwrap().to_string();
    assert_eq!(r.bytes().await.unwrap().to_vec(), png(1));
    let r = e.http.get(format!("{}/v1/growth/public/media/{id}", e.base)).header("if-none-match", &etag).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 304);
    for bad in ["ffffffffffffffffffffffff", "..%2F..%2Fetc%2Fpasswd", "abc"] {
        let r = e.http.get(format!("{}/v1/growth/public/media/{bad}", e.base)).send().await.unwrap();
        assert_eq!(r.status().as_u16(), 404, "{bad}");
    }
    e.drop().await;
}

#[tokio::test]
async fn banners_events_and_posts_reach_the_right_clients_in_order() {
    let Some(e) = env().await else { return };
    let (_, m) = e.upload(png(9), "marketing").await;
    let media = m["media"]["id"].as_str().unwrap().to_string();
    let now = Utc::now();
    let post = reqwest::Method::POST;

    // validation
    let cases = [
        (json!({"kind": "banner", "layout": "hero", "title": "No image"}), "image"),
        (json!({"kind": "banner", "layout": "hero", "placement": "wallet", "title": "Wallet hero", "imageMediaId": media}), "layout"),
        (json!({"kind": "event", "title": "No date"}), "eventStartsAt"),
        (json!({"kind": "event", "title": "Backwards", "eventStartsAt": (now + Duration::days(2)).to_rfc3339(), "eventEndsAt": (now + Duration::days(1)).to_rfc3339()}), "eventEndsAt"),
        (json!({"kind": "event", "title": "Script", "eventStartsAt": now.to_rfc3339(), "location": "javascript:alert(1)"}), "location"),
        (json!({"kind": "event", "title": "Plain http", "eventStartsAt": now.to_rfc3339(), "location": "http://example.com/live"}), "location"),
        (json!({"kind": "post", "title": "Unknown image", "imageMediaId": "ffffffffffffffffffffffff"}), "imageMediaId"),
        (json!({"kind": "story", "title": "Bad kind"}), "kind"),
        (json!({"kind": "post", "title": "Too long", "content": "x".repeat(20_001)}), "content"),
    ];
    for (body, field) in cases {
        let (s, v) = e.write(post.clone(), "/v1/growth/admin/banners", body.clone()).await;
        assert_eq!((s, v["error"]["field"].as_str()), (422, Some(field)), "{body}");
    }

    let create = |body: Value| {
        let e = &e;
        async move {
            let (s, v) = e.write(reqwest::Method::POST, "/v1/growth/admin/banners", body).await;
            assert_eq!(s, 200, "{v}");
            v["banner"].clone()
        }
    };
    let hero = create(json!({"kind": "banner", "layout": "hero", "title": "Zero spreads on gold", "body": "All week", "ctaLabel": "Trade gold", "ctaUrl": "/accounts", "imageMediaId": media, "priority": 300})).await;
    let card = create(json!({"title": "Verify your identity", "ctaLabel": "Verify", "ctaUrl": "/profile/verification"})).await;
    let soon = create(json!({"kind": "event", "title": "Dubai traders meetup", "body": "Meet the desk", "content": "## Agenda\n\n- Markets outlook\n- Q&A", "imageMediaId": media,
                             "eventStartsAt": (now + Duration::days(2)).to_rfc3339(), "eventEndsAt": (now + Duration::days(2) + Duration::hours(3)).to_rfc3339(), "location": "Dubai, DIFC"})).await;
    let later = create(json!({"kind": "event", "layout": "hero", "title": "Gold webinar", "imageUrl": "/assets/photos/gold.jpg", "eventStartsAt": (now + Duration::days(9)).to_rfc3339(), "location": "https://meet.example.com/gold", "placement": "wallet"})).await;
    let ended = create(json!({"kind": "event", "title": "Last week's AMA", "eventStartsAt": (now - Duration::days(6)).to_rfc3339(), "eventEndsAt": (now - Duration::days(6) + Duration::hours(1)).to_rfc3339()})).await;
    let older = create(json!({"kind": "post", "title": "New platform release", "content": "**Faster** charts.", "startsAt": (now - Duration::days(3)).to_rfc3339()})).await;
    let newer = create(json!({"kind": "post", "title": "Weekend crypto hours", "startsAt": (now - Duration::hours(2)).to_rfc3339()})).await;
    let uae = create(json!({"kind": "post", "title": "UAE clients: local deposits", "countries": ["ae"]})).await;
    let off = create(json!({"kind": "post", "title": "Draft", "active": false})).await;
    let id = |b: &Value| b["id"].as_i64().unwrap();

    // what staff see: events / posts are dashboard items, the hero keeps the uploaded image, an event's link stays
    assert_eq!(later["placement"], "dashboard");
    assert_eq!(hero["imageMediaId"], media.as_str());
    assert_eq!(hero["imageUrl"], Value::Null);
    assert_eq!(soon["content"], "## Agenda\n\n- Markets outlook\n- Q&A");
    assert_eq!(later["location"], "https://meet.example.com/gold");

    // banner slot: banners of the placement + events / posts featured in the hero; card events / posts stay out
    let (s, v) = e.me("banners?placement=dashboard", 501, "IN").await;
    assert_eq!(s, 200);
    assert_eq!(ids(&v), vec![id(&hero), id(&later), id(&card)]);
    let first = &v["items"][0];
    assert_eq!((first["layout"].as_str(), first["kind"].as_str()), (Some("hero"), Some("banner")));
    assert_eq!(first["imageUrl"], format!("/api/growth/media/{media}"));
    assert_eq!(v["items"][1]["eventState"], "upcoming");
    assert_eq!(v["items"][1]["imageUrl"], "/assets/photos/gold.jpg");

    // Events & updates: upcoming events (soonest first), then posts and ended events (newest first); targeting applies
    let (s, v) = e.me("posts", 501, "IN").await;
    assert_eq!(s, 200);
    assert_eq!(ids(&v), vec![id(&soon), id(&later), id(&newer), id(&older), id(&ended)]);
    assert_eq!(v["total"], 5);
    assert!(v["items"][0].get("content").is_none(), "the list carries no markdown body");
    assert_eq!(v["items"][4]["eventState"], "ended");
    let (_, v) = e.me("posts", 502, "AE").await;
    assert!(ids(&v).contains(&id(&uae)));
    assert!(!ids(&v).contains(&id(&off)));
    let (_, v) = e.me("posts?kind=event&limit=1&page=2", 501, "IN").await;
    assert_eq!((ids(&v), v["total"].as_i64()), (vec![id(&later)], Some(3)));

    // the detail page: markdown body; not targeted, inactive or a plain banner = not found
    let (s, v) = e.me(&format!("posts/{}", id(&soon)), 501, "IN").await;
    assert_eq!(s, 200);
    assert_eq!(v["post"]["content"], "## Agenda\n\n- Markets outlook\n- Q&A");
    assert_eq!(v["post"]["location"], "Dubai, DIFC");
    for (other, who) in [(id(&uae), "IN"), (id(&off), "IN"), (id(&card), "IN")] {
        let (s, _) = e.me(&format!("posts/{other}"), 501, who).await;
        assert_eq!(s, 404, "post {other}");
    }

    // a partial update keeps everything else (kind, layout, markdown, image, event time)
    let (s, v) = e.write(reqwest::Method::PATCH, &format!("/v1/growth/admin/banners/{}", id(&soon)), json!({"title": "Dubai traders meetup · 2nd edition"})).await;
    assert_eq!(s, 200, "{v}");
    let b = &v["banner"];
    assert_eq!((b["kind"].as_str(), b["layout"].as_str(), b["imageMediaId"].as_str()), (Some("event"), Some("card"), Some(media.as_str())));
    assert_eq!(b["content"], soon["content"]);
    assert_eq!(b["eventStartsAt"], soon["eventStartsAt"]);
    // switching an event to a post drops its date and place
    let (_, v) = e.write(reqwest::Method::PATCH, &format!("/v1/growth/admin/banners/{}", id(&ended)), json!({"kind": "post"})).await;
    assert_eq!((v["banner"]["eventStartsAt"].clone(), v["banner"]["location"].clone()), (Value::Null, Value::Null));

    // removal: gone for clients and staff at once, kept in the audit log; it can't be edited any more
    let r = e.staff(reqwest::Method::DELETE, &format!("/v1/growth/admin/banners/{}", id(&hero)), "support").send().await.unwrap();
    assert_eq!(r.status().as_u16(), 403);
    let r = e.staff(reqwest::Method::DELETE, &format!("/v1/growth/admin/banners/{}", id(&hero)), "marketing").send().await.unwrap();
    assert_eq!(r.status().as_u16(), 200);
    let (_, v) = e.me("banners?placement=dashboard", 501, "IN").await;
    assert!(!ids(&v).contains(&id(&hero)));
    let r = e.staff(reqwest::Method::GET, "/v1/growth/admin/banners", "marketing").send().await.unwrap();
    let list: Value = r.json().await.unwrap();
    assert!(!ids(&list).contains(&id(&hero)));
    let (s, _) = e.write(reqwest::Method::PATCH, &format!("/v1/growth/admin/banners/{}", id(&hero)), json!({"active": true})).await;
    assert_eq!(s, 404);
    let audited: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'banner.delete' AND target = $1").bind(format!("banner:{}", id(&hero))).fetch_one(&e.st.pool).await.unwrap();
    assert_eq!(audited, 1);
    e.drop().await;
}
