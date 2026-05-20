"""Staking — open-position request schema.

Other staking endpoints (claim, withdraw, plans list) take no body, so
this is the only inbound schema the service needs.
"""
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class OpenStakingPositionRequest(BaseModel):
    """Open a new stake against a plan with the given USD amount.

    `use_trading_bonus` opts into the locked-plan-only bonus credit:
    the principal stays locked but an equal-amount cash bonus is
    credited to a tagged trading account, unlocking trading volume."""
    plan_id: UUID
    amount: Decimal = Field(gt=0)
    use_trading_bonus: bool = False
