//! TRON over TronGrid (API key in `TRON-PRO-API-KEY`): transaction info with logs, the current block, TRC20
//! transfer history per address and `balanceOf` through a constant call.

use async_trait::async_trait;
use chrono::DateTime;
use serde_json::{Value, json};
use std::time::Duration;

use super::{Chain, ChainId, Incoming, TRANSFER_TOPIC, TokenTransfer, TxLookup, TxStatus, topic_address, tron_from_hex, tron_to_hex20, word_u128};
use crate::money::{D, from_units};

pub struct Tron {
    http: reqwest::Client,
    base: String,
    key: String,
}

/// First scan looks back this far (ms).
const SCAN_START_BACK_MS: i64 = 10 * 60 * 1000;

impl Tron {
    pub fn new(base: String, key: String) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(12)).user_agent("kalks-wallet/0.1").build().expect("http client");
        Self { http, base, key }
    }

    fn req(&self, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if self.key.is_empty() { rb } else { rb.header("TRON-PRO-API-KEY", &self.key) }
    }

    async fn post(&self, path: &str, body: Value) -> anyhow::Result<Value> {
        let r = self.req(self.http.post(format!("{}{path}", self.base)).json(&body)).send().await.map_err(|e| anyhow::anyhow!("{path}: {}", e.without_url()))?;
        if !r.status().is_success() {
            anyhow::bail!("{path}: http {}", r.status());
        }
        Ok(r.json().await?)
    }

    async fn get(&self, path_and_query: &str) -> anyhow::Result<Value> {
        let r = self.req(self.http.get(format!("{}{path_and_query}", self.base))).send().await.map_err(|e| anyhow::anyhow!("trongrid: {}", e.without_url()))?;
        if !r.status().is_success() {
            anyhow::bail!("trongrid: http {}", r.status());
        }
        Ok(r.json().await?)
    }
}

/// Decodes a TRON event log (`address` is the 20-byte contract hex without the 41 prefix).
pub fn decode_log(log: &Value, index: usize) -> Option<TokenTransfer> {
    let topics = log.get("topics")?.as_array()?;
    if topics.len() != 3 || topics[0].as_str()?.to_ascii_lowercase() != TRANSFER_TOPIC {
        return None;
    }
    let token = tron_from_hex(log.get("address")?.as_str()?)?;
    let units = word_u128(log.get("data")?.as_str()?)?;
    let decimals = if token == ChainId::Tron.usdt_contract() { ChainId::Tron.usdt_decimals() } else { 6 };
    Some(TokenTransfer {
        log_index: Some(index as i32),
        token,
        from: tron_from_hex(&topic_address(topics[1].as_str()?)?)?,
        to: tron_from_hex(&topic_address(topics[2].as_str()?)?)?,
        amount: from_units(units, decimals)?,
    })
}

pub fn parse_info(info: &Value) -> TxLookup {
    let Some(block) = info.get("blockNumber").and_then(Value::as_i64) else { return TxLookup::not_found() };
    let ok = info.get("receipt").and_then(|r| r.get("result")).and_then(Value::as_str) == Some("SUCCESS") && info.get("result").and_then(Value::as_str) != Some("FAILED");
    let transfers = info.get("log").and_then(Value::as_array).map(|a| a.iter().enumerate().filter_map(|(i, l)| decode_log(l, i)).collect()).unwrap_or_default();
    TxLookup {
        status: if ok { TxStatus::Success } else { TxStatus::Failed },
        block: Some(block),
        block_time: info.get("blockTimeStamp").and_then(Value::as_i64).and_then(DateTime::from_timestamp_millis),
        transfers,
    }
}

#[async_trait]
impl Chain for Tron {
    fn id(&self) -> ChainId {
        ChainId::Tron
    }

    async fn lookup(&self, hash: &str) -> anyhow::Result<TxLookup> {
        let info = self.post("/wallet/gettransactioninfobyid", json!({"value": hash})).await?;
        Ok(parse_info(&info))
    }

    async fn head(&self) -> anyhow::Result<i64> {
        let b = self.post("/wallet/getnowblock", json!({})).await?;
        b.pointer("/block_header/raw_data/number").and_then(Value::as_i64).ok_or_else(|| anyhow::anyhow!("getnowblock: bad result"))
    }

    async fn incoming(&self, address: &str, cursor: Option<i64>) -> anyhow::Result<(Vec<Incoming>, i64)> {
        let now = chrono::Utc::now().timestamp_millis();
        let since = cursor.unwrap_or(now - SCAN_START_BACK_MS);
        let v = self
            .get(&format!(
                "/v1/accounts/{address}/transactions/trc20?only_to=true&only_confirmed=false&limit=200&order_by=block_timestamp,asc&contract_address={}&min_timestamp={since}",
                ChainId::Tron.usdt_contract()
            ))
            .await?;
        let mut out = vec![];
        let mut cur = since;
        for it in v.get("data").and_then(Value::as_array).into_iter().flatten() {
            let ts = it.get("block_timestamp").and_then(Value::as_i64).unwrap_or(since);
            cur = cur.max(ts);
            if it.get("type").and_then(Value::as_str) != Some("Transfer") || it.get("to").and_then(Value::as_str) != Some(address) {
                continue;
            }
            if it.pointer("/token_info/address").and_then(Value::as_str) != Some(ChainId::Tron.usdt_contract()) {
                continue;
            }
            let (Some(hash), Some(from), Some(units)) = (
                it.get("transaction_id").and_then(Value::as_str),
                it.get("from").and_then(Value::as_str),
                it.get("value").and_then(Value::as_str).and_then(|s| s.parse::<u128>().ok()),
            ) else {
                continue;
            };
            let Some(amount) = from_units(units, ChainId::Tron.usdt_decimals()) else { continue };
            out.push(Incoming {
                tx_hash: hash.to_ascii_lowercase(),
                log_index: None,
                from: from.to_string(),
                to: address.to_string(),
                amount,
                block: None,
                time: DateTime::from_timestamp_millis(ts),
            });
        }
        Ok((out, cur))
    }

    async fn usdt_balance(&self, address: &str) -> anyhow::Result<D> {
        let hex = tron_to_hex20(address).ok_or_else(|| anyhow::anyhow!("bad tron address"))?;
        let v = self
            .post(
                "/wallet/triggerconstantcontract",
                json!({
                    "owner_address": address,
                    "contract_address": ChainId::Tron.usdt_contract(),
                    "function_selector": "balanceOf(address)",
                    "parameter": format!("{hex:0>64}"),
                    "visible": true,
                }),
            )
            .await?;
        let word = v.pointer("/constant_result/0").and_then(Value::as_str).ok_or_else(|| anyhow::anyhow!("balanceOf: no result"))?;
        let units = word_u128(word).ok_or_else(|| anyhow::anyhow!("balanceOf: bad result"))?;
        from_units(units, ChainId::Tron.usdt_decimals()).ok_or_else(|| anyhow::anyhow!("balanceOf: overflow"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn parses_real_transaction_info() {
        // TRON tx 6e5ffb1e…2d63: a contract paying two USDT transfers (1.5 and 938.5 USDT)
        let info = json!({
            "id": "6e5ffb1e12db87e3420eca751d837305db57dd5d22b5eda4dc1cffeeb2492d63",
            "blockNumber": 86646265, "blockTimeStamp": 1790611248000u64,
            "receipt": {"result": "SUCCESS"},
            "log": [
                {"address": "a614f803b6fd780986a42c78ec9c7f77e6ded13c", "topics": [TRANSFER_TOPIC,
                  "0000000000000000000000001cd1e40c5d77ad152837a782777045a97e0d7b2e",
                  "00000000000000000000000076b5c8429b78a38643e5ff9a94b4ca10c1efd867"],
                 "data": "000000000000000000000000000000000000000000000000000000000016e360"},
                {"address": "a614f803b6fd780986a42c78ec9c7f77e6ded13c", "topics": [TRANSFER_TOPIC,
                  "0000000000000000000000001cd1e40c5d77ad152837a782777045a97e0d7b2e",
                  "0000000000000000000000002cab3ac79193296de9c5e3f1e3aaa35f589505cb"],
                 "data": "0000000000000000000000000000000000000000000000000000000037f05fa0"},
                {"address": "39dd12a54e2bab7c82aa14a1e158b34263d2d510", "topics": ["fe6f7f8574ad66f5a9001635fa07c426dbed515866253867ebd1ca6ac43f0d12"], "data": ""}
            ]
        });
        let l = parse_info(&info);
        assert_eq!(l.status, TxStatus::Success);
        assert_eq!(l.block, Some(86646265));
        assert_eq!(l.transfers.len(), 2);
        assert!(l.transfers.iter().all(|t| t.token == ChainId::Tron.usdt_contract()));
        assert_eq!(l.transfers[0].amount, D::from_str("1.5").unwrap());
        assert_eq!(l.transfers[1].amount, D::from_str("938.5").unwrap());
        assert_eq!(l.transfers[1].to, tron_from_hex("2cab3ac79193296de9c5e3f1e3aaa35f589505cb").unwrap());
        assert!(parse_info(&json!({})).status == TxStatus::NotFound);
        let mut failed = info.clone();
        failed["receipt"]["result"] = json!("REVERT");
        assert_eq!(parse_info(&failed).status, TxStatus::Failed);
    }
}
