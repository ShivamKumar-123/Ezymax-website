'use client';

/**
 * ChartExitsPanel — the TradingView-style "Exits" review that replaces the
 * order ticket in the terminal sidebar while the user is editing a
 * position from the chart:
 *
 *   • Drag the TP / SL line on the chart → the new levels land here with
 *     projected P&L, risk/reward and position info → Confirm (PUT) or
 *     Discard (lines snap back).
 *   • Press ✕ on the position line → a close review with live P&L →
 *     Confirm closes at market.
 *
 * Levels are also editable as numbers here (typed changes move the chart
 * lines through the store → chart effect).
 */

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, Crosshair, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useTradingStore, type Position } from '@/stores/tradingStore';

const usd = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;

function projectedNet(p: Position, price: number, contractSize: number, quoteToUsd: (v: number, price: number) => number): number {
  const gross = p.side === 'buy'
    ? (price - Number(p.open_price)) * Number(p.lots) * contractSize
    : (Number(p.open_price) - price) * Number(p.lots) * contractSize;
  return quoteToUsd(gross, price) - (Number(p.commission) || 0) + (Number(p.swap) || 0);
}

export default function ChartExitsPanel() {
  const draft = useTradingStore((s) => s.chartExitsDraft);
  const closeReq = useTradingStore((s) => s.chartCloseRequest);
  const positions = useTradingStore((s) => s.positions);
  const instruments = useTradingStore((s) => s.instruments);
  const prices = useTradingStore((s) => s.prices);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const setDraft = useTradingStore((s) => s.setChartExitsDraft);
  const setCloseReq = useTradingStore((s) => s.setChartCloseRequest);
  const bumpReset = useTradingStore((s) => s.bumpChartLinesReset);
  const updatePosition = useTradingStore((s) => s.updatePosition);
  const removePosition = useTradingStore((s) => s.removePosition);
  const refreshPositions = useTradingStore((s) => s.refreshPositions);
  const refreshAccount = useTradingStore((s) => s.refreshAccount);
  const resolvePositionId = useTradingStore((s) => s.resolvePositionId);

  const positionId = draft?.positionId ?? closeReq ?? null;
  const p = positions.find((x) => x.id === positionId) ?? null;
  const inst = p ? instruments.find((i) => i.symbol.toUpperCase() === p.symbol.toUpperCase()) : undefined;
  const digits = inst?.digits ?? 2;
  const cs = Number(inst?.contract_size) || 100000;
  const tick = p ? prices[p.symbol.toUpperCase()] : undefined;
  const mark = p && tick ? (p.side === 'buy' ? tick.bid : tick.ask) : p ? Number(p.current_price) || Number(p.open_price) : 0;

  const quoteToUsd = useMemo(() => {
    const quote = String(inst?.quote_currency || (p?.symbol ?? '').slice(3, 6)).toUpperCase();
    const base = String(inst?.base_currency || (p?.symbol ?? '').slice(0, 3)).toUpperCase();
    return (v: number, price: number) => {
      if (!quote || quote === 'USD') return v;
      if (base === 'USD' && price) return v / price;
      const usdQ = prices[`USD${quote}`]; if (usdQ?.bid) return v / usdQ.bid;
      const qUsd = prices[`${quote}USD`]; if (qUsd?.bid) return v * qUsd.bid;
      return v;
    };
  }, [inst, p?.symbol, prices]);

  // Effective levels: draft overrides server; `null` = removed.
  const tp = draft && draft.takeProfit !== undefined ? draft.takeProfit : (p?.take_profit != null && Number(p.take_profit) > 0 ? Number(p.take_profit) : null);
  const sl = draft && draft.stopLoss !== undefined ? draft.stopLoss : (p?.stop_loss != null && Number(p.stop_loss) > 0 ? Number(p.stop_loss) : null);

  const [tpText, setTpText] = useState('');
  const [slText, setSlText] = useState('');
  useEffect(() => { setTpText(tp != null ? tp.toFixed(digits) : ''); }, [tp, digits]);
  useEffect(() => { setSlText(sl != null ? sl.toFixed(digits) : ''); }, [sl, digits]);
  const [busy, setBusy] = useState(false);

  if (!p) return null;

  const tpPnl = tp != null ? projectedNet(p, tp, cs, quoteToUsd) : null;
  const slPnl = sl != null ? projectedNet(p, sl, cs, quoteToUsd) : null;
  const rr = tpPnl != null && slPnl != null && slPnl < 0 ? tpPnl / Math.abs(slPnl) : null;
  const tradeValue = Number(p.open_price) * Number(p.lots) * cs;
  const pct = (v: number | null) => (v == null || !(tradeValue > 0) ? null : (v / tradeValue) * 100);
  const livePnl = Number(p.profit) - (Number(p.commission) || 0) + (Number(p.swap) || 0);

  // Validation mirrors the server: TP must be on the profit side, SL on the loss side.
  const tpBad = tp != null && (p.side === 'buy' ? tp <= mark : tp >= mark);
  const slBad = sl != null && (p.side === 'buy' ? sl >= mark : sl <= mark);
  const changed = !!draft && (draft.takeProfit !== undefined || draft.stopLoss !== undefined);

  const commitLevel = (kind: 'tp' | 'sl', raw: string) => {
    const v = raw.trim() === '' ? null : Number(raw);
    if (v !== null && !(v > 0)) { toast.error('Invalid price'); return; }
    setDraft({ positionId: p.id, ...(draft ?? {}), ...(kind === 'tp' ? { takeProfit: v } : { stopLoss: v }) });
  };

  const discard = () => { setDraft(null); setCloseReq(null); bumpReset(); };

  const confirmExits = async () => {
    if (!draft || busy) return;
    if (tpBad || slBad) { toast.error('Level is on the wrong side of the market'); return; }
    setBusy(true);
    const patch: Record<string, number | null> = {};
    if (draft.takeProfit !== undefined) patch.take_profit = draft.takeProfit;
    if (draft.stopLoss !== undefined) patch.stop_loss = draft.stopLoss;
    try {
      // The row is still keyed/updated by its DISPLAYED id (may briefly be
      // the optimistic "optim-…" one) so the store patch lands on the right
      // row, but the request URL needs the REAL server id the chart's
      // readiness check already confirmed exists — submitting the fake id
      // would 422.
      updatePosition(p.id, { take_profit: patch.take_profit === undefined ? p.take_profit : (patch.take_profit ?? undefined), stop_loss: patch.stop_loss === undefined ? p.stop_loss : (patch.stop_loss ?? undefined) });
      await api.put(`/positions/${resolvePositionId(p.id)}`, patch);
      toast.success('Exits updated');
      setDraft(null);
      await refreshPositions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update exits');
      bumpReset();
      try { await refreshPositions(); } catch { /* ignore */ }
    } finally {
      setBusy(false);
    }
  };

  const confirmClose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      removePosition(p.id);
      const res = await api.post<{ profit?: number; close_price?: number }>(`/positions/${resolvePositionId(p.id)}/close`, {}, { timeoutMs: 8000 });
      const pnl = Number(res?.profit ?? 0);
      toast.success(`Closed @ ${res?.close_price ?? ''} | ${usd(pnl)}`);
      setCloseReq(null); setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Close failed');
    } finally {
      setBusy(false);
      Promise.all([refreshPositions(), refreshAccount()]).catch(() => {});
    }
  };

  const sideLabel = p.side === 'buy' ? 'Long' : 'Short';
  const isClose = !!closeReq && !draft;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-base">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2.5 pb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">{isClose ? 'Close position' : 'Exits'}</p>
          <p className="text-[15px] font-bold leading-tight text-text-primary">
            <span className={p.side === 'buy' ? 'text-buy' : 'text-sell'}>{sideLabel}</span> {Number(p.lots)} {p.symbol.toUpperCase()} @ {Number(p.open_price).toFixed(digits)}
          </p>
        </div>
        <button type="button" onClick={discard} className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover hover:text-text-primary" aria-label="Discard"><X size={16} /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
        {/* Live mark + P&L */}
        <div className="rounded-xl px-3.5 py-2" style={{ background: 'var(--bg-card-nested)' }}>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-text-tertiary">Mark</span>
            <span className="font-semibold tabular-nums text-text-primary">{mark ? mark.toFixed(digits) : '—'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px]">
            <span className="text-text-tertiary">Open P&amp;L</span>
            <span className={clsx('font-bold tabular-nums', livePnl >= 0 ? 'text-emerald-500' : 'text-[#E5484D]')}>{usd(livePnl)}</span>
          </div>
        </div>

        {!isClose && (
          <>
            <div className="flex items-center justify-between px-0.5 pt-1 text-[12px]">
              <span className="font-semibold text-text-primary">Exits</span>
              <span className="text-text-tertiary">Risk / Reward <span className="font-semibold text-text-primary">{rr != null ? rr.toFixed(2) : '—'}</span></span>
            </div>

            {/* TP */}
            <div className={clsx('rounded-xl px-3.5 py-2 ring-1', tpBad ? 'ring-[#E5484D]' : 'ring-transparent')} style={{ background: 'var(--bg-card-nested)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-tertiary">Take Profit</p>
                {tpPnl != null && <p className={clsx('text-[11px] font-semibold tabular-nums', tpPnl >= 0 ? 'text-emerald-500' : 'text-[#E5484D]')}>{usd(tpPnl)}{pct(tpPnl) != null ? ` · ${pct(tpPnl)!.toFixed(2)}%` : ''}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={tpText}
                  onChange={(e) => setTpText(e.target.value)}
                  onBlur={() => commitLevel('tp', tpText)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitLevel('tp', tpText); }}
                  inputMode="decimal"
                  placeholder="Not set"
                  className="ticket-input w-full border-0 bg-transparent p-0 pt-0.5 text-[15px] font-bold tabular-nums text-buy shadow-none outline-none placeholder:font-medium placeholder:text-text-tertiary focus:ring-0"
                />
                {tp != null && (
                  <button type="button" onClick={() => commitLevel('tp', '')} className="shrink-0 rounded-full p-1 text-text-tertiary hover:bg-bg-hover hover:text-[#E5484D]" title="Remove take profit"><Trash2 size={14} /></button>
                )}
              </div>
              {tpBad && <p className="mt-1 flex items-center gap-1 text-[11px] text-[#E5484D]"><AlertCircle size={12} /> Must be {p.side === 'buy' ? 'above' : 'below'} the market</p>}
            </div>

            {/* SL */}
            <div className={clsx('rounded-xl px-3.5 py-2 ring-1', slBad ? 'ring-[#E5484D]' : 'ring-transparent')} style={{ background: 'var(--bg-card-nested)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-tertiary">Stop Loss</p>
                {slPnl != null && <p className={clsx('text-[11px] font-semibold tabular-nums', slPnl >= 0 ? 'text-emerald-500' : 'text-[#E5484D]')}>{usd(slPnl)}{pct(slPnl) != null ? ` · ${pct(slPnl)!.toFixed(2)}%` : ''}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={slText}
                  onChange={(e) => setSlText(e.target.value)}
                  onBlur={() => commitLevel('sl', slText)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitLevel('sl', slText); }}
                  inputMode="decimal"
                  placeholder="Not set"
                  className="ticket-input w-full border-0 bg-transparent p-0 pt-0.5 text-[15px] font-bold tabular-nums text-[#E5484D] shadow-none outline-none placeholder:font-medium placeholder:text-text-tertiary focus:ring-0"
                />
                {sl != null && (
                  <button type="button" onClick={() => commitLevel('sl', '')} className="shrink-0 rounded-full p-1 text-text-tertiary hover:bg-bg-hover hover:text-[#E5484D]" title="Remove stop loss"><Trash2 size={14} /></button>
                )}
              </div>
              {slBad && <p className="mt-1 flex items-center gap-1 text-[11px] text-[#E5484D]"><AlertCircle size={12} /> Must be {p.side === 'buy' ? 'below' : 'above'} the market</p>}
            </div>

            <p className="flex items-center gap-1.5 px-0.5 text-[11px] text-text-tertiary"><Crosshair size={12} /> Drag the TP / SL lines on the chart, or type the levels here.</p>
          </>
        )}

        {/* Position info */}
        <div className="pt-1">
          <p className="px-0.5 text-[12px] font-semibold text-text-primary">Position info</p>
          <dl className="mt-1 text-[12px] leading-none">
            {[
              ['Leverage', activeAccount ? `1:${activeAccount.leverage}` : '—'],
              ['Trade value', `$${tradeValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`],
              ['Reward', tpPnl != null ? `${pct(tpPnl)!.toFixed(2)}% / ${usd(tpPnl)}` : '—'],
              ['Risk', slPnl != null ? `${pct(slPnl)!.toFixed(2)}% / ${usd(slPnl)}` : '—'],
              ['Commission', `$${(Number(p.commission) || 0).toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-[3.5px]">
                <dt className="text-text-tertiary underline decoration-dotted decoration-border-primary underline-offset-4">{k}</dt>
                <dd className="tabular-nums font-medium text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Actions — pinned at the bottom, where the Buy/Sell button lives */}
      <div className="shrink-0 space-y-2 border-t border-border-primary p-3">
        {isClose ? (
          <button type="button" onClick={() => { void confirmClose(); }} disabled={busy} className="w-full rounded-xl bg-[#E5484D] py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45">
            {busy ? 'Closing…' : `Close ${sideLabel.toLowerCase()} at market`}
          </button>
        ) : (
          <button type="button" onClick={() => { void confirmExits(); }} disabled={busy || !changed || tpBad || slBad} className="w-full rounded-xl bg-accent py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45">
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        )}
        <button type="button" onClick={discard} disabled={busy} className="w-full rounded-xl border border-border-primary py-2.5 text-[15px] font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-45">
          Discard
        </button>
      </div>
    </div>
  );
}
