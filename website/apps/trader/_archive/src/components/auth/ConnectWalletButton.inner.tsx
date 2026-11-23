'use client';

/**
 * Lazy-loaded shell that mounts <Web3Provider> (wagmi + RainbowKit +
 * tanstack-query) around <ConnectWalletFlow>. Only imported when the
 * outer ConnectWalletButton actually renders — avoids paying the wagmi
 * bundle cost on every login page visit.
 */
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import ConnectWalletFlow from './ConnectWalletFlow';

const Web3Provider = dynamic(
  () => import('@/components/providers/Web3Provider'),
  {
    ssr: false,
    loading: () => (
      <button type="button" className="auth-btn auth-btn--outline" disabled>
        <Loader2 size={16} className="auth-spinner" />
        <span>Loading wallet…</span>
      </button>
    ),
  },
);

type Props = {
  variant?: 'login' | 'link';
  disabled?: boolean;
};

export default function ConnectWalletButtonInner({ variant = 'login', disabled }: Props) {
  return (
    <Web3Provider>
      <ConnectWalletFlow variant={variant} disabled={disabled} />
    </Web3Provider>
  );
}
