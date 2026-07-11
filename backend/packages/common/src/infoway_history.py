"""Infoway historical candlestick (kline) client.

Infoway's REST history API (docs.infoway.io → Market Data → Candlestick
Real/Historical):

    POST https://data.infoway.io/common/v2/batch_kline    (forex / metals / commodities)
    POST https://data.infoway.io/crypto/v2/batch_kline     (crypto)
    header:  apiKey: <key>
    body:    { "klineType": 1..12, "klineNum": <=500, "codes": "EURUSD",
               "timestamp": <unix seconds, optional — pages older data for
                             minute/hourly> }
    resp:    { "ret": 200, "data": [ { "s": code,
               "respList": [ { "t": <unix s>, "o","h","l","c","v" } ] } ] }

Only forex/crypto/metals/commodities are covered here (what the platform
trades). Used by the one-time backfill and by the /bars self-heal path.
"""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger("infoway_history")

_BASE = "https://data.infoway.io"

# tf slug → Infoway klineType. (2h=6, 1w=9, 1M=10 exist but we don't chart them.)
_TF_TO_KLINETYPE: dict[str, int] = {
    "1m": 1, "5m": 2, "15m": 3, "30m": 4, "1h": 5, "4h": 7, "1d": 8,
}

# Crypto platform symbol → Infoway product code (Infoway quotes crypto as *USDT).
_CRYPTO_CODES: dict[str, str] = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT", "SOLUSD": "SOLUSDT",
}
# Non-crypto aliases: our symbol → Infoway code.
_ALIAS_CODES: dict[str, str] = {
    "USOIL": "XTIUSD",  # WTI crude on Infoway
}
_CRYPTO_SET = set(_CRYPTO_CODES.keys())


def _market_and_code(symbol: str) -> tuple[str, str]:
    """Return (market_segment_for_url, infoway_code) for a platform symbol."""
    s = symbol.upper()
    if s in _CRYPTO_SET:
        return "crypto", _CRYPTO_CODES[s]
    return "common", _ALIAS_CODES.get(s, s)


def infoway_supports(tf: str) -> bool:
    return tf in _TF_TO_KLINETYPE


async def fetch_infoway_klines(
    api_key: str, symbol: str, tf: str,
    count: int = 500, end_ts: int | None = None,
    client: httpx.AsyncClient | None = None,
) -> list[dict]:
    """Fetch up to `count` (<=500) bars for one symbol/tf ending at/around
    `end_ts` (unix seconds; None = most recent). Returns ascending
    [{time, open, high, low, close, volume}] (time in epoch SECONDS)."""
    kt = _TF_TO_KLINETYPE.get(tf)
    if not kt or not api_key:
        return []
    market, code = _market_and_code(symbol)
    url = f"{_BASE}/{market}/v2/batch_kline"
    body: dict = {"klineType": kt, "klineNum": min(int(count), 500), "codes": code}
    if end_ts:
        body["timestamp"] = int(end_ts)

    owns = client is None
    cl = client or httpx.AsyncClient(timeout=20.0)
    try:
        resp = await cl.post(url, headers={"apiKey": api_key, "Content-Type": "application/json"}, json=body)
        if resp.status_code != 200:
            logger.warning("Infoway kline HTTP %s for %s %s (code=%s url=%s): %s",
                           resp.status_code, symbol, tf, code, url, resp.text[:300])
            return []
        payload = resp.json()
    except Exception as e:  # network / parse
        logger.warning("Infoway kline fetch failed for %s %s (code=%s): %s", symbol, tf, code, e)
        return []
    finally:
        if owns:
            await cl.aclose()

    if not isinstance(payload, dict):
        logger.warning("Infoway kline bad payload for %s %s: %s", symbol, tf, str(payload)[:300])
        return []
    ret = payload.get("ret")
    if ret not in (200, "200", None):
        logger.warning("Infoway kline ret=%s for %s %s (code=%s): msg=%s", ret, symbol, tf, code, payload.get("msg"))
        return []
    data = payload.get("data") or []
    if not data:
        logger.warning("Infoway kline EMPTY data for %s %s (code=%s): %s", symbol, tf, code, str(payload)[:300])
        return []
    resp_list = (data[0] or {}).get("respList") or []
    if not resp_list:
        logger.warning("Infoway kline empty respList for %s %s (code=%s): %s", symbol, tf, code, str(data[0])[:300])
    out: list[dict] = []
    for c in resp_list:
        try:
            out.append({
                "time": int(c["t"]),
                "open": float(c["o"]), "high": float(c["h"]),
                "low": float(c["l"]), "close": float(c["c"]),
                "volume": float(c.get("v", 0) or 0),
            })
        except (KeyError, TypeError, ValueError):
            continue
    out.sort(key=lambda b: b["time"])
    return out


async def backfill_infoway(
    api_key: str, symbol: str, tf: str, target_bars: int,
    client: httpx.AsyncClient | None = None,
) -> list[dict]:
    """Page backwards to accumulate up to `target_bars` bars (ascending, dedup'd).

    Uses the `timestamp` cursor to walk older data. Infoway only supports the
    timestamp cursor for minute/hourly klines, so daily is capped at one 500-bar
    batch (Infoway's daily depth) — still far deeper than the old Redis window.
    """
    owns = client is None
    cl = client or httpx.AsyncClient(timeout=20.0)
    try:
        collected: dict[int, dict] = {}
        cursor: int | None = None
        pages = max(1, min(20, (target_bars // 500) + 1))
        supports_cursor = tf != "1d"  # per docs: timestamp cursor is intraday-only
        for _ in range(pages):
            batch = await fetch_infoway_klines(api_key, symbol, tf, count=500, end_ts=cursor, client=cl)
            if not batch:
                break
            new = 0
            for b in batch:
                if b["time"] not in collected:
                    collected[b["time"]] = b
                    new += 1
            if len(collected) >= target_bars or not supports_cursor or new == 0:
                break
            # Next page ends just before the oldest bar we have.
            cursor = min(b["time"] for b in batch) - 1
        return [collected[t] for t in sorted(collected.keys())]
    finally:
        if owns:
            await cl.aclose()
