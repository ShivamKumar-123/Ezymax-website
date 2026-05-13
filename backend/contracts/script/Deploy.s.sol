// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FXArthaVaultV1} from "../src/FXArthaVaultV1.sol";

/**
 * @title Deploy
 * @notice Deploys FXArthaVaultV1 to the configured network.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $BSC_TESTNET_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast --verify
 *
 * Required env vars (see .env.example):
 *   USDT_ADDRESS      ERC20 stablecoin address on the target chain.
 *                     BSC testnet USDT: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDD
 *   ADMIN_ADDRESS     Multi-sig (Gnosis Safe) that will receive
 *                     DEFAULT_ADMIN_ROLE, WITHDRAWER_ROLE, PAUSER_ROLE.
 *                     For testnet you may pass a single EOA, but the
 *                     mainnet deploy MUST use a real multi-sig.
 *
 * Optional env var:
 *   PAUSER_OPS_EOA    If set, this address is additionally granted
 *                     PAUSER_ROLE so on-call ops can pause without
 *                     waiting for multi-sig signatures. Useful for
 *                     incident response.
 *
 * Output:
 *   Prints the deployed vault address. Save it as
 *   VAULT_CONTRACT_ADDRESS in the gateway env, and insert a row in
 *   admin_deposit_wallets with that value as both `address` and
 *   `contract_address`.
 */
contract Deploy is Script {
    function run() external returns (FXArthaVaultV1 vault) {
        address usdt  = vm.envAddress("USDT_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");

        console2.log("=== FXArthaVaultV1 deploy ===");
        console2.log("USDT address: %s", usdt);
        console2.log("Admin (multi-sig): %s", admin);

        vm.startBroadcast();
        vault = new FXArthaVaultV1(usdt, admin);

        // Optional second pauser (on-call ops EOA) so a fast pause
        // doesn't require collecting multi-sig signatures.
        try vm.envAddress("PAUSER_OPS_EOA") returns (address opsEOA) {
            if (opsEOA != address(0) && opsEOA != admin) {
                // PAUSER_ROLE has admin = DEFAULT_ADMIN_ROLE which we
                // just granted to the multi-sig. The deployer EOA cannot
                // grant roles. So this grant must happen AFTER deploy
                // via a multi-sig transaction — we just log the intent
                // here so ops knows what to do post-deploy.
                console2.log("PAUSER_OPS_EOA configured: %s", opsEOA);
                console2.log("==> Multi-sig must call:");
                console2.log("    vault.grantRole(vault.PAUSER_ROLE(), PAUSER_OPS_EOA)");
            }
        } catch {
            // PAUSER_OPS_EOA not set — fine, multi-sig is the only pauser.
        }

        vm.stopBroadcast();

        console2.log("=== DEPLOYED ===");
        console2.log("FXArthaVaultV1: %s", address(vault));
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Verify on BscScan:");
        console2.log(
            "   forge verify-contract <address> src/FXArthaVaultV1.sol:FXArthaVaultV1 \\"
        );
        console2.log("     --chain-id 97 --watch \\");
        console2.log("     --constructor-args $(cast abi-encode 'constructor(address,address)' %s %s)", usdt, admin);
        console2.log("2. Set VAULT_CONTRACT_ADDRESS=<address> in gateway env.");
        console2.log("3. Insert row in admin_deposit_wallets via admin UI.");
        console2.log("4. Flip NEXT_PUBLIC_VAULT_TESTNET_ENABLED=true and rebuild trader-frontend.");
    }
}
