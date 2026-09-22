"""Shared rate-limiting helpers.

Lifted out of ``services/gateway/src/services/auth_service.py`` so the
admin API can throttle its own login / sensitive endpoints with the same
sliding-window + Redis cross-process semantics. Anything that needs an
HTTP-bound rate limit should depend on this module instead of redefining
its own bucket.

Local in-memory buckets are per-process; the Redis pipeline is best-
effort cross-process sync (multi-worker / multi-pod deployments rely on
it for cluster-wide counting). A Redis blip never makes the request
slower than the local check.
"""
from __future__ import annotations

import asyncio
import ipaddress
from time import monotonic

from fastapi import HTTPException, Request


# ─── IP helpers ──────────────────────────────────────────────────────────

_TRUSTED_NETS_CACHE: list | None = None
_TRUSTED_NETS_RAW: str | None = None


def _parse_one_ip(raw: str) -> str | None:
    h = raw.strip()
    if not h:
        return None
    if "," in h:
        h = h.split(",")[0].strip()
    if h.startswith("[") and "]" in h:
        h = h[1 : h.index("]")]
    if "%" in h:
        h = h.split("%", 1)[0]
    try:
        ipaddress.ip_address(h)
        return h
    except ValueError:
        return None


def _trusted_proxy_networks() -> list:
    """Parse TRUSTED_PROXY_CIDRS into ip_network objects (cached per settings)."""
    global _TRUSTED_NETS_CACHE, _TRUSTED_NETS_RAW
    try:
        from packages.common.src.config import get_settings
        raw = get_settings().TRUSTED_PROXY_CIDRS or ""
    except Exception:
        raw = ""
    if raw == _TRUSTED_NETS_RAW and _TRUSTED_NETS_CACHE is not None:
        return _TRUSTED_NETS_CACHE
    nets = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            nets.append(ipaddress.ip_network(chunk, strict=False))
        except ValueError:
            continue
    _TRUSTED_NETS_RAW = raw
    _TRUSTED_NETS_CACHE = nets
    return nets


def _is_trusted_proxy(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in _trusted_proxy_networks())


def client_ip_for_inet(request: Request) -> str | None:
    """Return the real client IP as a value PostgreSQL INET accepts, or None.

    SECURITY (H-AUTH-1): the client controls the LEFTMOST X-Forwarded-For entries
    (nginx appends the real peer via $proxy_add_x_forwarded_for), so trusting the
    first entry let an attacker spoof their IP and bypass per-IP rate limits (and
    forge audit-log IPs). We prefer Cloudflare's CF-Connecting-IP (the edge
    overwrites any client value), then walk X-Forwarded-For from the RIGHT and
    return the last hop that is NOT one of our own proxies (TRUSTED_PROXY_CIDRS)
    — the genuine client. A single trusted rightmost hop still resolves to the
    entry to its left, and a fully-trusted chain falls back to the direct peer.
    """
    cf = request.headers.get("cf-connecting-ip") or request.headers.get("CF-Connecting-IP")
    got = _parse_one_ip(cf) if cf else None
    if got:
        return got
    ff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if ff:
        parts = [_parse_one_ip(p) for p in ff.split(",")]
        parts = [p for p in parts if p]
        # Walk right→left, skipping our own proxy hops; first non-trusted = client.
        for ip in reversed(parts):
            if not _is_trusted_proxy(ip):
                return ip
        # Whole chain is trusted proxies (e.g. single nginx hop) → leftmost entry
        # is the closest to the client we have.
        if parts:
            return parts[0]
    host = request.client.host if request.client else None
    return _parse_one_ip(str(host)) if host else None


# ─── Sliding-window rate limit ───────────────────────────────────────────

_LOCAL_RATE_BUCKETS: dict[str, list[float]] = {}

# The bucket dict is keyed by (bucket, client IP) and grows with every
# distinct IP that ever hits a rate-limited endpoint — an unbounded,
# never-GC'd leak. Sweep expired buckets opportunistically: cheap (a dict
# scan), amortized over many requests, and safe because an empty/expired
# bucket carries no rate-limit state worth keeping.
_GC_EVERY = 2048  # sweep once per this many rate_limit_http calls
_gc_counter = 0
_MAX_WINDOW_HINT = 3600.0  # longest window currently used (register: 1h)


def _maybe_gc(now: float) -> None:
    global _gc_counter
    _gc_counter += 1
    if _gc_counter % _GC_EVERY:
        return
    stale_floor = now - _MAX_WINDOW_HINT
    for k in [k for k, arr in _LOCAL_RATE_BUCKETS.items()
              if not arr or arr[-1] < stale_floor]:
        _LOCAL_RATE_BUCKETS.pop(k, None)


def rate_limit_http(
    request: Request,
    bucket: str,
    max_requests: int,
    window_sec: float,
) -> None:
    """Sliding-window rate limit, scoped to (bucket, client IP).

    Raises ``HTTPException(429)`` when the cap is exceeded. Whitelisting
    is by IP; if ``client_ip_for_inet`` returns None (e.g. unit test
    request with no client) the bucket is keyed on the bucket name alone.
    """
    ip = client_ip_for_inet(request) or "anon"
    key = f"rl:{bucket}:{ip}"
    now = monotonic()
    floor = now - window_sec
    _maybe_gc(now)

    # Local fallback path. Trim, count, decide. Cheap.
    arr = _LOCAL_RATE_BUCKETS.setdefault(key, [])
    while arr and arr[0] < floor:
        arr.pop(0)
    if len(arr) >= max_requests:
        retry_after = max(1, int(arr[0] + window_sec - now))
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests — retry after {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
    arr.append(now)

    # Best-effort Redis cross-process sync — fire-and-forget so a Redis
    # blip never makes the request slower than it already is.
    try:
        from packages.common.src.redis_client import redis_client

        async def _sync() -> None:
            try:
                pipe = redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, floor)
                pipe.zadd(key, {f"{now}:{ip}": now})
                pipe.zcard(key)
                pipe.expire(key, int(window_sec) + 5)
                _, _, count, _ = await pipe.execute()
                if count > max_requests:
                    # Cross-process counter saw too many — bump the local
                    # bucket so the next request from this pod also fails
                    # without re-querying Redis.
                    _LOCAL_RATE_BUCKETS[key] = [now] * max_requests
            except Exception:
                pass

        try:
            asyncio.create_task(_sync())
        except RuntimeError:
            pass
    except Exception:
        pass
