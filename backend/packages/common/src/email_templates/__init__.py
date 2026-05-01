"""Transactional email templates.

Each template is a pure function that returns (subject, html, text).
Keeping them in code (vs. Jinja files) means no new runtime dependency
and the templates ship inside the gateway image.
"""
from .base import render_layout
from .welcome import render_welcome
from .password_reset import render_password_reset
from .deposit import render_deposit_confirmed
from .withdrawal import (
    render_withdrawal_requested,
    render_withdrawal_approved,
    render_withdrawal_rejected,
)

__all__ = [
    "render_layout",
    "render_welcome",
    "render_password_reset",
    "render_deposit_confirmed",
    "render_withdrawal_requested",
    "render_withdrawal_approved",
    "render_withdrawal_rejected",
]
