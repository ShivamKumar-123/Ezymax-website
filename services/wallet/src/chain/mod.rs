//! Blockchain access: BNB Chain (BEP20 USDT, JSON-RPC) and TRON (TRC20 USDT, TronGrid). Both implement
//! [`Chain`]; tests use [`mock::MockChain`].

pub mod bsc;
pub mod mock;
pub mod tron;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::fmt;

use crate::money::D;

/// keccak256("Transfer(address,uint256)") — the ERC-20 / TRC-20 Transfer event topic.
pub const TRANSFER_TOPIC: &str = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChainId {
    Bsc,
    Tron,
}

impl ChainId {
    pub const ALL: [ChainId; 2] = [ChainId::Bsc, ChainId::Tron];

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "bsc" | "bep20" | "bnb" => Some(ChainId::Bsc),
            "tron" | "trc20" | "trx" => Some(ChainId::Tron),
            _ => None,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            ChainId::Bsc => "bsc",
            ChainId::Tron => "tron",
        }
    }
    pub fn network(self) -> &'static str {
        match self {
            ChainId::Bsc => "BNB Smart Chain (BEP20)",
            ChainId::Tron => "TRON (TRC20)",
        }
    }
    /// USDT contract in canonical form (bsc: lower-case 0x…, tron: base58).
    pub fn usdt_contract(self) -> &'static str {
        match self {
            ChainId::Bsc => "0x55d398326f99059ff775485246999027b3197955",
            ChainId::Tron => "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        }
    }
    /// Contract as users / wallets expect to see it (EIP-55 checksum on BSC).
    pub fn usdt_contract_display(self) -> &'static str {
        match self {
            ChainId::Bsc => "0x55d398326f99059fF775485246999027B3197955",
            ChainId::Tron => "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        }
    }
    pub fn usdt_decimals(self) -> u32 {
        match self {
            ChainId::Bsc => 18,
            ChainId::Tron => 6,
        }
    }
    /// EVM chain id (for wallet_switchEthereumChain).
    pub fn evm_chain_id(self) -> Option<u64> {
        match self {
            ChainId::Bsc => Some(56),
            ChainId::Tron => None,
        }
    }
    pub fn explorer_tx(self, hash: &str) -> String {
        match self {
            ChainId::Bsc => format!("https://bscscan.com/tx/{hash}"),
            ChainId::Tron => format!("https://tronscan.org/#/transaction/{hash}"),
        }
    }
    /// Canonical address or None when the format / checksum is invalid.
    pub fn normalize_address(self, raw: &str) -> Option<String> {
        let t = raw.trim();
        match self {
            ChainId::Bsc => {
                let h = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X"))?;
                (h.len() == 40 && h.chars().all(|c| c.is_ascii_hexdigit())).then(|| format!("0x{}", h.to_ascii_lowercase()))
            }
            ChainId::Tron => tron_to_hex20(t).map(|_| t.to_string()),
        }
    }
    /// Canonical tx hash or None.
    pub fn normalize_hash(self, raw: &str) -> Option<String> {
        let t = raw.trim();
        let h = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")).unwrap_or(t);
        if h.len() != 64 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }
        let h = h.to_ascii_lowercase();
        Some(match self {
            ChainId::Bsc => format!("0x{h}"),
            ChainId::Tron => h,
        })
    }
}

impl fmt::Display for ChainId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// One token Transfer log.
#[derive(Clone, Debug, PartialEq)]
pub struct TokenTransfer {
    pub log_index: Option<i32>,
    /// Token contract, canonical.
    pub token: String,
    pub from: String,
    pub to: String,
    /// In token units (USDT), full on-chain precision.
    pub amount: D,
}

#[derive(Clone, Debug, PartialEq)]
pub enum TxStatus {
    /// Not (yet) in a block.
    NotFound,
    /// Mined but reverted / failed.
    Failed,
    Success,
}

#[derive(Clone, Debug)]
pub struct TxLookup {
    pub status: TxStatus,
    pub block: Option<i64>,
    pub block_time: Option<DateTime<Utc>>,
    pub transfers: Vec<TokenTransfer>,
}

impl TxLookup {
    pub fn not_found() -> Self {
        Self { status: TxStatus::NotFound, block: None, block_time: None, transfers: vec![] }
    }
    /// USDT transfers paying `to` (any of the given canonical addresses).
    pub fn usdt_to<'a>(&'a self, chain: ChainId, to: &'a [String]) -> impl Iterator<Item = &'a TokenTransfer> + 'a {
        self.transfers.iter().filter(move |t| t.token == chain.usdt_contract() && to.contains(&t.to))
    }
}

/// An incoming USDT transfer found by the scanner.
#[derive(Clone, Debug)]
pub struct Incoming {
    pub tx_hash: String,
    pub log_index: Option<i32>,
    pub from: String,
    pub to: String,
    pub amount: D,
    pub block: Option<i64>,
    pub time: Option<DateTime<Utc>>,
}

#[async_trait]
pub trait Chain: Send + Sync {
    fn id(&self) -> ChainId;
    /// Receipt / info of a transaction with its token transfer logs.
    async fn lookup(&self, hash: &str) -> anyhow::Result<TxLookup>;
    /// Current block number.
    async fn head(&self) -> anyhow::Result<i64>;
    /// Incoming USDT transfers to `address` after `cursor` (chain-specific position); returns the new cursor.
    async fn incoming(&self, address: &str, cursor: Option<i64>) -> anyhow::Result<(Vec<Incoming>, i64)>;
    /// USDT balance of an address.
    async fn usdt_balance(&self, address: &str) -> anyhow::Result<D>;
}

/// Confirmations of a transaction in `block` when the chain head is `head` (the including block counts as 1).
pub fn confirmations(head: i64, block: i64) -> i32 {
    (head - block + 1).clamp(0, i32::MAX as i64) as i32
}

/* ------------------------------------------------------------------ */
/* hex / ABI helpers                                                   */
/* ------------------------------------------------------------------ */

pub fn hex_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok()).collect()
}

pub fn hex_encode(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// A 32-byte ABI word (hex, with or without 0x) as u128; None if it doesn't fit.
pub fn word_u128(word: &str) -> Option<u128> {
    let w = word.strip_prefix("0x").unwrap_or(word);
    let w = w.trim_start_matches('0');
    if w.is_empty() {
        return Some(0);
    }
    if w.len() > 32 {
        return None;
    }
    u128::from_str_radix(w, 16).ok()
}

/// The last 20 bytes of a 32-byte topic as lower-case hex (no prefix).
pub fn topic_address(topic: &str) -> Option<String> {
    let t = topic.strip_prefix("0x").unwrap_or(topic).to_ascii_lowercase();
    (t.len() == 64 && t.chars().all(|c| c.is_ascii_hexdigit())).then(|| t[24..].to_string())
}

pub fn pad_address_topic(hex20: &str) -> String {
    format!("0x{:0>64}", hex20.trim_start_matches("0x").to_ascii_lowercase())
}

/* ------------------------------------------------------------------ */
/* TRON base58check                                                    */
/* ------------------------------------------------------------------ */

const B58: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

fn sha256d(b: &[u8]) -> Vec<u8> {
    Sha256::digest(Sha256::digest(b)).to_vec()
}

pub fn base58_decode(s: &str) -> Option<Vec<u8>> {
    let mut out: Vec<u8> = vec![];
    for c in s.bytes() {
        let mut carry = B58.iter().position(|x| *x == c)? as u32;
        for b in out.iter_mut().rev() {
            carry += (*b as u32) * 58;
            *b = (carry & 0xff) as u8;
            carry >>= 8;
        }
        while carry > 0 {
            out.insert(0, (carry & 0xff) as u8);
            carry >>= 8;
        }
    }
    let zeros = s.bytes().take_while(|c| *c == b'1').count();
    let mut v = vec![0u8; zeros];
    v.extend(out);
    Some(v)
}

pub fn base58_encode(b: &[u8]) -> String {
    let mut digits: Vec<u8> = vec![];
    for &byte in b {
        let mut carry = byte as u32;
        for d in digits.iter_mut() {
            carry += (*d as u32) << 8;
            *d = (carry % 58) as u8;
            carry /= 58;
        }
        while carry > 0 {
            digits.push((carry % 58) as u8);
            carry /= 58;
        }
    }
    let zeros = b.iter().take_while(|x| **x == 0).count();
    let mut s = "1".repeat(zeros);
    s.extend(digits.iter().rev().map(|d| B58[*d as usize] as char));
    s
}

/// TRON base58 address → 20-byte hex (no 0x41 prefix), validating the checksum.
pub fn tron_to_hex20(addr: &str) -> Option<String> {
    if !addr.starts_with('T') || addr.len() != 34 {
        return None;
    }
    let raw = base58_decode(addr)?;
    if raw.len() != 25 || raw[0] != 0x41 {
        return None;
    }
    let (payload, check) = raw.split_at(21);
    (sha256d(payload)[..4] == *check).then(|| hex_encode(&payload[1..]))
}

/// 20-byte hex (optionally 41-prefixed) → TRON base58 address.
pub fn tron_from_hex(hex: &str) -> Option<String> {
    let h = hex.strip_prefix("0x").unwrap_or(hex).to_ascii_lowercase();
    let h = if h.len() == 42 && h.starts_with("41") { h[2..].to_string() } else { h };
    let b = hex_decode(&h)?;
    if b.len() != 20 {
        return None;
    }
    let mut payload = vec![0x41u8];
    payload.extend(b);
    let check = sha256d(&payload);
    payload.extend(&check[..4]);
    Some(base58_encode(&payload))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tron_addresses_round_trip() {
        let usdt = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
        assert_eq!(tron_to_hex20(usdt).unwrap(), "a614f803b6fd780986a42c78ec9c7f77e6ded13c");
        assert_eq!(tron_from_hex("a614f803b6fd780986a42c78ec9c7f77e6ded13c").unwrap(), usdt);
        assert_eq!(tron_from_hex("41a614f803b6fd780986a42c78ec9c7f77e6ded13c").unwrap(), usdt);
        for a in ["TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ", "TDVSPgBZDmNjkYpSH9GdLLbV6LCLhrrYnx"] {
            let h = tron_to_hex20(a).expect("valid company address");
            assert_eq!(tron_from_hex(&h).unwrap(), a);
        }
        // bad checksum / format
        assert!(tron_to_hex20("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u").is_none());
        assert!(tron_to_hex20("0x55d398326f99059fF775485246999027B3197955").is_none());
        assert!(ChainId::Tron.normalize_address("TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ").is_some());
    }

    #[test]
    fn bsc_addresses_and_hashes() {
        assert_eq!(ChainId::Bsc.normalize_address("0x11e9373d598703F83582e34378E086EbEEC5da11").unwrap(), "0x11e9373d598703f83582e34378e086ebeec5da11");
        assert!(ChainId::Bsc.normalize_address("0x11e9373d598703F83582e34378E086EbEEC5da1").is_none());
        assert!(ChainId::Bsc.normalize_address("TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ").is_none());
        let h = "0xBAEA09070a6e181e1c418ae493004c3ab0ad89bd402e18b8aa83f58efcd56212";
        assert_eq!(ChainId::Bsc.normalize_hash(h).unwrap(), h.to_lowercase());
        assert_eq!(ChainId::Tron.normalize_hash(h).unwrap(), h[2..].to_lowercase());
        assert!(ChainId::Bsc.normalize_hash("0x1234").is_none());
        assert_eq!(ChainId::Bsc.usdt_contract(), ChainId::Bsc.usdt_contract_display().to_lowercase());
    }

    #[test]
    fn abi_words() {
        assert_eq!(word_u128("0x00000000000000000000000000000000000000000000000c493a8ea6a02067c0"), Some(0xc493a8ea6a02067c0));
        assert_eq!(word_u128("0000000000000000000000000000000000000000000000000000000037f05fa0"), Some(938_500_000));
        assert_eq!(word_u128("0x0"), Some(0));
        assert_eq!(word_u128("0x1000000000000000000000000000000000"), None);
        assert_eq!(topic_address("0x0000000000000000000000008bafe0bdd3eb9ae0539f5b32e771c1a72a189b7f").unwrap(), "8bafe0bdd3eb9ae0539f5b32e771c1a72a189b7f");
        assert_eq!(pad_address_topic("0x8BAFE0bdd3eb9ae0539f5b32e771c1a72a189b7f"), "0x0000000000000000000000008bafe0bdd3eb9ae0539f5b32e771c1a72a189b7f");
        assert_eq!(confirmations(110, 100), 11);
        assert_eq!(confirmations(90, 100), 0);
    }
}
