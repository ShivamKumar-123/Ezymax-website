"""Shared instrumentation — Sentry, rate limiting, Prometheus metrics, request size limit.

Usage in any FastAPI service:

    from packages.common.src.instrumentation import init_sentry, add_middleware_stack

    init_sentry("gateway")
    app = FastAPI(...)
    add_middleware_stack(app)
"""
import logging
import re
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from .config import get_settings

logger = logging.getLogger("instrumentation")
settings = get_settings()


# ---------------------------------------------------------------------------
# 1. Sentry
# ---------------------------------------------------------------------------
# PII / secret redaction. send_default_pii=False only stops Sentry's
# *automatic* PII pulls; request headers, query strings, breadcrumbs, log
# messages, `extra` / contexts and stack-frame local variables still reach
# the event. On a money-flow API those carry JWTs, cookies, webhook secrets,
# passwords, OTP / TOTP codes, bank account / IFSC / UPI ids, PAN numbers and
# emails. Everything below is scrubbed in before_send / before_breadcrumb /
# before_send_transaction, and the scrubbers are module-level so they can be
# unit tested without a DSN.
_REDACT = "[redacted]"
_MAX_SCRUB_DEPTH = 12

_SENSITIVE_HEADERS = frozenset({
    "authorization", "proxy-authorization", "cookie", "set-cookie",
    "x-api-key", "x-api-secret", "x-razorpay-signature", "hmac",
    "x-signature", "x-webhook-signature", "x-webhook-secret", "x-hub-signature",
    "x-hub-signature-256", "x-csrf-token", "x-xsrf-token", "x-auth-token",
    "x-access-token", "x-refresh-token", "x-forwarded-for", "x-real-ip",
    "cf-connecting-ip", "true-client-ip",
})

# Key names whose values are always dropped (after lower-casing and
# normalising '-' / ' ' to '_'). Substring match for the unambiguous ones…
_SENSITIVE_KEY_PARTS = (
    "password", "passwd", "passphrase", "secret", "token", "api_key", "apikey",
    "access_key", "private_key", "privkey", "mnemonic", "seed_phrase",
    "authorization", "cookie", "session", "csrf", "credential", "signature",
    "otp", "totp", "2fa", "mfa", "backup_code", "recovery_code", "cvv", "cvc",
    "card_number", "bank_account", "account_number", "account_no", "acc_no",
    "ifsc", "iban", "swift", "routing_number", "upi", "vpa", "pan_number",
    "pan_card", "aadhaar", "aadhar", "ssn", "passport", "email", "e_mail",
    "phone", "mobile", "date_of_birth", "jwt", "webhook_key", "dsn",
)
# …and exact match for short names that would over-match as substrings
# ("code" would hit status_code, "pan" would hit company).
_SENSITIVE_KEY_EXACT = frozenset({
    "code", "pin", "pan", "dob", "key", "sig", "hash", "auth", "pwd", "pass",
    "verification_code", "step_up_code", "ip", "ip_address",
    "remote_addr", "client_ip",
})

# Value patterns redacted inside free text (exception messages, log lines,
# breadcrumb messages, URLs). Ordered: emails before UPI ids.
_VALUE_PATTERNS = (
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9\-._~+/]+=*"), "Bearer " + _REDACT),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+"), _REDACT),  # JWT
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[email]"),
    (re.compile(r"\b[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}\b"), "[upi]"),          # UPI VPA
    (re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), "[pan]"),                  # Indian PAN
    (re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"), "[ifsc]"),                  # IFSC
    (re.compile(r"(?i)\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}"), _REDACT),  # API keys
    (re.compile(r"(?i)\b(rzp_(live|test)_[A-Za-z0-9]{6,})"), _REDACT),
    # key=value / "key": "value" pairs inside free text (query strings,
    # stringified dicts, log lines).
    (re.compile(
        r"(?i)\b((?:\w*password|passwd|passphrase|\w*secret|\w*token|\w*api_?key|"
        r"otp|totp|otp_code|signature|ifsc|upi|upi_id|vpa|pan|pan_number|"
        r"account_number|bank_account|authorization|cookie)[\"']?\s*[=:]\s*[\"']?)"
        r"([^\s\"'&,;}]+)"),
     r"\1" + _REDACT),
)


def _norm_key(key) -> str:
    return str(key).strip().lower().replace("-", "_").replace(" ", "_")


def is_sensitive_key(key) -> bool:
    k = _norm_key(key)
    if not k:
        return False
    if k in _SENSITIVE_KEY_EXACT:
        return True
    return any(part in k for part in _SENSITIVE_KEY_PARTS)


def scrub_text(value):
    """Redact secret / PII patterns inside a free-text string."""
    if not isinstance(value, str) or not value:
        return value
    out = value
    for pattern, repl in _VALUE_PATTERNS:
        out = pattern.sub(repl, out)
    return out


def scrub_data(value, _depth: int = 0):
    """Recursively scrub dicts / lists / strings: sensitive keys are replaced
    wholesale, every remaining string is pattern-scrubbed."""
    if _depth > _MAX_SCRUB_DEPTH:
        return _REDACT
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if is_sensitive_key(k) and v not in (None, "", [], {}):
                out[k] = _REDACT
            else:
                out[k] = scrub_data(v, _depth + 1)
        return out
    if isinstance(value, (list, tuple)):
        # Sentry sends headers / query params as [[key, value], ...] pairs.
        out_list = []
        for item in value:
            if (isinstance(item, (list, tuple)) and len(item) == 2
                    and isinstance(item[0], str) and is_sensitive_key(item[0])):
                out_list.append([item[0], _REDACT])
            else:
                out_list.append(scrub_data(item, _depth + 1))
        return out_list
    if isinstance(value, str):
        return scrub_text(value)
    return value


def _scrub_headers(headers):
    if not headers:
        return headers
    if isinstance(headers, dict):
        return {
            k: (_REDACT if (str(k).lower() in _SENSITIVE_HEADERS or is_sensitive_key(k))
                else scrub_text(v) if isinstance(v, str) else v)
            for k, v in headers.items()
        }
    return scrub_data(headers)


def _scrub_query_string(qs):
    if not qs:
        return qs
    if isinstance(qs, str):
        try:
            from urllib.parse import parse_qsl, urlencode
            pairs = parse_qsl(qs, keep_blank_values=True)
            if pairs:
                return urlencode(
                    [(k, _REDACT if is_sensitive_key(k) else scrub_text(v)) for k, v in pairs],
                    safe="[]",
                )
        except Exception:
            return _REDACT
        return scrub_text(qs)
    return scrub_data(qs)


def _scrub_url(url):
    if not isinstance(url, str) or "?" not in url:
        return scrub_text(url)
    base, _, qs = url.partition("?")
    return f"{scrub_text(base)}?{_scrub_query_string(qs)}"


_SENSITIVE_URL_PREFIXES = (
    "/api/v1/webhooks/",   # Razorpay / OxaPay / on-chain IPNs
    "/api/v1/auth/",       # passwords, OAuth tokens, 2FA codes
    "/api/lp/",            # Corecen LP push (HMAC-signed prices)
    "/api/v1/wallet/",     # deposit/withdraw bodies, bank / UPI details
    "/api/v1/admin/",      # admin actions (login-as codes etc.)
    "/api/v1/profile",     # KYC, bank, PAN
    "/api/v1/kyc",
)


def _scrub_exception_values(exc_block) -> None:
    for exc in (exc_block or {}).get("values") or []:
        if not isinstance(exc, dict):
            continue
        if isinstance(exc.get("value"), str):
            exc["value"] = scrub_text(exc["value"])
        frames = ((exc.get("stacktrace") or {}).get("frames")) or []
        for frame in frames:
            if isinstance(frame, dict) and isinstance(frame.get("vars"), dict):
                frame["vars"] = scrub_data(frame["vars"])


def scrub_event(event, _hint=None):
    """Sentry before_send / before_send_transaction hook. Never drops the
    event: a redaction bug must not swallow a real exception report — but if
    scrubbing fails we strip the riskiest parts instead of sending raw."""
    if not isinstance(event, dict):
        return event
    try:
        req = event.get("request")
        if isinstance(req, dict):
            url = req.get("url") or ""
            req["headers"] = _scrub_headers(req.get("headers"))
            if "cookies" in req:
                req["cookies"] = _REDACT
            if "env" in req:
                req["env"] = scrub_data(req["env"])
            # Drop request bodies wholesale on sensitive paths — much safer
            # than guessing which field is a secret. Elsewhere scrub by key.
            if "data" in req:
                if any(p in url for p in _SENSITIVE_URL_PREFIXES):
                    req["data"] = _REDACT
                else:
                    req["data"] = scrub_data(req["data"])
            if "query_string" in req:
                # Legacy ?token=... fallbacks have ended up on auth URLs.
                req["query_string"] = (
                    _REDACT if "/auth" in url else _scrub_query_string(req["query_string"])
                )
            req["url"] = _scrub_url(url) if url else url
            event["request"] = req

        user = event.get("user")
        if isinstance(user, dict):
            # Keep only the opaque id — never email / username / IP.
            event["user"] = {k: v for k, v in user.items() if k == "id"}

        for key in ("extra", "contexts", "tags", "modules_extra"):
            if key in event:
                event[key] = scrub_data(event[key])

        if isinstance(event.get("message"), str):
            event["message"] = scrub_text(event["message"])
        logentry = event.get("logentry")
        if isinstance(logentry, dict):
            if isinstance(logentry.get("message"), str):
                logentry["message"] = scrub_text(logentry["message"])
            if isinstance(logentry.get("formatted"), str):
                logentry["formatted"] = scrub_text(logentry["formatted"])
            if "params" in logentry:
                logentry["params"] = scrub_data(logentry["params"])

        _scrub_exception_values(event.get("exception"))
        for thread in ((event.get("threads") or {}).get("values")) or []:
            frames = ((thread or {}).get("stacktrace") or {}).get("frames") or []
            for frame in frames:
                if isinstance(frame, dict) and isinstance(frame.get("vars"), dict):
                    frame["vars"] = scrub_data(frame["vars"])

        crumbs = event.get("breadcrumbs")
        values = crumbs.get("values") if isinstance(crumbs, dict) else crumbs
        if isinstance(values, list):
            scrubbed = [scrub_breadcrumb(c) for c in values]
            scrubbed = [c for c in scrubbed if c is not None]
            if isinstance(crumbs, dict):
                crumbs["values"] = scrubbed
            else:
                event["breadcrumbs"] = scrubbed

        for span in event.get("spans") or []:
            if isinstance(span, dict):
                if isinstance(span.get("description"), str):
                    span["description"] = scrub_text(span["description"])
                if isinstance(span.get("data"), dict):
                    span["data"] = scrub_data(span["data"])
    except Exception:
        # Fail safe: keep the stack/exception type, drop the payload parts
        # most likely to hold secrets.
        for key in ("request", "extra", "breadcrumbs", "user", "contexts"):
            event.pop(key, None)
    return event


def scrub_breadcrumb(crumb, _hint=None):
    """Sentry before_breadcrumb hook — scrub message + data (HTTP crumbs
    carry full URLs with query strings, log crumbs carry formatted lines)."""
    if not isinstance(crumb, dict):
        return crumb
    try:
        if isinstance(crumb.get("message"), str):
            crumb["message"] = scrub_text(crumb["message"])
        data = crumb.get("data")
        if isinstance(data, dict):
            data = scrub_data(data)
            if isinstance(data.get("url"), str):
                data["url"] = _scrub_url(data["url"])
            crumb["data"] = data
    except Exception:
        crumb.pop("data", None)
        crumb["message"] = _REDACT
    return crumb


def init_sentry(service_name: str) -> None:
    """Initialise Sentry SDK if SENTRY_DSN is configured."""
    dsn = settings.SENTRY_DSN
    if not dsn:
        logger.info("SENTRY_DSN not set — Sentry disabled for %s", service_name)
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            environment=settings.ENVIRONMENT,
            release=f"swisscresta-{service_name}@1.0.0",
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
            before_send=scrub_event,
            before_send_transaction=scrub_event,
            before_breadcrumb=scrub_breadcrumb,
            # Don't include request bodies in event payloads by default;
            # the before_send hook is a second layer of defence in case
            # this is ignored on some SDK paths.
            max_request_body_size="never",
        )
        sentry_sdk.set_tag("service", service_name)
        try:
            # report_exception() captures explicitly; don't let the logging
            # integration send the same failure a second time.
            from sentry_sdk.integrations.logging import ignore_logger
            ignore_logger(_bg_logger.name)
        except Exception:
            pass
        logger.info("Sentry initialised for %s (env=%s)", service_name, settings.ENVIRONMENT)
    except Exception as exc:
        logger.warning("Failed to initialise Sentry: %s", exc)


# ---------------------------------------------------------------------------
# 1b. Background-task exception reporting
# ---------------------------------------------------------------------------
# Engines and fire-and-forget work run in bare `asyncio.create_task(...)`.
# An exception there never reaches a request handler, so FastApiIntegration
# never sees it; asyncio only logs "Task exception was never retrieved" if /
# when the task object is garbage collected. Three layers:
#   * report_exception()        — explicit capture (log + Sentry, tagged);
#   * spawn()                   — create_task with a strong reference and a
#                                 done-callback that reports the failure;
#   * install_asyncio_exception_reporting() — loop exception handler for
#                                 every task / callback not created by spawn().
#     Installed automatically for ASGI apps by add_middleware_stack (on the
#     lifespan startup message); asyncio.run() services call it at the top
#     of main().
_bg_logger = logging.getLogger("swisscresta.background")
_BACKGROUND_TASKS: set = set()


def _sentry_active() -> bool:
    try:
        import sentry_sdk
        return bool(sentry_sdk.is_initialized())
    except Exception:
        return False


def report_exception(exc: BaseException, *, where: str | None = None, **context) -> None:
    """Log *exc* with its traceback and send it to Sentry (if enabled), tagged
    with where it happened. Never raises."""
    try:
        label = where or "background"
        _bg_logger.error("unhandled exception in %s: %r", label, exc,
                         exc_info=(type(exc), exc, exc.__traceback__))
        if not _sentry_active():
            return
        import sentry_sdk
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("background", "true")
            scope.set_tag("where", label[:200])
            if context:
                scope.set_context("background", scrub_data(
                    {k: (v if isinstance(v, (str, int, float, bool, type(None))) else repr(v))
                     for k, v in context.items()}))
            sentry_sdk.capture_exception(exc)
    except Exception:  # pragma: no cover - reporting must never raise
        pass


def _task_done(task) -> None:
    _BACKGROUND_TASKS.discard(task)
    if task.cancelled():
        return
    try:
        exc = task.exception()  # also marks it "retrieved" → no GC warning
    except BaseException:  # pragma: no cover
        return
    if exc is not None:
        report_exception(exc, where=f"task:{task.get_name()}")


def spawn(coro, *, name: str | None = None):
    """asyncio.create_task() replacement for background / fire-and-forget
    work: keeps a strong reference (so the task can't be GC'd mid-flight)
    and reports any exception it dies with."""
    import asyncio
    task = asyncio.get_running_loop().create_task(coro, name=name)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_task_done)
    return task


def _loop_exception_handler(loop, context: dict) -> None:
    exc = context.get("exception")
    if isinstance(exc, BaseException):
        task = context.get("task") or context.get("future")
        where = "asyncio"
        try:
            if task is not None and hasattr(task, "get_name"):
                where = f"task:{task.get_name()}"
        except Exception:
            pass
        report_exception(exc, where=where, asyncio_message=str(context.get("message") or ""))
        return
    loop.default_exception_handler(context)


def install_asyncio_exception_reporting(loop=None) -> bool:
    """Route unhandled asyncio exceptions (tasks nobody awaited, callbacks)
    to report_exception(). Idempotent; keeps a custom handler already set by
    the service. Returns True if our handler is (now) installed."""
    import asyncio
    try:
        loop = loop or asyncio.get_running_loop()
    except RuntimeError:
        return False
    current = loop.get_exception_handler()
    if current is _loop_exception_handler:
        return True
    if current is not None:
        return False
    loop.set_exception_handler(_loop_exception_handler)
    return True


class BackgroundErrorReportingMiddleware:
    """Pure ASGI shim: on the lifespan startup message (which runs on the
    server's event loop, before the app's own lifespan starts its engines)
    install the asyncio exception handler. Pass-through for everything else."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "lifespan":
            install_asyncio_exception_reporting()
        await self.app(scope, receive, send)


# ---------------------------------------------------------------------------
# 2. Rate Limiting (slowapi)
# ---------------------------------------------------------------------------
_limiter_instance = None


def get_rate_limiter():
    """Return a singleton SlowAPI Limiter instance."""
    global _limiter_instance
    if _limiter_instance is None:
        from slowapi import Limiter
        from slowapi.util import get_remote_address
        _limiter_instance = Limiter(
            key_func=get_remote_address,
            default_limits=[settings.RATE_LIMIT_DEFAULT],
            storage_uri=settings.REDIS_URL,
        )
    return _limiter_instance


def add_rate_limit_handler(app):
    """Attach SlowAPI exception handler to the app."""
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    limiter = get_rate_limiter()
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please slow down."},
        )


# ---------------------------------------------------------------------------
# 3. Request Body Size Limit Middleware
# ---------------------------------------------------------------------------
class _BodyTooLarge(Exception):
    pass


class RequestSizeLimitMiddleware:
    """Reject request bodies larger than MAX_REQUEST_SIZE.

    Pure ASGI (not BaseHTTPMiddleware) so it can count the bytes ACTUALLY
    streamed: the old version only trusted the Content-Length header, so a
    chunked (Transfer-Encoding) upload with no Content-Length bypassed the cap
    entirely, and a malformed Content-Length crashed with a 500. Now:
      * declared Content-Length over the cap → 413 before reading anything;
      * non-numeric Content-Length → 400;
      * streamed body that grows past the cap (chunked) → 413.
    """

    def __init__(self, app, max_size: int | None = None):
        self.app = app
        self.max_size = max_size or settings.MAX_REQUEST_SIZE

    async def _reply(self, send, status_code: int, detail: str) -> None:
        resp = JSONResponse(status_code=status_code, content={"detail": detail})
        await send({
            "type": "http.response.start",
            "status": resp.status_code,
            "headers": resp.raw_headers,
        })
        await send({"type": "http.response.body", "body": resp.body})

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        too_large = f"Request body too large. Max {self.max_size // (1024 * 1024)} MB."
        for name, value in scope.get("headers") or []:
            if name == b"content-length":
                try:
                    declared = int(value)
                except (ValueError, TypeError):
                    await self._reply(send, 400, "Invalid Content-Length header.")
                    return
                if declared < 0:
                    await self._reply(send, 400, "Invalid Content-Length header.")
                    return
                if declared > self.max_size:
                    await self._reply(send, 413, too_large)
                    return
                break

        received = 0
        response_started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message.get("type") == "http.request":
                received += len(message.get("body", b"") or b"")
                if received > self.max_size:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._reply(send, 413, too_large)


# ---------------------------------------------------------------------------
# 4. Prometheus Metrics Middleware
# ---------------------------------------------------------------------------
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency",
        ["method", "endpoint"],
    )
    _PROM_AVAILABLE = True
except ImportError:
    _PROM_AVAILABLE = False


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not _PROM_AVAILABLE:
            return await call_next(request)

        method = request.method
        path = request.url.path
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        # Normalize path to avoid high-cardinality labels
        endpoint = path.split("?")[0]
        if len(endpoint) > 80:
            endpoint = endpoint[:80]

        REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=response.status_code).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)
        return response


def add_metrics_endpoint(app):
    """Add /metrics endpoint for Prometheus scraping — internal scrapers only."""
    if not _PROM_AVAILABLE:
        return

    @app.get("/metrics", include_in_schema=False)
    async def metrics(request: Request):
        # Only INTERNAL scrapers may read metrics. Every request that reached
        # this app through the public edge carries an X-Forwarded-* header
        # (nginx/Cloudflare add it); a Prometheus scraper hitting the container
        # directly on the internal network / loopback does not. Deny the
        # forwarded ones so the full route inventory + traffic stats aren't
        # exposed publicly on api.swisscresta.com/metrics. (The gateway binds
        # 127.0.0.1 in prod, so non-forwarded requests are internal-only.)
        if request.headers.get("x-forwarded-for") or request.headers.get("x-forwarded-host"):
            return Response(status_code=404)
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ---------------------------------------------------------------------------
# 5. Structured Request Logging Middleware
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Assert baseline security headers on every API response. The nginx blocks
    for the trader/admin hosts already set these, but the api.swisscresta.com
    JSON host was missing HSTS / Referrer-Policy / Permissions-Policy — set them
    at the app so they hold regardless of the (host-managed) proxy config."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        h = response.headers
        # Only the three the nginx blocks were missing on the api host —
        # X-Frame-Options / X-Content-Type-Options are already set by nginx
        # everywhere, so setting them here too would just duplicate the header.
        h.setdefault("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        if not request.url.path.startswith(("/health", "/metrics")):
            logger.info(
                "%s %s %d %.1fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
        return response


# ---------------------------------------------------------------------------
# Convenience: add the full middleware stack at once
# ---------------------------------------------------------------------------
def add_middleware_stack(app, *, include_rate_limit: bool = False):
    """Add all production middleware to a FastAPI app.

    Call AFTER app creation, BEFORE including routers.
    Middleware is applied in reverse order (last added runs first).

    NOTE: rate limiting is DISABLED by default — the global SlowAPI limiter
    caused 429s on legitimate authenticated traffic (shared NAT IPs, CDN
    fan-out). Pass include_rate_limit=True to re-enable; individual endpoints
    still have per-bucket rate_limit_http() guards where needed.
    """
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(PrometheusMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware)
    # Outermost: installs the asyncio exception handler on lifespan startup
    # so background-task failures reach Sentry. Pass-through for HTTP/WS.
    app.add_middleware(BackgroundErrorReportingMiddleware)
    add_metrics_endpoint(app)
    if include_rate_limit:
        add_rate_limit_handler(app)
