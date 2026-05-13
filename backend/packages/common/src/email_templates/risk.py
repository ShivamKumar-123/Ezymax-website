from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


def render_margin_call(
    *,
    first_name: str | None,
    account_number: str,
    margin_level_pct: float,
    equity: Decimal | float,
    used_margin: Decimal | float,
    free_margin: Decimal | float,
    currency: str = "USD",
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Account", account_number),
        ("Margin level", f"{margin_level_pct:,.1f}%"),
        ("Equity", _fmt_money(equity, currency)),
        ("Used margin", _fmt_money(used_margin, currency)),
        ("Free margin", _fmt_money(free_margin, currency)),
    ]
    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Your account is approaching the stop-out threshold. To avoid forced
      position closure, do one of the following now:
    </p>
    <ul style="margin:8px 0 0;padding-left:20px;color:#f5f5f5;font-size:14px;line-height:1.7;">
      <li>Add funds to your trading account</li>
      <li>Close one or more open positions</li>
      <li>Reduce position size</li>
    </ul>
    """
    subject = f"Margin call — account {account_number} at {margin_level_pct:.0f}%"
    html = render_layout(
        title="Margin call warning",
        intro=f"Hi {name}, your margin level has dropped into the warning zone.",
        body_html=body,
        cta_label="Open Trading Terminal",
        cta_url=f"{trader_app_url.rstrip('/')}/trade",
        footer_note=(
            "If margin level falls below the stop-out threshold, the system "
            "will automatically close positions starting with the largest loss."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"MARGIN CALL — account {account_number} margin level is {margin_level_pct:,.1f}%.",
        "",
        f"Equity:       {_fmt_money(equity, currency)}",
        f"Used margin:  {_fmt_money(used_margin, currency)}",
        f"Free margin:  {_fmt_money(free_margin, currency)}",
        "",
        "Add funds, close positions, or reduce size to avoid stop-out:",
        f"  {trader_app_url.rstrip('/')}/trade",
    ]
    return subject, html, "\n".join(text_lines)


def render_stop_out(
    *,
    first_name: str | None,
    account_number: str,
    closed_count: int,
    realized_pnl: Decimal | float,
    new_equity: Decimal | float,
    currency: str = "USD",
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    pnl_label = _fmt_money(realized_pnl, currency)
    if float(realized_pnl or 0) > 0:
        pnl_label = "+" + pnl_label
    rows: list[tuple[str, str]] = [
        ("Account", account_number),
        ("Positions closed", str(closed_count)),
        ("Realised P/L", pnl_label),
        ("New equity", _fmt_money(new_equity, currency)),
    ]
    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      The system closed positions automatically because margin level fell
      below the stop-out threshold. Your remaining equity is shown above.
      You can resume trading once you top up the account.
    </p>
    """
    subject = f"Stop-out triggered — account {account_number}"
    html = render_layout(
        title="Stop-out executed",
        intro=f"Hi {name}, positions on your account were closed automatically.",
        body_html=body,
        cta_label="Top up & resume",
        cta_url=f"{trader_app_url.rstrip('/')}/wallet",
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"STOP-OUT triggered on account {account_number}.",
        "",
        f"Positions closed: {closed_count}",
        f"Realised P/L:     {pnl_label}",
        f"New equity:       {_fmt_money(new_equity, currency)}",
        "",
        "Top up your account and resume trading:",
        f"  {trader_app_url.rstrip('/')}/wallet",
    ]
    return subject, html, "\n".join(text_lines)
