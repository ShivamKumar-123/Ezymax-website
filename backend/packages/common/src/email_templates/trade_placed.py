from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_price(p: Decimal | float | None) -> str:
    if p is None:
        return "—"
    return f"{float(p):,.5f}".rstrip("0").rstrip(".")


def _fmt_lots(lots: Decimal | float) -> str:
    return f"{float(lots):,.2f}"


def render_trade_placed(
    *,
    first_name: str | None,
    symbol: str,
    side: str,
    lots: Decimal | float,
    order_type: str,
    status: str,
    price: Decimal | float | None,
    filled_price: Decimal | float | None,
    stop_loss: Decimal | float | None,
    take_profit: Decimal | float | None,
    when_utc: str,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    side_u = (side or "").upper()
    otype_u = (order_type or "").replace("_", " ").upper()
    status_u = (status or "").upper()

    if status.lower() == "filled" and filled_price is not None:
        headline_price = ("Filled price", _fmt_price(filled_price))
    elif price is not None:
        headline_price = ("Price", _fmt_price(price))
    else:
        headline_price = ("Price", "market")

    rows: list[tuple[str, str]] = [
        ("Instrument", symbol),
        ("Side", side_u),
        ("Order type", otype_u),
        ("Status", status_u),
        ("Volume", f"{_fmt_lots(lots)} lots"),
        headline_price,
    ]
    if stop_loss is not None:
        rows.append(("Stop loss", _fmt_price(stop_loss)))
    if take_profit is not None:
        rows.append(("Take profit", _fmt_price(take_profit)))
    rows.append(("Time (UTC)", when_utc))

    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      If you did not place this order, change your password and contact support
      immediately — someone may have access to your account.
    </p>
    """
    is_filled = status.lower() == "filled"
    title = "Trade filled" if is_filled else "Order placed"
    intro = (
        f"Hi {name}, your {side_u} order on {symbol} was just filled."
        if is_filled
        else f"Hi {name}, your {side_u} {otype_u} order on {symbol} is now active."
    )
    subject = (
        f"Trade filled — {side_u} {symbol}"
        if is_filled
        else f"Order placed — {side_u} {symbol}"
    )

    html = render_layout(
        title=title,
        intro=intro,
        body_html=body,
        cta_label="Open trading dashboard",
        cta_url=f"{trader_app_url.rstrip('/')}/trading",
        footer_note=(
            "Wasn't you? Change your password right away and email "
            "support@fxartha.com so we can lock the account."
        ),
    )

    text_lines = [
        f"Hi {name},",
        "",
        intro.removeprefix(f"Hi {name}, "),
        "",
        f"Instrument: {symbol}",
        f"Side: {side_u}",
        f"Order type: {otype_u}",
        f"Status: {status_u}",
        f"Volume: {_fmt_lots(lots)} lots",
        f"{headline_price[0]}: {headline_price[1]}",
    ]
    if stop_loss is not None:
        text_lines.append(f"Stop loss: {_fmt_price(stop_loss)}")
    if take_profit is not None:
        text_lines.append(f"Take profit: {_fmt_price(take_profit)}")
    text_lines += [
        f"Time (UTC): {when_utc}",
        "",
        f"Open the dashboard: {trader_app_url.rstrip('/')}/trading",
        "",
        "Didn't place this order? Email support@fxartha.com immediately.",
    ]
    return subject, html, "\n".join(text_lines)
