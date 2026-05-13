from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


def render_withdrawal_requested(
    *,
    first_name: str | None,
    amount: Decimal | float,
    currency: str = "USD",
    method: str | None = None,
    destination: str | None = None,
    request_id: str | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Amount", _fmt_money(amount, currency)),
    ]
    if method:
        rows.append(("Method", method))
    if destination:
        rows.append(("Destination", destination))
    if request_id:
        rows.append(("Request ID", request_id))
    rows.append(("Status", "Pending review"))

    subject = f"Withdrawal requested — {_fmt_money(amount, currency)}"
    html = render_layout(
        title="Withdrawal request received",
        intro=(
            f"Hi {name}, we've received your withdrawal request. "
            "Our team typically processes it within 24 business hours."
        ),
        body_html=kv_table(rows),
        cta_label="Track in Wallet",
        cta_url=f"{trader_app_url.rstrip('/')}/wallet",
        footer_note="You'll get another email when the withdrawal is approved or rejected.",
    )
    text_lines = [
        f"Hi {name},",
        "",
        "We've received your withdrawal request. Our team typically processes it",
        "within 24 business hours.",
        "",
        f"Amount: {_fmt_money(amount, currency)}",
    ]
    if method:
        text_lines.append(f"Method: {method}")
    if destination:
        text_lines.append(f"Destination: {destination}")
    if request_id:
        text_lines.append(f"Request ID: {request_id}")
    text_lines += [
        "Status: Pending review",
        "",
        f"Track in wallet: {trader_app_url.rstrip('/')}/wallet",
        "",
        "Didn't make this request? Email support@fxartha.com immediately.",
    ]
    return subject, html, "\n".join(text_lines)


def render_withdrawal_approved(
    *,
    first_name: str | None,
    amount: Decimal | float,
    currency: str = "USD",
    method: str | None = None,
    destination: str | None = None,
    transaction_hash: str | None = None,
    request_id: str | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Amount", _fmt_money(amount, currency)),
    ]
    if method:
        rows.append(("Method", method))
    if destination:
        rows.append(("Destination", destination))
    if transaction_hash:
        rows.append(("Transaction", transaction_hash))
    if request_id:
        rows.append(("Request ID", request_id))
    rows.append(("Status", "Approved"))

    subject = f"Withdrawal approved — {_fmt_money(amount, currency)}"
    html = render_layout(
        title="Withdrawal approved",
        intro=(
            f"Hi {name}, your withdrawal has been approved and sent to your "
            "chosen destination."
        ),
        body_html=kv_table(rows),
        cta_label="View Wallet",
        cta_url=f"{trader_app_url.rstrip('/')}/wallet",
        footer_note=(
            "Bank withdrawals can take 1-3 business days to settle. Crypto "
            "withdrawals are usually instant after on-chain confirmation."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        "Your withdrawal has been approved and sent to your chosen destination.",
        "",
        f"Amount: {_fmt_money(amount, currency)}",
    ]
    if method:
        text_lines.append(f"Method: {method}")
    if destination:
        text_lines.append(f"Destination: {destination}")
    if transaction_hash:
        text_lines.append(f"Transaction: {transaction_hash}")
    if request_id:
        text_lines.append(f"Request ID: {request_id}")
    text_lines += [
        "Status: Approved",
        "",
        f"View wallet: {trader_app_url.rstrip('/')}/wallet",
    ]
    return subject, html, "\n".join(text_lines)


def render_withdrawal_rejected(
    *,
    first_name: str | None,
    amount: Decimal | float,
    currency: str = "USD",
    reason: str | None = None,
    request_id: str | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [
        ("Amount", _fmt_money(amount, currency)),
    ]
    if request_id:
        rows.append(("Request ID", request_id))
    rows.append(("Status", "Rejected"))
    if reason:
        rows.append(("Reason", reason))

    subject = f"Withdrawal rejected — {_fmt_money(amount, currency)}"
    body = kv_table(rows) + (
        '<p style="margin:18px 0 0;color:#9a9a9a;font-size:13px;line-height:1.6;">'
        "Your funds have been returned to your main wallet. You can submit a "
        "new withdrawal request once you've addressed the issue above, or "
        "contact support if anything is unclear."
        "</p>"
    )
    html = render_layout(
        title="Withdrawal rejected",
        intro=f"Hi {name}, we couldn't process this withdrawal — see details below.",
        body_html=body,
        cta_label="Contact Support",
        cta_url="mailto:support@fxartha.com",
    )
    text_lines = [
        f"Hi {name},",
        "",
        "We couldn't process this withdrawal.",
        "",
        f"Amount: {_fmt_money(amount, currency)}",
    ]
    if request_id:
        text_lines.append(f"Request ID: {request_id}")
    text_lines.append("Status: Rejected")
    if reason:
        text_lines.append(f"Reason: {reason}")
    text_lines += [
        "",
        "Your funds have been returned to your main wallet. Submit a new request",
        "once the issue is resolved, or email support@fxartha.com for help.",
    ]
    return subject, html, "\n".join(text_lines)
