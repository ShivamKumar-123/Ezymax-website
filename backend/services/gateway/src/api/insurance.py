"""Trade Insurance API.

Quote → Activate → (passive) Settle on close. See `Trade Insurance.docx`
at the repo root and `packages/common/src/insurance/` for the engine.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db
from packages.common.src.models import (
    Instrument, Position, TradingAccount, TradeHistory,
    InsurancePolicy, InsuranceClaim,
)
from packages.common.src.schemas import (
    InsuranceActivateRequest, InsuranceActivateResponse,
    InsuranceClaimOut, InsurancePolicyOut,
    InsuranceQuoteRequest, InsuranceTierQuote,
)
from packages.common.src.insurance import quote_all_tiers, load_config
from packages.common.src.insurance.volatility import get_atr
from packages.common.src.insurance.pricing import fee_to_decimal, DURATIONS

from ..services import wallet_service, trading_service

router = APIRouter()


@router.post("/quote", response_model=list[InsuranceTierQuote])
async def quote(
    req: InsuranceQuoteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await load_config()
    if not cfg.enabled:
        raise HTTPException(status_code=409, detail="insurance_disabled")
    if cfg.news_blackout_until and datetime.now(timezone.utc) < cfg.news_blackout_until:
        raise HTTPException(status_code=409, detail="news_blackout")

    inst = (await db.execute(
        select(Instrument).where(Instrument.symbol == req.symbol.upper(), Instrument.is_active.is_(True))
    )).scalar_one_or_none()
    if inst is None:
        raise HTTPException(status_code=404, detail="instrument_not_found")

    atr = await get_atr(req.symbol)
    if atr < cfg.atr_floor:
        raise HTTPException(status_code=409, detail="vol_too_low")
    if cfg.atr_ceiling is not None and atr > cfg.atr_ceiling:
        raise HTTPException(status_code=409, detail="vol_too_high")

    # Trade-size in USD ≈ lots × contract_size × price.
    bid, ask = await trading_service.get_current_price(req.symbol)
    price = (bid + ask) / Decimal("2") if (bid and ask) else Decimal("1")
    contract_size = Decimal(str(inst.contract_size or 100000))
    trade_size_usd = float(Decimal(str(req.lots)) * contract_size * price)

    sl_distance = None
    if req.stop_loss is not None:
        sl_distance = abs(float(price - Decimal(str(req.stop_loss))))

    win_rate = await _user_win_rate(db, current_user["user_id"])

    quotes = await quote_all_tiers(
        cfg=cfg,
        leverage=float(req.leverage),
        atr=atr,
        lots=float(req.lots),
        trade_size_usd=trade_size_usd,
        has_stop_loss=req.stop_loss is not None,
        sl_distance=sl_distance,
        win_rate=win_rate,
        db=db,
        user_id=current_user["user_id"],
        duration=req.duration,
    )
    return quotes


@router.post("/activate", response_model=InsuranceActivateResponse)
async def activate(
    req: InsuranceActivateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await load_config()
    if not cfg.enabled:
        raise HTTPException(status_code=409, detail="insurance_disabled")
    if cfg.news_blackout_until and datetime.now(timezone.utc) < cfg.news_blackout_until:
        raise HTTPException(status_code=409, detail="news_blackout")

    user_id = current_user["user_id"]

    pos = (await db.execute(
        select(Position).where(Position.id == req.position_id)
    )).scalar_one_or_none()
    if pos is None:
        raise HTTPException(status_code=404, detail="position_not_found")
    if pos.status != "open":
        raise HTTPException(status_code=409, detail="position_not_open")

    # Position belongs to user?
    acct = (await db.execute(
        select(TradingAccount).where(TradingAccount.id == pos.account_id)
    )).scalar_one_or_none()
    if acct is None or acct.user_id != user_id:
        raise HTTPException(status_code=403, detail="not_your_position")

    # Already insured?
    existing = (await db.execute(
        select(InsurancePolicy).where(InsurancePolicy.position_id == pos.id)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="policy_already_exists")

    inst = (await db.execute(
        select(Instrument).where(Instrument.id == pos.instrument_id)
    )).scalar_one_or_none()
    if inst is None:
        raise HTTPException(status_code=404, detail="instrument_not_found")

    atr = await get_atr(inst.symbol)
    if atr < cfg.atr_floor:
        raise HTTPException(status_code=409, detail="vol_too_low")

    contract_size = Decimal(str(inst.contract_size or 100000))
    trade_size_usd = float(Decimal(str(pos.lots)) * contract_size * Decimal(str(pos.open_price)))

    sl_distance = None
    if pos.stop_loss is not None:
        sl_distance = abs(float(Decimal(str(pos.open_price)) - Decimal(str(pos.stop_loss))))

    win_rate = await _user_win_rate(db, user_id)

    quotes = await quote_all_tiers(
        cfg=cfg,
        leverage=float(acct.leverage or 100),
        atr=atr,
        lots=float(pos.lots),
        trade_size_usd=trade_size_usd,
        has_stop_loss=pos.stop_loss is not None,
        sl_distance=sl_distance,
        win_rate=win_rate,
        db=db,
        user_id=user_id,
        duration=req.duration,
    )

    chosen = next((q for q in quotes if q["tier"] == req.tier), None)
    if chosen is None:
        raise HTTPException(status_code=400, detail="invalid_tier")

    fee_dec = fee_to_decimal(chosen["fee"])
    # Coverage window starts at activation, not position open — the user is
    # buying protection from now.
    expires_at = datetime.now(timezone.utc) + timedelta(days=DURATIONS[req.duration])

    # Persist policy first so the FK target exists for the Transaction reference.
    import uuid as _uuid
    policy = InsurancePolicy(
        id=_uuid.uuid4(),
        user_id=user_id,
        account_id=acct.id,
        position_id=pos.id,
        instrument_id=inst.id,
        tier=req.tier,
        fee=fee_dec,
        coverage_pct=Decimal(str(chosen["coverage_pct"])),
        max_cap=Decimal(str(chosen["max_cap"])),
        risk_score=Decimal(str(chosen["risk_score"])),
        status="active",
        duration=req.duration,
        expires_at=expires_at,
    )
    db.add(policy)
    await db.flush()

    await wallet_service.charge_insurance_fee(
        db=db,
        user_id=user_id,
        amount=fee_dec,
        policy_id=policy.id,
        description=(
            f"Trade insurance — {req.tier.title()} tier on {inst.symbol} "
            f"({float(pos.lots):.2f} lots)"
        ),
    )
    await db.commit()

    return InsuranceActivateResponse(
        policy_id=policy.id, fee_charged=fee_dec, status="active",
        duration=req.duration, expires_at=expires_at,
    )


@router.get("/active", response_model=list[InsurancePolicyOut])
async def list_active(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _list_policies(db, current_user["user_id"], statuses=("active",))


@router.get("/policies", response_model=list[InsurancePolicyOut])
async def list_policies(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _list_policies(db, current_user["user_id"], statuses=None, limit=limit)


@router.get("/claims", response_model=list[InsuranceClaimOut])
async def list_claims(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(InsuranceClaim)
        .where(InsuranceClaim.user_id == current_user["user_id"])
        .order_by(desc(InsuranceClaim.paid_at))
        .limit(max(1, min(limit, 200)))
    )).scalars().all()
    return [
        InsuranceClaimOut(
            id=c.id,
            policy_id=c.policy_id,
            loss_amount=c.loss_amount,
            claim_amount=c.claim_amount,
            paid_at=c.paid_at,
        )
        for c in rows
    ]


# ─────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────

async def _list_policies(
    db: AsyncSession, user_id: UUID, *, statuses: tuple[str, ...] | None = None, limit: int = 50,
) -> list[InsurancePolicyOut]:
    stmt = (
        select(InsurancePolicy, Instrument.symbol)
        .join(Instrument, Instrument.id == InsurancePolicy.instrument_id)
        .where(InsurancePolicy.user_id == user_id)
        .order_by(desc(InsurancePolicy.activated_at))
        .limit(max(1, min(limit, 200)))
    )
    if statuses:
        stmt = stmt.where(InsurancePolicy.status.in_(statuses))
    rows = (await db.execute(stmt)).all()
    return [
        InsurancePolicyOut(
            id=p.id,
            position_id=p.position_id,
            instrument_symbol=symbol,
            tier=p.tier,
            fee=p.fee,
            coverage_pct=p.coverage_pct,
            max_cap=p.max_cap,
            status=p.status,
            duration=p.duration or "1d",
            expires_at=p.expires_at,
            activated_at=p.activated_at,
            settled_at=p.settled_at,
        )
        for (p, symbol) in rows
    ]


async def _user_win_rate(db: AsyncSession, user_id: UUID) -> float:
    """Recent win-rate over the user's last 50 closed trades. 0.0 if no history."""
    rows = (await db.execute(
        select(TradeHistory.profit)
        .join(TradingAccount, TradingAccount.id == TradeHistory.account_id)
        .where(TradingAccount.user_id == user_id)
        .order_by(desc(TradeHistory.closed_at))
        .limit(50)
    )).scalars().all()
    if not rows:
        return 0.0
    wins = sum(1 for p in rows if (p or 0) > 0)
    return wins / len(rows)
