//! Images of manual payments: QR codes staff upload for a payment method and payment screenshots clients attach to a
//! deposit request. PNG, JPEG or WEBP only, sniffed from the first bytes (never from the file name or the declared
//! type), at most 5 MB. Files are stored privately under WALLET_STORAGE_DIR (directory 0700, files 0600,
//! `<tenant>/<purpose>/<yyyymm>/<id>.<ext>`) and read by an unguessable id (24 random hex characters).
//!
//! Who may read: a QR image any signed-in client of its tenant (the Client Area BFF) and staff; a proof only staff
//! and the client who uploaded it. An id never changes content (a new image is a new id).

use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use sqlx::postgres::PgRow;

use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

pub const PURPOSES: &[&str] = &["qr", "proof"];

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

/// Media ids: 24 lower-case hex characters (96 random bits).
pub fn valid_id(id: &str) -> bool {
    id.len() == 24 && id.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

fn new_id() -> String {
    let mut b = [0u8; 12];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    crate::chain::hex_encode(&b)
}

/// Where an image is served: `/api/wallet/manual/media/<id>`, the same path on the Client Area (signed-in clients:
/// QR codes and their own screenshots) and on the Back Office (staff).
pub fn url(id: &str) -> String {
    format!("/api/wallet/manual/media/{id}")
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
        "url": url(&id),
        "purpose": r.get::<String, _>("purpose"),
        "mime": r.get::<String, _>("mime"),
        "size": r.get::<i32, _>("size_bytes"),
        "sha256": r.get::<String, _>("sha256"),
        "created_at": r.get::<chrono::DateTime<Utc>, _>("created_at"),
    })
}

pub fn too_large(max: usize) -> ApiError {
    ApiError::Coded { status: StatusCode::PAYLOAD_TOO_LARGE, code: "too_large", message: format!("Images can be up to {} MB.", max / 1024 / 1024) }
}

/// Checks and stores an uploaded image; returns its row as JSON. `uploader` is `staff:<id>` or `user:<id>`.
pub async fn store(st: &AppState, tenant_id: i64, purpose: &str, uploader: &str, user_id: Option<i64>, bytes: &[u8]) -> ApiResult<Value> {
    if !PURPOSES.contains(&purpose) {
        return Err(ApiError::BadRequest("Unknown image purpose".into()));
    }
    if bytes.is_empty() {
        return Err(ApiError::validation("file", "The file is empty."));
    }
    if bytes.len() > st.cfg.max_media_bytes {
        return Err(too_large(st.cfg.max_media_bytes));
    }
    let Some((mime, ext)) = sniff(bytes) else {
        return Err(ApiError::Coded { status: StatusCode::UNSUPPORTED_MEDIA_TYPE, code: "unsupported_type", message: "Only PNG, JPG or WEBP images can be uploaded.".into() });
    };
    let sha: String = crate::chain::hex_encode(&Sha256::digest(bytes));
    let id = new_id();
    let key = format!("{tenant_id}/{purpose}/{}/{id}.{ext}", Utc::now().format("%Y%m"));
    let path = std::path::Path::new(&st.cfg.storage_dir).join(&key);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    write_private(&path, bytes).await?;
    let row = sqlx::query("INSERT INTO payment_media (id, tenant_id, purpose, mime, size_bytes, sha256, path, uploaded_by, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *")
        .bind(&id)
        .bind(tenant_id)
        .bind(purpose)
        .bind(mime)
        .bind(bytes.len() as i32)
        .bind(&sha)
        .bind(&key)
        .bind(uploader)
        .bind(user_id)
        .fetch_one(&st.pool)
        .await;
    match row {
        Ok(r) => Ok(media_json(&r)),
        Err(e) => {
            let _ = tokio::fs::remove_file(&path).await;
            Err(e.into())
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

/// The media row of `id` in `tenant_id`, if any.
pub async fn find(st: &AppState, tenant_id: i64, id: &str) -> ApiResult<Option<PgRow>> {
    if !valid_id(id) {
        return Ok(None);
    }
    Ok(sqlx::query("SELECT * FROM payment_media WHERE id = $1 AND tenant_id = $2").bind(id).bind(tenant_id).fetch_optional(&st.pool).await?)
}

/// Who is reading an image.
pub enum Reader {
    Staff,
    /// A signed-in client (the CRM BFF passes the user id).
    Client(i64),
}

/// Reads an image the reader may see; 404 for anything else (no hint that the id exists).
pub async fn read(st: &AppState, tenant_id: i64, id: &str, reader: Reader, if_none_match: Option<&str>) -> ApiResult<Response> {
    let r = find(st, tenant_id, id).await?.ok_or_else(|| ApiError::not_found("Image"))?;
    let purpose: String = r.get("purpose");
    let allowed = match reader {
        Reader::Staff => true,
        Reader::Client(uid) => purpose == "qr" || r.get::<Option<i64>, _>("user_id") == Some(uid),
    };
    if !allowed {
        return Err(ApiError::not_found("Image"));
    }
    let key: String = r.get("path");
    if key.contains("..") || key.starts_with('/') {
        return Err(ApiError::not_found("Image"));
    }
    let sha: String = r.get("sha256");
    let mime: String = r.get("mime");
    // QR codes never change (a new image is a new id); payment screenshots are private and never cached
    let cache = if purpose == "qr" { "private, max-age=31536000, immutable" } else { "private, no-store" };
    let etag = format!("\"{sha}\"");
    if purpose == "qr" && if_none_match.is_some_and(|v| v.split(',').any(|t| t.trim() == etag || t.trim() == "*")) {
        return Ok((StatusCode::NOT_MODIFIED, [(header::ETAG, etag), (header::CACHE_CONTROL, cache.to_string())]).into_response());
    }
    let bytes = tokio::fs::read(std::path::Path::new(&st.cfg.storage_dir).join(&key)).await.map_err(|_| ApiError::not_found("Image"))?;
    let ext = match mime.as_str() {
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "jpg",
    };
    Ok((
        [
            (header::CONTENT_TYPE, mime.clone()),
            (header::CONTENT_DISPOSITION, format!("inline; filename=\"{id}.{ext}\"")),
            (header::CACHE_CONTROL, cache.to_string()),
            (header::ETAG, etag),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
            (header::CONTENT_SECURITY_POLICY, "default-src 'none'".to_string()),
        ],
        bytes,
    )
        .into_response())
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
        assert!(sniff(b"").is_none());
    }

    #[test]
    fn ids_are_random_hex() {
        let a = new_id();
        assert!(valid_id(&a));
        assert_ne!(a, new_id());
        assert!(!valid_id("../../etc/passwd"));
        assert!(!valid_id("ABCDEFABCDEFABCDEFABCDEF"));
        assert!(!valid_id("abc"));
        assert_eq!(url("00ff"), "/api/wallet/manual/media/00ff");
    }
}
