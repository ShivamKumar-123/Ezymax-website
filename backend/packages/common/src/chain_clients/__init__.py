"""On-chain verification clients for the decentralized USDT deposit flow.

Each client exposes one async function:

    verify_usdt_transfer(tx_hash, expected_to, expected_value, min_confs)
        -> {"ok": bool, "confirmations": int, "reason": str | None,
            "final_failure": bool}

`expected_value` is in USDT base units. Decimals are PER CHAIN (see
USDT_DECIMALS below — BSC-peg USDT is 18 decimals, ETH/Tron are 6), so
$5 is 5_000_000 on eth/tron but 5 * 10**18 on bsc. A wrong decimals entry
makes every deposit on that chain fail `amount_mismatch` by orders of
magnitude — override per chain via the USDT_DECIMALS_OVERRIDES env var
(JSON, e.g. '{"bsc-testnet": 18}') if a non-canonical token is deployed.
`expected_to` is the admin deposit address configured in
admin_deposit_wallets.

`final_failure=True` means the verifier should not retry — the tx is
known-bad (reverted, wrong contract, wrong recipient, value off). Anything
else (RPC down, tx not yet visible) is transient and the engine will
retry on the next tick.
"""
from .etherscan import verify_usdt_transfer as verify_eth_usdt_transfer
from .bscscan import verify_usdt_transfer as verify_bsc_usdt_transfer
from .bscscan import verify_bsc_vault_deposit
from .trongrid import verify_usdt_transfer as verify_tron_usdt_transfer


# USDT contract / native address per chain. The plain-transfer
# verifier path uses these to confirm the on-chain `to` address of a
# deposit transaction matches the canonical USDT contract for that
# chain. The vault path uses the `contract_address` column on
# admin_deposit_wallets instead, so this map only matters for the
# legacy path.
USDT_CONTRACTS: dict[str, str] = {
    # Ethereum mainnet — USDT (ERC-20)
    "eth": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    # BSC mainnet — USDT (BEP-20). Note: BSC's "USDT" is 18 decimals, not 6.
    "bsc": "0x55d398326f99059fF775485246999027B3197955",
    # BSC testnet — USDT (BEP-20), 18 decimals like mainnet.
    "bsc-testnet": "0x337610d27c682E347C9cD60BD4b3b107C9d34dDD",
    # Tron — USDT (TRC-20). Tron addresses are base58.
    "tron": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
}

# USDT decimals per chain. Matters for converting amount → base units:
# a wrong entry here makes EVERY deposit on that chain fail amount_mismatch
# by 10^|delta|, so verify against the actual deployed token before changing.
USDT_DECIMALS: dict[str, int] = {
    "eth": 6,
    "bsc": 18,         # Binance-Peg USDT (0x55d3…7955) really is 18 decimals
    # The canonical BSC-testnet Tether at 0x3376…4dDD is SIX decimals (this
    # previously said 18 "like mainnet", which would have rejected every
    # testnet vault deposit by a factor of 10^12; contracts/.env.example
    # documents the same token as 6-decimal).
    "bsc-testnet": 6,
    "tron": 6,
}

# Deployment-specific override, e.g. USDT_DECIMALS_OVERRIDES='{"bsc-testnet": 18}'
# if a non-canonical test token is used. Malformed JSON is ignored loudly.
import json as _json
import logging as _logging
import os as _os

_overrides_raw = _os.environ.get("USDT_DECIMALS_OVERRIDES", "").strip()
if _overrides_raw:
    try:
        _overrides = _json.loads(_overrides_raw)
        if isinstance(_overrides, dict):
            for _k, _v in _overrides.items():
                USDT_DECIMALS[str(_k)] = int(_v)
    except (ValueError, TypeError) as _e:
        _logging.getLogger("chain_clients").error(
            "Ignoring malformed USDT_DECIMALS_OVERRIDES=%r: %s", _overrides_raw, _e
        )


def chain_id_for(network: str) -> int:
    """EIP-155 chain id for the EVM chains. Tron has no EIP-155 chain id."""
    return {"eth": 1, "bsc": 56, "bsc-testnet": 97}.get(network, 0)


__all__ = [
    "verify_eth_usdt_transfer",
    "verify_bsc_usdt_transfer",
    "verify_bsc_vault_deposit",
    "verify_tron_usdt_transfer",
    "USDT_CONTRACTS",
    "USDT_DECIMALS",
    "chain_id_for",
]
