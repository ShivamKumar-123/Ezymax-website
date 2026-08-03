/**
 * Wagmi + RainbowKit configuration for the on-site NOWPayments wallet-connect
 * deposit flow. Phase 1 = EVM only (Ethereum, BSC, Polygon, Arbitrum).
 * Tron / Solana / Bitcoin support will land in later phases via separate
 * wallet adapters; the existing crypto-asset grid greys out non-EVM picks.
 *
 * NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is baked at Docker build time. Without
 * it RainbowKit only surfaces injected wallets (MetaMask, OKX, Brave); the
 * WalletConnect-based wallets (Trust Mobile, Rainbow, etc.) won't connect.
 */
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { http } from 'wagmi';
import { arbitrum, bsc, mainnet, polygon } from 'wagmi/chains';

const PROJECT_ID = (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '').trim();

/** Dev placeholder id (see .env.local): enables the wallet UI without a real
 * Reown project. Detected here so the config can avoid the WalletConnect
 * cloud entirely — an unregistered origin makes cloud.reown.com log
 * "Origin … not found on Allowlist" console errors on every modal open. */
const DUMMY_PROJECT_ID = '00000000000000000000000000000000';
const hasRealProjectId = PROJECT_ID.length > 0 && PROJECT_ID !== DUMMY_PROJECT_ID;

/** Lazy-init so the config isn't computed during SSR / static export. */
let _config: ReturnType<typeof getDefaultConfig> | null = null;

export function getWagmiConfig() {
  if (_config) return _config;
  _config = getDefaultConfig({
    appName: 'FXArtha',
    // RainbowKit requires a non-empty project id at build time. We pass a
    // dummy when the env var is unset so the bundle still compiles; the
    // WalletDepositModal checks isWalletConnectConfigured() before mounting
    // the provider so it won't actually try to talk to Reown without one.
    projectId: PROJECT_ID || DUMMY_PROJECT_ID,
    // With only the dev placeholder id, restrict to browser-injected wallets
    // (MetaMask etc.) so the WalletConnect/AppKit cloud layer never
    // initialises — it would reject the unregistered origin and spam the
    // console. A real project id restores the full default wallet list.
    ...(hasRealProjectId
      ? {}
      : {
          wallets: [
            {
              groupName: 'Browser wallets',
              wallets: [injectedWallet],
            },
          ],
        }),
    chains: [mainnet, bsc, polygon, arbitrum],
    // Explicit CORS-enabled RPCs. Without this, viem falls back to its default
    // public endpoints (e.g. eth.merkle.io) which DON'T send CORS headers, so
    // every on-chain read from the browser failed with a CORS error and spammed
    // the console on the wallet page. publicnode.com endpoints are CORS-friendly;
    // override per chain via NEXT_PUBLIC_*_RPC_URL if a dedicated provider is set.
    transports: {
      [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim() || 'https://ethereum-rpc.publicnode.com'),
      [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL?.trim() || 'https://bsc-rpc.publicnode.com'),
      [polygon.id]: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL?.trim() || 'https://polygon-bor-rpc.publicnode.com'),
      [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL?.trim() || 'https://arbitrum-one-rpc.publicnode.com'),
    },
    ssr: true,
  });
  return _config;
}

/** True only when the WC project id is set — gates the wallet-connect UI so
 * we don't leak a "Connect Wallet" button that 500s when the env var is
 * missing in dev or pre-rollout. */
export function isWalletConnectConfigured(): boolean {
  return PROJECT_ID.length > 0;
}

/** Map our backend `network` slug → wagmi chain. NOWPayments may also send
 * an EVM-compatible chain code we don't list here; the modal then warns
 * "Switch to {chain} in your wallet" rather than auto-switching. */
export const NETWORK_TO_CHAIN: Record<string, { id: number; name: string }> = {
  eth: { id: mainnet.id, name: 'Ethereum' },
  ethereum: { id: mainnet.id, name: 'Ethereum' },
  bsc: { id: bsc.id, name: 'BNB Smart Chain' },
  polygon: { id: polygon.id, name: 'Polygon' },
  arbitrum: { id: arbitrum.id, name: 'Arbitrum One' },
};
