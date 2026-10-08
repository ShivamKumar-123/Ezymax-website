'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Users, Copy, Check, Loader2, Share2, BadgeCheck } from 'lucide-react';
import api from '@/lib/api/client';

interface Referral {
  code: string;
  path: string;
  referred_count: number;
  is_ib: boolean;
}

export default function ReferralPage() {
  const [data, setData] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Referral>('/business/referral/me');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const link = data ? `${typeof window !== 'undefined' ? window.location.origin : ''}${data.path}` : '';

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  return (
    <DashboardShell>
      <div className="space-y-5 pb-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <Users size={22} className="text-[#FF6A00]" /> Refer &amp; Earn
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Share your link. Everyone you bring in is tracked to you — and once you refer even one
            trader, you automatically become an <span className="text-[#FF6A00] font-semibold">IB partner</span>
            {' '}and start earning per-lot rebates.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary py-10 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : data ? (
          <>
            {/* Link card */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary font-bold mb-2">Your referral link</p>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0 rounded-xl px-3 py-3 text-sm font-mono text-text-primary truncate"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                  {link}
                </div>
                <button type="button" onClick={copy}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-xl text-sm font-bold"
                  style={{ color: '#060606', background: '#FF6A00' }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text-tertiary">Code: <span className="font-mono font-bold text-text-secondary">{data.code}</span></span>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button type="button" onClick={() => navigator.share?.({ url: link, title: 'Join me on Ezymax' })}
                    className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
                    <Share2 size={13} /> Share
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary font-bold">People referred</p>
                <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono tabular-nums mt-1 truncate">{data.referred_count}</p>
              </div>
              <div className="rounded-2xl p-4 flex flex-col justify-center" style={{ background: 'var(--bg-card)', border: `1px solid ${data.is_ib ? '#FF6A0055' : 'var(--border-primary)'}` }}>
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary font-bold">Partner status</p>
                {data.is_ib ? (
                  <p className="text-lg font-bold mt-1 flex items-center gap-1.5" style={{ color: 'var(--accent-ink)' }}>
                    <BadgeCheck size={18} /> IB Partner
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary mt-1">Refer <b className="text-text-primary">1</b> trader to unlock IB partner rebates.</p>
                )}
              </div>
            </div>

            {data.is_ib && (
              <div className="rounded-xl p-3 text-xs text-text-secondary" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                You&apos;re an IB partner — log in to the <b className="text-text-primary">IB Portal</b> with your
                {' '}<b className="text-text-primary">same email &amp; password</b> to track lots, tiers and rebates.
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-text-secondary">Couldn&apos;t load your referral link. Try again.</p>
        )}
      </div>
    </DashboardShell>
  );
}
