//! Images for banners, events and brand posts. PNG, JPEG or WEBP only, sniffed from the first bytes (never from the
//! file name or the declared type), at most 5 MB. Files are stored privately under GROWTH_STORAGE_DIR (directory
//! 0700, files 0600, `<tenant>/<yyyymm>/<id>.<ext>`) and served publicly by an unguessable id: the Client Area at
//! `/api/growth/media/<id>`, the Back Office at `/api/marketing/media/<id>`. An id never changes content (a new image
//! is a new id), so responses are cached as immutable. The same file uploaded twice by a tenant is stored once.

use crate::error::{ApiError, ApiResult, invalid};
use crate::state::AppState;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use sqlx::postgres::PgRow;

/// The file type from its first bytes: PNG, JPEG or WEBP only. Returns (mime, extension).
pub fn sniff(b: &[u8]) -> Option<(&'static str, &'static str)> {
    if b.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("image/png", "png"))
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("image/jpeg", "jpg"))
    } else if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else {
        None
    }
}

/// Media ids: 24 lowercase hex characters (96 random bits).
pub fn valid_id(id: &str) -> bool {
    id.len() == 24 && id.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

fn new_id() -> String {
    let mut b = [0u8; 12];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// The Client Area's public URL of an uploaded image (its BFF serves `/api/growth/media/<id>` without a session, so
/// the mobile app and the web load it alike).
pub fn public_url(id: &str) -> String {
    format!("/api/growth/media/{id}")
}

/// Creates the storage directory (0700) if needed.
pub async fn ensure_dir(dir: &str) -> anyhow::Result<()> {
    tokio::fs::create_dir_all(dir).await?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700)).await?;
    }
    Ok(())
}

pub fn media_json(r: &PgRow) -> Value {
    let id: String = r.get("id");
    json!({
        "id": id,
        "url": public_url(&id),
        "mime": r.get::<String, _>("mime"),
        "size": r.get::<i32, _>("size_bytes"),
        "sha256": r.get::<String, _>("sha256"),
        "createdAt": r.get::<chrono::DateTime<Utc>, _>("created_at"),
    })
}

/// Stores an uploaded image for `tenant` and returns its row as JSON (an identical earlier upload is returned as is).
pub async fn store(st: &AppState, tenant: &str, created_by: &str, bytes: &[u8]) -> ApiResult<Value> {
    if bytes.is_empty() {
        return Err(invalid("file", "The file is empty."));
    }
    if bytes.len() > st.cfg.max_media_bytes {
        return Err(ApiError::TooLarge(format!("Images can be up to {} MB.", st.cfg.max_media_bytes / 1024 / 1024)));
    }
    let Some((mime, ext)) = sniff(bytes) else {
        return Err(ApiError::Unsupported("Only PNG, JPG or WEBP images can be uploaded.".into()));
    };
    let sha: String = Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect();
    let existing = sqlx::query("SELECT * FROM growth_media WHERE tenant = $1 AND sha256 = $2").bind(tenant).bind(&sha).fetch_optional(&st.pool).await?;
    if let Some(r) = existing {
        return Ok(media_json(&r));
    }
    let id = new_id();
    let dir = tenant.replace(['/', '.', '\\'], "");
    let key = format!("{dir}/{}/{id}.{ext}", Utc::now().format("%Y%m"));
    let path = std::path::Path::new(&st.cfg.storage_dir).join(&key);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    write_private(&path, bytes).await?;
    let row = sqlx::query(
        "INSERT INTO growth_media (id, tenant, mime, size_bytes, sha256, path, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant, sha256) DO NOTHING RETURNING *",
    )
    .bind(&id)
    .bind(tenant)
    .bind(mime)
    .bind(bytes.len() as i32)
    .bind(&sha)
    .bind(&key)
    .bind(created_by)
    .fetch_optional(&st.pool)
    .await?;
    match row {
        Some(r) => Ok(media_json(&r)),
        None => {
            // the same file landed concurrently: keep that one
            let _ = tokio::fs::remove_file(&path).await;
            let r = sqlx::query("SELECT * FROM growth_media WHERE tenant = $1 AND sha256 = $2").bind(tenant).bind(&sha).fetch_one(&st.pool).await?;
            Ok(media_json(&r))
        }
    }
}

/// Writes a new file readable by the service user only (0600 from creation).
async fn write_private(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    use tokio::io::AsyncWriteExt;
    let mut opts = tokio::fs::OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    opts.mode(0o600);
    let mut f = opts.open(path).await?;
    f.write_all(bytes).await?;
    f.sync_all().await?;
    Ok(())
}

/// Whether `id` is an image of `tenant` (banners may only point at their own tenant's images).
pub async fn exists(st: &AppState, tenant: &str, id: &str) -> ApiResult<bool> {
    if !valid_id(id) {
        return Ok(false);
    }
    let n: Option<i32> = sqlx::query_scalar("SELECT 1 FROM growth_media WHERE id = $1 AND tenant = $2").bind(id).bind(tenant).fetch_optional(&st.pool).await?;
    Ok(n.is_some())
}

/// Reads an image by id: (bytes, mime, sha256). Ids are global and unguessable, so no tenant is needed to read one.
pub async fn read(st: &AppState, id: &str) -> ApiResult<(Vec<u8>, String, String)> {
    if !valid_id(id) {
        return Err(ApiError::NotFound);
    }
    let r = sqlx::query("SELECT mime, path, sha256 FROM growth_media WHERE id = $1").bind(id).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let key: String = r.get("path");
    if key.contains("..") || key.starts_with('/') {
        return Err(ApiError::NotFound);
    }
    let bytes = tokio::fs::read(std::path::Path::new(&st.cfg.storage_dir).join(&key)).await.map_err(|_| ApiError::NotFound)?;
    Ok((bytes, r.get("mime"), r.get("sha256")))
}

/// An id never changes content: browsers, the Client Area and Cloudflare may keep it for a year.
pub const IMMUTABLE: &str = "public, max-age=31536000, immutable";

/// The image with immutable cache headers (an id never changes content); 304 when the browser has it.
pub fn response(id: &str, bytes: Vec<u8>, mime: &str, sha: &str, if_none_match: Option<&str>) -> Response {
    let etag = format!("\"{sha}\"");
    if if_none_match.is_some_and(|v| v.split(',').any(|t| t.trim() == etag || t.trim() == "*")) {
        return (StatusCode::NOT_MODIFIED, [(header::ETAG, etag), (header::CACHE_CONTROL, IMMUTABLE.to_string())]).into_response();
    }
    let ext = match mime {
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "jpg",
    };
    (
        [
            (header::CONTENT_TYPE, mime.to_string()),
            (header::CONTENT_DISPOSITION, format!("inline; filename=\"{id}.{ext}\"")),
            (header::CACHE_CONTROL, IMMUTABLE.to_string()),
            (header::ETAG, etag),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
            (header::CONTENT_SECURITY_POLICY, "default-src 'none'".to_string()),
        ],
        bytes,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_png_jpeg_webp_only() {
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\nrest"), Some(("image/png", "png")));
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0]), Some(("image/jpeg", "jpg")));
        assert_eq!(sniff(b"RIFF\0\0\0\0WEBPVP8 "), Some(("image/webp", "webp")));
        // GIF, SVG (script), HTML, PDF and executables are refused whatever their name or declared type
        assert!(sniff(b"GIF89a....").is_none());
        assert!(sniff(b"<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>").is_none());
        assert!(sniff(b"<html>").is_none());
        assert!(sniff(b"%PDF-1.7").is_none());
        assert!(sniff(b"MZ\x90\0").is_none());
        assert!(sniff(b"RIFF\0\0\0\0WAVE").is_none());
    }

    #[test]
    fn ids_are_random_hex() {
        let a = new_id();
        assert!(valid_id(&a));
        assert_ne!(a, new_id());
        assert!(!valid_id("../../etc/passwd"));
        assert!(!valid_id("ABCDEFABCDEFABCDEFABCDEF"));
        assert!(!valid_id("abc"));
        assert_eq!(public_url("00ff"), "/api/growth/media/00ff");
    }
}
