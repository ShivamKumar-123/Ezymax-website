#!/usr/bin/env python3
"""SwissCresta health watchdog — the 3am pager.

Runs from cron every 5 minutes on the HOST and checks the things that
have actually broken in production:

  1. gateway /health + trader frontend reachable
  2. every compose service is Up (not restarting / exited)
  3. LIVE PRICE FRESHNESS — the real killer: the Infoway socket can die
     silently, leaving stale quotes that block every order with "No live
     price". Crypto (Binance) is the always-on canary; forex/metals are
     only checked while the forex market is actually open, so a normal
     weekend never pages anyone.
  4. last night's DB backup exists and is recent
  5. SSL certificates (platform + every white-label tenant) not expiring
  6. disk space

Alerting is state-based, not spammy: an email goes out when a check
FLIPS to failing, is repeated at most every REPEAT_HOURS while it stays
broken, and a RECOVERED email is sent when it clears. State lives in
STATE_FILE.

Email uses the platform's own SMTP credentials from /opt/swisscresta/.env
(no new service, no API key). Exit code is always 0 so cron stays quiet;
everything is written to the log.

Install:  sudo ./scripts/install-watchdog-cron.sh
Log:      /var/log/swisscresta-watchdog.log
Test now: sudo python3 scripts/health-watchdog.py --test-email
"""
from __future__ import annotations

import json
import os
import re
import smtplib
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

REPO_DIR = Path(os.environ.get("SWISSCRESTA_DIR", "/opt/swisscresta"))
ENV_FILE = REPO_DIR / ".env"
STATE_FILE = Path("/var/lib/swisscresta-watchdog.json")
COMPOSE = [
    "docker", "compose",
    "-f", str(REPO_DIR / "docker-compose.yml"),
    "-f", str(REPO_DIR / "docker-compose.prod.yml"),
]

# Re-send a still-failing alert at most this often.
REPEAT_HOURS = 6
# A tick older than this means the feed is dead (the refresher republishes
# every 30s, so 5 minutes is far beyond any healthy gap).
TICK_MAX_AGE_SEC = 300
# Warn this many days before a certificate expires (certbot renews at 30).
CERT_WARN_DAYS = 14
# Backups run 03:15 daily; alert if the newest is older than this.
BACKUP_MAX_AGE_HOURS = 30
DISK_WARN_PCT = 88


# ── env ------------------------------------------------------------------

def env_get(key: str, default: str = "") -> str:
    """Read one key from the dotenv file. NOT a shell source — values like
    `SMTP_FROM=Name <a@b>` must never be interpreted by a shell."""
    try:
        for line in ENV_FILE.read_text(errors="replace").splitlines():
            if line.startswith(f"{key}="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                default = v  # last occurrence wins, like docker compose
    except OSError:
        pass
    return default


# ── helpers --------------------------------------------------------------

def run(cmd: list[str], timeout: int = 60) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except Exception as e:  # timeout, missing binary…
        return 1, str(e)


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def forex_market_open(now: datetime | None = None) -> bool:
    """Forex trades Sun 22:00 UTC → Fri 22:00 UTC. Outside that window a
    stale forex tick is NORMAL and must not page anyone."""
    n = now or datetime.now(timezone.utc)
    wd, hour = n.weekday(), n.hour  # Mon=0 … Sun=6
    if wd == 5:                      # Saturday
        return False
    if wd == 4 and hour >= 22:       # Friday close
        return False
    if wd == 6 and hour < 22:        # Sunday before open
        return False
    return True


# ── checks ---------------------------------------------------------------

def check_http(url: str, name: str) -> tuple[bool, str]:
    code, out = run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
                     "-m", "20", url], timeout=30)
    status = out.strip().splitlines()[-1] if out.strip() else "000"
    if code == 0 and status.startswith("2"):
        return True, f"{name} HTTP {status}"
    return False, f"{name} unreachable (HTTP {status})"


def check_containers() -> tuple[bool, str]:
    code, out = run(COMPOSE + ["ps", "--format", "{{.Name}} {{.State}}"], timeout=60)
    if code != 0:
        return False, f"docker compose ps failed: {out.strip()[:200]}"
    bad = [ln for ln in out.strip().splitlines()
           if ln.strip() and not ln.strip().endswith("running")]
    if bad:
        return False, "containers not running: " + "; ".join(b.strip() for b in bad)
    n = len([ln for ln in out.strip().splitlines() if ln.strip()])
    return True, f"all {n} containers running"


def _tick_age(symbol: str) -> float | None:
    """Seconds since the last published tick for `symbol`, or None when the
    key is missing/unparseable."""
    code, out = run(COMPOSE + ["exec", "-T", "redis", "redis-cli", "GET",
                               f"tick:{symbol}"], timeout=45)
    if code != 0 or not out.strip():
        return None
    m = re.search(r'"?ts_ms"?\s*:\s*(\d+)', out)
    if not m:
        return None
    return max(0.0, time.time() - int(m.group(1)) / 1000.0)


def check_prices() -> tuple[bool, str]:
    problems, notes = [], []

    crypto_age = _tick_age("BTCUSD")
    if crypto_age is None:
        problems.append("BTCUSD has no tick at all (crypto feed down)")
    elif crypto_age > TICK_MAX_AGE_SEC:
        problems.append(f"BTCUSD tick is {crypto_age:.0f}s old (crypto feed stalled)")
    else:
        notes.append(f"BTCUSD {crypto_age:.0f}s")

    if forex_market_open():
        fx_age = _tick_age("XAUUSD")
        if fx_age is None:
            problems.append("XAUUSD has no tick (primary feed down) — orders will be rejected")
        elif fx_age > TICK_MAX_AGE_SEC:
            problems.append(
                f"XAUUSD tick is {fx_age:.0f}s old with the market OPEN — "
                "primary feed stalled, orders will be rejected"
            )
        else:
            notes.append(f"XAUUSD {fx_age:.0f}s")
    else:
        notes.append("forex market closed (skipped)")

    if problems:
        return False, "; ".join(problems)
    return True, "prices fresh: " + ", ".join(notes)


def check_backup() -> tuple[bool, str]:
    d = REPO_DIR / "backups" / "db" / "daily"
    dumps = sorted(d.glob("*.dump"), key=lambda p: p.stat().st_mtime, reverse=True) if d.is_dir() else []
    if not dumps:
        return False, "no database backups found in backups/db/daily"
    newest = dumps[0]
    age_h = (time.time() - newest.stat().st_mtime) / 3600
    size_mb = newest.stat().st_size / 1e6
    if age_h > BACKUP_MAX_AGE_HOURS:
        return False, f"newest backup is {age_h:.0f}h old ({newest.name}) — nightly backup not running"
    if size_mb < 1:
        return False, f"newest backup is only {size_mb:.1f}MB ({newest.name}) — likely truncated"
    return True, f"backup {newest.name} ({size_mb:.0f}MB, {age_h:.0f}h old)"


def check_certs() -> tuple[bool, str]:
    """Every live certificate — platform hosts and white-label tenants."""
    live = Path("/etc/letsencrypt/live")
    if not live.is_dir():
        return True, "no local certs (edge-terminated TLS)"
    soon, ok = [], 0
    for cert in sorted(live.glob("*/cert.pem")):
        code, out = run(["openssl", "x509", "-enddate", "-noout", "-in", str(cert)], timeout=20)
        m = re.search(r"notAfter=(.+)", out or "")
        if code != 0 or not m:
            continue
        try:
            exp = datetime.strptime(m.group(1).strip(), "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        days = (exp - datetime.now(timezone.utc)).days
        if days <= CERT_WARN_DAYS:
            soon.append(f"{cert.parent.name} expires in {days}d")
        else:
            ok += 1
    if soon:
        return False, "certificates need attention: " + "; ".join(soon)
    return True, f"{ok} certificate(s) valid"


def check_disk() -> tuple[bool, str]:
    code, out = run(["df", "-P", "/"], timeout=20)
    m = re.search(r"(\d+)%", out or "")
    if code != 0 or not m:
        return True, "disk usage unknown"
    pct = int(m.group(1))
    if pct >= DISK_WARN_PCT:
        return False, f"disk {pct}% full on /"
    return True, f"disk {pct}% used"


CHECKS = [
    ("api", lambda: check_http("https://api.swisscresta.com/health", "api.swisscresta.com/health")),
    ("trader", lambda: check_http("https://trade.swisscresta.com", "trade.swisscresta.com")),
    ("containers", check_containers),
    ("prices", check_prices),
    ("backup", check_backup),
    ("certs", check_certs),
    ("disk", check_disk),
]


# ── alerting -------------------------------------------------------------

def send_email(subject: str, body: str) -> bool:
    host = env_get("SMTP_HOST")
    port = int(env_get("SMTP_PORT", "587") or 587)
    user = env_get("SMTP_USER")
    pwd = env_get("SMTP_PASSWORD")
    sender = env_get("SMTP_FROM") or user
    to = env_get("WATCHDOG_ALERT_EMAIL") or env_get("ADMIN_EMAIL")
    if not (host and user and pwd and to):
        log("email not configured (SMTP_* / ADMIN_EMAIL) — alert not sent")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.set_content(body)
    try:
        with smtplib.SMTP(host, port, timeout=30) as s:
            s.starttls(context=ssl.create_default_context())
            s.login(user, pwd)
            s.send_message(msg)
        log(f"alert emailed to {to}: {subject}")
        return True
    except Exception as e:
        log(f"EMAIL FAILED ({e}) — subject was: {subject}")
        return False


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def save_state(state: dict) -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, indent=1))
    except OSError as e:
        log(f"could not write state file: {e}")


def main() -> int:
    if "--test-email" in sys.argv:
        ok = send_email(
            "[SwissCresta] Watchdog test",
            "This is a test alert from the SwissCresta health watchdog.\n"
            "If you received this, 3am pages will reach you.\n",
        )
        return 0 if ok else 1

    host = socket.gethostname()
    state = load_state()
    now = time.time()
    failing, recovered = [], []

    for key, fn in CHECKS:
        try:
            ok, detail = fn()
        except Exception as e:  # a broken check must never take the watchdog down
            ok, detail = False, f"check crashed: {e}"

        prev = state.get(key, {})
        was_failing = bool(prev.get("failing"))

        if ok:
            log(f"OK   {key}: {detail}")
            if was_failing:
                recovered.append((key, detail))
            state[key] = {"failing": False, "last_ok": now}
        else:
            log(f"FAIL {key}: {detail}")
            last_alert = float(prev.get("last_alert") or 0)
            due = (not was_failing) or (now - last_alert > REPEAT_HOURS * 3600)
            if due:
                failing.append((key, detail))
                state[key] = {"failing": True, "last_alert": now, "since": prev.get("since") or now}
            else:
                state[key] = {"failing": True, "last_alert": last_alert, "since": prev.get("since") or now}

    if failing:
        lines = [f"{len(failing)} check(s) failing on {host}:", ""]
        for key, detail in failing:
            lines.append(f"  [{key}] {detail}")
        lines += [
            "",
            "Useful commands:",
            "  cd /opt/swisscresta && docker compose logs --tail 50 market-data",
            "  docker compose ps",
            "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate market-data",
            "",
            "Full log: /var/log/swisscresta-watchdog.log",
        ]
        send_email(f"[SwissCresta] ALERT: {failing[0][0]} failing", "\n".join(lines))

    if recovered:
        lines = ["Recovered:", ""] + [f"  [{k}] {d}" for k, d in recovered]
        send_email(f"[SwissCresta] Recovered: {recovered[0][0]}", "\n".join(lines))

    save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
