//! Hashing, HMAC, random tokens and an in-memory sliding-window rate limiter.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;

pub fn random_token(n: usize) -> String {
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    URL_SAFE_NO_PAD.encode(b)
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex(&Sha256::digest(data))
}

pub fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn hmac_raw(key: &[u8], msg: &[u8]) -> Vec<u8> {
    let mut m = <Hmac<Sha256> as KeyInit>::new_from_slice(key).expect("hmac key");
    m.update(msg);
    m.finalize().into_bytes().to_vec()
}

pub fn hmac_hex(key: &[u8], msg: &[u8]) -> String {
    hex(&hmac_raw(key, msg))
}

pub fn hmac_b64(key: &[u8], msg: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(hmac_raw(key, msg))
}

pub fn ct_eq(a: &str, b: &str) -> bool {
    a.len() == b.len() && bool::from(a.as_bytes().ct_eq(b.as_bytes()))
}

/// Sliding-window limiter keyed by string (per API key, webhook, user, IP).
#[derive(Default)]
pub struct Limiter {
    hits: Mutex<HashMap<String, VecDeque<Instant>>>,
}

impl Limiter {
    /// Records a hit; `Err(retry_after_secs)` when `limit` hits already happened within `window`.
    pub fn hit(&self, key: &str, limit: usize, window: Duration) -> Result<(), u64> {
        let now = Instant::now();
        let mut map = self.hits.lock().unwrap();
        if map.len() > 50_000 {
            map.retain(|_, q| q.back().is_some_and(|t| now.duration_since(*t) < Duration::from_secs(3600)));
        }
        let q = map.entry(key.to_string()).or_default();
        while q.front().is_some_and(|t| now.duration_since(*t) >= window) {
            q.pop_front();
        }
        if q.len() >= limit {
            let oldest = *q.front().unwrap();
            return Err(window.saturating_sub(now.duration_since(oldest)).as_secs().max(1));
        }
        q.push_back(now);
        Ok(())
    }
}

/// `ip` matches an entry of the whitelist: an exact address or an IPv4 CIDR (`203.0.113.0/24`).
pub fn ip_allowed(ip: &str, list: &[String]) -> bool {
    if list.is_empty() {
        return true;
    }
    let parse4 = |s: &str| -> Option<u32> {
        let p: Vec<u8> = s.split('.').map(|x| x.parse().ok()).collect::<Option<Vec<u8>>>()?;
        if p.len() != 4 {
            return None;
        }
        Some(u32::from_be_bytes([p[0], p[1], p[2], p[3]]))
    };
    list.iter().any(|e| {
        let e = e.trim();
        if let Some((net, bits)) = e.split_once('/') {
            match (parse4(net), parse4(ip), bits.parse::<u32>()) {
                (Some(n), Some(a), Ok(b)) if b <= 32 => {
                    let mask = if b == 0 { 0 } else { u32::MAX << (32 - b) };
                    n & mask == a & mask
                }
                _ => false,
            }
        } else {
            e == ip
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limiter_and_ip_lists() {
        let l = Limiter::default();
        for _ in 0..3 {
            assert!(l.hit("k", 3, Duration::from_secs(60)).is_ok());
        }
        assert!(l.hit("k", 3, Duration::from_secs(60)).is_err());
        assert!(l.hit("other", 3, Duration::from_secs(60)).is_ok());
        assert!(ip_allowed("1.2.3.4", &[]));
        assert!(ip_allowed("10.0.5.9", &["10.0.0.0/16".into()]));
        assert!(!ip_allowed("10.1.5.9", &["10.0.0.0/16".into()]));
        assert!(ip_allowed("2001:db8::1", &["2001:db8::1".into()]));
        assert!(!ip_allowed("1.2.3.5", &["1.2.3.4".into()]));
        assert!(ct_eq("abc", "abc") && !ct_eq("abc", "abd"));
        assert_eq!(hmac_hex(b"key", b"The quick brown fox jumps over the lazy dog"), "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
    }
}
