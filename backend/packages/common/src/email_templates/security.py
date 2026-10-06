from __future__ import annotations

from .base import render_layout, kv_table, platform_name


def render_new_login(
    *,
    first_name: str | None,
    ip_address: str | None,
    user_agent: str | None,
    location: str | None,
    when_utc: str,
    trader_app_url: str = "https://trade.ezymex.com",
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
    <p style="margin:18px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      If this was you, no action needed. If you don't recognise this sign-in,
      change your password and reply to this email so support can lock the account.
    </p>
    """
    pn = platform_name()
    subject = f"New sign-in to your {pn} account"
    html = render_layout(
        title="Sign-in detected",
        intro=f"Hi {name}, we just recorded a sign-in to your {pn} account.",
        body_html=body,
        footer_note=(
            "Wasn't you? Change your password right away and reply to this email "
            "so support can lock the account."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"A sign-in to your {pn} account was just recorded.",
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
        "If you don't recognise this sign-in, change your password and reply",
        "to this email so support can lock the account.",
    ]
    return subject, html, "\n".join(text_lines)


def render_account_exists(
    *,
    first_name: str | None,
    trader_app_url: str = "https://trade.ezymex.com",
) -> tuple[str, str, str]:
    """Sent instead of a sign-up code when someone starts registration with
    an address that already has an account (the API answers uniformly, so
    the owner learns about it here — not the person who typed the address)."""
    name = (first_name or "trader").strip() or "trader"
    pn = platform_name()
    base = (trader_app_url or "").rstrip("/") or "https://trade.ezymex.com"
    subject = f"Sign-up attempt for your {pn} account"
    body = """
    <p style="margin:0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Someone (hopefully you) tried to create a new account with this email
      address, but it already belongs to an account. No new account was created.
      If you forgot your password, use "Forgot password" on the sign-in page.
    </p>
    """
    html = render_layout(
        title="You already have an account",
        intro=f"Hi {name}, this email address is already registered on {pn}.",
        body_html=body,
        cta_label="Sign in",
        cta_url=f"{base}/login",
        footer_note="If this wasn't you, you can ignore this email — your account is unchanged.",
    )
    text = "\n".join([
        f"Hi {name},",
        "",
        f"Someone tried to create a new {pn} account with this email address,",
        "but it already belongs to an account. No new account was created.",
        f"Sign in: {base}/login (use 'Forgot password' if needed).",
        "",
        "If this wasn't you, you can ignore this email.",
    ])
    return subject, html, text


def _shorten(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"
