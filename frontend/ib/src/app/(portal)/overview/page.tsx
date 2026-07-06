'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CheckCircle2, Copy as CopyIcon } from 'lucide-react';
import { ibGet, fmt, UnauthorizedError } from '@/lib/api';
import type { DashboardData, Commission } from '@/lib/types';
import StatCard from '@/components/StatCard';
import SectionCard from '@/components/SectionCard';
import Spinner from '@/components/Spinner';

export default function OverviewPage() {
  const router = useRouter();
  const [d, setD] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dash, comm] = await Promise.all([
          ibGet<DashboardData>('/business/ib/dashboard'),
          ibGet<any>('/business/ib/commissions', { per_page: 5 }),
        ]);
        setD(dash);
        setRecent(comm.items || []);
      } catch (e: any) {
        if (e instanceof UnauthorizedError) return router.replace('/login');
        toast.error('Could not load your dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <Spinner />;
  if (!d) return <p className="py-20 text-center text-sm text-text-tertiary">Dashboard unavailable.</p>;

  const cards = [
    { label: 'Total Commission', value: `$${fmt(d.total_commission)}`, color: 'text-success', href: '/commissions' },
    { label: 'Total Earned', value: `$${fmt(d.total_earned)}`, color: 'text-success', href: '/commissions' },
    { label: 'Pending Payout', value: `$${fmt(d.pending_payout)}`, color: 'text-warning', href: '/commissions' },
    { label: 'Referrals', value: String(d.total_referrals), color: 'text-accent', href: '/referrals' },
    { label: 'No Trade Yet', value: String(d.registered_no_trade), color: 'text-text-secondary', href: '/untraded' },
    { label: 'Sub-IBs', value: String(d.sub_ib_count), color: 'text-accent', href: '/sub-ibs' },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-card p-5 sm:p-7 noise-texture">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.14] via-transparent to-accent/[0.04]" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success" />
              <span className="text-xs font-semibold uppercase tracking-widest text-success">Approved IB</span>
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">Level {d.level}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-text-primary sm:text-3xl">Welcome back</h1>
            <p className="mt-1 text-xs text-text-tertiary">
              Referral code: <span className="font-mono font-bold text-accent">{d.referral_code}</span>
            </p>
          </div>
          {d.referral_link && (
            <div className="w-full max-w-md">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Your referral link</p>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={d.referral_link} className="min-w-0 flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary outline-none" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(d.referral_link); toast.success('Copied!'); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-black">
                  <CopyIcon size={13} /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <SectionCard
        title="Recent commissions"
        subtitle="Your latest earnings"
        action={<Link href="/commissions" className="text-xs font-semibold text-accent hover:underline">View all</Link>}
      >
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-text-tertiary">No commissions yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-2.5 text-left">From</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                  <td className="px-4 py-2.5 text-text-primary">{c.source_user?.name || c.source_user?.email}</td>
                  <td className="px-4 py-2.5 capitalize text-text-secondary">{c.commission_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-success">${fmt(c.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={c.status === 'paid' ? 'text-success' : 'text-warning'}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
