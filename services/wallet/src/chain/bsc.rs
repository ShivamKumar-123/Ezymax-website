//! BNB Smart Chain over public JSON-RPC (no explorer key): receipts, block numbers / times, Transfer logs and
//! `balanceOf`. Endpoints are tried in order; the first that answers wins. The Binance dataseeds refuse
//! `eth_getLogs`, so a getLogs-capable node (publicnode) goes first in the default list.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use super::{Chain, ChainId, Incoming, TRANSFER_TOPIC, TokenTransfer, TxLookup, TxStatus, pad_address_topic, topic_address, word_u128};
use crate::money::{D, from_units};

pub struct Bsc {
    http: reqwest::Client,
    urls: Vec<String>,
    ids: AtomicU64,
}

/// Blocks per eth_getLogs request (public nodes cap ranges) and per scan pass.
const LOG_CHUNK: i64 = 500;
const SCAN_MAX: i64 = 5_000;
/// First scan starts this many blocks back (~2.5 min at 0.75 s blocks).
const SCAN_START_BACK: i64 = 200;

impl Bsc {
    pub fn new(urls: Vec<String>) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(12)).user_agent("kalks-wallet/0.1").build().expect("http client");
        Self { http, urls, ids: AtomicU64::new(1) }
    }

    async fn call(&self, method: &str, params: Value) -> anyhow::Result<Value> {
        let mut last = anyhow::anyhow!("no BSC RPC endpoints configured");
        for url in &self.urls {
            let id = self.ids.fetch_add(1, Ordering::Relaxed);
            let body = json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params});
            match self.http.post(url).json(&body).send().await {
                Ok(r) if r.status().is_success() => match r.json::<Value>().await {
                    Ok(v) => {
                        if let Some(e) = v.get("error") {
                            last = anyhow::anyhow!("{method}: {}", e.get("message").and_then(Value::as_str).unwrap_or("rpc error"));
                            continue;
                        }
                        return Ok(v.get("result").cloned().unwrap_or(Value::Null));
                    }
                    Err(e) => last = anyhow::anyhow!("{method}: bad json: {e}"),
                },
                Ok(r) => last = anyhow::anyhow!("{method}: http {}", r.status()),
                Err(e) => last = anyhow::anyhow!("{method}: {}", e.without_url()),
            }
        }
        Err(last)
    }

    async fn block_time(&self, block: i64) -> anyhow::Result<Option<DateTime<Utc>>> {
        let b = self.call("eth_getBlockByNumber", json!([format!("0x{block:x}"), false])).await?;
        Ok(b.get("timestamp").and_then(Value::as_str).and_then(hex_i64).and_then(|t| DateTime::from_timestamp(t, 0)))
    }
}

pub fn hex_i64(s: &str) -> Option<i64> {
    i64::from_str_radix(s.strip_prefix("0x").unwrap_or(s), 16).ok()
}

/// Decodes a USDT Transfer log (any token; the caller filters by contract).
pub fn decode_log(log: &Value) -> Option<TokenTransfer> {
    let topics = log.get("topics")?.as_array()?;
    if topics.len() != 3 || topics[0].as_str()?.trim_start_matches("0x").to_ascii_lowercase() != TRANSFER_TOPIC {
        return None;
    }
    let token = log.get("address")?.as_str()?.to_ascii_lowercase();
    let units = word_u128(log.get("data")?.as_str()?)?;
    let decimals = if token == ChainId::Bsc.usdt_contract() { ChainId::Bsc.usdt_decimals() } else { 18 };
    Some(TokenTransfer {
        log_index: log.get("logIndex").and_then(Value::as_str).and_then(hex_i64).map(|i| i as i32),
        token,
        from: format!("0x{}", topic_address(topics[1].as_str()?)?),
        to: format!("0x{}", topic_address(topics[2].as_str()?)?),
        amount: from_units(units, decimals)?,
    })
}

#[async_trait]
impl Chain for Bsc {
    fn id(&self) -> ChainId {
        ChainId::Bsc
    }

    async fn lookup(&self, hash: &str) -> anyhow::Result<TxLookup> {
        let r = self.call("eth_getTransactionReceipt", json!([hash])).await?;
        if r.is_null() {
            return Ok(TxLookup::not_found());
        }
        let block = r.get("blockNumber").and_then(Value::as_str).and_then(hex_i64);
        let Some(block) = block else { return Ok(TxLookup::not_found()) };
        let ok = r.get("status").and_then(Value::as_str).map(|s| s == "0x1").unwrap_or(false);
        let transfers: Vec<TokenTransfer> = r.get("logs").and_then(Value::as_array).map(|a| a.iter().filter_map(decode_log).collect()).unwrap_or_default();
        let block_time = self.block_time(block).await.unwrap_or(None);
        Ok(TxLookup { status: if ok { TxStatus::Success } else { TxStatus::Failed }, block: Some(block), block_time, transfers })
    }

    async fn head(&self) -> anyhow::Result<i64> {
        let v = self.call("eth_blockNumber", json!([])).await?;
        v.as_str().and_then(hex_i64).ok_or_else(|| anyhow::anyhow!("eth_blockNumber: bad result"))
    }

    async fn incoming(&self, address: &str, cursor: Option<i64>) -> anyhow::Result<(Vec<Incoming>, i64)> {
        let head = self.head().await?;
        let start = match cursor {
            Some(c) => c + 1,
            None => head - SCAN_START_BACK,
        };
        let end = head.min(start + SCAN_MAX - 1);
        let mut out = vec![];
        let to_topic = pad_address_topic(address);
        let mut from = start;
        while from <= end {
            let to = (from + LOG_CHUNK - 1).min(end);
            let logs = self
                .call(
                    "eth_getLogs",
                    json!([{
                        "fromBlock": format!("0x{from:x}"),
                        "toBlock": format!("0x{to:x}"),
                        "address": ChainId::Bsc.usdt_contract(),
                        "topics": [format!("0x{TRANSFER_TOPIC}"), Value::Null, to_topic],
                    }]),
                )
                .await?;
            for l in logs.as_array().into_iter().flatten() {
                if l.get("removed").and_then(Value::as_bool) == Some(true) {
                    continue;
                }
                let (Some(t), Some(hash)) = (decode_log(l), l.get("transactionHash").and_then(Value::as_str)) else { continue };
                if t.token != ChainId::Bsc.usdt_contract() {
                    continue;
                }
                out.push(Incoming {
                    tx_hash: hash.to_ascii_lowercase(),
                    log_index: t.log_index,
                    from: t.from,
                    to: t.to,
                    amount: t.amount,
                    block: l.get("blockNumber").and_then(Value::as_str).and_then(hex_i64),
                    time: l.get("blockTimestamp").and_then(Value::as_str).and_then(hex_i64).and_then(|t| DateTime::from_timestamp(t, 0)),
                });
            }
            from = to + 1;
        }
        Ok((out, end.max(start - 1)))
    }

    async fn usdt_balance(&self, address: &str) -> anyhow::Result<D> {
        let data = format!("0x70a08231{}", &pad_address_topic(address)[2..]);
        let v = self.call("eth_call", json!([{"to": ChainId::Bsc.usdt_contract(), "data": data}, "latest"])).await?;
        let units = v.as_str().and_then(word_u128).ok_or_else(|| anyhow::anyhow!("balanceOf: bad result"))?;
        from_units(units, ChainId::Bsc.usdt_decimals()).ok_or_else(|| anyhow::anyhow!("balanceOf: overflow"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_a_real_usdt_log() {
        // BSC tx 0xbaea0907…6212, log 8 (USDT transfer, 226.39 USDT)
        let log = json!({
            "address": "0x55d398326f99059ff775485246999027b3197955",
            "topics": [
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                "0x000000000000000000000000286da9568057420df90c5489e51cbb82b29f0301",
                "0x0000000000000000000000008bafe0bdd3eb9ae0539f5b32e771c1a72a189b7f"
            ],
            "data": "0x00000000000000000000000000000000000000000000000c493a8ea6a02067c0",
            "logIndex": "0x8"
        });
        let t = decode_log(&log).unwrap();
        assert_eq!(t.token, ChainId::Bsc.usdt_contract());
        assert_eq!(t.from, "0x286da9568057420df90c5489e51cbb82b29f0301");
        assert_eq!(t.to, "0x8bafe0bdd3eb9ae0539f5b32e771c1a72a189b7f");
        assert_eq!(t.log_index, Some(8));
        assert_eq!(t.amount, from_units(0xc493a8ea6a02067c0, 18).unwrap());
        // not a Transfer
        let mut other = log.clone();
        other["topics"][0] = json!("0x1234");
        assert!(decode_log(&other).is_none());
    }
}
