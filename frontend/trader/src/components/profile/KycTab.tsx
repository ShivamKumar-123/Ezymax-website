'use client';

/** KYC tab — status, whether verification is enforced by the broker, and
 *  the path into the full verification flow (/kyc). */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ArrowRight, Info } from 'lucide-react';
import api from '@/lib/api/client';

export default function KycTab({ status }: { status?: string | null }) {
  const [required, setRequired] = useState<boolean | null>(null);
  useEffect(() => {
    api.get<{ kyc_required?: boolean }>('/auth/platform-status')
      .then((r) => setRequired(!!r.kyc_required))
      .catch(() => setRequired(false));
  }, []);
  const s = (status || 'pending').toLowerCase();
  const verified = s === 'approved' || s === 'verified';
  const submitted = s === 'submitted';
  const rejected = s === 'rejected';

  return (
    <div className="p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-5" style={{ background: 'var(--bg-card-nested)' }}>
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${verified ? 'bg-emerald-500/15 text-emerald-500' : 'bg-crx-yellow-soft text-[#C73E11]'}`}>
            {verified ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">
              {verified ? 'Identity verified' : submitted ? 'Verification under review' : rejected ? 'Verification rejected' : 'Not verified yet'}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {verified
                ? 'Your identity documents have been approved. Nothing more to do.'
                : submitted
                  ? 'We received your documents — reviews usually complete within 24 hours.'
                  : rejected
                    ? 'Some documents were not accepted. Open the verification flow to re-upload.'
                    : required === true
                      ? 'Identity verification is required before you can trade live.'
                      : 'Verification is optional. Complete it to unlock higher leverage and card / UPI deposits.'}
            </p>
          </div>
        </div>
        {!verified && (
          <Link
            href="/kyc"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-crx-charcoal px-5 py-2.5 text-sm font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover transition-colors"
          >
            {submitted ? 'View submission' : rejected ? 'Re-submit documents' : 'Start verification'} <ArrowRight size={15} />
          </Link>
        )}
      </div>

      {required === true && !verified && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#E94E1B]/30 bg-crx-yellow-soft px-4 py-3 text-xs text-text-primary">
          <Info size={14} className="mt-0.5 shrink-0 text-[#C73E11]" />
          Verification is enforced by the broker for all live accounts. Demo accounts are unaffected.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Government ID', 'Passport, national ID or driving licence — front and back.'],
          ['Proof of address', 'Utility bill or bank statement issued within the last 3 months.'],
          ['Selfie check', 'A quick selfie to match you against your ID.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl p-4" style={{ background: 'var(--bg-card-nested)' }}>
            <p className="text-sm font-semibold text-text-primary">{t}</p>
            <p className="mt-1 text-xs text-text-secondary">{d}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-text-tertiary">
        Documents are stored encrypted and are only visible to the compliance team. Uploading and re-uploading is handled on the verification page.
      </p>
    </div>
  );
}
