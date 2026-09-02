"""Transactional email via SMTP (Hostinger, SES, Gmail, etc.).

Single send path — `send_email(to, subject, html, text)` — used by every
business event (welcome, deposit, withdrawal, password reset). The
old `send_password_reset_email` is kept as a thin wrapper so existing
callers don't change.

The actual `smtplib` call runs in a thread (asyncio.to_thread) so the
event loop isn't blocked while SMTP handshakes.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

from .config import get_settings

logger = logging.getLogger(__name__)

# Inline-attached brand logo. Bundled with the package so we don't depend
# on an outbound URL fetch — every email gets the wordmark whether or not
# the recipient's client has remote-image loading enabled. The CID below
# must match LOGO_CID in email_templates/base.py.
_LOGO_PATH = (
    Path(__file__).parent / "email_templates" / "assets" / "swisscresta-logo.png"
)
_LOGO_CID = "swisscresta-logo"
_LOGO_BYTES: bytes | None = None


def _logo_bytes() -> bytes | None:
    """Read the logo PNG once, cache for the process lifetime. Returns
    None if the file is missing so a packaging hiccup doesn't break sending
    — emails still go out with a broken-image icon instead of a 500."""
    global _LOGO_BYTES
    if _LOGO_BYTES is not None:
        return _LOGO_BYTES
    try:
        _LOGO_BYTES = _LOGO_PATH.read_bytes()
    except FileNotFoundError:
        logger.warning("Email logo missing at %s — emails will render without it", _LOGO_PATH)
        _LOGO_BYTES = b""
    return _LOGO_BYTES or None


def smtp_configured() -> bool:
    s = get_settings()
    return bool(s.SMTP_HOST and str(s.SMTP_HOST).strip())


def _from_address() -> str:
    s = get_settings()
    addr = (s.SMTP_FROM or s.SMTP_USER or "").strip()
    if not addr:
        raise ValueError("SMTP_FROM or SMTP_USER must be set when SMTP_HOST is set")
    return addr


def _send_sync(to_email: str, subject: str, html: str, text: Optional[str]) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _from_address()
    msg["To"] = to_email
    # Always include a plain-text fallback. If the caller didn't give us one,
    # produce a crude strip-tags version of the html so picky clients still
    # render something.
    plain = text if text else _strip_tags(html)
    msg.set_content(plain)
    msg.add_alternative(html, subtype="html")

    # Attach the brand logo as a related inline image so <img src="cid:..."/>
    # in the template renders without an outbound fetch. We modify the HTML
    # alternative part directly (not the outer message) so the structure is
    # multipart/alternative {plain, multipart/related {html, image}}.
    # SKIPPED when the html doesn't reference the CID — white-label tenant
    # emails render a text header instead of the platform logo, and an
    # unreferenced inline attachment shows up as a paperclip in Outlook.
    logo = _logo_bytes() if f"cid:{_LOGO_CID}" in html else None
    if logo:
        html_part = msg.get_payload()[-1]
        html_part.add_related(
            logo,
            maintype="image",
            subtype="png",
            cid=f"<{_LOGO_CID}>",
            filename="swisscresta-logo.png",
        )

    host = str(s.SMTP_HOST).strip()
    port = int(s.SMTP_PORT)
    user = (s.SMTP_USER or "").strip()
    pwd = (s.SMTP_PASSWORD or "").strip()

    # Port 465 = implicit TLS (SMTPS) — needs SMTP_SSL which negotiates
    # TLS before the SMTP greeting. Port 587 = STARTTLS — connect plain,
    # then upgrade via STARTTLS. Using the wrong class on port 465 hangs
    # because the server waits for a TLS ClientHello while our client
    # waits for the plaintext '220' greeting.
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=30) as server:
            if user:
                server.login(user, pwd)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as server:
            if s.SMTP_USE_TLS:
                server.starttls()
            if user:
                server.login(user, pwd)
            server.send_message(msg)


async def send_email(
    to_email: str,
    subject: str,
    html: str,
    *,
    text: Optional[str] = None,
) -> bool:
    """Send a transactional email. Returns True on success, False on
    misconfiguration or SMTP failure. Never raises — caller can ignore
    the result if they don't care."""
    if not smtp_configured():
        logger.warning("SMTP not configured — skipping email to %s subj=%r", to_email, subject)
        return False
    if not to_email or "@" not in to_email:
        logger.warning("Skipping email — bad recipient %r", to_email)
        return False
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, html, text)
        logger.info("email sent to=%s subj=%r", to_email, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s subj=%r", to_email, subject)
        return False


def fire_and_forget(coro) -> None:
    """Schedule a send_email coroutine on the running loop without awaiting.
    Use from API handlers + services so SMTP latency never delays a response
    and a delivery failure never rolls back a transaction."""
    try:
        asyncio.create_task(coro)
    except RuntimeError:
        # No running loop (sync context) — best-effort fallback.
        try:
            asyncio.run(coro)
        except Exception:
            logger.exception("fire_and_forget fallback failed")


# ─── Plain-text fallback ────────────────────────────────────────────


def _strip_tags(html: str) -> str:
    import re
    # Remove block-level tags as line breaks first so the plaintext is readable.
    txt = re.sub(r"</(p|div|h[1-6]|li|tr)>", "\n", html, flags=re.IGNORECASE)
    txt = re.sub(r"<br\s*/?>", "\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", "", txt)
    # Collapse whitespace.
    txt = re.sub(r"\n\s*\n+", "\n\n", txt)
    return txt.strip()


# ─── Backwards-compat helper used by auth_service.forgot_password ───


async def send_password_reset_email(
    to_email: str, code: str, *, app_name: str = "SwissCresta",
) -> bool:
    from .email_templates import render_password_reset
    subject, html, text = render_password_reset(app_name=app_name, code=code)
    return await send_email(to_email, subject, html, text=text)
