from __future__ import annotations

from .base import render_layout


def render_welcome(
    *,
    first_name: str | None,
    trader_app_url: str,
    via_google: bool = False,
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    intro = (
        "Welcome to FXArtha. Your account is ready — your funds stay in "
        "your wallet, the system handles execution."
    )
    next_steps = """
    <p style="margin:0 0 12px;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Here's what to do next:
    </p>
    <ul style="margin:0 0 8px;padding-left:20px;color:#f5f5f5;font-size:14px;line-height:1.7;">
      <li>Open your first trading account from the dashboard</li>
      <li>Complete KYC to unlock higher leverage tiers</li>
      <li>Visit the Earn hub — daily streak, tasks, spin &amp; win, staking</li>
      <li>Try the demo account if you want to practise risk-free</li>
    </ul>
    """
    if via_google:
        next_steps = (
            '<p style="margin:0 0 12px;color:#9a9a9a;font-size:13px;">'
            "You signed in with Google — no password to remember. "
            "You can add one later from your profile if you want."
            "</p>"
        ) + next_steps

    subject = "Welcome to FXArtha"
    html = render_layout(
        title=f"Welcome aboard, {name}.",
        intro=intro,
        body_html=next_steps,
        cta_label="Open Dashboard",
        cta_url=f"{trader_app_url.rstrip('/')}/accounts",
        footer_note=(
            "If you didn't create this account, contact support@fxartha.com immediately."
        ),
    )
    text = (
        f"Welcome to FXArtha, {name}.\n\n"
        "Your account is ready. Get started:\n"
        "  - Open your first trading account from the dashboard\n"
        "  - Complete KYC to unlock higher leverage tiers\n"
        "  - Visit the Earn hub for tasks, spin, and staking\n"
        "  - Try the demo account if you want to practise risk-free\n\n"
        f"Open your dashboard: {trader_app_url.rstrip('/')}/accounts\n\n"
        "Didn't create this account? Email support@fxartha.com immediately.\n"
    )
    return subject, html, text
