"""C-MONEY-2: on-chain tx hashes normalise to one canonical form per network,
so the (network, lower(crypto_tx_hash)) unique index dedupes reliably.
"""
import unittest

from services.gateway.src.services.onchain_deposit_service import normalize_tx_hash

H = "AbCdEf0123456789" * 4  # 64 hex chars, mixed case


class TxHashNormalizeTests(unittest.TestCase):
    def test_evm_lowercases_and_keeps_0x(self):
        self.assertEqual(normalize_tx_hash("eth", "0x" + H), "0x" + H.lower())
        self.assertEqual(normalize_tx_hash("bsc", "0x" + H), "0x" + H.lower())

    def test_evm_adds_missing_0x(self):
        self.assertEqual(normalize_tx_hash("eth", H), "0x" + H.lower())

    def test_tron_bare_lowercase(self):
        self.assertEqual(normalize_tx_hash("tron", H), H.lower())

    def test_tron_strips_0x(self):
        self.assertEqual(normalize_tx_hash("tron", "0x" + H), H.lower())

    def test_case_variants_collapse(self):
        # the whole point: two casings of the same tx map to one key.
        self.assertEqual(
            normalize_tx_hash("eth", "0x" + H.upper()),
            normalize_tx_hash("eth", "0x" + H.lower()),
        )

    def test_whitespace_trimmed(self):
        self.assertEqual(normalize_tx_hash("eth", "  0x" + H + "  "), "0x" + H.lower())


if __name__ == "__main__":
    unittest.main()
