//! In-memory chain for tests: transactions, head block, scanner results and balances are set by the test.

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicI64, Ordering};

use super::{Chain, ChainId, Incoming, TxLookup};
use crate::money::D;

pub struct MockChain {
    pub chain: ChainId,
    pub txs: Mutex<HashMap<String, TxLookup>>,
    pub head: AtomicI64,
    pub incoming: Mutex<Vec<Incoming>>,
    pub balance: Mutex<D>,
    pub fail: std::sync::atomic::AtomicBool,
}

impl MockChain {
    pub fn new(chain: ChainId) -> Self {
        Self {
            chain,
            txs: Mutex::default(),
            head: AtomicI64::new(1_000),
            incoming: Mutex::default(),
            balance: Mutex::new(D::ZERO),
            fail: Default::default(),
        }
    }
    pub fn put(&self, hash: &str, l: TxLookup) {
        self.txs.lock().unwrap().insert(hash.to_string(), l);
    }
    pub fn set_head(&self, h: i64) {
        self.head.store(h, Ordering::SeqCst);
    }
    fn check(&self) -> anyhow::Result<()> {
        if self.fail.load(Ordering::SeqCst) { anyhow::bail!("mock chain unavailable") } else { Ok(()) }
    }
}

#[async_trait]
impl Chain for MockChain {
    fn id(&self) -> ChainId {
        self.chain
    }
    async fn lookup(&self, hash: &str) -> anyhow::Result<TxLookup> {
        self.check()?;
        Ok(self.txs.lock().unwrap().get(hash).cloned().unwrap_or_else(TxLookup::not_found))
    }
    async fn head(&self) -> anyhow::Result<i64> {
        self.check()?;
        Ok(self.head.load(Ordering::SeqCst))
    }
    async fn incoming(&self, address: &str, cursor: Option<i64>) -> anyhow::Result<(Vec<Incoming>, i64)> {
        self.check()?;
        let items: Vec<Incoming> = std::mem::take(&mut *self.incoming.lock().unwrap()).into_iter().filter(|i| i.to == address).collect();
        Ok((items, cursor.unwrap_or(0) + 1))
    }
    async fn usdt_balance(&self, _address: &str) -> anyhow::Result<D> {
        self.check()?;
        Ok(*self.balance.lock().unwrap())
    }
}
