"""Admin RMS / IP-management service — read-side aggregation.

All per-user IP data is derived from ``user_sessions`` (written on every
login) joined to ``ip_geo_cache`` (populated by the gateway rms_engine).
Shared-IP collisions are overlaid with any ``rms_alerts`` row so the
admin sees the alert status next to the live collision.

This service never makes an outbound GeoIP call — resolution is the
engine's job; here we only read the cache. An IP with no cache row yet
simply shows geo.status='pending'.
"""
import logging
import uuid
from datetime import date, datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.admin_schemas import (
    PaginatedResponse, RmsUserIpRow, GeoInfo, SharedIpGroup, SharedIpUser,
    RmsMapPoint, RmsAlertOut, RmsSummary,
)

_log = logging.getLogger("uvicorn.error")

LOOKBACK_DAYS = 30  # keep in sync with rms_engine.LOOKBACK_DAYS

_WINDOW = f"now() - interval '{LOOKBACK_DAYS} days'"


def _geo_from_row(row, prefix: str = "g_") -> GeoInfo:
    """Build GeoInfo from a result row's geo columns (aliased g_*)."""
    m = row._mapping
    status = m.get(f"{prefix}status")
    return GeoInfo(
        country=m.get(f"{prefix}country"),
        country_code=m.get(f"{prefix}country_code"),
        region=m.get(f"{prefix}region"),
        city=m.get(f"{prefix}city"),
        latitude=float(m[f"{prefix}lat"]) if m.get(f"{prefix}lat") is not None else None,
        longitude=float(m[f"{prefix}lon"]) if m.get(f"{prefix}lon") is not None else None,
        isp=m.get(f"{prefix}isp"),
        status=status or "pending",
    )


def _missing_table(exc: BaseException) -> bool:
    msg = f"{getattr(exc, 'orig', None) or exc}".lower()
    return ("does not exist" in msg or "undefinedtable" in msg) and (
        "ip_geo_cache" in msg or "rms_alerts" in msg or "user_sessions" in msg
    )


async def summary(db: AsyncSession) -> RmsSummary:
    sql = text(
        f"""
        WITH sess AS (
            SELECT user_id, ip_address
            FROM user_sessions
            WHERE ip_address IS NOT NULL AND user_id IS NOT NULL
              AND created_at > {_WINDOW}
        ),
        ipc AS (
            SELECT ip_address, count(DISTINCT user_id) uc
            FROM sess GROUP BY ip_address
        )
        SELECT
            (SELECT count(DISTINCT user_id) FROM sess) AS users_with_ip,
            (SELECT count(*) FROM ipc) AS distinct_ips,
            (SELECT count(*) FROM ipc WHERE uc >= 2) AS shared_ips,
            (SELECT count(*) FROM rms_alerts WHERE status = 'open') AS open_alerts,
            (SELECT count(*) FROM ip_geo_cache WHERE status = 'resolved') AS resolved_ips,
            (SELECT count(*) FROM ipc) - (
                SELECT count(*) FROM ip_geo_cache g
                WHERE g.status = 'resolved'
                  AND g.ip_address IN (SELECT ip_address FROM ipc)
            ) AS unresolved_ips
        """
    )
    try:
        r = (await db.execute(sql)).first()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing_table(exc):
            return RmsSummary()
        raise
    if r is None:
        return RmsSummary()
    return RmsSummary(
        total_users_with_ip=int(r[0] or 0),
        distinct_ips=int(r[1] or 0),
        shared_ip_count=int(r[2] or 0),
        open_alerts=int(r[3] or 0),
        resolved_ips=int(r[4] or 0),
        unresolved_ips=max(0, int(r[5] or 0)),
    )


async def list_user_ips(
    db: AsyncSession,
    page: int,
    per_page: int,
    search: str | None,
    shared_only: bool,
    country: str | None,
) -> PaginatedResponse:
    search_like = f"%{search.strip()}%" if search and search.strip() else None
    params = {
        "search": search_like,
        "shared_only": shared_only,
        "country": (country.strip().upper() if country and country.strip() else None),
        "limit": per_page,
        "offset": (page - 1) * per_page,
    }

    base_cte = f"""
        WITH latest AS (
            SELECT DISTINCT ON (s.user_id) s.user_id, s.ip_address, s.created_at
            FROM user_sessions s
            WHERE s.ip_address IS NOT NULL AND s.user_id IS NOT NULL
              AND s.created_at > {_WINDOW}
            ORDER BY s.user_id, s.created_at DESC
        ),
        ipc AS (
            SELECT ip_address, count(DISTINCT user_id) uc
            FROM user_sessions
            WHERE ip_address IS NOT NULL AND user_id IS NOT NULL
              AND created_at > {_WINDOW}
            GROUP BY ip_address
        ),
        usrc AS (
            SELECT user_id, count(DISTINCT ip_address) ipcnt
            FROM user_sessions
            WHERE ip_address IS NOT NULL AND user_id IS NOT NULL
              AND created_at > {_WINDOW}
            GROUP BY user_id
        )
        SELECT
            l.user_id, host(l.ip_address) AS ip, l.created_at AS last_seen,
            u.email, trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS name,
            u.role, u.status,
            coalesce(ipc.uc, 1) AS uc,
            coalesce(usrc.ipcnt, 1) AS session_count,
            g.country AS g_country, g.country_code AS g_country_code,
            g.region AS g_region, g.city AS g_city,
            g.latitude AS g_lat, g.longitude AS g_lon, g.isp AS g_isp,
            g.status AS g_status
        FROM latest l
        JOIN users u ON u.id = l.user_id
        LEFT JOIN ipc  ON ipc.ip_address = l.ip_address
        LEFT JOIN usrc ON usrc.user_id = l.user_id
        LEFT JOIN ip_geo_cache g ON g.ip_address = l.ip_address
        WHERE (CAST(:search AS text) IS NULL
               OR u.email ILIKE CAST(:search AS text)
               OR trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) ILIKE CAST(:search AS text)
               OR host(l.ip_address) ILIKE CAST(:search AS text))
          AND (CAST(:shared_only AS boolean) = false OR coalesce(ipc.uc, 1) >= 2)
          AND (CAST(:country AS text) IS NULL OR g.country_code = CAST(:country AS text))
    """

    count_sql = text(f"SELECT count(*) FROM ({base_cte}) q")
    page_sql = text(base_cte + " ORDER BY uc DESC, last_seen DESC LIMIT :limit OFFSET :offset")

    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(page_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing_table(exc):
            return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)
        raise

    items = []
    for row in rows:
        m = row._mapping
        items.append(RmsUserIpRow(
            user_id=str(m["user_id"]),
            user_email=m["email"],
            user_name=(m["name"] or "").strip() or None,
            role=m["role"],
            status=m["status"],
            ip_address=m["ip"],
            last_seen=m["last_seen"],
            session_count=int(m["session_count"] or 0),
            shared=int(m["uc"] or 0) >= 2,
            geo=_geo_from_row(row),
        ))
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)


async def list_shared_ips(db: AsyncSession, status_filter: str | None = None) -> list[SharedIpGroup]:
    sql = text(
        f"""
        WITH ipc AS (
            SELECT ip_address, count(DISTINCT user_id) uc, max(created_at) last_seen
            FROM user_sessions
            WHERE ip_address IS NOT NULL AND user_id IS NOT NULL
              AND created_at > {_WINDOW}
            GROUP BY ip_address
            HAVING count(DISTINCT user_id) >= 2
        )
        SELECT host(ipc.ip_address) AS ip, ipc.uc, ipc.last_seen,
               g.country AS g_country, g.country_code AS g_country_code,
               g.region AS g_region, g.city AS g_city,
               g.latitude AS g_lat, g.longitude AS g_lon, g.isp AS g_isp,
               g.status AS g_status,
               a.id AS alert_id, a.status AS alert_status, a.severity AS severity
        FROM ipc
        LEFT JOIN ip_geo_cache g ON g.ip_address = ipc.ip_address
        LEFT JOIN rms_alerts a ON a.alert_type = 'shared_ip' AND a.ip_address = ipc.ip_address
        ORDER BY ipc.uc DESC, ipc.last_seen DESC
        """
    )
    try:
        rows = (await db.execute(sql)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing_table(exc):
            return []
        raise

    groups: list[SharedIpGroup] = []
    for row in rows:
        m = row._mapping
        if status_filter and (m["alert_status"] or "open") != status_filter:
            continue
        ip = m["ip"]
        users = await _users_for_ip(db, ip)
        groups.append(SharedIpGroup(
            ip_address=ip,
            user_count=int(m["uc"] or 0),
            users=users,
            last_seen=m["last_seen"],
            geo=_geo_from_row(row),
            alert_id=str(m["alert_id"]) if m["alert_id"] else None,
            alert_status=m["alert_status"],
            severity=m["severity"],
        ))
    return groups


async def _users_for_ip(db: AsyncSession, ip: str) -> list[SharedIpUser]:
    sql = text(
        f"""
        SELECT DISTINCT u.id, u.email,
               trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS name
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE host(s.ip_address) = :ip AND s.created_at > {_WINDOW}
        ORDER BY u.email
        """
    )
    rows = (await db.execute(sql, {"ip": ip})).all()
    return [
        SharedIpUser(user_id=str(r[0]), email=r[1], name=(r[2] or "").strip() or None)
        for r in rows
    ]


async def map_points(db: AsyncSession, limit: int = 2000) -> list[RmsMapPoint]:
    """One point per user (their latest geo-resolved IP). Users whose IP
    isn't resolved yet are skipped (no coordinates to plot)."""
    sql = text(
        f"""
        WITH latest AS (
            SELECT DISTINCT ON (s.user_id) s.user_id, s.ip_address
            FROM user_sessions s
            WHERE s.ip_address IS NOT NULL AND s.user_id IS NOT NULL
              AND s.created_at > {_WINDOW}
            ORDER BY s.user_id, s.created_at DESC
        ),
        ipc AS (
            SELECT ip_address, count(DISTINCT user_id) uc
            FROM user_sessions
            WHERE ip_address IS NOT NULL AND user_id IS NOT NULL
              AND created_at > {_WINDOW}
            GROUP BY ip_address
        )
        SELECT l.user_id, host(l.ip_address) ip, u.email,
               trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS name,
               g.latitude, g.longitude, g.city, g.country,
               coalesce(ipc.uc, 1) AS uc
        FROM latest l
        JOIN users u ON u.id = l.user_id
        JOIN ip_geo_cache g ON g.ip_address = l.ip_address
        LEFT JOIN ipc ON ipc.ip_address = l.ip_address
        WHERE g.status = 'resolved' AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL
        LIMIT :limit
        """
    )
    try:
        rows = (await db.execute(sql, {"limit": limit})).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing_table(exc):
            return []
        raise
    return [
        RmsMapPoint(
            user_id=str(m["user_id"]),
            user_email=m["email"],
            user_name=(m["name"] or "").strip() or None,
            ip_address=m["ip"],
            latitude=float(m["latitude"]),
            longitude=float(m["longitude"]),
            city=m["city"],
            country=m["country"],
            shared=int(m["uc"] or 0) >= 2,
        )
        for m in (row._mapping for row in rows)
    ]


async def list_alerts(
    db: AsyncSession, page: int, per_page: int, status_filter: str | None,
) -> PaginatedResponse:
    where = ""
    params: dict = {"limit": per_page, "offset": (page - 1) * per_page}
    if status_filter:
        where = "WHERE a.status = :status"
        params["status"] = status_filter

    count_sql = text(f"SELECT count(*) FROM rms_alerts a {where}")
    page_sql = text(
        f"""
        SELECT a.id, a.alert_type, host(a.ip_address) AS ip, a.user_count, a.user_ids,
               a.status, a.severity, a.notes, a.first_seen_at, a.last_seen_at, a.created_at,
               g.country AS g_country, g.country_code AS g_country_code,
               g.region AS g_region, g.city AS g_city,
               g.latitude AS g_lat, g.longitude AS g_lon, g.isp AS g_isp,
               g.status AS g_status
        FROM rms_alerts a
        LEFT JOIN ip_geo_cache g ON g.ip_address = a.ip_address
        {where}
        ORDER BY a.last_seen_at DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(page_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing_table(exc):
            return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)
        raise

    items = []
    for row in rows:
        m = row._mapping
        raw_users = m["user_ids"] or []
        users = [
            SharedIpUser(
                user_id=str(u.get("user_id")), email=u.get("email"), name=u.get("name")
            )
            for u in raw_users if isinstance(u, dict)
        ]
        items.append(RmsAlertOut(
            id=str(m["id"]),
            alert_type=m["alert_type"],
            ip_address=m["ip"],
            user_count=int(m["user_count"] or 0),
            users=users,
            status=m["status"],
            severity=m["severity"],
            notes=m["notes"],
            geo=_geo_from_row(row),
            first_seen_at=m["first_seen_at"],
            last_seen_at=m["last_seen_at"],
            created_at=m["created_at"],
        ))
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)


async def update_alert(
    db: AsyncSession, alert_id: uuid.UUID, status: str, notes: str | None, admin_id: uuid.UUID,
) -> dict:
    now = datetime.now(timezone.utc)
    res = await db.execute(
        text(
            """
            UPDATE rms_alerts
            SET status = :status,
                notes = COALESCE(:notes, notes),
                reviewed_by = :admin_id,
                reviewed_at = :now
            WHERE id = :id
            """
        ),
        {"status": status, "notes": notes, "admin_id": admin_id, "now": now, "id": alert_id},
    )
    if (res.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.commit()
    return {"id": str(alert_id), "status": status}
