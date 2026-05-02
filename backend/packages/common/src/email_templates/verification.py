from __future__ import annotations

from .base import render_layout


def render_verification_reminder(
    *,
    first_name: str | None,
    days_since_signup: int,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    intro = (
        "It's been a few days since you joined FXArtha and your account "
        "isn't fully verified yet. Verify now to remove deposit and "
        "withdrawal limits — it takes about 2 minutes."
    )
    body = """
    <p style="margin:0 0 12px;color:#f5f5f5;font-size:14px;line-height:1.6;">
      You'll need:
    </p>
    <ul style="margin:0 0 8px;padding-left:20px;color:#f5f5f5;font-size:14px;line-height:1.7;">
      <li>Government-issued photo ID (passport, driver's licence, national ID)</li>
      <li>A clear selfie holding the ID</li>
      <li>Recent address proof (utility bill, bank statement)</li>
    </ul>
    <p style="margin:16px 0 0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      Approval is usually within 24 hours, often much sooner.
    </p>
    """
    subject = "Finish setting up your FXArtha account"
    html = render_layout(
        title="Complete your verification",
        intro=intro,
        body_html=body,
        cta_label="Verify now",
        cta_url=f"{trader_app_url.rstrip('/')}/profile/kyc",
        footer_note=(
            f"You signed up {days_since_signup} day(s) ago. "
            "We'll send one more reminder if your account stays unverified, "
            "then we'll stop emailing about this."
        ),
    )
    text = (
        f"Hi {name},\n\n"
        "Your FXArtha account isn't fully verified yet. "
        "Verifying takes about 2 minutes and removes deposit / withdrawal limits.\n\n"
        "You'll need:\n"
        "  - Government-issued photo ID\n"
        "  - A clear selfie holding the ID\n"
        "  - Recent address proof\n\n"
        f"Verify now: {trader_app_url.rstrip('/')}/profile/kyc\n"
    )
    return subject, html, text
