'use client';

/**
 * Standalone Affiliate / IB dashboard — opens in its own tab from the
 * "Affiliates" sidebar item. Deliberately NOT wrapped in DashboardShell:
 * no trader sidebar, its own slim header, full-width polished layout so an
 * approved IB gets a focused partner-portal view of commissions, referrals
 * (incl. who registered but never traded), and their sub-IBs.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import {
  DollarSign, TrendingUp, Clock, Users, UserPlus, Network as NetworkIcon,
  Award, Copy as CopyIcon, ArrowLeft, CheckCircle2, Hourglass,
} from 'lucide-react';

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString(); } catch { return d; } }

function Header() {
  const user = useAuthStore((s) => s.user);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';
  const initials = (name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <header className="sticky top-0 z-30 border-b border-border-primary bg-bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg font-bold tracking-tight shrink-0">
            <span className="text-accent">FX</span><span className="text-text-primary">Artha</span>
          </span>
          <span className="hidden sm:inline text-text-tertiary">/</span>
          <span className="hidden sm:inline text-sm font-semibold text-text-secondary truncate">IB Dashboard</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Trading App</span>
          </Link>
          {name && (
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full border border-accent/40 bg-accent/10 text-[11px] font-bold text-accent">
                {initials}
              </div>
              <span className="hidden md:inline text-sm font-semibold text-text-primary max-w-[160px] truncate">{name}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-bg-base text-text-primary">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</main>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-24">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

const STAT_ICONS: Record<string, any> = {
  'Total Commission': DollarSign,
  'Total Earned': TrendingUp,
  'Pending Payout': Clock,
  'Referrals': Users,
  'No Trade Yet': UserPlus,
  'Sub-IBs': NetworkIcon,
  'Level': Award,
};

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const Icon = STAT_ICONS[label] || DollarSign;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-primary bg-card p-4 sm:p-5 noise-texture transition-transform hover:scale-[1.015]">
      <div className="absolute top-0 right-0 h-16 w-16 rounded-bl-[40px] bg-accent/[0.05] pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10">
          <Icon size={18} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{label}</p>
          <p className={clsx('mt-0.5 truncate font-mono text-lg sm:text-xl font-bold tabular-nums', color)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-primary bg-card noise-texture">
      <div className="border-b border-border-primary px-4 sm:px-5 py-3">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        {subtitle && <p className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default function AffiliateDashboardPage() {
  const [status, setStatus] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const loadStatus = async () => {
    const s = await api.get<any>('/business/status');
    setStatus(s);
    if (s.is_ib) {
      const [d, r, c] = await Promise.all([
        api.get<any>('/business/ib/dashboard'),
        api.get<any>('/business/ib/referrals'),
        api.get<any>('/business/ib/commissions'),
      ]);
      setDashboard(d);
      setReferrals(r.items || []);
      setCommissions(c.items || []);
    }
  };

  useEffect(() => {
    (async () => {
      try { await loadStatus(); } catch { /* not authed / not ready */ } finally { setLoading(false); }
    })();
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/business/apply', {});
      toast.success('IB application submitted!');
      await loadStatus();
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setApplying(false); }
  };

  if (loading) return <Shell><Spinner /></Shell>;

  // ── Pending application ──────────────────────────────────────────────
  if (!status?.is_ib && status?.application_status === 'pending') {
    return (
      <Shell>
        <div className="mx-auto max-w-lg rounded-2xl border border-border-primary bg-card p-8 noise-texture text-center">
          <Hourglass className="mx-auto mb-3 text-warning" size={32} />
          <h3 className="text-base font-bold text-text-primary">Application under review</h3>
          <p className="mt-1 text-xs text-text-tertiary">Your IB application is being reviewed by our team. You&apos;ll get access to the full dashboard once approved.</p>
        </div>
      </Shell>
    );
  }

  // ── Not an IB yet — apply CTA ────────────────────────────────────────
  if (!status?.is_ib) {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-border-primary bg-card p-8 sm:p-12 noise-texture text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10">
            <Users size={26} className="text-accent" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">Become an Introducing Broker</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
            Invite traders, earn lifetime commission on their activity, and grow your own sub-IB network. Apply once — your dashboard unlocks after approval.
          </p>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className={clsx(
              'mx-auto mt-6 block w-full max-w-xs rounded-xl border-2 border-accent px-6 py-3.5 text-sm font-bold transition-all',
              applying ? 'cursor-not-allowed opacity-50' : 'bg-accent text-black hover:brightness-110 shadow-[0_0_24px_rgba(214,169,61,0.35)]',
            )}
          >
            {applying ? 'Submitting…' : 'Apply Now'}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Approved IB — full dashboard ─────────────────────────────────────
  const cards = [
    { label: 'Total Commission', value: `$${fmt(dashboard?.total_commission || 0)}`, color: 'text-success' },
    { label: 'Total Earned', value: `$${fmt(dashboard?.total_earned || 0)}`, color: 'text-success' },
    { label: 'Pending Payout', value: `$${fmt(dashboard?.pending_payout || 0)}`, color: 'text-warning' },
    { label: 'Referrals', value: String(dashboard?.total_referrals || 0), color: 'text-accent' },
    { label: 'No Trade Yet', value: String(dashboard?.registered_no_trade || 0), color: 'text-text-secondary' },
    { label: 'Sub-IBs', value: String(dashboard?.sub_ib_count || 0), color: 'text-accent' },
  ];

  return (
    <Shell>
      {/* Hero — referral identity */}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-accent/30 bg-card p-5 sm:p-7 noise-texture">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.14] via-transparent to-accent/[0.04]" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success" />
              <span className="text-xs font-semibold uppercase tracking-widest text-success">Approved IB</span>
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">Level {dashboard?.level || 1}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-text-primary">IB Dashboard</h1>
            <p className="mt-1 text-xs text-text-tertiary">
              Referral code: <span className="font-mono font-bold text-accent">{dashboard?.referral_code}</span>
            </p>
          </div>
          {dashboard?.referral_link && (
            <div className="w-full max-w-md">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Your referral link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text" readOnly value={dashboard.referral_link}
                  className="min-w-0 flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(dashboard.referral_link); toast.success('Copied!'); }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-black"
                >
                  <CopyIcon size={13} /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Referrals */}
        <SectionCard title="My Referrals" subtitle="Everyone who signed up with your link — and whether they've traded yet">
          {referrals.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-text-tertiary">No referrals yet. Share your link to start earning.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left">Joined</th>
                  <th className="px-4 py-2.5 text-center">Activity</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => (
                  <tr key={r.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                    <td className="px-4 py-2.5">
                      <p className="text-text-primary">{r.referred_user?.name || '—'}</p>
                      <p className="text-[11px] text-text-tertiary">{r.referred_user?.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-text-tertiary">{r.referred_user?.joined_at ? fmtDate(r.referred_user.joined_at) : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.has_traded ? (
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-success/15 text-success">Traded{r.trades_count ? ` · ${r.trades_count}` : ''}</span>
                      ) : (
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-text-tertiary/15 text-text-tertiary">No trade yet</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-text-primary">${fmt(r.total_deposit || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Sub-IBs */}
        {dashboard?.sub_ibs?.length > 0 && (
          <SectionCard title="Your Sub-IBs" subtitle="Referrals who became IBs themselves — your downline">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Code</th>
                  <th className="px-4 py-2.5 text-center">Level</th>
                  <th className="px-4 py-2.5 text-right">Earned</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.sub_ibs.map((s: any) => (
                  <tr key={s.referral_code} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                    <td className="px-4 py-2.5">
                      <p className="text-text-primary">{s.name}</p>
                      <p className="text-[11px] text-text-tertiary">{s.email}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-accent">{s.referral_code}</td>
                    <td className="px-4 py-2.5 text-center text-text-secondary">L{s.level}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-success">${fmt(s.total_earned || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}

        {/* Commission history */}
        {commissions.length > 0 && (
          <SectionCard title="Commission History" subtitle="Per-user commission you've earned">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-2.5 text-left">From</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-center">Level</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c: any) => (
                  <tr key={c.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                    <td className="px-4 py-2.5 text-text-primary">{c.source_user?.name || c.source_user?.email}</td>
                    <td className="px-4 py-2.5 capitalize text-text-secondary">{c.commission_type?.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-center text-text-secondary">L{c.mlm_level}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-success">${fmt(c.amount || 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-medium', c.status === 'paid' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}
      </div>
    </Shell>
  );
}
