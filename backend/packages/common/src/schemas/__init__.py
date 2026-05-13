"""Pydantic schemas — split into per-domain modules.

Importers continue to use `from packages.common.src.schemas import X` exactly
as before. Every name from the legacy single-file `schemas.py` is re-exported
here so call sites don't change.
"""

from .auth import (
    RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest,
    BootstrapSessionRequest, OpenLiveAccountRequest, GoogleAuthRequest,
    WalletNonceRequest, WalletNonceResponse, WalletVerifyRequest,
    TokenResponse, UserResponse, MessageResponse,
)
from .trading import (
    TradingAccountResponse, AccountSummary,
    PlaceOrderRequest, ModifyOrderRequest, OrderResponse,
    PositionResponse, ClosePositionRequest, ModifyPositionRequest,
)
from .wallet import (
    DepositRequest, WithdrawalRequest,
    TransferTradingToMainRequest, TransferMainToTradingRequest,
    InternalWalletTransferRequest,
    DepositResponse, WithdrawalResponse, BankAccountCreate,
)
from .market import TickData, OHLCVBar, InstrumentResponse
from .admin import AdminFundAdjustment, AdminTradeCreate, AdminModifyTrade
from .common import PaginationParams, PaginatedResponse
from .insurance import (
    InsuranceQuoteRequest, InsuranceTierQuote,
    InsuranceActivateRequest, InsuranceActivateResponse,
    InsurancePolicyOut, InsuranceClaimOut,
)


__all__ = [
    # auth
    "RegisterRequest", "LoginRequest", "ForgotPasswordRequest", "ResetPasswordRequest",
    "BootstrapSessionRequest", "OpenLiveAccountRequest", "GoogleAuthRequest",
    "WalletNonceRequest", "WalletNonceResponse", "WalletVerifyRequest",
    "TokenResponse", "UserResponse", "MessageResponse",
    # trading
    "TradingAccountResponse", "AccountSummary",
    "PlaceOrderRequest", "ModifyOrderRequest", "OrderResponse",
    "PositionResponse", "ClosePositionRequest", "ModifyPositionRequest",
    # wallet
    "DepositRequest", "WithdrawalRequest",
    "TransferTradingToMainRequest", "TransferMainToTradingRequest",
    "InternalWalletTransferRequest",
    "DepositResponse", "WithdrawalResponse", "BankAccountCreate",
    # market
    "TickData", "OHLCVBar", "InstrumentResponse",
    # admin
    "AdminFundAdjustment", "AdminTradeCreate", "AdminModifyTrade",
    # common
    "PaginationParams", "PaginatedResponse",
    # insurance
    "InsuranceQuoteRequest", "InsuranceTierQuote",
    "InsuranceActivateRequest", "InsuranceActivateResponse",
    "InsurancePolicyOut", "InsuranceClaimOut",
]
