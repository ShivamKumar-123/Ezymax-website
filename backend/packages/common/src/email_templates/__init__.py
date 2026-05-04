"""Transactional email templates.

Each template is a pure function that returns (subject, html, text).
Keeping them in code (vs. Jinja files) means no new runtime dependency
and the templates ship inside the gateway image.
"""
from .base import render_layout
from .welcome import render_welcome
from .password_reset import render_password_reset
from .deposit import render_deposit_confirmed
from .deposit_failed import render_deposit_failed
from .withdrawal import (
    render_withdrawal_requested,
    render_withdrawal_approved,
    render_withdrawal_rejected,
)
from .kyc import render_kyc_approved, render_kyc_rejected
from .security import render_new_login
from .risk import render_margin_call, render_stop_out
from .bonus import render_bonus_credited
from .rewards import render_mission_completed, render_tier_upgraded
from .staking import render_staking_digest
from .verification import render_verification_reminder
from .trade_placed import render_trade_placed
from .monthly_statement import render_monthly_statement_available

__all__ = [
    "render_layout",
    "render_welcome",
    "render_password_reset",
    "render_deposit_confirmed",
    "render_deposit_failed",
    "render_withdrawal_requested",
    "render_withdrawal_approved",
    "render_withdrawal_rejected",
    "render_kyc_approved",
    "render_kyc_rejected",
    "render_new_login",
    "render_margin_call",
    "render_stop_out",
    "render_bonus_credited",
    "render_mission_completed",
    "render_tier_upgraded",
    "render_staking_digest",
    "render_verification_reminder",
    "render_trade_placed",
    "render_monthly_statement_available",
]
