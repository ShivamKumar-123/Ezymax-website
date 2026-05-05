"""TronGrid-based USDT (TRC-20) verifier.

Tron's TRC-20 transfer encoding mirrors EVM's ERC-20 (same `transfer(address,
uint256)` selector + ABI), but the address is base58-encoded with a leading
`41` byte in hex form. We convert admin's base58 deposit address (T...) to
its 20-byte hex equivalent for comparison against the tx calldata.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger("chain.tron")

DEFAULT_TRON_API = "https://api.trongrid.io"
TRANSFER_SELECTOR = "a9059cbb"  # without 0x — matches Tron's `data` format


# ── base58 → hex helper for Tron addresses ─────────────────────────────────

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58decode(s: str) -> bytes:
    n = 0
    for ch in s:
        idx = _B58_ALPHABET.find(ch)
        if idx < 0:
            raise ValueError(f"bad base58 char: {ch!r}")
        n = n * 58 + idx
    full = n.to_bytes((n.bit_length() + 7) // 8, "big") if n > 0 else b""
    leading_zeros = len(s) - len(s.lstrip("1"))
    return b"\x00" * leading_zeros + full


def _tron_base58_to_hex(addr: str) -> str:
    """Decode a base58 Tron address (T...) to its 21-byte hex form (the
    leading `41` is the Tron mainnet byte). The last 4 bytes are a
    SHA256-checksum we drop. Returns lowercase hex without 0x prefix."""
    raw = _b58decode(addr.strip())
    if len(raw) < 25:
        raise ValueError(f"tron address too short: {addr!r}")
    body = raw[:-4]  # drop checksum
    return body.hex().lower()


def _normalize_admin_address(addr: str) -> tuple[str, str]:
    """Return (full_with_41_prefix, last_20_bytes_only) — both lowercase
    hex, no 0x prefix. Tron contract calldata uses the 20-byte form,
    while gettransactioninfobyid responses sometimes report addresses
    with the `41` prefix."""
    a = addr.strip()
    if a.startswith("T"):
        full = _tron_base58_to_hex(a)
    elif a.lower().startswith("0x"):
        full = a[2:].lower()
        if len(full) == 40:
            full = "41" + full
    else:
        full = a.lower()
    return full, full[-40:]


async def _trongrid_post(client: httpx.AsyncClient, path: str, body: dict) -> dict:
    s = get_settings()
    base = (s.TRON_API_URL or DEFAULT_TRON_API).rstrip("/")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    api_key = (s.TRONGRID_API_KEY or "").strip()
    if api_key:
        headers["TRON-PRO-API-KEY"] = api_key
    r = await client.post(f"{base}{path}", json=body, headers=headers, timeout=15)
    r.raise_for_status()
    return r.json()


async def _trongrid_get(client: httpx.AsyncClient, path: str) -> dict:
    s = get_settings()
    base = (s.TRON_API_URL or DEFAULT_TRON_API).rstrip("/")
    headers: dict[str, str] = {}
    api_key = (s.TRONGRID_API_KEY or "").strip()
    if api_key:
        headers["TRON-PRO-API-KEY"] = api_key
    r = await client.get(f"{base}{path}", headers=headers, timeout=15)
    r.raise_for_status()
    return r.json()


async def verify_usdt_transfer(
    tx_hash: str, expected_to: str, expected_value: int, min_confs: int,
    *, contract_address: str,
    tolerance_bps: int = 50,
) -> dict:
    """expected_to may be base58 (T...) or hex; we normalize both.
    expected_value is in 6-decimal USDT base units (5 USDT == 5_000_000)."""
    try:
        _, expected_to_20 = _normalize_admin_address(expected_to)
        _, contract_20 = _normalize_admin_address(contract_address)
    except Exception as e:
        return {"ok": False, "confirmations": 0,
                "reason": f"address_decode_error:{e}", "final_failure": True}

    th = tx_hash.lstrip("0x").lower()

    async with httpx.AsyncClient() as client:
        try:
            info = await _trongrid_post(client, "/wallet/gettransactioninfobyid",
                                        {"value": th})
            tx = await _trongrid_post(client, "/wallet/gettransactionbyid",
                                      {"value": th})
        except Exception as e:
            return {"ok": False, "confirmations": 0, "reason": f"rpc_error:{e}",
                    "final_failure": False}

        if not tx or "raw_data" not in tx:
            return {"ok": False, "confirmations": 0, "reason": "tx_not_found",
                    "final_failure": False}

        # `info` is empty {} until the tx is included in a block.
        block_number = info.get("blockNumber")
        if not block_number:
            return {"ok": False, "confirmations": 0, "reason": "tx_pending",
                    "final_failure": False}

        # `receipt.result` == "SUCCESS" / "REVERT" / "OUT_OF_ENERGY" etc.
        receipt = info.get("receipt") or {}
        result = receipt.get("result")
        # Also `info.contractRet` lists per-contract results.
        contract_ret_list = info.get("contractResult", [])
        if result and result != "SUCCESS":
            return {"ok": False, "confirmations": 0,
                    "reason": f"tx_failed:{result}", "final_failure": True}

        # Decode the contract call.
        contracts = (tx.get("raw_data") or {}).get("contract") or []
        if not contracts:
            return {"ok": False, "confirmations": 0,
                    "reason": "no_contract_call", "final_failure": True}
        c0 = contracts[0]
        if c0.get("type") != "TriggerSmartContract":
            return {"ok": False, "confirmations": 0,
                    "reason": f"wrong_tx_type:{c0.get('type')}", "final_failure": True}

        params = (c0.get("parameter") or {}).get("value") or {}
        called_contract = (params.get("contract_address") or "").lower()
        # `contract_address` here is hex with the `41` prefix (21 bytes).
        if called_contract != contract_20 and called_contract[-40:] != contract_20:
            return {"ok": False, "confirmations": 0,
                    "reason": f"wrong_contract:{called_contract}",
                    "final_failure": True}

        data = (params.get("data") or "").lower()
        if not data.startswith(TRANSFER_SELECTOR):
            return {"ok": False, "confirmations": 0, "reason": "not_transfer_call",
                    "final_failure": True}
        payload = data[len(TRANSFER_SELECTOR):]
        if len(payload) < 128:
            return {"ok": False, "confirmations": 0, "reason": "short_calldata",
                    "final_failure": True}
        recipient = payload[24:64]  # last 20 bytes of the first word, no 41 prefix
        try:
            value = int(payload[64:128], 16)
        except ValueError:
            return {"ok": False, "confirmations": 0, "reason": "bad_value_encoding",
                    "final_failure": True}
        if recipient != expected_to_20:
            return {"ok": False, "confirmations": 0,
                    "reason": f"wrong_recipient:{recipient}", "final_failure": True}

        delta = abs(value - expected_value)
        max_delta = (Decimal(expected_value) * Decimal(tolerance_bps) / Decimal(10000))
        if Decimal(delta) > max_delta:
            return {"ok": False, "confirmations": 0,
                    "reason": f"amount_mismatch:{value}_vs_{expected_value}",
                    "final_failure": True}

        # Confirmations = head - tx_block + 1.
        try:
            head_resp = await _trongrid_get(client, "/wallet/getnowblock")
        except Exception as e:
            return {"ok": False, "confirmations": 0, "reason": f"rpc_error:{e}",
                    "final_failure": False}
        head_num = ((head_resp.get("block_header") or {}).get("raw_data") or {}).get("number")
        if head_num is None:
            return {"ok": False, "confirmations": 0, "reason": "head_unknown",
                    "final_failure": False}

        confs = max(0, int(head_num) - int(block_number) + 1)
        if confs < min_confs:
            return {"ok": False, "confirmations": confs,
                    "reason": f"awaiting_confs:{confs}/{min_confs}",
                    "final_failure": False}

        # Transient guard: if contractResult exists and is non-success, fail.
        if contract_ret_list:
            cret = (contract_ret_list[0] or "").lower()
            if cret and cret not in ("success", "1"):
                # Tron returns the EVM-style return data here; SUCCESS is "" or "1"
                # but for non-success calls it's a revert string. Treat anything
                # that's clearly an error as final failure.
                if "revert" in cret or "fail" in cret:
                    return {"ok": False, "confirmations": confs,
                            "reason": f"contract_revert:{cret[:40]}",
                            "final_failure": True}

        return {"ok": True, "confirmations": confs, "reason": None,
                "final_failure": False}
