'use client';

/**
 * Email card on the Profile → Security page.
 *
 * Three states:
 *   • placeholder (wallet-first signup): big yellow callout pushing the
 *     user to add and verify a real address. Inline OTP form.
 *   • verified: shows the address + a green "Verified" badge + a
 *     "Change email" button that expands the same OTP flow.
 *   • not verified (rare — covers email/password users who haven't
 *     done OTP yet): shows the address + a "Verify now" button that
 *     opens the OTP flow re-using the existing email.
 */
import { useState } from 'react';
import { Mail, ShieldCheck, AlertTriangle, Pencil } from 'lucide-react';
import EmailOtpStep from '@/components/auth/EmailOtpStep';

export default function EmailVerificationCard({
  email, isVerified, isPlaceholder, onChanged,
}: {
  email: string;
  isVerified: boolean;
  isPlaceholder: boolean;
  /** Fired after a successful OTP verify so the parent can refetch /profile. */
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const headline = isPlaceholder
    ? 'Add an email to your account'
    : isVerified
    ? 'Email — verified'
    : 'Verify your email';

  const sub = isPlaceholder
    ? 'Wallet sign-ins start with a placeholder email. Add a real address you control so we can send you trade confirmations, deposit receipts, and password-reset links.'
    : isVerified
    ? "Verified emails receive every transactional notification we send."
    : 'Confirm you control this address before you can use deposits, withdrawals, and trading.';

  return (
    <div className="bg-card-base border border-border-glass/30 rounded-xl p-4 md:p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className={
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' +
          (isPlaceholder
            ? 'bg-amber-500/15'
            : isVerified
            ? 'bg-emerald-500/15'
            : 'bg-amber-500/15')
        }>
          <Mail size={16} className={
            isPlaceholder ? 'text-amber-400'
            : isVerified ? 'text-emerald-400'
            : 'text-amber-400'
          } />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-text-primary leading-tight">{headline}</h3>
            {isVerified && !isPlaceholder && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                <ShieldCheck size={10} /> Verified
              </span>
            )}
            {(!isVerified || isPlaceholder) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400">
                <AlertTriangle size={10} /> Needs verification
              </span>
            )}
          </div>
          <p className="text-text-tertiary text-xs mt-0.5 leading-relaxed">{sub}</p>
        </div>
      </div>

      {!editing && (
        <div className="space-y-3">
          {!isPlaceholder && (
            <div className="px-3 py-2.5 rounded-lg bg-bg-secondary border border-border-primary text-sm text-text-primary truncate">
              {email}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="auth-btn auth-btn--outline inline-flex items-center gap-1.5"
          >
            <Pencil size={12} />
            {isPlaceholder ? 'Add email' : isVerified ? 'Change email' : 'Verify email'}
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 rounded-lg border border-border-primary bg-bg-secondary/40 p-3">
          <EmailOtpStep
            currentEmail={email}
            isPlaceholder={isPlaceholder}
            onVerified={() => {
              setEditing(false);
              onChanged();
            }}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mt-2 text-[11px] text-text-tertiary hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
