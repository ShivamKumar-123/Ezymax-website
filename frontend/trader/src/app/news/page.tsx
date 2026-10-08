'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { Calendar, ChevronLeft, Loader2, Radio, Newspaper } from 'lucide-react';
import { clsx } from 'clsx';

const TradingViewNewsTimeline = dynamic(
  () => import('@/components/charts/TradingViewNewsTimeline'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[480px] flex items-center justify-center bg-bg-secondary border-t border-border-primary">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
      </div>
    ),
  },
);

const TradingViewEventsCalendar = dynamic(
  () => import('@/components/charts/TradingViewEventsCalendar'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[520px] flex items-center justify-center bg-bg-secondary">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
      </div>
    ),
  },
);

const LIVE_SYMBOL_OPTIONS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'US500'] as const;

type NewsMainTab = 'calendar' | 'live';

export default function EconomicNewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<NewsMainTab>('calendar');
  const [liveSymbol, setLiveSymbol] = useState<string>('EURUSD');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'live') setMainTab('live');
    if (t === 'calendar') setMainTab('calendar');
  }, [searchParams]);

  const setMainTabAndUrl = useCallback(
    (tab: NewsMainTab) => {
      setMainTab(tab);
      router.replace(tab === 'live' ? '/news?tab=live' : '/news', { scroll: false });
    },
    [router],
  );

  const mainTabIndex = mainTab === 'calendar' ? 0 : 1;

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 text-text-primary">
          <section
            className="relative overflow-hidden rounded-2xl border mb-4 sm:mb-5"
            style={{
              background:
                'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.10), transparent 55%), var(--bg-card)',
              borderColor: 'rgba(255,106,0,0.16)',
              boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
            }}
          >
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
              style={{ background: 'linear-gradient(180deg, #FFB380, #FF6A00 55%, #C2410C)', boxShadow: '0 0 14px rgba(255,106,0,0.5)' }}
            />
            <div className="relative z-10 px-4 sm:px-6 py-4 sm:py-6 pl-5 sm:pl-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
                  aria-label="Go back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.25)' }}
                >
                  <Newspaper className="w-5 h-5 text-[#FF6A00]" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-text-primary">Economic News</h1>
                  <p className="text-sm text-text-tertiary">Live calendar &amp; headlines via TradingView</p>
                </div>
              </div>
              {/* Impact legend chips */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/12 text-red-400 border border-red-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> High
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Medium
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#FF6A00]/12 text-[#FF6A00] border border-[#FF6A00]/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00]" /> Low
                </span>
              </div>
            </div>
          </section>

          <div className="overflow-hidden rounded-xl border border-border-primary bg-card">
            <div className="relative flex min-h-[52px] border-b border-border-primary bg-card">
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                <div
                  className="absolute top-0 h-full w-1/2 transition-[transform] duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] will-change-transform"
                  style={{ transform: `translate3d(${mainTabIndex * 100}%,0,0)` }}
                >
                  <div
                    className={clsx(
                      'absolute inset-x-1 top-0 h-full rounded-t-2xl border-2 border-b-0 border-accent bg-card-nested',
                      'animate-wallet-main-tab-glow',
                    )}
                  />
                </div>
              </div>
              {(
                [
                  { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
                  { id: 'live' as const, label: 'Live News', icon: Radio },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = mainTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMainTabAndUrl(id)}
                    className={clsx(
                      'relative z-10 flex-1 min-w-0 border-0 bg-transparent py-3.5 px-2 text-xs sm:text-sm font-semibold outline-none inline-flex items-center justify-center gap-2',
                      'transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50',
                      active ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {active ? (
                      <span className="relative inline-block animate-wallet-main-tab-text drop-shadow-[0_0_20px_rgba(255,106,0,0.7)]">
                        {label}
                      </span>
                    ) : (
                      <span className="relative inline-block truncate">{label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              key={mainTab}
              className={clsx(
                'animate-wallet-fund-enter-lg bg-card-nested',
              )}
            >
              {mainTab === 'live' ? (
                <div className="overflow-hidden border-t border-border-primary">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-border-primary bg-card">
                    <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                      <span className="font-mono text-lg font-bold text-text-primary tracking-tight">{liveSymbol}</span>
                      <span className="text-sm text-text-secondary">Top Stories</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-text-secondary shrink-0">
                      <span className="text-text-tertiary whitespace-nowrap">Symbol</span>
                      <select
                        value={liveSymbol}
                        onChange={(e) => setLiveSymbol(e.target.value)}
                        className="accounts-native-select rounded-xl py-2 pl-3 pr-8 text-sm font-mono min-w-[9rem] cursor-pointer border-border-primary bg-bg-secondary"
                      >
                        {LIVE_SYMBOL_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="h-[min(72vh,820px)] min-h-[520px] bg-bg-secondary">
                    <TradingViewNewsTimeline
                      symbolOverride={liveSymbol}
                      hideChrome
                      useDarkEmbed={false}
                      className="h-full min-h-[520px]"
                    />
                  </div>
                  <div className="px-4 py-2.5 border-t border-border-primary bg-card">
                    <p className="text-center text-[11px] text-text-secondary leading-relaxed">
                      Live headlines via{' '}
                      <a
                        href="https://www.tradingview.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline font-medium"
                      >
                        TradingView
                      </a>
                      . Not investment advice.
                    </p>
                  </div>
                </div>
              ) : null}

              {mainTab === 'calendar' ? (
                <div className="overflow-hidden border-t border-border-primary">
                  <div className="flex items-start gap-3 px-4 py-3 border-b border-border-primary bg-card">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,106,0,0.10)' }}>
                      <Calendar className="w-4 h-4 text-[#FF6A00]" />
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Live economic events from TradingView. Use the widget&apos;s built-in filters to pick
                      timezone, importance, and date range.
                    </p>
                  </div>
                  <div className="h-[min(78vh,900px)] min-h-[560px] bg-bg-secondary">
                    <TradingViewEventsCalendar className="h-full min-h-[560px]" />
                  </div>
                  <div className="px-4 py-2.5 border-t border-border-primary bg-card">
                    <p className="text-center text-[11px] text-text-secondary leading-relaxed">
                      Calendar data via{' '}
                      <a
                        href="https://www.tradingview.com/economic-calendar/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline font-medium"
                      >
                        TradingView
                      </a>
                      . Not investment advice.{' '}
                      <Link href="/wallet" className="text-text-tertiary hover:text-accent">
                        Deposit / Withdraw
                      </Link>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
