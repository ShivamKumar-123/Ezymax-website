"""Admin Algo Service — manage signals, master toggles, settings."""
import secrets
from datetime import datetime, timezone

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import (
    AlgoSignal, MasterAccount, InvestorAllocation, SystemSetting,
)
from packages.common.src.algo_executor import execute_signal as _run_signal


async def list_signals(db: AsyncSession, status: str | None = None, limit: int = 50) -> list[dict]:
    q = select(AlgoSignal).order_by(desc(AlgoSignal.created_at)).limit(limit)
    if status:
        q = q.where(AlgoSignal.status == status)
    result = await db.execute(q)
    signals = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "action": s.action,
            "symbol": s.symbol,
            "volume": float(s.volume) if s.volume else None,
            "sl": float(s.stop_loss) if s.stop_loss else None,
            "tp": float(s.take_profit) if s.take_profit else None,
            "status": s.status,
            "masters_executed": s.masters_executed or 0,
            "execution_details": s.execution_details,
            "reject_reason": s.reject_reason,
            "executed_at": s.executed_at.isoformat() if s.executed_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in signals
    ]


async def execute_signal(signal_id: str, admin_user_id: str, db: AsyncSession) -> dict:
    """Admin manually executes a pending signal."""
    signal = await db.get(AlgoSignal, signal_id)
    if not signal:
        raise ValueError("Signal not found")
    if signal.status != "pending":
        raise ValueError(f"Signal already {signal.status}")

    signal.executed_by = admin_user_id
    result = await _run_signal(signal, db)
    await db.commit()
    return result


async def reject_signal(signal_id: str, admin_user_id: str, reason: str, db: AsyncSession) -> dict:
    signal = await db.get(AlgoSignal, signal_id)
    if not signal:
        raise ValueError("Signal not found")
    if signal.status != "pending":
        raise ValueError(f"Signal already {signal.status}")

    signal.status = "rejected"
    signal.executed_by = admin_user_id
    signal.executed_at = datetime.now(timezone.utc)
    signal.reject_reason = reason or "Rejected by admin"
    await db.commit()
    return {"signal_id": signal_id, "status": "rejected"}


async def list_algo_masters(db: AsyncSession) -> list[dict]:
    q = select(MasterAccount).where(
        MasterAccount.status.in_(["approved", "active"])
    ).options(selectinload(MasterAccount.user), selectinload(MasterAccount.account))
    result = await db.execute(q)
    masters = result.scalars().all()

    items = []
    for m in masters:
        inv_q = await db.execute(
            select(func.count(InvestorAllocation.id)).where(
                InvestorAllocation.master_id == m.id,
                InvestorAllocation.status == "active",
            )
        )
        active_inv = inv_q.scalar() or 0

        items.append({
            "id": str(m.id),
            "user_email": m.user.email if m.user else "",
            "user_name": " ".join(filter(None, [
                getattr(m.user, "first_name", ""),
                getattr(m.user, "last_name", ""),
            ])) if m.user else "",
            "account_number": m.account.account_number if m.account else "",
            "account_balance": float(m.account.balance or 0) if m.account else 0,
            "master_type": m.master_type or "signal_provider",
            "followers_count": m.followers_count or active_inv,
            "algo_enabled": bool(m.algo_enabled),
            "algo_volume_multiplier": float(m.algo_volume_multiplier or 1),
            "status": m.status,
        })
    return items


async def toggle_algo_master(master_id: str, enabled: bool, multiplier: float | None, db: AsyncSession) -> dict:
    master = await db.get(MasterAccount, master_id)
    if not master:
        raise ValueError("Master not found")

    master.algo_enabled = enabled
    if multiplier is not None and multiplier > 0:
        master.algo_volume_multiplier = multiplier
    await db.commit()
    return {
        "master_id": master_id,
        "algo_enabled": master.algo_enabled,
        "algo_volume_multiplier": float(master.algo_volume_multiplier or 1),
    }


async def _read_setting(db: AsyncSession, key: str) -> dict | None:
    row = (await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )).scalar_one_or_none()
    return row.value if row and row.value else None


async def _write_setting(db: AsyncSession, key: str, value: dict, desc: str, admin_id: str):
    row = (await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )).scalar_one_or_none()
    if row:
        row.value = value
        row.updated_by = admin_id
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(SystemSetting(key=key, value=value, description=desc, updated_by=admin_id))
    await db.commit()


async def get_algo_settings(db: AsyncSession) -> dict:
    from packages.common.src.config import get_settings
    s = get_settings()

    secret_data = await _read_setting(db, "algo_webhook_secret")
    stored_secret = secret_data.get("v", "") if secret_data else ""

    auto_data = await _read_setting(db, "algo_auto_execute")
    auto_execute = auto_data.get("v", s.ALGO_AUTO_EXECUTE) if auto_data else s.ALGO_AUTO_EXECUTE

    return {
        "webhook_secret": stored_secret or s.ALGO_WEBHOOK_SECRET,
        "auto_execute": bool(auto_execute),
        "webhook_url": "/api/algo/signal",
    }


async def toggle_auto_execute(enabled: bool, admin_user_id: str, db: AsyncSession) -> dict:
    await _write_setting(db, "algo_auto_execute", {"v": enabled}, "Algo auto-execute mode", admin_user_id)
    return {"auto_execute": enabled}


async def regenerate_webhook_secret(admin_user_id: str, db: AsyncSession) -> dict:
    new_secret = "algo_" + secrets.token_hex(24)
    await _write_setting(db, "algo_webhook_secret", {"v": new_secret}, "Algo bot webhook secret", admin_user_id)
    return {"webhook_secret": new_secret}


async def get_signal_stats(db: AsyncSession) -> dict:
    total_q = await db.execute(select(func.count(AlgoSignal.id)))
    pending_q = await db.execute(
        select(func.count(AlgoSignal.id)).where(AlgoSignal.status == "pending")
    )
    executed_q = await db.execute(
        select(func.count(AlgoSignal.id)).where(AlgoSignal.status == "executed")
    )
    rejected_q = await db.execute(
        select(func.count(AlgoSignal.id)).where(AlgoSignal.status == "rejected")
    )
    masters_q = await db.execute(
        select(func.count(MasterAccount.id)).where(MasterAccount.algo_enabled == True)
    )
    return {
        "total_signals": total_q.scalar() or 0,
        "pending": pending_q.scalar() or 0,
        "executed": executed_q.scalar() or 0,
        "rejected": rejected_q.scalar() or 0,
        "algo_enabled_masters": masters_q.scalar() or 0,
    }
