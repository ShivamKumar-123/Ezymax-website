'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { TERMINAL_RESIZE, maxBottomPanelHeightPx } from '@/lib/terminalLayout';
import PanelResizeHandle from '@/components/trading/PanelResizeHandle';
import { useTradingStore, InstrumentInfo } from '@/stores/tradingStore';
import toast from 'react-hot-toast';
import { sounds, unlockAudio } from '@/lib/sounds';
import { getMarketStatus } from '@/lib/marketHours';
import { setPersistedTradingAccountId, tradingTerminalUrl } from '@/lib/tradingNav';
import Watchlist from '@/components/trading/Watchlist';
import OrderPanel from '@/components/trading/OrderPanel';
import PositionsPanel from '@/components/trading/PositionsPanel';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';
import TerminalLeftRail, { type TerminalSpaceId } from '@/components/trading/TerminalLeftRail';

const TradingViewChart = dynamic(() => import('@/components/charts/TradingViewChart'), { ssr: false });
const TradingViewNewsTimeline = dynamic(() => import('@/components/charts/TradingViewNewsTimeline'), {
  ssr: false,
});

const ORDER_MIN = 250;
const ORDER_MAX = 560;
const BOTTOM_MIN = 160;

export default function TradingTerminalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const {
    orderPanelWidth,
    bottomPanelHeight,
    terminalMarketsOpen,
    terminalNewsOpen,
    setTerminalMarketsOpen,
    setTerminalNewsOpen,
    setOrderPanelWidth,
    setBottomPanelHeight,
    toggleTerminalMarkets,
  } = useUIStore();

  const [opW, setOpW] = useState(orderPanelWidth);
  const [bpH, setBpH] = useState(bottomPanelHeight);
  const [isMobile, setIsMobile] = useState(false);

  /** Snapshot at pointer-down: stable clamps while store updates mid-drag. */
  const layoutDragStartRef = useRef({ op: 0, bp: 0, vw: 0, colH: 0 });
  const centerColumnRef = useRef<HTMLDivElement>(null);
  const bottomRestoreRef = useRef(320);
  const [activeSpace, setActiveSpace] = useState<TerminalSpaceId>('balanced');
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);

  const snapshotLayout = useCallback(() => {
    const s = useUIStore.getState();
    const rect = centerColumnRef.current?.getBoundingClientRect();
    const col =
      rect?.height ??
      (typeof window !== 'undefined' ? window.innerHeight - 8 : 0);
    layoutDragStartRef.current = {
      op: s.orderPanelWidth,
      bp: s.bottomPanelHeight,
      vw: typeof window !== 'undefined' ? window.innerWidth : 0,
      colH: Math.max(120, col),
    };
  }, []);

  /** Between chart and order+markets rail: drag right widens the rail. */
  const onChartRailDrag = useCallback(
    (dx: number) => {
      const { op, vw } = layoutDragStartRef.current;
      const maxOp = Math.min(
        ORDER_MAX,
        vw - TERMINAL_RESIZE.handlesSlack - TERMINAL_RESIZE.chartMinWidth,
      );
      const next = Math.max(ORDER_MIN, Math.min(maxOp, op + dx));
      setOpW(next);
      setOrderPanelWidth(next);
    },
    [setOrderPanelWidth],
  );

  const onBottomDrag = useCallback(
    (dy: number) => {
      const { bp, colH } = layoutDragStartRef.current;
      const maxBp = maxBottomPanelHeightPx(colH);
      const next = Math.max(BOTTOM_MIN, Math.min(maxBp, bp - dy));
      setBpH(next);
      setBottomPanelHeight(next);
    },
    [setBottomPanelHeight],
  );

  useEffect(() => {
    setOpW(orderPanelWidth);
  }, [orderPanelWidth]);

  useEffect(() => {
    setBpH(bottomPanelHeight);
  }, [bottomPanelHeight]);

  useEffect(() => {
    if (!bottomCollapsed) bottomRestoreRef.current = bottomPanelHeight;
  }, [bottomPanelHeight, bottomCollapsed]);

  const applySpace = useCallback(
    (id: TerminalSpaceId) => {
      setActiveSpace(id);
      setBottomCollapsed(false);
      if (id === 'balanced') {
        setOrderPanelWidth(340);
        setOpW(340);
        setBottomPanelHeight(320);
        setBpH(320);
      } else if (id === 'chart') {
        setOrderPanelWidth(ORDER_MIN);
        setOpW(ORDER_MIN);
        setBottomPanelHeight(200);
        setBpH(200);
      } else {
        setOrderPanelWidth(480);
        setOpW(480);
        setBottomPanelHeight(360);
        setBpH(360);
      }
    },
    [setOrderPanelWidth, setBottomPanelHeight],
  );

  const onToggleBottomPanel = useCallback(() => {
    const s = useUIStore.getState();
    if (bottomCollapsed) {
      const h = Math.max(BOTTOM_MIN, bottomRestoreRef.current);
      setBottomPanelHeight(h);
      setBpH(h);
      setBottomCollapsed(false);
    } else {
      bottomRestoreRef.current = s.bottomPanelHeight;
      setBottomPanelHeight(BOTTOM_MIN);
      setBpH(BOTTOM_MIN);
      setBottomCollapsed(true);
    }
  }, [bottomCollapsed, setBottomPanelHeight]);

  const onFocusSymbolSearch = useCallback(() => {
    setTerminalNewsOpen(false);
    setTerminalMarketsOpen(true);
    setChartExpanded(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('[data-terminal-symbol-search]')?.focus();
      });
    });
  }, [setTerminalMarketsOpen, setTerminalNewsOpen]);

  const onPanelsSelectMarkets = useCallback(() => {
    setTerminalNewsOpen(false);
    setChartExpanded(false);
    setTerminalMarketsOpen(true);
  }, [setTerminalMarketsOpen, setTerminalNewsOpen]);

  const onPanelsSelectOrder = useCallback(() => {
    setTerminalNewsOpen(false);
    setChartExpanded(false);
    setTerminalMarketsOpen(false);
  }, [setTerminalMarketsOpen, setTerminalNewsOpen]);

  const onExpandFullChartFromRail = useCallback(() => {
    setTerminalNewsOpen(false);
    setTerminalMarketsOpen(false);
    setChartExpanded(true);
  }, [setTerminalMarketsOpen, setTerminalNewsOpen]);

  const onPanelsSelectNews = useCallback(() => {
    setChartExpanded(false);
    setTerminalNewsOpen(true);
  }, [setTerminalNewsOpen]);
  const [lotSize, setLotSize] = useState('0.01');
  const [chartTabs, setChartTabs] = useState<string[]>([]);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const {
    selectedSymbol,
    prices,
    instruments,
    setSelectedSymbol,
    activeAccount,
    placeOrder,
  } = useTradingStore();

  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === selectedSymbol);
  const mobileMarketStatus = getMarketStatus(selectedSymbol, (instrumentInfo as any)?.segment);
  /** Default `chart` so Trade opens chart + buy/sell (not symbol list only). Watchlist tab still passes view=watchlist. */
  const mobileView = searchParams.get('view') || 'chart';

  useEffect(() => {
    if (accountId) setPersistedTradingAccountId(accountId);
  }, [accountId]);

  useEffect(() => {
    if (!accountId) router.replace('/trading');
  }, [accountId, router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!chartExpanded || !isMobile) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [chartExpanded, isMobile]);

  useEffect(() => {
    if (!chartExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChartExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartExpanded]);

  // Sync selected symbol with tabs — use functional update to avoid stale closure duplicates
  useEffect(() => {
    if (selectedSymbol) {
      setChartTabs(prev => prev.includes(selectedSymbol) ? prev : [...prev, selectedSymbol]);
    }
  }, [selectedSymbol]);

  const removeTab = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const nextTabs = chartTabs.filter(s => s !== symbol);
    setChartTabs(nextTabs);
    if (selectedSymbol === symbol && nextTabs.length > 0) {
      setSelectedSymbol(nextTabs[nextTabs.length - 1]);
    }
  };

  if (!accountId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary min-h-0">
        <p className="text-sm text-text-tertiary">Choose an account to trade…</p>
      </div>
    );
  }

  if (isMobile) {
    const digits = instruments.find((i: InstrumentInfo) => i.symbol === selectedSymbol)?.digits ?? 5;
    const price = prices[selectedSymbol];

    const handleLotChange = (val: number) => {
      const current = parseFloat(lotSize) || 0;
      const next = Math.max(0.01, +(current + val).toFixed(2));
      setLotSize(next.toFixed(2));
    };

    const placeMarketOrder = async (side: 'buy' | 'sell') => {
      unlockAudio();
      if (!activeAccount) {
        toast.error('No account selected');
        return;
      }
      if (!mobileMarketStatus.isOpen) {
        toast.error(mobileMarketStatus.reason || 'Market is closed');
        return;
      }
      if (!selectedSymbol?.trim()) {
        toast.error('Select a symbol');
        return;
      }
      const lots = parseFloat(lotSize);
      if (!Number.isFinite(lots) || lots <= 0) {
        toast.error('Invalid lot size');
        return;
      }
      setOrderSubmitting(true);
      try {
        await placeOrder({
          account_id: activeAccount.id,
          symbol: selectedSymbol,
          side,
          order_type: 'market',
          lots,
        });
        sounds.orderPlaced();
        toast.success(`${side.toUpperCase()} ${lotSize} ${selectedSymbol}`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Order failed');
      } finally {
        setOrderSubmitting(false);
      }
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          {mobileView === 'watchlist' && <Watchlist />}
          {mobileView === 'news' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-bg-primary">
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border-glass bg-bg-secondary">
                <button
                  type="button"
                  onClick={() => router.push(tradingTerminalUrl(accountId, { view: 'chart' }))}
                  className="text-xs font-semibold text-buy"
                >
                  ← Chart
                </button>
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Live news</span>
                <span className="w-14" aria-hidden />
              </div>
              <div className="flex-1 min-h-0">
                <TradingViewNewsTimeline />
              </div>
            </div>
          )}
          {mobileView === 'chart' && (
            <div className="h-full flex flex-col min-h-0">
              {/* Dynamic Chart Tabs Header */}
              {!chartExpanded ? (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border-b border-border-glass overflow-x-auto no-scrollbar scrollbar-none">
                {chartTabs.map((symbol) => (
                  <button
                    key={symbol}
                    onClick={() => setSelectedSymbol(symbol)}
                    className={clsx(
                      'px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all border whitespace-nowrap flex items-center gap-2 group',
                      symbol === selectedSymbol
                        ? 'bg-bg-primary text-text-primary border-border-glass shadow-sm'
                        : 'bg-transparent text-text-tertiary border-transparent hover:text-text-primary'
                    )}
                  >
                    {symbol}
                    <div
                      onClick={(e) => removeTab(e, symbol)}
                      className="p-0.5 rounded-md hover:bg-sell/10 hover:text-sell transition-colors opacity-60 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => router.push(tradingTerminalUrl(accountId, { view: 'watchlist' }))}
                  className="shrink-0 w-10 h-[34px] flex items-center justify-center rounded-xl bg-bg-hover/80 text-text-primary border border-border-glass hover:bg-buy/10 transition-all active:scale-95"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(tradingTerminalUrl(accountId, { view: 'news' }))}
                  className="shrink-0 px-3 h-[34px] rounded-xl bg-bg-hover/80 text-text-primary border border-border-glass text-[10px] font-extrabold uppercase tracking-wide hover:bg-buy/10 transition-all active:scale-95"
                >
                  News
                </button>
              </div>
              ) : null}

              {!chartExpanded && activeAccount ? (
                <div className="sm:hidden shrink-0 px-3 py-1.5 border-b border-border-glass bg-bg-secondary/40">
                  <ActiveAccountBadge account={activeAccount} variant="compact" />
                </div>
              ) : null}

              <div
                className={clsx(
                  'flex flex-col flex-1 min-h-0 overflow-hidden bg-bg-primary',
                  chartExpanded &&
                    'fixed inset-0 z-[100] h-[100dvh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
                )}
              >
                {chartExpanded ? (
                  <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border-glass bg-bg-secondary">
                    <span className="text-sm font-bold text-text-primary truncate">{selectedSymbol || 'Chart'}</span>
                    <button
                      type="button"
                      onClick={() => setChartExpanded(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border-glass hover:bg-bg-hover hover:text-text-primary"
                    >
                      <Minimize2 className="w-4 h-4 shrink-0" aria-hidden />
                      Close
                    </button>
                  </div>
                ) : null}
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
                  <TradingViewChart />
                </div>
                <div className="shrink-0 flex items-center justify-end gap-2 px-2 py-1.5 border-t border-border-glass bg-bg-secondary/90">
                  <button
                    type="button"
                    onClick={() => setChartExpanded((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border-glass hover:bg-buy/10 hover:text-buy hover:border-buy/30 transition-colors"
                  >
                    {chartExpanded ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        Normal view
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        Expand chart
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Refined Quick Trade Bottom Bar */}
              <div className="fixed bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom,0px)))] left-0 right-0 p-3 bg-bg-secondary/95 backdrop-blur-xl border-t border-border-glass z-50">
                {!mobileMarketStatus.isOpen && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sell/10 border border-sell/20">
                    <span className="text-[9px] font-bold text-sell uppercase tracking-wider">● CLOSED</span>
                    <span className="text-[10px] text-sell/80 truncate">{mobileMarketStatus.reason}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 h-[52px]">
                   {/* SELL button */}
                   <button
                     type="button"
                     disabled={orderSubmitting || !mobileMarketStatus.isOpen}
                     onClick={() => placeMarketOrder('sell')}
                     className="flex-1 h-full bg-sell rounded-xl flex flex-col items-center justify-center shadow-lg shadow-sell/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none min-w-0"
                   >
                     <span className="text-white text-[14px] font-black uppercase tracking-[0.05em]">Sell</span>
                     <span className="text-white/70 text-[10px] font-mono font-bold leading-tight">{price?.bid.toFixed(digits) || '--'}</span>
                   </button>

                   {/* Lot size controls — center */}
                   <div className="shrink-0 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider leading-none mb-1">Lots</span>
                      <div className="flex items-center gap-1">
                         <button
                           onClick={() => handleLotChange(-0.01)}
                           className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-primary border border-border-glass text-text-primary active:scale-90 transition-transform"
                         >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/></svg>
                         </button>
                         <input
                           type="text"
                           inputMode="decimal"
                           value={lotSize}
                           onChange={(e) => {
                             const v = e.target.value;
                             if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setLotSize(v);
                           }}
                           onBlur={() => {
                             const n = parseFloat(lotSize);
                             if (!Number.isFinite(n) || n <= 0) setLotSize('0.01');
                             else setLotSize(n.toFixed(2));
                           }}
                           className="w-16 h-9 text-[15px] font-black font-mono text-center bg-bg-primary border-2 border-border-glass rounded-lg text-text-primary outline-none"
                         />
                         <button
                           onClick={() => handleLotChange(0.01)}
                           className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-primary border border-border-glass text-text-primary active:scale-90 transition-transform"
                         >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                         </button>
                      </div>
                   </div>

                   {/* BUY button */}
                   <button
                     type="button"
                     disabled={orderSubmitting || !mobileMarketStatus.isOpen}
                     onClick={() => placeMarketOrder('buy')}
                     className="flex-1 h-full bg-buy rounded-xl flex flex-col items-center justify-center shadow-lg shadow-buy/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none min-w-0"
                   >
                     <span className="text-white text-[14px] font-black uppercase tracking-[0.05em]">Buy</span>
                     <span className="text-white/70 text-[10px] font-mono font-bold leading-tight">{price?.ask.toFixed(digits) || '--'}</span>
                   </button>
                </div>
              </div>
            </div>
          )}
          {mobileView === 'order' && <PositionsPanel />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 relative bg-bg-base pt-[env(safe-area-inset-top,0px)]">
      <TerminalLeftRail
        activeSpace={activeSpace}
        onSpaceChange={applySpace}
        terminalMarketsOpen={terminalMarketsOpen}
        onToggleMarkets={() => toggleTerminalMarkets()}
        bottomPanelCollapsed={bottomCollapsed}
        onToggleBottomPanel={onToggleBottomPanel}
        onFocusSymbolSearch={onFocusSymbolSearch}
        chartExpanded={chartExpanded}
        terminalNewsOpen={terminalNewsOpen}
        onPanelsSelectMarkets={onPanelsSelectMarkets}
        onPanelsSelectOrder={onPanelsSelectOrder}
        onExpandFullChart={onExpandFullChartFromRail}
        onPanelsSelectNews={onPanelsSelectNews}
      />
      <div
        ref={centerColumnRef}
        className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 relative z-0"
      >
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div
            className={clsx(
              'flex flex-col overflow-hidden bg-bg-base flex-1 min-w-0 min-h-0 relative isolate z-0',
              chartExpanded &&
                'ring-1 ring-inset ring-accent/25 shadow-[inset_0_0_0_1px_rgba(0,230,118,0.08)]',
            )}
          >
            {chartExpanded ? (
              <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border-primary bg-bg-secondary">
                <span className="text-xs font-semibold text-text-primary truncate">
                  {selectedSymbol ? `Chart — ${selectedSymbol}` : 'Chart'}
                </span>
                <span className="text-[10px] text-text-tertiary hidden sm:inline">Esc — normal view</span>
                <button
                  type="button"
                  onClick={() => setChartExpanded(false)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-text-secondary border border-border-primary hover:bg-bg-hover hover:text-text-primary"
                >
                  <Minimize2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  Normal view
                </button>
              </div>
            ) : null}
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
              <TradingViewChart />
            </div>
            <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 border-t border-border-primary bg-bg-secondary">
              {chartExpanded ? (
                <span className="text-[11px] text-text-secondary truncate pl-1">{selectedSymbol}</span>
              ) : (
                <span className="text-[11px] text-text-tertiary pl-1">Chart panel</span>
              )}
              <button
                type="button"
                onClick={() => setChartExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-text-secondary border border-border-primary hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-colors"
              >
                {chartExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Normal view
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Expand chart
                  </>
                )}
              </button>
            </div>
          </div>

          <PanelResizeHandle
            axis="vertical"
            hitSize={TERMINAL_RESIZE.handleHitPx}
            onDragStart={snapshotLayout}
            onDrag={onChartRailDrag}
          />

          <div
            className="shrink-0 flex flex-col h-full min-h-0 overflow-hidden bg-bg-base border-l border-border-primary"
            style={{ width: opW }}
          >
            {terminalNewsOpen ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <TradingViewNewsTimeline />
              </div>
            ) : terminalMarketsOpen ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <Watchlist
                  variant="terminalRail"
                  onExitMarkets={() => {
                    setTerminalMarketsOpen(false);
                    setTerminalNewsOpen(false);
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <OrderPanel />
              </div>
            )}
          </div>
        </div>

        <PanelResizeHandle
          axis="horizontal"
          hitSize={TERMINAL_RESIZE.bottomHandleHitPx}
          onDragStart={snapshotLayout}
          onDrag={onBottomDrag}
          className="z-[80]"
        />

        <div
          className="shrink-0 overflow-hidden min-h-0 flex flex-col relative z-[1] border-t border-border-primary"
          style={{ height: bpH }}
        >
          <PositionsPanel variant="terminal" />
        </div>
      </div>
    </div>
  );
}
