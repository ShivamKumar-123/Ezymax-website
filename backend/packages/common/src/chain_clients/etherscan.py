"""Etherscan-based USDT (ERC-20) verifier.

We use the public Etherscan API for two reasons: it's reliable, and the
free tier (5 req/s, 100k req/day) is more than enough for a low-volume
deposit flow. If a paid Alchemy URL is configured we use it for the
JSON-RPC `eth_blockNumber` call (cheaper / less rate-limited) but the
tx fetch itself stays on Etherscan.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger("chain.eth")

ETHERSCAN_API = "https://api.etherscan.io/api"
PUBLIC_RPC = "https://eth.llamarpc.com"  # last-resort free fallback

# ERC-20 transfer(address,uint256) function selector
TRANSFER_SELECTOR = "0xa9059cbb"


def _strip_0x(s: str) -> str:
    return s[2:] if s.startswith("0x") else s


def _decode_transfer(input_data: str) -> Optional[tuple[str, int]]:
    """Decode `transfer(to, value)` calldata. Returns (to_address, value_uint)
    or None if the input doesn't look like a transfer call."""
    if not input_data or not input_data.startswith(TRANSFER_SELECTOR):
        return None
    payload = input_data[len(TRANSFER_SELECTOR):]
    if len(payload) < 128:
        return None
    to_hex = "0x" + payload[24:64]  # last 20 bytes of the first 32-byte word
    try:
        value = int(payload[64:128], 16)
    except ValueError:
        return None
    return to_hex.lower(), value


async def _fetch_tx(client: httpx.AsyncClient, tx_hash: str, api_key: str) -> Optional[dict]:
    params = {
        "module": "proxy",
        "action": "eth_getTransactionByHash",
        "txhash": tx_hash,
    }
    if api_key:
        params["apikey"] = api_key
    r = await client.get(ETHERSCAN_API, params=params, timeout=15)
    r.raise_for_status()
    body = r.json()
    return body.get("result")


async def _fetch_receipt(client: httpx.AsyncClient, tx_hash: str, api_key: str) -> Optional[dict]:
    params = {
        "module": "proxy",
        "action": "eth_getTransactionReceipt",
        "txhash": tx_hash,
    }
    if api_key:
        params["apikey"] = api_key
    r = await client.get(ETHERSCAN_API, params=params, timeout=15)
    r.raise_for_status()
    return r.json().get("result")


async def _fetch_head_block(client: httpx.AsyncClient, api_key: str) -> Optional[int]:
    s = get_settings()
    rpc_url = (s.ALCHEMY_API_URL or "").strip()
    if rpc_url:
        try:
            r = await client.post(rpc_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [],
            }, timeout=15)
            r.raise_for_status()
            return int(r.json()["result"], 16)
        except Exception as e:
            logger.debug("alchemy eth_blockNumber failed, falling back: %s", e)

    params = {"module": "proxy", "action": "eth_blockNumber"}
    if api_key:
        params["apikey"] = api_key
    try:
        r = await client.get(ETHERSCAN_API, params=params, timeout=15)
        r.raise_for_status()
        return int(r.json()["result"], 16)
    except Exception as e:
        logger.debug("etherscan eth_blockNumber failed: %s", e)

    try:
        r = await client.post(PUBLIC_RPC, json={
            "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [],
        }, timeout=15)
        r.raise_for_status()
        return int(r.json()["result"], 16)
    except Exception as e:
        logger.warning("public RPC eth_blockNumber failed: %s", e)
    return None


async def verify_usdt_transfer(
    tx_hash: str, expected_to: str, expected_value: int, min_confs: int,
    *, contract_address: str,
    tolerance_bps: int = 50,  # 0.5% slippage tolerance
) -> dict:
    """See chain_clients.__init__ for the contract."""
    api_key = (get_settings().ETHERSCAN_API_KEY or "").strip()
    expected_to_lc = expected_to.lower()
    contract_lc = contract_address.lower()

    async with httpx.AsyncClient() as client:
        try:
            tx = await _fetch_tx(client, tx_hash, api_key)
        except Exception as e:
            return {"ok": False, "confirmations": 0, "reason": f"rpc_error:{e}",
                    "final_failure": False}

        if not tx:
            # Tx not yet visible — could be propagating. Transient.
            return {"ok": False, "confirmations": 0, "reason": "tx_not_found",
                    "final_failure": False}

        # Receipt tells us success/fail.
        receipt = None
        try:
            receipt = await _fetch_receipt(client, tx_hash, api_key)
        except Exception as e:
            return {"ok": False, "confirmations": 0, "reason": f"rpc_error:{e}",
                    "final_failure": False}

        if not receipt:
            return {"ok": False, "confirmations": 0, "reason": "receipt_pending",
                    "final_failure": False}

        if receipt.get("status") != "0x1":
            return {"ok": False, "confirmations": 0, "reason": "tx_reverted",
                    "final_failure": True}

        to_addr = (tx.get("to") or "").lower()
        if to_addr != contract_lc:
            return {"ok": False, "confirmations": 0,
                    "reason": f"wrong_contract:{to_addr}", "final_failure": True}

        decoded = _decode_transfer(tx.get("input") or "")
        if decoded is None:
            return {"ok": False, "confirmations": 0, "reason": "not_transfer_call",
                    "final_failure": True}
        recipient, value = decoded
        if recipient != expected_to_lc:
            return {"ok": False, "confirmations": 0,
                    "reason": f"wrong_recipient:{recipient}", "final_failure": True}

        # Tolerance comparison in base units.
        delta = abs(value - expected_value)
        max_delta = (Decimal(expected_value) * Decimal(tolerance_bps) / Decimal(10000))
        if Decimal(delta) > max_delta:
            return {"ok": False, "confirmations": 0,
                    "reason": f"amount_mismatch:{value}_vs_{expected_value}",
                    "final_failure": True}

        head = await _fetch_head_block(client, api_key)
        try:
            tx_block = int(tx["blockNumber"], 16)
        except (KeyError, ValueError, TypeError):
            return {"ok": False, "confirmations": 0, "reason": "bad_block_number",
                    "final_failure": False}

        if head is None:
            return {"ok": False, "confirmations": 0, "reason": "head_unknown",
                    "final_failure": False}
        confs = max(0, head - tx_block + 1)
        if confs < min_confs:
            return {"ok": False, "confirmations": confs,
                    "reason": f"awaiting_confs:{confs}/{min_confs}",
                    "final_failure": False}
        return {"ok": True, "confirmations": confs, "reason": None,
                "final_failure": False}
