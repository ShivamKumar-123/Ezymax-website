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
        deposit = (await db.execute(
            select(Deposit).where(Deposit.id == deposit_id)
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

        wallet = (await db.execute(
            select(AdminDepositWallet).where(
                AdminDepositWallet.network == net,
                AdminDepositWallet.asset == "USDT",
                AdminDepositWallet.is_active == True,  # noqa: E712
            ).limit(1)
        )).scalar_one_or_none()
        if not wallet:
            logger.warning(
                "no active admin wallet for network=%s deposit=%s — flagging",
                net, deposit.id,
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
            result = await verifier(
                deposit.crypto_tx_hash,
                wallet.address,
                expected_value,
                int(wallet.min_confirmations),
                contract_address=USDT_CONTRACTS.get(net, ""),
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
    """Mirror the credit logic used by the existing oxapay/nowpayments
    webhook handlers so balances, transactions, bonuses, and emails all
    behave the same way regardless of which deposit method was used."""
    user = (await db.execute(
        select(User).where(User.id == deposit.user_id)
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

    # Bonus offer application — same shape as oxapay path.
    bonus_msg = ""
    applied_bonuses: list[tuple[str, Decimal]] = []
    now = datetime.utcnow()
    offers_q = await db.execute(
        select(BonusOffer).where(
            BonusOffer.is_active == True,  # noqa: E712
            BonusOffer.bonus_type.in_(["deposit", "welcome"]),
            BonusOffer.min_deposit <= deposit.amount,
        )
    )
    for offer in offers_q.scalars().all():
        if offer.starts_at and offer.starts_at > now:
            continue
        if offer.expires_at and offer.expires_at < now:
            continue
        if offer.percentage and offer.percentage > 0:
            bonus_amount = deposit.amount * offer.percentage / Decimal("100")
        elif offer.fixed_amount and offer.fixed_amount > 0:
            bonus_amount = offer.fixed_amount
        else:
            continue
        if offer.max_bonus and bonus_amount > offer.max_bonus:
            bonus_amount = offer.max_bonus

        user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + bonus_amount
        db.add(Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="bonus",
            amount=bonus_amount,
            balance_after=user.main_wallet_balance,
            description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
        ))
        bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"
        applied_bonuses.append((offer.name, bonus_amount))

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
        if smtp_configured() and user.email and not user.email.lower().endswith(
            "@wallet.fxartha.local"
        ):
            subject, html, text = render_deposit_confirmed(
                first_name=user.first_name,
                amount=deposit.amount,
                currency="USD",
                method=f"USDT-{(deposit.network or '').upper()}",
                reference=str(deposit.id),
                new_balance=user.main_wallet_balance,
                trader_app_url=(get_settings().TRADER_APP_URL or "https://trade.fxartha.com"),
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
        if not user or not user.email or user.email.lower().endswith("@wallet.fxartha.local"):
            return
        subject, html, text = render_deposit_failed(
            first_name=user.first_name,
            amount=deposit.amount,
            currency="USD",
            method=f"USDT-{(deposit.network or '').upper()}",
            reason_code=deposit.rejection_reason or "verification failed",
            reference=str(deposit.id),
            trader_app_url=(get_settings().TRADER_APP_URL or "https://trade.fxartha.com"),
        )
        fire_and_forget(send_email(user.email, subject, html, text=text))
    except Exception as e:
        logger.debug("rejection email failed for deposit %s: %s", deposit.id, e)


chain_verifier_engine = ChainVerifierEngine()
