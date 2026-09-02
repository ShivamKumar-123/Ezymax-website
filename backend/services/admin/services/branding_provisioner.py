"""Custom-domain SSL/nginx provisioner.

Port of stock4x's `workers/tasks/branding.py` Celery task as an asyncio
background job (SwissCresta has no Celery; the admin service's event
loop runs it via asyncio.create_task, shelling out in a thread executor
so the loop never blocks).

provision(user_id):
    1. Append an HTTP server block for the tenant's hostnames to the
       nginx tenants include file (idempotent — skipped if present).
    2. Reload nginx, then run `certbot --nginx -d <hosts>` so Let's
       Encrypt issues a cert AND splices the 443 listener into the same
       block.
    3. Reload nginx again (cheap insurance), flip the profile to READY.

teardown(domain):
    Delete the cert (best-effort) and drop the server block + reload.

Requires (production host): passwordless sudo for certbot + nginx —
same ops contract stock4x documents. When BRANDING_NGINX_TENANTS_FILE
is unset (dev / Windows), the provisioner records status transitions
only and logs what it WOULD have done, so the wizard flow is fully
testable locally.
"""
import asyncio
import logging
import re
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import BrokerProfile
from packages.common.src import broker_tenancy
from packages.common.src.models.broker import (
    DOMAIN_STATUS_FAILED,
    DOMAIN_STATUS_PROVISIONING,
    DOMAIN_STATUS_READY,
)

logger = logging.getLogger("branding-provisioner")
settings = get_settings()

_BLOCK_BEGIN = "# BEGIN swisscresta-tenant {domain}"
_BLOCK_END = "# END swisscresta-tenant {domain}"


def _server_block(server_names: str, upstream: str) -> str:
    return f"""
server {{
    listen 80;
    listen [::]:80;
    server_name {server_names};

    client_max_body_size 25m;

    location / {{
        proxy_pass http://{upstream};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }}
}}
"""


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    logger.info("exec: %s", " ".join(cmd))
    return subprocess.run(cmd, capture_output=True, text=True, timeout=300)


def _sync_provision(domain: str, app_subdomain: str | None) -> str | None:
    """Blocking shell work. Returns an error string, or None on success."""
    tenants_file = settings.BRANDING_NGINX_TENANTS_FILE
    trader_hosts = broker_tenancy.served_hostnames(domain, app_subdomain)
    admin_host = broker_tenancy.admin_hostname(domain)
    # certbot covers every host in one certificate.
    hosts = trader_hosts + [admin_host]
    names = " ".join(trader_hosts)

    if not tenants_file:
        logger.info(
            "BRANDING_NGINX_TENANTS_FILE unset — dev mode, skipping nginx/certbot "
            "for %s (would serve: %s + admin panel on %s)", domain, names, admin_host,
        )
        return None

    path = Path(tenants_file)
    begin = _BLOCK_BEGIN.format(domain=domain)
    end = _BLOCK_END.format(domain=domain)
    existing = path.read_text() if path.exists() else ""
    if begin not in existing:
        with path.open("a") as f:
            # Two blocks per tenant: the trader app on their chosen hosts,
            # and the (scoped) admin panel on admin.<domain>.
            f.write(
                f"\n{begin}\n"
                f"{_server_block(names, settings.BRANDING_TRADER_UPSTREAM)}\n"
                f"{_server_block(admin_host, settings.BRANDING_ADMIN_UPSTREAM)}\n"
                f"{end}\n"
            )

    r = _run(["sudo", settings.BRANDING_NGINX_BIN, "-s", "reload"])
    if r.returncode != 0:
        return f"nginx reload failed: {r.stderr.strip()[:400]}"

    certbot_cmd = [
        "sudo", settings.BRANDING_CERTBOT_BIN, "--nginx",
        "--non-interactive", "--agree-tos", "--redirect",
    ]
    if settings.BRANDING_CERTBOT_EMAIL:
        certbot_cmd += ["-m", settings.BRANDING_CERTBOT_EMAIL]
    else:
        certbot_cmd += ["--register-unsafely-without-email"]
    for h in hosts:
        certbot_cmd += ["-d", h]
    r = _run(certbot_cmd)
    if r.returncode != 0:
        return f"certbot failed: {(r.stderr or r.stdout).strip()[:400]}"

    _run(["sudo", settings.BRANDING_NGINX_BIN, "-s", "reload"])
    return None


def _sync_teardown(domain: str, app_subdomain: str | None) -> None:
    tenants_file = settings.BRANDING_NGINX_TENANTS_FILE
    if not tenants_file:
        logger.info("dev mode — skipping teardown for %s", domain)
        return
    hosts = broker_tenancy.served_hostnames(domain, app_subdomain) + [
        broker_tenancy.admin_hostname(domain)
    ]
    cert_name = hosts[0]
    _run([
        "sudo", settings.BRANDING_CERTBOT_BIN, "delete",
        "--non-interactive", "--cert-name", cert_name,
    ])
    path = Path(tenants_file)
    if path.exists():
        begin = _BLOCK_BEGIN.format(domain=domain)
        end = _BLOCK_END.format(domain=domain)
        content = path.read_text()
        pattern = re.compile(
            re.escape(begin) + r".*?" + re.escape(end) + r"\n?", re.DOTALL
        )
        new_content = pattern.sub("", content)
        if new_content != content:
            path.write_text(new_content)
            _run(["sudo", settings.BRANDING_NGINX_BIN, "-s", "reload"])


async def _provision(user_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        profile = (
            await db.execute(select(BrokerProfile).where(BrokerProfile.user_id == user_id))
        ).scalar_one_or_none()
        if profile is None or not profile.custom_domain:
            return
        domain, sub = profile.custom_domain, profile.app_subdomain
        profile.custom_domain_status = DOMAIN_STATUS_PROVISIONING
        await db.commit()

    # Containerised deploys (the default) cannot reach host nginx/certbot —
    # the domain stays in 'provisioning' and the HOST agent
    # (scripts/wl-domain-agent.sh, root cron) completes it within a minute
    # and flips the status to ready/failed itself. Set
    # BRANDING_PROVISION_LOCAL=true only when admin-api runs directly on
    # the host with sudo access to nginx+certbot.
    if not getattr(settings, "BRANDING_PROVISION_LOCAL", False):
        logger.info(
            "domain %s marked provisioning — host agent (wl-domain-agent) will complete it",
            domain,
        )
        return

    try:
        error = await asyncio.get_running_loop().run_in_executor(
            None, _sync_provision, domain, sub
        )
    except Exception as e:  # subprocess timeout etc.
        error = f"provisioner crashed: {e}"
        logger.exception("provisioning %s failed", domain)

    async with AsyncSessionLocal() as db:
        profile = (
            await db.execute(select(BrokerProfile).where(BrokerProfile.user_id == user_id))
        ).scalar_one_or_none()
        if profile is None:
            return
        # The admin may have disconnected mid-provision — don't resurrect.
        if profile.custom_domain != domain:
            return
        if error:
            profile.custom_domain_status = DOMAIN_STATUS_FAILED
            profile.custom_domain_last_error = error
        else:
            profile.custom_domain_status = DOMAIN_STATUS_READY
            profile.custom_domain_last_error = None
            profile.custom_domain_provisioned_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("domain %s → %s", domain, profile.custom_domain_status)


def schedule_provision(user_id: uuid.UUID) -> None:
    asyncio.create_task(_provision(user_id))


def schedule_teardown(domain: str, app_subdomain: str | None) -> None:
    # Agent mode (default): the host agent reconciles — any tenant nginx
    # block whose domain is no longer active in broker_profiles is
    # removed and its certificate deleted on the next cron tick.
    if not getattr(settings, "BRANDING_PROVISION_LOCAL", False):
        logger.info("domain %s disconnected — host agent will tear it down", domain)
        return

    async def _run_teardown():
        try:
            await asyncio.get_running_loop().run_in_executor(
                None, _sync_teardown, domain, app_subdomain
            )
        except Exception:
            logger.exception("teardown for %s failed (non-fatal)", domain)
    asyncio.create_task(_run_teardown())
