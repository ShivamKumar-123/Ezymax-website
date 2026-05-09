'use client';

/**
 * Decentralized USDT deposit flow.
 *
 * The user picks a chain (USDT-ERC20 / USDT-BEP20 / USDT-TRC20), enters
 * a USD amount, and signs the transfer in their own wallet (MetaMask
 * / TronLink / etc.) — funds go directly to FXArtha's per-chain admin
 * deposit address. The backend's chain_verifier_engine watches the
 * tx hash and credits the user's main wallet once confirmations hit.
 *
 * No NowPayments middleman, no manual proof upload. Pure on-chain.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowRight, Check, Clock, Copy, ExternalLink, Loader2, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

// Heavy wagmi-using inner component lazy-loads to keep the wallet page
// snappy on first render. Only needed when the user actually picks an
// EVM chain (eth / bsc).
const Web3Provider = dynamic(() => import('@/components/providers/Web3Provider'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-6 text-text-secondary text-xs gap-2">
      <Loader2 size={14} className="animate-spin" /> Loading wallet…
    </div>
  ),
});
const OnchainConnectAndSend = dynamic(() => import('./OnchainConnectAndSend'), {
  ssr: false,
});


// ── Chains ────────────────────────────────────────────────────────────

type Network = 'eth' | 'bsc' | 'tron' | 'bsc-testnet';

// Feature flag: when set, the BSC-testnet vault chain card is rendered
// alongside the three production networks. Default off so production
// users see the existing three chains only. Set
// NEXT_PUBLIC_VAULT_TESTNET_ENABLED=true at trader-frontend BUILD time
// (Next.js inlines NEXT_PUBLIC_* at build, not runtime).
const VAULT_TESTNET_ENABLED =
  process.env.NEXT_PUBLIC_VAULT_TESTNET_ENABLED === 'true';

const CHAIN_OPTIONS_BASE: Array<{
  id: Network;
  label: string;
  short: string;
  description: string;
  feeHint: string;
  isEvm: boolean;
}> = [
  {
    id: 'tron',
    label: 'USDT · TRC-20',
    short: 'Tron',
    description: 'Tron network. Fastest + cheapest for USDT.',
    feeHint: '~$1 gas, ~1 minute',
    isEvm: false,
  },
  {
    id: 'bsc',
    label: 'USDT · BEP-20',
    short: 'BSC',
    description: 'Binance Smart Chain. Quick and cheap.',
    feeHint: '~$0.30 gas, ~30s',
    isEvm: true,
  },
  {
    id: 'eth',
    label: 'USDT · ERC-20',
    short: 'Ethereum',
    description: 'Ethereum mainnet. Highest gas; most universal.',
    feeHint: '~$5–20 gas, ~3 min',
    isEvm: true,
  },
];

// Testnet card appended only when the build-time feature flag is on.
// Once the FXArthaVaultV1 contract is deployed on BSC mainnet and the
// audit signs off, this card swaps for the mainnet vault chain (or the
// production BSC card above is repointed at the vault contract).
const VAULT_TESTNET_OPTION = {
  id: 'bsc-testnet' as Network,
  label: 'USDT · BSC Testnet (Vault)',
  short: 'BSC Testnet',
  description:
    'FXArthaVaultV1 on BSC testnet (chain 97). Test funds only — get tBNB from the faucet.',
  feeHint: 'tBNB gas, ~30s',
  isEvm: true,
};

const CHAIN_OPTIONS = VAULT_TESTNET_ENABLED
  ? [...CHAIN_OPTIONS_BASE, VAULT_TESTNET_OPTION]
  : CHAIN_OPTIONS_BASE;

// ── API types ─────────────────────────────────────────────────────────

type CreateOnchainResp = {
  deposit_id: string;
  network: Network;
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

type StatusPayload = {
  id: string;
  status: 'initiated' | 'submitted' | 'auto_approved' | 'confirmed' | 'rejected' | string;
  amount_usd: number;
  network: string | null;
  admin_address: string | null;
  tx_hash: string | null;
  confirmations: number | null;
  reason: string | null;
};

const STATUS_POLL_MS = 5_000;
const MIN_AMOUNT = 5;

// ── Component ─────────────────────────────────────────────────────────

export default function OnchainDepositFlow({
  onSettled,
}: {
  /** Fires once when the deposit is auto-credited. Parent can refresh balance. */
  onSettled?: () => void;
}) {
  type Step = 'pick' | 'amount' | 'send';
  const [step, setStep] = useState<Step>('pick');
  const [network, setNetwork] = useState<Network>('tron');
  const [amount, setAmount] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<CreateOnchainResp | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);

  const chosen = CHAIN_OPTIONS.find((c) => c.id === network)!;

  const reset = useCallback(() => {
    setStep('pick');
    setAmount('');
    setDeposit(null);
    setStatus(null);
    setCreateError(null);
  }, []);

  const onContinue = useCallback(async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < MIN_AMOUNT) {
      toast.error(`Minimum deposit is $${MIN_AMOUNT}`);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post<CreateOnchainResp>('/wallet/deposit/onchain', {
        network,
        amount: n,
      });
      setDeposit(res);
      setStep('send');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : e?.message || 'Could not create deposit';
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }, [amount, network]);

  // Poll status while we have a deposit and aren't terminal.
  useEffect(() => {
    if (!deposit) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const s = await api.get<StatusPayload>(
          `/wallet/deposit/${deposit.deposit_id}/onchain-status`,
        );
        if (cancelled) return;
        setStatus(s);
        if (s.status === 'auto_approved' || s.status === 'confirmed') {
          onSettled?.();
          return;
        }
        if (s.status === 'rejected') return;
      } catch {
        /* keep polling silently */
      }
      if (!cancelled) timer = setTimeout(tick, STATUS_POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deposit, onSettled]);

  // ── Render ──────────────────────────────────────────────────────────

  if (step === 'pick') {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs text-text-tertiary mb-2 font-medium uppercase tracking-wide">
            Choose Network
          </p>
          <div className="space-y-2">
            {CHAIN_OPTIONS.map((c) => {
              const active = network === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNetwork(c.id)}
                  className={
                    'w-full text-left rounded-xl px-4 py-3 transition-all border ' +
                    (active
                      ? 'border-[#d6a93d] bg-[#d6a93d]/8 ring-2 ring-[#d6a93d]/40'
                      : 'border-border-primary bg-bg-secondary hover:border-[#d6a93d]/50')
                  }
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-text-primary">{c.label}</p>
                    <span className="text-[10.5px] text-text-tertiary">{c.feeHint}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{c.description}</p>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStep('amount')}
          className="w-full py-3 rounded-xl font-bold text-base bg-[#d6a93d] text-bg-base hover:brightness-110 transition-all"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === 'amount') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="text-text-tertiary hover:text-text-primary"
          >
            ← Back
          </button>
          <span>·</span>
          <span className="text-text-primary font-semibold">{chosen.label}</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-secondary">Amount (USD, ≈ USDT)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-bold">$</span>
            <input
              type="number"
              min={MIN_AMOUNT}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${MIN_AMOUNT}`}
              autoFocus
              className="w-full pl-7 pr-4 py-3 rounded-xl border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#d6a93d]/50 font-mono font-bold text-lg tabular-nums"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#d6a93d]/20 bg-[#d6a93d]/5 px-4 py-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            You'll send <span className="text-text-primary font-semibold">USDT</span>{' '}
            on {chosen.short} from your own wallet to FXArtha's deposit
            address. Your balance is credited automatically once the
            transfer reaches {(network === 'eth' ? 12 : network === 'bsc' ? 15 : 19)}{' '}
            confirmations.
          </p>
        </div>

        {createError && (
          <p className="text-xs text-red-400">{createError}</p>
        )}

        <button
          type="button"
          onClick={() => void onContinue()}
          disabled={creating || !amount || Number(amount) < MIN_AMOUNT}
          className={
            'w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.99] ' +
            (creating || !amount || Number(amount) < MIN_AMOUNT
              ? 'bg-bg-hover text-text-tertiary cursor-not-allowed'
              : 'bg-[#d6a93d] text-bg-base hover:brightness-110')
          }
        >
          {creating ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Preparing…
            </span>
          ) : (
            <>Get deposit address</>
          )}
        </button>
      </div>
    );
  }

  // step === 'send'
  if (!deposit) return null;
  const terminalConfirmed =
    status?.status === 'auto_approved' || status?.status === 'confirmed';
  const terminalRejected = status?.status === 'rejected';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={reset}
          className="text-xs text-text-tertiary hover:text-text-primary"
        >
          ← New deposit
        </button>
        <span className="text-[10px] uppercase tracking-wide text-text-tertiary">
          {chosen.label}
        </span>
      </div>

      {terminalConfirmed && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
          <Check size={28} className="text-emerald-400 mx-auto" />
          <p className="text-sm text-text-primary font-semibold">
            Deposit confirmed
          </p>
          <p className="text-xs text-text-secondary">
            ${deposit.amount_usd.toFixed(2)} added to your main wallet.
          </p>
        </div>
      )}

      {terminalRejected && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <p className="text-sm text-red-300 font-semibold">Deposit rejected</p>
          <p className="text-xs text-text-secondary">
            {status?.reason || 'On-chain verification failed.'} Contact support
            if you believe this is a mistake.
          </p>
        </div>
      )}

      {!terminalConfirmed && !terminalRejected && (
        <>
          <DepositAddressCard deposit={deposit} />

          {chosen.isEvm ? (
            <Web3Provider>
              <OnchainConnectAndSend
                deposit={deposit}
                onSubmittedTx={(hash) => {
                  setStatus((prev) => ({
                    ...(prev || ({} as StatusPayload)),
                    id: deposit.deposit_id,
                    status: 'submitted',
                    amount_usd: deposit.amount_usd,
                    network: deposit.network,
                    admin_address: deposit.admin_address,
                    tx_hash: hash,
                    confirmations: 0,
                    reason: null,
                  }));
                }}
              />
            </Web3Provider>
          ) : (
            <TronManualSubmit
              deposit={deposit}
              onSubmittedTx={(hash) => {
                setStatus((prev) => ({
                  ...(prev || ({} as StatusPayload)),
                  id: deposit.deposit_id,
                  status: 'submitted',
                  amount_usd: deposit.amount_usd,
                  network: deposit.network,
                  admin_address: deposit.admin_address,
                  tx_hash: hash,
                  confirmations: 0,
                  reason: null,
                }));
              }}
            />
          )}

          <StatusBar status={status} minConfirmations={deposit.min_confirmations} />
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function DepositAddressCard({ deposit }: { deposit: CreateOnchainResp }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard
      .writeText(deposit.admin_address)
      .then(() => {
        setCopied(true);
        toast.success('Address copied');
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error('Copy failed'));
  };
  return (
    <div className="rounded-xl border border-[#d6a93d]/30 bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">Send exactly</p>
        <p className="text-base font-bold text-text-primary tabular-nums">
          ${deposit.amount_usd.toFixed(2)} USDT
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="bg-white p-2 rounded-md shrink-0">
          <QRCodeCanvas value={deposit.admin_address} size={92} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[10.5px] uppercase tracking-wide text-text-tertiary">
            To this address ({deposit.network.toUpperCase()})
          </p>
          <p className="font-mono text-[11px] text-text-primary break-all leading-snug">
            {deposit.admin_address}
          </p>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d6a93d] hover:brightness-110"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TronManualSubmit({
  deposit, onSubmittedTx,
}: {
  deposit: CreateOnchainResp;
  onSubmittedTx: (hash: string) => void;
}) {
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const onSubmit = async () => {
    const h = hash.trim();
    if (h.length < 10) {
      toast.error('Enter the transaction hash from your wallet');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/wallet/deposit/${deposit.deposit_id}/confirm-tx`, {
        tx_hash: h,
      });
      toast.success('Transaction submitted — verifying on chain');
      onSubmittedTx(h);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      toast.error(
        typeof detail === 'string' ? detail : e?.message || 'Submit failed',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary leading-relaxed">
        Send the amount above from any Tron-compatible wallet
        (TronLink, Trust, Binance, Bybit, etc.) and paste the
        transaction hash below.
      </p>
      <input
        type="text"
        value={hash}
        onChange={(e) => setHash(e.target.value)}
        placeholder="Tron transaction hash (0x… or 64-hex)"
        className="w-full px-3 py-2.5 rounded-lg border border-border-primary bg-bg-base text-text-primary text-xs font-mono outline-none focus:border-[#d6a93d]"
      />
      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={busy || !hash.trim()}
        className={
          'w-full py-3 rounded-xl font-bold text-sm transition-all ' +
          (busy || !hash.trim()
            ? 'bg-bg-hover text-text-tertiary cursor-not-allowed'
            : 'bg-[#d6a93d] text-bg-base hover:brightness-110')
        }
      >
        {busy ? (
          <span className="inline-flex items-center gap-2 justify-center">
            <Loader2 size={14} className="animate-spin" /> Submitting…
          </span>
        ) : (
          'I\'ve sent it — verify'
        )}
      </button>
    </div>
  );
}

function StatusBar({
  status, minConfirmations,
}: {
  status: StatusPayload | null;
  minConfirmations: number;
}) {
  if (!status) {
    return (
      <div className="rounded-lg border border-border-primary bg-bg-base px-3 py-2.5 text-xs text-text-tertiary flex items-center gap-2">
        <Clock size={12} /> Waiting for your transfer…
      </div>
    );
  }
  if (status.status === 'submitted') {
    const confs = status.confirmations ?? 0;
    return (
      <div className="rounded-lg border border-[#d6a93d]/30 bg-[#d6a93d]/5 px-3 py-2.5 text-xs text-text-primary flex items-center gap-2">
        <Loader2 size={12} className="animate-spin text-[#d6a93d]" />
        Verifying on chain — {confs}/{minConfirmations} confirmations
      </div>
    );
  }
  return null;
}
