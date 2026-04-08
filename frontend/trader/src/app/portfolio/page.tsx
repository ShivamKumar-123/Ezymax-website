'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';

import Link from 'next/link';

import { useSearchParams } from 'next/navigation';

import { clsx } from 'clsx';

import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';

import { Card, StatCard } from '@/components/ui/Card';

import { Tabs } from '@/components/ui/Tabs';

import DashboardShell from '@/components/layout/DashboardShell';

import TradingJournalSection from '@/components/profile/TradingJournalSection';

import { buildTradingJournalFromPortfolio } from '@/lib/trading-dashboard';

import api from '@/lib/api/client';

import { FileDown } from 'lucide-react';

import { downloadTradeStatementPdf } from '@/lib/pdf/tradeStatementPdf';



interface PortfolioSummary {

  total_balance: number;

  total_equity: number;

  total_unrealized_pnl: number;

  pnl_breakdown: {

    today: number;

    this_week: number;

    this_month: number;

    all_time: number;

  };

  holdings: Array<{

    symbol: string;

    side: string;

    lots: number;

    entry_price: number;

    current_price: number;

    pnl: number;

    pnl_pct: number;

  }>;

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

  monthly_breakdown: Array<{ month: string; pnl: number }>;

  symbol_breakdown: Array<{ symbol: string; pnl: number; trades: number }>;

}



interface Trade {

  id: string;

  symbol: string;

  side: string;

  lots: number;

  pnl: number;

  open_time: string;

  close_time: string;

  duration: string;

  entry_price: number;

  exit_price: number;

  close_reason?: string | null;

  /** API may send these (align with /portfolio/trades). */
  open_price?: number;

  close_price?: number;

  opened_at?: string;

  commission?: number;

  swap?: number;

}



function fmt(n: number) {

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

}

function tradeExitLabel(reason: string | null | undefined): { text: string; className: string } {

  const r = (reason || 'manual').toLowerCase();

  if (r === 'sl') return { text: 'Stop loss (SL)', className: 'text-sell bg-sell/10 border-sell/20' };

  if (r === 'tp') return { text: 'Take profit (TP)', className: 'text-buy bg-buy/10 border-buy/20' };

  if (r === 'manual') return { text: 'Manual close', className: 'text-text-tertiary bg-bg-hover border-border-glass' };

  if (r === 'copy_close' || r === 'copy') return { text: 'Copy close', className: 'text-info bg-info/10 border-info/20' };

  if (r === 'admin') return { text: 'Admin', className: 'text-warning bg-warning/10 border-warning/20' };

  return { text: r.replace(/_/g, ' '), className: 'text-text-secondary bg-bg-hover border-border-glass' };

}



const TIMEFRAMES = ['1M', '3M', '6M', '1Y', 'All'] as const;

const TF_TO_PERIOD: Record<string, string> = {

  '1M': '1m', '3M': '3m', '6M': '6m', '1Y': '1y', 'All': 'all',

};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseAccountId(raw: string | null): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();

  const validAccountId = useMemo(() => {
    return parseAccountId(new URLSearchParams(queryKey).get('account_id'));
  }, [queryKey]);

  const accountNoLabel = useMemo(() => {
    const v = new URLSearchParams(queryKey).get('account_no');
    return v?.trim() ? v.trim() : '';
  }, [queryKey]);

  const [tf, setTf] = useState('1M');

  const [tab, setTab] = useState('overview');

  const [page, setPage] = useState(1);



  const [summary, setSummary] = useState<PortfolioSummary | null>(null);

  const [performance, setPerformance] = useState<PerformanceData | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);

  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [pdfExporting, setPdfExporting] = useState(false);



  const fetchData = useCallback(async () => {

    try {

      setLoading(true);

      setError(null);

      const period = TF_TO_PERIOD[tf] || 'all';

      const summaryParams: Record<string, string> | undefined = validAccountId

        ? { account_id: validAccountId }

        : undefined;

      const perfParams: Record<string, string> = { period };

      if (validAccountId) perfParams.account_id = validAccountId;

      const [sumRes, perfRes] = await Promise.all([

        api.get<PortfolioSummary>('/portfolio/summary', summaryParams),

        api.get<PerformanceData>('/portfolio/performance', perfParams),

      ]);

      setSummary(sumRes);

      setPerformance(perfRes);

    } catch (err: unknown) {

      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to load portfolio';

      setError(msg);

      toast.error(msg);

    } finally {

      setLoading(false);

    }

  }, [tf, validAccountId]);



  const fetchTrades = useCallback(async (p: number) => {

    try {

      const params: Record<string, string> = { page: String(p), per_page: '50' };

      if (validAccountId) params.account_id = validAccountId;

      const res = await api.get<{ items: Trade[]; total: number; pages: number }>(

        '/portfolio/trades',

        params,

      );

      setTrades(res.items ?? []);

      setTotalPages(res.pages ?? 1);

    } catch (err: unknown) {

      toast.error(err instanceof Error ? err.message : 'Failed to load trades');

    }

  }, [validAccountId]);



  const handleDownloadTradeStatementPdf = useCallback(async () => {

    setPdfExporting(true);

    try {

      const all: Trade[] = [];

      let p = 1;

      let pages = 1;

      const perPage = 200;

      do {

        const params: Record<string, string> = {

          page: String(p),

          per_page: String(perPage),

        };

        if (validAccountId) params.account_id = validAccountId;

        const res = await api.get<{ items: Trade[]; pages: number }>(

          '/portfolio/trades',

          params,

        );

        all.push(...(res.items ?? []));

        pages = Math.max(1, res.pages ?? 1);

        p += 1;

      } while (p <= pages && p <= 50);

      if (all.length === 0) {

        toast.error('No trades to export');

        return;

      }

      await downloadTradeStatementPdf(

        all.map((t) => ({

          close_time: t.close_time,

          open_time: t.open_time ?? t.opened_at,

          opened_at: t.opened_at,

          symbol: t.symbol,

          side: t.side,

          lots: t.lots,

          open_price: t.open_price ?? t.entry_price,

          close_price: t.close_price ?? t.exit_price,

          entry_price: t.entry_price,

          exit_price: t.exit_price,

          pnl: t.pnl,

          close_reason: t.close_reason,

          commission: t.commission,

          swap: t.swap,

        })),

      );

      toast.success('Statement PDF downloaded');

    } catch (err: unknown) {

      toast.error(err instanceof Error ? err.message : 'Could not create PDF');

    } finally {

      setPdfExporting(false);

    }

  }, [validAccountId]);



  const rawAccountParam = useMemo(() => new URLSearchParams(queryKey).get('account_id'), [queryKey]);

  const invalidAccountParam = Boolean(rawAccountParam && !validAccountId);

  useEffect(() => {

    const t = new URLSearchParams(queryKey).get('tab');

    if (t === 'overview' || t === 'performance' || t === 'history') {

      setTab(t);

    } else {

      setTab('overview');

    }

  }, [queryKey]);

  useEffect(() => {

    setPage(1);

  }, [validAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => { if (tab === 'history') fetchTrades(page); }, [tab, page, fetchTrades]);



  const holdings = summary?.holdings ?? [];

  const stats = performance?.stats;

  const monthlies = performance?.monthly_breakdown ?? [];

  const equityCurve = performance?.equity_curve ?? [];

  const journalBlock = useMemo(() => {
    if (!summary) return null;
    const lotsOpen = (summary.holdings ?? []).reduce((a, h) => a + (Number(h.lots) || 0), 0);
    return buildTradingJournalFromPortfolio({
      balance: summary.total_balance,
      equity: summary.total_equity,
      allTimePnl: summary.pnl_breakdown?.all_time ?? 0,
      lotsFromOpenPositions: lotsOpen,
      totalTrades: performance?.stats?.total_trades ?? 0,
      winRate: performance?.stats?.win_rate ?? 0,
      sharpeRatio: performance?.stats?.sharpe_ratio ?? 0,
    });
  }, [summary, performance]);

  const tabs = [

    { id: 'overview', label: 'Overview', count: holdings.length },

    { id: 'performance', label: 'Performance' },

    { id: 'history', label: 'Trade History' },

  ];



  if (loading) {

    return (

      <DashboardShell mainClassName="flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-8 h-8 border-2 border-[#00e676] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#888]">Loading portfolio...</span>
        </div>
      </DashboardShell>

    );

  }



  if (error) {

    return (

      <DashboardShell mainClassName="flex items-center justify-center bg-[#050505]">
        <div className="text-center space-y-3 py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      </DashboardShell>

    );

  }



  const maxEquity = equityCurve.length > 0 ? Math.max(...equityCurve.map((e) => e.equity)) : 1;

  const minEquity = equityCurve.length > 0 ? Math.min(...equityCurve.map((e) => e.equity)) : 0;

  const equityRange = maxEquity - minEquity || 1;



  return (

    <DashboardShell mainClassName="bg-[#050505]">
      <div className="page-main space-y-4 sm:space-y-6 text-white">

        <h2 className="text-lg font-semibold text-zinc-200">
          {validAccountId ? 'Trading journal' : 'Portfolio'}
        </h2>

        {invalidAccountParam ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Invalid account id in the URL — showing your full portfolio.{' '}
            <Link href="/portfolio" className="font-semibold text-[#00e676] underline underline-offset-2 hover:text-[#00c853]">
              Reset
            </Link>
          </div>
        ) : null}

        {validAccountId ? (
          <div className="rounded-xl border border-[#00e676]/30 bg-[#00e676]/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#00e676]">Account scope</p>
              <p className="text-sm text-white mt-0.5">
                Journal and trade list for{' '}
                <span className="font-mono font-semibold">
                  {accountNoLabel ? `#${accountNoLabel}` : validAccountId.slice(0, 8) + '…'}
                </span>
              </p>
            </div>
            <Link
              href="/portfolio"
              className="text-xs font-semibold text-[#00e676] hover:text-[#00c853] underline underline-offset-2 shrink-0"
            >
              View all accounts
            </Link>
          </div>
        ) : null}

        {journalBlock ? (
          <div className="rounded-xl border border-[#252525] bg-[#0a0a0a] p-4 md:p-6">
            <TradingJournalSection journal={journalBlock} title="Trading Journal" />
          </div>
        ) : null}

        {/* Equity Curve */}

        <Card variant="glass" padding="none">

          <div className="flex items-center justify-between px-4 py-3 border-b border-border-glass">

            <h3 className="text-md font-semibold text-text-primary">Equity Curve</h3>

            <div className="flex gap-0.5">

              {TIMEFRAMES.map((t) => (

                <button

                  key={t}

                  onClick={() => setTf(t)}

                  className={clsx(

                    'px-2 py-1 text-[10px] rounded-md transition-all',

                    tf === t ? 'skeu-btn-buy text-text-inverse' : 'text-text-tertiary hover:bg-bg-hover',

                  )}

                >

                  {t}

                </button>

              ))}

            </div>

          </div>

          <div className="p-4 h-48 flex items-end gap-px">

            {equityCurve.length > 0 ? (

              equityCurve.map((point, i) => {

                const pct = ((point.equity - minEquity) / equityRange) * 100;

                return (

                  <div

                    key={i}

                    className="flex-1 bg-gradient-to-t from-buy/60 to-buy/20 rounded-t-sm transition-all hover:from-buy/80 hover:to-buy/40"

                    style={{ height: `${Math.max(pct, 2)}%` }}

                    title={`${new Date(point.date).toLocaleDateString()}: ${fmt(point.equity)}`}

                  />

                );

              })

            ) : (

              <div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">

                No equity data available

              </div>

            )}

          </div>

        </Card>



        {/* Stats Row */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">

          <StatCard label="Total Trades" value={stats ? String(stats.total_trades) : '0'} />

          <StatCard

            label="Total Return"

            value={stats ? `${stats.total_return >= 0 ? '+' : ''}${stats.total_return.toFixed(2)}%` : '—'}

            trend={stats && stats.total_return >= 0 ? 'up' : 'down'}

          />

          <StatCard

            label="Max Drawdown"

            value={stats ? `${stats.max_drawdown.toFixed(2)}%` : '—'}

            trend="down"

          />

          <StatCard

            label="P&L Today"

            value={`${(summary?.pnl_breakdown?.today ?? 0) >= 0 ? '+' : ''}${fmt(summary?.pnl_breakdown?.today ?? 0)}`}

            trend={(summary?.pnl_breakdown?.today ?? 0) >= 0 ? 'up' : 'down'}

          />

        </div>



        <div className="emboss-divider" />



        <Tabs tabs={tabs} active={tab} onChange={setTab} />



        {tab === 'overview' && (

          <Card variant="glass" padding="none">

            {/* Mobile card layout */}
            <div className="md:hidden p-2 space-y-2">
              {holdings.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">No open positions</div>
              ) : (
                holdings.map((h, i) => (
                  <div key={i} className="rounded-xl border border-border-glass/50 bg-bg-secondary/30 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{h.symbol}</span>
                        <span className={clsx('text-[10px] font-bold uppercase', h.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{h.side}</span>
                      </div>
                      <div className="text-right">
                        <span className={clsx('text-sm font-mono font-semibold tabular-nums', h.pnl >= 0 ? 'text-buy' : 'text-sell')}>
                          {h.pnl >= 0 ? '+' : ''}{fmt(h.pnl)}
                        </span>
                        {h.pnl_pct !== undefined && (
                          <span className={clsx('text-[10px] ml-1', h.pnl_pct >= 0 ? 'text-buy' : 'text-sell')}>
                            ({h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 text-[11px]">
                      <div><span className="text-text-tertiary">Lots</span> <span className="text-text-primary font-mono">{h.lots}</span></div>
                      <div><span className="text-text-tertiary">Entry</span> <span className="text-text-secondary font-mono">{h.entry_price}</span></div>
                      <div><span className="text-text-tertiary">Now</span> <span className="text-text-primary font-mono">{h.current_price}</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">

              <table className="w-full text-sm">

                <thead>

                  <tr className="border-b border-border-glass">

                    <th className="px-4 py-3 text-left text-xs text-text-tertiary font-medium">Symbol</th>

                    <th className="px-4 py-3 text-left text-xs text-text-tertiary font-medium">Side</th>

                    <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">Lots</th>

                    <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">Entry</th>

                    <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">Current</th>

                    <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">P&L</th>

                  </tr>

                </thead>

                <tbody>

                  {holdings.length === 0 ? (

                    <tr>

                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-tertiary">

                        No open positions

                      </td>

                    </tr>

                  ) : (

                    holdings.map((h, i) => (

                      <tr key={i} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-all">

                        <td className="px-4 py-3 text-text-primary text-xs font-semibold">{h.symbol}</td>

                        <td className="px-4 py-3">

                          <span className={clsx('text-xs font-medium', h.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>

                            {h.side}

                          </span>

                        </td>

                        <td className="px-4 py-3 text-right text-text-secondary text-xs font-mono">{h.lots}</td>

                        <td className="px-4 py-3 text-right text-text-secondary text-xs font-mono">{h.entry_price}</td>

                        <td className="px-4 py-3 text-right text-text-primary text-xs font-mono">{h.current_price}</td>

                        <td className="px-4 py-3 text-right">

                          <span className={clsx('text-xs font-mono font-semibold tabular-nums', h.pnl >= 0 ? 'text-buy' : 'text-sell')}>

                            {h.pnl >= 0 ? '+' : ''}{fmt(h.pnl)}

                          </span>

                          {h.pnl_pct !== undefined && (

                            <span className={clsx('text-[10px] ml-1', h.pnl_pct >= 0 ? 'text-buy' : 'text-sell')}>

                              ({h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct.toFixed(2)}%)

                            </span>

                          )}

                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          </Card>

        )}



        {tab === 'performance' && (

          <div className="space-y-6">

            <Card variant="glass" padding="none">

              <div className="px-4 py-3 border-b border-border-glass">

                <h3 className="text-md font-semibold text-text-primary">Monthly Breakdown</h3>

              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">

                {monthlies.length === 0 ? (

                  <div className="col-span-full text-center text-sm text-text-tertiary py-4">No monthly data</div>

                ) : (

                  monthlies.map((m) => {
                    const pnl = Number(m.pnl) || 0;
                    return (
                    <div

                      key={m.month}

                      className={clsx(

                        'rounded-lg p-3 text-center border',

                        pnl >= 0 ? 'border-buy/20 bg-buy/5' : 'border-sell/20 bg-sell/5',

                      )}

                    >

                      <div className="text-[10px] text-text-tertiary mb-1">{m.month}</div>

                      <div className={clsx('text-sm font-mono font-semibold tabular-nums', pnl >= 0 ? 'text-buy' : 'text-sell')}>

                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}

                      </div>

                    </div>
                    );
                  })

                )}

              </div>

            </Card>



            {performance?.symbol_breakdown && performance.symbol_breakdown.length > 0 && (

              <Card variant="glass" padding="none">

                <div className="px-4 py-3 border-b border-border-glass">

                  <h3 className="text-md font-semibold text-text-primary">Symbol Breakdown</h3>

                </div>

                <div className="p-4 space-y-2">

                  {performance.symbol_breakdown.map((s) => {
                    const sPnl = Number(s.pnl) || 0;
                    return (
                    <div key={s.symbol} className="flex items-center justify-between py-2 border-b border-border-glass/50">

                      <div>

                        <span className="text-sm font-medium text-text-primary">{s.symbol}</span>

                        <span className="text-xs text-text-tertiary ml-2">{s.trades} trades</span>

                      </div>

                      <span className={clsx('text-sm font-mono font-semibold tabular-nums', sPnl >= 0 ? 'text-buy' : 'text-sell')}>

                        {sPnl >= 0 ? '+' : ''}{fmt(sPnl)}

                      </span>

                    </div>
                    );
                  })}

                </div>

              </Card>

            )}

          </div>

        )}



        {tab === 'history' && (

          <>

            <Card variant="glass" padding="none">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-border-glass">

                <div>

                  <h3 className="text-md font-semibold text-text-primary">Trade history</h3>

                  <p className="text-[10px] text-text-tertiary mt-0.5">

                    PDF includes all closed trades on file (paginated fetch, up to 10,000 rows).

                  </p>

                </div>

                <Button

                  type="button"

                  variant="outline"

                  size="sm"

                  loading={pdfExporting}

                  disabled={pdfExporting}

                  onClick={() => void handleDownloadTradeStatementPdf()}

                  className="shrink-0 inline-flex items-center gap-2"

                >

                  <FileDown className="w-4 h-4" aria-hidden />

                  Download PDF statement

                </Button>

              </div>

              {/* Mobile card layout */}
              <div className="md:hidden p-2 space-y-2">
                {trades.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-text-tertiary">No trade history</div>
                ) : (
                  trades.map((t) => {
                    const ex = tradeExitLabel(t.close_reason);
                    return (
                      <div key={t.id} className="rounded-xl border border-border-glass/50 bg-bg-secondary/30 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text-primary">{t.symbol}</span>
                            <span className={clsx('text-[10px] font-bold uppercase', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{t.side}</span>
                            <span className={clsx('inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-md border', ex.className)}>{ex.text}</span>
                          </div>
                          <span className={clsx('text-sm font-mono font-semibold tabular-nums', t.pnl >= 0 ? 'text-buy' : 'text-sell')}>
                            {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-x-3 text-[11px]">
                          <div><span className="text-text-tertiary">Lots</span> <span className="text-text-primary font-mono">{t.lots}</span></div>
                          <div><span className="text-text-tertiary">Dur.</span> <span className="text-text-secondary">{t.duration ?? '—'}</span></div>
                          <div className="text-text-tertiary text-[10px]">{new Date(t.close_time || t.open_time).toLocaleDateString()}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block overflow-x-auto">

                <table className="w-full text-sm">

                  <thead>

                    <tr className="border-b border-border-glass">

                      <th className="px-4 py-3 text-left text-xs text-text-tertiary font-medium">Date</th>

                      <th className="px-4 py-3 text-left text-xs text-text-tertiary font-medium">Symbol</th>

                      <th className="px-4 py-3 text-left text-xs text-text-tertiary font-medium">Side</th>

                      <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">Lots</th>

                      <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">Duration</th>

                      <th className="px-4 py-3 text-left text-xs text-text-tertiary font-medium">Exit</th>

                      <th className="px-4 py-3 text-right text-xs text-text-tertiary font-medium">P&L</th>

                    </tr>

                  </thead>

                  <tbody>

                    {trades.length === 0 ? (

                      <tr>

                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-tertiary">

                          No trade history

                        </td>

                      </tr>

                    ) : (

                      trades.map((t) => (

                        <tr key={t.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-all">

                          <td className="px-4 py-3 text-text-secondary text-xs">

                            {new Date(t.close_time || t.open_time).toLocaleString()}

                          </td>

                          <td className="px-4 py-3 text-text-primary text-xs font-semibold">{t.symbol}</td>

                          <td className="px-4 py-3">

                            <span className={clsx('text-xs font-medium', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>

                              {t.side}

                            </span>

                          </td>

                          <td className="px-4 py-3 text-right text-text-secondary text-xs font-mono">{t.lots}</td>

                          <td className="px-4 py-3 text-right text-text-tertiary text-xs">{t.duration ?? '—'}</td>

                          <td className="px-4 py-3">
                            {(() => {
                              const ex = tradeExitLabel(t.close_reason);
                              return (
                                <span className={clsx('inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md border', ex.className)}>
                                  {ex.text}
                                </span>
                              );
                            })()}
                          </td>

                          <td className="px-4 py-3 text-right">

                            <span className={clsx('text-xs font-mono font-semibold tabular-nums', t.pnl >= 0 ? 'text-buy' : 'text-sell')}>

                              {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}

                            </span>

                          </td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

            </Card>

            {totalPages > 1 && (

              <div className="flex items-center justify-center gap-2">

                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>

                  ← Prev

                </Button>

                <span className="text-xs text-text-tertiary">Page {page} of {totalPages}</span>

                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>

                  Next →

                </Button>

              </div>

            )}

          </>

        )}

      </div>

    </DashboardShell>

  );

}

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={(
        <DashboardShell mainClassName="flex items-center justify-center bg-[#050505]">
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-8 h-8 border-2 border-[#00e676] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#888]">Loading portfolio...</span>
          </div>
        </DashboardShell>
      )}
    >
      <PortfolioPageContent />
    </Suspense>
  );
}
