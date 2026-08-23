'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Users,
  Briefcase,
  Network,
  Share2,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  Copy,
  ChevronRight,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errors';
import api from '@/lib/api/client';


type TabId = 'ib' | 'sub-broker' | 'network';

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'ib', label: 'IB Program', icon: Users },
  { id: 'sub-broker', label: 'Sub-Broker', icon: Briefcase },
  { id: 'network', label: 'My Network', icon: Network },
];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#E94E1B] border-t-transparent" />
      <span className="text-xs font-medium text-text-tertiary">Loading…</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'default' }: {
  label: string;
  value: string;
  icon: typeof Users;
  tone?: 'default' | 'success' | 'warning' | 'accent';
}) {
  const toneClasses = {
    default: { bg: 'bg-bg-input', icon: 'text-text-primary' },
    success: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    accent: { bg: 'bg-[#FCE6DD]', icon: 'text-[#E94E1B]' },
  }[tone];
  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneClasses.bg)}>
          <Icon size={18} className={toneClasses.icon} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
          <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}

function BenefitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 size={13} className="text-emerald-600" strokeWidth={2.6} />
      </span>
      <span className="text-sm text-[#4B5563] leading-relaxed">{children}</span>
    </li>
  );
}

export default function BusinessPage() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const [tab, setTab] = useState<TabId>('ib');

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Affiliates & IB rewards"
          description="IB commissions, sub-broker partnerships and network payouts require a real trading account. Register a live account to start earning."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border border-border-primary bg-bg-card p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FCE6DD] via-white to-white"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FCE6DD] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#E94E1B]">
                <Award size={12} strokeWidth={2.5} />
                Partner Programs
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Grow with SwissCresta
              </h1>
              <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
                Refer traders, build a team, or partner as a sub-broker. Earn revenue share on every trade your network places.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs strip */}
        <div className="rounded-2xl border border-border-primary bg-bg-card">
          <div className="flex border-b border-border-primary px-2 sm:px-4">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    'relative flex flex-1 items-center justify-center gap-2 px-2 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors',
                    active ? 'text-[#E94E1B]' : 'text-text-tertiary hover:text-text-primary',
                  )}
                >
                  <Icon size={15} strokeWidth={2.2} />
                  <span className="truncate">{t.label}</span>
                  {active && (
                    <span
                      className="pointer-events-none absolute inset-x-3 -bottom-px h-[3px] rounded-t-full bg-[#E94E1B]"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div key={tab} className="p-4 sm:p-6 animate-wallet-fund-enter-lg min-h-[240px]">
            {tab === 'ib' && <IBTab />}
            {tab === 'sub-broker' && <SubBrokerTab />}
            {tab === 'network' && <NetworkTab />}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}


function IBTab() {
  const [status, setStatus] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
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
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/business/apply', {});
      toast.success('IB application submitted!');
      const s = await api.get<any>('/business/status');
      setStatus(s);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <Spinner />;

  if (!status?.is_ib && status?.application_status === 'pending') {
    return (
      <PendingCard message="Your IB application is under review by the admin team." />
    );
  }

  if (!status?.is_ib) {
    return (
      <CtaCard
        eyebrow="IB Program"
        title="Become an Introducing Broker"
        subtitle="Refer traders to SwissCresta and earn a lifetime share of their trading commissions — up to 5 levels deep."
        benefits={[
          'Lifetime commission on every trade your referrals place',
          'Multi-level network — earn from sub-referrals too',
          'Personalised referral link and dashboard',
          'Weekly automated payouts to your trading wallet',
        ]}
        cta={applying ? 'Submitting…' : 'Apply Now'}
        onClick={handleApply}
        disabled={applying}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Earned" value={`$${fmt(dashboard?.total_earned || 0)}`} icon={DollarSign} tone="success" />
        <StatCard label="Pending Payout" value={`$${fmt(dashboard?.pending_payout || 0)}`} icon={TrendingUp} tone="warning" />
        <StatCard label="Referrals" value={String(dashboard?.total_referrals || 0)} icon={Users} tone="accent" />
        <StatCard label="Level" value={`L${dashboard?.level || 1}`} icon={Award} tone="default" />
      </div>

      {dashboard?.referral_link && (
        <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Share2 size={15} className="text-[#E94E1B]" strokeWidth={2.4} />
            <p className="text-sm font-semibold text-text-primary">Your Referral Link</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={dashboard.referral_link}
              className="flex-1 rounded-lg border border-border-primary bg-bg-input px-3 py-2.5 text-xs font-mono text-text-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(dashboard.referral_link); toast.success('Copied!'); }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors"
            >
              <Copy size={13} />
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Code: <span className="font-mono font-bold text-[#E94E1B]">{dashboard.referral_code}</span>
          </p>
        </div>
      )}

      {referrals.length > 0 && (
        <DataTable
          title="My Referrals"
          headers={['User', 'Joined', 'Balance']}
          rows={referrals.map((r: any) => [
            (
              <div key={`u-${r.id}`}>
                <p className="text-text-primary font-medium">{r.referred_user?.name}</p>
                <p className="text-[11px] text-text-tertiary">{r.referred_user?.email}</p>
              </div>
            ),
            <span key={`d-${r.id}`} className="text-text-tertiary">{r.referred_user?.joined_at ? fmtDate(r.referred_user.joined_at) : '—'}</span>,
            <span key={`b-${r.id}`} className="font-mono tabular-nums text-text-primary">${fmt(r.total_deposit || 0)}</span>,
          ])}
          align={['left', 'left', 'right']}
        />
      )}

      {commissions.length > 0 && (
        <DataTable
          title="Commission History"
          headers={['From', 'Type', 'Level', 'Amount', 'Status']}
          rows={commissions.map((c: any) => [
            <span key={`s-${c.id}`} className="text-text-primary">{c.source_user?.name}</span>,
            <span key={`t-${c.id}`} className="text-text-tertiary capitalize">{c.commission_type?.replace('_', ' ')}</span>,
            <span key={`l-${c.id}`} className="text-text-tertiary">L{c.mlm_level}</span>,
            <span key={`a-${c.id}`} className="font-mono tabular-nums text-emerald-600">${fmt(c.amount || 0)}</span>,
            (
              <span
                key={`st-${c.id}`}
                className={clsx(
                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  c.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                )}
              >
                {c.status}
              </span>
            ),
          ])}
          align={['left', 'left', 'left', 'right', 'right']}
        />
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
      toast.success('Sub-broker application submitted!');
      const s = await api.get<any>('/business/status');
      setStatus(s);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <Spinner />;

  if (status?.application_status === 'pending') {
    return <PendingCard message="Your sub-broker application is under review." />;
  }

  if (dashboard) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Clients" value={String(dashboard.direct_clients || 0)} icon={Users} tone="accent" />
          <StatCard label="Total Earned" value={`$${fmt(dashboard.total_earned || 0)}`} icon={DollarSign} tone="success" />
          <StatCard label="Pending" value={`$${fmt(dashboard.pending_payout || 0)}`} icon={TrendingUp} tone="warning" />
          <StatCard label="Commission" value={`$${fmt(dashboard.total_commission || 0)}`} icon={Award} tone="default" />
        </div>

        <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Share2 size={15} className="text-[#E94E1B]" strokeWidth={2.4} />
            <p className="text-sm font-semibold text-text-primary">Your Referral Code</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-bg-input px-4 py-2.5 text-lg font-bold font-mono text-[#E94E1B]">
              {dashboard.referral_code}
            </span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(dashboard.referral_code); toast.success('Copied!'); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors"
            >
              <Copy size={13} />
              Copy
            </button>
          </div>
        </div>

        {dashboard.clients?.length > 0 && (
          <DataTable
            title="Your Clients"
            headers={['Client', 'Status', 'Balance', 'Joined']}
            rows={dashboard.clients.map((c: any) => [
              (
                <div key={`c-${c.user_id}`}>
                  <p className="text-text-primary font-medium">{c.name}</p>
                  <p className="text-[11px] text-text-tertiary">{c.email}</p>
                </div>
              ),
              (
                <span
                  key={`s-${c.user_id}`}
                  className={clsx(
                    'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-card-nested text-text-secondary',
                  )}
                >
                  {c.status}
                </span>
              ),
              <span key={`b-${c.user_id}`} className="font-mono tabular-nums text-text-primary">${fmt(c.total_balance || 0)}</span>,
              <span key={`d-${c.user_id}`} className="text-text-tertiary">{c.joined_at ? fmtDate(c.joined_at) : '—'}</span>,
            ])}
            align={['left', 'left', 'right', 'left']}
          />
        )}
      </div>
    );
  }

  return (
    <CtaCard
      eyebrow="Sub-Broker"
      title="Become a Sub-Broker"
      subtitle="Partner with us as a sub-broker. Get your own referral code, manage clients and earn revenue share on all their trading activity."
      benefits={[
        'Direct revenue share on every client trade',
        'Dedicated client management dashboard',
        'Custom referral code for your business',
        'Priority partner support and reporting',
      ]}
      cta={applying ? 'Submitting…' : 'Apply as Sub-Broker'}
      onClick={handleApply}
      disabled={applying}
      extra={(
        <div className="text-left">
          <label className="block text-xs font-medium text-text-tertiary mb-1.5">
            Company Name <span className="text-text-tertiary">(optional)</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Your company name"
            className="w-full rounded-xl border border-border-primary bg-bg-card px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#E94E1B] focus:ring-2 focus:ring-[#E94E1B]/15"
          />
        </div>
      )}
    />
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

  if (!tree) {
    return (
      <div className="rounded-2xl border border-dashed border-border-primary bg-bg-input/60 py-16 px-6 text-center max-w-xl mx-auto">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-card border border-border-primary mb-3">
          <Network size={20} className="text-text-tertiary" />
        </div>
        <p className="text-sm font-semibold text-text-primary">No network yet</p>
        <p className="mt-1 text-xs text-text-tertiary">You need to be an approved IB to see your network.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-[#E94E1B]" strokeWidth={2.4} />
            <h3 className="text-sm font-semibold text-text-primary">Your MLM Network</h3>
          </div>
          <span className="text-xs text-text-tertiary">{tree.total_nodes || 0} members</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="text-text-tertiary">
            Your Code: <span className="font-mono font-bold text-[#E94E1B]">{tree.root?.referral_code}</span>
          </span>
          <span className="text-text-tertiary">
            Level: <span className="font-bold text-text-primary">L{tree.root?.level}</span>
          </span>
          <span className="text-text-tertiary">
            Total Earned: <span className="font-mono font-bold text-emerald-600">${fmt(tree.root?.total_earned || 0)}</span>
          </span>
        </div>
      </div>

      {tree.tree?.length > 0 ? (
        <div className="rounded-2xl border border-border-primary bg-bg-card p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Downline Tree</h4>
          <div className="space-y-0.5">
            {tree.tree.map((node: any) => <TreeNode key={node.id} node={node} depth={0} />)}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-primary bg-bg-input/60 py-10 px-6 text-center text-sm text-text-tertiary">
          No downline members yet. Share your referral link to grow your network.
        </div>
      )}
    </div>
  );
}


function TreeNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg py-1.5 px-2 text-left text-xs hover:bg-bg-input transition-colors"
      >
        {hasChildren ? (
          <ChevronRight
            size={13}
            className={clsx('text-text-tertiary transition-transform', expanded && 'rotate-90')}
          />
        ) : (
          <span className="w-[13px] text-center text-[#D1D5DB]">•</span>
        )}
        <span className="font-medium text-text-primary">{node.name || node.email}</span>
        <span className="rounded-md bg-[#FCE6DD] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#E94E1B]">L{node.depth}</span>
        <span className="ml-auto font-mono tabular-nums text-text-tertiary">${fmt(node.total_earned || 0)}</span>
        {!node.is_active && (
          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">inactive</span>
        )}
      </button>
      {expanded && hasChildren && node.children.map((child: any) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}


/* ----------------------------------------------------------------------------
   Shared sub-components
   ------------------------------------------------------------------------ */

function PendingCard({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50/50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-3">
        <span className="text-xl">⏳</span>
      </div>
      <h3 className="text-base font-bold text-text-primary">Application Pending</h3>
      <p className="mt-1 text-sm text-text-tertiary">{message}</p>
    </div>
  );
}

function CtaCard({
  eyebrow,
  title,
  subtitle,
  benefits,
  cta,
  onClick,
  disabled,
  extra,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  benefits: string[];
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-card">
        <div className="relative px-6 sm:px-8 pt-8 pb-6 text-center">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FCE6DD]/60 to-transparent"
            aria-hidden
          />
          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-[#FCE6DD] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#E94E1B]">
              {eyebrow}
            </span>
            <h3 className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{title}</h3>
            <p className="mt-2 text-sm text-[#4B5563] leading-relaxed max-w-md mx-auto">{subtitle}</p>
          </div>
        </div>
        <div className="border-t border-border-primary px-6 sm:px-8 py-6">
          <ul className="space-y-2.5 max-w-md mx-auto">
            {benefits.map((b) => <BenefitItem key={b}>{b}</BenefitItem>)}
          </ul>
          {extra && <div className="mt-5 max-w-md mx-auto">{extra}</div>}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-colors shadow-[0_2px_8px_rgba(233,78,27,0.25)] min-w-[200px]',
                disabled
                  ? 'bg-[#E94E1B]/60 cursor-not-allowed'
                  : 'bg-[#E94E1B] hover:bg-[#C73E11]',
              )}
            >
              {cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  align,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
  align: Array<'left' | 'right'>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-card">
      <div className="px-5 py-3 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary bg-bg-card-nested">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={clsx(
                    'px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary',
                    align[i] === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, ri) => (
              <tr key={ri} className="border-b border-[#F5F5F5] last:border-b-0 hover:bg-bg-card-nested/60">
                {cells.map((cell, ci) => (
                  <td
                    key={ci}
                    className={clsx(
                      'px-5 py-3',
                      align[ci] === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
