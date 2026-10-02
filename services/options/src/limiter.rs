//! Per-client token-bucket rate limiter for the public order-book routes (docs/OPTIONS-EXCHANGE.md §10: 10 requests
//! per second per IP). Pure: the caller passes the instant, so tests drive the clock.

use std::collections::HashMap;
use std::hash::Hash;
use std::time::{Duration, Instant};

/// `rate` tokens per second, at most `burst` saved up.
pub struct Limiter<K> {
    rate: f64,
    burst: f64,
    buckets: HashMap<K, (f64, Instant)>,
    last_prune: Option<Instant>,
}

impl<K: Hash + Eq + Clone> Limiter<K> {
    pub fn new(rate: f64, burst: f64) -> Self {
        Limiter { rate: rate.max(0.001), burst: burst.max(1.0), buckets: HashMap::new(), last_prune: None }
    }

    /// Takes one token for `key` at `now`; false when the client is over its rate.
    pub fn check(&mut self, key: &K, now: Instant) -> bool {
        self.prune(now);
        let (rate, burst) = (self.rate, self.burst);
        let b = self.buckets.entry(key.clone()).or_insert((burst, now));
        let elapsed = now.saturating_duration_since(b.1).as_secs_f64();
        b.0 = (b.0 + elapsed * rate).min(burst);
        b.1 = now;
        if b.0 >= 1.0 {
            b.0 -= 1.0;
            true
        } else {
            false
        }
    }

    /// Clients tracked right now.
    pub fn len(&self) -> usize {
        self.buckets.len()
    }

    pub fn is_empty(&self) -> bool {
        self.buckets.is_empty()
    }

    /// Drops buckets that have refilled completely (every 10 s at most).
    fn prune(&mut self, now: Instant) {
        if self.last_prune.is_some_and(|t| now.saturating_duration_since(t) < Duration::from_secs(10)) {
            return;
        }
        self.last_prune = Some(now);
        let full = Duration::from_secs_f64(self.burst / self.rate);
        self.buckets.retain(|_, (_, at)| now.saturating_duration_since(*at) < full);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ten_per_second_per_client() {
        let mut l = Limiter::new(10.0, 10.0);
        let t0 = Instant::now();
        let a = "1.2.3.4".to_string();
        let b = "5.6.7.8".to_string();
        // a burst of 10 passes, the 11th in the same instant is refused
        assert!((0..10).all(|_| l.check(&a, t0)));
        assert!(!l.check(&a, t0));
        // another client is not affected
        assert!(l.check(&b, t0));
        // 100 ms later one more token has refilled
        let t1 = t0 + Duration::from_millis(100);
        assert!(l.check(&a, t1));
        assert!(!l.check(&a, t1));
        // over a long run the client gets ~10 per second, never more
        let mut ok = 0;
        for i in 1..=200 {
            if l.check(&a, t1 + Duration::from_millis(i * 10)) {
                ok += 1;
            }
        }
        assert!((19..=21).contains(&ok), "{ok} in 2 s");
    }

    #[test]
    fn idle_clients_are_forgotten() {
        let mut l = Limiter::new(10.0, 10.0);
        let t0 = Instant::now();
        for i in 0..50 {
            l.check(&i, t0);
        }
        assert_eq!(l.len(), 50);
        l.check(&999, t0 + Duration::from_secs(11));
        assert_eq!(l.len(), 1);
    }
}
