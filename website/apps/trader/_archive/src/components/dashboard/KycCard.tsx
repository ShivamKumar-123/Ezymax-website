'use client';

import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

/**
 * KYC verification card — the platform's EXISTING identity-verification
 * flow (user.kyc_status + /kyc), presented in the reference's
 * "verification / enable" card style. Hidden once approved.
 */
export function KycCard() {
  const user = useAuthStore((s) => s.user);
  const status = (user?.kyc_status || '').toLowerCase();
  if (!user || status === 'approved') return null;

  const submitted = status === 'submitted';
  return (
    <div
      /* Radius and border match PanelCard so this reads as one of the
         cards rather than a banner bolted above them. */
      className="rounded-3xl p-5 flex items-start gap-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass-bright)',
        boxShadow: '0 1px 2px rgba(11,11,12,0.04)',
      }}
    >
      <div
        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(225, 32, 25,0.12)' }}
      >
        <ShieldCheck size={22} className="text-[#E12019]" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-text-primary">
          {submitted ? 'Verification in review' : 'Verify your identity'}
        </h3>
        <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
          {submitted
            ? 'Your documents are being reviewed. We’ll notify you once approved.'
            : 'Complete KYC to unlock deposits, withdrawals and full account access.'}
        </p>
        {!submitted && (
          <Link
            href="/kyc"
            className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1.5 text-[11px] font-extrabold rounded-full"
            style={{ background: '#E12019', color: '#ffffff' }}
          >
            Start verification <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}
