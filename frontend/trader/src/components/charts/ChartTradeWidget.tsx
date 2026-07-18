'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTradingStore } from '@/stores/tradingStore';
import { sounds } from '@/lib/sounds';

/**
 * On-chart quick-trade widget (like the reference platform's chart buy/sell):
 * live SELL (bid, red) and BUY (ask, blue) prices with the spread between them,
 * plus a small lot input. Clicking places a MARKET order on the active account
 * for the charted symbol via the shared store action — the resulting position
 * then shows on the chart (pill + lines) and keeps showing until closed.
 */
export function ChartTradeWidget() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
  const tick = useTradingStore((s) => s.prices[sym]);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const placeOrder = useTradingStore((s) => s.placeOrder);
  const instruments = useTradingStore((s) => s.instruments);

  const [lots, setLots] = useState(0.01);
  const [busy, setBusy] = useState(false);

  const inst = instruments.find((i) => String(i.symbol).toUpperCase() === sym);
  const digits = inst?.digits ?? (sym.endsWith('JPY') ? 3 : sym.includes('USD') && !/^[A-Z]{6}$/.test(sym) ? 2 : 5);

  const bid = tick?.bid;
  const ask = tick?.ask;

  const fmt = (v?: number) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits));

  const trade = async (side: 'buy' | 'sell') => {
    if (busy) return;
    if (!activeAccount?.id) {
      toast.error('Select an account first');
      return;
    }
    const lot = Math.max(0.01, Number(lots) || 0.01);
    // Fire the click sound BEFORE the request, like the order panel does — the
    // tap should feel synchronous instead of waiting on the server round-trip.
    // (The success toast still waits for the API, so a rejected order never
    // shows a fake confirmation.)
    sounds.orderPlaced();
    setBusy(true);
    try {
      await placeOrder({ account_id: activeAccount.id, symbol: sym, side, order_type: 'market', lots: lot });
      toast.success(`${side.toUpperCase()} ${lot} ${sym} @ ${fmt(side === 'buy' ? ask : bid)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto flex items-stretch gap-1 select-none">
      <button
        type="button"
        disabled={busy || bid == null}
        onClick={() => trade('sell')}
        className="flex flex-col items-center justify-center rounded-md bg-rose-500 hover:bg-rose-400 px-3 py-1 text-white shadow-lg disabled:opacity-60 transition-colors"
        title="Sell at market"
      >
        <span className="text-sm font-extrabold leading-none">{fmt(bid)}</span>
        <span className="text-[10px] font-bold tracking-wider">SELL</span>
      </button>

      {/* Lot input sits between SELL and BUY (typing only — no stepper arrows). */}
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        value={lots}
        onChange={(e) => setLots(Math.max(0.01, Number(e.target.value) || 0.01))}
        className="w-16 self-stretch rounded-md bg-black/60 text-white text-xs px-1 text-center border border-white/20 focus:outline-none focus:border-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
        title="Lot size"
        aria-label="Lot size"
      />

      <button
        type="button"
        disabled={busy || ask == null}
        onClick={() => trade('buy')}
        className="flex flex-col items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1 text-white shadow-lg disabled:opacity-60 transition-colors"
        title="Buy at market"
      >
        <span className="text-sm font-extrabold leading-none">{fmt(ask)}</span>
        <span className="text-[10px] font-bold tracking-wider">BUY</span>
      </button>
    </div>
  );
}
