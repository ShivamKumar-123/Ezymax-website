'use client';

/**
 * Wallet-link step inside the OnboardingGate.
 *
 * Wraps the existing ConnectWalletButton in 'link' mode (which runs the
 * SIWE flow against /profile/wallet/link/nonce + /profile/wallet/link)
 * with copy that explains why we need a wallet on file before letting
 * the user trade or withdraw. Connecting flips user.wallet_linked to
 * true; the gate's parent then re-evaluates and either advances to the
 * email step or unmounts entirely.
 */
import { Wallet, ShieldCheck } from 'lucide-react';
import ConnectWalletButton from './ConnectWalletButton';

export default function WalletLinkStep({
  onLinked,  // currently unused — ConnectWalletButton's link flow already
             // refreshes the auth store, but kept on the prop surface so
             // the gate's render-after-link logic stays explicit.
}: {
  onLinked?: () => void;
}) {
  void onLinked;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#d6a93d]/20 bg-[#d6a93d]/5 px-3 py-3 flex items-start gap-2">
        <ShieldCheck size={14} className="text-[#d6a93d] mt-0.5 shrink-0" />
        <div className="text-[11px] text-text-secondary leading-relaxed space-y-1">
          <p>
            <strong className="text-text-primary">Why we ask:</strong>{' '}
            Withdrawals are sent to your linked wallet, and the link
            proves the wallet is yours (you sign a one-time message —
            no transaction, no gas, no funds moved).
          </p>
          <p>
            <strong className="text-text-primary">One wallet per account.</strong>{' '}
            You can disconnect later from Profile → Security if you set a
            password first, but you can never link the same wallet to two
            accounts at once.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-base p-4 flex items-center gap-3">
        <Wallet size={18} className="text-[#d6a93d] shrink-0" />
        <div className="flex-1 text-xs text-text-secondary leading-snug">
          Use any EVM wallet — MetaMask, Trust Wallet, Rainbow, Coinbase
          Wallet, OKX, and so on.
        </div>
      </div>

      <ConnectWalletButton variant="link" />
    </div>
  );
}
