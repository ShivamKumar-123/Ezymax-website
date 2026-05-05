"""On-chain verification clients for the decentralized USDT deposit flow.

Each client exposes one async function:

    verify_usdt_transfer(tx_hash, expected_to, expected_value, min_confs)
        -> {"ok": bool, "confirmations": int, "reason": str | None,
            "final_failure": bool}

`expected_value` is in USDT base units (USDT has 6 decimals on every chain
we support, so $5 == 5_000_000). `expected_to` is the admin deposit address
configured in admin_deposit_wallets.

`final_failure=True` means the verifier should not retry — the tx is
known-bad (reverted, wrong contract, wrong recipient, value off). Anything
else (RPC down, tx not yet visible) is transient and the engine will
retry on the next tick.
"""
from .etherscan import verify_usdt_transfer as verify_eth_usdt_transfer
from .bscscan import verify_usdt_transfer as verify_bsc_usdt_transfer
from .trongrid import verify_usdt_transfer as verify_tron_usdt_transfer


# USDT contract / native address per chain.
USDT_CONTRACTS: dict[str, str] = {
    # Ethereum mainnet — USDT (ERC-20)
    "eth": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    # BSC mainnet — USDT (BEP-20). Note: BSC's "USDT" is 18 decimals, not 6.
    "bsc": "0x55d398326f99059fF775485246999027B3197955",
    # Tron — USDT (TRC-20). Tron addresses are base58.
    "tron": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
}

# USDT decimals per chain. Matters for converting amount → base units.
USDT_DECIMALS: dict[str, int] = {
    "eth": 6,
    "bsc": 18,  # BSC uses 18 decimals for USDT, unlike most other chains
    "tron": 6,
}


def chain_id_for(network: str) -> int:
    """EIP-155 chain id for the EVM chains. Tron has no EIP-155 chain id."""
    return {"eth": 1, "bsc": 56}.get(network, 0)


__all__ = [
    "verify_eth_usdt_transfer",
    "verify_bsc_usdt_transfer",
    "verify_tron_usdt_transfer",
    "USDT_CONTRACTS",
    "USDT_DECIMALS",
    "chain_id_for",
]
