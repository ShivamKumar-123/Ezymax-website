"""RMS engine — IP geo-resolution + shared-IP collision detection.

Powers the superadmin IP-management module. Every tick (leader-locked,
so a 2-worker gateway runs it once) this engine does two things:

  1. **Resolve geo for new IPs.** Pulls distinct IPs seen in
     ``user_sessions`` over the lookback window that aren't yet in
     ``ip_geo_cache`` (or are stale), and resolves them via the GeoIP
     provider — capped at ``_RESOLVE_CAP`` per tick so we stay under
     the provider's free-tier rate limit. The admin read path then
     never makes an outbound call.

  2. **Detect shared-IP collisions.** Finds every IP used by two or
     more *distinct* users in the window — the core multi-account /
     fraud signal. Each collision is upserted into ``rms_alerts`` on
     the ``(alert_type, ip_address)`` key. When a collision is brand
     new (or grows to include another user), an alert is published to
     the ``admin:alerts`` Redis channel so the ``/ws/admin`` socket
     pushes it live to any open admin dashboard.

Read-side aggregation (per-user IP list, map points) lives in the admin
service; this engine only owns the write side (cache + alerts).
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.geoip import resolve_ip
from packages.common.src.redis_client import redis_client
from packages.common.src.admin_notify import admin_notify

logger = logging.getLogger("rms-engine")

TICK_INTERVAL = 180            # 3 minutes
LOOKBACK_DAYS = 30             # window for "recent" sessions
_RESOLVE_CAP = 30              # max provider calls per tick (free tier ~45/min)
_RESOLVE_SPACING = 1.4         # seconds between provider calls (rate safety)

# Coordinated-trading detection: same instrument + same side opened by
# >= COORD_MIN_USERS distinct users within a COORD_WINDOW_MIN-minute bucket,
# scanned over the last COORD_LOOKBACK_HOURS.
COORD_WINDOW_MIN = 5
COORD_MIN_USERS = 3
COORD_LOOKBACK_HOURS = 6


def _severity(user_count: int) -> str:
    if user_count >= 5:
        return "high"
    if user_count >= 3:
        return "medium"
    return "low"


class RmsEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("RMS engine started (tick=%ds, lookback=%dd)", TICK_INTERVAL, LOOKBACK_DAYS)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Medium-cadence engine — TTL comfortably exceeds one tick's
                # work (a handful of short queries + capped provider calls).
                async with engine_lock("rms_tick", ttl_seconds=300) as is_leader:
                    if is_leader:
                        await self._resolve_new_ips()
                        await self._detect_shared_ips()
                        await self._detect_coordinated_trades()
            except Exception as e:
                logger.error("rms engine tick failed: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)

    # ── 1. Geo-resolve recently-seen IPs (rate-capped) ────────────────────
    async def _resolve_new_ips(self) -> None:
        sql = text(
            f"""
            SELECT DISTINCT host(s.ip_address) AS ip
            FROM user_sessions s
            LEFT JOIN ip_geo_cache g ON g.ip_address = s.ip_address
            WHERE s.ip_address IS NOT NULL
              AND s.created_at > now() - interval '{LOOKBACK_DAYS} days'
              AND (
                    g.ip_address IS NULL
                 OR (g.status = 'resolved' AND g.resolved_at < now() - interval '{LOOKBACK_DAYS} days')
                 OR (g.status = 'failed'   AND g.resolved_at < now() - interval '12 hours')
              )
            LIMIT :cap
            """
        )
        try:
            async with AsyncSessionLocal() as db:
                rows = (await db.execute(sql, {"cap": _RESOLVE_CAP})).all()
                ips = [r[0] for r in rows if r[0]]
        except Exception as e:
            logger.warning("rms: collecting unresolved IPs failed: %s", e)
            return

        if not ips:
            return
        logger.info("rms: resolving geo for %d new IP(s)", len(ips))
        for ip in ips:
            # Each resolve_ip opens its own short transaction and commits.
            async with AsyncSessionLocal() as db:
                await resolve_ip(db, ip)
            await asyncio.sleep(_RESOLVE_SPACING)

    # ── 2. Detect shared-IP collisions → upsert alerts + notify ───────────
    async def _detect_shared_ips(self) -> None:
        sql = text(
            f"""
            SELECT host(ip_address) AS ip,
                   count(DISTINCT user_id) AS uc,
                   array_agg(DISTINCT user_id) AS uids
            FROM user_sessions
            WHERE ip_address IS NOT NULL
              AND user_id IS NOT NULL
              AND created_at > now() - interval '{LOOKBACK_DAYS} days'
            GROUP BY ip_address
            HAVING count(DISTINCT user_id) >= 2
            """
        )
        try:
            async with AsyncSessionLocal() as db:
                groups = (await db.execute(sql)).all()
                for ip, uc, uids in groups:
                    await self._upsert_alert(db, ip, int(uc), [str(u) for u in (uids or [])])
        except Exception as e:
            logger.warning("rms: shared-IP detection failed: %s", e)

    async def _upsert_alert(self, db, ip: str, user_count: int, user_ids: list[str]) -> None:
        now = datetime.now(timezone.utc)
        # Snapshot the colliding users (email + name) for the alert list.
        try:
            urows = (await db.execute(
                text(
                    "SELECT id, email, "
                    "trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) AS name "
                    "FROM users WHERE id = ANY(:ids)"
                ),
                {"ids": user_ids},
            )).all()
        except Exception:
            urows = []
        users_snapshot = [
            {"user_id": str(r[0]), "email": r[1], "name": (r[2] or "").strip() or None}
            for r in urows
        ]
        severity = _severity(user_count)

        existing = (await db.execute(
            text(
                "SELECT id, user_count, status FROM rms_alerts "
                "WHERE alert_type = 'shared_ip' AND host(ip_address) = :ip"
            ),
            {"ip": ip},
        )).first()

        if existing is None:
            await db.execute(
                text(
                    """
                    INSERT INTO rms_alerts
                        (id, alert_type, ip_address, user_ids, user_count,
                         status, severity, first_seen_at, last_seen_at, created_at)
                    VALUES
                        (gen_random_uuid(), 'shared_ip', :ip, :users, :uc,
                         'open', :sev, :now, :now, :now)
                    ON CONFLICT (alert_type, ip_address) DO NOTHING
                    """
                ),
                {"ip": ip, "users": json.dumps(users_snapshot), "uc": user_count,
                 "sev": severity, "now": now},
            )
            await db.commit()
            await self._publish(ip, user_count, users_snapshot, severity, is_new=True)
            await admin_notify(
                category="shared_ip",
                severity=severity if severity != "low" else "medium",
                title=f"Shared IP: {user_count} users on {ip}",
                body=(
                    f"{user_count} distinct users authenticated from {ip}: "
                    + ", ".join(u.get("email") or u.get("user_id") for u in users_snapshot[:6])
                ),
                meta={"ip": ip, "user_count": user_count, "users": users_snapshot},
                action_url="/rms",
                dedup_key=f"shared_ip:{ip}",
            )
            logger.warning(
                "rms ALERT shared_ip: %d users share IP %s (sev=%s)",
                user_count, ip, severity,
            )
            return

        # Existing alert — refresh snapshot/count. Re-notify only if the
        # collision grew (a new user appeared on the IP) and it isn't
        # already dismissed.
        prev_count = int(existing[1] or 0)
        await db.execute(
            text(
                """
                UPDATE rms_alerts
                SET user_ids = :users, user_count = :uc, severity = :sev,
                    last_seen_at = :now
                WHERE id = :id
                """
            ),
            {"users": json.dumps(users_snapshot), "uc": user_count, "sev": severity,
             "now": now, "id": existing[0]},
        )
        await db.commit()
        if user_count > prev_count and existing[2] != "dismissed":
            await self._publish(ip, user_count, users_snapshot, severity, is_new=False)
            logger.warning(
                "rms ALERT shared_ip grew: IP %s now %d users (was %d)",
                ip, user_count, prev_count,
            )

    # ── 3. Detect coordinated same-side trading → notify admins ───────────
    async def _detect_coordinated_trades(self) -> None:
        """Same instrument + same side opened by >= COORD_MIN_USERS distinct
        users inside a COORD_WINDOW_MIN-minute bucket. A herding/collusion
        signal (concentrated directional B-book risk). Deduped per
        (symbol, side, bucket) so a given window alerts at most once."""
        sql = text(
            f"""
            SELECT i.symbol,
                   lower(cast(p.side AS text)) AS side,
                   date_bin(make_interval(mins => {COORD_WINDOW_MIN}), p.created_at,
                            TIMESTAMPTZ '2000-01-01 00:00:00+00') AS bucket,
                   count(DISTINCT ta.user_id) AS user_count,
                   count(*) AS trade_count,
                   sum(p.lots) AS total_lots,
                   array_agg(DISTINCT u.email) AS emails
            FROM positions p
            JOIN trading_accounts ta ON ta.id = p.account_id
            JOIN instruments i ON i.id = p.instrument_id
            JOIN users u ON u.id = ta.user_id
            WHERE p.created_at > now() - make_interval(hours => {COORD_LOOKBACK_HOURS})
              AND ta.is_demo = false
            GROUP BY i.symbol, lower(cast(p.side AS text)), bucket
            HAVING count(DISTINCT ta.user_id) >= {COORD_MIN_USERS}
            ORDER BY user_count DESC
            LIMIT 50
            """
        )
        try:
            async with AsyncSessionLocal() as db:
                rows = (await db.execute(sql)).all()
        except Exception as e:
            logger.warning("rms: coordinated-trade detection failed: %s", e)
            return

        for row in rows:
            m = row._mapping
            symbol, side = m["symbol"], m["side"]
            uc = int(m["user_count"] or 0)
            bucket = m["bucket"]
            bucket_iso = bucket.isoformat() if bucket else "?"
            emails = [e for e in (m["emails"] or []) if e]
            severity = "high" if uc >= 5 else "medium"
            is_new = await admin_notify(
                category="coordinated_trade",
                severity=severity,
                title=f"Coordinated {side.upper()} on {symbol}: {uc} users",
                body=(
                    f"{uc} users opened {side.upper()} {symbol} within "
                    f"{COORD_WINDOW_MIN} min ({int(m['trade_count'] or 0)} trades, "
                    f"{float(m['total_lots'] or 0):g} lots): " + ", ".join(emails[:6])
                ),
                meta={
                    "symbol": symbol, "side": side, "user_count": uc,
                    "trade_count": int(m["trade_count"] or 0),
                    "total_lots": float(m["total_lots"] or 0),
                    "window_start": bucket_iso, "users": emails,
                },
                action_url="/trade-risk",
                dedup_key=f"coordinated:{symbol}:{side}:{bucket_iso}",
            )
            if is_new:
                logger.warning(
                    "rms ALERT coordinated_trade: %d users %s %s (sev=%s)",
                    uc, side.upper(), symbol, severity,
                )

    async def _publish(self, ip, user_count, users, severity, *, is_new: bool) -> None:
        """Best-effort live push to the admin dashboard via Redis."""
        try:
            await redis_client.publish("admin:alerts", json.dumps({
                "type": "rms_alert",
                "alert_type": "shared_ip",
                "ip": ip,
                "user_count": user_count,
                "severity": severity,
                "users": users,
                "is_new": is_new,
            }))
        except Exception:
            pass


rms_engine = RmsEngine()
