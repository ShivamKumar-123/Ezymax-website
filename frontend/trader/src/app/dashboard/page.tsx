'use client';

/**
 * Broker home — replaces the old open-positions / quick-actions dashboard.
 * Layout follows the Elev8-style brief: account balance card with action
 * buttons, popular deposit methods, top daily movers, status program /
 * rewards, invite-friends banner, deposit bonus, and the existing admin-
 * configurable banner carousel.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  ChevronDown, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, TrendingDown, ArrowRight,
  ExternalLink, Loader2,
  Wallet as WalletIcon, BarChart3, Users,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency as fmtUsd, formatNumber as fmtNum } from '@/lib/formatters';

interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  credit?: number;
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
  // Cached daily-open bars — these don't change intraday, so we fetch
  // once on mount and reuse across every mover refresh. The poll only
  // re-pulls the cheap /instruments/prices/all endpoint.
  const dayOpenBarsRef = useRef<BarRow[][]>([]);

  const refreshAccounts = useCallback(async (opts: { silent?: boolean } = {}) => {
    try {
      const accs = await api.get<{ items: AccountRow[] } | AccountRow[]>('/accounts');
      const list: AccountRow[] = Array.isArray(accs) ? accs : (accs as { items: AccountRow[] }).items || [];
      setAccounts(list);
      if (list.length > 0) setActiveId((cur) => cur ?? list[0]!.id);
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
      const dayOpen = bars.length > 0 ? Number(bars[bars.length - 1]!.open) : NaN;
      const price = tickMap.get(sym) ?? (bars.length > 0 ? Number(bars[bars.length - 1]!.close) : NaN);
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
        if (list.length > 0) setActiveId((cur) => cur ?? list[0]!.id);
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

  // Aggregate stats for the DAG mockup top section. REAL accounts only —
  // demo balances / demo floating P&L never mix into these numbers.
  const realAccounts = accounts.filter((a) => !a.is_demo);
  const totalBalance = realAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalCredit = realAccounts.reduce((s, a) => s + (Number(a.credit) || 0), 0);
  const totalEquity = realAccounts.reduce((s, a) => s + (Number(a.equity) || 0), 0);
  // equity = balance + credit + floating P&L, so subtract credit too —
  // otherwise a bonus would show up as "unrealized profit".
  const todaysPnl = totalEquity - totalBalance - totalCredit;
  const todaysPnlPct = totalBalance > 0 ? (todaysPnl / totalBalance) * 100 : 0;
  const firstName = user?.first_name || (user?.email ? user.email.split('@')[0] : 'Trader');

  return (
    <div className="space-y-5 pb-8 w-full">
      {/* ── Greeting header (DAG mockup) ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-2">
          Welcome back, {firstName}! <span className="text-2xl">👋</span>
        </h1>
        <p className="text-sm text-text-secondary mt-1">Trade. Earn. Level Up.</p>
      </div>

      {/* Admin-managed banner strip — moved up here so the marketing
          message sits in the user's first view instead of being buried
          at the bottom of the dashboard. */}
      {banners.length > 0 && <BannerStrip banners={banners} />}

      {/* ── 4 stat cards (DAG aesthetic). Surfaces + foreground colors
              come from theme-aware `--card-*` CSS vars (defined in
              globals.css) so the cards work in both dark and light
              mode without per-component `dark:` overrides. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Total Balance — label left, value right */}
        <div className="rounded-2xl p-5 bg-bg-card border border-border-primary">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
                <WalletIcon size={20} className="text-[#E94E1B]" />
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-text-tertiary">Total Balance</p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-2xl font-bold font-mono tabular-nums truncate text-text-primary">{fmtUsd(totalBalance)}</p>
              <p className="text-xs mt-0.5 text-text-secondary">Across {realAccounts.length} {realAccounts.length === 1 ? 'account' : 'accounts'}</p>
            </div>
          </div>
        </div>

        {/* Open P/L — value stays green/up red/down; icon tile is brand orange */}
        <div className="rounded-2xl p-5 bg-bg-card border border-border-primary">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
                {todaysPnl >= 0
                  ? <TrendingUp size={20} className="text-[#E94E1B]" />
                  : <TrendingDown size={20} className="text-[#E94E1B]" />}
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-text-tertiary">Open P/L</p>
            </div>
            <div className="text-right min-w-0">
              <p className={clsx('text-2xl font-bold font-mono tabular-nums truncate', todaysPnl >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {todaysPnl >= 0 ? '+' : ''}{fmtUsd(todaysPnl)}
              </p>
              <p className="text-xs mt-0.5 text-text-secondary">
                {todaysPnlPct >= 0 ? '+' : ''}{todaysPnlPct.toFixed(2)}% unrealized
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 quick-action cards — clean white, subtle accent on hover ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            if (accounts.length === 0) {
              router.push('/trading/open-account');
              return;
            }
            const id = activeId || accounts[0]!.id;
            router.push(`/trading/terminal?account=${encodeURIComponent(id)}&view=chart`);
          }}
          className="group rounded-2xl p-5 bg-bg-card border border-border-primary hover:border-[#E94E1B] transition-colors flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
            <BarChart3 size={22} className="text-[#E94E1B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-text-primary truncate">Trade Now</p>
            <p className="text-xs text-text-secondary mt-0.5">Start Trading</p>
          </div>
          <ArrowRight size={20} className="text-text-tertiary group-hover:text-[#E94E1B] group-hover:translate-x-1 transition-all shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => router.push('/social')}
          className="group rounded-2xl p-5 bg-bg-card border border-border-primary hover:border-[#E94E1B] transition-colors flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
            <Users size={22} className="text-[#E94E1B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-text-primary truncate">Copy Trading</p>
            <p className="text-xs text-text-secondary mt-0.5">Copy Top Traders</p>
          </div>
          <ArrowRight size={20} className="text-text-tertiary group-hover:text-[#E94E1B] group-hover:translate-x-1 transition-all shrink-0" />
        </button>

        {/* Add Funds tile is meaningless for try-with-demo users — demo
            accounts are pre-funded with play money. */}
        {!user?.is_demo && (
          <button
            type="button"
            onClick={() => router.push('/wallet')}
            className="group rounded-2xl p-5 bg-bg-card border border-border-primary hover:border-[#E94E1B] transition-colors flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
              <WalletIcon size={22} className="text-[#E94E1B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-text-primary truncate">Add Funds</p>
              <p className="text-xs text-text-secondary mt-0.5">Deposit Now</p>
            </div>
            <ArrowRight size={20} className="text-text-tertiary group-hover:text-[#E94E1B] group-hover:translate-x-1 transition-all shrink-0" />
          </button>
        )}
      </div>

      <AccountBalanceCard
        accounts={accounts}
        active={activeAccount}
        onChangeAccount={setActiveId}
        loading={loading}
      />
      <TopMoversCard movers={movers} />
    </div>
  );
}

function AccountBalanceCard({
  accounts, active, onChangeAccount, loading,
}: {
  accounts: AccountRow[];
  active: AccountRow | null;
  onChangeAccount: (id: string) => void;
  loading: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const a = active;

  return (
    <div
      className="rounded-2xl p-5 md:p-6"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-bg-hover"
            style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
          >
            <span
              className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={a?.is_demo
                ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }
                : { color: '#E94E1B', background: 'rgba(233,78,27,0.12)', border: '1px solid rgba(233,78,27,0.3)' }}
            >
              {a?.is_demo ? 'Demo' : 'Real'}
            </span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              {a?.account_number || (loading ? '…' : 'No accounts')}
            </span>
            <ChevronDown size={14} className="text-text-tertiary" />
          </button>
          {pickerOpen && accounts.length > 0 && (
            <div
              className="absolute top-full left-0 mt-2 z-30 rounded-xl p-1.5 min-w-[260px]"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
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
                      : { color: '#E94E1B', background: 'rgba(233,78,27,0.12)' }}
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
          {/* Deposit / Withdraw don't apply to demo accounts — play
              money can't be funded or withdrawn. */}
          {!a?.is_demo && (
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors"
              style={{ background: '#E94E1B', color: '#ffffff' }}
            >
              <ArrowDownToLine size={14} /> Deposit
            </Link>
          )}
          <a
            href={a ? tradeUrl(a.id) : '#'}
            target={a ? '_blank' : undefined}
            rel="noopener noreferrer"
            aria-disabled={!a}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              !a && 'pointer-events-none opacity-50',
            )}
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            Trade <ExternalLink size={13} />
          </a>
          {!a?.is_demo && (
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-bg-hover"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <ArrowUpFromLine size={14} /> Withdraw
            </Link>
          )}
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-bg-hover"
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            Details
          </Link>
        </div>
      </div>

      {/* Server + No-swap stats removed: the platform runs a single server
          (nothing to show) and any swap charged shows up per-trade in the
          history, so a static account-level "No swap: No" label added noise. */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
        <Stat label="Balance" value={fmtUsd(a?.balance ?? 0)} highlight />
        <Stat label="Free margin" value={fmtUsd(a?.free_margin ?? 0)} />
        <Stat label="Equity" value={fmtUsd(a?.equity ?? 0)} />
        <Stat label="Leverage" value={a ? `1:${a.leverage}` : '—'} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-text-tertiary">{label}</p>
      <p
        className={clsx('mt-1 font-bold tabular-nums', highlight ? 'text-xl md:text-2xl' : 'text-base md:text-lg')}
        style={{ color: highlight ? '#E94E1B' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function TopMoversCard({ movers }: { movers: { symbol: string; pct: number; price: number }[] }) {
  return (
    <Card title="Top daily movers">
      <ul className="divide-y divide-border-primary">
        {movers.length === 0 && (
          <li className="py-8 text-center text-sm text-text-tertiary flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </li>
        )}
        {movers.map((m) => {
          const up = m.pct >= 0;
          const Icon = up ? TrendingUp : TrendingDown;
          return (
            <li key={m.symbol} className="py-3 flex items-center gap-3">
              <span className="text-sm font-semibold text-text-primary flex-1">{m.symbol}</span>
              <span className="text-sm font-mono tabular-nums text-text-secondary">
                {Number.isFinite(m.price) && m.price > 0 ? fmtNum(m.price, m.symbol === 'BTCUSD' ? 0 : 4) : '—'}
              </span>
              <span
                className="inline-flex items-center gap-1 text-xs font-bold tabular-nums"
                style={{ color: up ? '#22c55e' : '#ef4444' }}
              >
                <Icon size={12} />
                {Number.isFinite(m.pct) ? `${up ? '+' : ''}${m.pct.toFixed(2)}%` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
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
  // banners[index] is always in range thanks to the modulo in the setInterval,
  // but TypeScript can't prove that — guard explicitly.
  const b = banners[index];
  if (!b) return null;
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
      <div className="relative w-full h-44 sm:h-52 md:h-60 bg-bg-secondary">
        {b.link_url ? (
          <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
            <Image
              src={b.image_url}
              alt={b.title || 'Banner'}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
            />
          </a>
        ) : (
          <Image
            src={b.image_url}
            alt={b.title || 'Banner'}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
          />
        )}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {banners.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ background: i === index ? '#E94E1B' : 'rgba(255,255,255,0.4)' }}
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
