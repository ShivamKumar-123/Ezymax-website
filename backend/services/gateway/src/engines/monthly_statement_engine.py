"""Monthly account-statement notification engine.

Fires on the 1st of every UTC month: every active user with a real email
gets a one-line notification that their previous month's statement is
available in the trader app.

Section F (exactly-once across workers, replicas and restarts):
  * leader-locked (engine_lock "monthly_statement") so only one process walks
    the user table at a time;
  * users are walked in keyset batches of BATCH_SIZE ids with ONE short
    session per batch (the old code loaded every active user into memory and
    shared one AsyncSession across concurrent send tasks);
  * the per-user claim is DURABLE: ``users.last_statement_month`` (migration
    0076) is set with a conditional ``UPDATE … RETURNING`` and committed
    BEFORE any email goes out, so a user is claimed by exactly one process
    even if the Redis key the old version relied on was lost. A failed send
    reverts that user's claim so a later tick retries it.

Tick is hourly so a deploy or restart on the 1st mid-day still triggers the
send for users not yet processed.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from calendar import month_name
from datetime import datetime, timezone
from types import SimpleNamespace

from sqlalchemy import text

from packages.common.src.instrumentation import spawn
from packages.common.src.database import WorkerSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.email_branding import apply_email_brand
from packages.common.src.wallet_placeholder import not_placeholder_sql

logger = logging.getLogger("monthly-statement")

TICK_INTERVAL = 3600  # check hourly
SEND_CONCURRENCY = 10  # cap parallel SMTP sessions
BATCH_SIZE = 1000

# Engine sessions never carry the API statement_timeout. Module-level name so
# tests can patch it.
AsyncSessionLocal = WorkerSessionLocal


def _previous_month_label(now: datetime) -> tuple[str, str]:
    """Return (label, year_month_key) for the *previous* calendar month.

    Example: called on 2026-04-01 → ("March, 2026", "2026-03").
    The notification covers the month that just ended."""
    y, m = now.year, now.month - 1
    if m == 0:
        m = 12
        y -= 1
    label = f"{month_name[m]}, {y}"
    key = f"{y:04d}-{m:02d}"
    return label, key


class MonthlyStatementEngine:
    def __init__(self):
        self._running = False
        self._last_run_month: str | None = None  # YYYY-MM we last finished

    async def start(self):
        self._running = True
        logger.info("Monthly statement engine started (tick=%ds)", TICK_INTERVAL)
        spawn(self._run(), name="monthly_statement_engine")

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                if now.day == 1:
                    # Every hourly tick on the 1st re-runs: the durable claim
                    # makes already-emailed users a no-op (the keyset scan only
                    # returns unclaimed users), and failed sends whose claim was
                    # released are retried.
                    label, ym_key = _previous_month_label(now)
                    async with engine_lock("monthly_statement", ttl_seconds=600) as lease:
                        if lease:
                            sent = await send_monthly_statements(None, label, ym_key, lease=lease)
                            self._last_run_month = ym_key
                            if sent:
                                logger.info(
                                    "monthly statement: emailed %d users for %s",
                                    sent, label,
                                )
            except Exception as e:
                logger.error("Monthly statement engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


_CANDIDATES_SQL = text(
    f"""
    SELECT id FROM users
     WHERE status = 'active'
       AND id > :after
       AND COALESCE(is_demo, false) = false
       AND email IS NOT NULL
       AND {not_placeholder_sql('email')}
       AND last_statement_month IS DISTINCT FROM :ym
     ORDER BY id
     LIMIT :lim
    """
)

# Durable claim: only rows not yet claimed for this month flip; RETURNING
# tells us exactly which users THIS process now owns.
_CLAIM_SQL = text(
    """
    UPDATE users
       SET last_statement_month = :ym
     WHERE id = ANY(:ids)
       AND status = 'active'
       AND last_statement_month IS DISTINCT FROM :ym
    RETURNING id, email, first_name, assigned_broker_id, broker_ancestry
    """
)

_UNCLAIM_SQL = text(
    "UPDATE users SET last_statement_month = NULL "
    "WHERE id = ANY(:ids) AND last_statement_month = :ym"
)


LEGACY_LOCK_PREFIX = "monthly_statement_sent"


async def _legacy_sent_ids(ids: list, year_month_key: str) -> set:
    if not ids:
        return set()
    try:
        from packages.common.src.redis_client import redis_client
        pipe = redis_client.pipeline(transaction=False)
        for uid in ids:
            pipe.exists(f"{LEGACY_LOCK_PREFIX}:{uid}:{year_month_key}")
        res = await pipe.execute()
        return {uid for uid, hit in zip(ids, res) if hit}
    except Exception:
        return set()


async def send_monthly_statements(
    db, statement_month_label: str, year_month_key: str, *, lease=None,
) -> int:
    """Send to every eligible user exactly once for ``year_month_key``.

    ``db`` is ignored (kept for call-site compatibility): each keyset batch
    uses its own short session. Returns the number of emails dispatched."""
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured
        from packages.common.src.email_templates import render_monthly_statement_available
        from packages.common.src.config import get_settings
    except Exception as e:
        logger.warning("monthly statement setup failed: %s", e)
        return 0

    if not smtp_configured():
        return 0

    app_url = (get_settings().TRADER_APP_URL or "https://trade.ezymex.com")
    semaphore = asyncio.Semaphore(SEND_CONCURRENCY)
    sent_total = 0
    after = uuid.UUID(int=0)  # keyset start: smallest UUID

    while True:
        if lease is not None and getattr(lease, "lost", False):
            logger.error("monthly statement: leadership lost — stopping this run")
            break

        # 1) Claim a batch (committed before any email is sent).
        async with AsyncSessionLocal() as db_batch:
            ids = [r[0] for r in (await db_batch.execute(
                _CANDIDATES_SQL, {"after": after, "ym": year_month_key, "lim": BATCH_SIZE},
            )).all()]
            if not ids:
                break
            after = ids[-1]
            claimed = (await db_batch.execute(
                _CLAIM_SQL, {"ids": ids, "ym": year_month_key},
            )).all()
            await db_batch.commit()

            # Rollout guard: users already emailed this month by the previous
            # (Redis-key) version keep their claim but get no second email.
            legacy_sent = await _legacy_sent_ids([r[0] for r in claimed], year_month_key)

            # 2) Render sequentially on this batch's session (brand lookup
            #    needs the DB; one task at a time on a session).
            rendered: list[tuple] = []
            for row in claimed:
                uid, email, first_name, broker_id, ancestry = row
                if uid in legacy_sent:
                    continue
                user_like = SimpleNamespace(
                    id=uid, email=email, first_name=first_name,
                    assigned_broker_id=broker_id, broker_ancestry=ancestry or [],
                )
                try:
                    await apply_email_brand(db_batch, user_like)
                    subject, html, text_body = render_monthly_statement_available(
                        first_name=first_name,
                        statement_month_label=statement_month_label,
                        user_uid=str(uid),
                        trader_app_url=app_url,
                    )
                    rendered.append((uid, email, subject, html, text_body))
                except Exception as e:
                    logger.warning("monthly statement render for %s failed: %s", uid, e)
                    rendered.append((uid, None, None, None, None))

        # 3) Send with bounded concurrency (no DB use in the send tasks).
        failed: list = []

        async def _send(item) -> bool:
            uid, email, subject, html, text_body = item
            if not email:
                failed.append(uid)
                return False
            async with semaphore:
                try:
                    ok = await send_email(email, subject, html, text=text_body)
                except Exception as e:
                    logger.warning("monthly statement send to %s failed: %s", email, e)
                    ok = False
            if not ok:
                failed.append(uid)
            return bool(ok)

        results = await asyncio.gather(*(_send(i) for i in rendered), return_exceptions=True)
        sent_total += sum(1 for r in results if r is True)

        # 4) Release failed claims so a later tick retries them.
        if failed:
            try:
                async with AsyncSessionLocal() as db_fail:
                    await db_fail.execute(_UNCLAIM_SQL, {"ids": failed, "ym": year_month_key})
                    await db_fail.commit()
            except Exception as e:
                logger.warning("monthly statement: releasing %d failed claim(s) failed: %s", len(failed), e)

        if len(ids) < BATCH_SIZE:
            break

    return sent_total


monthly_statement_engine = MonthlyStatementEngine()
