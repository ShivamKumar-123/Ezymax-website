from __future__ import annotations

from .base import render_layout, platform_name


def render_password_reset(
    *,
    code: str,
    app_name: str | None = None,
    expires_in_minutes: int = 15,
) -> tuple[str, str, str]:
    # Default to the active tenant brand (or the platform) when the
    # caller doesn't pin a name explicitly.
    app_name = app_name or platform_name()
    subject = f"Your {app_name} password reset code"
    body = f"""
    <p style="margin:0 0 16px;color:#f5f5f5;font-size:14px;line-height:1.6;">
      You requested a password reset for your {app_name} account. Enter this
      code in the app to choose a new password.
    </p>
    <div style="margin:0 0 16px;text-align:center;">
      <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:8px;
        color:#ffffff;background:#1f1f1f;border:1px solid #333;border-radius:10px;
        padding:14px 22px;font-family:monospace;">{code}</span>
    </div>
    <p style="margin:0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      This code expires in {expires_in_minutes} minutes. If you didn't request
      this, you can ignore this email — your password stays unchanged.
    </p>
    """
    html = render_layout(
        title="Password reset code",
        intro="Use the code below to reset your password.",
        body_html=body,
        footer_note="For security, never share this code with anyone.",
    )
    text = (
        f"Your {app_name} password reset code is: {code}\n\n"
        f"Enter it in the app to choose a new password (expires in {expires_in_minutes} minutes).\n\n"
        "If you didn't request this, ignore this email.\n"
    )
    return subject, html, text
