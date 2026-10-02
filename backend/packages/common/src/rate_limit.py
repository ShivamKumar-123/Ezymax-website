"""Shared rate-limiting helpers.

Lifted out of ``services/gateway/src/services/auth_service.py`` so the
admin API can throttle its own login / sensitive endpoints with the same
sliding-window + Redis cross-process semantics. Anything that needs an
HTTP-bound rate limit should depend on this module instead of redefining
its own bucket.

Section F (horizontal scale):

* ``rate_limit_http_async`` — **Redis-authoritative** sliding window: one Lua
  script (trim → count → admit/deny → TTL) keyed on WALL-CLOCK milliseconds,
  so every worker / replica shares one exact window. The process-local bucket
  is used only when Redis errors.
* ``rate_limit_http`` (sync, legacy signature kept for existing call sites) —
  local bucket for the immediate decision plus the same Lua script run in the
  background; a Redis "deny" marks the local bucket full so the next request
  on this process fails too. Call sites should migrate to the async variant
  for exact cluster-wide limits.
* ``incr_with_ttl`` — atomic INCR + first-hit EXPIRE for simple counters
  (OTP attempts, per-email caps …), replacing racy INCR-then-EXPIRE pairs.
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import uuid
from time import monotonic, time as wall_time

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


logger = logging.getLogger("rate_limit")

# ─── Sliding-window rate limit ───────────────────────────────────────────

# KEYS[1]=zset  ARGV[1]=now_ms ARGV[2]=window_ms ARGV[3]=max ARGV[4]=member
# -> {allowed(1|0), count_after, retry_after_s}
_SLIDING_WINDOW_LUA = """
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('zremrangebyscore', KEYS[1], '-inf', now - window)
local n = redis.call('zcard', KEYS[1])
if n >= limit then
  local oldest = redis.call('zrange', KEYS[1], 0, 0, 'WITHSCORES')
  local retry = 1
  if oldest[2] then
    retry = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
    if retry < 1 then retry = 1 end
  end
  redis.call('pexpire', KEYS[1], window + 1000)
  return {0, n, retry}
end
redis.call('zadd', KEYS[1], now, ARGV[4])
redis.call('pexpire', KEYS[1], window + 1000)
return {1, n + 1, 0}
"""

# KEYS[1]=counter ARGV[1]=ttl_seconds -> new value (TTL set on first hit only)
_INCR_TTL_LUA = """
local v = redis.call('incr', KEYS[1])
if v == 1 then
  redis.call('expire', KEYS[1], ARGV[1])
end
return v
"""


def _redis():
    from packages.common.src.redis_client import redis_client
    return redis_client


async def _redis_sliding_window(key: str, max_requests: int, window_sec: float) -> tuple[bool, int]:
    """Run the shared Lua window. Returns (allowed, retry_after_s). Raises on
    Redis errors so callers can choose their fallback."""
    now_ms = int(wall_time() * 1000)
    res = await _redis().eval(
        _SLIDING_WINDOW_LUA, 1, key,
        now_ms, int(float(window_sec) * 1000), int(max_requests),
        f"{now_ms}:{uuid.uuid4().hex[:12]}",
    )
    allowed = bool(int(res[0]))
    retry = int(res[2]) if len(res) > 2 else 1
    return allowed, max(1, retry)


async def incr_with_ttl(key: str, ttl_seconds: int) -> int:
    """Atomically INCR ``key`` and set its TTL on the first increment.
    Raises on Redis errors (callers decide fail-open vs fail-closed)."""
    return int(await _redis().eval(_INCR_TTL_LUA, 1, key, int(ttl_seconds)))


def _too_many(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail=f"Too many requests — retry after {retry_after}s.",
        headers={"Retry-After": str(retry_after)},
    )

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

    # Cross-process sync: the SAME wall-clock Lua window the async variant
    # uses (the old pipeline scored entries with each process's monotonic
    # clock, so different workers' entries were not comparable). Runs in the
    # background so a Redis blip never slows the request; a cluster-wide
    # "deny" fills the local bucket so this process's next request fails
    # without re-querying Redis.
    async def _sync() -> None:
        try:
            allowed, _retry = await _redis_sliding_window(key, max_requests, window_sec)
            if not allowed:
                _LOCAL_RATE_BUCKETS[key] = [monotonic()] * max_requests
        except Exception:
            pass

    try:
        asyncio.get_running_loop().create_task(_sync())
    except RuntimeError:
        pass


async def rate_limit_http_async(
    request: Request,
    bucket: str,
    max_requests: int,
    window_sec: float,
) -> None:
    """Redis-authoritative sliding-window limit scoped to (bucket, client IP).

    Exact across every worker / replica. Falls back to the process-local
    bucket ONLY when Redis errors (so a Redis outage degrades to per-process
    limiting instead of no limiting). Raises ``HTTPException(429)``."""
    ip = client_ip_for_inet(request) or "anon"
    key = f"rl:{bucket}:{ip}"
    try:
        allowed, retry = await _redis_sliding_window(key, max_requests, window_sec)
    except Exception as exc:
        logger.debug("rate_limit: redis unavailable for %s (%s) — local fallback", bucket, exc)
        now = monotonic()
        _maybe_gc(now)
        floor = now - window_sec
        arr = _LOCAL_RATE_BUCKETS.setdefault(key, [])
        while arr and arr[0] < floor:
            arr.pop(0)
        if len(arr) >= max_requests:
            raise _too_many(max(1, int(arr[0] + window_sec - now)))
        arr.append(now)
        return
    if not allowed:
        raise _too_many(retry)
