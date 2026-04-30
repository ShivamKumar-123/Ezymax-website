"""Shared enums + SQLAlchemy Enum bindings, used across multiple model modules."""
import enum

from sqlalchemy import Enum as SAEnum


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PositionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    PARTIALLY_CLOSED = "partially_closed"


class AllocationCopyType(str, enum.Enum):
    """How investor lot size is derived for mirrored trades (per InvestorAllocation)."""

    SIGNAL = "signal"
    PAMM = "pamm"
    MAM = "mam"


order_type_enum = SAEnum(
    OrderType, name="order_type", create_type=False,
    values_callable=lambda e: [x.value for x in e],
)
order_side_enum = SAEnum(
    OrderSide, name="order_side", create_type=False,
    values_callable=lambda e: [x.value for x in e],
)
order_status_enum = SAEnum(
    OrderStatus, name="order_status", create_type=False,
    values_callable=lambda e: [x.value for x in e],
)
position_status_enum = SAEnum(
    PositionStatus, name="position_status", create_type=False,
    values_callable=lambda e: [x.value for x in e],
)
