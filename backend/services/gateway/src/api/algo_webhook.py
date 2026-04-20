"""Algo Bot Webhook — Receives trading signals from external algo bots.

Endpoint: POST /api/algo/signal
Auth: X-Algo-Secret header must match ALGO_WEBHOOK_SECRET env var or DB-stored secret.

Flow:
  1. Bot sends signal (BUY/SELL/CLOSE + symbol + volume)
  2. Signal saved to algo_signals table
  3. If ALGO_AUTO_EXECUTE → immediately execute on algo-enabled master accounts
  4. If manual mode → signal stays PENDING until admin approves
"""
import logging
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import select
from typing import Optional

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import AlgoSignal, SystemSetting
from packages.common.src.algo_executor import execute_signal

logger = logging.getLogger("algo_webhook")
router = APIRouter()


class AlgoSignalRequest(BaseModel):
    action: str = Field(..., pattern="^(BUY|SELL|CLOSE)$")
    symbol: str
    volume: Optional[float] = None
    sl: Optional[float] = None
    tp: Optional[float] = None


async def _get_valid_secret(db) -> str:
    """Return the active webhook secret (DB-stored takes priority over .env)."""
    try:
        row = (await db.execute(
            select(SystemSetting).where(SystemSetting.key == "algo_webhook_secret")
        )).scalar_one_or_none()
        if row and row.value and row.value.get("v"):
            return row.value["v"]
    except Exception:
        pass
    return get_settings().ALGO_WEBHOOK_SECRET


@router.post("/signal")
async def receive_signal(
    body: AlgoSignalRequest,
    x_algo_secret: str = Header(default="", alias="X-Algo-Secret"),
):
    settings = get_settings()

    async with AsyncSessionLocal() as db:
        valid_secret = await _get_valid_secret(db)

        if not valid_secret:
            raise HTTPException(status_code=404, detail="Algo webhook not configured")
        if x_algo_secret != valid_secret:
            raise HTTPException(status_code=401, detail="Invalid algo secret")

        if body.action in ("BUY", "SELL") and (not body.volume or body.volume <= 0):
            raise HTTPException(status_code=400, detail="volume required for BUY/SELL")

        signal = AlgoSignal(
            action=body.action.upper(),
            symbol=body.symbol.upper(),
            volume=Decimal(str(body.volume)) if body.volume else None,
            stop_loss=Decimal(str(body.sl)) if body.sl else None,
            take_profit=Decimal(str(body.tp)) if body.tp else None,
            status="pending",
        )
        db.add(signal)
        await db.flush()
        signal_id = str(signal.id)

        if settings.ALGO_AUTO_EXECUTE:
            result = await execute_signal(signal, db)
            await db.commit()
            return {
                "signal_id": signal_id,
                "status": "executed",
                "masters_executed": result["masters_executed"],
                "details": result["details"],
            }
        else:
            await db.commit()
            logger.info("[ALGO] Signal saved (manual mode): %s %s %s", body.action, body.symbol, body.volume)
            return {
                "signal_id": signal_id,
                "status": "pending",
                "message": "Signal received. Awaiting admin approval.",
            }
