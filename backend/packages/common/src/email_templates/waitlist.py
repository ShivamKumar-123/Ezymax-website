from __future__ import annotations

from html import escape

from .base import render_layout, kv_table


def render_waitlist_approved(
    *,
    full_name: str | None,
    email: str,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    """Sent when an admin approves a waitlist request. Welcomes the user and
    links to the register + login pages so they can get started."""
    name = (full_name or "trader").strip() or "trader"
    base = trader_app_url.rstrip("/")
    register_url = f"{base}/auth/register"
    login_url = f"{base}/auth/login"

    body = kv_table([("Your email", email)]) + f"""
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Welcome to FX Artha! Your access request has been approved. Create your
      account to get started — use the email above when you sign up.
    </p>
    <p style="margin:16px 0 0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      Already have an account?
      <a href="{escape(login_url, quote=True)}" style="color:#d6a93d;text-decoration:none;">
        Log in here</a>.
    </p>
    """
    subject = "Welcome to FX Artha — you're approved"
    html = render_layout(
        title="You're approved 🎉",
        intro=f"Hi {name}, welcome to FX Artha. Your access request has been approved.",
        body_html=body,
        cta_label="Create your account",
        cta_url=register_url,
        footer_note="If you didn't request access, you can safely ignore this email.",
    )
    text = (
        f"Hi {name},\n\n"
        "Welcome to FX Artha! Your access request has been approved.\n\n"
        f"  Your email: {email}\n\n"
        f"Create your account: {register_url}\n"
        f"Log in:              {login_url}\n\n"
        "Use the email above when you sign up.\n"
    )
    return subject, html, text


def render_waitlist_rejected(
    *,
    full_name: str | None,
    reason: str | None = None,
) -> tuple[str, str, str]:
    """Sent when an admin rejects a waitlist request."""
    name = (full_name or "there").strip() or "there"
    rows: list[tuple[str, str]] = []
    if reason:
        rows.append(("Reason", reason))
    body = (kv_table(rows) if rows else "") + """
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Thank you for your interest in FX Artha. We're unable to grant access at
      this time. You're welcome to reach out if you believe this was a mistake.
    </p>
    """
    subject = "Update on your FX Artha access request"
    html = render_layout(
        title="Access request update",
        intro=f"Hi {name}, thanks for requesting access to FX Artha.",
        body_html=body,
        footer_note="Reply to this email if you have any questions.",
    )
    text_lines = [
        f"Hi {name},",
        "",
        "Thank you for your interest in FX Artha. We're unable to grant access "
        "at this time.",
    ]
    if reason:
        text_lines += ["", f"Reason: {reason}"]
    return subject, html, "\n".join(text_lines)
