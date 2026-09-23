'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import toast from 'react-hot-toast';
import { Minus, Plus, X, ChevronDown, ChevronLeft, Wifi, WifiOff, Zap, Info, Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import api from '@/lib/api/client';
import { sounds, unlockAudio } from '@/lib/sounds';
import { getDigits } from '@/lib/utils';
import { getMarketStatus } from '@/lib/marketHours';
import { wsManager } from '@/lib/ws/wsManager';
import OrderPanelSymbolPicker from '@/components/trading/OrderPanelSymbolPicker';

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'pending';

export default function OrderPanel({
  onOrderPlaced,
}: {
  /** Called right after an order is dispatched (validation passed) — hosts
   *  like the draggable window / mobile sheet close themselves on it. */
  onOrderPlaced?: () => void;
} = {}) {
  const pathname = usePathname();
  const isTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const {
    terminalMarketsOpen,
    toggleTerminalMarkets,
    oneClickTrading,
    setOneClickTrading,
  } = useUIStore();

  // Narrow selectors: the order ticket needs live `prices`, but selecting each
  // slice individually drops re-renders from unrelated store updates
  // (action references are stable in zustand).
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const positions = useTradingStore((s) => s.positions);
  const setPositions = useTradingStore((s) => s.setPositions);
  const refreshPositions = useTradingStore((s) => s.refreshPositions);
  const refreshAccount = useTradingStore((s) => s.refreshAccount);
  const orderFormCloneDraft = useTradingStore((s) => s.orderFormCloneDraft);
  const setOrderFormCloneDraft = useTradingStore((s) => s.setOrderFormCloneDraft);
  const setTerminalMarketsOpen = useUIStore((s) => s.setTerminalMarketsOpen);
  const setTerminalNewsOpen = useUIStore((s) => s.setTerminalNewsOpen);

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderTab, setOrderTab] = useState<OrderType>('market');
  const [pendingKind, setPendingKind] = useState<'limit' | 'stop' | 'stop_limit'>('limit');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [stopLimitPrice, setStopLimitPrice] = useState('');
  const [lots, setLots] = useState('0.01');
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tick = prices[selectedSymbol];
  const instrumentInfo = instruments.find((i) => i.symbol === selectedSymbol);
  const segment = (instrumentInfo as any)?.segment as string | undefined;
  const digits = getDigits(selectedSymbol);
  const contractSize = instrumentInfo?.contract_size || 100000;

  const marketStatus = useMemo(
    () => getMarketStatus(selectedSymbol, segment),
    [selectedSymbol, segment, Math.floor(Date.now() / 60_000)],
  );

  const bid = tick?.bid ?? 0;
  const ask = tick?.ask ?? 0;
  const execPrice = tick ? (side === 'buy' ? tick.ask : tick.bid) : 0;
  const lotsNum = parseFloat(lots) || 0;
  // Day-change indicator: first bid seen per symbol this session is the
  // reference (the feed doesn't carry a day-open field).
  const sessionOpenRef = useRef<Record<string, number>>({});
  if (tick && sessionOpenRef.current[selectedSymbol] == null) sessionOpenRef.current[selectedSymbol] = tick.bid;
  const dayOpen = sessionOpenRef.current[selectedSymbol];
  const pipSize = instrumentInfo?.pip_size ? Number(instrumentInfo.pip_size) : (digits >= 4 ? 0.0001 : 0.01);
  const dayChangePts = tick && dayOpen ? Math.round((tick.bid - dayOpen) / pipSize) : 0;
  const spreadPts = tick ? Math.round((tick.ask - tick.bid) / pipSize) : 0;
  const fmtPx = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const maxLots = Number((instrumentInfo as { max_lot?: number | string } | undefined)?.max_lot) || 100;
  const minLots = Number((instrumentInfo as { min_lot?: number | string } | undefined)?.min_lot) || 0.01;
  const stepPx = execPrice > 100 ? 0.01 : Math.pow(10, -digits);
  /** Reference tab: market | limit | stop | stop_limit (maps onto orderTab + pendingKind). */
  const ticketTab: 'market' | 'limit' | 'stop' | 'stop_limit' = orderTab === 'market' ? 'market' : pendingKind;
  const selectTicketTab = (t: 'market' | 'limit' | 'stop' | 'stop_limit') => {
    if (t === 'market') { setOrderTab('market'); return; }
    setOrderTab('pending'); setPendingKind(t);
  };
  const trig = parseFloat(triggerPrice);
  /** Limit must be better than market, stop must be beyond it — the broker rule the reference shows as Min/Max value. */
  const triggerBound = (() => {
    if (!tick || ticketTab === 'market') return null;
    if (ticketTab === 'limit') return side === 'buy' ? { kind: 'max' as const, v: tick.ask } : { kind: 'min' as const, v: tick.bid };
    return side === 'buy' ? { kind: 'min' as const, v: tick.ask } : { kind: 'max' as const, v: tick.bid };
  })();
  const triggerOutOfBounds = !!triggerBound && Number.isFinite(trig) && (triggerBound.kind === 'max' ? trig > triggerBound.v : trig < triggerBound.v);
  const stepTrigger = (d: number) => {
    const base = Number.isFinite(trig) && trig > 0 ? trig : execPrice;
    setTriggerPrice((base + d * stepPx).toFixed(digits));
  };
  const equityVal = Number(activeAccount?.equity ?? 0);
  const balanceVal = Number(activeAccount?.balance ?? 0);
  const creditVal = Number((activeAccount as { credit?: number } | null)?.credit ?? 0);
  const marginUsedVal = Number((activeAccount as { margin_used?: number } | null)?.margin_used ?? 0);
  const floatingPnl = equityVal - balanceVal - creditVal;
  const marginLevelNow = marginUsedVal > 0 ? (equityVal / marginUsedVal) * 100 : null;
  const usd = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

  const marginRequired = useMemo(() => {
    if (!execPrice || !activeAccount) return 0;
    return (lotsNum * contractSize * execPrice) / activeAccount.leverage;
  }, [execPrice, lotsNum, activeAccount, contractSize]);

  const freeMargin = activeAccount?.free_margin || 0;
  const hasEnoughMargin = freeMargin >= marginRequired;
  const marginAfter = marginUsedVal + marginRequired > 0 ? (equityVal / (marginUsedVal + marginRequired)) * 100 : null;

  // The account-group minimum deposit applies at ACCOUNT OPENING only —
  // trading is never blocked by it (margin checks are the only funding
  // gate). The old client-side minimum-balance gate was removed together
  // with its server-side counterpart in trading_service.py.

  /** Pending tab requires a positive trigger price. Stop-limit also
   *  requires the second (limit/target) price. Side-vs-mid validity is
   *  enforced in handleSubmit so the button only blocks on simplest
   *  preconditions here. */
  const pendingTriggerValid = orderTab !== 'pending'
    ? true
    : (() => {
        const t = parseFloat(triggerPrice);
        if (!Number.isFinite(t) || t <= 0) return false;
        if (pendingKind === 'stop_limit') {
          const sl = parseFloat(stopLimitPrice);
          if (!Number.isFinite(sl) || sl <= 0) return false;
        }
        return true;
      })();

  useEffect(() => {
    const unsub = wsManager.onStatusChange(setWsStatus);
    setWsStatus(wsManager.status);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!orderFormCloneDraft) return;
    const d = orderFormCloneDraft;
    setSelectedSymbol(d.symbol);
    setSide(d.side);
    setLots(Math.max(0.01, Number(d.lots.toFixed(4))).toString());
    if (d.stop_loss != null && d.stop_loss !== undefined && !Number.isNaN(Number(d.stop_loss))) {
      setSlEnabled(true);
      setStopLoss(String(d.stop_loss));
    } else {
      setSlEnabled(false);
      setStopLoss('');
    }
    if (d.take_profit != null && d.take_profit !== undefined && !Number.isNaN(Number(d.take_profit))) {
      setTpEnabled(true);
      setTakeProfit(String(d.take_profit));
    } else {
      setTpEnabled(false);
      setTakeProfit('');
    }
    setOrderTab('market');
    setOrderFormCloneDraft(null);
    setTerminalMarketsOpen(false);
    setTerminalNewsOpen(false);
    toast.success('Order form filled — review and place');
  }, [orderFormCloneDraft, setSelectedSymbol, setOrderFormCloneDraft, setTerminalMarketsOpen, setTerminalNewsOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSymbolPickerOpen(false);
      }
    }
    if (symbolPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [symbolPickerOpen]);

  // Auto-set SL/TP defaults
  useEffect(() => {
    if (slEnabled && !stopLoss && execPrice > 0) {
      setStopLoss((side === 'buy' ? execPrice * 0.99 : execPrice * 1.01).toFixed(digits));
    }
  }, [slEnabled]);

  useEffect(() => {
    if (tpEnabled && !takeProfit && execPrice > 0) {
      setTakeProfit((side === 'buy' ? execPrice * 1.02 : execPrice * 0.98).toFixed(digits));
    }
  }, [tpEnabled]);

  const adjustLots = (delta: number) => {
    setLots(Math.max(0.01, parseFloat((lotsNum + delta).toFixed(2))).toString());
  };

  // 1-second grace window after a click during which the button stays
  // visually stable (no opacity-flash to disabled) even if hasEnoughMargin
  // briefly flickers while the account refresh and the optimistic position
  // settle. Without this the button appeared to "disappear" for a second
  // after every trade.
  const justClickedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentlyClicked, setRecentlyClicked] = useState(false);
  const markRecentlyClicked = () => {
    setRecentlyClicked(true);
    if (justClickedRef.current) clearTimeout(justClickedRef.current);
    justClickedRef.current = setTimeout(() => setRecentlyClicked(false), 1000);
  };

  const handleSubmit = async () => {
    unlockAudio();
    if (!activeAccount) return;
    if (submitting) return;  // in-flight guard: a double-click must not fire two orders
    markRecentlyClicked();
    if (orderTab === 'market' && !marketStatus.isOpen) {
      toast.error(marketStatus.reason || 'Market is closed');
      return;
    }
    if (!hasEnoughMargin) {
      toast.error(`Insufficient margin`);
      return;
    }
    // Pending orders require a trigger price + must be on the correct
    // side of the current market (server re-validates but bail early so
    // the user gets a clear toast instead of a 400).
    let triggerPx: number | null = null;
    let stopLimitPx: number | null = null;
    if (orderTab === 'pending') {
      const t = parseFloat(triggerPrice);
      if (!Number.isFinite(t) || t <= 0) {
        toast.error('Enter a trigger price');
        return;
      }
      triggerPx = t;
      if (pendingKind === 'limit') {
        if (side === 'buy' && t >= ask) {
          toast.error(`Buy limit must be below ask (${ask.toFixed(digits)})`);
          return;
        }
        if (side === 'sell' && t <= bid) {
          toast.error(`Sell limit must be above bid (${bid.toFixed(digits)})`);
          return;
        }
      } else if (pendingKind === 'stop') {
        if (side === 'buy' && t <= ask) {
          toast.error(`Buy stop must be above ask (${ask.toFixed(digits)})`);
          return;
        }
        if (side === 'sell' && t >= bid) {
          toast.error(`Sell stop must be below bid (${bid.toFixed(digits)})`);
          return;
        }
      } else {
        // stop_limit — stop triggers the order, limit is the resulting
        // limit-order price. Backend rule: buy stop > ask AND limit < stop.
        const sl = parseFloat(stopLimitPrice);
        if (!Number.isFinite(sl) || sl <= 0) {
          toast.error('Enter a stop-limit (target) price');
          return;
        }
        stopLimitPx = sl;
        if (side === 'buy') {
          if (t <= ask) {
            toast.error(`Buy stop must be above ask (${ask.toFixed(digits)})`);
            return;
          }
          if (sl >= t) {
            toast.error('Buy stop-limit: limit price must be below the stop price');
            return;
          }
        } else {
          if (t >= bid) {
            toast.error(`Sell stop must be below bid (${bid.toFixed(digits)})`);
            return;
          }
          if (sl <= t) {
            toast.error('Sell stop-limit: limit price must be above the stop price');
            return;
          }
        }
      }
    }
    // Optimistic: instant feedback, API fires in background. Sound
    // plays NOW so the tap feels synchronous, but the toast.success
    // only fires after the API confirms — otherwise the user sees
    // "BUY 0.01 EURUSD" success even when the server rejects the
    // trade for insufficient balance, which is confusing.
    sounds.orderPlaced();

    // Only market orders hit the book immediately — show the position in
    // the panel without waiting for the API round-trip so the UI feels
    // synchronous with the tap.
    const optimisticId = `optim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    let rollback: (() => void) | null = null;
    if (orderTab === 'market') {
      const nowIso = new Date().toISOString();
      const optimisticPos = {
        id: optimisticId,
        account_id: activeAccount.id,
        symbol: selectedSymbol,
        side,
        lots: lotsNum,
        open_price: execPrice,
        current_price: execPrice,
        stop_loss: slEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
        take_profit: tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined,
        swap: 0,
        commission: 0,
        profit: 0,
        trade_type: 'market',
        created_at: nowIso,
      } as (typeof positions)[number];
      const prev = positions;
      setPositions([optimisticPos, ...prev]);
      rollback = () => setPositions(prev);
    }

    setSubmitting(true);  // in-flight guard — reset in .then/.catch below
    api.post<{
      id: string;
      position_id: string | null;
      filled_price?: number | null;
      commission?: number | null;
    }>('/orders/', {
      account_id: activeAccount.id,
      symbol: selectedSymbol,
      order_type: orderTab === 'market' ? 'market' : pendingKind,
      price: orderTab === 'pending' && triggerPx != null ? triggerPx : undefined,
      stop_limit_price:
        orderTab === 'pending' && pendingKind === 'stop_limit' && stopLimitPx != null
          ? stopLimitPx
          : undefined,
      side,
      lots: lotsNum,
      stop_loss: slEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
      take_profit: tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined,
    }).then(async (res) => {
      // Confirm success only now — the request actually went through.
      toast.success(`${side.toUpperCase()} ${lotsNum} ${selectedSymbol}`);

      // The response for a market order already carries the REAL
      // position_id (plus fill price / commission) — promote the
      // optimistic row to it right now instead of waiting on the next
      // background poll (up to 1.5s away) to reconcile it. Until the row
      // carries a real id, every chart SL/TP/close control on it refuses
      // to act ("Order still finalizing…") — this is the actual latency
      // the trader feels between tapping Buy/Sell and being able to
      // manage the position.
      //
      // Reading/writing through getState() rather than this closure's
      // `positions`/`setPositions` avoids clobbering a concurrent update
      // (e.g. the 1.5s poll landing in the same window). Safe against that
      // very poll's own optimistic-matching too: it only ever touches rows
      // whose id still starts with "optim-", so a row already swapped to a
      // real UUID here is invisible to it from this point on — one clean
      // handoff, not a race.
      if (orderTab === 'market' && res.position_id) {
        const st = useTradingStore.getState();
        st.setPositions(
          st.positions.map((pos) =>
            pos.id === optimisticId
              ? {
                  ...pos,
                  id: res.position_id!,
                  open_price:
                    res.filled_price != null && res.filled_price > 0 ? res.filled_price : pos.open_price,
                  commission: res.commission ?? pos.commission,
                }
              : pos,
          ),
        );
      }

      // refreshAccount updates balance/margin numbers. refreshPositions
      // would tear down + rebuild rows unnecessarily — skip it, the
      // periodic poll already syncs server-side fields without remounting.
      refreshAccount().catch(() => {});
    }).catch((e: any) => {
      if (rollback) rollback();
      toast.error(e.message || 'Order failed');
    }).finally(() => {
      setSubmitting(false);
    });

    // Order is on its way (optimistic, same as the sound above) — let the
    // hosting window/sheet close so the chart is visible again. Failure
    // still surfaces via the global toast + optimistic-row rollback.
    onOrderPlaced?.();
  };

  const isConnected = wsStatus === 'connected';

  const pad = isTradingTerminal ? 'px-3 py-2 space-y-2' : 'p-4 space-y-3';
  const tabPad = isTradingTerminal ? 'py-1 text-[11px]' : 'py-1.5 text-xs';
  const volBtn = isTradingTerminal ? 'w-8 h-8' : 'w-10 h-10';
  const volIn = isTradingTerminal ? 'py-1.5 text-sm' : 'py-2.5 text-base';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {!isTradingTerminal && (<>
      {/* ═══ Header ═══ */}
      <div
        className={clsx('shrink-0 flex items-center justify-between border-b border-border-primary bg-bg-secondary', isTradingTerminal ? 'px-2 py-1' : 'px-4 py-2.5')}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="relative flex items-center gap-1.5 min-w-0" ref={dropdownRef}>
            <div
              className={clsx('rounded-full shrink-0', isTradingTerminal ? 'w-3.5 h-3.5' : 'w-4 h-4')}
              style={{ background: 'linear-gradient(135deg, #ffb300, #42a5f5)' }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setSymbolPickerOpen((o) => !o)}
              className="flex items-center gap-1 hover:bg-white/[0.05] py-1 pl-0 pr-0.5 rounded-lg transition-colors min-w-0"
            >
              <span
                className={clsx(
                  'font-bold text-text-primary font-mono truncate',
                  isTradingTerminal ? 'text-xs' : 'text-sm',
                )}
              >
                {selectedSymbol}
              </span>
              {!isTradingTerminal ? (
                <ChevronDown
                  size={14}
                  className={clsx('text-text-tertiary shrink-0 transition-transform', symbolPickerOpen && 'rotate-180')}
                />
              ) : (
                <ChevronDown
                  size={12}
                  className={clsx('text-text-tertiary shrink-0 transition-transform', symbolPickerOpen && 'rotate-180')}
                />
              )}
            </button>
            {symbolPickerOpen && (
              <div className="absolute top-full left-0 z-50 w-64 mt-1 rounded-lg border border-border-primary shadow-2xl bg-bg-secondary overflow-hidden">
                <OrderPanelSymbolPicker
                  onPick={(sym) => {
                    setSelectedSymbol(sym);
                    setSymbolPickerOpen(false);
                  }}
                />
              </div>
            )}
          </div>
          {isTradingTerminal ? (
            <div className="flex items-center gap-1 shrink-0">
              {!isTradingTerminal && (
              <button
                type="button"
                onClick={() => {
                  setSymbolPickerOpen(false);
                  toggleTerminalMarkets();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-accent/40 text-accent hover:bg-accent/12 transition-colors"
                aria-label={terminalMarketsOpen ? 'Hide markets' : 'Open markets'}
                aria-expanded={terminalMarketsOpen}
              >
                <ChevronLeft
                  className={clsx(
                    'w-3.5 h-3.5 transition-transform duration-200',
                    terminalMarketsOpen && '-rotate-90',
                  )}
                />
                <span className="text-[9px] font-extrabold uppercase tracking-wider">Markets</span>
              </button>
              )}
              <button
                type="button"
                title={oneClickTrading ? 'One-click trading on' : 'One-click trading off'}
                aria-label={oneClickTrading ? 'Disable one-click trading' : 'Enable one-click trading'}
                aria-pressed={oneClickTrading}
                onClick={() => setOneClickTrading(!oneClickTrading)}
                className={clsx(
                  'flex items-center justify-center w-8 h-8 rounded-md border transition-colors',
                  oneClickTrading
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                <Zap size={15} strokeWidth={1.75} />
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1">
            <span
              className={clsx('font-bold', isTradingTerminal ? 'text-[9px]' : 'text-[10px]')}
              style={{ color: marketStatus.isOpen ? '#1E66F5' : '#f57c00' }}
            >
              {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            {isConnected ? (
              <Wifi size={isTradingTerminal ? 11 : 12} className="text-buy" />
            ) : (
              <WifiOff size={isTradingTerminal ? 11 : 12} className="text-[#f57c00]" />
            )}
          </div>
        </div>
      </div>

      </>)}

      <div
        className={clsx('flex-1 min-h-0 flex flex-col bg-bg-base', isTradingTerminal && 'overflow-hidden')}
      >
        <div
          className={clsx(
            'min-h-0',
            isTradingTerminal
              ? 'flex-1 overflow-y-auto overscroll-y-contain'
              : 'flex-1 overflow-y-auto min-h-0',
          )}
        >
          <div className={pad}>
          {/* ══ Sell ⟋ spread ⟍ Buy ══ */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            <button
              type="button"
              onClick={() => setSide('sell')}
              aria-pressed={side === 'sell'}
              className={clsx(
                'flex flex-col items-center justify-center rounded-l-xl py-1.5 pl-3 pr-6 transition-colors [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]',
                side === 'sell' ? 'bg-[#E5484D] text-white' : 'bg-bg-card-nested text-text-secondary hover:bg-bg-hover',
              )}
            >
              <span className="text-[11px] font-medium opacity-90 leading-none">Sell</span>
              <AnimatedPrice value={tick?.bid} digits={digits} flash={false} lockWidth placeholder="---" className="text-[15px] font-bold tabular-nums leading-tight" />
            </button>
            <span className="flex items-center justify-center px-1 text-[13px] font-medium tabular-nums text-text-secondary">{tick ? spreadPts : '—'}</span>
            <button
              type="button"
              onClick={() => setSide('buy')}
              aria-pressed={side === 'buy'}
              className={clsx(
                'flex flex-col items-center justify-center rounded-r-xl py-1.5 pl-6 pr-3 transition-colors [clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]',
                side === 'buy' ? 'bg-[#1E66F5] text-white' : 'bg-bg-card-nested text-text-secondary hover:bg-bg-hover',
              )}
            >
              <span className="text-[11px] font-medium opacity-90 leading-none">Buy</span>
              <AnimatedPrice value={tick?.ask} digits={digits} flash={false} lockWidth placeholder="---" className="text-[15px] font-bold tabular-nums leading-tight" />
            </button>
          </div>

          {/* Day change bar */}
          <div className="flex items-center gap-2">
            {isTradingTerminal && (
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold leading-none text-text-secondary">
                <span className={clsx('h-1.5 w-1.5 rounded-full', marketStatus.isOpen ? 'bg-emerald-500' : 'bg-[#f57c00]')} aria-hidden />
                {selectedSymbol}
              </span>
            )}
            <div className={clsx('h-[3px] flex-1 rounded-full', dayChangePts >= 0 ? 'bg-emerald-500' : 'bg-[#E5484D]')} />
            <span className={clsx('flex items-center gap-1 text-[11px] font-medium tabular-nums leading-none', dayChangePts >= 0 ? 'text-emerald-500' : 'text-[#E5484D]')}>
              {dayChangePts >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-text-secondary">{dayChangePts >= 0 ? '+' : ''}{dayChangePts}</span>
            </span>
          </div>

          {/* Order type tabs */}
          <div className="flex items-center border-b border-border-primary">
            {([
              { k: 'market' as const, label: 'Market' },
              { k: 'limit' as const, label: 'Limit' },
              { k: 'stop' as const, label: 'Stop' },
              { k: 'stop_limit' as const, label: 'Stop-Limit' },
            ]).map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => selectTicketTab(k)}
                className={clsx(
                  'relative px-2 py-1.5 text-[12px] font-medium transition-colors',
                  ticketTab === k ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                {label}
                {ticketTab === k && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[#E94E1B]" />}
              </button>
            ))}
            <span className="ml-auto text-text-tertiary" title="Market: fills at the current price. Limit: fills at your price or better. Stop: triggers once price passes your level."><Info size={15} /></span>
          </div>

          {/* Price card */}
          {ticketTab === 'market' ? (
            <div className="rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-text-tertiary" style={{ background: 'var(--bg-card-nested)' }}>Fill at market price</div>
          ) : (
            <div>
              <div className={clsx('flex items-center rounded-xl px-3.5 py-1.5', triggerOutOfBounds ? 'ring-1 ring-[#E5484D]' : '')} style={{ background: 'var(--bg-card-nested)' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-text-tertiary">{ticketTab === 'limit' ? 'Limit Price' : 'Stop Price'}</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={triggerPrice}
                    onChange={(e) => setTriggerPrice(e.target.value)}
                    placeholder={execPrice ? execPrice.toFixed(digits) : '—'}
                    className="ticket-input w-full bg-transparent p-0 text-[15px] font-bold tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none border-0 shadow-none"
                  />
                </div>
                <div className="flex items-center gap-1 border-l border-border-primary pl-3">
                  <button type="button" onClick={() => stepTrigger(-1)} aria-label="Decrease price" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover"><Minus size={14} /></button>
                  <button type="button" onClick={() => stepTrigger(1)} aria-label="Increase price" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover"><Plus size={14} /></button>
                </div>
              </div>
              {triggerBound && (
                <p className={clsx('mt-1.5 text-[12px]', triggerOutOfBounds ? 'text-[#E5484D]' : 'text-text-tertiary')}>
                  {triggerBound.kind === 'min' ? 'Min' : 'Max'} value: {triggerBound.v.toFixed(digits)}
                </p>
              )}
              {ticketTab === 'stop_limit' && (
                <div className="mt-1.5 flex items-center rounded-xl px-3.5 py-1.5" style={{ background: 'var(--bg-card-nested)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-text-tertiary">Limit Price</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={stopLimitPrice}
                      onChange={(e) => setStopLimitPrice(e.target.value)}
                      placeholder={Number.isFinite(trig) ? (side === 'buy' ? trig * 0.999 : trig * 1.001).toFixed(digits) : '—'}
                      className="ticket-input w-full bg-transparent p-0 text-[18px] font-bold tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none border-0 shadow-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Volume card */}
          <div className="flex items-center rounded-xl px-3.5 py-1.5" style={{ background: 'var(--bg-card-nested)' }}>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-text-tertiary">Volume</p>
              <input
                type="text"
                inputMode="decimal"
                value={lots}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setLots(v); }}
                onBlur={() => { const n = parseFloat(lots); if (!Number.isFinite(n) || n <= 0) setLots(minLots.toFixed(2)); else setLots(Math.min(n, maxLots).toFixed(2)); }}
                className="ticket-input w-full bg-transparent p-0 text-[18px] font-bold tabular-nums text-text-primary focus:outline-none border-0 shadow-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => adjustLots(-0.01)} aria-label="Decrease volume" className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover"><Minus size={16} /></button>
              <button type="button" onClick={() => adjustLots(0.01)} aria-label="Increase volume" className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover"><Plus size={16} /></button>
              <span className="ml-1.5 border-l border-border-primary pl-2.5 text-[12px] text-text-primary">Lots</span>
              <ChevronDown size={14} className="text-text-tertiary" />
            </div>
          </div>

          {/* Lot slider */}
          <div className="px-1">
            <input
              type="range"
              min={minLots}
              max={maxLots}
              step={0.01}
              value={Math.min(Math.max(lotsNum || minLots, minLots), maxLots)}
              onChange={(e) => setLots(parseFloat(e.target.value).toFixed(2))}
              aria-label="Volume"
              className="crx-range w-full"
              style={{ '--pct': `${Math.min(100, Math.max(0, ((lotsNum - minLots) / (maxLots - minLots)) * 100))}%` } as React.CSSProperties}
            />
            <div className="-mt-0.5 flex items-center justify-between text-[11px] text-text-tertiary">
              <span>0</span>
              <span>Max open {maxLots.toFixed(2)} Lots</span>
            </div>
          </div>

          {/* TP / SL toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
            <input
              type="checkbox"
              checked={slEnabled || tpEnabled}
              onChange={(e) => { setSlEnabled(e.target.checked); setTpEnabled(e.target.checked); if (!e.target.checked) { setStopLoss(''); setTakeProfit(''); } }}
              className="h-4 w-4 rounded border-border-primary accent-[#E94E1B]"
            />
            TP/SL
          </label>
          {(slEnabled || tpEnabled) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl px-3 py-1.5" style={{ background: 'var(--bg-card-nested)' }}>
                <p className="text-[11px] text-text-tertiary">Take Profit</p>
                <input type="text" inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder={execPrice ? (execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits) : '—'} className="ticket-input w-full bg-transparent p-0 text-[15px] font-bold tabular-nums text-buy placeholder:text-text-tertiary focus:outline-none border-0 shadow-none" />
              </div>
              <div className="rounded-xl px-3 py-1.5" style={{ background: 'var(--bg-card-nested)' }}>
                <p className="text-[11px] text-text-tertiary">Stop Loss</p>
                <input type="text" inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder={execPrice ? (execPrice * (side === 'buy' ? 0.99 : 1.01)).toFixed(digits) : '—'} className="ticket-input w-full bg-transparent p-0 text-[15px] font-bold tabular-nums text-[#E5484D] placeholder:text-text-tertiary focus:outline-none border-0 shadow-none" />
              </div>
            </div>
          )}

          {/* Action */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (!recentlyClicked && (!hasEnoughMargin || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen) || !pendingTriggerValid || triggerOutOfBounds))}
            className={clsx(
              'w-full rounded-xl py-2.5 text-[15px] font-semibold text-white transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
              side === 'buy' ? 'bg-[#1E66F5] hover:bg-[#1a58d6]' : 'bg-[#E5484D] hover:bg-[#d23b40]',
            )}
          >
            {submitting ? 'Placing…' : side === 'buy' ? 'Buy' : 'Sell'}
          </button>
          {!hasEnoughMargin && <p className="text-center text-[12px] font-semibold text-[#E5484D]">Insufficient margin</p>}
          {!marketStatus.isOpen && orderTab === 'market' && (
            <p className="rounded-xl px-3 py-2 text-center text-[12px] text-[#E5484D]" style={{ background: 'rgba(229,72,77,0.1)' }}>{marketStatus.reason}</p>
          )}

          {/* Margin rows */}
          <dl className="text-[12px] leading-none">
            {[
              ['Margin', usd(marginRequired)],
              ['Free Margin', usd(freeMargin)],
              ['Margin Level After Trading', marginAfter != null ? `${marginAfter.toLocaleString('en-US', { maximumFractionDigits: 2 })} %` : '--'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-[3.5px]">
                <dt className="text-text-tertiary underline decoration-dotted decoration-border-primary underline-offset-4">{k}</dt>
                <dd className="tabular-nums font-medium text-text-primary">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-[3.5px]">
              <dt className="text-text-tertiary underline decoration-dotted decoration-border-primary underline-offset-4">Leverage</dt>
              <dd className="tabular-nums font-medium text-text-primary">
                {activeAccount ? <LeveragePicker account={activeAccount} onChanged={() => { void refreshAccount(); }} /> : '—'}
              </dd>
            </div>
          </dl>

          {/* Assets */}
          <div className="-mx-3 border-t border-border-primary px-3 pt-2">
            <h3 className="text-[13px] font-bold text-text-primary">Assets</h3>
            <dl className="mt-1 text-[12px] leading-none">
              {[
                ['Equity', usd(equityVal)],
                ['Balance', usd(balanceVal)],
                ['Floating PnL', `${floatingPnl >= 0 ? '' : '-'}${Math.abs(floatingPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (${balanceVal > 0 ? ((floatingPnl / balanceVal) * 100).toFixed(2) : '0.00'} %)`],
                ['Credit', usd(creditVal)],
                ['Margin Level', marginLevelNow != null ? `${marginLevelNow.toLocaleString('en-US', { maximumFractionDigits: 2 })} %` : '--'],
                ['Margin Used', usd(marginUsedVal)],
                ['Free Margin', usd(freeMargin)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-[3.5px]">
                  <dt className="shrink-0 text-text-tertiary underline decoration-dotted decoration-border-primary underline-offset-4">{k}</dt>
                  <dd className="flex items-center gap-1.5 text-right tabular-nums font-medium text-text-primary">
                    {k === 'Margin Level' && <Gauge size={13} className="shrink-0 text-emerald-500" />}{v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dropdown that lets the trader lower their leverage to any preset value up to
 * the admin-set `account_group.leverage_default` ceiling. Persists the change
 * via PATCH /accounts/:id/leverage.
 */
function LeveragePicker({
  account,
  onChanged,
}: {
  account: TradingAccount;
  onChanged: () => void;
}) {
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const positions = useTradingStore((s) => s.positions);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const maxLev = account.account_group?.leverage_default ?? account.leverage;
  const presets = useMemo(() => {
    const base = [1, 10, 25, 50, 100, 200, 300, 400, 500, 1000];
    const filtered = base.filter((v) => v <= maxLev);
    if (!filtered.includes(maxLev)) filtered.push(maxLev);
    return Array.from(new Set(filtered)).sort((a, b) => a - b);
  }, [maxLev]);

  // Backend blocks leverage changes when the account has open positions
  // (account_service.py:548-552). Mirror that on the client so the user
  // gets a clear locked indicator + tooltip BEFORE clicking, instead of
  // a generic toast after the API rejects them.
  const openOnThisAccount = positions.filter((p) => p.account_id === account.id).length;
  const locked = openOnThisAccount > 0;
  const lockReason = `You have ${openOnThisAccount} open position${openOnThisAccount === 1 ? '' : 's'} on this account. Close ${openOnThisAccount === 1 ? 'it' : 'them all'} to change leverage.`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const apply = async (lev: number) => {
    if (lev === account.leverage) { setOpen(false); return; }
    setSaving(true);
    try {
      await api.patch(`/accounts/${account.id}/leverage`, { leverage: lev });
      // Optimistic local update so the pill reflects the new value immediately.
      setActiveAccount({ ...account, leverage: lev });
      toast.success(`Leverage set to 1:${lev}`);
      onChanged();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change leverage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ml-auto relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (locked) {
            toast(lockReason, { icon: '🔒', duration: 4000 });
            return;
          }
          setOpen((p) => !p);
        }}
        disabled={saving}
        className={clsx(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-colors disabled:opacity-50',
          locked
            ? 'text-text-tertiary cursor-not-allowed bg-bg-secondary'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
        )}
        title={locked ? lockReason : `Max 1:${maxLev} — click to change`}
      >
        {locked && <span aria-hidden>🔒</span>}
        1:{account.leverage}
        {!locked && <ChevronDown size={10} />}
      </button>
      {open && !locked && (
        <div
          className="absolute right-0 bottom-full mb-1 w-28 rounded-lg border border-border-primary shadow-xl py-1"
          style={{
            backgroundColor: 'var(--bg-card)',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div className="px-2 pb-1 pt-0.5 text-[9px] uppercase tracking-wider text-text-tertiary font-bold border-b border-border-primary mb-1">
            Max 1:{maxLev}
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {presets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => void apply(v)}
                className={clsx(
                  'w-full text-left px-2 py-1 text-[11px] font-mono transition-colors',
                  v === account.leverage
                    ? 'bg-[#1E66F5]/15 text-buy font-bold'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                1:{v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
