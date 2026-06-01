from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    # Per-worker pool. The gateway runs 9 background engines + HTTP
    # traffic + WebSocket fanout in the same process, and each engine
    # tick holds a session for the duration of its query. 20+10 was
    # tight under sustained load — bumped to 30+15 so engine sessions
    # don't starve HTTP traffic during high-volume polling windows.
    pool_size=30,
    max_overflow=15,
    pool_pre_ping=True,
    # Recycle connections older than 30 min so a stale conn killed
    # server-side by Postgres' idle_in_transaction_session_timeout
    # surfaces as a fresh connection here instead of as an
    # "OperationalError: server closed the connection unexpectedly"
    # at the request boundary.
    pool_recycle=1800,
)

timescale_engine = create_async_engine(
    settings.TIMESCALE_URL,
    echo=False,
    pool_size=15,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

TimescaleSessionLocal = async_sessionmaker(
    timescale_engine, class_=AsyncSession, expire_on_commit=False
)


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
