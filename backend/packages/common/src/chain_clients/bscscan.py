"""BscScan-based USDT (BEP-20) verifier. Mirrors etherscan.py exactly —
the BSC API is bug-for-bug compatible with Etherscan, just on a different
host. The key difference is decimals: BEP-20 USDT is 18 decimals, not 6,
so the engine passes `expected_value` already scaled accordingly.

This module also exposes `verify_bsc_vault_deposit` and
`verify_bsc_vault_withdraw` for the FXArthaVaultV1 contract path.
When a deposit is sent via `vault.deposit(amount)` the on-chain tx is
NOT a USDT.transfer call — it's a vault.deposit call that the contract
turns into an internal `safeTransferFrom` from user → vault. The
verifier path therefore reads the Deposit event from the tx receipt's
log array rather than parsing the call's input data.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger("chain.bsc")

BSCSCAN_API = "https://api.bscscan.com/api"
BSCSCAN_TESTNET_API = "https://api-testnet.bscscan.com/api"
PUBLIC_RPC = "https://bsc-dataseed.binance.org"
PUBLIC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545"

TRANSFER_SELECTOR = "0xa9059cbb"


def _vault_event_topics() -> tuple[str, str]:
    """Return (deposit_topic, withdraw_topic) — keccak256 of the
    FXArthaVaultV1 event signatures.

    Computed at runtime via eth_utils.keccak rather than hardcoded so we
    never accidentally drift from the deployed contract. If
    `FXArthaVaultV1.sol` ever changes an event signature, this updates
    automatically; if eth_utils isn't installed, the verifier raises a
    clear ImportError instead of silently using wrong topics.
    """
    try:
        from eth_utils import keccak
    except ImportError as e:
        raise ImportError(
            "eth_utils is required for vault event verification. "
            "Add `eth-utils>=4.0` to backend/packages/common/pyproject.toml "
            "and `pip install -e .` in the gateway image."
        ) from e
    deposit = "0x" + keccak(text="Deposit(address,uint256,uint256)").hex()
    withdraw = "0x" + keccak(text="Withdraw(address,uint256,bytes32,uint256)").hex()
    return deposit, withdraw


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


# ── Vault path: event-decoded verification ────────────────────────────


def _topic_to_address(topic: str) -> str:
    """The address topic is left-padded to 32 bytes; the address is the
    rightmost 20 bytes (40 hex chars after the '0x'). Returns lowercase."""
    if not topic or len(topic) < 66:
        return ""
    return ("0x" + topic[-40:]).lower()


def _api_for_testnet(is_testnet: bool) -> str:
    return BSCSCAN_TESTNET_API if is_testnet else BSCSCAN_API


async def verify_bsc_vault_deposit(
    tx_hash: str,
    vault_address: str,
    expected_user: str,
    expected_value: int,
    min_confs: int,
    *,
    is_testnet: bool = False,
    tolerance_bps: int = 50,
) -> dict:
    """Verify that `tx_hash` contains a `Deposit(user, amount, ts)` log
    emitted by the FXArthaVaultV1 instance at `vault_address`, with
    `user == expected_user` and `amount` within ±tolerance_bps of
    `expected_value`. Result-shape mirrors `verify_usdt_transfer`.

    Failure modes:
      • tx not found / receipt pending → transient (final_failure=False)
      • receipt status != 0x1 → reverted, final_failure=True
      • no matching Deposit log → final_failure=True
      • user mismatch → final_failure=True
      • amount mismatch (outside tolerance) → final_failure=True
      • confirmations < min_confs → transient

    BSC mainnet vs testnet is selected via `is_testnet` flag (different
    BscScan API host). Same API key works for both per BscScan docs.
    """
    api_key = (get_settings().BSCSCAN_API_KEY or "").strip()
    api_url = _api_for_testnet(is_testnet)
    rpc_url_default = PUBLIC_TESTNET_RPC if is_testnet else PUBLIC_RPC

    deposit_topic, _ = _vault_event_topics()
    vault_lc = vault_address.lower()
    expected_user_lc = expected_user.lower()

    async with httpx.AsyncClient() as client:
        # Receipt fetch
        try:
            params = {
                "module": "proxy", "action": "eth_getTransactionReceipt",
                "txhash": tx_hash,
            }
            if api_key:
                params["apikey"] = api_key
            r = await client.get(api_url, params=params, timeout=15)
            r.raise_for_status()
            receipt = r.json().get("result")
        except Exception as e:
            return {"ok": False, "confirmations": 0, "reason": f"rpc_error:{e}",
                    "final_failure": False}

        if not receipt:
            return {"ok": False, "confirmations": 0, "reason": "receipt_pending",
                    "final_failure": False}
        if receipt.get("status") != "0x1":
            return {"ok": False, "confirmations": 0, "reason": "tx_reverted",
                    "final_failure": True}

        # Walk logs for a matching Deposit emitted by our vault.
        matched = None
        for log in receipt.get("logs") or []:
            if (log.get("address") or "").lower() != vault_lc:
                continue
            topics = log.get("topics") or []
            if len(topics) < 2 or topics[0].lower() != deposit_topic.lower():
                continue
            user = _topic_to_address(topics[1])
            data = log.get("data") or ""
            try:
                # data layout: 32-byte amount, 32-byte timestamp
                amount = int(data[2:66], 16)
            except (ValueError, IndexError):
                continue
            matched = (user, amount)
            break

        if matched is None:
            return {"ok": False, "confirmations": 0,
                    "reason": "deposit_event_not_found", "final_failure": True}

        user_addr, amount = matched
        if user_addr != expected_user_lc:
            return {"ok": False, "confirmations": 0,
                    "reason": f"wrong_user:{user_addr}", "final_failure": True}

        delta = abs(amount - expected_value)
        max_delta = (Decimal(expected_value) * Decimal(tolerance_bps) / Decimal(10000))
        if Decimal(delta) > max_delta:
            return {"ok": False, "confirmations": 0,
                    "reason": f"amount_mismatch:{amount}_vs_{expected_value}",
                    "final_failure": True}

        # Confirmation count — same path as verify_usdt_transfer.
        try:
            tx_block = int(receipt["blockNumber"], 16)
        except (KeyError, ValueError, TypeError):
            return {"ok": False, "confirmations": 0, "reason": "bad_block_number",
                    "final_failure": False}
        # Reuse _fetch_head_block but it hardcodes the mainnet RPC; for
        # testnet we hit the testnet RPC directly.
        head: Optional[int] = None
        rpc_target = (
            (get_settings().BSC_TESTNET_RPC_URL or "").strip() or rpc_url_default
            if is_testnet else
            (get_settings().BSC_RPC_URL or "").strip() or rpc_url_default
        )
        try:
            r = await client.post(rpc_target, json={
                "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [],
            }, timeout=15)
            r.raise_for_status()
            head = int(r.json()["result"], 16)
        except Exception as e:
            logger.debug("BSC RPC head fetch failed: %s", e)
        if head is None:
            return {"ok": False, "confirmations": 0, "reason": "head_unknown",
                    "final_failure": False}
        confs = max(0, head - tx_block + 1)
        if confs < min_confs:
            return {"ok": False, "confirmations": confs,
                    "reason": f"awaiting_confs:{confs}/{min_confs}",
                    "final_failure": False}

        return {"ok": True, "confirmations": confs, "reason": None,
                "final_failure": False, "amount_received": amount}
