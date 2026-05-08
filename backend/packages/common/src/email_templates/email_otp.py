"""Email-verification one-time-passcode template.

Single transactional event: the user (or a wallet-first signup adopting
their first real email) typed an address into the onboarding gate; we
just sent them this code. Subject puts the code in the preview line so
phone clients can read it without opening — most users prefer that.
"""
from __future__ import annotations

from .base import render_layout


def render_email_otp(
    *,
    first_name: str | None,
    code: str,
    ttl_minutes: int = 10,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    base = trader_app_url.rstrip("/")

    body = f"""
    <p style="margin:0 0 16px;color:#f5f5f5;font-size:14px;line-height:1.65;">
      Use the code below to verify this email address. It expires in
      {ttl_minutes} minutes.
    </p>
    <div style="margin:18px 0;padding:18px 12px;border:1px solid #3a3a3a;
                border-radius:10px;background:#0d0d0d;text-align:center;">
      <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:32px;
                font-weight:700;letter-spacing:8px;color:#d6a93d;">
        {code}
      </p>
    </div>
    <p style="margin:12px 0 0;color:#9a9a9a;font-size:12px;line-height:1.55;">
      If you didn't ask for this code, ignore this email — your account is
      still safe.
    </p>
    """

    subject = f"FXArtha verification code: {code}"
    html = render_layout(
        title="Verify your email",
        intro=f"Hi {name}, here's your one-time code to confirm this email on FXArtha.",
        body_html=body,
        footer_note=(
            "This code is valid for one verification only. Do not share it "
            "with anyone — FXArtha staff will never ask you for it."
        ),
    )

    text_lines = [
        f"Hi {name},",
        "",
        "Here's your FXArtha email verification code:",
        "",
        f"   {code}",
        "",
        f"It expires in {ttl_minutes} minutes.",
        "",
        "If you didn't ask for this code, ignore this email.",
        "",
        f"— FXArtha team    {base}",
    ]
    return subject, html, "\n".join(text_lines)
