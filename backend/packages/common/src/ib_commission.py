"""IB Commission distribution — shared across services.

When a referred user's trade is FILLED (market order in the gateway, or a
pending order filled by the b-book-engine), this distributes commission up
the referrer's MLM chain:

1. Find the referrer IB via the Referral table (referred_id → ib_profile_id).
2. Resolve the per-lot rate (IB custom override > plan > default plan).
3. Split it across the MLM levels and credit each IB.

Lives in packages/common so BOTH the gateway (trading_service, copy_engine)
and the standalone b-book-engine can call it — a pending/limit order that
fills in the b-book-engine must earn the IB the same commission a market
order does.

Every skip path logs WHY nothing was distributed, so "commission isn't
working" is diagnosable from the log instead of a silent return.
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Referral, IBProfile, IBCommission, IBCommissionPlan,
    TradingAccount, Transaction, SystemSetting, User,
)

logger = logging.getLogger("ib-commission")

DEFAULT_MLM_DISTRIBUTION = [40, 25, 15, 10, 10]


async def get_mlm_distribution(db: AsyncSession) -> list[int]:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_distribution")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                return DEFAULT_MLM_DISTRIBUTION
        if isinstance(val, list):
            return [int(x) for x in val]
    return DEFAULT_MLM_DISTRIBUTION


async def distribute_ib_commission(
    db: AsyncSession,
    trader_user_id: UUID,
    order_id: UUID,
    lots: Decimal,
    instrument_symbol: str,
):
    """Distribute IB commission for one filled order. Idempotency is the
    caller's responsibility (call once per fill)."""
    referral_q = await db.execute(
        select(Referral).where(Referral.referred_id == trader_user_id)
    )
    referral = referral_q.scalar_one_or_none()
    if not referral or not referral.ib_profile_id:
        logger.info(
            "IB commission skipped: trader=%s has no IB referral "
            "(no Referral row, or Referral.ib_profile_id is NULL). "
            "Commission only flows when the trader was signed up under an IB.",
            trader_user_id,
        )
        return

    ib_profile_q = await db.execute(
        select(IBProfile).where(IBProfile.id == referral.ib_profile_id, IBProfile.is_active == True)
    )
    direct_ib = ib_profile_q.scalar_one_or_none()
    if not direct_ib:
        logger.info(
            "IB commission skipped: trader=%s referred by ib_profile=%s but that "
            "IB is inactive or missing.",
            trader_user_id, referral.ib_profile_id,
        )
        return

    plan = None
    if direct_ib.commission_plan_id:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.id == direct_ib.commission_plan_id)
        )
        plan = plan_q.scalar_one_or_none()

    if not plan:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.is_default == True)
        )
        plan = plan_q.scalar_one_or_none()

    # Effective per-lot rate: direct IB's custom override beats plan; plan beats nothing.
    per_lot = None
    if direct_ib.custom_commission_per_lot is not None and direct_ib.custom_commission_per_lot > 0:
        per_lot = Decimal(str(direct_ib.custom_commission_per_lot))
    elif plan and plan.commission_per_lot is not None:
        per_lot = Decimal(str(plan.commission_per_lot))

    if per_lot is None or per_lot <= 0:
        logger.info(
            "IB commission skipped: trader=%s IB=%s has no per-lot rate > 0 "
            "(custom_commission_per_lot=%s, plan=%s, plan.commission_per_lot=%s). "
            "Set a commission_per_lot on the IB's plan (or a custom rate on the IB).",
            trader_user_id, direct_ib.referral_code,
            direct_ib.custom_commission_per_lot,
            getattr(plan, "name", None),
            getattr(plan, "commission_per_lot", None),
        )
        return

    total_commission = per_lot * lots
    if total_commission <= 0:
        logger.info(
            "IB commission skipped: computed total_commission<=0 "
            "(per_lot=%s × lots=%s) for trader=%s.",
            per_lot, lots, trader_user_id,
        )
        return

    logger.info(
        "IB commission: distributing $%.4f (per_lot=%s × %s lots) from trader=%s "
        "up the chain from IB=%s (%s)",
        float(total_commission), per_lot, lots, trader_user_id,
        direct_ib.referral_code, instrument_symbol,
    )

    # Prefer plan's MLM distribution; fall back to global SystemSetting; then default.
    mlm_dist: list[int] | None = None
    if plan and plan.mlm_distribution:
        raw = plan.mlm_distribution
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = None
        if isinstance(raw, list) and raw:
            mlm_dist = [int(x) for x in raw]
    if mlm_dist is None:
        mlm_dist = await get_mlm_distribution(db)

    current_ib = direct_ib
    for level, pct in enumerate(mlm_dist, start=1):
        if current_ib is None:
            break

        share = total_commission * Decimal(str(pct)) / Decimal("100")
        if share <= 0:
            current_ib = await _get_parent_ib(current_ib, db)
            continue

        commission_record = IBCommission(
            ib_id=current_ib.id,
            source_user_id=trader_user_id,
            source_trade_id=order_id,
            commission_type="trade_lot",
            amount=share,
            mlm_level=level,
            status="paid",
        )
        db.add(commission_record)

        current_ib.total_earned = (current_ib.total_earned or Decimal("0")) + share

        ib_account_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == current_ib.user_id,
                TradingAccount.is_demo == False,
                TradingAccount.is_active == True,
            ).limit(1)
        )
        ib_account = ib_account_q.scalar_one_or_none()
        if ib_account:
            ib_account.balance = (ib_account.balance or Decimal("0")) + share
            ib_account.equity = ib_account.balance + (ib_account.credit or Decimal("0"))
            ib_account.free_margin = ib_account.equity - (ib_account.margin_used or Decimal("0"))

            db.add(Transaction(
                user_id=current_ib.user_id,
                account_id=ib_account.id,
                type="ib_commission",
                amount=share,
                balance_after=ib_account.balance,
                description=f"IB commission L{level}: {instrument_symbol} {lots} lots",
            ))
        else:
            # No trading account — credit the IB's MAIN WALLET so the earning
            # is real and withdrawable. Previously this branch wrote only the
            # IBCommission row + total_earned and moved no money, so the
            # dashboard showed "earned" the IB could never withdraw.
            ib_user = await db.get(User, current_ib.user_id)
            if ib_user is not None:
                ib_user.main_wallet_balance = (
                    ib_user.main_wallet_balance or Decimal("0")
                ) + share
                db.add(Transaction(
                    user_id=current_ib.user_id,
                    account_id=None,
                    type="ib_commission",
                    amount=share,
                    balance_after=ib_user.main_wallet_balance,
                    description=f"IB commission L{level}: {instrument_symbol} {lots} lots (wallet)",
                ))
            else:
                logger.warning(
                    "IB commission L%d booked for IB=%s but the IB user row is "
                    "missing — total_earned updated, no balance credited.",
                    level, current_ib.referral_code,
                )

        logger.info(f"IB commission L{level}: ${share:.2f} to {current_ib.referral_code} ({instrument_symbol} {lots} lots)")

        current_ib = await _get_parent_ib(current_ib, db)


async def _get_parent_ib(ib: IBProfile, db: AsyncSession) -> IBProfile | None:
    if not ib.parent_ib_id:
        return None
    result = await db.execute(
        select(IBProfile).where(IBProfile.id == ib.parent_ib_id, IBProfile.is_active == True)
    )
    return result.scalar_one_or_none()
