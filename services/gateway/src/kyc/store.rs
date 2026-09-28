//! Private, encrypted document storage on the gateway's disk.
//!
//! Layout: `<KYC_STORAGE_DIR>/<tenant_id>/<first 2 chars of ref>/<ref>` where `ref` is a random 32-character
//! URL-safe token (the only thing the database stores). Directories are 0700, files 0600, and the directory
//! must be outside every web root (default `~/.kalks-data/kyc`).
//!
//! File format: `KKYC1` magic, 12-byte random nonce, AES-256-GCM ciphertext + 16-byte tag. The file ref is
//! the associated data, so a file copied or renamed onto another ref fails to decrypt.

use ring::aead::{AES_256_GCM, Aad, LessSafeKey, NONCE_LEN, Nonce, UnboundKey};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::crypto;

const MAGIC: &[u8; 5] = b"KKYC1";

/// A 256-bit data key.
#[derive(Clone)]
pub struct DataKey([u8; 32]);

impl DataKey {
    pub fn from_bytes(b: [u8; 32]) -> Self {
        Self(b)
    }

    /// `KYC_ENCRYPTION_KEY`: 64 hex characters or base64 (standard or URL-safe) of exactly 32 bytes.
    pub fn parse(raw: &str) -> Option<Self> {
        use base64::Engine;
        let t = raw.trim();
        if t.len() == 64 && t.chars().all(|c| c.is_ascii_hexdigit()) {
            let mut out = [0u8; 32];
            for (i, chunk) in t.as_bytes().chunks(2).enumerate() {
                out[i] = u8::from_str_radix(std::str::from_utf8(chunk).ok()?, 16).ok()?;
            }
            return Some(Self(out));
        }
        let engines = [base64::engine::general_purpose::STANDARD, base64::engine::general_purpose::URL_SAFE];
        for e in engines {
            if let Ok(v) = e.decode(t)
                && let Ok(arr) = <[u8; 32]>::try_from(v.as_slice())
            {
                return Some(Self(arr));
            }
        }
        let nopad = [base64::engine::general_purpose::STANDARD_NO_PAD, base64::engine::general_purpose::URL_SAFE_NO_PAD];
        for e in nopad {
            if let Ok(v) = e.decode(t)
                && let Ok(arr) = <[u8; 32]>::try_from(v.as_slice())
            {
                return Some(Self(arr));
            }
        }
        None
    }

    fn key(&self) -> LessSafeKey {
        LessSafeKey::new(UnboundKey::new(&AES_256_GCM, &self.0).expect("32-byte AES-256 key"))
    }
}

pub fn encrypt(key: &DataKey, file_ref: &str, plain: &[u8]) -> anyhow::Result<Vec<u8>> {
    let nonce_bytes = crypto::random_bytes::<NONCE_LEN>();
    let mut buf = plain.to_vec();
    key.key()
        .seal_in_place_append_tag(Nonce::assume_unique_for_key(nonce_bytes), Aad::from(file_ref.as_bytes()), &mut buf)
        .map_err(|_| anyhow::anyhow!("encryption failed"))?;
    let mut out = Vec::with_capacity(MAGIC.len() + NONCE_LEN + buf.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&buf);
    Ok(out)
}

pub fn decrypt(key: &DataKey, file_ref: &str, sealed: &[u8]) -> anyhow::Result<Vec<u8>> {
    if sealed.len() < MAGIC.len() + NONCE_LEN + 16 || &sealed[..MAGIC.len()] != MAGIC {
        anyhow::bail!("not a KYC file");
    }
    let nonce: [u8; NONCE_LEN] = sealed[MAGIC.len()..MAGIC.len() + NONCE_LEN].try_into()?;
    let mut buf = sealed[MAGIC.len() + NONCE_LEN..].to_vec();
    let plain = key
        .key()
        .open_in_place(Nonce::assume_unique_for_key(nonce), Aad::from(file_ref.as_bytes()), &mut buf)
        .map_err(|_| anyhow::anyhow!("decryption failed (wrong key or tampered file)"))?;
    Ok(plain.to_vec())
}

pub fn sha256_hex(b: &[u8]) -> String {
    Sha256::digest(b).iter().map(|x| format!("{x:02x}")).collect()
}

/// Refs are generated here; anything else is refused before it reaches the filesystem.
pub fn valid_ref(r: &str) -> bool {
    r.len() == 32 && r.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub fn new_ref() -> String {
    crypto::random_token(24)
}

pub fn path_for(dir: &Path, tenant_id: i64, file_ref: &str) -> Option<PathBuf> {
    if !valid_ref(file_ref) {
        return None;
    }
    Some(dir.join(tenant_id.to_string()).join(&file_ref[..2]).join(file_ref))
}

#[cfg(unix)]
fn private_dir(p: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
    std::fs::DirBuilder::new().recursive(true).mode(0o700).create(p)?;
    std::fs::set_permissions(p, std::fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
fn private_dir(p: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(p)
}

/// Encrypts and writes a document (temp file + rename, 0600). Blocking: call from `spawn_blocking`.
pub fn write(dir: &Path, key: &DataKey, tenant_id: i64, file_ref: &str, plain: &[u8]) -> anyhow::Result<()> {
    let path = path_for(dir, tenant_id, file_ref).ok_or_else(|| anyhow::anyhow!("invalid file ref"))?;
    let parent = path.parent().ok_or_else(|| anyhow::anyhow!("no parent"))?;
    private_dir(dir)?;
    private_dir(parent)?;
    let sealed = encrypt(key, file_ref, plain)?;
    let tmp = parent.join(format!(".{file_ref}.tmp"));
    {
        let mut opts = std::fs::OpenOptions::new();
        opts.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            opts.mode(0o600);
        }
        let mut f = opts.open(&tmp)?;
        f.write_all(&sealed)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, &path)?;
    Ok(())
}

/// Reads and decrypts a document. Blocking: call from `spawn_blocking`.
pub fn read(dir: &Path, key: &DataKey, tenant_id: i64, file_ref: &str) -> anyhow::Result<Vec<u8>> {
    let path = path_for(dir, tenant_id, file_ref).ok_or_else(|| anyhow::anyhow!("invalid file ref"))?;
    let sealed = std::fs::read(&path)?;
    decrypt(key, file_ref, &sealed)
}

/// Removes a stored document (used when an account is erased). Missing files are fine.
pub fn remove(dir: &Path, tenant_id: i64, file_ref: &str) -> anyhow::Result<()> {
    let path = path_for(dir, tenant_id, file_ref).ok_or_else(|| anyhow::anyhow!("invalid file ref"))?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}
