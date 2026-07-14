'use client';

/**
 * Broker home — "premium gold hero" layout.
 * One brand-gold hero card carries the money story (total balance, open P/L,
 * account picker + per-account stats, wallet actions); rewards, movers and
 * marketing follow in a two-column grid. Data flow is unchanged from the
 * previous layout: 2s background polling of /accounts + /instruments/prices/all,
 * daily-open bars cached once on mount, rewards state fetched once.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  ChevronDown, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, TrendingDown, ArrowRight,
  ShieldCheck, BadgeCheck, ExternalLink,
  Wallet as WalletIcon, Coins, BarChart3, Users,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { TOUR_TARGETS } from '@/components/Onboarding/tourTargets';
import { formatCurrency as fmtUsd, formatNumber as fmtNum } from '@/lib/formatters';

interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  equity: number;
  free_margin: number;
  margin_used?: number;
  leverage: number;
  is_demo: boolean;
  swap_free?: boolean;
  account_group_name?: string | null;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
}

interface PriceTick { symbol?: string; bid?: number; ask?: number; }
interface BarRow { time: number; open: number; close: number; }

const TOP_MOVER_SYMBOLS = ['XAUUSD', 'NAS100', 'BTCUSD', 'EURUSD'];

// Hero ink colours — near-black warm tones that stay legible on the gold
// gradient in both app themes (the hero is self-coloured, not theme-driven).
const INK = '#1c1405';
const INK_SOFT = 'rgba(28,20,5,0.66)';
const INK_FAINT = 'rgba(28,20,5,0.45)';

const tradeUrl = (accountId: string) => {
  const host = process.env.NEXT_PUBLIC_TRADE_HOST;
  const path = `/trading/terminal?account=${encodeURIComponent(accountId)}&view=chart`;
  return host ? `https://${host}${path}` : path;
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <BrokerHome />
    </DashboardShell>
  );
}

function BrokerHome() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [movers, setMovers] = useState<{ symbol: string; pct: number; price: number }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Rewards state for Level + FXArtha Coin (FXA) display.
  const [rewardsState, setRewardsState] = useState<{
    level?: number; level_label?: string;
    xp?: number; xp_next_level?: number;
    artha_coins?: number;
  } | null>(null);

  useEffect(() => {
    api.get<typeof rewardsState>('/rewards/state').then(setRewardsState).catch(() => {});
  }, []);

  // Cached daily-open bars — these don't change intraday, so we fetch
  // once on mount and reuse across every mover refresh. The poll only
  // re-pulls the cheap /instruments/prices/all endpoint.
  const dayOpenBarsRef = useRef<BarRow[][]>([]);

  const refreshAccounts = useCallback(async (opts: { silent?: boolean } = {}) => {
    try {
      const accs = await api.get<{ items: AccountRow[] } | AccountRow[]>('/accounts');
      const list: AccountRow[] = Array.isArray(accs) ? accs : (accs as { items: AccountRow[] }).items || [];
      setAccounts(list);
      if (list.length > 0) setActiveId((cur) => cur ?? list[0].id);
    } catch {
      // Silent polls swallow errors; initial-load surfacing is handled
      // by the bootstrap effect below.
      if (!opts.silent) throw new Error('accounts fetch failed');
    }
  }, []);

  const recomputeMovers = useCallback((ticksRaw: PriceTick[]) => {
    const tickMap = new Map<string, number>();
    for (const t of ticksRaw || []) {
      if (t?.symbol && t.bid && t.ask) tickMap.set(t.symbol.toUpperCase(), (t.bid + t.ask) / 2);
    }
    const out = TOP_MOVER_SYMBOLS.map((sym, i) => {
      const bars = dayOpenBarsRef.current[i] || [];
      const dayOpen = bars.length > 0 ? Number(bars[bars.length - 1].open) : NaN;
      const price = tickMap.get(sym) ?? (bars.length > 0 ? Number(bars[bars.length - 1].close) : NaN);
      const pct = (Number.isFinite(dayOpen) && dayOpen > 0 && Number.isFinite(price))
        ? ((price - dayOpen) / dayOpen) * 100
        : 0;
      return { symbol: sym, pct, price };
    });
    setMovers(out);
  }, []);

  const refreshMoverTicks = useCallback(async () => {
    try {
      const ticksRaw = await api.get<PriceTick[]>('/instruments/prices/all');
      recomputeMovers(ticksRaw || []);
    } catch {
      // Silent — keep the last known prices on a transient failure.
    }
  }, [recomputeMovers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accs, b] = await Promise.all([
          api.get<{ items: AccountRow[] } | AccountRow[]>('/accounts'),
          api.get<{ banners: Banner[] }>('/banners', { page: 'dashboard' }).catch(() => ({ banners: [] as Banner[] })),
        ]);
        if (cancelled) return;
        const list: AccountRow[] = Array.isArray(accs) ? accs : (accs as { items: AccountRow[] }).items || [];
        setAccounts(list);
        if (list.length > 0) setActiveId((cur) => cur ?? list[0].id);
        setBanners(b.banners || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ticksRaw, ...barsRaw] = await Promise.all([
          api.get<PriceTick[]>('/instruments/prices/all').catch(() => [] as PriceTick[]),
          ...TOP_MOVER_SYMBOLS.map((s) =>
            api.get<BarRow[]>(`/instruments/${s}/bars`, { resolution: '1D' }).catch(() => [] as BarRow[]),
          ),
        ]);
        if (cancelled) return;
        dayOpenBarsRef.current = barsRaw;
        recomputeMovers(ticksRaw || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [recomputeMovers]);

  // Background polling — keeps Total Balance, Open P/L, the account
  // card stats, and Top Daily Movers fresh while the dashboard is
  // visible. Both endpoints are cheap; /accounts recomputes equity
  // server-side from current Redis tick prices on every call.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      void refreshAccounts({ silent: true });
      void refreshMoverTicks();
    };
    const interval = setInterval(tick, 2000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [refreshAccounts, refreshMoverTicks]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeId) || accounts[0] || null,
    [accounts, activeId],
  );

  const realAccounts = accounts.filter((a) => !a.is_demo);
  const totalBalance = realAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalEquity = realAccounts.reduce((s, a) => s + (Number(a.equity) || 0), 0);
  const todaysPnl = totalEquity - totalBalance;
  const todaysPnlPct = totalBalance > 0 ? (todaysPnl / totalBalance) * 100 : 0;
  // Only greet by a real given name — never a raw email/username like "setup".
  const rawFirst = (user?.first_name || '').trim();
  const firstName = rawFirst ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1) : '';
  const level = rewardsState?.level ?? 1;
  const levelLabel = rewardsState?.level_label || 'New Trader';
  const dgcCoins = rewardsState?.artha_coins ?? 0;

  return (
    <div className="space-y-5 pb-8 max-w-6xl mx-auto w-full">
      {/* ── Greeting ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-2">
            Welcome back{firstName ? `, ${firstName}` : ''} <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">Trade. Earn. Level up.</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ border: '1px solid rgba(214,169,61,0.35)', background: 'rgba(214,169,61,0.08)', color: '#d6a93d' }}
          >
            <BadgeCheck size={13} /> Level {level} · {levelLabel}
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tabular-nums"
            style={{ border: '1px solid rgba(214,169,61,0.35)', background: 'rgba(214,169,61,0.08)', color: '#d6a93d' }}
          >
            <Coins size={13} /> {dgcCoins.toLocaleString(undefined, { maximumFractionDigits: 2 })} FXA
          </span>
        </div>
      </div>

      {/* ── Gold hero: the money story ── */}
      <HeroBalanceCard
        accounts={accounts}
        active={activeAccount}
        onChangeAccount={setActiveId}
        loading={loading}
        totalBalance={totalBalance}
        realCount={realAccounts.length}
        todaysPnl={todaysPnl}
        todaysPnlPct={todaysPnlPct}
      />

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          data-tour={TOUR_TARGETS.DASHBOARD_TRADE_NOW}
          onClick={() => {
            if (accounts.length === 0) {
              router.push('/trading/open-account');
              return;
            }
            const id = activeId || accounts[0].id;
            router.push(`/trading/terminal?account=${encodeURIComponent(id)}&view=chart`);
          }}
          className="group rounded-2xl p-5 transition-all flex items-center gap-4 text-left hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #23282f 0%, #14171c 100%)', border: '1px solid rgba(214,169,61,0.45)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(214,169,61,0.16)' }}>
            <BarChart3 size={20} style={{ color: '#d6a93d' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">Trade Now</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Open the terminal</p>
          </div>
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform shrink-0" style={{ color: '#d6a93d' }} />
        </button>

        <button
          type="button"
          onClick={() => router.push('/social')}
          className="group rounded-2xl p-5 transition-colors flex items-center gap-4 text-left hover:bg-bg-hover"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <Users size={20} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-text-primary truncate">Copy Trading</p>
            <p className="text-xs text-text-tertiary mt-0.5">Copy top traders</p>
          </div>
          <ArrowRight size={20} className="text-text-tertiary group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        <button
          type="button"
          data-tour={TOUR_TARGETS.DASHBOARD_DEPOSIT}
          onClick={() => router.push('/wallet')}
          className="group rounded-2xl p-5 transition-colors flex items-center gap-4 text-left hover:bg-bg-hover"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <WalletIcon size={20} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-text-primary truncate">Add Funds</p>
            <p className="text-xs text-text-tertiary mt-0.5">Deposit now</p>
          </div>
          <ArrowRight size={20} className="text-text-tertiary group-hover:translate-x-1 transition-transform shrink-0" />
        </button>
      </div>

      {/* ── Two-column: markets + progression ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
        <TopMoversCard movers={movers} />
        <StatusProgramCard level={level} xp={rewardsState?.xp ?? 0} xpNext={rewardsState?.xp_next_level ?? 100} />
      </div>

      <InviteFriendsCard />
      {banners.length > 0 && <BannerStrip banners={banners} />}
    </div>
  );
}

function HeroBalanceCard({
  accounts, active, onChangeAccount, loading,
  totalBalance, realCount, todaysPnl, todaysPnlPct,
}: {
  accounts: AccountRow[];
  active: AccountRow | null;
  onChangeAccount: (id: string) => void;
  loading: boolean;
  totalBalance: number;
  realCount: number;
  todaysPnl: number;
  todaysPnlPct: number;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const a = active;
  const pnlUp = todaysPnl >= 0;

  return (
    <div
      data-tour={TOUR_TARGETS.DASHBOARD_BALANCE}
      className="relative rounded-3xl p-5 md:p-7 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f2d484 0%, #ddb04a 42%, #c1912a 78%, #a87b1f 100%)',
        boxShadow: '0 18px 44px rgba(168,123,31,0.28), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
    >
      {/* soft sheen */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 90% at 85% -10%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 55%)' }}
      />

      <div className="relative">
        {/* Top row: account picker + wallet actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all hover:brightness-105"
              style={{ background: 'rgba(255,255,255,0.32)', border: '1px solid rgba(28,20,5,0.18)' }}
            >
              <span
                className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                style={{ color: '#fff', background: a?.is_demo ? 'rgba(28,20,5,0.55)' : INK }}
              >
                {a?.is_demo ? 'Demo' : 'Real'}
              </span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: INK }}>
                {a?.account_number || (loading ? '…' : 'No accounts')}
              </span>
              <ChevronDown size={14} style={{ color: INK_SOFT }} />
            </button>
            {pickerOpen && accounts.length > 0 && (
              <div
                className="absolute top-full left-0 mt-2 z-30 rounded-xl p-1.5 min-w-[260px]"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
                }}
              >
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { onChangeAccount(acc.id); setPickerOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-bg-hover"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                      style={acc.is_demo
                        ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                        : { color: '#d6a93d', background: 'rgba(214,169,61,0.12)' }}
                    >
                      {acc.is_demo ? 'Demo' : 'Real'}
                    </span>
                    <span className="font-semibold tabular-nums">#{acc.account_number}</span>
                    <span className="ml-auto text-xs text-text-tertiary tabular-nums">{fmtUsd(acc.balance)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <HeroAction href="/wallet"><ArrowDownToLine size={14} /> Deposit</HeroAction>
            <a
              href={a ? tradeUrl(a.id) : '#'}
              target={a ? '_blank' : undefined}
              rel="noopener noreferrer"
              aria-disabled={!a}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:brightness-110',
                !a && 'pointer-events-none opacity-50',
              )}
              style={{ background: INK, color: '#f2d484' }}
            >
              Trade <ExternalLink size={13} />
            </a>
            <HeroAction href="/wallet"><ArrowUpFromLine size={14} /> Withdraw</HeroAction>
            <HeroAction href="/accounts">Details</HeroAction>
          </div>
        </div>

        {/* Balance + P/L */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: INK_SOFT }}>Total Balance</p>
            <p className="mt-1 text-3xl md:text-4xl font-bold tabular-nums" style={{ color: INK }}>{fmtUsd(totalBalance)}</p>
            <p className="text-xs mt-1" style={{ color: INK_FAINT }}>
              Across {realCount} {realCount === 1 ? 'live account' : 'live accounts'}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: INK_SOFT }}>Open P/L</p>
            <p
              className="mt-1 text-2xl md:text-3xl font-bold tabular-nums inline-flex items-center gap-2"
              style={{ color: pnlUp ? '#14532d' : '#7f1d1d' }}
            >
              {pnlUp ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              {pnlUp ? '+' : ''}{fmtUsd(todaysPnl)}
            </p>
            <p className="text-xs mt-1 tabular-nums" style={{ color: INK_FAINT }}>
              {todaysPnlPct >= 0 ? '+' : ''}{todaysPnlPct.toFixed(2)}% unrealized
            </p>
          </div>
        </div>

        {/* Selected-account stats */}
        <div
          className="mt-6 pt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6"
          style={{ borderTop: '1px solid rgba(28,20,5,0.18)' }}
        >
          <HeroStat label="Balance" value={fmtUsd(a?.balance ?? 0)} />
          <HeroStat label="Equity" value={fmtUsd(a?.equity ?? 0)} />
          <HeroStat label="Free margin" value={fmtUsd(a?.free_margin ?? 0)} negative={(a?.free_margin ?? 0) < 0} />
          <HeroStat label="Leverage" value={a ? `1:${a.leverage}` : '—'} />
          <HeroStat label="No swap" value={a?.swap_free ? 'Yes' : 'No'} />
        </div>
      </div>
    </div>
  );
}

function HeroAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:brightness-105"
      style={{ background: 'rgba(255,255,255,0.32)', border: '1px solid rgba(28,20,5,0.18)', color: INK }}
    >
      {children}
    </Link>
  );
}

function HeroStat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: INK_FAINT }}>{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-base md:text-lg" style={{ color: negative ? '#7f1d1d' : INK }}>
        {value}
      </p>
    </div>
  );
}

function TopMoversCard({ movers }: { movers: { symbol: string; pct: number; price: number }[] }) {
  return (
    <Card title="Top daily movers">
      {movers.length === 0 ? (
        <div className="divide-y divide-border-primary">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="py-3 flex items-center gap-3 animate-pulse">
              <div className="h-3.5 w-20 rounded bg-bg-hover" />
              <div className="ml-auto h-3.5 w-16 rounded bg-bg-hover" />
              <div className="h-6 w-16 rounded-md bg-bg-hover" />
            </div>
          ))}
          <p className="pt-3 text-xs text-text-tertiary text-center">Market data loading…</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-primary">
          {movers.map((m) => {
            const up = m.pct >= 0;
            const hasPct = Number.isFinite(m.pct);
            const hasPrice = Number.isFinite(m.price) && m.price > 0;
            return (
              <li key={m.symbol} className="py-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-text-primary flex-1">{m.symbol}</span>
                <span className="text-sm font-mono tabular-nums text-text-tertiary">
                  {hasPrice ? fmtNum(m.price, m.symbol === 'BTCUSD' ? 0 : 4) : '—'}
                </span>
                {hasPct && (
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 text-xs font-bold tabular-nums px-2 py-1 rounded-md',
                      up ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10',
                    )}
                  >
                    {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {up ? '+' : ''}{m.pct.toFixed(2)}%
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StatusProgramCard({ level, xp, xpNext }: { level: number; xp: number; xpNext: number }) {
  const [tab, setTab] = useState<'challenges' | 'rewards'>('challenges');
  const pct = xpNext > 0 ? Math.min(100, Math.round((xp / xpNext) * 100)) : 0;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <BadgeCheck size={18} className="text-[#d6a93d]" /> Status program
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('challenges')}
            className={clsx('px-3 py-1.5 text-xs font-semibold rounded-full transition-colors',
              tab === 'challenges' ? 'bg-[#d6a93d] text-black' : 'text-text-tertiary hover:text-text-primary')}
          >
            Challenges
          </button>
          <button
            type="button"
            onClick={() => setTab('rewards')}
            className={clsx('px-3 py-1.5 text-xs font-semibold rounded-full transition-colors',
              tab === 'rewards' ? 'bg-[#d6a93d] text-black' : 'text-text-tertiary hover:text-text-primary')}
          >
            My rewards
          </button>
        </div>
      </div>

      {/* XP progress toward the next level */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-text-tertiary">Level {level} → Level {level + 1}</span>
        <span className="text-text-tertiary tabular-nums">{xp} / {xpNext} XP</span>
      </div>
      <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f2d484, #d6a93d)' }}
        />
      </div>

      {tab === 'challenges' ? (
        <div
          className="mt-4 rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <BarChart3 size={18} className="text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Complete your first trade</p>
            <p className="text-xs text-text-tertiary mt-0.5">Open and close any position to earn your first reward.</p>
          </div>
          <span className="text-xs font-bold text-[#d6a93d] shrink-0">+50 XP</span>
        </div>
      ) : (
        <div
          className="mt-4 rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Coins size={18} className="text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Reward balance</p>
            <p className="text-xs text-text-tertiary mt-0.5">Redeem your FXA coins in the rewards store.</p>
          </div>
          <Link href="/rewards" className="text-xs font-semibold text-[#d6a93d] hover:underline shrink-0">Open →</Link>
        </div>
      )}
    </Card>
  );
}

function InviteFriendsCard() {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <ShieldCheck size={26} className="text-green-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-text-primary">Invite friends, earn together</h3>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Get a share of every trade your invitees make. Lifetime payouts straight to your main wallet.
          </p>
          <Link
            href="/business"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#d6a93d] hover:underline"
          >
            Learn details <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function BannerStrip({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 3000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (banners.length === 0) return null;
  const b = banners[index];
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
      <div className="relative w-full h-44 sm:h-52 md:h-60 bg-bg-secondary">
        {b.link_url ? (
          <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
            <img src={b.image_url} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
          </a>
        ) : (
          <img src={b.image_url} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
        )}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {banners.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ background: i === index ? '#d6a93d' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      {title && <h2 className="text-base font-bold text-text-primary mb-3">{title}</h2>}
      {children}
    </div>
  );
}
