"""AI Strategy Builder — service layer.

Natural-language prompt → Claude (structured output, validated Pydantic DSL)
→ save → backtest against ohlc_bars history → deploy onto any of the user's
trading accounts. The LLM can only ever emit the declarative DSL — it never
generates code, and live execution goes through the canonical
trading_service paths (see engines/ai_strategy_engine.py).
"""
from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.models import (
    AIStrategy, AIStrategyBacktest, AIStrategyInstance, AIStrategyTrade,
    Instrument, Position, TradingAccount,
)
from packages.common.src.bars_store import TF_SECONDS, read_bars
from packages.common.src.strategy_dsl import StrategyDSL
from packages.common.src.strategy_backtest import run_backtest

logger = logging.getLogger("ai_strategy")

MAX_STRATEGIES_PER_USER = 50
MAX_RUNNING_INSTANCES_PER_USER = 10
EQUITY_CURVE_MAX_POINTS = 1000
BACKTEST_TRADES_MAX = 200


# ─── DSL validation helper ───────────────────────────────────────────────

def parse_dsl(raw: dict) -> StrategyDSL:
    try:
        return StrategyDSL.model_validate(raw)
    except ValidationError as e:
        first = e.errors()[0] if e.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ()))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid strategy DSL at '{loc}': {first.get('msg', 'invalid')}",
        )


async def _validate_symbol(db: AsyncSession, symbol: str) -> Instrument:
    inst = (await db.execute(
        select(Instrument).where(
            Instrument.symbol == symbol.upper(), Instrument.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if not inst:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown or inactive instrument '{symbol}' in strategy DSL",
        )
    return inst


# ─── AI generation (Claude structured output) ─────────────────────────────

class GeneratedStrategy(BaseModel):
    """Structured output the model must produce — nothing else is accepted.

    The DSL travels as a JSON-encoded STRING, not a typed sub-schema: the
    full StrategyDSL schema (nested operand unions) exceeds the structured-
    outputs complexity limit ("Schema is too complex", after a ~3-minute
    server-side compile attempt). The string is parsed and validated against
    StrategyDSL server-side, with one automatic repair round on failure —
    same guarantees, none of the schema-compile pathology.
    """
    reply: str = Field(description=(
        "Conversational reply to the trader: explain what the strategy does "
        "(or what you changed on a refinement) in 2-5 plain sentences. "
        "No JSON here."
    ))
    name: Optional[str] = Field(default=None, description="Short strategy name, max 60 chars")
    description: Optional[str] = Field(
        default=None, description="1-2 sentence plain-English summary of the rules")
    dsl_json: Optional[str] = Field(default=None, description=(
        "The full strategy configuration as ONE JSON object serialized to a "
        "string, exactly following the DSL semantics from the system prompt. "
        "Provide it whenever the user's message describes or refines a "
        "strategy; omit only when you are asking a clarifying question."
    ))


_DSL_GUIDE = """You translate a trader's natural-language idea into a strict JSON strategy DSL.

DSL semantics:
- timeframe: one of 5m, 15m, 30m, 1h, 4h, 1d. Signals evaluate on bar CLOSE.
- direction: "long", "short", or "both". Provide entry_long and/or entry_short accordingly.
- Condition groups: {"all": [...]} means AND, {"any": [...]} means OR.
- A condition is {"left": operand, "op": op, "right": operand}.
  Ops: ">", "<", "crosses_above", "crosses_below".
  Operands:
    {"type": "indicator", "name": "...", "period": N, "source": "close|open|high|low"}
      names: sma, ema, rsi, macd, macd_signal, atr, bb_upper, bb_lower
      (macd/macd_signal use standard 12/26/9 regardless of period; bb uses 2 std dev)
    {"type": "price", "field": "close|open|high|low"}
    {"type": "const", "value": number}
- risk: {"lots", "stop_loss_pct", "take_profit_pct", "max_open_positions", "max_trades_per_day"}.
  stop_loss_pct / take_profit_pct are PERCENT OF ENTRY PRICE (e.g. 0.5 = 0.5%).
  If the user speaks in pips, convert sensibly (for a typical FX pair ~1.1000,
  30 pips ≈ 0.27%; for XAUUSD ~2400, $10 ≈ 0.42%). Always set a stop_loss_pct
  unless the user gives explicit exit conditions AND refuses a stop.
- exit_long / exit_short are optional rule-based exits on top of SL/TP.

Rules:
- Pick the symbol from the available instruments list; if the user's asset
  isn't listed, choose the closest match and say so in the description.
- Be faithful to the user's idea; where the idea is vague, choose standard
  parameter values (e.g. RSI 14 with 30/70, EMA 20/50) and keep risk modest
  (lots 0.01-0.1, stop 0.5-2%).
- Default max_open_positions 1 and max_trades_per_day 10 unless asked.
- Output: put the configuration in the dsl_json field as ONE JSON object
  serialized to a string (no markdown fences, no comments)."""


MAX_CHAT_HISTORY = 20


async def generate_from_prompt(
    prompt: str, db: AsyncSession,
    previous_dsl: Optional[dict] = None,
    history: Optional[list[dict]] = None,
) -> dict:
    """One chat turn of the AI Strategy Maker.

    First call: `previous_dsl`/`history` empty → fresh generation.
    Refinement: the client passes the running conversation plus the current
    config; the model edits that config instead of starting over.
    """
    st = get_settings()
    if not st.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI generation is not configured on this server "
                "(ANTHROPIC_API_KEY is unset). You can still build the "
                "strategy manually in the JSON editor and backtest it."
            ),
        )
    prompt = (prompt or "").strip()
    if len(prompt) < 3:
        raise HTTPException(status_code=400, detail="Describe your strategy in a bit more detail")
    if len(prompt) > 4000:
        raise HTTPException(status_code=400, detail="Prompt too long (max 4000 characters)")

    symbols = (await db.execute(
        select(Instrument.symbol).where(Instrument.is_active == True)  # noqa: E712
        .order_by(Instrument.symbol)
    )).scalars().all()

    # Rebuild the conversation: prior turns (text only, capped), then — on a
    # refinement — the current config injected right before the new prompt so
    # the model edits rather than reinvents.
    messages: list[dict] = []
    for turn in (history or [])[-MAX_CHAT_HISTORY:]:
        role = turn.get("role")
        content = str(turn.get("content") or "").strip()[:4000]
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    # The API requires the first message to be a user turn.
    while messages and messages[0]["role"] != "user":
        messages.pop(0)

    user_content = prompt
    if previous_dsl is not None:
        try:
            current = parse_dsl(previous_dsl)  # never feed the model an invalid config
            import json as _json
            user_content = (
                "Current strategy configuration:\n"
                f"{_json.dumps(current.model_dump(exclude_none=True), indent=1)}\n\n"
                f"Refinement request: {prompt}\n"
                "Apply the request to the configuration above — change only "
                "what the request implies, keep everything else as-is, and "
                "return the full updated configuration."
            )
        except HTTPException:
            pass  # invalid previous config → treat as a fresh generation
    messages.append({"role": "user", "content": user_content})

    import json as _json

    import anthropic

    system = [
        {"type": "text", "text": _DSL_GUIDE, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "Available instruments: " + ", ".join(symbols)},
    ]

    async def _one_turn(client, msgs):
        try:
            return await client.messages.parse(
                model=st.AI_STRATEGY_MODEL,
                max_tokens=10000,
                # Keep p95 inside the browser's request window — DSL
                # generation is a well-specified task; medium is plenty.
                output_config={"effort": "medium"},
                system=system,
                messages=msgs,
                output_format=GeneratedStrategy,
            )
        except anthropic.RateLimitError:
            raise HTTPException(status_code=503, detail="AI service is busy — try again in a minute")
        except anthropic.APIStatusError as e:
            logger.error("AI generation failed (%s): %s", e.status_code, e.message)
            raise HTTPException(status_code=502, detail="AI generation failed — try again")
        except anthropic.APIConnectionError:
            raise HTTPException(status_code=503, detail="AI service unreachable — try again")

    def _try_parse_dsl(raw_json: Optional[str]):
        """Returns (StrategyDSL|None, error_message|None)."""
        if not raw_json:
            return None, None
        try:
            data = _json.loads(raw_json)
        except ValueError as e:
            return None, f"dsl_json is not valid JSON: {e}"
        try:
            return StrategyDSL.model_validate(data), None
        except ValidationError as e:
            lines = [
                f"- {'.'.join(str(p) for p in err.get('loc', ()))}: {err.get('msg')}"
                for err in e.errors()[:5]
            ]
            return None, "dsl_json failed validation:\n" + "\n".join(lines)

    client = anthropic.AsyncAnthropic(api_key=st.ANTHROPIC_API_KEY)
    try:
        response = await _one_turn(client, messages)
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise HTTPException(
                status_code=400,
                detail="The AI couldn't turn that into a strategy — rephrase your idea",
            )
        generated: GeneratedStrategy = response.parsed_output
        dsl, err = _try_parse_dsl(generated.dsl_json)

        # One automatic repair round: feed the validation errors back so the
        # model corrects its own output instead of surfacing them to the user.
        if err is not None:
            logger.warning("AI dsl_json invalid, repairing: %s", err.splitlines()[0])
            repair_messages = messages + [
                {"role": "assistant", "content": generated.reply},
                {"role": "user", "content": (
                    f"Your dsl_json had problems:\n{err}\n"
                    "Return the corrected full configuration in dsl_json."
                )},
            ]
            response = await _one_turn(client, repair_messages)
            if response.parsed_output is not None:
                generated = response.parsed_output
                dsl, err = _try_parse_dsl(generated.dsl_json)
            if err is not None or dsl is None:
                raise HTTPException(
                    status_code=400,
                    detail="The AI couldn't produce a valid strategy — rephrase your idea",
                )
    finally:
        await client.close()

    out: dict = {
        "reply": generated.reply,
        "name": (generated.name or "")[:120] or None,
        "description": generated.description,
        "dsl": None,
    }
    if dsl is not None:
        # Server-side re-validation: symbol must be tradeable here.
        await _validate_symbol(db, dsl.symbol)
        out["dsl"] = dsl.model_dump(exclude_none=True)
    return out


# ─── CRUD ─────────────────────────────────────────────────────────────────

def _strategy_out(s: AIStrategy, running: int = 0) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "symbol": (s.dsl or {}).get("symbol"),
        "timeframe": (s.dsl or {}).get("timeframe"),
        "status": s.status,
        "running_instances": running,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


async def create_strategy(
    user_id: UUID, name: str, dsl_raw: dict,
    description: Optional[str], prompt: Optional[str], db: AsyncSession,
    explanation: Optional[str] = None,
) -> dict:
    dsl = parse_dsl(dsl_raw)
    await _validate_symbol(db, dsl.symbol)
    count = (await db.execute(
        select(func.count(AIStrategy.id)).where(AIStrategy.user_id == user_id)
    )).scalar() or 0
    if count >= MAX_STRATEGIES_PER_USER:
        raise HTTPException(status_code=400, detail=f"Strategy limit reached ({MAX_STRATEGIES_PER_USER})")
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    s = AIStrategy(
        user_id=user_id, name=name[:120], description=description,
        prompt=prompt, explanation=explanation,
        dsl=dsl.model_dump(exclude_none=True), status="draft",
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _strategy_out(s)


async def _get_owned(strategy_id: UUID, user_id: UUID, db: AsyncSession) -> AIStrategy:
    s = (await db.execute(
        select(AIStrategy).where(AIStrategy.id == strategy_id, AIStrategy.user_id == user_id)
    )).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return s


async def list_strategies(user_id: UUID, db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(AIStrategy).where(AIStrategy.user_id == user_id)
        .order_by(AIStrategy.updated_at.desc())
    )).scalars().all()
    counts = dict((await db.execute(
        select(AIStrategyInstance.strategy_id, func.count(AIStrategyInstance.id))
        .where(AIStrategyInstance.user_id == user_id, AIStrategyInstance.status == "running")
        .group_by(AIStrategyInstance.strategy_id)
    )).all())
    # Latest backtest per strategy → ROI / win-rate for the "My strategies"
    # cards without N detail round-trips.
    latest: dict = {}
    bts = (await db.execute(
        select(AIStrategyBacktest.strategy_id, AIStrategyBacktest.stats, AIStrategyBacktest.created_at)
        .where(AIStrategyBacktest.user_id == user_id)
        .order_by(AIStrategyBacktest.created_at.desc())
    )).all()
    for sid, stats, created in bts:
        if sid not in latest:
            latest[sid] = (stats or {}, created)
    out = []
    for s in rows:
        d = _strategy_out(s, counts.get(s.id, 0))
        st, created = latest.get(s.id, ({}, None))
        d["latest_return_pct"] = st.get("return_pct")
        d["latest_win_rate"] = st.get("win_rate")
        d["latest_total_trades"] = st.get("total_trades")
        d["latest_backtest_at"] = created.isoformat() if created else None
        out.append(d)
    return out


async def get_strategy(strategy_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    s = await _get_owned(strategy_id, user_id, db)
    latest_bt = (await db.execute(
        select(AIStrategyBacktest).where(AIStrategyBacktest.strategy_id == s.id)
        .order_by(AIStrategyBacktest.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    running = (await db.execute(
        select(func.count(AIStrategyInstance.id)).where(
            AIStrategyInstance.strategy_id == s.id,
            AIStrategyInstance.status == "running",
        )
    )).scalar() or 0
    out = _strategy_out(s, running)
    out["prompt"] = s.prompt
    out["explanation"] = s.explanation
    out["dsl"] = s.dsl
    out["latest_backtest"] = None
    if latest_bt:
        out["latest_backtest"] = {
            "stats": latest_bt.stats,
            "equity_curve": latest_bt.equity_curve,
            "created_at": latest_bt.created_at.isoformat() if latest_bt.created_at else None,
        }
    return out


async def update_strategy(
    strategy_id: UUID, user_id: UUID, db: AsyncSession,
    name: Optional[str] = None, description: Optional[str] = None,
    dsl_raw: Optional[dict] = None,
) -> dict:
    s = await _get_owned(strategy_id, user_id, db)
    if dsl_raw is not None:
        dsl = parse_dsl(dsl_raw)
        await _validate_symbol(db, dsl.symbol)
        running = (await db.execute(
            select(func.count(AIStrategyInstance.id)).where(
                AIStrategyInstance.strategy_id == s.id,
                AIStrategyInstance.status == "running",
            )
        )).scalar() or 0
        if running:
            raise HTTPException(
                status_code=400,
                detail="Stop running instances before editing the rules "
                       "(instances keep trading their deployed snapshot)",
            )
        s.dsl = dsl.model_dump(exclude_none=True)
    if name is not None and name.strip():
        s.name = name.strip()[:120]
    if description is not None:
        s.description = description
    await db.commit()
    await db.refresh(s)
    return _strategy_out(s)


async def delete_strategy(strategy_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    s = await _get_owned(strategy_id, user_id, db)
    running = (await db.execute(
        select(func.count(AIStrategyInstance.id)).where(
            AIStrategyInstance.strategy_id == s.id,
            AIStrategyInstance.status == "running",
        )
    )).scalar() or 0
    if running:
        raise HTTPException(status_code=400, detail="Stop running instances first")
    await db.delete(s)
    await db.commit()
    return {"message": "Strategy deleted"}


# ─── Backtest ─────────────────────────────────────────────────────────────

def _downsample(curve: list[dict], max_points: int) -> list[dict]:
    if len(curve) <= max_points:
        return curve
    step = math.ceil(len(curve) / max_points)
    sampled = curve[::step]
    if sampled[-1] is not curve[-1]:
        sampled.append(curve[-1])
    return sampled


# H-TRADE-5: backtests are CPU-bound pure-python loops. Guard against them
# (a) blocking the event loop, (b) running unbounded, and (c) being launched in
# parallel by one user to exhaust the worker. Bars are hard-capped, the compute
# runs in a worker thread under a wall-time limit, and each user may have at most
# one backtest in flight at a time.
_BACKTEST_MAX_BARS = 20000
_BACKTEST_WALL_SECONDS = 30.0
_backtest_locks: dict[str, asyncio.Lock] = {}


async def backtest_strategy(
    strategy_id: UUID, user_id: UUID, db: AsyncSession,
    days: int = 90, commission_per_lot: float = 0.0,
) -> dict:
    if not 7 <= days <= 365:
        raise HTTPException(status_code=400, detail="days must be between 7 and 365")
    if not 0 <= commission_per_lot <= 1000:
        raise HTTPException(status_code=400, detail="commission_per_lot out of range")

    # Per-user concurrency of 1 — reject rather than queue, so a user can't pile
    # up expensive runs.
    lock = _backtest_locks.setdefault(str(user_id), asyncio.Lock())
    if lock.locked():
        raise HTTPException(
            status_code=429,
            detail="A backtest is already running for your account. Wait for it to finish.",
        )

    async with lock:
        s = await _get_owned(strategy_id, user_id, db)
        dsl = parse_dsl(s.dsl)
        inst = await _validate_symbol(db, dsl.symbol)

        tf_seconds = TF_SECONDS[dsl.timeframe]
        now = int(datetime.now(timezone.utc).timestamp())
        from_ts = now - days * 86400
        want = days * 86400 // tf_seconds + dsl.warmup_bars() + 10
        raw_bars = await read_bars(
            db, dsl.symbol, dsl.timeframe,
            from_ts=from_ts, to_ts=now, limit=min(want, _BACKTEST_MAX_BARS),
        )
        if len(raw_bars) < dsl.warmup_bars() + 10:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough {dsl.timeframe} history for {dsl.symbol} "
                    f"({len(raw_bars)} bars stored). Open the chart on this "
                    f"symbol/timeframe once to backfill history, or pick a "
                    f"shorter-period strategy."
                ),
            )

        try:
            # Offload the CPU-bound loop to a thread and cap wall time.
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    run_backtest,
                    dsl, raw_bars,
                    contract_size=float(inst.contract_size or 100000),
                    commission_per_lot=commission_per_lot,
                ),
                timeout=_BACKTEST_WALL_SECONDS,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=408,
                detail="Backtest timed out. Try a shorter period or a simpler strategy.",
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    curve = _downsample(result.equity_curve, EQUITY_CURVE_MAX_POINTS)
    trades = result.trades[-BACKTEST_TRADES_MAX:]

    bt = AIStrategyBacktest(
        strategy_id=s.id, user_id=user_id,
        params={"days": days, "commission_per_lot": commission_per_lot},
        dsl_snapshot=s.dsl, stats=result.stats,
        equity_curve=curve, trades=trades,
    )
    db.add(bt)
    await db.commit()

    return {"stats": result.stats, "equity_curve": curve, "trades": trades}


# ─── Deploy / stop instances ─────────────────────────────────────────────

def _instance_out(i: AIStrategyInstance, strategy_name: str = "",
                  account_number: str = "") -> dict:
    return {
        "id": str(i.id),
        "strategy_id": str(i.strategy_id),
        "strategy_name": strategy_name,
        "account_id": str(i.account_id),
        "account_number": account_number,
        "status": i.status,
        "trades_count": i.trades_count,
        "last_error": i.last_error,
        "started_at": i.started_at.isoformat() if i.started_at else None,
        "stopped_at": i.stopped_at.isoformat() if i.stopped_at else None,
    }


async def deploy_strategy(
    strategy_id: UUID, user_id: UUID, account_id: UUID, db: AsyncSession,
) -> dict:
    s = await _get_owned(strategy_id, user_id, db)
    dsl = parse_dsl(s.dsl)  # re-validate before anything goes live
    await _validate_symbol(db, dsl.symbol)

    # Reference-app discipline: never deploy rules that were never tested.
    has_backtest = (await db.execute(
        select(func.count(AIStrategyBacktest.id)).where(
            AIStrategyBacktest.strategy_id == s.id,
        )
    )).scalar() or 0
    if not has_backtest:
        raise HTTPException(
            status_code=400,
            detail="Run a backtest before deploying this strategy",
        )

    account = (await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id, TradingAccount.user_id == user_id,
        )
    )).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
    if not account.is_active:
        raise HTTPException(status_code=400, detail="Trading account is not active")

    running = (await db.execute(
        select(func.count(AIStrategyInstance.id)).where(
            AIStrategyInstance.user_id == user_id,
            AIStrategyInstance.status == "running",
        )
    )).scalar() or 0
    if running >= MAX_RUNNING_INSTANCES_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Running-instance limit reached ({MAX_RUNNING_INSTANCES_PER_USER})",
        )

    instance = AIStrategyInstance(
        strategy_id=s.id, user_id=user_id, account_id=account.id,
        dsl_snapshot=s.dsl, status="running",
    )
    db.add(instance)
    s.status = "active"
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This strategy is already running on that account",
        )
    await db.refresh(instance)
    return _instance_out(instance, s.name, account.account_number)


async def stop_instance(instance_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    instance = (await db.execute(
        select(AIStrategyInstance).where(
            AIStrategyInstance.id == instance_id,
            AIStrategyInstance.user_id == user_id,
        )
    )).scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    if instance.status == "running":
        instance.status = "stopped"
        instance.stopped_at = datetime.now(timezone.utc)
    # Strategy drops back to draft when nothing is running anymore.
    still_running = (await db.execute(
        select(func.count(AIStrategyInstance.id)).where(
            AIStrategyInstance.strategy_id == instance.strategy_id,
            AIStrategyInstance.status == "running",
            AIStrategyInstance.id != instance.id,
        )
    )).scalar() or 0
    if not still_running:
        strategy = await db.get(AIStrategy, instance.strategy_id)
        if strategy and strategy.status == "active":
            strategy.status = "draft"
    await db.commit()
    await db.refresh(instance)
    return _instance_out(instance)


async def list_instances(user_id: UUID, db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(AIStrategyInstance, AIStrategy.name, TradingAccount.account_number)
        .join(AIStrategy, AIStrategy.id == AIStrategyInstance.strategy_id)
        .join(TradingAccount, TradingAccount.id == AIStrategyInstance.account_id)
        .where(AIStrategyInstance.user_id == user_id)
        .order_by(AIStrategyInstance.started_at.desc())
        .limit(100)
    )).all()
    return [_instance_out(i, name, acct) for i, name, acct in rows]


# ─── AI trade views (the "displayed separately" surface) ─────────────────

async def list_ai_position_ids(user_id: UUID, db: AsyncSession) -> dict:
    ids = (await db.execute(
        select(AIStrategyTrade.position_id)
        .where(AIStrategyTrade.user_id == user_id,
               AIStrategyTrade.position_id.isnot(None))
        .order_by(AIStrategyTrade.created_at.desc())
        .limit(500)
    )).scalars().all()
    return {"position_ids": [str(p) for p in ids]}


async def list_ai_trades(user_id: UUID, status: str, db: AsyncSession) -> list[dict]:
    if status not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="status must be open or closed")
    pos_status = "open" if status == "open" else "closed"
    from sqlalchemy.orm import selectinload
    rows = (await db.execute(
        select(AIStrategyTrade, Position, AIStrategy.name)
        .join(Position, Position.id == AIStrategyTrade.position_id)
        .join(AIStrategy, AIStrategy.id == AIStrategyTrade.strategy_id)
        .options(selectinload(Position.instrument))
        .where(AIStrategyTrade.user_id == user_id, Position.status == pos_status)
        .order_by(AIStrategyTrade.created_at.desc())
        .limit(200)
    )).all()
    out = []
    for link, pos, strat_name in rows:
        out.append({
            "position_id": str(pos.id),
            "instance_id": str(link.instance_id),
            "strategy_id": str(link.strategy_id),
            "strategy_name": strat_name,
            "symbol": pos.instrument.symbol if pos.instrument else None,
            "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
            "lots": float(pos.lots),
            "open_price": float(pos.open_price),
            "close_price": float(pos.close_price) if pos.close_price else None,
            "profit": float(pos.profit) if pos.profit is not None else None,
            "opened_at": pos.created_at.isoformat() if pos.created_at else None,
            "closed_at": pos.closed_at.isoformat() if pos.closed_at else None,
        })
    return out
