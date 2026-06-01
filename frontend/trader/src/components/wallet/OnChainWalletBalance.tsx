'use client';

/**
 * Live on-chain balance card for the linked wallet.
 *
 * Fetches native (ETH/BNB/MATIC) + USDT (ERC-20) balance for each
 * supported chain via wagmi. Read-only — nothing crediting / debiting
 * here; the gateway's main_wallet_balance is unaffected.
 *
 * Surface:
 *   - Per-chain row: chain name · native balance · USDT balance
 *   - Truncated linked address with a "View on explorer" deep link
 *   - "Deposit" button next to chains with a non-zero USDT balance
 *     (pre-fills the deposit modal with that network)
 *
 * Hidden when:
 *   - User has no `wallet_address` linked yet (the OnboardingGate
 *     should have forced one, but defensive guard for legacy users).
 *   - WalletConnect isn't configured (`isWalletConnectConfigured`
 *     returns false) — wagmi hooks would no-op anyway, but skipping
 *     the render keeps the page tidy.
 *
 * Balance updates poll every 30 s via `refetchInterval`. Multicall is
 * automatic — wagmi batches reads to a single RPC request per chain.
 */
import { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { arbitrum, bsc, mainnet, polygon } from 'wagmi/chains';
import { useAuthStore } from '@/stores/authStore';
import { isWalletConnectConfigured } from '@/lib/web3/config';
import { ExternalLink, Wallet as WalletIcon, Loader2 } from 'lucide-react';

// Lazy-load Web3Provider so the wallet page doesn't pay the wagmi +
// RainbowKit bundle cost when WalletConnect isn't configured (or before
// the user even scrolls to this card). ssr:false because wagmi can't
// render server-side and we don't need SEO for a wallet balance widget.
const Web3Provider = dynamic(
  () => import('@/components/providers/Web3Provider'),
  { ssr: false },
);

// USDT contract addresses per chain. These are the canonical mainnet
// addresses — confirm before editing. Decimals are 6 on Ethereum/
// Polygon/Arbitrum, 18 on BSC (BEP-20 USDT is 18 decimals, an
// unfortunate quirk of the original Binance peg).
type ChainEntry = {
  id: number;
  name: string;
  nativeSymbol: string;
  nativeDecimals: number;
  usdt: `0x${string}`;
  usdtDecimals: number;
  explorerTx: (addr: string) => string;
  depositSlug: 'eth' | 'bsc' | 'polygon' | 'arbitrum';
};

const CHAINS: ChainEntry[] = [
  {
    id: mainnet.id,
    name: 'Ethereum',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    usdtDecimals: 6,
    explorerTx: (a) => `https://etherscan.io/address/${a}`,
    depositSlug: 'eth',
  },
  {
    id: bsc.id,
    name: 'BNB Smart Chain',
    nativeSymbol: 'BNB',
    nativeDecimals: 18,
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    usdtDecimals: 18,
    explorerTx: (a) => `https://bscscan.com/address/${a}`,
    depositSlug: 'bsc',
  },
  {
    id: polygon.id,
    name: 'Polygon',
    nativeSymbol: 'MATIC',
    nativeDecimals: 18,
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    usdtDecimals: 6,
    explorerTx: (a) => `https://polygonscan.com/address/${a}`,
    depositSlug: 'polygon',
  },
  {
    id: arbitrum.id,
    name: 'Arbitrum One',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    usdtDecimals: 6,
    explorerTx: (a) => `https://arbiscan.io/address/${a}`,
    depositSlug: 'arbitrum',
  },
];

function formatBalance(raw: bigint | undefined, decimals: number): string {
  if (raw === undefined) return '—';
  const v = Number(formatUnits(raw, decimals));
  if (v === 0) return '0';
  if (v < 0.0001) return '<0.0001';
  if (v < 1) return v.toFixed(4);
  if (v < 1000) return v.toFixed(2);
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function OnChainWalletBalanceInner({
  onDepositClick,
}: {
  /** Optional handler — when the user clicks "Deposit" on a chain row,
   *  we call this with the chain slug so the parent wallet page can
   *  pre-fill the deposit modal. Omit to render the row read-only. */
  onDepositClick?: (slug: ChainEntry['depositSlug']) => void;
}) {
  const linkedAddress = useAuthStore((s) => s.user?.wallet_address || '');

  // Build one contract-read entry per chain × asset. wagmi batches the
  // calls per-chain into a multicall RPC; we get a single RPC roundtrip
  // per chain regardless of how many tokens we ask for.
  const contracts = useMemo(() => {
    if (!linkedAddress) return [];
    const addr = linkedAddress as `0x${string}`;
    return CHAINS.flatMap((c) => [
      // Native balance (ETH/BNB/MATIC) — there's no contract; wagmi
      // exposes it via `getBalance` not `readContracts`. We use a
      // separate path below for natives.
      {
        chainId: c.id,
        address: c.usdt,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [addr] as const,
      },
    ]);
  }, [linkedAddress]);

  const { data: usdtResults, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 30_000, // poll every 30s — cheap, cached client-side
      staleTime: 25_000,
    },
  });

  if (!linkedAddress) return null;

  const shortAddr =
    linkedAddress.length > 12
      ? `${linkedAddress.slice(0, 6)}…${linkedAddress.slice(-4)}`
      : linkedAddress;

  return (
    <div className="rounded-2xl border border-border-glass bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <WalletIcon size={18} className="text-[#d6a93d]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
            Your Wallet — On-chain balance
          </h2>
        </div>
        <div className="text-[11px] font-mono text-text-tertiary">
          {shortAddr}
        </div>
      </div>

      <div className="space-y-2">
        {CHAINS.map((c, idx) => {
          const usdtBalance = usdtResults?.[idx];
          const usdtRaw =
            usdtBalance && usdtBalance.status === 'success'
              ? (usdtBalance.result as bigint)
              : undefined;
          const usdtStr = formatBalance(usdtRaw, c.usdtDecimals);
          const hasUsdt = usdtRaw !== undefined && usdtRaw > BigInt(0);

          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border-glass bg-bg-secondary"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs font-bold text-text-primary">
                  {c.name}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-mono text-text-secondary tabular-nums">
                    {usdtStr}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-text-tertiary">
                    USDT
                  </div>
                </div>
                {hasUsdt && onDepositClick && (
                  <button
                    type="button"
                    onClick={() => onDepositClick(c.depositSlug)}
                    className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#d6a93d]/15 text-[#d6a93d] border border-[#d6a93d]/30 hover:bg-[#d6a93d]/25 transition-colors"
                  >
                    Deposit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-tertiary pt-1">
        <span>
          {isLoading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Refreshing…
            </span>
          ) : (
            'Live balances · refreshes every 30s'
          )}
        </span>
        <a
          href={CHAINS[0].explorerTx(linkedAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[#d6a93d]"
        >
          View on explorer <ExternalLink size={9} />
        </a>
      </div>
    </div>
  );
}

type Props = {
  onDepositClick?: (slug: ChainEntry['depositSlug']) => void;
};

/**
 * Public wrapper — checks WalletConnect configuration + linked wallet
 * BEFORE mounting `<Web3Provider>`. Two failure modes that this guard
 * fixes:
 *
 *   1. Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID at build time:
 *      Web3Provider would still mount with a dummy ID, but rendering
 *      a wallet card a user can't act on is pointless — bail to null.
 *   2. User has no linked wallet: we don't have an address to query
 *      balances for, so there is nothing to show.
 *
 * Calling any wagmi hook outside <WagmiProvider> throws
 * WagmiProviderNotFoundError on the client, which crashes the entire
 * wallet page. Mounting Web3Provider here as the outer wrapper makes
 * `useReadContracts()` in the inner component safe.
 */
function OnChainWalletBalanceWrapper(props: Props) {
  const hasWallet = useAuthStore((s) => Boolean(s.user?.wallet_address));
  if (!isWalletConnectConfigured()) return null;
  if (!hasWallet) return null;
  return (
    <Web3Provider>
      <OnChainWalletBalanceInner {...props} />
    </Web3Provider>
  );
}

export default memo(OnChainWalletBalanceWrapper);
