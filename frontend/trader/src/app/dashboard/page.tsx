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
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import BrandCard from '@/components/ui/BrandCard';
import {
  ChevronDown, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, TrendingDown, ArrowRight,
  ExternalLink, Loader2,
  Wallet as WalletIcon, LineChart, Bot, Clock } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import WorldMarketsMap from '@/components/dashboard/WorldMarketsMap';
import Pagination, { usePagination } from '@/components/ui/Pagination';
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

/** Real public quote from /api/market-quotes (Yahoo / Binance). */
interface PublicQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  high: number | null;
  low: number | null;
  spark: number[];
  digits: number;
}

interface MoverRow {
  symbol: string;
  name: string;
  price: number;
  pct: number;
  high: number | null;
  low: number | null;
  spark: number[];
  digits: number;
  /** 'feed' = platform price feed tick, 'public' = public market data. */
  source: 'feed' | 'public';
}

const MOVER_META: Record<string, { name: string; digits: number }> = {
  XAUUSD: { name: 'Gold', digits: 2 },
  NAS100: { name: 'Nasdaq 100', digits: 2 },
  BTCUSD: { name: 'Bitcoin', digits: 0 },
  EURUSD: { name: 'EUR / USD', digits: 4 },
};
interface BarRow { time: number; open: number; close: number; }

interface PositionRow {
  id: string;
  account_id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price: number | null;
  profit: number;
  status: string;
  created_at: string | null;
}

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
  const [movers, setMovers] = useState<MoverRow[]>([]);
  // Public quotes (real, free sources) — detail + fallback for the feed.
  const publicRef = useRef<Record<string, PublicQuote>>({});
  const lastTicksRef = useRef<PriceTick[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<PositionRow[]>([]);
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
    lastTicksRef.current = ticksRaw;
    const tickMap = new Map<string, number>();
    for (const t of ticksRaw || []) {
      if (t?.symbol && t.bid && t.ask) tickMap.set(t.symbol.toUpperCase(), (t.bid + t.ask) / 2);
    }
    const out: MoverRow[] = TOP_MOVER_SYMBOLS.map((sym, i) => {
      const pq = publicRef.current[sym];
      const meta = MOVER_META[sym] ?? { name: sym, digits: 2 };
      const bars = dayOpenBarsRef.current[i] || [];
      const dayOpen = bars.length > 0 ? Number(bars[bars.length - 1]!.open) : NaN;
      const feedPrice = tickMap.get(sym);
      // Platform feed first (what clients actually trade on); public data
      // fills in whenever the feed has no tick, and always supplies the
      // instrument details (name, day range, sparkline).
      if (feedPrice != null && Number.isFinite(feedPrice)) {
        const pct = Number.isFinite(dayOpen) && dayOpen > 0
          ? ((feedPrice - dayOpen) / dayOpen) * 100
          : (pq?.changePct ?? NaN);
        return { symbol: sym, name: pq?.name ?? meta.name, price: feedPrice, pct,
          high: pq?.high ?? null, low: pq?.low ?? null, spark: pq?.spark ?? [],
          digits: pq?.digits ?? meta.digits, source: 'feed' };
      }
      return { symbol: sym, name: pq?.name ?? meta.name, price: pq?.price ?? NaN, pct: pq?.changePct ?? NaN,
        high: pq?.high ?? null, low: pq?.low ?? null, spark: pq?.spark ?? [],
        digits: pq?.digits ?? meta.digits, source: 'public' };
    });
    setMovers(out);
  }, []);

  // Public quotes: fetch on mount, then every 60s (server caches 60s too).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/market-quotes');
        const d = (await r.json()) as { items?: PublicQuote[] };
        if (cancelled || !d.items) return;
        const map: Record<string, PublicQuote> = {};
        for (const q of d.items) map[q.symbol] = q;
        publicRef.current = map;
        recomputeMovers(lastTicksRef.current);
      } catch {
        // keep whatever we had
      }
    };
    void load();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void load();
    }, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [recomputeMovers]);

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

  // ── Open trades across ALL accounts (the dashboard Trade section).
  // Fetched per account and merged; polled on its own 5s cadence (the
  // 2s account/price poll would multiply request volume by N accounts).
  const accountsRef = useRef<AccountRow[]>([]);
  accountsRef.current = accounts;
  const accountIdsKey = accounts.map((a) => a.id).join(',');

  const refreshTrades = useCallback(async () => {
    const accts = accountsRef.current;
    if (accts.length === 0) { setTrades([]); return; }
    const lists = await Promise.all(
      accts.map((a) =>
        api.get<PositionRow[]>('/positions/', { account_id: a.id, status: 'open' }).catch(() => [] as PositionRow[]),
      ),
    );
    const merged = lists.flat().sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));
    setTrades(merged);
  }, []);

  useEffect(() => {
    if (!accountIdsKey) { setTrades([]); return; }
    void refreshTrades();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refreshTrades();
    }, 5000);
    return () => clearInterval(t);
  }, [accountIdsKey, refreshTrades]);

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
      {/* ── Greeting header — Crextio "Welcome in" treatment: big light
              charcoal greeting on the left; borderless big-number stats
              plus a time-tracker-style tick dial on the right. ── */}
      <div className="pt-2 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <h1 className="text-[clamp(1.75rem,4.5vw,2.625rem)] leading-tight font-light text-text-primary">
            Welcome back, <span className="font-normal">{firstName}</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">Trade. Earn. Level Up.</p>
        </div>

        {/* Stats strip — one aligned bar: three equal cells split by hairlines,
            the unrealized dial docked at the end. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          className="flex items-center gap-3 xl:justify-end"
        >
          {/* Columns size to their own content instead of three forced equal
              thirds. With equal thirds a large balance could not fit its cell
              and, having nothing to clip it, painted straight over the next
              stat's icon — while the clock cell sat on unused slack. */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_auto] max-w-full overflow-x-auto divide-y sm:divide-y-0 sm:divide-x divide-border-primary rounded-[22px] bg-bg-card ring-1 ring-[#E94E1B]/25 shadow-[0_22px_50px_-20px_rgba(233,78,27,0.55),0_6px_18px_-10px_rgba(233,78,27,0.35)] backdrop-blur">
            <div className="px-5 py-3.5 sm:px-6 min-w-0">
              <BigStat
                icon={<WalletIcon strokeWidth={1.9} />}
                value={<AnimatedMoney value={totalBalance} />}
                label={`Total Balance · ${realAccounts.length} ${realAccounts.length === 1 ? 'account' : 'accounts'}`}
                tone="brand"
              />
            </div>
            <div className="px-5 py-3.5 sm:px-6 min-w-0">
              <BigStat
                icon={todaysPnl >= 0 ? <TrendingUp strokeWidth={1.9} /> : <TrendingDown strokeWidth={1.9} />}
                value={<AnimatedMoney value={todaysPnl} signed />}
                label="Open P/L"
                tone={todaysPnl >= 0 ? 'up' : 'down'}
                pulse={todaysPnl !== 0}
              />
            </div>
            <div className="px-5 py-3.5 sm:px-6 min-w-0">
              <LocalClock />
            </div>
          </div>
          <TickDial
            pct={todaysPnlPct}
            caption="Unrealized"
          />
        </motion.div>
      </div>

      {/* Admin-managed banner strip — moved up here so the marketing
          message sits in the user's first view instead of being buried
          at the bottom of the dashboard. */}
      {banners.length > 0 && <BannerStrip banners={banners} />}

      {/* ── 3 quick-action shortcuts: Terminal · Wallet · AI Strategy
              Builder ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <QuickAction
          icon={<LineChart size={22} className="text-crx-charcoal" strokeWidth={1.8} />}
          title="Terminal"
          subtitle="Open the trading terminal"
          onClick={() => {
            if (accounts.length === 0) {
              router.push('/trading/open-account');
              return;
            }
            const id = activeId || accounts[0]!.id;
            router.push(`/trading/terminal?account=${encodeURIComponent(id)}&view=chart`);
          }}
        />
        {/* Always visible — demo users are gated by the wallet page's
            own DemoLockGate rather than a hidden shortcut. */}
        <QuickAction
          icon={<WalletIcon size={22} className="text-crx-charcoal" strokeWidth={1.8} />}
          title="Wallet"
          subtitle="Deposit & Withdraw"
          onClick={() => router.push('/wallet')}
        />
        <QuickAction
          icon={<Bot size={22} className="text-crx-charcoal" strokeWidth={1.8} />}
          title="AI Strategy Builder"
          subtitle="Build & backtest strategies"
          onClick={() => router.push('/ai-strategies')}
        />
      </div>

      <AccountBalanceCard
        accounts={accounts}
        active={activeAccount}
        onChangeAccount={setActiveId}
        loading={loading}
      />
      <TradesSection trades={trades} accounts={accounts} />
      <TopMoversCard movers={movers} />
      <WorldMarketsMap />
    </div>
  );
}

/** Quick-action shortcut card: soft-orange icon chip, title/subtitle,
 *  charcoal circular arrow. */
function QuickAction({
  icon, title, subtitle, onClick,
}: {
  icon: React.ReactNode; title: string; subtitle: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[24px] p-4 sm:p-5 bg-bg-card hover:bg-bg-glass-heavy transition-all duration-fast ease-entrance active:scale-[0.98] flex items-center gap-3 sm:gap-4 text-left"
    >
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-crx-yellow-soft flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-base font-bold text-text-primary truncate">{title}</p>
        <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
      </div>
      <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-crx-charcoal text-crx-charcoal-ink transition-transform group-hover:translate-x-1">
        <ArrowRight size={16} strokeWidth={2} />
      </span>
    </button>
  );
}

/** Trade section — every open trade across ALL of the user's accounts,
 *  merged into one list. Each row links into that account's terminal. */
function TradesSection({ trades, accounts }: { trades: PositionRow[]; accounts: AccountRow[] }) {
  const pager = usePagination(trades, 8);
  const numberFor = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.account_number ?? '—';
  return (
    <Card title="Trades — all accounts">
      {trades.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-text-secondary">No open trades yet.</p>
          <p className="text-xs text-text-tertiary mt-1">
            Open the terminal to place your first trade — it will show up here across every account.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-secondary">
          {pager.items.map((t) => {
            const up = t.profit >= 0;
            const buy = t.side.toLowerCase() === 'buy';
            return (
              <li key={t.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-bg-card-nested text-text-secondary tabular-nums">
                  #{numberFor(t.account_id)}
                </span>
                <span className="text-sm font-semibold text-text-primary w-20">{t.symbol}</span>
                <span
                  className={clsx(
                    'text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full',
                    buy ? 'bg-crx-yellow-soft text-[#C73E11]' : 'bg-crx-charcoal text-crx-charcoal-ink',
                  )}
                >
                  {buy ? 'Buy' : 'Sell'}
                </span>
                <span className="text-xs text-text-secondary tabular-nums">{t.lots} lots</span>
                <span className="text-xs text-text-tertiary tabular-nums hidden sm:inline">
                  {fmtNum(t.open_price, 4)} → {t.current_price != null ? fmtNum(t.current_price, 4) : '—'}
                </span>
                <span
                  className={clsx(
                    'ml-auto text-sm font-medium tabular-nums',
                    up ? 'text-text-primary' : 'text-red-600',
                  )}
                >
                  {up ? '+' : ''}{fmtUsd(t.profit)}
                </span>
                <a
                  href={tradeUrl(t.account_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${t.symbol} in terminal`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-card-nested text-text-secondary hover:bg-crx-charcoal hover:text-crx-charcoal-ink transition-colors"
                >
                  <ExternalLink size={13} strokeWidth={2} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {trades.length > 0 && <Pagination {...pager.props} itemLabel="trades" />}
    </Card>
  );
}

/** Borderless big-number stat — the Crextio "78 Employee / 56 Hirings"
 *  treatment: small icon beside a large light number, muted label under. */
type StatTone = 'brand' | 'up' | 'down' | 'neutral';
const STAT_TONE: Record<StatTone, string> = {
  brand: 'bg-[linear-gradient(160deg,#FF9A64_0%,#F0561F_55%,#B93A12_100%)] shadow-[0_12px_24px_-10px_rgba(240,86,31,0.7)]',
  up: 'bg-[linear-gradient(160deg,#4ADE80_0%,#16A34A_55%,#15803D_100%)] shadow-[0_12px_24px_-10px_rgba(22,163,74,0.65)]',
  down: 'bg-[linear-gradient(160deg,#F87171_0%,#DC2626_55%,#B91C1C_100%)] shadow-[0_12px_24px_-10px_rgba(220,38,38,0.65)]',
  neutral: 'bg-[linear-gradient(160deg,#6B6B6B_0%,#2A2A2A_55%,#0F0F0F_100%)] shadow-[0_12px_24px_-10px_rgba(0,0,0,0.6)]',
};

/** Animated icon chip — springs in on mount, floats gently, tilts on hover. */
function StatChip({ tone, children, pulse }: { tone: StatTone; children: React.ReactNode; pulse?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={reduce ? false : { scale: 0.6, rotate: -14, opacity: 0 }}
      animate={reduce ? { opacity: 1 } : { scale: 1, rotate: 0, opacity: 1, y: [0, -2.5, 0] }}
      transition={reduce ? undefined : {
        scale: { type: 'spring', stiffness: 260, damping: 18 },
        rotate: { type: 'spring', stiffness: 260, damping: 18 },
        opacity: { duration: 0.25 },
        y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
      }}
      whileHover={reduce ? undefined : { scale: 1.07, rotate: -5 }}
      className={clsx(
        'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ring-1 ring-white/25',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] [&>svg]:h-[22px] [&>svg]:w-[22px]',
        STAT_TONE[tone],
      )}
      aria-hidden
    >
      {pulse && !reduce && (
        <motion.span
          className="absolute inset-0 rounded-2xl ring-2 ring-current opacity-0"
          animate={{ opacity: [0.45, 0], scale: [1, 1.35] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      {children}
    </motion.span>
  );
}

/** Bold tabular number that counts up/down to its new value. */
function AnimatedMoney({ value, signed }: { value: number; signed?: boolean }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce) { setShown(value); mv.set(value); return; }
    const controls = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(v) });
    return () => controls.stop();
  }, [value, mv, reduce]);
  const abs = Math.abs(shown).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = signed ? (shown >= 0 ? '+' : '−') : shown < 0 ? '−' : '';
  return <>{sign}${abs}</>;
}

/** Headline stat cell: chip · bold value · uppercase caption. */
function BigStat({ icon, value, label, tone = 'brand', pulse }: { icon: React.ReactNode; value: React.ReactNode; label: React.ReactNode; tone?: StatTone; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <StatChip tone={tone} pulse={pulse}>{icon}</StatChip>
      <div className="min-w-0">
        <p className="text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-none tracking-tight tabular-nums text-text-primary whitespace-nowrap">
          {value}
        </p>
        <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}

/** Live local clock — bold digits with a blinking colon, a seconds ring
 *  around the chip, and the viewer's zone + UTC offset as the caption. */
function LocalClock() {
  const reduce = useReducedMotion();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const zone = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      let offset = '';
      try {
        offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
          .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
      } catch {
        offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
          .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
      }
      return { tz: tz.replace(/_/g, ' '), offset };
    } catch {
      return { tz: 'UTC', offset: 'GMT' };
    }
  }, []);
  const hh = now ? String(now.getHours()).padStart(2, '0') : '--';
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--';
  const ss = now ? String(now.getSeconds()).padStart(2, '0') : '--';
  const secFrac = now ? now.getSeconds() / 60 : 0;
  const R = 27; const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-3.5">
      <span className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
        {/* seconds ring */}
        <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="30" cy="30" r={R} fill="none" strokeWidth="2" className="stroke-border-primary" />
          <circle
            cx="30" cy="30" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round"
            className="stroke-accent"
            style={{ strokeDasharray: C, strokeDashoffset: C * (1 - secFrac), transition: reduce ? undefined : 'stroke-dashoffset 0.9s linear' }}
          />
        </svg>
        <StatChip tone="neutral"><Clock strokeWidth={1.9} /></StatChip>
      </span>
      <div className="min-w-0">
        <p className="text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-none tracking-tight tabular-nums text-text-primary whitespace-nowrap">
          {hh}<span className={clsx('mx-[1px]', !reduce && now && 'animate-pulse')}>:</span>{mm}<span className={clsx('mx-[1px]', !reduce && now && 'animate-pulse')}>:</span>{ss}
        </p>
        <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary whitespace-nowrap">
          {zone.tz}{zone.offset ? ` · ${zone.offset}` : ''}
        </p>
      </div>
    </div>
  );
}

/** Time-tracker-style tick dial (Crextio "02:35 Work Time" widget):
 *  a ring of radial tick marks with the swept portion in butter
 *  yellow, and the value in light type at the center. */
function TickDial({ pct, caption }: { pct: number; caption: string }) {
  const TICKS = 48;
  const R_OUT = 34;
  const R_IN = 28;
  const CX = 38;
  const CY = 38;
  // Sweep scales with |pct| (full ring at ±10%), with a minimum so the
  // dial reads as a gauge even at 0.
  const fraction = Math.min(Math.max(Math.abs(pct) / 10, 0.06), 1);
  const lit = Math.round(TICKS * fraction);
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const angle = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
    const x1 = CX + R_IN * Math.cos(angle);
    const y1 = CY + R_IN * Math.sin(angle);
    const x2 = CX + R_OUT * Math.cos(angle);
    const y2 = CY + R_OUT * Math.sin(angle);
    return { x1, y1, x2, y2, on: i < lit };
  });
  return (
    <div className="relative h-[76px] w-[76px] shrink-0" aria-label={`${caption} ${pct.toFixed(2)}%`}>
      <svg viewBox="0 0 76 76" className="h-full w-full">
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.on ? 'var(--crx-yellow)' : 'var(--border-primary)'}
            strokeWidth={t.on ? 2.4 : 1.6}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-normal tabular-nums leading-none text-text-primary">
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
        <span className="mt-0.5 text-[8.5px] uppercase tracking-wide text-text-tertiary">{caption}</span>
      </div>
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

  const header = (
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-full px-4 py-2 transition-colors hover:bg-bg-hover"
            style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
          >
            <span
              className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={a?.is_demo
                ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }
                : { color: '#C73E11', background: 'rgba(233,78,27,0.12)', border: '1px solid rgba(233,78,27,0.35)' }}
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
                      : { color: '#C73E11', background: 'rgba(233,78,27,0.12)' }}
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

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {/* Deposit / Withdraw don't apply to demo accounts — play
              money can't be funded or withdrawn. */}
          {!a?.is_demo && (
            <Link
              href="/wallet"
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-sm font-bold transition-colors"
              style={{ background: 'var(--crx-charcoal)', color: 'var(--crx-charcoal-ink)' }}
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
              'inline-flex items-center justify-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-sm font-semibold transition-colors',
              !a && 'pointer-events-none opacity-50',
            )}
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            Trade <ExternalLink size={13} />
          </a>
          {!a?.is_demo && (
            <Link
              href="/wallet"
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-sm font-semibold transition-colors hover:bg-bg-hover"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <ArrowUpFromLine size={14} /> Withdraw
            </Link>
          )}
          <Link
            href="/accounts"
            className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-sm font-semibold transition-colors hover:bg-bg-hover"
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            Details
          </Link>
        </div>
      </div>

  );

  return (
    <BrandCard header={header}>
      {/* Server + No-swap stats removed: the platform runs a single server
          (nothing to show) and any swap charged shows up per-trade in the
          history, so a static account-level "No swap: No" label added noise. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
        <Stat label="Balance" value={fmtUsd(a?.balance ?? 0)} highlight />
        <Stat label="Free margin" value={fmtUsd(a?.free_margin ?? 0)} />
        <Stat label="Equity" value={fmtUsd(a?.equity ?? 0)} />
        <Stat label="Leverage" value={a ? `1:${a.leverage}` : '—'} />
      </div>
    </BrandCard>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-text-tertiary">{label}</p>
      <p
        className={clsx('mt-1 font-bold tabular-nums', highlight ? 'text-xl md:text-2xl' : 'text-base md:text-lg')}
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

/** Tiny intraday sparkline — last ~60 closes, orange when up. */
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <span className="hidden sm:block h-7 w-24" aria-hidden />;
  const W = 96, H = 28, P = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = P + (i / (data.length - 1)) * (W - P * 2);
    const y = P + (1 - (v - min) / span) * (H - P * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="hidden sm:block h-7 w-24 shrink-0" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? 'var(--crx-yellow)' : 'var(--text-tertiary)'}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TopMoversCard({ movers }: { movers: MoverRow[] }) {
  const ready = movers.some((m) => Number.isFinite(m.price));
  return (
    <Card title="Top daily movers">
      <ul className="divide-y divide-border-secondary">
        {!ready && (
          <li className="py-8 text-center text-sm text-text-tertiary flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading live quotes…
          </li>
        )}
        {ready && movers.map((m) => {
          const hasPrice = Number.isFinite(m.price);
          const hasPct = Number.isFinite(m.pct);
          const up = hasPct ? m.pct >= 0 : true;
          const Icon = up ? TrendingUp : TrendingDown;
          return (
            <li key={m.symbol} className="py-3 flex items-center gap-3 sm:gap-4">
              <div className="min-w-0 w-24 sm:w-32">
                <p className="text-sm font-semibold text-text-primary leading-tight">{m.symbol}</p>
                <p className="text-[11px] text-text-tertiary truncate">{m.name}</p>
              </div>
              <Sparkline data={m.spark} up={up} />
              <div className="ml-auto text-right">
                <p className="text-sm font-semibold tabular-nums text-text-primary">
                  {hasPrice ? fmtNum(m.price, m.digits) : '—'}
                </p>
                {m.high != null && m.low != null && (
                  <p className="text-[10px] text-text-tertiary tabular-nums hidden sm:block">
                    L {fmtNum(m.low, m.digits)} · H {fmtNum(m.high, m.digits)}
                  </p>
                )}
              </div>
              <span
                className={clsx(
                  'inline-flex w-[84px] items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums',
                  up ? 'bg-crx-yellow-soft text-crx-charcoal' : 'bg-bg-active text-text-secondary',
                )}
              >
                <Icon size={12} strokeWidth={2} />
                {hasPct ? `${up ? '+' : ''}${m.pct.toFixed(2)}%` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
      {ready && (
        <p className="mt-2 text-[10px] text-text-tertiary">
          {movers.some((m) => m.source === 'feed') ? 'Platform feed' : 'Public market data'} · refreshes every minute
        </p>
      )}
    </Card>
  );
}

/** Sliding banner carousel — all slides sit on one horizontal track
 *  that scrolls (translateX) to the active slide, auto-advancing every
 *  4 seconds. Dots jump straight to a slide. */
function BannerStrip({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (banners.length === 0) return null;

  const slide = (b: Banner, i: number) => (
    <Image
      src={b.image_url}
      alt={b.title || `Banner ${i + 1}`}
      fill
      priority={i === 0}
      sizes="(max-width: 768px) 100vw, 1500px"
      className="object-cover"
    />
  );

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden">
      <div
        className="flex h-48 sm:h-64 md:h-80 transition-transform duration-700 ease-entrance will-change-transform"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b, i) => (
          <div key={b.id} className="relative w-full h-full shrink-0 bg-bg-secondary">
            {b.link_url ? (
              <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
                {slide(b, i)}
              </a>
            ) : (
              slide(b, i)
            )}
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className="h-1.5 rounded-full transition-all duration-fast ease-entrance"
              style={{
                width: i === index ? 20 : 6,
                background: i === index ? 'var(--crx-yellow)' : 'rgba(255,255,255,0.55)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <BrandCard header={title ? <h2 className="text-base font-bold">{title}</h2> : undefined}>
      {children}
    </BrandCard>
  );
}
