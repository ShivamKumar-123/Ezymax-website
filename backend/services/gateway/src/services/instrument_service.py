"""Instrument Service — Listing, market status, price retrieval."""
import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Instrument, InstrumentSegment
from packages.common.src.schemas import InstrumentResponse, TickData
from packages.common.src.redis_client import get_latest_ticks
from packages.common.src.price_cache import price_cache
from packages.common.src.cache import TTLCache
from packages.common.src.market_hours import market_status_dict


# Section F: small per-process caches for read-mostly instrument data. Busted
# on `config:instruments:reload` (gateway lifespan wires it via the hub).
_instruments_cache = TTLCache("instruments", ttl=10.0, maxsize=32)
_market_status_cache = TTLCache("market_status", ttl=5.0, maxsize=4)


async def list_instruments(
    segment: str | None, active_only: bool, db: AsyncSession,
) -> list[InstrumentResponse]:
    return await _instruments_cache.get_or_load(
        ("list", segment, bool(active_only)),
        lambda: _list_instruments_uncached(segment, active_only, db),
    )


async def _list_instruments_uncached(
    segment: str | None, active_only: bool, db: AsyncSession,
) -> list[InstrumentResponse]:
    query = select(Instrument)

    if active_only:
        query = query.where(Instrument.is_active == True)

    if segment:
        query = query.join(InstrumentSegment).where(InstrumentSegment.name == segment)

    result = await db.execute(query)
    instruments = result.scalars().all()

    return [
        InstrumentResponse(
            id=inst.id,
            symbol=inst.symbol,
            display_name=inst.display_name,
            segment=inst.segment.name if inst.segment else None,
            base_currency=inst.base_currency or (inst.symbol[:3] if inst.symbol and len(inst.symbol) >= 6 else None),
            quote_currency=inst.quote_currency or (inst.symbol[3:6] if inst.symbol and len(inst.symbol) >= 6 else None),
            digits=inst.digits,
            pip_size=inst.pip_size,
            min_lot=inst.min_lot,
            max_lot=inst.max_lot,
            lot_step=inst.lot_step,
            contract_size=inst.contract_size,
            margin_rate=inst.margin_rate,
            is_active=inst.is_active,
        )
        for inst in instruments
    ]


async def get_market_status(db: AsyncSession) -> list[dict]:
    # market_status_dict depends on wall-clock time, hence the short TTL.
    return await _market_status_cache.get_or_load(
        "all", lambda: _get_market_status_uncached(db),
    )


async def _get_market_status_uncached(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Instrument).where(Instrument.is_active == True)
    )
    instruments = result.scalars().all()
    return [
        market_status_dict(
            inst.symbol,
            inst.segment.name if inst.segment else None,
            inst.trading_hours,
        )
        for inst in instruments
    ]


async def get_symbol_market_status(symbol: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Instrument).where(
            Instrument.symbol == symbol.upper(),
            Instrument.is_active == True,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail=f"Instrument {symbol} not found")
    return market_status_dict(
        inst.symbol,
        inst.segment.name if inst.segment else None,
        inst.trading_hours,
    )


async def get_all_prices() -> list[dict]:
    """Latest quote for every symbol.

    Section F: one HGETALL of the ticks:latest hash (maintained by
    publish_price) instead of two keyspace SCANs + MGETs per call — this
    endpoint is polled sub-second by clients. The hash holds the newest
    publish per symbol, i.e. the live tick while quoting and the last-known
    price once a market closes (same result the tick:/last_price: pair gave).
    """
    latest = await get_latest_ticks()
    prices: list[dict] = []
    for v in latest.values():
        try:
            prices.append(json.loads(v))
        except (ValueError, TypeError):
            continue
    return prices


async def get_price(symbol: str) -> TickData:
    tick_data = await price_cache.get(symbol)
    if not tick_data:
        raise HTTPException(status_code=404, detail=f"No price data for {symbol}")

    data = json.loads(tick_data)
    return TickData(**data)
