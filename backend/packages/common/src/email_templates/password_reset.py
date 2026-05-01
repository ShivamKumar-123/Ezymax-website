from __future__ import annotations

from .base import render_layout


def render_password_reset(
    *,
    reset_link: str,
    app_name: str = "FXArtha",
    expires_in_minutes: int = 15,
) -> tuple[str, str, str]:
    subject = f"Reset your {app_name} password"
    body = f"""
    <p style="margin:0 0 12px;color:#f5f5f5;font-size:14px;line-height:1.6;">
      You requested a password reset for your {app_name} account.
    </p>
    <p style="margin:0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      The link below expires in {expires_in_minutes} minutes. If you didn't
      request this, you can ignore this email — your password stays unchanged.
    </p>
    """
    html = render_layout(
        title="Reset your password",
        intro="Click the button below to choose a new password.",
        body_html=body,
        cta_label="Reset Password",
        cta_url=reset_link,
        footer_note=(
            "For security, this link only works once. Copy it directly into "
            "your browser — never share it."
        ),
    )
    text = (
        f"You requested a password reset for your {app_name} account.\n\n"
        f"Open this link to choose a new password (expires in {expires_in_minutes} minutes):\n\n"
        f"{reset_link}\n\n"
        "If you didn't request this, ignore this email.\n"
    )
    return subject, html, text
