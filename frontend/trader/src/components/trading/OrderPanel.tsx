'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Minus, Plus, ChevronDown, ChevronLeft, Wifi, WifiOff, Zap, Sun, Moon } from 'lucide-react';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import api from '@/lib/api/client';
import { sounds, unlockAudio } from '@/lib/sounds';
import { getDigits } from '@/lib/utils';
import { getMarketStatus } from '@/lib/marketHours';
import { wsManager } from '@/lib/ws/wsManager';
import OrderPanelSymbolPicker from '@/components/trading/OrderPanelSymbolPicker';
import InsuranceTierPicker from '@/components/trading/InsuranceTierPicker';
import { insuranceApi, type InsuranceTier } from '@/lib/api/insurance';

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
    theme,
    toggleTheme,
  } = useUIStore();

  const {
    selectedSymbol,
    setSelectedSymbol,
    prices,
    instruments,
    activeAccount,
    positions,
    setPositions,
    refreshPositions,
    refreshAccount,
    orderFormCloneDraft,
    setOrderFormCloneDraft,
  } = useTradingStore();
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
  // Smart Trade Mode (pitch slide 4): when ON, the position is funded
  // 100% from user capital — no leverage, no overnight (swap) cost.
  // Margin == notional, so the trade size is implicitly capped by the
  // account's free margin.
  const [fullyFunded, setFullyFunded] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [insuranceSelection, setInsuranceSelection] = useState<{ tier: InsuranceTier; fee: number } | null>(null);
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

  const handleSubmit = async () => {
    unlockAudio();
    if (!activeAccount) return;
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

    const insuranceChoice = insuranceSelection;

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
      fully_funded: fullyFunded,
    }).then(async (resp) => {
      // Confirm success only now — the request actually went through.
      toast.success(`${side.toUpperCase()} ${lotsNum} ${selectedSymbol}`);

      // Swap the optimistic placeholder's id with the real position_id
      // in-place. The React row keeps its mount (no flicker) — refresh
      // can then quietly fill in server-side fields (commission, swap)
      // without unmounting the row.
      if (resp?.position_id && orderTab === 'market') {
        setPositions(
          useTradingStore.getState().positions.map((p) =>
            p.id === optimisticId ? { ...p, id: resp.position_id! } : p,
          ),
        );
      }

      // Insurance — only for market orders that immediately produced a position_id.
      if (insuranceChoice && resp?.position_id) {
        try {
          await insuranceApi.activate(resp.position_id, insuranceChoice.tier);
          toast.success(`Insured ($${insuranceChoice.fee.toFixed(2)} fee)`);
        } catch (e: any) {
          const detail = e?.response?.data?.detail || e?.message || 'insurance_failed';
          toast.error(`Insurance not activated: ${detail}`);
        }
      }
      // Reset the picker so the next order starts fresh.
      setInsuranceSelection(null);
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
  const obPad = isTradingTerminal ? 'py-2' : 'py-3';
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
              <button
                type="button"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-md border border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                {theme === 'dark'
                  ? <Sun size={15} strokeWidth={1.75} />
                  : <Moon size={15} strokeWidth={1.75} />}
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1">
            <span
              className={clsx('font-bold', isTradingTerminal ? 'text-[9px]' : 'text-[10px]')}
              style={{ color: marketStatus.isOpen ? '#d6a93d' : '#f57c00' }}
            >
              {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            {isConnected ? (
              <Wifi size={isTradingTerminal ? 11 : 12} className="text-[#d6a93d]" />
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
                      ? `2px solid ${isTradingTerminal ? '#2962FF' : '#d6a93d'}`
                      : '2px solid transparent',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sell / Buy buttons */}
          <div className={clsx('grid grid-cols-2', isTradingTerminal ? 'gap-1.5' : 'gap-2')}>
             <button
                type="button"
                onClick={() => setSide('sell')}
                className={clsx(obPad, 'rounded-lg flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98]')}
                style={{
                  background: side === 'sell' ? 'rgba(239,83,80,0.15)' : 'var(--bg-secondary)',
                  border: side === 'sell' ? '1px solid #ef5350' : '1px solid var(--border-primary)',
                  color: side === 'sell' ? '#ef5350' : 'var(--text-secondary)',
                }}
             >
                <div className={clsx('font-bold uppercase tracking-wider', isTradingTerminal ? 'text-[10px] mb-0' : 'text-sm mb-0.5')}>Sell</div>
                <div className={clsx('font-mono font-bold', isTradingTerminal ? 'text-[13px]' : 'text-[15px]', side === 'sell' && 'text-red-400')}>{tick ? tick.bid.toFixed(digits) : '---'}</div>
                <div className={clsx('text-text-tertiary', isTradingTerminal ? 'text-[8px] mt-0.5' : 'text-[9px] mt-1')}>Bid</div>
             </button>
             <button
                type="button"
                onClick={() => setSide('buy')}
                className={clsx(obPad, 'rounded-lg flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98]')}
                style={{
                  background: side === 'buy' ? 'rgba(41,98,255,0.15)' : 'var(--bg-secondary)',
                  border: side === 'buy' ? '1px solid #2962FF' : '1px solid var(--border-primary)',
                  color: side === 'buy' ? '#2962FF' : 'var(--text-secondary)',
                }}
             >
                <div className={clsx('font-bold uppercase tracking-wider', isTradingTerminal ? 'text-[10px] mb-0' : 'text-sm mb-0.5')}>Buy</div>
                <div className={clsx('font-mono font-bold', isTradingTerminal ? 'text-[13px]' : 'text-[15px]', side === 'buy' && 'text-[#2962FF]')}>{tick ? tick.ask.toFixed(digits) : '---'}</div>
                <div className={clsx('text-text-tertiary', isTradingTerminal ? 'text-[8px] mt-0.5' : 'text-[9px] mt-1')}>Ask</div>
             </button>
          </div>

          {/* Spread */}
          {tick && (
             <div className={clsx('flex items-center justify-center', isTradingTerminal ? '-mt-1' : '-mt-2')}>
                <span className={clsx('font-mono px-2 py-0.5 rounded-full bg-bg-secondary text-text-tertiary border border-border-primary', isTradingTerminal ? 'text-[9px]' : 'text-[10px]')}>
                  Spread: {(tick.spread / (instrumentInfo?.pip_size || 0.0001)).toFixed(1)}
                </span>
             </div>
          )}

          {/* SL / TP toggles */}
          <div className={clsx('flex items-center', isTradingTerminal ? 'gap-3 pt-1' : 'gap-5 pt-2')}>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => { setSlEnabled((p) => !p); if (slEnabled) setStopLoss(''); }}
                className="w-8 h-[18px] rounded-full relative transition-colors cursor-pointer border border-border-primary"
                style={{ background: slEnabled ? '#ef5350' : 'var(--bg-secondary)' }}
              >
                <div className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: slEnabled ? '18px' : '3px' }} />
              </div>
              <span className="text-[10px] uppercase font-semibold text-text-secondary">SL</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => { setTpEnabled((p) => !p); if (tpEnabled) setTakeProfit(''); }}
                className="w-8 h-[18px] rounded-full relative transition-colors cursor-pointer border border-border-primary"
                style={{ background: tpEnabled ? '#d6a93d' : 'var(--bg-secondary)' }}
              >
                <div className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: tpEnabled ? '18px' : '3px' }} />
              </div>
              <span className="text-[10px] uppercase font-semibold text-text-secondary">TP</span>
            </label>
            {activeAccount && (
              <LeveragePicker
                account={activeAccount}
                onChanged={() => { void refreshAccount(); }}
              />
            )}
          </div>

          {/* Smart Trade Mode — Fully Funded toggle. When ON, the position
              uses no leverage and never accrues an overnight (swap) fee.
              Margin equals notional, so the trade size is implicitly capped
              by free margin. */}
          <label className={clsx('flex items-center justify-between gap-2 rounded-md px-2 py-1 border', isTradingTerminal ? 'mt-1' : 'mt-2', fullyFunded ? 'border-buy/40 bg-buy/10' : 'border-border-primary bg-bg-secondary')} title="No leverage. No overnight cost.">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">Fully Funded</span>
              <span className="text-[9px] text-text-tertiary leading-tight">No leverage · No overnight fee</span>
            </div>
            <div
              onClick={() => setFullyFunded((p) => !p)}
              className="w-8 h-[18px] rounded-full relative transition-colors cursor-pointer border border-border-primary shrink-0"
              style={{ background: fullyFunded ? 'var(--buy, #16a34a)' : 'var(--bg-secondary)' }}
            >
              <div className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: fullyFunded ? '18px' : '3px' }} />
            </div>
          </label>

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
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary shrink-0">
                  Pending type
                </span>
                <div className="flex rounded-md overflow-hidden border border-border-primary bg-bg-secondary">
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
                          'px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#d6a93d] mb-1.5 block">Take Profit</span>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step={execPrice > 100 ? 0.01 : 0.00001}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits)}`}
                className="w-full text-sm font-mono py-2.5 px-3 rounded-lg focus:outline-none bg-bg-secondary border border-[#d6a93d]/30 text-[#d6a93d]"
              />
            </div>
          )}

          {/* Trade Insurance — only on market orders */}
          {orderTab === 'market' && activeAccount && (
            <div className="pt-2">
              <InsuranceTierPicker
                accountId={activeAccount.id}
                symbol={selectedSymbol}
                side={side}
                lots={lotsNum}
                leverage={(activeAccount as any).leverage || 100}
                stopLoss={slEnabled && stopLoss ? parseFloat(stopLoss) : undefined}
                takeProfit={tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined}
                onSelect={setInsuranceSelection}
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
                  { label: 'Free Margin', value: `$${freeMargin.toFixed(2)}`, color: !hasEnoughMargin ? '#ef5350' : '#d6a93d' },
                  { label: 'Feed', value: isConnected ? '● Connected' : '○ Disconnected', color: isConnected ? '#d6a93d' : '#f57c00' },
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
                disabled={!hasEnoughMargin || !meetsMinBalance || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen) || !pendingTriggerValid}
                className="w-full py-4 rounded-xl text-[15px] font-black tracking-wide uppercase transition-transform duration-75 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.96]"
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
              <span className="text-[10px] text-text-tertiary">Exec. Price</span>
              <span className="text-xs font-mono font-semibold text-text-primary">
                {execPrice > 0 ? execPrice.toFixed(digits) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 px-1 text-[9px] text-text-tertiary">
              <span className="truncate">Mrgn ${marginRequired.toFixed(2)}</span>
              <span className={clsx('shrink-0 font-mono', hasEnoughMargin ? 'text-[#d6a93d]' : 'text-[#ef5350]')}>
                Free ${freeMargin.toFixed(2)}
              </span>
              <span
                className={clsx('shrink-0 font-mono', isConnected ? 'text-[#d6a93d]' : 'text-[#f57c00]')}
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
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasEnoughMargin || !meetsMinBalance || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen) || !pendingTriggerValid}
              className="w-full py-2.5 rounded-lg text-sm font-black tracking-wide uppercase transition-transform duration-75 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.96]"
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
        onClick={() => setOpen((p) => !p)}
        disabled={saving}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
        title={`Max 1:${maxLev} — click to change`}
      >
        1:{account.leverage}
        <ChevronDown size={10} />
      </button>
      {open && (
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
                    ? 'bg-[#d6a93d]/15 text-[#d6a93d] font-bold'
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
