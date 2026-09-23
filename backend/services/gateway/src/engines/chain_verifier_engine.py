"""On-chain verification engine for the decentralized USDT deposit flow.

Every 30 seconds:
  1. Loads all deposits with method='wallet_connect' AND status='submitted'.
  2. For each, dispatches to the right chain client (Etherscan / BscScan /
     TronGrid) based on `deposits.network`.
  3. If the chain client confirms the transfer matches (correct contract,
     correct recipient, correct value within ±0.5%, ≥ N confirmations),
     credits the user's main wallet and flips the deposit to
     'auto_approved'.
  4. If the chain client reports a final failure (revert, wrong recipient,
     wrong contract, amount mismatch), flips the deposit to 'rejected'
     with a human-readable reason.
  5. Otherwise (transient — RPC down, tx not yet visible, awaiting more
     confirmations), leaves the deposit at 'submitted' and retries on
     the next tick. After ~2 hours of fruitless retries, flags for admin
     review by setting status='manual_review'.

Idempotency across the gateway's two uvicorn workers: every per-deposit
verification claims a Redis SETNX lock keyed by deposit id. Whichever
worker wins the race processes that deposit; the other skips. Lock TTL
is 60s — slightly longer than the tick — so a crash mid-verify doesn't
strand the deposit forever.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Deposit, User, Transaction, BonusOffer, AdminDepositWallet,
)
from packages.common.src.redis_client import redis_client
from packages.common.src.chain_clients import (
    USDT_CONTRACTS, USDT_DECIMALS,
    verify_eth_usdt_transfer,
    verify_bsc_usdt_transfer,
    verify_bsc_vault_deposit,
    verify_tron_usdt_transfer,
)

from packages.common.src import notify
from packages.common.src.email_branding import apply_email_brand

logger = logging.getLogger("chain-verifier")

TICK_INTERVAL = 30
LOCK_TTL_SECONDS = 60
LOCK_PREFIX = "chain_verifier_lock"
MAX_RETRY_TICKS = 240  # ~2 hours @ 30s tick

VERIFIERS = {
    "eth": verify_eth_usdt_transfer,
    "bsc": verify_bsc_usdt_transfer,
    "tron": verify_tron_usdt_transfer,
}


class ChainVerifierEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Chain verifier engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    await _verify_pending_deposits(db)
            except Exception as e:
                logger.error("chain verifier tick error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


async def _verify_pending_deposits(db: AsyncSession) -> None:
    rows = (await db.execute(
        select(Deposit).where(
            Deposit.method == "wallet_connect",
            Deposit.status == "submitted",
        )
    )).scalars().all()

    for deposit in rows:
        # Per-deposit Redis lock so racing workers don't double-credit.
        lock_key = f"{LOCK_PREFIX}:{deposit.id}"
        try:
            acquired = await redis_client.set(lock_key, "1", ex=LOCK_TTL_SECONDS, nx=True)
        except Exception as e:
            logger.debug("redis SETNX failed for %s — skipping safely: %s", lock_key, e)
            continue
        if not acquired:
            continue

        try:
            await _verify_one(deposit.id)
        except Exception as e:
            logger.error("verify_one(%s) crashed: %s", deposit.id, e, exc_info=True)


async def _verify_one(deposit_id) -> None:
    """Each deposit gets its own DB session so a failure on one doesn't
    poison the rest of the batch."""
    async with AsyncSessionLocal() as db:
        # FOR UPDATE is the AUTHORITATIVE double-credit guard. The Redis
        # SETNX lock above is best-effort only: Redis runs with an LRU
        # eviction policy and a lock key can be evicted under memory
        # pressure, letting both workers reach this point. With the row
        # lock, the loser blocks here until the winner commits, then the
        # status recheck sees 'auto_approved' and bails.
        deposit = (await db.execute(
            select(Deposit).where(Deposit.id == deposit_id).with_for_update()
        )).scalar_one_or_none()
        if not deposit or deposit.status != "submitted":
            return  # something else moved it already
        if not deposit.network or not deposit.crypto_tx_hash:
            return
        net = deposit.network.lower()
        verifier = VERIFIERS.get(net)
        if not verifier:
            logger.warning("no verifier for network=%s deposit=%s", net, deposit.id)
            return

        # Verify against the wallet the user was actually told to pay:
        # the deposit row stored crypto_address at creation time. Matching
        # by address (not a LIMIT-1 re-derive) means a later wallet
        # rotation — or a testnet row activated alongside the mainnet one
        # (possible since migration 0044) — can't redirect verification to
        # the wrong address.
        wallet = None
        if deposit.crypto_address:
            wallet = (await db.execute(
                select(AdminDepositWallet).where(
                    AdminDepositWallet.network == net,
                    AdminDepositWallet.asset == "USDT",
                    AdminDepositWallet.address == deposit.crypto_address,
                ).order_by(AdminDepositWallet.created_at.desc()).limit(1)
            )).scalar_one_or_none()
        if not wallet:
            # Legacy deposits without a stored address: mainnet rows only.
            wallet = (await db.execute(
                select(AdminDepositWallet).where(
                    AdminDepositWallet.network == net,
                    AdminDepositWallet.asset == "USDT",
                    AdminDepositWallet.is_active == True,  # noqa: E712
                    AdminDepositWallet.is_testnet == False,  # noqa: E712
                ).order_by(AdminDepositWallet.created_at.desc()).limit(1)
            )).scalar_one_or_none()
        if not wallet:
            logger.warning(
                "no admin wallet matching network=%s addr=%s deposit=%s — flagging",
                net, deposit.crypto_address, deposit.id,
            )
            return

        decimals = USDT_DECIMALS.get(net, 6)
        expected_value = int(Decimal(deposit.amount) * (Decimal(10) ** decimals))

        # Vault path: when admin_deposit_wallet.contract_address is set,
        # the deposit was made via vault.deposit() — verify the on-chain
        # Deposit event instead of decoding a plain USDT.transfer call.
        # Spec: docs/vault-phase1-spec.md §5.2.
        if (wallet.contract_address or "").strip():
            result = await _verify_via_vault_event(
                deposit, wallet, expected_value, decimals,
            )
        else:
            # SECURITY: bind plain-transfer verification to the depositing
            # user's own wallet. Without this, any user could submit someone
            # else's USDT transfer to the public admin address and be credited.
            # The vault path already enforces this; mirror it here. Unlinked
            # wallet → manual_review (admin decides) rather than a silent
            # auto-credit or a hard reject.
            u = (await db.execute(
                select(User).where(User.id == deposit.user_id)
            )).scalar_one_or_none()
            user_wallet = (u.wallet_address or "").strip() if u else ""
            if not user_wallet:
                deposit.status = "manual_review"
                deposit.rejection_reason = "user_wallet_not_linked — cannot verify sender"
                await db.commit()
                return
            result = await verifier(
                deposit.crypto_tx_hash,
                wallet.address,
                expected_value,
                int(wallet.min_confirmations),
                contract_address=USDT_CONTRACTS.get(net, ""),
                expected_from=user_wallet,
            )

        logger.info(
            "verifying deposit=%s network=%s tx=%s result=%s confs=%s reason=%s",
            deposit.id, net, (deposit.crypto_tx_hash or "")[:18],
            "OK" if result["ok"] else "PENDING/FAIL",
            result.get("confirmations"), result.get("reason"),
        )

        if result["ok"]:
            await _credit_deposit(db, deposit)
            await db.commit()
            return

        if result.get("final_failure"):
            deposit.status = "rejected"
            deposit.rejection_reason = result.get("reason") or "verification_failed"
            await db.commit()
            await _send_rejected_email(deposit)
            return

        # Transient — bump retry counter, give up after MAX_RETRY_TICKS.
        # We piggy-back the count on Redis (no schema change) keyed by id.
        retry_key = f"chain_verifier_retries:{deposit.id}"
        try:
            n = await redis_client.incr(retry_key)
            if n == 1:
                await redis_client.expire(retry_key, 6 * 3600)
            if n > MAX_RETRY_TICKS:
                deposit.status = "manual_review"
                deposit.rejection_reason = (
                    f"timeout after {n} ticks — last reason: {result.get('reason')}"
                )
                await db.commit()
                logger.warning(
                    "deposit %s flagged for manual review after %d ticks",
                    deposit.id, n,
                )
        except Exception:
            pass


async def _verify_via_vault_event(
    deposit: Deposit,
    wallet: AdminDepositWallet,
    expected_value: int,
    decimals: int,
) -> dict:
    """Vault-path verification: check the tx_hash carries a Deposit event
    emitted by `wallet.contract_address` for this user's wallet address
    in the expected amount. Currently supports BSC (mainnet + testnet);
    other EVM chains can be added by mirroring this function with their
    respective explorer client.

    Returns the same dict shape as `verify_*_usdt_transfer` so the
    surrounding engine logic (commit / reject / retry) is unchanged.
    """
    net = (deposit.network or "").lower()

    # Vault path requires the depositor's wallet address — pulled from
    # the user row. The Deposit event's `user` field is the on-chain
    # msg.sender, which is the wallet that signed the deposit() call.
    async with AsyncSessionLocal() as db2:
        u = (await db2.execute(
            select(User).where(User.id == deposit.user_id)
        )).scalar_one_or_none()
    if not u or not u.wallet_address:
        return {
            "ok": False, "confirmations": 0,
            "reason": "user_wallet_not_linked", "final_failure": True,
        }
    expected_user = (u.wallet_address or "").lower()

    if net in ("bsc", "bsc-testnet"):
        return await verify_bsc_vault_deposit(
            deposit.crypto_tx_hash,
            wallet.contract_address,
            expected_user,
            expected_value,
            int(wallet.min_confirmations),
            is_testnet=(net == "bsc-testnet"),
        )

    logger.warning(
        "vault-event verification not implemented for network=%s deposit=%s",
        net, deposit.id,
    )
    return {
        "ok": False, "confirmations": 0,
        "reason": f"vault_path_not_implemented:{net}",
        "final_failure": False,
    }


async def _credit_deposit(db: AsyncSession, deposit: Deposit) -> None:
    """Mirror the credit logic used by the existing oxapay/razorpay
    webhook handlers so balances, transactions, bonuses, and emails all
    behave the same way regardless of which deposit method was used."""
    # Row-lock the user so concurrent credits (another deposit, an oxapay
    # webhook) can't lost-update main_wallet_balance.
    user = (await db.execute(
        select(User).where(User.id == deposit.user_id).with_for_update()
    )).scalar_one_or_none()
    if not user:
        logger.error("user not found for deposit %s", deposit.id)
        return

    deposit.status = "auto_approved"
    deposit.approved_at = datetime.utcnow()

    user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + deposit.amount

    db.add(Transaction(
        user_id=deposit.user_id,
        account_id=None,
        type="deposit",
        amount=deposit.amount,
        balance_after=user.main_wallet_balance,
        reference_id=deposit.id,
        description=f"Deposit to main wallet - USDT {(deposit.network or '').upper()} (auto)",
    ))

    # H-MONEY-2: single, dedup-guarded bonus application (was an inline copy).
    from packages.common.src.bonus_service import apply_deposit_bonus
    applied_bonuses = await apply_deposit_bonus(db, user, deposit)
    bonus_msg = "".join(
        f" + ${float(a):.2f} bonus ({n})" for n, a in applied_bonuses
    )

    try:
        await notify.create_notification(
            db, deposit.user_id,
            title="Deposit confirmed",
            message=(
                f"Your USDT-{(deposit.network or '').upper()} deposit of "
                f"${float(deposit.amount):,.2f} was confirmed on-chain.{bonus_msg}"
            ),
            notif_type="deposit", action_url="/wallet",
            commit=False,  # caller commits the whole batch
        )
    except Exception as e:
        logger.debug("notification failed: %s", e)

    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_deposit_confirmed
        from packages.common.src.config import get_settings
        await apply_email_brand(db, user)
        if smtp_configured() and user.email and not user.email.lower().endswith(
            "@wallet.swisscresta.local"
        ):
            subject, html, text = render_deposit_confirmed(
                first_name=user.first_name,
                amount=deposit.amount,
                currency="USD",
                method=f"USDT-{(deposit.network or '').upper()}",
                reference=str(deposit.id),
                new_balance=user.main_wallet_balance,
                trader_app_url=(get_settings().TRADER_APP_URL or "https://trade.swisscresta.com"),
            )
            fire_and_forget(send_email(user.email, subject, html, text=text))
    except Exception as e:
        logger.warning("deposit confirm email failed: %s", e)

    logger.info(
        "deposit confirmed user=%s amount=$%s network=%s deposit=%s",
        user.id, deposit.amount, deposit.network, deposit.id,
    )


async def _send_rejected_email(deposit: Deposit) -> None:
    """Fire-and-forget rejection email. Uses a fresh DB session because
    the caller's session may be in an indeterminate state."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_deposit_failed
        from packages.common.src.config import get_settings
        if not smtp_configured():
            return
        async with AsyncSessionLocal() as db2:
            user = (await db2.execute(
                select(User).where(User.id == deposit.user_id)
            )).scalar_one_or_none()
        async with AsyncSessionLocal() as db3:
            await apply_email_brand(db3, user)
        if not user or not user.email or user.email.lower().endswith("@wallet.swisscresta.local"):
            return
        subject, html, text = render_deposit_failed(
            first_name=user.first_name,
            amount=deposit.amount,
            currency="USD",
            method=f"USDT-{(deposit.network or '').upper()}",
            reason_code=deposit.rejection_reason or "verification failed",
            reference=str(deposit.id),
            trader_app_url=(get_settings().TRADER_APP_URL or "https://trade.swisscresta.com"),
        )
        fire_and_forget(send_email(user.email, subject, html, text=text))
    except Exception as e:
        logger.debug("rejection email failed for deposit %s: %s", deposit.id, e)


chain_verifier_engine = ChainVerifierEngine()
