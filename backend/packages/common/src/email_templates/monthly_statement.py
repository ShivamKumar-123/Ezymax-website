"""Monthly account-statement-available notification.

Fires on the 1st of every month UTC for every active user, telling them
that the previous month's statement is ready to view in the trader app.
"""
from __future__ import annotations

from .base import render_layout


def render_monthly_statement_available(
    *,
    first_name: str | None,
    statement_month_label: str,
    user_uid: str,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    base = trader_app_url.rstrip("/")

    body = f"""
    <p style="margin:0 0 14px;color:#f5f5f5;font-size:14px;line-height:1.65;">
      You can view your latest account statement in the trader dashboard
      under <strong>Wallet → Account statement</strong>.
    </p>
    <p style="margin:0 0 14px;color:#f5f5f5;font-size:14px;line-height:1.65;">
      You can also review your trading and funding history under
      <strong>Trading → History</strong> and <strong>Wallet → Transactions</strong>.
    </p>
    <p style="margin:18px 0 0;color:#9a9a9a;font-size:12px;line-height:1.55;">
      UID: <span style="font-family:Menlo,Consolas,monospace;color:#cfcfcf;">{user_uid}</span>
    </p>
    """

    subject = f"Your account statement for {statement_month_label} is now available"
    html = render_layout(
        title=f"Your account statement for {statement_month_label} is ready",
        intro=f"Hi {name}, your latest FXArtha account statement is now available.",
        body_html=body,
        cta_label="View statement",
        cta_url=f"{base}/wallet",
        footer_note=(
            "If anything looks off, reply to this email and support will "
            "reconcile your records."
        ),
    )

    text_lines = [
        f"Hi {name},",
        "",
        f"Your FXArtha account statement for {statement_month_label} is now available.",
        "",
        "View it in the trader dashboard under Wallet → Account statement.",
        "Trading and funding history live under Trading → History and Wallet → Transactions.",
        "",
        f"UID: {user_uid}",
        "",
        f"Open the dashboard: {base}/wallet",
    ]
    return subject, html, "\n".join(text_lines)
