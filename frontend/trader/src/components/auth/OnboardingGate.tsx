'use client';

/**
 * Multi-step onboarding gate that runs AFTER ProfileCompleteGate.
 *
 * Sequence the gate enforces (per platform policy):
 *   1. profile_complete  →  ProfileCompleteGate handles this. If it's
 *      still false we render nothing here and let that other gate own
 *      the screen.
 *   2. wallet_linked     →  user must connect a wallet via SIWE.
 *   3. email_verified    →  if the user signed in with a wallet they have
 *      a placeholder @wallet.fxartha.local email; they must add a real
 *      email and verify via OTP. Same applies to email/password users
 *      who never went through OTP.
 *
 * The modal is non-dismissible: there is no close button, the backdrop
 * doesn't dismiss, Escape doesn't dismiss. The user must finish the
 * step or sign out (a "Sign out" link is exposed at the bottom as the
 * only escape hatch).
 *
 * Demo accounts and staff (admin / super_admin / employee) are exempt.
 */
import { useMemo } from 'react';
import { ShieldCheck, Wallet, Mail, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import EmailOtpStep from './EmailOtpStep';
import WalletLinkStep from './WalletLinkStep';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'employee']);

export default function OnboardingGate() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);

  // Decide whether the gate runs at all. We deliberately mirror the
  // server-side require_onboarded check so a UI bug can't accidentally
  // open access; if the server says onboarding_complete=false the user
  // sees the modal regardless of what the FE state thinks.
  const decision = useMemo(() => {
    if (!isInitialized || !isAuthenticated || !user) return 'hidden' as const;
    if (user.is_demo) return 'hidden' as const;
    if (STAFF_ROLES.has(user.role)) return 'hidden' as const;

    // Step 1 belongs to ProfileCompleteGate. Defer to it.
    if (user.profile_complete === false) return 'hidden' as const;

    // Already onboarded — nothing to do.
    if (user.onboarding_complete) return 'hidden' as const;

    if (!user.wallet_linked) return 'wallet' as const;
    if (!user.email_verified || user.is_wallet_placeholder) return 'email' as const;

    return 'hidden' as const;
  }, [isInitialized, isAuthenticated, user]);

  if (decision === 'hidden') return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      // Intentionally NO onClick handler — the backdrop is non-dismissible.
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-gate-title"
    >
      <div
        className="relative w-full max-w-lg my-auto rounded-2xl border border-[#d6a93d]/40 bg-bg-secondary shadow-2xl"
        // Stop clicks inside the card from closing the page-level UI.
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 pt-6 pb-3 border-b border-border-primary">
          <div className="flex items-center gap-2 text-[#d6a93d] mb-2">
            <ShieldCheck size={16} />
            <span className="text-[10px] uppercase tracking-wider font-semibold">
              Account setup required
            </span>
          </div>
          <h2 id="onboarding-gate-title" className="text-base font-bold text-text-primary">
            {decision === 'wallet' ? 'Connect a wallet' : 'Verify your email'}
          </h2>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            {decision === 'wallet'
              ? "Every FXArtha account must have a verified wallet linked. We'll use it for withdrawals, so make sure you control it."
              : "We need a verified email on file before you can use the platform. Enter the address you want to use and we'll send you a one-time code."}
          </p>
        </header>

        <div className="px-6 py-5">
          {decision === 'wallet' && (
            <WalletLinkStep onLinked={() => void refreshUser()} />
          )}
          {decision === 'email' && (
            <EmailOtpStep
              currentEmail={user?.email || ''}
              isPlaceholder={Boolean(user?.is_wallet_placeholder)}
              onVerified={() => void refreshUser()}
            />
          )}
        </div>

        <footer className="px-6 pb-5 pt-1 flex items-center justify-between gap-2 border-t border-border-primary">
          <div className="flex items-center gap-1.5 text-[10.5px] text-text-tertiary">
            <Wallet size={11} />
            <Mail size={11} />
            <span>1 wallet + 1 verified email per account</span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </footer>
      </div>
    </div>
  );
}
