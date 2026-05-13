from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


def render_bonus_credited(
    *,
    first_name: str | None,
    bonus_amount: Decimal | float,
    bonus_label: str,
    currency: str = "USD",
    new_bonus_balance: Decimal | float | None = None,
    expires_at: str | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Bonus", bonus_label),
        ("Amount", _fmt_money(bonus_amount, currency)),
    ]
    if new_bonus_balance is not None:
        rows.append(("New bonus balance", _fmt_money(new_bonus_balance, currency)))
    if expires_at:
        rows.append(("Use before", expires_at))

    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      Bonus funds expand your trading margin. Profit from bonus-funded trades
      converts to cash once you meet the volume requirement on your trading
      account.
    </p>
    """
    subject = f"Bonus credited — {_fmt_money(bonus_amount, currency)}"
    html = render_layout(
        title="Bonus credited",
        intro=f"Hi {name}, a bonus has been added to your account.",
        body_html=body,
        cta_label="Start trading",
        cta_url=f"{trader_app_url.rstrip('/')}/trade",
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"Bonus credited: {bonus_label}",
        f"Amount:         {_fmt_money(bonus_amount, currency)}",
    ]
    if new_bonus_balance is not None:
        text_lines.append(f"New bonus bal:  {_fmt_money(new_bonus_balance, currency)}")
    if expires_at:
        text_lines.append(f"Use before:     {expires_at}")
    text_lines += [
        "",
        f"Start trading: {trader_app_url.rstrip('/')}/trade",
    ]
    return subject, html, "\n".join(text_lines)
