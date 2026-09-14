"""USD value of one unit of a currency, for converting cross-pair P&L.

Position P&L comes out in the instrument's quote currency. For EURJPY that is
yen, for GER40 euros, for UK100 pounds. quote_to_account_pnl could only convert
when one side of the symbol was USD, and booked every other figure as dollars
unchanged, so a 1.00 move on a lot of EURJPY read as $100,000 instead of ~$670.

Rates come from the platform's own live quotes (EURUSD, USDJPY, ...) already in
Redis, refreshed every couple of seconds into a process-local table so the P&L
helper can stay synchronous. Each service process keeps its own table and starts
the refresher lazily on first use; services also warm it at startup.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

logger = logging.getLogger("fx_rates")

REFRESH_SEC = 2.0

# Currencies that can appear as a quote currency on this platform. A currency
# is only convertible if one of <CCY>USD / USD<CCY> is actually quoted.
CURRENCIES = (
    "EUR", "GBP", "AUD", "NZD", "JPY", "CAD", "CHF", "HKD", "SGD", "CNH", "CNY",
    "THB", "TRY", "RUB", "MXN", "ZAR", "SEK", "NOK", "DKK", "PLN", "INR", "TWD",
    "MYR", "KRW", "BRL",
)

_rates: dict[str, float] = {"USD": 1.0}
_task: Optional[asyncio.Task] = None


def _mid(raw: Optional[str]) -> float:
    if not raw:
        return 0.0
    try:
        d = json.loads(raw)
        return (float(d["bid"]) + float(d["ask"])) / 2.0
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return 0.0


async def refresh_once() -> None:
    from .redis_client import PriceChannel, redis_client

    keys: list[str] = []
    for c in CURRENCIES:
        keys.append(PriceChannel.tick_key(f"{c}USD"))
        keys.append(PriceChannel.tick_key(f"USD{c}"))
    values = await redis_client.mget(keys)
    for i, c in enumerate(CURRENCIES):
        direct = _mid(values[2 * i])
        inverse = _mid(values[2 * i + 1])
        if direct > 0:
            _rates[c] = direct
        elif inverse > 0:
            _rates[c] = 1.0 / inverse


async def _loop() -> None:
    while True:
        try:
            await refresh_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.debug("fx rate refresh failed: %s", exc)
        await asyncio.sleep(REFRESH_SEC)


def ensure_started() -> None:
    """Start the refresher in the running event loop, once per process."""
    global _task
    if _task is not None and not _task.done():
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    _task = loop.create_task(_loop(), name="fx_rates")


async def start() -> None:
    """Load rates now and keep them fresh. Call from service startup."""
    try:
        await refresh_once()
    except Exception as exc:  # noqa: BLE001
        logger.warning("fx rate warm-up failed: %s", exc)
    ensure_started()


def usd_per(currency: str) -> Optional[float]:
    """USD per one unit of ``currency``, or None if it is not quoted."""
    ensure_started()
    return _rates.get((currency or "").upper())
