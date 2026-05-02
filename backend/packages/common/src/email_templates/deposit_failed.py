from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


_HUMAN_REASON: dict[str, str] = {
    "expired": (
        "The payment window expired before the network confirmed your "
        "transaction. No funds have been credited."
    ),
    "failed": (
        "The processor reported the payment as failed. No funds have been "
        "credited."
    ),
    "refunded": (
        "The payment was refunded by the processor. No funds were credited."
    ),
    "partially_paid": (
        "We received less than the requested amount, so the deposit was "
        "automatically rejected to prevent partial credit. If you've already "
        "sent the remainder, contact support and we'll reconcile manually."
    ),
}


def render_deposit_failed(
    *,
    first_name: str | None,
    amount: Decimal | float,
    currency: str = "USD",
    method: str | None = None,
    reason_code: str,
    reference: str | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    human = _HUMAN_REASON.get(reason_code, f"The deposit was rejected ({reason_code}).")
    rows: list[tuple[str, str]] = [
        ("Amount", _fmt_money(amount, currency)),
        ("Status", reason_code.replace("_", " ").title()),
    ]
    if method:
        rows.append(("Method", method))
    if reference:
        rows.append(("Reference", reference))

    body = kv_table(rows) + f"""
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      {human}
    </p>
    """
    subject = "Deposit not completed"
    html = render_layout(
        title="Deposit not completed",
        intro=f"Hi {name}, we couldn't credit your most recent deposit.",
        body_html=body,
        cta_label="Try again",
        cta_url=f"{trader_app_url.rstrip('/')}/wallet",
        footer_note=(
            "If you believe funds left your wallet but weren't credited, "
            "reply to this email with the on-chain transaction hash and "
            "support will reconcile manually."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        "We couldn't credit your most recent deposit.",
        "",
        f"Amount: {_fmt_money(amount, currency)}",
        f"Status: {reason_code.replace('_', ' ').title()}",
    ]
    if method:
        text_lines.append(f"Method: {method}")
    if reference:
        text_lines.append(f"Reference: {reference}")
    text_lines += [
        "",
        human,
        "",
        f"Try again: {trader_app_url.rstrip('/')}/wallet",
    ]
    return subject, html, "\n".join(text_lines)
