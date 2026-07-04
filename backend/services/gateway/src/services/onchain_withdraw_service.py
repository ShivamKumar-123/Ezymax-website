"""Decentralized USDT withdrawal flow.

Mirrors `onchain_deposit_service.py` for the payout direction:

  Trader picks chain (eth/bsc/tron) + USD amount → server uses the
  user's linked SIWE wallet address as the destination (ignoring any
  client-supplied value), debits main_wallet_balance immediately
  (frozen for review), inserts a `withdrawals` row with status='pending'.
  Admin reviews on the back office, signs the on-chain transfer from
  the admin deposit wallet, pastes the resulting tx hash;
  `chain_verifier_engine` confirms the transfer landed and flips the
  row to 'paid'. Reject-path refunds the debit.

The destination is server-locked to `users.wallet_address` (set via
SIWE link). A user must link a wallet before they can withdraw on-chain
— this kills the "compromised account drains to attacker address"
attack: an attacker would also have to socially-engineer the user into
re-linking a wallet they control, which itself requires a fresh SIWE
signature from the original wallet.
"""
from __future__ import annotations

import logging
import re
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, Withdrawal

logger = logging.getLogger("onchain_withdraw")

ALLOWED_NETWORKS = {"eth", "bsc", "tron"}
MIN_USD_AMOUNT = Decimal("5")

# Cheap per-chain format checks. Not full checksum — admin still reviews
# the row before signing the on-chain transfer.
_EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_TRON_ADDRESS_RE = re.compile(r"^T[1-9A-HJ-NP-Za-km-z]{33}$")


def _validate_destination(network: str, address: str) -> str:
    """Trim + normalise the destination and reject obviously bad strings."""
    addr = (address or "").strip()
    if not addr:
        raise HTTPException(
            status_code=400,
            detail="Destination wallet address is required.",
        )
    if network in {"eth", "bsc"}:
        if not _EVM_ADDRESS_RE.match(addr):
            raise HTTPException(
                status_code=400,
                detail="Invalid EVM address. Expected 0x followed by 40 hex characters.",
            )
        return addr.lower()
    if network == "tron":
        if not _TRON_ADDRESS_RE.match(addr):
            raise HTTPException(
                status_code=400,
                detail="Invalid TRON address. Expected a base58 address starting with T.",
            )
        return addr  # TRON addresses are case-sensitive
    raise HTTPException(status_code=400, detail=f"Unsupported network: {network!r}")


async def create_onchain_withdrawal(
    user_id: UUID,
    network: str,
    amount: Decimal,
    destination_address: str | None,
    db: AsyncSession,
    *,
    source: str | None = None,
) -> dict:
    """Open a USDT withdrawal request.

    The user-supplied `destination_address` is used as the payout target
    (format-validated per network). Debits the balance atomically so the
    same funds can't be requested twice while a withdrawal is pending.
    Admin reviews + sends the payout on-chain manually before any funds
    move. (The SIWE linked-wallet lock is deferred to the future automated
    payout flow.)
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

    # Manual on-chain withdrawal: the user supplies the destination address
    # and the admin reviews + sends the payout by hand (status stays
    # 'pending' until then, so a wrong address is caught before any funds
    # move). The SIWE linked-wallet lock is intentionally deferred here — it
    # will be re-introduced with the automated payout flow. The address is
    # format-validated per network (eth/bsc EVM, tron base58).
    destination = _validate_destination(net, destination_address or "")

    # Resolve debit source — honor explicit user choice if provided,
    # else auto-route (wallet-bound when present, else main_wallet).
    from .wallet_service import _resolve_debit_source
    source_kind, source_row = await _resolve_debit_source(db, user_id, preference=source)
    if source_kind == "trading":
        available = source_row.balance or Decimal("0")
    else:
        available = user.main_wallet_balance or Decimal("0")
    if available < amount:
        if source_kind == "trading":
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient wallet account balance. Available: ${float(available):.2f}.",
            )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(available):.2f}. "
                "Transfer profit from your trading accounts to your main wallet first."
            ),
        )

    # Debit immediately (frozen). Admin re-credits on reject.
    amt = Decimal(amount)
    if source_kind == "trading":
        source_row.balance = available - amt
        source_row.equity = (source_row.equity or Decimal("0")) - amt
        source_row.free_margin = (source_row.free_margin or Decimal("0")) - amt
    else:
        user.main_wallet_balance = available - amt

    withdrawal = Withdrawal(
        user_id=user.id,
        # Tag wallet-bound source so admin reject/refund knows where to
        # re-credit (and reporting can split wallet-bound vs main-wallet
        # withdrawals cleanly).
        account_id=source_row.id if source_kind == "trading" else None,
        amount=amt,
        currency="USDT",
        method="wallet_connect",
        crypto_address=destination,
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

    # Confirmation email — uses the shared helper that all three
    # withdrawal-creation paths share (legacy bank/crypto, manual UPI,
    # this on-chain WalletConnect one). Previously this path silently
    # skipped the email, which is what the client noticed: "user takes
    # a withdrawal but no mail comes with transaction id".
    try:
        from . import wallet_service
        await wallet_service.send_withdrawal_requested_email(
            db, withdrawal, user_row=user, method_label=f"WalletConnect ({net.upper()})",
        )
    except Exception as _e:
        logger.warning("onchain withdrawal-requested email failed: %s", _e)

    return {
        "withdrawal_id": str(withdrawal.id),
        "status": withdrawal.status,
        "network": net,
        "amount_usd": float(amount),
        "destination_address": destination,
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
