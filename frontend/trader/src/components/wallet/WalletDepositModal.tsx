'use client';

/**
 * On-site NOWPayments wallet-connect deposit modal.
 *
 * Lifecycle (production-grade — never trust the client for credit):
 *   1. User picks asset + amount → backend POST /wallet/deposit/wallet
 *   2. Backend creates 'initiated' Deposit + NOWPayments /v1/payment;
 *      returns pay_address, pay_amount, pay_currency, network, expires_at.
 *   3. We render QR + countdown + "Connect Wallet" + "Pay manually".
 *   4. User connects an EVM wallet (RainbowKit). If chain ≠ network we
 *      auto-switch via wagmi `useSwitchChain`.
 *   5. User clicks "Send …" → wagmi `useSendTransaction` (native ETH/BNB)
 *      OR `useWriteContract` (ERC-20 transfer). Wallet pops; user signs.
 *   6. We POST /wallet/deposit/{id}/tx-hash so support has it; UI moves to
 *      "Waiting for confirmations…" and polls /wallet/deposit/{id}/status.
 *   7. The IPN webhook (NOT this UI) flips status → auto_approved + credits
 *      balance + sends the email. The polling loop just observes that.
 *
 * Fallback: if the user has no wallet OR wallet-connect fails, the address
 * + QR remain rendered — they can pay from any external wallet/exchange.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { QRCodeCanvas } from 'qrcode.react';
import {
  AlertTriangle, ArrowRight, Check, Clock, Copy, ExternalLink,
  Loader2, RefreshCw, ShieldCheck, Wallet, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { isWalletConnectConfigured, NETWORK_TO_CHAIN } from '@/lib/web3/config';

// The wagmi hooks + ConnectButton are heavy and only needed inside the
// "Connect Wallet" branch. Keep the modal openable on first render, but
// lazy-load the whole web3 stack so /wallet doesn't pay it on every visit.
const Web3Provider = dynamic(() => import('@/components/providers/Web3Provider'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-6 text-text-secondary text-xs gap-2">
      <Loader2 size={14} className="animate-spin" /> Loading wallet…
    </div>
  ),
});
const ConnectAndSend = dynamic(() => import('@/components/wallet/ConnectAndSend'), {
  ssr: false,
});

type CreatedDeposit = {
  id: string;
  status: string;
  amount_usd: number;
  pay_address: string;
  pay_amount: string;
  pay_currency: string;
  network: string | null;
  expires_at: string | null;
  payment_id: string;
};

type StatusPayload = {
  id: string;
  status: 'initiated' | 'pending' | 'auto_approved' | 'rejected' | string;
  amount_usd: number;
  pay_address: string | null;
  pay_amount: string | null;
  pay_currency: string | null;
  network: string | null;
  tx_hash: string | null;
  expires_at: string | null;
  nowpayments_status: string | null;
  confirmations: number | null;
};

const STATUS_POLL_MS = 8_000;

export default function WalletDepositModal({
  open,
  onClose,
  amountUsd,
  cryptoAsset,
  onSettled,
}: {
  open: boolean;
  onClose: () => void;
  /** USD amount the user typed on the deposit form. */
  amountUsd: number;
  /** Frontend asset id (e.g. "USDT_ERC", "ETH"). */
  cryptoAsset: string;
  /** Fired once when the IPN-reconciled status reaches auto_approved. */
  onSettled?: () => void;
}) {
  const [deposit, setDeposit] = useState<CreatedDeposit | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Create the deposit when the modal opens (idempotent guard via state).
  useEffect(() => {
    if (!open) {
      setDeposit(null);
      setStatus(null);
      setError(null);
      return;
    }
    if (deposit || creating) return;
    setCreating(true);
    void (async () => {
      try {
        const res = await api.post<CreatedDeposit>('/wallet/deposit/wallet', {
          amount: amountUsd,
          crypto_currency: cryptoAsset,
        });
        setDeposit(res);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || 'Could not create deposit';
        setError(typeof msg === 'string' ? msg : 'Could not create deposit');
      } finally {
        setCreating(false);
      }
    })();
  }, [open, amountUsd, cryptoAsset, deposit, creating]);

  // 2. Poll status while modal is open and not terminal.
  useEffect(() => {
    if (!open || !deposit) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const s = await api.get<StatusPayload>(`/wallet/deposit/${deposit.id}/status`);
        if (cancelled) return;
        setStatus(s);
        if (s.status === 'auto_approved') {
          onSettled?.();
          return; // stop polling
        }
        if (s.status === 'rejected') {
          return; // stop polling
        }
      } catch {
        // Silent — keep polling.
      }
      if (!cancelled) timer = setTimeout(tick, STATUS_POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, deposit, onSettled]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[#d6a93d]/30 bg-bg-secondary shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary p-1.5 rounded-full hover:bg-bg-hover z-10"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-6 pb-3 border-b border-border-primary">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Wallet size={16} className="text-[#d6a93d]" /> Crypto deposit
          </h2>
          <p className="text-xs text-text-tertiary mt-1">
            ${amountUsd.toFixed(2)} via {labelForAsset(cryptoAsset)}
          </p>
        </div>

        {creating && (
          <div className="px-6 py-10 flex items-center gap-2 text-sm text-text-secondary justify-center">
            <Loader2 size={16} className="animate-spin" /> Preparing your deposit…
          </div>
        )}

        {!creating && error && (
          <div className="px-6 py-8 text-center space-y-3">
            <AlertTriangle size={28} className="text-amber-400 mx-auto" />
            <p className="text-sm text-text-primary">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border-primary text-sm"
            >
              Close
            </button>
          </div>
        )}

        {!creating && !error && deposit && (
          <DepositBody
            deposit={deposit}
            status={status}
            cryptoAsset={cryptoAsset}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */

function DepositBody({
  deposit, status, cryptoAsset, onClose,
}: {
  deposit: CreatedDeposit;
  status: StatusPayload | null;
  cryptoAsset: string;
  onClose: () => void;
}) {
  const settled = status?.status === 'auto_approved';
  const rejected = status?.status === 'rejected';
  const expired = useExpired(deposit.expires_at);
  const networkLabel = NETWORK_TO_CHAIN[deposit.network ?? '']?.name || deposit.network || '—';
  const wcConfigured = isWalletConnectConfigured();
  const evmCompatible = !!NETWORK_TO_CHAIN[deposit.network ?? ''];
  // Set true while the user clicks "Pay on NOWPayments page" — we
  // disable the button to prevent double-spawning hosted invoices on a
  // double-click before the browser navigates away.
  const [redirectingToHosted, setRedirectingToHosted] = useState(false);

  // Domains we trust to receive a hosted-invoice redirect. If the
  // backend ever gets compromised and tries to redirect us elsewhere
  // (or a buggy upstream returns a phishing URL), we refuse and ask
  // the user to retry instead of opening the browser at the bad host.
  const PAYMENT_REDIRECT_ALLOWLIST = ['nowpayments.io', 'oxapay.com'];

  const isAllowedPaymentUrl = (raw: string): boolean => {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:') return false;
      // Match exact host or any subdomain of a trusted host.
      return PAYMENT_REDIRECT_ALLOWLIST.some(
        (host) => u.hostname === host || u.hostname.endsWith(`.${host}`),
      );
    } catch {
      return false;
    }
  };

  const handlePayOnNowPayments = useCallback(async () => {
    if (redirectingToHosted) return;
    setRedirectingToHosted(true);
    try {
      const res = await api.post<{ payment_url: string }>(
        '/wallet/deposit/hosted-invoice',
        { amount: deposit.amount_usd, crypto_currency: cryptoAsset },
      );
      if (res?.payment_url && isAllowedPaymentUrl(res.payment_url)) {
        window.location.href = res.payment_url;
        return; // navigation away
      }
      if (res?.payment_url) {
        // Logged-and-blocked, not redirected. This either means the
        // backend returned a URL on an unexpected host (worth alerting
        // engineering on) or the allowlist is out of date.
        console.error('[wallet] refusing to redirect to untrusted payment URL');
      }
      throw new Error('No valid payment URL returned');
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      const msg = err?.response?.data?.detail || err?.message || 'Could not create hosted invoice';
      toast.error(typeof msg === 'string' ? msg : 'Could not create hosted invoice');
      setRedirectingToHosted(false);
    }
  }, [deposit.amount_usd, cryptoAsset, redirectingToHosted]);

  if (settled) {
    return (
      <div className="px-6 py-10 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
          <Check size={26} className="text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-text-primary">Deposit confirmed</h3>
        <p className="text-sm text-text-secondary">
          ${deposit.amount_usd.toFixed(2)} has been credited to your main wallet.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 px-5 py-2 rounded-md bg-[#d6a93d] text-bg-base text-sm font-bold"
        >
          Done
        </button>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="px-6 py-10 text-center space-y-3">
        <AlertTriangle size={28} className="text-red-400 mx-auto" />
        <h3 className="text-base font-semibold text-text-primary">Deposit rejected</h3>
        <p className="text-sm text-text-secondary">
          The payment couldn't be confirmed. If the funds left your wallet, contact support@fxartha.com with your tx hash.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 px-5 py-2 rounded-md border border-border-primary text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#d6a93d]/5 border border-[#d6a93d]/25">
        <div className="bg-white p-2 rounded shrink-0">
          <QRCodeCanvas value={deposit.pay_address} size={88} bgColor="#ffffff" fgColor="#000000" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] uppercase tracking-wider text-text-tertiary">Send exactly</p>
          <p className="text-lg font-bold text-text-primary tabular-nums break-all">
            {trimAmount(deposit.pay_amount)} {deposit.pay_currency.toUpperCase()}
          </p>
          <p className="text-[10.5px] uppercase tracking-wider text-text-tertiary mt-1">Network</p>
          <p className="text-xs text-text-primary">{networkLabel}</p>
        </div>
      </div>

      <div>
        <label className="text-[10.5px] uppercase tracking-wider text-text-tertiary block mb-1">
          To this address
        </label>
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-bg-base border border-border-primary">
          <code className="text-[11px] text-text-primary truncate flex-1 select-all">
            {deposit.pay_address}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(deposit.pay_address).catch(() => {});
              toast.success('Address copied');
            }}
            className="text-text-tertiary hover:text-text-primary p-1"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      <Countdown deposit={deposit} expired={expired} />

      <StatusStrip status={status} />

      {/* Wallet-connect path: only render the wagmi-using subtree when WC is
          configured AND the network is EVM-compatible. Otherwise, the QR +
          address above are the manual-payment path. */}
      {wcConfigured && evmCompatible && !expired && (
        <Web3Provider>
          <ConnectAndSend
            depositId={deposit.id}
            payAddress={deposit.pay_address}
            payAmount={deposit.pay_amount}
            payCurrency={deposit.pay_currency}
            network={deposit.network ?? ''}
          />
        </Web3Provider>
      )}

      {wcConfigured && !evmCompatible && (
        <div className="text-[11px] text-text-tertiary leading-relaxed border border-border-primary rounded-md p-3">
          The {networkLabel} network isn't supported by the Connect Wallet flow yet —
          send the amount above from any compatible wallet or exchange and we'll
          credit your balance once it confirms on-chain.
        </div>
      )}

      {/* Mode B fallback — Pay on NOWPayments' hosted page. Targets users
          who don't have a Web3 wallet, want to pay from a CEX in a
          currency we don't list here, or just prefer the hosted UX. */}
      {!expired && (
        <div className="rounded-md border border-border-primary bg-bg-secondary p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-text-primary">
                Don't have a crypto wallet?
              </p>
              <p className="text-[10px] text-text-tertiary leading-relaxed mt-0.5">
                Pay on the NOWPayments page — works with any exchange,
                supports more currencies. You'll return here after paying.
              </p>
            </div>
            <button
              type="button"
              disabled={redirectingToHosted}
              onClick={handlePayOnNowPayments}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-buy text-white text-[11px] font-bold hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {redirectingToHosted ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Redirecting…
                </>
              ) : (
                <>
                  Pay on NOWPayments <ExternalLink size={11} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-[11px] text-text-tertiary hover:text-text-primary">
          Having wallet issues? Pay manually instead.
        </summary>
        <div className="text-[11px] text-text-secondary leading-relaxed mt-2 space-y-1">
          <p>
            Copy the address above into Binance, Bybit, MetaMask, Trust, or any wallet
            on the <strong>{networkLabel}</strong> network and send <strong>exactly</strong>{' '}
            {trimAmount(deposit.pay_amount)} {deposit.pay_currency.toUpperCase()}.
          </p>
          <p className="text-text-tertiary">
            Your balance credits automatically once the network confirms the transaction.
            Don't close this window if you want to track confirmations live.
          </p>
        </div>
      </details>

      <p className="text-[10px] text-text-tertiary leading-relaxed flex items-start gap-1.5">
        <ShieldCheck size={11} className="shrink-0 mt-0.5 text-emerald-400" />
        Funds settle only after on-chain confirmation. Sending a different amount
        or wrong network may delay or void the deposit.
      </p>
    </div>
  );
}

/* ─── Atoms ─────────────────────────────────────────────────────────── */

function StatusStrip({ status }: { status: StatusPayload | null }) {
  const npStatus = status?.nowpayments_status || (status?.status === 'initiated' ? 'awaiting_payment' : status?.status);
  const conf = status?.confirmations;
  const local = status?.status || 'initiated';

  const tone =
    local === 'auto_approved' ? 'emerald' :
    local === 'rejected' ? 'red' :
    local === 'pending' || (npStatus && ['confirming', 'sending'].includes(npStatus)) ? 'amber' :
    'border';

  const cls = {
    emerald: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
    amber: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
    red: 'border-red-500/40 bg-red-500/5 text-red-400',
    border: 'border-border-primary text-text-secondary',
  }[tone];

  return (
    <div className={'rounded-md border px-3 py-2 text-xs flex items-center gap-2 ' + cls}>
      {local === 'auto_approved' ? <Check size={12} /> :
       local === 'rejected' ? <AlertTriangle size={12} /> :
       <RefreshCw size={12} className="animate-spin" />}
      <span className="flex-1">
        {local === 'auto_approved' ? 'Confirmed — balance credited.' :
         local === 'rejected' ? 'Payment rejected.' :
         npStatus === 'confirming' ? 'Confirming on-chain…' :
         npStatus === 'sending' ? 'Sending to wallet…' :
         'Waiting for payment…'}
      </span>
      {typeof conf === 'number' && conf > 0 && (
        <span className="tabular-nums opacity-80">{conf} conf</span>
      )}
    </div>
  );
}

function Countdown({ deposit, expired }: { deposit: CreatedDeposit; expired: boolean }) {
  if (!deposit.expires_at) return null;
  const remaining = useRemaining(deposit.expires_at);
  if (expired) {
    return (
      <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
        <Clock size={11} /> Payment window expired. Open a new deposit to continue.
      </p>
    );
  }
  return (
    <p className="text-[11px] text-text-tertiary flex items-center gap-1.5">
      <Clock size={11} className="text-[#d6a93d]" /> Payment window: {remaining}
    </p>
  );
}

/* ─── Hooks ─────────────────────────────────────────────────────────── */

function useExpired(iso: string | null): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!iso) return;
    const at = new Date(iso).getTime();
    if (!Number.isFinite(at)) return;
    const tick = () => setExpired(Date.now() >= at);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return expired;
}

function useRemaining(iso: string): string {
  const [text, setText] = useState('—');
  useEffect(() => {
    const at = new Date(iso).getTime();
    if (!Number.isFinite(at)) return;
    const tick = () => {
      const ms = at - Date.now();
      if (ms <= 0) { setText('expired'); return; }
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setText(h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return text;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function trimAmount(s: string): string {
  // Drop trailing zeros after the decimal so "0.000423000" → "0.000423".
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

function labelForAsset(id: string): string {
  switch (id) {
    case 'USDT_ERC': return 'USDT (ERC20)';
    case 'USDC_ERC': return 'USDC (ERC20)';
    case 'USDT_BSC': return 'USDT (BSC)';
    case 'USDC_BSC': return 'USDC (BSC)';
    case 'USDT_MATIC': return 'USDT (Polygon)';
    case 'USDC_MATIC': return 'USDC (Polygon)';
    case 'USDT_ARB': return 'USDT (Arbitrum)';
    case 'USDC_ARB': return 'USDC (Arbitrum)';
    case 'USDT_TRC': return 'USDT (TRC20)';
    case 'USDC_TRC': return 'USDC (TRC20)';
    case 'USDT_SOL': return 'USDT (Solana)';
    case 'USDC_SOL': return 'USDC (Solana)';
    default: return id;
  }
}
