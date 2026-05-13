'use client';

/**
 * Linked-wallet section for the profile / security page.
 *
 * Two states:
 *  - Wallet linked → shows truncated address, "Copy" button, "Unlink"
 *    button (disabled with a tooltip when wallet is the user's only
 *    sign-in method, since unlinking would lock them out).
 *  - No wallet → shows a <ConnectWalletButton variant="link" /> that runs
 *    the SIWE flow against /profile/wallet/link/* and refreshes the user
 *    on success.
 */
import { useState } from 'react';
import { Check, Copy, Wallet, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import ConnectWalletButton from '@/components/auth/ConnectWalletButton';

function _short(addr: string | null | undefined): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function LinkedWalletCard() {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const linked = !!user.wallet_address;
  const canUnlink = !!user.has_password || !!user.has_google;

  const handleCopy = async () => {
    if (!user.wallet_address) return;
    try {
      await navigator.clipboard.writeText(user.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleUnlink = async () => {
    if (!canUnlink || unlinking) return;
    if (!confirm('Unlink this wallet from your FXArtha account?')) return;
    setUnlinking(true);
    try {
      await api.delete('/profile/wallet/link');
      await refreshUser();
      toast.success('Wallet unlinked');
    } catch (err: any) {
      const detail =
        err?.detail || err?.response?.data?.detail || err?.message ||
        'Could not unlink wallet';
      toast.error(detail);
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="bg-card-base border border-border-glass/30 rounded-xl p-4 md:p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#d6a93d]/15 flex items-center justify-center shrink-0">
          <Wallet size={16} className="text-[#d6a93d]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary leading-tight">
            Connect Wallet
          </h3>
          <p className="text-text-tertiary text-xs mt-0.5 leading-relaxed">
            {linked
              ? 'This wallet is linked to your account for on-chain deposits and withdrawals.'
              : 'Connect an external wallet (MetaMask, Trust, Rainbow, Coinbase, OKX, …) to link it with your account for transactions and payments.'}
          </p>
        </div>
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border-primary">
            <span className="font-mono text-sm text-text-primary truncate">
              {_short(user.wallet_address)}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-[#d6a93d] transition-colors"
              aria-label="Copy wallet address"
            >
              {copied ? (
                <>
                  <Check size={12} /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-text-tertiary leading-relaxed flex-1 min-w-[180px]">
              {canUnlink
                ? 'Unlinking disconnects this wallet from your account. You can connect a different wallet later.'
                : 'Set a password before unlinking — this wallet is currently your only sign-in method.'}
            </p>
            <button
              type="button"
              onClick={handleUnlink}
              disabled={!canUnlink || unlinking}
              className="auth-btn auth-btn--outline"
              style={{ width: 'auto', padding: '8px 14px', fontSize: '13px' }}
              title={!canUnlink ? 'Set a password before unlinking' : undefined}
            >
              {unlinking ? (
                <>
                  <Loader2 size={14} className="auth-spinner" /> Unlinking…
                </>
              ) : (
                'Unlink wallet'
              )}
            </button>
          </div>
        </div>
      ) : (
        <ConnectWalletButton variant="link" />
      )}
    </div>
  );
}
