"""Decentralized USDT deposit flow.

User picks a chain (eth/bsc/tron), enters a USD amount, the gateway
returns the active admin deposit address for that chain. The user signs
a transfer in their wallet, posts the tx hash back, and the
chain_verifier_engine credits the user's main wallet once the on-chain
transfer is confirmed.

This service file owns:
  - create_onchain_deposit() → inserts a deposits row, returns address +
    expected amount + token contract + chain id for the trader UI.
  - confirm_tx_hash() → records the user-submitted tx hash and flips the
    deposit to 'submitted' so the engine picks it up on next tick.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import AdminDepositWallet, Deposit
from packages.common.src.chain_clients import (
    USDT_CONTRACTS, USDT_DECIMALS, chain_id_for,
)

logger = logging.getLogger("onchain_deposit")

ALLOWED_NETWORKS = {"eth", "bsc", "tron"}
INVOICE_TTL_MINUTES = 30
MIN_USD_AMOUNT = Decimal("5")


def _is_placeholder(address: str) -> bool:
    a = (address or "").strip().lower()
    if a.startswith("0x") and set(a[2:]) <= {"0"}:
        return True
    if a.startswith("t") and set(a[1:]) <= {"0"}:
        return True
    return False


async def _get_active_wallet(db: AsyncSession, network: str) -> AdminDepositWallet:
    row = (await db.execute(
        select(AdminDepositWallet).where(
            AdminDepositWallet.network == network,
            AdminDepositWallet.asset == "USDT",
            AdminDepositWallet.is_active == True,  # noqa: E712
        ).limit(1)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=503,
            detail=f"No active USDT deposit wallet configured for {network}. "
                   "Ask an admin to set it under Settings → Deposit Wallets.",
        )
    if _is_placeholder(row.address):
        raise HTTPException(
            status_code=503,
            detail=f"Deposit wallet for {network} is still a placeholder. "
                   "Ask an admin to set the real address before depositing.",
        )
    return row


async def create_onchain_deposit(
    user_id: UUID, network: str, amount: Decimal, db: AsyncSession,
) -> dict:
    """Create a wallet-connect deposit row and return everything the
    trader UI needs to invoke MetaMask / TronLink / similar."""
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(
            status_code=503,
            detail="Platform is under maintenance. Deposits are temporarily disabled.",
        )
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    net = (network or "").lower().strip()
    if net not in ALLOWED_NETWORKS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported network: {network!r}. Allowed: {sorted(ALLOWED_NETWORKS)}",
        )
    if amount is None or Decimal(amount) < MIN_USD_AMOUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum deposit is ${MIN_USD_AMOUNT}",
        )

    wallet = await _get_active_wallet(db, net)
    expires = datetime.now(timezone.utc) + timedelta(minutes=INVOICE_TTL_MINUTES)

    deposit = Deposit(
        user_id=user_id,
        amount=Decimal(amount),
        currency="USDT",
        method="wallet_connect",
        status="initiated",
        crypto_address=wallet.address,
        network=net,
        pay_currency=f"USDT_{net.upper()}",
        pay_amount=Decimal(amount),  # USDT is 1:1 with USD for invoice purposes
        expires_at=expires,
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    logger.info(
        "onchain deposit created id=%s user=%s network=%s amount=%s",
        deposit.id, user_id, net, amount,
    )

    decimals = USDT_DECIMALS[net]
    base_units = int(Decimal(amount) * (Decimal(10) ** decimals))

    return {
        "deposit_id": str(deposit.id),
        "network": net,
        "admin_address": wallet.address,
        "amount_usd": float(amount),
        "amount_usdt_base_units": str(base_units),
        "amount_usdt_decimal": str(amount),
        "token_contract": USDT_CONTRACTS[net],
        "chain_id": chain_id_for(net),  # 0 for tron (no EIP-155)
        "decimals": decimals,
        "min_confirmations": int(wallet.min_confirmations),
        "expires_at": expires.isoformat(),
    }


async def confirm_tx_hash(
    deposit_id: UUID, tx_hash: str, user_id: UUID, db: AsyncSession,
) -> dict:
    """User finished broadcasting the transfer; record the hash and let
    the engine handle verification + crediting on its next tick.

    Idempotent: same hash on a deposit that already has it returns 200
    without changes; a different hash on a deposit that already has one
    raises 409.
    """
    th = (tx_hash or "").strip()
    if not th or len(th) < 10 or len(th) > 200:
        raise HTTPException(status_code=400, detail="Invalid tx hash")
    th = th if th.startswith("0x") or len(th) == 64 else th  # leave as-is
    th_norm = th.lower().lstrip("0x")

    deposit = (await db.execute(
        select(Deposit).where(Deposit.id == deposit_id)
    )).scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.user_id != user_id:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.method != "wallet_connect":
        raise HTTPException(
            status_code=400,
            detail="This deposit doesn't use the wallet-connect flow",
        )
    if deposit.status in ("auto_approved", "approved", "confirmed"):
        return {"deposit_id": str(deposit.id), "status": deposit.status,
                "tx_hash": deposit.crypto_tx_hash}
    if deposit.status == "rejected":
        raise HTTPException(
            status_code=400,
            detail=f"Deposit was rejected: {deposit.rejection_reason or 'unknown reason'}",
        )

    existing = (deposit.crypto_tx_hash or "").lower().lstrip("0x")
    if existing and existing != th_norm:
        raise HTTPException(
            status_code=409,
            detail="A different tx hash is already on this deposit",
        )

    deposit.crypto_tx_hash = th
    if deposit.status == "initiated":
        deposit.status = "submitted"
    await db.commit()

    logger.info(
        "onchain tx hash recorded deposit=%s network=%s tx=%s",
        deposit.id, deposit.network, th[:18],
    )
    return {
        "deposit_id": str(deposit.id),
        "status": deposit.status,
        "tx_hash": deposit.crypto_tx_hash,
    }


async def get_status(deposit_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    """Lightweight polling endpoint for the trader UI status loop."""
    deposit = (await db.execute(
        select(Deposit).where(Deposit.id == deposit_id)
    )).scalar_one_or_none()
    if not deposit or deposit.user_id != user_id:
        raise HTTPException(status_code=404, detail="Deposit not found")
    return {
        "deposit_id": str(deposit.id),
        "status": deposit.status,
        "tx_hash": deposit.crypto_tx_hash,
        "network": deposit.network,
        "amount": float(deposit.amount or 0),
        "rejection_reason": deposit.rejection_reason,
    }
