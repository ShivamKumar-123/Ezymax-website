'use client';

/**
 * Wagmi-using subtree of OnchainDepositFlow for the EVM chains
 * (USDT-ERC20 / USDT-BEP20). Renders the RainbowKit ConnectButton +
 * a "Send …" button that triggers a USDT contract `transfer()` call.
 *
 * After the wallet broadcasts the tx, we POST the hash to
 * /wallet/deposit/{id}/confirm-tx so the backend's chain_verifier_engine
 * picks it up. The tx hash is also surfaced in the UI for the user.
 */
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount, useChainId, useSwitchChain, useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { erc20Abi } from 'viem';
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

type CreateOnchainResp = {
  deposit_id: string;
  network: string;
  admin_address: string;
  amount_usd: number;
  amount_usdt_base_units: string;
  amount_usdt_decimal: string;
  token_contract: string;
  chain_id: number;
  decimals: number;
  min_confirmations: number;
  expires_at: string;
};

type Props = {
  deposit: CreateOnchainResp;
  onSubmittedTx: (hash: string) => void;
};

const EXPLORER_TX: Record<string, string> = {
  eth: 'https://etherscan.io/tx/',
  bsc: 'https://bscscan.com/tx/',
};

export default function OnchainConnectAndSend({ deposit, onSubmittedTx }: Props) {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  const wrongNetwork = isConnected && deposit.chain_id > 0 && currentChainId !== deposit.chain_id;
  const write = useWriteContract();
  const txHash = (write.data as `0x${string}` | undefined) ?? undefined;
  const sending = write.isPending;
  const wagmiError = (write.error as Error | undefined)?.message;

  const wait = useWaitForTransactionReceipt({ hash: txHash });

  // Persist tx hash to backend the moment wagmi reports it. Once stored,
  // the chain_verifier_engine takes over and credits when confirmed.
  const [reportedHash, setReportedHash] = useState<string | null>(null);
  useEffect(() => {
    if (!txHash || reportedHash === txHash) return;
    setReportedHash(txHash);
    void api
      .post(`/wallet/deposit/${deposit.deposit_id}/confirm-tx`, {
        tx_hash: txHash,
      })
      .then(() => {
        toast.success('Transaction submitted — verifying on chain');
        onSubmittedTx(txHash);
      })
      .catch((e: any) => {
        const detail = e?.response?.data?.detail;
        toast.error(
          typeof detail === 'string'
            ? detail
            : 'Tx broadcast but server didn\'t accept it — contact support',
        );
      });
  }, [txHash, reportedHash, deposit.deposit_id, onSubmittedTx]);

  const onSend = () => {
    if (!isConnected) {
      toast.error('Connect your wallet first');
      return;
    }
    if (wrongNetwork) {
      switchChain({ chainId: deposit.chain_id });
      return;
    }
    try {
      write.writeContract({
        address: deposit.token_contract as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [
          deposit.admin_address as `0x${string}`,
          BigInt(deposit.amount_usdt_base_units),
        ],
      });
    } catch (e: any) {
      toast.error(e?.message || 'Send failed');
    }
  };

  return (
    <div className="space-y-2">
      <ConnectButton
        accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
        showBalance={false}
        chainStatus="icon"
      />

      {isConnected && wrongNetwork && (
        <button
          type="button"
          onClick={onSend}
          disabled={switching}
          className={
            'w-full py-3 rounded-xl font-bold text-sm transition-all ' +
            (switching
              ? 'bg-bg-hover text-text-tertiary'
              : 'bg-amber-500 text-bg-base hover:brightness-110')
          }
        >
          {switching ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 size={14} className="animate-spin" /> Switching network…
            </span>
          ) : (
            <>Switch to {deposit.network.toUpperCase()}</>
          )}
        </button>
      )}

      {isConnected && !wrongNetwork && !txHash && (
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className={
            'w-full py-3.5 rounded-xl font-bold text-sm transition-all ' +
            (sending
              ? 'bg-bg-hover text-text-tertiary cursor-not-allowed'
              : 'bg-[#d6a93d] text-bg-base hover:brightness-110')
          }
        >
          {sending ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 size={14} className="animate-spin" /> Confirm in your wallet…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 justify-center">
              Send ${deposit.amount_usd.toFixed(2)} USDT
              <ArrowRight size={14} />
            </span>
          )}
        </button>
      )}

      {wagmiError && (
        <p className="text-[11px] text-red-300 leading-snug">
          {wagmiError.length > 200 ? wagmiError.slice(0, 200) + '…' : wagmiError}
        </p>
      )}

      {txHash && (
        <a
          href={(EXPLORER_TX[deposit.network] || '') + txHash}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
        >
          View transaction <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}
