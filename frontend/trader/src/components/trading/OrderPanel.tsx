'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Minus, Plus, ChevronDown, ChevronLeft, Wifi, WifiOff, Zap, Sun, Moon, Info, TrendingUp, TrendingDown, Gauge } from 'lucide-react';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import api from '@/lib/api/client';
import { sounds, unlockAudio } from '@/lib/sounds';
import { getDigits } from '@/lib/utils';
import { getMarketStatus } from '@/lib/marketHours';
import { wsManager } from '@/lib/ws/wsManager';
import { AnimatedPrice } from '@/components/trading/AnimatedPrice';
import OrderPanelSymbolPicker from '@/components/trading/OrderPanelSymbolPicker';
import InsuranceTierPicker from '@/components/trading/InsuranceTierPicker';
import { insuranceApi, type InsuranceDuration, type InsuranceTier } from '@/lib/api/insurance';
import { TOUR_TARGETS } from '@/components/Onboarding/tourTargets';

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'pending';
type PendingKind = 'limit' | 'stop' | 'stop_limit';

/** One flat row of order types. `tab`/`kind` map straight onto the existing
 *  `orderTab` + `pendingKind` state, so the submit path is unchanged. */
const ORDER_TYPE_TABS: {
  key: string;
  label: string;
  tab: OrderType;
  kind?: PendingKind;
}[] = [
  { key: 'market', label: 'Market', tab: 'market' },
  { key: 'limit', label: 'Limit', tab: 'pending', kind: 'limit' },
  { key: 'stop', label: 'Stop', tab: 'pending', kind: 'stop' },
  { key: 'stop_limit', label: 'Stop-Limit', tab: 'pending', kind: 'stop_limit' },
];


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
  const [insuranceSelection, setInsuranceSelection] = useState<{ tier: InsuranceTier; duration: InsuranceDuration; fee: number } | null>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tick = prices[selectedSymbol];
  const instrumentInfo = instruments.find((i) => i.symbol === selectedSymbol);
  const segment = instrumentInfo?.segment;
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
    // Fully Funded = no leverage: margin equals full notional (÷1), matching
    // the backend (trading_service forces effective_leverage=1). Without this
    // the preview showed the leveraged margin while the server charged the
    // full notional — the toggle looked like it did nothing.
    const lev = fullyFunded ? 1 : (activeAccount.leverage || 1);
    return (lotsNum * contractSize * execPrice) / lev;
  }, [execPrice, lotsNum, activeAccount, contractSize, fullyFunded]);

  const freeMargin = activeAccount?.free_margin || 0;
  const hasEnoughMargin = freeMargin >= marginRequired;

  /* ── Reference-terminal derived values ─────────────────────────────
     Day-change indicator: the first bid seen per symbol this session is the
     reference point (the feed carries no day-open field). */
  const sessionOpenRef = useRef<Record<string, number>>({});
  if (tick && selectedSymbol && sessionOpenRef.current[selectedSymbol] == null) {
    sessionOpenRef.current[selectedSymbol] = tick.bid;
  }
  const dayOpen = selectedSymbol ? sessionOpenRef.current[selectedSymbol] : undefined;
  const pipSize = instrumentInfo?.pip_size ? Number(instrumentInfo.pip_size) : digits >= 4 ? 0.0001 : 0.01;
  const dayChangePts = tick && dayOpen ? Math.round((tick.bid - dayOpen) / pipSize) : 0;
  const spreadPts = tick ? Math.round((tick.ask - tick.bid) / pipSize) : 0;

  const maxLots = Number(instrumentInfo?.max_lot) > 0 ? Number(instrumentInfo?.max_lot) : 100;
  const minLots = Number(instrumentInfo?.min_lot) > 0 ? Number(instrumentInfo?.min_lot) : 0.01;
  const stepPx = execPrice > 100 ? 0.01 : Math.pow(10, -digits);

  /** One flat tab set mapped onto the existing orderTab + pendingKind state. */
  const ticketTab: 'market' | 'limit' | 'stop' | 'stop_limit' =
    orderTab === 'market' ? 'market' : pendingKind;
  const selectTicketTab = (t: 'market' | 'limit' | 'stop' | 'stop_limit') => {
    if (t === 'market') { setOrderTab('market'); return; }
    setOrderTab('pending');
    setPendingKind(t);
  };

  const trig = parseFloat(triggerPrice);
  /** Limit must be better than market, stop must be beyond it — the broker
   *  rule the reference surfaces as a Min/Max value hint. */
  const triggerBound = (() => {
    if (!tick || ticketTab === 'market') return null;
    if (ticketTab === 'limit') {
      return side === 'buy' ? { kind: 'max' as const, v: tick.ask } : { kind: 'min' as const, v: tick.bid };
    }
    return side === 'buy' ? { kind: 'min' as const, v: tick.ask } : { kind: 'max' as const, v: tick.bid };
  })();
  const triggerOutOfBounds =
    !!triggerBound && Number.isFinite(trig) &&
    (triggerBound.kind === 'max' ? trig > triggerBound.v : trig < triggerBound.v);
  const stepTrigger = (d: number) => {
    const base = Number.isFinite(trig) && trig > 0 ? trig : execPrice;
    setTriggerPrice((base + d * stepPx).toFixed(digits));
  };

  const equityVal = Number(activeAccount?.equity ?? 0);
  const balanceVal = Number(activeAccount?.balance ?? 0);
  const creditVal = Number(activeAccount?.credit ?? 0);
  const marginUsedVal = Number(activeAccount?.margin_used ?? 0);
  // equity = balance + credit + gross unrealised P&L
  const floatingPnl = equityVal - balanceVal - creditVal;
  const marginLevelNow = marginUsedVal > 0 ? (equityVal / marginUsedVal) * 100 : null;
  const marginAfter =
    marginUsedVal + marginRequired > 0 ? (equityVal / (marginUsedVal + marginRequired)) * 100 : null;
  const usd = (n: number) =>
    `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

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

      // Note: we no longer swap the optimistic row's id with the real
      // position_id here. The store's refreshPositions does that merge
      // by matching on (account_id, symbol, side, lots) and preserving
      // the optimistic React key, which is what actually prevents the
      // unmount/remount flicker. Swapping the id here would just churn
      // the key between this microtask and the next poll.

      // Insurance — only for market orders that immediately produced a position_id.
      if (insuranceChoice && resp?.position_id) {
        try {
          await insuranceApi.activate(resp.position_id, insuranceChoice.tier, insuranceChoice.duration);
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

  /* ══════════════════════════════════════════════════════════════════
     TERMINAL TICKET
     A direct port of the reference terminal's order panel: no header,
     an angled Sell / spread / Buy strip, a day-change bar, flat order-type
     tabs, card-style price + volume inputs, a lot slider, one TP/SL
     checkbox, then Margin and Assets readouts. FXArtha's own Fully Funded
     and Trade Insurance controls are kept, placed where they fit.
     The dashboard layout below is untouched.
     ══════════════════════════════════════════════════════════════════ */
  if (isTradingTerminal) {
    const submitDisabled =
      !hasEnoughMargin || !meetsMinBalance || !activeAccount ||
      (orderTab === 'market' && !marketStatus.isOpen) || !pendingTriggerValid || triggerOutOfBounds;

    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <div className="px-3 py-3 space-y-2.5">

            {/* ══ Sell ⟋ spread ⟍ Buy ══ */}
            <div data-tour={TOUR_TARGETS.ORDER_BUY_SELL} className="grid grid-cols-[1fr_auto_1fr] items-stretch">
              <button
                type="button"
                onClick={() => setSide('sell')}
                aria-pressed={side === 'sell'}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-l-xl py-1.5 pl-3 pr-6 transition-colors [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]',
                  side === 'sell' ? 'bg-[#E5484D] text-white' : 'bg-card-nested text-text-secondary hover:bg-bg-hover',
                )}
              >
                <span className="text-[11px] font-medium opacity-90 leading-none">Sell</span>
                <AnimatedPrice value={tick?.bid} digits={digits} flash={false} lockWidth placeholder="---" className="text-[15px] font-bold tabular-nums leading-tight" />
              </button>
              <span className="flex items-center justify-center px-1 text-[13px] font-medium tabular-nums text-text-secondary">
                {tick ? spreadPts : '—'}
              </span>
              <button
                type="button"
                onClick={() => setSide('buy')}
                aria-pressed={side === 'buy'}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-r-xl py-1.5 pl-6 pr-3 transition-colors [clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]',
                  side === 'buy' ? 'bg-[#1E66F5] text-white' : 'bg-card-nested text-text-secondary hover:bg-bg-hover',
                )}
              >
                <span className="text-[11px] font-medium opacity-90 leading-none">Buy</span>
                <AnimatedPrice value={tick?.ask} digits={digits} flash={false} lockWidth placeholder="---" className="text-[15px] font-bold tabular-nums leading-tight" />
              </button>
            </div>

            {/* Day change bar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSymbolPickerOpen((o) => !o)}
                className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold leading-none text-text-secondary hover:text-text-primary"
                title="Change symbol"
              >
                <span className={clsx('h-1.5 w-1.5 rounded-full', marketStatus.isOpen ? 'bg-emerald-500' : 'bg-[#f57c00]')} aria-hidden />
                {selectedSymbol}
              </button>
              <div className={clsx('h-[3px] flex-1 rounded-full', dayChangePts >= 0 ? 'bg-emerald-500' : 'bg-[#E5484D]')} />
              <span className={clsx('flex items-center gap-1 text-[11px] font-medium tabular-nums leading-none', dayChangePts >= 0 ? 'text-emerald-500' : 'text-[#E5484D]')}>
                {dayChangePts >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span className="text-text-secondary">{dayChangePts >= 0 ? '+' : ''}{dayChangePts}</span>
              </span>
            </div>
            {symbolPickerOpen && (
              <div className="relative" ref={dropdownRef}>
                <div className="absolute left-0 top-0 z-50 w-full rounded-lg border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden">
                  <OrderPanelSymbolPicker
                    onPick={(sym) => { setSelectedSymbol(sym); setSymbolPickerOpen(false); }}
                  />
                </div>
              </div>
            )}

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
                  {ticketTab === k && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[#ccff00]" />}
                </button>
              ))}
              <span
                className="ml-auto text-text-tertiary"
                title="Market: fills at the current price. Limit: fills at your price or better. Stop: triggers once price passes your level."
              >
                <Info size={15} />
              </span>
            </div>

            {/* Price card */}
            {ticketTab === 'market' ? (
              <div className="rounded-xl bg-card-nested px-3.5 py-2.5 text-[13px] font-medium text-text-tertiary">
                Fill at market price
              </div>
            ) : (
              <div>
                <div className={clsx('flex items-center rounded-xl bg-card-nested px-3.5 py-1.5', triggerOutOfBounds && 'ring-1 ring-[#E5484D]')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-text-tertiary">{ticketTab === 'limit' ? 'Limit Price' : 'Stop Price'}</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={triggerPrice}
                      onChange={(e) => setTriggerPrice(e.target.value)}
                      placeholder={execPrice ? execPrice.toFixed(digits) : '—'}
                      className="ticket-input w-full bg-transparent p-0 text-[15px] font-bold tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none"
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
                  <div className="mt-1.5 flex items-center rounded-xl bg-card-nested px-3.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-text-tertiary">Limit Price</p>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={stopLimitPrice}
                        onChange={(e) => setStopLimitPrice(e.target.value)}
                        placeholder={Number.isFinite(trig) ? (side === 'buy' ? trig * 0.999 : trig * 1.001).toFixed(digits) : '—'}
                        className="ticket-input w-full bg-transparent p-0 text-[16px] font-bold tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Volume card */}
            <div data-tour={TOUR_TARGETS.ORDER_VOLUME} className="flex items-center rounded-xl bg-card-nested px-3.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-text-tertiary">Volume</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lots}
                  onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setLots(v); }}
                  onBlur={() => {
                    const n = parseFloat(lots);
                    if (!Number.isFinite(n) || n <= 0) setLots(minLots.toFixed(2));
                    else setLots(Math.min(n, maxLots).toFixed(2));
                  }}
                  className="ticket-input w-full bg-transparent p-0 text-[18px] font-bold tabular-nums text-text-primary focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => adjustLots(-0.01)} aria-label="Decrease volume" className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover"><Minus size={16} /></button>
                <button type="button" onClick={() => adjustLots(0.01)} aria-label="Increase volume" className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover"><Plus size={16} /></button>
                <span className="ml-1.5 border-l border-border-primary pl-2.5 text-[12px] text-text-primary">Lots</span>
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

            {/* TP / SL */}
            <label data-tour={TOUR_TARGETS.ORDER_SL_TP} className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
              <input
                type="checkbox"
                checked={slEnabled || tpEnabled}
                onChange={(e) => {
                  setSlEnabled(e.target.checked);
                  setTpEnabled(e.target.checked);
                  if (!e.target.checked) { setStopLoss(''); setTakeProfit(''); }
                }}
                className="h-4 w-4 rounded border-border-primary accent-[#ccff00]"
              />
              TP/SL
            </label>
            {(slEnabled || tpEnabled) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-card-nested px-3 py-1.5">
                  <p className="text-[11px] text-text-tertiary">Take Profit</p>
                  <input type="text" inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder={execPrice ? (execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits) : '—'} className="ticket-input w-full bg-transparent p-0 text-[15px] font-bold tabular-nums text-buy placeholder:text-text-tertiary focus:outline-none" />
                </div>
                <div className="rounded-xl bg-card-nested px-3 py-1.5">
                  <p className="text-[11px] text-text-tertiary">Stop Loss</p>
                  <input type="text" inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder={execPrice ? (execPrice * (side === 'buy' ? 0.99 : 1.01)).toFixed(digits) : '—'} className="ticket-input w-full bg-transparent p-0 text-[15px] font-bold tabular-nums text-[#E5484D] placeholder:text-text-tertiary focus:outline-none" />
                </div>
              </div>
            )}

            {/* Fully Funded — FXArtha-only. No leverage, no overnight fee. */}
            <label className={clsx('flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 border', fullyFunded ? 'border-buy/40 bg-buy/10' : 'border-transparent bg-card-nested')} title="No leverage. No overnight cost.">
              <span className="flex flex-col">
                <span className="text-[12px] font-medium text-text-primary">Fully Funded</span>
                <span className="text-[11px] text-text-tertiary leading-tight">No leverage · No overnight fee</span>
              </span>
              <span
                onClick={() => setFullyFunded((p) => !p)}
                className="w-8 h-[18px] rounded-full relative transition-colors cursor-pointer border border-border-primary shrink-0"
                style={{ background: fullyFunded ? 'var(--buy, #16a34a)' : 'var(--bg-secondary)' }}
              >
                <span className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm block" style={{ left: fullyFunded ? '18px' : '3px' }} />
              </span>
            </label>

            {/* Trade Insurance — FXArtha-only, market orders only. */}
            {orderTab === 'market' && activeAccount && (
              <InsuranceTierPicker
                accountId={activeAccount.id}
                symbol={selectedSymbol}
                side={side}
                lots={lotsNum}
                leverage={activeAccount.leverage || 100}
                stopLoss={slEnabled && stopLoss ? parseFloat(stopLoss) : undefined}
                takeProfit={tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined}
                onSelect={setInsuranceSelection}
              />
            )}

            {/* Action */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className={clsx(
                'w-full rounded-xl py-2.5 text-[15px] font-semibold text-white transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
                side === 'buy' ? 'bg-[#1E66F5] hover:bg-[#1a58d6]' : 'bg-[#E5484D] hover:bg-[#d23b40]',
              )}
            >
              {submitting ? 'Placing…' : side === 'buy' ? 'Buy' : 'Sell'}
            </button>
            {!hasEnoughMargin && <p className="text-center text-[12px] font-semibold text-[#E5484D]">Insufficient margin</p>}
            {hasEnoughMargin && !meetsMinBalance && (
              <p className="text-center text-[12px] font-semibold text-[#E5484D]">
                Min ${minDepositGate.toFixed(0)} balance required
              </p>
            )}
            {!marketStatus.isOpen && orderTab === 'market' && (
              <p className="rounded-xl px-3 py-2 text-center text-[12px] text-[#E5484D]" style={{ background: 'rgba(229,72,77,0.1)' }}>
                {marketStatus.reason}
              </p>
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
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {/* ═══ Header ═══ */}
      <div
        className={clsx(
          'shrink-0 flex items-center justify-between gap-2 border-b border-border-primary bg-bg-secondary',
          isTradingTerminal ? 'px-2 py-1.5' : 'px-4 py-2.5',
        )}
      >
        {/* Left lane owns all the flexible width; every control to its right is
            shrink-0, so a long symbol truncates instead of shoving the status
            pill past the panel edge. */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="relative min-w-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setSymbolPickerOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={symbolPickerOpen}
              className={clsx(
                'flex min-w-0 items-center gap-1.5 rounded-lg border border-border-primary/70 bg-bg-base',
                'transition-colors hover:border-accent/40 hover:bg-bg-hover',
                isTradingTerminal ? 'h-7 px-1.5' : 'h-9 px-2.5',
              )}
            >
              <span
                className={clsx('rounded-full shrink-0', isTradingTerminal ? 'w-3 h-3' : 'w-3.5 h-3.5')}
                style={{ background: 'linear-gradient(135deg, #ffb300, #42a5f5)' }}
                aria-hidden
              />
              <span
                className={clsx(
                  'font-bold text-text-primary font-mono truncate min-w-0',
                  isTradingTerminal ? 'text-xs' : 'text-sm',
                )}
              >
                {selectedSymbol}
              </span>
              <ChevronDown
                size={isTradingTerminal ? 12 : 14}
                className={clsx('text-text-tertiary shrink-0 transition-transform', symbolPickerOpen && 'rotate-180')}
              />
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
              {/* The Markets toggle moved to the ticker row's action group, so
                  the header keeps only the symbol + the two live toggles —
                  matching the reference terminal's thin symbol strip. */}
              <button
                type="button"
                title={oneClickTrading ? 'One-click trading on' : 'One-click trading off'}
                aria-label={oneClickTrading ? 'Disable one-click trading' : 'Enable one-click trading'}
                aria-pressed={oneClickTrading}
                onClick={() => setOneClickTrading(!oneClickTrading)}
                className={clsx(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors',
                  oneClickTrading
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                <Zap size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleTheme}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border-secondary text-text-tertiary transition-colors hover:text-text-primary hover:bg-bg-hover"
              >
                {theme === 'dark'
                  ? <Sun size={14} strokeWidth={1.75} />
                  : <Moon size={14} strokeWidth={1.75} />}
              </button>
            </div>
          ) : null}
        </div>

        {/* Market status — one pill instead of loose text + icon, so it can't
            be split or clipped at the panel edge. The label uses
            var(--accent-ink): raw lime is unreadable on the light theme. */}
        <div
          className={clsx(
            'flex shrink-0 items-center gap-1.5 rounded-full border px-2',
            isTradingTerminal ? 'h-7' : 'h-8',
            marketStatus.isOpen
              ? 'border-accent/35 bg-accent/[0.08]'
              : 'border-[#f57c00]/35 bg-[#f57c00]/[0.08]',
          )}
          title={marketStatus.isOpen ? 'Market open' : marketStatus.reason || 'Market closed'}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            {marketStatus.isOpen && isConnected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ccff00] opacity-60" />
            )}
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: marketStatus.isOpen ? '#ccff00' : '#f57c00' }}
            />
          </span>
          <span
            className={clsx(
              'font-bold uppercase tracking-wider whitespace-nowrap',
              isTradingTerminal ? 'text-[9px]' : 'text-[10px]',
            )}
            style={{ color: marketStatus.isOpen ? 'var(--accent-ink)' : '#f57c00' }}
          >
            {marketStatus.isOpen ? 'Open' : 'Closed'}
          </span>
          {isConnected ? (
            <Wifi size={isTradingTerminal ? 11 : 12} className="shrink-0 text-[#ccff00]" />
          ) : (
            <WifiOff size={isTradingTerminal ? 11 : 12} className="shrink-0 text-[#f57c00]" />
          )}
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
          {/* Order type — Market / Limit / Stop / Stop-Limit on ONE row, like
              the reference terminal. These still drive exactly the same two
              pieces of state as before (`orderTab` = market vs pending,
              `pendingKind` = which pending type), so no order logic changes;
              only the control surface is flattened. */}
          <div className="flex items-center gap-0.5 border-b border-border-primary">
            {ORDER_TYPE_TABS.map(({ key, label, tab, kind }) => {
              const active =
                tab === 'market' ? orderTab === 'market' : orderTab === 'pending' && pendingKind === kind;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setOrderTab(tab);
                    if (kind) setPendingKind(kind);
                  }}
                  className={clsx(
                    'relative whitespace-nowrap px-2 pb-1.5 pt-1 font-semibold transition-colors',
                    isTradingTerminal ? 'text-[11px]' : 'text-xs',
                    active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
                  )}
                >
                  {label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-1 -bottom-px h-0.5 rounded-full"
                      style={{ background: isTradingTerminal ? '#2962FF' : '#ccff00' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {orderTab === 'market' && (
            <p className="text-[10px] text-text-tertiary">Fill at market price</p>
          )}

          {/* Sell / Buy — on the terminal this is ONE strip where the chosen
              side is a solid colour block and the spread sits between the two
              prices, matching the reference terminal. Elsewhere (dashboard)
              the original two-card layout is kept. */}
          {isTradingTerminal ? (
            <div
              data-tour={TOUR_TARGETS.ORDER_BUY_SELL}
              className="flex items-stretch overflow-hidden rounded-lg border border-border-primary"
            >
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  side === 'sell'
                    ? 'bg-[#ef5350] text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Sell</span>
                <span className="font-mono text-[17px] font-extrabold leading-none tabular-nums">
                  {tick ? <AnimatedPrice value={tick.bid} digits={digits} flash={false} /> : '---'}
                </span>
              </button>
              <div className="flex w-12 shrink-0 items-center justify-center bg-bg-base font-mono text-[11px] font-bold text-text-tertiary tabular-nums">
                {tick ? (tick.spread / (instrumentInfo?.pip_size || 0.0001)).toFixed(0) : '—'}
              </div>
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  side === 'buy'
                    ? 'bg-[#2962FF] text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Buy</span>
                <span className="font-mono text-[17px] font-extrabold leading-none tabular-nums">
                  {tick ? <AnimatedPrice value={tick.ask} digits={digits} flash={false} /> : '---'}
                </span>
              </button>
            </div>
          ) : (
          <div data-tour={TOUR_TARGETS.ORDER_BUY_SELL} className={clsx('grid grid-cols-2', isTradingTerminal ? 'gap-1.5' : 'gap-2')}>
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
                <div className={clsx('font-mono font-bold', isTradingTerminal ? 'text-[13px]' : 'text-[15px]', side === 'sell' && 'text-red-400')}>{tick ? <AnimatedPrice value={tick.bid} digits={digits} flash={false} /> : '---'}</div>
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
                <div className={clsx('font-mono font-bold', isTradingTerminal ? 'text-[13px]' : 'text-[15px]', side === 'buy' && 'text-[#2962FF]')}>{tick ? <AnimatedPrice value={tick.ask} digits={digits} flash={false} /> : '---'}</div>
                <div className={clsx('text-text-tertiary', isTradingTerminal ? 'text-[8px] mt-0.5' : 'text-[9px] mt-1')}>Ask</div>
             </button>
          </div>
          )}

          {/* Spread pill — only the dashboard layout needs it; on the terminal
              the spread already sits between the Sell and Buy prices. */}
          {!isTradingTerminal && tick && (
             <div className="flex items-center justify-center -mt-2">
                <span className="font-mono px-2 py-0.5 rounded-full bg-bg-secondary text-text-tertiary border border-border-primary text-[10px]">
                  Spread: {(tick.spread / (instrumentInfo?.pip_size || 0.0001)).toFixed(1)}
                </span>
             </div>
          )}

          {/* SL / TP toggles */}
          <div data-tour={TOUR_TARGETS.ORDER_SL_TP} className={clsx('flex items-center', isTradingTerminal ? 'gap-3 pt-1' : 'gap-5 pt-2')}>
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
                style={{ background: tpEnabled ? '#ccff00' : 'var(--bg-secondary)' }}
              >
                <div className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: tpEnabled ? '18px' : '3px' }} />
              </div>
              <span className="text-[10px] uppercase font-semibold text-text-secondary">TP</span>
            </label>
            {activeAccount && (
              <LeveragePicker
                account={activeAccount}
                fullyFunded={fullyFunded}
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
          <div data-tour={TOUR_TARGETS.ORDER_VOLUME} className={isTradingTerminal ? 'pt-1' : 'pt-2'}>
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
            {/* The lot slider is part of the terminal ticket above; the
                dashboard panel keeps the stepper + quick chips. */}
          </div>

          {/* Pending order — trigger price (+ stop-limit target). Only renders
              on a pending tab; the type itself is now picked in the flat
              order-type row at the top. */}
          {orderTab === 'pending' && (
            <div className="pt-2 space-y-2">
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#ccff00] mb-1.5 block">Take Profit</span>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step={execPrice > 100 ? 0.01 : 0.00001}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits)}`}
                className="w-full text-sm font-mono py-2.5 px-3 rounded-lg focus:outline-none bg-bg-secondary border border-[#ccff00]/30 text-[#ccff00]"
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
                leverage={activeAccount.leverage || 100}
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
                  { label: 'Free Margin', value: `$${freeMargin.toFixed(2)}`, color: !hasEnoughMargin ? '#ef5350' : '#ccff00' },
                  { label: 'Feed', value: isConnected ? '● Connected' : '○ Disconnected', color: isConnected ? '#ccff00' : '#f57c00' },
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
            {/* Exec price / margin / free margin used to be repeated here; they
                now live in the Margin + Assets readouts above, so the footer is
                just the action button (kept sticky so it's always reachable). */}
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
              className="w-full py-3 rounded-lg text-[15px] font-bold tracking-wide transition-transform duration-75 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: side === 'buy' ? '#2962FF' : '#ef5350',
                color: '#fff',
                boxShadow: side === 'buy' ? '0 2px 12px rgba(41,98,255,0.2)' : '0 2px 12px rgba(239,83,80,0.2)',
              }}
            >
              {side === 'buy' ? 'Buy' : 'Sell'}
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
  fullyFunded = false,
}: {
  account: TradingAccount;
  onChanged: () => void;
  fullyFunded?: boolean;
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
        onClick={() => { if (!fullyFunded) setOpen((p) => !p); }}
        disabled={saving || fullyFunded}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
        title={fullyFunded ? 'Fully Funded — no leverage (1:1)' : `Max 1:${maxLev} — click to change`}
      >
        1:{fullyFunded ? 1 : account.leverage}
        {!fullyFunded && <ChevronDown size={10} />}
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
                    ? 'bg-[#ccff00]/15 text-[#ccff00] font-bold'
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
