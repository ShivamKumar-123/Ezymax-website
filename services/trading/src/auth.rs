//! Credentials and tokens: argon2id password hashes (trading + investor), opaque session / SSO / stream
//! tokens stored only as HMAC-SHA256(secret, domain || token).

use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;

fn argon() -> Argon2<'static> {
    Argon2::new(Algorithm::Argon2id, Version::V0x13, Params::DEFAULT)
}

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    argon().hash_password(password.as_bytes()).map(|h| h.to_string()).map_err(|e| anyhow::anyhow!("hash failed: {e}"))
}

pub fn verify_password(password: &str, phc: &str) -> bool {
    match PasswordHash::new(phc) {
        Ok(parsed) => argon().verify_password(password.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

/// Verified against when the login is unknown, so both paths take the same time.
pub fn dummy_hash() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| hash_password(&random_token(18)).unwrap_or_default())
}

pub fn random_token(n: usize) -> String {
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    URL_SAFE_NO_PAD.encode(b)
}

/// MT5-style trading password: 8–64 characters with at least one letter and one digit.
pub fn check_password(p: &str) -> Result<(), &'static str> {
    if p.chars().count() < 8 || p.chars().count() > 64 {
        return Err("Password must be 8–64 characters");
    }
    if !p.chars().any(|c| c.is_alphabetic()) || !p.chars().any(|c| c.is_ascii_digit()) {
        return Err("Password must contain letters and digits");
    }
    Ok(())
}

/// A random password that passes `check_password` (shown to the user once).
pub fn generate_password() -> String {
    const ALPHA: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const DIGIT: &[u8] = b"23456789";
    let mut b = [0u8; 12];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    let mut s: String = b.iter().enumerate().map(|(i, x)| if i % 4 == 3 { DIGIT[*x as usize % DIGIT.len()] as char } else { ALPHA[*x as usize % ALPHA.len()] as char }).collect();
    s.push('9');
    s
}

#[derive(Clone)]
pub struct Keys {
    secret: Arc<Vec<u8>>,
}

impl Keys {
    pub fn new(secret: &str) -> Self {
        Self { secret: Arc::new(secret.as_bytes().to_vec()) }
    }
    pub fn hash(&self, domain: &str, value: &str) -> Vec<u8> {
        let mut mac = <Hmac<Sha256> as KeyInit>::new_from_slice(&self.secret).expect("hmac accepts any key size");
        mac.update(domain.as_bytes());
        mac.update(&[0]);
        mac.update(value.as_bytes());
        mac.finalize().into_bytes().to_vec()
    }
}

pub fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && bool::from(a.ct_eq(b))
}

/// Fixed-window in-memory rate limiter.
#[derive(Clone, Default)]
pub struct Limiter(Arc<Mutex<HashMap<String, (Instant, u32)>>>);

impl Limiter {
    /// Ok(()) or Err(retry-after seconds).
    pub fn hit(&self, key: &str, max: u32, window: Duration) -> Result<(), u64> {
        let mut m = self.0.lock().unwrap();
        let now = Instant::now();
        let e = m.entry(key.to_string()).or_insert((now, 0));
        if now.duration_since(e.0) > window {
            *e = (now, 0);
        }
        e.1 += 1;
        if e.1 > max {
            return Err((window.saturating_sub(now.duration_since(e.0))).as_secs().max(1));
        }
        Ok(())
    }
    pub fn clear(&self, key: &str) {
        self.0.lock().unwrap().remove(key);
    }
    pub fn sweep(&self, older: Duration) {
        let now = Instant::now();
        self.0.lock().unwrap().retain(|_, (t, _)| now.duration_since(*t) < older);
    }
}

/// Short-lived one-time WebSocket tickets (the browser connects directly with `?ticket=`).
#[derive(Clone, Default)]
pub struct StreamTickets(Arc<Mutex<HashMap<Vec<u8>, (StreamGrant, Instant)>>>);

#[derive(Clone, Debug)]
pub enum StreamGrant {
    Account { tenant_id: i64, login: i64, read_only: bool },
    Dealing { tenant_id: i64, staff: String },
}

impl StreamTickets {
    pub fn issue(&self, keys: &Keys, grant: StreamGrant) -> String {
        let t = random_token(24);
        let mut m = self.0.lock().unwrap();
        let now = Instant::now();
        m.retain(|_, (_, at)| now.duration_since(*at) < Duration::from_secs(30));
        m.insert(keys.hash("stream", &t), (grant, now));
        t
    }
    pub fn redeem(&self, keys: &Keys, ticket: &str) -> Option<StreamGrant> {
        let (g, at) = self.0.lock().unwrap().remove(&keys.hash("stream", ticket))?;
        (at.elapsed() < Duration::from_secs(30)).then_some(g)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_rules_and_hashing() {
        assert!(check_password("short1").is_err());
        assert!(check_password("longenough").is_err());
        assert!(check_password("longenough1").is_ok());
        for _ in 0..20 {
            assert!(check_password(&generate_password()).is_ok());
        }
        let h = hash_password("Trading123").unwrap();
        assert!(verify_password("Trading123", &h));
        assert!(!verify_password("trading123", &h));
        assert!(!verify_password("x", "not-a-hash"));
    }

    #[test]
    fn stream_tickets_are_one_time() {
        let k = Keys::new("0123456789abcdef0123456789abcdef");
        let s = StreamTickets::default();
        let t = s.issue(&k, StreamGrant::Account { tenant_id: 1, login: 5, read_only: true });
        assert!(matches!(s.redeem(&k, &t), Some(StreamGrant::Account { login: 5, read_only: true, .. })));
        assert!(s.redeem(&k, &t).is_none());
    }

    #[test]
    fn limiter_blocks_after_max() {
        let l = Limiter::default();
        for _ in 0..3 {
            assert!(l.hit("k", 3, Duration::from_secs(60)).is_ok());
        }
        assert!(l.hit("k", 3, Duration::from_secs(60)).is_err());
    }
}
