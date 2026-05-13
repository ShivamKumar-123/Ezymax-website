# FXArtha — Phase 1 Vault Contract Specification

**Status:** Draft, pre-audit
**Target chain:** DAGChain (EVM-compatible)
**Owner:** FXArtha engineering
**Audience:** Client team, contract auditor, gateway/frontend integrators

---

## 1. Context and Scope

FXArtha currently runs a hybrid trading platform: trade execution + balance accounting are off-chain (PostgreSQL ledger), and money movement (deposits, withdrawals) happens via plain on-chain USDT transfers to/from an admin-controlled wallet. This is a custodial model — the broker holds user funds in a hot wallet.

**Phase 1** introduces an on-chain **custody vault** so user funds are no longer pooled in a hot wallet. The vault contract owns the funds; users deposit by calling `deposit()` on the vault, and admin-approved withdrawals are released through `withdraw()`. Trade execution stays off-chain, the database remains the source of truth for balances, and the vault contract holds **no per-user state** — only the aggregate USDT balance, which equals the sum of every `(deposit − withdraw)` event.

### What Phase 1 IS

- A minimal, audit-friendly Solidity contract that custodies USDT on DAGChain
- Pause / emergency-stop controls
- Multi-sig owner (no single key can drain)
- Event-based accounting consumed by the existing `chain_verifier_engine`
- One contract per chain; this spec covers the DAGChain instance

### What Phase 1 is NOT

- ❌ On-chain order matching / execution
- ❌ On-chain leverage, margin, or liquidation
- ❌ Per-user balance accounting on-chain (DB stays source of truth)
- ❌ Bridge logic to/from other chains
- ❌ Protocol token, staking, referral mechanics
- ❌ Multi-asset support (USDT only)

These are deliberately deferred to keep the audit surface tiny.

---

## 2. Architecture

```
Trader app                   Backend gateway              Vault (DAGChain)
──────────                   ───────────────              ─────────────────
User wallet ─┐
             │  vault.deposit(amount)
             ▼
                        Tx broadcast on DAGChain ───▶ event Deposit(user, amount, …)
                                                              │
                                                              ▼
                  chain_verifier_engine polls explorer  ◀─────┘
                  decodes Deposit event
                  credits user.main_wallet_balance in DB
                                │
                                ▼
                        Trader sees balance update

Withdraw flow:
Trader requests withdraw  ──▶ Backend marks withdrawal=pending
                              Admin approves on back-office
                              Admin signs vault.withdraw(user, amount, approvalId)
                                                              │
                                                              ▼
                                                        event Withdraw(user, amount, approvalId, …)
                                                              │
                                                              ▼
                          chain_verifier_engine polls ◀──────┘
                          decodes Withdraw event
                          flips withdrawal=paid in DB
```

**Key invariant:** the database is authoritative for *user-facing* balances, the vault is authoritative for *aggregate* on-chain custody. Reconciliation is `SUM(Deposit.amount) − SUM(Withdraw.amount) = vault.balanceOf(USDT)` — exposed as an admin dashboard health metric.

---

## 3. Contract Surface

### 3.1 State

```solidity
contract FXArthaVaultV1 is AccessControl, Pausable {
    IERC20 public immutable USDT;          // set in constructor, never changes
    uint256 public totalDeposited;         // monotonic, lifetime sum of deposits
    uint256 public totalWithdrawn;         // monotonic, lifetime sum of withdrawals
    mapping(bytes32 => bool) public usedApprovalIds;  // one-shot withdraw approvals
}
```

No per-user balances. No order book. No leverage. Just custody.

### 3.2 Functions

```solidity
function deposit(uint256 amount) external whenNotPaused {
    require(amount > 0, "amount=0");
    USDT.safeTransferFrom(msg.sender, address(this), amount);
    totalDeposited += amount;
    emit Deposit(msg.sender, amount, block.timestamp);
}

function withdraw(
    address to,
    uint256 amount,
    bytes32 approvalId
) external onlyRole(WITHDRAWER_ROLE) whenNotPaused {
    require(amount > 0, "amount=0");
    require(to != address(0), "to=0");
    require(!usedApprovalIds[approvalId], "approval already used");
    usedApprovalIds[approvalId] = true;
    totalWithdrawn += amount;
    USDT.safeTransfer(to, amount);
    emit Withdraw(to, amount, approvalId, block.timestamp);
}

function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

function recoverToken(address token, uint256 amount)
    external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(token != address(USDT), "cannot recover USDT");
    IERC20(token).safeTransfer(msg.sender, amount);
}
```

### 3.3 Events

```solidity
event Deposit(address indexed user, uint256 amount, uint256 timestamp);
event Withdraw(address indexed user, uint256 amount, bytes32 indexed approvalId, uint256 timestamp);
// Inherited from Pausable: Paused(address account); Unpaused(address account);
// Inherited from AccessControl: RoleGranted, RoleRevoked, RoleAdminChanged
```

`approvalId` is a back-end-generated UUID per approved withdrawal. Including it on-chain gives us an idempotency key the verifier can match against the DB row, so a re-broadcast of the same tx can never double-credit.

### 3.4 Access control

| Role | Held by | Permissions |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Multi-sig (Gnosis Safe, 2-of-3) | Grant/revoke roles, recover non-USDT tokens stuck on the contract |
| `WITHDRAWER_ROLE` | Multi-sig (same Safe) | Sign `withdraw()` transactions for admin-approved payouts |
| `PAUSER_ROLE` | Multi-sig + on-call ops EOA | Emergency pause; faster than rotating Safe signers if compromise suspected |

The `DEFAULT_ADMIN_ROLE` and `WITHDRAWER_ROLE` are the same Safe in Phase 1; they're separated by role so we can split them later (e.g. dedicated treasury Safe vs ops Safe) without redeploying.

### 3.5 Security properties

| Property | How enforced |
|---|---|
| No single key drains the vault | Withdraw + admin actions require multi-sig signatures |
| Replay protection on withdrawals | `usedApprovalIds` mapping; backend generates fresh UUID per withdrawal |
| No reentrancy | OpenZeppelin `SafeERC20` + Checks-Effects-Interactions ordering; no callbacks |
| USDT cannot be "recovered" via `recoverToken` | Explicit `require(token != address(USDT))` |
| Pause does not freeze user funds permanently | Pause only blocks new deposits/withdrawals; existing balance is always recoverable via unpause + withdraw |
| Aggregate accounting matches on-chain reality | `totalDeposited − totalWithdrawn == USDT.balanceOf(address(this))` is an external invariant the backend monitors |

---

## 4. Environment Configuration

All chain-specific values are environment variables — never hardcoded. Backend env vars are set in the gateway service `.env` file; frontend env vars must be present at **build time** (Next.js inlines `NEXT_PUBLIC_*` into the bundle).

| Env var | Used by | Description | Example |
|---|---|---|---|
| `DAGCHAIN_CHAIN_ID` | gateway, frontend | EIP-155 numeric chain ID | `<int>` |
| `DAGCHAIN_RPC_URL` | gateway | Primary JSON-RPC endpoint for tx fetch + balance reads | `https://rpc.dagchain.io` |
| `DAGCHAIN_RPC_FALLBACK_URL` | gateway | Secondary RPC if primary fails. Optional. | `https://rpc-backup.dagchain.io` |
| `DAGCHAIN_EXPLORER_API_URL` | gateway | Explorer API base URL (Etherscan-style if available) | `https://api.dagscan.io` |
| `DAGCHAIN_EXPLORER_API_KEY` | gateway | Explorer API key for rate-limited endpoints | `<key>` |
| `DAGCHAIN_USDT_CONTRACT_ADDRESS` | gateway, frontend | USDT (or stablecoin) ERC20 contract on DAGChain | `0x…` |
| `DAGCHAIN_USDT_DECIMALS` | gateway, frontend | Stablecoin decimals (USDT is typically 6 on TRC20/EVM) | `6` |
| `DAGCHAIN_VAULT_CONTRACT_ADDRESS` | gateway, frontend | Deployed FXArthaVaultV1 address | `0x…` |
| `DAGCHAIN_VAULT_DEPLOYED_AT_BLOCK` | gateway | Genesis block of the vault — verifier doesn't scan earlier than this | `<int>` |
| `DAGCHAIN_VAULT_OWNER_MULTISIG` | gateway | Gnosis Safe / multi-sig address holding admin role | `0x…` |
| `DAGCHAIN_MIN_CONFIRMATIONS` | gateway | Block confirmations required before crediting a deposit | `12` |
| `NEXT_PUBLIC_DAGCHAIN_ENABLED` | frontend | Feature flag — kept `false` until everything else is wired and tested | `false` |
| `NEXT_PUBLIC_DAGCHAIN_DISPLAY_NAME` | frontend | Human-readable label shown on the chain-picker radio card | `"DAGChain"` |
| `NEXT_PUBLIC_DAGCHAIN_BLOCK_EXPLORER_URL` | frontend | Used to deep-link from a tx hash in the UI | `https://scan.dagchain.io` |

**Loading rule:** if any required env var is missing **and** `NEXT_PUBLIC_DAGCHAIN_ENABLED=true`, the gateway must refuse to start (clear error to logs). If the flag is `false`, missing vars are tolerated.

---

## 5. Integration with Existing Backend

### 5.1 `admin_deposit_wallets` table

Already supports per-chain admin addresses via the placeholder columns added in migration `0040`:

| Column | Filled how |
|---|---|
| `network` | `'dagchain'` (allowed by migration `0044`, see §7) |
| `asset` | `'USDT'` |
| `address` | The vault contract address (same value as `DAGCHAIN_VAULT_CONTRACT_ADDRESS`) |
| `min_confirmations` | From `DAGCHAIN_MIN_CONFIRMATIONS` |
| `is_active` | `true` once integration is verified on testnet |
| `contract_address` | Vault address (signals to verifier engine to use event-decoded path, not plain transfer path) |
| `contract_event_abi` | JSONB ABI fragment for `Deposit` and `Withdraw` events |
| `contract_owner_address` | Multi-sig address |

A single row per chain. Insertion is via the existing `/admin/deposit-wallets` settings UI — no migration seeds it.

### 5.2 `chain_verifier_engine` extension

Today the engine polls Etherscan / BscScan / TronGrid and verifies that a given tx hash is a USDT `transfer(address,uint256)` to the admin wallet. With the vault, the verification path branches:

```python
# Pseudocode — backend/services/gateway/src/engines/chain_verifier_engine.py
if admin_wallet.contract_address is not None:
    # Vault path: decode the Deposit / Withdraw event from the tx receipt
    event = decode_vault_event(
        tx_receipt,
        contract_address=admin_wallet.contract_address,
        event_abi=admin_wallet.contract_event_abi,
    )
    if event.name == "Deposit":
        credit_user(event.user, event.amount)
    elif event.name == "Withdraw":
        mark_withdrawal_paid(event.approvalId)
else:
    # Legacy plain-transfer path (BSC/ETH/Tron) stays unchanged
    verify_usdt_transfer(tx_hash, admin_wallet.address)
```

The **`Deposit` event includes `user`** — that's the on-chain `msg.sender`. Backend looks up the local user by `users.wallet_address = event.user.lower()` and credits `users.main_wallet_balance`. If no user is found, the event is logged for ops review (someone deposited from an unlinked wallet — refundable but flagged).

### 5.3 New chain client

`backend/packages/common/src/chain_clients/dagchain.py` — same shape as `etherscan.py` / `bscscan.py` / `trongrid.py`. Reads ALL config from env. Module fails to import (raises `RuntimeError`) if `DAGCHAIN_RPC_URL` is unset and `NEXT_PUBLIC_DAGCHAIN_ENABLED=true`.

### 5.4 Frontend changes

| File | Change |
|---|---|
| `frontend/trader/src/lib/web3/config.ts` | Add DAGChain to wagmi `chains` array, gated on `NEXT_PUBLIC_DAGCHAIN_ENABLED` |
| `frontend/trader/src/components/wallet/OnchainDepositFlow.tsx` | Add fourth radio card for DAGChain, hidden by feature flag |
| `frontend/trader/src/components/wallet/OnchainWithdrawFlow.tsx` (when built) | Same fourth radio card |
| `frontend/admin/src/app/(admin)/settings/deposit-wallets/page.tsx` | Add `dagchain` to network dropdown so admin can create the row |

The deposit flow on DAGChain calls `vault.deposit(amount)` instead of the plain `usdt.transfer(adminAddress, amount)` used for the other three chains. wagmi's `useWriteContract` handles both.

### 5.5 Withdrawal signing

Admin clicks "Mark sent" on the back-office withdrawal queue. Backend generates a fresh `approvalId` (UUID, hex-encoded as `bytes32`). Admin's wallet (connected to the multi-sig Safe) signs the `vault.withdraw(to, amount, approvalId)` call. Once mined, the verifier engine matches the on-chain `approvalId` to the local `Withdrawal.approval_id` column (new column, see §7) and flips status to `paid`.

---

## 6. Audit Checklist

Provide the auditor with this contract surface, the `forge test` suite (see §8), and the backend integration spec above. The auditor should specifically verify:

- [ ] **Reentrancy** — `deposit` and `withdraw` use `SafeERC20`, no callbacks, CEI ordering followed
- [ ] **Integer over/underflow** — solc 0.8.x compiler default checks; no `unchecked` blocks
- [ ] **Access control** — every state-changing function is gated by the correct role; no missing modifiers
- [ ] **Replay protection** — `usedApprovalIds` mapping is set BEFORE the external transfer call, not after
- [ ] **Pause coverage** — `whenNotPaused` modifier on `deposit` and `withdraw`; admin functions remain callable during pause (you must be able to `pause()`/`unpause()` even when paused)
- [ ] **Immutable USDT address** — `IERC20 public immutable USDT` set in constructor, no setter
- [ ] **`recoverToken` cannot drain USDT** — explicit revert on USDT, audit the equality check
- [ ] **Event correctness** — every state-changing function emits its event; no silent state changes
- [ ] **Approval allowance flow** — user must `usdt.approve(vault, amount)` before `vault.deposit()`; UX considerations for infinite approval risk
- [ ] **No proxy / upgradeability** — the contract is intentionally non-upgradeable. Bug fixes ship as a new contract + migration. Tradeoff: simpler audit, no admin proxy compromise risk.
- [ ] **No emergency drain** — there is intentionally no `emergencyWithdraw()` that bypasses the role check. If the multi-sig is compromised, funds go with it. We accept this risk and mitigate via multi-sig + pause.
- [ ] **Gas DoS** — `deposit` is O(1); `withdraw` is O(1); no loops over user-provided arrays
- [ ] **Front-running** — deposits cannot be front-run profitably (the depositor is `msg.sender`); withdrawals are role-gated
- [ ] **Test coverage** — Foundry / Hardhat suite covers happy path, every revert path, and a fuzz harness over `deposit` + `withdraw` sequences

**Recommended audit budget tier:**

- **$5–8k**: single experienced Solidity auditor, ~3-day review. Acceptable for a contract this small + this widely-used pattern (Pausable + AccessControl + SafeERC20).
- **$15–30k**: firm review (Hacken, Quantstamp). Recommended if the multi-sig holds > $1M equivalent.
- **$30k+**: top-tier (CertiK, Trail of Bits, OpenZeppelin). Overkill for this contract surface but reassuring for the marketing page.

The contract is intentionally simple (~200 SLOC including comments) so any of the three tiers works.

---

## 7. Database Migration

A single migration **`0044_allow_dagchain_network.py`** widens the allowed values in `admin_deposit_wallets.network` and adds an `approval_id` column to `withdrawals` for the on-chain idempotency key:

```python
# backend/infra/migrations/versions/20260509_0044_allow_dagchain_network.py
def upgrade():
    # Add 'dagchain' to the allowed network values.
    # Existing eth/bsc/tron rows continue to work unchanged.
    op.execute("""
        ALTER TABLE admin_deposit_wallets
        DROP CONSTRAINT IF EXISTS admin_deposit_wallets_network_check;
    """)
    op.execute("""
        ALTER TABLE admin_deposit_wallets
        ADD CONSTRAINT admin_deposit_wallets_network_check
        CHECK (network IN ('eth', 'bsc', 'tron', 'dagchain'));
    """)
    # On-chain approvalId for vault withdrawals — idempotency key.
    op.execute("""
        ALTER TABLE withdrawals
        ADD COLUMN IF NOT EXISTS approval_id VARCHAR(66) UNIQUE;
    """)
```

Additive only. No data migration. Existing flows untouched.

---

## 8. Repository Layout

Per the prior decision (same monorepo), all contract work lives at:

```
backend/contracts/
├── src/
│   └── FXArthaVaultV1.sol          # the contract
├── test/
│   ├── FXArthaVaultV1.t.sol        # Foundry unit + fuzz tests
│   └── invariants/
│       └── AccountingInvariant.t.sol  # totalDeposited - totalWithdrawn == USDT.balanceOf(this)
├── script/
│   └── DeployVault.s.sol            # Foundry deployment script
├── foundry.toml
├── README.md                         # build + deploy instructions
└── audit/
    ├── FXArthaVaultV1-audit-checklist.md   # the §6 list
    └── reports/                       # auditor PDFs land here
```

Foundry chosen over Hardhat for: speed of test runs, native fuzz/invariant testing, and the auditor community's familiarity with `forge test` output. If the eventual auditor prefers Hardhat we can ship both lockfiles.

---

## 9. Deployment Plan

### Step 1 — Local Foundry build + tests

```bash
cd backend/contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0
forge build
forge test --gas-report
forge coverage
```

Required: 100% line coverage, fuzz suite green for ≥ 1M runs.

### Step 2 — Deploy to DAGChain testnet

```bash
forge script script/DeployVault.s.sol \
  --rpc-url $DAGCHAIN_RPC_URL_TESTNET \
  --private-key $DEPLOYER_KEY_TESTNET \
  --broadcast \
  --verify
```

Constructor args:
- `_USDT` = USDT address on DAGChain testnet
- `_admin` = testnet multi-sig (or temporary EOA if Safe not yet deployed on testnet)

After deploy:
1. Grant `WITHDRAWER_ROLE` and `PAUSER_ROLE` to the multi-sig.
2. Revoke `DEFAULT_ADMIN_ROLE` from the deployer EOA.
3. Verify on the testnet block explorer.
4. Insert the testnet vault row in `admin_deposit_wallets` via the admin settings UI.
5. End-to-end test: trader deposits 5 USDT, watches it credit; admin approves a 3 USDT withdrawal, watches it pay out.

### Step 3 — Audit

Hand the auditor:
- This spec doc
- The deployed testnet contract address
- The Foundry repo
- The §6 checklist
- Backend integration code (`chain_verifier_engine`, `admin_deposit_wallets`)

Block mainnet deploy until audit report is signed off and any critical / high findings are remediated + retested.

### Step 4 — Mainnet deploy

```bash
forge script script/DeployVault.s.sol \
  --rpc-url $DAGCHAIN_RPC_URL \
  --private-key $DEPLOYER_KEY_MAINNET \
  --broadcast \
  --verify
```

Constructor args:
- `_USDT` = `DAGCHAIN_USDT_CONTRACT_ADDRESS` (mainnet)
- `_admin` = mainnet multi-sig (Gnosis Safe, 2-of-3)

Post-deploy: same role grant/revoke pattern as testnet. Insert mainnet row in `admin_deposit_wallets`. Flip `NEXT_PUBLIC_DAGCHAIN_ENABLED=true` in the trader-frontend build args. Rebuild + deploy frontend.

### Multi-sig setup

**Phase 1 default**: Gnosis Safe, 2-of-3, signers held by:

1. **Operator-1** — primary engineering on-call
2. **Operator-2** — secondary engineering on-call
3. **Founder / treasury** — cold key, used only for role rotation

Daily withdrawals require 2 signatures (typically Operator-1 + Operator-2). Role rotation requires 2 signatures including Founder.

If Safe is not yet deployed on DAGChain, use Safe's official deployment factory (Safe deploys on every EVM chain via deterministic CREATE2). Failing that, a 2-of-3 multi-sig wallet from any reputable EVM-compatible Safe-alike. Document the choice + the 3 signer addresses in `audit/multisig.md`.

---

## 10. Open Items / Risks

| Item | Risk | Mitigation |
|---|---|---|
| DAGChain RPC reliability unknown | If primary RPC goes down, deposits/withdrawals stop being verified | `DAGCHAIN_RPC_FALLBACK_URL` + retry-with-backoff in chain client |
| DAGChain block explorer API may not exist or differ from Etherscan format | `chain_verifier_engine` would need to read tx receipts directly via RPC instead of explorer | New chain client uses RPC `eth_getTransactionReceipt` as primary, explorer API as optional accelerator |
| Multi-sig support on DAGChain unconfirmed | Funds custody depends on multi-sig | Block mainnet deploy until Safe (or audited equivalent) is verified live on DAGChain |
| USDT availability on DAGChain | If no USDT, must use a different stablecoin or the client's own bridged token | `DAGCHAIN_USDT_CONTRACT_ADDRESS` is the env var — value can be any ERC20 address |
| Reorg / chain reorg depth on DAGChain | A deep reorg could un-confirm a credited deposit | `DAGCHAIN_MIN_CONFIRMATIONS` env var; default 12 (revisit after observing chain finality on testnet) |
| Audit window | Mainnet ship is gated on audit completion | Start audit conversations alongside testnet deploy to compress critical-path |

---

## 11. Phase 2+ Outlook

**Phase 2** (post Phase 1 stability):

- Replicate the same vault contract on Ethereum, BSC, Tron — multi-vault architecture
- Optional cross-chain bridge if liquidity gets fragmented
- Withdrawal whitelist (per-user destination address book)

**Phase 3** (long-horizon):

- On-chain price feed integration for trustless margin/liquidation checks
- Optional smart-contract-driven settlement (if the off-chain engine ever moves on-chain — uncertain)

These are deliberately out of scope for Phase 1.

---

## 12. Sign-Off

| Role | Name | Status | Date |
|---|---|---|---|
| Engineering | _FXArtha team_ | Spec drafted | _today_ |
| Product / client | | Pending review | |
| Auditor | | Pending engagement | |

Ship Phase 1 only after all three rows are signed off and the env-var table is filled in with real DAGChain values from the client.

---

**End of spec.** Comments + edits welcome via PR against this file.
