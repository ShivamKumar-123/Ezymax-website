"""Admin service for the decentralized deposit address registry.

Powers the Settings → Deposit Wallets page where an admin pastes the
real BTC/ETH/BSC/Tron addresses the platform receives USDT to. The
chain_verifier_engine (in the gateway) reads from the same table to
know what address every deposit must match.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import AdminDepositWallet
from dependencies import write_audit_log

logger = logging.getLogger("admin.deposit_wallet")

ALLOWED_NETWORKS = {"eth", "bsc", "tron"}

_EVM_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_TRON_RE = re.compile(r"^T[1-9A-HJ-NP-Za-km-z]{33}$")


def _validate_address(network: str, address: str) -> None:
    a = (address or "").strip()
    if not a:
        raise HTTPException(status_code=400, detail="address required")
    if network in ("eth", "bsc"):
        if not _EVM_RE.match(a):
            raise HTTPException(
                status_code=400,
                detail=f"{network.upper()} address must be 0x-prefixed 40 hex chars",
            )
    elif network == "tron":
        if not _TRON_RE.match(a):
            raise HTTPException(
                status_code=400,
                detail="Tron address must be base58, start with 'T', length 34",
            )
    else:
        raise HTTPException(status_code=400, detail=f"unsupported network: {network!r}")


def _row_to_dict(row: AdminDepositWallet) -> dict:
    placeholder_evm = row.address.lower().startswith("0x") and set(row.address[2:]) <= {"0"}
    placeholder_tron = row.address.lower().startswith("t") and set(row.address[1:]) <= {"0"}
    return {
        "id": str(row.id),
        "network": row.network,
        "asset": row.asset,
        "address": row.address,
        "min_confirmations": int(row.min_confirmations),
        "is_active": bool(row.is_active),
        "is_placeholder": bool(placeholder_evm or placeholder_tron),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


async def list_wallets(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(AdminDepositWallet).order_by(AdminDepositWallet.network.asc())
    )).scalars().all()
    return [_row_to_dict(r) for r in rows]


async def upsert_wallet(
    db: AsyncSession, admin_id: uuid.UUID, ip_address: str | None,
    network: str, address: str, min_confirmations: int,
) -> dict:
    """Set or replace the active deposit wallet for a chain.

    Strategy: deactivate any currently-active row for this (network, asset),
    insert a fresh row with the new address. Keeps a history of past
    addresses we used in case we need to audit which deposits went where."""
    net = (network or "").lower().strip()
    if net not in ALLOWED_NETWORKS:
        raise HTTPException(status_code=400, detail=f"unsupported network: {network!r}")
    _validate_address(net, address)
    if min_confirmations is None or int(min_confirmations) < 1:
        raise HTTPException(status_code=400, detail="min_confirmations must be >= 1")

    # Deactivate any current active for (net, USDT) — partial unique index
    # only allows one is_active=true per (network, asset).
    existing = (await db.execute(
        select(AdminDepositWallet).where(
            AdminDepositWallet.network == net,
            AdminDepositWallet.asset == "USDT",
            AdminDepositWallet.is_active == True,  # noqa: E712
        )
    )).scalars().all()
    for prior in existing:
        prior.is_active = False
        prior.updated_at = datetime.utcnow()

    new_row = AdminDepositWallet(
        network=net,
        asset="USDT",
        address=address.strip(),
        min_confirmations=int(min_confirmations),
        is_active=True,
    )
    db.add(new_row)
    await db.flush()

    await write_audit_log(
        db, admin_id, "set_deposit_wallet", "admin_deposit_wallet", new_row.id,
        new_values={
            "network": net,
            "address": new_row.address,
            "min_confirmations": int(min_confirmations),
        },
        ip_address=ip_address,
    )
    await db.commit()
    return _row_to_dict(new_row)
