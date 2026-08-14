'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Handshake,
  DollarSign,
  Clock,
  Users,
  Network,
  Award,
  Copy,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Building2,
  BadgeCheck,
  Hourglass,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';

type TabId = 'ib' | 'sub-broker' | 'network';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ib', label: 'IB Program' },
  { id: 'sub-broker', label: 'Master IB' },
  { id: 'network', label: 'My Network' },
];

// Standalone IB partner-portal (separate app on its own port). Approved IBs
// sign in there with the credentials emailed on approval.
const IB_PORTAL_URL = process.env.NEXT_PUBLIC_IB_PORTAL_URL || 'http://localhost:3002';

const PREMIUM_CARD =
  'rounded-2xl border relative overflow-hidden transition-all duration-300';
const PREMIUM_STYLE = {
  background:
    'radial-gradient(130% 120% at 95% -25%, rgba(204,255,0,0.10), transparent 55%), var(--bg-card)',
  borderColor: 'rgba(204,255,0,0.16)',
  boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
} as const;
const ACCENT_BAR = (
  <div
    className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
    style={{ background: 'linear-gradient(180deg, #eaff8a, #ccff00 55%, #a6d600)', boxShadow: '0 0 14px rgba(204,255,0,0.5)' }}
  />
);

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString(); } catch { return d; } }

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  valueColor = 'text-text-primary',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className={clsx(PREMIUM_CARD, 'hover:-translate-y-1 p-3.5')} style={PREMIUM_STYLE}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ background: 'rgba(204,255,0,0.10)' }}>
        <Icon className="w-4 h-4 text-[#ccff00]" />
      </div>
      <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className={clsx('text-2xl font-bold tabular-nums mt-0.5', valueColor)}>{value}</p>
    </div>
  );
}

// Shared table wrapper — premium card with icon-chip header.
function TableCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx(PREMIUM_CARD)} style={PREMIUM_STYLE}>
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-primary">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(204,255,0,0.10)' }}>
          <Icon className="w-4 h-4 text-[#ccff00]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          {subtitle && <p className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const TH = 'px-4 py-2.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider';
const ROW = 'border-b border-border-primary/50 hover:bg-[#ccff00]/[0.04] transition-colors';

// Once a user is an approved IB / Master IB, the full dashboard lives in the
// dedicated partner portal — the trader app just points them there.
function IBPortalCTA({ subtitle }: { subtitle?: string }) {
  return (
    <div className={clsx(PREMIUM_CARD, 'p-6 sm:p-10 pl-7 text-center space-y-5 max-w-lg mx-auto')} style={PREMIUM_STYLE}>
      {ACCENT_BAR}
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}>
        <BadgeCheck className="w-7 h-7 text-[#ccff00]" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-text-primary">You&apos;re an approved partner</h3>
      <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
        {subtitle || 'Manage your referrals, commissions, network and client trading from your dedicated IB partner portal.'}
      </p>
      <a
        href={IB_PORTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 w-full max-w-xs mx-auto px-6 py-3.5 rounded-xl text-sm font-semibold bg-[#ccff00] hover:bg-[#a6d600] text-[#0a0a0a] shadow-[0_0_24px_rgba(204,255,0,0.35)] transition-all"
      >
        Login to IB Portal <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}

// Every user's own referral link — shown page-level (PipHigh-style), since every
// user can refer and is auto-promoted to IB once they bring one in.
function ReferralLinkCard() {
  const [data, setData] = useState<{ code: string; path: string; referred_count: number; is_ib: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      try { setData(await api.get('/business/referral/me')); } catch { /* ignore */ }
    })();
  }, []);
  if (!data) return null;
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.path}`;
  return (
    <div className={clsx(PREMIUM_CARD, 'p-4 pl-5')} style={PREMIUM_STYLE}>
      {ACCENT_BAR}
      <div className="flex items-center gap-2 mb-2.5">
        <Link2 className="w-4 h-4 text-[#ccff00]" />
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Your Referral Link</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={link}
          className="flex-1 min-w-0 text-xs font-mono bg-bg-secondary border border-border-primary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-[#ccff00]/40"
        />
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(link); toast.success('Copied!'); }}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#ccff00] hover:bg-[#a6d600] text-[#0a0a0a] transition-colors"
        >
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
      </div>
      <p className="text-[11px] text-text-tertiary mt-2.5">Code: <span className="text-[#ccff00] font-mono font-bold">{data.code}</span></p>
    </div>
  );
}

export default function BusinessPage() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const [tab, setTab] = useState<TabId>('ib');
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const slideIndex = tabIndex >= 0 ? tabIndex : 0;

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Affiliates & IB rewards"
          description="IB commissions, Master IB partnerships and network payouts require a real trading account. Register a live account to start earning."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Premium header */}
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}
            >
              <Handshake className="w-5 h-5 text-[#ccff00]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-text-primary">Affiliates &amp; IB Program</h1>
              <p className="text-sm text-text-tertiary">Refer, build your network and earn commissions</p>
            </div>
          </div>

          {/* Referral link — every user has one (PipHigh-style, page-level). */}
          <div className="mb-4 sm:mb-5">
            <ReferralLinkCard />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border-primary bg-card">
            <div className="relative flex min-h-[52px] border-b border-border-primary bg-card">
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                <div
                  className="absolute top-0 h-full w-1/3 transition-[transform] duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] will-change-transform"
                  style={{ transform: `translate3d(${slideIndex * 100}%,0,0)` }}
                >
                  <div
                    className={clsx(
                      'absolute inset-x-1 top-0 h-full rounded-t-2xl border-2 border-b-0 border-accent bg-card-nested',
                      'animate-wallet-main-tab-glow',
                    )}
                  />
                </div>
              </div>
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'relative z-10 flex-1 min-w-0 border-0 bg-transparent py-3.5 px-1 sm:px-2 text-xs sm:text-sm font-semibold outline-none',
                      'transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50',
                      active ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {active ? (
                      <span className="relative inline-block animate-wallet-main-tab-text drop-shadow-[0_0_20px_rgba(204,255,0,0.7)]">
                        {t.label}
                      </span>
                    ) : (
                      <span className="relative inline-block truncate">{t.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div key={tab} className="bg-card-nested p-4 md:p-6 animate-wallet-fund-enter-lg min-h-[200px]">
              {tab === 'ib' && <IBTab />}
              {tab === 'sub-broker' && <SubBrokerTab />}
              {tab === 'network' && <NetworkTab />}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function IBTab() {
  const [referral, setReferral] = useState<{ is_ib: boolean; referred_count: number } | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ref = await api.get<any>('/business/referral/me');
        setReferral(ref);
        if (ref.is_ib) {
          const [d, r] = await Promise.all([
            api.get<any>('/business/ib/dashboard').catch(() => null),
            api.get<any>('/business/ib/referrals').catch(() => ({ items: [] })),
          ]);
          setDashboard(d);
          setReferrals(r.items || []);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;
  const isIb = !!referral?.is_ib;

  return (
    <div className="space-y-4">
      {/* Partner dashboard banner — no application. Every user auto-becomes an
          IB once they refer someone; the full dashboard is the IB portal. */}
      <div className={clsx(PREMIUM_CARD, 'p-4 sm:p-5 pl-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between')} style={PREMIUM_STYLE}>
        {ACCENT_BAR}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-[#ccff00]" /> Your IB Partner Dashboard
          </h3>
          <p className="text-[11px] text-text-tertiary mt-0.5 max-w-xl">
            {isIb
              ? 'Manage referrals, commissions, your network and client trading in your dedicated IB portal.'
              : 'Share your link above. Refer at least one trader and you automatically become an IB partner — no application needed.'}
          </p>
        </div>
        {isIb ? (
          <a
            href={IB_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#ccff00] hover:bg-[#a6d600] text-[#0a0a0a] shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all"
          >
            Go to IB Dashboard <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary px-4 py-2.5 rounded-xl border border-dashed border-border-primary">
            {referral?.referred_count || 0} / 1 referral to unlock
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={DollarSign} label="Total Earned" value={`$${fmt(dashboard?.total_commission || 0)}`} valueColor="text-success" />
        <StatTile icon={Clock} label="Pending Payout" value={`$${fmt(dashboard?.pending_payout || 0)}`} valueColor="text-warning" />
        <StatTile icon={Users} label="Referrals" value={String(dashboard?.total_referrals ?? referral?.referred_count ?? 0)} />
        <StatTile icon={Award} label="Level" value={`L${dashboard?.level || 1}`} />
      </div>

      {/* My Referrals */}
      {referrals.length > 0 ? (
        <TableCard title="My Referrals" icon={Users}>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-primary">
              <th className={clsx(TH, 'text-left')}>User</th><th className={clsx(TH, 'text-left')}>Joined</th><th className={clsx(TH, 'text-center')}>Activity</th><th className={clsx(TH, 'text-right')}>Balance</th>
            </tr></thead>
            <tbody>
              {referrals.map((r: any) => (
                <tr key={r.id} className={ROW}>
                  <td className="px-4 py-2.5"><p className="text-text-primary font-medium">{r.referred_user?.name}</p><p className="text-[11px] text-text-tertiary">{r.referred_user?.email}</p></td>
                  <td className="px-4 py-2.5 text-text-tertiary">{r.referred_user?.joined_at ? fmtDate(r.referred_user.joined_at) : '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.has_traded ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/15 text-success">Traded{r.trades_count ? ` · ${r.trades_count}` : ''}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-text-tertiary/15 text-text-tertiary">No trade yet</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-primary">${fmt(r.total_deposit || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-primary bg-bg-secondary/40 py-10 px-4 text-center text-xs text-text-tertiary">
          No referrals yet. Copy your link above and share it — everyone who signs up through it is tracked to you.
        </div>
      )}
    </div>
  );
}

function SubBrokerTab() {
  const [status, setStatus] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<any>('/business/status');
        setStatus(s);
        if (s.is_ib) {
          try {
            const d = await api.get<any>('/business/sub-broker/dashboard');
            setDashboard(d);
          } catch {}
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/business/apply-sub-broker', { company_name: companyName || undefined });
      toast.success('Master IB application submitted!');
      const s = await api.get<any>('/business/status');
      setStatus(s);
    } catch (e: any) { toast.error(e.message || 'Failed'); } finally { setApplying(false); }
  };

  if (loading) return <Spinner />;

  // Approved partner → portal CTA instead of the inline Master IB dashboard.
  if (status?.is_ib) return <IBPortalCTA subtitle="Manage your clients and revenue share from your dedicated IB partner portal." />;

  if (status?.application_status === 'pending') {
    return (
      <div className={clsx(PREMIUM_CARD, 'p-6 sm:p-8 pl-7 text-center max-w-lg mx-auto space-y-3')} style={PREMIUM_STYLE}>
        {ACCENT_BAR}
        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}>
          <Hourglass className="w-6 h-6 text-[#ccff00]" />
        </div>
        <h3 className="text-base font-bold text-text-primary">Application Pending</h3>
        <p className="text-xs text-text-tertiary">Your Master IB application is under review.</p>
      </div>
    );
  }

  if (dashboard) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={Users} label="Clients" value={String(dashboard.direct_clients || 0)} />
          <StatTile icon={DollarSign} label="Total Earned" value={`$${fmt(dashboard.total_earned || 0)}`} valueColor="text-success" />
          <StatTile icon={Clock} label="Pending" value={`$${fmt(dashboard.pending_payout || 0)}`} valueColor="text-warning" />
          <StatTile icon={Award} label="Commission" value={`$${fmt(dashboard.total_commission || 0)}`} />
        </div>

        <div className={clsx(PREMIUM_CARD, 'p-4 pl-5')} style={PREMIUM_STYLE}>
          {ACCENT_BAR}
          <div className="flex items-center gap-2 mb-2.5">
            <Link2 className="w-4 h-4 text-[#ccff00]" />
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Your Referral Code</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono text-[#ccff00]">{dashboard.referral_code}</span>
            <button type="button" onClick={() => { navigator.clipboard.writeText(dashboard.referral_code); toast.success('Copied!'); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#ccff00] hover:bg-[#a6d600] text-[#0a0a0a] transition-colors">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>

        {dashboard.clients?.length > 0 && (
          <TableCard title="Your Clients" icon={Users}>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border-primary">
                <th className={clsx(TH, 'text-left')}>Client</th><th className={clsx(TH, 'text-left')}>Status</th><th className={clsx(TH, 'text-right')}>Balance</th><th className={clsx(TH, 'text-left')}>Joined</th>
              </tr></thead>
              <tbody>
                {dashboard.clients.map((c: any) => (
                  <tr key={c.user_id} className={ROW}>
                    <td className="px-4 py-2.5"><p className="text-text-primary font-medium">{c.name}</p><p className="text-[11px] text-text-tertiary">{c.email}</p></td>
                    <td className="px-4 py-2.5"><span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', c.status === 'active' ? 'bg-success/15 text-success' : 'bg-text-tertiary/15 text-text-tertiary')}>{c.status}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-text-primary">${fmt(c.total_balance || 0)}</td>
                    <td className="px-4 py-2.5 text-text-tertiary">{c.joined_at ? fmtDate(c.joined_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(PREMIUM_CARD, 'p-6 sm:p-10 pl-7 text-center space-y-5 max-w-2xl mx-auto')} style={PREMIUM_STYLE}>
      {ACCENT_BAR}
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}>
        <Building2 className="w-7 h-7 text-[#ccff00]" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-text-primary">Become a Master IB</h3>
      <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto leading-relaxed">Partner with us as a Master IB. Get your own referral code, manage clients, and earn revenue share on all their trading activity.</p>
      <div className="max-w-sm mx-auto text-left">
        <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">Company Name (optional)</label>
        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" className="w-full text-text-primary rounded-xl py-2.5 px-4 text-xs bg-bg-secondary border border-border-primary focus:border-[#ccff00]/50 focus:ring-1 focus:ring-[#ccff00]/30 focus:outline-none" />
      </div>
      <button
        type="button"
        onClick={handleApply}
        disabled={applying}
        className={clsx(
          'inline-flex items-center justify-center w-full max-w-xs mx-auto px-6 py-3.5 rounded-xl text-sm font-semibold transition-all',
          applying ? 'opacity-50 cursor-not-allowed bg-[#ccff00] text-[#0a0a0a]' : 'bg-[#ccff00] hover:bg-[#a6d600] text-[#0a0a0a] shadow-[0_0_24px_rgba(204,255,0,0.35)]',
        )}
      >
        {applying ? 'Submitting...' : 'Apply as Master IB'}
      </button>
    </div>
  );
}

function NetworkTab() {
  const [tree, setTree] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/business/ib/tree');
        setTree(res);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;
  // Approved IB → network lives in the partner portal.
  if (tree) return <IBPortalCTA subtitle="View your full MLM network and downline in your dedicated IB partner portal." />;

  if (!tree) return (
    <div className="rounded-2xl border border-dashed border-border-primary bg-bg-secondary/50 py-16 px-4 text-center text-sm text-text-secondary max-w-lg mx-auto">
      You need to be an approved IB to see your network.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={clsx(PREMIUM_CARD, 'p-4 pl-5')} style={PREMIUM_STYLE}>
        {ACCENT_BAR}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-[#ccff00]" />
            <h3 className="text-sm font-bold text-text-primary">Your MLM Network</h3>
          </div>
          <span className="text-[11px] text-text-tertiary">{tree.total_nodes || 0} members</span>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-text-tertiary">Your Code: <span className="text-[#ccff00] font-mono font-bold">{tree.root?.referral_code}</span></span>
          <span className="text-text-tertiary">Level: <span className="text-text-primary font-bold">L{tree.root?.level}</span></span>
          <span className="text-text-tertiary">Total Earned: <span className="text-success font-mono font-bold">${fmt(tree.root?.total_earned || 0)}</span></span>
        </div>
      </div>

      {tree.tree?.length > 0 ? (
        <div className={clsx(PREMIUM_CARD, 'p-4')} style={PREMIUM_STYLE}>
          <h4 className="text-xs font-bold text-text-primary mb-3 uppercase tracking-wider">Downline Tree</h4>
          <div className="space-y-1">
            {tree.tree.map((node: any) => <TreeNode key={node.id} node={node} depth={0} />)}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-xs text-text-tertiary">No downline members yet. Share your referral link to grow your network.</div>
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <button onClick={() => hasChildren && setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-[#ccff00]/[0.05] transition-colors text-xs">
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#ccff00]" /> : <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
        ) : (
          <span className="text-text-tertiary ml-1">•</span>
        )}
        <span className="text-text-primary font-medium">{node.name || node.email}</span>
        <span className="text-[11px] text-[#ccff00] font-mono">L{node.depth}</span>
        <span className="text-[11px] text-text-tertiary ml-auto font-mono">${fmt(node.total_earned || 0)}</span>
        {!node.is_active && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">inactive</span>}
      </button>
      {expanded && hasChildren && node.children.map((child: any) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
