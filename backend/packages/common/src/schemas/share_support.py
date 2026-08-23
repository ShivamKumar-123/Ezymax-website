"""Shareable trade cards + support-ticket request schemas.

Two small domains co-located here to keep the schemas package flat —
they're each one or two payloads.
"""
from pydantic import BaseModel, Field


# ─── Trade share cards ──────────────────────────────────────────────


class CreateShareRequest(BaseModel):
    """User taps "Share" on a closed/open position → server generates a
    one-time public link to a rendered card. `display_mode` controls
    which figure is the headline (raw P&L vs ROI vs tick count)."""
    description: str | None = Field(default=None, max_length=140)
    link_description: str | None = Field(default=None, max_length=500)
    display_mode: str = Field(default="pnl")  # pnl | roi | ticks


class CreateAccountShareRequest(BaseModel):
    """Share every trade on one account rather than a single position.

    `scope` picks how much is covered: ``open`` is the account's currently
    open positions (priced live), ``history`` is its whole record — open
    positions plus closed trades. Unlike a single-position share the link
    is not a snapshot: it re-reads the account each time it is viewed.
    """
    scope: str = Field(pattern="^(open|history)$")
    description: str | None = Field(default=None, max_length=140)
    link_description: str | None = Field(default=None, max_length=500)
    display_mode: str = Field(default="pnl")  # pnl | roi | ticks


# ─── Support tickets ────────────────────────────────────────────────


class CreateTicketRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")


class ReplyTicketRequest(BaseModel):
    message: str = Field(min_length=1)
    attachments: list | None = None
