"""BscScan-based USDT (BEP-20) verifier. Mirrors etherscan.py exactly —
the BSC API is bug-for-bug compatible with Etherscan, just on a different
host. The key difference is decimals: BEP-20 USDT is 18 decimals, not 6,
so the engine passes `expected_value` already scaled accordingly.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger("chain.bsc")

BSCSCAN_API = "https://api.bscscan.com/api"
PUBLIC_RPC = "https://bsc-dataseed.binance.org"

TRANSFER_SELECTOR = "0xa9059cbb"


def _decode_transfer(input_data: str) -> Optional[tuple[str, int]]:
    if not input_data or not input_data.startswith(TRANSFER_SELECTOR):
        return None
    payload = input_data[len(TRANSFER_SELECTOR):]
    if len(payload) < 128:
        return None
    to_hex = "0x" + payload[24:64]
    try:
        value = int(payload[64:128], 16)
    except ValueError:
        return None
    return to_hex.lower(), value


async def _fetch_tx(client: httpx.AsyncClient, tx_hash: str, api_key: str) -> Optional[dict]:
    params = {"module": "proxy", "action": "eth_getTransactionByHash", "txhash": tx_hash}
    if api_key:
        params["apikey"] = api_key
    r = await client.get(BSCSCAN_API, params=params, timeout=15)
    r.raise_for_status()
    return r.json().get("result")


async def _fetch_receipt(client: httpx.AsyncClient, tx_hash: str, api_key: str) -> Optional[dict]:
    params = {"module": "proxy", "action": "eth_getTransactionReceipt", "txhash": tx_hash}
    if api_key:
        params["apikey"] = api_key
    r = await client.get(BSCSCAN_API, params=params, timeout=15)
    r.raise_for_status()
    return r.json().get("result")


async def _fetch_head_block(client: httpx.AsyncClient, api_key: str) -> Optional[int]:
    rpc_url = (get_settings().BSC_RPC_URL or "").strip() or PUBLIC_RPC
    try:
        r = await client.post(rpc_url, json={
            "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [],
        }, timeout=15)
        r.raise_for_status()
        return int(r.json()["result"], 16)
    except Exception as e:
        logger.debug("BSC RPC head fetch failed, falling back to BscScan: %s", e)

    params = {"module": "proxy", "action": "eth_blockNumber"}
    if api_key:
        params["apikey"] = api_key
    try:
        r = await client.get(BSCSCAN_API, params=params, timeout=15)
        r.raise_for_status()
        return int(r.json()["result"], 16)
    except Exception as e:
        logger.warning("BscScan eth_blockNumber failed: %s", e)
    return None


async def verify_usdt_transfer(
    tx_hash: str, expected_to: str, expected_value: int, min_confs: int,
    *, contract_address: str,
    tolerance_bps: int = 50,
) -> dict:
    api_key = (get_settings().BSCSCAN_API_KEY or "").strip()
    expected_to_lc = expected_to.lower()
    contract_lc = contract_address.lower()

    async with httpx.AsyncClient() as client:
        try:
            tx = await _fetch_tx(client, tx_hash, api_key)
        except Exception as e:
            return {"ok": False, "confirmations": 0, "reason": f"rpc_error:{e}",
                    "final_failure": False}
        if not tx:
            return {"ok": False, "confirmations": 0, "reason": "tx_not_found",
                    "final_failure": False}

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
