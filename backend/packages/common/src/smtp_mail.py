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
from typing import Optional

from .config import get_settings

logger = logging.getLogger(__name__)


def _sendgrid_configured() -> bool:
    s = get_settings()
    return bool(getattr(s, "SENDGRID_API_KEY", "") and str(s.SENDGRID_API_KEY).strip())


def _resend_configured() -> bool:
    s = get_settings()
    return bool(getattr(s, "RESEND_API_KEY", "") and str(s.RESEND_API_KEY).strip())


def _smtp_transport_configured() -> bool:
    s = get_settings()
    return bool(s.SMTP_HOST and str(s.SMTP_HOST).strip())


def email_configured() -> bool:
    """True when *any* email transport is usable (HTTPS API or SMTP)."""
    return _sendgrid_configured() or _resend_configured() or _smtp_transport_configured()


def smtp_configured() -> bool:
    """Legacy name, now meaning "can we send email at all?".

    ~30 call sites across the gateway, admin and risk-engine use this as
    a gate before composing a message. Widening it here (rather than
    renaming at every site) means a Resend-only deployment — no SMTP_HOST
    set — keeps sending instead of silently skipping every email.
    Prefer `email_configured()` in new code.
    """
    return email_configured()


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

    host = str(s.SMTP_HOST).strip()
    port = int(s.SMTP_PORT)
    user = (s.SMTP_USER or "").strip()
    pwd = (s.SMTP_PASSWORD or "").strip()

    # Two mutually exclusive TLS modes — picking the wrong one hangs until
    # the socket timeout instead of failing fast, which is why a
    # misconfigured port looks like "email silently never arrives":
    #
    #   • Port 465 = implicit TLS (SMTPS). The server expects a TLS
    #     handshake immediately, so plain SMTP must NOT be used and
    #     starttls() must NOT be called. Hostinger and many shared hosts
    #     default to this.
    #   • Port 587 = STARTTLS. Connect in plaintext, then upgrade.
    #
    # Previously only the 587 path existed, so any deployment configured
    # for 465 could never send mail at all.
    use_implicit_ssl = port == 465
    if use_implicit_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=30) as server:
            if user:
                server.login(user, pwd)
            server.send_message(msg)
        return

    with smtplib.SMTP(host, port, timeout=30) as server:
        if s.SMTP_USE_TLS:
            server.starttls()
        if user:
            server.login(user, pwd)
        server.send_message(msg)


async def _send_via_sendgrid(
    to_email: str, subject: str, html: str, text: Optional[str],
) -> None:
    """POST the message to SendGrid's v3 mail/send over HTTPS. Raises on
    any non-2xx (success is 202 Accepted with an empty body)."""
    import httpx

    s = get_settings()
    content = []
    # SendGrid requires text/plain before text/html when both are present.
    content.append({"type": "text/plain", "value": text if text else _strip_tags(html)})
    content.append({"type": "text/html", "value": html})
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": _from_address(), "name": "FXArtha"},
        "subject": subject,
        "content": content,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            str(s.SENDGRID_API_URL).strip(),
            json=payload,
            headers={
                "Authorization": f"Bearer {str(s.SENDGRID_API_KEY).strip()}",
                "Content-Type": "application/json",
            },
        )
    if resp.status_code >= 300:
        # Surface the provider's own message — it names the actual problem
        # (unverified domain, bad key, invalid from-address).
        raise RuntimeError(
            f"SendGrid returned {resp.status_code}: {resp.text[:400]}"
        )


async def _send_via_resend(
    to_email: str, subject: str, html: str, text: Optional[str],
) -> None:
    """POST the message to Resend over HTTPS. Raises on any non-2xx."""
    import httpx

    s = get_settings()
    payload = {
        "from": _from_address(),
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            str(s.RESEND_API_URL).strip(),
            json=payload,
            headers={
                "Authorization": f"Bearer {str(s.RESEND_API_KEY).strip()}",
                "Content-Type": "application/json",
            },
        )
    if resp.status_code >= 300:
        # Surface the provider's own message — it names the actual problem
        # (unverified domain, bad key, invalid from-address).
        raise RuntimeError(
            f"Resend returned {resp.status_code}: {resp.text[:400]}"
        )


async def send_email(
    to_email: str,
    subject: str,
    html: str,
    *,
    text: Optional[str] = None,
) -> bool:
    """Send a transactional email. Returns True on success, False on
    misconfiguration or send failure. Never raises — caller can ignore
    the result if they don't care.

    Transport order: SendGrid (HTTPS) first when configured, then Resend
    (HTTPS), then SMTP. Each is attempted before giving up, so a transient
    failure on the primary still gets the message out if a fallback is
    reachable.
    """
    if not to_email or "@" not in to_email:
        logger.warning("Skipping email — bad recipient %r", to_email)
        return False
    if not email_configured():
        logger.warning(
            "No email transport configured (set SENDGRID_API_KEY, "
            "RESEND_API_KEY or SMTP_HOST) — skipping email to %s subj=%r",
            to_email, subject,
        )
        return False

    if _sendgrid_configured():
        try:
            await _send_via_sendgrid(to_email, subject, html, text)
            logger.info("email sent via sendgrid to=%s subj=%r", to_email, subject)
            return True
        except Exception:
            if _resend_configured() or _smtp_transport_configured():
                logger.warning(
                    "SendGrid send failed for %s subj=%r — trying fallback",
                    to_email, subject, exc_info=True,
                )
            else:
                logger.exception("Failed to send email to %s subj=%r", to_email, subject)
                return False

    if _resend_configured():
        try:
            await _send_via_resend(to_email, subject, html, text)
            logger.info("email sent via resend to=%s subj=%r", to_email, subject)
            return True
        except Exception:
            # Only worth a full traceback if there's no fallback left.
            if _smtp_transport_configured():
                logger.warning(
                    "Resend send failed for %s subj=%r — falling back to SMTP",
                    to_email, subject, exc_info=True,
                )
            else:
                logger.exception("Failed to send email to %s subj=%r", to_email, subject)
                return False

    if not _smtp_transport_configured():
        return False

    try:
        await asyncio.to_thread(_send_sync, to_email, subject, html, text)
        logger.info("email sent via smtp to=%s subj=%r", to_email, subject)
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
    to_email: str, reset_link: str, *, app_name: str = "FXArtha",
) -> bool:
    from .email_templates import render_password_reset
    subject, html, text = render_password_reset(app_name=app_name, reset_link=reset_link)
    return await send_email(to_email, subject, html, text=text)
