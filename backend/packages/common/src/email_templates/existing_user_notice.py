from __future__ import annotations

from .base import render_layout


def render_existing_user_login_notice(
    *,
    full_name: str | None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    """One-off notice to existing users: the marketing site is now invite-only
    (waitlist) for new signups, so point returning users straight at login."""
    name = (full_name or "trader").strip() or "trader"
    login_url = f"{trader_app_url.rstrip('/')}/auth/login"

    body = """
    <p style="margin:0 0 12px;color:#f5f5f5;font-size:14px;line-height:1.6;">
      We've refreshed FX Artha. Your account, balances and positions are exactly
      where you left them — nothing has changed for you.
    </p>
    <p style="margin:0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Just log in with your usual email and password to continue trading.
    </p>
    """
    subject = "Log in to FX Artha"
    html = render_layout(
        title="Welcome back",
        intro=f"Hi {name}, here's your quick link back into FX Artha.",
        body_html=body,
        cta_label="Log in",
        cta_url=login_url,
        footer_note=(
            "Forgot your password? Use the 'Forgot password' link on the login "
            "page. If you didn't expect this email, you can ignore it."
        ),
    )
    text = (
        f"Hi {name},\n\n"
        "We've refreshed FX Artha. Your account, balances and positions are "
        "exactly where you left them.\n\n"
        f"Log in to continue trading: {login_url}\n\n"
        "Forgot your password? Use the 'Forgot password' link on the login page.\n"
    )
    return subject, html, text
