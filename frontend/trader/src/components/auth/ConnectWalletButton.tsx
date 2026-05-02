'use client';

/**
 * Public, lightweight surface for wallet sign-in / link.
 *
 * The actual flow (wagmi hooks, RainbowKit modal, SIWE message construction)
 * lives in `ConnectWalletButton.inner.tsx` and is dynamically imported so
 * the login/register page bundle isn't bloated by Web3Provider + wagmi +
 * RainbowKit when the user never clicks the button.
 *
 * Mirrors the lazy-load discipline already used by WalletDepositModal.
 */
import dynamic from 'next/dynamic';
import { Loader2, Wallet } from 'lucide-react';
import { isWalletConnectConfigured } from '@/lib/web3/config';

const Inner = dynamic(() => import('./ConnectWalletButton.inner'), {
  ssr: false,
  loading: () => (
    <button type="button" className="auth-btn auth-btn--outline" disabled>
      <Loader2 size={16} className="auth-spinner" />
      <span>Loading wallet…</span>
    </button>
  ),
});

type Variant = 'login' | 'link';

type Props = {
  variant?: Variant;
  disabled?: boolean;
};

export default function ConnectWalletButton({ variant = 'login', disabled }: Props) {
  // Hide the button entirely if WalletConnect isn't configured for this
  // build — the Reown project id is required for the WalletConnect-based
  // wallets (Trust mobile, Rainbow, etc.) to enumerate. Without it, the
  // RainbowKit modal would only show injected wallets which is misleading.
  if (!isWalletConnectConfigured()) {
    return (
      <button type="button" className="auth-btn auth-btn--outline" disabled>
        <Wallet size={16} />
        <span>Wallet sign-in not configured</span>
      </button>
    );
  }
  return <Inner variant={variant} disabled={disabled} />;
}
