'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Minus, Plus, ChevronDown, ChevronLeft, Wifi, WifiOff, Zap } from 'lucide-react';
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

  const {
    selectedSymbol,
    setSelectedSymbol,
    prices,
    instruments,
    activeAccount,
    refreshPositions,
    refreshAccount,
    orderFormCloneDraft,
    setOrderFormCloneDraft,
  } = useTradingStore();
  const setTerminalMarketsOpen = useUIStore((s) => s.setTerminalMarketsOpen);
  const setTerminalNewsOpen = useUIStore((s) => s.setTerminalNewsOpen);

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderTab, setOrderTab] = useState<OrderType>('market');
  const [lots, setLots] = useState(0.01);
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

  const execPrice = tick ? (side === 'buy' ? tick.ask : tick.bid) : 0;

  const marginRequired = useMemo(() => {
    if (!execPrice || !activeAccount) return 0;
    return (lots * contractSize * execPrice) / activeAccount.leverage;
  }, [execPrice, lots, activeAccount, contractSize]);

  const freeMargin = activeAccount?.free_margin || 0;
  const hasEnoughMargin = freeMargin >= marginRequired;

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
    setLots(Math.max(0.01, Number(d.lots.toFixed(4))));
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
    setLots((prev) => parseFloat(Math.max(0.01, prev + delta).toFixed(2)));
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
    setSubmitting(true);
    try {
      await api.post('/orders/', {
        account_id: activeAccount.id,
        symbol: selectedSymbol,
        order_type: orderTab === 'market' ? 'market' : 'limit',
        side,
        lots,
        stop_loss: slEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
        take_profit: tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined,
      });
      sounds.orderPlaced();
      toast.success(`${side.toUpperCase()} ${lots} ${selectedSymbol}`);
      refreshPositions();
      refreshAccount();
    } catch (e: any) {
      toast.error(e.message || 'Order failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isConnected = wsStatus === 'connected';

  const pad = isTradingTerminal ? 'px-2 py-2 space-y-2' : 'p-4 space-y-4';
  const tabPad = isTradingTerminal ? 'py-1 text-[11px]' : 'py-1.5 text-xs';
  const obPad = isTradingTerminal ? 'py-2' : 'py-3';
  const volBtn = isTradingTerminal ? 'w-8 h-8' : 'w-10 h-10';
  const volIn = isTradingTerminal ? 'py-1.5 text-sm' : 'py-2.5 text-base';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* ═══ Header ═══ */}
      <div
        className={clsx('shrink-0 flex items-center justify-between border-b border-[#1a1a1a] bg-[#0e0e0e]', isTradingTerminal ? 'px-2 py-2' : 'px-4 py-2.5')}
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
                  'font-bold text-white font-mono truncate',
                  isTradingTerminal ? 'text-xs' : 'text-sm',
                )}
              >
                {selectedSymbol}
              </span>
              {!isTradingTerminal ? (
                <ChevronDown
                  size={14}
                  className={clsx('text-[#555] shrink-0 transition-transform', symbolPickerOpen && 'rotate-180')}
                />
              ) : (
                <ChevronDown
                  size={12}
                  className={clsx('text-[#555] shrink-0 transition-transform', symbolPickerOpen && 'rotate-180')}
                />
              )}
            </button>
            {symbolPickerOpen && (
              <div className="absolute top-full left-0 z-50 w-64 mt-1 rounded-lg border border-[#1a1a1a] shadow-2xl bg-[#0e0e0e] overflow-hidden">
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
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#2962FF]/40 text-[#2962FF] hover:bg-[#2962FF]/12 transition-colors"
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
                    ? 'border-[#5eb3ff]/50 bg-[#1e3a5f] text-[#5eb3ff]'
                    : 'border-[#333] text-white/50 hover:text-white hover:bg-white/[0.06]',
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
              style={{ color: marketStatus.isOpen ? '#00e676' : '#f57c00' }}
            >
              {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            {isConnected ? (
              <Wifi size={isTradingTerminal ? 11 : 12} className="text-[#00e676]" />
            ) : (
              <WifiOff size={isTradingTerminal ? 11 : 12} className="text-[#f57c00]" />
            )}
          </div>
        </div>
      </div>

      {isTradingTerminal ? (
        <div className="h-px w-full shrink-0 bg-[#2962FF]" aria-hidden />
      ) : null}

      <div
        className={clsx('flex-1 min-h-0 flex flex-col', isTradingTerminal && 'overflow-hidden')}
        style={{ background: '#0a0a0a' }}
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
          <div className="flex rounded-md overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            {(['market', 'pending'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderTab(t)}
                className={clsx('flex-1 font-semibold capitalize transition-all', tabPad)}
                style={{
                  background: orderTab === t ? '#1a1a1a' : 'transparent',
                  color: orderTab === t ? '#fff' : '#666',
                  borderBottom:
                    orderTab === t
                      ? `2px solid ${isTradingTerminal ? '#2962FF' : '#00e676'}`
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
                  background: side === 'sell' ? 'rgba(239,83,80,0.15)' : '#111',
                  border: side === 'sell' ? '1px solid #ef5350' : '1px solid #1e1e1e',
                  color: side === 'sell' ? '#ef5350' : '#888',
                }}
             >
                <div className={clsx('font-bold uppercase tracking-wider', isTradingTerminal ? 'text-[10px] mb-0' : 'text-sm mb-0.5')}>Sell</div>
                <div className={clsx('font-mono font-bold', isTradingTerminal ? 'text-[13px]' : 'text-[15px]', side === 'sell' && 'text-red-400')}>{tick ? tick.bid.toFixed(digits) : '---'}</div>
                <div className={clsx('text-[#666]', isTradingTerminal ? 'text-[8px] mt-0.5' : 'text-[9px] mt-1')}>Bid</div>
             </button>
             <button
                type="button"
                onClick={() => setSide('buy')}
                className={clsx(obPad, 'rounded-lg flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98]')}
                style={{
                  background: side === 'buy' ? 'rgba(0,230,118,0.15)' : '#111',
                  border: side === 'buy' ? '1px solid #00e676' : '1px solid #1e1e1e',
                  color: side === 'buy' ? '#00e676' : '#888',
                }}
             >
                <div className={clsx('font-bold uppercase tracking-wider', isTradingTerminal ? 'text-[10px] mb-0' : 'text-sm mb-0.5')}>Buy</div>
                <div className={clsx('font-mono font-bold', isTradingTerminal ? 'text-[13px]' : 'text-[15px]', side === 'buy' && 'text-[#00e676]')}>{tick ? tick.ask.toFixed(digits) : '---'}</div>
                <div className={clsx('text-[#666]', isTradingTerminal ? 'text-[8px] mt-0.5' : 'text-[9px] mt-1')}>Ask</div>
             </button>
          </div>

          {/* Spread */}
          {tick && (
             <div className={clsx('flex items-center justify-center', isTradingTerminal ? '-mt-1' : '-mt-2')}>
                <span className={clsx('font-mono px-2 py-0.5 rounded-full bg-[#111] text-[#666] border border-[#1e1e1e]', isTradingTerminal ? 'text-[9px]' : 'text-[10px]')}>
                  Spread: {(tick.spread / (instrumentInfo?.pip_size || 0.0001)).toFixed(1)}
                </span>
             </div>
          )}

          {/* SL / TP toggles */}
          <div className={clsx('flex items-center', isTradingTerminal ? 'gap-3 pt-1' : 'gap-5 pt-2')}>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => { setSlEnabled((p) => !p); if (slEnabled) setStopLoss(''); }}
                className="w-8 h-[18px] rounded-full relative transition-colors cursor-pointer border border-[#2a2a2a]"
                style={{ background: slEnabled ? '#ef5350' : '#111' }}
              >
                <div className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: slEnabled ? '18px' : '3px' }} />
              </div>
              <span className="text-[10px] uppercase font-semibold text-[#888]">SL</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => { setTpEnabled((p) => !p); if (tpEnabled) setTakeProfit(''); }}
                className="w-8 h-[18px] rounded-full relative transition-colors cursor-pointer border border-[#2a2a2a]"
                style={{ background: tpEnabled ? '#00e676' : '#111' }}
              >
                <div className="absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: tpEnabled ? '18px' : '3px' }} />
              </div>
              <span className="text-[10px] uppercase font-semibold text-[#888]">TP</span>
            </label>
            {activeAccount && (
              <div className="ml-auto text-[10px] font-mono text-[#888] font-semibold">1:{activeAccount.leverage}</div>
            )}
          </div>

          {/* Volume */}
          <div className={isTradingTerminal ? 'pt-1' : 'pt-2'}>
            <div className={clsx('flex items-center justify-between', isTradingTerminal ? 'mb-1' : 'mb-1.5')}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666]">Volume</span>
              <div className="flex gap-0.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: '#1a1a1a', color: '#aaa' }}>Lots</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-[#444] hover:text-[#888] cursor-pointer transition-colors">Units</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => adjustLots(-0.01)}
                className={clsx(volBtn, 'rounded-lg flex items-center justify-center transition-colors text-[#888] hover:text-white')}
                style={{ background: '#111', border: '1px solid #222' }}
              >
                <Minus size={isTradingTerminal ? 12 : 14} />
              </button>
              <input
                type="number"
                value={lots}
                onChange={(e) => setLots(parseFloat(e.target.value) || 0.01)}
                step={0.01}
                min={0.01}
                className={clsx('flex-1 text-center font-mono font-bold rounded-lg focus:outline-none', volIn)}
                style={{ background: '#111', border: '1px solid #222', color: '#fff' }}
              />
              <button
                type="button"
                onClick={() => adjustLots(0.01)}
                className={clsx(volBtn, 'rounded-lg flex items-center justify-center transition-colors text-[#888] hover:text-white')}
                style={{ background: '#111', border: '1px solid #222' }}
              >
                <Plus size={isTradingTerminal ? 12 : 14} />
              </button>
            </div>
          </div>

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
                className="w-full text-sm font-mono py-2.5 px-3 rounded-lg focus:outline-none"
                style={{ background: '#111', border: '1px solid rgba(239,83,80,0.3)', color: '#ef5350' }}
              />
            </div>
          )}

          {/* TP input */}
          {tpEnabled && (
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00e676] mb-1.5 block">Take Profit</span>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step={execPrice > 100 ? 0.01 : 0.00001}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits)}`}
                className="w-full text-sm font-mono py-2.5 px-3 rounded-lg focus:outline-none"
                style={{ background: '#111', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }}
              />
            </div>
          )}

          {!isTradingTerminal ? (
            <>
              <div className="py-2" />
              <div className="rounded-xl p-3 space-y-2" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                {[
                  { label: 'Exec. Price', value: execPrice > 0 ? execPrice.toFixed(digits) : '—', color: '#fff' },
                  { label: 'Margin Required', value: `$${marginRequired.toFixed(2)}`, color: !hasEnoughMargin ? '#ef5350' : '#888' },
                  { label: 'Free Margin', value: `$${freeMargin.toFixed(2)}`, color: !hasEnoughMargin ? '#ef5350' : '#00e676' },
                  { label: 'Feed', value: isConnected ? '● Connected' : '○ Disconnected', color: isConnected ? '#00e676' : '#f57c00' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: '#666' }}>{row.label}</span>
                    <span className="text-[11px] font-mono font-semibold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
                {!hasEnoughMargin && (
                  <div className="text-[11px] text-red-500 font-bold text-center pt-2 mt-2" style={{ borderTop: '1px solid rgba(239,83,80,0.15)' }}>
                    ⚠ Insufficient margin
                  </div>
                )}
              </div>
              <div className="py-2" />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !hasEnoughMargin || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen)}
                className="w-full py-4 rounded-xl text-[15px] font-black tracking-wide uppercase transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{
                  background: side === 'buy' ? '#00e676' : '#ef5350',
                  color: side === 'buy' ? '#000' : '#fff',
                  boxShadow: side === 'buy' ? '0 4px 20px rgba(0,230,118,0.2)' : '0 4px 20px rgba(239,83,80,0.2)',
                }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing
                  </span>
                ) : (
                  `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedSymbol}`
                )}
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
          <div className="shrink-0 border-t border-[#1a1a1a] bg-[#080808] px-2 pt-2 pb-2 space-y-1.5">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-[#111] border border-[#222]">
              <span className="text-[10px] text-[#666]">Exec. Price</span>
              <span className="text-xs font-mono font-semibold text-white">
                {execPrice > 0 ? execPrice.toFixed(digits) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 px-1 text-[9px] text-[#666]">
              <span className="truncate">Mrgn ${marginRequired.toFixed(2)}</span>
              <span className={clsx('shrink-0 font-mono', hasEnoughMargin ? 'text-[#00e676]' : 'text-[#ef5350]')}>
                Free ${freeMargin.toFixed(2)}
              </span>
              <span
                className={clsx('shrink-0 font-mono', isConnected ? 'text-[#00e676]' : 'text-[#f57c00]')}
                title={isConnected ? 'Feed connected' : 'Feed disconnected'}
              >
                {isConnected ? '●' : '○'}
              </span>
            </div>
            {!hasEnoughMargin && (
              <div className="text-[10px] text-red-500 font-semibold text-center leading-tight">Insufficient margin</div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !hasEnoughMargin || !activeAccount || (orderTab === 'market' && !marketStatus.isOpen)}
              className="w-full py-2.5 rounded-lg text-sm font-black tracking-wide uppercase transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: side === 'buy' ? '#00e676' : '#ef5350',
                color: side === 'buy' ? '#000' : '#fff',
                boxShadow: side === 'buy' ? '0 2px 12px rgba(0,230,118,0.2)' : '0 2px 12px rgba(239,83,80,0.2)',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing
                </span>
              ) : (
                `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedSymbol}`
              )}
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
