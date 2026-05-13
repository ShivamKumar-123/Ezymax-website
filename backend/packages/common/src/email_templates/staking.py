from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


def render_staking_digest(
    *,
    first_name: str | None,
    period_label: str,
    accrued_amount: Decimal | float,
    staked_principal: Decimal | float,
    apy_pct: float,
    period_end: str,
    currency: str = "USD",
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Period", period_label),
        ("Period end", period_end),
        ("Staked principal", _fmt_money(staked_principal, currency)),
        ("APY", f"{apy_pct:,.2f}%"),
        ("Earned", _fmt_money(accrued_amount, currency)),
    ]
    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      Earnings accrue hourly and compound back into your stake. Withdraw any
      time after the lock period from the Staking page.
    </p>
    """
    subject = f"Staking summary — {period_label} (+{_fmt_money(accrued_amount, currency)})"
    html = render_layout(
        title=f"Staking earnings — {period_label}",
        intro=f"Hi {name}, here's how your stake performed this {period_label.lower()}.",
        body_html=body,
        cta_label="Open Staking",
        cta_url=f"{trader_app_url.rstrip('/')}/earn/staking",
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"Staking summary — {period_label} ending {period_end}.",
        "",
        f"Staked principal: {_fmt_money(staked_principal, currency)}",
        f"APY:              {apy_pct:,.2f}%",
        f"Earned:           {_fmt_money(accrued_amount, currency)}",
        "",
        f"View staking: {trader_app_url.rstrip('/')}/earn/staking",
    ]
    return subject, html, "\n".join(text_lines)
