'use client';

/**
 * The wagmi-using subtree of WalletDepositModal. Renders the RainbowKit
 * ConnectButton + the "Send …" button that triggers the on-chain transfer.
 *
 * Splits into two transfer paths:
 *  - native ETH / BNB / MATIC / ARB-ETH → useSendTransaction
 *  - ERC-20 tokens (USDT, USDC, etc.)   → useWriteContract on transfer()
 *
 * Token contract addresses are looked up by (network, currency). New ones
 * are easy to add — see TOKEN_CONTRACTS below.
 *
 * After a successful broadcast we POST the tx hash to the backend (purely
 * informational — settlement still gates on the IPN webhook).
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount, useChainId, useSendTransaction, useSwitchChain, useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { erc20Abi, parseEther, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { NETWORK_TO_CHAIN } from '@/lib/web3/config';

/** Token contracts indexed by (network, normalized currency). All addresses
 * are checksummed mainnet contracts. Add new pairs as we onboard them. */
const TOKEN_CONTRACTS: Record<string, { address: `0x${string}`; decimals: number }> = {
  // Ethereum
  'eth:usdterc20': { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  'eth:usdcerc20': { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  // BSC
  'bsc:usdtbsc':   { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  'bsc:usdcbsc':   { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  // Polygon
  'polygon:usdtmatic': { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  'polygon:usdcmatic': { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 }, // USDC native
  // Arbitrum
  'arbitrum:usdtarb': { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  'arbitrum:usdcarb': { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }, // USDC native
};

type Props = {
  depositId: string;
  payAddress: string;
  payAmount: string;
  payCurrency: string; // NOWPayments code (usdterc20, eth, …)
  network: string;     // wagmi slug (eth, bsc, …)
};

export default function ConnectAndSend({
  depositId, payAddress, payAmount, payCurrency, network,
}: Props) {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  const targetChain = NETWORK_TO_CHAIN[network];
  const wrongNetwork = isConnected && targetChain && currentChainId !== targetChain.id;
  const tokenKey = `${network}:${payCurrency.toLowerCase()}`;
  const isNative = !TOKEN_CONTRACTS[tokenKey] && _looksNative(payCurrency);
  const token = TOKEN_CONTRACTS[tokenKey];

  // Native send (ETH / BNB / MATIC / ARB-ETH)
  const send = useSendTransaction();
  // ERC-20 transfer
  const write = useWriteContract();
  const txHash = (send.data || write.data) as `0x${string}` | undefined;
  const sending = send.isPending || write.isPending;
  const wagmiError =
    (send.error as Error | undefined)?.message ||
    (write.error as Error | undefined)?.message;

  const wait = useWaitForTransactionReceipt({ hash: txHash });

  // Persist tx hash to backend once wagmi reports it.
  const [savedHash, setSavedHash] = useState<string | null>(null);
  useEffect(() => {
    if (!txHash || savedHash === txHash) return;
    setSavedHash(txHash);
    void api
      .post(`/wallet/deposit/${depositId}/tx-hash`, { tx_hash: txHash })
      .catch(() => {/* informational; settlement waits on IPN */});
  }, [txHash, savedHash, depositId]);

  const handleSwitch = () => {
    if (!targetChain) return;
    switchChain({ chainId: targetChain.id });
  };

  const handleSend = () => {
    if (!isConnected) {
      toast.error('Connect a wallet first');
      return;
    }
    if (wrongNetwork && targetChain) {
      handleSwitch();
      return;
    }
    try {
      if (isNative) {
        send.sendTransaction({
          to: payAddress as `0x${string}`,
          value: parseEther(payAmount),
        });
        return;
      }
      if (!token) {
        toast.error('This asset isn\'t set up for wallet-connect yet — pay manually.');
        return;
      }
      write.writeContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [payAddress as `0x${string}`, parseUnits(payAmount, token.decimals)],
      });
    } catch (e: any) {
      toast.error(e?.message || 'Could not start transaction');
    }
  };

  const explorerUrl = txHash && targetChain
    ? _explorerTxUrl(targetChain.id, txHash)
    : null;

  return (
    <div className="space-y-3 pt-2 border-t border-border-primary">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">Pay with a connected wallet</p>
        <ConnectButton
          showBalance={false}
          accountStatus="address"
          chainStatus="icon"
        />
      </div>

      {isConnected && (
        <>
          {wrongNetwork && targetChain && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={12} /> Switch to {targetChain.name}
              </span>
              <button
                type="button"
                onClick={handleSwitch}
                disabled={switching}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-60 text-[11px] font-medium"
              >
                {switching ? 'Switching…' : 'Switch'}
              </button>
            </div>
          )}

          {!wrongNetwork && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !!wait.data || (!isNative && !token)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-[#d6a93d] text-bg-base text-sm font-bold disabled:opacity-60"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> :
               wait.data ? <Check size={14} /> :
               <ArrowRight size={14} />}
              {sending ? 'Confirm in your wallet…' :
               wait.data ? 'Sent — waiting for confirmations' :
               `Send ${payAmount} ${payCurrency.toUpperCase()}`}
            </button>
          )}

          {wagmiError && (
            <p className="text-[11px] text-red-400 leading-relaxed">
              {wagmiError.length > 240 ? wagmiError.slice(0, 240) + '…' : wagmiError}
            </p>
          )}

          {txHash && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-[#d6a93d]"
            >
              View on explorer <ExternalLink size={11} />
            </a>
          )}

          {!isNative && !token && (
            <p className="text-[11px] text-text-tertiary leading-relaxed">
              The {payCurrency.toUpperCase()} contract isn't pre-registered on this build —
              please pay manually using the address above.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function _looksNative(payCurrency: string): boolean {
  const c = (payCurrency || '').toLowerCase();
  return ['eth', 'bnb', 'bnbbsc', 'matic', 'pol'].includes(c);
}

function _explorerTxUrl(chainId: number, hash: string): string {
  switch (chainId) {
    case 1: return `https://etherscan.io/tx/${hash}`;
    case 56: return `https://bscscan.com/tx/${hash}`;
    case 137: return `https://polygonscan.com/tx/${hash}`;
    case 42161: return `https://arbiscan.io/tx/${hash}`;
    default: return `#`;
  }
}
