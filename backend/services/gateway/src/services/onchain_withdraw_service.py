"""Decentralized USDT withdrawal flow.

Mirrors `onchain_deposit_service.py` for the payout direction:

  Trader picks chain (eth/bsc/tron) + USD amount → server snapshots the
  linked wallet address as the destination, debits main_wallet_balance
  immediately (frozen for review), inserts a `withdrawals` row with
  status='pending'. Admin reviews on the back office, signs the on-chain
  transfer from the admin deposit wallet, pastes the resulting tx hash;
  `chain_verifier_engine` confirms the transfer landed and flips the row
  to 'paid'. Reject-path refunds the debit.

Destination address is ALWAYS user.wallet_address. The
`destination_address` parameter is ignored — kept on the wire purely for
the trader UI to show what it thinks the linked wallet is.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, Withdrawal

logger = logging.getLogger("onchain_withdraw")

ALLOWED_NETWORKS = {"eth", "bsc", "tron"}
MIN_USD_AMOUNT = Decimal("5")


async def create_onchain_withdrawal(
    user_id: UUID,
    network: str,
    amount: Decimal,
    destination_address: str | None,
    db: AsyncSession,
) -> dict:
    """Open a wallet-connect withdrawal.

    Locks the destination to user.wallet_address regardless of what the
    client passed. Debits main_wallet_balance atomically so the same
    funds can't be requested twice while one withdrawal is pending.
    """
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(
            status_code=503,
            detail="Platform is under maintenance. Withdrawals are temporarily disabled.",
        )
    if not await get_bool_setting("allow_withdrawals", True):
        raise HTTPException(status_code=403, detail="Withdrawals are currently disabled")

    net = (network or "").lower().strip()
    if net not in ALLOWED_NETWORKS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported network: {network!r}. Allowed: {sorted(ALLOWED_NETWORKS)}",
        )
    if amount is None or Decimal(amount) < MIN_USD_AMOUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal is ${MIN_USD_AMOUNT}",
        )

    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    linked = (user.wallet_address or "").strip().lower()
    if not linked:
        raise HTTPException(
            status_code=400,
            detail="Link a wallet to your account before requesting a withdrawal.",
        )

    if destination_address:
        provided = destination_address.strip().lower()
        if provided != linked:
            logger.warning(
                "onchain withdraw: client passed destination=%s but linked=%s — ignoring",
                provided, linked,
            )

    main_bal = user.main_wallet_balance or Decimal("0")
    if main_bal < amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}. "
                "Transfer profit from your trading accounts to your main wallet first."
            ),
        )

    # Debit immediately (frozen). Admin re-credits on reject.
    user.main_wallet_balance = main_bal - Decimal(amount)

    withdrawal = Withdrawal(
        user_id=user.id,
        account_id=None,
        amount=Decimal(amount),
        currency="USDT",
        method="wallet_connect",
        crypto_address=linked,
        # Snapshot the chain the user picked so admin doesn't have to
        # guess from the address (USDT on ETH/BSC/TRC all look different
        # but the contract address column is opaque in a list view).
        wallet_chain_snapshot=net,
        status="pending",
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    logger.info(
        "onchain withdrawal created id=%s user=%s network=%s amount=%s",
        withdrawal.id, user.id, net, amount,
    )

    return {
        "withdrawal_id": str(withdrawal.id),
        "status": withdrawal.status,
        "network": net,
        "amount_usd": float(amount),
        "destination_address": linked,
    }


async def get_status(withdrawal_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    """Read-only polling endpoint for the trader UI status loop."""
    withdrawal = (await db.execute(
        select(Withdrawal).where(Withdrawal.id == withdrawal_id)
    )).scalar_one_or_none()
    if not withdrawal or withdrawal.user_id != user_id:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    return {
        "withdrawal_id": str(withdrawal.id),
        "status": withdrawal.status,
        "tx_hash": withdrawal.crypto_tx_hash,
        "amount": float(withdrawal.amount or 0),
        "destination_address": withdrawal.crypto_address,
        "rejection_reason": withdrawal.rejection_reason,
    }
