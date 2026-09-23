"""C-MONEY-3 / H-MONEY-1: withdrawable amount must exclude margin-backed funds.

Before the fix, main-wallet and manual withdrawal paths used the raw trading
account balance, letting a user withdraw funds collateralising open positions.
available_to_withdraw() is the shared rule now used by every withdrawal path.
"""
import unittest
from decimal import Decimal

from packages.common.src.withdrawal_limits import available_to_withdraw


class WithdrawalLimitsTests(unittest.TestCase):
    def test_trading_excludes_margin(self):
        # balance 1000, 400 locked as margin → only 600 withdrawable.
        self.assertEqual(
            available_to_withdraw("trading", balance=Decimal("1000"), margin_used=Decimal("400")),
            Decimal("600"),
        )

    def test_trading_capped_by_free_margin(self):
        # free_margin (reflecting floating loss) is the tighter cap.
        self.assertEqual(
            available_to_withdraw(
                "trading", balance=Decimal("1000"), margin_used=Decimal("200"),
                free_margin=Decimal("500"),
            ),
            Decimal("500"),
        )

    def test_trading_never_negative(self):
        self.assertEqual(
            available_to_withdraw("trading", balance=Decimal("100"), margin_used=Decimal("300")),
            Decimal("0"),
        )

    def test_trading_full_when_no_margin(self):
        self.assertEqual(
            available_to_withdraw("trading", balance=Decimal("250")),
            Decimal("250"),
        )

    def test_main_wallet_full(self):
        self.assertEqual(
            available_to_withdraw("main", main_wallet_balance=Decimal("777")),
            Decimal("777"),
        )

    def test_main_wallet_excludes_outstanding_bonus(self):
        # H-MONEY-2: a non-withdrawable bonus can't be cashed out.
        self.assertEqual(
            available_to_withdraw("main", main_wallet_balance=Decimal("500"),
                                  outstanding_bonus=Decimal("120")),
            Decimal("380"),
        )

    def test_main_wallet_bonus_never_negative(self):
        self.assertEqual(
            available_to_withdraw("main", main_wallet_balance=Decimal("50"),
                                  outstanding_bonus=Decimal("120")),
            Decimal("0"),
        )

    def test_none_inputs_safe(self):
        self.assertEqual(available_to_withdraw("trading"), Decimal("0"))
        self.assertEqual(available_to_withdraw("main"), Decimal("0"))


if __name__ == "__main__":
    unittest.main()
