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
      Open <strong>Portfolio</strong> in the trader dashboard and click
      <strong>Download PDF statement</strong> to get a full record of your
      closed trades, P&amp;L, fees, and commissions.
    </p>
    <p style="margin:0 0 14px;color:#f5f5f5;font-size:14px;line-height:1.65;">
      Funding history (deposits / withdrawals) is available under
      <strong>Wallet → Transactions</strong>.
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
        cta_label="Download statement",
        cta_url=f"{base}/portfolio",
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
        "Open Portfolio in the trader dashboard and click 'Download PDF statement'.",
        "Funding history (deposits / withdrawals) lives under Wallet → Transactions.",
        "",
        f"UID: {user_uid}",
        "",
        f"Open the dashboard: {base}/portfolio",
    ]
    return subject, html, "\n".join(text_lines)
