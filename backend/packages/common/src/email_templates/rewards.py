from __future__ import annotations

from decimal import Decimal

from .base import render_layout, kv_table


def _fmt_money(amount: Decimal | float, currency: str = "USD") -> str:
    a = float(amount or 0)
    return f"${a:,.2f}" if currency.upper() == "USD" else f"{a:,.2f} {currency.upper()}"


def render_mission_completed(
    *,
    first_name: str | None,
    mission_title: str,
    reward_xp: int | None,
    reward_amount: Decimal | float | None,
    reward_currency: str = "USD",
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = [("Mission", mission_title)]
    if reward_xp:
        rows.append(("XP earned", f"+{reward_xp:,} XP"))
    if reward_amount:
        rows.append(("Reward", _fmt_money(reward_amount, reward_currency)))

    body = kv_table(rows) + """
    <p style="margin:16px 0 0;color:#9a9a9a;font-size:13px;line-height:1.6;">
      Keep climbing the ranks — more missions are waiting in the Earn hub.
    </p>
    """
    subject = f"Mission completed — {mission_title}"
    html = render_layout(
        title="Mission completed",
        intro=f"Nice work, {name}. You finished a mission.",
        body_html=body,
        cta_label="Open Earn hub",
        cta_url=f"{trader_app_url.rstrip('/')}/earn",
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"Mission completed: {mission_title}",
    ]
    if reward_xp:
        text_lines.append(f"XP earned:  +{reward_xp:,} XP")
    if reward_amount:
        text_lines.append(f"Reward:     {_fmt_money(reward_amount, reward_currency)}")
    text_lines += [
        "",
        f"More missions: {trader_app_url.rstrip('/')}/earn",
    ]
    return subject, html, "\n".join(text_lines)


def render_tier_upgraded(
    *,
    first_name: str | None,
    new_tier: str,
    previous_tier: str | None,
    perks: list[str] | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    perks = perks or []
    perks_html = ""
    if perks:
        items = "".join(
            f'<li>{p}</li>' for p in perks
        )
        perks_html = f"""
        <p style="margin:0 0 8px;color:#f5f5f5;font-size:14px;line-height:1.6;">
          New perks unlocked at <strong>{new_tier}</strong>:
        </p>
        <ul style="margin:0;padding-left:20px;color:#f5f5f5;font-size:14px;line-height:1.7;">
          {items}
        </ul>
        """
    rows: list[tuple[str, str]] = [("New tier", new_tier)]
    if previous_tier:
        rows.append(("Previous tier", previous_tier))

    body = kv_table(rows) + perks_html
    subject = f"Tier upgrade — welcome to {new_tier}"
    html = render_layout(
        title=f"Welcome to {new_tier}",
        intro=f"Congrats {name} — your trading activity earned you a tier upgrade.",
        body_html=body,
        cta_label="View your tier",
        cta_url=f"{trader_app_url.rstrip('/')}/earn/tier",
    )
    text_lines = [
        f"Hi {name},",
        "",
        f"Tier upgraded: {previous_tier or 'previous'} -> {new_tier}",
    ]
    if perks:
        text_lines += ["", "New perks unlocked:"] + [f"  - {p}" for p in perks]
    text_lines += [
        "",
        f"View your tier: {trader_app_url.rstrip('/')}/earn/tier",
    ]
    return subject, html, "\n".join(text_lines)
