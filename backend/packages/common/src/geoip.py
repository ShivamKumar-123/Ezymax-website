"""GeoIP resolution with a Postgres-backed cache.

Provider: ip-api.com free tier — no key, ~45 requests/minute/IP, HTTP
only (HTTPS is the paid tier). We never resolve the same IP twice: the
first resolution is written to ``ip_geo_cache`` and every later lookup
is a pure DB read. The gateway ``rms_engine`` is the only caller that
triggers a network resolve, and it caps how many it resolves per tick
so we stay well under the provider rate limit.

Design notes
------------
* Private / reserved / loopback IPs never hit the provider — they're
  cached with ``status='private'`` so we don't waste a request.
* A provider failure is cached with ``status='failed'`` and retried
  only after ``_RETRY_FAILED_AFTER`` so a dead IP doesn't get hammered.
* Successful rows go stale after ``_FRESH_DAYS`` (ISPs reassign IPs);
  the resolver re-fetches them.
* Nothing here raises into a caller — every path returns the cache row
  (or None). GeoIP is best-effort enrichment, never a hard dependency.
"""
from __future__ import annotations

import ipaddress
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import IpGeoCache

logger = logging.getLogger("geoip")

_PROVIDER_URL = "http://ip-api.com/json/{ip}"
# Field list keeps the response small and stable.
_FIELDS = "status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,query"

_FRESH_DAYS = 30
_RETRY_FAILED_AFTER = timedelta(hours=12)
_HTTP_TIMEOUT = 6.0


def _to_decimal(v) -> Optional[Decimal]:
    if v is None:
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError):
        return None


def _classify(ip: str) -> Optional[str]:
    """Return 'private' for IPs that should never be sent to the provider,
    else None (resolvable public IP). Bad/empty input → 'private' too so
    we skip it cheaply."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return "private"
    if (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    ):
        return "private"
    return None


def _is_fresh(row: IpGeoCache, now: datetime) -> bool:
    """True if the cached row is still usable and should not be re-fetched."""
    resolved = row.resolved_at
    if resolved is None:
        return False
    if resolved.tzinfo is None:
        resolved = resolved.replace(tzinfo=timezone.utc)
    if row.status == "resolved":
        return now - resolved < timedelta(days=_FRESH_DAYS)
    if row.status == "private":
        return True  # never changes
    # failed → retry after the backoff window
    return now - resolved < _RETRY_FAILED_AFTER


async def get_cached(db: AsyncSession, ip: str) -> Optional[IpGeoCache]:
    """Pure DB read — return the cache row for ``ip`` or None. Never
    triggers a network call. This is what the admin read path uses."""
    if not ip:
        return None
    try:
        return (
            await db.execute(select(IpGeoCache).where(IpGeoCache.ip_address == ip))
        ).scalar_one_or_none()
    except Exception:
        return None


async def resolve_ip(db: AsyncSession, ip: str, *, force: bool = False) -> Optional[IpGeoCache]:
    """Return the geo row for ``ip``, resolving via the provider if the
    cache is missing/stale. Commits its own write. Best-effort — returns
    None only if even the cache write fails."""
    if not ip:
        return None
    now = datetime.now(timezone.utc)

    row = await get_cached(db, ip)
    if row is not None and not force and _is_fresh(row, now):
        return row

    # Private / reserved → cache once, never call the provider.
    klass = _classify(ip)
    if klass == "private":
        return await _upsert(db, ip, {"status": "private"}, now)

    payload = await _fetch_from_provider(ip)
    if payload is None:
        return await _upsert(db, ip, {"status": "failed"}, now)
    return await _upsert(db, ip, payload, now)


async def _fetch_from_provider(ip: str) -> Optional[dict]:
    """One HTTP call to ip-api.com. Returns a normalised dict on success,
    None on any failure (network, non-success body, malformed)."""
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(_PROVIDER_URL.format(ip=ip), params={"fields": _FIELDS})
        if resp.status_code != 200:
            logger.warning("geoip provider HTTP %s for %s", resp.status_code, ip)
            return None
        data = resp.json()
    except Exception as exc:
        logger.warning("geoip resolve failed for %s: %s", ip, exc)
        return None

    if not isinstance(data, dict) or data.get("status") != "success":
        # ip-api returns {"status":"fail","message":"reserved range"} etc.
        return None
    return {
        "status": "resolved",
        "country": data.get("country"),
        "country_code": data.get("countryCode"),
        "region": data.get("regionName") or data.get("region"),
        "city": data.get("city"),
        "latitude": _to_decimal(data.get("lat")),
        "longitude": _to_decimal(data.get("lon")),
        "isp": data.get("isp"),
        "org": data.get("org"),
        "timezone": data.get("timezone"),
    }


async def _upsert(db: AsyncSession, ip: str, fields: dict, now: datetime) -> Optional[IpGeoCache]:
    """Insert or update the cache row for ``ip`` and commit."""
    try:
        row = await get_cached(db, ip)
        if row is None:
            row = IpGeoCache(ip_address=ip, created_at=now)
            db.add(row)
        for k, v in fields.items():
            setattr(row, k, v)
        # Make sure status is always set even on a bare insert.
        row.status = fields.get("status", "resolved")
        row.resolved_at = now
        await db.commit()
        return row
    except Exception as exc:
        logger.warning("geoip cache upsert failed for %s: %s", ip, exc)
        try:
            await db.rollback()
        except Exception:
            pass
        return None
