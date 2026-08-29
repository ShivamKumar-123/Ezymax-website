import logging

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Session as _SyncSession
from .config import get_settings

_logger = logging.getLogger("common.database")


class Base(DeclarativeBase):
    pass


@event.listens_for(_SyncSession, "before_flush")
def _fill_transaction_balance_after(session, flush_context, instances):
    """Ledger safety-net: guarantee every account-scoped Transaction records the
    running balance in `balance_after`.

    Historically several money-movement paths (copy-trade deposits/withdrawals,
    performance fees, some scripts) inserted Transaction rows WITHOUT setting
    `balance_after`, so ~37% of a heavy account's ledger had NULL running
    balances and admin views / reconciliation drifted. Rather than patch every
    call site (and risk missing future ones), we fill it here at flush time from
    the account (or user's main wallet) that is already loaded in this session —
    a pure in-memory read, no DB query, so it is safe inside before_flush.

    Defensive by construction: only fills when the field is None, only from an
    object already in the session, and never raises (a listener error must never
    break a live financial write — worst case the field stays NULL, as before).
    """
    try:
        pending = [o for o in session.new if type(o).__name__ == "Transaction"]
        if not pending:
            return
        accounts, users = {}, {}
        for o in session.identity_map.values():
            tn = type(o).__name__
            oid = getattr(o, "id", None)
            if oid is None:
                continue
            if tn == "TradingAccount":
                accounts[oid] = o
            elif tn == "User":
                users[oid] = o
        for tx in pending:
            if getattr(tx, "balance_after", None) is not None:
                continue
            acct_id = getattr(tx, "account_id", None)
            if acct_id is not None:
                acc = accounts.get(acct_id)
                bal = getattr(acc, "balance", None) if acc is not None else None
            else:
                usr = users.get(getattr(tx, "user_id", None))
                bal = getattr(usr, "main_wallet_balance", None) if usr is not None else None
            if bal is not None:
                tx.balance_after = bal
    except Exception as exc:  # never break a flush over an audit-field default
        _logger.debug("balance_after auto-fill skipped: %s", exc)


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
