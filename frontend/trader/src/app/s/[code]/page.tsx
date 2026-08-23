'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ShareTradeCard from '@/components/trading/ShareTradeCard';
import SharePortfolioCard from '@/components/trading/SharePortfolioCard';
import { getApiBase } from '@/lib/api/client';

interface ShareSummaryData {
  total_pnl: number;
  total_trades: number;
  open_count: number;
  closed_count: number;
  wins: number;
  losses: number;
  win_rate: number;
  roi_pct: number;
  ticks: number;
  best_pnl: number;
  worst_pnl: number;
}

interface SharedTradeRow {
  id: string;
  status: 'active' | 'closed';
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price: number;
  pnl: number;
  roi_pct: number;
  ticks: number;
  pip_size: number;
  opened_at: string | null;
  closed_at: string | null;
}

/** Account-wide link: "all open positions" or "entire trade history". */
interface SharedPortfolioData {
  short_code: string;
  scope: 'open' | 'history';
  is_live: boolean;
  leverage: number;
  summary: ShareSummaryData;
  trades: SharedTradeRow[];
  truncated: boolean;
  description: string | null;
  link_description: string | null;
  display_mode: 'pnl' | 'roi' | 'ticks';
  expires_at: string;
}

interface SharedTradeData {
  short_code: string;
  scope?: 'single';
  status: 'active' | 'closed';
  is_live: boolean;
  symbol: string;
  side: string;
  lots: number;
  leverage: number;
  open_price: number;
  current_price: number;
  pnl: number;
  roi_pct: number;
  ticks: number;
  pip_size: number;
  description: string | null;
  link_description: string | null;
  display_mode: 'pnl' | 'roi' | 'ticks';
  opened_at: string | null;
  closed_at: string | null;
  expires_at: string;
}

type SharedPayload = SharedTradeData | SharedPortfolioData;

function isPortfolio(d: SharedPayload): d is SharedPortfolioData {
  return d.scope === 'open' || d.scope === 'history';
}

function money(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

function signed(n: number, render: (v: number) => string): string {
  return `${n >= 0 ? '+' : '-'}${render(n)}`;
}

export default function SharedTradePage() {
  const params = useParams();
  const code = Array.isArray(params?.code) ? params.code[0] : (params?.code as string);
  const [data, setData] = useState<SharedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // A history link with nothing open can never change between polls, so it
  // stops re-fetching instead of hitting the API every 3s forever.
  const staticRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    let alive = true;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`${getApiBase()}/public/share/${code}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (alive) setError(body?.detail || `Error ${res.status}`);
          return;
        }
        const body = (await res.json()) as SharedPayload;
        if (alive) {
          staticRef.current = isPortfolio(body) && !body.is_live;
          setData(body);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchOnce();
    pollingRef.current = setInterval(() => {
      if (staticRef.current) return;
      void fetchOnce();
    }, 3000);

    return () => {
      alive = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [code]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(30, 64, 175, 0.25) 0%, rgba(5, 7, 20, 1) 50%, #000 100%)',
      }}
    >
      {/* Header logo */}
      <div className="flex items-center gap-2 mb-8">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 6V12C3 17.5 6.8 22.3 12 23C17.2 22.3 21 17.5 21 12V6L12 2Z" stroke="white" strokeWidth="1.6" fill="none" />
          <path d="M9 12L11 14L15 10" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-white text-sm font-bold tracking-[0.25em]">SWISSCRESTA</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading shared trade…</span>
        </div>
      ) : error || !data ? (
        <div className="max-w-md text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">Unable to load trade</p>
          <p className="text-white/60 text-sm">{error || 'This link may have expired or been removed.'}</p>
        </div>
      ) : (
        <>
          <div className="w-full max-w-sm md:max-w-md">
            {isPortfolio(data) ? (
              <SharePortfolioCard
                scope={data.scope}
                summary={data.summary}
                displayMode={data.display_mode}
                shortUrl={typeof window !== 'undefined' ? window.location.href : ''}
              />
            ) : (
              <ShareTradeCard
                symbol={data.symbol}
                side={data.side}
                lots={data.lots}
                leverage={data.leverage}
                openPrice={data.open_price}
                currentPrice={data.current_price}
                pnl={data.pnl}
                openedAt={data.opened_at}
                closedAt={data.closed_at}
                displayMode={data.display_mode}
                pipSize={data.pip_size}
                status={data.status}
                shortUrl={typeof window !== 'undefined' ? window.location.href : ''}
                roiPct={data.roi_pct}
                ticks={data.ticks}
              />
            )}
          </div>

          {isPortfolio(data) && (
            <div className="w-full max-w-3xl mt-6">
              {/* Headline figures, then the trades behind them. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Total P&L',
                    value: signed(data.summary.total_pnl, money),
                    tone: data.summary.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400',
                  },
                  { label: 'Trades', value: String(data.summary.total_trades), tone: 'text-white' },
                  { label: 'Win rate', value: `${data.summary.win_rate.toFixed(0)}%`, tone: 'text-white' },
                  {
                    label: 'ROI',
                    value: signed(data.summary.roi_pct, (v) => `${Math.abs(v).toFixed(2)}%`),
                    tone: data.summary.roi_pct >= 0 ? 'text-emerald-400' : 'text-red-400',
                  },
                ].map((stat) => (
                  <div key={stat.label} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className={`text-lg font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <p className="text-white/90 text-sm font-semibold">
                    {data.scope === 'open' ? 'Open positions' : 'All trades'}
                  </p>
                  {data.is_live && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>

                {/* Wide table scrolls inside its own box so the page body
                    never scrolls sideways on a phone. */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-white/50 text-[10px] uppercase tracking-wider">
                        <th className="text-left font-semibold px-4 py-2">Symbol</th>
                        <th className="text-left font-semibold px-2 py-2">Side</th>
                        <th className="text-right font-semibold px-2 py-2">Lots</th>
                        <th className="text-right font-semibold px-2 py-2">Entry</th>
                        <th className="text-right font-semibold px-2 py-2">
                          {data.scope === 'open' ? 'Now' : 'Exit'}
                        </th>
                        <th className="text-right font-semibold px-4 py-2">
                          {data.display_mode === 'roi' ? 'ROI' : data.display_mode === 'ticks' ? 'Ticks' : 'P&L'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((t) => {
                        const digits = t.symbol?.toUpperCase().endsWith('JPY') ? 3 : 5;
                        const value =
                          data.display_mode === 'roi'
                            ? signed(t.roi_pct, (v) => `${Math.abs(v).toFixed(2)}%`)
                            : data.display_mode === 'ticks'
                              ? signed(t.ticks, (v) => Math.abs(v).toFixed(1))
                              : signed(t.pnl, money);
                        const tone =
                          (data.display_mode === 'ticks' ? t.ticks : t.pnl) >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400';
                        return (
                          <tr key={t.id} className="border-t border-white/5">
                            <td className="px-4 py-2 text-white font-semibold whitespace-nowrap">
                              {t.symbol}
                              {t.status === 'active' && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  Open
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  t.side.toLowerCase() === 'buy'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/15 text-red-400'
                                }`}
                              >
                                {t.side}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right text-white/80 tabular-nums">{t.lots.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right text-white/80 tabular-nums">
                              {t.open_price.toFixed(digits)}
                            </td>
                            <td className="px-2 py-2 text-right text-white/80 tabular-nums">
                              {t.current_price.toFixed(digits)}
                            </td>
                            <td className={`px-4 py-2 text-right font-bold tabular-nums ${tone}`}>{value}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {data.truncated && (
                  <p className="px-4 py-3 text-[11px] text-white/50 border-t border-white/10">
                    Totals above cover every trade. The list shows the most recent {data.trades.length}.
                  </p>
                )}
              </div>
            </div>
          )}

          {data.description && (
            <div className="w-full max-w-sm md:max-w-md mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/90 text-sm leading-relaxed">{data.description}</p>
            </div>
          )}

          {data.link_description && (
            <div className="w-full max-w-sm md:max-w-md mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/70 text-xs mb-1 uppercase tracking-wider">Creator links</p>
              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap break-words">{data.link_description}</p>
            </div>
          )}

          <p className="text-white/40 text-xs mt-10">SwissCresta © {new Date().getFullYear()}. All rights reserved.</p>
        </>
      )}
    </div>
  );
}
