'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Minus, Plus, X, ChevronDown, ChevronLeft, Wifi, WifiOff, Zap } from 'lucide-react';
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

export default function OrderPanel() {
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

  const marginRequired = useMemo(() => {
    if (!execPrice || !activeAccount) return 0;
    return (lotsNum * contractSize * execPrice) / activeAccount.leverage;
  }, [execPrice, lotsNum, activeAccount, contractSize]);

  const freeMargin = activeAccount?.free_margin || 0;
  const hasEnoughMargin = freeMargin >= marginRequired;

  // Account-tier minimum-balance gate (Micro $10 / Standard $100 /
  // Pro $500 / Elite $1000). Server rejects trades when
  // account.balance < group.minimum_deposit; mirror it client-side so
  // the Buy/Sell button visibly disables and the user reads the
  // requirement up-front instead of after tapping.
  const minDepositGate = activeAccount?.account_group?.minimum_deposit ?? 0;
  const accountBalance = activeAccount?.balance ?? 0;
  const meetsMinBalance = minDepositGate <= 0 || accountBalance >= minDepositGate;

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
    markRecentlyClicked();
    if (orderTab === 'market' && !marketStatus.isOpen) {
      toast.error(marketStatus.reason || 'Market is closed');
      return;
    }
    if (!hasEnoughMargin) {
      toast.error(`Insufficient margin`);
      return;
    }
    // Preflight the server-side "Account balance must be ≥ min_deposit
    // for this account type" gate (trading_service.py:141-150). Catching
    // it client-side means the user gets a clean toast IMMEDIATELY,
    // without the optimistic UI / "orderPlaced" sound / success message
    // racing the rejection.
    const minDeposit = activeAccount.account_group?.minimum_deposit ?? 0;
    if (minDeposit > 0 && (activeAccount.balance ?? 0) < minDeposit) {
      toast.error(`Minimum $${minDeposit.toFixed(0)} balance required for this account. Deposit funds first.`);
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

    api.post<{ id: string; position_id: string | null }>('/orders/', {
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
    }).then(async () => {
      // Confirm success only now — the request actually went through.
      toast.success(`${side.toUpperCase()} ${lotsNum} ${selectedSymbol}`);

      // Note: we no longer swap the optimistic row's id with the real
      // position_id here. The store's refreshPositions does that merge
      // by matching on (account_id, symbol, side, lots) and preserving
      // the optimistic React key, which is what actually prevents the
      // unmount/remount flicker. Swapping the id here would just churn
      // the key between this microtask and the next poll.

      // refreshAccount updates balance/margin numbers. refreshPositions
      // would tear down + rebuild the row we just swapped — skip it,
      // the periodic poll already syncs server-side fields without
      // remounting React rows.
      refreshAccount().catch(() => {});
    }).catch((e: any) => {
      if (rollback) rollback();
      toast.error(e.message || 'Order failed');
    });
  };

  const isConnected = wsStatus === 'connected';

  const pad = isTradingTerminal ? 'px-2 py-2 space-y-2' : 'p-4 space-y-4';
  const tabPad = isTradingTerminal ? 'py-1 text-[11px]' : 'py-1.5 text-xs';
  const volBtn = isTradingTerminal ? 'w-8 h-8' : 'w-10 h-10';
  const volIn = isTradingTerminal ? 'py-1.5 text-sm' : 'py-2.5 text-base';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {/* ═══ Header ═══ */}
      <div
        className={clsx('shrink-0 flex items-center justify-between border-b border-border-primary bg-bg-secondary', isTradingTerminal ? 'px-2 py-2' : 'px-4 py-2.5')}
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
              style={{ color: marketStatus.isOpen ? '#6366F1' : '#f57c00' }}
            >
              {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            {isConnected ? (
              <Wifi size={isTradingTerminal ? 11 : 12} className="text-[#6366F1]" />
            ) : (
              <WifiOff size={isTradingTerminal ? 11 : 12} className="text-[#f57c00]" />
            )}
          </div>
        </div>
      </div>

      {isTradingTerminal ? (
        <div className="h-px w-full shrink-0 bg-accent" aria-hidden />
      ) : null}

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
          {/* Market / Pending tabs */}
          <div className="flex rounded-md overflow-hidden bg-bg-secondary border border-border-primary">
            {(['market', 'pending'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderTab(t)}
                className={clsx('flex-1 font-semibold capitalize transition-all', tabPad)}
                style={{
                  background: orderTab === t ? 'var(--bg-hover)' : 'transparent',
                  color: orderTab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom:
                    orderTab === t
                      ? `2px solid ${isTradingTerminal ? '#2962FF' : '#6366F1'}`
                      : '2px solid transparent',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sell / Buy Vantage-style pills with center spread badge */}
          <div className="relative">
            <div className={clsx('grid grid-cols-2', isTradingTerminal ? 'gap-8' : 'gap-9')}>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={clsx(
                  'rounded-2xl flex flex-col items-start justify-center transition-all duration-150 active:scale-[0.98]',
                  isTradingTerminal ? 'px-3 py-2' : 'px-4 py-3',
                  side === 'sell'
                    ? 'bg-[#DC2626] text-white shadow-sm'
                    : 'bg-bg-secondary text-text-secondary border border-border-primary hover:bg-bg-hover',
                )}
                aria-pressed={side === 'sell'}
              >
                <div className={clsx('font-bold tracking-tight', isTradingTerminal ? 'text-xs' : 'text-sm')}>
                  Sell
                </div>
                <div className={clsx('font-mono font-bold tabular-nums', isTradingTerminal ? 'text-base' : 'text-lg')}>
                  {tick ? tick.bid.toFixed(digits) : '---'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={clsx(
                  'rounded-2xl flex flex-col items-end justify-center transition-all duration-150 active:scale-[0.98]',
                  isTradingTerminal ? 'px-3 py-2' : 'px-4 py-3',
                  side === 'buy'
                    ? 'bg-[#1E66F5] text-white shadow-sm'
                    : 'bg-bg-secondary text-text-secondary border border-border-primary hover:bg-bg-hover',
                )}
                aria-pressed={side === 'buy'}
              >
                <div className={clsx('font-bold tracking-tight', isTradingTerminal ? 'text-xs' : 'text-sm')}>
                  Buy
                </div>
                <div className={clsx('font-mono font-bold tabular-nums', isTradingTerminal ? 'text-base' : 'text-lg')}>
                  {tick ? tick.ask.toFixed(digits) : '---'}
                </div>
              </button>
            </div>

            {/* Center spread badge — overlaps the gap between buttons.
                Used to be a bare number "10" in a small circle, which
                made it impossible to tell at a glance what it meant.
                Now stacks a "SPREAD" label over the pip count + raw
                price diff so traders can see exactly what's being
                charged on the round trip. */}
            {tick && (() => {
              const pipSize = instrumentInfo?.pip_size || 0.0001;
              const pips = tick.spread / pipSize;
              const pipsLabel = pips >= 100 ? pips.toFixed(0) : pips.toFixed(1);
              const priceDiff = tick.spread.toFixed(digits);
              return (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div
                    className={clsx(
                      'flex flex-col items-center rounded-lg bg-white shadow-md ring-1 ring-black/5 border border-[#E5E5E5]',
                      isTradingTerminal ? 'px-2 py-1' : 'px-2.5 py-1.5',
                    )}
                  >
                    <span
                      className={clsx(
                        'font-bold uppercase tracking-[0.08em] text-[#9CA3AF]',
                        isTradingTerminal ? 'text-[8px] leading-[10px]' : 'text-[9px] leading-[11px]',
                      )}
                    >
                      Spread
                    </span>
                    <span
                      className={clsx(
                        'font-mono font-bold tabular-nums text-[#E94E1B] leading-tight',
                        isTradingTerminal ? 'text-[11px]' : 'text-sm',
                      )}
                    >
                      {pipsLabel}
                      <span className={clsx('ml-0.5 font-semibold text-[#6B7280]', isTradingTerminal ? 'text-[8px]' : 'text-[9px]')}>
                        pip{pips === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        'font-mono tabular-nums text-[#9CA3AF] leading-none mt-0.5',
                        isTradingTerminal ? 'text-[8px]' : 'text-[9px]',
                      )}
                    >
                      {priceDiff}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SL / TP — separate Add / Remove buttons. Click to toggle the
              corresponding input field below; visually distinct red/blue
              chips so the trader can tell them apart at a glance. */}
          <div className={clsx('flex items-center flex-wrap', isTradingTerminal ? 'gap-2 pt-1' : 'gap-2 pt-2')}>
            <button
              type="button"
              onClick={() => { setSlEnabled((p) => !p); if (slEnabled) setStopLoss(''); }}
              className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border',
                slEnabled
                  ? 'bg-[#ef5350]/15 text-[#ef5350] border-[#ef5350]/40'
                  : 'bg-bg-secondary text-text-secondary border-border-primary hover:border-[#ef5350]/40 hover:text-[#ef5350]',
              )}
              title={slEnabled ? 'Remove Stop Loss' : 'Add Stop Loss'}
            >
              {slEnabled ? <X size={11} /> : <Plus size={11} />}
              SL
            </button>
            <button
              type="button"
              onClick={() => { setTpEnabled((p) => !p); if (tpEnabled) setTakeProfit(''); }}
              className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border',
                tpEnabled
                  ? 'bg-[#6366F1]/15 text-[#6366F1] border-[#6366F1]/40'
                  : 'bg-bg-secondary text-text-secondary border-border-primary hover:border-[#6366F1]/40 hover:text-[#6366F1]',
              )}
              title={tpEnabled ? 'Remove Take Profit' : 'Add Take Profit'}
            >
              {tpEnabled ? <X size={11} /> : <Plus size={11} />}
              TP
            </button>
            {activeAccount && (
              <LeveragePicker
                account={activeAccount}
                onChanged={() => { void refreshAccount(); }}
              />
            )}
          </div>

          {/* Volume */}
          <div className={isTradingTerminal ? 'pt-1' : 'pt-2'}>
            <div className={clsx('flex items-center justify-between', isTradingTerminal ? 'mb-1' : 'mb-1.5')}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Volume</span>
              <div className="flex gap-0.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-bg-hover text-text-secondary">Lots</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">Units</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => adjustLots(-0.01)}
                className={clsx(volBtn, 'rounded-lg flex items-center justify-center transition-colors text-text-secondary hover:text-text-primary bg-bg-secondary border border-border-primary')}
              >
                <Minus size={isTradingTerminal ? 12 : 14} />
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={lots}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setLots(v);
                }}
                onBlur={() => {
                  const n = parseFloat(lots);
                  if (!Number.isFinite(n) || n <= 0) setLots('0.01');
                  else setLots(n.toFixed(2));
                }}
                className={clsx('flex-1 text-center font-mono font-bold rounded-lg focus:outline-none bg-bg-secondary border border-border-primary text-text-primary', volIn)}
              />
              <button
                type="button"
                onClick={() => adjustLots(0.01)}
                className={clsx(volBtn, 'rounded-lg flex items-center justify-center transition-colors text-text-secondary hover:text-text-primary bg-bg-secondary border border-border-primary')}
              >
                <Plus size={isTradingTerminal ? 12 : 14} />
              </button>
            </div>
            {/* Quick-size chips: tap to set volume directly. */}
            <div className="flex items-center gap-1 mt-1.5">
              {(['0.01', '0.1', '1.00', '10', '100'] as const).map((v) => {
                const active = parseFloat(lots) === parseFloat(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLots(v)}
                    className={clsx(
                      'flex-1 py-1 rounded-md text-[10px] font-bold font-mono tabular-nums border transition-colors',
                      active
                        ? 'border-accent/60 bg-accent/10 text-accent'
                        : 'border-border-primary bg-bg-secondary text-text-secondary hover:text-text-primary hover:border-accent/30',
                    )}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pending order — type toggle + trigger price (+ stop-limit
              target). Only renders on the Pending tab. */}
          {orderTab === 'pending' && (
            <div className="pt-2 space-y-2">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  Pending type
                </span>
                <div className="grid grid-cols-3 rounded-md overflow-hidden border border-border-primary bg-bg-secondary">
                  {([
                    { k: 'limit' as const, label: 'Limit' },
                    { k: 'stop' as const, label: 'Stop' },
                    { k: 'stop_limit' as const, label: 'Stop-Limit' },
                  ]).map(({ k, label }) => {
                    const active = pendingKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setPendingKind(k)}
                        className={clsx(
                          'px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
                          active
                            ? 'bg-accent/15 text-accent'
                            : 'text-text-tertiary hover:text-text-primary',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {pendingKind === 'stop_limit' ? 'Stop (trigger) price' : 'Trigger price'}
                  </span>
                  <span className="text-[9.5px] text-text-tertiary font-mono">
                    {pendingKind === 'limit'
                      ? side === 'buy'
                        ? `< ${ask.toFixed(digits)}`
                        : `> ${bid.toFixed(digits)}`
                      : side === 'buy'
                        ? `> ${ask.toFixed(digits)}`
                        : `< ${bid.toFixed(digits)}`}
                  </span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  step={execPrice > 100 ? 0.01 : 0.00001}
                  placeholder={(
                    pendingKind === 'limit'
                      ? side === 'buy'
                        ? ask * 0.999
                        : bid * 1.001
                      : side === 'buy'
                        ? ask * 1.001
                        : bid * 0.999
                  ).toFixed(digits)}
                  className="w-full text-sm font-mono py-2 px-3 rounded-lg focus:outline-none bg-bg-secondary border border-border-primary text-text-primary placeholder:text-text-tertiary focus:border-accent/50"
                />
              </div>
              {/* Second price input only for stop-limit */}
              {pendingKind === 'stop_limit' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Limit (target) price
                    </span>
                    <span className="text-[9.5px] text-text-tertiary font-mono">
                      {side === 'buy' ? '< stop' : '> stop'}
                    </span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={stopLimitPrice}
                    onChange={(e) => setStopLimitPrice(e.target.value)}
                    step={execPrice > 100 ? 0.01 : 0.00001}
                    placeholder={
                      Number.isFinite(parseFloat(triggerPrice))
                        ? (
                            side === 'buy'
                              ? parseFloat(triggerPrice) * 0.999
                              : parseFloat(triggerPrice) * 1.001
                          ).toFixed(digits)
                        : '—'
                    }
                    className="w-full text-sm font-mono py-2 px-3 rounded-lg focus:outline-none bg-bg-secondary border border-border-primary text-text-primary placeholder:text-text-tertiary focus:border-accent/50"
                  />
                </div>
              )}
            </div>
          )}

          {/* SL input */}
          {slEnabled && (
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1.5 block">Stop Loss</span>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                step={execPrice > 100 ? 0.01 : 0.00001}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 0.99 : 1.01)).toFixed(digits)}`}
                className="w-full text-sm font-mono py-2.5 px-3 rounded-lg focus:outline-none bg-bg-secondary border border-red-500/30 text-red-400"
              />
            </div>
          )}

          {/* TP input */}
          {tpEnabled && (
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1] mb-1.5 block">Take Profit</span>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step={execPrice > 100 ? 0.01 : 0.00001}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits)}`}
                className="w-full text-sm font-mono py-2.5 px-3 rounded-lg focus:outline-none bg-bg-secondary border border-[#6366F1]/30 text-[#6366F1]"
              />
            </div>
          )}

          {!isTradingTerminal ? (
            <>
              <div className="py-2" />
              <div className="rounded-xl p-3 space-y-2 bg-bg-secondary border border-border-primary">
                {[
                  { label: 'Exec. Price', value: execPrice > 0 ? execPrice.toFixed(digits) : '—', color: 'var(--text-primary)' },
                  { label: 'Margin Required', value: `$${marginRequired.toFixed(2)}`, color: !hasEnoughMargin ? '#ef5350' : 'var(--text-secondary)' },
                  { label: 'Free Margin', value: `$${freeMargin.toFixed(2)}`, color: !hasEnoughMargin ? '#ef5350' : '#6366F1' },
                  { label: 'Feed', value: isConnected ? '● Connected' : '○ Disconnected', color: isConnected ? '#6366F1' : '#f57c00' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-text-tertiary">{row.label}</span>
                    <span className="text-[11px] font-mono font-semibold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
                {!hasEnoughMargin && (
                  <div className="text-[11px] text-red-500 font-bold text-center pt-2 mt-2" style={{ borderTop: '1px solid rgba(239,83,80,0.15)' }}>
                    ⚠ Insufficient margin
                  </div>
                )}
                {hasEnoughMargin && !meetsMinBalance && (
                  <div className="text-[11px] text-red-500 font-bold text-center pt-2 mt-2 leading-snug" style={{ borderTop: '1px solid rgba(239,83,80,0.15)' }}>
                    ⚠ Minimum ${minDepositGate.toFixed(0)} balance required
                  </div>
                )}
              </div>
              <div className="py-2" />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!recentlyClicked && (!hasEnoughMargin || !meetsMinBalance || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen) || !pendingTriggerValid)}
                className="w-full py-4 rounded-xl text-[15px] font-black tracking-wide uppercase transition-[transform,opacity] duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                style={{
                  background: side === 'buy' ? '#2962FF' : '#ef5350',
                  color: '#fff',
                  boxShadow: side === 'buy' ? '0 4px 20px rgba(41,98,255,0.2)' : '0 4px 20px rgba(239,83,80,0.2)',
                }}
              >
                {`${side === 'buy' ? 'Buy' : 'Sell'} ${selectedSymbol}`}
              </button>
              {!marketStatus.isOpen && orderTab === 'market' && (
                <div className="mt-4 rounded-lg px-3 py-2 text-[11px] text-red-400 leading-snug text-center" style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.2)' }}>
                  {marketStatus.reason}
                </div>
              )}
            </>
          ) : null}
          </div>
        </div>

        {isTradingTerminal ? (
          <div className="shrink-0 border-t border-border-primary bg-bg-secondary px-2 pt-2 pb-2 space-y-1.5">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-card border border-border-primary">
              {/* Market orders show the required Margin here (the standalone
                  "Mrgn $.." line below was removed); pending orders keep the
                  Trigger price since that's the essential value to confirm. */}
              <span className="text-[10px] text-text-tertiary">
                {orderTab === 'pending' ? 'Trigger' : 'Margin'}
              </span>
              <span className="text-xs font-mono font-semibold text-text-primary">
                {orderTab === 'pending'
                  ? (Number.isFinite(parseFloat(triggerPrice)) && parseFloat(triggerPrice) > 0
                      ? parseFloat(triggerPrice).toFixed(digits)
                      : '—')
                  : `$${marginRequired.toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 px-1 text-[9px] text-text-tertiary">
              <span className={clsx('shrink-0 font-mono', hasEnoughMargin ? 'text-[#6366F1]' : 'text-[#ef5350]')}>
                Free ${freeMargin.toFixed(2)}
              </span>
              <span
                className={clsx('shrink-0 font-mono', isConnected ? 'text-[#6366F1]' : 'text-[#f57c00]')}
                title={isConnected ? 'Feed connected' : 'Feed disconnected'}
              >
                {isConnected ? '●' : '○'}
              </span>
            </div>
            {!hasEnoughMargin && (
              <div className="text-[10px] text-red-500 font-semibold text-center leading-tight">Insufficient margin</div>
            )}
            {hasEnoughMargin && !meetsMinBalance && (
              <div className="text-[10px] text-red-500 font-semibold text-center leading-tight">
                Min ${minDepositGate.toFixed(0)} balance required
              </div>
            )}
            {orderTab === 'pending' && !pendingTriggerValid && hasEnoughMargin && meetsMinBalance && (
              <div className="text-[10px] text-warning font-semibold text-center leading-tight">
                Enter a trigger price to place the order
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!recentlyClicked && (!hasEnoughMargin || !meetsMinBalance || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen) || !pendingTriggerValid)}
              className="w-full py-2.5 rounded-lg text-sm font-black tracking-wide uppercase transition-[transform,opacity] duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
              style={{
                background: side === 'buy' ? '#2962FF' : '#ef5350',
                color: '#fff',
                boxShadow: side === 'buy' ? '0 2px 12px rgba(41,98,255,0.2)' : '0 2px 12px rgba(239,83,80,0.2)',
              }}
            >
              {`${side === 'buy' ? 'Buy' : 'Sell'} ${selectedSymbol}`}
            </button>
            {!marketStatus.isOpen && orderTab === 'market' && (
              <div
                className="rounded px-2 py-1 text-[10px] text-red-400 leading-snug text-center"
                style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.2)' }}
              >
                {marketStatus.reason}
              </div>
            )}
          </div>
        ) : null}
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
                    ? 'bg-[#6366F1]/15 text-[#6366F1] font-bold'
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
