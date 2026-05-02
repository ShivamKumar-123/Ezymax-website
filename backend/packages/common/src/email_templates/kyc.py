from __future__ import annotations

from .base import render_layout, kv_table


def render_kyc_approved(
    *,
    first_name: str | None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    body = """
    <p style="margin:0 0 12px;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Now unlocked on your account:
    </p>
    <ul style="margin:0;padding-left:20px;color:#f5f5f5;font-size:14px;line-height:1.7;">
      <li>Higher leverage tiers</li>
      <li>Larger withdrawal limits</li>
      <li>Faster deposit settlement</li>
      <li>Premium rewards eligibility</li>
    </ul>
    """
    subject = "KYC verified — your account is fully unlocked"
    html = render_layout(
        title="Identity verified",
        intro=f"Hi {name}, your KYC documents have been approved.",
        body_html=body,
        cta_label="Open Dashboard",
        cta_url=f"{trader_app_url.rstrip('/')}/dashboard",
    )
    text = (
        f"Hi {name},\n\n"
        "Your KYC has been approved. Now unlocked:\n"
        "  - Higher leverage tiers\n"
        "  - Larger withdrawal limits\n"
        "  - Faster deposit settlement\n"
        "  - Premium rewards eligibility\n\n"
        f"Open your dashboard: {trader_app_url.rstrip('/')}/dashboard\n"
    )
    return subject, html, text


def render_kyc_rejected(
    *,
    first_name: str | None,
    reason: str | None = None,
    trader_app_url: str = "https://trade.fxartha.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    rows: list[tuple[str, str]] = []
    if reason:
        rows.append(("Reason", reason))
    body = (kv_table(rows) if rows else "") + """
    <p style="margin:16px 0 0;color:#f5f5f5;font-size:14px;line-height:1.6;">
      Please re-upload corrected documents from the KYC page. Common fixes:
    </p>
    <ul style="margin:8px 0 0;padding-left:20px;color:#f5f5f5;font-size:14px;line-height:1.7;">
      <li>All four corners of the document visible</li>
      <li>Clear, readable photo (no glare or blur)</li>
      <li>Address proof issued within the last 3 months</li>
      <li>Selfie matching the photo on the ID</li>
    </ul>
    """
    subject = "KYC needs another look — action required"
    html = render_layout(
        title="KYC verification rejected",
        intro=f"Hi {name}, we couldn't verify your KYC documents on this attempt.",
        body_html=body,
        cta_label="Re-upload documents",
        cta_url=f"{trader_app_url.rstrip('/')}/profile/kyc",
        footer_note=(
            "Most rejections are resolved on the second attempt. "
            "Reply to this email if you'd like help."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        "We couldn't verify your KYC documents on this attempt.",
    ]
    if reason:
        text_lines += ["", f"Reason: {reason}"]
    text_lines += [
        "",
        "Common fixes:",
        "  - All four corners of the document visible",
        "  - Clear, readable photo (no glare or blur)",
        "  - Address proof issued within the last 3 months",
        "  - Selfie matching the photo on the ID",
        "",
        f"Re-upload here: {trader_app_url.rstrip('/')}/profile/kyc",
    ]
    return subject, html, "\n".join(text_lines)
