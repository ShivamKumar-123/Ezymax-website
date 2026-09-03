'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { CheckCircle2, Copy as CopyIcon } from 'lucide-react';
import { ibGet, fmt, UnauthorizedError } from '@/lib/api';
import type { DashboardData, Commission } from '@/lib/types';
import StatCard from '@/components/StatCard';
import SectionCard from '@/components/SectionCard';
import RebateCalculator from '@/components/RebateCalculator';
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
    { label: 'Total Commission', value: `$${fmt(d.total_commission)}`, variant: 'green' as const, href: '/commissions' },
    { label: 'Total Earned', value: `$${fmt(d.total_earned)}`, variant: 'lime' as const, href: '/commissions' },
    { label: 'Pending Payout', value: `$${fmt(d.pending_payout)}`, variant: 'amber' as const, href: '/commissions' },
    { label: 'Referrals', value: String(d.total_referrals), variant: 'blue' as const, href: '/referrals' },
    { label: 'No Trade Yet', value: String(d.registered_no_trade), variant: 'neutral' as const, href: '/untraded' },
    { label: 'Sub-IBs', value: String(d.sub_ib_count), variant: 'purple' as const, href: '/sub-ibs' },
  ];

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-8 noise-texture"
        style={{
          background: 'radial-gradient(120% 140% at 100% 0%, rgba(204,255,0,0.16), transparent 55%), linear-gradient(180deg, var(--bg-card), var(--bg-card-nested))',
          borderColor: 'rgba(204,255,0,0.28)',
          boxShadow: '0 20px 60px -24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Decorative lime orbs for an eye-catching hero. */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-50 blur-3xl" style={{ background: 'rgba(204,255,0,0.18)' }} aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-[-40%] h-52 w-52 rounded-full opacity-30 blur-3xl" style={{ background: 'rgba(204,255,0,0.10)' }} aria-hidden />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-success">
                <CheckCircle2 size={13} /> Approved IB
              </span>
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent shadow-[0_0_16px_rgba(204,255,0,0.25)]">Level {d.level}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Welcome back</h1>
            <p className="mt-1.5 text-xs text-text-tertiary">
              Referral code: <span className="font-mono font-bold text-accent">{d.referral_code}</span>
            </p>
          </div>
          {d.referral_link && (
            <div className="w-full max-w-md rounded-2xl border border-accent/25 bg-black/25 p-3.5 backdrop-blur-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Your referral link</p>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={d.referral_link} className="min-w-0 flex-1 rounded-xl border border-border-primary bg-bg-secondary px-3 py-2.5 font-mono text-xs text-text-primary outline-none focus:border-accent/50" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(d.referral_link); toast.success('Copied!'); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all hover:brightness-110">
                  <CopyIcon size={13} /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Master IB — the referral link doubles as the IB-introduction link. */}
      {d.is_master_ib && d.referral_link && (
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-primary">Introduce an IB</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary max-w-xl">
                As a <span className="font-semibold text-accent">Master IB</span>, you introduce new IBs with this
                link. Anyone who registers through it becomes your direct referral — when they apply as an IB and
                are approved, they are automatically linked under you, and you earn your share of every commission
                they generate.
              </p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2 sm:shrink-0">
              <input type="text" readOnly value={d.referral_link} className="min-w-0 flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary outline-none" />
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(d.referral_link); toast.success('Introduction link copied!'); }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-accent/90"
              >
                <CopyIcon size={13} /> Copy link
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <SectionCard
        title="How Much Can You Earn?"
        subtitle="Estimate your monthly rebate — drag the sliders."
      >
        <div className="px-4 sm:px-5 py-5">
          <RebateCalculator />
        </div>
      </SectionCard>

      <SectionCard
        title="Recent commissions"
        subtitle="Your latest earnings"
        action={<Link href="/commissions" className="text-xs font-semibold text-accent hover:underline">View all</Link>}
      >
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-text-tertiary">No commissions yet.</p>
        ) : (
          <table className="w-full min-w-[420px] text-xs">
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
                <tr key={c.id} className="border-b border-border-primary/50 transition-colors hover:bg-accent/[0.04]">
                  <td className="px-4 py-3 font-medium text-text-primary">{c.source_user?.name || c.source_user?.email}</td>
                  <td className="px-4 py-3 capitalize text-text-secondary">{c.commission_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-success">${fmt(c.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={clsx(
                      'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                      c.status === 'paid' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
                    )}>{c.status}</span>
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
