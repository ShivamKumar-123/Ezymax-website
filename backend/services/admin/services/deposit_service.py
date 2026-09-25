"""Admin Finance Service — deposit/withdrawal listing, approval, rejection, screenshots."""
import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, TradingAccount, Deposit, Withdrawal, Transaction, BonusOffer
from packages.common.src.notify import create_notification
from packages.common.src.email_branding import apply_email_brand
from packages.common.src.admin_schemas import DepositOut, WithdrawalOut, PaginatedResponse
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from packages.common.src.withdrawal_limits import available_to_withdraw
from dependencies import write_audit_log

# C-ADMIN-1: only proof/QR image + PDF uploads may ever be served back, and each
# with its real content type (never a generic octet-stream that a browser might
# mishandle, nor an arbitrary extension a traversal could smuggle in).
_DOWNLOAD_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def _deposit_to_out(d: Deposit, user: User = None) -> DepositOut:
    return DepositOut(
        id=str(d.id),
        user_id=str(d.user_id),
        account_id=str(d.account_id) if d.account_id else None,
        amount=float(d.amount or 0),
        currency=d.currency or "INR",
        method=d.method,
        status=d.status,
        transaction_id=d.transaction_id,
        screenshot_url=d.screenshot_url,
        rejection_reason=d.rejection_reason,
        created_at=d.created_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
    )


def _withdrawal_to_out(w: Withdrawal, user: User = None) -> WithdrawalOut:
    return WithdrawalOut(
        id=str(w.id),
        user_id=str(w.user_id),
        account_id=str(w.account_id) if w.account_id else None,
        amount=float(w.amount or 0),
        currency=w.currency or "INR",
        method=w.method,
        status=w.status,
        bank_details=w.bank_details,
        crypto_address=w.crypto_address,
        wallet_chain_snapshot=w.wallet_chain_snapshot,
        crypto_tx_hash=w.crypto_tx_hash,
        rejection_reason=w.rejection_reason,
        created_at=w.created_at,
        approved_at=w.approved_at,
        completed_at=w.completed_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
    )


async def list_pending_deposits(page: int, per_page: int, db: AsyncSession,
                                user_ids: list | None = None):
    query = select(Deposit).where(Deposit.status == "pending")
    # White-label pool scoping (broker actors); None = unscoped.
    if user_ids is not None:
        query = query.where(Deposit.user_id.in_(user_ids))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # DESC so the newest pending request lands at the top of the admin
    # queue — operators expect "what just came in" first, not the
    # oldest stuck row from the bottom of the list.
    query = query.order_by(Deposit.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    deposits = result.scalars().all()

    items = []
    for d in deposits:
        user_q = await db.execute(select(User).where(User.id == d.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_deposit_to_out(d, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_pending_withdrawals(page: int, per_page: int, db: AsyncSession,
                                   user_ids: list | None = None):
    query = select(Withdrawal).where(Withdrawal.status == "pending")
    if user_ids is not None:
        query = query.where(Withdrawal.user_id.in_(user_ids))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # DESC for newest-first, matching the pending-deposits order above.
    query = query.order_by(Withdrawal.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        user_q = await db.execute(select(User).where(User.id == w.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_withdrawal_to_out(w, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_all_deposits(
    page: int, per_page: int, status: str | None, db: AsyncSession,
    user_id: uuid.UUID | None = None,
    user_ids: list | None = None,
):
    query = select(Deposit)
    if user_ids is not None:
        query = query.where(Deposit.user_id.in_(user_ids))
    # Optional per-user filter for the user-detail ledger page.
    if user_id is not None:
        query = query.where(Deposit.user_id == user_id)
    if status and status != "all":
        if status == "approved":
            query = query.where(Deposit.status.in_(["approved", "auto_approved"]))
        else:
            query = query.where(Deposit.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Deposit.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    deposits = result.scalars().all()

    items = []
    for d in deposits:
        user_q = await db.execute(select(User).where(User.id == d.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_deposit_to_out(d, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_all_withdrawals(
    page: int, per_page: int, status: str | None, db: AsyncSession,
    user_id: uuid.UUID | None = None,
    user_ids: list | None = None,
):
    query = select(Withdrawal)
    if user_ids is not None:
        query = query.where(Withdrawal.user_id.in_(user_ids))
    if user_id is not None:
        query = query.where(Withdrawal.user_id == user_id)
    if status and status != "all":
        query = query.where(Withdrawal.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Withdrawal.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        user_q = await db.execute(select(User).where(User.id == w.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_withdrawal_to_out(w, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def set_payment_link(
    deposit_id: uuid.UUID,
    payment_link: str,
    message: str | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Attach a payment URL to a pending local-banking deposit and notify
    the user (in-app + email). Deposit stays pending — admin still has to
    mark it approved once the user has paid externally."""
    link = (payment_link or "").strip()
    if not link:
        raise HTTPException(status_code=400, detail="payment_link is required")
    if not (link.startswith("http://") or link.startswith("https://") or link.startswith("upi://")):
        raise HTTPException(
            status_code=400,
            detail="payment_link must start with http://, https://, or upi://",
        )

    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id).with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.method != "local_banking":
        raise HTTPException(
            status_code=400,
            detail="Payment link can only be attached to local-banking requests",
        )
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.payment_link = link

    user_row = (
        await db.execute(select(User).where(User.id == deposit.user_id))
    ).scalar_one_or_none()

    note = message.strip() if message else ""
    notif_message = (
        f"Your local banking deposit of ${float(deposit.amount or 0):,.2f} is "
        f"ready. Tap to pay."
    )
    if note:
        notif_message = f"{notif_message} Admin note: {note}"

    await create_notification(
        db, deposit.user_id,
        title="Deposit payment link ready",
        message=notif_message,
        notif_type="deposit",
        action_url="/wallet?tab=deposit",
        commit=False,
    )

    await write_audit_log(
        db, admin_id, "set_payment_link", "deposit", deposit_id,
        old_values={"payment_link": None},
        new_values={"payment_link": link, "message": note or None},
        ip_address=ip_address,
    )

    await db.commit()

    # Fire-and-forget email so the user gets a copy even if they're not
    # actively in the app. Failure here doesn't roll back the link.
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured, fire_and_forget
        from packages.common.src.email_templates.base import render_layout
        from packages.common.src.config import get_settings as _gs
        if smtp_configured() and user_row and user_row.email:
            trader_app_url = (_gs().TRADER_APP_URL or "https://trade.swisscresta.com").rstrip("/")
            body_html = f"""
            <p>We've reviewed your deposit request and attached a payment link below.
            Click through to complete payment with your bank or card. Once you've paid,
            our team will confirm and your wallet will be credited.</p>
            {('<p><em>' + note + '</em></p>') if note else ''}
            """
            html = render_layout(
                title="Your deposit payment link is ready",
                intro=f"Deposit request: ${float(deposit.amount or 0):,.2f}",
                body_html=body_html,
                cta_label="Open payment link",
                cta_url=link,
                footer_note=(
                    f"After paying, you can track the request at {trader_app_url}/wallet."
                ),
            )
            fire_and_forget(send_email(
                user_row.email,
                "Your SwissCresta deposit payment link",
                html,
            ))
    except Exception as e:  # pragma: no cover - email path is best-effort
        import logging
        logging.getLogger(__name__).warning("payment-link email failed: %s", e)

    return {
        "ok": True,
        "deposit_id": str(deposit.id),
        "payment_link": link,
    }


async def approve_deposit(
    deposit_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    # Lock the deposit row so two admins clicking "approve" at the same
    # moment can't both flip pending → approved and credit twice. The
    # status guard below then makes the second one fail cleanly.
    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id).with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.status = "approved"
    deposit.approved_by = admin_id
    deposit.approved_at = datetime.utcnow()

    # Lock the user row too — concurrent transactions touching
    # main_wallet_balance must serialise to avoid lost-update writes.
    user_q = await db.execute(
        select(User).where(User.id == deposit.user_id).with_for_update()
    )
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=400, detail="User not found for deposit")

    # Credit target: honor the deposit row's tagged account_id first
    # (user explicitly picked "Wallet Account" at submit time). Else
    # fall back to wallet-bound account (auto-route). Else main_wallet.
    wallet_acc = None
    if getattr(deposit, "account_id", None):
        tagged_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == deposit.account_id,
                TradingAccount.user_id == deposit.user_id,
                TradingAccount.is_active.is_(True),
            ).with_for_update().limit(1)
        )
        wallet_acc = tagged_q.scalar_one_or_none()
    if wallet_acc is None:
        wallet_acc_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == deposit.user_id,
                TradingAccount.is_wallet_account.is_(True),
                TradingAccount.is_active.is_(True),
            ).with_for_update().limit(1)
        )
        wallet_acc = wallet_acc_q.scalar_one_or_none()

    if wallet_acc is not None:
        wallet_acc.balance = (wallet_acc.balance or Decimal("0")) + deposit.amount
        wallet_acc.equity = (wallet_acc.equity or Decimal("0")) + deposit.amount
        wallet_acc.free_margin = (wallet_acc.free_margin or Decimal("0")) + deposit.amount
        db.add(
            Transaction(
                user_id=deposit.user_id,
                account_id=wallet_acc.id,
                type="deposit",
                amount=deposit.amount,
                balance_after=wallet_acc.balance,
                reference_id=deposit.id,
                description=f"Deposit to wallet account - {deposit.method or 'manual'}",
                created_by=admin_id,
            )
        )
    else:
        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount
        db.add(
            Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="deposit",
                amount=deposit.amount,
                balance_after=user_row.main_wallet_balance,
                reference_id=deposit.id,
                description=f"Deposit to main wallet - {deposit.method or 'manual'}",
                created_by=admin_id,
            )
        )

    # CPA to the referring IB, if their plan carries one. This is the only
    # trigger for it: the commission engine was previously only ever called
    # from the fill path, so IBCommissionPlan.cpa_per_deposit could be set in
    # admin and would never pay anything. Charged once per referred trader.
    # Best-effort — a CPA problem must never block crediting a deposit.
    try:
        from packages.common.src.ib_commission import distribute_ib_cpa
        await distribute_ib_cpa(db, deposit.user_id, deposit.amount)
    except Exception as _cpa_exc:
        import logging as _lg
        _lg.getLogger("admin-deposits").error(
            "IB CPA accrual failed for deposit %s: %s", deposit.id, _cpa_exc
        )

    bonus_msg = ""
    applied_bonuses: list[tuple[str, Decimal]] = []
    now = datetime.utcnow()
    offers_q = await db.execute(
        select(BonusOffer).where(
            BonusOffer.is_active == True,
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

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + bonus_amount
        db.add(
            Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="bonus",
                amount=bonus_amount,
                balance_after=user_row.main_wallet_balance,
                description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
                created_by=admin_id,
            )
        )
        bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"
        applied_bonuses.append((offer.name, bonus_amount))

    await write_audit_log(
        db, admin_id, "approve_deposit", "deposit", deposit_id,
        # str() preserves the Decimal precisely in JSONB — float() can
        # introduce a few ULPs of drift on edge values which becomes a
        # records-vs-bank-statement diff during reconciliation.
        new_values={"amount": str(deposit.amount), "status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        deposit.user_id,
        title="Deposit approved",
        message=(
            f"Your deposit of ${float(deposit.amount):,.2f} was approved and added to your main wallet.{bonus_msg}"
        ),
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    # Email — fire-and-forget after commit so SMTP latency doesn't delay the
    # admin's response and a delivery failure can't roll back the approval.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import (
            render_deposit_confirmed, render_bonus_credited,
        )
        from packages.common.src.config import get_settings as _get_settings
        await apply_email_brand(db, user_row)
        if smtp_configured() and user_row.email:
            app_url = (_get_settings().TRADER_APP_URL or "https://trade.swisscresta.com")
            subject, html, text = render_deposit_confirmed(
                first_name=user_row.first_name,
                amount=deposit.amount,
                currency="USD",
                method=deposit.method or "Manual",
                reference=str(deposit.id),
                new_balance=user_row.main_wallet_balance,
                trader_app_url=app_url,
            )
            fire_and_forget(send_email(user_row.email, subject, html, text=text))
            for offer_name, bonus_amount in applied_bonuses:
                bsubject, bhtml, btext = render_bonus_credited(
                    first_name=user_row.first_name,
                    bonus_amount=bonus_amount,
                    bonus_label=offer_name,
                    currency="USD",
                    new_bonus_balance=user_row.main_wallet_balance,
                    trader_app_url=app_url,
                )
                fire_and_forget(send_email(user_row.email, bsubject, bhtml, text=btext))
    except Exception as _e:
        # Logger isn't always imported at module top here; deferred lookup.
        import logging as _logging
        _logging.getLogger("admin.deposit").warning("deposit email failed: %s", _e)
    return {"message": f"Deposit approved successfully{bonus_msg}"}


async def reject_deposit(
    deposit_id: uuid.UUID, reason: str | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    # Phase 3: lock the row like approve_deposit does, so a reject can't race a
    # concurrent approve/auto-approve (both passing the pending check).
    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id).with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.status = "rejected"
    deposit.rejection_reason = reason
    deposit.approved_by = admin_id
    deposit.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_deposit", "deposit", deposit_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db,
        deposit.user_id,
        title="Deposit not approved",
        message=f"Your deposit request of ${float(deposit.amount):,.2f} was not approved.{extra}",
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    return {"message": "Deposit rejected"}


async def approve_withdrawal(
    withdrawal_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    # Withdrawal row is locked so two admins racing on the same row see
    # "not pending" on the second click; the user row + account row are
    # then locked so balance reads are consistent with the debit.
    result = await db.execute(
        select(Withdrawal).where(Withdrawal.id == withdrawal_id).with_for_update()
    )
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending")

    # wallet_connect withdrawals already debited main_wallet_balance at
    # request time (see onchain_withdraw_service.create_onchain_withdrawal),
    # so approving them must NOT debit again. We still write the ledger
    # row here at approval time so the audit trail shows the admin action.
    already_debited = (withdrawal.method or "") == "wallet_connect"

    if withdrawal.account_id:
        acc_q = await db.execute(
            select(TradingAccount).where(TradingAccount.id == withdrawal.account_id).with_for_update()
        )
        account = acc_q.scalar_one_or_none()
        if account:
            if not already_debited:
                # C-MONEY-3: withdrawable = balance − margin_used (capped by
                # free_margin), NOT the raw balance — otherwise an admin approval
                # could pull out funds collateralising open positions and push the
                # account into a margin deficit. Same rule as the user-facing
                # withdrawal paths (account row is locked above, so this is
                # consistent with the debit).
                avail = available_to_withdraw(
                    "trading",
                    balance=account.balance,
                    margin_used=account.margin_used,
                    free_margin=account.free_margin,
                )
                if avail < withdrawal.amount:
                    raise HTTPException(
                        status_code=400,
                        detail="Insufficient withdrawable balance — funds backing open positions cannot be withdrawn",
                    )
                account.balance = (account.balance or Decimal("0")) - withdrawal.amount
                account.equity = account.balance + (account.credit or Decimal("0"))
                account.free_margin = account.equity - (account.margin_used or Decimal("0"))

            txn = Transaction(
                user_id=withdrawal.user_id,
                account_id=account.id,
                type="withdrawal",
                amount=-withdrawal.amount,
                balance_after=account.balance,
                reference_id=withdrawal.id,
                description=f"Withdrawal approved - {withdrawal.method or 'manual'}",
                created_by=admin_id,
            )
            db.add(txn)
    else:
        uw = await db.execute(
            select(User).where(User.id == withdrawal.user_id).with_for_update()
        )
        user_row = uw.scalar_one_or_none()
        if not user_row:
            raise HTTPException(status_code=400, detail="User not found")
        if not already_debited:
            main_bal = user_row.main_wallet_balance or Decimal("0")
            if main_bal < withdrawal.amount:
                raise HTTPException(status_code=400, detail="Insufficient main wallet balance")
            user_row.main_wallet_balance = main_bal - withdrawal.amount
        db.add(
            Transaction(
                user_id=withdrawal.user_id,
                account_id=None,
                type="withdrawal",
                amount=-withdrawal.amount,
                balance_after=user_row.main_wallet_balance,
                reference_id=withdrawal.id,
                description=f"Withdrawal approved (main wallet) - {withdrawal.method or 'manual'}",
                created_by=admin_id,
            )
        )

    withdrawal.status = "approved"
    withdrawal.approved_by = admin_id
    withdrawal.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "approve_withdrawal", "withdrawal", withdrawal_id,
        new_values={"amount": str(withdrawal.amount), "status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal approved",
        message=(
            f"Your withdrawal of ${float(withdrawal.amount):,.2f} via "
            f"{withdrawal.method or 'manual'} has been approved and will be processed."
        ),
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    # Approval email — fire-and-forget.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_withdrawal_approved
        from packages.common.src.config import get_settings as _gs
        u = (await db.execute(select(User).where(User.id == withdrawal.user_id))).scalar_one_or_none()
        if smtp_configured() and u and u.email:
            destination_str: str | None = None
            if withdrawal.crypto_address:
                ca = str(withdrawal.crypto_address)
                destination_str = f"{ca[:6]}…{ca[-4:]}" if len(ca) > 12 else ca
            elif withdrawal.bank_details and isinstance(withdrawal.bank_details, dict):
                acct = withdrawal.bank_details.get("account_number") or ""
                if acct:
                    destination_str = f"Bank ****{str(acct)[-4:]}"
            await apply_email_brand(db, u)
            subject, html, text = render_withdrawal_approved(
                first_name=u.first_name,
                amount=withdrawal.amount,
                currency="USD",
                method=withdrawal.method or "Manual",
                destination=destination_str,
                request_id=str(withdrawal.id),
                trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisscresta.com"),
            )
            fire_and_forget(send_email(u.email, subject, html, text=text))
    except Exception as _e:
        import logging as _logging
        _logging.getLogger("admin.withdraw").warning("withdrawal approve email failed: %s", _e)
    return {"message": "Withdrawal approved successfully"}


async def reject_withdrawal(
    withdrawal_id: uuid.UUID, reason: str | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    # Row-lock so the refund branch (below) is safe against a concurrent
    # approve on the same row.
    result = await db.execute(
        select(Withdrawal).where(Withdrawal.id == withdrawal_id).with_for_update()
    )
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending")

    # wallet_connect withdrawals had funds debited at REQUEST time so
    # we must refund here. All other methods debit at approve, so a
    # still-pending row never moved money — nothing to refund.
    #
    # Refund destination follows the source: if the withdrawal was
    # tagged with `account_id` (wallet-bound source) re-credit that
    # account. Otherwise refund the user's main_wallet_balance
    # (legacy behaviour).
    if (withdrawal.method or "") == "wallet_connect":
        if withdrawal.account_id:
            acc_q = await db.execute(
                select(TradingAccount).where(
                    TradingAccount.id == withdrawal.account_id
                ).with_for_update()
            )
            acc = acc_q.scalar_one_or_none()
            if acc is not None:
                amt = Decimal(str(withdrawal.amount))
                acc.balance = (acc.balance or Decimal("0")) + amt
                acc.equity = (acc.equity or Decimal("0")) + amt
                acc.free_margin = (acc.free_margin or Decimal("0")) + amt
                db.add(
                    Transaction(
                        user_id=withdrawal.user_id,
                        account_id=acc.id,
                        type="withdrawal_refund",
                        amount=amt,
                        balance_after=acc.balance,
                        reference_id=withdrawal.id,
                        description="Withdrawal rejected — wallet account refunded",
                        created_by=admin_id,
                    )
                )
        else:
            uw = await db.execute(
                select(User).where(User.id == withdrawal.user_id).with_for_update()
            )
            user_row = uw.scalar_one_or_none()
            if user_row:
                user_row.main_wallet_balance = (
                    Decimal(str(user_row.main_wallet_balance or 0)) + Decimal(str(withdrawal.amount))
                )
                db.add(
                    Transaction(
                        user_id=withdrawal.user_id,
                        account_id=None,
                        type="withdrawal_refund",
                        amount=Decimal(str(withdrawal.amount)),
                        balance_after=user_row.main_wallet_balance,
                        reference_id=withdrawal.id,
                        description="Withdrawal rejected — main wallet refunded",
                        created_by=admin_id,
                    )
                )

    withdrawal.status = "rejected"
    withdrawal.rejection_reason = reason
    withdrawal.approved_by = admin_id
    withdrawal.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_withdrawal", "withdrawal", withdrawal_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal not approved",
        message=f"Your withdrawal request of ${float(withdrawal.amount):,.2f} was not approved.{extra}",
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    # Rejection email — fire-and-forget.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_withdrawal_rejected
        from packages.common.src.config import get_settings as _gs
        u = (await db.execute(select(User).where(User.id == withdrawal.user_id))).scalar_one_or_none()
        if smtp_configured() and u and u.email:
            await apply_email_brand(db, u)
            subject, html, text = render_withdrawal_rejected(
                first_name=u.first_name,
                amount=withdrawal.amount,
                currency="USD",
                reason=reason_str or None,
                request_id=str(withdrawal.id),
                trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisscresta.com"),
            )
            fire_and_forget(send_email(u.email, subject, html, text=text))
    except Exception as _e:
        import logging as _logging
        _logging.getLogger("admin.withdraw").warning("withdrawal reject email failed: %s", _e)
    return {"message": "Withdrawal rejected"}


async def mark_withdrawal_paid(
    withdrawal_id: uuid.UUID,
    tx_hash: str,
    notes: str | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Record an off-platform payout. Admin calls this after they have
    actually sent the funds (signed an on-chain tx, made a bank
    transfer, etc.) and pastes the tx hash / reference.

    The Withdrawal row must already be in status='approved' (balance
    debited). This flips status to 'paid' and stamps crypto_tx_hash +
    completed_at so the user sees an explorer-linkable hash in their
    transaction history.
    """
    tx_hash = (tx_hash or "").strip()
    if not tx_hash:
        raise HTTPException(status_code=400, detail="tx_hash is required")

    result = await db.execute(
        select(Withdrawal).where(Withdrawal.id == withdrawal_id).with_for_update()
    )
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Withdrawal must be 'approved' before marking paid (current: {withdrawal.status})",
        )

    withdrawal.crypto_tx_hash = tx_hash
    withdrawal.status = "paid"
    withdrawal.completed_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "mark_withdrawal_paid", "withdrawal", withdrawal_id,
        new_values={"tx_hash": tx_hash, "status": "paid", "notes": notes or ""},
        ip_address=ip_address,
    )

    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal paid",
        message=(
            f"Your withdrawal of ${float(withdrawal.amount):,.2f} has been sent. "
            f"Reference: {tx_hash}"
        ),
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()

    # Payout email — fire-and-forget. Falls back to a plain email if no
    # dedicated template exists for paid withdrawals yet.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        u = (await db.execute(select(User).where(User.id == withdrawal.user_id))).scalar_one_or_none()
        if smtp_configured() and u and u.email:
            subject = f"Your withdrawal of ${float(withdrawal.amount):,.2f} has been paid"
            html = (
                f"<p>Hi {u.first_name or 'Trader'},</p>"
                f"<p>Your withdrawal request has been processed and the funds have been sent.</p>"
                f"<ul>"
                f"<li><strong>Amount:</strong> ${float(withdrawal.amount):,.2f}</li>"
                f"<li><strong>Method:</strong> {withdrawal.method or 'manual'}</li>"
                f"<li><strong>Reference / TX:</strong> {tx_hash}</li>"
                f"</ul>"
                f"<p>If you don't see the funds within the expected confirmation window, "
                f"contact support and quote request ID {withdrawal.id}.</p>"
            )
            text = (
                f"Your withdrawal of ${float(withdrawal.amount):,.2f} has been sent.\n"
                f"Reference / TX: {tx_hash}\n"
                f"Request ID: {withdrawal.id}\n"
            )
            fire_and_forget(send_email(u.email, subject, html, text=text))
    except Exception as _e:
        import logging as _logging
        _logging.getLogger("admin.withdraw").warning("withdrawal paid email failed: %s", _e)

    return {"message": "Withdrawal marked as paid", "tx_hash": tx_hash}


def _uploads_root() -> Path:
    from packages.common.src.config import get_settings
    # e.g. WALLET_UPLOAD_ROOT=/app/uploads/wallet → base /app/uploads covers
    # wallet/, qr/, deposits/, withdrawals/ … under one confinement root.
    return Path(
        get_settings().WALLET_UPLOAD_ROOT.strip() or "uploads/wallet"
    ).resolve().parent


def _safe_upload_path(stored: str) -> Path:
    """Resolve a stored upload path, confine it strictly under the uploads root
    via the shared safe_join_under_base helper, and require a served-file type.

    SECURITY (C-ADMIN-1): deposit `screenshot_url` and withdrawal QR paths can be
    client-influenced. Passing them straight to Path()/FileResponse let a crafted
    absolute or ``..`` value make the admin server read ARBITRARY files. We reduce
    the value to its components under the uploads root and re-join them one
    segment at a time (each rejected if it contains ``/``, ``\\`` or ``..``), then
    require an allow-listed image/PDF extension; anything else is 404.
    """
    uploads_root = _uploads_root()
    raw = Path(stored)
    try:
        rel = raw.resolve().relative_to(uploads_root) if raw.is_absolute() else raw
        p = safe_join_under_base(uploads_root, *rel.parts)
    except (ValueError, PathTraversalError):
        raise HTTPException(status_code=404, detail="File not found")
    if p.suffix.lower() not in _DOWNLOAD_MEDIA_TYPES:
        raise HTTPException(status_code=404, detail="File not found")
    return p


def _serve(p: Path) -> FileResponse:
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File missing on server")
    media_type = _DOWNLOAD_MEDIA_TYPES.get(p.suffix.lower(), "application/octet-stream")
    return FileResponse(str(p), filename=p.name, media_type=media_type)


async def download_deposit_screenshot(deposit_id: uuid.UUID, db: AsyncSession):
    """Serve manual deposit proof file (same filesystem path gateway wrote)."""
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit or not deposit.screenshot_url:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return _serve(_safe_upload_path(deposit.screenshot_url))


async def download_withdrawal_payout_qr(withdrawal_id: uuid.UUID, db: AsyncSession):
    """User-uploaded QR / payout image for manual withdrawals."""
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    w = result.scalar_one_or_none()
    if not w or not w.bank_details:
        raise HTTPException(status_code=404, detail="Attachment not found")
    raw = w.bank_details.get("user_payout_qr_path") if isinstance(w.bank_details, dict) else None
    if not raw:
        raise HTTPException(status_code=404, detail="No payout QR on file")
    return _serve(_safe_upload_path(str(raw)))


async def approve_with_razorpay(
    deposit_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
    amount_override: Decimal | None = None,  # kept for backward compatibility, ignored
) -> dict:
    """Local Banking stage-2 (auto path): admin approves the request as
    "ready for Razorpay". The actual Razorpay order is NOT created here
    — the trader enters their final amount when they tap "Pay with
    Razorpay" on the deposit row, and the order is created lazily then
    (see wallet_service.create_razorpay_order_on_deposit).

    Why deferred: admin has reviewed KYC but can't always predict what
    the user will actually want to deposit. Letting the user pick the
    amount at pay time keeps the UX flexible and means an old LB row
    with amount=0 isn't stuck.

    The deposit's payment_link gets the sentinel "razorpay:awaiting"
    so the trader UI knows to render the amount-entry + Razorpay
    launcher instead of an external URL.
    """
    _ = amount_override  # unused — see docstring
    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id).with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.method != "local_banking":
        raise HTTPException(
            status_code=400,
            detail="Razorpay auto-approval only applies to local-banking requests",
        )
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.payment_link = "razorpay:awaiting"

    user_row = (
        await db.execute(select(User).where(User.id == deposit.user_id))
    ).scalar_one_or_none()

    await create_notification(
        db, deposit.user_id,
        title="Deposit approved — pay now",
        message=(
            "Your local banking request was approved. Open Funds, enter "
            "your amount, and pay via Razorpay."
        ),
        notif_type="deposit",
        action_url="/wallet?tab=deposit",
        commit=False,
    )

    await write_audit_log(
        db, admin_id, "approve_local_banking_with_razorpay", "deposit", deposit_id,
        old_values={"payment_link": None},
        new_values={"payment_link": "razorpay:awaiting"},
        ip_address=ip_address,
    )

    await db.commit()

    return {
        "deposit_id": str(deposit.id),
        "message": "Approved — the user can now enter an amount and pay via Razorpay.",
    }
