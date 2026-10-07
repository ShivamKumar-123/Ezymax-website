//! Provider REST rate limit with priorities.
//!
//! The plan allows a fixed number of REST requests per second for the whole key. Every caller asks the gate for a
//! slot at a priority; one slot is granted per interval, always to the most urgent waiter:
//!
//! 1. `Reconcile`: replacing closed bars of streamed symbols with the provider's final values (time-sensitive).
//! 2. `Interactive`: someone is waiting (first chart of a symbol, a quote for a symbol that has none yet).
//! 3. `Snapshot`: background price snapshots of symbols that are not streamed.
//! 4. `Background`: deep history.
//!
//! Waiters of the same priority are served in arrival order.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::sync::{Notify, oneshot};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Prio {
    Reconcile = 0,
    Interactive = 1,
    Snapshot = 2,
    Background = 3,
}

const LEVELS: usize = 4;

#[derive(Default)]
struct Queues {
    q: [VecDeque<oneshot::Sender<()>>; LEVELS],
}

impl Queues {
    fn pop(&mut self) -> Option<oneshot::Sender<()>> {
        self.q.iter_mut().find_map(VecDeque::pop_front)
    }
}

#[derive(Clone)]
pub struct Gate {
    queues: Arc<Mutex<Queues>>,
    wake: Arc<Notify>,
}

impl Gate {
    /// Starts the dispatcher: one grant every `gap`.
    pub fn start(gap: Duration) -> Self {
        let g = Self { queues: Default::default(), wake: Arc::new(Notify::new()) };
        let (queues, wake) = (g.queues.clone(), g.wake.clone());
        tokio::spawn(async move {
            loop {
                let next = queues.lock().unwrap().pop();
                match next {
                    // a waiter that gave up (dropped its receiver) does not use the slot
                    Some(tx) => {
                        if tx.send(()).is_ok() {
                            tokio::time::sleep(gap).await;
                        }
                    }
                    None => wake.notified().await,
                }
            }
        });
        g
    }

    /// Waits for a request slot.
    pub async fn acquire(&self, prio: Prio) {
        let (tx, rx) = oneshot::channel();
        self.queues.lock().unwrap().q[prio as usize].push_back(tx);
        self.wake.notify_one();
        let _ = rx.await;
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn grants_in_priority_order_at_the_rate() {
        let gate = Gate::start(Duration::from_secs(1));
        let order = Arc::new(Mutex::new(Vec::new()));
        let t0 = tokio::time::Instant::now();
        let mut tasks = Vec::new();
        // queue order: background, snapshot, interactive, reconcile — served in the reverse
        for (i, p) in [Prio::Background, Prio::Snapshot, Prio::Interactive, Prio::Reconcile].into_iter().enumerate() {
            let (g, o) = (gate.clone(), order.clone());
            tasks.push(tokio::spawn(async move {
                // the first waiter arrives alone and is served at once; the rest queue behind it
                tokio::time::sleep(Duration::from_millis(10 * i as u64)).await;
                g.acquire(p).await;
                o.lock().unwrap().push((p, tokio::time::Instant::now() - t0));
            }));
        }
        for t in tasks {
            t.await.unwrap();
        }
        let got = order.lock().unwrap().clone();
        let prios: Vec<Prio> = got.iter().map(|(p, _)| *p).collect();
        assert_eq!(prios, vec![Prio::Background, Prio::Reconcile, Prio::Interactive, Prio::Snapshot]);
        // one grant per second
        for w in got.windows(2) {
            assert!(w[1].1 - w[0].1 >= Duration::from_millis(990), "{:?}", got);
        }
    }

    #[tokio::test(start_paused = true)]
    async fn abandoned_waiters_do_not_use_a_slot() {
        let gate = Gate::start(Duration::from_secs(1));
        gate.acquire(Prio::Background).await; // takes the first slot; the next one is 1 s away
        let g = gate.clone();
        let gave_up = tokio::spawn(async move { tokio::time::timeout(Duration::from_millis(100), g.acquire(Prio::Interactive)).await.is_err() });
        assert!(gave_up.await.unwrap());
        let t = tokio::time::Instant::now();
        gate.acquire(Prio::Snapshot).await;
        assert!(t.elapsed() <= Duration::from_secs(1));
    }
}
