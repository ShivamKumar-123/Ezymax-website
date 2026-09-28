//! Password hashing (argon2id), opaque tokens, OTP codes and keyed hashes.

use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::sync::OnceLock;
use subtle::ConstantTimeEq;

/// argon2id, 19 MiB, t=2, p=1 (OWASP password storage baseline).
fn argon() -> Argon2<'static> {
    Argon2::new(Algorithm::Argon2id, Version::V0x13, Params::DEFAULT)
}

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    argon().hash_password(password.as_bytes()).map(|h| h.to_string()).map_err(|e| anyhow::anyhow!("hash failed: {e}"))
}

/// Verifies against a stored PHC string. Never panics on malformed hashes.
pub fn verify_password(password: &str, phc: &str) -> bool {
    match PasswordHash::new(phc) {
        Ok(parsed) => argon().verify_password(password.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

/// A real hash of a throwaway password, verified against when the email is unknown so
/// "no such account" and "wrong password" take the same time.
pub fn dummy_hash() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| hash_password(&random_token(18)).unwrap_or_default())
}

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    b
}

/// URL-safe random token of `n` bytes of entropy.
pub fn random_token(n: usize) -> String {
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    URL_SAFE_NO_PAD.encode(b)
}

/// Uniform 6-digit code (rejection sampling avoids modulo bias).
pub fn otp_code() -> String {
    loop {
        let v = u32::from_le_bytes(random_bytes::<4>());
        if v < 4_294_000_000 {
            return format!("{:06}", v % 1_000_000);
        }
    }
}

/// Keyed hashing with the server secret. Tokens, OTP codes and device ids are stored only as
/// HMAC-SHA256(secret, domain || value), so a database leak does not yield usable sessions.
#[derive(Clone)]
pub struct Keys {
    secret: Vec<u8>,
}

impl Keys {
    pub fn new(secret: &str) -> Self {
        Self { secret: secret.as_bytes().to_vec() }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_roundtrip() {
        let h = hash_password("Correct#Horse9").unwrap();
        assert!(h.starts_with("$argon2id$v=19$"));
        assert!(verify_password("Correct#Horse9", &h));
        assert!(!verify_password("correct#horse9", &h));
        assert!(!verify_password("Correct#Horse9", "not-a-phc-string"));
    }

    #[test]
    fn hashes_are_salted() {
        let a = hash_password("Same#Pass1").unwrap();
        let b = hash_password("Same#Pass1").unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn otp_is_six_digits() {
        for _ in 0..200 {
            let c = otp_code();
            assert_eq!(c.len(), 6);
            assert!(c.chars().all(|x| x.is_ascii_digit()));
        }
    }

    #[test]
    fn keyed_hash_depends_on_secret_and_domain() {
        let k1 = Keys::new("a".repeat(32).as_str());
        let k2 = Keys::new("b".repeat(32).as_str());
        assert_eq!(k1.hash("session", "t"), k1.hash("session", "t"));
        assert_ne!(k1.hash("session", "t"), k2.hash("session", "t"));
        assert_ne!(k1.hash("session", "t"), k1.hash("otp", "t"));
        assert!(ct_eq(&k1.hash("x", "y"), &k1.hash("x", "y")));
        assert!(!ct_eq(&k1.hash("x", "y"), &k1.hash("x", "z")));
    }

    #[test]
    fn tokens_are_unique_and_long() {
        let a = random_token(32);
        assert_eq!(a.len(), 43);
        assert_ne!(a, random_token(32));
    }
}
