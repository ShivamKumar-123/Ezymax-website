//! In-memory fixed-window rate limiter. Single-process only; move to Redis when the gateway scales out.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Clone, Default)]
pub struct Limiter {
    inner: Arc<Mutex<HashMap<String, (Instant, u32)>>>,
}

impl Limiter {
    /// Counts one hit for `key`. Returns `Err(retry_after_secs)` once `limit` hits happened within `window`.
    pub fn hit(&self, key: &str, limit: u32, window: Duration) -> Result<(), u64> {
        self.hit_at(key, limit, window, Instant::now())
    }

    fn hit_at(&self, key: &str, limit: u32, window: Duration, now: Instant) -> Result<(), u64> {
        let mut map = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        let e = map.entry(key.to_string()).or_insert((now, 0));
        if now.duration_since(e.0) >= window {
            *e = (now, 0);
        }
        if e.1 >= limit {
            let left = window.saturating_sub(now.duration_since(e.0));
            return Err(left.as_secs().max(1));
        }
        e.1 += 1;
        Ok(())
    }

    /// Forget a key (e.g. per-email login counter after a successful login).
    pub fn clear(&self, key: &str) {
        self.inner.lock().unwrap_or_else(|p| p.into_inner()).remove(key);
    }

    /// Drops windows older than `max_window` so memory stays bounded.
    pub fn sweep(&self, max_window: Duration) {
        let now = Instant::now();
        self.inner.lock().unwrap_or_else(|p| p.into_inner()).retain(|_, (t, _)| now.duration_since(*t) < max_window);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_after_limit_and_resets() {
        let l = Limiter::default();
        let t0 = Instant::now();
        let w = Duration::from_secs(60);
        for _ in 0..3 {
            assert!(l.hit_at("k", 3, w, t0).is_ok());
        }
        let retry = l.hit_at("k", 3, w, t0 + Duration::from_secs(10)).unwrap_err();
        assert_eq!(retry, 50);
        assert!(l.hit_at("other", 3, w, t0).is_ok());
        assert!(l.hit_at("k", 3, w, t0 + Duration::from_secs(61)).is_ok());
    }
}
