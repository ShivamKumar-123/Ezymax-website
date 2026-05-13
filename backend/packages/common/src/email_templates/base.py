"""Shared HTML scaffolding for every transactional email.

Inline CSS only — Outlook/Gmail/iOS Mail strip <style> blocks.
"""
from __future__ import annotations

from html import escape


_GOLD = "#d6a93d"
_BG = "#0a0a0a"
_CARD = "#141414"
_KV_BG = "#0d0d0d"
_KV_ROW_BORDER = "#222222"
_TEXT = "#f5f5f5"
_TEXT_DIM = "#9a9a9a"
_BORDER = "#2a2a2a"
_BORDER_BRIGHT = "#3a3a3a"


def render_layout(
    *,
    title: str,
    intro: str,
    body_html: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    footer_note: str | None = None,
) -> str:
    """Wraps body content in the standard FXArtha email shell.

    Args:
      title:       big headline at the top of the card (escaped)
      intro:       1-2 line lead under the title (escaped)
      body_html:   pre-rendered HTML for the main content (NOT escaped — caller
                   must trust or pre-escape values)
      cta_label:   if provided, renders the gold button
      cta_url:     target for the CTA
      footer_note: optional disclaimer below the CTA
    """
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
        <div style="text-align:center;margin:32px 0 8px;">
          <a href="{escape(cta_url, quote=True)}"
             style="display:inline-block;padding:14px 28px;border-radius:8px;
                    background:{_GOLD};color:#1a1408;text-decoration:none;
                    font-weight:700;font-size:14px;letter-spacing:0.2px;">
            {escape(cta_label)}
          </a>
        </div>
        """

    footer_block = ""
    if footer_note:
        footer_block = f"""
        <p style="margin:24px 0 0;color:{_TEXT_DIM};font-size:12px;line-height:1.5;">
          {escape(footer_note)}
        </p>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:{_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:{_TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:{_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:{_CARD};
                      border:1px solid {_BORDER};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 12px;border-bottom:1px solid {_BORDER};">
              <span style="font-weight:700;font-size:20px;letter-spacing:0.2px;">
                <span style="color:{_TEXT};">FX</span><span style="color:{_GOLD};">Artha</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:{_TEXT};">
                {escape(title)}
              </h1>
              <p style="margin:0 0 20px;color:{_TEXT_DIM};font-size:14px;line-height:1.6;">
                {escape(intro)}
              </p>
              {body_html}
              {cta_block}
              {footer_block}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid {_BORDER};
                       color:{_TEXT_DIM};font-size:12px;line-height:1.5;">
              FXArtha — Trade without giving your money to any broker.<br>
              You received this because of activity on your FXArtha account.
              Need help? Reply to this email or contact
              <a href="mailto:support@fxartha.com" style="color:{_GOLD};text-decoration:none;">
                support@fxartha.com</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def kv_row(label: str, value: str, *, last: bool = False) -> str:
    """One line in a label/value table for transactional details.

    `last=True` skips the bottom row separator so the last row sits flush
    against the table border instead of doubling up."""
    border_bottom = "" if last else f"border-bottom:1px solid {_KV_ROW_BORDER};"
    return f"""
    <tr>
      <td style="padding:14px 20px;color:{_TEXT_DIM};font-size:13px;
                 width:180px;vertical-align:top;{border_bottom}">{escape(label)}</td>
      <td style="padding:14px 20px;color:{_TEXT};font-size:14px;font-weight:600;
                 font-variant-numeric:tabular-nums;word-break:break-word;{border_bottom}">
        {escape(value)}
      </td>
    </tr>
    """


def kv_table(rows: list[tuple[str, str]]) -> str:
    """Wraps kv_row items into a styled table. Wider padding + brighter
    border + per-row separators so the block stands out clearly against
    the email card surface."""
    last_idx = len(rows) - 1
    inner = "".join(
        kv_row(k, v, last=(i == last_idx)) for i, (k, v) in enumerate(rows)
    )
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-collapse:separate;border-spacing:0;width:100%;
                  border:1px solid {_BORDER_BRIGHT};border-radius:10px;
                  background:{_KV_BG};margin:8px 0;overflow:hidden;">
      {inner}
    </table>
    """
