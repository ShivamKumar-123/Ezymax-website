from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


def render_deposit_confirmed(
    *,
    first_name: str | None,
    amount: Decimal | float,
    currency: str = "USD",
    method: str | None = None,
    reference: str | None = None,
    new_balance: Decimal | float | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Amount", _fmt_money(amount, currency)),
    ]
    if method:
        rows.append(("Method", method))
    if reference:
        rows.append(("Reference", reference))
    if new_balance is not None:
        rows.append(("New balance", _fmt_money(new_balance, currency)))

    body = kv_table(rows)
    subject = f"Deposit confirmed — {_fmt_money(amount, currency)}"
    html = render_layout(
        title="Deposit confirmed",
        intro=f"Hi {name}, your deposit has cleared and is now in your main wallet.",
        body_html=body,
        cta_label="View Wallet",
        cta_url=f"{trader_app_url.rstrip('/')}/wallet",
        footer_note=(
            "If you didn't make this deposit, contact support@fxartha.com immediately."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        "Your deposit has cleared and is now in your main wallet.",
        "",
        f"Amount: {_fmt_money(amount, currency)}",
    ]
    if method:
        text_lines.append(f"Method: {method}")
    if reference:
        text_lines.append(f"Reference: {reference}")
    if new_balance is not None:
        text_lines.append(f"New balance: {_fmt_money(new_balance, currency)}")
    text_lines += [
        "",
        f"View your wallet: {trader_app_url.rstrip('/')}/wallet",
        "",
        "Didn't make this deposit? Email support@fxartha.com immediately.",
    ]
    return subject, html, "\n".join(text_lines)
