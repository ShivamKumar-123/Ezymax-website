# FXArtha Contracts — Phase 1 Vault

Foundry workspace for the **FXArthaVaultV1** custody vault.
Spec lives at [`docs/vault-phase1-spec.md`](../../docs/vault-phase1-spec.md).

## Layout

```
backend/contracts/
├── src/FXArthaVaultV1.sol       # the contract
├── test/FXArthaVaultV1.t.sol    # Foundry unit + fuzz + invariant tests
├── script/Deploy.s.sol          # forge script Deploy.s.sol --broadcast
├── foundry.toml                 # solc 0.8.24, optimizer on, fuzz=1024
├── remappings.txt               # @openzeppelin + forge-std paths
├── .env.example                 # copy → .env, fill in real values
└── .gitignore                   # blocks .env, lib/, out/, etc.
```

## One-time setup (do once on the deploy machine)

```bash
# 1. Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Inside this folder:
cd backend/contracts

# 3. Copy env template and fill it in
cp .env.example .env
# edit .env — see comments inside for what each variable means

# 4. Install dependencies (OpenZeppelin v5 + forge-std)
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge install foundry-rs/forge-std --no-commit

# 5. Compile
forge build
```

## Run tests (no network needed)

```bash
forge test                    # all tests, default fuzz runs
forge test -vvv               # verbose with stack traces on failure
forge test --gas-report       # gas usage per function
forge coverage                # line coverage; aim for 100%
```

Required pass criteria before any deploy:

- [x] All unit tests green
- [x] All fuzz tests green at ≥ 1024 runs
- [x] `invariant_AccountingMatchesBalance` green at depth ≥ 32
- [x] No high-severity warnings in `forge build`

## Deploy to BSC testnet

Pre-requisites:

1. Funded deployer EOA — get tBNB from <https://testnet.bnbchain.org/faucet-smart>
2. `BSCSCAN_API_KEY` set in `.env` — register free at <https://bscscan.com/register>
3. `ADMIN_ADDRESS` decided — for testnet you may use an EOA you control; for mainnet it MUST be a multi-sig

```bash
# Load env into the shell (or source it differently per OS)
source .env

# Dry-run first — see the deploy plan without broadcasting
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BSC_TESTNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Real deploy + auto-verify
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BSC_TESTNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --verify --chain 97
```

Output ends with:

```
=== DEPLOYED ===
FXArthaVaultV1: 0x….
```

Save that address — it goes into `VAULT_CONTRACT_ADDRESS` in the
gateway env, and into the `address` + `contract_address` columns of a
new `admin_deposit_wallets` row.

## Verify manually (if `--verify` failed during deploy)

```bash
forge verify-contract <DEPLOYED_ADDRESS> \
  src/FXArthaVaultV1.sol:FXArthaVaultV1 \
  --chain-id 97 \
  --watch \
  --constructor-args $(cast abi-encode 'constructor(address,address)' $USDT_ADDRESS $ADMIN_ADDRESS)
```

Verification typically completes in 30–60 seconds. Once verified, the
contract source is visible at:

`https://testnet.bscscan.com/address/<DEPLOYED_ADDRESS>#code`

## Post-deploy checklist (hand back to backend integrator)

- [ ] Verified contract URL on BscScan testnet
- [ ] Deployed vault address (`VAULT_CONTRACT_ADDRESS`)
- [ ] Admin address used (`ADMIN_ADDRESS`)
- [ ] Deploy tx hash
- [ ] If `PAUSER_OPS_EOA` was set: confirm multi-sig later runs
      `vault.grantRole(vault.PAUSER_ROLE(), <PAUSER_OPS_EOA>)`

Backend then:

1. Sets `VAULT_CONTRACT_ADDRESS=<address>` in gateway `.env`
2. Inserts row in `admin_deposit_wallets` (network='bsc', is_testnet=true,
   contract_address=<address>, asset='USDT', etc.)
3. Sets `NEXT_PUBLIC_VAULT_TESTNET_ENABLED=true` in trader-frontend
   build args, rebuilds, deploys
4. Places a 5-USDT test deposit from a wallet → verifies the
   `Deposit` event credits the user's main_wallet_balance within 60s
5. Approves a 3-USDT test withdrawal in admin → multi-sig signs the
   `withdraw()` call → verifies the `Withdraw` event flips the row
   to `paid`

If both flows work, the vault is ready for **audit** (see spec §6) and
mainnet is the next step.

## Troubleshooting

**`forge install` fails with "Permission denied"** — make sure you're
in the `backend/contracts` directory, not the repo root.

**`forge script ... --broadcast` fails with "insufficient funds"** —
the deployer EOA needs tBNB. Hit the faucet linked above.

**`--verify` fails with "Unable to locate ContractName"** — pass
`--chain 97` explicitly. BscScan testnet is chain 97; without the flag
Foundry defaults to chain 1 (mainnet Etherscan), which doesn't know
about your contract.

**`--verify` fails with "Already verified"** — harmless, the contract
was already verified on a previous run. Visit BscScan to confirm.
