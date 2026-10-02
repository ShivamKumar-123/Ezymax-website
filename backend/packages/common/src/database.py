"""Database engines + session factories.

Section F (horizontal scale):
  * Pool size / overflow / timeout / recycle come from settings (env), with
    defaults equal to the previously hard-coded values.
  * API sessions may carry server-side ``statement_timeout`` and
    ``idle_in_transaction_session_timeout`` (DB_STATEMENT_TIMEOUT_MS /
    DB_IDLE_IN_TX_TIMEOUT_MS, 0 = off = previous behaviour).
  * ``DB_PGBOUNCER=true`` turns off asyncpg's prepared-statement cache (PgBouncer
    transaction pooling can't keep per-connection prepared statements) and
    skips startup ``server_settings`` (PgBouncer rejects unknown startup
    parameters — set the timeouts on the DB role instead).
  * The Timescale engine is created lazily on first use, so processes that
    never touch market-data history don't hold a second pool.
  * ``WorkerSessionLocal`` is a separate session factory for engines / long
    background jobs. It never sets ``statement_timeout`` (a nightly batch must
    not be killed by the API cap). When no cap is configured it simply shares
    the API engine.
"""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def _connect_args(*, statement_timeout_ms: int, idle_in_tx_ms: int) -> dict:
    """asyncpg connect() kwargs for the current deployment mode."""
    s = get_settings()
    args: dict = {}
    if getattr(s, "DB_PGBOUNCER", False):
        # Transaction pooling: no server-side prepared statement may outlive a
        # transaction. Unique names avoid "prepared statement already exists".
        args["statement_cache_size"] = 0
        args["prepared_statement_cache_size"] = 0
        args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4().hex}__"
        return args
    server_settings: dict[str, str] = {}
    if statement_timeout_ms and statement_timeout_ms > 0:
        server_settings["statement_timeout"] = str(int(statement_timeout_ms))
    if idle_in_tx_ms and idle_in_tx_ms > 0:
        server_settings["idle_in_transaction_session_timeout"] = str(int(idle_in_tx_ms))
    if server_settings:
        args["server_settings"] = server_settings
    return args


def _pool_kwargs(pool_size: int, max_overflow: int) -> dict:
    s = get_settings()
    return {
        "pool_size": int(pool_size),
        "max_overflow": int(max_overflow),
        "pool_timeout": float(getattr(s, "DB_POOL_TIMEOUT", 30.0)),
        "pool_recycle": int(getattr(s, "DB_POOL_RECYCLE", 1800)),
        "pool_pre_ping": True,
    }


_STATEMENT_TIMEOUT_MS = int(getattr(settings, "DB_STATEMENT_TIMEOUT_MS", 0) or 0)
_IDLE_IN_TX_MS = int(getattr(settings, "DB_IDLE_IN_TX_TIMEOUT_MS", 0) or 0)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    connect_args=_connect_args(
        statement_timeout_ms=_STATEMENT_TIMEOUT_MS, idle_in_tx_ms=_IDLE_IN_TX_MS,
    ),
    **_pool_kwargs(
        getattr(settings, "DB_POOL_SIZE", 20), getattr(settings, "DB_MAX_OVERFLOW", 10),
    ),
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Worker (engine / batch) sessions: no statement cap. Only a separate engine
# when the API engine actually carries one — otherwise share the pool.
if _STATEMENT_TIMEOUT_MS > 0:
    worker_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args=_connect_args(statement_timeout_ms=0, idle_in_tx_ms=_IDLE_IN_TX_MS),
        **_pool_kwargs(
            max(2, int(getattr(settings, "DB_POOL_SIZE", 20)) // 2),
            getattr(settings, "DB_MAX_OVERFLOW", 10),
        ),
    )
    WorkerSessionLocal = async_sessionmaker(
        worker_engine, class_=AsyncSession, expire_on_commit=False
    )
else:
    worker_engine = engine
    WorkerSessionLocal = AsyncSessionLocal


# ── Lazy Timescale engine ──────────────────────────────────────────────
_timescale_engine = None
_timescale_sessionmaker = None


def get_timescale_engine():
    global _timescale_engine
    if _timescale_engine is None:
        s = get_settings()
        _timescale_engine = create_async_engine(
            s.TIMESCALE_URL,
            echo=False,
            connect_args=_connect_args(statement_timeout_ms=0, idle_in_tx_ms=0),
            **_pool_kwargs(
                getattr(s, "TIMESCALE_POOL_SIZE", 10), getattr(s, "TIMESCALE_MAX_OVERFLOW", 5),
            ),
        )
    return _timescale_engine


def get_timescale_sessionmaker():
    global _timescale_sessionmaker
    if _timescale_sessionmaker is None:
        _timescale_sessionmaker = async_sessionmaker(
            get_timescale_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _timescale_sessionmaker


def TimescaleSessionLocal():  # noqa: N802 — keeps the old factory call-site shape
    """Back-compat: ``async with TimescaleSessionLocal() as s`` still works,
    but the engine is only created on first call."""
    return get_timescale_sessionmaker()()


def __getattr__(name: str):
    # PEP 562: `from database import timescale_engine` keeps working and only
    # then builds the engine.
    if name == "timescale_engine":
        return get_timescale_engine()
    raise AttributeError(name)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_timescale_db() -> AsyncSession:
    async with TimescaleSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def dispose_engines() -> None:
    """Dispose every engine this process created (shutdown hook)."""
    await engine.dispose()
    if worker_engine is not engine:
        await worker_engine.dispose()
    if _timescale_engine is not None:
        await _timescale_engine.dispose()
