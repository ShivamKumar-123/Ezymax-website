from __future__ import annotations

from .base import render_layout, kv_table


def render_new_login(
    *,
    first_name: str | None,
    ip_address: str | None,
    user_agent: str | None,
    location: str | None,
    when_utc: str,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [("When (UTC)", when_utc)]
    if location:
        rows.append(("Approx. location", location))
    if ip_address:
        rows.append(("IP address", ip_address))
    if user_agent:
        rows.append(("Device", _shorten(user_agent, 80)))

    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      If this was you, no action needed. If you don't recognise this sign-in,
      change your password and review active sessions immediately.
    </p>
    """
    subject = "New sign-in to your FXArtha account"
    html = render_layout(
        title="Sign-in detected",
        intro=f"Hi {name}, we just recorded a sign-in to your FXArtha account.",
        body_html=body,
        cta_label="Review account security",
        cta_url=f"{trader_app_url.rstrip('/')}/profile/security",
        footer_note=(
            "Wasn't you? Change your password right away and reply to this email "
            "so support can lock the account."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        "A sign-in to your FXArtha account was just recorded.",
        "",
        f"When (UTC): {when_utc}",
    ]
    if location:
        text_lines.append(f"Approx. location: {location}")
    if ip_address:
        text_lines.append(f"IP address: {ip_address}")
    if user_agent:
        text_lines.append(f"Device: {_shorten(user_agent, 80)}")
    text_lines += [
        "",
        "If this was you, no action needed.",
        "If you don't recognise this device, change your password immediately:",
        f"  {trader_app_url.rstrip('/')}/profile/security",
    ]
    return subject, html, "\n".join(text_lines)


def _shorten(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"
