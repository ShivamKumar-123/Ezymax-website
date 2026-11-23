'use client';

/**
 * Broker home — premium fintech redesign (2026-08-20).
 *
 * Visual language (spacious cards, soft radii, quiet borders, one strong
 * figure per card, ring/wave visualizations) follows the client's design
 * reference; every widget maps to an EXISTING platform feature and its
 * EXISTING endpoint — no new features, metrics or APIs were introduced:
 *
 *   hero balance + actions      → /accounts (+ existing Deposit/Trade/
 *                                 Withdraw/Details routes)
 *   margin ring                 → existing account margin_used / equity
 *   main wallet card            → /wallet/summary
 *   P&L tiles                   → /portfolio/summary pnl_breakdown
 *   performance wave + stats    → /portfolio/performance (+ summary equity)
 *   open positions list         → /portfolio/summary holdings
 *   top daily movers            → /instruments/{s}/bars + /prices/all
 *                                 (existing live-movers computation)
 *   KYC card                    → existing user.kyc_status + /kyc
 *   invite friends              → /business/referral/me
 *   banners                     → /banners
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { AccountHero, type AccountRow } from '@/components/dashboard/AccountHero';
import { MainWalletCard, type WalletSummary } from '@/components/dashboard/MainWalletCard';
import { PnlTiles, type PnlBreakdown } from '@/components/dashboard/PnlTiles';
import { PerformanceCard } from '@/components/dashboard/PerformanceCard';
import { OpenPositionsCard, type HoldingRow } from '@/components/dashboard/OpenPositionsCard';
import { TopMoversCard, type Mover } from '@/components/dashboard/TopMoversCard';
import { KycCard } from '@/components/dashboard/KycCard';
import { QuickLinksCard } from '@/components/dashboard/QuickLinksCard';
import { PanelCard } from '@/components/dashboard/PanelCard';

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
}

interface PortfolioSummary {
  total_balance: number;
  total_equity: number;
  total_unrealized_pnl: number;
  pnl_breakdown: PnlBreakdown;
  holdings: HoldingRow[];
  open_positions_count: number;
}

interface PerformanceData {
  equity_curve: Array<{ date: string; equity: number }>;
  stats: {
    total_return: number;
    max_drawdown: number;
    sharpe_ratio: number;
    win_rate: number;
    total_trades: number;
  };
}

interface PriceTick { symbol?: string; bid?: number; ask?: number; }
interface BarRow { time: number; open: number; close: number; }

const TOP_MOVER_SYMBOLS = ['XAUUSD', 'NAS100', 'BTCUSD', 'EURUSD'];

export default function DashboardPage() {
  return (
    <DashboardShell>
      <BrokerHome />
    </DashboardShell>
  );
}

function BrokerHome() {
  const user = useAuthStore((s) => s.user);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

  // Accounts + banners (unchanged data layer from the previous dashboard).
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
      } catch {
        // Accounts API unreachable: the cards fall back to their empty state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Portfolio + wallet overview — same endpoints the portfolio and wallet
  // pages already consume; each card degrades to a "—" state on failure.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, p, w] = await Promise.allSettled([
        api.get<PortfolioSummary>('/portfolio/summary'),
        api.get<PerformanceData>('/portfolio/performance'),
        api.get<WalletSummary>('/wallet/summary'),
      ]);
      if (cancelled) return;
      if (s.status === 'fulfilled') setSummary(s.value);
      if (p.status === 'fulfilled') setPerformance(p.value);
      if (w.status === 'fulfilled') setWallet(w.value);
    })();
    return () => { cancelled = true; };
  }, []);

  // Live top movers (unchanged computation from the previous dashboard):
  // daily bars give the day-open baseline once; /prices/all refreshes the
  // pct every 5s; bars reload hourly to pick up the new trading day.
  useEffect(() => {
    let cancelled = false;
    type BarsResp = { bars?: BarRow[] } | BarRow[] | null | undefined;
    const dayOpenBySymbol: Record<string, number> = {};
    const closeFallbackBySymbol: Record<string, number> = {};

    const loadBars = async () => {
      const barsRaw = await Promise.all(
        TOP_MOVER_SYMBOLS.map((s) =>
          api.get<BarsResp>(`/instruments/${s}/bars`, { resolution: '1D' }).catch(() => null as BarsResp),
        ),
      );
      if (cancelled) return;
      TOP_MOVER_SYMBOLS.forEach((sym, i) => {
        const resp = barsRaw[i];
        const bars: BarRow[] = Array.isArray(resp) ? resp : (resp?.bars ?? []);
        const dayBar = bars.length > 0 ? bars[bars.length - 1] : null;
        if (dayBar) {
          dayOpenBySymbol[sym] = Number(dayBar.open);
          closeFallbackBySymbol[sym] = Number(dayBar.close);
        }
      });
    };

    const recompute = async () => {
      try {
        const ticksRaw = await api.get<PriceTick[]>('/instruments/prices/all').catch(
          () => [] as PriceTick[],
        );
        if (cancelled) return;
        const tickMap = new Map<string, number>();
        for (const t of ticksRaw || []) {
          if (t?.symbol && t.bid && t.ask) tickMap.set(t.symbol.toUpperCase(), (t.bid + t.ask) / 2);
        }
        const out = TOP_MOVER_SYMBOLS.map((sym) => {
          const dayOpen = dayOpenBySymbol[sym];
          const price = tickMap.get(sym) ?? closeFallbackBySymbol[sym] ?? NaN;
          const pct = (Number.isFinite(dayOpen) && dayOpen > 0 && Number.isFinite(price))
            ? ((price - dayOpen) / dayOpen) * 100
            : 0;
          return { symbol: sym, pct, price };
        });
        setMovers(out);
      } catch { /* keep previous values on transient failure */ }
    };

    const timers: { priceTimer?: ReturnType<typeof setInterval>; barTimer?: ReturnType<typeof setInterval> } = {};
    (async () => {
      await loadBars();
      if (cancelled) return;
      await recompute();
      if (cancelled) return;
      timers.priceTimer = setInterval(() => { void recompute(); }, 5000);
      timers.barTimer = setInterval(() => { void loadBars(); }, 60 * 60 * 1000);
    })();

    return () => {
      cancelled = true;
      if (timers.priceTimer) clearInterval(timers.priceTimer);
      if (timers.barTimer) clearInterval(timers.barTimer);
    };
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeId) || accounts[0] || null,
    [accounts, activeId],
  );

  const today = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );

  return (
    <div className="space-y-5 pb-10 max-w-[1240px] mx-auto w-full">
      {/* Greeting. The reference leads with a large, light page title over
          a small date line, so the heading steps up from 20/24px and the
          date drops to a quiet caption above it. */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-semibold text-text-tertiary">{today}</p>
          <h1 className="mt-1 text-[26px] md:text-[34px] font-extrabold tracking-[-0.02em] leading-none text-text-primary">
            {user?.first_name ? `Hey, ${user.first_name} 👋` : 'Welcome back 👋'}
          </h1>
        </div>
        <Link
          href="/support"
          className="rounded-full px-3 py-1.5 text-[11px] font-bold text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          style={{ border: '1px solid var(--border-glass-bright)' }}
        >
          Need help? →
        </Link>
      </div>

      {banners.length > 0 && <BannerStrip banners={banners} />}
      <KycCard />

      <AccountHero
        accounts={accounts}
        active={activeAccount}
        onChangeAccount={setActiveId}
        loading={loading}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4"><MainWalletCard summary={wallet} /></div>
        <div className="lg:col-span-4"><PnlTiles pnl={summary?.pnl_breakdown ?? null} /></div>
        <div className="md:col-span-2 lg:col-span-4">
          <PerformanceCard
            totalEquity={summary ? summary.total_equity : null}
            curve={performance?.equity_curve ?? []}
            stats={performance?.stats ?? null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <OpenPositionsCard
            holdings={summary?.holdings ?? []}
            count={summary?.open_positions_count ?? 0}
          />
        </div>
        <div className="lg:col-span-5"><TopMoversCard movers={movers} /></div>
      </div>

      {/* BonusCard used to sit between these two. It advertised an "up to
          100% deposit bonus" that the platform no longer offers, so it is
          gone and the row splits evenly instead. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6"><InviteFriendsCard /></div>
        <div className="lg:col-span-6"><QuickLinksCard /></div>
      </div>
    </div>
  );
}

function InviteFriendsCard() {
  // Personal referral (every user has a code) — NOT the IB program.
  const [link, setLink] = useState<string>('');
  const [code, setCode] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ referral_code?: string | null }>('/business/referral/me')
      .then((d) => {
        if (cancelled) return;
        const c = (d.referral_code || '').trim();
        setCode(c);
        if (c && typeof window !== 'undefined') {
          setLink(`${window.location.origin}/auth/register?ref=${encodeURIComponent(c)}`);
        }
      })
      .catch(() => { /* card falls back to the static CTA */ });
    return () => { cancelled = true; };
  }, []);

  const onCopy = (value: string) => {
    try {
      navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed — please select the text manually');
    }
  };

  return (
    <PanelCard padding="lg" className="h-full">
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.10)' }}
        >
          <Users size={20} className="text-green-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-text-primary">Invite friends, earn together</h3>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
            Share your link — every trade your invitees make earns you commission for life.
          </p>
          {link ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 text-[10px] font-mono bg-bg-secondary border border-border-primary rounded-full px-3 py-1.5 text-text-primary outline-none focus:border-[#E12019]/40"
                />
                <button
                  type="button"
                  onClick={() => onCopy(link)}
                  className="shrink-0 px-3 py-1.5 text-[10px] font-extrabold rounded-full border border-[#E12019]/40 text-[#E12019] hover:bg-[#E12019]/10 transition-colors"
                >
                  Copy
                </button>
              </div>
              {code && (
                <p className="text-[10px] text-text-tertiary mt-2">
                  Code:{' '}
                  <button
                    type="button"
                    onClick={() => onCopy(code)}
                    className="text-[#E12019] font-mono font-bold cursor-pointer hover:underline"
                    title="Click to copy your referral code"
                  >
                    {code}
                  </button>
                </p>
              )}
            </>
          ) : (
            <Link
              href="/referral"
              className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-extrabold text-[#E12019] hover:underline"
            >
              Get your referral link <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </div>
    </PanelCard>
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
  // Fixed 5:1 aspect ratio everywhere a banner shows (dashboard + admin
  // preview list). Recommended upload size: 1500×300.
  return (
    <div className="relative w-full rounded-3xl overflow-hidden" style={{ border: '1px solid var(--border-glass-bright)' }}>
      <div className="relative w-full aspect-[5/1] bg-bg-secondary">
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
              style={{ background: i === index ? '#E12019' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
