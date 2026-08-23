'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { History, LineChart } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { netPnl } from '@/lib/pnl';
import { formatDateTime, formatNumber } from '@/lib/formatters';
import { aiApi, type AiClosedTrade, type AiOpenTrade } from '@/lib/ai-strategies';
import Pagination, { usePagination } from '@/components/ui/Pagination';

function SideBadge({ side }: { side: string }) {
  const isBuy = String(side).toLowerCase() === 'buy';
  return (
    <span className={clsx('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', isBuy ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>
      {side}
    </span>
  );
}

function Pnl({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-text-tertiary">—</span>;
  return (
    <span className={clsx('font-mono font-bold tabular-nums', value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
      {value >= 0 ? '+' : '-'}${formatNumber(Math.abs(value))}
    </span>
  );
}

/**
 * AI Trades — the dedicated view for trades opened by AI strategy instances.
 * Open trades join `/ai-strategies/position-ids` with the live tradingStore
 * positions so P&L ticks in real time; closed history comes from the API.
 */
export default function AiTradesTab() {
  // Narrow selector — re-renders only when positions change (live P&L ticks).
  const positions = useTradingStore((s) => s.positions);

  const [aiIds, setAiIds] = useState<Set<string>>(() => new Set());
  const [openTrades, setOpenTrades] = useState<AiOpenTrade[]>([]);
  const [openLoading, setOpenLoading] = useState(true);
  const [closed, setClosed] = useState<AiClosedTrade[]>([]);
  const [closedLoading, setClosedLoading] = useState(true);

  const fetchOpen = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setOpenLoading(true);
    try {
      const [ids, trades] = await Promise.all([aiApi.positionIds(), aiApi.openTrades()]);
      setAiIds(new Set(ids?.position_ids ?? []));
      setOpenTrades(Array.isArray(trades) ? trades : []);
    } catch {
      // keep last-known state
    } finally {
      if (!opts.silent) setOpenLoading(false);
    }
  }, []);

  const fetchClosed = useCallback(async () => {
    setClosedLoading(true);
    try {
      const res = await aiApi.closedTrades();
      setClosed(Array.isArray(res) ? res : []);
    } catch {
      setClosed([]);
    } finally {
      setClosedLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOpen();
    void fetchClosed();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchOpen({ silent: true });
    }, 10_000);
    return () => clearInterval(t);
  }, [fetchOpen, fetchClosed]);

  /** Open rows: API rows overlaid with live store positions (real-time P&L),
   *  plus any store position flagged as AI that the trades endpoint hasn't
   *  reported yet. */
  const openRows = useMemo(() => {
    const byId = new Map(positions.map((p) => [p.id, p] as const));
    const seen = new Set<string>();
    const rows = openTrades.map((t) => {
      seen.add(t.position_id);
      const live = byId.get(t.position_id);
      return {
        position_id: t.position_id,
        strategy_name: t.strategy_name,
        symbol: live?.symbol ?? t.symbol,
        side: live?.side ?? t.side,
        lots: live?.lots ?? t.lots,
        open_price: live?.open_price ?? t.open_price,
        current_price: live?.current_price ?? t.current_price,
        profit: live ? netPnl(live) : t.profit,
        live: !!live,
      };
    });
    for (const p of positions) {
      if (aiIds.has(p.id) && !seen.has(p.id)) {
        rows.push({
          position_id: p.id,
          strategy_name: 'AI Strategy',
          symbol: p.symbol,
          side: p.side,
          lots: p.lots,
          open_price: p.open_price,
          current_price: p.current_price,
          profit: netPnl(p),
          live: true,
        });
      }
    }
    return rows;
  }, [openTrades, positions, aiIds]);

  const openTotal = openRows.reduce((s, r) => s + (Number.isFinite(r.profit as number) ? (r.profit as number) : 0), 0);

  const openPager = usePagination(openRows, 10);
  const closedPager = usePagination(closed, 10);
  return (
    <div className="space-y-6">
      {/* ── Open AI trades (live) ── */}
      <div className="bg-card border border-border-primary rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <LineChart size={15} className="text-[#E94E1B]" /> Open AI Trades
          </p>
          {openRows.length > 0 && (
            <p className="text-xs">Floating P&amp;L: <Pnl value={openTotal} /></p>
          )}
        </div>
        {openLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E94E1B] border-t-transparent" />
          </div>
        ) : openRows.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-10">No open AI trades right now</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="border-b border-border-primary text-text-tertiary text-left">
                  <th className="px-4 py-2.5 font-medium">Strategy</th>
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Side</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lots</th>
                  <th className="px-4 py-2.5 font-medium text-right">Open</th>
                  <th className="px-4 py-2.5 font-medium text-right">Current</th>
                  <th className="px-4 py-2.5 font-medium text-right pr-4">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {openPager.items.map((r) => (
                  <tr key={r.position_id} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                    <td className="px-4 py-3 text-text-secondary">{r.strategy_name}</td>
                    <td className="px-4 py-3 font-bold font-mono text-text-primary">{r.symbol}</td>
                    <td className="px-4 py-3"><SideBadge side={r.side} /></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{r.lots}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{r.open_price}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">
                      {r.current_price != null ? r.current_price : '—'}
                    </td>
                    <td className="px-4 py-3 text-right pr-4"><Pnl value={r.profit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...openPager.props} itemLabel="open trades" />
          </div>
        )}
      </div>

      {/* ── Closed AI trades (history) ── */}
      <div className="bg-card border border-border-primary rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="px-4 py-3 border-b border-border-primary">
          <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <History size={15} className="text-[#E94E1B]" /> Trade History
          </p>
        </div>
        {closedLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E94E1B] border-t-transparent" />
          </div>
        ) : closed.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-10">No closed AI trades yet</p>
        ) : (
          <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border-primary text-text-tertiary text-left">
                  <th className="px-4 py-2.5 font-medium">Strategy</th>
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Side</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lots</th>
                  <th className="px-4 py-2.5 font-medium text-right">Open</th>
                  <th className="px-4 py-2.5 font-medium text-right">Close</th>
                  <th className="px-4 py-2.5 font-medium text-right">P&amp;L</th>
                  <th className="px-4 py-2.5 font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closedPager.items.map((t) => (
                  <tr key={t.position_id} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                    <td className="px-4 py-3 text-text-secondary">{t.strategy_name}</td>
                    <td className="px-4 py-3 font-bold font-mono text-text-primary">{t.symbol}</td>
                    <td className="px-4 py-3"><SideBadge side={t.side} /></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{t.lots}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{t.open_price}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{t.close_price}</td>
                    <td className="px-4 py-3 text-right"><Pnl value={t.profit} /></td>
                    <td className="px-4 py-3 text-text-tertiary whitespace-nowrap">{formatDateTime(t.closed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...closedPager.props} itemLabel="closed trades" />
          </div>
        )}
      </div>
    </div>
  );
}
